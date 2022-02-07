// Workspace Switcher Manager
// GPL v3 ©G-dH@Github.com
'use strict'

const { GLib, GObject, Clutter, St, Meta, Shell, Gio } = imports.gi;
const Main = imports.ui.main;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const AltTab = imports.ui.altTab;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail.WorkspaceThumbnail;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;
const shellVersion = Settings.shellVersion;

let originalWsPopup;
let originalWsPopupList;
let origNeighbor;
let defaultOrientationVertical;
let enableTimeoutId = 0;
let prefsDemoTimeoutId = 0;

let mscOptions;

var DISPLAY_TIMEOUT = 300;
var ANIMATION_TIME = 100;

const ws_popup_mode = {
    ALL     : 0,
    ACTIVE  : 1,
    DISABLE : 2,
};


function init() {
    ExtensionUtils.initTranslations();
    originalWsPopup = WorkspaceSwitcherPopup.WorkspaceSwitcherPopup;
    originalWsPopupList = WorkspaceSwitcherPopup.WorkspaceSwitcherPopupList;
    origNeighbor = Meta.Workspace.prototype.get_neighbor;
    defaultOrientationVertical = global.workspace_manager.layout_rows == -1;
}

function enable() {
    enableTimeoutId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        700,
        () => {
            mscOptions = new Settings.MscOptions();
            mscOptions.connect('changed', _updateSettings);

            DISPLAY_TIMEOUT = mscOptions.popupTimeout;
            WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = WorkspaceSwitcherPopupCustom;
            WorkspaceSwitcherPopup.WorkspaceSwitcherPopupList = WorkspaceSwitcherPopupList;
            _reverseWsOrientation(mscOptions.reverseWsOrientation);
            _updateNeighbor();

            _storeDefaultColors();
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

    mscOptions.destroy();
    mscOptions = null;
    WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = originalWsPopup;
    WorkspaceSwitcherPopup.WorkspaceSwitcherPopupList = originalWsPopupList;
    Meta.Workspace.prototype.get_neighbor = origNeighbor;
    _reverseWsOrientation(false);
}

//------------------------------------------------------------------------------
function _updateSettings(settings, key) {
    switch (key) {
    case 'on-screen-time':
        DISPLAY_TIMEOUT = mscOptions.popupTimeout;
        break;
    case 'default-colors':
        return;
    case 'ws-wraparound':
    case 'ws-ignore-last':
        _updateNeighbor();
        return;
    case 'reverse-ws-orientation':
        _reverseWsOrientation(mscOptions.reverseWsOrientation);
        _updateNeighbor();
        return;
    }
    prefsDemoTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, _showPopupForPrefs);
}

function _updateNeighbor() {
    if (mscOptions.wsSwitchWrap || mscOptions.wsSwitchIgnoreLast || mscOptions.reverseWsOrientation) {
        Meta.Workspace.prototype.get_neighbor = getNeighbor;
    } else {
        Meta.Workspace.prototype.get_neighbor = origNeighbor;
    }
}

function _reverseWsOrientation(reverse = false) {
    const orientationVertical = reverse ? !defaultOrientationVertical : defaultOrientationVertical;
    if (orientationVertical) {
        global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, -1, 1);
    } else { // horizontal
        global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, 1, -1);
    }
}

function _showPopupForPrefs() {
    // if user is currently customizing teir popup, show the popup on the screen
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

    Main.wm._workspaceSwitcherPopup.display(direction, wsIndex);
}

function _storeDefaultColors() {
    const workspaceMode = mscOptions.workspaceMode;
    if (workspaceMode == 1)
        mscOptions.workspaceMode = 0;
    const popup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
    mscOptions.workspaceMode = workspaceMode;
    popup.opacity = 0;
    //const activeIndex = global.workspaceManager.get_active_workspace_index();
    popup.display(Meta.MotionDirection.UP, 0);

    const containerNode = popup._container.get_theme_node();
    const listItems = popup._list.get_children();
    const activeNode = listItems[0].get_theme_node();
    const inactiveNode = popup._list.get_children()[1].get_theme_node();
    const popupBgColor = containerNode.lookup_color('background-color', true)[1];
    // border color in default theme is set in 'border' element and can not be read directly
    let [result, borderColor] = inactiveNode.lookup_color('border-color', true);
    if (result) {
        borderColor = borderColor.to_string();
    } else {
        borderColor = 'rgb(53,53,53)'; // average of default inactive box and container bordes 31/40
    }
    const activeFgColor = activeNode.get_foreground_color();
    const activeBgColor = activeNode.get_background_color();
    const inactiveFgColor = inactiveNode.get_foreground_color();
    const inactiveBgColor = inactiveNode.get_background_color();

    popup.destroy();

    const defaultColors = [
         `rgba(${popupBgColor.red},${popupBgColor.green},${popupBgColor.blue},${popupBgColor.alpha})`,
         borderColor,
         `rgba(${activeFgColor.red},${activeFgColor.green},${activeFgColor.blue},${activeFgColor.alpha})`,
         `rgba(${activeBgColor.red},${activeBgColor.green},${activeBgColor.blue},${activeBgColor.alpha})`,
         `rgba(${inactiveFgColor.red},${inactiveFgColor.green},${inactiveFgColor.blue},${inactiveFgColor.alpha})`,
         `rgba(${inactiveBgColor.red},${inactiveBgColor.green},${inactiveBgColor.blue},${inactiveBgColor.alpha})`
    ];
    mscOptions.defaultColors = defaultColors;

    if (!mscOptions.popupBgColor)
        mscOptions.popupBgColor = defaultColors[0];
    if (!mscOptions.popupBorderColor)
        mscOptions.popupBorderColor = defaultColors[1];
    if (!mscOptions.popupActiveFgColor)
        mscOptions.popupActiveFgColor = defaultColors[2];
    if (!mscOptions.popupActiveBgColor)
        mscOptions.popupActiveBgColor = defaultColors[3];
    if (!mscOptions.popupInactiveFgColor)
        mscOptions.popupInactiveFgColor = defaultColors[4];
    if (!mscOptions.popupInactiveBgColor)
        mscOptions.popupInactiveBgColor = defaultColors[5];
}

function getNeighbor(direction) {
    const activeIndex = this.index();
    const ignoreLast = mscOptions.wsSwitchIgnoreLast;
    const wraparound = mscOptions.wsSwitchWrap;
    const nWorkspaces = global.workspace_manager.n_workspaces - (ignoreLast ? 1 : 0);
    const lastIndex = nWorkspaces - 1;

    let index;

    if(direction === Meta.MotionDirection.UP || direction === Meta.MotionDirection.LEFT) {
        index = (activeIndex + lastIndex) % nWorkspaces;
        if (!wraparound && index > activeIndex) {
            index = 0;
        }
    } else { 
        index = (activeIndex + 1) % nWorkspaces;
        if (!wraparound && index < activeIndex) {
            index = lastIndex;
        }
    }
    return global.workspace_manager.get_workspace_by_index(index);
}

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
                      style_class: 'workspace-switcher-group' });

        Main.uiGroup.add_actor(this);

        this._timeoutId = 0;

        this._popupMode = mscOptions.popupMode;
        // if popup disabled don't allocate more resources
        if (this._popupMode === ws_popup_mode.DISABLE) {
            return;
        }

        this._container = new St.BoxLayout({ style_class: 'workspace-switcher-container' });
        this.add_child(this._container);

        this._list = new WorkspaceSwitcherPopupList();
        this._list._popupMode = this._popupMode;
        this._container.add_child(this._list);

        this._monitorOption = mscOptions.monitor;
        this._workspacesOnPrimaryOnly = mscOptions.workspacesOnPrimaryOnly;

        this._horizontalPosition = mscOptions.popupHorizontal;
        this._verticalPosition = mscOptions.popupVertical;
        this._modifiersCancelTimeout = mscOptions.modifiersHidePopup;
        this._fadeOutTime = mscOptions.fadeOutTime;

        this._popScale = mscOptions.popupScale / 100;
        this._paddingScale = mscOptions.popupPaddingScale / 100;
        this._spacingScale = mscOptions.popupSpacingScale / 100;
        this._list._popScale = this._popScale;
        
        this._indexScale = mscOptions.indexScale / 100;
        this._fontScale = mscOptions.fontScale / 100;
        this._textBold = mscOptions.textBold;
        this._textShadow = mscOptions.textShadow;
        this._wrapAppNames = mscOptions.wrapAppNames;

        this._popupOpacity = mscOptions.popupOpacity;
        this._allowCustomColors = mscOptions.allowCustomColors;
        if (this._allowCustomColors) {
            this._bgColor = mscOptions.popupBgColor;
            this._borderColor = mscOptions.popupBorderColor;
            this._activeFgColor = mscOptions.popupActiveFgColor;
            this._activeBgColor = mscOptions.popupActiveBgColor;
            this._inactiveFgColor = mscOptions.popupInactiveFgColor;
            this._inactiveBgColor = mscOptions.popupInactiveBgColor;
            this._borderColor = mscOptions.popupBorderColor;
        }

        this._activeShowWsIndex = mscOptions.activeShowWsIndex;
        this._activeShowWsName = mscOptions.activeShowWsName;
        this._activeShowAppName = mscOptions.activeShowAppName;
        this._inactiveShowWsIndex = mscOptions.inactiveShowWsIndex;
        this._inactiveShowWsName  = mscOptions.inactiveShowWsName;
        this._inactiveShowAppName = mscOptions.inactiveShowAppName;
        this._labelRescaleNeeded = this._activeShowWsIndex || this._activeShowWsName || this._activeShowAppName
                                || this._inactiveShowWsIndex || this._inactiveShowWsName || this._inactiveShowAppName;

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

    display(direction, activeWorkspaceIndex) {
        if (this._popupMode === ws_popup_mode.DISABLE) {
            // in this case the popup object will stay in Main.wm._workspaceSwitcherPopup and wil not be recreated each time as there is no content to update
            return;
        }

        this._direction = direction;
        this._activeWorkspaceIndex = activeWorkspaceIndex;

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

        // TO DO: this second customizing shoud just rescale padding, spacing and corner radius ...
        this._setCustomStyle();
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

            if (i == this._activeWorkspaceIndex && this._direction == Meta.MotionDirection.UP)
                indicator = new St.Bin({ style_class: 'ws-switcher-active-up' });
            else if (i == this._activeWorkspaceIndex && this._direction == Meta.MotionDirection.DOWN)
                indicator = new St.Bin({ style_class: 'ws-switcher-active-down' });
            else if (i == this._activeWorkspaceIndex && this._direction == Meta.MotionDirection.LEFT)
                indicator = new St.Bin({ style_class: 'ws-switcher-active-left' });
            else if (i == this._activeWorkspaceIndex && this._direction == Meta.MotionDirection.RIGHT)
                indicator = new St.Bin({ style_class: 'ws-switcher-active-right' });
            // TODO single ws indicator needs to be handled in the container class, disabled for now
            else if (this._popupMode === ws_popup_mode.ALL)
                indicator = new St.Bin({ style_class: 'ws-switcher-box' });

            if (indicator) {
                // we need to know wsIndex of active box in single ws mode 
                indicator._wsIndex = i;
                this._list.add_actor(indicator);
            }
        }
        this._addLabels();
    }

    _onTimeout() {
        // if user holds any modifier key dont hide the popup and wait until they release the keys
        if (this._modifiersCancelTimeout) {
            const mods = global.get_pointer()[2];
            if (mods & 77) {
                this._resetTimeout();
                return;
            }
        }

        GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;
        this._container.ease({
            opacity: 0.0,
            duration: this._fadeOutTime,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this.destroy(),
        });
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
            this._contRadius = Math.min(Math.max(Math.floor(contRadius * this._popScale), 3), contRadius);
            let contPadding = this.get_theme_node().get_length('padding');
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
                this._boxRadius = Math.min(Math.max(Math.floor(boxRadius * this._popScale), 3), boxRadius);
                this._boxHeight = Math.floor(theme.get_height() * this._popScale);
                this._boxBgSize = Math.floor(theme.get_length('background-size') * this._popScale);
            }
            if (i == this._activeWorkspaceIndex || this._popupMode){ // 0 all ws 1 single ws
                if (this._allowCustomColors) {
                    children[i].set_style( `background-size: ${this._boxBgSize}px;
                                            border-radius: ${this._boxRadius}px;
                                            color: ${this._activeFgColor};
                                            background-color: ${this._activeBgColor};
                                            border-color: ${this._borderColor};`
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
        let spacing = this._list.get_theme_node().get_length('spacing');
        spacing = Math.max(Math.floor(spacing * this._popScale), 4);

        this._list._listSpacing = Math.floor(spacing * this._spacingScale);

        this._list.set_style(`spacing: ${this._list._listSpacing}px;`);
    }

    _getWorkspaceThumbnail(index, box) {
        let ws = global.workspaceManager.get_workspace_by_index(box._wsIndex);
        let thumbnail = new WorkspaceThumbnail(ws, box._wsIndex);
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
            workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        } else {
            workArea = Main.layoutManager.getWorkAreaForMonitor(global.display.get_current_monitor());
        }
        let [, containerNatHeight] = this._container.get_preferred_height(global.screen_width);
        let [, containerNatWidth] = this._container.get_preferred_width(containerNatHeight);
        let h_percent = this._horizontalPosition;
        let v_percent = this._verticalPosition;
        this._container.x = workArea.x + Math.floor((workArea.width - containerNatWidth) * (h_percent / 100));
        this._container.y = workArea.y + Math.floor((workArea.height - containerNatHeight) * (v_percent / 100));
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

        let label = null;
        let text = '';

        const wsIndexIsActiveWS = wsIndex == this._activeWorkspaceIndex;

        const showIndex = wsIndexIsActiveWS ? this._activeShowWsIndex : this._inactiveShowWsIndex;
        const showName  = wsIndexIsActiveWS ? this._activeShowWsName  : this._inactiveShowWsName;
        const showApp   = wsIndexIsActiveWS ? this._activeShowAppName : this._inactiveShowAppName;
        let indexOnly = false;

        if (showIndex) {
            text = `${wsIndex + 1}`;
            indexOnly = true;
        }

        if (showName) {
            const name = this._getWsName(wsIndex);
            if (name) {
                if (text) {
                    text += '\n';
                    indexOnly = false;
                }
                text += name;
            }
        }

        if (showApp) {
            const appName = this._getWsAppName(wsIndex);
            if (appName) {
                if (text) {
                    text += '\n';
                    indexOnly = false;
                }
                text += appName;
            }
        }

        if (!text) return;

        let fontSize;
        if (indexOnly) {
            fontSize = this._popScale * this._indexScale * this._list._fitToScreenScale;
        } else {
            fontSize = this._popScale * this._fontScale * this._list._fitToScreenScale;
        }

        label = new St.Label({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: `text-align: center;
                    font-size: ${fontSize}em;
                    ${this._textBold ? 'font-weight: bold;' : ''}
                    ${this._textShadow ? 'text-shadow: +1px -1px rgb(200, 200, 200);' : ''}
                    padding: 2px`,
        });

        label.set_text(text);

        return label;
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

    _getWsAppName(wsIndex) {
        const ws = global.workspaceManager.get_workspace_by_index(wsIndex);
        // AltTab.get_windows(ws) gives strange results after GS restart on X11
        // filtered get_windows(null) gives constant results (GS 3.36 - 41)
        let wins = AltTab.getWindows(null);
        wins = wins.filter(w => w.get_workspace() === ws);

        if (this._workspacesOnPrimaryOnly) {
            const monitor = Main.layoutManager.primaryIndex;
            wins = wins.filter(w => w.get_monitor() === monitor);
        }

        const win = wins[0];

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
});

var WorkspaceSwitcherPopupList = GObject.registerClass(
class WorkspaceSwitcherPopupList extends St.Widget {
    _init() {
        super._init({
            style_class: 'workspace-switcher',
            // this parameter causes error: g_value_get_enum: assertion 'G_VALUE_HOLDS_ENUM (value)' failed
            // not in the original popup class, which has exactly the same super._init() call
            /*offscreen_redirect: Clutter.OffscreenRedirect.ALWAYS,*/
        });
        this._itemSpacing = 0;
        this._childHeight = 0;
        this._childWidth = 0;
        this._fitToScreenScale = 1;
        this._customWidthScale = mscOptions.popupWidthScale / 100;
        let orientation = global.workspace_manager.layout_rows == -1;
        if (mscOptions.reversePopupOrientation)
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
        let spacing = this._itemSpacing * (this._popupMode ? 0 : workspaceManager.n_workspaces - 1);
        size += spacing;

        // note info about downsizing the popupup to calculate proper content size
        this._fitToScreenScale = size > availSize ? availSize / size : 1;

        size = Math.min(size, availSize);

        if (this._orientation == Clutter.Orientation.HORIZONTAL) {
            this._childWidth = (size - spacing) / (this._popupMode ? 1 : workspaceManager.n_workspaces);
            return themeNode.adjust_preferred_width(size, size);
        } else {
            this._childHeight = (size - spacing) / (this._popupMode ? 1 : workspaceManager.n_workspaces);
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

function debug(message) {
    const stack = new Error().stack.split('\n');

    // Remove debug() function call from stack.
    stack.shift();

    // Find the index of the extension directory (e.g. particles@schneegans.github.com) in
    // the stack entry. We do not want to print the entire absolute file path.
    const extensionRoot = stack[0].indexOf(Me.metadata.uuid);

    log('[' + stack[0].slice(extensionRoot) + '] ' + message);
}