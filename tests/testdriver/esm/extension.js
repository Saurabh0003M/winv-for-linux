// SPDX-License-Identifier: GPL-2.0-or-later
// Test-only: lets the test script run JavaScript in the shell (org.gnome.Shell.Eval) and take
// screenshots over D-Bus. Never install this on a real desktop.
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class TestDriver extends Extension {
    enable() {
        global.context.unsafe_mode = true;
    }

    disable() {
        global.context.unsafe_mode = false;
    }
}
