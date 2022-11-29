/**
 * Workspaces Switcher Manager
 * extension.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022
 * @license    GPL-3.0
 */
'use strict';

const { GLib, GObject, Clutter, St, Meta, Shell, Gio, Graphene } = imports.gi;
const Main = imports.ui.main;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const AltTab = imports.ui.altTab;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const WindowManager = imports.ui.windowManager;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;
const _Util = Me.imports.util;
let VerticalWorkspaces = null;

const shellVersion = Settings.shellVersion;

let originalWsPopup;
let originalWsPopupList;
let original_getNeighbor;

let defaultOrientationVertical;
let enableTimeoutId = 0;
let prefsDemoTimeoutId = 0;

let gOptions;

let DISPLAY_TIMEOUT = 300;
const ANIMATION_TIME = 100;

const ws_popup_mode = {
    ALL     : 0,
    ACTIVE  : 1,
    DEFAULT : 2,
    DISABLE : 3,
};


function init() {
    ExtensionUtils.initTranslations();

    originalWsPopup = WorkspaceSwitcherPopup.WorkspaceSwitcherPopup;
    originalWsPopupList = WorkspaceSwitcherPopup.WorkspaceSwitcherPopupList;
    original_getNeighbor = Meta.Workspace.prototype.get_neighbor;

    if (shellVersion >= 40) {
        VerticalWorkspaces = Me.imports.verticalWorkspaces;
    }

    defaultOrientationVertical = shellVersion < 40;
}

function enable() {
    enableTimeoutId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        // WSM must start after Vertical Workspaces extension to be able detect it
        800,
        () => {
            gOptions = new Settings.MscOptions();

            _storeDefaultColors();

            DISPLAY_TIMEOUT = gOptions.get('popupTimeout');
            if (gOptions.get('popupMode') !== ws_popup_mode.DEFAULT)
                _setCustomWsPopup();
            _reverseWsOrientation(gOptions.get('reverseWsOrientation'));
            _updateNeighbor();

            gOptions.connect('changed', _updateSettings);

            log(`${Me.metadata.name}: enabled`);
            enableTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        }
    );
}

function disable() {
    if (enableTimeoutId) {
        GLib.source_remove(enableTimeoutId);
        enableTimeoutId = 0;
    }

    if (prefsDemoTimeoutId) {
        GLib.source_remove(prefsDemoTimeoutId);
        prefsDemoTimeoutId = 0;
    }

    if  (Main.wm._workspaceSwitcherPopup) {
        Main.wm._workspaceSwitcherPopup.destroy();
        Main.wm._workspaceSwitcherPopup = null;
    }

    if (gOptions) {
        gOptions.destroy();
        gOptions = null;
    }

    _setDefaultWsPopup();
    Meta.Workspace.prototype.get_neighbor = original_getNeighbor;

    _reverseWsOrientation(false);
    log(`${Me.metadata.name}: disabled`);
}

function _setCustomWsPopup() {
    WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = WorkspaceSwitcherPopupCustom;
    WorkspaceSwitcherPopup.WorkspaceSwitcherPopupList = WorkspaceSwitcherPopupList;
}

function _setDefaultWsPopup() {
    if (shellVersion < 42) {
        WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = originalWsPopup;
        WorkspaceSwitcherPopup.WorkspaceSwitcherPopupList = originalWsPopupList;
    } else {
        WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = WorkspaceSwitcherPopup42;
    }
}

//------------------------------------------------------------------------------
function _updateSettings(settings, key) {
    switch (key) {
    case 'popup-mode':
        _updatePopupMode();
        break;
    case 'on-screen-time':
        DISPLAY_TIMEOUT = gOptions.get('popupTimeout');
        break;
    case 'default-colors':
        return;
    case 'ws-wraparound':
    case 'ws-ignore-last':
        _updateNeighbor();
        return;
    case 'reverse-ws-orientation':
    case 'vertical-overview':
        _reverseWsOrientation(gOptions.get('reverseWsOrientation'), true);
        _updateNeighbor();
        return;
    }

    // avoid multiple pop-ups when more than one settings keys were changed at once
    if (prefsDemoTimeoutId) {
        GLib.source_remove(prefsDemoTimeoutId);
    }
    prefsDemoTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, _showPopupForPrefs);
}

function _updatePopupMode() {
    const popupMode = gOptions.get('popupMode');
    if (popupMode === ws_popup_mode.DEFAULT) {
        _setDefaultWsPopup();
    } else {
        _setCustomWsPopup();
    }
}

function _updateNeighbor() {
    if (gOptions.get('wsSwitchWrap') || gOptions.get('wsSwitchIgnoreLast') || gOptions.get('reverseWsOrientation')) {
        Meta.Workspace.prototype.get_neighbor = getNeighbor;
    } else {
        Meta.Workspace.prototype.get_neighbor = original_getNeighbor;
    }
}

function _reverseWsOrientation(reverse = false) {
    // this option is in conflict with Vertical Workspaces extension that includes the same patch
    if (global.verticalWorkspacesEnabled)
        return;
    // reverse == false means reset, default values for GS < 40 == true; GS >= 40 == false;
    const orientationVertical = reverse ? !defaultOrientationVertical : defaultOrientationVertical;

    if (orientationVertical) {
        global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, -1, 1);
        if (shellVersion >= 40) {
            VerticalWorkspaces.patch();
        }
    } else { // horizontal
        global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, 1, -1);
        if (shellVersion >= 40) {
            VerticalWorkspaces.reset();
        }
    }
}

function _showPopupForPrefs() {
    // if user is currently customizing the popup, show the popup on the screen
    const wsIndex = global.workspaceManager.get_active_workspace_index();
    const direction = Meta.MotionDirection.RIGHT;
    if (Main.wm._workspaceSwitcherPopup !== null) {
        Main.wm._workspaceSwitcherPopup.destroy();
        Main.wm._workspaceSwitcherPopup = null;
    }

    Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
    Main.wm._workspaceSwitcherPopup.connect('destroy', () => {
        Main.wm._workspaceSwitcherPopup = null;
    });

    if (shellVersion >= 42 && gOptions.get('popupMode') === ws_popup_mode.DEFAULT) {
        Main.wm._workspaceSwitcherPopup.display(wsIndex);
    } else {
        Main.wm._workspaceSwitcherPopup.display(direction, wsIndex);
    }

    prefsDemoTimeoutId = 0;
    return GLib.SOURCE_REMOVE;
}

function _storeDefaultColors() {
    // default popup in GS42 needs to be replaced by the custom one in order to get its default colors
    if (shellVersion >= 42) {
        _setCustomWsPopup();
    }

    const popup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
    // set 'all workspaces' mode to get 'inactive' box colors (if # of ws > 1)
    popup._popupMode = 0;
    popup._list._popupMode = 0;
    popup._allowCustomColors = false;

    popup.display(Meta.MotionDirection.UP, 0);
    popup.opacity = 0;

    const popupMode = gOptions.get('popupMode', true);
    if (shellVersion >= 42 && popupMode === ws_popup_mode.DEFAULT) {
        _setDefaultWsPopup();
    }

    const containerNode = popup._container.get_theme_node();
    const listItems = popup._list.get_children();
    const activeNode = listItems[0].get_theme_node();
    let inactiveNode;

    const popupBgColor = containerNode.lookup_color('background-color', true)[1];
    // border color in default theme is set in 'border' element and can not be read directly
    let [result, borderColor] = activeNode.lookup_color('border-color', true);
    if (result) {
        borderColor = borderColor.to_string();
    } else {
        borderColor = 'rgb(53,53,53)'; // average of default inactive box and container borders 31/40
    }
    const activeFgColor = activeNode.get_foreground_color();
    const activeBgColor = activeNode.get_background_color();
    let inactiveFgColor = {};
    let inactiveBgColor = {};
    if (popup._list.get_children()[1]) {
        inactiveNode = popup._list.get_children()[1].get_theme_node();
        inactiveFgColor = inactiveNode.get_foreground_color();
        inactiveBgColor = inactiveNode.get_background_color();
    }

    const defaultColors = [
         `rgba(${popupBgColor.red},${popupBgColor.green},${popupBgColor.blue},${popupBgColor.alpha})`,
         borderColor,
         `rgba(${activeFgColor.red},${activeFgColor.green},${activeFgColor.blue},${activeFgColor.alpha})`,
         `rgba(${activeBgColor.red},${activeBgColor.green},${activeBgColor.blue},${activeBgColor.alpha})`,
         `rgba(${inactiveFgColor.red || activeFgColor.red},${inactiveFgColor.green || activeFgColor.green},${inactiveFgColor.blue || activeFgColor.blue},${inactiveFgColor.alpha || activeFgColor.alpha})`,
         `rgba(${inactiveBgColor.red || popupBgColor.red},${inactiveBgColor.green || popupBgColor.green},${inactiveBgColor.blue || popupBgColor.blue},${inactiveBgColor.alpha || activeBgColor.alpha})`,
    ];

    gOptions.set('defaultColors', defaultColors);

    if (!gOptions.get('popupBgColor'))
        gOptions.set('popupBgColor', defaultColors[0]);
    if (!gOptions.get('popupBorderColor'))
        gOptions.set('popupBorderColor', defaultColors[1]);
    if (!gOptions.get('popupActiveFgColor'))
        gOptions.set('popupActiveFgColor', defaultColors[2]);
    if (!gOptions.get('popupActiveBgColor'))
        gOptions.set('popupActiveBgColor', defaultColors[3]);
    if (!gOptions.get('popupInactiveFgColor'))
        gOptions.set('popupInactiveFgColor', defaultColors[4]);
    if (!gOptions.get('popupInactiveBgColor'))
        gOptions.set('popupInactiveBgColor', defaultColors[5]);
}

function getNeighbor(direction) {
    const activeIndex = this.index();
    const ignoreLast = gOptions.get('wsSwitchIgnoreLast');
    const wraparound = gOptions.get('wsSwitchWrap');
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
        if (wraparound && !neighborExists) {
            index = currentRow * columns;
        }
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
        if (wraparound && !neighborExists) {
            index = index % columns;
        }
    }

    return global.workspace_manager.get_workspace_by_index(neighborExists || wraparound ? index : activeIndex);
}

// -------------------------------------------------------------------------------------

function _getWindowApp(metaWindow) {
    let tracker = Shell.WindowTracker.get_default();
    return tracker.get_window_app(metaWindow);
}

var WorkspaceSwitcherPopupCustom = GObject.registerClass(
class WorkspaceSwitcherPopupCustom extends St.Widget {
    _init() {
        super._init({ x: 0,
                      y: 0,
                      width: global.screen_width,
                      height: global.screen_height,
                      style_class: shellVersion >= 42 ? 'workspace-switcher-group-42' : 'workspace-switcher-group' });

        Main.uiGroup.add_child(this);

        this._timeoutId = 0;

        this._popupMode = gOptions.get('popupMode');
        // if popup disabled don't allocate more resources
        if (this._popupMode === ws_popup_mode.DISABLE) {
            return;
        }

        this._container = new St.BoxLayout({
            style_class: shellVersion >= 42 ? 'workspace-switcher-container-42' : 'workspace-switcher-container'
        });
        this.add_child(this._container);

        this._list = new WorkspaceSwitcherPopupList();
        this._list._popupMode = this._popupMode;
        this._container.add_child(this._list);

        this._monitorOption = gOptions.get('monitor');
        this._workspacesOnPrimaryOnly = gOptions.get('workspacesOnPrimaryOnly');

        this._horizontalPosition = gOptions.get('popupHorizontal') / 100;
        this._verticalPosition = gOptions.get('popupVertical') / 100;
        this._modifiersCancelTimeout = gOptions.get('modifiersHidePopup');
        this._fadeOutTime = gOptions.get('fadeOutTime');

        this._popScale = gOptions.get('popupScale') / 100;
        this._paddingScale = gOptions.get('popupPaddingScale') / 100;
        this._spacingScale = gOptions.get('popupSpacingScale') / 100;
        this._radiusScale = gOptions.get('popupRadiusScale') / 100;
        this._list._popScale = this._popScale;

        this._indexScale = gOptions.get('indexScale') / 100;
        this._fontScale = gOptions.get('fontScale') / 100;
        this._textBold = gOptions.get('textBold');
        this._textShadow = gOptions.get('textShadow');
        this._wrapAppNames = gOptions.get('wrapAppNames');

        this._popupOpacity = gOptions.get('popupOpacity');
        this._allowCustomColors = gOptions.get('allowCustomColors');
        if (this._allowCustomColors) {
            this._bgColor = gOptions.get('popupBgColor');
            this._borderColor = gOptions.get('popupBorderColor');
            this._activeFgColor = gOptions.get('popupActiveFgColor');
            this._activeBgColor = gOptions.get('popupActiveBgColor');
            this._inactiveFgColor = gOptions.get('popupInactiveFgColor');
            this._inactiveBgColor = gOptions.get('popupInactiveBgColor');
            this._borderColor = gOptions.get('popupBorderColor');
        }

        this._activeShowWsIndex = gOptions.get('activeShowWsIndex');
        this._activeShowWsName = gOptions.get('activeShowWsName');
        this._activeShowAppName = gOptions.get('activeShowAppName');
        this._activeShowWinTitle = gOptions.get('activeShowWinTitle');
        this._inactiveShowWsIndex = gOptions.get('inactiveShowWsIndex');
        this._inactiveShowWsName  = gOptions.get('inactiveShowWsName');
        this._inactiveShowAppName = gOptions.get('inactiveShowAppName');
        this._inactiveShowWinTitle = gOptions.get('inactiveShowWinTitle');

        //this._redisplay();

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

    display(direction, activeWorkspaceIndex = null) {
        if (this._popupMode === ws_popup_mode.DISABLE) {
            // in this case the popup object will stay in Main.wm._workspaceSwitcherPopup and wil not be recreated each time as there is no content to update
            return;
        }

        // GS 42+ doesn't use direction variable, therefore if activeWorkspaceIndex is undefined, direction variable holds the workspace index
        this._direction = activeWorkspaceIndex === null ? null : direction;
        this._activeWorkspaceIndex = activeWorkspaceIndex === null ? direction : activeWorkspaceIndex;

        this._setCustomStyle();
        this._setSpacing();
        this._redisplay();
        this._resetTimeout();
        //GLib.Source.set_name_by_id(this._timeoutId, '[gnome-shell] this._onTimeout');

        this.opacity = Math.floor(this._popupOpacity / 100 * 255);

        this._show();
        //this._setCustomStyle();
        // first style adjustments have to be made to calculate popup size
        this._setPopupPosition();

        // TO DO: this second customizing should just rescale padding, spacing and corner radius ...
        //this._setCustomStyle();
        if (this._list._fitToScreenScale < 1)
            this._addLabels();
    }

    _resetTimeout() {
        if (this._timeoutId != 0) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (DISPLAY_TIMEOUT !== 0) {
            this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DISPLAY_TIMEOUT, this._onTimeout.bind(this));
        }
    }

    _redisplay() {
        let workspaceManager = global.workspace_manager;

        this._list.destroy_all_children();

        for (let i = 0; i < workspaceManager.n_workspaces; i++) {
            let indicator = null;

            let style;
            if (shellVersion >= 42) {
                style = 'ws-switcher-active-42-';
            } else {
                style = 'ws-switcher-active-';
            }

            if (i == this._activeWorkspaceIndex && this._direction == Meta.MotionDirection.UP)
                indicator = new St.Bin({ style_class: `${style}up` });
            else if (i == this._activeWorkspaceIndex && this._direction == Meta.MotionDirection.DOWN)
                indicator = new St.Bin({ style_class: `${style}down` });
            else if (i == this._activeWorkspaceIndex && this._direction == Meta.MotionDirection.LEFT)
                indicator = new St.Bin({ style_class: `${style}left` });
            else if (i == this._activeWorkspaceIndex && this._direction == Meta.MotionDirection.RIGHT)
                indicator = new St.Bin({ style_class: `${style}right` });
            else if (i == this._activeWorkspaceIndex)
                indicator = new St.Bin({ style_class: `${style}right` });
            // TODO single ws indicator needs to be handled in the container class, disabled for now
            // in GS 42+ the direction isn't available
            else if (this._popupMode === ws_popup_mode.ALL)
                indicator = new St.Bin({ style_class: shellVersion >= 42 ? 'ws-switcher-box-42' : 'ws-switcher-box' });

            if (indicator) {
                // we need to know wsIndex of active box in single ws mode
                indicator._wsIndex = i;
                this._list.add_child(indicator);
            }
        }
        this._setCustomStyle();
        this._addLabels();
    }

    _onTimeout() {
        // if user holds any modifier key, don't hide the popup and wait until they release the keys
        if (this._modifiersCancelTimeout) {
            const mods = global.get_pointer()[2];
            if (mods & 77) {
                this._resetTimeout();
                return;
            }
        }

        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;
        this._container.ease({
            opacity: 0.0,
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
            //this._contRadius = Math.min(Math.max(Math.floor(contRadius * this._popScale), 3), contRadius);
            this._contRadius = Math.max(Math.floor(contRadius * this._radiusScale), 3);
            let contPadding = this.get_theme_node().get_length('padding') || 10;
            contPadding = Math.max(contPadding * this._popScale, 2);
            this._contPadding = Math.floor(contPadding * this._paddingScale);
            if (this._allowCustomColors) {
                this._container.set_style( `padding: ${this._contPadding}px;
                                            border-radius: ${this._contRadius}px;
                                            background-color: ${this._bgColor};
                                            border-color: ${this._borderColor};`
                );
            } else {
                this._container.set_style( `padding: ${this._contPadding}px;
                                            border-radius: ${this._contRadius}px;`
                );
            }
        }

        const children = this._list.get_children();
        for (let i=0; i < children.length; i++) {
            if (this._boxRadius === undefined) {
                const theme = children[i].get_theme_node();
                const boxRadius = theme.get_length('border-radius');
                this._boxRadius = Math.max(Math.floor(boxRadius * this._radiusScale), 3);
                this._boxHeight = Math.floor(theme.get_height() * this._popScale);
                this._boxBgSize = Math.floor(theme.get_length('background-size') * this._popScale);
            }
            if (i == this._activeWorkspaceIndex || this._popupMode){ // 0 all ws 1 single ws 2,3 will never get to here
                if (this._allowCustomColors) {
                    children[i].set_style( `background-size: ${this._boxBgSize}px;
                                            border-radius: ${this._boxRadius}px;
                                            color: ${this._activeFgColor};
                                            background-color: ${this._activeBgColor};
                                            border-color: ${this._activeBgColor};
                                            box-shadow: none;
                                            `
                                            // latest versions of ubuntu yaru theme don't follow transparency of the background and stay on the screen even if the background is fully transparent.
                                            //box-shadow: 0 3px 9px 0px ${this._bgColor} // bgColor for the shadow needs to be more transparent to be used
                    );
                } else {
                    children[i].set_style( `background-size: ${this._boxBgSize}px;
                                            border-radius: ${this._boxRadius}px;`
                    );
                }
            } else {
                if (this._allowCustomColors) {
                    children[i].set_style( `background-size: ${this._boxBgSize}px;
                                            border-radius: ${this._boxRadius}px;
                                            color: ${this._inactiveFgColor};
                                            background-color: ${this._inactiveBgColor};
                                            border-color: ${this._borderColor};`
                    );
                } else {
                    children[i].set_style( `background-size: ${this._boxBgSize}px;
                                            border-radius: ${this._boxRadius}px;`
                    );
                }
            }
        }
    }

    _addLabels() {
        const children = this._list.get_children();
        for (let i=0; i < children.length; i++) {
            const label = this._getCustomLabel(children[i]._wsIndex);
            if (label) {
                children[i].set_child(label);
            }
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
        let thumbnail = new WorkspaceThumbnail.WorkspaceThumbnail(ws, index);
        const screenHeight = global.display.get_monitor_geometry(0).height;
        //const screenHeight = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex).height;
        const scale = (this._boxHeight) / screenHeight*2;
        thumbnail.get_children().forEach(w => w.set_scale(scale, scale));
        thumbnail._contents.set_position(0, 0);
        return thumbnail;
    }

    _setPopupPosition() {
        let workArea;
        if (this._monitorOption === 0) {
            //workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
            workArea = global.display.get_monitor_geometry(Main.layoutManager.primaryIndex);
        } else {
            //workArea = Main.layoutManager.getWorkAreaForMonitor(global.display.get_current_monitor());
            workArea = global.display.get_monitor_geometry(global.display.get_current_monitor());
        }
        let [, containerNatHeight] = this._container.get_preferred_height(global.screen_width);
        let [, containerNatWidth] = this._container.get_preferred_width(containerNatHeight);
        let h = this._horizontalPosition;
        let v = this._verticalPosition;
        this._container.x = workArea.x + Math.floor((workArea.width - containerNatWidth) * (h));
        this._container.y = workArea.y + Math.floor((workArea.height - containerNatHeight) * (v));
    }

    _getWsNamesSettings() {
        if (!this._wsNamesSettings) {
            this._wsNamesSettings = ExtensionUtils.getSettings(
                        'org.gnome.desktop.wm.preferences');
        }
        return this._wsNamesSettings;
    }

    _getCustomLabel(wsIndex){
        //this._list._getPreferredSizeForOrientation(true);

        let labelBox = null;
        let textLabel = null;
        let indexLabel = null;
        let titleLabel = null;
        let text = '';
        const textShadowStyle = 'text-shadow: +1px -1px 4px rgb(200, 200, 200);'

        const wsIndexIsActiveWS = wsIndex == this._activeWorkspaceIndex;

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
                text: text
            });
        }

        if (showName) {
            const name = this._getWsName(wsIndex);
            if (name) {
                if (text) {
                    text += '\n';
                }
                text += name;
            }
        }

        if (showApp) {
            const appName = this._getWsAppName(wsIndex);
            if (appName) {
                if (text) {
                    text += '\n';
                }
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
                    text: winTitle
                });
            }
        }

        let fontSize = this._popScale * this._fontScale * this._list._fitToScreenScale;
        // if text is ordered but not delivered (no app name, no ws name) but ws index will be shown,
        // add an empty line to avoid index jumping during switching (at least when app name wrapping is disabled)
        if (this._popupMode === ws_popup_mode.ACTIVE && (showName || showApp || showTitle) && showIndex && !text)
            text = ' ';

        // if text is ordered but not delivered (no app name, no ws name) show ws index
        /*if ((showName || showApp) && !showIndex && !text) {
            text = `${wsIndex + 1}`;
            // single number always looks about 20% smaller than longer text with the same font size
            fontSize = fontSize * 1.2;
        }*/

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
                text: text
            });
        }

        if (indexLabel || textLabel || titleLabel) {
            labelBox = new St.BoxLayout({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                vertical: true
            });
        }
        if (indexLabel) {
            labelBox.add_child(indexLabel);
        }
        if (textLabel) {
            labelBox.add_child(textLabel);
        }

        if (titleLabel) {
            labelBox.add_child(titleLabel);
        }

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

    _getCurrentWsWin(wsIndex) {
        const ws = global.workspaceManager.get_workspace_by_index(wsIndex);
        // AltTab.get_windows(ws) gives strange results after GS restart on X11
        // filtered get_windows(null) gives constant results (GS 3.36 - 41)
        let wins = AltTab.getWindows(null);

        wins = wins.filter(w => w.get_workspace() === ws);

        if (this._workspacesOnPrimaryOnly) {
            const monitor = Main.layoutManager.primaryIndex;
            wins = wins.filter(w => w.get_monitor() === monitor);
        }

        if (wins.length > 0) {
            return wins[0];
        } else {
            return null;
        }
    }

    _getWsAppName(wsIndex) {
        const win = this._getCurrentWsWin(wsIndex);

        let appName = null;
        if (win) {
            appName = _getWindowApp(win).get_name();
            // wrap app names
            if (this._wrapAppNames) {
                appName = appName.replace(' ', '\n');
            }
        }

        return appName;
    }


    _getWinTitle(wsIndex) {
        const win = this._getCurrentWsWin(wsIndex);
        let title = null;
        if (win) {
            title = win.get_title();
        }

        return title;
    }
});

const WorkspaceSwitcherPopupList = GObject.registerClass(
class WorkspaceSwitcherPopupList extends St.Widget {
    _init() {
        super._init({
            style_class: shellVersion >= 42 ? 'workspace-switcher-42' : 'workspace-switcher',
            // this parameter causes error: g_value_get_enum: assertion 'G_VALUE_HOLDS_ENUM (value)' failed
            // not in the original popup class, which has exactly the same super._init() call
            /*offscreen_redirect: Clutter.OffscreenRedirect.ALWAYS,*/
        });
        this._itemSpacing = 0;
        this._childHeight = 0;
        this._childWidth = 0;
        this._fitToScreenScale = 1;
        this._customWidthScale = gOptions.get('popupWidthScale') / 100;
        let orientation = global.workspace_manager.layout_rows == -1;
        if (gOptions.get('reversePopupOrientation'))
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
        if (this._orientation == Clutter.Orientation.HORIZONTAL)
            availSize = workArea.width - themeNode.get_horizontal_padding();
        else
            availSize = workArea.height - themeNode.get_vertical_padding();

        let size = 0;
        for (let child of this.get_children()) {
            let [, childNaturalHeight] = child.get_preferred_height(-1);
            let height = childNaturalHeight * workArea.width / workArea.height * this._popScale;

            if (this._orientation == Clutter.Orientation.HORIZONTAL) // width scale option application
                size += height * workArea.width / workArea.height * this._customWidthScale;
            else
                size += height;
        }

        let workspaceManager = global.workspace_manager;
        let spacing = this._itemSpacing * (this._popupMode != ws_popup_mode.ALL ? 0 : workspaceManager.n_workspaces - 1);
        size += spacing;

        // note info about downsizing the popup to calculate proper content size
        this._fitToScreenScale = size > availSize ? availSize / size : 1;

        size = Math.min(size, availSize);

        if (this._orientation == Clutter.Orientation.HORIZONTAL) {
            this._childWidth = (size - spacing) / (this._popupMode != ws_popup_mode.ALL ? 1 : workspaceManager.n_workspaces);
            return themeNode.adjust_preferred_width(size, size);
        } else {
            this._childHeight = (size - spacing) / (this._popupMode != ws_popup_mode.ALL ? 1 : workspaceManager.n_workspaces);
            return themeNode.adjust_preferred_height(size, size);
        }
    }

    _getSizeForOppositeOrientation() {
        let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);

        if (this._orientation == Clutter.Orientation.HORIZONTAL) {  // width scale option application
            this._childHeight = Math.round(this._childWidth * workArea.height / workArea.width / this._customWidthScale);
            return [this._childHeight, this._childHeight];
        } else {
            this._childWidth = Math.round(this._childHeight * workArea.width / workArea.height * this._customWidthScale);
            return [this._childWidth, this._childWidth];
        }
    }

    vfunc_get_preferred_height(forWidth) {
        if (this._orientation == Clutter.Orientation.HORIZONTAL)
            return this._getSizeForOppositeOrientation();
        else
            return this._getPreferredSizeForOrientation(forWidth);
    }

    vfunc_get_preferred_width(forHeight) {
        if (this._orientation == Clutter.Orientation.HORIZONTAL)
            return this._getPreferredSizeForOrientation(forHeight);
        else
            return this._getSizeForOppositeOrientation();
    }

    vfunc_allocate(box, flags) {
        shellVersion >= 40  ?   this.set_allocation(box)
                            :   this.set_allocation(box, flags);

        let themeNode = this.get_theme_node();
        box = themeNode.get_content_box(box);

        let childBox = new Clutter.ActorBox();

        let rtl = this.text_direction == Clutter.TextDirection.RTL;
        let x = rtl ? box.x2 - this._childWidth : box.x1;
        let y = box.y1;
        for (let child of this.get_children()) {
            childBox.x1 = Math.round(x);
            childBox.x2 = Math.round(x + this._childWidth);
            childBox.y1 = Math.round(y);
            childBox.y2 = Math.round(y + this._childHeight);

            if (this._orientation == Clutter.Orientation.HORIZONTAL) {
                if (rtl)
                    x -= this._childWidth + this._itemSpacing;
                else
                    x += this._childWidth + this._itemSpacing;
            } else {
                y += this._childHeight + this._itemSpacing;
            }
            shellVersion >= 40 ? child.allocate(childBox)
                               : child.allocate(childBox, flags);
        }
    }
});

const WorkspaceSwitcherPopup42 = GObject.registerClass(
class WorkspaceSwitcherPopup42 extends WorkspaceSwitcherPopup.WorkspaceSwitcherPopup {
    _init() {
        super._init();
        this.remove_constraint(this.get_constraints()[0]);
        this._monitorOption = gOptions.get('monitor');
        this._workspacesOnPrimaryOnly = gOptions.get('workspacesOnPrimaryOnly');

        this._horizontalPosition = gOptions.get('popupHorizontal') / 100;
        this._verticalPosition = gOptions.get('popupVertical') / 100;
        this._modifiersCancelTimeout = gOptions.get('modifiersHidePopup');
        this._fadeOutTime = gOptions.get('fadeOutTime');
        this._list.set_style('margin: 0;');
        this._redisplay();

        if (gOptions.get('reversePopupOrientation')) {
            this._list.vertical = !this._list.vertical;
        }
    }

    _setPopupPosition() {
        let workArea;
        if (this._monitorOption === 0) {
            //workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
            workArea = global.display.get_monitor_geometry(Main.layoutManager.primaryIndex);
        } else {
            //workArea = Main.layoutManager.getWorkAreaForMonitor(global.display.get_current_monitor());
            workArea = global.display.get_monitor_geometry(global.display.get_current_monitor());
        }

        let [, natHeight] = this.get_preferred_height(global.screen_width);
        let [, natWidth] = this.get_preferred_width(natHeight);
        let h = this._horizontalPosition;
        let v = this._verticalPosition;
        this.x = workArea.x + Math.floor((workArea.width - natWidth) * h);
        this.y = workArea.y + Math.floor((workArea.height - natHeight) * v);
    }

    display(activeWorkspaceIndex) {
        this._activeWorkspaceIndex = activeWorkspaceIndex;

        this._redisplay();
        if (this._timeoutId != 0)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DISPLAY_TIMEOUT, this._onTimeout.bind(this));
        GLib.Source.set_name_by_id(this._timeoutId, '[gnome-shell] this._onTimeout');

        const duration = this.visible ? 0 : this._onTimeout;
        this.show();
        this.opacity = 0;
        this.ease({
            opacity: 255,
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        this._setPopupPosition()
    }

    _onTimeout() {
        GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;
        this.ease({
            opacity: 0.0,
            duration: this._fadeOutTime,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this.destroy(),
        });
        return GLib.SOURCE_REMOVE;
    }

    _resetTimeout() {
        // if user holds any modifier key, don't hide the popup and wait until they release the keys
        if (this._modifiersCancelTimeout) {
            const mods = global.get_pointer()[2];
            if (mods & 77) {
                this._resetTimeout();
                return;
            }
        }

        if (this._timeoutId != 0) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (DISPLAY_TIMEOUT !== 0) {
            this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DISPLAY_TIMEOUT, this._onTimeout.bind(this));
        }
    }
});

function debug(message) {
    const stack = new Error().stack.split('\n');

    // Remove debug() function call from stack.
    stack.shift();

    // Find the index of the extension directory (e.g. particles@schneegans.github.com) in
    // the stack entry. We do not want to print the entire absolute file path.
    const extensionRoot = stack[0].indexOf(Me.metadata.uuid);

    log('[' + stack[0].slice(extensionRoot) + '] ' + message);
}
