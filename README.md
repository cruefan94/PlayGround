# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/cruefan94/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/cruefan94/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/cruefan94/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/cruefan94/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/cruefan94/PlayGround).
- 🛠️ [Check build runs](https://github.com/cruefan94/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/cruefan94/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/cruefan94).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->

## NAM '68 — Operation Iron Triangle

A top-down Vietnam War wave shooter. No build steps — open `index.html` and play.

### Screens
- **Main menu** — animated Vietnam forest backdrop with a Huey flying a door-gunner M60 pass; **▶ Start Mission** launches round 1 immediately. A small **▲ Silent Raid into Cambodia** mode sits at the bottom: one covert raid grants two free loot packages of different grades (field papers + MACV-SOG black file), re-armed on a **12-hour cooldown** (shown as a timer on the button).
- **Barracks** ("Report for Duty") — name, skin, headwear, face camo, fatigues, boots, body armor.
- **Loadout** — assign owned weapons to PRIMARY [1] / SIDEARM [2] slots and pick worn armor.
- **S-4 Store** — 116 period weapons by class, armor and era clothing; purchases equippable in the Loadout screen.
- **Squad** — roster of human soldiers (US / ARVN / ROK Marines / Australian SAS) across 5 rank tiers (Private → Colonel); the Reinforcement Office processes transfer packages (1 gear item + 2 soldier transfers). 3 march-out slots; each soldier buffs your stats and fights beside you with a specialty trait (Belt-Fed Gunner, Tunnel Rat, Medic, Grenadier, RTO spotter…).
- Persistent **REQUISITION** ($ — starts at $80) chip shown top-right on every screen.

### Gameplay
- WASD move · mouse aim/click fire · R reload · 1/2 swap weapon · G grenade · Shift sprint · Esc pause.
- 4 rotating areas per round: village → rice paddies (water slows you — use the dikes) → dense jungle → open field.
- Boss battle every 10th round (4 rotating bosses, escalating by cycle).
- Difficulty, enemies and money rewards ramp each round; deaths keep gear, roster and requisition.

### Tech
- `index.html` + `js/data.js` (content data) + `js/game.js` (engine/UI). Vanilla JS + Canvas, WebAudio synth SFX, `localStorage` saves.
- Headless screenshot smoke test: `node test/shots.mjs /tmp/opencode` (needs `playwright-core` + Chromium).
