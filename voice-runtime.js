/* JARVIS VOICE RUNTIME V2
 * Centraliza el estado de escucha y da prioridad absoluta a "Jarvis, cállate".
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

  const commandOf = (text) => normalize(text)
    .replace(/\b(jarvis|yarvis|jervis|harvis)\b/g, " ")
    .replace(/\bpor favor\b/g, " ")
    .replace(/\bporfa\b/g, " ")
    .replace(/\bseñor\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const hasWake = (text) => /\b(jarvis|yarvis|jervis|harvis)\b/.test(normalize(text));

  // Acepta "cállate", "cállate ya" y pequeñas variaciones del reconocimiento.
  const isSilenceCommand = (text) => {
    const command = commandOf(text);
    return /\bcallate\b/.test(command)
      || /\b(calla|silencio|deja de hablar|no hables)\b/.test(command);
  };

  const stopEverything = () => {
    try { window.speechSynthesis?.cancel(); } catch {}
    try { window.JarvisCommandFixes?.stopAllSpeech?.(); } catch {}
    try {
      document.querySelectorAll("audio").forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
    } catch {}
  };

  const silenceImmediately = (recognitionInstance) => {
    active = false;
    stopEverything();
    const status = document.getElementById("status");
    if (status) status.textContent = "Esperando la palabra Jarvis...";
    const transcript = document.getElementById("transcript");
    if (transcript) transcript.textContent = "Micrófono: Jarvis, cállate";
    try { recognitionInstance?.stop?.(); } catch {}
  };

  const dispatch = async (heard, recognitionInstance) => {
    const clean = String(heard || "").trim();
    if (!clean) return;

    // Silencio tiene prioridad sobre cualquier otra intención.
    if (isSilenceCommand(clean)) {
      silenceImmediately(recognitionInstance);
      return;
    }

    const wake = hasWake(clean);
    if (!active && !wake) return;
    if (wake) active = true;

    const transcript = document.getElementById("transcript");
    if (transcript) transcript.textContent = `Micrófono: ${clean}`;

    if (typeof window.processInput === "function") {
      // Pause recognition while Jarvis processes and speaks the command.
      // This prevents the microphone from hearing Jarvis's own response.
      try {
        recognitionInstance.__jarvisHold = true;
        recognitionInstance.stop();
      } catch {}

      try {
        await window.processInput(clean, "voice");
      } finally {
        recognitionInstance.__jarvisHold = false;
        window.setTimeout(() => {
          try {
            recognitionInstance.start();
          } catch {}
        }, 250);
      }
    }
  };

  const descriptor = Object.getOwnPropertyDescriptor(Recognition.prototype, "onresult");
  if (!descriptor || !descriptor.set || !descriptor.get) return;

  Object.defineProperty(Recognition.prototype, "onresult", {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set(handler) {
      descriptor.set.call(this, async function(event) {
        const result = event.results[event.results.length - 1];
        const heard = result?.[0]?.transcript?.trim();
        if (!heard) return;
        try {
          await dispatch(heard, this);
        } catch (error) {
          console.error("Error procesando voz de Jarvis:", error);
        }
      });
    }
  });
})();
