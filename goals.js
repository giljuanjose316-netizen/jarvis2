/*
 * Jarvis Goals Layer — cuarta capa
 * Gestiona objetivos persistentes y su progreso. No ejecuta acciones.
 */
(() => {
  const KEY = "jarvis_goals_state_v1";
  const MAX_GOALS = 30;

  const defaults = {
    currentGoalId: null,
    goals: []
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!saved || typeof saved !== "object") return { ...defaults };
      return {
        ...defaults,
        ...saved,
        goals: Array.isArray(saved.goals) ? saved.goals.slice(-MAX_GOALS) : []
      };
    } catch {
      return { ...defaults };
    }
  }

  let state = load();

  function save() {
    state.goals = state.goals.slice(-MAX_GOALS);
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("jarvis:goals", { detail: get() }));
  }

  function get() {
    return JSON.parse(JSON.stringify(state));
  }

  function getCurrent() {
    return state.goals.find((goal) => goal.id === state.currentGoalId) || null;
  }

  function create(title) {
    const clean = String(title || "").trim();
    if (!clean) return null;

    const goal = {
      id: "goal-" + Date.now(),
      title: clean,
      status: "active",
      progress: 0,
      milestones: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null
    };

    state.goals.push(goal);
    state.currentGoalId = goal.id;
    save();
    return getCurrent();
  }

  function setCurrent(id) {
    const goal = state.goals.find((item) => item.id === id);
    if (!goal) return null;
    state.currentGoalId = id;
    goal.updatedAt = new Date().toISOString();
    save();
    return getCurrent();
  }

  function updateProgress(value) {
    const goal = getCurrent();
    if (!goal) return null;
    const progress = Math.max(0, Math.min(100, Number(value)));
    if (!Number.isFinite(progress)) return goal;
    goal.progress = Math.round(progress);
    goal.status = goal.progress >= 100 ? "completed" : "active";
    goal.updatedAt = new Date().toISOString();
    goal.completedAt = goal.progress >= 100 ? new Date().toISOString() : null;
    save();
    return getCurrent();
  }

  function addMilestone(title) {
    const goal = getCurrent();
    const clean = String(title || "").trim();
    if (!goal || !clean) return null;
    goal.milestones.push({
      id: "milestone-" + Date.now(),
      title: clean,
      completed: false,
      createdAt: new Date().toISOString()
    });
    goal.updatedAt = new Date().toISOString();
    save();
    return getCurrent();
  }

  function complete() {
    return updateProgress(100);
  }

  function summary() {
    const goal = getCurrent();
    if (!goal) return "No hay un objetivo activo.";
    const pending = goal.milestones.filter((item) => !item.completed).length;
    return `Objetivo actual: ${goal.title}. Progreso: ${goal.progress} por ciento. Hitos pendientes: ${pending}.`;
  }

  function list() {
    return get().goals;
  }

  function reset() {
    state = { ...defaults };
    save();
  }

  window.JarvisGoals = {
    get, getCurrent, create, setCurrent, updateProgress,
    addMilestone, complete, summary, list, reset
  };
})();
