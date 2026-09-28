/*
 * Jarvis Time & Date — parches incrementales
 * Responde hora y fecha usando la hora local del navegador.
 */
(() => {
  if (typeof window.processInput !== "function") return;
  if (window.JarvisTimeDate) return;

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

  const isTimeQuery = (command) =>
    /\b(que hora es|que hora tienes|me dices la hora|dime la hora|dime que hora es|hora actual|hora exacta|hora son)\b/.test(command)
    || /^hora$/.test(command);

  const isDateQuery = (command) =>
    /\b(que fecha es|cual es la fecha|cual es tu fecha|dime la fecha|dime que fecha es|fecha actual|fecha de hoy|que dia es|que dia estamos|en que fecha estamos|hoy que fecha es)\b/.test(command)
    || /^fecha$/.test(command);

  const formatTime = (date) => new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Bogota"
  }).format(date).replace("a. m.", "de la mañana").replace("p. m.", "de la tarde");

  const formatDate = (date) => new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota"
  }).format(date);

  const originalProcessInput = window.processInput;

  window.processInput = async function timeDateInput(text, source = "text") {
    const command = removeWake(text);
    const now = new Date();

    if (isTimeQuery(command)) {
      const response = `Son las ${formatTime(now)}, señor.`;
      const transcript = document.getElementById("transcript");
      const status = document.getElementById("status");
      if (transcript) transcript.textContent = `Tú: ${String(text || "")}`;
      if (status) status.textContent = "Consultando hora...";
      if (typeof window.speak === "function") await window.speak(response);
      if (window.JarvisConsciousness) window.JarvisConsciousness.set({ state: "idle", currentTask: null, lastIntent: "time_query", lastResult: response });
      return;
    }

    if (isDateQuery(command)) {
      const response = `Hoy es ${formatDate(now)}, señor.`;
      const transcript = document.getElementById("transcript");
      const status = document.getElementById("status");
      if (transcript) transcript.textContent = `Tú: ${String(text || "")}`;
      if (status) status.textContent = "Consultando fecha...";
      if (typeof window.speak === "function") await window.speak(response);
      if (window.JarvisConsciousness) window.JarvisConsciousness.set({ state: "idle", currentTask: null, lastIntent: "date_query", lastResult: response });
      return;
    }

    return originalProcessInput(text, source);
  };

  window.JarvisTimeDate = { formatTime, formatDate };
})();
