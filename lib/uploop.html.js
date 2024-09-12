import { $up } from "./uploop.core.js";
import { createGlobalStylesShadow, createGlobalStyles, setupPredefinedStyles } from "./uploop.cssUtil";

export function upSetupHtml({ root, component, isUseCssUtil }) {
    console.log('upSetup Html');
    $up.root = root;
    $up.isUseCssUtil = isUseCssUtil;

    if (isUseCssUtil) {
        createGlobalStyles();
    }
    if (component) {
        if (isUseCssUtil) {
            const globalStylesheets = createGlobalStylesShadow();
            $up.globalStylesheets = globalStylesheets;
        }
        // console.log('tag', tag);
        const newElement = document.createElement(component.prototype.__tag);
        // console.log('newElement', newElement);
        document.body.appendChild(newElement);
    }
}

export function $html(htmlTemplate) {
    return htmlTemplate;
}

export function $htmlFunc(htmlTemplate) {
    return (htmlTemplate instanceof Function) ? () => htmlTemplate() : () => htmlTemplate;
}

/**
 * return a view object that has a render function and a toString function from htmlTemplate
 * render = (element) => { element.shadowRoot.innerHTML = htmlTemplate; }
 * viewObj = { render, newObjThis, toString }
 * @param {*} newObjThis 
 * @param {*} viewConfig 
 * @param {*} state 
 * @returns 
 */
export function $view(newObjThis, viewConfig, state) {
    // console.log('call $view', newObjThis, viewConfig, state);
    //FIXME: This is a hack to make the newObjThis available in the render function!
    const viewObj = {
        render: createRenderFunc(newObjThis, viewConfig),
        __newObjThis: newObjThis,
        toString: () => objToHtmlTag(newObjThis, state)
    };
    return viewObj;
}

/**
 * Create a render function that will be called to render the view
 * @param {*} componentInstance 
 * @param {*} viewConfig 
 * @returns 
 */
export function createRenderFunc(componentInstance, viewConfig) {
    const render = (element, state) => {
        if (!element) {
            element = componentInstance.__linkedElement;
        }
        if (element) {
            element.__renderCount = element.__renderCount || 0;
            element.__renderCount++;
            // console.log('render', element, state, element.__renderCount);
            //Delegate rendering to the htmlTemplate
            if (viewConfig.render) {
                // console.log('delegate-render', viewConfig.render);
                viewConfig.render(element, state);
            } else if (viewConfig.content) {
                // console.log('delegate-render-content', viewConfig.content);
                element.shadowRoot.innerHTML = viewConfig.content(state);
            } else {
                element.shadowRoot.innerHTML = (viewConfig instanceof Function) ? viewConfig() : viewConfig;
            }
            return element;
        } else {
            // Only for debugging
            if (viewConfig.render) {
                return viewConfig.render(element, state).trim();
            } else if (viewConfig.content) {
                return viewConfig.content(state).trim();
            } else {
                return (viewConfig instanceof Function) ? viewConfig() : viewConfig.trim();
            }
        }
    };

    //render throttling

    if (componentInstance) {
        componentInstance.__rerender = render;
    }
    return render;
}

export function setupNewUpElement(element, componentInstance) {
    element.id = element.id || `uel_${$up.newElementId++}`;
    $up.elementRefs[element.id] = element;
}

//TODO: Fix data attributes serialization
export function objToHtmlTag(obj, state) {
    const objProto = Object.getPrototypeOf(obj);
    const tagName = objProto.__tag;

    // console.log(tagName);
    // const dataAttributes = state ? Object.keys(state).map(key => {
    //     const hypenKey = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    //     return `data-${hypenKey}="${state[key]}"`;
    // }).join(' ') : '';
    const dataAttributes = `data-init-state-saved="${upSavedState(state)}"`;
    return `<${tagName} ${dataAttributes}></${tagName}>`;
}

export function upSavedState(state = {}) {
    
    $up.savedStates = $up.savedStates || {};
    $up.stateId = $up.stateId || 0;
    $up.stateId++;
    $up.savedStates[$up.stateId] = state;
    // console.log('upSavedState', state, $up.stateId);
    return $up.stateId;
}

export function syncStateFromAttributes(element, dataAttributes, initState) {
    for (let i = 0; i < dataAttributes.length; i++) {
        const attr = dataAttributes[i];
        const attrName = attr.name;
        const attrValue = attr.value;
        if (attrName.startsWith('data-')) {
            if (attrName === 'data-init-state-saved') {
                const stateId = attrValue;
                console.log('savedStates', $up.savedStates, stateId);
                if ($up.savedStates[stateId]) {
                    Object.assign(initState, $up.savedStates[stateId]);
                    continue;
                } else {
                    console.error('No saved state', stateId);
                }
            }
            let stateName = attrName.replace('data-', '');
            stateName = stateName.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); });
            const stateValue = attrValue;
            initState[stateName] = stateValue;
        }
    }
    console.log('syncStateFromAttributes initState', initState);
}

/**
 * Create a WebComponent from a class definition and a tag name
 * @param {*} classDef 
 * @param {*} tagName 
 * @returns 
 */
export function $component(classDef, tagName) {
    //create a WebComponent
    const newWebComponentClass = class extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });

            if ($up.isUseCssUtil && $up.globalStylesheets) {
                this.shadowRoot.adoptedStyleSheets = $up.globalStylesheets;
                // setupPredefinedStyles(this);
            }
        }
        connectedCallback() {
            //convert data-attributes to state
            const initState = {};
            syncStateFromAttributes(this, this.attributes, initState);

            //NOTE: expect classDef to be a function that returns a view!
            this.__componentInstanceView = new classDef(initState);
            this.__componentInstance = this.__componentInstanceView.__newObjThis;
            if (this.__componentInstance) {
                this.__componentInstance.__linkedElement = this;
                setupNewUpElement(this, this.__componentInstance);
                this.__componentInstanceView.render(this);
            } else {
                console.error('No linked element', tagName, this.__componentInstanceView, this.__componentInstance);
            }
        }
    };
    classDef.$ = (state)=> {
        const dataAttributes = `data-init-state-saved="${upSavedState(state)}"`;
        return `<${tagName} ${dataAttributes}></${tagName}>`;
    }
    classDef.prototype.__tag = tagName;
    newWebComponentClass.prototype.__tag = tagName;
    newWebComponentClass.prototype.__component = classDef;
    customElements.define(tagName, newWebComponentClass);

    console.log('newWebComponentClass', tagName);
    return { classDef, newWebComponentClass };
}

export function $event(thisObj, func) {
    // console.log('event thisObj', thisObj);
    const element = thisObj.__linkedElement || document.body;

    if (element.shadowRoot) {
        return `$up.e('${element.id}', ${newEventHandler(thisObj, element, func)})`;
    } else {
        const elementAccessorStr = element.id ? `document.getElementById('${element.id}')` : 'document.body';
        const eventHandlerStr = `__eventHandlers[${newEventHandler(thisObj, element, func)}]`;
        return `${elementAccessorStr}.${eventHandlerStr}`;
    }
}

function newEventHandler(thisObj, element, func) {
    if (!element || !func) {
        return;
        // console.error('newEventHandler', element, func);
    }
    let newEventHandlerId = func._uid;
    element.__eventHandlers = element.__eventHandlers || {};
    if (!newEventHandlerId) {
        element.__eventHandlerId = element.__eventHandlerId || 0;
        element.__eventHandlerId++;
        newEventHandlerId = element.__eventHandlerId;
    }
    element.__eventHandlers[newEventHandlerId] = func.bind(thisObj);
    return `${newEventHandlerId}`;
}

export function $input(thisObj, initState, events) {

}

// Simple state management
//FIXME: Support nested states and store
export function $state(thisObj, initState) {
    if (initState instanceof Function) {
        return () => initState();
    }
    if (!thisObj) {
        return initState;
    }
    const objectUid = thisObj._uid;

    $up.values[objectUid] = $up.values[objectUid] || {};
    $up.values[objectUid][initState._uid] = initState;
    // console.log('set-init-state', $up.values[objectUid]);

    const getState = () => {
        // console.log('get-state', $up.values[objectUid]);
        return $up.values[objectUid][initState._uid];
    };

    getState._stateUid = initState._uid;
    return getState;
}

export function $setState(thisObj, getState, stateSetter) {
    const objectUid = thisObj._uid;
    const newState = stateSetter($up.values[objectUid][getState._stateUid]);
    $up.values[objectUid] = $up.values[objectUid] || {};
    $up.values[objectUid][getState._stateUid] = newState;
    // console.log('set-state', $up.values[objectUid]);

    //FIXME: Use uploop render throttling
    thisObj.__rerender();

    return newState;
}