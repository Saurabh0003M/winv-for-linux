#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Runs inside the test container (see run.sh): installs WinV and the test driver into a fresh
# home, then runs checks.py on a private session bus.
set -euo pipefail
export HOME=/tmp/home XDG_RUNTIME_DIR=/tmp/xdg
export XDG_DATA_HOME=$HOME/.local/share XDG_CONFIG_HOME=$HOME/.config XDG_CACHE_HOME=$HOME/.cache
mkdir -p "$HOME" "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
[ -d /tmp/.X11-unix ] || install -d -m 1777 /tmp/.X11-unix   # Xwayland needs it (for apps that only speak X11)
# and an empty system bus, so GNOME's system services fail politely instead of not at all
dbus-daemon --session --address="unix:path=$XDG_RUNTIME_DIR/system_bus" --fork --nopidfile --print-address > /dev/null
export DBUS_SYSTEM_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/system_bus"

UUID=winv-for-linux@saurabh0003m.github.io
EXT=$XDG_DATA_HOME/gnome-shell/extensions
GNOME=$(gnome-shell --version | grep -oE '[0-9]+' | head -1)
mkdir -p "$EXT"
if [ "$GNOME" -ge 45 ]; then
    cp -r "/src/$UUID" "$EXT/"
    cp -r /src/tests/testdriver/esm "$EXT/testdriver@winv-for-linux"
else
    cp -r "/src/gnome-42/$UUID" "$EXT/"
    cp -r /src/tests/testdriver/legacy "$EXT/testdriver@winv-for-linux"
fi
glib-compile-schemas "$EXT/$UUID/schemas"
echo "GNOME Shell $(gnome-shell --version | grep -oE '[0-9.]+$')"
exec dbus-run-session -- python3 /src/tests/checks.py "$GNOME" "$EXT/$UUID"
