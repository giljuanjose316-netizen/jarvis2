/*
 * Jarvis System Commands — extensión incremental.
 * Se monta sobre processInput existente y no reemplaza el núcleo de voz.
 */
(() => {
  if (typeof window.processInput !== "function") return;
  if (window.JarvisSystemCommands) return;

  const STORAGE_KEY = "jarvis_custom_command_aliases_v1";
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
    .replace(/\s+/g, " ")
    .trim();

  const appTargets = [
    ["chrome", "Chrome"],
    ["edge", "Microsoft Edge"],
    ["vscode", "Visual Studio Code"],
    ["notepad", "Bloc de notas"],
    ["calculator", "Calculadora"],
    ["explorer", "Explorador de archivos"],
    ["roblox", "Roblox"],
    ["discord", "Discord"],
    ["spotify", "Spotify"],
    ["steam", "Steam"],
    ["epic", "Epic Games"],
    ["whatsapp", "WhatsApp"],
    ["telegram", "Telegram"],
    ["word", "Word"],
    ["excel", "Excel"],
    ["powerpoint", "PowerPoint"]
  ];

  const jokes = [
    "Señor, intentaría contarle un chiste sobre computadoras, pero temo que tenga demasiados bugs.",
    "¿Por qué el programador confundió Halloween con Navidad? Porque OCT 31 es igual a DEC 25.",
    "Señor, mi sentido del humor está en modo beta, pero sigo compilando.",
    "Tengo una memoria excelente, señor. El problema es que funciona con localStorage."
  ];

  const loadAliases = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  };

  const saveAliases = (aliases) => localStorage.setItem(STORAGE_KEY, JSON.stringify(aliases));

  const speak = async (text) => {
    if (typeof window.speak === "function") return window.speak(text);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  };

  const stopEverything = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    document.querySelectorAll("audio").forEach((audio) => {
      try { audio.pause(); audio.currentTime = 0; } catch {}
    });
    if (window.JarvisCommandFixes?.stopAllSpeech) window.JarvisCommandFixes.stopAllSpeech();
  };

  const pauseEverything = () => {
    if (window.speechSynthesis) window.speechSynthesis.pause();
    document.querySelectorAll("audio").forEach((audio) => {
      try { audio.pause(); } catch {}
    });
  };

  const resumeEverything = () => {
    if (window.speechSynthesis) window.speechSynthesis.resume();
    document.querySelectorAll("audio").forEach((audio) => {
      try { if (audio.paused) audio.play().catch(() => {}); } catch {}
    });
  };

  const getStatus = () => {
    const consciousness = window.JarvisConsciousness?.get?.();
    const task = consciousness?.currentTask || consciousness?.lastAction;
    if (task) return `Ahora mismo estoy ejecutando: ${task}.`;
    if (consciousness?.state === "executing") return "Estoy ejecutando una tarea, señor.";
    return "Ahora mismo estoy en espera y listo para recibir una orden, señor.";
  };

  const closeAll = async (exceptions) => {
    const excluded = new Set(exceptions.map(removeWake).filter(Boolean));
    const skipped = [];
    const closed = [];

    for (const [app, label] of appTargets) {
      const normalizedLabel = normalize(label);
      const keep = [...excluded].some((item) =>
        item === app || item === normalizedLabel || normalizedLabel.includes(item) || item.includes(normalizedLabel)
      );
      if (keep) {
        skipped.push(label);
        continue;
      }
      if (typeof window.closeLocalApp !== "function") continue;
      try {
        const ok = await window.closeLocalApp(app, label);
        if (ok) closed.push(label);
      } catch {}
    }

    const suffix = skipped.length
      ? ` He dejado abiertas: ${skipped.join(", ")}.`
      : "";
    await speak(`He cerrado las aplicaciones compatibles que estaban abiertas.${suffix}`);
  };

  const originalProcessInput = window.processInput;

  window.processInput = async function systemCommandsInput(text, source = "text") {
    const command = removeWake(text);
    const aliases = loadAliases();

    // Aprender un sinónimo: "aprende que X significa Y".
    let match = command.match(/^aprende(?: que)? (.+?) (?:significa|es igual a) (.+)$/);
    if (match) {
      const alias = normalize(match[1]);
      const target = normalize(match[2]);
      if (alias && target) {
        aliases[alias] = target;
        saveAliases(aliases);
        await speak(`He aprendido que ${alias} significa ${target}, señor.`);
        return;
      }
    }

    if (aliases[command]) {
      return originalProcessInput(aliases[command], source);
    }

    if (/^(silencio|silenciate|silenciate ya|silenciar todo|silencia todo|callate)$/i.test(command)) {
      stopEverything();
      return;
    }

    if (/^(pausa|pausa todo|pausar todo|pausa lo que suena|pausar lo que suena)$/i.test(command)) {
      pauseEverything();
      await speak("Todo en pausa, señor.");
      return;
    }

    if (/^(reanuda|reanudar|reanuda todo|reanudar todo|continua|continuar)$/i.test(command)) {
      resumeEverything();
      await speak("Reanudado, señor.");
      return;
    }

    if (/^(que estas haciendo|que haces|que estas ejecutando|estado actual)$/i.test(command)) {
      await speak(getStatus());
      return;
    }

    if (/^(modo broma|cuenta un chiste|cuentame un chiste|dime un chiste)$/i.test(command)) {
      await speak(jokes[Math.floor(Math.random() * jokes.length)]);
      return;
    }

    if (/^cierra todo(?: excepto| salvo| menos)?\s*(.*)$/i.test(command)) {
      const matchAll = command.match(/^cierra todo(?: excepto| salvo| menos)?\s*(.*)$/i);
      const rawExceptions = (matchAll?.[1] || "").trim();
      const exceptions = rawExceptions
        ? rawExceptions.split(/\s+(?:y|,|tambien|también)\s+/).map((item) => item.trim()).filter(Boolean)
        : [];
      await closeAll(exceptions);
      return;
    }

    return originalProcessInput(text, source);
  };

  window.JarvisSystemCommands = {
    version: "1.0.0",
    clearLearnedCommands() {
      localStorage.removeItem(STORAGE_KEY);
    }
  };
})();
