// @ts-nocheck
import { createNamedGradientStyle } from '../lib/uploop.cssUtil.js';
import { $view, $html, $component, $state, $setState, $event } from '../lib/uploop.html.js';

export function Counter(initState) {
  // console.log('Counter', initState);
  const { initCount, color } = initState || { initCount: 0 };
  const count = $state(this, new Number(initCount || 0));
  const count2 = $state(this, new Number(initCount || 0));
  const sum = $state(this, () => count() + count2());
  // console.log('currentState', count());

  const handleClick = () => {
    // console.log('click');
    $setState(this, count, count => new Number(count + 1));
  }

  const handleClick2 = () => {
    // console.log('click');
    $setState(this, count2, count2 => new Number(count2 + 2));
  }

  const { styleName: buttonStyleName } = createNamedGradientStyle({
    colors: ['var(--color-cyan-5)', 'cyan'],
    dir: 'to bottom',
  })

  return $view(this, () => /*html*/ `
  <div style="color: ${color}">count is ${count()} + ${count2()}</div>
  <div>Sum is ${sum()}</div>
  <button 
    class="p-0_5 rounded-md ${buttonStyleName} box-shadow-md" 
    style="
      color: var(--color-gray);
      background-color: var(--color-teal-1);
    " 
    onclick="${$event(this, handleClick)}()"
  >Add count</button>
  <button 
    class="p-0_5 rounded-md" 
    onclick="${$event(this, handleClick2)}()"
  >Add count 2</button>
`,
    initState
  );
}

$component(Counter, 'u-counter');

export function CounterExample() {
  return $view(this,
/*html*/`
<div>
  <u-counter data-color="red"></u-counter>
  <hr/>
  <u-counter data-init-count="${1}"></u-counter>
  <hr/>
  ${new Counter({ initCount: 1, color: "green" })}
</div>
  `);
}

$component(CounterExample, 'u-counter-app');