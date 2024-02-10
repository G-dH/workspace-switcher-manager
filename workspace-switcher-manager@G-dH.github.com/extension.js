/**
 * Workspaces Switcher Manager
 * extension.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022 - 2024
 * @license    GPL-3.0
 */
'use strict';

const { GLib, GObject, Clutter, St, Meta, Shell } = imports.gi;
const Main = imports.ui.main;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;
const Util = Me.imports.util;
const VerticalWorkspaces = Me.imports.verticalWorkspaces;

const ANIMATION_TIME = 100;

const wsPopupMode = {
    ALL: 0,
    ACTIVE: 1,
    DEFAULT: 2,
};

let opt;

function init(me) {
    ExtensionUtils.initTranslations();

    const wsm = new WSM(me);
    return wsm;
}

class WSM {
    constructor(me) {
        this.metadata = me.metadata;
    }

    enable() {
        this._original_WorkspaceSwitcherPopup = WorkspaceSwitcherPopup.WorkspaceSwitcherPopup;
        this._original_getNeighbor = Meta.Workspace.prototype.get_neighbor;
        this._defaultOrientationVertical = global.workspaceManager.layout_rows === -1;

        // if VW extension enabled, disable this option in WSM
        this._wsOrientationEnabled = !Util.getEnabledExtensions('vertical-workspaces').length;

        opt = new Settings.Options(this);

        this._overrides = new Util.Overrides();

        this._updatePopupMode();

        this._reverseWsOrientation(opt.get('reverseWsOrientation'));
        this._updateNeighbor();

        opt.connect('changed', this._updateSettings.bind(this));

        console.debug(`${this.metadata.name}: enabled`);
    }

    disable() {
        if (this._prefsDemoTimeoutId) {
            GLib.source_remove(this._prefsDemoTimeoutId);
            this._prefsDemoTimeoutId = 0;
        }

        if  (Main.wm._workspaceSwitcherPopup) {
            Main.wm._workspaceSwitcherPopup.destroy();
            Main.wm._workspaceSwitcherPopup = null;
        }

        this._setDefaultWsPopup();
        Meta.Workspace.prototype.get_neighbor = this._original_getNeighbor;

        this._reverseWsOrientation(false);

        this._overrides.removeAll();
        this._overrides = null;

        if (opt) {
            opt.destroy();
            opt = null;
        }

        console.debug(`${this.metadata.name}: disabled`);
    }

    _setCustomWsPopup() {
        this._setDefaultWsPopup();
        WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = WorkspaceSwitcherPopupCustom;
    }

    _setDefaultWsPopup() {
        WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = this._original_WorkspaceSwitcherPopup;
    }

    // ------------------------------------------------------------------------------
    _updateSettings(settings, key) {
        switch (key) {
        case 'popup-mode':
            this._updatePopupMode();
            break;
        case 'default-colors':
            return;
        case 'ws-wraparound':
        case 'ws-ignore-last':
            this._updateNeighbor();
            return;
        case 'reverse-ws-orientation':
            this._reverseWsOrientation(opt.get('reverseWsOrientation'), true);
            this._updateNeighbor();
            return;
        }

        // avoid multiple pop-ups when more than one settings keys were changed at once
        if (this._prefsDemoTimeoutId)
            GLib.source_remove(this._prefsDemoTimeoutId);

        this._prefsDemoTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, this._showPopupForPrefs.bind(this));
    }

    _updatePopupMode() {
        const popupMode = opt.get('popupMode');
        if (popupMode === wsPopupMode.DEFAULT) {
            this._setDefaultWsPopup();
            // set modified default so we can set its position and timing
            WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = WorkspaceSwitcherPopupDefault;
        } else {
            this._setCustomWsPopup();
        }
    }

    _updateNeighbor() {
        if (opt.get('wsSwitchWrap') || opt.get('wsSwitchIgnoreLast') || opt.get('reverseWsOrientation'))
            Meta.Workspace.prototype.get_neighbor = this._getNeighbor;
        else
            Meta.Workspace.prototype.get_neighbor = this._original_getNeighbor;
    }

    _reverseWsOrientation(reverse = false) {
        // this option is in conflict with Vertical Workspaces extension that includes the same patch
        if (!this._wsOrientationEnabled)
            return;

        // reverse === false means reset
        const orientationVertical = reverse ? !this._defaultOrientationVertical : this._defaultOrientationVertical;

        if (orientationVertical) {
            global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, -1, 1);
            if (VerticalWorkspaces)
                VerticalWorkspaces.patch(this._overrides);
        } else { // horizontal
            global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, 1, -1);
            if (VerticalWorkspaces)
                VerticalWorkspaces.reset(this._overrides);
        }
    }

    _showPopupForPrefs() {
        // if user is currently customizing the popup, show the popup on the screen
        const wsIndex = global.workspaceManager.get_active_workspace_index();
        if (Main.wm._workspaceSwitcherPopup !== null) {
            Main.wm._workspaceSwitcherPopup.destroy();
            Main.wm._workspaceSwitcherPopup = null;
        }

        Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
        Main.wm._workspaceSwitcherPopup.connect('destroy', () => {
            Main.wm._workspaceSwitcherPopup = null;
        });

        Main.wm._workspaceSwitcherPopup.display(wsIndex);

        this._prefsDemoTimeoutId = 0;
        return GLib.SOURCE_REMOVE;
    }

    _getNeighbor(direction) {
        const activeIndex = this.index();
        const ignoreLast = opt.get('wsSwitchIgnoreLast');
        const wraparound = opt.get('wsSwitchWrap');
        const nWorkspaces = global.workspace_manager.n_workspaces - (ignoreLast ? 1 : 0);
        const lastIndex = nWorkspaces - 1;
        const rows = global.workspace_manager.layout_rows > -1 ? global.workspace_manager.layout_rows : nWorkspaces;
        const columns = global.workspace_manager.layout_columns > -1 ? global.workspace_manager.layout_columns : nWorkspaces;

        let index = activeIndex;
        let neighborExists;

        if (direction === Meta.MotionDirection.LEFT) {
            index -= 1;
            const currentRow = Math.floor(activeIndex / columns);
            const indexRow = Math.floor(index / columns);
            neighborExists = index > -1 && indexRow === currentRow;
            if (wraparound && !neighborExists) {
                index = currentRow * columns + columns - 1;
                const maxIndexOnLastRow = lastIndex % columns;
                index = index < lastIndex ? index : currentRow * columns + maxIndexOnLastRow;
            }
        } else if (direction === Meta.MotionDirection.RIGHT) {
            index += 1;
            const currentRow = Math.floor(activeIndex / columns);
            const indexRow = Math.floor(index / columns);
            neighborExists = index <= lastIndex && indexRow === currentRow;
            if (wraparound && !neighborExists)
                index = currentRow * columns;
        } else if (direction === Meta.MotionDirection.UP) {
            index -= columns;
            neighborExists = index > -1;
            if (wraparound && !neighborExists) {
                index = rows * columns + index;
                index = index < nWorkspaces ? index : index - columns;
            }
        } else if (direction === Meta.MotionDirection.DOWN) {
            index += columns;
            neighborExists = index <= lastIndex;
            if (wraparound && !neighborExists)
                index %= columns;
        }

        return global.workspace_manager.get_workspace_by_index(neighborExists || wraparound ? index : activeIndex);
    }
}

function _getWindowApp(metaWindow) {
    let tracker = Shell.WindowTracker.get_default();
    return tracker.get_window_app(metaWindow);
}

var WorkspaceSwitcherPopupCustom = GObject.registerClass(
class WorkspaceSwitcherPopupCustom extends St.Widget {
    _init() {
        super._init({
            x: 0,
            y: 0,
            width: global.screen_width,
            height: global.screen_height,
            style_class: 'workspace-switcher-group',
        });

        Main.uiGroup.add_child(this);

        this._timeoutId = 0;

        this._popupMode = opt.get('popupMode');
        this._popupDisabled = !opt.get('popupVisibility');
        // if popup disabled don't allocate more resources
        if (this._popupDisabled)
            return;

        this._container = new St.BoxLayout({
            style_class: 'workspace-switcher-container',
        });
        this.add_child(this._container);

        this._list = new WorkspaceSwitcherPopupList();
        this._list._popupMode = this._popupMode;
        this._container.add_child(this._list);

        this._monitorOption = opt.get('monitor');
        if (this._monitorOption === 0)
            this._monitorIndex = global.display.get_primary_monitor();
        else
            this._monitorIndex = global.display.get_current_monitor();

        this._workspacesOnPrimaryOnly = opt.get('workspacesOnPrimaryOnly');

        this._horizontalPosition = opt.get('popupHorizontal') / 100;
        this._verticalPosition = opt.get('popupVertical') / 100;
        this._modifiersCancelTimeout = opt.get('modifiersHidePopup');
        this._displayTimeout = opt.get('popupTimeout');
        this._fadeOutTime = opt.get('fadeOutTime');

        this._popScale = opt.get('popupScale') / 100;
        this._paddingScale = opt.get('popupPaddingScale') / 100;
        this._spacingScale = opt.get('popupSpacingScale') / 100;
        this._radiusScale = opt.get('popupRadiusScale') / 100;
        this._list._popScale = this._popScale;

        this._indexScale = opt.get('indexScale') / 100;
        this._fontScale = opt.get('fontScale') / 100;
        this._textBold = opt.get('textBold');
        this._textShadow = opt.get('textShadow');
        this._wrapAppNames = opt.get('wrapAppNames');

        this._popupOpacity = opt.get('popupOpacity');
        this._bgColor = opt.get('popupBgColor');
        this._borderColor = opt.get('popupBorderColor');
        this._activeFgColor = opt.get('popupActiveFgColor');
        this._activeBgColor = opt.get('popupActiveBgColor');
        this._inactiveFgColor = opt.get('popupInactiveFgColor');
        this._inactiveBgColor = opt.get('popupInactiveBgColor');
        this._borderColor = opt.get('popupBorderColor');

        this._activeShowWsIndex = opt.get('activeShowWsIndex');
        this._activeShowWsName = opt.get('activeShowWsName');
        this._activeShowAppName = opt.get('activeShowAppName');
        this._activeShowWinTitle = opt.get('activeShowWinTitle');
        this._inactiveShowWsIndex = opt.get('inactiveShowWsIndex');
        this._inactiveShowWsName  = opt.get('inactiveShowWsName');
        this._inactiveShowAppName = opt.get('inactiveShowAppName');
        this._inactiveShowWinTitle = opt.get('inactiveShowWinTitle');

        this.hide();

        let workspaceManager = global.workspace_manager;
        this._workspaceManagerSignals = [];
        this._workspaceManagerSignals.push(workspaceManager.connect('workspace-added',
            this._redisplay.bind(this)));
        this._workspaceManagerSignals.push(workspaceManager.connect('workspace-removed',
            this._redisplay.bind(this)));

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _show() {
        this._container.ease({
            opacity: 255,
            duration: ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        this.show();
    }

    display(activeWorkspaceIndex = null) {
        if (this._popupDisabled) {
            // in this case the popup object will stay in Main.wm._workspaceSwitcherPopup
            // and wil not be recreated each time as there is no content to update
            return;
        }

        this._activeWorkspaceIndex = activeWorkspaceIndex;

        this._setCustomStyle();
        this._setSpacing();
        this._redisplay();
        this._resetTimeout();

        this.opacity = Math.floor(this._popupOpacity / 100 * 255);

        this._show();
        // this._setCustomStyle();
        // first style adjustments have to be made to calculate popup size
        this._setPopupPosition();

        if (this._list._fitToScreenScale < 1)
            this._addLabels();
    }

    _redisplay() {
        let workspaceManager = global.workspace_manager;

        this._list.destroy_all_children();

        for (let i = 0; i < workspaceManager.n_workspaces; i++) {
            let indicator = null;

            if (i === this._activeWorkspaceIndex)
                indicator = new St.Bin({ style_class: 'ws-switcher-active' });
            // TODO single ws indicator needs to be handled in the container class, disabled for now
            else if (this._popupMode === wsPopupMode.ALL)
                indicator = new St.Bin({ style_class: 'ws-switcher-box' });

            if (indicator) {
                // we need to know wsIndex of active box in single ws mode
                indicator._wsIndex = i;
                this._list.add_child(indicator);
            }
        }
        this._setCustomStyle();
        this._addLabels();
    }

    _resetTimeout() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._displayTimeout)
            this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._displayTimeout, this._onTimeout.bind(this));
    }

    _onTimeout() {
        // if user holds any modifier key, don't hide the popup and wait until they release the keys
        if (this._modifiersCancelTimeout) {
            const mods = global.get_pointer()[2];
            if (mods & 77)
                return GLib.SOURCE_CONTINUE;
        }

        this._container.ease({
            opacity: 0,
            duration: this._fadeOutTime,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this.destroy(),
        });

        this._timeoutId = 0;
        return GLib.SOURCE_REMOVE;
    }

    _onDestroy() {
        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;

        let workspaceManager = global.workspace_manager;
        for (let i = 0; i < this._workspaceManagerSignals.length; i++)
            workspaceManager.disconnect(this._workspaceManagerSignals[i]);

        this._workspaceManagerSignals = [];
        this._wsNamesSettings = null;
    }

    _setCustomStyle() {
        if (this._contRadius === undefined) {
            const contRadius = this._container.get_theme_node().get_length('border-radius');
            // this._contRadius = Math.min(Math.max(Math.floor(contRadius * this._popScale), 3), contRadius);
            this._contRadius = Math.max(Math.floor(contRadius * this._radiusScale), 3);
            let contPadding = this.get_theme_node().get_length('padding') || 10;
            contPadding = Math.max(contPadding * this._popScale, 2);
            this._contPadding = Math.floor(contPadding * this._paddingScale);

            this._container.set_style(`padding: ${this._contPadding}px;
                                            border-radius: ${this._contRadius}px;
                                            background-color: ${this._bgColor};
                                            border-color: ${this._borderColor};`
            );
        }

        const children = this._list.get_children();
        for (let i = 0; i < children.length; i++) {
            if (this._boxRadius === undefined) {
                const theme = children[i].get_theme_node();
                const boxRadius = theme.get_length('border-radius');
                this._boxRadius = Math.max(Math.floor(boxRadius * this._radiusScale), 3);
                this._boxHeight = Math.floor(theme.get_height() * this._popScale);
                this._boxBgSize = Math.floor(theme.get_length('background-size') * this._popScale);
            }
            if (i === this._activeWorkspaceIndex || this._popupMode) { // 0 all ws 1 single ws 2,3 will never get to here
                children[i].set_style(` background-size: ${this._boxBgSize}px;
                                        border-radius: ${this._boxRadius}px;
                                        color: ${this._activeFgColor};
                                        background-color: ${this._activeBgColor};
                                        border-color: ${this._activeBgColor};
                                        box-shadow: none;`
                );
            } else {
                children[i].set_style(` background-size: ${this._boxBgSize}px;
                                        border-radius: ${this._boxRadius}px;
                                        color: ${this._inactiveFgColor};
                                        background-color: ${this._inactiveBgColor};
                                        border-color: ${this._borderColor};`
                );
            }
        }
    }

    _addLabels() {
        const children = this._list.get_children();
        for (let i = 0; i < children.length; i++) {
            const label = this._getCustomLabel(children[i]._wsIndex);
            if (label)
                children[i].set_child(label);
        }
    }

    _setSpacing() {
        let spacing;
        if (!this._list._listSpacing) {
            spacing = this._list.get_theme_node().get_length('spacing');
            spacing = Math.max(Math.floor(spacing * this._popScale), 4);
            this._list._listSpacing = Math.floor(spacing * this._spacingScale);
            this._list.set_style(`spacing: ${this._list._listSpacing}px;`);
        }
    }

    _getWorkspaceThumbnail(index) {
        let ws = global.workspaceManager.get_workspace_by_index(index);
        let thumbnail = new WorkspaceThumbnail.WorkspaceThumbnail(ws, this._monitorIndex);
        const screenHeight = global.display.get_monitor_geometry(this._monitorIndex).height;
        const scale = this._boxHeight / screenHeight * 2;
        thumbnail.get_children().forEach(w => w.set_scale(scale, scale));
        thumbnail._contents.set_position(0, 0);
        return thumbnail;
    }

    _setPopupPosition() {

        let workArea = global.display.get_monitor_geometry(this._monitorIndex);

        let [, containerNatHeight] = this._container.get_preferred_height(global.screen_width);
        let [, containerNatWidth] = this._container.get_preferred_width(containerNatHeight);
        let h = this._horizontalPosition;
        let v = this._verticalPosition;
        this._container.x = workArea.x + Math.floor((workArea.width - containerNatWidth) * h);
        this._container.y = workArea.y + Math.floor((workArea.height - containerNatHeight) * v);
    }

    _getWsNamesSettings() {
        if (!this._wsNamesSettings) {
            this._wsNamesSettings = ExtensionUtils.getSettings(
                'org.gnome.desktop.wm.preferences');
        }
        return this._wsNamesSettings;
    }

    _getCustomLabel(wsIndex) {
        let labelBox = null;
        let textLabel = null;
        let indexLabel = null;
        let titleLabel = null;
        let text = '';
        const textShadowStyle = 'text-shadow: +1px -1px 4px rgb(200, 200, 200);';

        const wsIndexIsActiveWS = wsIndex === this._activeWorkspaceIndex;

        const showIndex = wsIndexIsActiveWS ? this._activeShowWsIndex  : this._inactiveShowWsIndex;
        const showName  = wsIndexIsActiveWS ? this._activeShowWsName   : this._inactiveShowWsName;
        const showApp   = wsIndexIsActiveWS ? this._activeShowAppName  : this._inactiveShowAppName;
        const showTitle = wsIndexIsActiveWS ? this._activeShowWinTitle : this._inactiveShowWinTitle;

        if (!(showIndex || showName || showApp || showTitle))
            return null;

        if (showIndex) {
            const text = `${wsIndex + 1}`;
            const fontSize = this._popScale * this._indexScale * this._list._fitToScreenScale;
            indexLabel = new St.Label({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                style: `text-align: center;
                        font-size: ${fontSize}em;
                        ${this._textBold ? 'font-weight: bold;' : ''}
                        ${this._textShadow ? textShadowStyle : ''}
                        padding: 2px`,
                text,
            });
        }

        if (showName) {
            const name = this._getWsName(wsIndex);
            if (name) {
                if (text)
                    text += '\n';

                text += name;
            }
        }

        if (showApp) {
            const appName = this._getWsAppName(wsIndex);
            if (appName) {
                if (text)
                    text += '\n';

                text += appName;
            }
        }

        if (showTitle) {
            const winTitle = this._getWinTitle(wsIndex);
            const fontSize = this._popScale * this._fontScale * 0.8 * this._list._fitToScreenScale;
            if (winTitle && !text.split('\n').includes(winTitle)) {
                titleLabel = new St.Label({
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: `text-align: center;
                            font-size: ${fontSize}em;
                            ${this._textBold ? 'font-weight: bold;' : ''}
                            ${this._textShadow ? textShadowStyle : ''}
                            padding-top: 0.3em;
                            padding-left: 0.5em;
                            padding-right: 0.5em;`,
                    text: winTitle,
                });
            }
        }

        let fontSize = this._popScale * this._fontScale * this._list._fitToScreenScale;
        // if text is ordered but not delivered (no app name, no ws name) but ws index will be shown,
        // add an empty line to avoid index jumping during switching (at least when app name wrapping is disabled)
        if (this._popupMode === wsPopupMode.ACTIVE && (showName || showApp || showTitle) && showIndex && !text)
            text = ' ';

        if (text) {
            textLabel = new St.Label({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                style: `text-align: center;
                        font-size: ${fontSize}em;
                        ${this._textBold ? 'font-weight: bold;' : ''}
                        ${this._textShadow ? textShadowStyle : ''}
                        padding-top: 0.3em;
                        padding-left: 0.5em;
                        padding-right: 0.5em;`,
                text,
            });
        }

        if (indexLabel || textLabel || titleLabel) {
            labelBox = new St.BoxLayout({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                vertical: true,
            });
        }
        if (indexLabel)
            labelBox.add_child(indexLabel);

        if (textLabel)
            labelBox.add_child(textLabel);


        if (titleLabel)
            labelBox.add_child(titleLabel);


        return labelBox;
    }

    _getWsName(wsIndex) {
        if (!this._wsNames) {
            const settings = this._getWsNamesSettings();
            this._wsNames = settings.get_strv('workspace-names');
        }

        if (this._wsNames.length > wsIndex)
            return this._wsNames[wsIndex];

        return null;
    }

    _getWindows(workspace, modals = false) {
        // We ignore skip-taskbar windows in switchers, but if they are attached
        // to their parent, their position in the MRU list may be more appropriate
        // than the parent; so start with the complete list ...
        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL,
            workspace);
        // ... map windows to their parent where appropriate, or leave it if the user wants to list modal windows too...
        return windows.map(w => {
            return w.is_attached_dialog() && !modals ? w.get_transient_for() : w;
        // ... and filter out skip-taskbar windows and duplicates
        // ... (if modal windows (attached_dialogs) haven't been removed in map function, leave them in the list)
        }).filter((w, i, a) => (!w.skip_taskbar && a.indexOf(w) === i) || w.is_attached_dialog());
    }

    _getCurrentWsWin(wsIndex) {
        const ws = global.workspaceManager.get_workspace_by_index(wsIndex);
        let wins = this._getWindows(null);

        wins = wins.filter(w => w.get_workspace() === ws);

        if (this._workspacesOnPrimaryOnly) {
            const monitor = Main.layoutManager.primaryIndex;
            wins = wins.filter(w => w.get_monitor() === monitor);
        }

        if (wins.length > 0)
            return wins[0];
        else
            return null;
    }

    _getWsAppName(wsIndex) {
        const win = this._getCurrentWsWin(wsIndex);

        let appName = null;
        if (win) {
            appName = _getWindowApp(win).get_name();
            // wrap app names
            if (this._wrapAppNames)
                appName = appName.replace(' ', '\n');
        }

        return appName;
    }


    _getWinTitle(wsIndex) {
        const win = this._getCurrentWsWin(wsIndex);
        let title = null;
        if (win)
            title = win.get_title();


        return title;
    }
});

const WorkspaceSwitcherPopupList = GObject.registerClass(
class WorkspaceSwitcherPopupList extends St.Widget {
    _init() {
        super._init({
            style_class: 'workspace-switcher-custom',
            // this parameter causes error: g_value_get_enum: assertion 'G_VALUE_HOLDS_ENUM (value)' failed
            // not in the original popup class, which has exactly the same super._init() call
            /* offscreen_redirect: Clutter.OffscreenRedirect.ALWAYS,*/
        });
        this._itemSpacing = 0;
        this._childHeight = 0;
        this._childWidth = 0;
        this._fitToScreenScale = 1;
        this._customWidthScale = opt.get('popupWidthScale') / 100;
        let orientation = global.workspace_manager.layout_rows === -1;
        if (opt.get('reversePopupOrientation'))
            orientation = !orientation;
        this._orientation = orientation
            ? Clutter.Orientation.VERTICAL
            : Clutter.Orientation.HORIZONTAL;

        this.connect('style-changed', () => {
            this._itemSpacing = this._listSpacing;
            if (!this._itemSpacing)
                this._itemSpacing = this.get_theme_node().get_length('spacing');
        });
    }

    _getPreferredSizeForOrientation(_forSize) {
        let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        let themeNode = this.get_theme_node();

        let availSize;
        if (this._orientation === Clutter.Orientation.HORIZONTAL)
            availSize = workArea.width - themeNode.get_horizontal_padding();
        else
            availSize = workArea.height - themeNode.get_vertical_padding();

        let size = 0;
        for (let child of this.get_children()) {
            let [, childNaturalHeight] = child.get_preferred_height(-1);
            let height = childNaturalHeight * workArea.width / workArea.height * this._popScale;

            if (this._orientation === Clutter.Orientation.HORIZONTAL) // width scale option application
                size += height * workArea.width / workArea.height * this._customWidthScale;
            else
                size += height;
        }

        let workspaceManager = global.workspace_manager;
        let spacing = this._itemSpacing * (this._popupMode !== wsPopupMode.ALL ? 0 : workspaceManager.n_workspaces - 1);
        size += spacing;

        // note info about downsizing the popup to calculate proper content size
        this._fitToScreenScale = size > availSize ? availSize / size : 1;

        size = Math.min(size, availSize);

        if (this._orientation === Clutter.Orientation.HORIZONTAL) {
            this._childWidth = (size - spacing) / (this._popupMode !== wsPopupMode.ALL ? 1 : workspaceManager.n_workspaces);
            return themeNode.adjust_preferred_width(size, size);
        } else {
            this._childHeight = (size - spacing) / (this._popupMode !== wsPopupMode.ALL ? 1 : workspaceManager.n_workspaces);
            return themeNode.adjust_preferred_height(size, size);
        }
    }

    _getSizeForOppositeOrientation() {
        let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);

        if (this._orientation === Clutter.Orientation.HORIZONTAL) {  // width scale option application
            this._childHeight = Math.round(this._childWidth * workArea.height / workArea.width / this._customWidthScale);
            return [this._childHeight, this._childHeight];
        } else {
            this._childWidth = Math.round(this._childHeight * workArea.width / workArea.height * this._customWidthScale);
            return [this._childWidth, this._childWidth];
        }
    }

    vfunc_get_preferred_height(forWidth) {
        if (this._orientation === Clutter.Orientation.HORIZONTAL)
            return this._getSizeForOppositeOrientation();
        else
            return this._getPreferredSizeForOrientation(forWidth);
    }

    vfunc_get_preferred_width(forHeight) {
        if (this._orientation === Clutter.Orientation.HORIZONTAL)
            return this._getPreferredSizeForOrientation(forHeight);
        else
            return this._getSizeForOppositeOrientation();
    }

    vfunc_allocate(box) {
        this.set_allocation(box);

        let themeNode = this.get_theme_node();
        box = themeNode.get_content_box(box);

        let childBox = new Clutter.ActorBox();

        let rtl = this.text_direction === Clutter.TextDirection.RTL;
        let x = rtl ? box.x2 - this._childWidth : box.x1;
        let y = box.y1;
        for (let child of this.get_children()) {
            childBox.x1 = Math.round(x);
            childBox.x2 = Math.round(x + this._childWidth);
            childBox.y1 = Math.round(y);
            childBox.y2 = Math.round(y + this._childHeight);

            if (this._orientation === Clutter.Orientation.HORIZONTAL) {
                if (rtl)
                    x -= this._childWidth + this._itemSpacing;
                else
                    x += this._childWidth + this._itemSpacing;
            } else {
                y += this._childHeight + this._itemSpacing;
            }
            child.allocate(childBox);
        }
    }
});

const WorkspaceSwitcherPopupDefault = GObject.registerClass(
class WorkspaceSwitcherPopupDefault extends WorkspaceSwitcherPopup.WorkspaceSwitcherPopup {
    _init() {
        super._init();

        this._popupDisabled = !opt.get('popupVisibility');
        // if popup disabled don't allocate more resources
        if (this._popupDisabled)
            return;

        this.remove_constraint(this.get_constraints()[0]);
        this._monitorOption = opt.get('monitor');
        this._workspacesOnPrimaryOnly = opt.get('workspacesOnPrimaryOnly');

        this._horizontalPosition = opt.get('popupHorizontal') / 100;
        this._verticalPosition = opt.get('popupVertical') / 100;
        this._modifiersCancelTimeout = opt.get('modifiersHidePopup');
        this._fadeOutTime = opt.get('fadeOutTime');
        this._displayTimeout = opt.get('popupTimeout');
        this._list.set_style('margin: 0;');
        this._redisplay();

        const vertical = global.workspace_manager.layout_rows === -1;
        this._list.vertical = vertical;
        if (opt.get('reversePopupOrientation'))
            this._list.vertical =  !this._list.vertical;

        if (this._list.vertical)
            this._list.add_style_class_name('ws-switcher-vertical');
    }

    _setPopupPosition() {
        let workArea;
        if (this._monitorOption === 0)
            workArea = global.display.get_monitor_geometry(Main.layoutManager.primaryIndex);
        else
            workArea = global.display.get_monitor_geometry(global.display.get_current_monitor());

        let [, natHeight] = this.get_preferred_height(global.screen_width);
        let [, natWidth] = this.get_preferred_width(natHeight);
        let h = this._horizontalPosition;
        let v = this._verticalPosition;
        this.x = workArea.x + Math.floor((workArea.width - natWidth) * h);
        this.y = workArea.y + Math.floor((workArea.height - natHeight) * v);
    }

    display(activeWorkspaceIndex) {
        if (this._popupDisabled) {
            // in this case the popup object will stay in Main.wm._workspaceSwitcherPopup
            // and wil not be recreated each time as there is no content to update
            return;
        }

        this._activeWorkspaceIndex = activeWorkspaceIndex;

        this._redisplay();
        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._displayTimeout, this._onTimeout.bind(this));
        GLib.Source.set_name_by_id(this._timeoutId, '[gnome-shell] this._onTimeout');

        const duration = this.visible ? 0 : 100;
        this.show();
        this.opacity = 0;
        this.ease({
            opacity: 255,
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        this._setPopupPosition();
    }

    _onTimeout() {
        // if user holds any modifier key, don't hide the popup and wait until they release the keys
        if (this._modifiersCancelTimeout) {
            const mods = global.get_pointer()[2];
            if (mods & 77)
                return GLib.SOURCE_CONTINUE;
        }

        this.ease({
            opacity: 0,
            duration: this._fadeOutTime,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this.destroy(),
        });

        this._timeoutId = 0;
        return GLib.SOURCE_REMOVE;
    }

    _resetTimeout() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._displayTimeout)
            this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._displayTimeout, this._onTimeout.bind(this));
    }
});
