import {
  ORES, ORE_ORDER, LAYERS, ZONES, STIM_MAX, OUTFITS, ATTRIBUTES, PERKS,
  fmt, fmtRate, costLabel, canAfford, pickPower, pickaxeCost, crewCost,
  drillCost, drillRate, weaponCost, armorCost, stimCost, playerStats,
  nodeRichness, layerMaxHp, strikeYield, overloadGain, playerAttackInterval,
  xpNeeded, outfitCost, outfitLevel, attrLevel, perkRank, levelHpMult, levelAtkMult,
} from './data.js';

const $ = (id) => document.getElementById(id);
const setText = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };

export class UI {
  constructor(game) {
    this.game = game;
    this.toastId = 0;
    this.lastLogId = -1;
    this.saveFlashUntil = 0;
    this.refs = {};
    this.buildResources();
    this.buildLayers();
    this.buildCards();
    this.buildAttributes();
    this.buildOutfits();
    this.buildDrills();
    this.buildZones();
    this.cacheRefs();
    this.bind();
    this.render();
  }

  get s() { return this.game.state; }

  buildResources() {
    const wrap = $('resources');
    this.resEls = {};
    const specs = [
      { key: 'caps', name: 'CAPS', color: '#e9c46a', cls: 'caps' },
      ...ORE_ORDER.map((key) => ({ key, name: ORES[key].name.toUpperCase(), color: ORES[key].color })),
      { key: 'shards', name: 'SHARDS', color: '#b98aff', cls: 'shards' },
    ];
    for (const spec of specs) {
      const chip = document.createElement('div');
      chip.className = `res-chip ${spec.cls || ''}`;
      chip.title = spec.name;
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.setProperty('--c', spec.color);
      const meta = document.createElement('span');
      meta.className = 'res-meta';
      const name = document.createElement('span');
      name.className = 'res-name';
      name.textContent = spec.name;
      const val = document.createElement('span');
      val.className = 'res-val';
      val.textContent = '0';
      const per = document.createElement('span');
      per.className = 'res-per';
      meta.append(name, val);
      chip.append(dot, meta, per);
      wrap.append(chip);
      this.resEls[spec.key] = { chip, val, per };
    }
  }

  buildLayers() {
    const wrap = $('layerStrip');
    this.layerEls = LAYERS.map((layer, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'layer-btn';
      btn.dataset.action = 'layer';
      btn.dataset.index = String(i);
      btn.innerHTML = `
        <span class="l-name"><i class="l-ore" style="--c:${layer.glow}"></i><span>${layer.short}</span></span>
        <span class="l-req"></span>`;
      wrap.append(btn);
      return { btn, req: btn.querySelector('.l-req') };
    });
  }

  buildCards() {
    const fmtCard = (id, icon, title) => `
      <button class="card" type="button" data-action="${id}" id="card-${id}">
        <span class="card-icon">${icon}</span>
        <span class="card-body">
          <span class="card-top"><span class="card-title">${title}</span><span class="card-lvl" data-lvl>LV.1</span></span>
          <span class="card-desc" data-desc></span>
          <span class="card-cost" data-cost></span>
        </span>
        <span class="card-cta" data-cta>UPGRADE</span>
      </button>`;

    $('toolCards').innerHTML = fmtCard('pickaxe', '⚒', 'PICKAXE') + fmtCard('crew', '☗', 'SURVIVOR CREW');
    $('gearCards').innerHTML = fmtCard('weapon', '⚔', 'PIPE AXE') + fmtCard('armor', '⛨', 'RAD PLATE') + fmtCard('stim', '✚', 'STIM KIT');

    this.cardEls = {};
    for (const id of ['pickaxe', 'crew', 'weapon', 'armor', 'stim']) {
      const card = $(`card-${id}`);
      this.cardEls[id] = {
        card,
        lvl: card.querySelector('[data-lvl]'),
        desc: card.querySelector('[data-desc]'),
        cost: card.querySelector('[data-cost]'),
        cta: card.querySelector('[data-cta]'),
      };
    }
  }

  buildAttributes() {
    const wrap = $('attrGrid');
    this.attrEls = {};
    for (const attr of ATTRIBUTES) {
      const row = document.createElement('div');
      row.className = 'attr-row';
      row.innerHTML = `
        <span class="a-key">${attr.key}</span>
        <span class="a-info">
          <span class="a-name">${attr.name}<b data-val>0</b></span>
          <span class="a-eff" data-eff></span>
        </span>
        <button class="attr-plus" type="button" data-action="attr" data-id="${attr.id}" aria-label="Add point to ${attr.name}">+</button>`;
      wrap.append(row);
      this.attrEls[attr.id] = {
        val: row.querySelector('[data-val]'),
        eff: row.querySelector('[data-eff]'),
        plus: row.querySelector('.attr-plus'),
      };
    }
  }

  buildOutfits() {
    const wrap = $('outfitCards');
    wrap.innerHTML = OUTFITS.map((outfit, i) => `
      <button class="card outfit-card" type="button" data-action="outfit" data-index="${i}" id="outfit-${outfit.id}">
        <span class="card-icon">${outfit.icon}</span>
        <span class="card-body">
          <span class="card-top"><span class="card-title">${outfit.name}</span><span class="card-lvl" data-lvl>0/${outfit.max}</span></span>
          <span class="card-desc" data-desc></span>
          <span class="card-cost" data-cost></span>
        </span>
        <span class="card-cta" data-cta>CRAFT</span>
      </button>`).join('');
    this.outfitEls = OUTFITS.map((outfit, i) => {
      const card = $(`outfit-${outfit.id}`);
      return {
        card,
        lvl: card.querySelector('[data-lvl]'),
        desc: card.querySelector('[data-desc]'),
        cost: card.querySelector('[data-cost]'),
        cta: card.querySelector('[data-cta]'),
      };
    });
  }

  buildDrills() {
    const wrap = $('drillList');
    this.drillEls = LAYERS.map((layer, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'drill-row';
      btn.dataset.action = 'drill';
      btn.dataset.index = String(i);
      btn.innerHTML = `
        <span class="drill-dot" style="--c:${layer.glow}"></span>
        <span class="drill-name">${ORES[layer.ore].name} Drill<small></small></span>
        <span class="drill-buy"><span data-cost></span><b>BUY</b></span>`;
      wrap.append(btn);
      return { btn, name: btn.querySelector('.drill-name'), sub: btn.querySelector('.drill-name small'), cost: btn.querySelector('[data-cost]'), buy: btn.querySelector('.drill-buy') };
    });
  }

  buildZones() {
    const wrap = $('zoneList');
    this.zoneEls = ZONES.map((zone, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'zone-row';
      btn.dataset.action = 'zone';
      btn.dataset.index = String(i);
      btn.innerHTML = `
        <span>
          <span class="z-name"><i class="z-dot"></i>${zone.name}</span>
          <span class="z-sub"></span>
        </span>
        <span class="z-status"></span>`;
      wrap.append(btn);
      return { btn, name: btn.querySelector('.z-name'), sub: btn.querySelector('.z-sub'), status: btn.querySelector('.z-status') };
    });
  }

  cacheRefs() {
    const r = this.refs;
    r.layerBadge = $('layerBadge');
    r.veinLabel = $('veinLabel');
    r.richnessLabel = $('richnessLabel');
    r.veinHpText = $('veinHpText');
    r.veinBar = $('veinBar');
    r.strikeSub = $('strikeSub');
    r.pickPower = $('pickPower');
    r.autoYield = $('autoYield');
    r.depthText = $('depthText');
    r.objectiveText = $('objectiveText');
    r.sceneTip = $('sceneTip');
    r.drillRateTotal = $('drillRateTotal');
    r.crewBadge = $('crewBadge');
    r.coreDesc = $('coreDesc');
    r.overloadBtn = $('overloadBtn');
    r.enemyName = $('enemyName');
    r.wavePill = $('wavePill');
    r.enemyBar = $('enemyBar');
    r.playerBar = $('playerBar');
    r.playerHpText = $('playerHpText');
    r.deathBanner = $('deathBanner');
    r.autoBtn = $('autoBtn');
    r.autoLabel = $('autoLabel');
    r.attackBtn = $('attackBtn');
    r.atkStat = $('atkStat');
    r.defStat = $('defStat');
    r.killStat = $('killStat');
    r.zoneBadge = $('zoneBadge');
    r.zoneProgress = $('zoneProgress');
    r.tickerText = $('tickerText');
    r.ticker = $('ticker');
    r.playStats = $('playStats');
    r.saveState = $('saveState');
    r.soundBtn = $('soundBtn');
    r.topLevel = $('topLevel');
    r.topPoints = $('topPoints');
    r.forgeLevel = $('forgeLevel');
    r.levelXpBar = $('levelXpBar');
    r.levelXpText = $('levelXpText');
    r.levelBonus = $('levelBonus');
    r.levelPoints = $('levelPoints');
    r.perkBtn = $('perkBtn');
    r.perkBadge = $('perkBadge');
    r.perkLineText = $('perkLineText');
    r.respecBtn = $('respecBtn');
    r.outfitSummary = $('outfitSummary');
    r.playerLevel = $('playerLevel');
    r.playerXpBar = $('playerXpBar');
    r.playerXpText = $('playerXpText');
  }

  bind() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (target) {
        const action = target.dataset.action;
        const index = Number(target.dataset.index || 0);
        this.dispatch(action, index, target);
        return;
      }
      const tab = e.target.closest('[data-tab]');
      if (tab) {
        this.setTab(tab.dataset.tab);
        return;
      }
      if (e.target.closest('#soundBtn')) {
        this.game.toggleSound();
        return;
      }
      if (e.target.closest('#resetBtn')) {
        this.game.confirmReset();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (document.getElementById('app').dataset.tab === 'mine' || window.innerWidth > 980) this.game.strikeMine();
      } else if (e.key === 'f' || e.key === 'F') {
        if (document.getElementById('app').dataset.tab === 'fight' || window.innerWidth > 980) this.game.attack();
      }
    });

    window.addEventListener('resize', () => {
      this.game.mineRenderer?.resize();
      this.game.combatRenderer?.resize();
    });

    // The scene canvases are the primary input on touch devices.
    $('mineScene')?.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-action]')) return;
      this.game.strikeMine();
    });
    $('arena')?.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-action]') || e.target.closest('.death-banner')) return;
      this.game.attack();
    });
  }

  dispatch(action, index, target) {
    const g = this.game;
    switch (action) {
      case 'strike': g.strikeMine(); break;
      case 'attack': g.attack(); break;
      case 'auto': g.toggleAuto(); break;
      case 'pickaxe': g.buyPickaxe(); break;
      case 'crew': g.buyCrew(); break;
      case 'weapon': g.buyWeapon(); break;
      case 'armor': g.buyArmor(); break;
      case 'stim': g.buyStim(); break;
      case 'drill': g.buyDrill(index); break;
      case 'layer': g.selectLayer(index); break;
      case 'zone': g.selectZone(index); break;
      case 'outfit': g.buyOutfit(index); break;
      case 'attr': g.spendPoint(target?.dataset.id); break;
      case 'perks': g.openPerks(); break;
      case 'respec': g.respec(); break;
      case 'overload': g.confirmOverload(); break;
      default: break;
    }
  }

  setTab(tab) {
    const app = $('app');
    app.dataset.tab = tab;
    document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
    // let the browser apply display before measuring canvas rects
    requestAnimationFrame(() => {
      this.game.mineRenderer?.resize();
      this.game.combatRenderer?.resize();
    });
  }

  render() {
    if (!this.s) return;
    this.renderResources();
    this.renderMine();
    this.renderForge();
    this.renderFight();
    this.renderLog();
    this.renderFooter();
  }

  renderResources() {
    const s = this.s;
    const showShards = s.shards > 0;
    setText(this.refs.topLevel, String(s.level || 1));
    const hasPoints = (s.points || 0) > 0 || (s.perkPoints || 0) > 0;
    this.refs.topPoints.hidden = !hasPoints;
    for (const key of ORE_ORDER) {
      const ref = this.resEls[key];
      const unlocked = LAYERS.findIndex((l) => l.ore === key) < s.layersUnlocked;
      const visible = unlocked || (s.ores[key] || 0) > 0;
      ref.chip.style.display = visible ? '' : 'none';
      ref.chip.classList.toggle('locked', !unlocked);
      setText(ref.val, fmt(s.ores[key] || 0));
      const layerIndex = LAYERS.findIndex((l) => l.ore === key);
      const rate = layerIndex >= 0 ? (s.drills[layerIndex] || 0) * drillRate(s, layerIndex) : 0;
      setText(ref.per, rate > 0 ? `+${fmtRate(rate)}` : '');
      ref.chip.title = `${ORES[key].name}${rate > 0 ? ` · ${fmtRate(rate)}` : ''}`;
    }
    const caps = this.resEls.caps;
    setText(caps.val, fmt(s.caps));
    caps.chip.title = `Salvage caps (money) · earned in combat, spent on upgrades and outfits. ${fmt(s.stats.totalCaps || 0)} lifetime.`;
    const shards = this.resEls.shards;
    shards.chip.style.display = showShards ? '' : 'none';
    setText(shards.val, fmt(s.shards));
    shards.chip.title = `Core shards · +${Math.round(s.shards * 10)}% ore, +${Math.round(s.shards * 8)}% damage`;
  }

  renderMine() {
    const s = this.s;
    const r = this.refs;
    const layer = LAYERS[s.layer] || LAYERS[0];
    const node = s.nodes[s.layer] || 0;
    const maxHp = layerMaxHp(s, s.layer);
    const hp = Math.min(maxHp, s.veinHp[s.layer] ?? maxHp);
    setText(r.layerBadge, `${layer.short} // ${layer.depth}M`);
    setText(r.veinLabel, `VEIN ${String(node + 1).padStart(2, '0')}`);
    setText(r.richnessLabel, `RICH ×${nodeRichness(node).toFixed(2)}`);
    setText(r.veinHpText, `${Math.ceil(hp)} / ${maxHp}`);
    r.veinBar.style.width = `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%`;
    setText(r.strikeSub, `+${fmt(strikeYield(s, s.layer), 1)} ${ORES[layer.ore].name.toUpperCase()} PER HIT`);
    setText(r.pickPower, fmt(pickPower(s), 1));
    const totalRate = LAYERS.reduce((sum, _, i) => sum + (s.drills[i] || 0) * drillRate(s, i), 0);
    setText(r.autoYield, fmtRate(totalRate));
    setText(r.depthText, `${layer.name.toUpperCase()} // ${layer.depth}M`);
    r.sceneTip.classList.toggle('hidden', (s.stats.clicks || 0) > 3);
    setText(r.objectiveText, this.objectiveText());

    this.layerEls.forEach(({ btn, req }, i) => {
      const l = LAYERS[i];
      btn.classList.toggle('active', i === s.layer);
      const unlocked = i < s.layersUnlocked;
      btn.classList.toggle('locked', !unlocked);
      const unlock = l.unlock;
      let ready = false;
      if (!unlocked && unlock) {
        ready = s.pickaxe >= unlock.pickaxe && canAffordOre(s, unlock.ore);
      }
      btn.classList.toggle('ready', ready);
      if (unlocked) {
        const rate = (s.drills[i] || 0) * drillRate(s, i);
        setText(req, `${l.baseYield}/hit${rate > 0 ? ` · +${fmtRate(rate)}` : ''}`);
      } else if (ready) {
        setText(req, `UNLOCK · ${costLabel(unlock.ore)}`);
      } else {
        setText(req, `PK.${unlock.pickaxe} · ${costLabel(unlock.ore)}`);
      }
    });
  }

  renderForge() {
    const s = this.s;
    const r = this.refs;
    const p = playerStats(s);

    // ── survivor level / attributes / perks ──────────────────
    const need = xpNeeded(s.level || 1);
    setText(r.forgeLevel, String(s.level || 1));
    r.levelXpBar.style.width = `${Math.max(0, Math.min(100, ((s.xp || 0) / need) * 100))}%`;
    setText(r.levelXpText, `${fmt(s.xp || 0, 0)} / ${fmt(need)} XP`);
    setText(r.levelBonus, `+${Math.round((levelHpMult(s) - 1) * 100)}% HP · +${Math.round((levelAtkMult(s) - 1) * 100)}% ATK`);
    const unspent = s.points || 0;
    setText(r.levelPoints, `${unspent} POINT${unspent === 1 ? '' : 'S'}`);
    r.levelPoints.classList.toggle('ready', unspent > 0);
    setText(r.perkBadge, String(s.perkPoints || 0));
    r.perkBtn.classList.toggle('ready', (s.perkPoints || 0) > 0);

    for (const attr of ATTRIBUTES) {
      const els = this.attrEls[attr.id];
      const val = attrLevel(s, attr.id);
      setText(els.val, String(val));
      setText(els.eff, attr.effect(val));
      els.plus.disabled = unspent < 1;
      els.plus.title = unspent < 1 ? 'No attribute points available' : `Add 1 ${attr.name}`;
    }
    const totalSpent = ATTRIBUTES.reduce((sum, a) => sum + attrLevel(s, a.id), 0);
    const owned = PERKS.filter((perk) => perkRank(s, perk.id) > 0)
      .map((perk) => `${perk.name} ×${perkRank(s, perk.id)}`);
    if ((s.perkPoints || 0) > 0) setText(r.perkLineText, `${s.perkPoints} perk choice${s.perkPoints > 1 ? 's' : ''} ready — open PERKS.`);
    else if (owned.length) setText(r.perkLineText, owned.join(' · '));
    else setText(r.perkLineText, 'No perks yet — earn one every 3 levels.');
    r.respecBtn.disabled = totalSpent === 0;

    // pickaxe
    const pc = pickaxeCost(s.pickaxe);
    const pcAff = canAfford(s, pc);
    const pick = this.cardEls.pickaxe;
    pick.lvl.textContent = `LV.${s.pickaxe}`;
    pick.desc.innerHTML = `Power <b>${fmt(pickPower(s), 1)}</b> → <b>${fmt(2 + 2.3 * s.pickaxe, 1)}</b> · cracks all ore veins`;
    pick.cost.textContent = costLabel(pc);
    pick.card.classList.toggle('affordable', pcAff);
    pick.cta.textContent = 'UPGRADE';

    // crew
    const cc = crewCost(s.crew);
    const ccAff = canAfford(s, cc);
    const crew = this.cardEls.crew;
    crew.lvl.textContent = `LV.${s.crew}`;
    crew.desc.innerHTML = `Ore yield <b>+${s.crew * 8}%</b> → <b>+${(s.crew + 1) * 8}%</b> · survivors work the rigs`;
    crew.cost.textContent = costLabel(cc);
    crew.card.classList.toggle('affordable', ccAff);
    crew.cta.textContent = 'RECRUIT';
    setText(r.crewBadge, `CREW ${s.crew}`);
    setText(r.drillRateTotal, `${fmtRate(LAYERS.reduce((sum, _, i) => sum + (s.drills[i] || 0) * drillRate(s, i), 0))}`);

    // gear
    const wc = weaponCost(s.combat.gear.weapon);
    const wAff = canAfford(s, wc);
    const weapon = this.cardEls.weapon;
    weapon.lvl.textContent = `LV.${s.combat.gear.weapon}`;
    weapon.desc.innerHTML = `Damage <b>${fmt(p.attack, 1)}</b> · ${Math.round(p.crit * 100)}% crit · ${(playerAttackInterval(s) / 1000).toFixed(2)}s swing`;
    weapon.cost.textContent = costLabel(wc);
    weapon.card.classList.toggle('affordable', wAff);
    weapon.cta.textContent = 'FORGE';

    const ac = armorCost(s.combat.gear.armor);
    const aAff = canAfford(s, ac);
    const armor = this.cardEls.armor;
    armor.lvl.textContent = `LV.${s.combat.gear.armor}`;
    armor.desc.innerHTML = `HP <b>${fmt(p.maxHp)}</b> → <b>${fmt(p.maxHp + 30)}</b> · ${Math.round(p.defense * 100)}% damage resist`;
    armor.cost.textContent = costLabel(ac);
    armor.card.classList.toggle('affordable', aAff);
    armor.cta.textContent = 'FORGE';

    const stimMax = s.combat.gear.stim >= STIM_MAX;
    const stim = this.cardEls.stim;
    stim.lvl.textContent = `LV.${s.combat.gear.stim}`;
    if (stimMax) {
      stim.desc.innerHTML = `Heals <b>${p.healPerKill}</b> HP per kill · knockout ${p.deathMs / 1000}s`;
      stim.cost.textContent = 'Max tier reached';
      stim.card.classList.remove('affordable');
      stim.card.classList.add('maxed');
      stim.cta.textContent = 'MAX';
    } else {
      const sc = stimCost(s.combat.gear.stim);
      const sAff = canAfford(s, sc);
      stim.desc.innerHTML = `Heals <b>${p.healPerKill}</b> → <b>${8 + 5 * (s.combat.gear.stim + 1)}</b> HP per kill · faster reboot`;
      stim.cost.textContent = costLabel(sc);
      stim.card.classList.toggle('affordable', sAff);
      stim.card.classList.remove('maxed');
      stim.cta.textContent = 'BUILD';
    }

    // drills
    this.drillEls.forEach(({ btn, name, sub, cost, buy }, i) => {
      const unlocked = i < s.layersUnlocked;
      const l = LAYERS[i];
      const count = s.drills[i] || 0;
      btn.classList.toggle('locked', !unlocked);
      name.firstChild.textContent = `${ORES[l.ore].name} Drill`;
      if (!unlocked) {
        sub.textContent = 'Layer not yet opened';
        cost.textContent = 'LOCKED';
        buy.classList.remove('show');
        btn.classList.remove('affordable');
      } else {
        const per = drillRate(s, i);
        sub.textContent = `×${count} · ${fmtRate(per)} each · ${fmtRate(per * count)} total`;
        const dc = drillCost(i, count);
        cost.textContent = costLabel(dc);
        btn.classList.toggle('affordable', canAfford(s, dc));
      }
      cost.closest('.drill-buy').querySelector('b').textContent = 'BUY';
    });

    // outfits
    let crafted = 0;
    this.outfitEls.forEach((els, i) => {
      const outfit = OUTFITS[i];
      const lvl = outfitLevel(s, outfit.id);
      if (lvl > 0) crafted += 1;
      const maxed = lvl >= outfit.max;
      setText(els.lvl, `${lvl}/${outfit.max}`);
      setText(els.desc, `${outfit.slot} · ${maxed ? outfit.effect(lvl) : `Next: ${outfit.effect(lvl + 1)}`}`);
      els.card.title = outfit.blurb;
      if (maxed) {
        setText(els.cost, 'Max tier reached');
        setText(els.cta, 'MAX');
        els.card.classList.remove('affordable');
        els.card.classList.add('maxed');
      } else {
        const cost = outfitCost(outfit, lvl);
        const aff = canAfford(s, cost);
        setText(els.cost, costLabel(cost));
        setText(els.cta, lvl > 0 ? 'UPGRADE' : 'CRAFT');
        els.card.classList.toggle('affordable', aff);
        els.card.classList.remove('maxed');
      }
    });
    setText(r.outfitSummary, `${crafted} / ${OUTFITS.length} CRAFTED`);

    // core
    const gain = overloadGain(s);
    r.overloadBtn.disabled = s.combat.primeKills < 1;
    if (s.combat.primeKills < 1) {
      r.coreDesc.textContent = 'Defeat Warden Prime in The Black Vault to charge the core. Overloading resets your run for permanent shards.';
      r.coreDesc.classList.remove('ready');
    } else {
      r.coreDesc.textContent = `Core charged by ${s.combat.primeKills} Prime kill${s.combat.primeKills > 1 ? 's' : ''}. Overload yields ${gain} core shard${gain > 1 ? 's' : ''} and resets ore, rigs, and territory.`;
      r.coreDesc.classList.add('ready');
    }
  }

  renderFight() {
    const s = this.s;
    const c = s.combat;
    const r = this.refs;
    const zone = ZONES[c.zone] || ZONES[0];
    const stats = playerStats(s);
    const enemy = c.enemy;
    const dead = c.deadUntil > Date.now();

    setText(r.zoneBadge, zone.name.toUpperCase());
    setText(r.zoneProgress, `${c.unlocked} / ${ZONES.length} SECURED`);
    setText(r.wavePill, enemy ? `${enemy.boss ? 'BOSS · ' : ''}WAVE ${c.waves[c.zone] || 1}` : `WAVE ${c.waves[c.zone] || 1}`);
    r.wavePill.classList.toggle('boss', !!enemy?.boss);
    if (enemy) {
      setText(r.enemyName, enemy.name.toUpperCase());
      r.enemyName.style.color = enemy.boss ? '#ffb15c' : '';
      const pct = Math.max(0, Math.min(100, (enemy.hp / Math.max(1, enemy.maxHp)) * 100));
      r.enemyBar.style.width = `${pct}%`;
      r.enemyBar.style.filter = enemy.boss ? 'saturate(1.3)' : '';
    } else {
      setText(r.enemyName, 'SCANNING…');
      r.enemyBar.style.width = '0%';
    }
    const hpPct = Math.max(0, Math.min(100, (c.hp / stats.maxHp) * 100));
    r.playerBar.style.width = `${hpPct}%`;
    setText(r.playerHpText, `${fmt(Math.max(0, c.hp))} / ${fmt(stats.maxHp)}`);
    setText(r.playerLevel, String(s.level || 1));
    const need = xpNeeded(s.level || 1);
    r.playerXpBar.style.width = `${Math.max(0, Math.min(100, ((s.xp || 0) / need) * 100))}%`;
    setText(r.playerXpText, `${fmt(s.xp || 0, 0)}/${fmt(need)}`);
    setText(r.atkStat, fmt(stats.attack, 1));
    setText(r.defStat, `${Math.round(stats.defense * 100)}%`);
    setText(r.killStat, fmt(s.stats.kills || 0));
    r.deathBanner.hidden = !dead;
    if (dead) setText(r.deathBanner, `FLATLINED — REBOOTING ${Math.max(1, Math.ceil((c.deadUntil - Date.now()) / 1000))}s`);
    r.autoBtn.classList.toggle('on', !!c.auto);
    r.autoBtn.setAttribute('aria-pressed', String(!!c.auto));
    setText(r.autoLabel, c.auto ? 'AUTO: ON' : 'AUTO: OFF');
    const cooling = Date.now() < (c.nextPlayerAttack || 0);
    r.attackBtn.classList.toggle('cooling', cooling && !dead);

    this.zoneEls.forEach(({ btn, name, sub, status }, i) => {
      const z = ZONES[i];
      const unlocked = i < c.unlocked;
      btn.classList.toggle('locked', !unlocked);
      btn.classList.toggle('active', i === c.zone);
      name.querySelector('.z-dot').style.background = unlocked ? z.accent : '#4a4f43';
      name.querySelector('.z-dot').style.boxShadow = unlocked ? `0 0 6px ${z.accent}` : 'none';
      if (unlocked) {
        btn.classList.remove('ready');
        sub.textContent = `${z.unlock ? `${z.baseHp} HP` : 'STARTING GROUND'} · WAVE ${c.waves[i]} · ~${fmt(z.caps)} caps/kill`;
        if (i === c.zone) {
          status.innerHTML = `<b>ACTIVE</b>${z.enemies[0]}`;
          status.classList.add('active-tag');
        } else {
          status.innerHTML = `<b>TRAVEL</b>WAVE ${c.waves[i]}`;
          status.classList.remove('active-tag');
        }
      } else {
        const req = z.unlock;
        const ready = canAfford(s, { caps: req.caps, ...req.ore });
        btn.classList.toggle('ready', ready);
        status.classList.remove('active-tag');
        sub.textContent = `${z.baseDmg} DMG · ${fmt(z.caps)} caps/kill · ${ORES[z.ore].name}`;
        status.innerHTML = ready ? `<b>UNLOCK</b>${fmt(req.caps)} CAPS` : `<b>LOCKED</b>${fmt(req.caps)} CAPS`;
      }
    });
  }

  renderLog() {
    const log = this.game.logs;
    if (!log.length) return;
    const latest = log[log.length - 1];
    if (latest.id === this.lastLogId) return;
    this.lastLogId = latest.id;
    setText(this.refs.tickerText, latest.text);
    this.refs.tickerText.className = latest.type || '';
  }

  renderFooter() {
    const s = this.s;
    setText(this.refs.playStats, `${fmt(s.stats.totalMined)} ore mined · ${fmt(s.stats.kills)} kills · ${s.stats.detonations} overloads`);
    const saving = Date.now() < this.saveFlashUntil;
    setText(this.refs.saveState, saving ? 'SAVED ✓' : 'AUTOSAVE ON');
    this.refs.saveState.classList.toggle('saved', saving);
  }

  objectiveText() {
    const s = this.s;
    if ((s.stats.clicks || 0) < 5) return `Strike the ore vein — ${Math.min(5, s.stats.clicks || 0)}/5 swings.`;
    if ((s.drills[0] || 0) === 0) return 'Build a scrap drill in the FORGE so ore flows while you fight.';
    if (s.pickaxe < 3) return `Upgrade the pickaxe to Lv.3 — currently Lv.${s.pickaxe}.`;
    if (s.layersUnlocked < 2) return 'Open Rust Flats from the shaft map.';
    if ((s.stats.kills || 0) < 5) return `Win ${Math.min(5, s.stats.kills || 0)}/5 fights in the wasteland.`;
    if (s.combat.unlocked < 2) return 'Unlock Highway Camp and push deeper into the ruins.';
    if ((s.points || 0) > 0) return `Level ${s.level}: spend ${s.points} attribute point${s.points > 1 ? 's' : ''} in the FORGE.`;
    if ((s.perkPoints || 0) > 0) return 'A perk choice is waiting — open PERKS in the FORGE.';
    if (s.crew < 1) return 'Recruit a survivor crew to boost every ore source.';
    if (s.layersUnlocked < LAYERS.length) return `Descend: open ${LAYERS[s.layersUnlocked].name}.`;
    if (s.combat.unlocked < ZONES.length) return `Secure ${ZONES[s.combat.unlocked].name} at the edge of the map.`;
    if (s.combat.primeKills < 1) return 'Reach wave 10 in The Black Vault and kill Warden Prime.';
    return 'The core is charged. Overload the reactor for permanent shards.';
  }

  toast(text, type = '') {
    const wrap = $('toasts');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = text;
    wrap.append(el);
    while (wrap.children.length > 4) wrap.removeChild(wrap.firstChild);
    setTimeout(() => el.remove(), 3100);
  }

  log(text, type = '') {
    this.game.logs.push({ id: ++this.toastId + 1000, text, type, at: Date.now() });
    if (this.game.logs.length > 30) this.game.logs.shift();
    this.renderLog();
  }

  setSaveFlash() {
    this.saveFlashUntil = Date.now() + 1600;
  }

  updateSoundButton() {
    const btn = this.refs.soundBtn;
    if (!btn) return;
    btn.classList.toggle('off', !this.s.sound);
    btn.textContent = this.s.sound ? '♪' : '♪';
    btn.setAttribute('aria-pressed', String(!!this.s.sound));
    btn.title = this.s.sound ? 'Mute sound' : 'Enable sound';
  }

  openModal({ eyebrow = 'SYSTEM', title, body, actions = [] }) {
    const modal = $('modal');
    $('modalEyebrow').textContent = eyebrow;
    $('modalTitle').textContent = title;
    const bodyEl = $('modalBody');
    bodyEl.innerHTML = body;
    const actionsEl = $('modalActions');
    actionsEl.innerHTML = '';
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${action.kind || ''}`;
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        if (action.keepOpen !== true) this.closeModal();
        action.onClick?.();
      }, { once: true });
      actionsEl.append(btn);
    }
    modal.hidden = false;
    modal.querySelector('.modal-card').focus?.();
  }

  closeModal() {
    const modal = $('modal');
    modal.hidden = true;
  }
}

function canAffordOre(state, oreCost) {
  return Object.entries(oreCost).every(([k, v]) => (state.ores[k] || 0) >= v);
}
