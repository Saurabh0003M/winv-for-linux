#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Builds the release zips in dist/: one for GNOME 46 and later, one for GNOME 42.
# Install one with: gnome-extensions install --force dist/<zip>
set -euo pipefail
HERE="$(dirname "$(readlink -f "$0")")"
UUID=winv-for-linux@saurabh0003m.github.io
OUT="$HERE/dist"
rm -rf "$OUT"
mkdir -p "$OUT"

pack() {   # $1 = extension folder, $2 = zip name
    local tmp
    tmp=$(mktemp -d)
    gnome-extensions pack "$1" --force --out-dir "$tmp" \
        --extra-source=data.js --extra-source=theme.js --extra-source=icons \
        --schema=schemas/org.gnome.shell.extensions.winv-for-linux.gschema.xml
    mv "$tmp/$UUID.shell-extension.zip" "$OUT/$2"
    rm -rf "$tmp"
}
pack "$HERE/$UUID" winv-for-linux-gnome-46-51.zip
pack "$HERE/gnome-42/$UUID" winv-for-linux-gnome-42.zip
ls -l "$OUT"
