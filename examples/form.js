import { $view, $component } from "../lib/uploop.html";

export function FormExample(initState = {}, store = {}) {
    // console.log('FormExample', initState, store);
    const formData = initState.formData || { name: '', email: '', phone: '' };
    console.log('formData', formData);
    const { update } = store;
    
    const handleChange = (e) => {
        const { name, value } = e.target;
        update(`form.${name}`, value);
    }
    return $view(this, () =>/*html*/ `
    <form>
        <div>
        <p>Name</p>
            <input type="text" name="name" value="${formData.name}" oninput="${handleChange}" />
        </div>
        <div>
        <p>Email</p>
            <input type="text" name="email" value="${formData.email}" oninput="${handleChange}" />
        </div>
        <div>
        <p>Phone</p>
            <input type="text" name="phone" value="${formData.phone}" oninput="${handleChange}" />
        </div>
        <div class="mt-1">
            <button type="submit">Submit</button>
        </div>
    </form>
    `, initState);
}

$component(FormExample, 'u-form-example');