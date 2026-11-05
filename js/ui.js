import {
  ORES, ORE_ORDER, LAYERS, ZONES, STIM_MAX, OUTFITS, ATTRIBUTES, PERKS,
  MINING_TOOLS, COMBAT_WEAPONS, COMBAT_WEAPON_MAP, GEAR_SLOTS, MAX_INVENTORY,
  CHESTS, CREW_POOL, CREW_CLASSES, CREW_CLASS_MAP, CREW_COUNT, crewCount, crewBonus,
  CLASS_RANK_MAP, classTierRank, tierLabel,
  TASKS, taskProgress, isoValue, STORE_REROLL_COST,
  towerUnlock, towerReward,
  fmt, fmtRate, costLabel, canAfford, pickPower, pickaxeCost,
  drillCost, drillRate, weaponCost, armorCost, stimCost, playerStats, miningTool, combatWeapon,
  salvageCapsRate, nodeRichness, layerMaxHp, strikeYield, overloadGain, playerAttackInterval,
  xpNeeded, outfitCost, outfitLevel, attrLevel, perkRank, levelHpMult, levelAtkMult,
  rarityOf, gearStats, gearScore, gearStatLines, scrapValue, lootRunCost, equippedItem,
} from './data.js';

const $ = (id) => document.getElementById(id);
const setText = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };

/* class-tier chip colors, cheapest → most exotic (rank 0…14) */
const TIER_COLORS = [
  '#8d947f', '#9aa8b2', '#a6bfb0', '#7fdc6a', '#6fd882', '#a4d45a', '#d8c95a',
  '#e8b04c', '#ff9a4c', '#ff7a2b', '#e8912b', '#c98a3c', '#6fd8dc', '#49e0e8', '#7df5ef',
];
const tierChip = (item) => {
  const tier = item.classId ? tierLabel(item.classId) : '';
  if (!tier) return '';
  const rank = classTierRank(item);
  const color = TIER_COLORS[Math.min(rank, TIER_COLORS.length - 1)];
  const anomaly = tier === 'ANOMALY' ? ' anomaly' : '';
  return `<i class="lc-tier${anomaly}" style="color:${color}">${tier}</i>`;
};

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
    this.buildCrew();
    this.buildStore();
    this.buildLoadoutPanel();
    this.cacheRefs();
    this.bind();
    this.render();
  }

  get s() { return this.game.state; }

  buildResources() {
    const wrap = $('resources');
    this.resEls = {};
    const specs = [
      { key: 'caps', name: 'NUTS', color: '#e9c46a', cls: 'caps' },
      { key: 'iso', name: 'ISO', color: '#7dff5a', cls: 'iso' },
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

    $('toolCards').innerHTML = fmtCard('pickaxe', '⚒', 'TOOL TUNING');
    $('gearCards').innerHTML = fmtCard('weapon', '⚔', 'WEAPON TUNING') + fmtCard('armor', '⛨', 'RAD PLATE') + fmtCard('stim', '✚', 'STIM KIT');

    this.cardEls = {};
    for (const id of ['pickaxe', 'weapon', 'armor', 'stim']) {
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
      btn.dataset.tab = 'loadout';
      btn.dataset.slot = slot.id;
      btn.title = 'Open the LOADOUT tab';
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

  buildCrew() {
    // roster, grouped by class
    const rosterWrap = $('crewRoster');
    rosterWrap.innerHTML = CREW_POOL.map((member) => {
      const info = CREW_CLASS_MAP[member.cls];
      return `
        <div class="crew-tile" data-crew="${member.id}" style="--cc:${info.color}">
          <span class="crew-cls">${info.name}</span>
          <strong class="crew-name">${member.name}</strong>
          <span class="crew-blurb">${member.blurb}</span>
          <span class="crew-buff" data-buff>${member.buff}</span>
          <span class="crew-state" data-state></span>
        </div>`;
    }).join('');
    this.crewTileEls = this.collectCrewTiles();
  }

  collectCrewTiles() {
    const tiles = {};
    for (const member of CREW_POOL) {
      const el = document.querySelector(`.crew-tile[data-crew="${member.id}"]`);
      tiles[member.id] = {
        el,
        state: el.querySelector('[data-state]'),
      };
    }
    return tiles;
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
    r.rosterBadge = $('rosterBadge');
    r.rosterCount = $('rosterCount');
    r.chestSummary = $('chestSummary');
    r.buffEmptyNote = $('buffEmptyNote');
    r.crewBuffChips = $('crewBuffChips');
    r.storeBadge = $('storeBadge');
    r.storeStockNote = $('storeStockNote');
    r.storeRollBtn = $('storeRollBtn');
    r.storeTaskNote = $('storeTaskNote');
    r.packBadge = $('packBadge');
    r.bonusSummary = $('bonusSummary');
    r.loadCaps = $('loadCaps');
    r.salvageCost2 = $('salvageCost2');
    r.salvageRunBtn2 = $('salvageRunBtn2');
    r.towerStrip = $('towerStrip');
    r.towerFloorText = $('towerFloorText');
    r.towerRewardText = $('towerRewardText');
    r.towerBtn = $('towerBtn');
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
      const tab = document.getElementById('app').dataset.tab;
      if (e.code === 'Space') {
        e.preventDefault();
        if (tab === 'mine') this.game.strikeMine();
      } else if (e.key === 'f' || e.key === 'F') {
        if (tab === 'fight') this.game.attack();
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
      case 'salvagerun': g.salvageRun(); break;
      case 'equiploot': g.equipLoot(target?.dataset.id); break;
      case 'unequip': g.unequipSlot(target?.dataset.slot); break;
      case 'scraploot': g.scrapLoot(target?.dataset.id); break;
      case 'pickaxe': g.buyPickaxe(); break;
      case 'weapon': g.buyWeapon(); break;
      case 'armor': g.buyArmor(); break;
      case 'stim': g.buyStim(); break;
      case 'drill': g.buyDrill(index); break;
      case 'layer': g.selectLayer(index); break;
      case 'zone': g.selectZone(index); break;
      case 'outfit': g.buyOutfit(index); break;
      case 'chest': g.buyChest(index); break;
      case 'storeoffer': g.buyStoreOffer(index); break;
      case 'storeroll': g.rerollStore(); break;
      case 'claim': g.claimTask(target?.dataset.id); break;
      case 'autosort': g.sortInventory(this.packView.sort); break;
      case 'packfilter': this.setPackFilter(target); break;
      case 'tower': g.toggleTower(); break;
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
    this.renderCrew();
    this.renderStore();
    this.renderLoadout();
    this.renderLoadoutPanel();
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
    caps.chip.title = `Salvage metal nuts (common money) · ${capsRate > 0 ? `${fmtRate(capsRate)} from salvage · ` : ''}earned in combat, spent on upgrades and outfits. ${fmt(s.stats.totalCaps || 0)} lifetime.`;
    const iso = this.resEls.iso;
    setText(iso.val, fmt(s.iso || 0));
    iso.chip.title = `Glowing green isotopes (premium) — from 10-round bosses, tower milestones and contracts. Spent only in the STORE.`;
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
    setText(r.crewBadge, `CREW ${crewCount(s)} / ${CREW_COUNT}`);
    const oreRate = LAYERS.reduce((sum, _, i) => sum + (s.drills[i] || 0) * drillRate(s, i), 0);
    const capsRate = salvageCapsRate(s);
    setText(r.drillRateTotal, `${fmtRate(oreRate)} ore · ${fmtRate(capsRate)} metal nuts`);

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
      const equipped = s.equippedWeapon === weapon.id;
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
      stim.desc.innerHTML = `Heals <b>${p.healPerKill}</b> HP per kill · knockout ${p.deathMs / 1000}s`;
      stim.cost.textContent = 'Max tier reached';
      stim.card.classList.remove('affordable');
      stim.card.classList.add('maxed');
      setCta(stim.cta, 'MAX', 'inuse');
    } else {
      const sc = stimCost(s.combat.gear.stim);
      const sAff = canAfford(s, sc);
      stim.desc.innerHTML = `Heals <b>${p.healPerKill}</b> → <b>${8 + 5 * (s.combat.gear.stim + 1)}</b> HP per kill · faster reboot`;
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

  renderCrew() {
    const s = this.s;
    const r = this.refs;
    const owned = crewCount(s);
    setText(r.rosterBadge, `CREW ${owned} / ${CREW_COUNT}`);
    setText(r.rosterCount, `${owned} RECRUITED · ${CREW_COUNT - owned} REMAINING`);
    setText(r.buffEmptyNote, owned ? `${owned} active` : 'none yet — buy chests in the STORE');

    // aggregate buff chips
    const bonus = crewBonus(s);
    const chips = [];
    if (bonus.ore) chips.push(`ORE +${(bonus.ore * 100).toFixed(1)}%`);
    if (bonus.caps) chips.push(`NUTS +${(bonus.caps * 100).toFixed(1)}%`);
    if (bonus.atk) chips.push(`ATK +${(bonus.atk * 100).toFixed(1)}%`);
    if (bonus.crit) chips.push(`CRIT +${(bonus.crit * 100).toFixed(1)}%`);
    if (bonus.def) chips.push(`DEF +${(bonus.def * 100).toFixed(1)}%`);
    if (bonus.hp) chips.push(`HP +${Math.round(bonus.hp)}`);
    if (bonus.heal) chips.push(`HEAL +${Math.round(bonus.heal)}/kill`);
    if (bonus.speed) chips.push(`SPEED +${(bonus.speed * 100).toFixed(1)}%`);
    if (bonus.xp) chips.push(`XP +${(bonus.xp * 100).toFixed(1)}%`);
    if (bonus.power) chips.push(`VEIN +${(bonus.power * 100).toFixed(1)}%`);
    if (bonus.yield) chips.push(`YIELD +${(bonus.yield * 100).toFixed(1)}%`);
    r.crewBuffChips.innerHTML = chips.length
      ? chips.map((chip) => `<span class="buff-chip">${chip}</span>`).join('')
      : '<span class="buff-none">No crew on the rig yet — buy supply chests in the STORE with isotopes.</span>';

    // roster tiles
    for (const member of CREW_POOL) {
      const tile = this.crewTileEls[member.id];
      if (!tile?.el) continue;
      const has = !!s.crew[member.id];
      tile.el.classList.toggle('owned', has);
      tile.el.classList.toggle('locked', !has);
      setText(tile.state, has ? 'ON THE RIG' : 'NOT RECRUITED');
    }
  }

  openChestResult(chest, member, isNew) {
    const info = CREW_CLASS_MAP[member.cls];
    const body = isNew
      ? `
        <div class="chest-reveal" style="--cc:${info.color}">
          <span class="chest-reveal-tier">${chest.icon} ${chest.name} → CLASS ${member.cls}</span>
          <strong class="chest-reveal-name">${member.name}</strong>
          <span class="chest-reveal-cls">${info.name} CREW</span>
          <span class="chest-reveal-blurb">${member.blurb}</span>
          <span class="chest-reveal-buff">PERMANENT BUFF · ${member.buff}</span>
        </div>
        <p>Crew buffs stack across every recruit and other upgrades. This one works the rig forever, even through a core overload.</p>`
      : `
        <div class="chest-reveal duplicate" style="--cc:${info.color}">
          <span class="chest-reveal-tier">${chest.icon} ${chest.name} → CLASS ${member.cls}</span>
          <strong class="chest-reveal-name">${member.name}</strong>
          <span class="chest-reveal-cls">${info.name} — ALREADY ON THE RIG</span>
          <span class="chest-reveal-buff">DUPLICATE → +${fmt(info.refund)} metal nuts</span>
        </div>
        <p>Duplicate recruits are converted into metal nuts automatically. Higher classes pay out bigger bounties.</p>`;
    this.openModal({
      eyebrow: 'RECRUITMENT',
      title: chest.name,
      kind: 'chest',
      body,
      actions: [{ label: isNew ? 'WELCOME ABOARD' : 'BACK TO WORK', kind: isNew ? '' : '' }],
    });
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

    // ── tower mode reshapes the arena header & strips ─────────
    const tower = s.tower || { floor: 1, best: 0, active: false };
    const towerOpen = towerUnlock(s);
    if (tower.active) {
      setText(r.zoneBadge, `TOWER · FLOOR ${tower.floor}`);
      setText(r.zoneProgress, `BEST ${tower.best || '—'} · TOWER RUN`);
      setText(r.wavePill, enemy ? `${enemy.boss ? 'FLOOR BOSS · ' : ''}FLOOR ${tower.floor}` : `FLOOR ${tower.floor}`);
    } else {
      setText(r.zoneBadge, zone.name.toUpperCase());
      setText(r.zoneProgress, `${c.unlocked} / ${ZONES.length} SECURED`);
      setText(r.wavePill, enemy ? `${enemy.boss ? 'BOSS · ' : ''}WAVE ${c.waves[c.zone] || 1}` : `WAVE ${c.waves[c.zone] || 1}`);
    }
    r.wavePill.classList.toggle('tower', !!tower.active);
    r.wavePill.classList.toggle('boss', !!enemy?.boss);
    this.refs.towerStrip.classList.toggle('active', !!tower.active);
    this.refs.towerStrip.classList.toggle('locked', !towerOpen && !tower.active);
    if (towerOpen || tower.active) {
      const reward = towerReward(tower.floor);
      setText(r.towerFloorText, tower.active
        ? `FLOOR ${tower.floor}${tower.best ? ` · BEST ${tower.best}` : ''}`
        : `BEST ${tower.best || '—'} · FLOOR ${tower.floor} READY`);
      setText(r.towerRewardText, `CLEAR · +${fmt(Math.ceil(reward.caps * (stats.capsMult || 1)))} caps · +${fmt(Math.ceil(reward.oreAmt * (stats.oreMult || 1)))} ${ORES[reward.ore].name.toUpperCase()}`);
      setText(r.towerBtn, tower.active ? 'LEAVE' : 'ENTER');
      r.towerBtn.disabled = false;
    } else {
      setText(r.towerFloorText, 'SEALED · OPENS AT LV.5');
      setText(r.towerRewardText, 'Metal nuts, ore and unique vault gear inside');
      setText(r.towerBtn, 'LV.5');
      r.towerBtn.disabled = true;
    }

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
        sub.textContent = `${z.unlock ? `${z.baseHp} HP` : 'STARTING GROUND'} · WAVE ${c.waves[i]} · ~${fmt(z.caps)} metal nuts/kill`;
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
        sub.textContent = `${z.baseDmg} DMG · ${fmt(z.caps)} metal nuts/kill · ${ORES[z.ore].name}`;
        status.innerHTML = ready ? `<b>UNLOCK</b>${fmt(req.caps)} NUTS` : `<b>LOCKED</b>${fmt(req.caps)} NUTS`;
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
    if (crewCount(s) < 5) return `Recruit crew in the STORE — ${crewCount(s)}/5 aboard.`;
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
    return `
      <div class="gear-slot filled" style="--rarity:${rarity.color}">
        <span class="gs-icon">${slot.icon}</span>
        <span class="gs-body">
          <span class="gs-slot">${slot.name} · <em style="color:${rarity.color}">${rarity.name}</em></span>
          <strong>${item.name}</strong>
          <small>${gearStatLines(item).join(' · ')}</small>
        </span>
        <button class="mini-btn" type="button" data-action="unequip" data-slot="${slot.id}">REMOVE</button>
      </div>`;
  }

  lootCard(item) {
    const slot = GEAR_SLOTS.find((entry) => entry.id === item.slot) || { name: item.slot.toUpperCase() };
    const rarity = rarityOf(item);
    const equipped = this.s.loadout?.[item.slot] === item.id;
    return `
      <div class="loot-card rarity-${rarity.id}${equipped ? ' equipped' : ''}${item.unique ? ' has-unique' : ''}" style="--rarity:${rarity.color}">
        <div class="lc-top"><span class="lc-rarity">${rarity.name.toUpperCase()}</span>${item.unique ? '<span class="lc-unique">✦ UNIQUE</span>' : ''}<span class="lc-level">LV.${item.level}</span></div>
        <strong class="lc-name">${item.name}</strong>
        <span class="lc-slot">${slot.name}${tierChip(item)}</span>
        <div class="lc-stats">${gearStatLines(item).map((line) => `<span>${line}</span>`).join('')}</div>
        <div class="lc-actions">
          <button class="mini-btn" type="button" data-action="${equipped ? 'unequip' : 'equiploot'}" data-id="${item.id}" data-slot="${item.slot}">${equipped ? 'REMOVE' : 'EQUIP'}</button>
          <button class="mini-btn danger" type="button" data-action="scraploot" data-id="${item.id}">SCRAP +${scrapValue(item)}</button>
        </div>
      </div>`;
  }

  /* ── store panel ─────────────────────────────────────────── */
  buildStore() {
    // isotope-priced crew chests
    const chestWrap = $('chestCards');
    chestWrap.innerHTML = CHESTS.map((chest, i) => `
      <button class="card chest-card" type="button" data-action="chest" data-index="${i}" id="chest-${chest.id}" style="--cc:${chest.color}" title="${chest.blurb}">
        <span class="card-icon">${chest.icon}</span>
        <span class="card-body">
          <span class="card-top"><span class="card-title">${chest.name}</span><span class="card-lvl" data-tier>${chest.tier}</span></span>
          <span class="card-desc" data-desc></span>
          <span class="card-cost" data-cost></span>
        </span>
        <span class="card-cta" data-cta>OPEN</span>
      </button>`).join('');
    this.chestEls = CHESTS.map((chest) => {
      const card = $(`chest-${chest.id}`);
      return {
        card,
        desc: card.querySelector('[data-desc]'),
        cost: card.querySelector('[data-cost]'),
        cta: card.querySelector('[data-cta]'),
      };
    });

    // contracts
    const taskWrap = $('storeTasks');
    taskWrap.innerHTML = TASKS.map((task) => `
      <div class="task-row" data-task="${task.id}" id="task-${task.id}">
        <div class="task-copy">
          <strong>${task.name}</strong>
          <span>${task.desc}</span>
        </div>
        <span class="task-progress" data-progress>0 / ${task.goal}</span>
        <span class="task-pay">+${task.iso} ISO</span>
        <button class="btn small" type="button" data-action="claim" data-id="${task.id}" data-claim>CLAIM</button>
      </div>`).join('');
    this.taskEls = Object.fromEntries(TASKS.map((task) => {
      const row = $(`task-${task.id}`);
      return [task.id, { row, progress: row.querySelector('[data-progress]'), claim: row.querySelector('[data-claim]') }];
    }));

    this.storeOffersEl = $('storeOffers');
    this.offerSig = null;
    this.offerEls = [];
  }

  offerCard(item, index) {
    const slot = GEAR_SLOTS.find((entry) => entry.id === item.slot) || { name: item.slot.toUpperCase() };
    const rarity = rarityOf(item);
    const rank = classTierRank(item);
    const classLabel = item.classId
      ? (COMBAT_WEAPON_MAP[item.classId]?.name || item.classId.toUpperCase())
      : '';
    const price = isoValue(item);
    return `
      <div class="loot-card offer-card rarity-${rarity.id}${item.unique ? ' has-unique' : ''}" style="--rarity:${rarity.color}">
        <div class="lc-top"><span class="lc-rarity">${rarity.name.toUpperCase()}</span>${item.unique ? '<span class="lc-unique">✦ UNIQUE</span>' : ''}<span class="lc-level">LV.${item.level}</span></div>
        <strong class="lc-name">${item.name}</strong>
        <span class="lc-slot">${slot.name}${classLabel ? ` · ${classLabel}` : ''}${tierChip(item)}</span>
        <div class="lc-stats">${gearStatLines(item).map((line) => `<span>${line}</span>`).join('')}</div>
        <div class="offer-foot">
          <span class="offer-price">CLASS ${rank + 1} · ${fmt(price)} ISO</span>
          <button class="btn small primary" type="button" data-action="storeoffer" data-index="${index}" data-oafford>BUY</button>
        </div>
      </div>`;
  }

  renderStore() {
    const s = this.s;
    const r = this.refs;
    const iso = s.iso || 0;
    setText(r.storeBadge, `ISO ${fmt(iso)}`);

    // chests
    let unlockedChests = 0;
    this.chestEls.forEach((els, i) => {
      const chest = CHESTS[i];
      const locked = (s.level || 1) < chest.req;
      if (!locked) unlockedChests += 1;
      setText(els.desc, locked ? `Opens at Level ${chest.req}` : chest.odds);
      els.card.title = `${chest.name} — ${chest.blurb} · ${chest.odds}`;
      els.card.classList.toggle('locked', locked);
      els.card.classList.toggle('affordable', !locked && iso >= chest.cost);
      if (locked) {
        setText(els.cost, `LV.${chest.req} REQUIRED`);
        setCta(els.cta, 'LOCKED', 'inuse');
      } else {
        setText(els.cost, `${fmt(chest.cost)} ISO`);
        setCta(els.cta, 'OPEN', 'upgrade');
      }
    });
    setText(r.chestSummary, `${unlockedChests} / ${CHESTS.length} UNLOCKED`);

    // anomaly gear offers — rebuild when the stock changes
    const stock = s.store?.stock || [];
    const sig = stock.map((item) => item.id).join('|');
    if (sig !== this.offerSig) {
      this.offerSig = sig;
      this.storeOffersEl.innerHTML = stock.length
        ? stock.map((item, i) => this.offerCard(item, i)).join('')
        : '<p class="empty-note">The stall is bare — restock it.</p>';
      this.offerEls = stock.map((item, i) => {
        const card = this.storeOffersEl.querySelector(`.offer-card[data-card="${i}"]`) || this.storeOffersEl.children[i];
        return { card, price: card?.querySelector('.offer-price'), buy: card?.querySelector('[data-oafford]') };
      });
    }
    this.offerEls.forEach((els, i) => {
      const item = stock[i];
      if (!item) return;
      const price = isoValue(item);
      const afford = iso >= price;
      els.card.classList.toggle('affordable', afford);
      if (els.buy) els.buy.disabled = !afford;
      if (els.price) setText(els.price, `CLASS ${classTierRank(item) + 1} · ${fmt(price)} ISO`);
    });
    setText(r.storeStockNote, stock.length ? 'TOP-TIER · ISO ONLY' : 'STALL BARE');
    if (r.storeRollBtn) {
      r.storeRollBtn.disabled = iso < STORE_REROLL_COST;
      setText(r.storeRollBtn, `RESTOCK · ${STORE_REROLL_COST} ISO`);
      r.storeRollBtn.classList.toggle('affordable', iso >= STORE_REROLL_COST);
    }

    // contracts
    const progress = taskProgress(s);
    for (const task of TASKS) {
      const els = this.taskEls[task.id];
      if (!els) continue;
      const claimed = !!s.tasks[task.id];
      const value = Math.min(progress[task.metric] || 0, task.goal);
      const done = value >= task.goal;
      setText(els.progress, `${value} / ${task.goal}`);
      els.row.classList.toggle('claimed', claimed);
      els.row.classList.toggle('done', done && !claimed);
      els.claim.disabled = !done || claimed;
      setText(els.claim, claimed ? 'PAID' : 'CLAIM');
    }
    setText(r.storeTaskNote, Object.keys(s.tasks).length ? `${Object.keys(s.tasks).length} / ${TASKS.length} CLAIMED` : 'ONE-TIME ISO BOUNTIES');
  }

  /* ── loadout panel ───────────────────────────────────────── */
  buildLoadoutPanel() {
    this.packView = { sort: 'score', slot: 'all', rank: -1, uniqueOnly: false };
    this.packSig = null;
    this.slotSig = null;

    // filter chips
    const slotChips = $('packSlotChips');
    const slots = [{ id: 'all', label: 'ALL' }, ...GEAR_SLOTS.map((s) => ({ id: s.id, label: s.name })) ];
    slotChips.innerHTML = slots.map((s) => `<button class="control-chip${s.id === 'all' ? ' active' : ''}" type="button" data-action="packfilter" data-filter="slot" data-value="${s.id}">${s.label}</button>`).join('');
    const rankChips = $('packRankChips');
    const ranks = [
      { id: 'any', label: 'ANY QUALITY', rank: -1, unique: false },
      { id: 'rare', label: 'RARE+', rank: 2, unique: false },
      { id: 'epic', label: 'EPIC+', rank: 3, unique: false },
      { id: 'legendary', label: 'LEGENDARY+', rank: 4, unique: false },
      { id: 'unique', label: '✦ UNIQUE', rank: -1, unique: true },
    ];
    rankChips.innerHTML = ranks.map((rk) => `<button class="control-chip${rk.id === 'any' ? ' active' : ''}" type="button" data-action="packfilter" data-filter="rank" data-value="${rk.id}" data-rank="${rk.rank}" data-unique="${rk.unique}">${rk.label}</button>`).join('');

    $('packSort').addEventListener('change', () => {
      this.packView.sort = $('packSort').value;
      this.rebuildPack();
    });

    this.packGridEl = $('packGrid');
    this.loadoutSlotsEl = $('loadoutSlots');
  }

  setPackFilter(target) {
    if (!target) return;
    const filter = target.dataset.filter;
    if (filter === 'slot') this.packView.slot = target.dataset.value;
    else if (filter === 'rank') {
      this.packView.rank = Number(target.dataset.rank);
      this.packView.uniqueOnly = target.dataset.unique === 'true';
    }
    document.querySelectorAll(`.control-chip[data-filter="${filter}"]`).forEach((el) => el.classList.toggle('active', el === target));
    this.rebuildPack();
  }

  packItems() {
    const view = this.packView;
    const items = [...(this.s.inventory || [])];
    const filtered = items.filter((item) => {
      if (view.slot !== 'all' && item.slot !== view.slot) return false;
      if (view.uniqueOnly && !item.unique) return false;
      if (view.rank >= 0 && rarityOf(item).rank < view.rank) return false;
      return true;
    });
    const cmp = {
      score: (a, b) => gearScore(b) - gearScore(a),
      rarity: (a, b) => (rarityOf(b).rank - rarityOf(a).rank) || gearScore(b) - gearScore(a),
      slot: (a, b) => (a.slot || '').localeCompare(b.slot || '') || gearScore(b) - gearScore(a),
      class: (a, b) => String(a.classId || a.slot || '').localeCompare(String(b.classId || b.slot || '')) || gearScore(b) - gearScore(a),
      level: (a, b) => (b.level || 0) - (a.level || 0),
      name: (a, b) => (a.name || '').localeCompare(b.name || ''),
    }[view.sort] || null;
    if (cmp) filtered.sort(cmp);
    return filtered;
  }

  rebuildPack() {
    const items = this.packItems();
    this.packGridEl.innerHTML = items.length
      ? items.map((item) => this.lootCard(item)).join('')
      : '<p class="empty-note">Nothing matches the current filters. Run salvage or kill hostiles to recover gear.</p>';
  }

  renderLoadoutPanel() {
    const s = this.s;
    const r = this.refs;
    const score = this.loadoutScore();

    // equipped slots (rebuild only when they change)
    const slotSig = GEAR_SLOTS.map((slot) => `${slot.id}:${s.loadout?.[slot.id] || '-'}`).join('|');
    const slotsChanged = slotSig !== this.slotSig;
    if (slotsChanged) {
      this.slotSig = slotSig;
      this.loadoutSlotsEl.innerHTML = GEAR_SLOTS.map((slot) => this.gearSlotMarkup(slot)).join('');
    }

    // fitted bonuses
    const gs = gearStats(s);
    const bonuses = Object.entries(gs)
      .map(([key, value]) => {
        const label = { damage: 'DMG', crit: 'CRIT', speed: 'SPEED', hp: 'HP', heal: 'HEAL', defense: 'DEF', ore: 'ORE', caps: 'NUTS', xp: 'XP', power: 'POWER', yield: 'YIELD', cooldown: 'SWING' }[key] || key.toUpperCase();
        const pct = ['damage', 'crit', 'speed', 'defense', 'ore', 'caps', 'xp', 'power', 'yield', 'cooldown'].includes(key);
        return `<span>${label} ${pct ? `+${(value * 100).toFixed(1)}%` : `+${Math.round(value)}`}</span>`;
      })
      .join('');
    r.bonusSummary.innerHTML = bonuses || 'No gear fitted';

    // salvage pack summary + rebuild when the pack or filters change
    const inventory = s.inventory || [];
    setText(r.packBadge, `${inventory.length} / ${MAX_INVENTORY} ITEMS`);
    setText(r.gearScore, `GEAR ${score}`);
    setText(r.loadCaps, fmt(s.caps));
    const runSig = `${inventory.length}|${slotSig}|${this.packView.sort}|${this.packView.slot}|${this.packView.rank}|${this.packView.uniqueOnly}`;
    if (runSig !== this.packSig) {
      this.packSig = runSig;
      this.rebuildPack();
      const cost = lootRunCost(s);
      setText(r.salvageCost2, fmt(cost));
      r.salvageRunBtn2.classList.toggle('affordable', canAfford(s, { caps: cost }));
    }
  }

  openLootResults(items, title = 'Recovered gear') {
    const list = (items || []).filter(Boolean);
    this.lastLoot = { ids: list.map((item) => item.id), title };
    const body = list.length
      ? `<p>Recovered <strong>${list.length}</strong> item${list.length > 1 ? 's' : ''}. Equip now or scrap for metal nuts.</p>
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
    if (this.modalKind === 'loot') {
      const ids = this.lastLoot?.ids || [];
      const items = ids.map((id) => this.s.inventory.find((item) => item.id === id)).filter(Boolean);
      this.packSig = null; // force pack rebuild on the loadout panel
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
