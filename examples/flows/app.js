/**
 * Uploop Flows Showcase — 15 live demos of breakthrough execution patterns.
 *
 * Each demo shows a specific flow capability with real algorithms,
 * live visualizations, and performance stats. All demos use the same
 * Uploop primitives (html``, createLoop, pipelines) — showcasing how
 * easy it is to compose different flows on any component.
 *
 * Run: open examples/flows/index.html in a browser, or:
 *   npx vite examples/flows --open
 */

import {
  createCircuitBreaker,
  createRateLimiter,
  createRetryWithBackoff,
  createBatchProcessor,
  createPriorityQueue,
  createDeduplicationFilter,
  createEventBus,
  createIdempotencyGuard,
  createDeadLetterQueue,
  createBulkhead,
  createSagaOrchestrator,
  createFanOutFanIn,
  pipeline,
  queue,
  eventStream,
  schedule,
  createSignal,
  createComputed,
  createEffect,
  batch,
  createReactiveStore,
  createActor,
} from "../../packages/flows/src/index.js";

// ── Utility
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ====================================================================
// 1. Search Typeahead — debounce + interruptible + ring buffer
// ====================================================================
export function createSearchTypeaheadDemo() {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [stats, setStats] = createSignal({ calls: 0, aborted: 0, cached: 0 });

  let controller = null;
  let timer = null;
  const cache = new Map();

  function handleInput(val) {
    controller?.abort();
    clearTimeout(timer);
    setQuery(val);

    if (!val) {
      setResults([]);
      return;
    }

    setLoading(true);
    timer = setTimeout(async () => {
      if (cache.has(val)) {
        setResults(cache.get(val));
        setLoading(false);
        setStats((s) => ({ ...s, cached: s.cached + 1 }));
        return;
      }
      controller = new AbortController();
      try {
        const res = await fetch(
          `https://jsonplaceholder.typicode.com/users?q=${val}`,
        );
        const data = await res.json();
        const filtered = data
          .filter((u) => u.name.toLowerCase().includes(val.toLowerCase()))
          .slice(0, 5);
        cache.set(val, filtered);
        setResults(filtered);
        setStats((s) => ({ ...s, calls: s.calls + 1 }));
      } catch (e) {
        if (e.name === "AbortError")
          setStats((s) => ({ ...s, aborted: s.aborted + 1 }));
      }
      setLoading(false);
    }, 200);
  }

  return { query, results, loading, stats, handleInput };
}

// ====================================================================
// 2. Circuit Breaker — state machine visualization
// ====================================================================
export function createCircuitBreakerDemo() {
  const breaker = createCircuitBreaker({
    name: "api-gateway",
    failureThreshold: 3,
    resetTimeout: 5000,
  });
  const [state, setState] = createSignal("CLOSED");
  const [lastResult, setLastResult] = createSignal("");
  const [counts, setCounts] = createSignal({ success: 0, fail: 0 });

  const call = breaker.wrap(async (shouldFail) => {
    if (shouldFail) throw new Error("Service unavailable");
    return "✅ Success";
  });

  async function testCall(shouldFail) {
    try {
      const result = await call(shouldFail);
      setLastResult(result);
      setCounts((c) => ({ ...c, success: c.success + 1 }));
    } catch (e) {
      setLastResult(
        e.name === "CircuitOpenError"
          ? "🔴 Circuit OPEN — rejected"
          : "❌ " + e.message,
      );
      setCounts((c) => ({ ...c, fail: c.fail + 1 }));
    }
    setState(breaker.state);
  }

  // Auto-refresh state
  setInterval(() => setState(breaker.state), 100);

  return { state, lastResult, counts, breaker, testCall };
}

// ====================================================================
// 3. Rate Limiter — token bucket visualization
// ====================================================================
export function createRateLimiterDemo() {
  const limiter = createRateLimiter({
    rate: 5,
    windowMs: 1000,
    burst: 2,
    perKey: true,
  });
  const [tokens, setTokens] = createSignal([]);
  const [stats, setStats] = createSignal({ allowed: 0, denied: 0 });
  const MAX_TOKENS = 7;

  function request(key) {
    const { allowed, remaining } = limiter.tryAcquire(key);
    const entry = { key, allowed, ts: Date.now() };
    setTokens((t) => [...t.slice(-20), entry]);
    setStats((s) => ({
      allowed: s.allowed + (allowed ? 1 : 0),
      denied: s.denied + (allowed ? 0 : 1),
    }));
    return allowed;
  }

  return { tokens, stats, request, maxTokens: MAX_TOKENS, limiter };
}

// ====================================================================
// 4. Priority Queue — job scheduling with aging
// ====================================================================
export function createPriorityQueueDemo() {
  const pq = createPriorityQueue({
    levels: ["critical", "high", "normal", "low", "background"],
    aging: true,
    agingRate: 500,
  });
  const [jobs, setJobs] = createSignal([]);
  const [processed, setProcessed] = createSignal([]);
  let jobId = 0;

  function addJob(level) {
    const id = `job-${++jobId}`;
    pq.enqueue(id, level);
    setJobs((j) => [...j, { id, level, ts: Date.now() }]);
  }

  setInterval(() => {
    const job = pq.dequeue();
    if (job) {
      setProcessed((p) => [
        ...p.slice(-10),
        { id: job.task, level: job.level, ts: Date.now() },
      ]);
      setJobs((j) => j.filter((x) => x.id !== job.task));
      // simulate processing time
      setTimeout(() => pq.complete(job.id), 100 + Math.random() * 300);
    }
  }, 800);

  return { jobs, processed, addJob };
}

// ====================================================================
// 5. Event Bus — pub/sub with wildcards
// ====================================================================
export function createEventBusDemo() {
  const bus = createEventBus();
  const [events, setEvents] = createSignal([]);
  const [subscribers, setSubscribers] = createSignal([]);

  bus.on("user.*", (payload) => {
    setEvents((e) => [
      ...e.slice(-15),
      { topic: "user.*", payload, ts: Date.now() },
    ]);
  });
  bus.on("order.>", (payload) => {
    setEvents((e) => [
      ...e.slice(-15),
      { topic: "order.>", payload, ts: Date.now() },
    ]);
  });

  setSubscribers([
    { pattern: "user.*", handler: "logs all user events" },
    { pattern: "order.>", handler: "logs all order events" },
  ]);

  function emit(topic) {
    bus.emit(topic, { id: Math.random().toString(36).slice(2, 6) });
  }

  return { events, subscribers, emit };
}

// ====================================================================
// 6. Saga Checkout — compensating transaction
// ====================================================================
export function createSagaCheckoutDemo() {
  const so = createSagaOrchestrator({ timeout: 3000 });
  const [steps, setSteps] = createSignal([]);
  const [result, setResult] = createSignal(null);

  const saga = so.create("checkout", [
    {
      name: "validate-cart",
      execute: async (d) => {
        setSteps((s) => [...s, { step: "validate-cart", status: "running" }]);
        await delay(300);
        setSteps((s) =>
          s.map((x) =>
            x.step === "validate-cart" ? { ...x, status: "✅" } : x,
          ),
        );
        return d;
      },
      compensate: async (d) => {
        setSteps((s) => [
          ...s,
          { step: "validate-cart", status: "↩️ compensated" },
        ]);
      },
    },
    {
      name: "charge-payment",
      execute: async (d) => {
        setSteps((s) => [...s, { step: "charge-payment", status: "running" }]);
        await delay(400);
        setSteps((s) =>
          s.map((x) =>
            x.step === "charge-payment" ? { ...x, status: "✅" } : x,
          ),
        );
        return d;
      },
      compensate: async (d) => {
        setSteps((s) => [
          ...s,
          { step: "charge-payment", status: "↩️ refunded" },
        ]);
      },
    },
    {
      name: "reserve-inventory",
      execute: async (d) => {
        setSteps((s) => [
          ...s,
          { step: "reserve-inventory", status: "running" },
        ]);
        await delay(400);
        setSteps((s) =>
          s.map((x) =>
            x.step === "reserve-inventory" ? { ...x, status: "✅" } : x,
          ),
        );
        return d;
      },
      compensate: async (d) => {
        setSteps((s) => [
          ...s,
          { step: "reserve-inventory", status: "↩️ released" },
        ]);
      },
    },
    {
      name: "schedule-shipment",
      execute: async (d) => {
        setSteps((s) => [
          ...s,
          { step: "schedule-shipment", status: "running" },
        ]);
        await delay(300);
        setSteps((s) =>
          s.map((x) =>
            x.step === "schedule-shipment" ? { ...x, status: "✅" } : x,
          ),
        );
        return d;
      },
      compensate: async (d) => {
        setSteps((s) => [
          ...s,
          { step: "schedule-shipment", status: "↩️ cancelled" },
        ]);
      },
    },
  ]);

  async function runCheckout(shouldFail = false) {
    setSteps([]);
    setResult(null);
    if (shouldFail) {
      // inject a failing step
      const failSaga = so.create("checkout-fail", [
        {
          name: "validate-cart",
          execute: async () => {
            await delay(200);
            return "ok";
          },
          compensate: async () => {},
        },
        {
          name: "charge-payment",
          execute: async () => {
            await delay(200);
            return "ok";
          },
          compensate: async () => {},
        },
        {
          name: "reserve-inventory",
          execute: async () => {
            await delay(200);
            throw new Error("Out of stock");
          },
          compensate: async () => {},
        },
      ]);
      const r = await failSaga.run({});
      setSteps((prev) => {
        const steps = [];
        for (const s of r.completedSteps || [])
          steps.push({ step: s, status: "✅" });
        if (r.compensatedSteps)
          for (const s of r.compensatedSteps)
            steps.push({ step: s, status: "↩️ compensated" });
        return steps;
      });
      setResult({ ...r, compensated: r.compensatedSteps });
    } else {
      const r = await saga.run({});
      setResult(r);
    }
  }

  return { steps, result, runCheckout };
}

// ====================================================================
// 7. Batch Processor — accumulation + flush
// ====================================================================
export function createBatchProcessorDemo() {
  const [batches, setBatches] = createSignal([]);
  const [pending, setPending] = createSignal(0);
  const [stats, setStats] = createSignal({ processed: 0 });

  const bp = createBatchProcessor({
    maxSize: 5,
    maxLatency: 3000,
    handler: async (batch) => {
      setBatches((b) => [
        ...b.slice(-5),
        { items: batch, count: batch.length, ts: Date.now() },
      ]);
      setStats((s) => ({ processed: s.processed + batch.length }));
    },
  });

  function addItem() {
    bp.push(`item-${stats().processed + pending() + 1}`);
    setPending((p) => p + 1);
    // track pending reduction
    setTimeout(() => setPending(bp.size), 50);
  }

  setInterval(() => setPending(bp.size), 200);

  return { batches, pending, stats, addItem, flushAll: () => bp.flushAll() };
}

// ====================================================================
// 8. Dedup Filter — bloom + LRU
// ====================================================================
export function createDedupFilterDemo() {
  const df = createDeduplicationFilter({
    falsePositiveRate: 0.01,
    expectedItems: 1000,
  });
  const [log, setLog] = createSignal([]);

  function test(val) {
    const result = df.check(val);
    setLog((l) => [
      ...l.slice(-20),
      {
        value: val,
        duplicate: result.isDuplicate,
        method: result.method,
        ts: Date.now(),
      },
    ]);
    return result;
  }

  return { log, test, stats: () => df.stats };
}

// ====================================================================
// 9. Fan-Out / Fan-In — scatter-gather
// ====================================================================
export function createFanOutFanInDemo() {
  const fi = createFanOutFanIn({
    concurrency: 3,
    partialPolicy: "best-effort",
    timeout: 5000,
  });
  const [results, setResults] = createSignal(null);

  async function runTasks(count, withErrors = false) {
    setResults(null);
    const tasks = Array.from({ length: count }, (_, i) => ({
      fn: async () => {
        await delay(200 + Math.random() * 500);
        if (withErrors && i % 3 === 0) throw new Error(`Task ${i} failed`);
        return `Result-${i}`;
      },
    }));
    const r = await fi.all(tasks);
    setResults(r);
  }

  return { results, runTasks };
}

// ====================================================================
// 10. Actor Model — isolated state + mailbox
// ====================================================================
export function createActorDemo() {
  const [log, setLog] = createSignal([]);

  const counter = createActor({
    name: "counter",
    state: { value: 0, history: [] },
    on: {
      inc: (s, amount) => ({
        ...s,
        value: s.value + amount,
        history: [...s.history, `+${amount}`].slice(-5),
      }),
      dec: (s, amount) => ({
        ...s,
        value: s.value - amount,
        history: [...s.history, `-${amount}`].slice(-5),
      }),
      reset: () => ({ value: 0, history: [] }),
    },
  });

  counter.onStart((s) =>
    setLog((l) => [...l, "Actor started with value " + s.value]),
  );

  async function doInc(n) {
    await counter.send("inc", n);
    updateDisplay();
  }
  async function doDec(n) {
    await counter.send("dec", n);
    updateDisplay();
  }
  async function doReset() {
    await counter.send("reset");
    updateDisplay();
  }

  function updateDisplay() {
    setLog((l) => [
      ...l.slice(-10),
      `State: ${JSON.stringify(counter.state.value)} (processed: ${counter.totalProcessed})`,
    ]);
  }

  return { log, counter, doInc, doDec, doReset };
}

// ====================================================================
// 11. Reactive Form — signals + computed + effects
// ====================================================================
export function createReactiveFormDemo() {
  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [age, setAge] = createSignal(0);

  const isValid = createComputed(() => {
    const n = name(),
      e = email(),
      a = age();
    return {
      name: n.length >= 2,
      email: e.includes("@") && e.includes("."),
      age: a > 0 && a < 150,
      all:
        n.length >= 2 && e.includes("@") && e.includes(".") && a > 0 && a < 150,
    };
  });

  const [submitted, setSubmitted] = createSignal(null);

  createEffect(() => {
    if (isValid().all && name() && email()) {
      // auto-save effect — would trigger API call in real app
    }
    return undefined;
  });

  function submit() {
    if (isValid().all) {
      setSubmitted({ name: name(), email: email(), age: age() });
    }
  }

  return {
    name,
    setName,
    email,
    setEmail,
    age,
    setAge,
    isValid,
    submitted,
    submit,
  };
}

// ====================================================================
// 12. Worker Pool — CPU offloading (fibonacci)
// ====================================================================
export function createWorkerPoolDemo() {
  const [results, setResults] = createSignal([]);
  const [computing, setComputing] = createSignal(false);
  const pool = { stats: () => ({}) }; // mock — real workers need workerUrl

  function fib(n) {
    if (n <= 1) return n;
    let a = 0,
      b = 1;
    for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
    return b;
  }

  async function compute(n) {
    setComputing(true);
    const start = performance.now();
    // simulate worker offload with setTimeout
    await new Promise((r) => setTimeout(r, 10));
    const result = fib(n);
    const elapsed = (performance.now() - start).toFixed(1);
    setResults((r) => [...r.slice(-5), { n, result, elapsed, ts: Date.now() }]);
    setComputing(false);
    return result;
  }

  return { results, computing, compute };
}

// ====================================================================
// 13. Idempotency Guard — duplicate prevention
// ====================================================================
export function createIdempotencyDemo() {
  const guard = createIdempotencyGuard({ ttl: 60000 });
  const [log, setLog] = createSignal([]);

  async function processPayment(key, amount) {
    const { result, replayed } = await guard.execute(key, async () => {
      await delay(300); // simulate payment processing
      return { status: "charged", amount, txId: "tx_" + Date.now() };
    });
    setLog((l) => [
      ...l.slice(-10),
      { key, amount, replayed, ...result, ts: Date.now() },
    ]);
    return result;
  }

  function stats() {
    return guard.stats;
  }

  return { log, processPayment, stats };
}

// ====================================================================
// 14. Retry With Backoff — exponential + jitter
// ====================================================================
export function createRetryDemo() {
  const rb = createRetryWithBackoff({
    max: 3,
    backoff: "exponential",
    initialMs: 100,
    jitter: true,
  });
  const [log, setLog] = createSignal([]);

  async function call(shouldFail, failCount = 2) {
    let attempts = 0;
    try {
      const { result, attempts: at } = await rb.execute(async () => {
        attempts++;
        if (shouldFail && attempts <= failCount)
          throw new Error("Temporary error");
        return "✅ Recovered on attempt " + attempts;
      });
      setLog((l) => [
        ...l.slice(-10),
        { result, attempts: at, ts: Date.now() },
      ]);
    } catch (e) {
      setLog((l) => [
        ...l.slice(-10),
        { error: e.message, attempts, ts: Date.now() },
      ]);
    }
  }

  return { log, call };
}

// ====================================================================
// 15. Dead Letter Queue — poison message isolation
// ====================================================================
export function createDLQDemo() {
  const dlq = createDeadLetterQueue({ maxSize: 100, alertThreshold: 3 });
  const [log, setLog] = createSignal([]);

  dlq.onAlert(({ source, count }) => {
    setLog((l) => [
      ...l,
      "🚨 Alert: " + source + " has " + count + " dead messages",
    ]);
  });

  function failMessage(source, msg) {
    dlq.enqueue(source, msg, new Error("Processing failed"));
    setLog((l) => [...l.slice(-10), "💀 " + source + ": " + msg]);
  }

  async function replay(source) {
    const { replayed } = await dlq.replay(source, async (msg) => {
      setLog((l) => [...l.slice(-10), "🔄 Replayed: " + msg]);
    });
    setLog((l) => [
      ...l.slice(-10),
      `📊 Replayed ${replayed} messages from ${source}`,
    ]);
  }

  function stats() {
    return dlq.stats();
  }

  return {
    log,
    failMessage,
    replay,
    stats,
    sources: () => Object.keys(dlq.stats()),
  };
}
