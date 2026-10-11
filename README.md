# SSH Launcher

Extensión de GNOME Shell (46–49) que agrega un ícono en la barra superior para lanzar conexiones SSH.

## Instalación

```bash
./install.sh
```

Esto compila el esquema de opciones y crea un enlace simbólico en
`~/.local/share/gnome-shell/extensions/ssh-launcher@beto`.

En Wayland, GNOME solo detecta extensiones nuevas al iniciar sesión:

1. Cerrá sesión y volvé a entrar.
2. Activá la extensión:

   ```bash
   gnome-extensions enable ssh-launcher@beto
   ```

Si hay algún problema, los errores aparecen con:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

## Uso

Al hacer clic en el ícono de la barra se abre un menú con una sola lista de hosts y, debajo,
la opción **Preferencias**. La lista muestra primero:

- Tus hosts, los que agregues en Preferencias, con un nombre y los argumentos de ssh
  (por ejemplo `admin@10.0.0.5 -p 2222`).
- Después, los `Host` de `~/.ssh/config`, incluidos los de las líneas `Include`.
  Se omiten los que usan comodines. La lista se vuelve a leer cada vez que abrís el menú.

Al elegir un host se abre una terminal ejecutando `ssh <host>`.

### Preferencias

- Elegir la terminal entre las predefinidas (GNOME Terminal, Consola, Tilix, Ptyxis, Konsole,
  Alacritty, Kitty, xterm) o escribir un comando propio. En el comando, `%s` se reemplaza por el
  comando ssh con los argumentos separados, y `%S` por el comando ssh como una sola cadena.
- Activar o desactivar los hosts de `~/.ssh/config`.
- Editar `~/.ssh/config`: abre el archivo en el editor. Si no existe, lo crea con un ejemplo comentado.
- Agregar, editar y borrar tus hosts.

## Archivos

| Archivo | Descripción |
|---|---|
| `metadata.json` | Datos de la extensión |
| `extension.js` | El ícono de la barra y el menú |
| `prefs.js` | La ventana de preferencias |
| `schemas/org.gnome.shell.extensions.ssh-launcher.gschema.xml` | Las opciones guardadas |
| `icons/ssh-symbolic.svg` | El ícono |
| `install.sh` | Instala la extensión con un enlace simbólico |
| `pack.sh` | Genera un `.zip` para instalarla en otro equipo |

## Desarrollo

Como la extensión está enlazada, los cambios que hagas en la carpeta del proyecto se aplican
directamente, pero en Wayland hay que volver a iniciar sesión para verlos. Si modificás el
`.gschema.xml`, además tenés que volver a ejecutar `./install.sh`.

## Instalar en otro equipo

```bash
./pack.sh
gnome-extensions install --force ssh-launcher@beto.shell-extension.zip
```

Después cerrá sesión, volvé a entrar y activala con `gnome-extensions enable ssh-launcher@beto`.
