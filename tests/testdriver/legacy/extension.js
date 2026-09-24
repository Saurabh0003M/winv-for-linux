// SPDX-License-Identifier: GPL-2.0-or-later
// Test-only (GNOME 42): lets the test script run JavaScript in the shell (org.gnome.Shell.Eval)
// and take screenshots over D-Bus. Never install this on a real desktop.
/* exported init, enable, disable */
function init() {
}

function enable() {
    global.context.unsafe_mode = true;
}

function disable() {
    global.context.unsafe_mode = false;
}
