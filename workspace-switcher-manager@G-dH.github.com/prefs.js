// Workspace Switcher Manager
// GPL v3 ©G-dH@Github.com
'use strict';

const { Gtk, GLib, GObject } = imports.gi;
// libadwaita is available starting with GNOME Shell 42.
let Adw = null;
try {
  Adw = imports.gi.Adw;
} catch (e) {
}

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.settings;

let gOptions;
let customPages;
let wsEntries;
let windowWidget;
let prevPopupMode;
let widgets;

// gettext
const _  = Settings._;
const shellVersion = Settings.shellVersion;


function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
    gOptions = new Settings.MscOptions();
    prevPopupMode = -1;
    wsEntries = [];
    widgets = [];
}

// this function is called by GS42 if available and returns libadwaita prefes window
function fillPreferencesWindow(window) {
    const generalOptionsPage   = getAdwPage(_getGeneralOptionList(), {
        title: _('General'),
        icon_name: 'preferences-system-symbolic',
    });

    window.add(generalOptionsPage);

    customPages = [];

    customPages.push(getAdwPage(_getPopupOptionList(), {
        title: _('Pop-up'),
        icon_name: 'user-available-symbolic',
    }));
    customPages.push(getAdwPage(_getColorOptionList(), {
        title: _('Colors'),
        icon_name: 'applications-graphics-symbolic',
    }));
    customPages.push(getAdwPage(_getSizeTextOptionList(), {
        title: _('Size & Text'),
        icon_name: 'view-fullscreen-symbolic',
    }));
    customPages.push(getAdwPage(_getContentOptionList(), {
        title: _('Content'),
        icon_name: 'view-reveal-symbolic',
    }));
    customPages.push(getAdwPage(_getWorkspacesOptionList(), {
        title: _('Workspace Names'),
        icon_name: 'text-editor-symbolic',
    }));
    customPages.push(getAdwPage(_getPresetsOptionList(), {
        title: _('Profiles'),
        icon_name: 'view-list-bullet-symbolic',
    }));

    window.set_search_enabled(true);

    windowWidget = window;
    _updateAdwActivePages();

    gOptions.connect('changed::popup-mode', _updateAdwActivePages);
    window.connect('destroy', _onDestroy);

    return window;
}

function _onDestroy() {
    prevPopupMode = -1;
    gOptions.destroy();
    gOptions = null;
    customPages = null;
    wsEntries = null;
    windowWidget = null;
}

function _updateAdwActivePages() {
    const mode = gOptions.get('popupMode');
    if (_shouldUpdatePages(mode)) {
        for (let page of customPages) {
            if (mode < 2) {
                windowWidget.add(page);
            } else {
                windowWidget.remove(page);
            }
        }
    }
    prevPopupMode = mode;
}

function _shouldUpdatePages(mode) {
    if ((prevPopupMode > 1 && mode < 2) || ([0, 1].includes(prevPopupMode) && mode > 1) || (prevPopupMode === -1 && mode < 2)) {
        return true;
    } else {
        return false;
    }
}

function _updateLegacyActivePages() {
    const mode = gOptions.get('popupMode');
    if (_shouldUpdatePages(mode)) {
        for (let page of customPages) {
            if (mode < 2) {
                windowWidget.append_page(...page);
            } else {
                // remove last page
                windowWidget.remove_page( -1);
            }
        }
    }
    prevPopupMode = mode;
}

// this function is called by GS prior to 42 and also by 42 if fillPreferencesWindow not available
function buildPrefsWidget() {
    const optionsNotebook = new Gtk.Notebook({
        tab_pos: Gtk.PositionType.TOP,
    });

    const generalOptionsPage    = getLegacyPage(_getGeneralOptionList());
    const popupOptionsPage      = getLegacyPage(_getPopupOptionList());
    const colorOptionsPage      = getLegacyPage(_getColorOptionList())
    const sizeTextOptionsPage   = getLegacyPage(_getSizeTextOptionList());
    const contentOptionsPage    = getLegacyPage(_getContentOptionList());
    const workspacesOptionsPage = getLegacyPage(_getWorkspacesOptionList());
    const presetsOptionsPage    = getLegacyPage(_getPresetsOptionList());

    optionsNotebook.append_page(generalOptionsPage, new Gtk.Label({
        label: _('General'),
        halign: Gtk.Align.START,
    }));

    customPages = [];

    customPages.push([popupOptionsPage, new Gtk.Label({
        label: _('Pop-up'),
        halign: Gtk.Align.START,
    })]);

    customPages.push([sizeTextOptionsPage, new Gtk.Label({
        label: _('Size & Text'),
        halign: Gtk.Align.START,
    })]);

    customPages.push([colorOptionsPage, new Gtk.Label({
        label: _('Colors'),
        halign: Gtk.Align.START,
    })]);

    customPages.push([contentOptionsPage, new Gtk.Label({
        label: _('Content'),
        halign: Gtk.Align.START,
    })]);

    customPages.push([workspacesOptionsPage, new Gtk.Label({
        label: _('Workspace Names'),
        halign: Gtk.Align.START,
    })]);

    customPages.push([presetsOptionsPage, new Gtk.Label({
        label: _('Presets'),
        halign: Gtk.Align.START,
    })]);

    windowWidget = optionsNotebook;
    _updateLegacyActivePages();
    gOptions.connect('changed::popup-mode', _updateLegacyActivePages);

    optionsNotebook.show_all && optionsNotebook.show_all();

    optionsNotebook.connect('destroy', _onDestroy);

    return optionsNotebook;
}


function _getGeneralOptionList() {
    const optionList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Workspace Switcher Pop-up')),
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Mode'),
            'Switcher can display untouched Default pop-up or customized one showing either boxes for all workspaces or the active one only.',
            _newComboBox(),
            'popupMode',
            [   [_('Custom: All Workspaces'), 0],
                [_('Custom: Active Workspace Only'), 1],
                [_('Default: No Customizations'), 3],
                [_('Disable'), 2],
            ]
        )
    );
    optionList.push(
        _optionsItem(
            _makeTitle(_('Workspaces')),
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Dynamic Workspaces'),
            _(`Dynamic - workspaces can be created on demand, and are automaticaly removed when empty.
Static - number of workspaces is fixed to the number you can set below.`),
            _newGtkSwitch(),
            'dynamicWorkspaces'
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
    numScale.add_mark(4, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Number of Workspaces in Static Mode'),
            _('Max number of 36 is given by GNOME.'),
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
            _('Changes the axis (horizontal / vertical) in which workspaces are organized, depending on the default state that is recorded during the start of this extension. The switcher pop-up reflects this option automatically.\nThis option breaks overview (visually) in GS 40+, but is usable in 3.36/3.38.'),
            _newGtkSwitch(),
            'reverseWsOrientation'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Workspace Switcher')),
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Wraparound'),
            _('Continue from the last workspace to the first and vice versa.'),
            _newGtkSwitch(),
            'wsSwitchWrap'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Ignore Last (empty) Workspace'),
            _('In Dynamic workspace mode, there is always one empty workspace at the end. Switcher can ignore this last workspace.'),
            _newGtkSwitch(),
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
            _makeTitle(_('Behavior')),
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Monitor'),
            _('The monitor on which the workspace switcher pop-up should appear. The Current monitor is determined by the mouse pointer location.'),
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
            _("Time after which the pop-up fade out"),
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
            _(`Display Until Modifier Keys Released`),
            _('Keeps the pop-up on the screen until modifier keys (Shift, Ctrl, Super, Alt) are released. Similar as Alt-Tab switcher works.'),
            _newGtkSwitch(),
            'modifiersHidePopup'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Position on Screen')),
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
            _('Draw the switcher pop-up vertically instead of horizontaly and vice versa.'),
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
            _makeTitle(_("Pop-up Active Workspace Indicator Content")),
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
             _('Show Workspace Index'),
             _('Active workspace box shows workspace index.'),
             _newGtkSwitch(),
             'activeShowWsIndex'
         )
     );
    //-----------------------------------------------------
    optionList.push(
       _optionsItem(
            _('Show Workspace Name'),
            _('Active workspace box shows workspace name if the name is set.'),
            _newGtkSwitch(),
            'activeShowWsName'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Current App Name'),
            _('Active workspace box shows the name of the most recently used application on the represented workspace.'),
            _newGtkSwitch(),
            'activeShowAppName'
         )
     );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Current Window Title'),
            _('Active workspace box shows the title of the most recently used window on the represented workspace.'),
            _newGtkSwitch(),
            'activeShowWinTitle'
         )
     );

    //+++++++++++++++++++++++++++++++++++++++++++++++++++++
    optionList.push(
        _optionsItem(
            _makeTitle(_('Pop-up Inactive Workspace Indicator Content')),
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
             _('Show Workspace Index'),
             _('Inactive workspace box shows workspace index.'),
             _newGtkSwitch(),
             'inactiveShowWsIndex'
         )
     );
    //-----------------------------------------------------
    optionList.push(
       _optionsItem(
            _('Show Workspace Name'),
            _('Inactive workspace box shows workspace name if the name is set.'),
            _newGtkSwitch(),
            'inactiveShowWsName'
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Current App Name'),
            _('Inactive workspace box shows the name of the most recently used application on represented workspace.'),
            _newGtkSwitch(),
            'inactiveShowAppName'
         )
     );
     //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _('Show Current Window Title'),
            _('Inactive workspace box shows the title of the most recently used window on the represented workspace.'),
            _newGtkSwitch(),
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
            _makeTitle(_('Pop-up Proportions')),
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
            _('Global Scale (%)'),
            _("Adjusts size of the pop-up relative to the original."),
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
            _('WS Box Width Scale (%)'),
            _("Allows to change workspace box ratio."),
            boxWidth,
            'popupWidthScale'
        )
    );
    //-----------------------------------------------------
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
            _("Adjusts background padding."),
            padding,
            'popupPaddingScale'
        )
    );
    //-----------------------------------------------------
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
            _("Adjusts space between workspace boxes."),
            spacing,
            'popupSpacingScale'
        )
    );
    //-----------------------------------------------------
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
            _("Adjusts radius of all corners."),
            radius,
            'popupRadiusScale'
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
            _('Font Size Scale (%)'),
            _('Size resizes acording to the pop-up sclae, use this scale to precisely adjust the text size.'),
            fsScale,
            'fontScale',
        )
    );
    //-----------------------------------------------------
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
            _makeTitle(_('Pop-up Opacity')),
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
    opacityScale.add_mark(98, Gtk.PositionType.TOP, null);

    optionList.push(
        _optionsItem(
            _('Global Opacity (%)'),
            _('Sets transparency of the pop-up as a whole.'),
            opacityScale,
            'popupOpacity',
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Pop-up Colors')),
            null
        )
    );
    //-----------------------------------------------------
    optionList.push(
        _optionsItem(
            _makeTitle(_('Allow Custom Colors ↓')),
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
            _('Text and other forground graphics.'),
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
            _('Text and other forground graphics.'),
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

function _getPresetsOptionList() {
    const optionList = [];

    optionList.push(
        _optionsItem(
            _makeTitle(_('Predefined Pop-up Customizations')),
            _('Because pop-up adjustments are relative to the default popup, results may vary depending on the shell theme.')
        )
    );

    optionList.push(
        _optionsItem(
            _('Preset 1'),
            null,
            _newGtkButton(),
            'preset',
            [
                // popup mode,
                0,
                // scale, box width, padding, spacing, radius, font size, index size, wrap text, shadow, bold,
                66, 133, 200, 180, 180, 133, 300, true, false, true,
                // global opacity, bg col, border col, active fg, active bg, inactive fg, inactive bg
                98, 'rgb(29,29,29)', 'rgb(53,53,53)', 'rgb(255,255,255)', 'rgb(105,0,0)', 'rgb(255,255,255)', 'rgb(53,53,53)',
                // act show index, act show ws, act show app, inact show index, inact show ws, inact show app
                false, false, true, false, false, false, true, false
            ]
        )
    );

    optionList.push(
        _optionsItem(
            _('Preset 2'),
            null,
            _newGtkButton(),
            'preset',
            [
                // popup mode,
                0,
                // scale, box width, padding, spacing, radius, font size, index size, wrap text, shadow, bold,
                40, 55, 250, 250, 700, 100, 100, true, false, true,
                // global opacity, bg col, border col, active fg, active bg, inactive fg, inactive bg
                98, '#1D1D1D', '#353535', '#FFFFFF', '#0070FF', '#FFFFFF', '#353535',
                // act show index, act show ws, act show app, inact show index, inact show ws, inact show app
                false, false, false, false, false, false, false, false
            ]
        )
    );

    optionList.push(
        _optionsItem(
            _('Preset 3'),
            null,
            _newGtkButton(),
            'preset',
            [
                // popup mode,
                1,
                // scale, box width, padding, spacing, radius, font size, index size, wrap text, shadow, bold,
                527, 150, 100, 100, 100, 120, 230, false, true, true,
                // global opacity, bg col, border col, active fg, active bg, inactive fg, inactive bg,
                98, 'rgba(53,53,53,0)', 'rgba(53,53,53,0)', 'rgba(0,0,0,0.564189)', 'rgba(53,53,53,0)', 'rgb(255,255,255)', '#353535',
                // act show index, act show ws, act show app, inact show index, inact show ws, inact show app
                true, false, true, true, false, false, false, false
            ]
        )
    );

    optionList.push(
        _optionsItem(
            _('Preset 4'),
            null,
            _newGtkButton(),
            'preset',
            [
                // popup mode,
                1,
                // scale, box width, padding, spacing, radius, font size, index size, wrap text, shadow, bold,
                100, 57, 200, 100, 700, 150, 500, false, false, true,
                // global opacity, bg col, border col, active fg, active bg, inactive fg, inactive bg,
                98, 'rgba(29,29,29,0.689189)', 'rgba(53,53,53,0)', 'rgb(255,255,255)', 'rgb(233,84,32)', '#FFFFFF', '#353535',
                // act show index, act show ws, act show app, inact show index, inact show ws, inact show app
                true, false, false, false, false, false, false, false
            ]
        )
    );

    return optionList;
}

///////////////////////////////////////////////////
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
            if (group) {
                page.add(group);
            }
            group = new Adw.PreferencesGroup({
                title: option,
                hexpand: true,
                width_request: groupWidth
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
        })
        /*for (let i of item) {
            box[box.add ? 'add' : 'append'](i);*/
        grid.attach(option, 0, 0, 6, 1);
        if (widget) {
            grid.attach(widget, 6, 0, 3, 1);
        }
        row.set_child(grid);
        group.add(row);
    }
    page.add(group);
    return page;
}

function getLegacyPage(optionList) {
    const page = new Gtk.ScrolledWindow({
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.NEVER,
        vexpand: true,
        hexpand: true,
    });

    const context = page.get_style_context();
    context.add_class('background');

    const mainBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 5,
        homogeneous: false,
        margin_start: 16,
        margin_end: 16,
        margin_top: 16,
        margin_bottom: 16,
    });

    let frame;
    let frameBox;

    for (let item of optionList) {
        // item structure: [labelBox, control widget]
        const option = item[0];
        const widget = item[1];
        if (!widget) {
            // new section
            let lbl = new Gtk.Label({
                xalign: 0,
                margin_top: 4,
                margin_bottom: 2
            });
            lbl.set_markup(option); // option is plain text if item is section title
            mainBox[mainBox.add ? 'add' : 'append'](lbl);
            frame = new Gtk.Frame({
                margin_bottom: 10,
            });
            frameBox = new Gtk.ListBox({
                selection_mode: null,
            });
            mainBox[mainBox.add ? 'add' : 'append'](frame);
            frame[frame.add ? 'add' : 'set_child'](frameBox);
            continue;
        }
        const grid = new Gtk.Grid({
            column_homogeneous: true,
            column_spacing: 10,
            margin_start: 8,
            margin_end: 8,
            margin_top: 8,
            margin_bottom: 8,
            hexpand: true,
        })

        grid.attach(option, 0, 0, 6, 1);
        if (widget) {
            grid.attach(widget, 6, 0, 3, 1);
        }
        /*if (item.length === 2)
            box.set_tooltip_text(itemTooltip);*/
        frameBox[frameBox.add ? 'add' : 'append'](grid);
    }

    page[page.add ? 'add' : 'set_child'](mainBox);
    page.show_all && page.show_all();

    return page;
}

function _newGtkSwitch() {
    let sw = new Gtk.Switch({
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true,
    });
    sw.is_switch = true;
    return sw;
}

function _newSpinButton(adjustment) {
    let spinButton = new Gtk.SpinButton({
        halign: Gtk.Align.END,
        hexpand: true,
        xalign: 0.5,
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
    });
    const renderer = new Gtk.CellRendererText();
    comboBox.pack_start(renderer, true);
    comboBox.add_attribute(renderer, 'text', 0);
    comboBox.is_combo_box = true;
    return comboBox;
}

function _newGtkEntry() {
    const entry = new Gtk.Entry({
        width_chars: 25,
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
        const color = gOptions.get('defaultColors')[colIndex];
        if (!color) return;
        const rgba = colorBtn.get_rgba();
        const success = rgba.parse(color);
        if (success)
            colorBtn.set_rgba(rgba);
        gOptions.set(colorBtn._gsettingsVar, rgba.to_string());
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

function _newGtkButton() {
    const button = new Gtk.Button({
        label: 'Apply',
        hexpand: false,
        halign: Gtk.Align.END
    });
    button.is_button = true;

    return button;
}

function _optionsItem(text, tooltip, widget, variable, options = []) {
    /*if (widget && gOptions.get(variable) === undefined && variable != 'preset') {
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

        label[label.add ? 'add' : 'append'](option);

        if (tooltip) {
            const caption = new Gtk.Label({
                halign: Gtk.Align.START,
                wrap: true,
                xalign: 0
            })
            const context = caption.get_style_context();
            context.add_class('dim-label');
            context.add_class('caption');
            caption.set_text(tooltip);
            label[label.add ? 'add' : 'append'](caption);
        }

    } else {
        label = text;
    }
    item.push(label);
    item.push(widget);

    if (widget && widget.is_switch) {
        widget.active = gOptions.get(variable);
        widget.connect('notify::active', () => {
            gOptions.set(variable, widget.active);
        });
        widget._updateValue = () => {
            widget.set_active(gOptions.get(variable));
        };
        // store widget for future updates
        widgets.push(widget);

    } else if (widget && widget.is_spinbutton) {
        widget.value = gOptions.get(variable);
        widget.timeout_id = null;
        widget.connect('value-changed', () => {
            widget.update();
            if (widget.timeout_id)
                GLib.Source.remove(widget.timeout_id);

            widget.timeout_id = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                500,
                () => {
                    gOptions.set(variable, widget.value);
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
            if (value === gOptions.get(variable))
                widget.set_active_iter(iter);
        }
        widget.connect('changed', () => {
            const [success, iter] = widget.get_active_iter();
            if (!success)
                return;

            gOptions.set(variable, model.get_value(iter, 1));
        });
        widget._updateValue = () => {
            widget.set_active(gOptions.get(variable));
        };
        // store widget for future updates
        widgets.push(widget);

    } else if (widget && widget.is_entry) {
        if (options) {
            const names = gOptions.get(variable);
            if (names[options - 1])
                widget.set_text(names[options - 1]);

            widget.set_placeholder_text(_('Workspace') + ` ${options}`);

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
                        gOptions.set('wsNames', names);
                        entry._timeout_id = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                )
            });

            wsEntries.push(widget);
        }

    } else if (widget && widget.is_scale) {
        widget.set_value(gOptions.get(variable));
        widget.connect('value-changed', (w) => {
            if (w._timeout_id)
                GLib.source_remove(w._timeout_id);
            w._timeout_id = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                300,
                () => {
                    gOptions.set(variable, w.get_value());
                    w._timeout_id = 0;
                    return GLib.SOURCE_REMOVE;
                }
            )
        });
        widget._updateValue = () => {
            widget.set_value(gOptions.get(variable));
        };
        // store widget for future updates
        widgets.push(widget);

    } else if (widget && (widget.is_color_btn || widget.is_color_box)) {
        let colorBtn;
        if (widget.is_color_box) {
            colorBtn = widget.colorBtn;
        } else {
            colorBtn = widget;
        }
        const rgba = colorBtn.get_rgba();
        rgba.parse(gOptions.get(variable));
        colorBtn.set_rgba(rgba);
        colorBtn.connect('color_set', () => {
            gOptions.set(variable, `${colorBtn.get_rgba().to_string()}`);
        });
        colorBtn._updateValue = () => {
            const rgba = colorBtn.get_rgba();
            rgba.parse(gOptions.get(variable));
            colorBtn.set_rgba(rgba);
        };
        // store widget for future updates
        widgets.push(colorBtn);
    } else if (widget && widget.is_button) {
        widget.connect('clicked', () => {
            gOptions.set('popupMode',options[0]);
            gOptions.set('popupScale',options[1]);
            gOptions.set('popupWidthScale',options[2]);
            gOptions.set('popupPaddingScale',options[3]);
            gOptions.set('popupSpacingScale',options[4]);
            gOptions.set('popupRadiusScale',options[5]);
            gOptions.set('fontScale',options[6]);
            gOptions.set('indexScale',options[7]);
            gOptions.set('wrapAppNames',options[8]);
            gOptions.set('textShadow',options[9]);
            gOptions.set('textBold',options[10]);
            gOptions.set('popupOpacity',options[11]);
            gOptions.set('popupBgColor',options[12]);
            gOptions.set('popupBorderColor',options[13]);
            gOptions.set('popupActiveFgColor',options[14]);
            gOptions.set('popupActiveBgColor',options[15]);
            gOptions.set('popupInactiveFgColor',options[16]);
            gOptions.set('popupInactiveBgColor',options[17]);
            gOptions.set('activeShowWsIndex',options[18]);
            gOptions.set('activeShowWsName',options[19]);
            gOptions.set('activeShowAppName',options[20]);
            gOptions.set('activeShowWinTitle',options[21]);
            gOptions.set('inactiveShowWsIndex',options[22]);
            gOptions.set('inactiveShowWsName',options[23]);
            gOptions.set('inactiveShowAppName',options[24]);
            gOptions.set('inactiveShowWinTitle',options[25]);
            gOptions.set('allowCustomColors',true);
            // update controls
            for (widget of widgets) {
                widget._updateValue();
            }
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
