(() => {
  const originalProcessInput = window.processInput;
  if (typeof originalProcessInput !== "function") {
    console.error("Jarvis: processInput no está disponible para la capa de WhatsApp.");
    return;
  }

  let pendingWhatsAppMessage = null;

  function normalizeWhatsAppText(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractWhatsAppMessage(text) {
    const clean = text.trim();
    const normalized = normalizeWhatsAppText(clean);
    if (!/\b(whatsapp|mensaje|escrib|manda|envia|enví)\b/.test(normalized)) return null;

    const patterns = [
      /^(?:jarvis[ ,]*)?(?:envia|manda|mando|escribe|escribeme|dile)\s+(?:un\s+)?(?:mensaje\s+)?(?:a|al)\s+(.+?)\s*:\s*(.+)$/i,
      /^(?:jarvis[ ,]*)?(?:envia|manda|escribe)\s+(?:un\s+)?mensaje\s+a\s+(.+?)\s+(?:diciendo|que diga)\s+(.+)$/i,
      /^(?:jarvis[ ,]*)?(?:dile|escribele|escríbele)\s+a\s+(.+?)\s+(?:que|diciendo)\s+(.+)$/i
    ];

    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (match) {
        return {
          contact: match[1].trim(),
          message: match[2].trim()
        };
      }
    }

    return null;
  }

  function isWhatsAppConfirmation(text) {
    return /^(?:jarvis[ ,]*)?(?:si|sí|confirmo|confirmar|envialo|envíalo|manda|mandalo|mándalo)$/i.test(text.trim());
  }

  function isWhatsAppCancellation(text) {
    return /^(?:jarvis[ ,]*)?(?:no|cancela|cancelar|no lo envies|no lo envíes|detenlo|detener)$/i.test(text.trim());
  }

  async function handleWhatsAppInput(text, source) {
    const message = extractWhatsAppMessage(text);

    if (message) {
      pendingWhatsAppMessage = message;
      const response = `Voy a enviar a ${message.contact}: “${message.message}”. ¿Confirma?`;
      if (typeof window.speak === "function") await window.speak(response);
      const status = document.getElementById("status");
      if (status) status.textContent = "Esperando confirmación de WhatsApp...";
      return true;
    }

    if (pendingWhatsAppMessage && isWhatsAppCancellation(text)) {
      const cancelled = pendingWhatsAppMessage;
      pendingWhatsAppMessage = null;
      const response = `Cancelado. No enviaré el mensaje a ${cancelled.contact}.`;
      if (typeof window.speak === "function") await window.speak(response);
      return true;
    }

    if (pendingWhatsAppMessage && isWhatsAppConfirmation(text)) {
      const confirmed = pendingWhatsAppMessage;
      pendingWhatsAppMessage = null;

      // Esta capa solo confirma la intención. El envío real se conectará
      // a WhatsApp Web en la siguiente etapa, evitando envíos accidentales.
      window.dispatchEvent(new CustomEvent("jarvis:whatsapp-confirmed", {
        detail: confirmed
      }));

      const response = `Confirmado. El mensaje para ${confirmed.contact} quedó autorizado para envío.`;
      if (typeof window.speak === "function") await window.speak(response);
      const status = document.getElementById("status");
      if (status) status.textContent = "Mensaje de WhatsApp confirmado.";
      return true;
    }

    return false;
  }

  window.processInput = async function(text, source = "text") {
    const handled = await handleWhatsAppInput(text, source);
    if (handled) return;
    return originalProcessInput(text, source);
  };

  window.jarvisWhatsApp = {
    hasPendingMessage: () => Boolean(pendingWhatsAppMessage),
    cancel: () => {
      pendingWhatsAppMessage = null;
    }
  };
})();
