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
let enableTimeoutId = 0;

let mscOptions;
let STORE_DEFAULT_COLORS;

var DISPLAY_TIMEOUT;
var ANIMATION_TIME = 100;

const ws_popup_mode = {
    'ALL'     : 0,
    'ACTIVE'  : 1,
    'DISABLE' : 2,
};


function init() {
    ExtensionUtils.initTranslations();
    originalWsPopup = WorkspaceSwitcherPopup.WorkspaceSwitcherPopup;
    originalWsPopupList = WorkspaceSwitcherPopup.WorkspaceSwitcherPopupList;
    origNeighbor = Meta.Workspace.prototype.get_neighbor;
    STORE_DEFAULT_COLORS = true;
}

function enable() {
    enableTimeoutId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        700,
        () => {
            mscOptions = new Settings.MscOptions();
            mscOptions.connect('changed', _updateSettings);
            _storeDefaultColors();
            DISPLAY_TIMEOUT = mscOptions.popupTimeout;
            _updateNeighbor();
            WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = WorkspaceSwitcherPopupCustom;
            WorkspaceSwitcherPopup.WorkspaceSwitcherPopupList = WorkspaceSwitcherPopupList;
        }
    );
}

function disable() {
    if (enableTimeoutId)
        GLib.source_remove(enableTimeoutId);
    if  (Main.wm._workspaceSwitcherPopup) {
        Main.wm._workspaceSwitcherPopup.destroy();
        Main.wm._workspaceSwitcherPopup = null;
    }

    mscOptions.destroy();
    mscOptions = null;
    WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = originalWsPopup;
    WorkspaceSwitcherPopup.WorkspaceSwitcherPopupList = originalWsPopupList;
    Meta.Workspace.prototype.get_neighbor = origNeighbor;
}

//------------------------------------------------------------------------------
function _updateNeighbor() {
    if (mscOptions.wraparound || mscOptions.ignoreLast) {
        Meta.Workspace.prototype.get_neighbor = getNeighbor;
    } else {
        Meta.Workspace.prototype.get_neighbor = origNeighbor;
    }
}

function _updateSettings(settings, key) {
    switch (key) {
    case 'timeout':
        DISPLAY_TIMEOUT = mscOptions.popupTimeout;
        break;
    case 'default-colors':
        return;
    case 'wraparound':
    case 'ignore-last':
        _updateNeighbor();
    }
    _showPopupForPrefs();
}

function _showPopupForPrefs() {
    // if user is currently customizing teir popup, show the popup on the screen
    const wsIndex = global.workspaceManager.get_active_workspace_index();
    const direction = Meta.MotionDirection.DOWN;
    const vertical = global.workspaceManager.layout_rows === -1;
    if (Main.wm._workspaceSwitcherPopup !== null) {
        Main.wm._workspaceSwitcherPopup.destroy();
        Main.wm._workspaceSwitcherPopup = null;
    }

    Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
    Main.wm._workspaceSwitcherPopup.reactive = false;
    Main.wm._workspaceSwitcherPopup.connect('destroy', () => {
        Main.wm._workspaceSwitcherPopup = null;
    });

    let motion = direction === Meta.MotionDirection.DOWN ? (vertical ? Meta.MotionDirection.DOWN : Meta.MotionDirection.RIGHT)
    : (vertical ? Meta.MotionDirection.UP   : Meta.MotionDirection.LEFT);
    Main.wm._workspaceSwitcherPopup.display(motion, wsIndex);

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

     mscOptions.defaultColors = [
         `rgba(${popupBgColor.red},${popupBgColor.green},${popupBgColor.blue},${popupBgColor.alpha})`,
         borderColor,
         `rgba(${activeFgColor.red},${activeFgColor.green},${activeFgColor.blue},${activeFgColor.alpha})`,
         `rgba(${activeBgColor.red},${activeBgColor.green},${activeBgColor.blue},${activeBgColor.alpha})`,
         `rgba(${inactiveFgColor.red},${inactiveFgColor.green},${inactiveFgColor.blue},${inactiveFgColor.alpha})`,
         `rgba(${inactiveBgColor.red},${inactiveBgColor.green},${inactiveBgColor.blue},${inactiveBgColor.alpha})`
    ];
    if (!mscOptions.defaultPopupBgColor)
        mscOptions.defaultPopupBgColor = mscOptions.defaultColors[0];
    if (!mscOptions.defaultPopupBorderColor)
        mscOptions.defaultPopupBorderColor = mscOptions.defaultColors[1];
    if (!mscOptions.defaultPopupActiveFgColor)
        mscOptions.defaultPopupActiveFgColor = mscOptions.defaultColors[2];
    if (!mscOptions.defaultPopupActiveBgColor)
        mscOptions.defaultPopupActiveBgColor = mscOptions.defaultColors[3];
    if (!mscOptions.defaultPopupInactiveFgColor)
        mscOptions.defaultPopupInactiveFgColor = mscOptions.defaultColors[4];
    if (!mscOptions.defaultPopupInactiveBgColor)
        mscOptions.defaultPopupInactiveBgColor = mscOptions.defaultColors[5];
}

function getNeighbor(direction) {
    let index = this.index();
    if(direction === Meta.MotionDirection.UP || direction === Meta.MotionDirection.LEFT) {
        index = indexUp(index);
    } else {
        index = indexDown(index);
    }
    return global.workspace_manager.get_workspace_by_index(index);
}

function indexDown(activeIndex) {
    const ignoreLast = mscOptions.wsSwitchIgnoreLast;
    const wraparound = mscOptions.wsSwitchWrap;
    if ( activeIndex < global.workspace_manager.n_workspaces - (ignoreLast ? 2 : 1)) {
        return activeIndex + 1;
    }
    if (wraparound) {
        return 0;
    } else {
        return activeIndex;
    }
}

function indexUp(activeIndex) {
    const ignoreLast = mscOptions.wsSwitchIgnoreLast;
    const wraparound = mscOptions.wsSwitchWrap;
    if (activeIndex > 0) {
        return activeIndex - 1;
    }
    if (wraparound) {
        return global.workspace_manager.n_workspaces - (ignoreLast ? 2 : 1);
    } else {
        return activeIndex;
    }
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

        this._container = new St.BoxLayout({ style_class: 'workspace-switcher-container' });
        this.add_child(this._container);

        this._list = new WorkspaceSwitcherPopupList();
        this._container.add_child(this._list);

        this.popSize = mscOptions.defaultPopupSize / 100;
        // spacing needs to be calculated first to get proper container size
        this._setSpacing();
        this._redisplay();

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
        if (mscOptions.popupMode === ws_popup_mode.DISABLE)
            return;
        this._direction = direction;
        this._activeWorkspaceIndex = activeWorkspaceIndex;

        this._redisplay();
        this._resetTimeout();
        //GLib.Source.set_name_by_id(this._timeoutId, '[gnome-shell] this._onTimeout');

        this.opacity = Math.floor(mscOptions.defaultPopupOpacity / 100 * 255);

        this._show();
        // first style adjustments have to be made to calculate popup size
        this._setCustomStyle();
        this._setPopupPosition();
        // second style adjustments sets the text content with correct scale correction when popup had to be scaled down to fit the screen
        if (this._list._resizeScale < 1)
            this._setCustomStyle();
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
            else if (mscOptions.popupMode === ws_popup_mode.ALL)
                indicator = new St.Bin({ style_class: 'ws-switcher-box' });

            if (indicator) {
                indicator._wsIndex = i;
                this._list.add_actor(indicator);
            }
        }
    }

    _onTimeout() {
        // if user holds any modifier key dont hide the popup and wait until they release the keys
        if (mscOptions.modifiersHidePopup) {
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
            duration: mscOptions.fadeOutTime,
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

    _setCustomStyle(withoutContent) {
        if (this._contRadius === undefined) {
            const contRadius = this._container.get_theme_node().get_length('border-radius');
            this._contRadius = Math.min(Math.max(Math.floor(contRadius * this.popSize), 3), contRadius);
            // I wasn't successful to get original padding for the _container, so I use _list spacing as it's usually similar value
            this._contPadding = Math.min(Math.max(this._list._listSpacing * this.popSize, 2), this._origSpacing);
            if (mscOptions.allowCustomColors) {
                this._container.set_style( `padding: ${this._contPadding}px;
                                            border-radius: ${this._contRadius}px;
                                            background-color: ${mscOptions.defaultPopupBgColor};
                                            border-color: ${mscOptions.defaultPopupBorderColor};`
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
                this._boxRadius = Math.min(Math.max(Math.floor(boxRadius * this.popSize), 3), boxRadius);
                this._boxHeight = Math.floor(theme.get_height() * this.popSize);
                this._boxBgSize = Math.floor(theme.get_length('background-size') * this.popSize);
            }
            if (i == this._activeWorkspaceIndex || mscOptions.popupMode){ // 0 all ws 1 single ws
                if (mscOptions.allowCustomColors) {
                    children[i].set_style( `background-size: ${this._boxBgSize}px;
                                            border-radius: ${this._boxRadius}px;
                                            color: ${mscOptions.defaultPopupActiveFgColor};
                                            background-color: ${mscOptions.defaultPopupActiveBgColor};
                                            border-color: ${mscOptions.defaultPopupBorderColor};`
                    );
                } else {
                    children[i].set_style( `background-size: ${this._boxBgSize}px;
                                            border-radius: ${this._boxRadius}px;`
                    );
                }
            } else {
                if (mscOptions.allowCustomColors) {
                    children[i].set_style( `background-size: ${this._boxBgSize}px;
                                            border-radius: ${this._boxRadius}px;
                                            color: ${mscOptions.defaultPopupInactiveFgColor};
                                            background-color: ${mscOptions.defaultPopupInactiveBgColor};
                                            border-color: ${mscOptions.defaultPopupBorderColor};`
                    );
                } else {
                    children[i].set_style( `background-size: ${this._boxBgSize}px;
                                            border-radius: ${this._boxRadius}px;`
                    );
                }
            }

            if (withoutContent) continue;
            const label = this._getCustomLabel(children[i]._wsIndex);
            if (label) {
                children[i].set_child(label);
            }
        }
    }

    _setSpacing() {
        const listThemeNode = this._list.get_theme_node();
        this._origSpacing = listThemeNode.get_length('spacing');
        this._list._listSpacing = Math.min(Math.max(Math.floor(this._origSpacing * this.popSize), 4), this._origSpacing);
        this._list.set_style(`spacing: ${this._list._listSpacing};`);
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
        if (mscOptions.monitor === 0) {
            workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        } else {
            workArea = Main.layoutManager.getWorkAreaForMonitor(global.display.get_current_monitor());
        }
        let [, containerNatHeight] = this._container.get_preferred_height(global.screen_width);
        let [, containerNatWidth] = this._container.get_preferred_width(containerNatHeight);
        let h_percent = mscOptions.popupHorizontal;
        let v_percent = mscOptions.popupVertical;
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

    _getCustomLabel(i){
        //this._list._getPreferredSizeForOrientation(true);
        const wsIndex = i;
        let label = null;
        let text = '';

        const wsIndexIsActiveWS = i == this._activeWorkspaceIndex;

        const showIndex = wsIndexIsActiveWS ? mscOptions.activeShowWsIndex : mscOptions.inactiveShowWsIndex;
        const showName = wsIndexIsActiveWS ? mscOptions.activeShowWsName : mscOptions.inactiveShowWsName;
        const showApp = wsIndexIsActiveWS ? mscOptions.activeShowAppName : mscOptions.inactiveShowAppName;
        let indexOnly = false;

        if (showIndex) {
            text = `${wsIndex + 1}`;
            indexOnly = true;
        }

        if (showName) {
            const settings = this._getWsNamesSettings();
            const names = settings.get_strv('workspace-names');
            if (names.length > wsIndex) {
                if (text) {
                    text += '\n';
                    indexOnly = false;
                }
                text += names[wsIndex]
            }
        }

        if (showApp) {
            const ws = global.workspaceManager.get_workspace_by_index(wsIndex);
            let wins = AltTab.getWindows(ws);
            if (mscOptions.workspacesOnPrimaryOnly) {
                const monitor = Main.layoutManager.primaryIndex;
                wins = wins.filter(w => w.get_monitor() === monitor);
            }
            const win = wins[0];

            if (win) {
                if (text) {
                    text += '\n';
                    indexOnly = false;
                }
                let appName = _getWindowApp(win).get_name();
                // wrap app names
                if (mscOptions.wrapAppNames) {
                    appName = appName.replace(' ', '\n');
                }
                text += appName;
            }
        }

        if (!text) return;

        let fontSize;
        if (indexOnly) {
            fontSize = this.popSize * mscOptions.indexSize / 100 * this._list._resizeScale;
        } else {
            fontSize = this.popSize * mscOptions.fontSize / 100 * this._list._resizeScale;
        }
        label = new St.Label({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: `text-align: center;
                    font-size: ${fontSize}em;
                    ${mscOptions.textBold ? 'font-weight: bold;' : ''}
                    ${mscOptions.textShadow ? 'text-shadow: +1px -1px rgb(200, 200, 200);' : ''}
                    padding: 2px`,
        });
        label.set_text(text);

        return label;
    }
});

var WorkspaceSwitcherPopupList = GObject.registerClass(
class WorkspaceSwitcherPopupList extends St.Widget {
    _init() {
        super._init({
            style_class: 'workspace-switcher',
            offscreen_redirect: Clutter.OffscreenRedirect.ALWAYS,
        });

        this._itemSpacing = 0;
        this._childHeight = 0;
        this._childWidth = 0;
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
            let height = childNaturalHeight * workArea.width / workArea.height * mscOptions.defaultPopupSize / 100;

            if (this._orientation == Clutter.Orientation.HORIZONTAL) // width scale option application
                size += height * workArea.width / workArea.height * mscOptions.wsBoxWidth / 100;
            else
                size += height;
        }

        let workspaceManager = global.workspace_manager;
        let spacing = this._itemSpacing * (mscOptions.popupMode ? 0 : workspaceManager.n_workspaces - 1);
        size += spacing;

        // note info about downsizing the popupup to calculate proper content size
        this._resizeScale = size > availSize ? availSize / size : 1;

        size = Math.min(size, availSize);

        if (this._orientation == Clutter.Orientation.HORIZONTAL) {
            this._childWidth = (size - spacing) / (mscOptions.popupMode ? 1 : workspaceManager.n_workspaces);
            return themeNode.adjust_preferred_width(size, size);
        } else {
            this._childHeight = (size - spacing) / (mscOptions.popupMode ? 1 : workspaceManager.n_workspaces);
            return themeNode.adjust_preferred_height(size, size);
        }
    }

    _getSizeForOppositeOrientation() {
        let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);

        if (this._orientation == Clutter.Orientation.HORIZONTAL) {  // width scale option application
            this._childHeight = Math.round(this._childWidth * workArea.height / workArea.width / mscOptions.wsBoxWidth * 100);
            return [this._childHeight, this._childHeight];
        } else {
            this._childWidth = Math.round(this._childHeight * workArea.width / workArea.height * mscOptions.wsBoxWidth / 100);
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