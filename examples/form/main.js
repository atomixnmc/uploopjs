import { html, component } from "@uploop/html";
import { createStateMachine } from "@uploop/state-machine";

// ════════════════════════════════════════════════════════════
// City Autocomplete Dataset
// ════════════════════════════════════════════════════════════
const CITIES = [
  "Hanoi, Vietnam",
  "Ho Chi Minh City, Vietnam",
  "Da Nang, Vietnam",
  "Hai Phong, Vietnam",
  "Can Tho, Vietnam",
  "Nha Trang, Vietnam",
  "Hue, Vietnam",
  "Da Lat, Vietnam",
  "Vung Tau, Vietnam",
  "Tokyo, Japan",
  "Osaka, Japan",
  "Kyoto, Japan",
  "Seoul, South Korea",
  "Busan, South Korea",
  "Bangkok, Thailand",
  "Phuket, Thailand",
  "Singapore",
  "Kuala Lumpur, Malaysia",
  "Jakarta, Indonesia",
  "Bali, Indonesia",
  "Manila, Philippines",
  "Cebu, Philippines",
  "Beijing, China",
  "Shanghai, China",
  "Hong Kong",
  "Taipei, Taiwan",
  "New Delhi, India",
  "Mumbai, India",
  "Dubai, UAE",
  "London, UK",
  "Paris, France",
  "Berlin, Germany",
  "Rome, Italy",
  "Barcelona, Spain",
  "New York, USA",
  "Los Angeles, USA",
  "San Francisco, USA",
  "Sydney, Australia",
  "Melbourne, Australia",
];

// ════════════════════════════════════════════════════════════
// CityInput — autocomplete dropdown component
//
// Has its own internal state (query, suggestions, open) and
// exposes the selected city to the parent via onSelect callback.
// ════════════════════════════════════════════════════════════
const CityInput = component("CityInput", {
  state: {
    query: "",
    suggestions: [],
    open: false,
    selected: null,
    focusedIdx: -1,
  },

  update: {
    input: (s, q) => {
      const show = q.trim().length >= 2;
      const matches = show
        ? CITIES.filter((c) => c.toLowerCase().includes(q.toLowerCase()))
        : [];
      return {
        ...s,
        query: q,
        suggestions: matches.slice(0, 6),
        open: show && matches.length > 0,
        focusedIdx: -1,
      };
    },
    select: (s, city) => {
      if (s.onSelect) s.onSelect(city);
      return {
        ...s,
        query: city,
        selected: city,
        open: false,
        suggestions: [],
        focusedIdx: -1,
      };
    },
    open: (s) => ({ ...s, open: true }),
    close: (s) => ({ ...s, open: false }),
    focusNext: (s) => {
      const max = s.suggestions.length - 1;
      return { ...s, focusedIdx: s.focusedIdx >= max ? 0 : s.focusedIdx + 1 };
    },
    focusPrev: (s) => {
      const max = s.suggestions.length - 1;
      return { ...s, focusedIdx: s.focusedIdx <= 0 ? max : s.focusedIdx - 1 };
    },
  },

  view: (state, { send }) => html`
    <div style="position:relative;">
      <input
        value="${state.query}"
        @input=${["input", (e) => e.target.value]}
        @focus=${() => send("open")}
        @blur=${(e) => setTimeout(() => send("close"), 150)}
        @keydown=${(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            send("focusNext");
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            send("focusPrev");
          }
          if (
            e.key === "Enter" &&
            state.focusedIdx >= 0 &&
            state.suggestions[state.focusedIdx]
          ) {
            e.preventDefault();
            send("select", state.suggestions[state.focusedIdx]);
          }
          if (e.key === "Escape") send("close");
        }}
        placeholder="Type a city..."
        style="width:100%;padding:0.5rem;border:1px solid #ccc;border-radius:6px;font-size:1rem;box-sizing:border-box;"
      />
      ${state.open && state.suggestions.length > 0
        ? html`
            <div
              style="position:absolute;top:100%;left:0;right:0;background:white;border:1px solid #ddd;border-radius:0 0 6px 6px;z-index:10;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);"
            >
              ${state.suggestions.map(
                (city, i) => html`
                  <div
                    @mousedown=${() => send("select", city)}
                    style="padding:0.5rem;cursor:pointer;font-size:0.9rem;
                     background:${i === state.focusedIdx ? "#f0f0ff" : "white"};
                     ${i === state.focusedIdx
                      ? "color:#646cff;font-weight:500;"
                      : "color:#333;"}
                     border-bottom:1px solid #f0f0f0;"
                  >
                    ${city}
                  </div>
                `,
              )}
            </div>
          `
        : ""}
    </div>
  `,
});

// ════════════════════════════════════════════════════════════
// Form Validation State Machine
//
// The state machine controls the form lifecycle:
//
//   idle ──input──► dirty ──validate──► validating ──valid──► valid
//    ▲               │                      │                   │
//    │               │                      ├──invalid──► invalid│
//    │               │                      │                   │
//    │               ◄─────── input ─────────┘                   │
//    │                                                          │
//    └───── reset ◄── submitted ◄── success ◄── submitting ◄────┘
//                                                   │
//                                                   └── fail ──► error
//                                                                │
//                                           retry ◄──────────────┘
//
// Events are "interruptible": VALIDATE can be cancelled by a new INPUT.
// SUBMIT is blocked if state is not 'valid' (guard).
// ════════════════════════════════════════════════════════════
const formMachine = createStateMachine({
  name: "FormValidation",
  initial: "idle",
  data: { errors: {} },

  states: {
    idle: {
      on: { INPUT: "dirty" },
    },
    dirty: {
      on: { INPUT: "validating", VALIDATE: "validating" },
    },
    validating: {
      on: {
        VALID: "valid",
        INVALID: "invalid",
        INPUT: "dirty", // new input cancels validation (interruptible)
      },
      // Entry hook runs validation logic
      entry: (s) => {
        const errors = {};
        const d = s.data || {};
        if (!d.name || d.name.trim().length < 2)
          errors.name = "Name must be at least 2 characters";
        if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
          errors.email = "Invalid email address";
        if (!d.phone || !/^[\d\s\-+()]{7,}$/.test(d.phone))
          errors.phone = "Invalid phone number";
        if (!d.password || d.password.length < 6)
          errors.password = "Password must be at least 6 characters";
        if (!d.city || d.city.trim().length < 2)
          errors.city = "Please select a city";
        return { errors };
      },
    },
    valid: {
      on: { INPUT: "dirty", SUBMIT: "submitting" },
    },
    invalid: {
      on: { INPUT: "dirty" },
    },
    submitting: {
      on: { SUCCESS: "submitted", FAIL: "error" },
    },
    submitted: {
      on: { RESET: "idle" },
    },
    error: {
      on: { SUBMIT: "submitting" },
    },
  },
});

// ════════════════════════════════════════════════════════════
// Validation helpers
// ════════════════════════════════════════════════════════════
function validateField(field, value) {
  switch (field) {
    case "name":
      return !value || value.trim().length < 2
        ? "Name must be at least 2 characters"
        : null;
    case "email":
      return !value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? "Invalid email address"
        : null;
    case "phone":
      return !value || !/^[\d\s\-+()]{7,}$/.test(value)
        ? "Invalid phone number"
        : null;
    case "password":
      return !value || value.length < 6
        ? "Password must be at least 6 characters"
        : null;
    case "city":
      return !value || value.trim().length < 2 ? "Please select a city" : null;
    default:
      return null;
  }
}

// ════════════════════════════════════════════════════════════
// PasswordInput — with show/hide toggle
// ════════════════════════════════════════════════════════════
function PasswordInput({ value, error, onInput }) {
  return html`
    <div style="position:relative;">
      <input
        value="${value}"
        @input=${(e) => onInput(e.target.value)}
        type="password"
        id="password-field"
        placeholder="At least 6 characters"
        style="width:100%;padding:0.5rem;padding-right:2.5rem;border:1px solid ${error
          ? "#ff4444"
          : "#ccc"};border-radius:6px;font-size:1rem;box-sizing:border-box;${error
          ? "background:#fff0f0;"
          : ""}"
      />
      <span
        @click=${() => {
          const el = document.getElementById("password-field");
          if (el) el.type = el.type === "password" ? "text" : "password";
        }}
        style="position:absolute;right:0.5rem;top:50%;transform:translateY(-50%);cursor:pointer;font-size:1.1rem;user-select:none;"
      >
        👁
      </span>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// Form — root component with state machine validation
//
// Event-Data Flow:
//
//   User types ──@input──► send('input', 'name', value)
//     ├──► formData updated in state
//     └──► formMachine.send('INPUT') → transitions to 'dirty'/'validating'
//            └──► entry() hook runs validation → errors computed
//            └──► sends 'VALID' or 'INVALID'
//                   └──► component shows errors or enables submit
//
//   User clicks Submit:
//     └──► formMachine.is('valid')? → send('SUBMIT') → 'submitting'
//            └──► simulated async → send('SUCCESS') → 'submitted'
//
// The state machine acts as a "gate": events are interruptible.
// If user types during VALIDATING, INPUT transitions back to 'dirty',
// cancelling the validation flow (interruptible event pattern).
// ════════════════════════════════════════════════════════════
const Form = component("Form", {
  state: {
    formData: { name: "", email: "", phone: "", password: "", city: "" },
    errors: {},
    submitted: null,
    stateLabel: "idle",
    previousState: null,
  },

  update: {
    // ── Field input: updates form data + triggers validation machine ──
    input: (s, field, value) => {
      const formData = { ...s.formData, [field]: value };

      // Reset this field's error immediately on input
      const errors = { ...s.errors };
      delete errors[field];

      // Feed event to state machine
      formMachine.send("INPUT");

      // Deferred validation: sync formData into machine data, then VALIDATE
      clearTimeout(s._validateTimer);
      const timer = setTimeout(() => {
        // Push current form data into state machine via set()
        const m = formMachine.get();
        formMachine.set({ data: { ...m.data, ...formData } });
        formMachine.send("VALIDATE");
        const md = formMachine.data;
        if (md.errors && Object.keys(md.errors).length > 0) {
          formMachine.send("INVALID");
          Form.loop.set({ errors: { ...md.errors } });
        } else {
          formMachine.send("VALID");
          Form.loop.set({ errors: {} });
        }
      }, 300);

      return {
        formData,
        errors,
        _validateTimer: timer,
        stateLabel: formMachine.value,
        previousState: formMachine.data.prev,
      };
    },

    // ── Submit: only proceeds if state machine is in 'valid' ──
    submit: (s) => {
      if (!formMachine.is("valid")) {
        // Push current data into machine and re-validate
        const m2 = formMachine.get();
        formMachine.set({ data: { ...m2.data, ...s.formData } });
        formMachine.send("VALIDATE");
        const md2 = formMachine.data;
        if (md2.errors && Object.keys(md2.errors).length > 0) {
          formMachine.send("INVALID");
          return {
            ...s,
            errors: { ...md2.errors },
            stateLabel: formMachine.value,
          };
        }
      }

      formMachine.send("SUBMIT");
      setTimeout(() => {
        formMachine.send("SUCCESS");
        Form.loop.set({
          submitted: { ...Form.loop.get().formData },
          stateLabel: formMachine.value,
        });
      }, 500);

      return { ...s, errors: {}, stateLabel: "submitting" };
    },

    // ── Reset form ──
    reset: () => {
      formMachine.send("RESET");
      return {
        formData: { name: "", email: "", phone: "", password: "", city: "" },
        errors: {},
        submitted: null,
        stateLabel: "idle",
        previousState: null,
      };
    },
  },

  view: (state, { send }) => html`
    <div
      style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:1rem;"
    >
      <div
        style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;"
      >
        <h3 style="margin:0;color:#333;">Registration</h3>
        <span
          style="font-size:0.72rem;padding:0.15rem 0.5rem;border-radius:4px;
                     background:${formMachine.is("valid")
            ? "#e8f5e9"
            : formMachine.is("invalid")
              ? "#fff0f0"
              : formMachine.is("submitted")
                ? "#e3f2fd"
                : "#f5f5f5"};
                     color:${formMachine.is("valid")
            ? "#2e7d32"
            : formMachine.is("invalid")
              ? "#c62828"
              : formMachine.is("submitted")
                ? "#1565c0"
                : "#888"};"
        >
          ${formMachine.value}
          ${state.previousState ? `← ${state.previousState}` : ""}
        </span>
      </div>

      <!-- Event flow diagram -->
      <details style="font-size:0.75rem;color:#888;margin-bottom:0.75rem;">
        <summary style="cursor:pointer;">
          Event Flow: input → validate → ${formMachine.value}
        </summary>
        <div
          style="padding:0.5rem;background:#f9f9fb;border-radius:6px;margin-top:0.25rem;font-family:monospace;line-height:1.6;"
        >
          <div>
            User types → <strong>@input</strong> →
            <strong>send('input', field, value)</strong>
          </div>
          <div style="padding-left:1rem;">
            ├─ updates <strong>formData</strong> in state
          </div>
          <div style="padding-left:1rem;">
            └─ <strong>formMachine.send('INPUT')</strong> → ${formMachine.value}
          </div>
          <div style="padding-left:1rem;">
            &nbsp; └─ debounced 300ms → <strong>VALIDATE</strong>
          </div>
          <div style="padding-left:1rem;">
            &nbsp; &nbsp; └─ entry() hook → errors computed
          </div>
          <div style="padding-left:1rem;">
            &nbsp; &nbsp; &nbsp; └─ <strong>VALID</strong> or
            <strong>INVALID</strong>
          </div>
          <div>
            Submit → <strong>@click</strong> → <strong>send('submit')</strong>
          </div>
          <div style="padding-left:1rem;">
            ├─ guard: <strong>formMachine.is('valid')</strong>?
          </div>
          <div style="padding-left:1rem;">
            └─ <strong>SUBMIT</strong> → 'submitting' → async → 'submitted'
          </div>
        </div>
      </details>

      <form
        @submit=${(e) => e.preventDefault()}
        style="display:flex;flex-direction:column;gap:0.6rem;"
      >
        <!-- Name -->
        <div>
          <label
            style="display:block;font-size:0.85rem;color:#666;margin-bottom:0.2rem;"
            >Name *</label
          >
          <input
            value="${state.formData.name}"
            @input=${(e) => send("input", "name", e.target.value)}
            placeholder="Your full name"
            style="width:100%;padding:0.5rem;border:1px solid ${state.errors
              .name
              ? "#ff4444"
              : "#ccc"};border-radius:6px;font-size:1rem;box-sizing:border-box;${state
              .errors.name
              ? "background:#fff0f0;"
              : ""}"
          />
          ${state.errors.name
            ? html`<div
                style="font-size:0.78rem;color:#ff4444;margin-top:0.15rem;"
              >
                ${state.errors.name}
              </div>`
            : ""}
        </div>

        <!-- Email -->
        <div>
          <label
            style="display:block;font-size:0.85rem;color:#666;margin-bottom:0.2rem;"
            >Email *</label
          >
          <input
            value="${state.formData.email}"
            @input=${(e) => send("input", "email", e.target.value)}
            placeholder="your@email.com"
            style="width:100%;padding:0.5rem;border:1px solid ${state.errors
              .email
              ? "#ff4444"
              : "#ccc"};border-radius:6px;font-size:1rem;box-sizing:border-box;${state
              .errors.email
              ? "background:#fff0f0;"
              : ""}"
          />
          ${state.errors.email
            ? html`<div
                style="font-size:0.78rem;color:#ff4444;margin-top:0.15rem;"
              >
                ${state.errors.email}
              </div>`
            : ""}
        </div>

        <!-- Phone -->
        <div>
          <label
            style="display:block;font-size:0.85rem;color:#666;margin-bottom:0.2rem;"
            >Phone *</label
          >
          <input
            value="${state.formData.phone}"
            @input=${(e) => send("input", "phone", e.target.value)}
            placeholder="+84 123 456 789"
            style="width:100%;padding:0.5rem;border:1px solid ${state.errors
              .phone
              ? "#ff4444"
              : "#ccc"};border-radius:6px;font-size:1rem;box-sizing:border-box;${state
              .errors.phone
              ? "background:#fff0f0;"
              : ""}"
          />
          ${state.errors.phone
            ? html`<div
                style="font-size:0.78rem;color:#ff4444;margin-top:0.15rem;"
              >
                ${state.errors.phone}
              </div>`
            : ""}
        </div>

        <!-- Password -->
        <div>
          <label
            style="display:block;font-size:0.85rem;color:#666;margin-bottom:0.2rem;"
            >Password *</label
          >
          ${PasswordInput({
            value: state.formData.password,
            error: state.errors.password,
            onInput: (v) => send("input", "password", v),
          })}
          ${state.errors.password
            ? html`<div
                style="font-size:0.78rem;color:#ff4444;margin-top:0.15rem;"
              >
                ${state.errors.password}
              </div>`
            : ""}
        </div>

        <!-- City -->
        <div>
          <label
            style="display:block;font-size:0.85rem;color:#666;margin-bottom:0.2rem;"
            >City *</label
          >
          <div id="city-input-root"></div>
          ${state.errors.city
            ? html`<div
                style="font-size:0.78rem;color:#ff4444;margin-top:0.15rem;"
              >
                ${state.errors.city}
              </div>`
            : ""}
        </div>

        <!-- Actions -->
        <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
          <button
            type="submit"
            @click=${() => send("submit")}
            style="flex:1;padding:0.6rem;background:${formMachine.is(
              "submitting",
            )
              ? "#aaa"
              : formMachine.is("valid")
                ? "#2e7d32"
                : "#646cff"};color:white;border:none;border-radius:6px;font-size:1rem;cursor:${formMachine.is(
              "submitting",
            )
              ? "not-allowed"
              : "pointer"};"
            ?disabled=${formMachine.is("submitting")}
          >
            ${formMachine.is("submitting")
              ? "Submitting..."
              : formMachine.is("submitted")
                ? "✅ Submitted"
                : "Submit"}
          </button>
          <button
            @click=${() => send("reset")}
            style="padding:0.6rem 1rem;border:1px solid #ccc;border-radius:6px;cursor:pointer;background:white;font-size:0.9rem;"
          >
            Reset
          </button>
        </div>
      </form>

      <!-- Submitted data -->
      ${state.submitted
        ? html`
            <div
              style="margin-top:1rem;padding:0.75rem;background:#e8f5e9;border-radius:8px;border:1px solid #c8e6c9;"
            >
              <h4 style="margin:0 0 0.25rem;color:#2e7d32;">✅ Submitted</h4>
              <div style="font-size:0.85rem;color:#333;line-height:1.6;">
                <div><strong>Name:</strong> ${state.submitted.name}</div>
                <div><strong>Email:</strong> ${state.submitted.email}</div>
                <div><strong>Phone:</strong> ${state.submitted.phone}</div>
                <div><strong>City:</strong> ${state.submitted.city}</div>
              </div>
            </div>
          `
        : ""}

      <!-- State Machine Graph -->
      <details style="margin-top:1rem;font-size:0.72rem;color:#888;">
        <summary style="cursor:pointer;">
          State Machine: ${formMachine.value}
          (${formMachine.available().join(", ") || "no transitions"})
        </summary>
        <pre
          style="background:#f5f5f5;padding:0.5rem;border-radius:6px;overflow:auto;font-size:0.7rem;line-height:1.5;margin-top:0.25rem;"
        >
${formMachine.visualize()}</pre
        >
      </details>
    </div>
  `,

  /** Mount CityInput as a real component with its own render cycle */
  mount: (el, ctx) => {
    let cityInstance = null;
    let cityUnmount = null;

    function mountCity() {
      if (cityUnmount) {
        cityUnmount();
        cityUnmount = null;
      }
      const root = el.querySelector("#city-input-root");
      if (!root) return;

      cityInstance = CityInput.create({
        onSelect: (city) => Form.loop.send("input", "city", city),
      });
      cityUnmount = cityInstance.mount(root);
    }

    // Mount initially
    mountCity();

    // Re-mount after each Form re-render (innerHTML destroys the container)
    const unsub = Form.loop.subscribe(() => {
      requestAnimationFrame(() => mountCity());
    });

    return () => {
      if (cityUnmount) cityUnmount();
      unsub();
    };
  },
});

export { Form, CityInput, formMachine };
export default Form;
