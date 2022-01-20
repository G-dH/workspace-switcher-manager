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



    const generalOptionsPage    = new OptionsPageWSPM(_getGeneralOptionList());
    const popupOptionsPage      = new OptionsPageWSPM(_getPopupOptionList());
    const colorOptionsPage      = new OptionsPageWSPM(_getColorOptionList())
    const sizeTextOptionsPage   = new OptionsPageWSPM(_getSizeTextOptionList());
    const contentOptionsPage    = new OptionsPageWSPM(_getContentOptionList());
    const workspacesOptionsPage = new OptionsPageWSPM(_getWorkspacesOptionList());

    optionsPage.append_page(generalOptionsPage, new Gtk.Label({
        label: _('General'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    optionsPage.append_page(popupOptionsPage, new Gtk.Label({
        label: _('Popup'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    optionsPage.append_page(sizeTextOptionsPage, new Gtk.Label({
        label: _('Size & Text'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    optionsPage.append_page(colorOptionsPage, new Gtk.Label({
        label: _('Colors'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    optionsPage.append_page(contentOptionsPage, new Gtk.Label({
        label: _('Content'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    optionsPage.append_page(workspacesOptionsPage, new Gtk.Label({
        label: _('Workspace Names'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    /*optionsPage.connect('switch-page', (ntb, page, index) => {
            mscOptions.activePrefsPage = index;
        }
    });*/

    return optionsPage;
}

function _getGeneralOptionList() {
    const optionList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    optionList.push(
        _optionsItem(
            _makeTitle(_('Workspaces')),
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Mode'),
            _(`Dynamic - workspaces can be created on demand, and are automaticaly removed when empty\n
Static - number of workspaces is fixed, and you can set the number below\n
This option is backed by internal GNOME gsettings key and can be modified by other applications.`),
            _newComboBox(),
            'workspaceMode',
           [[_('Dynamic'), 0],
            [_('Static'),  1]]
        )
    );
    //-----------------------------------------------------
    const numAdjustment = new Gtk.Adjustment({
        lower: 1,
        upper: 36,
        step_increment: 1,
        page_increment: 1,
    });

    const numScale = _newScale(numAdjustment);
    numScale.add_mark(6, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Number of Workspaces in Static mode'),
            _('Max number of 36 is given by GNOME. This option is backed by internal GNOME gsettings key and can be modified by other applications.'),
            numScale,
            'numWorkspaces'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Workspaces on Primary Display Only'),
            _('Additional displays are treated as independent workspaces or the current workspace includes additional displays.'),
            _newGtkSwitch(),
            'workspacesOnPrimaryOnly'
            )
            );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Reverse Workspace Orientation'),
            _('This option breaks overview in GS 40+, but usable in 3.36/3.38. Changes the direction in which workspaces are organized, from horizontal to vertical or from vertical to horizontal, depending on the default state that is recorded during the start of GNOME Shell. The switcher popup reflects this option automatically.'),
            _newGtkSwitch(),
            'reverseWsOrientation'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Switcher')),
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Wraparound'),
            _('Whether the switcher should continue from the last workspace to the first one and vice versa.'),
            _newGtkSwitch(),
            'wsSwitchWrap'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Ignore Last (empty) workspace'),
            null,
            _newGtkSwitch(),
            'wsSwitchIgnoreLast'
        )
    );
    //-----------------------------------------------------
    return optionList;
}


function _getPopupOptionList() {
    const optionList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    optionList.push(
        _optionsItem(
            _makeTitle(_('Behavior')),
        )
    );
    //-----------------------------------------------------    
    optionList.push(
        _optionsItem(
            _('Mode'),
            null,
            _newComboBox(),
            'popupMode',
            [[_('Show All Workspaces'), 0],
             [_('Show Active Workspace Only'), 1],
             [_('Disable'), 2]]
        )
    );
    //-----------------------------------------------------
    optionList.push(
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
        step_increment: 1,
        page_increment: 1,
    });

    const tScale = _newScale(popupTimeoutAdjustment);
    tScale.add_mark(600, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('On-Screen Time (ms)'),
            _("Time after which the popup fade out"),
            tScale,
            'popupTimeout'
        )
    );
    //-----------------------------------------------------
    let fadeOutAdjustment = new Gtk.Adjustment({
        upper: 1000,
        lower: 10,
        step_increment: 1,
        page_increment: 1,
    });

    const fadeScale = _newScale(fadeOutAdjustment);
    fadeScale.add_mark(500, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Fade Out Time (ms)'),
            _('Durarion of fade out animation.'),
            fadeScale,
            'fadeOutTime'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _(`Display until modifier keys released`),
            _('Keeps the popup on the screen until modifier keys (Shift, Ctrl, Super, Alt) are released. Similar as Alt-Tab switcher works.'),
            _newGtkSwitch(),
            'modifiersHidePopup'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Position')),
        )
    );
    //-----------------------------------------------------
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
            'popupHorizontal',
        )
    );
    //-----------------------------------------------------
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
            'popupVertical',
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Orientation')),
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Reverse Orientation'),
            _('Draw the switcher popup vertically instead of horizontaly and vice versa.'),
            _newGtkSwitch(),
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
            _makeTitle(_("Popup Active Workspace Box")),
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
             _('Show Workspace Index'),
             _('Highlighted active workspace indicator will show its index.'),
             _newGtkSwitch(),
             'activeShowWsIndex'
         )
     );
    //-----------------------------------------------------
    optionList.push(
       _optionsItem(
            _('Show Workspace Name'),
            _('Highlighted active workspace indicator will show workspace name if the name is set.'),
            _newGtkSwitch(),
            'activeShowWsName'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Current App Name'),
            _('Highlighted active workspace indicator will show a name of the last used application on active workspace.'),
            _newGtkSwitch(),
            'activeShowAppName'
         )
     );

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++
    optionList.push(
        _optionsItem(
            _makeTitle(_('Popup Inactive Workspace Box')),
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
             _('Show Workspace Index'),
             _('Highlighted active workspace indicator will show its index.'),
             _newGtkSwitch(),
             'inactiveShowWsIndex'
         )
     );
    //-----------------------------------------------------
    optionList.push(
       _optionsItem(
            _('Show Workspace Name'),
            _('Highlighted active workspace indicator will show workspace name if the name is set.'),
            _newGtkSwitch(),
            'inactiveShowWsName'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Current App Name'),
            _('Highlighted active workspace indicator will show a name of the last used application on active workspace.'),
            _newGtkSwitch(),
            'inactiveShowAppName'
         )
     );

    return optionList;
}

// ////////////////////////////////////////////////

function _getSizeTextOptionList() {
    const optionList = [];

     optionList.push(
        _optionsItem(
            _makeTitle(_('Popup Size')),
            null
        )
    );
    //-----------------------------------------------------
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
            _('Popup Scale (%)'),
            _("Sets the size of the popup relative to the original."),
            dpSize,
            'popupScale'
        )
    );
    //-----------------------------------------------------
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
            _('Popup Width Scale (%)'),
            _("Allows to make popup box representing single workspace wider or narrower."),
            boxWidth,
            'popupWidthScale'
        )
    );
    //-----------------------------------------------------
    const paddingAdjustment = new Gtk.Adjustment({
        upper: 200,
        lower: 0,
        step_increment: 1,
        page_increment: 1,
    });

    const padding = _newScale(paddingAdjustment);
    padding.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Popup Padding (%)'),
            _("Adjusts popup background padding."),
            padding,
            'popupPaddingScale'
        )
    );
    //-----------------------------------------------------
    const spacingAdjustment = new Gtk.Adjustment({
        upper: 200,
        lower: 0,
        step_increment: 1,
        page_increment: 1,
    });

    const spacing = _newScale(spacingAdjustment);
    spacing.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Popup Spacing (%)'),
            _("Adjusts popup box spacing."),
            spacing,
            'popupSpacingScale'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Text Size')),
            null
        )
    );
    //-----------------------------------------------------
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
            _('Font Size Finetune (%)'),
            _('Size resizes acording to the popup sclae, use this scale to precisely adjust the text size.'),
            fsScale,
            'fontScale',
        )
    );
    //-----------------------------------------------------
    const idxSizeAdjustment = new Gtk.Adjustment({
        lower: 50,
        upper: 1000,
        step_increment: 1,
        page_increment: 1,
    });

    const idxScale = _newScale(idxSizeAdjustment);
    idxScale.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Index Size Finetune (%)'),
            _('If only "Show Workspace Index" text (or "Show App Name" on workspace without app) content option is active this scale takes effect. Single digit always looks smaller then longer text with the same font size.'),
            idxScale,
            'indexScale',
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Text Options')),
            null
        )
    );
     //-----------------------------------------------------
     optionList.push(
        _optionsItem(
            _('Wrap long App Names'),
            _('Application names with more than one word will be wrapped after the first word.'),
            _newGtkSwitch(),
            'wrapAppNames'
        )
    );
    //-----------------------------------------------------
     optionList.push(
        _optionsItem(
            _('Text Shadow'),
            _('Shadow helps text visibility on the background with the similar color.'),
            _newGtkSwitch(),
            'textShadow'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Text Weight Bold'),
            null,
            _newGtkSwitch(),
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
            _makeTitle(_('Popup Opacity')),
            null
        )
    );
    //-----------------------------------------------------
    const opacityAdjustment = new Gtk.Adjustment({
        lower: 10,
        upper: 100,
        step_increment: 1,
        page_increment: 1,
    });

    const opacityScale = _newScale(opacityAdjustment);
    opacityScale.add_mark(90, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Global'),
            null,
            opacityScale,
            'popupOpacity',
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Popup Colors')),
            null
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Allow Custom Colors ↓ →')),
            _(`Default colors are read from default Shell theme at the time the extension is being enabled.
Because reading colors from css style is hacky as hell if you don't exactly know the applied css style content,
colors may be incorrect (more incorrect if other than default theme is used). Also alpha chanel information may be missing.`),
            _newGtkSwitch(),
            'allowCustomColors'
        )
    );
    //-----------------------------------------------------
    const bgColorBox = _newColorButtonBox();
    const bgColorBtn = _newColorButton();
    const bgColorReset = _newColorResetBtn(0, bgColorBtn);
    bgColorBox.colorBtn = bgColorBtn;
    bgColorBtn._gsettingsVar = 'popupBgColor';

    bgColorBox[bgColorBox.add ? 'add' : 'append'](bgColorBtn);
    bgColorBox[bgColorBox.add ? 'add' : 'append'](bgColorReset);

    optionList.push(
        _optionsItem(
            _('Background color / opacity'),
            null,
            bgColorBox,
            'popupBgColor',
        )
    );
    //-----------------------------------------------------
    const borderColorBox = _newColorButtonBox();
    const borderColorBtn = _newColorButton();
    const borderColorReset = _newColorResetBtn(1, borderColorBtn);
    borderColorBox.colorBtn = borderColorBtn;
    borderColorBtn._gsettingsVar = 'popupBorderColor';

    borderColorBox[borderColorBox.add ? 'add' : 'append'](borderColorBtn);
    borderColorBox[borderColorBox.add ? 'add' : 'append'](borderColorReset);

    optionList.push(
        _optionsItem(
            _('Border color / opacity'),
            null,
            borderColorBox,
            'popupBorderColor',
        )
    );
    //-----------------------------------------------------
    const activeFgColorBox = _newColorButtonBox();
    const activeFgColorBtn = _newColorButton();
    const activeFgColorReset = _newColorResetBtn(2, activeFgColorBtn);
    activeFgColorBox.colorBtn = activeFgColorBtn;
    activeFgColorBtn._gsettingsVar = 'popupActiveFgColor';

    activeFgColorBox[activeFgColorBox.add ? 'add' : 'append'](activeFgColorBtn);
    activeFgColorBox[activeFgColorBox.add ? 'add' : 'append'](activeFgColorReset);

    optionList.push(
        _optionsItem(
            _('Active WS Foreground color / opacity'),
            _('Text and other active workspace box overlays'),
            activeFgColorBox,
            'popupActiveFgColor',
        )
    );
    //-----------------------------------------------------
    const activeBgColorBox = _newColorButtonBox();
    const activeBgColorBtn = _newColorButton();
    const activeBgColorReset = _newColorResetBtn(3, activeBgColorBtn);
    activeBgColorBox.colorBtn = activeBgColorBtn;
    activeBgColorBtn._gsettingsVar = 'popupActiveBgColor';

    activeBgColorBox[activeBgColorBox.add ? 'add' : 'append'](activeBgColorBtn);
    activeBgColorBox[activeBgColorBox.add ? 'add' : 'append'](activeBgColorReset);

    optionList.push(
        _optionsItem(
            _('Active WS Background color  / opacity'),
            null,
            activeBgColorBox,
            'popupActiveBgColor',
        )
    );
    //-----------------------------------------------------
    const inactiveFgColorBox = _newColorButtonBox();
    const inactiveFgColorBtn = _newColorButton();
    const inactiveFgColorReset = _newColorResetBtn(4, inactiveFgColorBtn);
    inactiveFgColorBox.colorBtn = inactiveFgColorBtn;
    inactiveFgColorBtn._gsettingsVar = 'popupInactiveFgColor';

    inactiveFgColorBox[inactiveFgColorBox.add ? 'add' : 'append'](inactiveFgColorBtn);
    inactiveFgColorBox[inactiveFgColorBox.add ? 'add' : 'append'](inactiveFgColorReset);

    optionList.push(
        _optionsItem(
            _('Inactive WS Foreground color / opacity'),
            _('Text and other inactive workspace box overlays'),
            inactiveFgColorBox,
            'popupInactiveFgColor',
        )
    );
    //-----------------------------------------------------
    const inactiveBgColorBox = _newColorButtonBox();
    const inactiveBgColorBtn = _newColorButton();
    const inactiveBgColorReset = _newColorResetBtn(5, inactiveBgColorBtn);
    inactiveBgColorBox.colorBtn = inactiveBgColorBtn;
    inactiveBgColorBtn._gsettingsVar = 'popupInactiveBgColor';

    inactiveBgColorBox[inactiveBgColorBox.add ? 'add' : 'append'](inactiveBgColorBtn);
    inactiveBgColorBox[inactiveBgColorBox.add ? 'add' : 'append'](inactiveBgColorReset);

    optionList.push(
        _optionsItem(
            _('Inactive WS Background color  / opacity'),
            null,
            inactiveBgColorBox,
            'popupInactiveBgColor',
        )
    );

//-----------------------------------------------------
    return optionList;
}

///////////////////////////////////////////////////

function _getWorkspacesOptionList() {
    const optionList = [];

    optionList.push(
        _optionsItem(
            _makeTitle(_('Names')),
            _('Uses official GNOME gsettings key that can be read/modified by other applications.')
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 1'),
            null,
            _newGtkEntry(),
            'wsNames',
            1
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 2'),
            null,
            _newGtkEntry(),
            'wsNames',
            2
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 3'),
            null,
            _newGtkEntry(),
            'wsNames',
            3
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 4'),
            null,
            _newGtkEntry(),
            'wsNames',
            4
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 5'),
            null,
            _newGtkEntry(),
            'wsNames',
            5
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 6'),
            null,
            _newGtkEntry(),
            'wsNames',
            6
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 7'),
            null,
            _newGtkEntry(),
            'wsNames',
            7
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 8'),
            null,
            _newGtkEntry(),
            'wsNames',
            8
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 9'),
            null,
            _newGtkEntry(),
            'wsNames',
            9
        )
    );

    optionList.push(
        _optionsItem(
            _('Workspace 10'),
            null,
            _newGtkEntry(),
            'wsNames',
            10
        )
    );

    return optionList;
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
            // item structure: [[label, control widget], tooltip]
            const itemWidgets = item[0];
            const itemLabel   = item[0][0];
            const itemControl = item[0][1];
            const itemTooltip = item[1];

            if (!itemControl) {
                // new section
                let lbl = new Gtk.Label({
                    xalign: 0,
                    visible: true
                });
                lbl.set_markup(itemLabel);
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
            for (let i of itemWidgets)
                box[box.add ? 'add' : 'append'](i);
            /*if (item.length === 2)
                box.set_tooltip_text(itemTooltip);*/
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
    if (widget && mscOptions[variable] === undefined) {
        throw new Error(
            `Settings variable ${variable} doesn't exist, check your code dude!`
        );
    }
    // item structure: [[label, widget], tooltip]
    let item = [[]];
    let label;
    if (widget) {
        label = new Gtk.Label({
            halign: Gtk.Align.START,
            visible: true,
        });
        label.set_markup(text);
        if (tooltip)
            label.set_tooltip_text(tooltip);
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
            if (names[options - 1])
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
                        wsEntries.forEach(e => {
                        if (e.get_text())
                            names.push(e.get_text());
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
