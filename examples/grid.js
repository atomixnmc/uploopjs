import { createNamedEventStyle } from "../lib/uploop.cssUtil";
import { $component, $setState, $state, $view, $event } from "../lib/uploop.html";
import { createUUID } from "../lib/uploop.utils";

export function GridItem(initState = {}, store = {}) {
    const { update } = store;
    const hoverStyle = createNamedEventStyle({
        name: 'hover-scale',
        event: 'hover',
        backgroundColor: 'var(--color-pink-2)',
        transform: 'scale(1.05)',
    }).styleName;

    return $view(this, () =>/*html*/ `
    <div class="grid-item border-solid p-1 rounded-1 bg-color-gray-9 ${hoverStyle}">
        <div class="grid-item-content">
            <h3>${initState.title}</h3>
            <p>${initState.content}</p>
        </div>
    </div>
    `, initState);
}

export function GridExample(initState = {}, store = {}) {
    // const { update } = store;
    const searchStr = $state(this, new String());
    const gridItems = Array.from({ length: 9 }, (v, i) => ({
        content: `Content ${i} ${createUUID()}`
    }));
    const updateSearchStr = (e) => {
        console.log('updateSearchStr', e.target.value);
        $setState(this, searchStr, new String(e.target.value));
    }
    return $view(this, () =>/*html*/ `
    ${GridSearch({ searchStr }, { updateSearchStr })}
    <div class="p-8px d-grid grid-cols-3 gap-8px bg-color-gray-8">
        ${gridItems
            .filter(i => searchStr.length > 0 ? i.content.includes(searchStr) : true)
            .map((item, i) => `<u-grid-item 
                data-title="Title ${i}" 
                data-content="${item.content}"
            >
            </u-grid-item>`).join('')}
    </div>
    `, initState);
}

export function GridSearch(initState = {}, { updateSearchStr }) {
    return $view(this, () =>/*html*/ `
    <div class="p-1">
        <input type="text" placeholder="Search..." onchange="${$event(this, updateSearchStr)}"/>
        <button>Search</button>
    </div>
    `, initState);
}

$component(GridItem, 'u-grid-item');
$component(GridSearch, 'u-grid-search');
$component(GridExample, 'u-grid-example');