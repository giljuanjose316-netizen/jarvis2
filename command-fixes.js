/*
 * Jarvis Command Fixes — parches incrementales
 * No reemplaza el ejecutor existente. Solo intercepta cierres explícitos
 * para evitar que una clasificación ambigua impida cerrar una aplicación.
 */
(() => {
  if (typeof window.processInput !== "function") return;
  if (window.JarvisCommandFixes) return;

  const normalize = (text) => String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const apps = [
    { pattern: /\broblox\b/, app: "roblox", label: "Roblox" },
    { pattern: /\b(microsoft\s+edge|edge)\b/, app: "edge", label: "Microsoft Edge" },
    { pattern: /\b(google\s+chrome|chrome)\b/, app: "chrome", label: "Chrome" },
    { pattern: /\b(visual\s+studio\s+code|vs\s*code|visual\s+code|vscode)\b/, app: "vscode", label: "Visual Studio Code" },
    { pattern: /\b(bloc\s+de\s+notas|notepad)\b/, app: "notepad", label: "Bloc de notas" },
    { pattern: /\b(calculadora|calculator)\b/, app: "calculator", label: "Calculadora" },
    { pattern: /\b(descargas|carpeta\s+de\s+descargas)\b/, app: "downloads", label: "Descargas" },
    { pattern: /\b(documentos|carpeta\s+de\s+documentos)\b/, app: "documents", label: "Documentos" },
    { pattern: /\b(escritorio|desktop)\b/, app: "desktop", label: "Escritorio" }
  ];

  const findApp = (command) => apps.find((item) => item.pattern.test(command));
  const isCloseCommand = (command) => /\b(cierra|cerrar|cierre|cerrame|cerrar)\b/.test(command);

  const originalProcessInput = window.processInput;

  window.processInput = async function commandFixesInput(text, source = "text") {
    const command = normalize(text)
      .replace(/\b(jarvis|yarvis|jervis|harvis)\b/g, " ")
      .replace(/\bpor favor\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (isCloseCommand(command)) {
      const target = findApp(command);
      if (target && typeof window.closeLocalApp === "function") {
        const ok = await window.closeLocalApp(target.app, target.label);
        if (typeof window.learningSet === "function") window.learningSet("close_app", ok, { app: target.app });
        return;
      }
    }

    return originalProcessInput(text, source);
  };

  window.JarvisCommandFixes = {
    normalize,
    stopAllSpeech() {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (window.currentAudio) {
        try { window.currentAudio.pause(); } catch {}
      }
    }
  };
})();
