#!/usr/bin/env bash
# NAM '68 — static site startup: build dist/, publish deployment metadata, serve on PORT (foreground).
# Timing note: every command below is wrapped with /usr/bin/time -p (real/user/sys lines).
set -euo pipefail
cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"
BUILD_DONE="$PROJECT_DIR/dist/.built"

# per-command timing helper (matches starter `real/user/sys` style)
T() { /usr/bin/time -p "$@"; }

PORT="${PORT:-3000}"
OPENCODE_WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
export PORT OPENCODE_WEB_DIR
export PROJECT_DIR

# ---- 1) build: copy static sources into PROJECT_DIR/dist (no compile step needed) ----
T rm -rf "$PROJECT_DIR/dist"
T mkdir -p "$PROJECT_DIR/dist/js"
T cp "$PROJECT_DIR/index.html" "$PROJECT_DIR/dist/index.html"
T cp "$PROJECT_DIR"/js/*.js "$PROJECT_DIR/dist/js/"
/usr/bin/time -p touch "$BUILD_DONE"
echo "[start] built static site into $PROJECT_DIR/dist"

# ---- 2) deployment metadata for the controller/worker ----
T mkdir -p "$OPENCODE_WEB_DIR"
T node -e '
  const fs = require("fs");
  const out = {
    project: process.env.PROJECT_DIR,
    directory: process.env.PROJECT_DIR + "/dist",
  };
  fs.writeFileSync(process.env.OPENCODE_WEB_DIR + "/deployment-output.json", JSON.stringify(out, null, 2) + "\n");
  console.log("[start] deployment-output.json ->", process.env.OPENCODE_WEB_DIR);
'

# ---- 3) dependencies (static site: none to install; validate node runtime) ----
T node --version

# ---- 4) serve dist/ in the FOREGROUND on PORT ----
# Reuses a Python http.server; logs go to stdout (controller captures via STARTUP_LOG).
echo "[start] serving $PROJECT_DIR/dist on 0.0.0.0:$PORT"
cd "$PROJECT_DIR/dist"
case "${SERVER_BIN:-auto}" in
  auto|python3|"")
    T python3 -u -m http.server "$PORT" --bind 0.0.0.0
    ;;
  node)
    # fallback pure-node static server if python3 is ever unavailable
    T exec node -e '
      const http = require("http"), fs = require("fs"), path = require("path");
      const root = process.cwd(), port = +process.env.PORT || 3000;
      const mime = { html: "text/html", js: "text/javascript", css: "text/css", png: "image/png", jpg: "image/jpeg", json: "application/json" };
      http.createServer((req, res) => {
        let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
        const f = path.normalize(path.join(root, p));
        if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
        fs.readFile(f, (e, d) => {
          if (e) { res.writeHead(404); return res.end("not found"); }
          res.writeHead(200, { "Content-Type": mime[path.extname(f).slice(1)] || "application/octet-stream" });
          res.end(d);
        });
      }).listen(port, "0.0.0.0", () => console.log("[start] node server on :" + port));
    '
    ;;
esac
