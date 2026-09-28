/*
 * Jarvis Planning Layer — tercera capa
 * Convierte una intención en un plan explícito antes de ejecutarlo.
 * No ejecuta acciones por sí sola.
 */
(() => {
  const KEY = "jarvis_planning_state_v1";
  const MAX_PLANS = 20;

  const defaults = {
    status: "idle",
    currentPlan: null,
    lastPlan: null,
    plans: []
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!saved || typeof saved !== "object") return { ...defaults };
      return {
        ...defaults,
        ...saved,
        plans: Array.isArray(saved.plans) ? saved.plans.slice(-MAX_PLANS) : []
      };
    } catch {
      return { ...defaults };
    }
  }

  let state = load();

  function save() {
    state.plans = state.plans.slice(-MAX_PLANS);
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function get() {
    return JSON.parse(JSON.stringify(state));
  }

  function set(patch = {}) {
    state = { ...state, ...patch };
    save();
    window.dispatchEvent(new CustomEvent("jarvis:planner", { detail: get() }));
    return get();
  }

  function create(intent, basePlan) {
    const actions = Array.isArray(basePlan?.actions) ? basePlan.actions : [];

    const steps = actions.map((action, index) => ({
      order: index + 1,
      type: action.type,
      label: describeAction(action),
      status: "pending",
      requiresConfirmation: action.type === "system_action" &&
        ["shutdown", "restart"].includes(action.action)
    }));

    if (!steps.length && basePlan?.response) {
      steps.push({
        order: 1,
        type: "respond",
        label: "Responder al usuario",
        status: "pending",
        requiresConfirmation: false
      });
    }

    const plan = {
      id: "plan-" + Date.now(),
      createdAt: new Date().toISOString(),
      intent: intent?.type || "unknown",
      objective: objectiveFor(intent, basePlan),
      steps,
      status: "ready",
      requiresConfirmation: steps.some((step) => step.requiresConfirmation)
    };

    state.currentPlan = plan;
    state.status = "ready";
    save();
    return get().currentPlan;
  }

  function describeAction(action) {
    switch (action?.type) {
      case "open_app":
        return "Abrir " + (action.label || action.app);
      case "close_app":
        return "Cerrar " + (action.label || action.app);
      case "camera_on":
        return "Activar la cámara";
      case "camera_off":
        return "Desactivar la cámara";
      case "photo":
        return "Tomar una foto";
      case "system_action":
        return "Ejecutar " + action.action + " en Windows";
      default:
        return "Ejecutar acción";
    }
  }

  function objectiveFor(intent, basePlan) {
    const objectives = {
      open_app: "Abrir una aplicación solicitada",
      close_app: "Cerrar una aplicación solicitada",
      photo: "Activar la cámara y capturar una foto",
      camera_on: "Activar la cámara",
      camera_off: "Desactivar la cámara",
      system_action: "Ejecutar una acción del sistema",
      system_confirm: "Ejecutar una acción del sistema previamente confirmada",
      greeting: "Responder al usuario",
      wake: "Quedar listo para recibir una orden",
      memory: "Consultar la memoria local",
      remember: "Guardar información proporcionada por el usuario",
      cognitive_status: "Informar del contexto cognitivo actual"
    };

    return objectives[intent?.type] || "Resolver la solicitud del usuario";
  }

  function markRunning() {
    if (!state.currentPlan) return null;
    state.status = "running";
    state.currentPlan.status = "running";
    save();
    return get().currentPlan;
  }

  function markStep(index, status) {
    if (!state.currentPlan?.steps?.[index]) return null;
    state.currentPlan.steps[index].status = status;
    save();
    return get().currentPlan;
  }

  function complete(success = true) {
    if (!state.currentPlan) return null;

    state.currentPlan.status = success ? "completed" : "failed";
    state.status = success ? "completed" : "failed";
    state.lastPlan = state.currentPlan;
    state.plans.push(state.currentPlan);
    state.currentPlan = null;
    save();

    window.dispatchEvent(
      new CustomEvent("jarvis:planner-complete", { detail: get().lastPlan })
    );

    return get().lastPlan;
  }

  function summary() {
    if (!state.currentPlan) {
      return state.lastPlan
        ? "No hay un plan activo. El último plan terminó en estado " + state.lastPlan.status + "."
        : "No hay un plan activo.";
    }

    const pending = state.currentPlan.steps.filter(
      (step) => step.status === "pending"
    ).length;

    return "Plan " + state.currentPlan.status + ": " +
      state.currentPlan.objective + ". Pasos pendientes: " + pending + ".";
  }

  function reset() {
    state = { ...defaults };
    save();
  }

  window.JarvisPlanner = {
    get,
    set,
    create,
    markRunning,
    markStep,
    complete,
    summary,
    reset
  };
})();
