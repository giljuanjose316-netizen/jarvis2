/*
 * Jarvis Consciousness Status — extensión no destructiva
 * Consulta las capas existentes sin reemplazarlas ni duplicar su estado.
 */
(() => {
  if (typeof window.processInput !== "function") return;
  if (window.JarvisConsciousnessStatus) return;

  const normalize = (text) => String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const removeWake = (text) => normalize(text)
    .replace(/\b(jarvis|yarvis|jervis|harvis)\b/g, " ")
    .replace(/\bpor favor\b/g, " ")
    .replace(/\bporfa\b/g, " ")
    .replace(/\bsenor\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isLayerQuery = (text) => {
    const command = removeWake(text);
    return /\b(ocho capas|8 capas|capas? de conciencia|capas? de consciencia|capas? del cerebro|tus capas|tus modulos|como estan tus capas|como estan tus modulos|estado de tus capas|estado de tus modulos|estado de las ocho capas|estado de las 8 capas)\b/.test(command);
  };

  const isStateQuery = (text) => {
    const command = removeWake(text);
    return /\b(cual es tu estado|cual es su estado|cual es el estado de jarvis|estado de jarvis|como estas|como esta jarvis|como se encuentra jarvis)\b/.test(command);
  };

  function getLayerData() {
    const consciousness = window.JarvisConsciousness?.get?.();
    const cognitive = window.JarvisCognitive?.get?.();
    const planner = window.JarvisPlanner?.get?.();
    const goals = window.JarvisGoals?.get?.();
    const learning = window.JarvisLearning?.get?.();
    const reasoning = window.JarvisReasoning?.get?.();
    const autonomy = window.JarvisAutonomy?.get?.();
    let memoryMessages = 0;
    try {
      const value = JSON.parse(localStorage.getItem("jarvis_conversation_memory_v2") || "[]");
      memoryMessages = Array.isArray(value) ? value.length : 0;
    } catch {}
    const activeGoal = goals?.goals?.find?.((goal) => goal.id === goals.currentGoalId) || null;
    return { consciousness, cognitive, planner, goals, learning, reasoning, autonomy, memoryMessages, activeGoal };
  }

  function buildLayerStatus() {
    const { consciousness, cognitive, planner, learning, reasoning, autonomy, memoryMessages, activeGoal } = getLayerData();
    const lines = [
      `Conciencia operativa: ${consciousness?.state || "no disponible"}.`,
      `Contexto cognitivo: ${cognitive?.activeMode || "no disponible"}, prioridad ${cognitive?.priority || "normal"}.`,
      `Planificación: ${planner?.status || "no disponible"}.`,
      `Objetivos: ${activeGoal ? `${activeGoal.title}, ${activeGoal.progress} por ciento` : "sin objetivo activo"}.`,
      `Memoria: ${memoryMessages} registros conversacionales locales.`,
      `Aprendizaje: ${learning?.interactions || 0} interacciones registradas.`,
      `Razonamiento: ${reasoning?.lastDecision ? "con una decisión registrada" : "sin decisión registrada"}.`,
      `Autonomía controlada: ${autonomy?.status || "no disponible"}.`
    ];
    return "Estado de mis ocho capas: " + lines.join(" ");
  }

  function buildFullState() {
    const { consciousness, cognitive, planner, learning, reasoning, autonomy, memoryMessages, activeGoal } = getLayerData();
    return [
      "Estoy operativo, señor.",
      `Conciencia: ${consciousness?.state || "no disponible"}.`,
      `Contexto cognitivo: ${cognitive?.activeMode || "no disponible"}.`,
      `Planificación: ${planner?.status || "no disponible"}.`,
      `Objetivos: ${activeGoal ? `${activeGoal.title}, ${activeGoal.progress} por ciento` : "sin objetivo activo"}.`,
      `Memoria: ${memoryMessages} registros locales.`,
      `Aprendizaje: ${learning?.interactions || 0} interacciones.`,
      `Razonamiento: ${reasoning?.lastDecision ? "activo con una decisión registrada" : "sin decisión registrada"}.`,
      `Autonomía controlada: ${autonomy?.status || "no disponible"}.`
    ].join(" ");
  }

  const originalProcessInput = window.processInput;

  window.processInput = async function consciousnessStatusInput(text, source = "text") {
    const raw = String(text || "").trim();

    if (isLayerQuery(raw)) {
      const response = buildLayerStatus();
      const transcript = document.getElementById("transcript");
      const status = document.getElementById("status");
      if (transcript) transcript.textContent = `Tú: ${raw}`;
      if (status) status.textContent = "Consultando capas de conciencia...";
      if (typeof window.speak === "function") await window.speak(response);
      if (window.JarvisConsciousness) window.JarvisConsciousness.set({ state: "idle", currentTask: null, lastIntent: "consciousness_layers_status", lastResult: response });
      return;
    }

    if (isStateQuery(raw)) {
      const response = buildFullState();
      const transcript = document.getElementById("transcript");
      const status = document.getElementById("status");
      if (transcript) transcript.textContent = `Tú: ${raw}`;
      if (status) status.textContent = "Consultando estado de Jarvis...";
      if (typeof window.speak === "function") await window.speak(response);
      if (window.JarvisConsciousness) window.JarvisConsciousness.set({ state: "idle", currentTask: null, lastIntent: "consciousness_status", lastResult: response });
      return;
    }

    return originalProcessInput(text, source);
  };

  window.JarvisConsciousnessStatus = { getLayerStatus: buildLayerStatus, getFullState: buildFullState };
})();
