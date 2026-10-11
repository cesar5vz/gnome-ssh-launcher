import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const TERMINALS = [
    ['GNOME Terminal', 'gnome-terminal -- %s'],
    ['Consola (kgx)', 'kgx -- %s'],
    ['Ptyxis', 'ptyxis -- %s'],
    ['Tilix', 'tilix -e %S'],
    ['Konsole', 'konsole -e %s'],
    ['Alacritty', 'alacritty -e %s'],
    ['Kitty', 'kitty %s'],
    ['xterm', 'xterm -e %s'],
];

export default class SshLauncherPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        // --- Terminal ---
        const termGroup = new Adw.PreferencesGroup({
            title: 'Terminal',
            description: '%s = comando ssh (argumentos separados), %S = comando ssh como una sola cadena',
        });
        page.add(termGroup);

        const presetRow = new Adw.ComboRow({
            title: 'Terminal predefinida',
            model: Gtk.StringList.new([...TERMINALS.map(t => t[0]), 'Personalizada']),
        });
        termGroup.add(presetRow);

        const cmdRow = new Adw.EntryRow({title: 'Comando'});
        termGroup.add(cmdRow);

        const syncPreset = () => {
            const idx = TERMINALS.findIndex(t => t[1] === settings.get_string('terminal-command'));
            presetRow.selected = idx >= 0 ? idx : TERMINALS.length;
        };
        cmdRow.text = settings.get_string('terminal-command');
        syncPreset();

        presetRow.connect('notify::selected', () => {
            const t = TERMINALS[presetRow.selected];
            if (t && cmdRow.text !== t[1])
                cmdRow.text = t[1];
        });
        cmdRow.connect('changed', () => {
            settings.set_string('terminal-command', cmdRow.text);
            syncPreset();
        });

        // --- ~/.ssh/config ---
        const cfgGroup = new Adw.PreferencesGroup({title: 'Fuentes'});
        page.add(cfgGroup);
        const showCfg = new Adw.SwitchRow({title: 'Mostrar hosts de ~/.ssh/config'});
        settings.bind('show-ssh-config', showCfg, 'active', Gio.SettingsBindFlags.DEFAULT);
        cfgGroup.add(showCfg);

        const editRow = new Adw.ActionRow({
            title: 'Editar ~/.ssh/config',
            activatable: true,
        });
        editRow.add_suffix(new Gtk.Image({icon_name: 'document-edit-symbolic'}));
        editRow.connect('activated', () => this._editConfig(window));
        cfgGroup.add(editRow);

        // --- Hosts propios ---
        const hostsGroup = new Adw.PreferencesGroup({
            title: 'Mis hosts',
            description: 'Argumentos de ssh, p. ej. "usuario@10.0.0.5 -p 2222 -i ~/.ssh/id_ed25519"',
        });
        page.add(hostsGroup);

        const addBtn = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: 'Agregar host',
        });
        hostsGroup.set_header_suffix(addBtn);

        let rows = [];

        const save = () => {
            settings.set_strv('custom-hosts', rows
                .map(r => [r.name.text.replace(/\|/g, ' ').trim(), r.args.text.trim()])
                .filter(([, args]) => args)
                .map(([name, args]) => `${name}|${args}`));
        };

        const addRow = (name = '', args = '') => {
            const expander = new Adw.ExpanderRow({title: name || args || 'Nuevo host', subtitle: args});
            const nameRow = new Adw.EntryRow({title: 'Nombre', text: name});
            const argsRow = new Adw.EntryRow({title: 'Argumentos de ssh', text: args});
            const delBtn = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['flat', 'destructive-action'],
                tooltip_text: 'Eliminar',
            });
            expander.add_suffix(delBtn);
            expander.add_row(nameRow);
            expander.add_row(argsRow);

            const entry = {expander, name: nameRow, args: argsRow};
            const onChange = () => {
                expander.title = nameRow.text || argsRow.text || 'Nuevo host';
                expander.subtitle = argsRow.text;
                save();
            };
            nameRow.connect('changed', onChange);
            argsRow.connect('changed', onChange);
            delBtn.connect('clicked', () => {
                hostsGroup.remove(expander);
                rows = rows.filter(r => r !== entry);
                save();
            });

            rows.push(entry);
            hostsGroup.add(expander);
            return expander;
        };

        for (const e of settings.get_strv('custom-hosts')) {
            const idx = e.indexOf('|');
            addRow(idx >= 0 ? e.slice(0, idx) : '', idx >= 0 ? e.slice(idx + 1) : e);
        }

        addBtn.connect('clicked', () => {
            addRow().expanded = true;
        });
    }

    _editConfig(window) {
        const sshDir = GLib.build_filenamev([GLib.get_home_dir(), '.ssh']);
        const file = Gio.File.new_for_path(GLib.build_filenamev([sshDir, 'config']));
        try {
            if (!file.query_exists(null)) {
                GLib.mkdir_with_parents(sshDir, 0o700);
                file.replace_contents(
                    new TextEncoder().encode('# Ejemplo:\n# Host miserver\n#     HostName 192.168.1.10\n#     User usuario\n#     Port 22\n'),
                    null, false, Gio.FileCreateFlags.PRIVATE, null);
            }
            Gio.AppInfo.launch_default_for_uri(file.get_uri(), null);
        } catch (e) {
            window.add_toast(new Adw.Toast({title: `No se pudo abrir ~/.ssh/config: ${e.message}`}));
        }
    }
}
