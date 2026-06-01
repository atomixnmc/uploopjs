import { upLoop } from './uploop.execute.js';
import { fromStringsToTemplate } from './uploop.utils.js';

// upStore is a function that store state
// return a function that can be called to update the state
// path is a string separated by dots, to access nested objects
export function upStore(state) {
    return function update(path, value) {
        var keys = path.split('.');
        var obj = state;
        for (var i = 0; i < keys.length - 1; i++) {
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
    }
}

// upConnect is a function that connect a WebComponent to a store
export function upConnect(component, store) {
    return function connect(path) {
        var keys = path.split('.');
        var obj = store.state;
        for (var i = 0; i < keys.length; i++) {
            obj = obj[keys[i]];
        }
        component.innerHTML = obj;
    }
}

// upEvent is a function that listen to an event
// return a function that can be called to update the state
export function upStoreEvent(event, store) {
    return function update(path, value) {
        store(path, value);
    }
}