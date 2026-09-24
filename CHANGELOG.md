# Changelog

## 2 — 2026-09-24

WinV now works on GNOME 46 to 51: Ubuntu 24.04 and 26.04 LTS, Fedora, Debian 13, Arch.

- A new version of the extension for GNOME 46 and later. GNOME 42 (Ubuntu 22.04) keeps its own
  version in `gnome-42/`; `install.sh` picks the right one.
- Automated tests in podman containers for every supported GNOME, and monthly for the next one.
- Donation links in the Extensions app (GNOME 46 and later).

## 1 — 2026-09-24

First public release, for GNOME Shell 42 (Ubuntu 22.04 LTS).

- Clipboard history on Super+V: text and images, click or Enter pastes into the previous app
  (terminals and XWayland apps included), pin, delete, clear all; unpinned history kept in memory only.
- Emoji, kaomoji and symbols on Super+. and Super+;, with search, skin tones and recently used.
- Opens at the text cursor; full keyboard navigation.
- Panel style: follows the active GNOME Shell theme (Yaru accents, light/dark, Adwaita, Sweet, ...)
  or the Windows 11 look. Settings window for the style and the history size.
