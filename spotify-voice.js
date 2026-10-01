/* JARVIS SPOTIFY VOICE V1
 * Extensión incremental: añade control de Spotify sobre processInput existente.
 * No reemplaza el núcleo de voz ni los comandos de sistema.
 */
(() => {
  if (typeof window.processInput !== "function") return;
  if (window.JarvisSpotifyVoice) return;

  const normalize = (text) => String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const removeWake = (text) => normalize(text)
    .replace(/\b(jarvis|yarvis|jervis|harvis)\b/g, " ")
    .replace(/\bpor favor\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const speak = async (text) => {
    if (typeof window.speak === "function") return window.speak(text);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  };

  const spotify = () => window.JarvisSpotify;

  const ensureSpotify = () => {
    if (!spotify()) throw new Error("El módulo Spotify todavía no está disponible.");
    return spotify();
  };

  const withSpotify = async (action, successMessage) => {
    try {
      const api = ensureSpotify();
      const result = await action(api);
      await speak(typeof successMessage === "function" ? successMessage(result) : successMessage);
      return true;
    } catch (error) {
      console.error("Jarvis Spotify:", error);
      const message = String(error?.message || "");
      if (/autorizaci[oó]n de spotify requerida|sesi[oó]n de spotify expir[oó]/i.test(message)) {
        await speak("Necesito autorización de Spotify, señor. He abierto el proceso de conexión.");
      } else {
        await speak("No pude completar esa orden de Spotify, señor.");
      }
      return true;
    }
  };

  const originalProcessInput = window.processInput;

  window.processInput = async function spotifyVoiceInput(text, source = "text") {
    const command = removeWake(text);

    // Reproducir música aleatoria.
    if (/^(?:pon|poner|ponme|reproduce|reproducir)(?:\s+la)?\s+musica$/.test(command)
      || /^(?:pon|poner|ponme|reproduce|reproducir)(?:\s+algo)?\s+de\s+musica$/.test(command)) {
      return withSpotify(
        (api) => api.searchAndPlayRandom(),
        (result) => {
          const track = result?.track;
          if (!track) return "Reproduciendo música en Spotify, señor.";
          const artist = track.artists?.map((item) => item.name).join(", ") || "artista desconocido";
          return `Reproduciendo ${track.name} de ${artist} en Spotify, señor.`;
        }
      );
    }

    // Reproducir una canción, artista o búsqueda concreta.
    const playMatch = command.match(/^(?:pon|poner|ponme|reproduce|reproducir)(?:\s+la)?\s+(.+)$/);
    if (playMatch) {
      const query = playMatch[1].trim();
      if (!/^(?:musica|música|algo de musica|algo de música)$/.test(query)) {
        return withSpotify(
          (api) => api.searchAndPlay(query),
          (result) => {
            const track = result?.track;
            if (!track) return `Reproduciendo ${query} en Spotify, señor.`;
            const artist = track.artists?.map((item) => item.name).join(", ") || "artista desconocido";
            return `Reproduciendo ${track.name} de ${artist} en Spotify, señor.`;
          }
        );
      }
    }

    const searchMatch = command.match(/^(?:busca|buscar|buscame|búscame)\s+(.+)$/);
    if (searchMatch) {
      const query = searchMatch[1].trim();
      return withSpotify(
        async (api) => {
          const tracks = await api.searchTracks?.(query, 5);
          if (!tracks?.length) throw new Error("No encontré canciones para esa búsqueda.");
          return api.searchAndPlay(query);
        },
        `Buscando y reproduciendo ${query} en Spotify, señor.`
      );
    }

    if (/^(?:pausa|pausa spotify|pausar spotify|pausa la musica|pausar la musica|deten la musica|detener la musica)$/.test(command)) {
      return withSpotify((api) => api.pause(), "Spotify en pausa, señor.");
    }

    if (/^(?:reanuda|reanudar|reanuda spotify|reanudar spotify|continua la musica|continuar la musica)$/.test(command)) {
      return withSpotify((api) => api.resume(), "Reanudando Spotify, señor.");
    }

    if (/^(?:siguiente|siguiente cancion|siguiente canción|siguiente pista|pista siguiente|salta la cancion|salta la canción)$/.test(command)) {
      return withSpotify((api) => api.next(), "Pasando a la siguiente canción, señor.");
    }

    if (/^(?:anterior|cancion anterior|canción anterior|pista anterior|pista previa|anterior cancion|anterior canción)$/.test(command)) {
      return withSpotify((api) => api.previous(), "Volviendo a la canción anterior, señor.");
    }

    const volumeMatch = command.match(/^(?:pon|establece|ajusta|sube|baja)\s+(?:el\s+)?volumen(?:\s+(?:a|en|al))?\s*(\d{1,3})(?:\s*por\s*ciento|\s*%)?$/);
    if (volumeMatch) {
      const volume = Math.max(0, Math.min(100, Number(volumeMatch[1])));
      return withSpotify(
        (api) => api.setVolume(volume),
        (value) => `Volumen de Spotify ajustado al ${value} por ciento, señor.`
      );
    }

    if (/^(?:sube|subir)\s+(?:el\s+)?volumen$/.test(command)) {
      return withSpotify(async (api) => {
        const state = await api.getPlaybackState();
        const current = Number(state?.device?.volume_percent);
        const next = Math.min(100, (Number.isFinite(current) ? current : 50) + 10);
        return api.setVolume(next);
      }, (value) => `He subido el volumen de Spotify al ${value} por ciento, señor.`);
    }

    if (/^(?:baja|bajar)\s+(?:el\s+)?volumen$/.test(command)) {
      return withSpotify(async (api) => {
        const state = await api.getPlaybackState();
        const current = Number(state?.device?.volume_percent);
        const next = Math.max(0, (Number.isFinite(current) ? current : 50) - 10);
        return api.setVolume(next);
      }, (value) => `He bajado el volumen de Spotify al ${value} por ciento, señor.`);
    }

    if (/^(?:que suena|que esta sonando|qué está sonando|cancion actual|canción actual|que cancion es|qué canción es)$/.test(command)) {
      return withSpotify(
        async (api) => {
          const data = await api.current();
          if (!data?.item) throw new Error("No hay ninguna canción reproduciéndose.");
          return data;
        },
        (data) => {
          const item = data.item;
          const artist = item.artists?.map((a) => a.name).join(", ") || "artista desconocido";
          return `Está sonando ${item.name} de ${artist}, señor.`;
        }
      );
    }

    return originalProcessInput(text, source);
  };

  window.JarvisSpotifyVoice = { version: "1.0.0" };
})();
