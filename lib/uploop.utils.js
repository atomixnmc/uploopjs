export function patchObjectPrototype() {
    var id = 0;
    Object.defineProperty(Object.prototype, '_uid', {
        // The prototype getter sets up a property on the instance. Because
        // the new instance-prop masks this one, we know this will only ever
        // be called at most once for any given object.
        get: function () {
            Object.defineProperty(this, '_uid', {
                value: id++,
                writable: false,
                enumerable: false,
            });
            return this._uid;
        },
        enumerable: false,
    });
}

export function polyfills() {
    patchObjectPrototype();
}

export function createUUID() {
    return crypto.randomUUID();
}

/**
 * access nested objects
 * return a value from an object
 * similar to lodash get or xpath
 * @param {*} path 
 * @param {*} obj 
 * @returns 
 */
export function getObjectByPath(path, obj) {
    var keys = path.split('.');
    var value = obj;
    for (var i = 0; i < keys.length; i++) {
        value = value[keys[i]];
    }
    return value;
}


/**
 * from a string literal, create a template
 * @param {*} strings 
 * @param  {...any} values 
 * @returns 
 */
export function fromStringsToTemplate(strings, ...values) {
    let str = '';
    strings.forEach((string, i) => {
        str += string + (values[i] || '');
    });
    return str;
}