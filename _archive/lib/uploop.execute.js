// uploop is a function that loop over time
// return a render function and an object as state and a link function
// uploop is similar to React, but with a different approach
// view is a function that return a string
// upload has event queue like js event loop
// beat is default to 60fps, with setInterval
// any function can be passed to uploop to be called at each beat
// path is a string separated by dots, to access nested objects

export function upLoop(view, config, updateFunc, beat = 1000 / 60) {
    const firstView = view(config);
    const render = () => {
        return firstView;
    }
    const eventQueue = [];
    const eachStep = () => {
        //process event queue
        while (eventQueue.length > 0) {
            const event = eventQueue.shift();
            if (event instanceof Function) {
                event();
            } else {
                if (updateFunc) updateFunc(event);
            }
        }

        if (updateFunc) {
            updateFunc();
        }
    }

    return {
        render,
        state: {},
        link: function link(anotherLoop) {

        },
        queue: (event) => {
            eventQueue.push(event);
        },
    }
}

// upAsync is a function that wrap async functions
