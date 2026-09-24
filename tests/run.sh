#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Tests WinV for Linux in a headless GNOME Shell inside a container (podman, no root needed).
#   tests/run.sh ubuntu:22.04      GNOME 42 (the gnome-42/ version)
#   tests/run.sh ubuntu:24.04      GNOME 46
#   tests/run.sh debian:trixie     GNOME 48
#   tests/run.sh fedora:43         GNOME 49
#   tests/run.sh ubuntu:26.04      GNOME 50
#   tests/run.sh fedora:rawhide    the newest GNOME, before it is released
# The first run of a target builds its image (about 1 GB; `podman rmi` removes it again).
# Screenshots, the shell's log and results.txt go to tests/out/<distro>-<version>/.
set -euo pipefail
TARGET=${1:?"usage: tests/run.sh ubuntu:24.04 | debian:trixie | fedora:43 | ubuntu:26.04 | fedora:rawhide"}
DISTRO=${TARGET%%:*}
VERSION=${TARGET#*:}
TESTS="$(dirname "$(readlink -f "$0")")"
REPO="$(dirname "$TESTS")"
IMAGE="localhost/winv-test:$DISTRO-$VERSION"
OUT="$TESTS/out/$DISTRO-$VERSION"

case "$DISTRO" in
    ubuntu | debian) RECIPE=apt BASE="docker.io/library/$DISTRO:$VERSION" ;;
    fedora) RECIPE=dnf BASE="registry.fedoraproject.org/fedora:$VERSION" ;;
    *) echo "unknown distro $DISTRO (ubuntu, debian or fedora)" >&2; exit 2 ;;
esac
podman image exists "$IMAGE" ||
    podman build -f "$TESTS/containers/$RECIPE.Containerfile" --build-arg IMAGE="$BASE" -t "$IMAGE" "$TESTS/containers"
rm -rf "$OUT"
mkdir -p "$OUT"
# keep-id: inside the container we are the same user as outside, so tests/out stays ours
# an empty /run/systemd: GNOME then runs without logind, which a container does not have
podman run --rm --userns=keep-id --user "$(id -u):$(id -g)" --security-opt label=disable --tmpfs /run/systemd \
    -v "$REPO:/src:ro" -v "$OUT:/out" "$IMAGE" /src/tests/inside.sh
