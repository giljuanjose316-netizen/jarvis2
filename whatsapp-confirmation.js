(() => {
  const NativeSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!NativeSpeechRecognition) return;

  let pendingWhatsAppMessage = null;

  function normalize(text) {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }

  function extractMessage(text) {
    const clean = text.trim();
    const patterns = [
      /^(?:jarvis[ ,]*)?(?:envia|manda|escribe|escribeme|dile)\s+(?:un\s+)?(?:mensaje\s+)?(?:a|al)\s+(.+?)\s*:\s*(.+)$/i,
      /^(?:jarvis[ ,]*)?(?:envia|manda|escribe)\s+(?:un\s+)?mensaje\s+a\s+(.+?)\s+(?:diciendo|que diga)\s+(.+)$/i,
      /^(?:jarvis[ ,]*)?(?:dile|escribele|escríbele)\s+a\s+(.+?)\s+(?:que|diciendo)\s+(.+)$/i
    ];
    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (match) return { contact: match[1].trim(), message: match[2].trim() };
    }
    return null;
  }

  function isConfirmation(text) {
    return /^(?:jarvis[ ,]*)?(?:si|sí|confirmo|confirmar|envialo|envíalo|manda|mándalo)$/i.test(text.trim());
  }

  function isCancellation(text) {
    return /^(?:jarvis[ ,]*)?(?:no|cancela|cancelar|no lo envies|no lo envíes|detenlo|detener)$/i.test(text.trim());
  }

  async function speak(text) {
    if (typeof window.speak === "function") return window.speak(text);
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-CO";
      window.speechSynthesis.speak(utterance);
    }
  }

  function handle(text) {
    const clean = text.trim();
    const normalized = normalize(clean);

    if (pendingWhatsAppMessage && isCancellation(clean)) {
      const cancelled = pendingWhatsAppMessage;
      pendingWhatsAppMessage = null;
      speak(`Cancelado. No enviaré el mensaje a ${cancelled.contact}.`);
      return true;
    }

    if (pendingWhatsAppMessage && isConfirmation(clean)) {
      const confirmed = pendingWhatsAppMessage;
      pendingWhatsAppMessage = null;
      window.dispatchEvent(new CustomEvent("jarvis:whatsapp-confirmed", { detail: confirmed }));
      speak(`Confirmado. El mensaje para ${confirmed.contact} quedó autorizado para envío.`);
      const status = document.getElementById("status");
      if (status) status.textContent = "Mensaje de WhatsApp confirmado.";
      return true;
    }

    if (/\b(whatsapp|mensaje|envia|envía|manda|escribe|dile)\b/.test(normalized)) {
      const message = extractMessage(clean);
      if (message) {
        pendingWhatsAppMessage = message;
        speak(`Voy a enviar a ${message.contact}: “${message.message}”. ¿Confirma?`);
        const status = document.getElementById("status");
        if (status) status.textContent = "Esperando confirmación de WhatsApp...";
        return true;
      }
    }

    return false;
  }

  // Se ejecuta antes de script.js y envuelve la instancia real de SpeechRecognition.
  // Así interceptamos comandos de WhatsApp antes de que lleguen al procesador general.
  function JarvisSpeechRecognition(...args) {
    const recognition = new NativeSpeechRecognition(...args);
    let originalOnResult = null;

    Object.defineProperty(recognition, "onresult", {
      configurable: true,
      get() { return originalOnResult; },
      set(handler) {
        originalOnResult = async (event) => {
          const text = event?.results?.[0]?.[0]?.transcript?.trim() || "";
          if (handle(text)) return;
          if (typeof handler === "function") return handler(event);
        };
      }
    });

    return recognition;
  }

  JarvisSpeechRecognition.prototype = NativeSpeechRecognition.prototype;
  window.SpeechRecognition = JarvisSpeechRecognition;
  window.webkitSpeechRecognition = JarvisSpeechRecognition;

  window.jarvisWhatsApp = {
    hasPendingMessage: () => Boolean(pendingWhatsAppMessage),
    cancel: () => { pendingWhatsAppMessage = null; }
  };
})();
