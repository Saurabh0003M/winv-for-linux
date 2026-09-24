#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
# The app WinV pastes into during the tests: a GTK 4 text box that writes what it holds to a file.
import sys

import gi
gi.require_version('Gtk', '4.0')
from gi.repository import Gtk  # noqa: E402

OUT = sys.argv[1]


def save(buffer):
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(buffer.get_text(buffer.get_start_iter(), buffer.get_end_iter(), False))


def activate(app):
    window = Gtk.ApplicationWindow(application=app, title='winv paste target')
    view = Gtk.TextView()
    view.get_buffer().connect('changed', save)
    window.set_child(view)
    window.set_default_size(700, 420)
    window.present()
    view.grab_focus()


app = Gtk.Application(application_id='io.github.saurabh0003m.WinvPasteTarget')
app.connect('activate', activate)
app.run([])
