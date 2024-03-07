/**
 * WSM (Workspace Switcher Manager)
 * optionsFactory.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022 - 2024
 * @license    GPL-3.0
 */

'use strict';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

// gettext
let _; //  = Settings._;

export function init(me) {
    _ = me._;
}

export function cleanGlobals() {
    _ = null;
}

export const ItemFactory = class ItemFactory {
    constructor(me) {
        this.opt = me.opt;
        this._settings = me.opt._gsettings;
        this._wsEntries = [];
        this._connectWsNames();
    }

    _connectWsNames() {
        const settings = this.opt._getWmPreferencesSettings();
        this.opt.connect('changed::workspace-names', (set, key) => {
            const wsNames = set.get_strv(key);
            this._doNotUpdateWsNames = true;
            for (let i = 0; i < this._wsEntries.length; i++) {
                if (i < this._wsEntries.length) {
                    const name = i < wsNames.length ? wsNames[i] : '';
                    const entry = this._wsEntries[i];
                    if (entry.get_text() !== name)
                        entry.set_text(name);
                }
            }
            this._doNotUpdateWsNames = false;
            return true;
        }, settings);
    }

    getRowWidget(text, caption, widget, variable, options = [], dependsOn) {
        let item = [];
        let label;
        if (widget) {
            label = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 4,
                halign: Gtk.Align.START,
                valign: Gtk.Align.CENTER,
            });
            const option = new Gtk.Label({
                halign: Gtk.Align.START,
            });
            option.set_text(text);
            label.append(option);

            if (caption) {
                const captionLabel = new Gtk.Label({
                    halign: Gtk.Align.START,
                    wrap: true,
                    /* width_chars: 80, */
                    xalign: 0,
                });
                const context = captionLabel.get_style_context();
                context.add_class('dim-label');
                context.add_class('caption');
                captionLabel.set_text(caption);
                label.append(captionLabel);
            }
            label._title = text;
        } else {
            label = text;
        }
        item.push(label);
        item.push(widget);

        let key;
        let settings;
        if (variable && this.opt.options[variable]) {
            const o = this.opt.options[variable];
            key = o[1];
            settings = o[2] ? o[2]() : this.opt._gsettings;
        }

        if (widget) {
            if (widget._isSwitch)
                this._connectSwitch(widget, settings, key, variable);
            else if (widget._isSpinButton || widget._isScale)
                this._connectSpinButton(widget, settings, key, variable);
            else if (widget._isDropDown)
                this._connectDropDown(widget, settings, key, variable, options);
            else if (widget._isColorBtn || widget._isColorBox)
                this._connectColorBtn(widget, settings, key, variable);
            else if (widget._isWsEntry)
                this._connectWsEntry(widget, settings, key, variable, options);

            if (dependsOn) {
                const dKey = this.opt.options[dependsOn][1];
                this._settings.bind(dKey, widget, 'sensitive', Gio.SettingsBindFlags.GET);
            }
        }

        return item;
    }

    _connectSwitch(widget, settings, key) {
        settings.bind(key, widget, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

    // Used also for Scale
    _connectSpinButton(widget, settings, key) {
        settings.bind(key, widget.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);
    }

    _connectScale(widget, settings, key) {
        settings.bind(key, widget.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);
    }

    _connectDropDown(widget, settings, key, variable, options) {
        const model = widget.get_model();
        const currentValue = this.opt.get(variable);
        for (let i = 0; i < options.length; i++) {
            const text = options[i][0];
            const id = options[i][1];
            model.append(new DropDownItem({ text, id }));
            if (id === currentValue)
                widget.set_selected(i);
        }

        const factory = new Gtk.SignalListItemFactory();
        factory.connect('setup', (fact, listItem) => {
            const label = new Gtk.Label({ xalign: 0 });
            listItem.set_child(label);
        });
        factory.connect('bind', (fact, listItem) => {
            const label = listItem.get_child();
            const item = listItem.get_item();
            label.set_text(item.text);
        });

        widget.connect('notify::selected-item', dropDown => {
            const item = dropDown.get_selected_item();
            this.opt.set(variable, item.id);
        });

        this.opt.connect(`changed::${key}`, () => {
            const newId = this.opt.get(variable, true);
            for (let i = 0; i < options.length; i++) {
                const id = options[i][1];
                if (id === newId)
                    widget.set_selected(i);
            }
        });

        widget.set_factory(factory);
    }

    _connectColorBtn(widget, settings, key, variable) {
        let colorBtn;
        if (widget._isColorBox)
            colorBtn = widget.colorBtn;
        else
            colorBtn = widget;

        const rgba = colorBtn.get_rgba();
        rgba.parse(this.opt.get(variable));
        colorBtn.set_rgba(rgba);

        colorBtn.connect('color_set', () => {
            this.opt.set(variable, `${colorBtn.get_rgba().to_string()}`);
        });

        this.opt.connect(`changed::${key}`, () => {
            const rgba = colorBtn.get_rgba();
            rgba.parse(this.opt.get(variable));
            colorBtn.set_rgba(rgba);
        });
    }

    _connectWsEntry(widget, settings, key, variable, index) {
        if (index) {
            const names = this.opt.get(variable);
            if (names[index - 1])
                widget.set_text(names[index - 1]);

            widget.set_placeholder_text(`${_('Workspace')} ${index}`);

            widget.connect('changed', () => {
                if (this._doNotUpdateWsNames)
                    return;
                const names = [];
                this._wsEntries.forEach(e => {
                    names.push(e.get_text().trim());
                });
                // remove trailing unset names
                for (let i = names.length - 1; i >= 0; i--) {
                    if (names[i])
                        break;
                    names.pop();
                }
                this.opt.set(variable, names);
            });

            this._wsEntries.push(widget);
        }
    }

    newSwitch() {
        let sw = new Gtk.Switch({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        sw._isSwitch = true;
        return sw;
    }

    newSpinButton(adjustment) {
        let spinButton = new Gtk.SpinButton({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            vexpand: false,
            xalign: 0.5,
        });
        spinButton.set_adjustment(adjustment);
        spinButton._isSpinButton = true;
        return spinButton;
    }

    newComboBox() {
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
        comboBox._isComboBox = true;
        return comboBox;
    }

    newDropDown() {
        const dropDown = new Gtk.DropDown({
            model: new Gio.ListStore({
                item_type: DropDownItem,
            }),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        dropDown._isDropDown = true;
        return dropDown;
    }

    newScale(adjustment) {
        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            draw_value:  true,
            has_origin:  false,
            value_pos:   Gtk.PositionType.LEFT,
            digits:      0,
            halign:      Gtk.Align.END,
            valign:      Gtk.Align.CENTER,
            hexpand:     true,
            vexpand:     false,
        });
        scale.set_size_request(300, -1);
        scale.set_adjustment(adjustment);
        scale._isScale = true;
        return scale;
    }

    newLabel(text = '') {
        const label = new Gtk.Label({
            label: text,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        label._activatable = false;
        return label;
    }

    newLinkButton(uri) {
        const linkBtn = new Gtk.LinkButton({
            uri,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            icon_name: 'emblem-symbolic-link',
        });
        return linkBtn;
    }

    newButton() {
        const btn = new Gtk.Button({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });

        btn._activatable = true;
        return btn;
    }

    newWsEntry() {
        const entry = new Gtk.Entry({
            width_chars: 40,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            xalign: 0,
        });
        entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'edit-clear-symbolic');
        entry.set_icon_activatable(Gtk.EntryIconPosition.SECONDARY, true);
        entry.connect('icon-press', e => e.set_text(''));
        entry._isWsEntry = true;
        return entry;
    }

    newColorButton() {
        const colorBtn = new Gtk.ColorButton({
            hexpand: true,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        colorBtn.set_use_alpha(true);
        colorBtn._isColorBtn = true;

        return colorBtn;
    }

    newColorResetBtn(gColor, colorBtn) {
        const colorReset = new Gtk.Button({
            hexpand: false,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });
        colorReset.set_tooltip_text(_('Reset color to default value'));

        if (colorReset.set_icon_name)
            colorReset.set_icon_name('edit-clear-symbolic');
        else
            colorReset.add(Gtk.Image.new_from_icon_name('edit-clear-symbolic', Gtk.IconSize.BUTTON));

        colorReset.connect('clicked', () => {
            const color = this.opt.getDefault(gColor);
            if (!color)
                return;
            const rgba = colorBtn.get_rgba();
            const success = rgba.parse(color);
            if (success)
                colorBtn.set_rgba(rgba);
            this.opt.set(colorBtn._gsettingsVar, rgba.to_string());
        });

        return colorReset;
    }

    newColorButtonBox() {
        const box = new Gtk.Box({
            hexpand: true,
            spacing: 4,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });

        box._isColorBox = true;
        return box;
    }

    newProfileButton(profileIndex) {
        const load = this.opt.loadProfile.bind(this.opt);
        const save = this.opt.saveProfile.bind(this.opt);
        const reset = this.opt.resetProfile.bind(this.opt);

        const box = new Gtk.Box({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            spacing: 8,
        });
        box.is_profile_box = true;

        const entry = new Gtk.Entry({
            width_chars: 50,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            xalign: 0,
        });
        entry.set_text(this.opt.get(`profileName${profileIndex}`));
        entry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'edit-clear-symbolic');
        entry.set_icon_activatable(Gtk.EntryIconPosition.SECONDARY, true);

        const resetProfile = this.newButton();
        resetProfile.set({
            tooltip_text: _('Reset profile to defaults'),
            icon_name: 'document-revert-symbolic',
            hexpand: false,
            css_classes: ['destructive-action'],
        });

        const setName = () => {
            let name = this.opt.get(`profileName${profileIndex}`, true);
            entry.set_text(name);
        };

        setName();

        entry.connect('icon-press', e => {
            if (entry.get_text())
                e.set_text('');
            else
                e.set_text(this.opt.getDefault(`profileName${profileIndex}`));
        });
        entry.connect('changed', e => this.opt.set(`profileName${profileIndex}`, e.get_text()));

        resetProfile.connect('clicked', () => {
            reset(profileIndex);
            setName();
        });
        resetProfile._activatable = false;

        const loadProfile = this.newButton();
        loadProfile.set({
            tooltip_text: _('Load profile'),
            icon_name: 'view-refresh-symbolic',
            hexpand: false,
        });
        loadProfile.connect('clicked', () => load(profileIndex));
        loadProfile._activatable = false;

        const saveProfile = this.newButton();
        saveProfile.set({
            tooltip_text: _('Save current settings into this profile'),
            icon_name: 'document-save-symbolic',
            hexpand: false,
        });
        saveProfile.connect('clicked', () => save(profileIndex));
        saveProfile._activatable = false;

        box.append(entry);
        box.append(resetProfile);
        box.append(saveProfile);
        box.append(loadProfile);
        return box;
    }

    newResetButton(callback) {
        const btn = this.newButton();
        btn.set({
            css_classes: ['destructive-action'],
            icon_name: 'edit-delete-symbolic',
        });

        btn.connect('clicked', callback);
        btn._activatable = false;
        return btn;
    }

    newOptionsResetButton() {
        const btn = new Gtk.Button({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            css_classes: ['destructive-action'],
            icon_name: 'document-revert-symbolic',
        });

        btn.connect('clicked', () => {
            const settings = this._settings;
            settings.list_keys().forEach(
                key => settings.reset(key)
            );
        });
        btn._activatable = false;
        return btn;
    }
};

export const AdwPrefs = class {
    static getFilledWindow(window, pages) {
        for (let page of pages) {
            const title = page.title;
            const iconName = page.iconName;
            const optionList = page.optionList;

            window.add(
                this.getAdwPage(optionList, {
                    title,
                    icon_name: iconName,
                })
            );
        }

        window.set_search_enabled(true);

        return window;
    }

    static getAdwPage(optionList, pageProperties = {}) {
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

            const row = new Adw.ActionRow({
                title: option._title,
            });

            const grid = new Gtk.Grid({
                column_homogeneous: false,
                column_spacing: 20,
                margin_start: 8,
                margin_end: 8,
                margin_top: 8,
                margin_bottom: 8,
                hexpand: true,
            });
            /* for (let i of item) {
                box.append(i);*/
            grid.attach(option, 0, 0, 1, 1);
            if (widget)
                grid.attach(widget, 1, 0, 1, 1);

            row.set_child(grid);
            if (widget._activatable === false)
                row.activatable = false;
            else
                row.activatable_widget = widget;

            group.add(row);
        }
        page.add(group);
        return page;
    }
};

const { GObject } = imports.gi;
const DropDownItem = GObject.registerClass({
    GTypeName: 'DropDownItemWSM',
    Properties: {
        'text': GObject.ParamSpec.string(
            'text',
            'Text',
            'DropDown item text',
            GObject.ParamFlags.READWRITE,
            ''
        ),
        'id': GObject.ParamSpec.int(
            'id',
            'Id',
            'Item id stored in settings',
            GObject.ParamFlags.READWRITE,
            // min, max, default
            -2147483648, 2147483647, 0
        ),
    },
}, class DropDownItem extends GObject.Object {
    get text() {
        return this._text;
    }

    set text(text) {
        this._text = text;
    }

    get id() {
        return this._id;
    }

    set id(id) {
        this._id = id;
    }
});
