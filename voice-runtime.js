/* JARVIS VOICE RUNTIME
 * Owns wake-word state so it is not split between script.js and patches.
 */
(() => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return;

  let active = false;
  const normalize = (text) => String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const hasWake = (text) => /\b(jarvis|yarvis|jervis|harvis)\b/.test(normalize(text));
  const commandOf = (text) => normalize(text)
    .replace(/\b(jarvis|yarvis|jervis|harvis)\b/g, " ")
    .replace(/\bpor favor\b/g, " ")
    .replace(/\bporfa\b/g, " ")
    .replace(/\bseñor\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const silenceCommand = (text) => /^(callate|silencio|deja de hablar|no hables)$/.test(commandOf(text));

  const dispatch = async (heard) => {
    const clean = String(heard || "").trim();
    if (!clean) return;

    const wake = hasWake(clean);
    const command = commandOf(clean);

    if (!active && !wake) return;

    if (wake) active = true;

    if (silenceCommand(clean)) {
      active = false;
      try { window.JarvisCommandFixes?.stopAllSpeech?.(); } catch {}
      try { window.speechSynthesis?.cancel(); } catch {}
      const status = document.getElementById("status");
      if (status) status.textContent = "Esperando la palabra Jarvis...";
      return;
    }

    const transcript = document.getElementById("transcript");
    if (transcript) transcript.textContent = `Micrófono: ${clean}`;

    if (typeof window.processInput === "function") {
      await window.processInput(clean, "voice");
    }
  };

  // Intercept the handler assigned by script.js without replacing SpeechRecognition itself.
  const descriptor = Object.getOwnPropertyDescriptor(Recognition.prototype, "onresult");
  if (!descriptor || !descriptor.set || !descriptor.get) return;

  Object.defineProperty(Recognition.prototype, "onresult", {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set(handler) {
      descriptor.set.call(this, async (event) => {
        const result = event.results[event.results.length - 1];
        const heard = result?.[0]?.transcript?.trim();
        if (!heard) return;
        try {
          await dispatch(heard);
        } catch (error) {
          console.error("Error procesando voz de Jarvis:", error);
        }
      });
    }
  });
})();
