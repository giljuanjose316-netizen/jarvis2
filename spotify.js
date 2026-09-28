(() => {
  const config = window.JarvisSpotifyConfig;
  if (!config?.clientId || !config?.redirectUri) return;

  const TOKEN_KEY = "jarvis_spotify_tokens_v1";
  const VERIFIER_KEY = "jarvis_spotify_code_verifier_v1";
  const STATE_KEY = "jarvis_spotify_oauth_state_v1";

  function randomString(length = 64) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, value => chars[value % chars.length]).join("");
  }

  async function sha256(value) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  }

  function base64Url(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  async function getCodeChallenge(verifier) {
    return base64Url(await sha256(verifier));
  }

  function getTokens() {
    try {
      return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveTokens(tokens) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  }

  async function authorize() {
    const verifier = randomString();
    const state = randomString(32);
    const challenge = await getCodeChallenge(verifier);

    localStorage.setItem(VERIFIER_KEY, verifier);
    localStorage.setItem(STATE_KEY, state);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      scope: config.scopes,
      code_challenge_method: "S256",
      code_challenge: challenge,
      redirect_uri: config.redirectUri,
      state
    });

    window.location.href = "https://accounts.spotify.com/authorize?" + params.toString();
  }

  async function exchangeCode(code) {
    const verifier = localStorage.getItem(VERIFIER_KEY);
    if (!verifier) throw new Error("Falta el verificador PKCE.");

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
        code_verifier: verifier
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || data.error || "No se pudo obtener el token.");

    saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000)
    });

    localStorage.removeItem(VERIFIER_KEY);
    localStorage.removeItem(STATE_KEY);
    return data;
  }

  async function refreshToken(tokens) {
    if (!tokens?.refresh_token) return null;

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: config.clientId
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || data.error || "No se pudo renovar el token.");

    const updated = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || tokens.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000)
    };
    saveTokens(updated);
    return updated;
  }

  async function getAccessToken() {
    let tokens = getTokens();
    if (!tokens) return null;

    if (tokens.expires_at && Date.now() < tokens.expires_at - 60000) {
      return tokens.access_token;
    }

    tokens = await refreshToken(tokens);
    return tokens?.access_token || null;
  }

  async function api(path, options = {}) {
    let token = await getAccessToken();
    if (!token) {
      await authorize();
      throw new Error("Autorización de Spotify requerida.");
    }

    let response = await fetch("https://api.spotify.com/v1" + path, {
      ...options,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    if (response.status === 401) {
      const tokens = getTokens();
      if (tokens?.refresh_token) {
        try {
          await refreshToken(tokens);
          token = await getAccessToken();
          response = await fetch("https://api.spotify.com/v1" + path, {
            ...options,
            headers: {
              Authorization: "Bearer " + token,
              "Content-Type": "application/json",
              ...(options.headers || {})
            }
          });
        } catch {
          localStorage.removeItem(TOKEN_KEY);
        }
      }
    }

    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      await authorize();
      throw new Error("La sesión de Spotify expiró.");
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || ("Spotify API " + response.status));
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async function getPlayableDevice() {
    const data = await api("/me/player/devices");
    const devices = (data?.devices || []).filter(device => !device.is_restricted);

    if (!devices.length) {
      throw new Error("No hay un dispositivo Spotify disponible. Abre Spotify en tu PC o teléfono e inténtalo de nuevo.");
    }

    return devices.find(device => device.is_active) || devices[0];
  }

  async function ensureDevice(device) {
    if (device.is_active) return device;

    await api("/me/player", {
      method: "PUT",
      body: JSON.stringify({
        device_ids: [device.id],
        play: false
      })
    });

    return device;
  }

  function chooseBestTrack(tracks) {
    const playable = tracks.filter(track => track && track.uri && track.is_playable !== false);
    if (!playable.length) return null;

    return playable.reduce((best, track) => {
      const bestPopularity = Number(best.popularity || 0);
      const trackPopularity = Number(track.popularity || 0);
      return trackPopularity > bestPopularity ? track : best;
    }, playable[0]);
  }

  async function searchAndPlay(query) {
    const params = new URLSearchParams({
      q: query,
      type: "track",
      limit: "10",
      market: "CO"
    });

    const data = await api("/search?" + params.toString());
    const tracks = data?.tracks?.items || [];
    if (!tracks.length) throw new Error("No encontré canciones para esa búsqueda.");

    const track = chooseBestTrack(tracks);
    if (!track) throw new Error("No encontré una pista reproducible para esa búsqueda.");

    const device = await getPlayableDevice();
    await ensureDevice(device);

    await api("/me/player/play?device_id=" + encodeURIComponent(device.id), {
      method: "PUT",
      body: JSON.stringify({ uris: [track.uri] })
    });

    return { track, device };
  }

  async function pause() {
    const device = await getPlayableDevice();
    return api("/me/player/pause?device_id=" + encodeURIComponent(device.id), { method: "PUT" });
  }

  async function resume() {
    const device = await getPlayableDevice();
    return api("/me/player/play?device_id=" + encodeURIComponent(device.id), { method: "PUT" });
  }

  async function next() {
    const device = await getPlayableDevice();
    return api("/me/player/next?device_id=" + encodeURIComponent(device.id), { method: "POST" });
  }

  async function current() {
    return api("/me/player/currently-playing?market=CO");
  }

  async function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const returnedState = params.get("state");
    const error = params.get("error");

    if (!code && !error) return false;

    if (error) {
      history.replaceState({}, document.title, config.redirectUri);
      throw new Error("Spotify rechazó la autorización: " + error);
    }

    const expectedState = localStorage.getItem(STATE_KEY);
    if (!returnedState || !expectedState || returnedState !== expectedState) {
      history.replaceState({}, document.title, config.redirectUri);
      throw new Error("Estado OAuth de Spotify no válido.");
    }

    await exchangeCode(code);
    history.replaceState({}, document.title, config.redirectUri);
    return true;
  }

  window.JarvisSpotify = {
    authorize,
    searchAndPlay,
    pause,
    resume,
    next,
    current,
    getAccessToken,
    handleCallback,
    isConnected: () => !!getTokens()
  };

  handleCallback()
    .then((connected) => {
      if (!connected) return;
      const status = document.getElementById("status");
      if (status) status.textContent = "Spotify conectado. Jarvis está listo.";
    })
    .catch((error) => {
      console.error("Spotify OAuth:", error);
      const status = document.getElementById("status");
      if (status) status.textContent = "No se pudo completar la conexión con Spotify.";
    });
})();