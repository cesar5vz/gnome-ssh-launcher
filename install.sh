#!/usr/bin/env bash
# Instala la extensión enlazándola en el directorio de extensiones del usuario.
set -euo pipefail
UUID="ssh-launcher@beto"
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

glib-compile-schemas "$SRC/schemas"
mkdir -p "$(dirname "$DEST")"
ln -sfn "$SRC" "$DEST"
echo "Instalada en $DEST"
echo "En Wayland: cerrá sesión y volvé a entrar, luego ejecutá:"
echo "  gnome-extensions enable $UUID"
