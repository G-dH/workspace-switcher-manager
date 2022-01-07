// Workspace Switcher Manager
// GPL v3 ©G-dH@Github.com
'use strict';

const { GLib, Gio } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Config = imports.misc.config;
var   shellVersion = Config.PACKAGE_VERSION;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
var _ = Gettext.gettext;

const _schema = 'org.gnome.shell.extensions.workspace-switcher-manager';

var MscOptions = class MscOptions {
    constructor() {
        this._gsettings = ExtensionUtils.getSettings(_schema);
        this._connectionIds = [];
    }

    connect(name, callback) {
        const id = this._gsettings.connect(name, callback);
        this._connectionIds.push(id);
        return id;
    }

    _getWsNamesSettings() {
		const wsNamesSettings = ExtensionUtils.getSettings(
						'org.gnome.desktop.wm.preferences');
		return wsNamesSettings;
	}

    destroy() {
        this._connectionIds.forEach(id => this._gsettings.disconnect(id));
    }

    // common options
    get popupMode() {
        return this._gsettings.get_int('mode');
    }
    set popupMode(int_val) {
        this._gsettings.set_int('mode', int_val);
    }

    get monitor() {
        return this._gsettings.get_int('monitor');
    }
    set monitor(int_val) {
        this._gsettings.set_int('monitor', int_val);
    }

    get popupHorizontal() {
        return this._gsettings.get_int('horizontal');
    }
    set popupHorizontal(int_val) {
        this._gsettings.set_int('horizontal', int_val);
    }

    get popupVertical() {
        return this._gsettings.get_int('vertical');
    }
    set popupVertical(int_val) {
        this._gsettings.set_int('vertical', int_val);
    }

    get popupTimeout() {
        return this._gsettings.get_int('timeout');
    }
    set popupTimeout(int_val) {
        this._gsettings.set_int('timeout', int_val);
    }

    get wsSwitchWrap() {
        return this._gsettings.get_boolean('wraparound');
    }
    set wsSwitchWrap(bool_val) {
        this._gsettings.set_boolean('wraparound', bool_val);
    }

    get wsSwitchIgnoreLast() {
        return this._gsettings.get_boolean('ignore-last');
    }
    set wsSwitchIgnoreLast(bool_val) {
        this._gsettings.set_boolean('ignore-last', bool_val);
    }

    get fontSize() {
        return this._gsettings.get_int('font-size');
    }
    set fontSize(int_val) {
        this._gsettings.set_int('font-size', int_val);
    }

    get indexSize() {
        return this._gsettings.get_int('index-size');
    }
    set indexSize(int_val) {
        this._gsettings.set_int('index-size', int_val);
    }

    get fontColor() {
        return this._gsettings.get_string('color');
    }
    set fontColor(string) {
        this._gsettings.set_string('color', string);
    }

    get textShadow() {
        return this._gsettings.get_boolean('text-shadow');
    }
    set textShadow(bool_val) {
        this._gsettings.set_boolean('text-shadow', bool_val);
    }

    get fadeOutTime() {
        return this._gsettings.get_int('fade-out-time');
    }
    set fadeOutTime(int_val) {
        this._gsettings.set_int('fade-out-time', int_val);
    }

    get wsNames() {
        return this._getWsNamesSettings().get_strv('workspace-names');
    }
    set wsNames(names) {
        this._getWsNamesSettings().set_strv('workspace-names', names);
    }

    get defaultPopupSize() {
        return this._gsettings.get_int('default-popup-size');
    }
    set defaultPopupSize(int_val) {
        this._gsettings.set_int('default-popup-size', int_val);
    }

    get defaultPopupOpacity() {
        return this._gsettings.get_int('default-popup-opacity');
    }
    set defaultPopupOpacity(int_val) {
        this._gsettings.set_int('default-popup-opacity', int_val);
    }
};