/*
 * Jarvis Cognitive Context Layer — segunda capa
 * Convierte el estado operativo en contexto situacional.
 * No implica conciencia real: organiza contexto, prioridades y continuidad.
 */
(() => {
  const KEY = "jarvis_cognitive_context_v1";
  const MAX_CONTEXT_EVENTS = 50;

  const defaults = {
    sessionStartedAt: new Date().toISOString(),
    interactionCount: 0,
    activeMode: "standby",
    priority: "normal",
    userPresent: true,
    lastSource: null,
    lastTopic: null,
    lastDecision: null,
    nextSuggestedAction: null,
    contextEvents: []
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!saved || typeof saved !== "object") return { ...defaults };
      return {
        ...defaults,
        ...saved,
        contextEvents: Array.isArray(saved.contextEvents)
          ? saved.contextEvents.slice(-MAX_CONTEXT_EVENTS)
          : []
      };
    } catch {
      return { ...defaults };
    }
  }

  let context = load();

  function save() {
    context.contextEvents = context.contextEvents.slice(-MAX_CONTEXT_EVENTS);
    localStorage.setItem(KEY, JSON.stringify(context));
  }

  function get() {
    return JSON.parse(JSON.stringify(context));
  }

  function set(patch = {}) {
    context = { ...context, ...patch };
    save();
    window.dispatchEvent(
      new CustomEvent("jarvis:cognitive-context", { detail: get() })
    );
    return get();
  }

  function remember(type, detail = "") {
    context.contextEvents.push({
      type,
      detail: String(detail),
      time: new Date().toISOString()
    });
    save();
  }

  function registerInteraction(source, topic) {
    context.interactionCount += 1;
    context.lastSource = source || null;
    context.lastTopic = topic || null;
    save();
  }

  function setDecision(decision, nextSuggestedAction = null) {
    context.lastDecision = decision || null;
    context.nextSuggestedAction = nextSuggestedAction || null;
    save();
  }

  function inferMode(intentType) {
    const activeIntents = new Set([
      "open_app",
      "close_app",
      "system_action",
      "system_confirm",
      "camera_on",
      "camera_off",
      "photo"
    ]);

    if (activeIntents.has(intentType)) return "execution";
    if (intentType === "consciousness_status" || intentType === "memory") {
      return "reflection";
    }
    if (intentType === "greeting" || intentType === "wake") return "ready";
    return "conversation";
  }

  function buildSummary(operationalState = null, recentMemory = []) {
    const op = operationalState || {};
    const recentCount = Array.isArray(recentMemory) ? recentMemory.length : 0;
    const parts = [
      "modo: " + context.activeMode,
      "prioridad: " + context.priority,
      "interacciones de sesión: " + context.interactionCount,
      context.lastTopic ? "último tema: " + context.lastTopic : null,
      op.currentTask ? "tarea operativa: " + op.currentTask : null,
      op.lastIntent ? "última intención: " + op.lastIntent : null,
      op.bridgeOnline === true ? "Bridge disponible" :
        op.bridgeOnline === false ? "Bridge no disponible" : null,
      op.cameraActive ? "cámara activa" : null,
      op.pendingConfirmation ? "confirmación pendiente: " + op.pendingConfirmation : null,
      "eventos recientes en memoria conversacional: " + recentCount,
      context.nextSuggestedAction ? "siguiente acción sugerida: " + context.nextSuggestedAction : null
    ].filter(Boolean);

    return parts.join(". ") + ".";
  }

  function reset() {
    context = {
      ...defaults,
      sessionStartedAt: new Date().toISOString()
    };
    save();
    remember("reset", "Contexto cognitivo reiniciado");
  }

  window.JarvisCognitive = {
    get,
    set,
    remember,
    registerInteraction,
    setDecision,
    inferMode,
    buildSummary,
    reset
  };
})();
