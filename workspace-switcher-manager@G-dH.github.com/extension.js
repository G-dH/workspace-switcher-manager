// Workspace Switcher Manager
// GPL v3 ©G-dH@Github.com
'use strict'

const { GLib, GObject, Clutter, St, Meta, Shell, Gio } = imports.gi;
const Main = imports.ui.main;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const AltTab = imports.ui.altTab;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;
const shellVersion = Settings.shellVersion;

let originalWsPopup;
let originalWsPopupList;
let origNeighbor;

let mscOptions;
let STORE_DEFAULT_COLORS;

var DISPLAY_TIMEOUT;

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
	mscOptions = new Settings.MscOptions();
	mscOptions.connect('changed', _updateSettings);
	DISPLAY_TIMEOUT = mscOptions.popupTimeout;
	Meta.Workspace.prototype.get_neighbor = getNeighbour;
	WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = WorkspaceSwitcherPopupCustom;
	WorkspaceSwitcherPopup.WorkspaceSwitcherPopupList = WorkspaceSwitcherPopupList;
	_storeDefaultColors();
}

function disable() {
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

function _updateSettings(settings, key) {
	switch (key) {
	case 'timeout':
		DISPLAY_TIMEOUT = mscOptions.popupTimeout;
		break;
	case 'default-colors':
		return;
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
	const popup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
	popup.opacity = 0;
	const activeIndex = global.workspaceManager.get_active_workspace_index();
	popup.display(Meta.MotionDirection.UP, activeIndex);

	const containerNode = popup._container.get_theme_node();
	const activeNode = popup._list.get_children()[activeIndex].get_theme_node();

	const popupBgColor = containerNode.lookup_color('background-color', true)[1];
	// border color in default theme is set in 'border' element and can not be read directly
	//const borderColor = inactiveNode.lookup_color('border-color', true)[1].to_string();
	const borderColor = 'rgb(53,53,53)'; // average of default inactive box and container bordes 31/40
	const activeFgColor = activeNode.get_foreground_color();
	const activeBGColor = activeNode.get_background_color();

 	mscOptions.defaultColors = [
		 `rgba(${popupBgColor.red},${popupBgColor.green},${popupBgColor.blue},${popupBgColor.alpha})`,
		 borderColor,
		 `rgba(${activeFgColor.red},${activeFgColor.green},${activeFgColor.blue},${activeFgColor.alpha})`,
		 `rgba(${activeBGColor.red},${activeBGColor.green},${activeBGColor.blue},${activeBGColor.alpha})`
	];
	if (!mscOptions.defaultPopupBgColor)
		mscOptions.defaultPopupBgColor = mscOptions.defaultColors[0];
	if (!mscOptions.defaultPopupBorderColor)
		mscOptions.defaultPopupBorderColor = mscOptions.defaultColors[1];
	if (!mscOptions.defaultPopupActiveFgColor)
		mscOptions.defaultPopupActiveFgColor = mscOptions.defaultColors[2];
	if (!mscOptions.defaultPopupActiveBgColor)
		mscOptions.defaultPopupActiveBgColor = mscOptions.defaultColors[3];

	popup.destroy();
}

function getNeighbour(direction) {
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
class WorkspaceSwitcherPopupCustom extends WorkspaceSwitcherPopup.WorkspaceSwitcherPopup {
	_init(){
		super._init();
		this.connect('destroy', () => this._wsNamesSettings = null);
	}

	display(direction, activeWorkspaceIndex) {
		if (mscOptions.popupMode === ws_popup_mode.DISABLE)
			return;
        this._direction = direction;
        this._activeWorkspaceIndex = activeWorkspaceIndex;

		this.popSize = mscOptions.defaultPopupSize / 100;
		
        this._redisplay();
        if (this._timeoutId != 0) {
            GLib.source_remove(this._timeoutId);
			this._timeoutId = 0;
		}
		if (DISPLAY_TIMEOUT !== 0) {
			this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DISPLAY_TIMEOUT, this._onTimeout.bind(this));
		}
        GLib.Source.set_name_by_id(this._timeoutId, '[gnome-shell] this._onTimeout');

		this.opacity = Math.floor(mscOptions.defaultPopupOpacity / 100 * 255);


		if (this._contRadius === undefined) {
			const listThemeNode = this._list.get_theme_node();
			const listSpacing = listThemeNode.get_length('spacing');
			// roundness adjust only for scaled down popups
			this._listSpacing = Math.min(Math.max(Math.floor(listSpacing * this.popSize), 4), listSpacing);

			const contRadius = this._container.get_theme_node().get_length('border-radius');
			this._contRadius = Math.max(Math.floor(contRadius * this.popSize), 3);
			// I wasn't successful to get original padding for the _container, so I use _list spacing as it's usually the similar value
			this._contPadding = Math.min(Math.max(this._listSpacing * this.popSize, 4), 35);
		}

		this._list.set_style(`spacing: ${this._listSpacing}px;`);
		this._container.set_style(`	padding: ${this._contPadding}px;
									border-radius: ${this._contRadius}px;
									background-color: ${mscOptions.defaultPopupBgColor};
									border-color: ${mscOptions.defaultPopupBorderColor};
		`);
		const children = this._list.get_children();
		for (let i=0; i < children.length; i++) {
			if (this._boxRadius === undefined) {
				const theme = children[i].get_theme_node();
				this._boxRadius = Math.max(Math.floor(theme.get_length('border-radius') * this.popSize), 3);
				this._boxHeight = Math.floor(theme.get_height() * this.popSize);
				this._boxBgSize = Math.floor(theme.get_length('background-size') * this.popSize);
			}

			if (i == this._activeWorkspaceIndex || mscOptions.popupMode){ // 0 all ws 1 single ws
				children[i].set_style(`	height: ${this._boxHeight}px;
										background-size: ${this._boxBgSize}px;
										border-radius: ${this._boxRadius}px;
										color: ${mscOptions.defaultPopupActiveFgColor};
										background-color: ${mscOptions.defaultPopupActiveBgColor};
										border-color: ${mscOptions.defaultPopupBorderColor};
				`);
			} else {
				children[i].set_style(`	height: ${this._boxHeight}px;
										background-size: ${this._boxBgSize}px;
										border-radius: ${this._boxRadius}px;
										border-color: ${mscOptions.defaultPopupBorderColor};
				`);
			}
		}
        this._show();
		this._setPopupPosition();
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

			if (i == this._activeWorkspaceIndex) {
				const label = this._getCustomLabel();
				if (label)
					indicator.set_child(label);
			}
			if (indicator)
            	this._list.add_actor(indicator);
        }
    }

	_onTimeout() {
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
		this._container.x = workArea.x + Math.floor((workArea.width - containerNatWidth) * (h_percent/100));
		this._container.y = workArea.y + Math.floor((workArea.height - containerNatHeight) * (v_percent/100));
	}

	_getWsNamesSettings() {
		if (!this._wsNamesSettings) {
			this._wsNamesSettings = ExtensionUtils.getSettings(
						'org.gnome.desktop.wm.preferences');
		}
		return this._wsNamesSettings;
	}

	_getCustomLabel(){
		let label = null;
		let text = '';//, wsName, appName = '';
		
		if (mscOptions.defaultPopupShowWsIndex) {
    		text = `${this._activeWorkspaceIndex + 1}`
		}

		if (mscOptions.defaultPopupShowWsName) {
			const settings = this._getWsNamesSettings();
			const names = settings.get_strv('workspace-names');
			if (names.length > this._activeWorkspaceIndex) {
				//wsName = names[this._activeWorkspaceIndex];
				if (text)
					text += '\n';
				text += names[this._activeWorkspaceIndex]
			}
		}

		if (mscOptions.defaultPopupShowAppName) {
			const ws = global.workspaceManager.get_workspace_by_index(this._activeWorkspaceIndex);
			const win = AltTab.getWindows(ws)[0];
			
			if (win) {
				//appName = this._getWindowApp(win).get_name();
				if (text) {
					text += '\n'
				}
				text += _getWindowApp(win).get_name();
			}
		}

		if (!text) return;

		let fontSize;
		if (!mscOptions.defaultPopupShowAppName && !mscOptions.defaultPopupShowAppName) {
			fontSize = this.popSize * mscOptions.indexSize / 100;
		} else {
			fontSize = this.popSize * mscOptions.fontSize / 100;
		}
		label = new St.Label({
			x_align: Clutter.ActorAlign.CENTER,
			y_align: Clutter.ActorAlign.CENTER,
			style: `text-align: center;
					font-size: ${fontSize}em;
					${mscOptions.textBold ? 'font-weight: bold;' : ''}
					${mscOptions.textShadow ? 'text-shadow: +1px -1px rgb(200, 200, 200);' : ''}`,
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
		this._orientation = global.workspace_manager.layout_rows == -1
			? Clutter.Orientation.VERTICAL
			: Clutter.Orientation.HORIZONTAL;

		this.connect('style-changed', () => {
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
			let height = childNaturalHeight * workArea.width / workArea.height;

			if (this._orientation == Clutter.Orientation.HORIZONTAL)
				size += height * workArea.width / workArea.height;
			else
				size += height;
		}

		let workspaceManager = global.workspace_manager;
		let spacing = this._itemSpacing * (mscOptions.popupMode ? 0 : workspaceManager.n_workspaces - 1);
		size += spacing;
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

		if (this._orientation == Clutter.Orientation.HORIZONTAL) {
			this._childHeight = Math.round(this._childWidth * workArea.height / workArea.width);
			return [this._childHeight, this._childHeight];
		} else {
			this._childWidth = Math.round(this._childHeight * workArea.width / workArea.height);
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

/*
var WorkspaceIndicator = GObject.registerClass(
class WorkspaceIndicator extends St.Label {
	_init() {
		super._init({
		name: 'ws-index',
	          style_class: 'workspace-label',
	          reactive: false,
		});
		Main.uiGroup.add_actor(this);
		this._timeoutId = 0;
		this.WS_POPUP_MODE = mscOptions.customPopupMode;
		this.connect('destroy', this._onDestroy.bind(this));
	}

	display(direction, activeWorkspaceIndex) {
		if (mscOptions.popupMode === ws_popup_mode.DISABLE) {
			return false;
		}
		this.wsIndex = activeWorkspaceIndex;
		this._showIndicator();
	}

	_showIndicator() {
		let text = '';
		let wsName = '';
		let appName = '';

		this.opacity = 255;
		if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
		}

		if (this.WS_POPUP_MODE === custom_popup_mode.NAME ||
			this.WS_POPUP_MODE === custom_popup_mode.NAME_APP ||
			this.WS_POPUP_MODE === custom_popup_mode.INDEX_NAME
		) {
				const settings = this._getWsNamesSettings();
				const names = settings.get_strv('workspace-names');
				if (!text && names.length > this.wsIndex)
					wsName = names[this.wsIndex];
    	}
		if (this.WS_POPUP_MODE === custom_popup_mode.APP ||
			this.WS_POPUP_MODE === custom_popup_mode.NAME_APP ||
			this.WS_POPUP_MODE === custom_popup_mode.INDEX_APP
		) {
				const ws = global.workspaceManager.get_workspace_by_index(this.wsIndex);
					const win = AltTab.getWindows(ws)[0];
					if (win)
						appName = _getWindowApp(win).get_name();
		}

		if (this.WS_POPUP_MODE === custom_popup_mode.NAME) {
			text = wsName;
		}
		else if (this.WS_POPUP_MODE === custom_popup_mode.APP) {
			text = appName;
		}
		else if (this.WS_POPUP_MODE === custom_popup_mode.NAME_APP) {
			if (wsName) {
				text = wsName;
			}
			else if (appName) {
				text = appName;
			}
			if (appName && wsName) {
				text = `${wsName}\n${appName}`;
			}
		} else if (this.WS_POPUP_MODE === custom_popup_mode.INDEX_APP) {
			text = `${this.wsIndex + 1}\n${appName ? `${appName}`: _('Empty')}`;
		} else if (this.WS_POPUP_MODE === custom_popup_mode.INDEX_NAME) {
			if (wsName) {
				text = `${this.wsIndex + 1}\n${wsName}`;
			}
		}

		let fontSize = mscOptions.fontSize;
		if (!text) {
			fontSize = mscOptions.indexSize;
			text = `${this.wsIndex + 1}`;
		}

		const color = mscOptions.fontColor;
		const textShadow = 'text-shadow: +1px -1px rgb(200, 200, 200)'
		const shadow = mscOptions.textShadow;
		
		this.text = text;
		this.set_style(`font-size: ${fontSize}em; color: ${color}; ${shadow ? textShadow: ''}`);
		
		let geometry
		if (mscOptions.monitor === 0) {
			geometry = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
		} else {
			geometry = Main.layoutManager.getWorkAreaForMonitor(global.display.get_current_monitor());
		}
		let x = Math.floor(geometry.x + (geometry.width * mscOptions.popupHorizontal / 100) - (this.width / 2));
		if (x < geometry.x) {
			x = geometry.x;
		}
		else if (x + this.width > geometry.x + geometry.width) {
			x = geometry.x + geometry.width - this.width;
		}
		let y = Math.floor(geometry.y + (geometry.height * mscOptions.popupVertical / 100) - (this.height / 2));
		if (y < geometry.y) {
			y = geometry.y;
		}
		else if (y + this.height > geometry.y + geometry.height) {
			y = geometry.y + geometry.height - this.height;
		}
		this.x = x;
		this.y = y;
		if (this.width > geometry.width) {
			this.width = geometry.width;
		}

		if (DISPLAY_TIMEOUT !== 0) {
			this._timeoutId = GLib.timeout_add(
				GLib.PRIORITY_DEFAULT,
				DISPLAY_TIMEOUT,
				this._onTimeout.bind(this));
		}
	}

	_onDestroy() {
        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;
		this._wsNamesSettings = null;
    }

	_onTimeout() {
        GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;
        this.ease({
            opacity: 0.0,
            duration: mscOptions.fadeOutTime,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this.destroy(),
        });
        return GLib.SOURCE_REMOVE;
    }

	_getWsNamesSettings() {
		if (!this._wsNamesSettings) {
			this._wsNamesSettings = ExtensionUtils.getSettings(
						'org.gnome.desktop.wm.preferences');
		}
		return this._wsNamesSettings;
	}
});
*/