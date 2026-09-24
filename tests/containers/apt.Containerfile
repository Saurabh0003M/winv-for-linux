# Headless GNOME Shell for testing WinV on Ubuntu or Debian (see ../run.sh).
# Ubuntu 22.04 = GNOME 42, 24.04 = 46, 26.04 = 50; Debian 13 (trixie) = 48.
ARG IMAGE=docker.io/library/ubuntu:24.04
FROM ${IMAGE}
ENV DEBIAN_FRONTEND=noninteractive
# Retried: while Ubuntu publishes an update, its package list can name files the mirror does not
# have yet (404), which failed whole test runs.
RUN ok=; for try in 1 2 3 4; do \
        apt-get update && apt-get install -y --no-install-recommends \
            gnome-shell gjs dconf-gsettings-backend dconf-service dbus dbus-user-session \
            libgl1-mesa-dri libegl-mesa0 xwayland ibus \
            python3-gi gir1.2-gtk-4.0 fonts-cantarell fonts-noto-color-emoji \
            libglib2.0-bin \
        && ok=1 && break; \
        echo "apt failed (try $try of 4), retrying in 90 s"; sleep 90; \
    done; [ -n "$ok" ] && rm -rf /var/lib/apt/lists/*
