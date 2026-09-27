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
const MAX_MEMORY_ITEMS = 30;
const MAX_FACTS = 30;
let cameraStream = null;
let currentAudio = null;
let jarvisActive = false;
let conversationMemory = loadMemory();
let semanticMemory = loadFacts();
let conversationContext = {
  lastIntent: null,
  lastApp: null,
  lastUserText: null
};

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
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Respuesta completa de ElevenLabs:", errorText);
      throw new Error(`TTS ${response.status}: ${errorText}`);
    }
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
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
      console.error("Error con voz del navegador:", fallbackError);
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
    console.error("No se pudo cargar la memoria de Jarvis:", error);
    return [];
  }
}

function loadFacts() {
  try {
    const saved = localStorage.getItem(FACTS_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("No se pudo cargar la memoria semántica:", error);
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
  conversationMemory.push({ role, text, time: new Date().toISOString() });
  saveMemory();
}

function rememberFact(key, value) {
  const cleanValue = value.trim();
  if (!cleanValue) return;
  semanticMemory = semanticMemory.filter((item) => item.key !== key);
  semanticMemory.push({ key, value: cleanValue, time: new Date().toISOString() });
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
  if (!messages && !facts) {
    memoryStatus.textContent = "Sin memoria guardada.";
    return;
  }
  memoryStatus.textContent = `${messages} mensajes y ${facts} recuerdos guardados localmente.`;
}

function clearMemory() {
  conversationMemory = [];
  semanticMemory = [];
  localStorage.removeItem(MEMORY_KEY);
  localStorage.removeItem(FACTS_KEY);
  renderMemoryStatus();
  status.textContent = "Memoria local borrada.";
  speak("Memoria local borrada, señor.");
}

function getRecentContext() {
  return conversationMemory.slice(-6);
}

function getMemorySummary() {
  const recent = getRecentContext();
  const facts = semanticMemory;
  const parts = [];

  if (facts.length) {
    parts.push(facts.map((item) => `${item.key}: ${item.value}`).join("; "));
  }
  if (recent.length) {
    parts.push(`${recent.length} mensajes recientes`);
  }
  return parts.length ? parts.join(". ") : "No hay memoria previa.";
}

async function openLocalApp(app, label) {
  status.textContent = `Abriendo ${label}...`;
  try {
    const response = await fetch(`http://127.0.0.1:3000/open?app=${encodeURIComponent(app)}`, {
      method: "GET",
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Bridge " + response.status);

    conversationContext.lastApp = label;
    status.textContent = `${label} abierto.`;
    await speak(`Señor, ya está abierto ${label}.`);
  } catch (error) {
    console.error(`Error abriendo ${label}:`, error);
    status.textContent = `No se pudo abrir ${label}.`;
    await speak(`No puedo abrir ${label}. Verifique que el puente de Jarvis esté activo, señor.`);
  }
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus.textContent = "Este navegador no permite acceder a la cámara.";
    return false;
  }
  try {
    if (!cameraStream) {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
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
  speak("Cámara desactivada, señor.");
}

function takePhoto() {
  if (!cameraStream || !camera.videoWidth || !camera.videoHeight) {
    status.textContent = "Activa la cámara primero.";
    speak("Necesito acceso a la cámara, señor.");
    return;
  }
  photoCanvas.width = camera.videoWidth;
  photoCanvas.height = camera.videoHeight;
  const context = photoCanvas.getContext("2d");
  context.drawImage(camera, 0, 0, photoCanvas.width, photoCanvas.height);
  const photoUrl = photoCanvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = photoUrl;
  link.download = `jarvis-foto-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  link.click();
  status.textContent = "Foto tomada.";
  cameraStatus.textContent = "Foto capturada y guardada.";
  speak("Foto tomada, señor.");
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

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectIntent(text) {
  const normalized = normalizeText(text);
  const saysJarvis = /\bjarvis\b/.test(normalized);
  const command = normalized.replace(/\bjarvis\b/g, "").trim();

  if (!saysJarvis && !jarvisActive) return { type: "ignore", command, normalized };

  if (/^(hola|buenos dias|buenas tardes|buenas noches|hey)$/.test(command)) return { type: "greeting", command, normalized };
  if (/\b(toma|tomar|saca|sacar)\s+(una\s+)?foto\b/.test(command)) return { type: "photo", command, normalized };
  if (/\b(desactiva|desactivar|apaga|apagar|cierra|cerrar)\s+(la\s+)?camara\b/.test(command)) return { type: "camera_off", command, normalized };
  if (/\b(activa|activar|enciende|encender|abre|abrir)\s+(la\s+)?camara\b/.test(command)) return { type: "camera_on", command, normalized };

  if (/\b(que|qué)\s+(recuerdas|recuerde)\b/.test(command) || /\bmemoria\b/.test(command)) {
    return { type: "memory", command, normalized };
  }

  const wantsOpen = /\b(abre|abrir|inicia|iniciar|lanza|lanzar|ejecuta|ejecutar|muestra|mostrar)\b/.test(command);
  if (wantsOpen) {
    const app = appAliases.find((item) => item.pattern.test(command));
    if (app) return { type: "open_app", app: app.app, label: app.label, command, normalized };
  }

  if (/^(como me llamo|cual es mi nombre)$/.test(command)) return { type: "remembered_name", command, normalized };
  if (/^(que recuerdas de mi|que sabes de mi)$/.test(command)) return { type: "remembered_facts", command, normalized };

  if (/^recuerda que /.test(command) || /^recuerda /.test(command) || /^me llamo /.test(command) || /^mi nombre es /.test(command)) {
    return { type: "remember", command, normalized };
  }

  if (saysJarvis && !command) return { type: "wake", command, normalized };
  return { type: "unknown", command, normalized };
}

async function executeIntent(intent) {
  conversationContext.lastIntent = intent.type;

  switch (intent.type) {
    case "ignore": return;
    case "wake":
      jarvisActive = true;
      status.textContent = "Jarvis activo.";
      await speak("Sí, señor.");
      return;
    case "greeting":
      jarvisActive = true;
      status.textContent = "Jarvis activo.";
      await speak("Buenos días, señor. ¿En qué puedo ayudarle?");
      return;
    case "open_app":
      await openLocalApp(intent.app, intent.label);
      return;
    case "camera_on": {
      status.textContent = "Activando cámara...";
      const cameraReady = await startCamera();
      if (cameraReady) await speak("Cámara activada, señor.");
      else await speak("No pude activar la cámara, señor.");
      return;
    }
    case "camera_off":
      stopCamera();
      return;
    case "photo": {
      status.textContent = "Preparando cámara...";
      const cameraReady = await startCamera();
      if (cameraReady) takePhoto();
      return;
    }
    case "memory":
      await speak(getMemorySummary());
      return;
    case "remember":
      await speak("Lo recordaré, señor.");
      return;
    case "remembered_name": {
      const name = getFact("nombre");
      await speak(name ? `Su nombre es ${name}, señor.` : "Todavía no me ha dicho su nombre, señor.");
      return;
    }
    case "remembered_facts": {
      const summary = getMemorySummary();
      await speak(summary === "No hay memoria previa." ? "Todavía no tengo datos guardados sobre usted, señor." : `Esto es lo que recuerdo: ${summary}`);
      return;
    }
    case "unknown":
      status.textContent = "Orden no reconocida.";
      await speak("No reconocí esa orden, señor.");
      return;
  }
}

async function processInput(text, source = "text") {
  const cleanText = text.trim();
  if (!cleanText) return;

  transcript.textContent = `${source === "voice" ? "Tú" : "Tú (texto)"}: ${cleanText}`;
  conversationContext.lastUserText = cleanText;
  extractSemanticMemory(cleanText);
  addMemory("user", cleanText);

  const intent = detectIntent(cleanText);
  await executeIntent(intent);

  if (intent.type !== "ignore") addMemory("jarvis", `intención: ${intent.type}`);
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
  status.textContent = "Este navegador no admite reconocimiento de voz. Puedes usar texto.";
  micButton.disabled = true;
} else {
  const recognition = new SpeechRecognition();
  recognition.lang = "es-CO";
  recognition.continuous = false;
  recognition.interimResults = false;

  micButton.addEventListener("click", () => {
    transcript.textContent = "";
    status.textContent = "Escuchando...";
    recognition.start();
  });

  recognition.onresult = async (event) => {
    await processInput(event.results[0][0].transcript.trim(), "voice");
  };
  recognition.onerror = (event) => { status.textContent = `Error de micrófono: ${event.error}`; };
  recognition.onend = () => { if (status.textContent === "Escuchando...") status.textContent = "Sistema listo."; };
}

renderMemoryStatus();
window.addEventListener("beforeunload", () => {
  if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
});
