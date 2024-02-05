/**
 * Workspaces Switcher Manager
 * prefs.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022-2024
 * @license    GPL-3.0
 */
'use strict';

const { Adw, Gtk, GLib, Gio, GObject } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.settings;

// gettext
let _;
let opt;
let _wsEntries;

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

function fillPreferencesWindow(window) {
    const wsm = new WSM();
    wsm.fillPreferencesWindow(window);
}

class WSM {
    fillPreferencesWindow(window) {
        this.metadata = Me.metadata;
        opt = new Me.imports.settings.Options(Me);
        _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;

        _wsEntries = [];
        this._prevPopupMode = -1;

        const GENERAL_TITLE = _('General');
        const GENERAL_ICON = 'preferences-system-symbolic';
        const POPUP_TITLE = _('Pop-up');
        const POPUP_ICON = 'user-available-symbolic';
        const SIZE_TEXT_TITLE = _('Size & Text');
        const SIZE_TEXT_ICON = 'view-fullscreen-symbolic';
        const COLORS_TITLE = _('Colors');
        const COLORS_ICON = 'applications-graphics-symbolic';
        const CONTENT_TITLE = _('Content');
        const CONTENT_ICON = 'view-reveal-symbolic';
        const WS_TITLE = _('Workspaces');
        const WS_ICON = 'text-editor-symbolic';
        const PRESETS_TITLE = _('Presets');
        const PRESET_ICON = 'view-list-bullet-symbolic';
        const ABOUT_TITLE = _('About');
        const ABOUT_ICON = 'preferences-system-details-symbolic';

        const generalOptionsPage = getAdwPage(_getGeneralOptionList(), {
            title: GENERAL_TITLE,
            icon_name: GENERAL_ICON,
        });

        const popupOptionsPage = getAdwPage(_getPopupOptionList(), {
            title: POPUP_TITLE,
            icon_name: POPUP_ICON,
        });

        const aboutPage = getAboutPage({
            title: ABOUT_TITLE,
            icon_name: ABOUT_ICON,
        }, this.metadata);

        window.add(generalOptionsPage);
        window.add(popupOptionsPage);

        this._customPages = [
            getAdwPage(_getSizeTextOptionList(), {
                title: SIZE_TEXT_TITLE,
                icon_name: SIZE_TEXT_ICON,
            }),
            getAdwPage(_getColorOptionList(), {
                title: COLORS_TITLE,
                icon_name: COLORS_ICON,
            }),
            getAdwPage(_getContentOptionList(), {
                title: CONTENT_TITLE,
                icon_name: CONTENT_ICON,
            }),
            getAdwPage(_getWorkspacesOptionList(), {
                title: WS_TITLE,
                icon_name: WS_ICON,
            }),
            getAdwPage(_getPresetsOptionList(), {
                title: PRESETS_TITLE,
                icon_name: PRESET_ICON,
            }),
            aboutPage,
        ];

        window.set_search_enabled(true);

        this._windowWidget = window;
        this._updateAdwActivePages();

        opt.connect('changed::popup-mode', this._updateAdwActivePages.bind(this));
        window.connect('close-request', this._onDestroy.bind(this));

        const height = 700;
        window.set_default_size(-1, height);

        return window;
    }

    _onDestroy() {
        this._prevPopupMode = -1;
        opt.destroy();
        opt = null;
        this._customPages = null;
        _wsEntries = null;
        this._windowWidget = null;
    }

    _updateAdwActivePages() {
        const mode = opt.get('popupMode');
        if (this._shouldUpdatePages(mode)) {
            if (this._prevPopupMode !== -1)
                this._windowWidget.remove(this._customPages[this._customPages.length - 1]);
            for (let i = 0; i < this._customPages.length - 1; i++) {
                if (mode < 2)
                    this._windowWidget.add(this._customPages[i]);
                else if (this._prevPopupMode !== -1)
                    this._windowWidget.remove(this._customPages[i]);
            }
            // always add about page
            this._windowWidget.add(this._customPages[this._customPages.length - 1]);
        }
        this._prevPopupMode = mode;
    }

    _shouldUpdatePages(mode) {
        if ((this._prevPopupMode > 1 && mode < 2) || ([0, 1].includes(this._prevPopupMode) && mode > 1) || this._prevPopupMode === -1)
            return true;
        else
            return false;
    }
}

// /////////////////////////////////////////////////
function getAdwPage(optionList, pageProperties = {}) {
    const groupWidth = 800;
    pageProperties.width_request = groupWidth + 100;
    const page = new Adw.PreferencesPage(pageProperties);
    let group;
    for (let item of optionList) {
        // label can be plain text for Section Title
        // or GtkBox for Option
        const option = item[0];
        const widget = item[1];

        if (!widget) {
            if (group)
                page.add(group);

            group = new Adw.PreferencesGroup({
                title: option,
                hexpand: true,
                width_request: groupWidth,
            });
            continue;
        }

        const row = new Adw.PreferencesRow({
            title: option._title,
        });

        const grid = new Gtk.Grid({
            column_homogeneous: true,
            column_spacing: 10,
            margin_start: 8,
            margin_end: 8,
            margin_top: 8,
            margin_bottom: 8,
            hexpand: true,
        });

        grid.attach(option, 0, 0, 6, 1);
        if (widget)
            grid.attach(widget, 6, 0, 3, 1);

        row.set_child(grid);
        group.add(row);
    }
    page.add(group);
    return page;
}

// ///////////////////////////////////////////////////////////////////

function _newSwitch() {
    let sw = new Gtk.Switch({
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true,
    });
    sw.is_switch = true;
    return sw;
}

/* function _newSpinButton(adjustment) {
    let spinButton = new Gtk.SpinButton({
        halign: Gtk.Align.END,
        hexpand: true,
        xalign: 0.5,
    });
    spinButton.set_adjustment(adjustment);
    spinButton.is_spinbutton = true;
    return spinButton;
}*/

function _newComboBox() {
    const model = new Gtk.ListStore();
    model.set_column_types([GObject.TYPE_STRING, GObject.TYPE_INT]);
    const comboBox = new Gtk.ComboBox({
        model,
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true,
    });
    const renderer = new Gtk.CellRendererText();
    comboBox.pack_start(renderer, true);
    comboBox.add_attribute(renderer, 'text', 0);
    comboBox.is_combo_box = true;
    return comboBox;
}

function _newEntry() {
    const entry = new Gtk.Entry({
        width_chars: 25,
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true,
        xalign: 0,
    });
    entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'edit-clear-symbolic');
    entry.set_icon_activatable(Gtk.EntryIconPosition.SECONDARY, true);
    entry.connect('icon-press', e => e.set_text(''));
    entry.is_entry = true;
    return entry;
}

function _newScale(adjustment) {
    const scale = new Gtk.Scale({
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

function _newColorResetBtn(gColor, colorBtn) {
    const colorReset = new Gtk.Button({
        hexpand: false,
        halign: Gtk.Align.END,
    });
    colorReset.set_tooltip_text(_('Reset color to default value'));

    if (colorReset.set_icon_name)
        colorReset.set_icon_name('edit-clear-symbolic');
    else
        colorReset.add(Gtk.Image.new_from_icon_name('edit-clear-symbolic', Gtk.IconSize.BUTTON));

    colorReset.connect('clicked', () => {
        const color = opt.getDefault(gColor);
        if (!color)
            return;
        const rgba = colorBtn.get_rgba();
        const success = rgba.parse(color);
        if (success)
            colorBtn.set_rgba(rgba);
        opt.set(colorBtn._gsettingsVar, rgba.to_string());
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

function _newButton() {
    const button = new Gtk.Button({
        label: 'Apply',
        hexpand: false,
        vexpand: false,
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
    });
    button.is_button = true;

    return button;
}

function _optionsItem(text, tooltip, widget, variable, options = []) {
    /* if (widget && opt.get(variable) === undefined && variable != 'preset') {
        throw new Error(
            `Settings variable ${variable} doesn't exist, check your code dude!`
        );
    }*/
    // item structure: [option(label/caption), widget]
    let item = [];
    let label;
    if (widget) {
        label = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            halign: Gtk.Align.START,
            valign: Gtk.Align.CENTER,
        });

        label._title = text;
        const option = new Gtk.Label({
            halign: Gtk.Align.START,
        });
        option.set_markup(text);

        label.append(option);

        if (tooltip) {
            const caption = new Gtk.Label({
                halign: Gtk.Align.START,
                wrap: true,
                xalign: 0,
            });
            const context = caption.get_style_context();
            context.add_class('dim-label');
            context.add_class('caption');
            caption.set_text(tooltip);
            label.append(caption);
        }
    } else {
        label = text;
    }
    item.push(label);
    item.push(widget);

    let settings;
    let key;

    if (variable && opt.options[variable]) {
        const o = opt.options[variable];
        key = o[1];
        settings = o[2] ? o[2]() : opt._gsettings;
    }
    if (widget && widget.is_switch) {
        settings.bind(key, widget, 'active', Gio.SettingsBindFlags.DEFAULT);
    } else if (widget && widget.is_combo_box) {
        let model = widget.get_model();
        for (const [label, value] of options) {
            let iter;
            model.set(iter = model.append(), [0, 1], [label, value]);
        }
        settings.bind(key, widget, 'active', Gio.SettingsBindFlags.DEFAULT);
    } else if (widget && widget.is_entry) {
        if (options) {
            const names = opt.get(variable);
            if (names[options - 1])
                widget.set_text(names[options - 1]);

            widget.set_placeholder_text(`${_('Workspace')} ${options}`);

            widget.connect('changed', () => {
                const names = [];
                _wsEntries.forEach(e => {
                    if (e.get_text())
                        names.push(e.get_text());
                });
                opt.set('wsNames', names);
            });

            _wsEntries.push(widget);
        }
    } else if (widget && widget.is_scale) {
        settings.bind(key, widget.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);
    } else if (widget && (widget.is_color_btn || widget.is_color_box)) {
        let colorBtn;
        if (widget.is_color_box)
            colorBtn = widget.colorBtn;
        else
            colorBtn = widget;

        const rgba = colorBtn.get_rgba();
        rgba.parse(opt.get(variable));
        colorBtn.set_rgba(rgba);

        colorBtn.connect('color_set', () => {
            opt.set(variable, `${colorBtn.get_rgba().to_string()}`);
        });

        settings.connect(`changed::${key}`, () => {
            const rgba = colorBtn.get_rgba();
            rgba.parse(opt.get(variable));
            colorBtn.set_rgba(rgba);
        });
    } else if (widget && widget.is_button) {
        widget.connect('clicked', () => {
            opt.set('popupMode', options[0]);
            opt.set('popupScale', options[1]);
            opt.set('popupWidthScale', options[2]);
            opt.set('popupPaddingScale', options[3]);
            opt.set('popupSpacingScale', options[4]);
            opt.set('popupRadiusScale', options[5]);
            opt.set('fontScale', options[6]);
            opt.set('indexScale', options[7]);
            opt.set('wrapAppNames', options[8]);
            opt.set('textShadow', options[9]);
            opt.set('textBold', options[10]);
            opt.set('popupOpacity', options[11]);
            opt.set('popupBgColor', options[12]);
            opt.set('popupBorderColor', options[13]);
            opt.set('popupActiveFgColor', options[14]);
            opt.set('popupActiveBgColor', options[15]);
            opt.set('popupInactiveFgColor', options[16]);
            opt.set('popupInactiveBgColor', options[17]);
            opt.set('activeShowWsIndex', options[18]);
            opt.set('activeShowWsName', options[19]);
            opt.set('activeShowAppName', options[20]);
            opt.set('activeShowWinTitle', options[21]);
            opt.set('inactiveShowWsIndex', options[22]);
            opt.set('inactiveShowWsName', options[23]);
            opt.set('inactiveShowAppName', options[24]);
            opt.set('inactiveShowWinTitle', options[25]);
            opt.set('allowCustomColors', true);
        });
    }

    return item;
}

function _makeTitle(label) {
    return `<b>${label}</b>`;
}

// ////////////////////////////////////////////////////////////////////

function _getGeneralOptionList() {
    const optionList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Workspace Switcher Pop-up'))
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Mode'),
            'Switcher can display untouched Default pop-up or customized one showing either boxes for all workspaces or the active one only',
            _newComboBox(),
            'popupMode',
            [[_('Custom: All Workspaces'), 0],
                [_('Custom: Active Workspace Only'), 1],
                [_('Default: No Customizations'), 2],
                [_('Disable'), 3]]
        )
    );
    optionList.push(
        _optionsItem(
            _makeTitle(_('Workspaces'))
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Dynamic Workspaces'),
            _(`Dynamic - workspaces can be created on demand, and are automatically removed when empty.
Static - number of workspaces is fixed to the number you can set below.`),
            _newSwitch(),
            'dynamicWorkspaces'
        )
    );
    // -----------------------------------------------------
    const numAdjustment = new Gtk.Adjustment({
        lower: 1,
        upper: 36,
        step_increment: 1,
        page_increment: 1,
    });

    const numScale = _newScale(numAdjustment);
    numScale.add_mark(4, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Number of Workspaces in Static Mode'),
            _('Max number of 36 is given by GNOME'),
            numScale,
            'numWorkspaces'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Workspaces on Primary Display Only'),
            _('Additional displays are treated as independent workspaces or the current workspace includes additional displays'),
            _newSwitch(),
            'workspacesOnPrimaryOnly'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Reverse Workspace Orientation'),
            _('Changes the axis in which workspaces are organized, from horizontal to vertical'),
            _newSwitch(),
            'reverseWsOrientation'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Workspace Switcher'))
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Wraparound'),
            _('Continue from the last workspace to the first and vice versa'),
            _newSwitch(),
            'wsSwitchWrap'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Ignore Last (empty) Workspace'),
            _('In Dynamic workspaces mode, there is always one empty workspace at the end. Switcher can ignore this last workspace'),
            _newSwitch(),
            'wsSwitchIgnoreLast'
        )
    );

    return optionList;
}


function _getPopupOptionList() {
    const optionList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    optionList.push(
        _optionsItem(
            _makeTitle(_('Behavior'))
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Monitor'),
            _('The monitor on which the workspace switcher pop-up should appear. The Current monitor is determined by the mouse pointer location'),
            _newComboBox(),
            'monitor',
            [[_('Primary'), 0],
                [_('Current'), 1]]
        )
    );
    // -----------------------------------------------------
    let popupTimeoutAdjustment = new Gtk.Adjustment({
        upper: 2000,
        lower: 0,
        step_increment: 1,
        page_increment: 1,
    });

    const tScale = _newScale(popupTimeoutAdjustment);
    tScale.add_mark(600, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('On-Screen Time (ms)'),
            _('Time after which the pop-up fades out'),
            tScale,
            'popupTimeout'
        )
    );
    // -----------------------------------------------------
    let fadeOutAdjustment = new Gtk.Adjustment({
        upper: 500,
        lower: 10,
        step_increment: 1,
        page_increment: 1,
    });

    const fadeScale = _newScale(fadeOutAdjustment);
    fadeScale.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Fade Out Time (ms)'),
            _('Duration of fade out animation'),
            fadeScale,
            'fadeOutTime'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Display Until Modifier Keys Released'),
            _('Keeps the pop-up on the screen until modifier keys (Shift, Ctrl, Super, Alt) are released. Similar as Alt-Tab switcher works'),
            _newSwitch(),
            'modifiersHidePopup'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Position on Screen'))
        )
    );
    // -----------------------------------------------------
    const hAdjustment = new Gtk.Adjustment({
        lower: 0,
        upper: 100,
        step_increment: 1,
        page_increment: 1,
    });

    const hScale = _newScale(hAdjustment);
    hScale.add_mark(50, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Horizontal (% from left)'),
            null,
            hScale,
            'popupHorizontal'
        )
    );
    // -----------------------------------------------------
    const vAdjustment = new Gtk.Adjustment({
        lower: 0,
        upper: 100,
        step_increment: 1,
        page_increment: 1,
    });

    const vScale = _newScale(vAdjustment);
    vScale.add_mark(50, Gtk.PositionType.TOP, null);
    optionList.push(
        _optionsItem(
            _('Vertical (% from top)'),
            null,
            vScale,
            'popupVertical'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Orientation'))
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Reverse Orientation'),
            _('Draw the switcher pop-up vertically instead of horizontally and vice versa'),
            _newSwitch(),
            'reversePopupOrientation'
        )
    );


    return optionList;
}
// ////////////////////////////////////////////////

function _getContentOptionList() {
    const optionList = [];

    optionList.push(
        _optionsItem(
            _makeTitle(_('Pop-up Active Workspace Indicator Content'))
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Workspace Index'),
            _('Active workspace box shows workspace index'),
            _newSwitch(),
            'activeShowWsIndex'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Workspace Name'),
            _('Active workspace box shows workspace name if the name is set'),
            _newSwitch(),
            'activeShowWsName'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Current App Name'),
            _('Active workspace box shows the name of the most recently used application on the represented workspace'),
            _newSwitch(),
            'activeShowAppName'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Current Window Title'),
            _('Active workspace box shows the title of the most recently used window on the represented workspace'),
            _newSwitch(),
            'activeShowWinTitle'
        )
    );

    // +++++++++++++++++++++++++++++++++++++++++++++++++++++
    optionList.push(
        _optionsItem(
            _makeTitle(_('Pop-up Inactive Workspace Indicator Content'))
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Workspace Index'),
            _('Inactive workspace box shows workspace index'),
            _newSwitch(),
            'inactiveShowWsIndex'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Workspace Name'),
            _('Inactive workspace box shows workspace name if the name is set'),
            _newSwitch(),
            'inactiveShowWsName'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Current App Name'),
            _('Inactive workspace box shows the name of the most recently used application on represented workspace'),
            _newSwitch(),
            'inactiveShowAppName'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Current Window Title'),
            _('Inactive workspace box shows the title of the most recently used window on the represented workspace'),
            _newSwitch(),
            'inactiveShowWinTitle'
        )
    );

    return optionList;
}

// ////////////////////////////////////////////////

function _getSizeTextOptionList() {
    const optionList = [];

    optionList.push(
        _optionsItem(
            _makeTitle(_('Pop-up Proportions (relative to the default WSM popup - the old GNOME 3 style')),
            null
        )
    );
    // -----------------------------------------------------
    const dpSizeAdjustment = new Gtk.Adjustment({
        upper: 600,
        lower: 10,
        step_increment: 1,
        page_increment: 1,
    });

    const dpSize = _newScale(dpSizeAdjustment);
    dpSize.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Global Scale (%)'),
            _('Adjusts size of the pop-up relative to the original'),
            dpSize,
            'popupScale'
        )
    );
    // -----------------------------------------------------
    const boxWidthAdjustment = new Gtk.Adjustment({
        upper: 300,
        lower: 10,
        step_increment: 1,
        page_increment: 1,
    });

    const boxWidth = _newScale(boxWidthAdjustment);
    boxWidth.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('WS Box Width Scale (%)'),
            _('Allows to change workspace box ratio'),
            boxWidth,
            'popupWidthScale'
        )
    );
    // -----------------------------------------------------
    const paddingAdjustment = new Gtk.Adjustment({
        upper: 500,
        lower: 0,
        step_increment: 1,
        page_increment: 1,
    });

    const padding = _newScale(paddingAdjustment);
    padding.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Padding (%)'),
            _('Adjusts background padding'),
            padding,
            'popupPaddingScale'
        )
    );
    // -----------------------------------------------------
    const spacingAdjustment = new Gtk.Adjustment({
        upper: 500,
        lower: 0,
        step_increment: 1,
        page_increment: 1,
    });

    const spacing = _newScale(spacingAdjustment);
    spacing.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Spacing (%)'),
            _('Adjusts space between workspace boxes'),
            spacing,
            'popupSpacingScale'
        )
    );
    // -----------------------------------------------------
    const radiusAdjustment = new Gtk.Adjustment({
        upper: 1000,
        lower: 0,
        step_increment: 1,
        page_increment: 1,
    });

    const radius = _newScale(radiusAdjustment);
    radius.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Corner Radius (%)'),
            _('Adjusts radius of all corners'),
            radius,
            'popupRadiusScale'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Text Size')),
            null
        )
    );
    // -----------------------------------------------------
    const fontSizeAdjustment = new Gtk.Adjustment({
        lower: 50,
        upper: 300,
        step_increment: 1,
        page_increment: 1,
    });

    const fsScale = _newScale(fontSizeAdjustment);
    fsScale.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Font Size Scale (%)'),
            _('Size resizes according to the pop-up scale, use this scale to precisely adjust the text size'),
            fsScale,
            'fontScale'
        )
    );
    // -----------------------------------------------------
    const idxSizeAdjustment = new Gtk.Adjustment({
        lower: 50,
        upper: 600,
        step_increment: 1,
        page_increment: 1,
    });

    const idxScale = _newScale(idxSizeAdjustment);
    idxScale.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('WS Index Size Scale (%)'),
            _('If only "Show Workspace Index" text (or "Show App Name" on workspace without app) content option is active this scale takes effect. Single digit always looks smaller then longer text with the same font size'),
            idxScale,
            'indexScale'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Text Options')),
            null
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Wrap long App Names'),
            _('Application names with more than one word will be wrapped after the first word'),
            _newSwitch(),
            'wrapAppNames'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Text Shadow'),
            _('Shadow helps text visibility on the background with the similar color'),
            _newSwitch(),
            'textShadow'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Text Weight Bold'),
            null,
            _newSwitch(),
            'textBold'
        )
    );

    return optionList;
}

function _getColorOptionList() {
    const optionList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    optionList.push(
        _optionsItem(
            _makeTitle(_('Pop-up Opacity')),
            null
        )
    );
    // -----------------------------------------------------
    const opacityAdjustment = new Gtk.Adjustment({
        lower: 10,
        upper: 100,
        step_increment: 1,
        page_increment: 1,
    });

    const opacityScale = _newScale(opacityAdjustment);
    opacityScale.add_mark(98, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Global Opacity (%)'),
            _('Sets transparency of the pop-up as a whole'),
            opacityScale,
            'popupOpacity'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Pop-up Colors')),
            null
        )
    );
    // -----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Allow Custom Colors ↓')),
            _(`Default colors are read from default Shell theme at the time the extension is being enabled.
Because reading colors from css style is hacky as hell if you don't exactly know the applied css style content,
colors may be incorrect (more incorrect if other than default theme is used). Also alpha chanel information may be missing.`),
            _newSwitch(),
            'allowCustomColors'
        )
    );
    // -----------------------------------------------------
    const bgColorBox = _newColorButtonBox();
    const bgColorBtn = _newColorButton();
    const bgColorReset = _newColorResetBtn('popupBgColor', bgColorBtn);
    bgColorBox.colorBtn = bgColorBtn;
    bgColorBtn._gsettingsVar = 'popupBgColor';

    bgColorBox.append(bgColorBtn);
    bgColorBox.append(bgColorReset);

    optionList.push(
        _optionsItem(
            _('Background color / opacity'),
            null,
            bgColorBox,
            'popupBgColor'
        )
    );
    // -----------------------------------------------------
    const borderColorBox = _newColorButtonBox();
    const borderColorBtn = _newColorButton();
    const borderColorReset = _newColorResetBtn('popupBorderColor', borderColorBtn);
    borderColorBox.colorBtn = borderColorBtn;
    borderColorBtn._gsettingsVar = 'popupBorderColor';

    borderColorBox.append(borderColorBtn);
    borderColorBox.append(borderColorReset);

    optionList.push(
        _optionsItem(
            _('Border color / opacity'),
            null,
            borderColorBox,
            'popupBorderColor'
        )
    );
    // -----------------------------------------------------
    const activeFgColorBox = _newColorButtonBox();
    const activeFgColorBtn = _newColorButton();
    const activeFgColorReset = _newColorResetBtn('popupActiveFgColor', activeFgColorBtn);
    activeFgColorBox.colorBtn = activeFgColorBtn;
    activeFgColorBtn._gsettingsVar = 'popupActiveFgColor';

    activeFgColorBox.append(activeFgColorBtn);
    activeFgColorBox.append(activeFgColorReset);

    optionList.push(
        _optionsItem(
            _('Active WS Foreground color / opacity'),
            _('Text and other foreground graphics'),
            activeFgColorBox,
            'popupActiveFgColor'
        )
    );
    // -----------------------------------------------------
    const activeBgColorBox = _newColorButtonBox();
    const activeBgColorBtn = _newColorButton();
    const activeBgColorReset = _newColorResetBtn('popupActiveBgColor', activeBgColorBtn);
    activeBgColorBox.colorBtn = activeBgColorBtn;
    activeBgColorBtn._gsettingsVar = 'popupActiveBgColor';

    activeBgColorBox.append(activeBgColorBtn);
    activeBgColorBox.append(activeBgColorReset);

    optionList.push(
        _optionsItem(
            _('Active WS Background color  / opacity'),
            null,
            activeBgColorBox,
            'popupActiveBgColor'
        )
    );
    // -----------------------------------------------------
    const inactiveFgColorBox = _newColorButtonBox();
    const inactiveFgColorBtn = _newColorButton();
    const inactiveFgColorReset = _newColorResetBtn('popupInactiveFgColor', inactiveFgColorBtn);
    inactiveFgColorBox.colorBtn = inactiveFgColorBtn;
    inactiveFgColorBtn._gsettingsVar = 'popupInactiveFgColor';

    inactiveFgColorBox.append(inactiveFgColorBtn);
    inactiveFgColorBox.append(inactiveFgColorReset);

    optionList.push(
        _optionsItem(
            _('Inactive WS Foreground color / opacity'),
            _('Text and other foreground graphics'),
            inactiveFgColorBox,
            'popupInactiveFgColor'
        )
    );
    // -----------------------------------------------------
    const inactiveBgColorBox = _newColorButtonBox();
    const inactiveBgColorBtn = _newColorButton();
    const inactiveBgColorReset = _newColorResetBtn('popupInactiveBgColor', inactiveBgColorBtn);
    inactiveBgColorBox.colorBtn = inactiveBgColorBtn;
    inactiveBgColorBtn._gsettingsVar = 'popupInactiveBgColor';

    inactiveBgColorBox.append(inactiveBgColorBtn);
    inactiveBgColorBox.append(inactiveBgColorReset);

    optionList.push(
        _optionsItem(
            _('Inactive WS Background color  / opacity'),
            null,
            inactiveBgColorBox,
            'popupInactiveBgColor'
        )
    );

    // -----------------------------------------------------
    return optionList;
}

// /////////////////////////////////////////////////

function _getWorkspacesOptionList() {
    const optionList = [];

    optionList.push(
        _optionsItem(
            _makeTitle(_('Names')),
            _('Uses official GNOME gsettings key that can be read/modified by other applications')
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 1'),
            null,
            _newEntry(),
            'wsNames',
            1
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 2'),
            null,
            _newEntry(),
            'wsNames',
            2
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 3'),
            null,
            _newEntry(),
            'wsNames',
            3
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 4'),
            null,
            _newEntry(),
            'wsNames',
            4
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 5'),
            null,
            _newEntry(),
            'wsNames',
            5
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 6'),
            null,
            _newEntry(),
            'wsNames',
            6
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 7'),
            null,
            _newEntry(),
            'wsNames',
            7
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 8'),
            null,
            _newEntry(),
            'wsNames',
            8
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 9'),
            null,
            _newEntry(),
            'wsNames',
            9
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 10'),
            null,
            _newEntry(),
            'wsNames',
            10
        )
    );

    return optionList;
}

// /////////////////////////////////////////////////

function _getPresetsOptionList() {
    const optionList = [];

    optionList.push(
        _optionsItem(
            _makeTitle(_('Predefined examples of the pop-up customizations'))
        )
    );

    optionList.push(
        _optionsItem(
            _('WSM Default - GNOME 3.xx style'),
            _('Classic old popup with workspace indexes and app names'),
            _newButton(),
            'preset',
            [
                // popup mode,
                0,
                // scale, box width, padding, spacing, radius, font size, index size, wrap text, shadow, bold,
                100, 100, 100, 100, 100, 100, 100, true, false, true,
                // global opacity, bg col, border col, active fg, active bg, inactive fg, inactive bg,
                98, 'rgb(29,29,29)', 'rgb(53,53,53)', 'rgb(255,255,255)', 'rgb(0,110,255)', 'rgb(255,255,255)', 'rgb(29,29,29)',
                // act show index, act show ws, act show app, act show title, inact show index, inact show ws, act show app, inact show title
                true, false, true, false, true, false, true, false,
            ]
        )
    );

    optionList.push(
        _optionsItem(
            _('Dark red rounded classic'),
            _('All workspaces mode, with workspace index and current app info'),
            _newButton(),
            'preset',
            [
                // popup mode,
                0,
                // scale, box width, padding, spacing, radius, font size, index size, wrap text, shadow, bold,
                66, 133, 130, 180, 180, 133, 300, true, false, true,
                // global opacity, bg col, border col, active fg, active bg, inactive fg, inactive bg
                98, 'rgb(29,29,29)', 'rgb(53,53,53)', 'rgb(255,255,255)', 'rgb(105,0,0)', 'rgb(255,255,255)', 'rgb(53,53,53)',
                // act show index, act show ws, act show app, act show title, inact show index, inact show ws, act show app, inact show title
                false, false, true, false, false, false, true, false,
            ]
        )
    );

    optionList.push(
        _optionsItem(
            _('Blue/grey circles on dark background'),
            _('All workspaces mode, small popup with workspace boxes shaped to little circle'),
            _newButton(),
            'preset',
            [
                // popup mode,
                0,
                // scale, box width, padding, spacing, radius, font size, index size, wrap text, shadow, bold,
                40, 55, 250, 250, 700, 100, 100, true, false, true,
                // global opacity, bg col, border col, active fg, active bg, inactive fg, inactive bg
                98, 'rgb(29,29,29)', 'rgb(53,53,53)', 'rgb(255,255,255)', 'rgb(0,112,255)', 'rgb(255,255,255)', 'rgb(53,53,53)',
                // act show index, act show ws, act show app, act show title, inact show index, inact show ws, act show app, inact show title
                false, false, false, false, false, false, false, false,
            ]
        )
    );

    optionList.push(
        _optionsItem(
            _('Big grey text only'),
            _('Active workspaces only mode, transparent background, big semi-transparent font, with the workspace index and current app info'),
            _newButton(),
            'preset',
            [
                // popup mode,
                1,
                // scale, box width, padding, spacing, radius, font size, index size, wrap text, shadow, bold,
                527, 150, 100, 100, 100, 120, 230, false, true, true,
                // global opacity, bg col, border col, active fg, active bg, inactive fg, inactive bg,
                98, 'rgba(53,53,53,0)', 'rgba(53,53,53,0)', 'rgba(0,0,0,0.564189)', 'rgba(53,53,53,0)', 'rgb(255,255,255)', 'rgb(535353)',
                // act show index, act show ws, act show app, act show title, inact show index, inact show ws, act show app, inact show title
                true, false, true, true, false, false, false, false,
            ]
        )
    );

    optionList.push(
        _optionsItem(
            _('Orange circle with semitransparent background'),
            _('Active workspaces only mode, smaller circle with workspace index'),
            _newButton(),
            'preset',
            [
                // popup mode,
                1,
                // scale, box width, padding, spacing, radius, font size, index size, wrap text, shadow, bold,
                100, 57, 200, 100, 700, 150, 500, false, false, true,
                // global opacity, bg col, border col, active fg, active bg, inactive fg, inactive bg,
                98, 'rgba(29,29,29,0.689189)', 'rgba(53,53,53,0)', 'rgb(255,255,255)', 'rgb(233,84,32)', 'rgb(255,255,255)', 'rgb(53,53,53)',
                // act show index, act show ws, act show app, act show title, inact show index, inact show ws, act show app, inact show title
                true, false, false, false, false, false, false, false,
            ]
        )
    );

    return optionList;
}

// /////////////////////////////////////////////////

function getAboutPage(pageProperties, metadata) {
    const page = new Adw.PreferencesPage(pageProperties);

    const aboutGroup = new Adw.PreferencesGroup({
        title: metadata.name,
        hexpand: true,
    });

    const linksGroup = new Adw.PreferencesGroup({
        title: _('Links'),
        hexpand: true,
    });

    page.add(aboutGroup);
    page.add(linksGroup);

    const versionName = metadata['version-name'] ?? '';
    let version = metadata['version'] ?? '';
    version = versionName && version ? `/${version}` : version;
    const versionStr = `${versionName}${version}`;
    aboutGroup.add(_newAdwLabelRow({
        title: _('Version'),
        subtitle: _(''),
        label: versionStr,
    }));

    aboutGroup.add(_newResetRow({
        title: _('Reset all options'),
        subtitle: _('Set all options to default values'),
    }));

    linksGroup.add(_newAdwLinkRow({
        title: _('Homepage'),
        subtitle: _('Source code and more info about this extension'),
        uri: 'https://github.com/G-dH/workspace-switcher-manager',
    }));

    linksGroup.add(_newAdwLinkRow({
        title: _('GNOME Extensions'),
        subtitle: _('Rate and comment the extension on GNOME Extensions site'),
        uri: 'https://extensions.gnome.org/extension/4788',
    }));

    linksGroup.add(_newAdwLinkRow({
        title: _('Report a bug or suggest new feature'),
        subtitle: _(''),
        uri: 'https://github.com/G-dH/workspace-switcher-manager/issues',
    }));

    linksGroup.add(_newAdwLinkRow({
        title: _('Buy Me a Coffee'),
        subtitle: _('Enjoying WSM? Consider supporting it by buying me a coffee!'),
        uri: 'https://buymeacoffee.com/georgdh',
    }));

    return page;
}

function _newAdwLabelRow(params) {
    const label = new Gtk.Label({
        label: params.label,
    });

    const actionRow = new Adw.ActionRow({
        title: params.title,
        subtitle: params.subtitle,
    });

    actionRow.add_suffix(label);

    return actionRow;
}

function _newAdwLinkRow(params) {
    const linkBtn = new Gtk.LinkButton({
        uri: params.uri,
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
    });

    const actionRow = new Adw.ActionRow({
        title: params.title,
        subtitle: params.subtitle,
        activatable_widget: linkBtn,
    });

    actionRow.add_suffix(linkBtn);

    return actionRow;
}

function _newResetRow(params) {
    const btn = new Gtk.Button({
        css_classes: ['destructive-action'],
        icon_name: 'view-refresh-symbolic',
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
    });
    btn.connect('clicked', () => {
        const settings = opt._gsettings;
        settings.list_keys().forEach(
            key => settings.reset(key)
        );
    });

    const actionRow = new Adw.ActionRow({
        title: params.title,
        subtitle: params.subtitle,
    });

    actionRow.add_suffix(btn);

    return actionRow;
}
