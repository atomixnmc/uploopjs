# Uploop
![Uploop](public/vite.svg)

Uploop is a "simple" functional js library.
- Generate WebComponent from string literal
- One way binding of data, via pure functions execution
- Updater of data and frame
- Store to connect data between updaters and Components
- Ultility base css, generate by javascript
- No build tool need, just import with esm from any Js CDN
- Single tiny 6k gzip library with all of these features, even small if only core + html

**NOTE: Uploop is now still a WIP, expect some changes till it reach 1.0**

## Quick start
Recommend way:

```
<script src="https://cdn.js/uploop.js" />
```
More common way: 

```
npm i uploop.js
```

## Motivation
I've used React and other "view" library for many years.
- Depend on JSX (or other madeup syntax :p ) and build tool
- Imply a lot in our workflow and updating strategy (asap is bad!)
- Wanted some thing extremely light weight and actually can be embeded everywhere needed
- Take goodies from those old-day JQuery and the modern libraries like React, Redux, Preact, Solid, Zustand, Tailwind, XState, Ark, ... and Awesome ideas from GameEngines!

### Why Uploop
- Uploop mean update-loop which is the main idea of how updating should work in view layer
- Data flow (copied) from one place to another like a stream
- Some data need to be there quickly (aka ASAP), some can be refreshed in seconds (because who care)

### Benefits
- This level of simplicity, yet flexibility actually a big gain. 
- Removing all the constraints you have with other framework. Everything is now possible again.
- No fixed workflow really. So much freedom => You can really can think "out of the box" again with Uploop

### Highlights
- Uploop html is just **WebComponent** with what ever the standard is for HTML
- Uploop store connect data like Redux or React hooks do, without complicated concepts and syntax
- Uploop css is ultility based css like Tailwind but deeply integrated with your components and feel nature to be embeded
- Uploop animation is like Framer motion, built-in solve most of your animation and transistion effect
- Uploop state machine is like Ark or StateX, built-in help to create complex and predictable behaviour for component
- Uploop routing is a pure functional approach to the routing issue with the help of updater and state machine, make a feel like magic
- Uploop play well with 2d, 3d render library and high performance WebGL, Canvas. Think running a game inside your view!

### Server side
- Uploop server side rendering only a few LOC that render out the data into html. 
- This simplicity and power which make Uplood perfect to be Serverless, see functional + serverless

## Example
- Counter
- Todos


A component:
```js
import { $view, $state, $setState, $class } from "uploop.js";

export function Counter(initState) {
  const { initCount, color } = initState || { initCount: 0 };
  const count = $state(this, new Number(initCount || 0));  
  const handleClick = () => {
    $setState(this, count, count => new Number(count + 1));
  }
  return $view(this, () =>
`
  <div style="color: ${color}">count is ${count()}</div>
  <button onclick="${$event(this, handleClick)}()">Add count</button>
`, initState);
}

$class(Counter, 'u-counter');
```

Component with html template:
```js

```

Styles:
```js

```

Store connect:
```js

```

State machine:
```js

```

## Work well with
- Vite
- Typescript
- VSCode extension es6-string-html

### TODO
- [ ] Add more examples
- [ ] Add more docs
- [ ] Add more tests
- [ ] Add more features
- [ ] Add more plugins
- [ ] Add more tools

#### Version 0.1.0
- [x] Core
- [x] Html
- [x] Store
- [x] Css
- [ ] No global variable