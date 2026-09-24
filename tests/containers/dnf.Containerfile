# Headless GNOME Shell for testing WinV on Fedora (see ../run.sh).
# Fedora 43 = GNOME 49, 44 = 50, rawhide = the newest GNOME, before it is released.
ARG IMAGE=registry.fedoraproject.org/fedora:rawhide
FROM ${IMAGE}
RUN dnf -y install --setopt=install_weak_deps=False \
        gnome-shell dconf dbus-daemon mesa-dri-drivers mesa-libEGL xorg-x11-server-Xwayland ibus \
        python3-gobject gtk4 abattis-cantarell-vf-fonts google-noto-color-emoji-fonts glib2 \
    && dnf clean all
