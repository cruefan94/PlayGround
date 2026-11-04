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

## ASHFALL — Salvage Protocol

A post-apocalyptic idle game about mining the ruins, rebuilding salvage rigs, and
fighting through six wasteland territories. Everything runs in the browser with
plain HTML, CSS, and JavaScript — no build step, no external assets.

### Run it

```bash
python3 -m http.server 3002
# open http://localhost:3002
```

### Controls

- **Mine:** click/tap the shaft or press **Space** (or use **STRIKE VEIN**).
- **Fight:** click/tap the arena, press **F**, or let **AUTO** handle attacks.
- Mobile uses the **MINE / FORGE / FIGHT** tab bar; desktop shows all three panels.

### Systems

- **Ore & drilling:** scrap, iron, copper, titanium, uranium and void shards.
  Pickaxe upgrades and drill rigs raise active and passive yield.
- **Caps (money):** earned from kills and spent on pickaxe, drills, crew, gear
  and outfits. Base cap income also gets a small trickle from salvage.
- **Combat:** pipe axe, rad plate and stim kit upgrades; six zones with waves,
  bosses every 10 waves, auto-attack and knockout/reboot timers.
- **RPG levels:** XP from mining and kills. Each level grants +3 attribute
  points (**STR / VIT / AGI / LUK**) and every third level grants a perk choice
  from eight stackable perks (max rank 5). Respec costs caps.
- **Outfits:** Glowcap Rebreather (crit/XP), Slagwalker Duster (HP/resist) and
  Warden Charm (caps/ore), each with 15 craftable tiers that change the
  miner's appearance.
- **Prestige:** defeat Warden Prime, then overload the reactor for permanent
  shards (+10% ore, +8% damage each). Prestige keeps level, XP, attributes,
  perks, outfits and shards; it wipes ore, caps, rigs, gear and territories.

### Assumptions

- Caps are the single money currency requested for upgrades.
- Progress autosaves to `localStorage` (`ashfall.save.v1`); offline drills earn
  at 50% for up to 8 hours, but combat pauses while the tab is closed.
- Sound uses a tiny WebAudio synth and starts after the first user gesture.

