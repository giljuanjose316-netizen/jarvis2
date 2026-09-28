/* Jarvis voice guard: silencia y bloquea órdenes hasta volver a oír la palabra Jarvis. */
(() => {
  const OriginalRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (OriginalRecognition) {
    const GuardedRecognition = function (...args) {
      const recognition = new OriginalRecognition(...args);
      let resultHandler = null;
      let silenced = false;

      Object.defineProperty(recognition, "onresult", {
        configurable: true,
        get() { return resultHandler; },
        set(handler) {
          resultHandler = typeof handler === "function" ? async (event) => {
            const result = event.results[event.results.length - 1];
            const heard = result?.[0]?.transcript?.trim() || "";
            const normalized = heard.toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[¿?¡!.,;:]/g, " ")
              .replace(/\s+/g, " ")
              .trim();

            const command = normalized
              .replace(/\b(jarvis|yarvis|jervis|harvis)\b/g, " ")
              .replace(/\s+/g, " ")
              .trim();

            const isSilence = /^(callate|silencio|deja de hablar|no hables)$/.test(command);
            const hasWakeWord = /\b(jarvis|yarvis|jervis|harvis)\b/.test(normalized);

            if (isSilence) {
              silenced = true;
              try { window.speechSynthesis?.cancel(); } catch {}
              try {
                document.querySelectorAll("audio").forEach(audio => {
                  audio.pause();
                  audio.currentTime = 0;
                });
              } catch {}
              try { window.JarvisAudioController?.stop?.(); } catch {}
              const status = document.getElementById("status");
              if (status) status.textContent = "Esperando la palabra Jarvis...";
              const transcript = document.getElementById("transcript");
              if (transcript) transcript.textContent = `Micrófono: ${heard}`;
              return;
            }

            if (silenced) {
              if (!hasWakeWord) return;
              silenced = false;
            }

            await handler(event);
          } : null;
        }
      });

      return recognition;
    };

    GuardedRecognition.prototype = OriginalRecognition.prototype;
    window.SpeechRecognition = GuardedRecognition;
    if (window.webkitSpeechRecognition) window.webkitSpeechRecognition = GuardedRecognition;
  }

  const OriginalAudio = window.Audio;
  if (OriginalAudio) {
    const activeAudios = new Set();
    const GuardedAudio = function (...args) {
      const audio = new OriginalAudio(...args);
      activeAudios.add(audio);
      audio.addEventListener("ended", () => activeAudios.delete(audio), { once: true });
      audio.addEventListener("error", () => activeAudios.delete(audio), { once: true });
      return audio;
    };
    GuardedAudio.prototype = OriginalAudio.prototype;
    window.Audio = GuardedAudio;

    window.JarvisVoiceGuard = {
      stopAudio() {
        for (const audio of activeAudios) {
          try { audio.pause(); audio.currentTime = 0; } catch {}
        }
        try { window.speechSynthesis?.cancel(); } catch {}
        try { window.JarvisAudioController?.stop?.(); } catch {}
      }
    };
  }
})();
