import {
  LAYERS, ZONES, ORES, ORE_ORDER, STIM_MAX, PERKS, ATTRIBUTES, OUTFITS,
  fmt, costLabel, canAfford, spend, makeEnemy, playerStats,
  playerAttackInterval, layerMaxHp, strikeYield, pickPower,
  drillRate, overloadGain, xpNeeded, xpMultiplier, outfitCost, outfitLevel,
  attrLevel, perkRank, pickaxeCost, crewCost, drillCost,
  weaponCost, armorCost, stimCost,
} from './data.js';
import { loadState, persist, wipeSave, offlineReport, resetProgress, formatGainList } from './state.js';
import { GameAudio } from './audio.js';
import { MineRenderer, CombatRenderer } from './render.js';
import { UI } from './ui.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    const loaded = loadState();
    this.state = loaded.state;
    this.fresh = loaded.fresh;
    this.logs = [];
    this.audio = new GameAudio(this.state.sound);
    this.nextSpawn = 0;
    this.lastStrike = 0;
    this.lastTick = performance.now();
    this.lastUI = 0;
    this.lastSave = performance.now();

    const offline = offlineReport(this.state);
    this.setupEnemy(performance.now());

    this.mineRenderer = new MineRenderer($('mineCanvas'), this);
    this.combatRenderer = new CombatRenderer($('combatCanvas'), this);
    this.ui = new UI(this);
    this.ui.updateSoundButton();

    this.seedLog();
    if (offline) this.showOffline(offline);
    else if (this.fresh) {
      this.log('Rig online. Strike the vein and rebuild. The wastes are listening.', 'good');
    } else {
      this.log('Rig restored from last session.', 'good');
    }

    this.bindGlobal();
    this.tick = this.tick.bind(this);
    setInterval(() => this.tick(performance.now()), 100);
    setInterval(() => this.ui.render(), 150);
    this.saveNow();
  }

  setupEnemy(now) {
    const c = this.state.combat;
    if (!c.enemy || !c.enemy.hp || c.enemy.hp <= 0) {
      const wave = c.waves[c.zone] || 1;
      c.enemy = makeEnemy(c.zone, wave);
    }
    c.enemy.nextAttack = now + c.enemy.interval * 0.9;
    c.nextPlayerAttack = 0;
    const stats = playerStats(this.state);
    c.hp = Math.min(stats.maxHp, Math.max(1, c.hp || stats.maxHp));
    if (c.hp <= 0) {
      c.hp = stats.maxHp;
      c.deadUntil = 0;
    }
  }

  seedLog() {}

  bindGlobal() {
    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') this.ui.closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.ui.closeModal();
    });
    window.addEventListener('pagehide', () => this.saveNow());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.saveNow();
      else this.lastTick = performance.now();
    });
  }

  tick(now) {
    const dt = Math.min(1.5, Math.max(0, (now - this.lastTick) / 1000));
    this.lastTick = now;
    this.passiveGain(dt);
    this.tickCombat(now, dt);
    if (now - this.lastUI > 150) {
      this.ui.render();
      this.lastUI = now;
    }
    if (now - this.lastSave > 5000) {
      this.saveNow();
      this.lastSave = now;
    }
  }

  passiveGain(dt) {
    const s = this.state;
    for (let i = 0; i < LAYERS.length; i++) {
      const count = s.drills[i] || 0;
      if (!count) continue;
      const ore = LAYERS[i].ore;
      const amount = count * drillRate(s, i) * dt;
      s.ores[ore] += amount;
      s.stats.totalMined += amount;
    }
  }

  /* ── mining ──────────────────────────────────────────────── */
  strikeMine() {
    const now = performance.now();
    if (now - this.lastStrike < 45) return;
    this.lastStrike = now;
    const s = this.state;
    const i = s.layer;
    const layer = LAYERS[i];
    const yieldAmt = strikeYield(s, i);
    const crit = Math.random() < 0.07;
    const gained = yieldAmt * (crit ? 3 : 1);
    s.ores[layer.ore] += gained;
    s.stats.totalMined += gained;
    s.stats.clicks = (s.stats.clicks || 0) + 1;

    const dmg = pickPower(s);
    const maxHp = layerMaxHp(s, i);
    s.veinHp[i] = (s.veinHp[i] ?? maxHp) - dmg;
    let broke = false;
    if (s.veinHp[i] <= 0) {
      broke = true;
      const bonus = yieldAmt * 10;
      s.ores[layer.ore] += bonus;
      s.stats.totalMined += bonus;
      s.nodes[i] = (s.nodes[i] || 0) + 1;
      s.veinHp[i] = layerMaxHp(s, i);
      this.mineRenderer.veinBreak();
      this.audio.shatter();
      this.log(`Vein shattered. Richness ×${(1 + 0.04 * s.nodes[i]).toFixed(2)} · +${fmt(bonus)} ${ORES[layer.ore].name}.`, 'good');
    } else {
      this.audio[crit ? 'crit' : 'strike']();
    }
    this.mineRenderer.strike();
    this.mineRenderer.floatOre(Math.round(gained), layer.ore, crit);
    if (broke) {
      this.mineRenderer.floatOre(Math.round(yieldAmt * 10), layer.ore, true);
      this.ui.toast(`VEIN SHATTERED · +${fmt(Math.round(yieldAmt * 10))} ${ORES[layer.ore].name}`, 'good');
    } else if (crit) {
      this.ui.toast(`CRITICAL SEAM · +${fmt(Math.round(gained))} ${ORES[layer.ore].name}`, 'good');
    }
    if ((s.stats.clicks || 0) === 1) {
      this.log('First swing. Keep the pick moving — the vein gives more the deeper you go.', 'good');
    }
    this.gainXp(1 + (broke ? 12 + i * 2 : 0));
    this.ui.render();
  }

  /* ── RPG progression ─────────────────────────────────────── */
  gainXp(amount) {
    const s = this.state;
    const mult = xpMultiplier(s);
    s.xp = (s.xp || 0) + Math.max(0, amount) * mult;
    let levels = 0;
    let perks = 0;
    let guard = 0;
    while (s.xp >= xpNeeded(s.level || 1) && guard++ < 100) {
      s.xp -= xpNeeded(s.level || 1);
      s.level = (s.level || 1) + 1;
      s.points = (s.points || 0) + 3;
      levels += 1;
      if (s.level % 3 === 0) {
        s.perkPoints = (s.perkPoints || 0) + 1;
        perks += 1;
      }
    }
    if (levels > 0) {
      const stats = playerStats(s);
      s.combat.hp = stats.maxHp;
      this.audio.levelUp();
      this.combatRenderer.levelUp();
      const perkText = perks > 0 ? ` · +${perks} PERK CHOICE${perks > 1 ? 'S' : ''}` : '';
      this.ui.toast(`LEVEL ${s.level} · +${levels * 3} ATTRIBUTE POINTS${perkText}`, 'lore');
      this.log(`Survivor reached level ${s.level}. +${levels * 3} attribute points${perks > 0 ? ' and a perk choice' : ''}.`, 'good');
      this.ui.render();
      this.saveNow();
    }
  }

  spendPoint(id) {
    const s = this.state;
    const attr = ATTRIBUTES.find((a) => a.id === id);
    if (!attr) return;
    if ((s.points || 0) < 1) {
      this.ui.toast('No attribute points — level up to earn more.', 'bad');
      this.audio.error();
      return;
    }
    s.attributes[id] = attrLevel(s, id) + 1;
    s.points -= 1;
    const stats = playerStats(s);
    s.combat.hp = Math.min(stats.maxHp, s.combat.hp + (id === 'vit' ? 8 : 0));
    this.audio.tone({ freq: 440, end: 620, dur: 0.09, type: 'triangle', vol: 0.17 });
    this.ui.render();
    this.saveNow();
  }

  respec() {
    const s = this.state;
    const spent = ATTRIBUTES.reduce((sum, a) => sum + attrLevel(s, a.id), 0);
    if (spent === 0) {
      this.ui.toast('No attribute points to refund.', 'bad');
      return;
    }
    const cost = 100 + spent * 10;
    if (s.caps < cost) {
      this.audio.error();
      this.ui.toast(`Respec costs ${fmt(cost)} caps (money).`, 'bad');
      return;
    }
    s.caps -= cost;
    s.points = (s.points || 0) + spent;
    s.attributes = { str: 0, vit: 0, agi: 0, luk: 0 };
    const stats = playerStats(s);
    s.combat.hp = Math.min(stats.maxHp, s.combat.hp);
    this.audio.buy();
    this.ui.toast(`Attributes reset · ${spent} points refunded · −${fmt(cost)} caps`, 'good');
    this.log(`Paid ${fmt(cost)} caps to reset ${spent} attribute points.`, '');
    this.ui.render();
    this.saveNow();
  }

  openPerks() {
    const s = this.state;
    const points = s.perkPoints || 0;
    if (points < 1) {
      const owned = PERKS.filter((p) => perkRank(s, p.id) > 0);
      const chips = owned.map((p) => `<span class="perk-chip">${p.name} ×${perkRank(s, p.id)}</span>`).join('');
      this.ui.openModal({
        eyebrow: 'SURVIVOR PERKS',
        title: 'Perk ledger',
        body: `
          <p>You earn <strong>1 perk choice every 3 levels</strong>. You have <strong>${points}</strong> unspent.</p>
          ${owned.length ? `<div class="perk-owned">${chips}</div>` : '<p>No perks chosen yet.</p>'}
          <p>Cut down more of the wasteland to earn the next choice.</p>`,
        actions: [{ label: 'CLOSE', kind: '' }],
      });
      return;
    }
    const available = PERKS.filter((p) => perkRank(s, p.id) < p.max);
    if (!available.length) {
      this.ui.openModal({
        eyebrow: 'SURVIVOR PERKS',
        title: 'Every perk mastered',
        body: '<p>You have learned every trick the wastes can teach.</p>',
        actions: [{ label: 'CLOSE', kind: '' }],
      });
      return;
    }
    const pool = [...available].sort(() => Math.random() - 0.5).slice(0, 3);
    const body = `
      <p>Choose 1 of 3. ${points} choice${points > 1 ? 's' : ''} available.</p>
      <div class="perk-choice">
        ${pool.map((p) => `
          <div class="perk-option">
            <strong>${p.name}<span>RANK ${perkRank(s, p.id)}/${p.max}</span></strong>
            <span>${p.desc}</span>
          </div>`).join('')}
      </div>
      <p>Perks are permanent for this survivor, even through a core overload.</p>`;
    this.ui.openModal({
      eyebrow: 'SURVIVOR PERKS',
      title: 'Choose a perk',
      body,
      actions: pool.map((p) => ({
        label: `TAKE ${p.name.toUpperCase()}`,
        kind: '',
        onClick: () => this.choosePerk(p.id),
      })),
    });
  }

  choosePerk(id) {
    const s = this.state;
    const perk = PERKS.find((p) => p.id === id);
    if (!perk || (s.perkPoints || 0) < 1) return;
    const rank = perkRank(s, id);
    if (rank >= perk.max) {
      this.ui.toast(`${perk.name} is already maxed.`, 'bad');
      return;
    }
    s.perks[id] = rank + 1;
    s.perkPoints -= 1;
    this.audio.levelUp();
    this.ui.toast(`PERK ACQUIRED · ${perk.name} ×${rank + 1}`, 'lore');
    this.log(`${perk.name} rank ${rank + 1} learned. ${perk.desc}`, 'lore');
    this.ui.render();
    this.saveNow();
  }

  buyOutfit(index) {
    const s = this.state;
    const outfit = OUTFITS[index];
    if (!outfit) return;
    const lvl = outfitLevel(s, outfit.id);
    if (lvl >= outfit.max) {
      this.ui.toast(`${outfit.name} is already max tier.`, 'bad');
      return;
    }
    const cost = outfitCost(outfit, lvl);
    if (!canAfford(s, cost)) return this.deny(cost);
    const before = playerStats(s);
    spend(s, cost);
    s.outfits[outfit.id] = lvl + 1;
    const after = playerStats(s);
    s.combat.hp = Math.min(after.maxHp, s.combat.hp + Math.max(0, after.maxHp - before.maxHp));
    this.audio.buy();
    const verb = lvl === 0 ? 'Crafted' : 'Upgraded';
    this.ui.toast(`${verb} ${outfit.name} · Lv.${lvl + 1}`, 'good');
    this.log(`${outfit.name} Lv.${lvl + 1} equipped. ${outfit.effect(lvl + 1)}.`, 'good');
    if (outfit.id === 'rebreather' && lvl === 0) this.ui.toast('Rebreather online — better crits and XP gain.', 'good');
    this.ui.render();
    this.saveNow();
  }

  selectLayer(index) {
    const s = this.state;
    if (index < 0 || index >= LAYERS.length) return;
    if (index < s.layersUnlocked) {
      if (s.layer !== index) {
        s.layer = index;
        this.log(`Descended to ${LAYERS[index].name}.`, '');
        this.ui.render();
      }
      return;
    }
    if (index !== s.layersUnlocked) {
      this.ui.toast('Open the earlier shafts first.', 'bad');
      this.audio.error();
      return;
    }
    const layer = LAYERS[index];
    const req = layer.unlock;
    if (s.pickaxe < req.pickaxe) {
      this.ui.toast(`Requires pickaxe Lv.${req.pickaxe}. You have Lv.${s.pickaxe}.`, 'bad');
      this.audio.error();
      return;
    }
    if (!canAfford(s, req.ore)) {
      this.ui.toast(`Need ${costLabel(req.ore)} to break through.`, 'bad');
      this.audio.error();
      return;
    }
    spend(s, req.ore);
    s.layersUnlocked = index + 1;
    s.layer = index;
    this.audio.buy();
    this.ui.toast(`NEW SHAFT · ${layer.name}`, 'good');
    this.log(`${layer.name} opened at ${layer.depth}m. ${layer.blurb}`, 'good');
    this.ui.render();
    this.saveNow();
  }

  buyPickaxe() {
    const s = this.state;
    const cost = pickaxeCost(s.pickaxe);
    if (!canAfford(s, cost)) return this.deny(cost);
    spend(s, cost);
    s.pickaxe += 1;
    this.audio.buy();
    this.log(`Pickaxe upgraded to Lv.${s.pickaxe}. Vein damage ${fmt(pickPower(s), 1)}.`, 'good');
    if (s.pickaxe === 3) this.ui.toast('Pickaxe Lv.3 — Rust Flats can be opened.', 'good');
    this.ui.render();
  }

  buyCrew() {
    const s = this.state;
    const cost = crewCost(s.crew);
    if (!canAfford(s, cost)) return this.deny(cost);
    spend(s, cost);
    s.crew += 1;
    this.audio.buy();
    this.ui.toast(`Survivor ${s.crew} joined · ore yield +${s.crew * 8}%`, 'good');
    this.log(`Crew expanded to ${s.crew}. Every ore source is ${s.crew * 8}% richer.`, 'good');
    this.ui.render();
  }

  buyDrill(index) {
    const s = this.state;
    if (index < 0 || index >= s.layersUnlocked) {
      this.ui.toast('That shaft is not open yet.', 'bad');
      this.audio.error();
      return;
    }
    const cost = drillCost(index, s.drills[index] || 0);
    if (!canAfford(s, cost)) return this.deny(cost);
    spend(s, cost);
    s.drills[index] = (s.drills[index] || 0) + 1;
    this.audio.buy();
    const layer = LAYERS[index];
    this.log(`Drill rig ${s.drills[index]} online in ${layer.name} · +${fmt(drillRate(s, index), 2)} ${ORES[layer.ore].name}/s.`, 'good');
    this.ui.render();
  }

  buyWeapon() {
    const s = this.state;
    const cost = weaponCost(s.combat.gear.weapon);
    if (!canAfford(s, cost)) return this.deny(cost);
    spend(s, cost);
    s.combat.gear.weapon += 1;
    this.audio.buy();
    const stats = playerStats(s);
    this.log(`Pipe axe reforged. Attack ${fmt(stats.attack, 1)}.`, 'good');
    this.ui.render();
  }

  buyArmor() {
    const s = this.state;
    const cost = armorCost(s.combat.gear.armor);
    if (!canAfford(s, cost)) return this.deny(cost);
    const oldMax = playerStats(s).maxHp;
    spend(s, cost);
    s.combat.gear.armor += 1;
    const stats = playerStats(s);
    s.combat.hp = Math.min(stats.maxHp, s.combat.hp + (stats.maxHp - oldMax));
    this.audio.buy();
    this.log(`Rad plate fitted. HP ${fmt(stats.maxHp)} · ${Math.round(stats.defense * 100)}% resist.`, 'good');
    this.ui.render();
  }

  buyStim() {
    const s = this.state;
    if (s.combat.gear.stim >= STIM_MAX) {
      this.ui.toast('Stim kit is already at max tier.', 'bad');
      return;
    }
    const cost = stimCost(s.combat.gear.stim);
    if (!canAfford(s, cost)) return this.deny(cost);
    spend(s, cost);
    s.combat.gear.stim += 1;
    this.audio.buy();
    const stats = playerStats(s);
    this.ui.toast(`Stim kit built · +${stats.healPerKill} HP per kill`, 'good');
    this.log(`Stim kit rebuilt. Heals ${stats.healPerKill} HP after each kill; reboot time ${stats.deathMs / 1000}s.`, 'good');
    this.ui.render();
  }

  deny(cost) {
    this.audio.error();
    this.ui.toast(`Not enough salvage — need ${costLabel(cost)}.`, 'bad');
  }

  /* ── combat ──────────────────────────────────────────────── */
  tickCombat(now, dt) {
    const s = this.state;
    const c = s.combat;
    const stats = playerStats(s);

    if (c.deadUntil > 0) {
      if (now >= c.deadUntil) {
        c.deadUntil = 0;
        c.hp = stats.maxHp;
        c.enemy = makeEnemy(c.zone, c.waves[c.zone]);
        c.enemy.nextAttack = now + c.enemy.interval;
        c.nextPlayerAttack = 0;
        this.nextSpawn = 0;
        this.combatRenderer.respawn();
        this.log('Reboot complete. Back on your feet.', '');
      }
      return;
    }

    if (!c.enemy) {
      if (now >= this.nextSpawn) {
        c.enemy = makeEnemy(c.zone, c.waves[c.zone]);
        c.enemy.nextAttack = now + c.enemy.interval * 0.9;
      } else {
        return;
      }
    }

    const enemy = c.enemy;
    c.hp = Math.min(stats.maxHp, c.hp + stats.maxHp * 0.007 * dt);

    if (c.auto && now >= (c.nextPlayerAttack || 0)) this.attack(now, true);

    if (c.enemy && now >= (c.enemy.nextAttack || 0) && c.deadUntil === 0) {
      const live = c.enemy;
      live.nextAttack = now + live.interval;
      this.combatRenderer.enemyAttack();
      this.audio.hurt();
      const dmg = live.dmg * (1 - stats.defense);
      c.hp -= dmg;
      this.combatRenderer.hurtNumber(dmg);
      this.combatRenderer.playerHit();
      if (c.hp <= 0) this.playerDied(now, stats);
    }
  }

  attack(now = performance.now(), auto = false) {
    const s = this.state;
    const c = s.combat;
    if (c.deadUntil > 0 || !c.enemy) return;
    if (now < (c.nextPlayerAttack || 0)) return;
    c.nextPlayerAttack = now + playerAttackInterval(s);
    const stats = playerStats(s);
    const crit = Math.random() < stats.crit;
    const dmg = stats.attack * (0.9 + Math.random() * 0.2) * (crit ? 1.9 : 1);
    c.enemy.hp -= dmg;
    this.combatRenderer.playerAttack();
    this.combatRenderer.enemyHit();
    this.combatRenderer.damageNumber(dmg, crit);
    if (crit) this.audio.crit(); else this.audio.hit();

    if (c.enemy.hp <= 0) this.killEnemy(now, stats);
    this.ui.render();
  }

  killEnemy(now, stats) {
    const s = this.state;
    const c = s.combat;
    const enemy = c.enemy;
    const zone = ZONES[c.zone];
    const caps = Math.max(1, Math.round(enemy.caps * (stats.capsMult || 1)));
    const oreAmt = Math.max(1, Math.round(enemy.oreAmt * (stats.oreMult || 1)));
    const xp = enemy.xp || 5;
    s.caps += caps;
    s.ores[enemy.ore] = (s.ores[enemy.ore] || 0) + oreAmt;
    s.stats.totalCaps = (s.stats.totalCaps || 0) + caps;
    s.stats.totalMined += oreAmt;
    s.stats.kills = (s.stats.kills || 0) + 1;
    s.combat.hp = Math.min(stats.maxHp, s.combat.hp + stats.healPerKill);
    c.waves[c.zone] = (c.waves[c.zone] || 1) + 1;

    this.combatRenderer.enemyKilled(c.zone, enemy.boss);
    this.audio.kill();
    this.gainXp(xp);
    if (enemy.boss) {
      this.ui.toast(`${enemy.name} DOWN · +${fmt(caps)} caps · +${xp} XP`, 'good');
      this.log(`${enemy.name} fell. +${fmt(caps)} caps · +${fmt(oreAmt)} ${ORES[enemy.ore].name} · +${xp} XP.`, 'good');
      this.audio.overload();
      if (c.zone === ZONES.length - 1) {
        c.primeKills += 1;
        this.log('Warden Prime is dead. The reactor core is exposed. You can overload it in the FORGE.', 'lore');
        this.ui.toast('CORE CHARGED · OVERLOAD AVAILABLE IN FORGE', 'lore');
      }
    } else {
      this.log(`${enemy.name} down · +${fmt(caps)} caps · +${fmt(oreAmt)} ${ORES[enemy.ore].name} · +${xp} XP.`, '');
    }
    if (c.waves[c.zone] % 10 === 1 && c.waves[c.zone] > 1) {
      this.log(`Wave ${c.waves[c.zone]} in ${zone.name}. Something bigger is coming.`, 'alert');
    }
    c.enemy = null;
    this.nextSpawn = now + 700;
    this.ui.render();
    this.saveNow();
  }

  playerDied(now, stats) {
    const s = this.state;
    const c = s.combat;
    c.hp = 0;
    c.deadUntil = now + stats.deathMs;
    c.enemy = null;
    this.nextSpawn = now + stats.deathMs + 300;
    this.combatRenderer.playerDied();
    this.audio.death();
    this.log(`Knocked out in ${ZONES[c.zone].name}. Reboot in ${(stats.deathMs / 1000).toFixed(1)}s.`, 'alert');
    this.ui.toast('FLATLINED · AUTO-REBOOT IN ' + Math.ceil(stats.deathMs / 1000) + 's', 'bad');
    this.ui.render();
  }

  toggleAuto() {
    const c = this.state.combat;
    c.auto = !c.auto;
    this.audio.tone({ freq: c.auto ? 520 : 280, dur: 0.08, type: 'triangle', vol: 0.16 });
    this.log(`Auto-attack ${c.auto ? 'engaged' : 'disengaged'}.`, '');
    this.ui.render();
    this.saveNow();
  }

  selectZone(index) {
    const s = this.state;
    const c = s.combat;
    if (index < 0 || index >= ZONES.length) return;
    if (index < c.unlocked) {
      if (index === c.zone) return;
      c.zone = index;
      c.enemy = makeEnemy(index, c.waves[index]);
      c.enemy.nextAttack = performance.now() + c.enemy.interval;
      c.nextPlayerAttack = performance.now() + 300;
      this.combatRenderer.enemyKey = '';
      this.audio.buy();
      this.log(`Travelled to ${ZONES[index].name}. Wave ${c.waves[index]}.`, '');
      this.ui.render();
      return;
    }
    if (index !== c.unlocked) {
      this.ui.toast('Secure the earlier sectors first.', 'bad');
      this.audio.error();
      return;
    }
    const zone = ZONES[index];
    const req = zone.unlock;
    const cost = { caps: req.caps, ...req.ore };
    if (!canAfford(s, cost)) {
      this.ui.toast(`Need ${costLabel(cost)} to secure ${zone.name}.`, 'bad');
      this.audio.error();
      return;
    }
    spend(s, cost);
    c.unlocked = index + 1;
    c.zone = index;
    c.enemy = makeEnemy(index, c.waves[index]);
    c.enemy.nextAttack = performance.now() + c.enemy.interval;
    c.nextPlayerAttack = performance.now() + 300;
    this.combatRenderer.enemyKey = '';
    this.audio.buy();
    this.ui.toast(`TERRITORY SECURED · ${zone.name}`, 'good');
    this.log(`${zone.name} secured. ${zone.enemies.join(', ')} now roam here.`, 'good');
    this.ui.render();
    this.saveNow();
  }

  /* ── meta ────────────────────────────────────────────────── */
  confirmOverload() {
    const s = this.state;
    if (s.combat.primeKills < 1) {
      this.ui.toast('Defeat Warden Prime before overloading the core.', 'bad');
      this.audio.error();
      return;
    }
    const gain = overloadGain(s);
    this.ui.openModal({
      eyebrow: 'REACTOR CONTROL',
      title: 'Overload the core?',
      body: `
        <p>The reactor will detonate. Your ore, caps, drills, pickaxe, crew, combat gear and territories will be <strong>wiped</strong>.</p>
        <p>You will gain <span class="gain">${gain} core shard${gain > 1 ? 's' : ''}</span> (now ${s.shards}, after ${s.shards + gain}). Each shard gives <strong>+10% ore yield</strong> and <strong>+8% damage</strong>, forever.</p>
        <p>Your <strong>survivor level, attributes, perks and outfits persist</strong> through the overload.</p>
        <p>This cannot be undone.</p>`,
      actions: [
        { label: 'CANCEL', kind: '' },
        { label: `DETONATE · +${gain} SHARDS`, kind: 'danger', onClick: () => this.doOverload(gain) },
      ],
    });
  }

  doOverload(gain) {
    const old = this.state;
    const next = resetProgress(old);
    next.shards = old.shards + gain;
    next.stats.detonations = (old.stats.detonations || 0) + 1;
    next.stats.startedAt = old.stats.startedAt;
    next.combat.primeKills = 0;
    this.state = next;
    this.nextSpawn = 0;
    this.setupEnemy(performance.now());
    this.combatRenderer.enemyKey = '';
    this.combatRenderer.respawn();
    this.mineRenderer.lastKey = '';
    this.audio.overload();
    this.ui.toast(`CORE DETONATED · +${gain} SHARDS · ${next.shards} total`, 'lore');
    this.log(`The core detonated. ${gain} shard${gain > 1 ? 's' : ''} recovered · permanent output +${Math.round(next.shards * 10)}%.`, 'lore');
    this.ui.render();
    this.saveNow();
  }

  confirmReset() {
    this.ui.openModal({
      eyebrow: 'EMERGENCY PROTOCOL',
      title: 'Wipe all progress?',
      body: '<p>This erases your save completely: ore, shards, upgrades, territories and stats. The wasteland will not remember you.</p>',
      actions: [
        { label: 'KEEP PLAYING', kind: '' },
        { label: 'WIPE SAVE', kind: 'danger', onClick: () => { wipeSave(); location.reload(); } },
      ],
    });
  }

  toggleSound() {
    this.state.sound = !this.state.sound;
    this.audio.setEnabled(this.state.sound);
    if (this.state.sound) this.audio.buy();
    this.ui.updateSoundButton();
    this.ui.toast(this.state.sound ? 'Sound enabled' : 'Sound muted', '');
    this.saveNow();
  }

  showOffline(report) {
    const rows = ORE_ORDER
      .filter((o) => report.gains[o] > 0)
      .map((o) => `<div class="loot-line"><span>${ORES[o].name}</span><span>+${fmt(report.gains[o], 1)}</span></div>`)
      .join('');
    const secs = report.seconds;
    const time = secs >= 3600 ? `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m` : `${Math.max(1, Math.floor(secs / 60))}m`;
    this.ui.openModal({
      eyebrow: 'OFFLINE REPORT',
      title: 'The rigs kept running.',
      body: `
        <p>You were gone for <strong>${time}</strong>. Your drills recovered ore at <strong>50%</strong> efficiency, capped at 8 hours.</p>
        ${rows}
        <p style="margin-top:10px">Combat does not run while the rig is unattended.</p>`,
      actions: [{ label: 'BACK TO WORK', kind: '' }],
    });
    this.log(`Offline rigs recovered ${formatGainList(report.gains)} over ${time}.`, 'good');
  }

  log(text, type = '') {
    if (this.ui) {
      this.ui.log(text, type);
      return;
    }
    this.logs.push({ id: this.logs.length + 1, text, type, at: Date.now() });
  }

  saveNow() {
    const ok = persist(this.state);
    if (ok) this.ui?.setSaveFlash();
    return ok;
  }
}

window.game = new Game();
