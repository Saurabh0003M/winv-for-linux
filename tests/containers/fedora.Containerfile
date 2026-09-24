# Headless GNOME Shell for testing WinV. Fedora 41 = GNOME 47, 42 = 48, 43 = 49, 44 = 50, rawhide = newest.
ARG VERSION=rawhide
FROM registry.fedoraproject.org/fedora:${VERSION}
RUN dnf -y install --setopt=install_weak_deps=False \
        gnome-shell dconf dbus-daemon mesa-dri-drivers mesa-libEGL xorg-x11-server-Xwayland ibus \
        python3-gobject gtk4 abattis-cantarell-vf-fonts google-noto-color-emoji-fonts glib2 \
    && dnf clean all
