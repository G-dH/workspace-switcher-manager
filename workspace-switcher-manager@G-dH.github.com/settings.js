// Workspace Switcher Manager
// GPL v3 ©G-dH@Github.com
'use strict';

const { GLib, Gio } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Config = imports.misc.config;
var   shellVersion = parseFloat(Config.PACKAGE_VERSION);

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

    get activePrefsPage() {
        return this._gsettings.get_int('active-prefs-page');
    }
    set activePrefsPage(int_val) {
        this._gsettings.set_int('active-prefs-page', int_val);
    }

    // common options
    get popupMode() {
        return this._gsettings.get_int('popup-mode');
    }
    set popupMode(int_val) {
        this._gsettings.set_int('popup-mode', int_val);
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
        return this._gsettings.get_int('on-screen-time');
    }
    set popupTimeout(int_val) {
        this._gsettings.set_int('on-screen-time', int_val);
    }

    get fadeOutTime() {
        return this._gsettings.get_int('fade-out-time');
    }
    set fadeOutTime(int_val) {
        this._gsettings.set_int('fade-out-time', int_val);
    }

    get wsSwitchWrap() {
        return this._gsettings.get_boolean('ws-wraparound');
    }
    set wsSwitchWrap(bool_val) {
        this._gsettings.set_boolean('ws-wraparound', bool_val);
    }

    get wsSwitchIgnoreLast() {
        return this._gsettings.get_boolean('ws-ignore-last');
    }
    set wsSwitchIgnoreLast(bool_val) {
        this._gsettings.set_boolean('ws-ignore-last', bool_val);
    }

    get fontScale() {
        return this._gsettings.get_int('font-scale');
    }
    set fontScale(int_val) {
        this._gsettings.set_int('font-scale', int_val);
    }

    get indexScale() {
        return this._gsettings.get_int('index-scale');
    }
    set indexScale(int_val) {
        this._gsettings.set_int('index-scale', int_val);
    }

    get wrapAppNames() {
        return this._gsettings.get_boolean('wrap-app-names');
    }
    set wrapAppNames(bool_val) {
        this._gsettings.set_boolean('wrap-app-names', bool_val);
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

    get wsNames() {
        return this._getWsNamesSettings().get_strv('workspace-names');
    }
    set wsNames(names) {
        this._getWsNamesSettings().set_strv('workspace-names', names);
    }

    get popupScale() {
        return this._gsettings.get_int('popup-scale');
    }
    set popupScale(int_val) {
        this._gsettings.set_int('popup-scale', int_val);
    }

    get popupWidthScale() {
        return this._gsettings.get_int('popup-width-scale');
    }
    set popupWidthScale(int_val) {
        this._gsettings.set_int('popup-width-scale', int_val);
    }

    get popupPaddingScale() {
        return this._gsettings.get_int('popup-padding-scale');
    }
    set popupPaddingScale(int_val) {
        this._gsettings.set_int('popup-padding-scale', int_val);
    }

    get popupSpacingScale() {
        return this._gsettings.get_int('popup-spacing-scale');
    }
    set popupSpacingScale(int_val) {
        this._gsettings.set_int('popup-spacing-scale', int_val);
    }

    get popupRadiusScale() {
        return this._gsettings.get_int('popup-radius-scale');
    }
    set popupRadiusScale(int_val) {
        this._gsettings.set_int('popup-radius-scale', int_val);
    }

    get allowCustomColors() {
        return this._gsettings.get_boolean('allow-custom-colors');
    }
    set allowCustomColors(bool_val) {
        this._gsettings.set_boolean('allow-custom-colors', bool_val);
    }

    get popupOpacity() {
        return this._gsettings.get_int('popup-opacity');
    }
    set popupOpacity(int_val) {
        this._gsettings.set_int('popup-opacity', int_val);
    }

    get popupBgColor() {
        return this._gsettings.get_string('popup-bg-color');
    }
    set popupBgColor(string) {
        this._gsettings.set_string('popup-bg-color', string);
    }

    get popupBorderColor() {
        return this._gsettings.get_string('popup-border-color');
    }
    set popupBorderColor(string) {
        this._gsettings.set_string('popup-border-color', string);
    }

    get popupActiveFgColor() {
        return this._gsettings.get_string('popup-active-fg-color');
    }
    set popupActiveFgColor(string) {
        this._gsettings.set_string('popup-active-fg-color', string);
    }

    get popupActiveBgColor() {
        return this._gsettings.get_string('popup-active-bg-color');
    }
    set popupActiveBgColor(string) {
        this._gsettings.set_string('popup-active-bg-color', string);
    }

    get popupInactiveFgColor() {
        return this._gsettings.get_string('popup-inactive-fg-color');
    }
    set popupInactiveFgColor(string) {
        this._gsettings.set_string('popup-inactive-fg-color', string);
    }

    get popupInactiveBgColor() {
        return this._gsettings.get_string('popup-inactive-bg-color');
    }
    set popupInactiveBgColor(string) {
        this._gsettings.set_string('popup-inactive-bg-color', string);
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

    get workspaceMode() {
        const settings = this._getMutterSettings();
        const val = settings.get_boolean('dynamic-workspaces');
        return val ? 0 : 1;
    }
    set workspaceMode(int_val) {
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

    get reverseWsOrientation() {
        return this._gsettings.get_boolean('reverse-ws-orientation');
    }
    set reverseWsOrientation(bool_val) {
        this._gsettings.set_boolean('reverse-ws-orientation', bool_val);
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

    get workspacesOnPrimaryOnly() {
        const settings = this._getMutterSettings();
        return settings.get_boolean('workspaces-only-on-primary');
    }
    set workspacesOnPrimaryOnly(bool_val) {
        const settings = this._getMutterSettings();
        settings.set_boolean('workspaces-only-on-primary', bool_val);
    }
};
