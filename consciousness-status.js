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
    .replace(/\bseñor\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isLayerQuery = (text) => {
    const command = removeWake(text);
    return /\b(capas? de conciencia|capas? de consciencia|capas? del cerebro|tus capas|tus modulos|tus módulos|como estan tus capas|como estan tus modulos|estado de tus capas|estado de tus modulos)\b/.test(command);
  };

  const isStateQuery = (text) => {
    const command = removeWake(text);
    return /\b(cual es tu estado|cual es su estado|cual es el estado de jarvis|estado de jarvis|como estas|como esta jarvis|como se encuentra jarvis)\b/.test(command);
  };

  function buildLayerStatus() {
    const consciousness = window.JarvisConsciousness?.get?.();
    const cognitive = window.JarvisCognitive?.get?.();
    const planner = window.JarvisPlanner?.get?.();
    const goals = window.JarvisGoals?.get?.();
    const learning = window.JarvisLearning?.get?.();
    const reasoning = window.JarvisReasoning?.get?.();
    const autonomy = window.JarvisAutonomy?.get?.();

    const memoryMessages = (() => {
      try {
        const value = JSON.parse(localStorage.getItem("jarvis_conversation_memory_v2") || "[]");
        return Array.isArray(value) ? value.length : 0;
      } catch { return 0; }
    })();

    const activeGoal = goals?.goals?.find?.((goal) => goal.id === goals.currentGoalId) || null;
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
      if (window.JarvisConsciousness) {
        window.JarvisConsciousness.set({
          state: "idle",
          currentTask: null,
          lastIntent: "consciousness_layers_status",
          lastResult: response
        });
      }
      return;
    }

    if (isStateQuery(raw)) {
      const response = window.JarvisConsciousness?.summary?.()
        || "Mi estado operativo todavía no está disponible, señor.";
      if (typeof window.speak === "function") await window.speak(response);
      return;
    }

    return originalProcessInput(text, source);
  };

  window.JarvisConsciousnessStatus = {
    getLayerStatus: buildLayerStatus
  };
})();
