'use strict';
/* exported ThemeStyle */
// "Match the system theme" look. Reads three colours from the active GNOME Shell theme (Yaru and
// its accent variants, Adwaita, Sweet, ...) through St's own style engine, so whatever the theme
// file says is what we get:
//   background  .popup-menu-content background      (the theme's menus)
//   text        .popup-menu-content text colour
//   accent      StEntry selection-background-color  (Yaru: orange or the chosen accent)
// Every other shade is mixed from those, and the result is loaded as a small generated
// stylesheet with rules under ".winv-panel.winv-system" that override stylesheet.css.
const { Gio, GLib, St } = imports.gi;
const Main = imports.ui.main;

const RUNTIME_DIR = GLib.build_filenamev([GLib.get_user_runtime_dir(), 'winv-for-linux']);
const FALLBACK_ACCENT = { r: 53, g: 132, b: 228, a: 1 };   // GNOME blue

// Colours are plain objects: r, g, b in 0-255, a in 0-1.
const fromClutter = c => ({ r: c.red, g: c.green, b: c.blue, a: c.alpha / 255 });
const css = c => `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${(c.a ?? 1).toFixed(3)})`;
const withAlpha = (c, a) => ({ ...c, a });
// t = 0 gives a, t = 1 gives b
const mix = (a, b, t) => ({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: 1,
});

// Black or white, whichever is easier to read on top of `color`. Used for the text on accent
// coloured chips, to pick a menu background when the theme gives none, and to tell dark themes
// from light ones (white is readable on dark backgrounds).
// WCAG relative luminance, but with the cut-off at 0.4 instead of the contrast-neutral 0.179:
// like Ubuntu and GNOME themselves, saturated accents (Yaru orange, GNOME blue) get white text and
// only light accents (yellow, light cyan) get black.
function readableOn(color) {
    const linear = v => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
    return luminance > 0.4 ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
}

var ThemeStyle = class {
    constructor() {
        this._file = null;
        this._css = '';
        this._serial = 0;
        this._idleId = 0;

        // Probes: never shown, only styled by the theme like a real menu with an entry in it.
        this._menu = new St.Widget({ style_class: 'popup-menu', visible: false });
        this._content = new St.Widget({ style_class: 'popup-menu-content' });
        this._entry = new St.Entry();
        this._menu.add_child(this._content);
        this._content.add_child(this._entry);
        Main.uiGroup.add_child(this._menu);

        // Emitted on a theme switch (User Themes, Ubuntu's accent colour, light/dark) and also when
        // our own stylesheet loads; _update() ignores the latter because the CSS comes out the same.
        this._context = St.ThemeContext.get_for_stage(global.stage);
        this._changedId = this._context.connect('changed', () => this._queueUpdate());
        this._update();
    }

    _queueUpdate() {
        if (this._idleId)
            return;
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idleId = 0;
            this._update();
            return GLib.SOURCE_REMOVE;
        });
    }

    _read() {
        const node = this._content.get_theme_node();
        const fg = { ...fromClutter(node.get_foreground_color()), a: 1 };
        let bg = fromClutter(node.get_background_color());
        if (bg.a < 0.5)   // theme paints its menus some other way: a neutral shade opposite the text
            bg = mix(readableOn(fg), fg, 0.1);
        const [found, selection] = this._entry.get_theme_node().lookup_color('selection-background-color', false);
        const accent = found ? { ...fromClutter(selection), a: 1 } : FALLBACK_ACCENT;
        const radius = Math.round(node.get_border_radius(St.Corner.TOPLEFT) / this._context.scale_factor);
        return { bg: withAlpha(bg, Math.max(bg.a, 0.97)), fg, accent, radius: Math.min(Math.max(radius, 6), 16) };
    }

    _stylesheet({ bg, fg, accent, radius }) {
        const P = '.winv-panel.winv-system';
        const shade = t => css(mix(bg, fg, t));
        const dim = a => css(withAlpha(fg, a));
        const text = css(fg);
        const onAccent = css(readableOn(accent));
        const dark = readableOn(bg).r > 127;
        return `
${P} { background-color: ${css(bg)}; color: ${text}; border-color: ${shade(0.14)}; border-radius: ${radius}px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, ${dark ? 0.55 : 0.25}); }
${P} .winv-tab { color: ${dim(0.7)}; }
${P} .winv-tab:hover { background-color: ${shade(0.07)}; color: ${text}; }
${P} .winv-tab:checked { color: ${text}; }
${P} .winv-tab:checked .winv-tab-bar { background-color: ${css(accent)}; }
${P} .winv-section-title { color: ${dim(0.92)}; }
${P} .winv-empty { color: ${dim(0.6)}; }
${P} .winv-separator { background-color: ${shade(0.1)}; }
${P} .winv-search { background-color: ${shade(0.06)}; border-color: ${shade(0.14)}; color: ${text}; caret-color: ${text};
  selection-background-color: ${css(accent)}; selected-color: ${onAccent}; }
${P} .winv-search:focus { background-color: ${shade(0.03)}; box-shadow: inset 0 -2px 0 0 ${css(accent)}; }
${P} .winv-search StLabel.hint-text { color: ${dim(0.55)}; }
${P} .winv-search-icon { color: ${dim(0.7)}; }
${P} .winv-cell, ${P} .winv-bottom-btn { color: ${text}; }
${P} .winv-cell:hover, ${P} .winv-bottom-btn:hover, ${P} .winv-mini:hover { background-color: ${shade(0.09)}; }
${P} .winv-bottom-btn:checked { background-color: ${shade(0.13)}; }
${P} .winv-tone-row { background-color: ${shade(0.12)}; }
${P} .winv-chip { color: ${dim(0.85)}; background-color: ${shade(0.07)}; }
${P} .winv-chip:hover { background-color: ${shade(0.12)}; }
${P} .winv-chip:checked { background-color: ${css(accent)}; color: ${onAccent}; }
${P} .winv-text-btn { color: ${text}; background-color: ${shade(0.07)}; border-color: ${shade(0.12)}; }
${P} .winv-text-btn:hover { background-color: ${shade(0.12)}; }
${P} .winv-clip { background-color: ${shade(0.05)}; border-color: ${shade(0.08)}; border-radius: ${Math.max(radius - 4, 4)}px; }
${P} .winv-clip:hover { background-color: ${shade(0.09)}; }
${P} .winv-clip-text { color: ${dim(0.95)}; }
${P} .winv-mini { color: ${dim(0.6)}; }
${P} .winv-mini:hover { color: ${text}; }
${P} .winv-mini.winv-pinned { color: ${css(accent)}; }
${P} .winv-tab:focus, ${P} .winv-cell:focus, ${P} .winv-bottom-btn:focus, ${P} .winv-chip:focus,
${P} .winv-text-btn:focus, ${P} .winv-clip:focus, ${P} .winv-mini:focus { box-shadow: inset 0 0 0 2px ${css(accent)}; }
`;
    }

    _update() {
        const stylesheet = this._stylesheet(this._read());
        if (stylesheet === this._css && this._file)
            return;
        this._css = stylesheet;
        // a new file name each time: St keeps loaded stylesheets per file
        GLib.mkdir_with_parents(RUNTIME_DIR, 0o700);
        const file = Gio.File.new_for_path(GLib.build_filenamev([RUNTIME_DIR, `theme-${++this._serial}.css`]));
        file.replace_contents(new TextEncoder().encode(stylesheet), null, false,
            Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        this._unload();
        this._context.get_theme().load_stylesheet(file);
        this._file = file;
    }

    _unload() {
        if (!this._file)
            return;
        this._context.get_theme().unload_stylesheet(this._file);
        this._file.delete(null);
        this._file = null;
    }

    destroy() {
        if (this._idleId)
            GLib.source_remove(this._idleId);
        this._context.disconnect(this._changedId);
        this._unload();
        this._menu.destroy();
    }
};
