/*
 * Jarvis Planning Integration
 * Inserta planificación previa sin sustituir el ejecutor existente.
 */
(() => {
  if (!window.JarvisPlanner || typeof window.processInput !== "function") return;

  const originalProcessInput = window.processInput;

  window.processInput = async function jarvisPlannedInput(text, source = "text") {
    const raw = String(text || "").trim();
    const normalized = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const asksForPlan = /\b(plan|planifica|planificar|planea|planeear|que plan tienes|como lo harias|cuales son los pasos)\b/.test(normalized);

    if (asksForPlan && window.JarvisPlanner && typeof window.detectIntent === "function" && typeof window.createPlan === "function") {
      const command = normalized
        .replace(/\bjarvis\b/g, "")
        .replace(/\b(planifica|planificar|planea|planeear|plan|cuales son los pasos|que plan tienes|como lo harias)\b/g, "")
        .trim();

      if (command) {
        const intent = window.detectIntent(command);
        const preview = window.createPlan(intent);
        window.JarvisPlanner.create(intent, preview);
        const current = window.JarvisPlanner.get().currentPlan;

        const stepText = (current?.steps || [])
          .map((step) => step.order + ". " + step.label)
          .join(". ");

        const response = stepText
          ? "El plan sería: " + stepText + "."
          : window.JarvisPlanner.summary();

        const statusNode = document.getElementById("status");
        if (statusNode) statusNode.textContent = "Plan preparado.";
        if (typeof window.speak === "function") await window.speak(response);

        window.JarvisPlanner.complete(true);
        return;
      }
    }
    const clean = String(text || "").trim();

    if (clean && window.JarvisPlanner && typeof window.detectIntent === "function" && typeof window.createPlan === "function") {
      try {
        const intent = window.detectIntent(clean);
        const previewPlan = window.createPlan(intent);
        window.JarvisPlanner.create(intent, previewPlan);

        if (window.JarvisConsciousness) {
          window.JarvisConsciousness.set({
            state: "planning",
            currentTask: window.JarvisPlanner.get().currentPlan?.objective || intent.type
          });
        }

        if (window.JarvisCognitive) {
          window.JarvisCognitive.set({
            activeMode: "execution",
            lastDecision: "Plan preparado antes de ejecutar"
          });
        }
      } catch (error) {
        console.warn("Planificador: no se pudo preparar el plan previo.", error);
      }
    }

    const result = await originalProcessInput(text, source);

    if (window.JarvisPlanner) {
      const plannerState = window.JarvisPlanner.get();

      if (plannerState.currentPlan) {
        const responseText =
          window.JarvisConsciousness?.get()?.lastResult || "";

        const failed = /no pude|no puedo|no se pudo|no reconoc/i.test(responseText);

        plannerState.currentPlan.steps.forEach((step, index) => {
          window.JarvisPlanner.markStep(index, failed ? "failed" : "completed");
        });

        window.JarvisPlanner.complete(!failed);
      }
    }

    return result;
  };

  window.addEventListener("jarvis:planner-complete", (event) => {
    const plan = event.detail;
    if (!plan) return;

    if (window.JarvisCognitive) {
      window.JarvisCognitive.setDecision(
        "Plan " + plan.status,
        plan.status === "completed" ? null : "Revisar el resultado de la última ejecución."
      );
    }
  });
})();
