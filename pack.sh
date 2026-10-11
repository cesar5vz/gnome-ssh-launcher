#!/usr/bin/env bash
# Genera un .zip instalable con: gnome-extensions install --force <zip>
set -euo pipefail
cd "$(dirname "$0")"
gnome-extensions pack --force --extra-source=icons --schema=schemas/org.gnome.shell.extensions.ssh-launcher.gschema.xml .
