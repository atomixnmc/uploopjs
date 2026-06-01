/**
 * router is a view with routes, contidionally render a view based on the path
 * @param {Object} routes
 */
export function $router(routes) {
    //FIXME: Cache the router instance
    return new RouterWithView(routes);
}

//FIXME: Use uploop to handle rendering
class RouterWithView {
    constructor(routes) {
        this.routes = routes;
        this.currentPath = '';
        this.currentElemenet = null;
        this.currentView = null;
        this.currentComponent = null;
        this.currentParams = {};
        this.currentQuery = {};
        this.currentHash = '';
        this.init();
    }

    init() {
        this.currentPath = window.location.pathname;
        this.currentHash = window.location.hash;
        this.currentQuery = parseQuery(window.location.search);
        this.currentParams = parseParams(this.currentPath);
        // this.loadView();

        window.addEventListener('popstate', () => {
            this.currentPath = window.location.pathname;
            this.currentHash = window.location.hash;
            this.currentQuery = parseQuery(window.location.search);
            this.currentParams = parseParams(this.currentPath);
            this.loadView(this.currentPath);
        });
    }

    render(element) {
        this.currentElement = element;

        let path = window.location.pathname;
        this.currentPath = path;
        console.log('location.path', path);
        //TODO: better path handling
        const matchedView = this.pathToView(path);

        if (matchedView) {
            this.currentView = matchedView;
            this.currentView.render(element);
        } else {
            console.log('Error: no matched view not found');
        }
    }

    pathToView(path) {
        let matchedView = null;
        const routes = this.routes;
        const index = routes.index || routes[''] || routes['/'] || routes['index'];
        const notFound = routes.notFound || {
            view: {
                render: (element) => {
                    element.shadowRoot.innerHTML = 'Not Found';
                }
            }
        };
        const error = routes.error || {
            view: {
                render: (element) => {
                    element.shadowRoot.innerHTML = 'Error';
                }
            }
        };
        if (path === '/' || path === '') {
            path = '';
            // console.log('index', index.view);
            matchedView = index.view;
        } else if (routes.hasOwnProperty(path)) {
            let route = routes[path];
            matchedView = route.view;
        } else {
            matchedView = notFound.view;
        }
        return matchedView;
    }

    loadView(path) {
        const matchedView = this.pathToView(path);

        if (matchedView) {
            this.currentView = matchedView;
            this.currentView.render(this.currentElement);
        } else {
            console.log('Error: no matched view not found');
        }
    }

    navigate(path) {
        window.history.pushState({}, '', path);
        this.currentPath = path;
        this.currentQuery = parseQuery(window.location.search);
        this.currentParams = parseParams(this.currentPath);
        this.loadView(path);
    }
}

function parseQuery(query) {
    let queryObj = {};
    let queryStr = query.substring(1);
    let queryArr = queryStr.split('&');
    for (let i = 0; i < queryArr.length; i++) {
        let queryItem = queryArr[i];
        let queryItemArr = queryItem.split('=');
        queryObj[queryItemArr[0]] = queryItemArr[1];
    }
    return queryObj;
}

function parseParams(path) {
    let params = {};
    let pathArr = path.split('/');
    let pathArrLen = pathArr.length;
    for (let i = 0; i < pathArrLen; i++) {
        if (pathArr[i].length > 0) {
            params[i] = pathArr[i];
        }
    }
    return params;
}