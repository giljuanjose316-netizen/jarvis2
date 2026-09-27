/*
 * Jarvis Consciousness Layer
 * Conciencia operativa: estado, contexto, capacidades y objetivos.
 * No implica conciencia real; mantiene un modelo interno del estado de Jarvis.
 */
(() => {
  const KEY = "jarvis_conscious_state_v1";
  const MAX_EVENTS = 30;

  const defaultState = {
    state: "idle",
    currentTask: null,
    lastCommand: null,
    lastIntent: null,
    lastAction: null,
    lastResult: null,
    bridgeOnline: null,
    cameraActive: false,
    pendingConfirmation: null,
    goal: null,
    events: []
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      return saved && typeof saved === "object"
        ? { ...defaultState, ...saved, events: Array.isArray(saved.events) ? saved.events : [] }
        : { ...defaultState };
    } catch {
      return { ...defaultState };
    }
  }

  let state = load();

  function save() {
    state.events = state.events.slice(-MAX_EVENTS);
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function get() {
    return JSON.parse(JSON.stringify(state));
  }

  function set(patch = {}) {
    state = { ...state, ...patch };
    save();
    window.dispatchEvent(new CustomEvent("jarvis:consciousness", { detail: get() }));
    return get();
  }

  function rememberEvent(type, detail = "") {
    state.events.push({
      type,
      detail: String(detail),
      time: new Date().toISOString()
    });
    save();
  }

  function summary() {
    const parts = [
      `estado: ${state.state}`,
      state.currentTask ? `tarea actual: ${state.currentTask}` : null,
      state.lastIntent ? `última intención: ${state.lastIntent}` : null,
      state.lastAction ? `última acción: ${state.lastAction}` : null,
      state.bridgeOnline === true ? "Bridge conectado" :
        state.bridgeOnline === false ? "Bridge desconectado" : null,
      state.cameraActive ? "cámara activa" : null,
      state.pendingConfirmation ? `confirmación pendiente: ${state.pendingConfirmation}` : null,
      state.goal ? `objetivo: ${state.goal}` : null
    ].filter(Boolean);

    return parts.join(". ") + ".";
  }

  function reset() {
    state = { ...defaultState };
    save();
    rememberEvent("reset", "Estado de conciencia reiniciado");
  }

  window.JarvisConsciousness = { get, set, rememberEvent, summary, reset };
})();
