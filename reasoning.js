/* Jarvis Reasoning Layer — sexta capa */
(() => {
  const KEY = "jarvis_reasoning_state_v1";
  const defaults = { decisions: [], lastDecision: null };
  const MAX_DECISIONS = 40;
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      return saved && typeof saved === "object" ? { ...defaults, ...saved, decisions: Array.isArray(saved.decisions) ? saved.decisions.slice(-MAX_DECISIONS) : [] } : { ...defaults, decisions: [] };
    } catch { return { ...defaults, decisions: [] }; }
  }
  let state = load();
  function save() { state.decisions = state.decisions.slice(-MAX_DECISIONS); localStorage.setItem(KEY, JSON.stringify(state)); window.dispatchEvent(new CustomEvent("jarvis:reasoning", { detail: get() })); }
  function get() { return JSON.parse(JSON.stringify(state)); }
  function reason(input = {}) {
    const intent = String(input.intent || "unknown");
    const command = String(input.command || "");
    const cognitive = input.cognitive || {};
    const goal = input.goal || null;
    const learning = input.learning || {};
    const requiresConfirmation = ["system_action", "system_confirm"].includes(intent);
    const executionIntents = ["open_app", "close_app", "camera_on", "camera_off", "photo", "goal_create", "goal_progress", "goal_complete", "goal_milestone"];
    let mode = "answer", confidence = 0.55, rationale = "La orden puede resolverse con el contexto disponible.", nextAction = "Responder al usuario."; 
    if (intent === "unknown") { mode = "clarify"; confidence = 0.2; rationale = "No hay una intención reconocida con suficiente evidencia."; nextAction = "Pedir una aclaración concreta."; }
    else if (requiresConfirmation) { mode = "confirm"; confidence = 0.95; rationale = "La acción afecta el sistema y requiere confirmación explícita."; nextAction = "Solicitar confirmación antes de ejecutar."; }
    else if (executionIntents.includes(intent)) { mode = "execute"; confidence = 0.9; rationale = "La intención coincide con una capacidad operativa disponible."; nextAction = "Ejecutar el plan y comprobar el resultado."; }
    if (goal && goal.status === "active" && intent === "unknown") rationale += " Existe un objetivo activo, pero la orden no permite vincularla de forma segura.";
    if (learning?.intentCounts?.[intent] >= 3) rationale += " El historial muestra que esta intención ya se ha utilizado varias veces.";
    if (cognitive?.priority === "alta" && mode === "execute") rationale += " La prioridad cognitiva actual es alta.";
    const decision = { mode, confidence, rationale, nextAction, intent, command, goal: goal ? goal.title : null, time: new Date().toISOString() };
    state.lastDecision = decision; state.decisions.push(decision); save(); return get().lastDecision;
  }
  function summary() {
    if (!state.lastDecision) return "Todavía no he tomado una decisión registrada, señor."; 
    const d = state.lastDecision;
    return "Decisión: " + d.mode + ". Confianza heurística: " + Math.round(d.confidence * 100) + " por ciento. Motivo: " + d.rationale + " Siguiente paso: " + d.nextAction;
  }
  function reset() { state = { ...defaults, decisions: [] }; save(); }
  window.JarvisReasoning = { get, reason, summary, reset };
})();