// Workspace Switcher Manager
// GPL v3 ©G-dH@Github.com
'use strict';

const { Gtk, GLib, GObject } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.settings;

let mscOptions;
let wsEntries = [];

// gettext
const _  = Settings._;


function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
    mscOptions = new Settings.MscOptions();
}

function buildPrefsWidget() {
    const optionsPage = new Gtk.Notebook({
        tab_pos: Gtk.PositionType.TOP,
        visible: true,
    });



    const generalOptionsPage    = new OptionsPageWSPM(_getGeneralOptionsList());
    const appearanceOptionsPage = new OptionsPageWSPM(_getAppearanceOptionsList());
    const contentOptionsPage    = new OptionsPageWSPM(_getContentOptionsList());
    const workspacesOptionsPage = new OptionsPageWSPM(_getWorkspacesOptionsList());

    optionsPage.append_page(generalOptionsPage, new Gtk.Label({
        label: _('General'),
        halign: Gtk.Align.START,
        visible: true,
    }));

        optionsPage.append_page(appearanceOptionsPage, new Gtk.Label({
            label: _('Popup Appearance'),
            halign: Gtk.Align.START,
            visible: true,
        }));

    optionsPage.append_page(contentOptionsPage, new Gtk.Label({
        label: _('Popup Content'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    optionsPage.append_page(workspacesOptionsPage, new Gtk.Label({
        label: _('Workspace Names'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    /*optionsPage.connect('switch-page', (ntb, page, index) => {
        switch (page) {
        case generalOptionsPage:
            mscOptions.activePrefsPage = 'general'
            break;
        case contentOptionsPage:
            mscOptions.activePrefsPage = 'defaultPopup';
            break;
        case appearanceOptionsPage:
            mscOptions.activePrefsPage = 'customPopup';
            break;
        default:
            mscOptions.activePrefsPage = '';
        }
    });*/

    return optionsPage;
}

function _getGeneralOptionsList() {
    const optionsList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Popup Behavior')),
        )
    );
    //-----------------------------------------------------	
    optionsList.push(
		_optionsItem(
			_('Workspace Switcher Popup Mode'),
            null,
            _newComboBox(),
            'popupMode',
            [[_('Show All Workspaces'), 0],
             [_('Show Active Workspace Only'), 1],
             [_('Disable'), 2]]
		)
	);
    //-----------------------------------------------------
    optionsList.push(
		_optionsItem(
			_('Monitor'),
            _('The monitor on which the workspace popup should appear. The Current monitor is determined by the mouse pointer position.'),
            _newComboBox(),
            'monitor',
		   [[_('Primary'), 0],
			[_('Current'), 1]]
		)
	);
//-----------------------------------------------------
	let popupTimeoutAdjustment = new Gtk.Adjustment({
        upper: 2000,
        lower: 0,
        step_increment: 10,
        page_increment: 100,
    });

    const tScale = _newScale(popupTimeoutAdjustment);
    tScale.add_mark(600, Gtk.PositionType.TOP, null);

    optionsList.push(
        _optionsItem(
            _('Popup Duration (ms)'),
            _("Time after which the popup fade out"),
            tScale,
            'popupTimeout'
        )
    );
    //-----------------------------------------------------
    let fadeOutAdjustment = new Gtk.Adjustment({
        upper: 1500,
        lower: 10,
        step_increment: 10,
        page_increment: 100,
    });

    const fadeScale = _newScale(fadeOutAdjustment);
    fadeScale.add_mark(500, Gtk.PositionType.TOP, null);

    optionsList.push(
        _optionsItem(
            _('Fade Out Time (ms)'),
            _('Durarion of fade out animation.'),
            fadeScale,
            'fadeOutTime'
        )
    );
    //-----------------------------------------------------
	optionsList.push(
        _optionsItem(
            _(`Display until modifier keys released`),
            _('Keeps the popup on the screen until modifier keys (Shift, Ctrl, Super, Alt) are released. Similar as Alt-Tab switcher works.'),
            _newGtkSwitch(),
            'modifiersHidePopup'
        )
    );
//-----------------------------------------------------

	optionsList.push(
		_optionsItem(
			_makeTitle(_('Popup Position')),
		)
	);
//-----------------------------------------------------
	const hAdjustment = new Gtk.Adjustment({
		lower: 0,
		upper: 100,
		step_increment: 1,
		page_increment: 10,
	});

    const hScale = _newScale(hAdjustment);
    hScale.add_mark(50, Gtk.PositionType.TOP, null);

	optionsList.push(
        _optionsItem(
            _('Horizontal (% from left)'),
            null,
            hScale,
            'popupHorizontal',
        )
    );
//-----------------------------------------------------
	const vAdjustment = new Gtk.Adjustment({
		lower: 0,
		upper: 100,
		step_increment: 1,
		page_increment: 10,
	});

    const vScale = _newScale(vAdjustment);
    vScale.add_mark(50, Gtk.PositionType.TOP, null);
	optionsList.push(
        _optionsItem(
            _('Vertical (% from top)'),
            null,
            vScale,
            'popupVertical',
        )
    );
    //-----------------------------------------------------
    optionsList.push(
        _optionsItem(
            _('Reverse Orientation'),
            _('Draw the switcher popup vertically instead of horizontaly and vice versa.'),
            _newGtkSwitch(),
            'reversePopupOrientation'
        )
    );
    //-----------------------------------------------------
    optionsList.push(
        _optionsItem(
            _makeTitle(_('Switcher')),
        )
    );
    //-----------------------------------------------------
    optionsList.push(
		_optionsItem(
			_('Switcher Mode'),
            _(`Dynamic - workspaces can be created on demand, and are automaticaly removed when empty\n
Static - number of workspaces is fixed, and you can set the number below\n
This option is backed by internal GNOME gsettings key and can be modified by other applications.`),
            _newComboBox(),
            'switcherMode',
		   [[_('Dynamic'), 0],
			[_('Static'),  1]]
		)
	);
    //-----------------------------------------------------
    const numAdjustment = new Gtk.Adjustment({
		lower: 1,
		upper: 36,
		step_increment: 1,
		page_increment: 5,
	});

    const numScale = _newScale(numAdjustment);
    numScale.add_mark(6, Gtk.PositionType.TOP, null);

    optionsList.push(
        _optionsItem(
            _('Number of workspaces for Static mode.'),
            _('Max number of 36 is given by GNOME. This option is backed by internal GNOME gsettings key and can be modified by other applications.'),
            numScale,
            'numWorkspaces'
        )
    );
    //-----------------------------------------------------
	optionsList.push(
        _optionsItem(
            _('Wraparound'),
            _('Whether the switcher should continue from the last workspace to the first one and vice versa.'),
            _newGtkSwitch(),
            'wsSwitchWrap'
        )
    );
    //-----------------------------------------------------
    optionsList.push(
        _optionsItem(
            _('Ignore last (empty) workspace'),
            null,
            _newGtkSwitch(),
            'wsSwitchIgnoreLast'
        )
    );

    return optionsList;
}
// ////////////////////////////////////////////////

function _getContentOptionsList() {
	const optionsList = [];

    optionsList.push(
		_optionsItem(
			_makeTitle(_('Active Workspace Identifiers')),
		)
	);
    //-----------------------------------------------------
    optionsList.push(
        _optionsItem(
             _('Show Workspace Index'),
             _('Highlighted active workspace indicator will show its index.'),
             _newGtkSwitch(),
             'activeShowWsIndex'
         )
     );
    //-----------------------------------------------------
    optionsList.push(
       _optionsItem(
            _('Show Workspace Name'),
            _('Highlighted active workspace indicator will show workspace name if the name is set.'),
            _newGtkSwitch(),
            'activeShowWsName'
        )
    );
    //-----------------------------------------------------
    optionsList.push(
        _optionsItem(
            _('Show Active App Name'),
            _('Highlighted active workspace indicator will show a name of the last used application on active workspace.'),
            _newGtkSwitch(),
            'activeShowAppName'
         )
     );

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++
    optionsList.push(
		_optionsItem(
			_makeTitle(_('Inactive Workspace Identifiers')),
		)
	);
    //-----------------------------------------------------
    optionsList.push(
        _optionsItem(
             _('Show Workspace Index'),
             _('Highlighted active workspace indicator will show its index.'),
             _newGtkSwitch(),
             'inactiveShowWsIndex'
         )
     );
    //-----------------------------------------------------
    optionsList.push(
       _optionsItem(
            _('Show Workspace Name'),
            _('Highlighted active workspace indicator will show workspace name if the name is set.'),
            _newGtkSwitch(),
            'inactiveShowWsName'
        )
    );
    //-----------------------------------------------------
    optionsList.push(
        _optionsItem(
            _('Show Active App Name'),
            _('Highlighted active workspace indicator will show a name of the last used application on active workspace.'),
            _newGtkSwitch(),
            'inactiveShowAppName'
         )
     );

    return optionsList;
}

// ////////////////////////////////////////////////

function _getAppearanceOptionsList() {
	const optionsList = [];

 	optionsList.push(
		_optionsItem(
			_makeTitle(_('Size')),
			null
		)
	);
    //-----------------------------------------------------
    let dpSizeAdjustment = new Gtk.Adjustment({
        upper: 1000,
        lower: 10,
        step_increment: 5,
        page_increment: 10,
    });

    const dpSize = _newScale(dpSizeAdjustment);
    dpSize.add_mark(100, Gtk.PositionType.TOP, null);

    optionsList.push(
        _optionsItem(
            _('Scale (%)'),
            _("Sets the size of the popup relative to the original."),
            dpSize,
            'defaultPopupSize'
        )
    );
    //-----------------------------------------------------
    optionsList.push(
		_optionsItem(
			_makeTitle(_('Text')),
			null
		)
	);
    //-----------------------------------------------------
	const fontSizeAdjustment = new Gtk.Adjustment({
		lower: 50,
		upper: 300,
		step_increment: 1,
		page_increment: 10,
	});

    const fsScale = _newScale(fontSizeAdjustment);
    fsScale.add_mark(100, Gtk.PositionType.TOP, null);

    optionsList.push(
        _optionsItem(
            _('Font Scale Finetune (%)'),
            _('Size resizes acording to the popup sclae, use this scale to precisely adjust the text size.'),
            fsScale,
            'fontSize',
        )
    );
    //-----------------------------------------------------
    const idxSizeAdjustment = new Gtk.Adjustment({
		lower: 50,
		upper: 500,
		step_increment: 1,
		page_increment: 10,
	});

    const idxScale = _newScale(idxSizeAdjustment);
    idxScale.add_mark(100, Gtk.PositionType.TOP, null);

    optionsList.push(
        _optionsItem(
            _('Index Scale Finetune (%)'),
            _('If only "Show Workspace Index" text content option is active, this scale takes effect. Single digit always looks smaller then longer text with the same font size.'),
            idxScale,
            'indexSize',
        )
    );
     //-----------------------------------------------------
    optionsList.push(
        _optionsItem(
            _('Text Shadow'),
            _('Shadow helps text visibility on the background with the similar color.'),
            _newGtkSwitch(),
            'textShadow'
        )
    );
    //-----------------------------------------------------
    optionsList.push(
        _optionsItem(
            _('Text Weight Bold'),
            null,
            _newGtkSwitch(),
            'textBold'
        )
    );
    //++++++++++++++++++++++++++++++++++++++++++++++++++++
    optionsList.push(
		_optionsItem(
			_makeTitle(_('Colors')),
			null
		)
	);
    //-----------------------------------------------------
    const opacityAdjustment = new Gtk.Adjustment({
		lower: 10,
		upper: 100,
		step_increment: 1,
		page_increment: 10,
	});

    const opacityScale = _newScale(opacityAdjustment);
    opacityScale.add_mark(90, Gtk.PositionType.TOP, null);

    optionsList.push(
        _optionsItem(
            _('Global Opacity'),
            null,
            opacityScale,
            'defaultPopupOpacity',
        )
    );
    //-----------------------------------------------------
    const bgColorBox = _newColorButtonBox();
    const bgColorBtn = _newColorButton();
    const bgColorReset = _newColorResetBtn(0, bgColorBtn);
    bgColorBox.colorBtn = bgColorBtn;
    bgColorBtn._gsettingsVar = 'defaultPopupBgColor';

    bgColorBox[bgColorBox.add ? 'add' : 'append'](bgColorBtn);
    bgColorBox[bgColorBox.add ? 'add' : 'append'](bgColorReset);

	optionsList.push(
        _optionsItem(
            _('Background color / opacity'),
            null,
            bgColorBox,
            'defaultPopupBgColor',
        )
    );
    //-----------------------------------------------------
    const borderColorBox = _newColorButtonBox();
    const borderColorBtn = _newColorButton();
    const borderColorReset = _newColorResetBtn(1, borderColorBtn);
    borderColorBox.colorBtn = borderColorBtn;
    borderColorBtn._gsettingsVar = 'defaultPopupBorderColor';

    borderColorBox[borderColorBox.add ? 'add' : 'append'](borderColorBtn);
    borderColorBox[borderColorBox.add ? 'add' : 'append'](borderColorReset);

	optionsList.push(
        _optionsItem(
            _('Border color / opacity'),
            null,
            borderColorBox,
            'defaultPopupBorderColor',
        )
    );
    //-----------------------------------------------------
    const activeFgColorBox = _newColorButtonBox();
    const activeFgColorBtn = _newColorButton();
    const activeFgColorReset = _newColorResetBtn(2, activeFgColorBtn);
    activeFgColorBox.colorBtn = activeFgColorBtn;
    activeFgColorBtn._gsettingsVar = 'defaultPopupActiveFgColor';

    activeFgColorBox[activeFgColorBox.add ? 'add' : 'append'](activeFgColorBtn);
    activeFgColorBox[activeFgColorBox.add ? 'add' : 'append'](activeFgColorReset);

	optionsList.push(
        _optionsItem(
            _('Active WS Foreground color / opacity'),
            _('Text and other active workspace box overlays'),
            activeFgColorBox,
            'defaultPopupActiveFgColor',
        )
    );
    //-----------------------------------------------------
    const activeBgColorBox = _newColorButtonBox();
    const activeBgColorBtn = _newColorButton();
    const activeBgColorReset = _newColorResetBtn(3, activeBgColorBtn);
    activeBgColorBox.colorBtn = activeBgColorBtn;
    activeBgColorBtn._gsettingsVar = 'defaultPopupActiveBgColor';

    activeBgColorBox[activeBgColorBox.add ? 'add' : 'append'](activeBgColorBtn);
    activeBgColorBox[activeBgColorBox.add ? 'add' : 'append'](activeBgColorReset);

	optionsList.push(
        _optionsItem(
            _('Active WS Background color  / opacity'),
            null,
            activeBgColorBox,
            'defaultPopupActiveBgColor',
        )
    );

//-----------------------------------------------------
    return optionsList;
}

///////////////////////////////////////////////////

function _getWorkspacesOptionsList() {
	const optionsList = [];

	optionsList.push(
		_optionsItem(
			_makeTitle(_('Names')),
			_('Uses official GNOME gsettings key which can be read/modified by other applications.')
		)
	);

	optionsList.push(
		_optionsItem(
			_('Workspace 1'),
			null,
			_newGtkEntry(),
			'wsNames',
			1
		)
	);

	optionsList.push(
		_optionsItem(
			_('Workspace 2'),
			null,
			_newGtkEntry(),
			'wsNames',
			2
		)
	);
	
	optionsList.push(
		_optionsItem(
			_('Workspace 3'),
			null,
			_newGtkEntry(),
			'wsNames',
			3
		)
	);

	optionsList.push(
		_optionsItem(
			_('Workspace 4'),
			null,
			_newGtkEntry(),
			'wsNames',
			4
		)
	);

	optionsList.push(
		_optionsItem(
			_('Workspace 5'),
			null,
			_newGtkEntry(),
			'wsNames',
			5
		)
	);

	optionsList.push(
		_optionsItem(
			_('Workspace 6'),
			null,
			_newGtkEntry(),
			'wsNames',
			6
		)
	);

	optionsList.push(
		_optionsItem(
			_('Workspace 7'),
			null,
			_newGtkEntry(),
			'wsNames',
			7
		)
	);

	optionsList.push(
		_optionsItem(
			_('Workspace 8'),
			null,
			_newGtkEntry(),
			'wsNames',
			8
		)
	);

	optionsList.push(
		_optionsItem(
			_('Workspace 9'),
			null,
			_newGtkEntry(),
			'wsNames',
			9
		)
	);

	optionsList.push(
		_optionsItem(
			_('Workspace 10'),
			null,
			_newGtkEntry(),
			'wsNames',
			10
		)
	);

    return optionsList;
}


///////////////////////////////////////////////////

const OptionsPageWSPM = GObject.registerClass(
class OptionsPageWSPM extends Gtk.ScrolledWindow {
    _init(optionList, widgetPropetrties = {
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.NEVER,
        vexpand: true,
        hexpand: true,
    }) {
        super._init(widgetPropetrties);

        this.optionList = optionList;
        this._alreadyBuilt = false;
        this.buildPage();
    }

    buildPage() {
        if (this._alreadyBuilt)
            return;

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5,
            homogeneous: false,
            margin_start: 15,
            margin_end: 15,
            margin_top: 12,
            margin_bottom: 12,
            visible: true,
        });

        let frame;
        let frameBox;
        for (let item of this.optionList) {
            // new section
            if (!item[0][1]) {
                let lbl = new Gtk.Label({
                    xalign: 0,
                    visible: true
                });
                lbl.set_markup(item[0][0]);
                if (item[1])
                    lbl.set_tooltip_text(item[1]);
                mainBox[mainBox.add ? 'add' : 'append'](lbl);
                frame = new Gtk.Frame({
                    visible: true,
                    margin_bottom: 10,
                });
                frameBox = new Gtk.ListBox({
                    selection_mode: null,
                    visible: true,
                });
                mainBox[mainBox.add ? 'add' : 'append'](frame);
                frame[frame.add ? 'add' : 'set_child'](frameBox);
                continue;
            }
            let box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
				homogeneous: true,
                margin_start: 4,
                margin_end: 4,
                margin_top: 4,
                margin_bottom: 4,
                hexpand: true,
                spacing: 20,
                visible: true,
            });
            for (let i of item[0])
                box[box.add ? 'add' : 'append'](i);
            if (item.length === 2)
                box.set_tooltip_text(item[1]);
            frameBox[frameBox.add ? 'add' : 'append'](box);
        }
        this[this.add ? 'add' : 'set_child'](mainBox);

        this.show_all && this.show_all();
        this._alreadyBuilt = true;
    }
});

function _newGtkSwitch() {
    let sw = new Gtk.Switch({
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true,
        visible: true,
    });
    sw.is_switch = true;
    return sw;
}

function _newSpinButton(adjustment) {
    let spinButton = new Gtk.SpinButton({
        halign: Gtk.Align.END,
        hexpand: true,
        xalign: 0.5,
        visible: true,
    });
    spinButton.set_adjustment(adjustment);
    spinButton.is_spinbutton = true;
    return spinButton;
}

function _newComboBox() {
    const model = new Gtk.ListStore();
    model.set_column_types([GObject.TYPE_STRING, GObject.TYPE_INT]);
    const comboBox = new Gtk.ComboBox({
        model,
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true,
        visible: true,
    });
    const renderer = new Gtk.CellRendererText();
    comboBox.pack_start(renderer, true);
    comboBox.add_attribute(renderer, 'text', 0);
    comboBox.is_combo_box = true;
    return comboBox;
}

function _newGtkEntry() {
    const entry = new Gtk.Entry({
        visible: true,
        width_chars: 30,
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true,
        xalign: 0,
    });
    entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'edit-clear-symbolic');
    entry.set_icon_activatable(Gtk.EntryIconPosition.SECONDARY, true);
    entry.connect('icon-press', (e) => e.set_text(''));
    entry.is_entry = true;
    return entry;
}

function _newScale(adjustment) {
	const scale = new Gtk.Scale({
		visible:     true,
		orientation: Gtk.Orientation.HORIZONTAL,
		draw_value:  true,
		has_origin:  false,
		value_pos:   Gtk.PositionType.LEFT,
		digits:      0,
		halign:      Gtk.Align.FILL,
		valign:      Gtk.Align.CENTER,
		hexpand:     true,
		vexpand:     false,
	});
    scale.set_adjustment(adjustment);
	scale.is_scale = true;
	return scale;
}

function _newColorButton() {
    const colorBtn = new Gtk.ColorButton({
        hexpand: true,
    });
	colorBtn.set_use_alpha(true);
    colorBtn.is_color_btn = true;

    return colorBtn;
}

function _newColorResetBtn(colIndex, colorBtn) {
    const colorReset = new Gtk.Button({
        hexpand: false,
        halign: Gtk.Align.END,
    });
    colorReset.set_tooltip_text(_('Reset color to default value'));
    if (colorReset.set_icon_name) {
        colorReset.set_icon_name('edit-clear-symbolic');
    } else {
        colorReset.add(Gtk.Image.new_from_icon_name('edit-clear-symbolic', Gtk.IconSize.BUTTON));
    }
    colorReset.connect('clicked', () =>{
        let color = mscOptions.defaultColors[colIndex];
        const rgba = colorBtn.get_rgba();
		rgba.parse(color);
        colorBtn.set_rgba(rgba);
        mscOptions[colorBtn._gsettingsVar] = rgba.to_string();
    });

    return colorReset;
}

function _newColorButtonBox() {
    const box = new Gtk.Box({
        hexpand: true,
        spacing: 4,
    });

    box.is_color_box = true;
    return box;
}

function _optionsItem(text, tooltip, widget, variable, options = []) {
    let item = [[]];
    let label;
    if (widget) {
        label = new Gtk.Label({
            halign: Gtk.Align.START,
            visible: true,
        });
        label.set_markup(text);
    } else {
        label = text;
    }
    item[0].push(label);
    if (widget)
        item[0].push(widget);
    if (tooltip)
        item.push(tooltip);

    if (widget && widget.is_switch) {
        widget.active = mscOptions[variable];
        widget.connect('notify::active', () => {
            mscOptions[variable] = widget.active;
        });
    } else if (widget && widget.is_spinbutton) {
        widget.value = mscOptions[variable];
        widget.timeout_id = null;
        widget.connect('value-changed', () => {
            widget.update();
            if (widget.timeout_id)
                GLib.Source.remove(widget.timeout_id);

            widget.timeout_id = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                500,
                () => {
                    mscOptions[variable] = widget.value;
                    widget.timeout_id = null;
                    return 0;
                }
            );
        });
    } else if (widget && widget.is_combo_box) {
        let model = widget.get_model();
        for (const [label, value] of options) {
            let iter;
            model.set(iter = model.append(), [0, 1], [label, value]);
            if (value === mscOptions[variable])
                widget.set_active_iter(iter);
        }
        widget.connect('changed', () => {
            const [success, iter] = widget.get_active_iter();
            if (!success)
                return;

            mscOptions[variable] = model.get_value(iter, 1);
        });
    } else if (widget && widget.is_entry) {
		if (options) {
			const names = mscOptions[variable];
			if (names[options-1])
				widget.set_text(names[options - 1]);

			widget.set_placeholder_text(_('workspace name'));

 			widget.connect('changed', (entry) => {
                if (entry._timeout_id)
                   GLib.source_remove(entry._timeout_id);
                entry._timeout_id = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    400,
                    () => {
                        const names = [];
				        wsEntries.forEach(entry => {
					    if (entry.text)
						    names.push(entry.get_text());
				        })
				        mscOptions.wsNames = names;
                        entry._timeout_id = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                )
			});
			wsEntries.push(widget);
		}
    } else if (widget && widget.is_scale) {
		widget.set_value(mscOptions[variable]);
        widget.connect('value-changed', (w) => {
            if (w._timeout_id)
                GLib.source_remove(w._timeout_id);
            w._timeout_id = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                300,
                () => {
                    mscOptions[variable] = w.get_value();
                    w._timeout_id = 0;
                    return GLib.SOURCE_REMOVE;
                }
            )
		});
	} else if (widget && (widget.is_color_btn || widget.is_color_box)) {
        let colorBtn;
        if (widget.is_color_box) {
            colorBtn = widget.colorBtn;
        } else {
            colorBtn = widget;
        }
		const rgba = colorBtn.get_rgba();
		rgba.parse(mscOptions[variable]);
		colorBtn.set_rgba(rgba);
		colorBtn.connect('color_set', () => {
			mscOptions[variable] = `${colorBtn.get_rgba().to_string()}`;
		});
	}

    return item;
}

/* function _makeSmall(label) {
    return `<small>${label}</small>`;
} */

function _makeTitle(label) {
    return `<b>${label}</b>`;
}
