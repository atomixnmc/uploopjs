import { upSetupHtml, $up, $view, $component, $router } from "./lib/index.js";
import { CounterExample } from "./examples/counter.js";
import { FormExample } from "./examples/form.js";
import { GridExample } from "./examples/grid.js";

function IndexPage() {
    return $view(this, () => /*html*/ `
    <div class="text-2">Example</div>
    <hr/>
    <div>
        <ul>
            <li><a href="/counter">counter</a></li>
            <li><a href="/form">form</a></li>
            <li><a href="/table">table</a></li>
            <li><a href="/tabs">tabs</a></li>
            <li><a href="/grid">grid</a></li>
            <li><a href="/todos">todos</a></li>
            <li><a href="/blog">blog</a></li>
            <li><a href="/tetris">tetris</a></li>
        </ul>
    </div>
    `);
}

function ExampleLayout({ header, content }) {
    return $view(this, () => /*html*/ `
    <div>
        <div><a href="/">Home</a></div>
        <div class="text-2">${header}</div>
        <hr/>
        <div class="p-2">${content}</div>
    </div>
    `);
}

function App() {
    return $view(this,
        $router({
            '': {
                path: '',
                view: IndexPage()
            },
            '/counter': {
                path: '/counter',
                view: ExampleLayout({
                    header: 'Counter Example',
                    //@ts-ignore
                    content: CounterExample.$()
                })
            },
            '/form': {
                path: '/form',
                view: ExampleLayout({
                    header: 'Form Example',
                    //@ts-ignore
                    content: FormExample.$({
                        formData: {
                            name: 'John Doe',
                            email: 'jd@email.com',
                            phone: '1234567890'
                        }
                    })
                })
            },
            '/table': {
            },
            '/tabs': {
            },
            '/grid': {
                path: '/grid',
                view: ExampleLayout({
                    header: 'Grid Example',
                    //@ts-ignore
                    content: GridExample.$()
                })
            },
        }));

    // return $view(this, new CounterApp());
}

$component(App, 'u-app');
$up.setup();
upSetupHtml({
    root: document.getElementById('app'),
    component: App,
    isUseCssUtil: true
});