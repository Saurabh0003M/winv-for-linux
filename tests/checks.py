#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Starts a headless GNOME Shell with WinV and the test driver, then checks that WinV works:
it loads without errors, remembers what is copied, pastes it into a GTK app with a click (with
IBus running, as on a real desktop), inserts emoji, follows the theme and survives being turned
off and on. Screenshots, shell.log and results.txt go to /out.
Runs inside the test container under dbus-run-session: see inside.sh and run.sh."""
import json
import os
import shutil
import subprocess
import sys
import time

from gi.repository import Gio, GLib

UUID = 'winv-for-linux@saurabh0003m.github.io'
GNOME = int(sys.argv[1])
EXT_DIR = sys.argv[2]
OUT = '/out'
TYPED = '/tmp/typed.txt'   # what the paste target app holds
PANEL = f"Main.extensionManager.lookup('{UUID}').stateObj.panel"
WAYLAND_DISPLAY = 'wayland-winv'

results = []
bus = Gio.bus_get_sync(Gio.BusType.SESSION)


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  (' + str(detail) + ')' if detail != '' else ''}", flush=True)


def call(dest, path, iface, method, args, reply, timeout=10000):
    return bus.call_sync(dest, path, iface, method, args, GLib.VariantType(reply),
                         Gio.DBusCallFlags.NONE, timeout, None).unpack()


def ev(js):
    """Runs JavaScript in the shell and returns its (JSON) result."""
    ok, out = call('org.gnome.Shell', '/org/gnome/Shell', 'org.gnome.Shell', 'Eval',
                   GLib.Variant('(s)', (js,)), '(bs)')
    if not ok:
        raise RuntimeError(out or 'Eval refused (unsafe mode off?)')
    return json.loads(out) if out else None


def wait(condition, timeout=10.0, step=0.1):
    end = time.time() + timeout
    while time.time() < end:
        try:
            value = condition()
            if value:
                return value
        except Exception:   # not there yet
            pass
        time.sleep(step)
    return None


def screenshot(name):
    call('org.gnome.Shell.Screenshot', '/org/gnome/Shell/Screenshot', 'org.gnome.Shell.Screenshot',
         'Screenshot', GLib.Variant('(bbs)', (False, False, f'{OUT}/{name}.png')), '(bs)')


def typed():
    try:
        with open(TYPED, encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return ''


def gsettings(*args, schemadir=None):
    cmd = ['gsettings'] + (['--schemadir', schemadir] if schemadir else []) + list(args)
    subprocess.run(cmd, check=True)


def winv_setting(key, value):
    gsettings('set', 'org.gnome.shell.extensions.winv-for-linux', key, value, schemadir=f'{EXT_DIR}/schemas')


def start_shell():
    gsettings('set', 'org.gnome.shell', 'enabled-extensions', f"['{UUID}', 'testdriver@winv-for-linux']")
    gsettings('set', 'org.gnome.shell', 'disable-extension-version-validation', 'true')   # test future GNOME too
    gsettings('set', 'org.gnome.shell', 'welcome-dialog-last-shown-version', "'9999'")
    # a real desktop always has IBus; without it the tests miss bugs (see _pressKeys in extension.js)
    subprocess.run(['ibus-daemon', '--daemonize', '--panel', 'disable'], check=False)
    options = subprocess.run(['gnome-shell', '--help-all'], capture_output=True, text=True).stdout
    args = ['gnome-shell', '--headless', '--virtual-monitor', '1280x800', '--wayland-display', WAYLAND_DISPLAY]
    if '--wayland ' in options:
        args.insert(1, '--wayland')
    log = open(f'{OUT}/shell.log', 'w')
    return subprocess.Popen(args, stdout=log, stderr=subprocess.STDOUT,
                            env=dict(os.environ, GIO_USE_VFS='local'))


def main():
    shell = start_shell()
    try:
        run_checks()
    finally:
        # IBus first: when the shell goes away under it, ibus-daemon can abort, and on the host
        # Ubuntu's crash reporter then pops up "System program problem detected"
        subprocess.run(['ibus', 'exit'], check=False, capture_output=True)
        shell.terminate()
        try:
            shell.wait(10)
        except subprocess.TimeoutExpired:
            shell.kill()

    errors = [line for line in open(f'{OUT}/shell.log', encoding='utf-8', errors='replace')
              if 'winv' in line.lower() and ('error' in line.lower() or 'exception' in line.lower())]
    check('no WinV errors in the shell log', not errors, ' | '.join(e.strip() for e in errors[:3]))
    with open(f'{OUT}/results.txt', 'w', encoding='utf-8') as f:
        for name, ok, detail in results:
            f.write(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}\n")
    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)} passed, {len(failed)} failed')
    sys.exit(1 if failed else 0)


def run_checks():
    state = wait(lambda: ev(f"""(() => {{
        const e = Main.extensionManager.lookup('{UUID}');
        return e && e.state !== undefined ? {{ state: e.state, error: e.error ? String(e.error) : '' }} : null;
    }})()"""), timeout=60, step=0.5)
    check('shell started and Eval works', state is not None)
    if state is None:
        return
    # ExtensionState: 1 = ENABLED (GNOME 42) / ACTIVE (46+)
    check('WinV loads without errors', state['state'] == 1 and not state['error'], state)
    if state['state'] != 1:
        return
    ev('Main.overview.hide()')
    # A real computer has a keyboard and a mouse before any app starts. A headless shell has
    # neither, and then GNOME 46 never delivers key presses to the app, not even WinV's.
    ev("""(() => {
        const Clutter = imports.gi.Clutter;
        const backend = global.stage.context?.get_backend?.() ?? Clutter.get_default_backend();
        const seat = backend.get_default_seat();
        globalThis._testKeyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        globalThis._testMouse = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
        _testMouse.notify_absolute_motion(imports.gi.GLib.get_monotonic_time(), 640, 400);
        return true;
    })()""")
    time.sleep(1)

    # the app to paste into, a native Wayland GTK 4 window
    env = dict(os.environ, WAYLAND_DISPLAY=WAYLAND_DISPLAY, GDK_BACKEND='wayland')
    target = subprocess.Popen(['python3', '/src/tests/paste_target.py', TYPED], env=env)
    try:
        found = wait(lambda: ev("""(() => {
            const w = global.display.list_all_windows().find(w => w.title === 'winv paste target');
            if (w) Main.activateWindow(w);
            return !!w && global.display.focus_window === w;
        })()"""), timeout=20, step=0.3)
        check('paste target window opens and has focus', found)
        paste_checks()
    finally:
        target.terminate()
    settings_check()


def settings_check():
    """Opens WinV's Settings window the way the Extensions app does, through GNOME's
    org.gnome.Shell.Extensions service, which we start ourselves to catch its errors."""
    service = next((p for p in ('/usr/share/gnome-shell/org.gnome.Shell.Extensions',
                                '/usr/libexec/gnome-shell/org.gnome.Shell.Extensions') if os.path.exists(p)), None)
    if GNOME < 45 or not service:
        return
    if not shutil.which('gjs'):   # it runs the service; Ubuntu packages it apart from gnome-shell
        check('Settings window opens without errors', False, 'gjs is not installed in the test image')
        return
    env = dict(os.environ, WAYLAND_DISPLAY=WAYLAND_DISPLAY, GDK_BACKEND='wayland')
    log = open(f'{OUT}/settings.log', 'w')
    prefs = subprocess.Popen(['gjs', '-m', service], env=env, stdout=log, stderr=subprocess.STDOUT)
    try:
        wait(lambda: subprocess.run(['gdbus', 'introspect', '--session', '--dest', 'org.gnome.Shell.Extensions',
                                     '--object-path', '/org/gnome/Shell/Extensions'],
                                    capture_output=True).returncode == 0, timeout=10)
        subprocess.run(['gnome-extensions', 'prefs', UUID], check=False)
        opened = wait(lambda: ev("global.display.list_all_windows().some(w => w.title === 'WinV for Linux')"),
                      timeout=15, step=0.3)
        time.sleep(1.5)
        screenshot('settings')
        with open(f'{OUT}/settings.log', encoding='utf-8', errors='replace') as f:
            # JavaScript errors only: GTK's accessibility-bus and Mesa warnings are harmless here
            errors = [line.strip() for line in f if 'JS ERROR' in line or 'Gjs-CRITICAL' in line]
        check('Settings window opens without errors', opened and not errors, ' | '.join(errors[:2]))
    finally:
        prefs.terminate()


def paste_checks():
    text = 'WinV test ✓ 123'
    ev(f"{PANEL}._clipboard.set_text(globalThis.imports?.gi.St.ClipboardType.CLIPBOARD ?? 1, {json.dumps(text)})")
    got = wait(lambda: ev(f"{PANEL}._current?.text") == text, timeout=5)
    check('copied text shows up in the history', got)

    ev(f"{PANEL}.open('clipboard')")
    time.sleep(0.8)
    check('Super+V panel opens', ev(f"{PANEL}._isOpen"))
    screenshot('clipboard')
    colours = ev(f"{PANEL}._theme?._read()")
    check('theme colours read from the shell theme',
          colours and all(isinstance(colours[k][c], (int, float)) for k in ('bg', 'fg', 'accent') for c in 'rgb'),
          colours)

    ev(f"{PANEL}._clipCards[0].card.emit('clicked', 1)")
    pasted = wait(lambda: typed() == text, timeout=6)
    check('clicking an item pastes it into the app', pasted, repr(typed()))

    ev(f"{PANEL}.open('emoji')")
    time.sleep(0.8)
    screenshot('emoji')
    emoji = ev(f"{PANEL}._emojiShown?.[0]?.text")
    check('emoji list loaded', bool(emoji), emoji)
    if emoji:
        ev(f"{PANEL}._firstCell.emoji.emit('clicked', 1)")
        inserted = wait(lambda: typed().endswith(emoji), timeout=6)
        check('clicking an emoji types it into the app', inserted, repr(typed()))
    for tab in ('kaomoji', 'symbols', 'recent'):
        ev(f"{PANEL}._showTab('{tab}')")
        time.sleep(0.4)
        screenshot(tab)
    ev(f"{PANEL}.close()")

    winv_setting('panel-style', "'windows'")
    time.sleep(0.5)
    ev(f"{PANEL}.open('clipboard')")
    time.sleep(0.8)
    screenshot('windows-style')
    check('Windows 11 style switches off theme matching', ev(f"{PANEL}._theme === null"))
    ev(f"{PANEL}.close()")
    winv_setting('panel-style', "'system'")

    # GNOME turns extensions off while the screen is locked: the history must survive that
    ev(f"Main.extensionManager.disableExtension('{UUID}')")
    time.sleep(0.5)
    ev(f"Main.extensionManager.enableExtension('{UUID}')")
    state = wait(lambda: ev(f"Main.extensionManager.lookup('{UUID}').state") == 1, timeout=5)
    check('turning it off and on again works', state and not ev(f"Main.extensionManager.lookup('{UUID}').error"))
    ev(f"{PANEL}.open('clipboard')")
    time.sleep(0.5)
    kept = ev(f"{PANEL}._clipCards.some(c => c.item.text === {json.dumps(text)})")
    ev(f"{PANEL}.close()")
    check('history survives being turned off and on', kept)


if __name__ == '__main__':
    main()
