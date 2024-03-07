/**
 * Workspaces Switcher Manager
 * settings.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022 - 2024
 * @license    GPL-3.0
 */
'use strict';

const { GLib } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;


var Options = class {
    constructor() {
        this._gsettings = ExtensionUtils.getSettings(Me.metadata['settings-schema']);
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
            popupVisibility: ['int', 'popup-visibility'],
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
            popupOpacity: ['int', 'popup-opacity'],
            popupBgColor: ['string', 'popup-bg-color'],
            popupBorderColor: ['string', 'popup-border-color'],
            popupActiveFgColor: ['string', 'popup-active-fg-color'],
            popupActiveBgColor: ['string', 'popup-active-bg-color'],
            popupInactiveFgColor: ['string', 'popup-inactive-fg-color'],
            popupInactiveBgColor: ['string', 'popup-inactive-bg-color'],
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

            wsNames: ['strv', 'workspace-names', this._getWmPreferencesSettings],
            numWorkspaces: ['int', 'num-workspaces', this._getWmPreferencesSettings],
            dynamicWorkspaces: ['boolean', 'dynamic-workspaces', this._getMutterSettings],
            workspacesOnPrimaryOnly: ['boolean', 'workspaces-only-on-primary', this._getMutterSettings],

            profileName1: ['string', 'profile-name-1'],
            profileName2: ['string', 'profile-name-2'],
            profileName3: ['string', 'profile-name-3'],
            profileName4: ['string', 'profile-name-4'],
            profileName5: ['string', 'profile-name-5'],
        };
    }

    connect(name, callback, settings) {
        settings = settings ?? this._gsettings;
        const id = settings.connect(name, callback);
        this._connectionIds.push({ id, settings });
        return id;
    }

    destroy() {
        this._connectionIds.forEach(con => con.settings.disconnect(con.id));
        if (this._writeTimeoutId) {
            GLib.source_remove(this._writeTimeoutId);
            this._writeTimeoutId = 0;
        }
    }

    _getWmPreferencesSettings() {
        const settings = ExtensionUtils.getSettings(
            'org.gnome.desktop.wm.preferences');
        return settings;
    }

    _getMutterSettings() {
        const settings = ExtensionUtils.getSettings(
            'org.gnome.mutter');
        return settings;
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

    saveProfile(index) {
        const profile = {};
        Object.keys(this.options).forEach(v => {
            if (!v.startsWith('profileName'))
                profile[v] = this.get(v).toString();
        });

        this._gsettings.set_value(`profile-data-${index}`, new GLib.Variant('a{ss}', profile));
    }

    loadProfile(index) {
        const options = this._gsettings.get_value(`profile-data-${index}`).deep_unpack();
        for (let o of Object.keys(options)) {
            if (!this.options[o]) {
                console.error(`[${Me.metadata.name}] Error: "${o}" is not a valid profile key -> Update your profile`);
                continue;
            }
            const [type] = this.options[o];
            let value = options[o];
            switch (type) {
            case 'string':
                break;
            case 'boolean':
                value = value === 'true';
                break;
            case 'int':
                value = parseInt(value);
                break;
            case 'strv':
                value = value.split(',');
                break;
            }

            this.set(o, value);
        }
    }

    resetProfile(index) {
        this._gsettings.reset(`profile-data-${index}`);
        this._gsettings.reset(`profile-data-${index}`);
    }
};
