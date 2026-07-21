#!/usr/bin/env python3
"""
ControlHub API Server - Python Backend
Railway-ready Flask backend for command execution and system monitoring.
Compatible with Python 3.10+
"""

import os
import re
import sys
import json
import time
import platform
import subprocess
import socket
import psutil
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Configuration
PORT = int(os.environ.get("PORT", 3001))
ENV = os.environ.get("RAILWAY_ENVIRONMENT", "local")
RAILWAY_URL = os.environ.get("RAILWAY_STATIC_URL", None)

# Allowed safe commands (whitelist approach)
ALLOWED_COMMANDS = [
    "echo", "pwd", "ls", "dir", "whoami", "date", "uptime", "uname",
    "cat", "head", "tail", "ps", "top", "df", "du", "env", "hostname",
    "id", "groups", "which", "whereis", "wc", "sort", "uniq", "grep",
    "find", "curl", "wget", "ping", "netstat", "ifconfig", "ipconfig",
    "nslookup", "dig", "traceroute", "node", "python", "python3", "npm",
    "pip", "pip3", "mkdir", "touch", "cp", "mv", "clear", "cls",
]

# Blocked dangerous patterns
BLOCKED_PATTERNS = [
    re.compile(r"rm\s+-rf\s+/"),
    re.compile(r">\s*/dev/null"),
    re.compile(r"mkfs"),
    re.compile(r"dd\s+if"),
    re.compile(r":\(\)\{\s*:\|:\s*\};"),  # fork bomb
    re.compile(r"shutdown"),
    re.compile(r"reboot"),
    re.compile(r"halt"),
    re.compile(r"poweroff"),
    re.compile(r"init\s+0"),
    re.compile(r"del\s+/s\s+/q"),
    re.compile(r"format\s+"),
]


def validate_command(cmd: str) -> dict:
    """Validate a command for safety."""
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
        "warning": None if is_whitelisted else f"Command '{base_cmd}' is not in whitelist - executing with caution",
    }


@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "name": "ControlHub API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": [
            "/api/health",
            "/api/system",
            "/api/execute",
            "/api/execute/batch",
            "/api/sessions",
            "/api/files/list",
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
        "version": "1.0.0",
        "platform": platform.system(),
        "environment": ENV,
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
            "cpu": {
                "model": cpu_info,
                "cores": cores,
                "loadAvg": load_avg,
            },
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
    data = request.get_json() or {}
    command = data.get("command", "")
    cwd = data.get("cwd")

    validation = validate_command(command)
    if not validation["valid"]:
        return jsonify({
            "success": False,
            "command": command,
            "error": validation["reason"],
            "stdout": "",
            "stderr": "",
            "exitCode": -1,
            "duration": 0,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "cwd": cwd or os.getcwd(),
        })

    start_time = time.time()
    working_dir = cwd if cwd and cwd != "~" else os.getcwd()

    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=30,
        )
        duration = round((time.time() - start_time) * 1000)

        app.logger.info(f"[EXEC] {command} - {duration}ms - exit {result.returncode}")

        return jsonify({
            "success": result.returncode == 0,
            "command": command,
            "stdout": result.stdout or "",
            "stderr": result.stderr or "",
            "exitCode": result.returncode,
            "duration": duration,
            "warning": validation.get("warning"),
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "cwd": working_dir,
        })
    except subprocess.TimeoutExpired:
        duration = round((time.time() - start_time) * 1000)
        return jsonify({
            "success": False,
            "command": command,
            "stdout": "",
            "stderr": "Command timed out after 30 seconds",
            "exitCode": -1,
            "duration": duration,
            "error": "Timeout",
            "warning": validation.get("warning"),
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "cwd": working_dir,
        })
    except Exception as e:
        duration = round((time.time() - start_time) * 1000)
        return jsonify({
            "success": False,
            "command": command,
            "stdout": "",
            "stderr": str(e),
            "exitCode": -1,
            "duration": duration,
            "error": str(e),
            "warning": validation.get("warning"),
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "cwd": working_dir,
        })


@app.route("/api/execute/batch", methods=["POST"])
def execute_batch():
    data = request.get_json() or {}
    commands = data.get("commands", [])
    cwd = data.get("cwd")
    working_dir = cwd if cwd and cwd != "~" else os.getcwd()

    if not isinstance(commands, list):
        return jsonify({"error": "commands must be an array"}), 400

    results = []
    for command in commands:
        validation = validate_command(command)
        if not validation["valid"]:
            results.append({
                "command": command,
                "success": False,
                "error": validation["reason"],
                "stdout": "",
                "stderr": "",
            })
            continue

        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=working_dir,
                capture_output=True,
                text=True,
                timeout=30,
            )
            results.append({
                "command": command,
                "success": result.returncode == 0,
                "stdout": result.stdout or "",
                "stderr": result.stderr or "",
                "exitCode": result.returncode,
            })
        except Exception as e:
            results.append({
                "command": command,
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "exitCode": -1,
                "error": str(e),
            })

    return jsonify({
        "results": results,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    })


@app.route("/api/sessions", methods=["GET"])
def sessions():
    return jsonify({
        "sessions": [
            {
                "id": "1",
                "target": socket.gethostname(),
                "ip": "127.0.0.1",
                "port": PORT,
                "os": platform.system(),
                "user": os.getlogin() if hasattr(os, "getlogin") else os.environ.get("USERNAME", "user"),
                "connectedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "status": "active",
            }
        ],
        "listening": True,
        "listenPort": PORT,
    })


@app.route("/api/files/list", methods=["POST"])
def list_files():
    data = request.get_json() or {}
    target_path = data.get("path", os.getcwd())

    try:
        if platform.system() == "Windows":
            cmd = f'dir "{target_path}" /b'
        else:
            cmd = f'ls -la "{target_path}"'

        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return jsonify({
            "success": result.returncode == 0,
            "path": target_path,
            "listing": result.stdout or result.stderr,
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "path": target_path,
            "error": str(e),
        }), 500


@app.errorhandler(Exception)
def handle_error(e):
    app.logger.error(f"Unhandled error: {e}")
    return jsonify({"error": "Internal server error", "message": str(e)}), 500


app_start_time = time.time()

if __name__ == "__main__":
    print(
        """
╔══════════════════════════════════════════════════════════════╗
║                    ControlHub API Server                     ║
╠══════════════════════════════════════════════════════════════╣
║  Port:    {port:<51}║
║  Platform: {plat:<50}║
║  Python:  {pyver:<51}║
║  Environment: {env:<47}║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                  ║
║    GET  /api/health     - Health check                       ║
║    GET  /api/system     - System metrics                     ║
║    POST /api/execute    - Execute command                    ║
║    POST /api/execute/batch - Execute multiple commands       ║
║    GET  /api/sessions   - Active sessions                    ║
║    POST /api/files/list - List directory contents            ║
╚══════════════════════════════════════════════════════════════╝
        """.format(
            port=PORT,
            plat=platform.system(),
            pyver=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            env=ENV,
        )
    )
    app.run(host="0.0.0.0", port=PORT, debug=(ENV == "local"))
