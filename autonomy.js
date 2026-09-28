/* Jarvis Controlled Autonomy Layer — séptima capa
 * Orquesta objetivos en pasos acotados. No ejecuta acciones externas por sí sola.
 * Requiere objetivo activo, tiene límites de pasos y se detiene ante incertidumbre.
 */
(() => {
  const KEY = "jarvis_autonomy_state_v1";
  const MAX_STEPS = 8;
  const MAX_HISTORY = 30;

  const defaults = {
    status: "idle",
    activeObjective: null,
    taskQueue: [],
    currentStep: 0,
    maxSteps: MAX_STEPS,
    pendingApproval: false,
    history: []
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!saved || typeof saved !== "object") return { ...defaults, history: [] };
      return {
        ...defaults,
        ...saved,
        taskQueue: Array.isArray(saved.taskQueue) ? saved.taskQueue.slice(0, MAX_STEPS) : [],
        history: Array.isArray(saved.history) ? saved.history.slice(-MAX_HISTORY) : []
      };
    } catch {
      return { ...defaults, history: [] };
    }
  }

  let state = load();

  function save() {
    state.taskQueue = state.taskQueue.slice(0, MAX_STEPS);
    state.history = state.history.slice(-MAX_HISTORY);
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("jarvis:autonomy", { detail: get() }));
  }

  function get() {
    return JSON.parse(JSON.stringify(state));
  }

  function buildTasks(goal) {
    const milestones = Array.isArray(goal?.milestones)
      ? goal.milestones.filter((item) => !item.completed)
      : [];

    if (milestones.length) {
      return milestones.slice(0, MAX_STEPS).map((item, index) => ({
        id: "task-" + Date.now() + "-" + index,
        title: item.title,
        source: "milestone",
        status: "pending"
      }));
    }

    return [{
      id: "task-" + Date.now(),
      title: "Definir el siguiente paso concreto para: " + goal.title,
      source: "goal",
      status: "pending"
    }];
  }

  function start(goal) {
    if (!goal || goal.status !== "active") {
      return { ok: false, message: "Necesito un objetivo activo para iniciar el trabajo autónomo controlado." };
    }

    state.activeObjective = goal.title;
    state.taskQueue = buildTasks(goal);
    state.currentStep = 0;
    state.status = "running";
    state.pendingApproval = false;
    state.history.push({
      type: "start",
      objective: goal.title,
      time: new Date().toISOString()
    });
    save();

    return {
      ok: true,
      task: state.taskQueue[0] || null,
      message: state.taskQueue[0]
        ? "Autonomía controlada iniciada. Siguiente paso: " + state.taskQueue[0].title + "."
        : "No hay pasos disponibles."
    };
  }

  function next() {
    if (state.status !== "running") {
      return { ok: false, message: "No hay una tarea autónoma en ejecución." };
    }

    const current = state.taskQueue[state.currentStep];
    if (current) current.status = "checkpoint";
    state.currentStep += 1;

    if (state.currentStep >= state.taskQueue.length) {
      state.status = "completed";
      state.history.push({
        type: "complete",
        objective: state.activeObjective,
        time: new Date().toISOString()
      });
      save();
      return { ok: true, done: true, message: "He terminado la secuencia de pasos planificados. El objetivo no se marca como completado automáticamente." };
    }

    const nextTask = state.taskQueue[state.currentStep];
    state.history.push({
      type: "advance",
      step: state.currentStep + 1,
      task: nextTask.title,
      time: new Date().toISOString()
    });
    save();

    return {
      ok: true,
      done: false,
      task: nextTask,
      message: "Siguiente paso: " + nextTask.title + "."
    };
  }

  function pause() {
    if (state.status !== "running") return false;
    state.status = "paused";
    state.history.push({ type: "pause", time: new Date().toISOString() });
    save();
    return true;
  }

  function resume() {
    if (state.status !== "paused") return false;
    state.status = "running";
    state.history.push({ type: "resume", time: new Date().toISOString() });
    save();
    return true;
  }

  function stop() {
    if (state.status === "idle") return false;
    state.status = "idle";
    state.pendingApproval = false;
    state.history.push({ type: "stop", time: new Date().toISOString() });
    save();
    return true;
  }

  function summary() {
    if (state.status === "idle") return "La autonomía controlada está detenida.";
    const current = state.taskQueue[state.currentStep];
    return "Autonomía controlada: " + state.status +
      ". Objetivo: " + (state.activeObjective || "ninguno") +
      ". Paso: " + Math.min(state.currentStep + 1, state.taskQueue.length) +
      " de " + state.taskQueue.length +
      (current ? ". Siguiente: " + current.title + "." : ".");
  }

  function reset() {
    state = { ...defaults, history: [] };
    save();
  }

  window.JarvisAutonomy = { get, start, next, pause, resume, stop, summary, reset };
})();