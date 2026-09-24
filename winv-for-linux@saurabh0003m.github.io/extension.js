// SPDX-License-Identifier: GPL-2.0-or-later
// WinV for Linux — a Windows 11 style Win+V / Win+. panel for GNOME Shell 46 and later
// (GNOME 42 has its own version in gnome-42/).
//   Super+V        clipboard history, text and images. Click an item (or arrows + Enter) to paste it
//                  into the app you were typing in. Pin keeps an item across restarts and "Clear all";
//                  the bin (or the Delete key) removes one.
//   Super+. or ;   the same panel on emoji, kaomoji and symbols. Typing searches emoji.
//   Esc, a click outside or Super+V again closes it.
// Unpinned history is kept in memory only, so a logout or reboot clears it, like Windows.
// Pinned items: ~/.local/share/winv-for-linux/ (only readable by you).
// Recent emoji and skin tone: ~/.config/winv-for-linux/state.json.
// Settings (look, history size, shortcuts): the extension's preferences, or gsettings with
//   --schemadir <this folder>/schemas on org.gnome.shell.extensions.winv-for-linux
import Clutter from 'gi://Clutter';
import GdkPixbuf from 'gi://GdkPixbuf';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as IBusManager from 'resource:///org/gnome/shell/misc/ibusManager.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Data from './data.js';
import * as Theme from './theme.js';

// What changed between the GNOME versions we support, in one place:
const SHELL_MAJOR = parseInt(Config.PACKAGE_VERSION);
// St widgets gained `orientation` in GNOME 48 and lost `vertical` in GNOME 51.
const VERTICAL = SHELL_MAJOR >= 48 ? { orientation: Clutter.Orientation.VERTICAL } : { vertical: true };
// GNOME 51 removed Clutter.get_default_backend().
const clutterBackend = () => global.stage.context?.get_backend?.() ?? Clutter.get_default_backend();

const MAX_TEXT_CHARS = 1024 * 1024;         // longer copies are not kept
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;    // bigger images are not kept
const PREVIEW_LINES = 4;                    // text shown per clipboard item
const PREVIEW_CHARS = 300;
const THUMB_W = 290, THUMB_H = 110;         // image preview box (px)
const MAX_RECENT = 32;                      // "Recently used" emoji / kaomoji / symbols
const MAX_SEARCH_RESULTS = 160;
const PASTE_DELAY_MS = 90;                  // lets the app get the keyboard back before we paste
const KEY_GAP_MS = 60;                      // between the synthetic key presses of a paste (see _pressKeys)
const RESTORE_DELAY_MS = 600;               // emoji sent through the clipboard: restore it after this

const DATA_DIR = GLib.build_filenamev([GLib.get_user_data_dir(), 'winv-for-linux']);
const PINNED_FILE = GLib.build_filenamev([DATA_DIR, 'pinned.json']);
const STATE_FILE = GLib.build_filenamev([GLib.get_user_config_dir(), 'winv-for-linux', 'state.json']);
const RUNTIME_DIR = GLib.build_filenamev([GLib.get_user_runtime_dir(), 'winv-for-linux', 'images']);

const CLIPBOARD = St.ClipboardType.CLIPBOARD;
const PRIMARY = St.ClipboardType.PRIMARY;
const TEXT_MIMES = ['text/plain;charset=utf-8', 'UTF8_STRING', 'text/plain', 'STRING'];
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/bmp', 'image/gif', 'image/webp'];
const FILES_MIME = 'x-special/gnome-copied-files';
// Left out of the history, like Windows: password managers and files copied in a file manager.
const SKIP_MIMES = ['x-kde-passwordManagerHint', FILES_MIME];

// evdev codes: the virtual keyboard presses physical keys, so pasting works with any layout.
// Text is pasted with Shift+Insert, which also works in terminals (we set PRIMARY to the same text).
const KEY_LEFTCTRL = 29, KEY_LEFTSHIFT = 42, KEY_V = 47, KEY_INSERT = 110;
const HELD_MODIFIERS = Clutter.ModifierType.SHIFT_MASK | Clutter.ModifierType.CONTROL_MASK |
    Clutter.ModifierType.MOD1_MASK | Clutter.ModifierType.MOD4_MASK | Clutter.ModifierType.SUPER_MASK;

const TABS = [
    { id: 'recent', icon: 'recent', name: 'Recently used' },
    { id: 'emoji', icon: 'emoji', name: 'Emoji' },
    { id: 'kaomoji', text: ';-)', name: 'Kaomoji' },
    { id: 'symbols', text: 'Ω', name: 'Symbols' },
    { id: 'clipboard', icon: 'clipboard', name: 'Clipboard history' },
];
const TONES = ['', 'light', 'medium-light', 'medium', 'medium-dark', 'dark'];
const TONE_MODIFIERS = ['', '🏻', '🏼', '🏽', '🏾', '🏿'];
const CELL_CLASS = { emoji: 'winv-emoji', symbols: 'winv-symbol', kaomoji: 'winv-kaomoji' };
const COLUMNS = { emoji: 8, symbols: 8, kaomoji: 2 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function readJson(path, fallback) {
    try {
        const [, contents] = GLib.file_get_contents(path);
        return JSON.parse(new TextDecoder().decode(contents));
    } catch (e) {
        return fallback;
    }
}

// 0600: clipboard contents can be private.
function writeFile(path, data) {
    GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700);
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    Gio.File.new_for_path(path).replace_contents(bytes, null, false,
        Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, null);
}

function removeFile(path) {
    try {
        Gio.File.new_for_path(path).delete(null);
    } catch (e) {
        // already gone
    }
}

function emptyDir(path) {
    let children;
    try {
        children = Gio.File.new_for_path(path).enumerate_children('standard::name',
            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    } catch (e) {
        return;
    }
    let info;
    while ((info = children.next_file(null)))
        removeFile(GLib.build_filenamev([path, info.get_name()]));
    children.close(null);
}

function preview(text) {
    const lines = text.replace(/\t/g, '    ').split('\n');
    while (lines.length > 1 && !lines[0].trim())
        lines.shift();
    let out = lines.slice(0, PREVIEW_LINES).join('\n');
    let cut = lines.length > PREVIEW_LINES;
    if (out.length > PREVIEW_CHARS) {
        out = out.slice(0, PREVIEW_CHARS);
        cut = true;
    }
    return cut ? `${out.trimEnd()}…` : out;
}

// Single code points with a text-style default (☺ ❤ ✈ …) need U+FE0F to show and paste in colour.
function emojiChar(e) {
    const code = e.code.trim();
    if (code.includes(' ') || parseInt(code, 16) >= 0x1F000)
        return e.char;
    return `${e.char}\uFE0F`;
}

// Module level on purpose: GNOME disables extensions while the screen is locked and the history
// must survive that. It does not survive gnome-shell restarting (logout, reboot), like Windows.
let history = null;   // { items: [{ kind: 'text'|'image', text, mime, hash, file, pinned, time }] }

function loadHistory() {
    if (history)
        return;
    history = { items: [] };
    emptyDir(RUNTIME_DIR);   // images of a previous session, whose history is gone
    const saved = readJson(PINNED_FILE, []);
    for (const s of Array.isArray(saved) ? saved : []) {
        if (s.kind === 'text' && typeof s.text === 'string' && s.text) {
            history.items.push({ kind: 'text', text: s.text, pinned: true, time: s.time || 0 });
        } else if (s.kind === 'image' && typeof s.file === 'string') {
            const file = GLib.build_filenamev([DATA_DIR, GLib.path_get_basename(s.file)]);
            if (GLib.file_test(file, GLib.FileTest.EXISTS)) {
                history.items.push({ kind: 'image', mime: s.mime || 'image/png', hash: s.hash, file,
                    pinned: true, time: s.time || 0 });
            }
        }
    }
    history.items.sort((a, b) => b.time - a.time);
}

class ClipboardPanel {
    constructor(extension) {
        this._path = extension.path;
        this._clipboard = St.Clipboard.get_default();
        this._timeouts = new Set();
        this._icons = {};
        this._suppress = 0;          // > 0 while we put something on the clipboard that isn't a copy
        this._serial = 0;            // bumped on every real clipboard change
        this._current = null;        // history item the clipboard holds right now, all formats intact
        this._isOpen = false;
        this._grab = null;
        this._tab = 'clipboard';
        this._pageActors = {};
        this._firstCell = {};
        this._clipCards = [];
        this._emoji = null;
        this._emojiSection = 0;
        this._sectionIndex = { kaomoji: 0, symbols: 0 };
        this._inserting = false;
        this._insertQueue = [];
        this._pressed = new Set();   // synthetic keys currently held down
        this._destroyed = false;

        const state = readJson(STATE_FILE, {});
        this._state = {
            recent: (Array.isArray(state.recent) ? state.recent : [])
                .filter(r => r && typeof r.text === 'string' && CELL_CLASS[r.kind]).slice(0, MAX_RECENT),
            skinTone: TONES[state.skinTone] !== undefined ? state.skinTone : 0,
        };
        loadHistory();

        const seat = clutterBackend().get_default_seat();
        this._keyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);

        this._selection = global.display.get_selection();
        // (when the app you copied from quits, mutter itself puts the last text/image back on the
        // clipboard, like Windows keeps it: that arrives here as one more change)
        this._ownerId = this._selection.connect('owner-changed', (selection, type) => {
            if (type === Meta.SelectionType.SELECTION_CLIPBOARD && !this._suppress)
                this._onClipboardChanged();
        });
        this._trackCaret();

        this._settings = extension.getSettings();
        this._freeShortcuts();
        const modes = Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW;
        Main.wm.addKeybinding('toggle-clipboard', this._settings, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            modes, () => this.toggle('clipboard'));
        Main.wm.addKeybinding('toggle-emoji', this._settings, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            modes, () => this.toggle('emoji'));

        this._interface = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
        this._monitorsId = Main.layoutManager.connect('monitors-changed', () => this.close());
        this._theme = null;
        this._settingsIds = [
            this._settings.connect('changed::panel-style', () => this._applyStyle()),
            this._settings.connect('changed::history-size', () => this._trim()),
        ];
        this._applyStyle();

        this._onClipboardChanged();   // whatever was copied before we started
    }

    // GNOME opens its notification list with Super+V as well as Super+M. When two bindings share
    // the same keys, which one wins is not fixed, so take ours out of that list (it keeps Super+M).
    // Stays that way after uninstalling; `install.sh --uninstall` puts it back.
    _freeShortcuts() {
        const ours = [...this._settings.get_strv('toggle-clipboard'), ...this._settings.get_strv('toggle-emoji')]
            .map(k => k.toLowerCase());
        const shell = new Gio.Settings({ schema_id: 'org.gnome.shell.keybindings' });
        const tray = shell.get_strv('toggle-message-tray');
        const kept = tray.filter(k => !ours.includes(k.toLowerCase()));
        if (kept.length !== tray.length)
            shell.set_strv('toggle-message-tray', kept);
    }

    // ---- history ----

    async _onClipboardChanged() {
        const serial = ++this._serial;
        this._current = null;
        const mimes = this._clipboard.get_mimetypes(CLIPBOARD);
        if (!mimes.length || mimes.some(m => SKIP_MIMES.includes(m)))
            return;
        try {
            let item = null;
            if (mimes.some(m => TEXT_MIMES.includes(m))) {
                const text = await this._getText(CLIPBOARD);
                if (serial === this._serial && !this._destroyed)
                    item = this._addText(text);
            } else {
                const mime = IMAGE_MIMES.find(m => mimes.includes(m)) ?? mimes.find(m => m.startsWith('image/'));
                if (!mime)
                    return;
                const data = await this._getContent(CLIPBOARD, mime);
                if (serial === this._serial && !this._destroyed)
                    item = this._addImage(mime, data);
            }
            if (item)
                this._current = item;
        } catch (e) {
            logError(e, 'winv-for-linux: reading the clipboard');
        }
    }

    _getText(type) {
        return new Promise(resolve => this._clipboard.get_text(type, (c, text) => resolve(text)));
    }

    // Resolves to a Uint8Array copy: the GBytes handed to the callback is only valid inside it
    // (keeping it past an await crashed gnome-shell with a double free).
    _getContent(type, mime) {
        return new Promise(resolve => this._clipboard.get_content(type, mime,
            (c, bytes) => resolve(bytes && bytes.get_size() ? bytes.get_data() : null)));
    }

    _addText(text) {
        if (!text || !text.trim() || text.length > MAX_TEXT_CHARS)
            return null;
        return this._remember(it => it.kind === 'text' && it.text === text, () => ({ kind: 'text', text }));
    }

    _addImage(mime, data) {
        if (!data || !data.length || data.length > MAX_IMAGE_BYTES)
            return null;
        const hash = GLib.compute_checksum_for_data(GLib.ChecksumType.SHA1, data);
        return this._remember(it => it.kind === 'image' && it.hash === hash, () => {
            const ext = mime.split('/')[1].replace(/[^a-z0-9]/g, '') || 'img';
            const file = GLib.build_filenamev([RUNTIME_DIR, `${hash}.${ext}`]);
            writeFile(file, data);
            return { kind: 'image', mime, hash, file };
        });
    }

    // New copies go on top; copying something that is already in the list moves it to the top.
    _remember(matches, create) {
        const items = history.items;
        let item = items.find(matches);
        if (item)
            items.splice(items.indexOf(item), 1);
        else
            item = { pinned: false, ...create() };
        item.time = GLib.get_real_time();
        items.unshift(item);
        this._trim();
        if (item.pinned)
            this._savePinned();
        this._refresh();
        return item;
    }

    // Keep the newest `history-size` unpinned items (Windows keeps 25); pinned ones never drop out.
    _trim() {
        const max = this._settings.get_int('history-size');
        let unpinned = 0;
        for (const item of [...history.items]) {
            if (!item.pinned && ++unpinned > max)
                this._forget(item);
        }
    }

    _forget(item) {
        const i = history.items.indexOf(item);
        if (i >= 0)
            history.items.splice(i, 1);
        if (item.kind === 'image')
            removeFile(item.file);
        if (this._current === item)
            this._current = null;
    }

    _delete(item) {
        const wasPinned = item.pinned;
        this._forget(item);
        if (wasPinned)
            this._savePinned();
    }

    _clearAll() {
        for (const item of [...history.items]) {
            if (!item.pinned)
                this._forget(item);
        }
    }

    _setPinned(item, pinned) {
        item.pinned = pinned;
        if (item.kind === 'image') {
            // pinned images go to disk, unpinned ones back to memory-backed /run/user
            const dir = pinned ? DATA_DIR : RUNTIME_DIR;
            const dest = GLib.build_filenamev([dir, GLib.path_get_basename(item.file)]);
            if (dest !== item.file) {
                try {
                    GLib.mkdir_with_parents(dir, 0o700);
                    Gio.File.new_for_path(item.file).move(Gio.File.new_for_path(dest),
                        Gio.FileCopyFlags.OVERWRITE, null, null);
                    item.file = dest;
                } catch (e) {
                    logError(e, 'winv-for-linux: moving a pinned image');
                }
            }
        }
        this._trim();
        this._savePinned();
    }

    _savePinned() {
        const pinned = history.items.filter(it => it.pinned).map(it => it.kind === 'text'
            ? { kind: 'text', text: it.text, time: it.time }
            : { kind: 'image', mime: it.mime, hash: it.hash, file: GLib.path_get_basename(it.file), time: it.time });
        try {
            writeFile(PINNED_FILE, JSON.stringify(pinned));
        } catch (e) {
            logError(e, 'winv-for-linux: saving pinned items');
        }
    }

    _putOnClipboard(item) {
        if (item.kind === 'text') {
            this._clipboard.set_text(CLIPBOARD, item.text);
            return;
        }
        try {
            const [, contents] = GLib.file_get_contents(item.file);
            this._clipboard.set_content(CLIPBOARD, item.mime, new GLib.Bytes(contents));
        } catch (e) {
            logError(e, 'winv-for-linux: image is gone');
        }
    }

    _addRecent(text, kind) {
        this._state.recent = [{ text, kind }, ...this._state.recent.filter(r => r.text !== text)]
            .slice(0, MAX_RECENT);
        this._saveState();
    }

    _saveState() {
        try {
            writeFile(STATE_FILE, JSON.stringify(this._state));
        } catch (e) {
            logError(e, 'winv-for-linux: saving state');
        }
    }

    // ---- pasting ----

    async _pasteItem(item) {
        // Windows: the item you paste becomes the clipboard content and moves to the top.
        // If it already is the clipboard content, leave it alone so rich formats survive.
        if (item !== this._current)
            this._putOnClipboard(item);
        if (item.kind === 'text')
            this._clipboard.set_text(PRIMARY, item.text);
        this.close();
        await this._sleep(PASTE_DELAY_MS);
        await this._waitForModifiers();
        await this._pressKeys(item.kind === 'image' ? [KEY_LEFTCTRL, KEY_V] : [KEY_LEFTSHIFT, KEY_INSERT]);
    }

    // Emoji, kaomoji, symbols. The panel stays open for more, like Windows; quick clicks queue up.
    async _insert(text, kind) {
        this._addRecent(text, kind);
        this._insertQueue.push(text);
        if (this._inserting)
            return;
        this._inserting = true;
        const focus = global.stage.key_focus;
        try {
            this._ungrab();   // the app gets the keyboard back while the panel stays up
            await this._sleep(PASTE_DELAY_MS);
            await this._waitForModifiers();
            // Native Wayland apps: type it through the input method, the clipboard stays untouched.
            // X11 apps don't talk to it: paste through the clipboard and put the old content back.
            for (let i = 0; i < 8 && !Main.inputMethod.currentFocus && !this._destroyed; i++)
                await this._sleep(25);
            while (this._insertQueue.length && !this._destroyed) {
                const batch = this._insertQueue.splice(0).join('');
                if (Main.inputMethod.currentFocus)
                    Main.inputMethod.commit(batch);
                else
                    await this._pasteThroughClipboard(batch);
            }
            if (this._destroyed)
                return;
            await this._sleep(60);
        } finally {
            this._inserting = false;
            this._insertQueue = [];
        }
        if (!this._isOpen || this._destroyed)
            return;
        if (!this._takeGrab())
            this.close();
        else if (focus && focus.mapped && this._panel.contains(focus))
            focus.grab_key_focus();
    }

    async _pasteThroughClipboard(text) {
        const saved = await this._snapshot();
        this._suppress++;
        try {
            this._clipboard.set_text(CLIPBOARD, text);
            this._clipboard.set_text(PRIMARY, text);
        } finally {
            this._suppress--;
        }
        const current = this._current;
        const serial = this._serial;
        await this._sleep(30);
        await this._pressKeys([KEY_LEFTSHIFT, KEY_INSERT]);
        await this._sleep(RESTORE_DELAY_MS);
        if (!saved || serial !== this._serial || this._destroyed)
            return;   // something new was copied meanwhile: keep it
        this._suppress++;
        try {
            if (saved.text !== undefined)
                this._clipboard.set_text(CLIPBOARD, saved.text);
            else
                this._clipboard.set_content(CLIPBOARD, saved.mime, new GLib.Bytes(saved.data));
        } finally {
            this._suppress--;
        }
        this._current = saved.text !== undefined ? current : null;
    }

    async _snapshot() {
        const mimes = this._clipboard.get_mimetypes(CLIPBOARD);
        if (!mimes.length)
            return null;
        if (!mimes.includes(FILES_MIME) && mimes.some(m => TEXT_MIMES.includes(m))) {
            const text = await this._getText(CLIPBOARD);
            return text !== null ? { text } : null;
        }
        const mime = mimes.includes(FILES_MIME) ? FILES_MIME : IMAGE_MIMES.find(m => mimes.includes(m)) ?? mimes[0];
        const data = await this._getContent(CLIPBOARD, mime);
        return data ? { mime, data } : null;
    }

    // Super (from Super+V) or Ctrl still held would turn Shift+Insert into another shortcut.
    async _waitForModifiers() {
        for (let i = 0; i < 50 && (global.get_pointer()[2] & HELD_MODIFIERS) && !this._destroyed; i++)
            await this._sleep(30);
    }

    // One key event at a time, like a person typing. gnome-shell hands every key to IBus and replays
    // it when IBus answers, but applies Shift/Ctrl to the app straight away: sent as one burst,
    // Shift+Insert reached apps as a bare Insert after Shift was already up, and nothing pasted.
    async _pressKeys(keys) {
        const events = [
            ...keys.map(key => [key, Clutter.KeyState.PRESSED]),
            ...[...keys].reverse().map(key => [key, Clutter.KeyState.RELEASED]),
        ];
        for (const [key, state] of events) {
            if (this._destroyed)
                return;
            this._keyboard.notify_key(GLib.get_monotonic_time(), key, state);
            if (state === Clutter.KeyState.PRESSED)
                this._pressed.add(key);
            else
                this._pressed.delete(key);
            await this._sleep(KEY_GAP_MS);
        }
    }

    _sleep(ms) {
        return new Promise(resolve => {
            const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
                this._timeouts.delete(id);
                resolve();
                return GLib.SOURCE_REMOVE;
            });
            this._timeouts.add(id);
        });
    }

    // ---- where to open: at the text cursor like Windows, else at the mouse ----

    // gnome-shell moves the IBus candidate popup to the text cursor of the focused app, for Wayland
    // (text-input) and X11 (IBus) apps alike: note every position it is given. Hooked on the method
    // rather than on the actor's position, which doesn't change when two windows put the cursor at
    // the same spot.
    _trackCaret() {
        this._caret = null;
        try {
            this._candidatePopup = IBusManager.getIBusManager()._candidatePopup;
        } catch (e) {
            this._candidatePopup = null;
        }
        const popup = this._candidatePopup;
        if (typeof popup?._setDummyCursorGeometry !== 'function')
            return;
        const original = popup._setDummyCursorGeometry;
        popup._setDummyCursorGeometry = (x, y, w, h) => {
            // a shell text field (ours, the overview search) has the keyboard: not an app's cursor
            this._caret = global.stage.key_focus ? null : { x, y, h, window: global.display.focus_window };
            return original.call(popup, x, y, w, h);
        };
    }

    _anchor() {
        const win = global.display.focus_window;
        const c = this._caret;
        if (c && win && c.window === win && !Main.overview.visible) {
            const r = win.get_frame_rect();
            if (c.x >= r.x && c.x < r.x + r.width && c.y >= r.y && c.y < r.y + r.height)
                return { x: c.x, y: c.y, h: Math.max(c.h, 1), caret: true };
        }
        const [x, y] = global.get_pointer();
        return { x, y, h: 0, caret: false };
    }

    _position(anchor) {
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const [, width] = this._panel.get_preferred_width(-1);
        const [, height] = this._panel.get_preferred_height(width);
        const rect = new Mtk.Rectangle({ x: Math.round(anchor.x), y: Math.round(anchor.y), width: 1, height: 1 });
        let monitor = global.display.get_monitor_index_for_rect(rect);
        if (monitor < 0)
            monitor = Main.layoutManager.primaryIndex;
        const area = Main.layoutManager.getWorkAreaForMonitor(monitor);
        const gap = 8 * scale;
        let x = anchor.caret ? anchor.x - 12 * scale : anchor.x;
        let y = anchor.y + anchor.h + gap;
        if (y + height > area.y + area.height)   // no room below: open above
            y = anchor.y - height - gap;
        x = clamp(x, area.x + gap, area.x + area.width - width - gap);
        y = clamp(y, area.y + gap, area.y + area.height - height - gap);
        this._panel.set_position(Math.round(x), Math.round(y));
    }

    // ---- open / close ----

    toggle(tab) {
        if (!this._isOpen)
            this.open(tab);
        else if (tab === 'clipboard' || this._tab === tab)
            this.close();
        else
            this._showTab(tab);
    }

    // "system": colours from the GNOME Shell theme (theme.js). "windows": stylesheet.css as it is,
    // dark or light following the desktop's dark style setting.
    _applyStyle() {
        const system = this._settings.get_string('panel-style') === 'system';
        if (system && !this._theme) {
            this._theme = new Theme.ThemeStyle();
        } else if (!system && this._theme) {
            this._theme.destroy();
            this._theme = null;
        }
        if (!this._panel)
            return;
        const light = !system && this._interface.get_string('color-scheme') !== 'prefer-dark';
        if (system)
            this._panel.add_style_class_name('winv-system');
        else
            this._panel.remove_style_class_name('winv-system');
        if (light)
            this._panel.add_style_class_name('winv-light');
        else
            this._panel.remove_style_class_name('winv-light');
    }

    open(tab) {
        if (this._isOpen)
            return;
        const anchor = this._anchor();   // before we take the keyboard from the app
        this._build();
        this._applyStyle();
        Main.uiGroup.set_child_above_sibling(this._container, null);
        this._container.show();
        if (!this._takeGrab()) {
            this._container.hide();
            return;
        }
        this._isOpen = true;
        this._showTab(tab);
        this._position(anchor);
        this._panel.remove_all_transitions();
        this._panel.opacity = 0;
        this._panel.translation_y = 12;
        this._panel.ease({
            opacity: 255,
            translation_y: 0,
            duration: 150,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    close() {
        if (!this._isOpen)
            return;
        this._isOpen = false;
        this._ungrab();
        this._panel.remove_all_transitions();
        this._container.hide();
        if (this._toneRow)
            this._toneRow.hide();
    }

    _takeGrab() {
        if (this._grab)
            return true;
        const grab = Main.pushModal(this._container, { actionMode: Shell.ActionMode.POPUP });
        // Up to GNOME 49 a grab can fail while something else holds the keyboard. GNOME 50
        // removed get_seat_state(): there a grab always succeeds, and GNOME's own dialogs stopped checking.
        if (grab.get_seat_state && grab.get_seat_state() !== Clutter.GrabState.ALL) {
            Main.popModal(grab);
            return false;
        }
        this._grab = grab;
        return true;
    }

    _ungrab() {
        if (!this._grab)
            return;
        Main.popModal(this._grab);
        this._grab = null;
    }

    // ---- panel ----

    _icon(name) {
        if (!this._icons[name])
            this._icons[name] = Gio.icon_new_for_string(`${this._path}/icons/${name}-symbolic.svg`);
        return this._icons[name];
    }

    _build() {
        if (this._container)
            return;
        // Full-screen and transparent: catches the click outside the panel that closes it.
        this._container = new St.Widget({ reactive: true, visible: false });
        this._container.add_constraint(new Clutter.BindConstraint({
            source: global.stage,
            coordinate: Clutter.BindCoordinate.ALL,
        }));
        this._container.connect('button-press-event', (actor, event) => {
            if (event.get_source() === this._container)
                this.close();
            return Clutter.EVENT_STOP;
        });
        this._container.connect('touch-event', (actor, event) => {
            if (event.type() === Clutter.EventType.TOUCH_BEGIN && event.get_source() === this._container)
                this.close();
            return Clutter.EVENT_PROPAGATE;
        });
        this._container.connect('key-press-event', (actor, event) => this._onKeyPress(event));
        Main.uiGroup.add_child(this._container);

        this._panel = new St.BoxLayout({ style_class: 'winv-panel', ...VERTICAL, reactive: true });
        this._container.add_child(this._panel);

        const tabs = new St.BoxLayout({ style_class: 'winv-tabs' });
        this._tabButtons = {};
        for (const tab of TABS) {
            const glyph = tab.icon
                ? new St.Icon({ gicon: this._icon(tab.icon), style_class: 'winv-tab-icon' })
                : new St.Label({ text: tab.text, style_class: 'winv-tab-text' });
            glyph.x_align = Clutter.ActorAlign.CENTER;
            const box = new St.BoxLayout({ ...VERTICAL, x_expand: true, y_align: Clutter.ActorAlign.CENTER });
            box.add_child(glyph);
            box.add_child(new St.Widget({ style_class: 'winv-tab-bar', x_align: Clutter.ActorAlign.CENTER }));
            const button = new St.Button({
                style_class: 'winv-tab', child: box, can_focus: true, track_hover: true, accessible_name: tab.name,
            });
            button.connect('clicked', () => this._showTab(tab.id));
            tabs.add_child(button);
            this._tabButtons[tab.id] = button;
        }
        this._panel.add_child(tabs);

        this._pages = new St.Widget({ layout_manager: new Clutter.BinLayout(), x_expand: true, y_expand: true });
        this._panel.add_child(this._pages);
    }

    _showTab(id, focusIndex = 0) {
        this._tab = id;
        for (const [tabId, button] of Object.entries(this._tabButtons))
            button.checked = tabId === id;
        if (!this._pageActors[id] || id === 'clipboard' || id === 'recent') {
            this._pageActors[id]?.destroy();
            this._pageActors[id] = this._buildPage(id);
            this._pages.add_child(this._pageActors[id]);
        }
        for (const [pageId, page] of Object.entries(this._pageActors))
            page.visible = pageId === id;
        if (this._toneRow)
            this._toneRow.hide();

        let target;
        if (id === 'clipboard')
            target = this._clipCards[clamp(focusIndex, 0, this._clipCards.length - 1)]?.card;
        else if (id === 'emoji')
            target = this._search;
        else
            target = this._firstCell[id];
        (target ?? this._tabButtons[id]).grab_key_focus();
    }

    _buildPage(id) {
        const page = new St.BoxLayout({ ...VERTICAL, style_class: 'winv-page', x_expand: true, y_expand: true });
        if (id === 'clipboard')
            this._buildClipboardPage(page);
        else if (id === 'emoji')
            this._buildEmojiPage(page);
        else if (id === 'recent')
            this._buildRecentPage(page);
        else if (id === 'kaomoji')
            this._buildSectionPage(page, 'kaomoji', Data.KAOMOJI);
        else
            this._buildSectionPage(page, 'symbols', Data.SYMBOLS.map(s => ({ ...s, items: s.chars.split(' ') })));
        return page;
    }

    _scroll() {
        return new St.ScrollView({
            style_class: 'winv-scroll',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
            x_expand: true,
            y_expand: true,
        });
    }

    _setScrollChild(scroll, child) {
        scroll.get_child()?.destroy();
        scroll.child = child;
        scroll.vadjustment.value = 0;
    }

    _emptyLabel(text) {
        const label = new St.Label({
            text, style_class: 'winv-empty', x_expand: true, y_expand: true,
            x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER,
        });
        label.clutter_text.set_line_wrap(true);
        label.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        label.clutter_text.set_line_alignment(Pango.Alignment.CENTER);
        return label;
    }

    _separator() {
        return new St.Widget({ style_class: 'winv-separator', x_expand: true });
    }

    // entries: [{ text, kind, name? }]; cells of one grid share a size (the kind of the first one)
    _grid(entries, scroll) {
        const kind = entries[0]?.kind ?? 'emoji';
        const grid = new St.BoxLayout({ ...VERTICAL, style_class: 'winv-grid', x_expand: true });
        const cells = [];
        let row = null;
        entries.forEach((entry, i) => {
            if (i % COLUMNS[kind] === 0) {
                row = new St.BoxLayout({ style_class: 'winv-grid-row' });
                grid.add_child(row);
            }
            const cell = new St.Button({
                style_class: `winv-cell ${CELL_CLASS[kind]}`, label: entry.text,
                can_focus: true, track_hover: true, accessible_name: entry.name ?? entry.text,
            });
            cell.connect('clicked', () => this._insert(entry.text, entry.kind).catch(e => logError(e, 'winv-for-linux')));
            cell.connect('key-focus-in', () => Util.ensureActorVisibleInScrollView(scroll, cell));
            row.add_child(cell);
            cells.push(cell);
        });
        return [grid, cells];
    }

    // -- clipboard history --

    _buildClipboardPage(page) {
        this._clipCards = [];
        const header = new St.BoxLayout({ style_class: 'winv-clip-header' });
        header.add_child(new St.Label({
            text: 'Clipboard history', style_class: 'winv-section-title', x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        }));
        if (history.items.some(it => !it.pinned)) {
            const clear = new St.Button({
                style_class: 'winv-text-btn', label: 'Clear all', can_focus: true, track_hover: true,
            });
            clear.connect('clicked', () => {
                this._clearAll();
                this._showTab('clipboard');
            });
            header.add_child(clear);
        }
        page.add_child(header);

        if (!history.items.length) {
            page.add_child(this._emptyLabel('Nothing here yet.\nCopy some text or an image and it shows up here.'));
            return;
        }
        const scroll = this._scroll();
        const list = new St.BoxLayout({ ...VERTICAL, style_class: 'winv-clip-list', x_expand: true });
        for (const item of history.items)
            list.add_child(this._clipCard(item, scroll));
        scroll.child = list;
        page.add_child(scroll);
    }

    _clipCard(item, scroll) {
        const index = this._clipCards.length;
        const row = new St.BoxLayout({ x_expand: true });
        let content;
        const [, width, height] = item.kind === 'image' ? GdkPixbuf.Pixbuf.get_file_info(item.file) : [];
        if (item.kind === 'image' && width && height) {
            // fit into THUMB_W x THUMB_H keeping the aspect ratio (the texture cache would stretch it)
            const fit = Math.min(THUMB_W / width, THUMB_H / height, 2);
            content = new St.Bin({ style_class: 'winv-clip-image', x_expand: true, x_align: Clutter.ActorAlign.START });
            const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
            content.set_child(St.TextureCache.get_default().load_file_async(Gio.File.new_for_path(item.file),
                Math.round(width * fit), Math.round(height * fit), scale, this._panel.get_resource_scale()));
        } else {
            content = new St.Label({
                text: item.kind === 'image' ? 'Image' : preview(item.text), style_class: 'winv-clip-text',
                x_expand: true, y_align: Clutter.ActorAlign.START,
            });
            content.clutter_text.set_line_wrap(true);
            content.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
            content.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        }
        row.add_child(content);

        const actions = new St.BoxLayout({ style_class: 'winv-clip-actions', y_align: Clutter.ActorAlign.START });
        const pin = this._miniButton(item.pinned ? 'pinned' : 'pin', item.pinned ? 'Unpin' : 'Pin');
        if (item.pinned)
            pin.add_style_class_name('winv-pinned');
        const del = this._miniButton('delete', 'Delete');
        actions.add_child(pin);
        actions.add_child(del);
        row.add_child(actions);

        const card = new St.Button({
            style_class: 'winv-clip', child: row, can_focus: true, track_hover: true, x_expand: true,
            accessible_name: item.kind === 'image' ? 'Image' : preview(item.text),
        });
        card.connect('clicked', () => this._pasteItem(item).catch(e => logError(e, 'winv-for-linux')));
        pin.connect('clicked', () => {
            this._setPinned(item, !item.pinned);
            this._showTab('clipboard', index);
        });
        del.connect('clicked', () => {
            this._delete(item);
            this._showTab('clipboard', index);
        });
        for (const actor of [card, pin, del])
            actor.connect('key-focus-in', () => Util.ensureActorVisibleInScrollView(scroll, card));
        this._clipCards.push({ card, pin, del, item });
        return card;
    }

    _miniButton(icon, name) {
        return new St.Button({
            style_class: 'winv-mini', can_focus: true, track_hover: true, accessible_name: name,
            child: new St.Icon({ gicon: this._icon(icon), style_class: 'winv-mini-icon' }),
        });
    }

    _refresh() {
        if (!this._isOpen || this._tab !== 'clipboard')
            return;
        const focus = global.stage.key_focus;
        this._showTab('clipboard', Math.max(this._clipCards.findIndex(c => c.card === focus), 0));
    }

    // -- emoji --

    _loadEmoji() {
        if (this._emoji)
            return this._emoji;
        const sections = Data.EMOJI_SECTIONS.map(s => ({ ...s, items: [] }));
        let list = [];
        try {
            const file = Gio.File.new_for_uri('resource:///org/gnome/shell/osk-layouts/emoji.json');
            const [, contents] = file.load_contents(null);
            list = JSON.parse(new TextDecoder().decode(contents));
        } catch (e) {
            logError(e, 'winv-for-linux: no emoji list');
        }
        const byName = new Map();
        let section = null;
        for (const e of list) {
            section = sections.find(s => s.first === e.name) ?? section;
            const variant = e.name.match(/^(.+): (light|medium-light|medium|medium-dark|dark) skin tone$/);
            if (variant) {
                const base = byName.get(variant[1]);
                if (base)
                    base.tones[TONES.indexOf(variant[2])] = e.char;
                continue;
            }
            if (!section || e.name.includes('skin tone'))   // two-tone combinations
                continue;
            const name = e.name.replace(/^⊛ /, '');
            const item = { char: emojiChar(e), name, search: name.toLowerCase(), tones: [] };
            section.items.push(item);
            byName.set(e.name, item);
        }
        this._emoji = sections;
        return sections;
    }

    _buildEmojiPage(page) {
        const sections = this._loadEmoji();
        this._search = new St.Entry({
            style_class: 'winv-search', hint_text: 'Search emoji', can_focus: true, x_expand: true,
        });
        this._search.set_primary_icon(new St.Icon({ gicon: this._icon('search'), style_class: 'winv-search-icon' }));
        this._search.clutter_text.connect('text-changed', () => this._renderEmoji());
        this._search.clutter_text.connect('activate', () => {
            const first = this._emojiShown?.[0];
            if (first)
                this._insert(first.text, 'emoji').catch(e => logError(e, 'winv-for-linux'));
        });
        page.add_child(this._search);
        this._emojiTitle = new St.Label({ style_class: 'winv-section-title' });
        page.add_child(this._emojiTitle);
        this._emojiScroll = this._scroll();
        page.add_child(this._emojiScroll);

        // skin tone picker, like the hand button at the bottom right in Windows
        this._toneRow = new St.BoxLayout({ style_class: 'winv-tone-row', visible: false, x_align: Clutter.ActorAlign.END });
        TONES.forEach((tone, i) => {
            const b = new St.Button({
                style_class: 'winv-cell winv-emoji', label: `✋${TONE_MODIFIERS[i]}`, can_focus: true,
                track_hover: true, accessible_name: tone ? `${tone} skin tone` : 'Default skin tone',
            });
            b.connect('clicked', () => {
                this._state.skinTone = i;
                this._saveState();
                this._toneButton.label = `✋${TONE_MODIFIERS[i]}`;
                this._toneRow.hide();
                this._renderEmoji();
                this._toneButton.grab_key_focus();
            });
            this._toneRow.add_child(b);
        });
        page.add_child(this._toneRow);

        page.add_child(this._separator());
        const bar = new St.BoxLayout({ style_class: 'winv-bottom-bar' });
        this._emojiSectionButtons = sections.map((s, i) => {
            const b = new St.Button({
                style_class: 'winv-bottom-btn', label: s.icon, can_focus: true, track_hover: true, accessible_name: s.name,
            });
            b.connect('clicked', () => {
                this._emojiSection = i;
                if (this._search.text)
                    this._search.text = '';   // re-renders
                else
                    this._renderEmoji();
            });
            bar.add_child(b);
            return b;
        });
        this._toneButton = new St.Button({
            style_class: 'winv-bottom-btn', label: `✋${TONE_MODIFIERS[this._state.skinTone]}`, can_focus: true,
            track_hover: true, accessible_name: 'Skin tone', x_expand: true, x_align: Clutter.ActorAlign.END,
        });
        this._toneButton.connect('clicked', () => {
            this._toneRow.visible = !this._toneRow.visible;
            if (this._toneRow.visible)
                this._toneRow.get_child_at_index(this._state.skinTone).grab_key_focus();
        });
        bar.add_child(this._toneButton);
        page.add_child(bar);
        this._renderEmoji();
    }

    _renderEmoji() {
        const sections = this._loadEmoji();
        const query = this._search.text.trim().toLowerCase();
        let items, title;
        if (query) {
            const words = query.split(/\s+/);
            items = sections.flatMap(s => s.items).filter(e => words.every(w => e.search.includes(w)))
                .slice(0, MAX_SEARCH_RESULTS);
            title = items.length ? 'Search results' : 'No emoji found';
        } else {
            items = sections[this._emojiSection].items;
            title = sections[this._emojiSection].name;
        }
        const tone = this._state.skinTone;
        this._emojiShown = items.map(e => ({ text: (tone && e.tones[tone]) || e.char, kind: 'emoji', name: e.name }));
        this._emojiTitle.text = title;
        this._emojiSectionButtons.forEach((b, i) => (b.checked = !query && i === this._emojiSection));
        const [grid, cells] = this._grid(this._emojiShown, this._emojiScroll);
        this._setScrollChild(this._emojiScroll, grid);
        this._firstCell.emoji = cells[0];
    }

    // -- kaomoji, symbols --

    _buildSectionPage(page, kind, sections) {
        const title = new St.Label({ style_class: 'winv-section-title' });
        const scroll = this._scroll();
        page.add_child(title);
        page.add_child(scroll);
        page.add_child(this._separator());

        // kaomoji sections have names, too long for icon buttons: one row of chips that scrolls sideways
        const bar = new St.BoxLayout({ style_class: kind === 'kaomoji' ? 'winv-chips' : 'winv-bottom-bar' });
        const render = i => {
            this._sectionIndex[kind] = i;
            title.text = sections[i].name;
            buttons.forEach((b, j) => (b.checked = j === i));
            const [grid, cells] = this._grid(sections[i].items.map(text => ({ text, kind })), scroll);
            this._setScrollChild(scroll, grid);
            this._firstCell[kind] = cells[0];
        };
        const buttons = sections.map((s, i) => {
            const b = new St.Button({
                style_class: kind === 'kaomoji' ? 'winv-chip' : 'winv-bottom-btn',
                label: kind === 'kaomoji' ? s.name : s.icon, can_focus: true, track_hover: true, accessible_name: s.name,
            });
            b.connect('clicked', () => render(i));
            bar.add_child(b);
            return b;
        });
        page.add_child(kind === 'kaomoji' ? this._sideScroll(bar) : bar);
        render(this._sectionIndex[kind]);
    }

    // A row that scrolls sideways, also with an ordinary (vertical) mouse wheel.
    _sideScroll(row) {
        const scroll = new St.ScrollView({
            style_class: 'winv-chip-scroll', x_expand: true,
            hscrollbar_policy: St.PolicyType.EXTERNAL, vscrollbar_policy: St.PolicyType.NEVER,
        });
        scroll.child = row;
        // a scrolling box lays children out at their minimum width: don't let labels shrink to "…"
        // (an St.Button label is a plain ClutterText in GNOME 42)
        for (const chip of row.get_children())
            chip.get_child().set_ellipsize(Pango.EllipsizeMode.NONE);
        const adjustment = scroll.hadjustment;   // (hscroll, the scroll bar, went in GNOME 50)
        scroll.connect('scroll-event', (actor, event) => {
            const direction = event.get_scroll_direction();
            let delta;
            if (direction === Clutter.ScrollDirection.SMOOTH) {
                const [dx, dy] = event.get_scroll_delta();
                delta = dx + dy;
            } else {
                delta = direction === Clutter.ScrollDirection.UP || direction === Clutter.ScrollDirection.LEFT ? -1 : 1;
            }
            adjustment.value += delta * 60;
            return Clutter.EVENT_STOP;
        });
        for (const chip of row.get_children()) {
            chip.connect('key-focus-in', () => {
                const [value, , , , , pageSize] = adjustment.get_values();
                if (chip.allocation.x1 < value)
                    adjustment.value = chip.allocation.x1;
                else if (chip.allocation.x2 > value + pageSize)
                    adjustment.value = chip.allocation.x2 - pageSize;
            });
        }
        return scroll;
    }

    // -- recently used --

    _buildRecentPage(page) {
        page.add_child(new St.Label({ text: 'Recently used', style_class: 'winv-section-title' }));
        const recent = this._state.recent;
        this._firstCell.recent = null;
        if (!recent.length) {
            page.add_child(this._emptyLabel('Emoji, kaomoji and symbols you use show up here.'));
            return;
        }
        const scroll = this._scroll();
        const box = new St.BoxLayout({ ...VERTICAL, style_class: 'winv-recent', x_expand: true });
        for (const kind of ['emoji', 'symbols', 'kaomoji']) {
            const entries = recent.filter(r => r.kind === kind);
            if (!entries.length)
                continue;
            const [grid, cells] = this._grid(entries, scroll);
            box.add_child(grid);
            this._firstCell.recent ??= cells[0];
        }
        scroll.child = box;
        page.add_child(scroll);
    }

    // -- keyboard --

    _onKeyPress(event) {
        const sym = event.get_key_symbol();
        const mods = event.get_state();
        const focus = global.stage.key_focus;   // inside the search box this is its ClutterText
        const inSearch = !!this._search && focus === this._search.clutter_text;

        if (sym === Clutter.KEY_Escape) {
            if (this._toneRow?.visible && this._tab === 'emoji') {
                this._toneRow.hide();
                this._toneButton.grab_key_focus();
            } else {
                this.close();
            }
            return Clutter.EVENT_STOP;
        }
        if (mods & (Clutter.ModifierType.MOD4_MASK | Clutter.ModifierType.SUPER_MASK)) {
            if (sym === Clutter.KEY_v || sym === Clutter.KEY_V) {
                this.close();
                return Clutter.EVENT_STOP;
            }
            if (sym === Clutter.KEY_period || sym === Clutter.KEY_semicolon) {
                this._showTab('emoji');
                return Clutter.EVENT_STOP;
            }
        }

        // clipboard list: up/down between items, right/left to the pin and bin buttons, Delete removes
        const c = this._tab === 'clipboard'
            ? this._clipCards.find(cc => focus === cc.card || focus === cc.pin || focus === cc.del) : null;
        if (c) {
            const i = this._clipCards.indexOf(c);
            if (sym === Clutter.KEY_Down || sym === Clutter.KEY_Up) {
                const j = i + (sym === Clutter.KEY_Down ? 1 : -1);
                if (j >= 0 && j < this._clipCards.length)
                    this._clipCards[j].card.grab_key_focus();
                else if (j < 0)
                    this._tabButtons.clipboard.grab_key_focus();
                return Clutter.EVENT_STOP;
            }
            // (St doesn't move focus inside a focusable card on its own)
            if (sym === Clutter.KEY_Right && focus !== c.del) {
                (focus === c.card ? c.pin : c.del).grab_key_focus();
                return Clutter.EVENT_STOP;
            }
            if (sym === Clutter.KEY_Left && focus !== c.card) {
                (focus === c.del ? c.pin : c.card).grab_key_focus();
                return Clutter.EVENT_STOP;
            }
            if (sym === Clutter.KEY_Delete || sym === Clutter.KEY_KP_Delete) {
                this._delete(c.item);
                this._showTab('clipboard', i);
                return Clutter.EVENT_STOP;
            }
        }

        // typing on the emoji tab searches, like Windows
        const ch = event.get_key_unicode();
        if (this._tab === 'emoji' && !inSearch && ch && ch.codePointAt(0) > 0x20 &&
            ch.codePointAt(0) !== 0x7f &&
            !(mods & (Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD1_MASK))) {
            this._search.grab_key_focus();
            this._search.text += ch;
            this._search.clutter_text.set_cursor_position(-1);
            return Clutter.EVENT_STOP;
        }

        const direction = {
            [Clutter.KEY_Up]: St.DirectionType.UP,
            [Clutter.KEY_Down]: St.DirectionType.DOWN,
            [Clutter.KEY_Left]: St.DirectionType.LEFT,
            [Clutter.KEY_Right]: St.DirectionType.RIGHT,
            [Clutter.KEY_Tab]: St.DirectionType.TAB_FORWARD,
            [Clutter.KEY_ISO_Left_Tab]: St.DirectionType.TAB_BACKWARD,
        }[sym];
        if (direction !== undefined) {
            // from the search box, start at its ClutterText: St.Entry itself would just refocus itself
            const from = focus && this._panel.contains(focus) ? focus : null;
            const tab = direction === St.DirectionType.TAB_FORWARD || direction === St.DirectionType.TAB_BACKWARD;
            this._panel.navigate_focus(from, direction, tab);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    destroy() {
        this._destroyed = true;
        this.close();
        for (const id of this._timeouts)
            GLib.source_remove(id);
        this._timeouts.clear();
        Main.wm.removeKeybinding('toggle-clipboard');
        Main.wm.removeKeybinding('toggle-emoji');
        this._selection.disconnect(this._ownerId);
        if (this._candidatePopup)
            delete this._candidatePopup._setDummyCursorGeometry;   // back to the class method
        Main.layoutManager.disconnect(this._monitorsId);
        for (const id of this._settingsIds)
            this._settings.disconnect(id);
        this._theme?.destroy();
        this._theme = null;
        this._container?.destroy();
        this._container = null;
        // disabled halfway through a paste: never leave a synthetic Shift/Ctrl held down
        for (const key of this._pressed)
            this._keyboard.notify_key(GLib.get_monotonic_time(), key, Clutter.KeyState.RELEASED);
        this._pressed.clear();
        this._keyboard = null;
    }
}

// The panel is reachable from Looking Glass (Alt+F2, lg) and the tests as
// Main.extensionManager.lookup('winv-for-linux@saurabh0003m.github.io').stateObj.panel
export default class WinvExtension extends Extension {
    enable() {
        this.panel = new ClipboardPanel(this);
    }

    disable() {
        this.panel?.destroy();
        this.panel = null;
    }
}
