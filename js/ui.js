import {
  ORES, ORE_ORDER, LAYERS, ZONES, STIM_MAX, OUTFITS, ATTRIBUTES, PERKS,
  MINING_TOOLS, COMBAT_WEAPONS, GEAR_SLOTS, MAX_INVENTORY,
  fmt, fmtRate, costLabel, canAfford, pickPower, pickaxeCost, crewCost,
  drillCost, drillRate, weaponCost, armorCost, stimCost, playerStats, miningTool, combatWeapon,
  salvageCapsRate, nodeRichness, layerMaxHp, strikeYield, overloadGain, playerAttackInterval,
  xpNeeded, outfitCost, outfitLevel, attrLevel, perkRank, levelHpMult, levelAtkMult,
  rarityOf, gearStats, gearScore, gearStatLines, scrapValue, lootRunCost, equippedItem,
} from './data.js';

const $ = (id) => document.getElementById(id);
const setText = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };

export class UI {
  constructor(game) {
    this.game = game;
    this.toastId = 0;
    this.lastLogId = -1;
    this.saveFlashUntil = 0;
    this.modalKind = null;
    this.lastLoot = null;
    this.refs = {};
    this.buildResources();
    this.buildLayers();
    this.buildCards();
    this.buildEquipmentCards();
    this.buildAttributes();
    this.buildOutfits();
    this.buildDrills();
    this.buildZones();
    this.buildLoadout();
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

    $('toolCards').innerHTML = fmtCard('pickaxe', '⚒', 'TOOL TUNING') + fmtCard('crew', '☗', 'SURVIVOR CREW');
    $('gearCards').innerHTML = fmtCard('weapon', '⚔', 'WEAPON TUNING') + fmtCard('armor', '⛨', 'RAD PLATE') + fmtCard('stim', '✚', 'STIM KIT');

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

  buildEquipmentCards() {
    const card = (item, action) => `
      <button class="card equip-card" type="button" data-action="${action}" data-id="${item.id}" id="${action}-${item.id}" title="${item.blurb}">
        <span class="card-icon">${item.icon}</span>
        <span class="card-body">
          <span class="card-top"><span class="card-title">${item.name}</span><span class="card-lvl" data-tier>${item.tier}</span></span>
          <span class="card-desc" data-desc></span>
          <span class="card-cost" data-cost></span>
        </span>
        <span class="card-cta" data-cta>EQUIP</span>
      </button>`;
    $('miningToolCards').innerHTML = MINING_TOOLS.map((item) => card(item, 'equiptool')).join('');
    $('combatWeaponCards').innerHTML = COMBAT_WEAPONS.map((item) => card(item, 'equipweapon')).join('');
    const collect = (list, action) => Object.fromEntries(list.map((item) => {
      const el = $(`${action}-${item.id}`);
      return [item.id, {
        card: el,
        desc: el.querySelector('[data-desc]'),
        cost: el.querySelector('[data-cost]'),
        cta: el.querySelector('[data-cta]'),
      }];
    }));
    this.toolCardEls = collect(MINING_TOOLS, 'equiptool');
    this.weaponCardEls = collect(COMBAT_WEAPONS, 'equipweapon');
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

  buildLoadout() {
    const wrap = $('loadoutStrip');
    this.loadoutEls = {};
    if (!wrap) return;
    for (const slot of GEAR_SLOTS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'loadout-slot';
      btn.dataset.action = 'gear';
      btn.dataset.slot = slot.id;
      btn.innerHTML = `
        <span class="ls-icon">${slot.icon}</span>
        <span class="ls-body">
          <span class="ls-slot">${slot.name}</span>
          <span class="ls-name" data-name>EMPTY</span>
        </span>
        <span class="ls-rarity" data-rarity></span>`;
      wrap.append(btn);
      this.loadoutEls[slot.id] = {
        btn,
        name: btn.querySelector('[data-name]'),
        rarity: btn.querySelector('[data-rarity]'),
      };
    }
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
    r.autoMineBtn = $('autoMineBtn');
    r.autoMineLabel = $('autoMineLabel');
    r.toolSummary = $('toolSummary');
    r.weaponSummary = $('weaponSummary');
    r.gearScore = $('gearScore');
    r.packSummary = $('packSummary');
    r.salvageCost = $('salvageCost');
    r.salvageRunBtn = $('salvageRunBtn');
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
      if (!$('modal').hidden) return;
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
      case 'automine': g.toggleAutoMine(); break;
      case 'equiptool': g.equipTool(target?.dataset.id); break;
      case 'equipweapon': g.equipWeapon(target?.dataset.id); break;
      case 'gear': this.openGear(); break;
      case 'salvagerun': g.salvageRun(); break;
      case 'equiploot': g.equipLoot(target?.dataset.id); break;
      case 'unequip': g.unequipSlot(target?.dataset.slot); break;
      case 'scraploot': g.scrapLoot(target?.dataset.id); break;
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
    this.renderLoadout();
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
    const capsRate = salvageCapsRate(s);
    setText(caps.val, fmt(s.caps));
    setText(caps.per, capsRate > 0 ? `+${fmtRate(capsRate)}` : '');
    caps.chip.title = `Salvage caps (money) · ${capsRate > 0 ? `${fmtRate(capsRate)} from salvage · ` : ''}earned in combat, spent on upgrades and outfits. ${fmt(s.stats.totalCaps || 0)} lifetime.`;
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
    const autoMine = !!s.autoMine;
    r.autoMineBtn.classList.toggle('on', autoMine);
    r.autoMineBtn.setAttribute('aria-pressed', String(autoMine));
    setText(r.autoMineLabel, autoMine ? 'AUTO-MINE: ON' : 'AUTO-MINE: OFF');

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
    pick.desc.innerHTML = `All tools <b>${fmt(pickPower(s), 1)}</b> → <b>${fmt((2 + 2.3 * s.pickaxe) * miningTool(s).powerMult, 1)}</b> vein power · raises every seam`;
    pick.cost.textContent = costLabel(pc);
    pick.card.classList.toggle('affordable', pcAff);
    setCta(pick.cta, 'UPGRADE', 'upgrade');

    // crew
    const cc = crewCost(s.crew);
    const ccAff = canAfford(s, cc);
    const crew = this.cardEls.crew;
    crew.lvl.textContent = `LV.${s.crew}`;
    crew.desc.innerHTML = `Ore yield <b>+${s.crew * 8}%</b> → <b>+${(s.crew + 1) * 8}%</b> · survivors work the rigs`;
    crew.cost.textContent = costLabel(cc);
    crew.card.classList.toggle('affordable', ccAff);
    setCta(crew.cta, 'RECRUIT', 'upgrade');
    setText(r.crewBadge, `CREW ${s.crew}`);
    const oreRate = LAYERS.reduce((sum, _, i) => sum + (s.drills[i] || 0) * drillRate(s, i), 0);
    const capsRate = salvageCapsRate(s);
    setText(r.drillRateTotal, `${fmtRate(oreRate)} ore · ${fmtRate(capsRate)} caps`);

    // mining tools
    const equippedTool = miningTool(s);
    const toolsReady = MINING_TOOLS.filter((tool) => s.tools?.[tool.id]).length;
    setText(r.toolSummary, `${toolsReady} / ${MINING_TOOLS.length} READY · ${equippedTool.name.toUpperCase()}`);
    for (const tool of MINING_TOOLS) {
      const els = this.toolCardEls[tool.id];
      const unlocked = !!s.tools?.[tool.id];
      const equipped = s.equippedTool === tool.id;
      els.desc.textContent = tool.stats;
      els.card.classList.toggle('equipped', equipped);
      els.card.classList.toggle('locked', !unlocked);
      els.card.classList.toggle('affordable', !unlocked && canAfford(s, tool.unlock || {}));
      if (equipped) {
        els.cost.textContent = 'EQUIPPED';
        setCta(els.cta, 'IN USE', 'inuse');
      } else if (unlocked) {
        els.cost.textContent = 'SCHEMATIC OWNED';
        setCta(els.cta, 'EQUIP', 'equip');
      } else {
        els.cost.textContent = costLabel(tool.unlock || {});
        setCta(els.cta, 'UNLOCK', 'unlock');
      }
    }

    // combat weapons
    const equippedWeapon = combatWeapon(s);
    const weaponsReady = COMBAT_WEAPONS.filter((weapon) => s.weapons?.[weapon.id]).length;
    setText(r.weaponSummary, `${weaponsReady} / ${COMBAT_WEAPONS.length} READY · ${equippedWeapon.name.toUpperCase()}`);
    for (const weapon of COMBAT_WEAPONS) {
      const els = this.weaponCardEls[weapon.id];
      const unlocked = !!s.weapons?.[weapon.id];
      const lootWeapon = equippedItem(s, 'weapon');
      const equipped = !lootWeapon && s.equippedWeapon === weapon.id;
      const swing = Math.max(220, Math.round((750 * weapon.speedMult) / (p.speedMult || 1)));
      const crit = Math.max(0, p.crit - equippedWeapon.critBonus + weapon.critBonus);
      els.desc.textContent = `DMG ×${weapon.damageMult.toFixed(2)} · ${(swing / 1000).toFixed(2)}s swing · ${Math.round(crit * 100)}% crit`;
      els.card.classList.toggle('equipped', equipped);
      els.card.classList.toggle('locked', !unlocked);
      els.card.classList.toggle('affordable', !unlocked && canAfford(s, weapon.unlock || {}));
      if (equipped) {
        els.cost.textContent = 'EQUIPPED';
        setCta(els.cta, 'IN USE', 'inuse');
      } else if (unlocked) {
        els.cost.textContent = 'SCHEMATIC OWNED';
        setCta(els.cta, 'EQUIP', 'equip');
      } else {
        els.cost.textContent = costLabel(weapon.unlock || {});
        setCta(els.cta, 'UNLOCK', 'unlock');
      }
    }

    // gear
    const wc = weaponCost(s.combat.gear.weapon);
    const wAff = canAfford(s, wc);
    const weapon = this.cardEls.weapon;
    weapon.lvl.textContent = `LV.${s.combat.gear.weapon}`;
    weapon.desc.innerHTML = `All weapons · Damage <b>${fmt(p.attack, 1)}</b> · ${Math.round(p.crit * 100)}% crit · ${(playerAttackInterval(s) / 1000).toFixed(2)}s swing`;
    weapon.cost.textContent = costLabel(wc);
    weapon.card.classList.toggle('affordable', wAff);
    setCta(weapon.cta, 'FORGE', 'upgrade');

    const ac = armorCost(s.combat.gear.armor);
    const aAff = canAfford(s, ac);
    const armor = this.cardEls.armor;
    const nextArmor = playerStats({
      ...s,
      combat: { ...s.combat, gear: { ...s.combat.gear, armor: s.combat.gear.armor + 1 } },
    });
    armor.lvl.textContent = `LV.${s.combat.gear.armor}`;
    armor.desc.innerHTML = `HP <b>${fmt(p.maxHp)}</b> → <b>${fmt(nextArmor.maxHp)}</b> · ${Math.round(p.defense * 100)}% damage resist`;
    armor.cost.textContent = costLabel(ac);
    armor.card.classList.toggle('affordable', aAff);
    setCta(armor.cta, 'FORGE', 'upgrade');

    const stimMax = s.combat.gear.stim >= STIM_MAX;
    const stim = this.cardEls.stim;
    stim.lvl.textContent = `LV.${s.combat.gear.stim}`;
    if (stimMax) {
      stim.desc.innerHTML = `Heals <b>${p.healPerKill}</b> HP per kill · knockout 5.0s`;
      stim.cost.textContent = 'Max tier reached';
      stim.card.classList.remove('affordable');
      stim.card.classList.add('maxed');
      setCta(stim.cta, 'MAX', 'inuse');
    } else {
      const sc = stimCost(s.combat.gear.stim);
      const sAff = canAfford(s, sc);
      stim.desc.innerHTML = `Heals <b>${p.healPerKill}</b> → <b>${8 + 5 * (s.combat.gear.stim + 1)}</b> HP per kill · knockout 5.0s`;
      stim.cost.textContent = costLabel(sc);
      stim.card.classList.toggle('affordable', sAff);
      stim.card.classList.remove('maxed');
      setCta(stim.cta, 'BUILD', 'upgrade');
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
        setCta(els.cta, 'MAX', 'inuse');
        els.card.classList.remove('affordable');
        els.card.classList.add('maxed');
      } else {
        const cost = outfitCost(outfit, lvl);
        const aff = canAfford(s, cost);
        setText(els.cost, costLabel(cost));
        setCta(els.cta, lvl > 0 ? 'UPGRADE' : 'CRAFT', 'upgrade');
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

  loadoutScore() {
    return GEAR_SLOTS.reduce((sum, slot) => {
      const item = equippedItem(this.s, slot.id);
      return sum + (item ? gearScore(item) : 0);
    }, 0);
  }

  renderLoadout() {
    const s = this.s;
    const r = this.refs;
    const score = this.loadoutScore();
    setText(r.gearScore, `GEAR ${score}`);
    setText(r.packSummary, `${(s.inventory || []).length} / ${MAX_INVENTORY} · GEAR ${score}`);
    const cost = lootRunCost(s);
    setText(r.salvageCost, fmt(cost));
    r.salvageRunBtn?.classList.toggle('affordable', canAfford(s, { caps: cost }));
    if (!this.loadoutEls) return;
    for (const slot of GEAR_SLOTS) {
      const els = this.loadoutEls[slot.id];
      if (!els) continue;
      const item = equippedItem(s, slot.id);
      els.btn.classList.toggle('filled', !!item);
      if (item) {
        const rarity = rarityOf(item);
        els.btn.style.setProperty('--rarity', rarity.color);
        els.name.textContent = item.name.toUpperCase();
        els.rarity.textContent = rarity.name.toUpperCase();
        els.btn.title = `${item.name} · ${rarity.name} · ${gearStatLines(item).join(' · ')}`;
      } else {
        els.btn.style.removeProperty('--rarity');
        els.name.textContent = 'EMPTY';
        els.rarity.textContent = '';
        els.btn.title = `No ${slot.name.toLowerCase()} fitted. Open loadout.`;
      }
    }
  }

  renderFight() {
    const s = this.s;
    const c = s.combat;
    const r = this.refs;
    const zone = ZONES[c.zone] || ZONES[0];
    const stats = playerStats(s);
    const enemy = c.enemy;
    const perfNow = performance.now();
    const dead = c.deadUntil > perfNow;

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
    if (dead) setText(r.deathBanner, `FLATLINED — REBOOTING ${Math.max(1, Math.ceil((c.deadUntil - perfNow) / 1000))}s`);
    r.autoBtn.classList.toggle('on', !!c.auto);
    r.autoBtn.setAttribute('aria-pressed', String(!!c.auto));
    setText(r.autoLabel, c.auto ? 'AUTO: ON' : 'AUTO: OFF');
    const cooling = perfNow < (c.nextPlayerAttack || 0);
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

  gearSlotMarkup(slot) {
    const item = equippedItem(this.s, slot.id);
    if (!item) {
      return `
        <div class="gear-slot empty">
          <span class="gs-icon">${slot.icon}</span>
          <span class="gs-body"><span class="gs-slot">${slot.name}</span><strong>EMPTY</strong><small>No item fitted</small></span>
        </div>`;
    }
    const rarity = rarityOf(item);
    const inHand = item.slot === 'weapon' || item.slot === 'tool';
    return `
      <div class="gear-slot filled" style="--rarity:${rarity.color}">
        <span class="gs-icon">${slot.icon}</span>
        <span class="gs-body">
          <span class="gs-slot">${slot.name} · <em style="color:${rarity.color}">${rarity.name}</em></span>
          <strong>${item.name}</strong>
          <small>${gearStatLines(item).join(' · ')}${inHand ? ' · <span class="gs-active">IN HAND · DRIVES THE FIGHTER</span>' : ''}</small>
        </span>
        <button class="mini-btn" type="button" data-action="unequip" data-slot="${slot.id}">REMOVE</button>
      </div>`;
  }

  lootCard(item) {
    const slot = GEAR_SLOTS.find((entry) => entry.id === item.slot) || { name: item.slot.toUpperCase() };
    const rarity = rarityOf(item);
    const equipped = this.s.loadout?.[item.slot] === item.id;
    return `
      <div class="loot-card rarity-${rarity.id}${equipped ? ' equipped' : ''}" style="--rarity:${rarity.color}">
        <div class="lc-top"><span class="lc-rarity">${rarity.name.toUpperCase()}</span><span class="lc-level">LV.${item.level}</span></div>
        <strong class="lc-name">${item.name}</strong>
        <span class="lc-slot">${slot.name}</span>
        <div class="lc-stats">${gearStatLines(item).map((line) => `<span>${line}</span>`).join('')}</div>
        <div class="lc-actions">
          <button class="mini-btn" type="button" data-action="${equipped ? 'unequip' : 'equiploot'}" data-id="${item.id}" data-slot="${item.slot}">${equipped ? 'REMOVE' : 'EQUIP'}</button>
          <button class="mini-btn danger" type="button" data-action="scraploot" data-id="${item.id}">SCRAP +${scrapValue(item)}</button>
        </div>
      </div>`;
  }

  openGear() {
    const s = this.s;
    const score = this.loadoutScore();
    const cost = lootRunCost(s);
    const inventory = s.inventory || [];
    const pack = inventory.length
      ? inventory.map((item) => this.lootCard(item)).join('')
      : '<p class="empty-note">The pack is empty. Run salvage or kill hostiles to recover gear.</p>';
    const slots = GEAR_SLOTS.map((slot) => this.gearSlotMarkup(slot)).join('');
    const gs = gearStats(s);
    const bonuses = Object.entries(gs)
      .map(([key, value]) => {
        const label = { damage: 'DMG', crit: 'CRIT', speed: 'SPEED', hp: 'HP', heal: 'HEAL', defense: 'DEF', ore: 'ORE', caps: 'CAPS', xp: 'XP', power: 'POWER', yield: 'YIELD', cooldown: 'SWING' }[key] || key.toUpperCase();
        const pct = ['damage', 'crit', 'speed', 'defense', 'ore', 'caps', 'xp', 'power', 'yield', 'cooldown'].includes(key);
        return `<span>${label} ${pct ? `+${(value * 100).toFixed(1)}%` : `+${Math.round(value)}`}</span>`;
      })
      .join('');
    this.openModal({
      eyebrow: 'SURVIVOR LOADOUT',
      title: `Gear score ${score}`,
      kind: 'gear',
      wide: true,
      body: `
        <div class="gear-summary">
          <div><span>FITTED BONUSES</span><strong>${bonuses || 'No gear fitted'}</strong></div>
          <div><span>CAPS</span><strong>${fmt(s.caps)}</strong></div>
        </div>
        <div class="gear-slots">${slots}</div>
        <p class="section-label">SALVAGE PACK <span class="label-sub">${inventory.length} / ${MAX_INVENTORY} ITEMS</span></p>
        <div class="loot-grid">${pack}</div>
        <div class="loot-run">
          <div><strong>SALVAGE RUN</strong><span>Spend caps to recover random weapons, tools and armor.</span></div>
          <button class="btn small primary" type="button" data-action="salvagerun">RUN · ${fmt(cost)} CAPS</button>
        </div>`,
      actions: [{ label: 'CLOSE', kind: '' }],
    });
  }

  openLootResults(items, title = 'Recovered gear') {
    const list = (items || []).filter(Boolean);
    this.lastLoot = { ids: list.map((item) => item.id), title };
    const body = list.length
      ? `<p>Recovered <strong>${list.length}</strong> item${list.length > 1 ? 's' : ''}. Equip now or scrap for caps.</p>
         <div class="loot-grid">${list.map((item) => this.lootCard(item)).join('')}</div>`
      : '<p>The run came back empty. The wastes keep what they take.</p>';
    this.openModal({
      eyebrow: 'SALVAGE RUN',
      title,
      kind: 'loot',
      wide: true,
      body,
      actions: [{ label: 'CLOSE', kind: '' }],
    });
  }

  refreshOpenGear() {
    if (this.modalKind === 'gear') {
      this.openGear();
    } else if (this.modalKind === 'loot') {
      const ids = this.lastLoot?.ids || [];
      const items = ids.map((id) => this.s.inventory.find((item) => item.id === id)).filter(Boolean);
      this.openLootResults(items, this.lastLoot?.title || 'Recovered gear');
    }
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

  openModal({ eyebrow = 'SYSTEM', title, body, actions = [], wide = false, kind = null }) {
    const modal = $('modal');
    this.modalKind = kind;
    $('modalEyebrow').textContent = eyebrow;
    $('modalTitle').textContent = title;
    const bodyEl = $('modalBody');
    bodyEl.innerHTML = body;
    bodyEl.scrollTop = 0;
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
    modal.querySelector('.modal-card').classList.toggle('wide', !!wide);
    modal.querySelector('.modal-card').focus?.();
  }

  closeModal() {
    const modal = $('modal');
    modal.hidden = true;
    this.modalKind = null;
  }
}

function canAffordOre(state, oreCost) {
  return Object.entries(oreCost).every(([k, v]) => (state.ores[k] || 0) >= v);
}

/* Colour-codes the action box in the Forge: EQUIP / IN USE / UNLOCK / UPGRADE. */
function setCta(el, label, state) {
  if (!el) return;
  el.textContent = label;
  el.classList.remove('cta-equip', 'cta-inuse', 'cta-unlock', 'cta-upgrade');
  if (state) el.classList.add(`cta-${state}`);
  const card = el.closest('.card');
  if (card) card.dataset.ctaState = state || '';
}
