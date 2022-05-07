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
        this._writeTimeoutId = 0;
        this._gsettings.delay();
        this._gsettings.connect('changed', () => {
            if (this._writeTimeoutId)
                GLib.Source.remove(this._writeTimeoutId);

            this._writeTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                300,
                () => {
                    this._gsettings.apply();
                    this._writeTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                }
            );
        });

        this._connectionIds = [];

        this.options = {
            monitor: ['int', 'monitor'],
            activePrefsPage: ['int', 'active-prefs-page'],
            popupMode: ['int', 'popup-mode'],
            popupHorizontal: ['int', 'horizontal'],
            popupVertical: ['int', 'vertical'],
            popupTimeout: ['int', 'on-screen-time'],
            fadeOutTime: ['int', 'fade-out-time'],
            wsSwitchWrap: ['boolean', 'ws-wraparound'],
            wsSwitchIgnoreLast: ['boolean', 'ws-ignore-last'],
            fontScale: ['int', 'font-scale'],
            indexScale: ['int', 'index-scale'],
            wrapAppNames: ['boolean', 'wrap-app-names'],
            textShadow: ['boolean', 'text-shadow'],
            textBold: ['boolean', 'text-bold'],
            wsNames: ['strv', 'workspace-names'],
            popupScale: ['int', 'popup-scale'],
            popupWidthScale: ['int', 'popup-width-scale'],
            popupPaddingScale: ['int', 'popup-padding-scale'],
            popupSpacingScale: ['int', 'popup-spacing-scale'],
            popupRadiusScale: ['int', 'popup-radius-scale'],
            allowCustomColors: ['boolean', 'allow-custom-colors'],
            popupOpacity: ['int', 'popup-opacity'],
            popupBgColor: ['string', 'popup-bg-color'],
            popupBorderColor: ['string', 'popup-border-color'],
            popupActiveFgColor: ['string', 'popup-active-fg-color'],
            popupActiveBgColor: ['string', 'popup-active-bg-color'],
            popupInactiveFgColor: ['string', 'popup-inactive-fg-color'],
            popupInactiveBgColor: ['string', 'popup-inactive-bg-color'],
            defaultColors: ['strv', 'default-colors'],
            activeShowWsIndex: ['boolean', 'active-show-ws-index'],
            activeShowWsName: ['boolean', 'active-show-ws-name'],
            activeShowAppName: ['boolean', 'active-show-app-name'],
            activeShowWinTitle: ['boolean', 'active-show-win-title'],
            inactiveShowWsIndex: ['boolean', 'inactive-show-ws-index'],
            inactiveShowWsName: ['boolean', 'inactive-show-ws-name'],
            inactiveShowAppName: ['boolean', 'inactive-show-app-name'],
            inactiveShowWinTitle: ['boolean', 'inactive-show-win-title'],
            reverseWsOrientation: ['boolean', 'reverse-ws-orientation'],
            modifiersHidePopup: ['boolean', 'modifiers-hide-popup'],
            reversePopupOrientation: ['boolean', 'reverse-popup-orientation'],

            wsNames: ['strv', 'workspace-names', this._getDesktopWmSettings],
            dynamicWorkspaces: ['boolean', 'dynamic-workspaces', this._getMutterSettings],
            numWorkspaces: ['int', 'num-workspaces', this._getDesktopWmSettings],
            workspacesOnPrimaryOnly: ['boolean', 'workspaces-only-on-primary', this._getMutterSettings]
        }
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
        if (this._writeTimeoutId) {
            GLib.source_remove(this._writeTimeoutId);
        }
    }

    get(option) {
        const [format, key, settings] = this.options[option];

        let gSettings = this._gsettings;

        if (settings !== undefined) {
            gSettings = settings();
        }

        return gSettings.get_value(key).deep_unpack();
    }

    set(option, value) {
        const [format, key, settings] = this.options[option];

        let gSettings = this._gsettings;

        if (settings !== undefined) {
            gSettings = settings();
        }

        switch (format) {
            case 'boolean':
                gSettings.set_boolean(key, value);
                break;
            case 'int':
                gSettings.set_int(key, value);
                break;
            case 'string':
                gSettings.set_string(key, value);
                break;
            case 'strv':
                gSettings.set_strv(key, value);
                break;
        }
    }

    getDefault(option) {
        const [format, key, settings] = this.options[option];

        let gSettings = this._gsettings;

        if (settings !== undefined) {
            gSettings = settings();
        }

        return gSettings.get_default_value(key).deep_unpack();
    }
};
