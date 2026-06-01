import { polyfills } from './uploop.utils.js';

export const $up = {
    setup: (options = {
        isPolyfill : true,
        isUseUpGlobal : true,
    }) => {
        if (options?.isPolyfill){
            polyfills();
        }
        if (options?.isUseUpGlobal){
            if (typeof window !== 'undefined') {
                //@ts-ignore
                window.$up = $up;
            }
        }
    },
    // Element Ids
    newElementId: 0,
    elementRefs: {},
    getElementById: (id) => {
        return $up.elementRefs[id];
    },

    //Shortcut to get event handler
    e: (id, handlerId) => $up.getElementById(id).__eventHandlers[handlerId],

    // State management
    values: {},
    savedStates: {},
}