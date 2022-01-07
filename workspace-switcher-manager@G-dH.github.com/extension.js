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

let originalWsPopup;
let origNeighbor;
var DISPLAY_TIMEOUT;
let mscOptions;
const ws_popup_mode = {
    'DISABLE'   : 0,
    'DEFAULT'   : 1,
    'INDEX'     : 2,
    'NAME'      : 3,
    'APP'       : 4,
	'NAME_APP'  : 5,
	'INDEX_APP' : 6,
	'INDEX_NAME': 7,
};

function init() {
	ExtensionUtils.initTranslations();
	originalWsPopup = WorkspaceSwitcherPopup.WorkspaceSwitcherPopup;
	origNeighbor = Meta.Workspace.prototype.get_neighbor;
}

function enable() {
	mscOptions = new Settings.MscOptions();
	mscOptions.connect('changed', updateSettings);
	DISPLAY_TIMEOUT = mscOptions.popupTimeout;
	Meta.Workspace.prototype.get_neighbor = getNeighbour;
	updateMode();
}

function disable() {
	mscOptions.destroy();
	mscOptions = null;
	WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = originalWsPopup;
	Meta.Workspace.prototype.get_neighbor = origNeighbor;
}

//------------------------------------------------------------------------------

function updateSettings(settings, key) {
	if (key == 'mode')
		updateMode();
	else if (key == 'timeout')
		DISPLAY_TIMEOUT = mscOptions.popupTimeout;
}

function updateMode() {
	const mode = mscOptions.popupMode;
	if (mode === ws_popup_mode.DISABLE) {
		WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = WorkspaceSwitcherPopupCustom;
	} else if (mode === ws_popup_mode.DEFAULT) {
		WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = WorkspaceSwitcherPopupCustom;
	} else if (mode > ws_popup_mode.DEFAULT) {
		WorkspaceSwitcherPopup.WorkspaceSwitcherPopup = WorkspaceIndicator;
	}
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
	if (wraparound)
		return 0;
	else
		return activeIndex;
}

function indexUp(activeIndex) {
	const ignoreLast = mscOptions.wsSwitchIgnoreLast;
	const wraparound = mscOptions.wsSwitchWrap;
	if (activeIndex > 0) {
		return activeIndex - 1;
	}
	if (wraparound)
		return global.workspace_manager.n_workspaces - (ignoreLast ? 2 : 1);
	else
		return activeIndex;
}

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
		this.WS_POPUP_MODE = mscOptions.popupMode;
		this.connect('destroy', this._onDestroy.bind(this));
	}

	display(direction, activeWorkspaceIndex) {
		if (mscOptions.popupMode === ws_popup_mode.DISABLE)
			return false;
		this.wsIndex = activeWorkspaceIndex;
		this._showIndicator();
	}

	_showIndicator() {
		let text = '';
		let wsName = '';
		let appName = '';

		this.opacity = 255;
		if (this._timeoutId)
            GLib.source_remove(this._timeoutId);

		if (this.WS_POPUP_MODE === ws_popup_mode.NAME ||
			this.WS_POPUP_MODE === ws_popup_mode.NAME_APP ||
			this.WS_POPUP_MODE === ws_popup_mode.INDEX_NAME) {
				const settings = this._getWsNamesSettings();
				const names = settings.get_strv('workspace-names');
				if (!text && names.length > this.wsIndex)
					wsName = names[this.wsIndex];
    	}
		if (this.WS_POPUP_MODE === ws_popup_mode.APP ||
			this.WS_POPUP_MODE === ws_popup_mode.NAME_APP ||
			this.WS_POPUP_MODE === ws_popup_mode.INDEX_APP) {
				const ws = global.workspaceManager.get_workspace_by_index(this.wsIndex);
					const win = AltTab.getWindows(ws)[0];
					if (win)
						appName = this._getWindowApp(win).get_name();
		}

		if (this.WS_POPUP_MODE === ws_popup_mode.NAME)
			text = wsName;
		else if (this.WS_POPUP_MODE === ws_popup_mode.APP)
			text = appName;
		else if (this.WS_POPUP_MODE === ws_popup_mode.NAME_APP)
			if (wsName)
				text = wsName;
			else if (appName)
				text = appName;
			if (appName && wsName)
				text = `${wsName}\n${appName}`;
		else if (this.WS_POPUP_MODE === ws_popup_mode.INDEX_APP)
			text = `${this.wsIndex + 1}\n${appName}`;
		else if (this.WS_POPUP_MODE === ws_popup_mode.INDEX_NAME)
			text = `${this.wsIndex + 1}\n${wsName}`;

		let fontSize = mscOptions.fontSize;
		if (!text) {
			fontSize = mscOptions.indexSize;
			text = `${this.wsIndex + 1}`;
		}

		const color = mscOptions.fontColor;
		const textShadow = 'text-shadow: -2px -2px rgba(255,255,255,0.5)'
		const shadow = mscOptions.textShadow;
		
		this.text = text;
		this.set_style(`font-size: ${fontSize}em; color: ${color}; ${shadow ? textShadow: ''}`);
		
		let geometry
		if (mscOptions.monitor === 0)
			geometry = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
		else
			geometry = Main.layoutManager.getWorkAreaForMonitor(global.display.get_current_monitor());

		let x = Math.floor(geometry.x + (geometry.width * mscOptions.popupHorizontal / 100) - (this.width / 2));
		if (x < geometry.x)
			x = geometry.x;
		else if (x + this.width > geometry.x + geometry.width)
			x = geometry.x + geometry.width - this.width;
		let y = Math.floor(geometry.y + (geometry.height * mscOptions.popupVertical / 100) - (this.height / 2));
		if (y < geometry.y)
			y = geometry.y;
		else if (y + this.height > geometry.y + geometry.height)
			y = geometry.y + geometry.height - this.height;
		this.x = x;
		this.y = y;
		if (this.width > geometry.width)
			this.width = geometry.width;
		let timeout = mscOptions.popupTimeout;

		if (!timeout)
			timeout = 600;
		this._timeoutId = GLib.timeout_add(
				GLib.PRIORITY_DEFAULT,
				timeout,
				this._onTimeout.bind(this));
	}

	_onDestroy() {
        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;
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

	_getWindowApp(metaWindow) {
		let tracker = Shell.WindowTracker.get_default();
		return tracker.get_window_app(metaWindow);
	}
});

var WorkspaceSwitcherPopupCustom = GObject.registerClass(
class WorkspaceSwitcherPopupCustom extends WorkspaceSwitcherPopup.WorkspaceSwitcherPopup {
	_init(){
		super._init();

	}

	display(direction, activeWorkspaceIndex) {
		if (mscOptions.popupMode === ws_popup_mode.DISABLE)
			return;
        this._direction = direction;
        this._activeWorkspaceIndex = activeWorkspaceIndex;

        this._redisplay();
        if (this._timeoutId != 0)
            GLib.source_remove(this._timeoutId);
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DISPLAY_TIMEOUT, this._onTimeout.bind(this));
        GLib.Source.set_name_by_id(this._timeoutId, '[gnome-shell] this._onTimeout');

		this.opacity = Math.floor(mscOptions.defaultPopupOpacity / 100 * 255);

		const popSize = mscOptions.defaultPopupSize / 100;

		if (this._contRadius === undefined) {
			const listThemeNode = this._list.get_theme_node();
			const listSpacing = listThemeNode.get_length('spacing');
			// roundness adjust only for scaled down popups
			this._listSpacing = Math.min(Math.max(Math.floor(listSpacing * popSize), 6), listSpacing);

			const contRadius = this._container.get_theme_node().get_length('border-radius');
			this._contRadius = Math.max(Math.floor(contRadius * popSize), 4);
			// I wasn't successful to get original padding for the _container, so I use _list spacing as it's usually the similar value
			this._contPadding = Math.max(this._listSpacing, 4);
		}

		/*
		  possible tweaks:
		  this._container: 	background-color
		  					border-radius

		*/
		this._list.set_style(`spacing: ${this._listSpacing}px;`);
		this._container.set_style(`padding: ${this._contPadding}px; border-radius: ${this._contRadius}px;`);
		const children = this._list.get_children();
		children.forEach(c => {
			if (this._boxRadius === undefined) {
				const theme = c.get_theme_node();
				this._boxRadius = Math.max(Math.floor(theme.get_length('border-radius') * popSize), 3);
				this._boxHeight = Math.floor(theme.get_height() * popSize);
				this._boxBgSize = Math.floor(theme.get_length('background-size') * popSize);

			}
			
			c.set_style(`height: ${this._boxHeight}px; background-size: ${this._boxBgSize}px; border-radius: ${this._boxRadius}px;`);
		});
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
            else
                indicator = new St.Bin({ style_class: 'ws-switcher-box' });

            this._list.add_actor(indicator);
        }
    }

	_setPopupPosition() {
		let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
		let [, containerNatHeight] = this._container.get_preferred_height(global.screen_width);
		let [, containerNatWidth] = this._container.get_preferred_width(containerNatHeight);
		let h_percent = mscOptions.popupHorizontal;
		let v_percent = mscOptions.popupVertical;
		this._container.x = workArea.x + Math.floor((workArea.width - containerNatWidth - this._contPadding) * (h_percent/100));
		this._container.y = workArea.y + Math.floor((workArea.height - containerNatHeight - this._contPadding) * (v_percent/100));
	}
});
