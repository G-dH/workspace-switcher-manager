/**
 * Workspaces Switcher Manager
 * utils.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022-2024
 * @license    GPL-3.0
 * this file is based on https://github.com/RensAlthuis/vertical-overview extension module
 */

const { GLib, Gio } = imports.gi;

const Main = imports.ui.main;
const Gi = imports._gi;

let _installedExtensions;

var Overrides = class {
    constructor() {
        this._overrides = {};
    }

    addOverride(name, prototype, overrideList) {
        const backup = this.overrideProto(prototype, overrideList, name);
        // don't update originals when override's just refreshing, keep initial content
        let originals = this._overrides[name]?.originals;
        if (!originals)
            originals = backup;
        this._overrides[name] = {
            originals,
            prototype,
        };
    }

    removeOverride(name) {
        const override = this._overrides[name];
        if (!override)
            return false;

        this.overrideProto(override.prototype, override.originals, name);
        delete this._overrides[name];
        return true;
    }

    removeAll() {
        for (let name in this._overrides) {
            this.removeOverride(name);
            delete this._overrides[name];
        }
    }

    hookVfunc(proto, symbol, func) {
        proto[Gi.hook_up_vfunc_symbol](symbol, func);
    }

    overrideProto(proto, overrides, name) {
        const backup = {};
        const originals = this._overrides[name]?.originals;
        for (let symbol in overrides) {
            if (symbol.startsWith('after_')) {
                const actualSymbol = symbol.slice('after_'.length);
                let fn;
                if (originals && originals[actualSymbol])
                    fn = originals[actualSymbol];
                else
                    fn = proto[actualSymbol];
                const afterFn = overrides[symbol];
                proto[actualSymbol] = function (...args) {
                    args = Array.prototype.slice.call(args);
                    const res = fn.apply(this, args);
                    afterFn.apply(this, args);
                    return res;
                };
                backup[actualSymbol] = fn;
            } else {
                backup[symbol] = proto[symbol];
                if (symbol.startsWith('vfunc'))
                    this.hookVfunc(proto[Gi.gobject_prototype_symbol], symbol.slice(6), overrides[symbol]);
                else if (overrides[symbol] !== null)
                    proto[symbol] = overrides[symbol];
            }
        }
        return backup;
    }
};

function getEnabledExtensions(pattern = '') {
    let result = [];
    // extensionManager is unreliable at startup because it is uncertain whether all extensions have been loaded
    // also gsettings key can contain already removed extensions (user deleted them without disabling them first)
    // therefore we have to check what's really installed in the filesystem
    if (!_installedExtensions) {
        const extensionFiles = [...collectFromDatadirs('extensions', true)];
        _installedExtensions = extensionFiles.map(({ info }) => {
            let fileType = info.get_file_type();
            if (fileType !== Gio.FileType.DIRECTORY)
                return null;
            const uuid = info.get_name();
            return uuid;
        });
    }
    // _enabledExtensions contains content of the enabled-extensions key from gsettings, not actual state
    const enabled = Main.extensionManager._enabledExtensions;
    result = _installedExtensions.filter(ext => enabled.includes(ext));
    // _extensions contains already loaded extensions, so we can try to filter out broken or incompatible extensions
    const active = Main.extensionManager._extensions;
    result = result.filter(ext => {
        const extension = active.get(ext);
        if (extension)
            return ![3, 4].includes(extension.state); // 3 - ERROR, 4 - OUT_OF_TIME (not supported by shell-version in metadata)
        // extension can be enabled but not yet loaded, we just cannot see its state at this moment, so let it pass as enabled
        return true;
    });
    // return only extensions matching the search pattern
    return result.filter(uuid => uuid !== null && uuid.includes(pattern));
}

function* collectFromDatadirs(subdir, includeUserDir) {
    let dataDirs = GLib.get_system_data_dirs();
    if (includeUserDir)
        dataDirs.unshift(GLib.get_user_data_dir());

    for (let i = 0; i < dataDirs.length; i++) {
        let path = GLib.build_filenamev([dataDirs[i], 'gnome-shell', subdir]);
        let dir = Gio.File.new_for_path(path);

        let fileEnum;
        try {
            fileEnum = dir.enumerate_children('standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            fileEnum = null;
        }
        if (fileEnum !== null) {
            let info;
            while ((info = fileEnum.next_file(null)))
                yield { dir: fileEnum.get_child(info), info };
        }
    }
}
