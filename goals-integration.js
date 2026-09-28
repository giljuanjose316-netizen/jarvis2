/*
 * Jarvis Goals Integration — cuarta capa
 * Interpreta órdenes de objetivos antes de la ejecución normal.
 */
(() => {
  if (!window.JarvisGoals || typeof window.processInput !== "function") return;

  const originalProcessInput = window.processInput;

  function speakSafe(text) {
    return typeof window.speak === "function" ? window.speak(text) : Promise.resolve();
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .replace(/\\s+/g, " ")
      .trim();
  }

  window.processInput = async function jarvisGoalsInput(text, source = "text") {
    const raw = String(text || "").trim();
    const n = normalize(raw).replace(/\\bjarvis\\b/g, "").trim();

    let match = n.match(/^(?:crea|crear|define|definir) (?:un )?objetivo(?: de)? (.+)$/);
    if (match) {
      const goal = window.JarvisGoals.create(match[1]);
      const response = goal
        ? `Objetivo creado: ${goal.title}. Progreso inicial: cero por ciento.`
        : "No pude crear el objetivo.";
      if (window.JarvisConsciousness) window.JarvisConsciousness.set({ goal: goal?.title || null, currentTask: "gestionar objetivo", state: "idle" });
      await speakSafe(response);
      return;
    }

    if (/^(?:cual es|cual es el|cual es mi) objetivo(?: actual)?$/.test(n) || /^(?:que objetivo tengo|objetivo actual)$/.test(n)) {
      const response = window.JarvisGoals.summary();
      await speakSafe(response);
      return;
    }

    if (/^(?:muestra|mostrar|lista|listar) (?:mis )?objetivos$/.test(n) || /^(?:que objetivos tengo|mis objetivos)$/.test(n)) {
      const goals = window.JarvisGoals.list();
      const response = goals.length
        ? "Mis objetivos registrados son: " + goals.map((g, i) => `${i + 1}. ${g.title}, ${g.progress} por ciento.`).join(" ")
        : "No hay objetivos registrados.";
      await speakSafe(response);
      return;
    }

    match = n.match(/^(?:marca|pon|actualiza) (?:el )?progreso (?:a|en) (\\d{1,3}) ?(?:por ciento|%)?$/);
    if (match) {
      const goal = window.JarvisGoals.updateProgress(Number(match[1]));
      const response = goal
        ? `Progreso actualizado a ${goal.progress} por ciento para ${goal.title}.`
        : "No hay un objetivo activo para actualizar.";
      await speakSafe(response);
      return;
    }

    if (/^(?:completa|completar|termina|terminar) (?:el )?objetivo$/.test(n)) {
      const goal = window.JarvisGoals.complete();
      const response = goal
        ? `Objetivo completado: ${goal.title}.`
        : "No hay un objetivo activo para completar.";
      if (window.JarvisConsciousness) window.JarvisConsciousness.set({ goal: goal?.title || null, currentTask: null, state: "idle" });
      await speakSafe(response);
      return;
    }

    match = n.match(/^(?:anade|agrega|crear) (?:un )?hito(?: al objetivo)? (.+)$/);
    if (match) {
      const goal = window.JarvisGoals.addMilestone(match[1]);
      const response = goal
        ? `Hito añadido al objetivo ${goal.title}.`
        : "No hay un objetivo activo para añadirle un hito.";
      await speakSafe(response);
      return;
    }

    return originalProcessInput(text, source);
  };

  window.addEventListener("jarvis:planner-complete", (event) => {
    const goal = window.JarvisGoals.getCurrent();
    const plan = event.detail;
    if (!goal || !plan || plan.status !== "completed") return;
    if (window.JarvisCognitive) {
      window.JarvisCognitive.set({
        lastDecision: "Plan completado dentro del objetivo activo",
        nextSuggestedAction: goal.progress < 100 ? "Continuar con el siguiente paso del objetivo." : null
      });
    }
  });
})();
