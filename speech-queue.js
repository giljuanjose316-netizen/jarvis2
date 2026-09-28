/*
 * Jarvis Speech Queue — salida de voz incremental
 * Serializa respuestas largas para evitar cortes, solapamientos y repeticiones.
 * No reemplaza las capas de conciencia ni el reconocimiento de voz.
 */
(() => {
  const originalSpeak = window.speak;
  if (typeof originalSpeak !== "function" || window.JarvisSpeechQueue) return;

  let queue = [];
  let running = false;
  let stopped = false;
  let currentAudio = null;

  const splitSpeech = (text) => {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return [];
    if (clean.length <= 180) return [clean];

    const parts = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
    return parts
      .map((part) => part.trim())
      .filter(Boolean);
  };

  const playPart = (text) => new Promise(async (resolve) => {
    if (stopped) return resolve();

    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();

      const response = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error(`TTS ${response.status}: ${await response.text()}`);

      const audioUrl = URL.createObjectURL(await response.blob());
      const audio = new Audio(audioUrl);
      currentAudio = audio;

      const finish = () => {
        if (currentAudio === audio) currentAudio = null;
        URL.revokeObjectURL(audioUrl);
        resolve();
      };

      audio.onended = finish;
      audio.onerror = finish;
      await audio.play();
    } catch (error) {
      console.error("Cola de voz: ElevenLabs no pudo reproducir el audio:", error);

      if (!("speechSynthesis" in window)) return resolve();

      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "es-CO";
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.onend = resolve;
        utterance.onerror = resolve;
        window.speechSynthesis.speak(utterance);
      } catch (fallbackError) {
        console.error("Cola de voz: fallo de voz del navegador:", fallbackError);
        resolve();
      }
    }
  });

  const drain = async () => {
    if (running) return;
    running = true;

    while (queue.length && !stopped) {
      const item = queue.shift();
      await playPart(item);
    }

    queue = [];
    running = false;
    stopped = false;
  };

  window.speak = function queuedSpeak(text) {
    const parts = splitSpeech(text);
    if (!parts.length) return Promise.resolve();

    stopped = false;
    queue.push(...parts);
    drain();

    return new Promise((resolve) => {
      // La resolución del comando no depende de la reproducción completa.
      // La cola garantiza que las frases se reproduzcan en orden.
      const check = () => {
        if (!running && queue.length === 0) return resolve();
        setTimeout(check, 50);
      };
      check();
    });
  };

  window.JarvisSpeechQueue = {
    stop() {
      stopped = true;
      queue = [];
      try { window.speechSynthesis?.cancel(); } catch {}
      try {
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
      } catch {}
      currentAudio = null;
    },
    pending() {
      return queue.length;
    }
  };

  const previousStop = window.JarvisCommandFixes?.stopAllSpeech;
  if (window.JarvisCommandFixes) {
    window.JarvisCommandFixes.stopAllSpeech = () => {
      try { previousStop?.(); } catch {}
      window.JarvisSpeechQueue.stop();
    };
  }
})();
