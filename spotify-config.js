const SPOTIFY_CLIENT_ID = "7dd661d992ef4899ba9f702ed89bc8de";
const SPOTIFY_REDIRECT_URI = "https://jarvis2-icvdgi9uj-hola-edbb.vercel.app/";
const SPOTIFY_SCOPES = "user-read-playback-state user-read-currently-playing user-modify-playback-state";

window.JarvisSpotifyConfig = {
  clientId: SPOTIFY_CLIENT_ID,
  redirectUri: SPOTIFY_REDIRECT_URI,
  scopes: SPOTIFY_SCOPES
};