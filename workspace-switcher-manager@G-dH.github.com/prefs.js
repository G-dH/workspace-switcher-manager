/**
 * Workspaces Switcher Manager
 * prefs.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022 - 2024
 * @license    GPL-3.0
 */
'use strict';

const { Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.settings;
const OptionsFactory = Me.imports.optionsFactory;

// gettext
let _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;

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
        this.opt = new Me.imports.settings.Options(Me);
        Me.opt = this.opt;
        Me._ = _;

        OptionsFactory.init(Me);

        this._prevPopupMode = -1;

        const GENERAL_TITLE = _('General');
        const GENERAL_ICON = 'preferences-system-symbolic';
        const POPUP_TITLE = _('Pop-up');
        const POPUP_ICON = 'user-available-symbolic';
        const SIZE_TEXT_TITLE = _('Size & Text');
        const SIZE_TEXT_ICON = 'view-fullscreen-symbolic';
        const COLORS_TITLE = _('Colors');
        const COLORS_ICON = 'view-reveal-symbolic';
        const CONTENT_TITLE = _('Content');
        const CONTENT_ICON = 'text-editor-symbolic';
        const WS_TITLE = _('Workspaces');
        const WS_ICON = 'document-edit-symbolic';
        const PROFILE_TITLE = _('Profiles');
        const PROFILE_ICON = 'view-list-bullet-symbolic';
        const ABOUT_TITLE = _('About');
        const ABOUT_ICON = 'preferences-system-details-symbolic';

        const itemFactory = new OptionsFactory.ItemFactory(Me);

        const AdwPrefs = OptionsFactory.AdwPrefs;

        const generalOptionsPage = AdwPrefs.getAdwPage(_getGeneralOptionList(itemFactory), {
            title: GENERAL_TITLE,
            icon_name: GENERAL_ICON,
        });

        window.add(generalOptionsPage);

        this._customPages = [
            AdwPrefs.getAdwPage(_getPopupOptionList(itemFactory), {
                title: POPUP_TITLE,
                icon_name: POPUP_ICON,
            }),
            AdwPrefs.getAdwPage(_getSizeTextOptionList(itemFactory), {
                title: SIZE_TEXT_TITLE,
                icon_name: SIZE_TEXT_ICON,
            }),
            AdwPrefs.getAdwPage(_getColorOptionList(itemFactory), {
                title: COLORS_TITLE,
                icon_name: COLORS_ICON,
            }),
            AdwPrefs.getAdwPage(_getContentOptionList(itemFactory), {
                title: CONTENT_TITLE,
                icon_name: CONTENT_ICON,
            }),
            AdwPrefs.getAdwPage(_getWorkspacesOptionList(itemFactory), {
                title: WS_TITLE,
                icon_name: WS_ICON,
            }),
            AdwPrefs.getAdwPage(_getProfilesOptionList(itemFactory), {
                title: PROFILE_TITLE,
                icon_name: PROFILE_ICON,
            }),
            AdwPrefs.getAdwPage(_getAboutOptionList(itemFactory), {
                title: ABOUT_TITLE,
                icon_name: ABOUT_ICON,
            }),
        ];

        window.set_search_enabled(true);

        this._windowWidget = window;
        this._updateAdwActivePages();

        this.opt.connect('changed::popup-mode', this._updateAdwActivePages.bind(this));
        this.opt.connect('changed::popup-visibility', this._updateAdwActivePages.bind(this));
        window.connect('close-request', this._onDestroy.bind(this));

        const height = 700;
        window.set_default_size(-1, height);

        return window;
    }

    _onDestroy() {
        this._prevPopupMode = -1;
        Me.opt.destroy();
        Me.opt = null;
        this.opt = null;
        this._customPages = null;
        this._windowWidget = null;
    }

    _updateAdwActivePages() {
        let mode = this.opt.get('popupMode');
        const visibility = this.opt.get('popupVisibility');
        // combine these two options into one
        mode = visibility ? mode : 3;
        const aboutPageIndex = this._customPages.length - 1;
        // update if needed
        if (!([0, 1].includes(mode) && [0, 1].includes(this._prevPopupMode))) {
            // remove all custom pages
            this._customPages.forEach(page => {
                if (page.get_parent())
                    this._windowWidget.remove(page);
            });

            // only add pages that can be used
            for (let i = 0; i <= aboutPageIndex; i++) {
                // default style needs only the first page
                if ((mode === 2 && i === 0) || mode < 2 || i === aboutPageIndex)
                    this._windowWidget.add(this._customPages[i]);
            }
        }

        this._prevPopupMode = mode;
    }
}

// ///////////////////////////////////////////////////////////////////

function _getGeneralOptionList(itemFactory) {
    const optionList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace Switcher Pop-up')
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Visibility'),
            'Switcher can display untouched Default pop-up or customized one showing either boxes for all workspaces or the active one only',
            itemFactory.newDropDown(),
            'popupVisibility',
            [
                [_('Show'), 1],
                [_('Hide'), 0],
            ]
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspaces')
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Dynamic Workspaces'),
            _(`Dynamic - workspaces can be created on demand, and are automatically removed when empty.
Static - number of workspaces is fixed to the number you can set below.`),
            itemFactory.newSwitch(),
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

    const numScale = itemFactory.newScale(numAdjustment);
    numScale.add_mark(4, Gtk.PositionType.TOP, null);

    optionList.push(
        itemFactory.getRowWidget(
            _('Number of Workspaces in Static Mode'),
            _('Max number of 36 is given by GNOME'),
            numScale,
            'numWorkspaces'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspaces on Primary Display Only'),
            _('Additional displays are treated as independent workspaces or the current workspace includes additional displays'),
            itemFactory.newSwitch(),
            'workspacesOnPrimaryOnly'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Reverse Workspace Orientation'),
            _('Changes the axis in which workspaces are organized, from horizontal to vertical'),
            itemFactory.newSwitch(),
            'reverseWsOrientation'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace Switcher')
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Wraparound'),
            _('Continue from the last workspace to the first and vice versa'),
            itemFactory.newSwitch(),
            'wsSwitchWrap'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Ignore Last (empty) Workspace'),
            _('In Dynamic workspaces mode, there is always one empty workspace at the end. Switcher can ignore this last workspace'),
            itemFactory.newSwitch(),
            'wsSwitchIgnoreLast'
        )
    );

    return optionList;
}


function _getPopupOptionList(itemFactory) {
    const optionList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    optionList.push(
        itemFactory.getRowWidget(
            _('Behavior')
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Mode'),
            'Switcher can display visually untouched Default pop-up or a customized one, showing either boxes for all workspaces or the active one only',
            itemFactory.newDropDown(),
            'popupMode',
            [
                [_('Custom: All Workspaces'), 0],
                [_('Custom: Active Workspace Only'), 1],
                [_('Default: No Style Customizations'), 2],
            ]
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Monitor'),
            _('The monitor on which the workspace switcher pop-up should appear. The Current monitor is determined by the mouse pointer location'),
            itemFactory.newDropDown(),
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

    const tScale = itemFactory.newScale(popupTimeoutAdjustment);
    tScale.add_mark(600, Gtk.PositionType.TOP, null);

    optionList.push(
        itemFactory.getRowWidget(
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

    const fadeScale = itemFactory.newScale(fadeOutAdjustment);
    fadeScale.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        itemFactory.getRowWidget(
            _('Fade Out Time (ms)'),
            _('Duration of fade out animation'),
            fadeScale,
            'fadeOutTime'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Display Until Modifier Keys Released'),
            _('Keeps the pop-up on the screen until modifier keys (Shift, Ctrl, Super, Alt) are released. Similar as Alt-Tab switcher works'),
            itemFactory.newSwitch(),
            'modifiersHidePopup'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Position on Screen')
        )
    );
    // -----------------------------------------------------
    const hAdjustment = new Gtk.Adjustment({
        lower: 0,
        upper: 100,
        step_increment: 1,
        page_increment: 1,
    });

    const hScale = itemFactory.newScale(hAdjustment);
    hScale.add_mark(50, Gtk.PositionType.TOP, null);

    optionList.push(
        itemFactory.getRowWidget(
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

    const vScale = itemFactory.newScale(vAdjustment);
    vScale.add_mark(50, Gtk.PositionType.TOP, null);
    optionList.push(
        itemFactory.getRowWidget(
            _('Vertical (% from top)'),
            null,
            vScale,
            'popupVertical'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Orientation')
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Reverse Orientation'),
            _('Draw the switcher pop-up vertically instead of horizontally and vice versa'),
            itemFactory.newSwitch(),
            'reversePopupOrientation'
        )
    );


    return optionList;
}
// ////////////////////////////////////////////////

function _getContentOptionList(itemFactory) {
    const optionList = [];

    optionList.push(
        itemFactory.getRowWidget(
            _('Pop-up Active Workspace Indicator Content')
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Show Workspace Index'),
            _('Active workspace box shows workspace index'),
            itemFactory.newSwitch(),
            'activeShowWsIndex'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Show Workspace Name'),
            _('Active workspace box shows workspace name if the name is set'),
            itemFactory.newSwitch(),
            'activeShowWsName'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Show Current App Name'),
            _('Active workspace box shows the name of the most recently used application on the represented workspace'),
            itemFactory.newSwitch(),
            'activeShowAppName'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Show Current Window Title'),
            _('Active workspace box shows the title of the most recently used window on the represented workspace'),
            itemFactory.newSwitch(),
            'activeShowWinTitle'
        )
    );

    // +++++++++++++++++++++++++++++++++++++++++++++++++++++
    optionList.push(
        itemFactory.getRowWidget(
            _('Pop-up Inactive Workspace Indicator Content')
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Show Workspace Index'),
            _('Inactive workspace box shows workspace index'),
            itemFactory.newSwitch(),
            'inactiveShowWsIndex'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Show Workspace Name'),
            _('Inactive workspace box shows workspace name if the name is set'),
            itemFactory.newSwitch(),
            'inactiveShowWsName'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Show Current App Name'),
            _('Inactive workspace box shows the name of the most recently used application on represented workspace'),
            itemFactory.newSwitch(),
            'inactiveShowAppName'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Show Current Window Title'),
            _('Inactive workspace box shows the title of the most recently used window on the represented workspace'),
            itemFactory.newSwitch(),
            'inactiveShowWinTitle'
        )
    );

    return optionList;
}

// ////////////////////////////////////////////////

function _getSizeTextOptionList(itemFactory) {
    const optionList = [];

    optionList.push(
        itemFactory.getRowWidget(
            _('Pop-up Proportions (relative to the default WSM popup - the old GNOME 3 style'),
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

    const dpSize = itemFactory.newScale(dpSizeAdjustment);
    dpSize.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        itemFactory.getRowWidget(
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

    const boxWidth = itemFactory.newScale(boxWidthAdjustment);
    boxWidth.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        itemFactory.getRowWidget(
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

    const padding = itemFactory.newScale(paddingAdjustment);
    padding.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        itemFactory.getRowWidget(
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

    const spacing = itemFactory.newScale(spacingAdjustment);
    spacing.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        itemFactory.getRowWidget(
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

    const radius = itemFactory.newScale(radiusAdjustment);
    radius.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        itemFactory.getRowWidget(
            _('Corner Radius (%)'),
            _('Adjusts radius of all corners'),
            radius,
            'popupRadiusScale'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Text Size'),
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

    const fsScale = itemFactory.newScale(fontSizeAdjustment);
    fsScale.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        itemFactory.getRowWidget(
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

    const idxScale = itemFactory.newScale(idxSizeAdjustment);
    idxScale.add_mark(100, Gtk.PositionType.TOP, null);

    optionList.push(
        itemFactory.getRowWidget(
            _('WS Index Size Scale (%)'),
            _('If only "Show Workspace Index" text (or "Show App Name" on workspace without app) content option is active this scale takes effect. Single digit always looks smaller then longer text with the same font size'),
            idxScale,
            'indexScale'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Text Options'),
            null
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Wrap long App Names'),
            _('Application names with more than one word will be wrapped after the first word'),
            itemFactory.newSwitch(),
            'wrapAppNames'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Text Shadow'),
            _('Shadow helps text visibility on the background with the similar color'),
            itemFactory.newSwitch(),
            'textShadow'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Text Weight Bold'),
            null,
            itemFactory.newSwitch(),
            'textBold'
        )
    );

    return optionList;
}

function _getColorOptionList(itemFactory) {
    const optionList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    optionList.push(
        itemFactory.getRowWidget(
            _('Pop-up Opacity'),
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

    const opacityScale = itemFactory.newScale(opacityAdjustment);
    opacityScale.add_mark(98, Gtk.PositionType.TOP, null);

    optionList.push(
        itemFactory.getRowWidget(
            _('Global Opacity (%)'),
            _('Sets transparency of the pop-up as a whole'),
            opacityScale,
            'popupOpacity'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Pop-up Colors'),
            null
        )
    );
    // -----------------------------------------------------
    const bgColorBox = itemFactory.newColorButtonBox();
    const bgColorBtn = itemFactory.newColorButton();
    const bgColorReset = itemFactory.newColorResetBtn('popupBgColor', bgColorBtn);
    bgColorBox.colorBtn = bgColorBtn;
    bgColorBtn._gsettingsVar = 'popupBgColor';

    bgColorBox.append(bgColorBtn);
    bgColorBox.append(bgColorReset);

    optionList.push(
        itemFactory.getRowWidget(
            _('Background color / opacity'),
            null,
            bgColorBox,
            'popupBgColor'
        )
    );
    // -----------------------------------------------------
    const borderColorBox = itemFactory.newColorButtonBox();
    const borderColorBtn = itemFactory.newColorButton();
    const borderColorReset = itemFactory.newColorResetBtn('popupBorderColor', borderColorBtn);
    borderColorBox.colorBtn = borderColorBtn;
    borderColorBtn._gsettingsVar = 'popupBorderColor';

    borderColorBox.append(borderColorBtn);
    borderColorBox.append(borderColorReset);

    optionList.push(
        itemFactory.getRowWidget(
            _('Border color / opacity'),
            null,
            borderColorBox,
            'popupBorderColor'
        )
    );
    // -----------------------------------------------------
    const activeFgColorBox = itemFactory.newColorButtonBox();
    const activeFgColorBtn = itemFactory.newColorButton();
    const activeFgColorReset = itemFactory.newColorResetBtn('popupActiveFgColor', activeFgColorBtn);
    activeFgColorBox.colorBtn = activeFgColorBtn;
    activeFgColorBtn._gsettingsVar = 'popupActiveFgColor';

    activeFgColorBox.append(activeFgColorBtn);
    activeFgColorBox.append(activeFgColorReset);

    optionList.push(
        itemFactory.getRowWidget(
            _('Active WS Foreground color / opacity'),
            _('Text and other foreground graphics'),
            activeFgColorBox,
            'popupActiveFgColor'
        )
    );
    // -----------------------------------------------------
    const activeBgColorBox = itemFactory.newColorButtonBox();
    const activeBgColorBtn = itemFactory.newColorButton();
    const activeBgColorReset = itemFactory.newColorResetBtn('popupActiveBgColor', activeBgColorBtn);
    activeBgColorBox.colorBtn = activeBgColorBtn;
    activeBgColorBtn._gsettingsVar = 'popupActiveBgColor';

    activeBgColorBox.append(activeBgColorBtn);
    activeBgColorBox.append(activeBgColorReset);

    optionList.push(
        itemFactory.getRowWidget(
            _('Active WS Background color  / opacity'),
            null,
            activeBgColorBox,
            'popupActiveBgColor'
        )
    );
    // -----------------------------------------------------
    const inactiveFgColorBox = itemFactory.newColorButtonBox();
    const inactiveFgColorBtn = itemFactory.newColorButton();
    const inactiveFgColorReset = itemFactory.newColorResetBtn('popupInactiveFgColor', inactiveFgColorBtn);
    inactiveFgColorBox.colorBtn = inactiveFgColorBtn;
    inactiveFgColorBtn._gsettingsVar = 'popupInactiveFgColor';

    inactiveFgColorBox.append(inactiveFgColorBtn);
    inactiveFgColorBox.append(inactiveFgColorReset);

    optionList.push(
        itemFactory.getRowWidget(
            _('Inactive WS Foreground color / opacity'),
            _('Text and other foreground graphics'),
            inactiveFgColorBox,
            'popupInactiveFgColor'
        )
    );
    // -----------------------------------------------------
    const inactiveBgColorBox = itemFactory.newColorButtonBox();
    const inactiveBgColorBtn = itemFactory.newColorButton();
    const inactiveBgColorReset = itemFactory.newColorResetBtn('popupInactiveBgColor', inactiveBgColorBtn);
    inactiveBgColorBox.colorBtn = inactiveBgColorBtn;
    inactiveBgColorBtn._gsettingsVar = 'popupInactiveBgColor';

    inactiveBgColorBox.append(inactiveBgColorBtn);
    inactiveBgColorBox.append(inactiveBgColorReset);

    optionList.push(
        itemFactory.getRowWidget(
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

function _getWorkspacesOptionList(itemFactory) {
    const optionList = [];

    optionList.push(
        itemFactory.getRowWidget(
            _('Names'),
            _('Uses official GNOME gsettings key that can be read/modified by other applications')
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace 1'),
            null,
            itemFactory.newWsEntry(),
            'wsNames',
            1
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace 2'),
            null,
            itemFactory.newWsEntry(),
            'wsNames',
            2
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace 3'),
            null,
            itemFactory.newWsEntry(),
            'wsNames',
            3
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace 4'),
            null,
            itemFactory.newWsEntry(),
            'wsNames',
            4
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace 5'),
            null,
            itemFactory.newWsEntry(),
            'wsNames',
            5
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace 6'),
            null,
            itemFactory.newWsEntry(),
            'wsNames',
            6
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace 7'),
            null,
            itemFactory.newWsEntry(),
            'wsNames',
            7
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace 8'),
            null,
            itemFactory.newWsEntry(),
            'wsNames',
            8
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace 9'),
            null,
            itemFactory.newWsEntry(),
            'wsNames',
            9
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Workspace 10'),
            null,
            itemFactory.newWsEntry(),
            'wsNames',
            10
        )
    );

    return optionList;
}

// /////////////////////////////////////////////////

function _getProfilesOptionList(itemFactory) {
    const optionList = [];

    optionList.push(
        itemFactory.getRowWidget(
            _('Profiles allows you to save all settings (default profiles contain only popup configuration)')
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Profile 1:'),
            null,
            itemFactory.newProfileButton(1),
            'profile1'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Profile 2:'),
            null,
            itemFactory.newProfileButton(2),
            'profile2'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Profile 3:'),
            null,
            itemFactory.newProfileButton(3),
            'profile3'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Profile 4:'),
            null,
            itemFactory.newProfileButton(4),
            'profile4'
        )
    );
    // -----------------------------------------------------
    optionList.push(
        itemFactory.getRowWidget(
            _('Profile 5:'),
            null,
            itemFactory.newProfileButton(5),
            'profile5'
        )
    );

    return optionList;
}

// /////////////////////////////////////////////////

function _getAboutOptionList(itemFactory) {
    const optionList = [];

    optionList.push(itemFactory.getRowWidget(
        Me.metadata.name
    ));

    const versionName = Me.metadata['version-name'] ?? '';
    let version = Me.metadata['version'] ?? '';
    version = versionName && version ? `/${version}` : version;
    const versionStr = `${versionName}${version}`;
    optionList.push(itemFactory.getRowWidget(
        _('Version'),
        null,
        itemFactory.newLabel(versionStr)
    ));
    // -----------------------------------------------------
    optionList.push(itemFactory.getRowWidget(
        _('Reset all options'),
        _('Set all options to default values.'),
        itemFactory.newOptionsResetButton()
    ));
    // -----------------------------------------------------
    optionList.push(itemFactory.getRowWidget(
        _('Links')
    ));
    // -----------------------------------------------------
    optionList.push(itemFactory.getRowWidget(
        _('Homepage'),
        _('Source code and more info about this extension'),
        itemFactory.newLinkButton('https://github.com/G-dH/workspace-switcher-manager')
    ));
    // -----------------------------------------------------
    optionList.push(itemFactory.getRowWidget(
        _('GNOME Extensions'),
        _('Rate and comment V-Shell on the GNOME Extensions site'),
        itemFactory.newLinkButton('https://extensions.gnome.org/extension/4788')
    ));
    // -----------------------------------------------------
    optionList.push(itemFactory.getRowWidget(
        _('Report a bug or suggest new feature'),
        _('Help me to help you!'),
        itemFactory.newLinkButton('https://github.com/G-dH/workspace-switcher-manager/issues')
    ));
    // -----------------------------------------------------
    optionList.push(itemFactory.getRowWidget(
        _('Buy Me a Coffee'),
        _('Enjoying WSM? Consider supporting it by buying me a coffee!'),
        itemFactory.newLinkButton('https://buymeacoffee.com/georgdh')
    ));

    return optionList;
}
