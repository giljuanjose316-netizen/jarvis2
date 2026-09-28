/* JARVIS_FIXES_V2 */
(() => {
  const originalDetectIntent = window.detectIntent;
  const originalCreatePlan = window.createPlan;
  const originalExecutePlan = window.executePlan;
  const originalSpeak = window.speak;

  const extraApps = [
    { pattern: /\b(discord)\b/, app: "discord", label: "Discord" },
    { pattern: /\b(spotify)\b/, app: "spotify", label: "Spotify" },
    { pattern: /\b(steam)\b/, app: "steam", label: "Steam" },
    { pattern: /\b(epic games|epic)\b/, app: "epic", label: "Epic Games" },
    { pattern: /\b(whatsapp)\b/, app: "whatsapp", label: "WhatsApp" },
    { pattern: /\b(telegram)\b/, app: "telegram", label: "Telegram" },
    { pattern: /\b(word|microsoft word)\b/, app: "word", label: "Microsoft Word" },
    { pattern: /\b(excel|microsoft excel)\b/, app: "excel", label: "Microsoft Excel" },
    { pattern: /\b(powerpoint|microsoft powerpoint)\b/, app: "powerpoint", label: "Microsoft PowerPoint" }
  ];

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[¿?¡!.,;:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function commandWithoutWakeWord(text) {
    return normalize(text)
      .replace(/\b(jarvis|yarvis|jervis|harvis)\b/g, " ")
      .replace(/\bpor favor\b/g, " ")
      .replace(/\bporfa\b/g, " ")
      .replace(/\bseñor\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findApp(command) {
    const normalized = normalize(command);
    const match = extraApps.find(item => item.pattern.test(normalized));
    if (match) return match;

    if (typeof window.findReferencedApp === "function") {
      try {
        const original = window.findReferencedApp(command);
        if (original) return original;
      } catch {}
    }
    return null;
  }

  function stopAllSpeech() {
    try { window.speechSynthesis?.cancel(); } catch {}
    try {
      if (window.JarvisAudioController?.stop) window.JarvisAudioController.stop();
    } catch {}
    try {
      document.querySelectorAll("audio").forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
    } catch {}
  }

  function detectIntentFixed(text) {
    const normalized = normalize(text);
    const command = commandWithoutWakeWord(text);
    const saysJarvis = /\b(jarvis|yarvis|jervis|harvis)\b/.test(normalized);

    if (/^(callate|silencio|deja de hablar|no hables)$/.test(command)) {
      return { type: "silence", command, normalized };
    }

    if (/^(?:pon|poner|ponme|reproduce|reproducir)(?:me)?\s+(?:la\s+)?musica$/.test(command)) {
      return { type: "spotify_random", command, normalized };
    }

    const spotifyMatch = command.match(
      /^(?:pon|poner|ponme|reproduce|reproducir)(?:me)?\s+(?:la\s+)?musica\s+(.+?)(?:\s+por favor)?$/
    );
    if (spotifyMatch) {
      return {
        type: "spotify_search",
        query: spotifyMatch[1].trim(),
        command,
        normalized
      };
    }

    if (!saysJarvis && !window.jarvisActive) {
      return { type: "ignore", command, normalized };
    }

    if (/^(?:cierra|cerrar|sal|salir|termina|terminar|apaga|apagar)\s+/.test(command)) {
      const app = findApp(command.replace(
        /^(?:cierra|cerrar|sal|salir|termina|terminar|apaga|apagar)\s+/,
        ""
      ));
      if (app) {
        return {
          type: "close_app",
          app: app.app,
          label: app.label,
          command,
          normalized
        };
      }
    }

    if (originalDetectIntent) {
      const intent = originalDetectIntent(text);
      if (intent?.type === "unknown") {
        const app = findApp(command);
        if (app && /\b(cierra|cerrar|sal|salir|termina|terminar|apaga|apagar)\b/.test(command)) {
          return { type: "close_app", app: app.app, label: app.label, command, normalized };
        }
      }
      return intent;
    }

    return { type: "unknown", command, normalized };
  }

  function createPlanFixed(intent) {
    if (intent.type === "silence") {
      return { type: "silence", actions: [] };
    }

    if (intent.type === "spotify_random") {
      return {
        type: "spotify_random",
        actions: [{ type: "spotify_random" }],
        replayable: true
      };
    }

    if (intent.type === "close_app") {
      return {
        type: "close_app",
        actions: [{ type: "close_app", app: intent.app, label: intent.label }]
      };
    }

    return originalCreatePlan(intent);
  }

  async function executePlanFixed(plan) {
    if (plan.type === "silence") {
      window.jarvisActive = false;
      stopAllSpeech();
      const status = document.getElementById("status");
      if (status) status.textContent = "Esperando la palabra Jarvis...";
      return;
    }

    if (plan.type === "spotify_random") {
      const status = document.getElementById("status");
      if (status) status.textContent = "Eligiendo una canción al azar en Spotify...";
      try {
        if (!window.JarvisSpotify?.searchAndPlayRandom) {
          throw new Error("El módulo de Spotify aleatorio no está disponible.");
        }
        const result = await window.JarvisSpotify.searchAndPlayRandom();
        const track = result.track;
        const artist = track.artists?.map(item => item.name).join(", ") || "artista desconocido";
        plan.response = `Reproduciendo ${track.name} de ${artist} en Spotify, señor.`;
      } catch (error) {
        console.error("Error reproduciendo Spotify:", error);
        plan.response = error?.message || "No pude reproducir una canción en Spotify, señor.";
      }
      if (status) status.textContent = "Jarvis activo.";
      return;
    }

    return originalExecutePlan(plan);
  }

  async function processInputFixed(text, source = "text") {
    const cleanText = String(text || "").trim();
    if (!cleanText) return;

    const command = commandWithoutWakeWord(cleanText);

    if (/^(callate|silencio|deja de hablar|no hables)$/.test(command)) {
      window.jarvisActive = false;
      stopAllSpeech();
      const status = document.getElementById("status");
      if (status) status.textContent = "Esperando la palabra Jarvis...";
      const transcript = document.getElementById("transcript");
      if (transcript) transcript.textContent = `${source === "voice" ? "Micrófono" : "Tú"}: ${cleanText}`;
      return;
    }

    const transcript = document.getElementById("transcript");
    if (transcript) {
      transcript.textContent = `${source === "voice" ? "Tú" : "Tú (texto)"}: ${cleanText}`;
    }

    const intent = detectIntentFixed(cleanText);
    if (intent.type === "ignore") return;

    const plan = createPlanFixed(intent);

    if (intent.type === "wake" || plan.type !== "silence") {
      window.jarvisActive = true;
    }

    await executePlanFixed(plan);

    if (plan.response && plan.type !== "silence") {
      await originalSpeak(plan.response);
    }
  }

  window.jarvisActive = false;
  window.detectIntent = detectIntentFixed;
  window.createPlan = createPlanFixed;
  window.executePlan = executePlanFixed;
  window.processInput = processInputFixed;
})();
