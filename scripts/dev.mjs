// Starts the app (Next dev) and the Council Room server together, so the room animation in the dashboard keeps working.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "dev"], { cwd: root, stdio: "inherit" });
// PORT is set explicitly: the app's PORT (3000) would otherwise be inherited and the room would bind the wrong port.
const room = spawn(process.execPath, [path.join(root, "council-room", "app", "server.mjs")], { cwd: root, stdio: "inherit", env: { ...process.env, PORT: "4730" } });

function stop(code = 0) {
  for (const p of [app, room]) if (!p.killed) p.kill();
  process.exit(code);
}

// The app is the main process. If the room stops (for example its port is already taken), the app keeps running and the Council Room page shows an offline notice.
app.on("exit", (code) => stop(code ?? 0));
room.on("exit", (code) => console.error(`Council Room server exited (code ${code}). The app is still running.`));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
