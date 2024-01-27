/**
 * Workspaces Switcher Manager
 * verticalWorkspaces.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022 - 2024
 * @license    GPL-3.0
 */
'use strict';

import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Meta from 'gi://Meta';
import Graphene from 'gi://Graphene';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';
import * as WorkspacesView from 'resource:///org/gnome/shell/ui/workspacesView.js';


// keep adjacent workspaces out of the screen
const WORKSPACE_MAX_SPACING = 200;
const WORKSPACE_MIN_SPACING = 24;

let _appButtonSigHandlerId;

export function patch(overrides) {

    overrides.addOverride('WorkspaceLayout', Workspace.WorkspaceLayout.prototype, WorkspaceLayoutOverride);
    overrides.addOverride('WorkspacesView', WorkspacesView.WorkspacesView.prototype, WorkspacesViewOverride);

    _connectAppButton();
    _switchPageShortcuts();
}

export function reset(overrides) {
    if (_appButtonSigHandlerId) {
        Main.overview.dash.showAppsButton.disconnect(_appButtonSigHandlerId);
        _appButtonSigHandlerId = 0;
    }

    overrides.removeOverride('WorkspacesView');
    overrides.removeOverride('WorkspaceLayout');
    _switchPageShortcuts();
}

function _connectAppButton() {
    if (_appButtonSigHandlerId)
        Main.overview.dash.showAppsButton.disconnect(_appButtonSigHandlerId);
    _appButtonSigHandlerId = Main.overview.dash.showAppsButton.connect('notify::checked', w => {
        if (w.checked)
            global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, 1, -1);
        else
            global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, -1, 1);
    });
}

function _switchPageShortcuts() {
    const vertical = global.workspaceManager.layout_rows === -1;
    const settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.keybindings' });

    const keyLeft = 'switch-to-workspace-left';
    const keyRight = 'switch-to-workspace-right';
    const keyUp = 'switch-to-workspace-up';
    const keyDown = 'switch-to-workspace-down';

    const keyMoveLeft = 'move-to-workspace-left';
    const keyMoveRight = 'move-to-workspace-right';
    const keyMoveUp = 'move-to-workspace-up';
    const keyMoveDown = 'move-to-workspace-down';

    const switchPrevSc = '<Super>Page_Up';
    const switchNextSc = '<Super>Page_Down';
    const movePrevSc = '<Super><Shift>Page_Up';
    const moveNextSc = '<Super><Shift>Page_Down';

    let switchLeft = settings.get_strv(keyLeft);
    let switchRight = settings.get_strv(keyRight);
    let switchUp = settings.get_strv(keyUp);
    let switchDown = settings.get_strv(keyDown);

    let moveLeft = settings.get_strv(keyMoveLeft);
    let moveRight = settings.get_strv(keyMoveRight);
    let moveUp = settings.get_strv(keyMoveUp);
    let moveDown = settings.get_strv(keyMoveDown);

    if (vertical) {
        if (switchLeft.includes(switchPrevSc))
            switchLeft.splice(switchLeft.indexOf(switchPrevSc), 1);
        if (switchRight.includes(switchNextSc))
            switchRight.splice(switchRight.indexOf(switchNextSc), 1);
        if (moveLeft.includes(movePrevSc))
            moveLeft.splice(moveLeft.indexOf(movePrevSc), 1);
        if (moveRight.includes(moveNextSc))
            moveRight.splice(moveRight.indexOf(moveNextSc), 1);

        if (!switchUp.includes(switchPrevSc))
            switchUp.push(switchPrevSc);
        if (!switchDown.includes(switchNextSc))
            switchDown.push(switchNextSc);
        if (!moveUp.includes(movePrevSc))
            moveUp.push(movePrevSc);
        if (!moveDown.includes(moveNextSc))
            moveDown.push(moveNextSc);
    } else {
        if (!switchLeft.includes(switchPrevSc))
            switchLeft.push(switchPrevSc);
        if (!switchRight.includes(switchNextSc))
            switchRight.push(switchNextSc);
        if (!moveLeft.includes(movePrevSc))
            moveLeft.push(movePrevSc);
        if (!moveRight.includes(moveNextSc))
            moveRight.push(moveNextSc);

        if (switchUp.includes(switchPrevSc))
            switchUp.splice(switchUp.indexOf(switchPrevSc), 1);
        if (switchDown.includes(switchNextSc))
            switchDown.splice(switchDown.indexOf(switchNextSc), 1);
        if (moveUp.includes(movePrevSc))
            moveUp.splice(moveUp.indexOf(movePrevSc), 1);
        if (moveDown.includes(moveNextSc))
            moveDown.splice(moveDown.indexOf(moveNextSc), 1);
    }

    settings.set_strv(keyLeft, switchLeft);
    settings.set_strv(keyRight, switchRight);
    settings.set_strv(keyUp, switchUp);
    settings.set_strv(keyDown, switchDown);

    settings.set_strv(keyMoveLeft, moveLeft);
    settings.set_strv(keyMoveRight, moveRight);
    settings.set_strv(keyMoveUp, moveUp);
    settings.set_strv(keyMoveDown, moveDown);
}

// ---- workspacesView ----------------------------------------
// WorkspacesView
var WorkspacesViewOverride = {
    _getFirstFitSingleWorkspaceBox(box, spacing, vertical) {
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

        const fitSingleBox = new Clutter.ActorBox({ x1, y1 });

        fitSingleBox.set_size(workspaceWidth, workspaceHeight);

        return fitSingleBox;
    },

    // avoid overlapping of adjacent workspaces with the current view
    _getSpacing(box, fitMode, vertical) {
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
};

// ------ Workspace -----------------------------------------------------------------
var WorkspaceLayoutOverride = {
    // this fixes wrong size and position calculation of window clones while moving overview to the next (+1) workspace if vertical ws orintation is enabled in GS
    _adjustSpacingAndPadding(rowSpacing, colSpacing, containerBox) {
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
            if (vertical)
                bottomPoint.x = containerBox.x2;
            else
                bottomPoint.y = containerBox.y2;


            const transformedBottomPoint =
                this._container.apply_transform_to_point(bottomPoint);
            const bottomFreeSpace = vertical
                ? (monitor.x + monitor.height) - transformedBottomPoint.x
                : (monitor.y + monitor.height) - transformedBottomPoint.y;

            const [, bottomOverlap] = window.overlapHeights();

            if ((bottomOverlap + oversize) > bottomFreeSpace && !vertical)
                containerBox.y2 -= (bottomOverlap + oversize) - bottomFreeSpace;
        }

        return [rowSpacing, colSpacing, containerBox];
    },
};
