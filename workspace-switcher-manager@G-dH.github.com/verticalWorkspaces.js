// Workspace Switcher Manager
// GPL v3 ©G-dH@Github.com
'use strict';

const { Clutter, Gio, GLib, GObject, Graphene, Meta, Shell, St } = imports.gi;

const DND = imports.ui.dnd;
const Main = imports.ui.main;
const AppDisplay = imports.ui.appDisplay;
const Dash = imports.ui.dash;
const Layout = imports.ui.layout;
const Overview = imports.ui.overview;
const Util = imports.misc.util;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const Background = imports.ui.background;
const WorkspacesView = imports.ui.workspacesView;
const Workspace = imports.ui.workspace;
const OverviewControls = imports.ui.overviewControls;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const shellVersion = Me.imports.settings.shellVersion;

const _Util = Me.imports.util;


// for some reason touching the SecondaryMonitorDisplay for the first time returns undefined in GS 42, so we touch it bere we use it
WorkspacesView.SecondaryMonitorDisplay;

let original_MAX_THUMBNAIL_SCALE;

var WORKSPACE_CUT_SIZE = 10;

// keep adjacent workspaces out of the screen
const WORKSPACE_MAX_SPACING = 200;
const WORKSPACE_MIN_SPACING = 24;

var DASH_MAX_WIDTH_RATIO = 0.15;
var DASH_ITEM_LABEL_SHOW_TIME = 150;

var ControlsState = {
    HIDDEN: 0,
    WINDOW_PICKER: 1,
    APP_GRID: 2,
};

let verticalOverrides = {};
let _wsDisplayVisibleSignalId;
let _stateAdjustmentValueSignalId;

let _appButtonSigHandlerId;
let _vertActivationSigId;
let _searchControllerSignalId;
let _verticalOverview;
let _prevDash;

function activate(verticalOverview = false) {
    _verticalOverview = verticalOverview;
    if (Object.keys(verticalOverrides).length != 0)
        reset();
    verticalOverrides['WorkspaceLayout'] = _Util.overrideProto(Workspace.WorkspaceLayout.prototype, WorkspaceLayoutOverride);
    verticalOverrides['WorkspacesView'] = _Util.overrideProto(WorkspacesView.WorkspacesView.prototype, WorkspacesViewOverride);
    verticalOverrides['WorkspacesDisplay'] = _Util.overrideProto(WorkspacesView.WorkspacesDisplay.prototype, WorkspacesDisplayOverride);
    if (_verticalOverview) {
        verticalOverrides['ThumbnailsBox'] = _Util.overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, ThumbnailsBoxOverride);
        verticalOverrides['WorkspaceThumbnail'] = _Util.overrideProto(WorkspaceThumbnail.WorkspaceThumbnail.prototype, WorkspaceThumbnailOverride);
        verticalOverrides['ControlsManager'] = _Util.overrideProto(OverviewControls.ControlsManager.prototype, ControlsManagerOverride);
        verticalOverrides['ControlsManagerLayout'] = _Util.overrideProto(OverviewControls.ControlsManagerLayout.prototype, ControlsManagerLayoutOverride);
        verticalOverrides['SecondaryMonitorDisplay'] = _Util.overrideProto(WorkspacesView.SecondaryMonitorDisplay.prototype, SecondaryMonitorDisplayOverride);
        verticalOverrides['BaseAppView'] = _Util.overrideProto(AppDisplay.BaseAppView.prototype, AppDisplayOverride);
        verticalOverrides['DashItemContainer'] = _Util.overrideProto(Dash.DashItemContainer.prototype, DashItemContainerOverride);

        original_MAX_THUMBNAIL_SCALE = WorkspaceThumbnail.MAX_THUMBNAIL_SCALE;
        WorkspaceThumbnail.MAX_THUMBNAIL_SCALE *= 2;

        const controlsManager = Main.overview._overview._controls;
        _stateAdjustmentValueSignalId = controlsManager._stateAdjustment.connect("notify::value", _updateWorkspacesDisplay.bind(controlsManager));
        _wsDisplayVisibleSignalId = controlsManager._workspacesDisplay.connect("notify::visible", controlsManager._workspacesDisplay._updateWorkspacesViews.bind(controlsManager._workspacesDisplay));

        _vertActivationSigId = Main.overview.connect('showing', () => {
            // this update collapsed ws thumbnails (workaroud for now, collapsing when only 1 ws should be disabled)
            Main.overview._overview._controls._thumbnailsBox.expandFraction = 1;
            // when user changes Dash to Dock / Ubuntu dock position on the screen, the dock will be recreated and overview layout code injected.
            Main.overview._overview._controls._thumbnailsBox.show();
            if (Main.overview.dash !== _prevDash && _prevDash !== undefined) {
                reset();
                activate(_verticalOverview);
                //_connectAppButton();
                _prevDash = Main.overview.dash;
                Main.overview.dash._background.opacity = 0;
                _moveDashAppGridIconLeft();
                return true;
            }
        });
        Main.overview.dash._background.opacity = 0;
        Main.overview.searchEntry.visible = false;
        _moveDashAppGridIconLeft();

        _searchControllerSignalId =  Main.overview._overview.controls._searchController.connect('notify::search-active', (w) => {
            Main.overview.searchEntry.visible = Main.overview._overview.controls._searchController._searchActive;
        });
    } else {
        _connectAppButton();
    }
}

function reset() {
    if (original_MAX_THUMBNAIL_SCALE)
        WorkspaceThumbnail.MAX_THUMBNAIL_SCALE = original_MAX_THUMBNAIL_SCALE;

    const controlsManager = Main.overview._overview._controls;
    if (_stateAdjustmentValueSignalId) {
        controlsManager._stateAdjustment.disconnect(_stateAdjustmentValueSignalId);
        _stateAdjustmentValueSignalId = 0;
    }
    if (_wsDisplayVisibleSignalId) {
        controlsManager._workspacesDisplay.disconnect(_wsDisplayVisibleSignalId);
        _wsDisplayVisibleSignalId = 0;
    }

    if (_vertActivationSigId) {
        Main.overview.disconnect(_vertActivationSigId);
        _vertActivationSigId = 0;
    }

    if (_searchControllerSignalId) {
        Main.overview._overview.controls._searchController.disconnect(_searchControllerSignalId);
        _searchControllerSignalId = 0;
    }

    if (_appButtonSigHandlerId) {
        Main.overview.dash.showAppsButton.disconnect(_appButtonSigHandlerId);
        _appButtonSigHandlerId = 0;
    }

    _Util.overrideProto(WorkspacesView.WorkspacesView.prototype, verticalOverrides['WorkspacesView']);
    _Util.overrideProto(WorkspacesView.WorkspacesDisplay.prototype, verticalOverrides['WorkspacesDisplay']);
    _Util.overrideProto(WorkspacesView.SecondaryMonitorDisplay.prototype, verticalOverrides['SecondaryMonitorDisplay']);
    if (shellVersion >= 42) {
        _Util.overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, verticalOverrides['ThumbnailsBox']);
        _Util.overrideProto(WorkspaceThumbnail.WorkspaceThumbnail.prototype, verticalOverrides['WorkspaceThumbnail']);
        _Util.overrideProto(OverviewControls.ControlsManagerLayout.prototype, verticalOverrides['ControlsManagerLayout']);
        _Util.overrideProto(OverviewControls.ControlsManager.prototype, verticalOverrides['ControlsManager']);
        _Util.overrideProto(Workspace.WorkspaceLayout.prototype, verticalOverrides['WorkspaceLayout']);
        _Util.overrideProto(AppDisplay.BaseAppView.prototype, verticalOverrides['BaseAppView']);
        _Util.overrideProto(Dash.DashItemContainer.prototype, verticalOverrides['DashItemContainer']);
    }

    verticalOverrides = {}

    Main.overview.searchEntry.visible = true;

    Main.overview.dash._background.opacity = 255;
    const reset = true;
    _moveDashAppGridIconLeft(reset);
    _prevDash = null;
}

function _moveDashAppGridIconLeft(reset = false) {
    // move dash app grid icon to the front
    const dash = Main.overview.dash;
    let target;
    if (reset)
        target = dash._showAppsIcon;
    else
        target = dash._box;
    const container = dash._dashContainer;
    container.remove_actor(target);
    container.add_actor(target);
}

function _connectAppButton() {
    if (_appButtonSigHandlerId)
        Main,overview.dash.showAppsButton.disconnect(_appButtonSigHandlerId);
    _appButtonSigHandlerId = Main.overview.dash.showAppsButton.connect('notify::checked', (w) => {
        if (w.checked) {
            global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, 1, -1);
        } else {
            global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, -1, 1);
        }
    });
}

// ---- workspacesView ----------------------------------------
var WorkspacesViewOverride = {
    _getFirstFitSingleWorkspaceBox: function(box, spacing, vertical) {
        let [width, height] = box.get_size();
        const [workspace] = this._workspaces;

        const rtl = this.text_direction === Clutter.TextDirection.RTL;
        const adj = this._scrollAdjustment;
        const currentWorkspace = vertical || !rtl
            ? adj.value : adj.upper - adj.value - 1;

        // Single fit mode implies centered too
        let [x1, y1] = box.get_origin();
        const [, workspaceWidth] = workspace.get_preferred_width(Math.floor(height));
        const [, workspaceHeight] = workspace.get_preferred_height(workspaceWidth);

        if (vertical) {
            x1 += (width - workspaceWidth) / 2;
            y1 -= currentWorkspace * (workspaceHeight + spacing);
        } else {
            x1 += (width - workspaceWidth) / 2;
            x1 -= currentWorkspace * (workspaceWidth + spacing);
        }

        const fitSingleBox = new Clutter.ActorBox({x1, y1});

        fitSingleBox.set_size(workspaceWidth, workspaceHeight);

        return fitSingleBox;
    },

    // avoid overlapping of adjacent workspaces with the current view
    _getSpacing: function(box, fitMode, vertical) {
        const [width, height] = box.get_size();
        const [workspace] = this._workspaces;

        let availableSpace;
        let workspaceSize;
        if (vertical) {
            [, workspaceSize] = workspace.get_preferred_height(width);
            availableSpace = height;
        } else {
            [, workspaceSize] = workspace.get_preferred_width(height);
            availableSpace = (width - workspaceSize) / 2;
        }

        const spacing = (availableSpace - workspaceSize * 0.4) * (1 - fitMode);
        const { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);

        return Math.clamp(spacing, WORKSPACE_MIN_SPACING * scaleFactor,
            WORKSPACE_MAX_SPACING * scaleFactor);
    },

    // spread windows during entering appDisplay page to add some action (looks more natural)
    _getWorkspaceModeForOverviewState: function(state) {
        const { ControlsState } = OverviewControls;

        switch (state) {
        case ControlsState.HIDDEN:
            return 0;
        case ControlsState.WINDOW_PICKER:
            return 1;
        case ControlsState.APP_GRID:
            return 1;
        }

        return 0;
    }
}

//  SecondaryMonitorDisplay
var SecondaryMonitorDisplayOverride = {
    _getThumbnailParamsForState: function(state) {
        const { ControlsState } = OverviewControls;

        let opacity, scale;
        switch (state) {
        case ControlsState.HIDDEN:
        case ControlsState.WINDOW_PICKER:
        case ControlsState.APP_GRID:
            opacity = 255;
            scale = 1;
            break;
        default:
            opacity = 255;
            scale = 1;
            break;
        }

        return { opacity, scale };
    },

    _getThumbnailsWidth: function(box) {
        if (!this._thumbnails.visible)
            return 0;

        const [width, height] = box.get_size();
        const { expandFraction } = this._thumbnails;
        const [, thumbnailsWidth] = this._thumbnails.get_preferred_width(height);
        return Math.min(
            thumbnailsWidth * expandFraction,
            width * WorkspaceThumbnail.MAX_THUMBNAIL_SCALE);
    },

    _getWorkspacesBoxForState: function(state, box, padding, thumbnailsWidth, spacing) {
        const { ControlsState } = OverviewControls;
        const workspaceBox = box.copy();
        const [width, height] = workspaceBox.get_size();

        switch (state) {
        case ControlsState.HIDDEN:
            break;
        case ControlsState.WINDOW_PICKER:
            case ControlsState.APP_GRID:
            workspaceBox.set_origin(thumbnailsWidth + spacing, padding);
            workspaceBox.set_size(
                width - thumbnailsWidth - spacing,
                height - 1.7 * padding);
            break;
        }

        return workspaceBox;
    },

    vfunc_allocate: function(box) {
        this.set_allocation(box);

        const themeNode = this.get_theme_node();
        const contentBox = themeNode.get_content_box(box);
        const [, height] = contentBox.get_size();
        const { expandFraction } = this._thumbnails;
        const spacing = themeNode.get_length('spacing') * expandFraction;
        const padding =
            Math.round((1 - WorkspacesView.SECONDARY_WORKSPACE_SCALE) * height / 2);

        const thumbnailsWidth = this._getThumbnailsWidth(contentBox);
        const [, thumbnailsHeight] = this._thumbnails.get_preferred_height(thumbnailsWidth);

        if (this._thumbnails.visible) {
            const childBox = new Clutter.ActorBox();
            childBox.set_origin(spacing, Math.max(0, (height - thumbnailsHeight) / 4));
            childBox.set_size(thumbnailsWidth, thumbnailsHeight);
            this._thumbnails.allocate(childBox);
        }

        const {
            currentState, initialState, finalState, transitioning, progress,
        } = this._overviewAdjustment.getStateTransitionParams();

        let workspacesBox;
        const workspaceParams = [contentBox, padding, thumbnailsWidth, spacing];
        if (!transitioning) {
            workspacesBox =
                this._getWorkspacesBoxForState(currentState, ...workspaceParams);
        } else {
            const initialBox =
                this._getWorkspacesBoxForState(initialState, ...workspaceParams);
            const finalBox =
                this._getWorkspacesBoxForState(finalState, ...workspaceParams);
            workspacesBox = initialBox.interpolate(finalBox, progress);
        }
        this._workspacesView.allocate(workspacesBox);
    }
}

// -----WorkspacesDisplay------------------------------------------------------------------------

var WorkspacesDisplayOverride = {
    _onScrollEvent: function(actor, event) {
        if (this._swipeTracker.canHandleScrollEvent(event))
            return Clutter.EVENT_PROPAGATE;

        if (!this.mapped)
            return Clutter.EVENT_PROPAGATE;

        if (this._workspacesOnlyOnPrimary &&
            this._getMonitorIndexForEvent(event) != this._primaryIndex)
            return Clutter.EVENT_PROPAGATE;

        if (global.get_pointer()[2] & Clutter.ModifierType.SHIFT_MASK) {
            let direction = event.get_scroll_direction();
            if (direction === Clutter.ScrollDirection.UP) {
                direction = -1;
            }
            else if (direction === Clutter.ScrollDirection.DOWN) {
                direction = 1;
            } else {
                direction = 0;
            }

            if (direction) {
                _reorderWorkspace(direction);
                return Clutter.EVENT_STOP;
            }
        }

        return Main.wm.handleWorkspaceScroll(event);
    },

    _onKeyPressEvent: function(actor, event) {
        const { ControlsState } = OverviewControls;
        if (this._overviewAdjustment.value !== ControlsState.WINDOW_PICKER)
            return Clutter.EVENT_PROPAGATE;

        if (!this.reactive)
            return Clutter.EVENT_PROPAGATE;

        const { workspaceManager } = global;
        const vertical = workspaceManager.layout_rows === -1;
        const rtl = this.get_text_direction() === Clutter.TextDirection.RTL;

        let which;
        switch (event.get_key_symbol()) {
        case Clutter.KEY_Page_Up:
            if (vertical)
                which = Meta.MotionDirection.UP;
            else if (rtl)
                which = Meta.MotionDirection.RIGHT;
            else
                which = Meta.MotionDirection.LEFT;
            break;
        case Clutter.KEY_Page_Down:
            if (vertical)
                which = Meta.MotionDirection.DOWN;
            else if (rtl)
                which = Meta.MotionDirection.LEFT;
            else
                which = Meta.MotionDirection.RIGHT;
            break;
        case Clutter.KEY_Home:
            which = 0;
            break;
        case Clutter.KEY_End:
            which = workspaceManager.n_workspaces - 1;
            break;
        default:
            return Clutter.EVENT_PROPAGATE;
        }

        let ws;
        if (which < 0)
            // Negative workspace numbers are directions
            // with respect to the current workspace
            ws = workspaceManager.get_active_workspace().get_neighbor(which);
        else
            // Otherwise it is a workspace index
            ws = workspaceManager.get_workspace_by_index(which);

        if (global.get_pointer()[2] & Clutter.ModifierType.SHIFT_MASK) {
            let direction;
            if (which === Meta.MotionDirection.UP || which === Meta.MotionDirection.LEFT)
                direction = -1;
            else if (which === Meta.MotionDirection.DOWN || which === Meta.MotionDirection.RIGHT)
                direction = 1;
            if (direction)
                _reorderWorkspace(direction);
                return Clutter.EVENT_STOP;
        }

        if (ws)
            Main.wm.actionMoveWorkspace(ws);

        return Clutter.EVENT_STOP;
    }
}

//------workspaceThumbnail------------------------------------------------------------------------

var WorkspaceThumbnailOverride = {
    after__init: function () {
        this._bgManager = new Background.BackgroundManager({
            monitorIndex: this.monitorIndex,
            container: this._viewport,
            vignette: false,
            controlPosition: false,
        });
        this._viewport.set_child_below_sibling(this._bgManager.backgroundActor, null);

        this.connect('destroy', (function () {
            this._bgManager.destroy();
            this._bgManager = null;
        }).bind(this));
    }
}

//--- ThumbnailsBox

var ThumbnailsBoxOverride = {
    _activateThumbnailAtPoint: function(stageX, stageY, time) {
        const [r_, x, y] = this.transform_stage_point(stageX, stageY);

        const thumbnail = this._thumbnails.find(t => y >= t.y && y <= t.y + t.height);
        if (thumbnail)
            thumbnail.activate(time);
    },

    _getPlaceholderTarget: function(index, spacing, rtl) {
        const workspace = this._thumbnails[index];

        let targetY1;
        let targetY2;

        if (rtl) {
            const baseY = workspace.y + workspace.height;
            targetY1 = baseX - WORKSPACE_CUT_SIZE;
            targetY2 = baseX + spacing + WORKSPACE_CUT_SIZE;
        } else {
            targetY1 = workspace.y - spacing - WORKSPACE_CUT_SIZE;
            targetY2 = workspace.y + WORKSPACE_CUT_SIZE;
        }

        if (index === 0) {
            if (rtl)
                targetY2 -= spacing + WORKSPACE_CUT_SIZE;
            else
                targetY1 += spacing + WORKSPACE_CUT_SIZE;
        }

        if (index === this._dropPlaceholderPos) {
            const placeholderHeight = this._dropPlaceholder.get_height() + spacing;
            if (rtl)
                targetY2 += placeholderHeight;
            else
                targetY1 -= placeholderHeight;
        }

        return [targetY1, targetY2];
    },

     _withinWorkspace: function(y, index, rtl) {
        const length = this._thumbnails.length;
        const workspace = this._thumbnails[index];

        let workspaceY1 = workspace.y + WORKSPACE_CUT_SIZE;
        let workspaceY2 = workspace.y + workspace.height - WORKSPACE_CUT_SIZE;

        if (index === length - 1) {
            if (rtl)
                workspaceY1 -= WORKSPACE_CUT_SIZE;
            else
                workspaceY2 += WORKSPACE_CUT_SIZE;
        }

        return y > workspaceY1 && y <= workspaceY2;
    },

    handleDragOver: function(source, actor, x, y, time) {
        if (!source.metaWindow &&
            (!source.app || !source.app.can_open_new_window()) &&
            (source.app || !source.shellWorkspaceLaunch) &&
            source != Main.xdndHandler)
            return DND.DragMotionResult.CONTINUE;

        const rtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;
        let canCreateWorkspaces = Meta.prefs_get_dynamic_workspaces();
        let spacing = this.get_theme_node().get_length('spacing');

        this._dropWorkspace = -1;
        let placeholderPos = -1;
        let length = this._thumbnails.length;
        for (let i = 0; i < length; i++) {
            const index = rtl ? length - i - 1 : i;

            if (canCreateWorkspaces && source !== Main.xdndHandler) {
                const [targetStart, targetEnd] =
                    this._getPlaceholderTarget(index, spacing, rtl);

                if (y > targetStart && y <= targetEnd) {
                    placeholderPos = index;
                    break;
                }
            }

            if (this._withinWorkspace(y, index, rtl)) {
                this._dropWorkspace = index;
                break;
            }
        }

        if (this._dropPlaceholderPos != placeholderPos) {
            this._dropPlaceholderPos = placeholderPos;
            this.queue_relayout();
        }

        if (this._dropWorkspace != -1)
            return this._thumbnails[this._dropWorkspace].handleDragOverInternal(source, actor, time);
        else if (this._dropPlaceholderPos != -1)
            return source.metaWindow ? DND.DragMotionResult.MOVE_DROP : DND.DragMotionResult.COPY_DROP;
        else
            return DND.DragMotionResult.CONTINUE;
    },

    vfunc_get_preferred_width: function(forHeight) {
        if (forHeight === -1)
            return this.get_preferred_height(forHeight);

        let themeNode = this.get_theme_node();

        forHeight = themeNode.adjust_for_width(forHeight);

        let spacing = themeNode.get_length('spacing');
        let nWorkspaces = this._thumbnails.length;
        let totalSpacing = (nWorkspaces - 1) * spacing;

        const avail = forHeight - totalSpacing;

        let scale = (avail / nWorkspaces) / this._porthole.height;
        scale = Math.min(scale, WorkspaceThumbnail.MAX_THUMBNAIL_SCALE);

        const width = Math.round(this._porthole.width * scale);
        return themeNode.adjust_preferred_height(width, width);
    },

    vfunc_get_preferred_height: function(_forWidth) {
        // Note that for getPreferredHeight/Width we cheat a bit and skip propagating
        // the size request to our children because we know how big they are and know
        // that the actors aren't depending on the virtual functions being called.
        let themeNode = this.get_theme_node();

        let spacing = themeNode.get_length('spacing');
        let nWorkspaces = this._thumbnails.length;
        let totalSpacing = (nWorkspaces - 1) * spacing;

        const naturalheight = this._thumbnails.reduce((accumulator, thumbnail, index) => {
            let workspaceSpacing = 0;

            if (index > 0)
                workspaceSpacing += spacing / 2;
            if (index < this._thumbnails.length - 1)
                workspaceSpacing += spacing / 2;

            const progress = 1 - thumbnail.collapse_fraction;
            const height = (this._porthole.height * WorkspaceThumbnail.MAX_THUMBNAIL_SCALE + workspaceSpacing) * progress;
            return accumulator + height;
        }, 0);

        return themeNode.adjust_preferred_width(totalSpacing, naturalheight);
    },

    vfunc_allocate: function(box) {
        this.set_allocation(box);

        let rtl = Clutter.get_default_text_direction() == Clutter.TextDirection.RTL;

        if (this._thumbnails.length == 0) // not visible
            return;

        let themeNode = this.get_theme_node();
        box = themeNode.get_content_box(box);

        const portholeWidth = this._porthole.width;
        const portholeHeight = this._porthole.height;
        const spacing = themeNode.get_length('spacing');

        const nWorkspaces = this._thumbnails.length;

        // Compute the scale we'll need once everything is updated,
        // unless we are currently transitioning
        if (this._expandFraction === 1) {
            const totalSpacing = (nWorkspaces - 1) * spacing;
            const availableHeight = (box.get_height() - totalSpacing) / nWorkspaces;

            const hScale = box.get_width() / portholeWidth;
            const vScale = availableHeight / portholeHeight;
            const newScale = Math.min(hScale, vScale);

            if (newScale !== this._targetScale) {
                if (this._targetScale > 0) {
                    // We don't ease immediately because we need to observe the
                    // ordering in queueUpdateStates - if workspaces have been
                    // removed we need to slide them out as the first thing.
                    this._targetScale = newScale;
                    this._pendingScaleUpdate = true;
                } else {
                    this._targetScale = this._scale = newScale;
                }

                this._queueUpdateStates();
            }
        }

        const ratio = portholeWidth / portholeHeight;
        const thumbnailFullHeight = Math.round(portholeHeight * this._scale);
        const thumbnailWidth = Math.round(thumbnailFullHeight * ratio);
        const thumbnailHeight = thumbnailFullHeight * this._expandFraction;
        const roundedVScale = thumbnailHeight / portholeHeight;

        // We always request size for MAX_THUMBNAIL_SCALE, distribute
        // space evently if we use smaller thumbnails
        const extraHeight =
            (WorkspaceThumbnail.MAX_THUMBNAIL_SCALE * portholeHeight - thumbnailHeight) * nWorkspaces;
        box.y2 -= Math.round(extraHeight / 2);

        let indicatorValue = this._scrollAdjustment.value;
        let indicatorUpperWs = Math.ceil(indicatorValue);
        let indicatorLowerWs = Math.floor(indicatorValue);

        let indicatorLowerY1 = 0;
        let indicatorLowerY2 = 0;
        let indicatorUpperY1 = 0;
        let indicatorUpperY2 = 0;

        let indicatorThemeNode = this._indicator.get_theme_node();
        let indicatorTopFullBorder = indicatorThemeNode.get_padding(St.Side.TOP) + indicatorThemeNode.get_border_width(St.Side.TOP);
        let indicatorBottomFullBorder = indicatorThemeNode.get_padding(St.Side.BOTTOM) + indicatorThemeNode.get_border_width(St.Side.BOTTOM);
        let indicatorLeftFullBorder = indicatorThemeNode.get_padding(St.Side.LEFT) + indicatorThemeNode.get_border_width(St.Side.LEFT);
        let indicatorRightFullBorder = indicatorThemeNode.get_padding(St.Side.RIGHT) + indicatorThemeNode.get_border_width(St.Side.RIGHT);

        let y = box.y1;

        if (this._dropPlaceholderPos == -1) {
            this._dropPlaceholder.allocate_preferred_size(
                ...this._dropPlaceholder.get_position());

            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                this._dropPlaceholder.hide();
            });
        }

        let childBox = new Clutter.ActorBox();

        for (let i = 0; i < this._thumbnails.length; i++) {
            const thumbnail = this._thumbnails[i];
            if (i > 0)
                y += spacing - Math.round(thumbnail.collapse_fraction * spacing);

            const x1 = box.x1;
            const x2 = x1 + thumbnailWidth;

            if (i === this._dropPlaceholderPos) {
                let [, placeholderHeight] = this._dropPlaceholder.get_preferred_height(-1);
                childBox.x1 = x1;
                childBox.x2 = x2;

                if (rtl) {
                    childBox.y2 = box.y2 - Math.round(y);
                    childBox.y1 = box.y2 - Math.round(y + placeholderHeight);
                } else {
                    childBox.y1 = Math.round(y);
                    childBox.y2 = Math.round(y + placeholderHeight);
                }

                this._dropPlaceholder.allocate(childBox);

                Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                    this._dropPlaceholder.show();
                });
                y += placeholderHeight + spacing;
            }

            // We might end up with thumbnailWidth being something like 99.33
            // pixels. To make this work and not end up with a gap at the end,
            // we need some thumbnails to be 99 pixels and some 100 pixels width;
            // we compute an actual scale separately for each thumbnail.
            const y1 = Math.round(y);
            const y2 = Math.round(y + thumbnailHeight);
            const roundedHScale = (y2 - y1) / portholeHeight;

            // Allocating a scaled actor is funny - x1/y1 correspond to the origin
            // of the actor, but x2/y2 are increased by the *unscaled* size.
            if (rtl) {
                childBox.y2 = box.y2 - y1;
                childBox.y1 = box.y2 - (y1 + thumbnailHeight);
            } else {
                childBox.y1 = y1;
                childBox.y2 = y1 + thumbnailHeight;
            }
            childBox.x1 = x1;
            childBox.x2 = x1 + thumbnailWidth;

            thumbnail.setScale(roundedHScale, roundedVScale);
            thumbnail.allocate(childBox);

            if (i === indicatorUpperWs) {
                indicatorUpperY1 = childBox.y1;
                indicatorUpperY2 = childBox.y2;
            }
            if (i === indicatorLowerWs) {
                indicatorLowerY1 = childBox.y1;
                indicatorLowerY2 = childBox.y2;
            }

            // We round the collapsing portion so that we don't get thumbnails resizing
            // during an animation due to differences in rounded, but leave the uncollapsed
            // portion unrounded so that non-animating we end up with the right total
            y += thumbnailHeight - Math.round(thumbnailHeight * thumbnail.collapse_fraction);
        }

        childBox.x1 = box.x1;
        childBox.x2 = box.x1 + thumbnailWidth;

        const indicatorY1 = indicatorLowerY1 +
            (indicatorUpperY1 - indicatorLowerY1) * (indicatorValue % 1);
        const indicatorY2 = indicatorLowerY2 +
            (indicatorUpperY2 - indicatorLowerY2) * (indicatorValue % 1);

        childBox.y1 = indicatorY1 - indicatorTopFullBorder;
        childBox.y2 = indicatorY2 + indicatorBottomFullBorder;
        childBox.x1 -= indicatorLeftFullBorder;
        childBox.x2 += indicatorRightFullBorder;
        this._indicator.allocate(childBox);
    },

    _updateShouldShow: function() {
        if (this._shouldShow === true)
            return;

        this._shouldShow = true;
        this.notify('should-show');
    }
}

//------- overviewControls --------------------------------

// ------ ControlsManager ----------------------------------

var ControlsManagerOverride = {
    _getFitModeForState: function(state) {
        switch (state) {
            case ControlsState.HIDDEN:
            case ControlsState.WINDOW_PICKER:
                return WorkspacesView.FitMode.SINGLE;
            case ControlsState.APP_GRID:
                return WorkspacesView.FitMode.SINGLE;
            default:
                return WorkspacesView.FitMode.SINGLE;
        }
    },

    _getThumbnailsBoxParams: function() {
        const opacity = 255;
        const scale = 1;
        return [ opacity, scale];
    },

    _updateThumbnailsBox: function() {
        const { shouldShow } = this._thumbnailsBox;

        const thumbnailsBoxVisible = shouldShow;
        if (thumbnailsBoxVisible) {
            this._thumbnailsBox.opacity = 255;
            this._thumbnailsBox.visible = thumbnailsBoxVisible;
        }
    },
}

//-------ControlsManagerLayout-----------------------------

var ControlsManagerLayoutOverride = {
    _computeWorkspacesBoxForState: function(state, box, workAreaBox, searchHeight, dashHeight, thumbnailsWidth) {
        if (shellVersion < 42) {
            thumbnailsWidth = dashHeight;
            dashHeight = thumbnailsWidth;
            searchHeight = dashHeight;
            workAreaBox = box;
        }
        const workspaceBox = box.copy();
        const [width, height] = workspaceBox.get_size();
        const { y1: startY } = workAreaBox;
        const { spacing } = this;
        const { expandFraction } = this._workspacesThumbnails;

        const dash = Main.overview.dash;
        // DtD property only
        const dashVertical = dash._isHorizontal === false;

        let wWidth;
        let wHeight;
        let scale = 1;

        switch (state) {
        case OverviewControls.ControlsState.HIDDEN:
            workspaceBox.set_origin(...workAreaBox.get_origin());
            workspaceBox.set_size(...workAreaBox.get_size());
            break;
        case OverviewControls.ControlsState.WINDOW_PICKER:
        case OverviewControls.ControlsState.APP_GRID:
            dashHeight = this._dash.visible ? dashHeight : 0;
            wWidth = width
                         - (dashVertical ? dash.width + spacing : spacing)
                         - thumbnailsWidth - spacing;
            wHeight = height -
                          (dashVertical ? spacing : dashHeight + 2 * spacing);
            const ratio = width / height;
            scale = wWidth / (ratio * wHeight) * 0.94;

            let xOffset = 0;
            let yOffset = 0;

            yOffset = dashHeight ? 0 : ((wHeight - (wHeight * scale)) / 4) + (((height - wHeight - dashHeight - searchHeight) / 3));

            if (scale < 1) {
                wHeight *= scale;
            }

            wWidth = wHeight * ratio;

            // move the workspace box to the middle of the screen, if possible
            const centeredBoxX = (width - wWidth + (dashVertical ? dash.width + spacing : 0)) / 2;
            xOffset = Math.min(centeredBoxX, width - wWidth - (thumbnailsWidth + (2 * spacing)));

            if (xOffset !== centeredBoxX) { // in this case xOffset holds max possible wsBoxX coordinance
                xOffset = Math.max((xOffset - (dashVertical ? dash.width + spacing : spacing)) / 2 + (dashVertical ? dash.width + spacing : spacing), (dashVertical ? dash.width + spacing : spacing));
            }

            const wsBoxX = Math.round(xOffset + (thumbnailsWidth ? thumbnailsWidth + spacing : 0));
            //const wsBoxY = Math.round(startY + yOffset + (searchHeight ? searchHeight + spacing : spacing));
            const wsBoxY = Math.round(startY + yOffset + (dashHeight ? dashHeight : spacing) + (searchHeight ? searchHeight + spacing : 0));

            workspaceBox.set_size(wWidth, wHeight);
            workspaceBox.set_origin(wsBoxX, wsBoxY);

            break;
        }

        return workspaceBox;
    },

    _getAppDisplayBoxForState: function(state, box, workAreaBox, searchHeight, dashHeight, appGridBox, thumbnailsWidth) {
        const [width, height] = box.get_size();
        const { y1: startY } = workAreaBox;
        const { x1: startX } = workAreaBox;
        const appDisplayBox = new Clutter.ActorBox();
        const { spacing } = this;

        switch (state) {
        case ControlsState.HIDDEN:
        case ControlsState.WINDOW_PICKER:
            appDisplayBox.set_origin(spacing + thumbnailsWidth, box.y2);
            break;
        case ControlsState.APP_GRID:
            appDisplayBox.set_origin(spacing + thumbnailsWidth, startY + dashHeight);
            break;
        }

        appDisplayBox.set_size(width - spacing - thumbnailsWidth, height - dashHeight - 2 * spacing);
        return appDisplayBox;
    },

    vfunc_allocate: function(container, box) {
        const childBox = new Clutter.ActorBox();

        const { spacing } = this;

        const monitor = Main.layoutManager.findMonitorForActor(this._container);
        const workArea = Main.layoutManager.getWorkAreaForMonitor(monitor.index);
        const startX = workArea.x - monitor.x;
        const startY = workArea.y - monitor.y;
        const workAreaBox = new Clutter.ActorBox();
        workAreaBox.set_origin(startX, startY);
        workAreaBox.set_size(workArea.width, workArea.height);
        box.y1 += startY;
        const [width, height] = box.get_size();
        let availableHeight = height;

        // Dash
        const maxDashHeight = Math.round(box.get_height() * OverviewControls.DASH_MAX_HEIGHT_RATIO);
        const maxDashWidth = Math.round(box.get_width() * DASH_MAX_WIDTH_RATIO);
        let dashHeight;
        let dashWidth;
        /*if (VERTICAL_DASH) { // just for testing
            this._dash.setMaxSize(maxDashWidth, height);
            [dashWidth] = this._dash.get_preferred_height(width);
            dashWidth = Math.min(dashWidth, maxDashWidth);

            childBox.set_origin(startX + spacing, startY);
            childBox.set_size(dashWidth, height);

        } else {*/
            this._dash.setMaxSize(width, maxDashHeight);
            [, dashHeight] = this._dash.get_preferred_height(width);
            [, dashWidth] = this._dash.get_preferred_width(dashHeight);
            dashHeight = Math.min(dashHeight, maxDashHeight);

            dashWidth = Math.min(dashWidth, width);
            const DASH_CENTERED = false; // for testing, before option will be added
            let dashX = Math.min(spacing, (width - dashWidth) / 2)
            if (DASH_CENTERED) {
                childBox.set_origin(0, startY);
                childBox.set_size(width, dashHeight);
            } else {
                childBox.set_origin(dashX, startY);
                childBox.set_size(dashWidth, dashHeight);
            }
        //}

        this._dash.allocate(childBox);
        // dash cloud be other than the default, could be Dash to Dock
        // btw Dash to Dock has property _isHorizontal
        const dashVertical = Main.overview.dash.width < Main.overview.dash.height;

        availableHeight -= dashVertical ? Main.overview.dash.width : dashHeight + spacing;

        dashHeight = this._dash.visible ? dashHeight : 0;

        // Workspace Thumbnails
        let thumbnailsWidth = 0;
        let thumbnailsHeight = 0;

        // should be always visible in this layout
        if (this._workspacesThumbnails.visible) {
            const { expandFraction } = this._workspacesThumbnails;
            thumbnailsHeight = height - spacing - dashHeight;

            thumbnailsWidth = this._workspacesThumbnails.get_preferred_width(thumbnailsHeight)[0];

            thumbnailsWidth = Math.round(Math.min(
                thumbnailsWidth * expandFraction,
                width * WorkspaceThumbnail.MAX_THUMBNAIL_SCALE));

                let dockOffset = 0;

            const dash = Main.overview.dash;
            // Ubuntu Dash / Dash to Dock property only - is_horizontal
            if (dashVertical) {
                dockOffset = dash.width;
            }

            // move the thumbnails to the left
            childBox.set_origin(startX + spacing,
                                startY + (dashHeight ? dashHeight : (3 * spacing))
            );
            childBox.set_size(thumbnailsWidth, thumbnailsHeight);
            this._workspacesThumbnails.allocate(childBox);
        }

        const searchXoffset = spacing + thumbnailsWidth + spacing;
        // Search entry
        let [searchHeight] = this._searchEntry.get_preferred_height(width - thumbnailsWidth - dashVertical ? dashWidth : 0);

        // Y possition under top Dash
        childBox.set_origin(/*searchXoffset*/0, startY + (dashVertical ? spacing : dashHeight - spacing));
        childBox.set_size(width /*- searchXoffset*/, searchHeight);

        this._searchEntry.allocate(childBox);

        availableHeight -= searchHeight + spacing;

        // Workspaces
        let params = [box, workAreaBox, searchHeight, dashHeight, thumbnailsWidth];
        const transitionParams = this._stateAdjustment.getStateTransitionParams();

        // Update cached boxes
        for (const state of Object.values(ControlsState)) {
            this._cachedWorkspaceBoxes.set(
                state, this._computeWorkspacesBoxForState(state, ...params));
        }

        let workspacesBox;
        if (!transitionParams.transitioning) {
            workspacesBox = this._cachedWorkspaceBoxes.get(transitionParams.currentState);
        } else {
            const initialBox = this._cachedWorkspaceBoxes.get(transitionParams.initialState);
            const finalBox = this._cachedWorkspaceBoxes.get(transitionParams.finalState);
            workspacesBox = initialBox.interpolate(finalBox, transitionParams.progress);
        }

        this._workspacesDisplay.allocate(workspacesBox);

        // AppDisplay
        if (this._appDisplay.visible) {
            const workspaceAppGridBox =
                this._cachedWorkspaceBoxes.get(ControlsState.APP_GRID);

            params = [box, workAreaBox, searchHeight, dashHeight, workspaceAppGridBox, thumbnailsWidth];
            let appDisplayBox;
            if (!transitionParams.transitioning) {
                appDisplayBox =
                    this._getAppDisplayBoxForState(transitionParams.currentState, ...params);
            } else {
                const initialBox =
                    this._getAppDisplayBoxForState(transitionParams.initialState, ...params);
                const finalBox =
                    this._getAppDisplayBoxForState(transitionParams.finalState, ...params);

                appDisplayBox = initialBox.interpolate(finalBox, transitionParams.progress);
            }

            this._appDisplay.allocate(appDisplayBox);
        }

        // Search
        childBox.set_origin(searchXoffset, startY + dashHeight + spacing + searchHeight + spacing);
        //childBox.set_size(width - 2 * searchXoffset, availableHeight);
        childBox.set_size(width - searchXoffset, availableHeight);

        this._searchController.allocate(childBox);

        this._runPostAllocation();
    }
}

// ------ Workspace -----------------------------------------------------------------
var WorkspaceLayoutOverride = {
    // this fixes wrong size and position calculation of window clones while moving overview to the next (+1) workspace if vertical ws orintation is set
    _adjustSpacingAndPadding: function(rowSpacing, colSpacing, containerBox) {
        if (this._sortedWindows.length === 0)
            return [rowSpacing, colSpacing, containerBox];

        // All of the overlays have the same chrome sizes,
        // so just pick the first one.
        const window = this._sortedWindows[0];

        const [topOversize, bottomOversize] = window.chromeHeights();
        const [leftOversize, rightOversize] = window.chromeWidths();

        const oversize = Math.max(topOversize, bottomOversize, leftOversize, rightOversize);

        if (rowSpacing !== null)
            rowSpacing += oversize;
        if (colSpacing !== null)
            colSpacing += oversize;

        if (containerBox) {
            const vertical = global.workspaceManager.layout_rows === -1;

            const monitor = Main.layoutManager.monitors[this._monitorIndex];

            const bottomPoint = new Graphene.Point3D();
            if (vertical) {
                bottomPoint.x = containerBox.x2;
            } else {
                bottomPoint.y = containerBox.y2;
            }

            const transformedBottomPoint =
                this._container.apply_transform_to_point(bottomPoint);
            const bottomFreeSpace = vertical
                ? (monitor.x + monitor.height) - transformedBottomPoint.x
                : (monitor.y + monitor.height) - transformedBottomPoint.y;

            const [, bottomOverlap] = window.overlapHeights();

            if ((bottomOverlap + oversize) > bottomFreeSpace && !vertical) {
                containerBox.y2 -= (bottomOverlap + oversize) - bottomFreeSpace;
            }
        }

        return [rowSpacing, colSpacing, containerBox];
    }
}

var DashItemContainerOverride = {
    // move labels under the icons
    showLabel() {
        if (!this._labelText)
            return;

        this.label.set_text(this._labelText);
        this.label.opacity = 0;
        this.label.show();

        let [stageX, stageY] = this.get_transformed_position();

        const itemWidth = this.allocation.get_width();
        const itemHeight = this.allocation.get_height();

        const labelWidth = this.label.get_width();
        const labelHeight = this.label.get_height();
        const xOffset = Math.floor((itemWidth - labelWidth) / 2);
        const x = Math.clamp(stageX + xOffset, 0, global.stage.width - labelWidth);

        let node = this.label.get_theme_node();
        const yOffset = Math.floor(itemHeight - labelHeight + 2* node.get_length('-y-offset'));

        const y = stageY + yOffset;

        this.label.set_position(x, y);
        this.label.ease({
            opacity: 255,
            duration: DASH_ITEM_LABEL_SHOW_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }
}

// appDisplay
var AppDisplayOverride  = {
    // this fixes dnd from appDisplay to workspace switcher if appDisplay is on page 1. weird bug, weird solution..
    _pageForCoords: function(x, y) {
        if (this._dragMonitor != null)
            return AppDisplay.SidePages.NONE;

        const rtl = this.get_text_direction() === Clutter.TextDirection.RTL;
        const { allocation } = this._grid;

        const [success, pointerX] = this._scrollView.transform_stage_point(x, y);
        if (!success)
            return AppDisplay.SidePages.NONE;

        if (pointerX < allocation.x1)
            return rtl ? AppDisplay.SidePages.NEXT : AppDisplay.SidePages.PREVIOUS;
        else if (pointerX > allocation.x2)
            return rtl ? AppDisplay.SidePages.PREVIOUS : AppDisplay.SidePages.NEXT;

        return AppDisplay.SidePages.NONE;
    }
}

function _updateWorkspacesDisplay() {
    const { initialState, finalState, progress } = this._stateAdjustment.getStateTransitionParams();
    const { searchActive } = this._searchController;

    const paramsForState = s => {
        let opacity;
        switch (s) {
            case ControlsState.HIDDEN:
            case ControlsState.WINDOW_PICKER:
                opacity = 255;
                break;
            case ControlsState.APP_GRID:
                opacity = 0;
                break;
            default:
                opacity = 255;
                break;
        }
        return { opacity };
    };

    let initialParams = paramsForState(initialState);
    let finalParams = paramsForState(finalState);

    let opacity = Math.round(Util.lerp(initialParams.opacity, finalParams.opacity, progress));

    let workspacesDisplayVisible = (opacity != 0) && !(searchActive);
    let params = {
        opacity: opacity,
        duration: 0,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onComplete: () => {
            this._workspacesDisplay.reactive = workspacesDisplayVisible;
            this._workspacesDisplay.setPrimaryWorkspaceVisible(workspacesDisplayVisible);
            // following changes in which axis will operate overshoot detection which switches appDisplay pages while dragging app icon to vertical
            // overall orientation of the grid and its pages stays horizontal, global orientation switch is not built-in
            if (finalState === ControlsState.APP_GRID)
                Main.overview._overview.controls._appDisplay._orientation = Clutter.Orientation.VERTICAL;
        }
    }

    this._workspacesDisplay.ease(params);
}

function _reorderWorkspace(direction = 0) {
    let activeWs = global.workspace_manager.get_active_workspace();
    let activeWsIdx = activeWs.index();
    let targetIdx = activeWsIdx + direction;
    if (targetIdx > -1 && targetIdx < (global.workspace_manager.get_n_workspaces())) {
        global.workspace_manager.reorder_workspace(activeWs, targetIdx);
    }
}