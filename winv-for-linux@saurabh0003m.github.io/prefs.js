'use strict';
// SPDX-License-Identifier: GPL-2.0-or-later
/* exported init, fillPreferencesWindow */
// Preferences window (Extensions app > WinV for Linux > Settings), GNOME 42 / libadwaita.
//
// TODO(human): this file is still in the GNOME 42 format, so on GNOME 46+ the Settings window
// fails to open. Convert it to an ES module, like extension.js was:
//   - the imports at the top: `import Adw from 'gi://Adw';` (and Gio, Gtk), plus
//     `import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';`
//   - `init()` goes; `fillPreferencesWindow(window)` becomes a method of
//     `export default class WinvPreferences extends ExtensionPreferences { ... }`
//   - the settings come from `this.getSettings()` instead of ExtensionUtils
//   - 'use strict' and the `/* exported */` line go (modules are strict and export explicitly)
// Guide: https://gjs.guide/extensions/upgrading/gnome-shell-45.html#prefs-js
const { Adw, Gio, Gtk } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

const STYLES = [
    ['system', 'System theme'],
    ['windows', 'Windows 11'],
];

function init() {
}

function fillPreferencesWindow(window) {
    const settings = ExtensionUtils.getSettings();
    const page = new Adw.PreferencesPage();

    const look = new Adw.PreferencesGroup({ title: 'Look' });
    const style = new Adw.ComboRow({
        title: 'Panel style',
        subtitle: 'Take the colours of your GNOME theme, or look like Windows 11',
        model: Gtk.StringList.new(STYLES.map(([, label]) => label)),
    });
    style.selected = Math.max(STYLES.findIndex(([id]) => id === settings.get_string('panel-style')), 0);
    style.connect('notify::selected', () => settings.set_string('panel-style', STYLES[style.selected][0]));
    look.add(style);
    page.add(look);

    const historyGroup = new Adw.PreferencesGroup({ title: 'Clipboard history' });
    const size = new Adw.ActionRow({
        title: 'Items to keep',
        subtitle: 'Pinned items come on top of this. Unpinned ones are forgotten when you log out.',
    });
    const spin = Gtk.SpinButton.new_with_range(10, 100, 5);
    spin.valign = Gtk.Align.CENTER;
    settings.bind('history-size', spin, 'value', Gio.SettingsBindFlags.DEFAULT);
    size.add_suffix(spin);
    size.activatable_widget = spin;
    historyGroup.add(size);
    page.add(historyGroup);

    const keys = new Adw.PreferencesGroup({
        title: 'Shortcuts',
        description: 'To change them, see "Change the shortcuts" in the README.',
    });
    for (const [title, key] of [['Clipboard history', 'toggle-clipboard'], ['Emoji, kaomoji and symbols', 'toggle-emoji']]) {
        const row = new Adw.ActionRow({ title });
        row.add_suffix(new Gtk.Label({ label: settings.get_strv(key).map(accelLabel).join('  or  '), css_classes: ['dim-label'] }));
        keys.add(row);
    }
    page.add(keys);

    window.add(page);
}

function accelLabel(accel) {
    const [ok, key, mods] = Gtk.accelerator_parse(accel);
    return ok ? Gtk.accelerator_get_label(key, mods) : accel;
}
