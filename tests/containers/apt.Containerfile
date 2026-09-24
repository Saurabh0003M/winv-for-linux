# Headless GNOME Shell for testing WinV on Ubuntu or Debian (see ../run.sh).
# Ubuntu 22.04 = GNOME 42, 24.04 = 46, 26.04 = 50; Debian 13 (trixie) = 48.
ARG IMAGE=docker.io/library/ubuntu:24.04
FROM ${IMAGE}
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        gnome-shell gjs dconf-gsettings-backend dconf-service dbus dbus-user-session \
        libgl1-mesa-dri libegl-mesa0 xwayland ibus \
        python3-gi gir1.2-gtk-4.0 fonts-cantarell fonts-noto-color-emoji \
        libglib2.0-bin \
    && rm -rf /var/lib/apt/lists/*
