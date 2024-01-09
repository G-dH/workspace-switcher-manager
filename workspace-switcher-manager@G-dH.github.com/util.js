/**
 * Workspaces Switcher Manager
 * utils.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2022-2023
 * @license    GPL-3.0
 * this file is based on https://github.com/RensAlthuis/vertical-overview extension module
 */

const Gi = imports._gi;

function _hookVfunc(proto, symbol, func) {
    proto[Gi._Gi.hook_up_vfunc_symbol](symbol, func);
}

export function overrideProto(proto, overrides) {
    const backup = {};
    for (let symbol in overrides) {
        if (symbol.startsWith('after_')) {
            const actualSymbol = symbol.slice('after_'.length);
            let fn = proto[actualSymbol];
            const afterFn = overrides[symbol];
            proto[actualSymbol] = function (...args) {
                args = Array.prototype.slice.call(args);
                const res = fn.apply(this, args);
                afterFn.apply(this, args);
                return res;
            };
            backup[actualSymbol] = fn;
        } else {
            backup[symbol] = proto[symbol];
            if (symbol.startsWith('vfunc'))
                _hookVfunc(proto[Gi._Gi.gobject_prototype_symbol], symbol.slice(6), overrides[symbol]);
            else if (overrides[symbol] !== null)
                proto[symbol] = overrides[symbol];
        }
    }
    return backup;
}

