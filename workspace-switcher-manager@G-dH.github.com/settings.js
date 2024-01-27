/**
 * Workspaces Switcher Manager
 * settings.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022-2024
 * @license    GPL-3.0
 */
'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

let _;

export const Options = class Options {
    constructor(extension) {
        _ = extension.gettext.bind(extension);
        this._gsettings = extension.getSettings.bind(extension)();
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
            verticalOverview: ['boolean', 'vertical-overview'],

            wsNames: ['strv', 'workspace-names', this._getDesktopWmSettings],
            dynamicWorkspaces: ['boolean', 'dynamic-workspaces', this._getMutterSettings],
            numWorkspaces: ['int', 'num-workspaces', this._getDesktopWmSettings],
            workspacesOnPrimaryOnly: ['boolean', 'workspaces-only-on-primary', this._getMutterSettings],
        };
    }

    connect(name, callback) {
        const id = this._gsettings.connect(name, callback);
        this._connectionIds.push(id);
        return id;
    }

    _getWsNamesSettings() {
        const settings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.wm.preferences',
        });
        return settings;
    }

    _getMutterSettings() {
        const settings = new Gio.Settings({
            schema_id: 'org.gnome.mutter',
        });
        return settings;
    }

    _getDesktopWmSettings() {
        const settings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.wm.preferences',
        });
        return settings;
    }

    destroy() {
        this._connectionIds.forEach(id => this._gsettings.disconnect(id));
        if (this._writeTimeoutId) {
            GLib.source_remove(this._writeTimeoutId);
            this._writeTimeoutId = 0;
        }
    }

    get(option) {
        const [, key, settings] = this.options[option];

        let gSettings = this._gsettings;

        if (settings !== undefined)
            gSettings = settings();


        return gSettings.get_value(key).deep_unpack();
    }

    set(option, value) {
        const [format, key, settings] = this.options[option];

        let gSettings = this._gsettings;

        if (settings !== undefined)
            gSettings = settings();


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
        const [, key, settings] = this.options[option];

        let gSettings = this._gsettings;

        if (settings !== undefined)
            gSettings = settings();


        return gSettings.get_default_value(key).deep_unpack();
    }
};
