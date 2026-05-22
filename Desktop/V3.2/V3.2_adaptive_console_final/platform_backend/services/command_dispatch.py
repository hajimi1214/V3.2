from __future__ import annotations

import json
import os
import time
from typing import Any, Dict

from platform_backend.config.paths import COMMAND_CONFIG_PATH


def coerce_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


def load_command_targets() -> Dict[str, Any]:
    default_config: Dict[str, Any] = {
        "protocol": "tcp_plain",
        "timeout_seconds": 3.0,
        "ack_timeout_seconds": 0.35,
        "targets": [
            {"name": "上位机控制端A", "host": "192.168.1.109", "port": 9000},
            {"name": "上位机控制端B", "host": "192.168.1.102", "port": 9000},
        ],
    }

    if COMMAND_CONFIG_PATH.exists():
        try:
            loaded = json.loads(COMMAND_CONFIG_PATH.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                default_config.update({k: v for k, v in loaded.items() if k != "targets"})
                if isinstance(loaded.get("targets"), list) and loaded["targets"]:
                    default_config["targets"] = loaded["targets"]
        except Exception:
            pass

    env_targets = []

    # 这里只读取两个上位机：COMMAND_TARGET_1 和 COMMAND_TARGET_2
    for idx in (1, 2):
        env_host = os.getenv(f"COMMAND_TARGET_{idx}_HOST", "").strip()
        env_port = os.getenv(f"COMMAND_TARGET_{idx}_PORT", "").strip()
        if env_host:
            env_targets.append({
                "name": f"上位机控制端{idx}",
                "host": env_host,
                "port": coerce_int(env_port, 9000)
            })

    if env_targets:
        default_config["targets"] = env_targets

    normalized = []

    for i, item in enumerate(default_config.get("targets", []), start=1):
        name = f"上位机控制端{i}"
        host = ""
        port = 9000

        if isinstance(item, str):
            value = item.strip()

            if value.startswith("tcp://"):
                value = value[6:]

            if ":" in value:
                host, port_s = value.rsplit(":", 1)
                port = coerce_int(port_s, 9000)
            else:
                host = value

        elif isinstance(item, dict):
            name = item.get("name") or f"上位机控制端{i}"
            host = (item.get("host") or "").strip()
            port = coerce_int(item.get("port"), 9000)

            legacy_url = (item.get("url") or item.get("endpoint") or "").strip()

            if not host and legacy_url:
                value = legacy_url

                if value.startswith("tcp://"):
                    value = value[6:]
                elif value.startswith("http://") or value.startswith("https://"):
                    value = value.split("://", 1)[1].split("/", 1)[0]

                if ":" in value:
                    host, port_s = value.rsplit(":", 1)
                    port = coerce_int(port_s, 9000)
                else:
                    host = value

        host = host.strip()

        if host:
            normalized.append({
                "name": name,
                "host": host,
                "port": int(port),
                "ack_timeout_seconds": float(
                    default_config.get("ack_timeout_seconds", 0.35) or 0.35
                )
            })

    default_config["protocol"] = "tcp_plain"

    # 最终强制只给两个上位机发
    default_config["targets"] = normalized[:2]

    return default_config


def send_control_signal_to_target(target: Dict[str, Any], timeout: float) -> Dict[str, Any]:
    import socket

    host = str(target["host"]).strip()
    port = int(target["port"])

    # 这里只发送 OK
    message = "OK"

    started = time.time()

    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.settimeout(timeout)

            # 发送 OK 到上位机控制端
            sock.sendall(message.encode("utf-8"))

            response_body: Any = ""
            ack_timeout = float(target.get("ack_timeout_seconds", 0.35) or 0.35)

            try:
                sock.settimeout(ack_timeout)
                response_body = sock.recv(4096).decode("utf-8", errors="replace").strip()
            except Exception:
                response_body = ""

            return {
                "name": target.get("name", "上位机控制端"),
                "protocol": "tcp_plain",
                "host": host,
                "port": port,
                "ok": True,
                "elapsed_ms": int((time.time() - started) * 1000),
                "message": message,
                "response": response_body,
            }

    except Exception as exc:
        return {
            "name": target.get("name", "上位机控制端"),
            "protocol": "tcp_plain",
            "host": host,
            "port": port,
            "ok": False,
            "elapsed_ms": int((time.time() - started) * 1000),
            "message": message,
            "error": str(exc),
        }