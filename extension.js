import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const SSH_DIR = GLib.build_filenamev([GLib.get_home_dir(), '.ssh']);
const SSH_CONFIG = GLib.build_filenamev([SSH_DIR, 'config']);

function readFile(path) {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        return ok ? new TextDecoder().decode(bytes) : null;
    } catch {
        return null;
    }
}

// Expande un patrón de Include (soporta comodines en el nombre de archivo).
function expandInclude(pattern) {
    if (pattern.startsWith('~'))
        pattern = GLib.get_home_dir() + pattern.slice(1);
    else if (!GLib.path_is_absolute(pattern))
        pattern = GLib.build_filenamev([SSH_DIR, pattern]);

    const dir = GLib.path_get_dirname(pattern);
    const base = GLib.path_get_basename(pattern);
    if (!/[*?]/.test(base))
        return [pattern];

    const re = new RegExp(`^${base.replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
    const files = [];
    try {
        const enumerator = Gio.File.new_for_path(dir).enumerate_children(
            'standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = enumerator.next_file(null))) {
            if (re.test(info.get_name()))
                files.push(GLib.build_filenamev([dir, info.get_name()]));
        }
    } catch {
        // directorio inexistente
    }
    return files.sort();
}

// Devuelve los alias de Host definidos (sin comodines) en ~/.ssh/config e Includes.
function parseSshConfig(path = SSH_CONFIG, seen = new Set()) {
    if (seen.has(path))
        return [];
    seen.add(path);

    const text = readFile(path);
    if (!text)
        return [];

    const hosts = [];
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#'))
            continue;
        const m = line.match(/^(\S+)\s*=?\s*(.*)$/);
        if (!m)
            continue;
        const key = m[1].toLowerCase();
        const values = m[2].split(/\s+/).filter(v => v);

        if (key === 'host') {
            for (const v of values) {
                if (!/[*?!]/.test(v))
                    hosts.push(v);
            }
        } else if (key === 'include') {
            for (const v of values) {
                for (const file of expandInclude(v))
                    hosts.push(...parseSshConfig(file, seen));
            }
        }
    }
    return hosts;
}

function parseCustomHosts(entries) {
    return entries.map(entry => {
        const idx = entry.indexOf('|');
        const name = idx >= 0 ? entry.slice(0, idx).trim() : entry.trim();
        const args = idx >= 0 ? entry.slice(idx + 1).trim() : entry.trim();
        return {name: name || args, args};
    }).filter(h => h.args);
}

const SshIndicator = GObject.registerClass(
class SshIndicator extends PanelMenu.Button {
    _init(ext) {
        super._init(0.0, 'SSH Launcher');
        this._ext = ext;
        this._settings = ext.getSettings();

        this.add_child(new St.Icon({
            gicon: Gio.icon_new_for_string(`${ext.path}/icons/ssh-symbolic.svg`),
            style_class: 'system-status-icon',
        }));

        // Reconstruir el menú cada vez que se abre, para reflejar cambios en ~/.ssh/config.
        this.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._buildMenu();
        });
        this._buildMenu();
    }

    _buildMenu() {
        this.menu.removeAll();

        const custom = parseCustomHosts(this._settings.get_strv('custom-hosts'));
        const config = this._settings.get_boolean('show-ssh-config')
            ? [...new Set(parseSshConfig())] : [];

        for (const h of custom)
            this._addHostItem(this.menu, h.name, h.args);

        for (const host of config)
            this._addHostItem(this.menu, host, host);

        if (!custom.length && !config.length) {
            const empty = new PopupMenu.PopupMenuItem('No hay hosts configurados', {reactive: false});
            this.menu.addMenuItem(empty);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const prefsItem = new PopupMenu.PopupMenuItem('Preferencias');
        prefsItem.connect('activate', () => this._ext.openPreferences());
        this.menu.addMenuItem(prefsItem);
    }

    _addHostItem(menu, label, args) {
        const item = new PopupMenu.PopupImageMenuItem(label, 'utilities-terminal-symbolic');
        item.connect('activate', () => this._connect(args));
        menu.addMenuItem(item);
    }

    _connect(args) {
        let sshArgv;
        try {
            [, sshArgv] = GLib.shell_parse_argv(`ssh ${args}`);
        } catch (e) {
            Main.notifyError('SSH Launcher', `Argumentos inválidos: ${e.message}`);
            return;
        }

        const template = this._settings.get_string('terminal-command');
        let argv;
        try {
            [, argv] = GLib.shell_parse_argv(template);
        } catch (e) {
            Main.notifyError('SSH Launcher', `Comando de terminal inválido: ${e.message}`);
            return;
        }

        const sshString = sshArgv.map(a => GLib.shell_quote(a)).join(' ');
        let replaced = false;
        argv = argv.flatMap(tok => {
            if (tok === '%s') {
                replaced = true;
                return sshArgv;
            }
            if (tok.includes('%S')) {
                replaced = true;
                return [tok.replace('%S', sshString)];
            }
            return [tok];
        });
        if (!replaced)
            argv.push(...sshArgv);

        try {
            GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
        } catch (e) {
            Main.notifyError('SSH Launcher', `No se pudo abrir la terminal: ${e.message}`);
        }
    }
});

export default class SshLauncherExtension extends Extension {
    enable() {
        this._indicator = new SshIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
