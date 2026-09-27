const micButton = document.getElementById("micButton");
const status = document.getElementById("status");
const transcript = document.getElementById("transcript");
const camera = document.getElementById("camera");
const photoCanvas = document.getElementById("photoCanvas");
const cameraButton = document.getElementById("cameraButton");
const cameraOffButton = document.getElementById("cameraOffButton");
const cameraStatus = document.getElementById("cameraStatus");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let cameraStream = null;
let currentAudio = null;

function browserSpeak(text) {
  if (!("speechSynthesis" in window)) {
    throw new Error("El navegador no tiene síntesis de voz.");
  }

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Respuesta completa de ElevenLabs:", errorText);
      throw new Error(`TTS ${response.status}: ${errorText}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    currentAudio = new Audio(audioUrl);

    currentAudio.onended = () => {
      URL.revokeObjectURL(audioUrl);
    };

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

async function openLocalApp(app, label) {
  status.textContent = `Abriendo ${label}...`;

  try {
    const response = await fetch(
      `http://127.0.0.1:3000/open?app=${encodeURIComponent(app)}`,
      {
        method: "GET",
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error("Bridge " + response.status);
    }

    status.textContent = `${label} abierto.`;
    speak(`Abriendo ${label}, señor.`);
  } catch (error) {
    console.error(`Error abriendo ${label}:`, error);
    status.textContent = `No se pudo abrir ${label}.`;
    speak(`No puedo abrir ${label}. Verifique que el puente de Jarvis esté activo, señor.`);
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

cameraButton.addEventListener("click", startCamera);
cameraOffButton.addEventListener("click", stopCamera);

if (!SpeechRecognition) {
  status.textContent = "Este navegador no admite reconocimiento de voz.";
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
    const text = event.results[0][0].transcript.trim();
    transcript.textContent = `Tú: ${text}`;
    const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const saysJarvis = /\bjarvis\b/.test(normalized);
    const asksForPhoto = /\b(toma|tomar|saca|sacar)\s+(una\s+)?foto\b/.test(normalized);
    const asksToDisableCamera = /\b(desactiva|desactivar|apaga|apagar|cierra|cerrar)\s+(la\s+)?camara\b/.test(normalized);
    const asksToEnableCamera = /\b(activa|activar|enciende|encender|abre|abrir)\s+(la\s+)?camara\b/.test(normalized);

    const asksToOpenRoblox = /\b(abre|abrir|inicia|iniciar|lanza|lanzar)\s+roblox\b/.test(normalized);
    const asksToOpenChrome = /\b(abre|abrir|inicia|iniciar|lanza|lanzar)\s+(google\s+chrome|chrome)\b/.test(normalized);
    const asksToOpenVSCode = /\b(abre|abrir|inicia|iniciar|lanza|lanzar)\s+(visual\s+studio\s+code|vs\s*code|visual\s+code)\b/.test(normalized);
    const asksToOpenNotepad = /\b(abre|abrir|inicia|iniciar|lanza|lanzar)\s+(bloc\s+de\s+notas|notas|notepad)\b/.test(normalized);
    const asksToOpenCalculator = /\b(abre|abrir|inicia|iniciar|lanza|lanzar)\s+(calculadora|calculator)\b/.test(normalized);

    const asksToOpenDownloads = /\b(abre|abrir|inicia|iniciar|muestra|mostrar)\s+(la\s+)?(carpeta\s+de\s+)?descargas\b/.test(normalized);
    const asksToOpenDocuments = /\b(abre|abrir|inicia|iniciar|muestra|mostrar)\s+(la\s+)?(carpeta\s+de\s+)?documentos\b/.test(normalized);
    const asksToOpenDesktop = /\b(abre|abrir|inicia|iniciar|muestra|mostrar)\s+(el\s+)?(escritorio|desktop)\b/.test(normalized);
    const asksToOpenExplorer = /\b(abre|abrir|inicia|iniciar|lanza|lanzar)\s+(el\s+)?(explorador|explorador\s+de\s+archivos|archivos)\b/.test(normalized);
    const asksToOpenSettings = /\b(abre|abrir|inicia|iniciar|muestra|mostrar)\s+(la\s+)?(configuracion|ajustes)\b/.test(normalized);

    // Cerebro local de Jarvis: interpreta intenciones y alias comunes.\n    const command = normalized.replace(/\\bjarvis\\b/g, "").trim();\n\n    const appAliases = [\n      { pattern: /\\b(roblox)\\b/, app: "roblox", label: "Roblox" },\n      { pattern: /\\b(google\\s+chrome|chrome)\\b/, app: "chrome", label: "Chrome" },\n      { pattern: /\\b(visual\\s+studio\\s+code|vs\\s*code|visual\\s+code|vscode)\\b/, app: "vscode", label: "Visual Studio Code" },\n      { pattern: /\\b(bloc\\s+de\\s+notas|notepad)\\b/, app: "notepad", label: "Bloc de notas" },\n      { pattern: /\\b(calculadora|calculator)\\b/, app: "calculator", label: "Calculadora" },\n      { pattern: /\\b(descargas|carpeta\\s+de\\s+descargas)\\b/, app: "downloads", label: "Descargas" },\n      { pattern: /\\b(documentos|carpeta\\s+de\\s+documentos)\\b/, app: "documents", label: "Documentos" },\n      { pattern: /\\b(escritorio|desktop)\\b/, app: "desktop", label: "Escritorio" },\n      { pattern: /\\b(explorador(?:\\s+de\\s+archivos)?|archivos)\\b/, app: "explorer", label: "Explorador de archivos" },\n      { pattern: /\\b(configuracion|ajustes)\\b/, app: "settings", label: "Configuración" }\n    ];\n\n    const wantsOpen = /\\b(abre|abrir|inicia|iniciar|lanza|lanzar|ejecuta|ejecutar|muestra|mostrar)\\b/.test(command);\n    const app = wantsOpen ? appAliases.find((item) => item.pattern.test(command)) : null;\n\n    if (app) {\n      await openLocalApp(app.app, app.label);\n    } else if (asksToDisableCamera) {\n      stopCamera();\n    } else if (asksToEnableCamera) {\n      status.textContent = "Activando cámara...";\n      const cameraReady = await startCamera();\n      if (cameraReady) speak("Cámara activada, señor.");\n    } else if (asksForPhoto) {\n      status.textContent = "Preparando cámara...";\n      const cameraReady = await startCamera();\n      if (cameraReady) takePhoto();\n    } else if (saysJarvis) {\n      status.textContent = "Jarvis activo.";\n      speak("Sí, señor.");\n    } else {\n      status.textContent = "No reconocí esa orden.";\n      speak("No reconocí esa orden, señor.");\n    }
  };

  recognition.onerror = (event) => {
    status.textContent = `Error de micrófono: ${event.error}`;
  };

  recognition.onend = () => {
    if (status.textContent === "Escuchando...") status.textContent = "Sistema listo.";
  };
}

window.addEventListener("beforeunload", () => {
  if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
});
