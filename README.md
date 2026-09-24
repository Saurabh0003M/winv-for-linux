# WinV for Linux — Windows 11 style clipboard history (Win+V) for Ubuntu and GNOME

<p align="center">
  <img src="docs/themes.png" alt="WinV for Linux clipboard history panel in the Yaru, Yaru dark, Yaru blue, Adwaita and Sweet GNOME themes" width="900">
</p>

<p align="center">
  <a href="https://github.com/Saurabh0003M/winv-for-linux/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/Saurabh0003M/winv-for-linux"></a>
  <img alt="GNOME Shell 42 and 46 to 51" src="https://img.shields.io/badge/GNOME%20Shell-42%20%7C%2046%E2%80%9351-4a86cf">
  <img alt="Ubuntu 22.04, 24.04 and 26.04" src="https://img.shields.io/badge/Ubuntu-22.04%20%7C%2024.04%20%7C%2026.04-e95420">
  <a href="https://github.com/Saurabh0003M/winv-for-linux/actions/workflows/test.yml"><img alt="Tests" src="https://github.com/Saurabh0003M/winv-for-linux/actions/workflows/test.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License GPL-2.0-or-later" src="https://img.shields.io/badge/license-GPL--2.0--or--later-blue"></a>
  <a href="https://github.com/sponsors/Saurabh0003M"><img alt="Sponsor" src="https://img.shields.io/badge/sponsor-%E2%9D%A4-db61a2"></a>
  <a href="https://buymeacoffee.com/saurabh0003m"><img alt="Buy Me a Coffee" src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buymeacoffee&logoColor=black"></a>
</p>

**WinV for Linux** brings the Windows 11 **Win+V clipboard history** and the **Win+. emoji panel** to
Ubuntu. Press **Super+V** to see everything you copied, text and images, and click an item to
paste it straight into the app you are typing in. It is a GNOME Shell extension for **Ubuntu 22.04,
24.04 and 26.04 LTS**, **Fedora**, **Debian 13**, **Arch** and any Linux with **GNOME 42 or 46–51**.
It works on **Wayland and X11** and takes its colours from your GNOME theme.

## Features

- **Clipboard history on Super+V** — text and images (screenshots too), newest first, 25 items by
  default (10–100 in the settings).
- **Click or Enter pastes** into the app you were in, including terminals (GNOME Terminal, the VS
  Code terminal) and apps running under XWayland.
- **Pin** items to keep them across restarts and *Clear all*; remove single items with the bin
  button or the Delete key.
- **Private by default** — unpinned history lives in memory only and is forgotten when you log
  out; pinned items are stored readable only by you; copies from password managers (KeePassXC)
  and files copied in the file manager are left out, as on Windows. No network code.
- **Emoji picker on <kbd>Super</kbd> + <kbd>;</kbd>** (or <kbd>Super</kbd> + <kbd>.</kbd>, as on Windows) — 1,500+ emoji
  with search and skin tones, kaomoji
  ( ͡° ͜ʖ ͡°) and symbols (math, arrows, currency, Greek, …). The panel stays open so you can
  insert several.
- **Opens at your text cursor**, falling back to the mouse position.
- **Keyboard friendly** — arrow keys, Tab, Enter, Delete and Esc all work.
- **Matches your theme** — Yaru with any Ubuntu accent colour, light or dark, Adwaita and custom
  shell themes such as Sweet. Prefer the Windows look? Switch to the **Windows 11** style.

<p align="center">
  <img src="docs/clipboard.png" alt="Clipboard history with text, a screenshot and pinned items" width="300">
  <img src="docs/emoji.png" alt="Emoji picker with search, sections and skin tones" width="300">
  <img src="docs/windows-style.png" alt="The optional Windows 11 style" width="300">
</p>

## Install

Works with **GNOME 42** (Ubuntu 22.04) and **GNOME 46 to 51** (Ubuntu 24.04 and 26.04, Fedora 43
and later, Debian 13, Arch, openSUSE Tumbleweed, ...). `gnome-shell --version` shows yours; the
installer picks the right version of WinV for it.

```bash
git clone https://github.com/Saurabh0003M/winv-for-linux.git
cd winv-for-linux
./install.sh
```

Then **log out and back in** (GNOME loads new extensions at login; on Xorg, Alt+F2 → `r` → Enter
is enough) and press **Super+V**. WinV takes Super+V over from GNOME's notification list, which
keeps Super+M (`./install.sh --uninstall` gives it back).

Or install the zip for your GNOME from the [latest release](https://github.com/Saurabh0003M/winv-for-linux/releases)
(`winv-for-linux-gnome-46-51.zip`, or `winv-for-linux-gnome-42.zip` for Ubuntu 22.04):

```bash
gnome-extensions install --force winv-for-linux-gnome-46-51.zip
```

To remove it: `./install.sh --uninstall`.

## Keyboard shortcuts

| Keys | What it does |
|---|---|
| <kbd>Super</kbd> + <kbd>V</kbd> | clipboard history |
| <kbd>Super</kbd> + <kbd>;</kbd> (semicolon) or <kbd>Super</kbd> + <kbd>.</kbd> (full stop) | emoji, kaomoji and symbols |
| arrow keys, <kbd>Tab</kbd> | move around |
| <kbd>Enter</kbd> or click | paste the item / insert the emoji |
| <kbd>Delete</kbd> | remove the selected clipboard item |
| <kbd>Esc</kbd>, click outside, <kbd>Super</kbd> + <kbd>V</kbd> again | close |

<kbd>Super</kbd> is the Windows key. For emoji, press it together with the semicolon key (right of
<kbd>L</kbd>) or the full-stop key (right of the comma): no <kbd>Shift</kbd>, and not the plus key.

## Settings

Open **Extensions → WinV for Linux → Settings** to choose the **panel style** (match the system
theme, or Windows 11) and how many **items to keep**.

<p align="center"><img src="docs/prefs.png" alt="WinV for Linux settings window" width="520"></p>

### Change the shortcuts

```bash
gsettings --schemadir ~/.local/share/gnome-shell/extensions/winv-for-linux@saurabh0003m.github.io/schemas \
    set org.gnome.shell.extensions.winv-for-linux toggle-clipboard "['<Super><Shift>v']"
```

The emoji shortcut is `toggle-emoji`. Log out and back in after changing them.

## How it works

- Watches the clipboard through Mutter's selection API; text is kept in memory, images in
  `/run/user/<you>/winv-for-linux` (also memory), pinned items in `~/.local/share/winv-for-linux`.
- Pastes by putting the item on the clipboard (and the primary selection, for terminals) and
  pressing Shift+Insert (Ctrl+V for images) with a virtual keyboard, one key at a time so IBus
  keeps the modifier.
- Emoji go through the input method in native Wayland apps, so your clipboard is not touched;
  X11 apps get them through the clipboard, which is put back straight after.
- Theme colours: reads the menu background, text colour and accent colour of the active shell
  theme through GNOME Shell's own style engine and generates a small stylesheet from them.

## FAQ

**Which Linux versions does it work on?**
Any Linux with GNOME Shell 42 or 46 to 51: Ubuntu 22.04, 24.04 and 26.04, Fedora, Debian 13, Arch,
openSUSE Tumbleweed and more. GNOME 45 is not supported (no maintained distribution ships it) and
GNOME 43–44 (Debian 12) are untested.

**Will it keep working after updates?**
Ubuntu LTS keeps the same GNOME version for its whole life, so updates do not break it. A new
GNOME comes out every March and September and can change what extensions rely on, so WinV is
tested every month against the upcoming GNOME (Fedora Rawhide) and updated for it.

**KDE, Linux Mint, Xfce?**
WinV is a GNOME Shell extension. KDE Plasma already has both features built in (Meta+V for
clipboard history, Meta+. for emoji). Cinnamon (Linux Mint), Xfce and COSMIC would need a
separate program.

**Why is it not on extensions.gnome.org?**
The code was written with an AI assistant (see below), and extensions.gnome.org does not accept
AI-generated extensions. So it is published here, open source, for anyone to read and check.

**Is my clipboard sent anywhere?**
No. There is no network code; everything stays on your computer.

**Super+V does nothing.**
Log out and back in after installing. If another clipboard manager (for example Clipboard
Indicator) also uses Super+V, disable one of them.

**Found a bug?** [Open an issue](https://github.com/Saurabh0003M/winv-for-linux/issues) with your
Ubuntu version, theme, and the output of
`journalctl -b -o cat /usr/bin/gnome-shell | grep -i winv`.

## Development

`tests/run.sh ubuntu:24.04` starts a headless GNOME Shell in a [podman](https://podman.io)
container and checks WinV there: loading, copying, pasting into a GTK app with IBus running,
emoji, theme colours, the Windows style, and turning it off and on, with screenshots in
`tests/out/`. GitHub runs the same tests on every push for GNOME 42, 46, 48, 49, 50 and the next
GNOME. The GNOME 42 version lives in `gnome-42/`.

## ❤️ Support

I am a student in India and I build and maintain this in my free time. If WinV saves you time
every day, please consider a small donation. Even **$1 (about ₹95) pays for a meal** for me here.

<a href="https://buymeacoffee.com/saurabh0003m"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="48"></a>

- [Buy Me a Coffee](https://buymeacoffee.com/saurabh0003m), one-time or monthly
- [Sponsor on GitHub](https://github.com/sponsors/Saurabh0003M)

Can't donate? Please **⭐ star the repo**. It helps other Ubuntu users find it, and it costs
nothing.

## How this was made

I (Saurabh Tomke) designed and tested WinV for Linux; the code was written with **Claude**,
Anthropic's AI assistant. Every feature was tried on a real Ubuntu 22.04 desktop and in isolated
GNOME Shell test sessions before release. For version 2, I ported the Settings window to GNOME 46
and later.

## License

[GPL-2.0-or-later](LICENSE), the same licence as GNOME Shell.
