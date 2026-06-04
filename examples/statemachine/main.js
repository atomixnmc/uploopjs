/**
 * State Machine Example — Traffic Light
 *
 * Demonstrates:
 *   • Finite state machine with constrained transitions
 *   • Entry/exit hooks
 *   • Guards (can only transition from valid states)
 *   • Visualization
 *   • Auto-cycling with effects
 */

import { html, component } from "@uploop/html";
import { createStateMachine } from "@uploop/state-machine";

// ── Traffic light state machine ──────────────────────────
const light = createStateMachine({
  name: "trafficLight",
  initial: "red",

  states: {
    red: {
      on: { NEXT: "green" },
      entry: () => ({ color: "#ff4444", label: "STOP", duration: 4000 }),
      exit: (s) => console.log("Leaving red..."),
    },
    yellow: {
      on: { NEXT: "red" },
      entry: () => ({ color: "#ffaa00", label: "SLOW", duration: 1500 }),
    },
    green: {
      on: { NEXT: "yellow", EMERGENCY: "red" },
      entry: () => ({ color: "#44cc44", label: "GO", duration: 3000 }),
    },
  },

  data: {
    color: "#ff4444",
    label: "STOP",
    duration: 4000,
  },
});

// ── Auto-cycle effect ────────────────────────────────────
let _cycleTimer = null;

function startCycle() {
  stopCycle();
  _cycleTimer = setInterval(() => {
    light.send("NEXT");
  }, light.data.duration);
}

function stopCycle() {
  if (_cycleTimer) {
    clearInterval(_cycleTimer);
    _cycleTimer = null;
  }
}

// Start cycling
startCycle();

// ── Component ────────────────────────────────────────────

export const StateMachineDemo = component("StateMachineDemo", {
  state: {
    running: true,
    emergencyActive: false,
  },

  update: {
    next: () => {
      light.send("NEXT");
      return {};
    },
    emergency: (s) => {
      stopCycle();
      light.send("EMERGENCY");
      return { running: false, emergencyActive: true };
    },
    resume: (s) => {
      startCycle();
      return { running: true, emergencyActive: false };
    },
    toggle: (s) => {
      if (s.running) {
        stopCycle();
        return { running: false };
      } else {
        startCycle();
        return { running: true };
      }
    },
  },

  view: (state, { send }) => {
    const currentState = light.value;
    const { color, label } = light.data;

    // Build transition buttons
    const available = light.available();

    return html`
      <div
        style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:1rem;text-align:center;"
      >
        <h2>🚦 State Machine Demo</h2>
        <p style="color:#888;font-size:0.85rem;">
          Traffic light FSM with constrained transitions, entry hooks, and
          auto-cycling effect.
        </p>

        <!-- Visual traffic light -->
        <div
          style="display:flex;flex-direction:column;align-items:center;gap:0.5rem;margin:1.5rem 0;"
        >
          <!-- Light housing -->
          <div
            style="background:#333;border-radius:16px;padding:1rem;display:flex;flex-direction:column;gap:0.75rem;width:100px;"
          >
            <!-- Red -->
            <div
              style="width:60px;height:60px;border-radius:50%;margin:0 auto;
              background:${currentState === "red" ? "#ff4444" : "#551111"};
              box-shadow:${currentState === "red"
                ? "0 0 20px #ff4444"
                : "none"};"
            ></div>

            <!-- Yellow -->
            <div
              style="width:60px;height:60px;border-radius:50%;margin:0 auto;
              background:${currentState === "yellow" ? "#ffaa00" : "#554400"};
              box-shadow:${currentState === "yellow"
                ? "0 0 20px #ffaa00"
                : "none"};"
            ></div>

            <!-- Green -->
            <div
              style="width:60px;height:60px;border-radius:50%;margin:0 auto;
              background:${currentState === "green" ? "#44cc44" : "#114411"};
              box-shadow:${currentState === "green"
                ? "0 0 20px #44cc44"
                : "none"};"
            ></div>
          </div>

          <div
            style="font-size:1.5rem;font-weight:bold;color:${color};margin-top:0.5rem;"
          >
            ${label}
          </div>
        </div>

        <!-- State indicator -->
        <div style="margin:0.5rem 0;">
          State: <strong>${currentState}</strong>
          ${state.running
            ? html`<span style="color:#4caf50;"> ● Running</span>`
            : html`<span style="color:#f44336;"> ■ Stopped</span>`}
        </div>

        <!-- Controls -->
        <div
          style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;margin:1rem 0;"
        >
          ${available.includes("NEXT")
            ? html`
                <button
                  @click=${() => send("next")}
                  style="padding:0.5rem 1rem;background:#646cff;color:#fff;border:none;border-radius:4px;cursor:pointer;"
                >
                  Next →
                </button>
              `
            : ""}

          <button
            @click=${() => send("toggle")}
            style="padding:0.5rem 1rem;background:${state.running
              ? "#f44336"
              : "#4caf50"};color:#fff;border:none;border-radius:4px;cursor:pointer;"
          >
            ${state.running ? "⏸ Pause" : "▶ Resume"}
          </button>

          <button
            @click=${() => send("emergency")}
            style="padding:0.5rem 1rem;background:#ff9800;color:#fff;border:none;border-radius:4px;cursor:pointer;"
            ?disabled=${state.emergencyActive}
          >
            🚨 Emergency (Force Red)
          </button>
        </div>

        <!-- State visualization -->
        <details
          style="margin-top:1.5rem;font-size:0.75rem;color:#888;text-align:left;"
        >
          <summary>State Machine Diagram</summary>
          <pre
            style="background:#f5f5f5;padding:0.75rem;border-radius:4px;overflow-x:auto;"
          >
${light.visualize()}

Available transitions: [${available.join(", ")}]
Can NEXT? ${light.can("NEXT")}
Can EMERGENCY? ${light.can("EMERGENCY")}
          </pre
          >
        </details>
      </div>
    `;
  },

  mount: (el) => {
    const unsub = light.subscribe(() => {
      // Re-render on state change
      el.setAttribute?.("data-force-update", Math.random());
    });
    return () => {
      unsub();
      stopCycle();
    };
  },
});

export default StateMachineDemo;
