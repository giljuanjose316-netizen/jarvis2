const micButton = document.getElementById("micButton");
const status = document.getElementById("status");
const transcript = document.getElementById("transcript");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

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

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    transcript.textContent = `Tú: ${text}`;
    status.textContent = "He recibido tu comando.";
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
