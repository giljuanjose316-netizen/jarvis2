const micButton = document.getElementById("micButton");
const status = document.getElementById("status");
const transcript = document.getElementById("transcript");
const camera = document.getElementById("camera");
const photoCanvas = document.getElementById("photoCanvas");
const cameraButton = document.getElementById("cameraButton");
const cameraStatus = document.getElementById("cameraStatus");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let cameraStream = null;

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-CO";
  utterance.rate = 0.88;
  utterance.pitch = 0.72;
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
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
      camera.srcObject = cameraStream;
    }

    await camera.play();
    cameraStatus.textContent = "Cámara activa.";
    cameraButton.textContent = "Cámara activa";
    return true;
  } catch (error) {
    cameraStatus.textContent = "Permiso de cámara necesario.";
    status.textContent = "No se pudo activar la cámara.";
    console.error(error);
    return false;
  }
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
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = photoUrl;
  link.download = `jarvis-foto-${timestamp}.png`;
  link.click();

  status.textContent = "Foto tomada.";
  cameraStatus.textContent = "Foto capturada y guardada.";
  speak("Foto tomada, señor.");
}

cameraButton.addEventListener("click", startCamera);

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

    const normalized = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const saysJarvis = /\bjarvis\b/.test(normalized);
    const asksForPhoto = /\b(toma|tomar|saca|sacar)\s+(una\s+)?foto\b/.test(normalized);

    if (saysJarvis && asksForPhoto) {
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
    if (status.textContent === "Escuchando...") {
      status.textContent = "Sistema listo.";
    }
  };
}

window.addEventListener("beforeunload", () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
  }
});
