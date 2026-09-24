#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Install or update WinV for Linux for the current user (GNOME 42 / Ubuntu 22.04). No sudo needed.
#   ./install.sh               install, enable, then log out and back in
#   ./install.sh --uninstall   remove it again
set -euo pipefail
UUID=winv-for-linux@saurabh0003m.github.io
SRC="$(dirname "$(readlink -f "$0")")/$UUID"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

enabled_list() { gsettings get org.gnome.shell enabled-extensions; }
set_enabled() {   # $1 = add|remove
    local new
    new=$(python3 -c 'import ast, sys
l = ast.literal_eval(sys.argv[1].replace("@as ", ""))
l = [u for u in l if u != sys.argv[3]] + ([sys.argv[3]] if sys.argv[2] == "add" else [])
print(l)' "$(enabled_list)" "$1" "$UUID")
    gsettings set org.gnome.shell enabled-extensions "$new"
}

if [ "${1:-}" = --uninstall ]; then
    set_enabled remove
    rm -rf "$DEST"
    gsettings reset org.gnome.shell.keybindings toggle-message-tray   # Super+V back to GNOME's notification list
    echo "WinV for Linux removed. Log out and back in to unload it completely."
    exit 0
fi

GNOME=$(gnome-shell --version | grep -oE '[0-9]+' | head -1)
[ "$GNOME" = 42 ] || echo "Warning: made for GNOME 42 (Ubuntu 22.04). You have GNOME $GNOME, where it will not load yet."

mkdir -p "$DEST"
cp -r "$SRC/." "$DEST/"
glib-compile-schemas "$DEST/schemas"

# GNOME opens the notification list with Super+V as well as Super+M: leave it Super+M only.
case "$(gsettings get org.gnome.shell.keybindings toggle-message-tray)" in
    *"<Super>v"*) gsettings set org.gnome.shell.keybindings toggle-message-tray "['<Super>m']" ;;
esac
case "$(enabled_list)" in
    *clipboard-indicator@tudmotu.com*) echo "Note: Clipboard Indicator also uses Super+V. Disable one of the two." ;;
esac
case "$(enabled_list)" in
    *"$UUID"*) ;;
    *) set_enabled add ;;
esac
echo "WinV for Linux installed. Log out and back in, then press Super+V."
