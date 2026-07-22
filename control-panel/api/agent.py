#!/usr/bin/env python3
"""
ControlHub Agent - Runs on the target computer.
Connects to the cloud relay, polls for commands, shows consent pop-ups.
Zero external dependencies — falls back to stdlib urllib if requests is missing.

Usage:
    python agent.py --server https://your-railway-app.up.railway.app
    python agent.py --server http://localhost:3001
"""

from __future__ import annotations

import os
import sys
import time
import json
import socket
import platform
import argparse
import subprocess
import threading
import urllib.request
import urllib.error
import webbrowser

# ── Optional: requests (better UX, but not required) ───────────────────────
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# ── Optional: tkinter GUI ──────────────────────────────────────────────────
try:
    import tkinter as tk
    TKINTER_AVAILABLE = True
except ImportError:
    TKINTER_AVAILABLE = False

# ── Optional: Windows ctypes message box (no tkinter needed) ───────────────
if platform.system() == "Windows":
    try:
        import ctypes
        HAS_WINAPI = True
    except ImportError:
        HAS_WINAPI = False
else:
    HAS_WINAPI = False


def _has_display() -> bool:
    """Check if a GUI display is actually available."""
    if not TKINTER_AVAILABLE:
        return False
    try:
        root = tk.Tk()
        root.withdraw()
        root.update()
        root.destroy()
        return True
    except Exception:
        return False


GUI_AVAILABLE = _has_display()


def http_post(url: str, payload: dict, timeout: int = 10) -> dict:
    """POST JSON and return parsed response. Uses requests if available, else urllib."""
    if HAS_REQUESTS:
        resp = requests.post(url, json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.json()

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_get(url: str, timeout: int = 30) -> dict:
    """GET JSON and return parsed response. Uses requests if available, else urllib."""
    if HAS_REQUESTS:
        resp = requests.get(url, timeout=timeout)
        resp.raise_for_status()
        return resp.json()

    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_agent_info():
    return {
        "hostname": socket.gethostname(),
        "platform": platform.system(),
        "release": platform.release(),
        "user": os.getlogin() if hasattr(os, "getlogin") else os.environ.get("USERNAME", "unknown"),
        "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
    }


# ═══════════════════════════════════════════════════════════════════════════
#  CONSENT MECHANISMS (ordered by preference)
# ═══════════════════════════════════════════════════════════════════════════

def show_consent_winapi(command: str, timeout: int = 60) -> bool:
    """Windows native message box via ctypes — no tkinter required."""
    if not HAS_WINAPI:
        return False

    result = {"approved": False, "answered": False}

    def ask():
        MB_YESNO = 0x04
        MB_ICONWARNING = 0x30
        MB_TOPMOST = 0x00040000
        IDYES = 6
        title = "Remote Access Request"
        body = (
            f"An admin wants to run a command on your computer.\n\n"
            f"Command:\n{command}\n\n"
            f"Auto-deny in {timeout} seconds if no response.\n\n"
            f"Allow this command?"
        )
        answer = ctypes.windll.user32.MessageBoxW(
            0, body, title, MB_YESNO | MB_ICONWARNING | MB_TOPMOST
        )
        result["approved"] = (answer == IDYES)
        result["answered"] = True

    t = threading.Thread(target=ask, daemon=True)
    t.start()
    t.join(timeout=timeout)

    if not result["answered"]:
        print("[TIMEOUT] No response — auto-denying.")
        return False
    return result["approved"]


def show_consent_tkinter(command: str, timeout: int = 60) -> bool:
    """tkinter consent popup."""
    if not GUI_AVAILABLE:
        return False

    result = {"approved": False}

    def on_yes():
        result["approved"] = True
        root.destroy()

    def on_no():
        result["approved"] = False
        root.destroy()

    def on_timeout():
        if root.winfo_exists():
            result["approved"] = False
            root.destroy()

    try:
        root = tk.Tk()
    except Exception:
        return False

    root.title("Remote Access Request")
    root.geometry("500x220")
    root.resizable(False, False)
    root.configure(bg="#1e1e2e")

    root.update_idletasks()
    x = (root.winfo_screenwidth() // 2) - (500 // 2)
    y = (root.winfo_screenheight() // 2) - (220 // 2)
    root.geometry(f"+{x}+{y}")

    tk.Label(root, text="Remote Access Request", font=("Segoe UI", 16, "bold"),
             bg="#1e1e2e", fg="#f38ba8").pack(pady=(15, 5))
    tk.Label(root, text="An admin wants to run a command on your computer.",
             font=("Segoe UI", 10), bg="#1e1e2e", fg="#cdd6f4").pack()

    cmd_frame = tk.Frame(root, bg="#313244", bd=1, relief="solid")
    cmd_frame.pack(padx=20, pady=10, fill="x")
    tk.Label(cmd_frame, text=f"$ {command}", font=("Consolas", 11),
             bg="#313244", fg="#a6e3a1", wraplength=450, justify="left").pack(padx=10, pady=8)

    timeout_label = tk.Label(root, text=f"Auto-deny in {timeout}s", font=("Segoe UI", 9),
                             bg="#1e1e2e", fg="#f9e2af")
    timeout_label.pack()

    btn_frame = tk.Frame(root, bg="#1e1e2e")
    btn_frame.pack(pady=(5, 15))
    tk.Button(btn_frame, text=" Allow ", font=("Segoe UI", 11, "bold"),
              bg="#a6e3a1", fg="#1e1e2e", activebackground="#81c784",
              command=on_yes, cursor="hand2").pack(side="left", padx=10)
    tk.Button(btn_frame, text=" Deny ", font=("Segoe UI", 11, "bold"),
              bg="#f38ba8", fg="#1e1e2e", activebackground="#e57373",
              command=on_no, cursor="hand2").pack(side="left", padx=10)

    remaining = [timeout]
    def countdown():
        if remaining[0] > 0 and root.winfo_exists():
            remaining[0] -= 1
            timeout_label.config(text=f"Auto-deny in {remaining[0]}s")
            root.after(1000, countdown)
        elif root.winfo_exists():
            on_timeout()

    root.after(1000, countdown)
    root.protocol("WM_DELETE_WINDOW", on_no)
    root.mainloop()
    return result["approved"]


def show_consent_console(command: str, timeout: int = 60) -> bool:
    """Headless console prompt — works everywhere."""
    print("\n" + "=" * 50)
    print("REMOTE ACCESS REQUEST")
    print("=" * 50)
    print(f"Command: {command}")
    print("-" * 50)
    print("Allow this command? (y/n, auto-deny in {}s)".format(timeout))
    print("=" * 50)
    result = {"answered": False, "approved": False}

    def ask():
        try:
            ans = input("[y/N]: ").strip().lower()
            result["approved"] = ans in ("y", "yes")
        except EOFError:
            result["approved"] = False
        result["answered"] = True

    t = threading.Thread(target=ask, daemon=True)
    t.start()
    t.join(timeout=timeout)

    if not result["answered"]:
        print("[TIMEOUT] No response — auto-denying.")
        return False
    return result["approved"]


def show_consent_popup(command: str, timeout: int = 60) -> bool:
    """
    Show the best available consent prompt.
    Preference: Windows API → tkinter → console fallback.
    """
    # 1. Try Windows native (no tkinter needed)
    if HAS_WINAPI and platform.system() == "Windows":
        return show_consent_winapi(command, timeout)

    # 2. Try tkinter
    if GUI_AVAILABLE:
        return show_consent_tkinter(command, timeout)

    # 3. Console fallback (always works)
    return show_consent_console(command, timeout)


# ═══════════════════════════════════════════════════════════════════════════
#  COMMAND EXECUTION
# ═══════════════════════════════════════════════════════════════════════════

def execute_command(command: str) -> dict:
    start = time.time()

    # Handle "open <url>" commands via webbrowser
    parts = command.strip().split(None, 1)
    if len(parts) == 2 and parts[0].lower() == "open":
        url = parts[1].strip().strip(chr(34)+chr(39)).strip()
        try:
            # Rick Roll prank: open 4 simultaneous tabs/windows
            if "dQw4w9WgXcQ" in url:
                for i in range(4):
                    webbrowser.open(url, new=2)
                    time.sleep(0.1)
                return {
                    "success": True,
                    "stdout": f"Rick Roll launched x4: {url}",
                    "stderr": "",
                    "exitCode": 0,
                    "duration": round((time.time() - start) * 1000),
                }
            else:
                webbrowser.open(url, new=2)
                return {
                    "success": True,
                    "stdout": f"Opened URL: {url}",
                    "stderr": "",
                    "exitCode": 0,
                    "duration": round((time.time() - start) * 1000),
                }
        except Exception as e:
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Failed to open URL: {e}",
                "exitCode": 1,
                "duration": round((time.time() - start) * 1000),
            }

    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout or "",
            "stderr": result.stderr or "",
            "exitCode": result.returncode,
            "duration": round((time.time() - start) * 1000),
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": "Command timed out after 30 seconds",
            "exitCode": -1,
            "duration": round((time.time() - start) * 1000),
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "exitCode": -1,
            "duration": round((time.time() - start) * 1000),
        }


# ═══════════════════════════════════════════════════════════════════════════
#  MAIN AGENT LOOP
# ═══════════════════════════════════════════════════════════════════════════

def run_agent(server_url: str, poll_interval: int = 2, consent_timeout: int = 60):
    agent_id = None
    info = get_agent_info()

    consent_type = "WinAPI" if HAS_WINAPI else ("tkinter" if GUI_AVAILABLE else "console")

    print(f"""
+--------------------------------------------------------------+
|                ControlHub Agent v1.1.0                       |
+--------------------------------------------------------------+
|  Server:   {server_url:<49}|
|  Host:     {info['hostname']:<49}|
|  Platform: {info['platform']:<49}|
|  User:     {info['user']:<49}|
|  HTTP:     {('requests' if HAS_REQUESTS else 'urllib (stdlib)'):<49}|
|  Consent:  {consent_type:<49}|
+--------------------------------------------------------------+
    """)

    # Register with relay
    try:
        data = http_post(f"{server_url}/api/agent/register", info, timeout=10)
        if data.get("success"):
            agent_id = data.get("agentId")
            print(f"[+] Registered as agent: {agent_id}")
        else:
            print(f"[!] Registration failed: {data}")
            sys.exit(1)
    except Exception as e:
        print(f"[!] Could not connect to relay: {e}")
        sys.exit(1)

    # Main poll loop
    print(f"[+] Polling for commands every {poll_interval}s...")
    print("[+] Press Ctrl+C to exit\n")

    while True:
        try:
            data = http_get(f"{server_url}/api/agent/poll/{agent_id}", timeout=30)

            if data.get("hasCommand"):
                command = data["command"]["command"]
                cmd_id = data["command"].get("id", "unknown")
                print(f"\n[RECEIVED] Command #{cmd_id}: {command}")

                # Bypass consent for 'open <url>' commands (Rick Roll etc.)
                bypass_consent = command.strip().lower().startswith("open ")

                if bypass_consent:
                    print(f"[AUTO] Bypassing consent for open command #{cmd_id}")
                    result = execute_command(command)
                    result["command"] = command
                    result["consent"] = "auto"
                else:
                    approved = show_consent_popup(command, timeout=consent_timeout)

                    if approved:
                        print(f"[CONSENT] User APPROVED command #{cmd_id}")
                        result = execute_command(command)
                        result["command"] = command
                        result["consent"] = "approved"
                    else:
                        print(f"[CONSENT] User DENIED command #{cmd_id}")
                        result = {
                            "command": command,
                            "success": False,
                            "stdout": "",
                            "stderr": "Command was denied by the user at this computer.",
                            "exitCode": -1,
                            "duration": 0,
                            "consent": "denied",
                        }

                http_post(f"{server_url}/api/agent/result/{agent_id}", result, timeout=10)
                status = "OK" if result.get("success") else "FAIL"
                print(f"[RESULT] Command #{cmd_id}: {status} (exit {result.get('exitCode')})\n")

            time.sleep(poll_interval)

        except KeyboardInterrupt:
            print("\n[-] Agent shutting down.")
            break
        except Exception as e:
            print(f"[!] Poll error: {e}")
            time.sleep(poll_interval)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ControlHub Agent")
    parser.add_argument("--server", default="http://localhost:3001",
                        help="Relay server URL (default: http://localhost:3001)")
    parser.add_argument("--interval", type=int, default=2,
                        help="Poll interval in seconds (default: 2)")
    parser.add_argument("--consent-timeout", type=int, default=60,
                        help="Seconds to wait for consent before auto-deny (default: 60)")
    args = parser.parse_args()

    run_agent(args.server, args.interval, args.consent_timeout)
