from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs, quote
from pathlib import Path
import os
import subprocess
import glob

HOST = "127.0.0.1"
PORT = 3000

def abrir_aplicacion(app):
    if app == "roblox":
        rutas = glob.glob(os.path.expandvars(r"%LOCALAPPDATA%\Roblox\Versions\**\RobloxPlayerBeta.exe"), recursive=True)
        if not rutas:
            raise FileNotFoundError("No se encontró Roblox.")
        subprocess.Popen([rutas[-1]], shell=False)
        return

    comandos = {
        "chrome": ["chrome.exe"],
        "edge": ["msedge.exe"],
        "vscode": ["Code.exe"],
        "notepad": ["notepad.exe"],
        "calculator": ["calc.exe"],
        "explorer": ["explorer.exe"],
    }

    if app in comandos:
        subprocess.Popen(comandos[app], shell=False)
        return

    rutas_especiales = {
        "downloads": Path.home() / "Downloads",
        "documents": Path.home() / "Documents",
        "desktop": Path.home() / "Desktop",
    }

    if app in rutas_especiales:
        os.startfile(str(rutas_especiales[app]))
        return

    if app == "settings":
        subprocess.Popen(["powershell.exe", "-NoProfile", "-Command", "Start-Process 'ms-settings:'"])
        return

    raise ValueError("Comando no permitido.")

def cerrar_aplicacion(app):
    procesos = {
        "chrome": "chrome.exe",
        "edge": "msedge.exe",
        "vscode": "Code.exe",
        "notepad": "notepad.exe",
        "calculator": "CalculatorApp.exe",
        "explorer": "explorer.exe",
        "roblox": "RobloxPlayerBeta.exe",
        "discord": "Discord.exe",
        "spotify": "Spotify.exe",
        "steam": "steam.exe",
        "epic": "EpicGamesLauncher.exe",
        "whatsapp": "WhatsApp.exe",
        "telegram": "Telegram.exe",
        "word": "WINWORD.EXE",
        "excel": "EXCEL.EXE",
        "powerpoint": "POWERPNT.EXE",
    }

    if app not in procesos:
        raise ValueError("Cierre no permitido para esa aplicación.")

    result = subprocess.run(
        ["taskkill", "/IM", procesos[app], "/F"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"No se encontró el proceso de {app}.")

def accion_sistema(action):
    if action == "lock":
        subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"], check=False)
        return
    if action == "restart":
        subprocess.run(["shutdown.exe", "/r", "/t", "0"], check=False)
        return
    if action == "shutdown":
        subprocess.run(["shutdown.exe", "/s", "/t", "0"], check=False)
        return
    raise ValueError("Acción de sistema no permitida.")

class Handler(BaseHTTPRequestHandler):
    def _send(self, code, message):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(message.encode("utf-8"))

    def do_OPTIONS(self):
        self._send(204, "")

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        try:
            if parsed.path == "/open":
                app = params.get("app", [""])[0]
                abrir_aplicacion(app)
                self._send(200, f"Abierto: {app}")
                return

            if parsed.path == "/close":
                app = params.get("app", [""])[0]
                cerrar_aplicacion(app)
                self._send(200, f"Cerrado: {app}")
                return

            if parsed.path == "/spotify":
                import webbrowser
                query = params.get("query", [""])[0].strip()
                if not query:
                    self._send(400, "Falta query.")
                    return
                spotify_url = "https://open.spotify.com/search/" + quote(query)
                webbrowser.open(spotify_url)
                self._send(200, f"Spotify abierto: {query}")
                return

            if parsed.path == "/system":
                action = params.get("action", [""])[0]
                accion_sistema(action)
                self._send(200, f"Acción ejecutada: {action}")
                return

            self._send(404, "Ruta no encontrada.")
        except Exception as error:
            self._send(500, str(error))

    def log_message(self, format, *args):
        print(f"[Bridge] {self.address_string()} - {format % args}")

if __name__ == "__main__":
    print(f"Jarvis Bridge activo en http://{HOST}:{PORT}")
    HTTPServer((HOST, PORT), Handler).serve_forever()
