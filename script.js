const micButton = document.getElementById("micButton");
const status = document.getElementById("status");
const transcript = document.getElementById("transcript");
const camera = document.getElementById("camera");
const photoCanvas = document.getElementById("photoCanvas");
const cameraButton = document.getElementById("cameraButton");
const cameraOffButton = document.getElementById("cameraOffButton");
const cameraStatus = document.getElementById("cameraStatus");
const textCommandForm = document.getElementById("textCommandForm");
const textCommand = document.getElementById("textCommand");
const memoryStatus = document.getElementById("memoryStatus");
const clearMemoryButton = document.getElementById("clearMemoryButton");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const MEMORY_KEY = "jarvis_conversation_memory_v2";
const FACTS_KEY = "jarvis_semantic_memory_v1";
const MAX_MEMORY_ITEMS = 40;
const MAX_FACTS = 40;

let cameraStream = null;
let currentAudio = null;
let jarvisActive = false;
let conversationMemory = loadMemory();
let semanticMemory = loadFacts();
let conversationContext = {
  lastIntent: null,
  lastApp: null,
  lastUserText: null,
  lastPlan: null
};

let pendingSystemAction = null;

function browserSpeak(text) {
  if (!("speechSynthesis" in window)) throw new Error("El navegador no tiene síntesis de voz.");
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-CO";
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

async function speak(text) {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!response.ok) throw new Error(`TTS ${response.status}: ${await response.text()}`);

    const audioUrl = URL.createObjectURL(await response.blob());
    currentAudio = new Audio(audioUrl);
    currentAudio.onended = () => URL.revokeObjectURL(audioUrl);
    await currentAudio.play();
  } catch (error) {
    console.error("ElevenLabs no pudo reproducir el audio:", error);
    status.textContent = "Usando voz del navegador...";
    try {
      browserSpeak(text);
      status.textContent = "Jarvis activo.";
    } catch (fallbackError) {
      console.error(fallbackError);
      status.textContent = "No se pudo reproducir la voz de Jarvis.";
    }
  }
}

function loadMemory() {
  try {
    const saved = localStorage.getItem(MEMORY_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

function loadFacts() {
  try {
    const saved = localStorage.getItem(FACTS_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

function saveMemory() {
  conversationMemory = conversationMemory.slice(-MAX_MEMORY_ITEMS);
  localStorage.setItem(MEMORY_KEY, JSON.stringify(conversationMemory));
  renderMemoryStatus();
}

function saveFacts() {
  semanticMemory = semanticMemory.slice(-MAX_FACTS);
  localStorage.setItem(FACTS_KEY, JSON.stringify(semanticMemory));
  renderMemoryStatus();
}

function addMemory(role, text) {
  conversationMemory.push({
    role,
    text,
    time: new Date().toISOString()
  });
  saveMemory();
}

function rememberFact(key, value) {
  const cleanValue = value.trim();
  if (!cleanValue) return;

  semanticMemory = semanticMemory.filter((item) => item.key !== key);
  semanticMemory.push({
    key,
    value: cleanValue,
    time: new Date().toISOString()
  });
  saveFacts();
}

function getFact(key) {
  const item = semanticMemory.find((entry) => entry.key === key);
  return item ? item.value : null;
}

function extractSemanticMemory(text) {
  const normalized = normalizeText(text);

  let match = normalized.match(/^me llamo (.+)$/);
  if (match) rememberFact("nombre", match[1]);

  match = normalized.match(/^mi nombre es (.+)$/);
  if (match) rememberFact("nombre", match[1]);

  match = normalized.match(/^recuerda que (.+)$/);
  if (match) rememberFact("nota", match[1]);

  match = normalized.match(/^recuerda (.+)$/);
  if (match) rememberFact("nota", match[1]);
}

function renderMemoryStatus() {
  if (!memoryStatus) return;

  const messages = conversationMemory.length;
  const facts = semanticMemory.length;

  memoryStatus.textContent = !messages && !facts
    ? "Sin memoria guardada."
    : `${messages} mensajes y ${facts} recuerdos guardados localmente.`;
}

async function clearMemory() {
  conversationMemory = [];
  semanticMemory = [];
  conversationContext = {
    lastIntent: null,
    lastApp: null,
    lastUserText: null,
    lastPlan: null
  };

  localStorage.removeItem(MEMORY_KEY);
  localStorage.removeItem(FACTS_KEY);
  renderMemoryStatus();
  status.textContent = "Memoria local borrada.";
  await speak("Memoria local borrada, señor.");
}

function getRecentContext() {
  return conversationMemory.slice(-8);
}

function getMemorySummary() {
  const recent = getRecentContext();
  const parts = [];

  if (semanticMemory.length) {
    parts.push(
      semanticMemory
        .map((item) => `${item.key}: ${item.value}`)
        .join("; ")
    );
  }

  if (recent.length) {
    parts.push(
      "Conversación reciente: " +
      recent.map((item) => `${item.role}: ${item.text}`).join(" | ")
    );
  }

  return parts.length ? parts.join(". ") : "No hay memoria previa.";
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeWakeWord(text) {
  return normalizeText(text)
    .replace(/\bjarvis\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function openLocalApp(app, label) {
  status.textContent = `Abriendo ${label}...`;

  try {
    const response = await fetch(
      `http://127.0.0.1:3000/open?app=${encodeURIComponent(app)}`,
      { method: "GET", cache: "no-store" }
    );

    if (!response.ok) throw new Error("Bridge " + response.status);

    conversationContext.lastApp = {
      app,
      label,
      openedAt: Date.now()
    };

    status.textContent = `${label} abierto.`;
    return true;
  } catch (error) {
    console.error(`Error abriendo ${label}:`, error);
    status.textContent = `No se pudo abrir ${label}.`;
    return false;
  }
}

async function closeLocalApp(app, label) {
  status.textContent = `Cerrando ${label}...`;

  try {
    const response = await fetch(
      `http://127.0.0.1:3000/close?app=${encodeURIComponent(app)}`,
      { method: "GET", cache: "no-store" }
    );

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(responseText || "Bridge " + response.status);
    }

    if (conversationContext.lastApp && conversationContext.lastApp.app === app) {
      conversationContext.lastApp = null;
    }

    status.textContent = `${label} cerrado.`;
    return true;
  } catch (error) {
    console.error(`Error cerrando ${label}:`, error);
    status.textContent = `No se pudo cerrar ${label}.`;
    return false;
  }
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus.textContent = "Este navegador no permite acceder a la cámara.";
    return false;
  }

  try {
    if (!cameraStream) {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      camera.srcObject = cameraStream;
    }

    await camera.play();
    cameraStatus.textContent = "Cámara activa.";
    cameraButton.textContent = "Cámara activa";
    cameraButton.disabled = true;
    cameraOffButton.disabled = false;
    return true;
  } catch (error) {
    cameraStatus.textContent = "Permiso de cámara necesario.";
    status.textContent = "No se pudo activar la cámara.";
    console.error(error);
    return false;
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  camera.srcObject = null;
  cameraStatus.textContent = "Cámara inactiva.";
  cameraButton.textContent = "Activar cámara";
  cameraButton.disabled = false;
  cameraOffButton.disabled = true;
  status.textContent = "Cámara desactivada.";
}

function takePhoto() {
  if (!cameraStream || !camera.videoWidth || !camera.videoHeight) return false;

  photoCanvas.width = camera.videoWidth;
  photoCanvas.height = camera.videoHeight;
  photoCanvas
    .getContext("2d")
    .drawImage(camera, 0, 0, photoCanvas.width, photoCanvas.height);

  const link = document.createElement("a");
  link.href = photoCanvas.toDataURL("image/png");
  link.download = `jarvis-foto-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  link.click();

  status.textContent = "Foto tomada.";
  cameraStatus.textContent = "Foto capturada y guardada.";
  return true;
}

const appAliases = [
  { pattern: /\b(roblox)\b/, app: "roblox", label: "Roblox" },
  { pattern: /\b(google\s+chrome|chrome)\b/, app: "chrome", label: "Chrome" },
  { pattern: /\b(visual\s+studio\s+code|vs\s*code|visual\s+code|vscode)\b/, app: "vscode", label: "Visual Studio Code" },
  { pattern: /\b(bloc\s+de\s+notas|notepad)\b/, app: "notepad", label: "Bloc de notas" },
  { pattern: /\b(calculadora|calculator)\b/, app: "calculator", label: "Calculadora" },
  { pattern: /\b(descargas|carpeta\s+de\s+descargas)\b/, app: "downloads", label: "Descargas" },
  { pattern: /\b(documentos|carpeta\s+de\s+documentos)\b/, app: "documents", label: "Documentos" },
  { pattern: /\b(escritorio|desktop)\b/, app: "desktop", label: "Escritorio" },
  { pattern: /\b(explorador(?:\s+de\s+archivos)?|archivos)\b/, app: "explorer", label: "Explorador de archivos" },
  { pattern: /\b(configuracion|ajustes)\b/, app: "settings", label: "Configuración" }
];

function findReferencedApp(command) {
  const direct = appAliases.find((item) => item.pattern.test(command));
  if (direct) return direct;

  const last = conversationContext.lastApp;
  if (!last) return null;

  if (/\b(eso|esa|ese|lo|la|le|alli|ahi|allí|ahí|la aplicacion|la app|el programa)\b/.test(command)) {
    return last;
  }

  return null;
}

async function executeSystemAction(action) {
  status.textContent = "Ejecutando acción del sistema...";

  try {
    const response = await fetch(
      `http://127.0.0.1:3000/system?action=${encodeURIComponent(action)}`,
      { method: "GET", cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return true;
  } catch (error) {
    console.error("Error de acción del sistema:", error);
    return false;
  }
}

function detectIntent(text) {
  const normalized = normalizeText(text);
  const command = removeWakeWord(text);
  const saysJarvis = /\bjarvis\b/.test(normalized);

  if (!saysJarvis && !jarvisActive) {
    return { type: "ignore", command, normalized };
  }

  if (/\b(confirmo|confirmar|si|sí)\b/.test(command) && pendingSystemAction) {
    return { type: "system_confirm", action: pendingSystemAction, command, normalized };
  }

  if (/^(hola|buenos dias|buenas tardes|buenas noches|hey)$/.test(command)) {
    return { type: "greeting", command, normalized };
  }

  if (/\b(toma|tomar|saca|sacar)\s+(una\s+)?foto\b/.test(command)) {
    return { type: "photo", command, normalized };
  }

  if (/\b(desactiva|desactivar|apaga|apagar|cierra|cerrar)\s+(la\s+)?camara\b/.test(command)) {
    return { type: "camera_off", command, normalized };
  }

  if (/\b(activa|activar|enciende|encender|abre|abrir)\s+(la\s+)?camara\b/.test(command)) {
    return { type: "camera_on", command, normalized };
  }

  if (/^(como me llamo|cual es mi nombre)$/.test(command)) {
    return { type: "remembered_name", command, normalized };
  }

  if (/^(que recuerdas de mi|que sabes de mi)$/.test(command)) {
    return { type: "remembered_facts", command, normalized };
  }

  if (/\b(que|qué)\s+(recuerdas|recuerde)\b/.test(command) || /\bmemoria\b/.test(command)) {
    return { type: "memory", command, normalized };
  }

  if (
    /^recuerda que /.test(command) ||
    /^recuerda /.test(command) ||
    /^me llamo /.test(command) ||
    /^mi nombre es /.test(command)
  ) {
    return { type: "remember", command, normalized };
  }

  if (/\b(bloquea|bloquear|bloqueame|bloquearme)\b/.test(command)) {
    return { type: "system_action", action: "lock", command, normalized };
  }

  if (/\b(reinicia|reiniciar|reinicia el pc|reiniciar el pc|reinicia la computadora|reiniciar la computadora)\b/.test(command)) {
    return { type: "system_action", action: "restart", command, normalized };
  }

  if (/\b(apaga|apagar|apaga el pc|apagar el pc|apaga la computadora|apagar la computadora)\b/.test(command)) {
    return { type: "system_action", action: "shutdown", command, normalized };
  }

  const wantsOpen = /\b(abre|abrir|inicia|iniciar|lanza|lanzar|ejecuta|ejecutar|muestra|mostrar|abrele|abrile)\b/.test(command);

  if (wantsOpen) {
    const app = findReferencedApp(command);

    if (app) {
      return {
        type: "open_app",
        app: app.app,
        label: app.label,
        command,
        normalized,
        referenced: !appAliases.includes(app)
      };
    }
  }

  if (
    /\b(cierra|cerrar|sal|salir|termina|terminar|apaga|apagar)\b/.test(command)
  ) {
    const app = findReferencedApp(command);

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

  if (/^(repite|repetir|otra vez|hazlo otra vez|haz eso otra vez|de nuevo)$/.test(command)) {
    if (conversationContext.lastPlan && conversationContext.lastPlan.replayable) {
      return {
        type: "repeat",
        command,
        normalized,
        planToRepeat: conversationContext.lastPlan
      };
    }
  }

  if (saysJarvis && !command) {
    return { type: "wake", command, normalized };
  }

  return { type: "unknown", command, normalized };
}

function createPlan(intent) {
  switch (intent.type) {
    case "ignore":
      return { type: "ignore", actions: [] };

    case "wake":
      return {
        type: "wake",
        actions: [],
        response: "Sí, señor."
      };

    case "greeting":
      return {
        type: "greeting",
        actions: [],
        response: "Buenos días, señor. ¿En qué puedo ayudarle?"
      };

    case "open_app":
      return {
        type: "open_app",
        actions: [
          {
            type: "open_app",
            app: intent.app,
            label: intent.label
          }
        ],
        replayable: true
      };

    case "system_action": {
      if (intent.action === "lock") {
        return {
          type: "system_action",
          actions: [{ type: "system_action", action: "lock" }],
          response: "Voy a bloquear Windows, señor."
        };
      }

      pendingSystemAction = intent.action;
      const label = intent.action === "restart" ? "reiniciar Windows" : "apagar Windows";

      return {
        type: "system_confirmation",
        actions: [],
        response: `Para ${label}, necesito su confirmación. Diga: "Jarvis, confirmo".`
      };
    }

    case "system_confirm": {
      const action = intent.action;
      pendingSystemAction = null;
      return {
        type: "system_action",
        actions: [{ type: "system_action", action }],
        response: action === "restart"
          ? "Reiniciando Windows, señor."
          : "Apagando Windows, señor."
      };
    }

    case "close_app":
      return {
        type: "close_app",
        actions: [
          {
            type: "close_app",
            app: intent.app,
            label: intent.label
          }
        ]
      };

    case "camera_on":
      return {
        type: "camera_on",
        actions: [{ type: "camera_on" }]
      };

    case "camera_off":
      return {
        type: "camera_off",
        actions: [{ type: "camera_off" }],
        response: "Cámara desactivada, señor."
      };

    case "photo":
      return {
        type: "photo",
        actions: [{ type: "camera_on" }, { type: "photo" }],
        replayable: true
      };

    case "memory":
      return {
        type: "memory",
        actions: [],
        response: getMemorySummary()
      };

    case "remember":
      return {
        type: "remember",
        actions: [],
        response: "Lo recordaré, señor."
      };

    case "remembered_name": {
      const name = getFact("nombre");
      return {
        type: "remembered_name",
        actions: [],
        response: name
          ? `Su nombre es ${name}, señor.`
          : "Todavía no me ha dicho su nombre, señor."
      };
    }

    case "remembered_facts": {
      const summary = getMemorySummary();
      return {
        type: "remembered_facts",
        actions: [],
        response:
          summary === "No hay memoria previa."
            ? "Todavía no tengo datos guardados sobre usted, señor."
            : `Esto es lo que recuerdo: ${summary}`
      };
    }

    case "repeat":
      return {
        ...(intent.planToRepeat || { type: "unknown", actions: [] }),
        repeated: true
      };

    default:
      return {
        type: "unknown",
        actions: [],
        response: "No reconocí esa orden, señor."
      };
  }
}

async function executePlan(plan) {
  if (plan.type === "ignore") return;

  if (plan.type === "wake" || plan.type === "greeting") {
    jarvisActive = true;
  }

  for (const action of plan.actions) {
    if (action.type === "open_app") {
      const opened = await openLocalApp(action.app, action.label);

      plan.response = opened
        ? `Señor, ya está abierto ${action.label}.`
        : `No puedo abrir ${action.label}. Verifique que el puente de Jarvis esté activo, señor.`;
    }

    if (action.type === "system_action") {
      const executed = await executeSystemAction(action.action);

      if (!executed) {
        plan.response = "No pude ejecutar esa acción de Windows, señor. Verifique que el puente esté activo.";
      }
    }

    if (action.type === "close_app") {
      const closed = await closeLocalApp(action.app, action.label);

      plan.response = closed
        ? `Señor, ${action.label} ha sido cerrado.`
        : `No pude cerrar ${action.label}, señor. Verifique que la aplicación esté abierta y que el puente de Jarvis esté activo.`;
    }

    if (action.type === "camera_on") {
      status.textContent = "Activando cámara...";
      const ready = await startCamera();

      if (!ready) {
        plan.response = "No pude activar la cámara, señor.";
      } else if (plan.type === "camera_on") {
        plan.response = "Cámara activada, señor.";
      }
    }

    if (action.type === "camera_off") {
      stopCamera();
    }

    if (action.type === "photo") {
      const photoReady = takePhoto();

      plan.response = photoReady
        ? "Foto tomada, señor."
        : "Necesito acceso a la cámara, señor.";
    }
  }

  status.textContent = plan.type === "unknown"
    ? "Orden no reconocida."
    : "Jarvis activo.";
}

async function respond(plan) {
  if (!plan.response) return;
  await speak(plan.response);
}

async function processInput(text, source = "text") {
  const cleanText = text.trim();
  if (!cleanText) return;

  transcript.textContent =
    `${source === "voice" ? "Tú" : "Tú (texto)"}: ${cleanText}`;

  conversationContext.lastUserText = cleanText;
  extractSemanticMemory(cleanText);
  addMemory("user", cleanText);

  const intent = detectIntent(cleanText);
  const plan = createPlan(intent);

  conversationContext.lastIntent = intent.type;
  conversationContext.lastPlan = plan;

  await executePlan(plan);
  await respond(plan);

  if (intent.type !== "ignore") {
    addMemory("jarvis", `intención: ${intent.type}`);
  }
}

cameraButton.addEventListener("click", startCamera);
cameraOffButton.addEventListener("click", stopCamera);
clearMemoryButton.addEventListener("click", clearMemory);

textCommandForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const value = textCommand.value.trim();
  if (!value) return;

  textCommand.value = "";
  await processInput(value, "text");
});

if (!SpeechRecognition) {
  status.textContent =
    "Este navegador no admite reconocimiento de voz. Puedes usar texto.";
  micButton.disabled = true;
} else {
  const recognition = new SpeechRecognition();
  recognition.lang = "es-CO";
  recognition.continuous = false;
  recognition.interimResults = false;

  micButton.addEventListener("click", () => {
    transcript.textContent = "";
    status.textContent = "Escuchando...";

    try {
      recognition.start();
    } catch (error) {
      console.error(error);
    }
  });

  recognition.onresult = async (event) => {
    await processInput(
      event.results[0][0].transcript.trim(),
      "voice"
    );
  };

  recognition.onerror = (event) => {
    status.textContent = `Error de micrófono: ${event.error}`;
  };

  recognition.onend = () => {
    if (status.textContent === "Escuchando...") {
      status.textContent = "Sistema listo.";
    }
  };
}

renderMemoryStatus();

window.addEventListener("beforeunload", () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
  }
});
