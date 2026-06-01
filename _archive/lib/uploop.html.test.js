import {expect, test} from 'vitest';

import { $view } from "./uploop.html";

function ComponentWithTemplate() {
    return $view(this, /*html*/ `
    <div>Text</div>
    `);
}

function ComponentWithViewRender() {
    return $view(this, {
        render: (element) => {
            if (element) {
                element.shadowRoot.innerHTML = "<div>Text</div>";
                //console.log(element.shadowRoot.innerHTML);
            } else {
                return "<div>Text</div>";
            }
        },
    });
}

function ComponentWithContent() {
    return $view(this, {
        content: (state) => {
            return "<div>Text</div>";
        },
    });
}

test('ComponentWithTemplate', () => {
    //@ts-ignore
    const componentInstance = new ComponentWithTemplate();
    console.log(componentInstance);
    expect(componentInstance.render()).toBe("<div>Text</div>");
    // expect(componentInstance.__linkedElement.shadowNode.innerHTML).toBe("<div><div>Index</div></div>");
});

test('ComponentWithViewRender', () => {
    //@ts-ignore
    const componentInstance = new ComponentWithViewRender();
    console.log(componentInstance);
    expect(componentInstance.render()).toBe("<div>Text</div>");
    // expect(componentInstance.__linkedElement.shadowNode.innerHTML).toBe("<div><div>Index</div></div>");
});

test('ComponentWithContent', () => {
    //@ts-ignore
    const componentInstance = new ComponentWithContent();
    console.log(componentInstance);
    expect(componentInstance.render()).toBe("<div>Text</div>");
    // expect(componentInstance.__linkedElement.shadowNode.innerHTML).toBe("<div><div>Index</div></div>");
});