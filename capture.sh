#!/usr/bin/env bash
# Capture rendered desktop + mobile screenshots of CAPTURE_URL into CAPTURE_DIR.
# Exit codes: 0 ok · 75 temporary navigation/browser infrastructure failure (retryable) · 1 script/render defect.
# Timing note: every command below is wrapped with /usr/bin/time -p.
set -euo pipefail
cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"

T() { /usr/bin/time -p "$@"; }

: "${CAPTURE_URL:?CAPTURE_URL is required}"
: "${CAPTURE_DIR:?CAPTURE_DIR is required}"

T mkdir -p "$CAPTURE_DIR"
# capture payload lives OUTSIDE the source tree (evidence dir), keep source untouched
CAPTURE_JS="$CAPTURE_DIR/omgithub-capture.mjs"
# pass the project root so the payload can resolve node_modules inside PROJECT_DIR
export CAPTURE_URL CAPTURE_DIR CAPTURE_JS CAPTURE_PROJECT="$PROJECT_DIR"

cat > "$CAPTURE_JS" <<'EOF'
import { createRequire } from 'module';

// resolve playwright-core from the project's node_modules regardless of payload location
const projectRequire = createRequire((process.env.CAPTURE_PROJECT || process.env.PWD) + '/package.json');
const { chromium } = projectRequire('playwright-core');

const url = process.env.CAPTURE_URL, dir = process.env.CAPTURE_DIR;
const CHROME = '/usr/bin/chromium';
const shots = [
  ['final-desktop.png', { width: 1280, height: 800 }],
  ['final-mobile.png', { width: 390, height: 844 }],
];

function fail(kind, msg, code) {
  console.log(`[capture] ${kind}: ${msg}`);
  process.exit(code);
}

let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
} catch (e) {
  fail('temporary', 'browser infrastructure failed to launch: ' + e.message, 75);
}
try {
  for (const [name, vp] of shots) {
    const page = await browser.newPage({ viewport: vp });
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    } catch (e) {
      // one retry on navigation flake — still a temporary failure if it repeats
      try { await page.goto(url, { waitUntil: 'load', timeout: 45000 }); }
      catch (e2) { fail('temporary', 'navigation failed: ' + e2.message, 75); }
    }
    try {
      await page.waitForFunction(
        () => !!document.querySelector('canvas#cv'),
        { timeout: 15000 }
      );
      await page.waitForTimeout(1500); // allow menu canvas / Huey animation to decorate
      const ok = await page.evaluate(() => {
        const cv = document.querySelector('canvas#cv');
        const on = document.querySelectorAll('.screen.on').length > 0;
        return cv && cv.getContext && on;
      });
      if (!ok) fail('defect', 'page loaded but game UI did not render (canvas/screens missing)', 1);
      await page.screenshot({ path: dir + '/' + name, type: 'png' });
      await page.close();
      console.log(`[capture] wrote ${name} (${vp.width}x${vp.height})`);
    } catch (e) {
      const t = e && e.message && e.message.includes('Timeout') ? 'temporary' : 'defect';
      fail(t, 'render/capture failed: ' + e.message, t === 'temporary' ? 75 : 1);
    }
  }
  console.log('[capture] all views captured.');
  process.exit(0);
} catch (e) {
  fail('temporary', 'browser failure: ' + e.message, 75);
} finally {
  if (browser) { try { await browser.close(); } catch {} }
}
EOF

# import playwright-core from the project's node_modules (already provisioned via package.json)
T node "$CAPTURE_JS"
