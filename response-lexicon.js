/* JARVIS RESPONSE LEXICON
 * Amplía las respuestas de activación sin reemplazar el núcleo de voz.
 */
(() => {
  if (window.JarvisResponseLexicon) return;

  const normalize = (text) => String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isWakeOnly = (text) => {
    const clean = normalize(text)
      .replace(/\b(jarvis|yarvis|jervis|harvis)\b/g, " ")
      .replace(/\bpor favor\b/g, " ")
      .replace(/\bporfa\b/g, " ")
      .replace(/\bsenor\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return !clean && /\b(jarvis|yarvis|jervis|harvis)\b/.test(normalize(text));
  };

  const responses = [
    "Aquí estoy, señor.",
    "A sus órdenes, señor.",
    "Lo escucho, señor.",
    "Dígame, señor.",
    "¿En qué puedo ayudarle?",
    "Estoy atento, señor.",
    "Adelante, señor.",
    "Sí, lo escucho.",
    "Preparado, señor.",
    "Aquí estoy. ¿Qué necesita?"
  ];

  let lastIndex = -1;

  const nextResponse = () => {
    if (responses.length === 1) return responses[0];
    let index;
    do {
      index = Math.floor(Math.random() * responses.length);
    } while (index === lastIndex);
    lastIndex = index;
    return responses[index];
  };

  const originalProcessInput = window.processInput;
  if (typeof originalProcessInput !== "function") return;

  window.processInput = async function jarvisLexiconProcessInput(text, source) {
    if (isWakeOnly(text)) {
      const response = nextResponse();
      const status = document.getElementById("status");
      if (status) status.textContent = "Jarvis activo.";
      const transcript = document.getElementById("transcript");
      if (transcript) transcript.textContent = `Micrófono: ${String(text).trim()}`;
      try {
        if (typeof window.speak === "function") await window.speak(response);
      } catch (error) {
        console.error("Error en respuesta de activación:", error);
      }
      return response;
    }

    return originalProcessInput.apply(this, arguments);
  };

  window.JarvisResponseLexicon = {
    responses,
    nextResponse
  };
})();
