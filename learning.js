/*
 * Jarvis Learning Layer — quinta capa
 * Aprende patrones de uso de forma local y transparente.
 * No ejecuta acciones ni infiere datos sensibles.
 */
(() => {
  const KEY = "jarvis_learning_state_v1";
  const MAX_EVENTS = 80;
  const defaults = {
    interactions: 0,
    successfulActions: 0,
    failedActions: 0,
    intentCounts: {},
    appCounts: {},
    learnedNotes: [],
    recentPatterns: []
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!saved || typeof saved !== "object") return { ...defaults, intentCounts: {}, appCounts: {}, learnedNotes: [], recentPatterns: [] };
      return {
        ...defaults,
        ...saved,
        intentCounts: saved.intentCounts && typeof saved.intentCounts === "object" ? saved.intentCounts : {},
        appCounts: saved.appCounts && typeof saved.appCounts === "object" ? saved.appCounts : {},
        learnedNotes: Array.isArray(saved.learnedNotes) ? saved.learnedNotes.slice(-MAX_EVENTS) : [],
        recentPatterns: Array.isArray(saved.recentPatterns) ? saved.recentPatterns.slice(-MAX_EVENTS) : []
      };
    } catch {
      return { ...defaults, intentCounts: {}, appCounts: {}, learnedNotes: [], recentPatterns: [] };
    }
  }

  let state = load();

  function save() {
    state.learnedNotes = state.learnedNotes.slice(-MAX_EVENTS);
    state.recentPatterns = state.recentPatterns.slice(-MAX_EVENTS);
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("jarvis:learning", { detail: get() }));
  }

  function get() {
    return JSON.parse(JSON.stringify(state));
  }

  function recordInteraction(intent, success = true, details = {}) {
    const type = String(intent || "unknown");
    state.interactions += 1;
    state.intentCounts[type] = (state.intentCounts[type] || 0) + 1;
    success ? state.successfulActions += 1 : state.failedActions += 1;

    const app = details.app ? String(details.app) : null;
    if (app) state.appCounts[app] = (state.appCounts[app] || 0) + 1;

    state.recentPatterns.push({
      intent: type,
      success: Boolean(success),
      app,
      time: new Date().toISOString()
    });
    save();
  }

  function addNote(note) {
    const clean = String(note || "").trim();
    if (!clean) return null;
    state.learnedNotes.push({ text: clean, time: new Date().toISOString() });
    save();
    return clean;
  }

  function topEntries(object, limit = 3) {
    return Object.entries(object)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  function summary() {
    if (!state.interactions && !state.learnedNotes.length) {
      return "Todavía no he aprendido patrones de uso suficientes, señor.";
    }

    const intents = topEntries(state.intentCounts)
      .map(([key, count]) => `${key}: ${count}`)
      .join(", ");

    const apps = topEntries(state.appCounts)
      .map(([key, count]) => `${key}: ${count}`)
      .join(", ");

    const notes = state.learnedNotes.length
      ? " Notas aprendidas: " + state.learnedNotes.slice(-3).map((n) => n.text).join("; ") + "."
      : "";

    return `He registrado ${state.interactions} interacciones. Exitosas: ${state.successfulActions}. Fallidas: ${state.failedActions}. Intenciones más frecuentes: ${intents || "ninguna"}. Aplicaciones más usadas: ${apps || "ninguna"}.${notes}`;
  }

  function suggest() {
    const topIntent = topEntries(state.intentCounts, 1)[0];
    const topApp = topEntries(state.appCounts, 1)[0];

    if (!topIntent && !topApp) {
      return "Aún no tengo suficiente historial para sugerir una mejora, señor.";
    }

    if (topApp) {
      return `La aplicación que más aparece en mi historial es ${topApp[0]}. Puedo usar este historial como contexto, sin ejecutar nada automáticamente.`;
    }

    return `La intención más frecuente de mi historial es ${topIntent[0]}. Puedo usar esta frecuencia como contexto para futuras mejoras.`;
  }

  function reset() {
    state = { ...defaults, intentCounts: {}, appCounts: {}, learnedNotes: [], recentPatterns: [] };
    save();
  }

  window.JarvisLearning = {
    get,
    recordInteraction,
    addNote,
    summary,
    suggest,
    reset
  };
})();
