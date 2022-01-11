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
		const settings = ExtensionUtils.getSettings(
						    'org.gnome.desktop.wm.preferences');
		return settings;
	}

    _getMutterSettings() {
        const settings = ExtensionUtils.getSettings(
                            'org.gnome.mutter');
        return settings;
    }

    _getDesktopWmSettings() {
        const settings = ExtensionUtils.getSettings(
            'org.gnome.desktop.wm.preferences');
        return settings;
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

    get textBold() {
        return this._gsettings.get_boolean('text-bold');
    }
    set textBold(bool_val) {
        this._gsettings.set_boolean('text-bold', bool_val);
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
        return this._gsettings.get_int('popup-size');
    }
    set defaultPopupSize(int_val) {
        this._gsettings.set_int('popup-size', int_val);
    }

    get defaultPopupOpacity() {
        return this._gsettings.get_int('popup-opacity');
    }
    set defaultPopupOpacity(int_val) {
        this._gsettings.set_int('popup-opacity', int_val);
    }

    get defaultPopupBgColor() {
        return this._gsettings.get_string('popup-bg-color');
    }
    set defaultPopupBgColor(string) {
        this._gsettings.set_string('popup-bg-color', string);
    }

    get defaultPopupBorderColor() {
        return this._gsettings.get_string('popup-border-color');
    }
    set defaultPopupBorderColor(string) {
        this._gsettings.set_string('popup-border-color', string);
    }

    get defaultPopupActiveFgColor() {
        return this._gsettings.get_string('popup-active-fg-color');
    }
    set defaultPopupActiveFgColor(string) {
        this._gsettings.set_string('popup-active-fg-color', string);
    }

    get defaultPopupActiveBgColor() {
        return this._gsettings.get_string('popup-active-bg-color');
    }
    set defaultPopupActiveBgColor(string) {
        this._gsettings.set_string('popup-active-bg-color', string);
    }

    get activePrefsPage() {
        return this._gsettings.get_string('active-prefs-page');
    }
    set activePrefsPage(string) {
        this._gsettings.set_string('active-prefs-page', string);
    }

    get defaultColors() {
        return this._gsettings.get_strv('default-colors');
    }
    set defaultColors(array) {
        this._gsettings.set_strv('default-colors', array);
    }

    get activeShowWsIndex() {
        return this._gsettings.get_boolean('active-show-ws-index');
    }
    set activeShowWsIndex(bool_val) {
        this._gsettings.set_boolean('active-show-ws-index', bool_val);
    }

    get activeShowWsName() {
        return this._gsettings.get_boolean('active-show-ws-name');
    }
    set activeShowWsName(bool_val) {
        this._gsettings.set_boolean('active-show-ws-name', bool_val);
    }

    get activeShowAppName() {
        return this._gsettings.get_boolean('active-show-app-name');
    }
    set activeShowAppName(bool_val) {
        this._gsettings.set_boolean('active-show-app-name', bool_val);
    }

    get inactiveShowWsIndex() {
        return this._gsettings.get_boolean('inactive-show-ws-index');
    }
    set inactiveShowWsIndex(bool_val) {
        this._gsettings.set_boolean('inactive-show-ws-index', bool_val);
    }

    get inactiveShowWsName() {
        return this._gsettings.get_boolean('inactive-show-ws-name');
    }
    set inactiveShowWsName(bool_val) {
        this._gsettings.set_boolean('inactive-show-ws-name', bool_val);
    }

    get inactiveShowAppName() {
        return this._gsettings.get_boolean('inactive-show-app-name');
    }
    set inactiveShowAppName(bool_val) {
        this._gsettings.set_boolean('inactive-show-app-name', bool_val);
    }

    get switcherMode() {
        const settings = this._getMutterSettings();
        const val = settings.get_boolean('dynamic-workspaces');
        return val ? 0 : 1;
    }
    set switcherMode(int_val) {
        const settings = this._getMutterSettings();
        const dynamic = int_val === 0;
        settings.set_boolean('dynamic-workspaces', dynamic);
    }

    get numWorkspaces() {
        const settings = this._getDesktopWmSettings();
        return settings.get_int('num-workspaces');
    }
    set numWorkspaces(int_val) {
        const settings = this._getDesktopWmSettings();
        settings.set_int('num-workspaces', int_val);
    }

    get modifiersHidePopup() {
        return this._gsettings.get_boolean('modifiers-hide-popup');
    }
    set modifiersHidePopup(bool_val) {
        this._gsettings.set_boolean('modifiers-hide-popup', bool_val);
    }

    get reversePopupOrientation() {
        return this._gsettings.get_boolean('reverse-popup-orientation');
    }
    set reversePopupOrientation(bool_val) {
        this._gsettings.set_boolean('reverse-popup-orientation', bool_val);
    }
};