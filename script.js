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
let selectedVoice = null;

function loadJarvisVoice() {
  if (!("speechSynthesis" in window)) return;

  const voices = window.speechSynthesis.getVoices();
  const spanishVoices = voices.filter((voice) => /^es(-|_)/i.test(voice.lang));

  // Prefer a Spanish voice with a masculine-sounding system name when available.
  selectedVoice = spanishVoices.find((voice) => /male|hombre|jorge|diego|carlos|raul|pablo|miguel|andres/i.test(voice.name))
    || spanishVoices.find((voice) => /es-CO/i.test(voice.lang))
    || spanishVoices[0]
    || voices.find((voice) => /es(-|_)/i.test(voice.lang))
    || voices[0]
    || null;
}

if ("speechSynthesis" in window) {
  loadJarvisVoice();
  window.speechSynthesis.addEventListener("voiceschanged", loadJarvisVoice);
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = selectedVoice?.lang || "es-CO";
  utterance.voice = selectedVoice;

  // JARVIS-style delivery: calm, deliberate and slightly deep.
  utterance.rate = 0.84;
  utterance.pitch = 0.62;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
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

    if (asksToDisableCamera) {
      stopCamera();
    } else if (asksToEnableCamera) {
      status.textContent = "Activando cámara...";
      const cameraReady = await startCamera();
      if (cameraReady) speak("Cámara activada, señor.");
    } else if (saysJarvis && asksForPhoto) {
      status.textContent = "Preparando cámara...";
      const cameraReady = await startCamera();
      if (cameraReady) takePhoto();
    } else if (asksForPhoto) {
      status.textContent = "Comando de foto recibido.";
      const cameraReady = await startCamera();
      if (cameraReady) takePhoto();
    } else if (saysJarvis) {
      status.textContent = "Jarvis activo.";
      speak("Sí, señor.");
    } else {
      status.textContent = "Comando recibido.";
    }
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
