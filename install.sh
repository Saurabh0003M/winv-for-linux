#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Install or update WinV for Linux for the current user. No sudo needed.
# Picks the right version: GNOME 46 and later (Ubuntu 24.04, 26.04, Fedora, Debian 13, Arch, ...)
# or GNOME 42 (Ubuntu 22.04).
#   ./install.sh               install, enable, then log out and back in
#   ./install.sh --uninstall   remove it again
set -euo pipefail
UUID=winv-for-linux@saurabh0003m.github.io
HERE="$(dirname "$(readlink -f "$0")")"
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
NEWEST=$(grep -oE '"[0-9]+"\]' "$HERE/$UUID/metadata.json" | tr -dc 0-9)
if [ "$GNOME" -ge 46 ]; then
    SRC="$HERE/$UUID"
    [ "$GNOME" -le "$NEWEST" ] || echo "Warning: tested up to GNOME $NEWEST, you have GNOME $GNOME. GNOME will not load it until it is updated for your version."
elif [ "$GNOME" -ge 42 ] && [ "$GNOME" -le 44 ]; then
    SRC="$HERE/gnome-42/$UUID"
    [ "$GNOME" = 42 ] || echo "Warning: this version was made for GNOME 42; on GNOME $GNOME it will not load yet."
else
    echo "WinV for Linux needs GNOME 42 or GNOME 46 and later; you have GNOME $GNOME." >&2
    exit 1
fi
rm -rf "$DEST"   # an update must not keep files the new version no longer has

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
echo "WinV for Linux installed. Log out and back in (on Xorg, Alt+F2, r, Enter is enough), then press Super+V."
