(() => {
  const NativeSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!NativeSpeechRecognition) return;

  let pendingWhatsAppMessage = null;

  function normalize(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
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
      if (match) {
        return {
          contact: match[1].trim(),
          message: match[2].trim()
        };
      }
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
    if (typeof window.speak === "function") {
      return window.speak(text);
    }

    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-CO";
      window.speechSynthesis.cancel();
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

      window.dispatchEvent(
        new CustomEvent("jarvis:whatsapp-confirmed", { detail: confirmed })
      );

      const status = document.getElementById("status");
      if (status) status.textContent = "Mensaje de WhatsApp confirmado.";
      return true;
    }

    if (/\b(whatsapp|mensaje|envia|envía|manda|escribe|dile)\b/.test(normalized)) {
      const message = extractMessage(clean);

      if (message) {
        pendingWhatsAppMessage = message;
        speak(`Voy a preparar un mensaje para ${message.contact}: ${message.message}. ¿Confirma?`);

        const status = document.getElementById("status");
        if (status) status.textContent = "Esperando confirmación de WhatsApp...";
        return true;
      }
    }

    return false;
  }

  function createPatchedConstructor(Native) {
    function PatchedSpeechRecognition(...args) {
      const recognition = new Native(...args);

      recognition.addEventListener("result", (event) => {
        const text = event?.results?.[0]?.[0]?.transcript?.trim() || "";
        if (!text) return;

        if (handle(text)) {
          event.stopImmediatePropagation();
        }
      });

      return recognition;
    }

    PatchedSpeechRecognition.prototype = Native.prototype;
    Object.setPrototypeOf(PatchedSpeechRecognition, Native);
    return PatchedSpeechRecognition;
  }

  const patched = createPatchedConstructor(NativeSpeechRecognition);

  if (window.SpeechRecognition === NativeSpeechRecognition) {
    window.SpeechRecognition = patched;
  }

  if (window.webkitSpeechRecognition === NativeSpeechRecognition) {
    window.webkitSpeechRecognition = patched;
  }

  // ============================================================
  // CONEXIÓN CON JARVIS BRIDGE
  // ============================================================

  window.addEventListener("jarvis:whatsapp-confirmed", async (event) => {
    const data = event.detail || {};
    const contact = data.contact;
    const message = data.message;

    if (!contact || !message) {
      speak("Faltan datos para preparar WhatsApp.");
      return;
    }

    try {
      const bridgeUrl =
        "http://127.0.0.1:3000/whatsapp" +
        `?contact=${encodeURIComponent(contact)}` +
        `&message=${encodeURIComponent(message)}`;

      const response = await fetch(bridgeUrl, {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const whatsappUrl = await response.text();

      if (!whatsappUrl.startsWith("https://web.whatsapp.com/")) {
        throw new Error("El Bridge no devolvió un enlace válido de WhatsApp.");
      }

      window.open(whatsappUrl, "_blank");

      const status = document.getElementById("status");
      if (status) {
        status.textContent = `WhatsApp preparado para ${contact}.`;
      }

      speak(
        `WhatsApp está preparado para ${contact}. Revise el mensaje y pulse enviar cuando esté listo.`
      );
    } catch (error) {
      console.error("Error de WhatsApp Bridge:", error);

      const status = document.getElementById("status");
      if (status) {
        status.textContent = "No se pudo conectar con WhatsApp Bridge.";
      }

      speak(
        "No pude preparar WhatsApp. Verifique que Bridge esté ejecutándose."
      );
    }
  });

  window.jarvisWhatsApp = {
    hasPendingMessage: () => Boolean(pendingWhatsAppMessage),
    cancel: () => {
      pendingWhatsAppMessage = null;
    }
  };
})();