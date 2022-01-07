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


    const commonOptionsPage = new OptionsPageWSPM(_getCommonOptionsList());
    const defaultPopupOptionsPage = new OptionsPageWSPM(_getDefaultOptionsList());
	const customPopupOptionsPage = new OptionsPageWSPM(_getCustomPopupOptionsList());
    const workspacesOptionsPage = new OptionsPageWSPM(_getWorkspacesOptionsList());

    optionsPage.append_page(commonOptionsPage, new Gtk.Label({
        label: _('Common'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    optionsPage.append_page(defaultPopupOptionsPage, new Gtk.Label({
        label: _('Default Popup'),
        halign: Gtk.Align.START,
        visible: true,
    }));

	optionsPage.append_page(customPopupOptionsPage, new Gtk.Label({
        label: _('Custom Popup'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    optionsPage.append_page(workspacesOptionsPage, new Gtk.Label({
        label: _('Workspaces'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    return optionsPage;
}

function _getCommonOptionsList() {
    const optionsList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Behavior')),
        )
    );
	
    optionsList.push(
		_optionsItem(
			_('Workspace Switcher Popup Mode'),
            null,
            _newComboBox(),
            'popupMode',
		   [[_('Disable'),            0],
			[_('Default'),            1],
			[_('Index'),              2],
			[_('WS Name'),            3],
			[_('App Name'),           4],
            [_('WS Name + App Name'), 5],
            [_('Index + App Name'),   6],
            [_('Index + WS Name'),    7],]
		)
	);

    optionsList.push(
		_optionsItem(
			_('Monitor'),
            _('The monitor on which the workspace popup should appear. The Current monitor is determined by mouse pointer'),
            _newComboBox(),
            'monitor',
		   [[_('Primary'),          0],
			[_('Current'),          1]]
		)
	);

	optionsList.push(
        _optionsItem(
            _('Wraparound'),
            _('Whether the switcher should continue from the last workspace to the first one and vice versa.'),
            _newGtkSwitch(),
            'wsSwitchWrap'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Ignore last (empty) workspace'),
            null,
            _newGtkSwitch(),
            'wsSwitchIgnoreLast'
        )
    );

	let popupTimeoutAdjustment = new Gtk.Adjustment({
        upper: 2000,
        lower: 10,
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

    //--------------------------------------------------------

	optionsList.push(
		_optionsItem(
			_makeTitle(_('Position')),
		)
	);

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

    return optionsList;
}
// ////////////////////////////////////////////////

function _getDefaultOptionsList() {
	const optionsList = [];

	optionsList.push(
		_optionsItem(
			_makeTitle(_('Appearance')),
			null
		)
	);

    let dpSizeAdjustment = new Gtk.Adjustment({
        upper: 70,
        lower: 10,
        step_increment: 5,
        page_increment: 10,
    });

    const dpSize = _newScale(dpSizeAdjustment);
    dpSize.add_mark(50, Gtk.PositionType.TOP, null);

    optionsList.push(
        _optionsItem(
            _('Popup Size'),
            _("Sets a height of popup's single workspace box."),
            dpSize,
            'defaultPopupSize'
        )
    );

    const opacityAdjustment = new Gtk.Adjustment({
		lower: 10,
		upper: 100,
		step_increment: 10,
		page_increment: 40,
	});

    const opacityScale = _newScale(opacityAdjustment);
    opacityScale.add_mark(90, Gtk.PositionType.TOP, null);

    optionsList.push(
        _optionsItem(
            _('Opacity'),
            null,
            opacityScale,
            'defaultPopupOpacity',
        )
    );

    return optionsList;
}

// ////////////////////////////////////////////////

function _getCustomPopupOptionsList() {
	const optionsList = [];

	optionsList.push(
		_optionsItem(
			_makeTitle(_('Appearance')),
		)
	);

	const fontSizeAdjustment = new Gtk.Adjustment({
		lower: 1,
		upper: 30,
		step_increment: 1,
		page_increment: 5,
	});

    const fsScale = _newScale(fontSizeAdjustment);
    fsScale.add_mark(10, Gtk.PositionType.TOP, null);

    optionsList.push(
        _optionsItem(
            _('Font Size (em)'),
            _('Size for all modes except "Index".'),
            fsScale,
            'fontSize',
        )
    );

    const idxSizeAdjustment = new Gtk.Adjustment({
		lower: 1,
		upper: 30,
		step_increment: 1,
		page_increment: 5,
	});

    const idxScale = _newScale(idxSizeAdjustment);
    idxScale.add_mark(15, Gtk.PositionType.TOP, null);

    optionsList.push(
        _optionsItem(
            _('Index Size (em)'),
            _('Size for "Index mode".'),
            idxScale,
            'indexSize',
        )
    );

	const colorBtn = new Gtk.ColorButton();
	colorBtn.set_use_alpha(true);
	colorBtn.is_color_btn = true;


	optionsList.push(
        _optionsItem(
            _('Color / Opacity'),
            null,
            colorBtn,
            'fontColor',
        )
    );

    optionsList.push(
        _optionsItem(
            _('Text Shadow'),
            _('Shadow helps text visibility on the background with the similar color.'),
            _newGtkSwitch(),
            'textShadow'
        )
    );

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

			widget.set_placeholder_text(_('index'));

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
	} else if (widget && widget.is_color_btn) {
		const rgba = widget.get_rgba();
		rgba.parse(mscOptions[variable]);
		widget.set_rgba(rgba);
		widget.connect('color_set', () => {
			mscOptions[variable] = `${widget.get_rgba().to_string()}`;
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
