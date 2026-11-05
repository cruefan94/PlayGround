// ==== VIETNAM '65-'73 WEAPON DATABASE ====
// W(name, cat, dmg, rpm, mag, reload(s), spread(rad), range(px), mode, pellets)
// cats: AR assault/carbine, BR battle rifle, SM submachine, SG shotgun, SN bolt/precision, MG LMG, PI pistol, SP special
const W = (n, c, d, r, m, rl, sp, rng, md, pc = 1) => ({ n, c, d, r, m, rl, sp, rng, md, pc });

const WEAPONS = [
  // ---- Assault rifles & carbines ----
  W('Colt 601', 'AR', 26, 750, 20, 2.3, .035, 620, 'auto'),
  W('XM16E1', 'AR', 25, 800, 30, 2.4, .04, 640, 'auto'),
  W('M16A1', 'AR', 26, 800, 30, 2.2, .038, 660, 'auto'),
  W('Colt 605 (CAR Rifle)', 'AR', 26, 800, 30, 2.2, .04, 600, 'auto'),
  W('Colt 607 Commando', 'AR', 24, 780, 30, 2.1, .045, 540, 'auto'),
  W('XM177E1 Commando', 'AR', 23, 780, 30, 2.0, .05, 500, 'auto'),
  W('XM177E2 Commando', 'AR', 24, 800, 30, 2.0, .05, 520, 'auto'),
  W('CAR-15 SMG (XM177, folding stock)', 'AR', 22, 800, 30, 1.9, .055, 470, 'auto'),
  W('Colt 653 CAR-15 Carbine', 'AR', 25, 800, 30, 2.1, .042, 560, 'auto'),
  W('XM177E2 Grenadier (XM148)', 'AR', 24, 780, 30, 2.2, .05, 520, 'auto'),
  W('HK33A2', 'AR', 30, 700, 25, 2.5, .035, 620, 'auto'),
  W('Valmet M62', 'AR', 30, 700, 30, 2.6, .045, 600, 'auto'),
  W('Stoner 63A Rifle', 'AR', 27, 750, 30, 2.6, .038, 600, 'auto'),
  W('Stoner 63A Commando', 'AR', 25, 760, 30, 2.3, .05, 530, 'auto'),
  W('F1 SMG (Australia)', 'SM', 20, 600, 34, 2.2, .055, 420, 'auto'),
  W('Owen Gun (Australia)', 'SM', 18, 700, 33, 2.0, .06, 400, 'auto'),
  W('Sterling L2A3', 'SM', 17, 550, 34, 2.0, .05, 430, 'auto'),
  W('Carl Gustaf m/45 "Swedish K"', 'SM', 19, 600, 36, 2.2, .05, 440, 'auto'),
  W('Uzi Model A', 'SM', 16, 600, 32, 1.8, .055, 380, 'auto'),
  W('FAL 50.00 (RVN surplus)', 'BR', 42, 600, 20, 2.6, .04, 680, 'auto'),
  W('MAS 49/56 (French surplus)', 'BR', 38, 380, 5, 2.8, .03, 660, 'semi'),

  // ---- Battle rifles ----
  W('M1 Garand', 'BR', 45, 300, 8, 2.6, .028, 700, 'semi'),
  W('M1C Garand (scoped)', 'SN', 48, 260, 8, 2.7, .035, 720, 'semi'),
  W('M14', 'BR', 48, 550, 20, 2.8, .032, 700, 'semi'),
  W('M14 (full auto)', 'BR', 46, 700, 20, 2.9, .055, 680, 'auto'),
  W('M14A1', 'BR', 47, 640, 20, 2.9, .04, 690, 'auto'),
  W('M1A National Match', 'SN', 50, 380, 20, 2.8, .022, 760, 'semi'),
  W('L1A1 SLR (Australia)', 'BR', 42, 500, 20, 2.6, .035, 700, 'semi'),
  W('FN FAL 50.63 Para', 'BR', 41, 550, 20, 2.5, .038, 690, 'auto'),
  W('G3A3', 'BR', 43, 600, 20, 2.7, .035, 690, 'auto'),
  W('Beretta BM59', 'BR', 40, 600, 20, 2.5, .033, 680, 'auto'),
  W('M1 Carbine', 'BR', 30, 480, 15, 2.3, .03, 520, 'semi'),
  W('M1A1 Carbine Para (folding)', 'BR', 30, 480, 15, 2.3, .03, 520, 'semi'),
  W('M2 Carbine (select fire)', 'BR', 29, 800, 30, 2.5, .052, 520, 'auto'),
  W('Type 56 SKS (captured)', 'BR', 38, 320, 10, 2.9, .028, 640, 'semi'),
  W('Type 38 Arisaka (battle pickup)', 'BR', 42, 200, 5, 3.2, .028, 620, 'bolt'),
  W('Type 99 Arisaka (battle pickup)', 'BR', 43, 200, 5, 3.2, .027, 620, 'bolt'),

  // ---- Submachine guns ----
  W('Thompson M1928A1', 'SM', 26, 640, 30, 2.7, .06, 400, 'auto'),
  W('Thompson M1A1', 'SM', 25, 700, 30, 2.5, .058, 410, 'auto'),
  W('M3 Grease Gun', 'SM', 24, 450, 30, 2.3, .055, 370, 'auto'),
  W('M3A1 Grease Gun', 'SM', 24, 450, 30, 2.2, .055, 370, 'auto'),
  W('Madsen M-50 (ARVN issue)', 'SM', 20, 500, 32, 2.1, .06, 360, 'auto'),
  W('PPSh-41 (captured)', 'SM', 21, 900, 35, 2.6, .07, 380, 'auto'),
  W('Chicom Type 50 SMG', 'SM', 21, 800, 35, 2.5, .068, 370, 'auto'),
  W('K-50M (NVA)', 'SM', 20, 700, 35, 2.4, .065, 380, 'auto'),
  W('MAT-49 (French surplus)', 'SM', 21, 600, 32, 2.2, .055, 380, 'auto'),
  W('Sten Mk V', 'SM', 16, 550, 32, 2.1, .07, 350, 'auto'),
  W('Austen Mk I (war trophy)', 'SM', 15, 550, 30, 2.2, .072, 340, 'auto'),

  // ---- Shotguns ----
  W('Ithaca 37 Riot Gun', 'SG', 20, 110, 5, 3.4, .1, 330, 'pump', 6),
  W('Ithaca 37 Stakeout (PIGS)', 'SG', 22, 100, 4, 3.2, .13, 280, 'pump', 7),
  W('Ithica 37 Deerslayer', 'SG', 24, 95, 4, 3.3, .12, 290, 'pump', 7),
  W('Winchester Model 1200 Riot', 'SG', 21, 110, 5, 3.4, .1, 330, 'pump', 6),
  W('Winchester Model 1897 Trench', 'SG', 23, 140, 5, 3.6, .11, 310, 'pump', 7),
  W('Winchester Model 1897 Riot', 'SG', 22, 140, 5, 3.6, .105, 320, 'pump', 6),
  W('Winchester Model 1897 Field', 'SG', 24, 135, 5, 3.6, .09, 340, 'pump', 5),
  W('Winchester Model 12 Trench Gun', 'SG', 23, 130, 5, 3.5, .11, 310, 'pump', 7),
  W('Winchester Model 12 Riot Gun', 'SG', 22, 130, 5, 3.5, .1, 320, 'pump', 6),
  W('Remington Model 870 Wingmaster', 'SG', 21, 110, 5, 3.4, .1, 330, 'pump', 6),
  W('Remington Model 870 Police', 'SG', 22, 110, 6, 3.4, .095, 340, 'pump', 6),
  W('Remington Model 31', 'SG', 22, 120, 5, 3.5, .1, 330, 'pump', 6),
  W('Remington Model 11-48 Autoloader', 'SG', 20, 160, 5, 3.3, .11, 320, 'semi', 6),
  W('Remington Model 11', 'SG', 21, 150, 5, 3.4, .12, 310, 'semi', 6),
  W('Mossberg 500A Riot', 'SG', 20, 110, 6, 3.3, .1, 330, 'pump', 6),
  W('Mossberg 500 AT Shotgun', 'SG', 21, 110, 5, 3.3, .1, 330, 'pump', 6),
  W('Browning Auto-5', 'SG', 23, 180, 5, 3.5, .13, 320, 'semi', 5),
  W('Winchester Super X Model 1', 'SG', 21, 170, 4, 3.3, .12, 320, 'semi', 6),
  W('Stevens 77E (ARVN shotgun)', 'SG', 20, 110, 5, 3.3, .11, 320, 'pump', 6),

  // ---- Sniper / bolt ----
  W('Springfield M1903A4 (scoped)', 'SN', 60, 60, 5, 3.4, .012, 900, 'bolt'),
  W('Springfield M1903A3', 'BR', 52, 90, 5, 3.2, .02, 780, 'bolt'),
  W('Remington M700 ADL', 'SN', 58, 70, 4, 3.4, .014, 880, 'bolt'),
  W('Remington M700 BDL', 'SN', 59, 70, 4, 3.4, .013, 880, 'bolt'),
  W('Remington XP-100 Pistol Carbine', 'SN', 45, 90, 4, 3.0, .03, 640, 'bolt'),
  W('USMC M40 (Remington build)', 'SN', 62, 60, 5, 3.6, .01, 920, 'bolt'),
  W('Winchester Model 70 (Brass Expo)', 'SN', 57, 60, 5, 3.4, .012, 900, 'bolt'),
  W('Mauser K98k (battle pickup)', 'SN', 50, 70, 5, 3.3, .018, 820, 'bolt'),
  W('Mosin 91/30 (battle pickup)', 'SN', 55, 55, 5, 3.6, .02, 850, 'bolt'),
  W('SVD Dragunov (battle trophy)', 'SN', 48, 130, 10, 2.9, .018, 800, 'semi'),
  W('XM21 (M14 build)', 'SN', 52, 260, 20, 2.9, .016, 820, 'semi'),
  W('M21 (M14 build)', 'SN', 53, 260, 20, 2.9, .015, 830, 'semi'),

  // ---- Light machine guns ----
  W('M60 GPMG', 'MG', 36, 500, 100, 5.0, .075, 640, 'auto'),
  W('M60D (door gun)', 'MG', 35, 500, 150, 5.5, .09, 640, 'auto'),
  W('M1919A4 .30 Browning', 'MG', 40, 450, 150, 5.8, .08, 660, 'auto'),
  W('M1919A6 (light barrel)', 'MG', 38, 450, 125, 5.6, .075, 620, 'auto'),
  W('M1918A2 BAR', 'MG', 42, 470, 20, 3.2, .05, 620, 'auto'),
  W('L2A1 (Aus. FAL LMG)', 'MG', 38, 550, 30, 3.4, .055, 600, 'auto'),
  W('Stoner 63A LMG', 'MG', 34, 650, 75, 4.4, .07, 620, 'auto'),
  W('RPD (captured)', 'MG', 33, 650, 100, 4.5, .07, 600, 'auto'),
  W('RPK (captured)', 'MG', 35, 600, 75, 4.3, .065, 620, 'auto'),

  // ---- Pistols & revolvers ----
  W('M1911A1 .45', 'PI', 38, 350, 7, 1.7, .035, 360, 'semi'),
  W('Colt Commander .45', 'PI', 36, 380, 8, 1.6, .035, 360, 'semi'),
  W('Colt Python .357', 'PI', 52, 140, 6, 3.0, .022, 400, 'rev'),
  W('Colt Trooper .357', 'PI', 45, 140, 6, 3.0, .025, 390, 'rev'),
  W('Colt Official Police .38', 'PI', 32, 140, 6, 3.0, .028, 360, 'rev'),
  W('S&W Model 10 .38 (M&P)', 'PI', 30, 140, 6, 3.0, .03, 350, 'rev'),
  W('S&W Model 15 K-38', 'PI', 33, 150, 6, 3.0, .026, 360, 'rev'),
  W('S&W Model 19 Combat Magnum', 'PI', 42, 150, 6, 3.0, .024, 390, 'rev'),
  W('S&W Model 36 Chief Special', 'PI', 28, 140, 5, 2.6, .036, 300, 'rev'),
  W('Colt Detective Special', 'PI', 28, 150, 6, 2.6, .04, 300, 'rev'),
  W('Colt New Service .45', 'PI', 42, 120, 6, 3.2, .03, 370, 'rev'),
  W('M1917 Revolver .45', 'PI', 40, 120, 6, 3.2, .032, 360, 'rev'),
  W('Ruger Speed Six .357', 'PI', 44, 140, 6, 3.0, .026, 380, 'rev'),
  W('Ruger Security Six', 'PI', 43, 140, 6, 3.0, .025, 380, 'rev'),
  W('Ruger Standard .22 (side armory)', 'PI', 20, 260, 9, 2.2, .03, 320, 'semi'),
  W('Beretta M1951 (ARVN issue)', 'PI', 32, 300, 8, 1.7, .033, 350, 'semi'),
  W('Walther P38 (battle pickup)', 'PI', 30, 320, 8, 1.7, .032, 340, 'semi'),
  W('Luger P08 (souvenir piece)', 'PI', 28, 320, 8, 1.8, .034, 340, 'semi'),
  W('FN Hi-Power', 'PI', 32, 300, 13, 1.9, .032, 350, 'semi'),
  W('Makarov PM (captured)', 'PI', 26, 300, 8, 1.7, .035, 320, 'semi'),
  W('TT-33 Tokarev (captured)', 'PI', 34, 300, 7, 1.7, .033, 350, 'semi'),
  W('Nambu Type 14 (war trophy)', 'PI', 26, 280, 8, 1.8, .04, 320, 'semi'),

  // ---- Special ----
  W('M72 LAW rocket (single use x3 ammo)', 'SP', 160, 40, 3, 4.2, .01, 760, 'semi'),
  W('M79 Blooper (40mm)', 'SP', 120, 45, 1, 3.2, .02, 560, 'semi'),
  W('XM148 Grenade Launcher', 'SP', 110, 40, 5, 3.8, .025, 560, 'semi'),
  W('M203 (under-barrel builds)', 'SP', 110, 40, 5, 3.8, .025, 560, 'semi'),
  W('M2A1-7 Flamethrower', 'SP', 14, 900, 200, 5.0, .08, 190, 'auto'),
  W('M-14 "Bloop Tube" Konverter', 'SP', 95, 45, 1, 3.0, .025, 520, 'semi'),
];

// ---- ARMOR (prices in requisition) ----
const ARMORS = [
  { n: 'Fatigue Shirt (unarmored)', prot: 0,    spd: 1.00, p: 0,   desc: 'Plain jungle fatigues. Maximum mobility, nothing stopping bullets.' },
  { n: 'SOG Recon Rig',             prot: .12,  spd: .99,  p: 120, desc: 'Light commander rig, harness + side plates. Recon teams ran these — fast and roomy.' },
  { n: 'M1952A Flak Vest',          prot: .16,  spd: .93,  p: 180, desc: 'The classic nylon flak jacket of early Vietnam. Stops frags, not much else.' },
  { n: 'M1955 Flak Vest',           prot: .19,  spd: .91,  p: 240, desc: 'Heavier model, used late in the war. Chafes your shoulders raw.' },
  { n: 'M67 Nylon Chest Rig',       prot: .2,   spd: .92,  p: 300, desc: 'Lighter nylon carrier with quick-release. Popular with LRRP teams.' },
  { n: 'M69 Body Armor',            prot: .24,  spd: .87,  p: 380, desc: '1968 successor with better shock padding. Slows you noticeably.' },
  { n: 'USMC Fragmentation Vest',   prot: .26,  spd: .85,  p: 460, desc: 'Marine pattern, held up through Hue and Khe Sanh.' },
  { n: 'M69 + Ceramic Plate Rig',   prot: .38,  spd: .76,  p: 650, desc: 'Chicken plates bolted into a flak jacket. On foot this rig is misery — but it saves lives.' },
];

// ---- PERIOD-ACCURATE CLOTHING (cosmetic + tiny modifiers) ----
const CLOTHES = [
  { n: 'OG-107 Cotton Sateen',      body: '#4a5b3a', alt: '#3d4b30', p: 0,  desc: 'The standard garrison fatigue of early I Corps. Hot, stiff, honest.' },
  { n: 'Jungle Fatigues Poplin',    body: '#55663f', alt: '#46552f', p: 30, desc: 'Ripstop cotton poplin, 1963 pattern. Breathes, dries fast, tears slow.' },
  { n: 'Jungle Fatigues ERDL',      body: '#4b5d34', alt: '#7a6b3e', p: 60, desc: 'Camouflage print evaporative pattern for lowland jungle.' },
  { n: 'Tiger Stripe Jacket',       body: '#3d4a2c', alt: '#8a5f2b', p: 90, desc: 'Locally made Tiger Stripe. Recon, CIDG, advisors — the jungle stalker\'s rig.' },
  { n: 'Highland ERDL Jacket',      body: '#324a33', alt: '#22331f', p: 70, desc: 'Highland green ERDL pattern. For the triple canopy.' },
  { n: 'Black Curtains (SOG)',      body: '#24231f', alt: '#171614', p: 110, desc: 'Dye-blackened fatigues for night raids. SOG teams swore by them.' },
];
const BOOTS = [
  { n: 'Jungle Boot M-62',               spd: 1.00, p: 0,   desc: 'Canvas & leather tropical boot, screened insole. Standard issue.' },
  { n: 'Jungle Boot M-64 (spike prot.)', spd: .98,  p: 40,  desc: 'Spike-protective sole — punji stakes must not ruin your night.' },
  { n: 'Recon "Slicker" Boots',          spd: 1.03, p: 150, desc: 'Stripped, taped and re-laced for silence and speed. Scout teams run faster.' },
];
const HEADWEAR = ['OG-106 Helmet', 'Bandana', 'Boonie Hat', 'Bare Head'];
const SKINS = ['#e6b78e', '#c98d5f', '#9a6a43', '#6b452e'];
const PAINT = ['Clean Face', 'Jungle Stripe', 'Full Camo'];

// Enemy types used by waves
const ENEMY_TYPES = {
  grunt:    { hp: 35,  spd: 70,  r: 11, weapon: 'AK-47 r?', dmg: 8,  rpm: 90,  range: 420, spread: .12, score: 15,  col: '#4a5b3a' },
  rusher:   { hp: 28,  spd: 130, r: 10, weapon: null, dmg: 18, rpm: 0, range: 0, spread: 0, score: 20,  col: '#6d5b3a' },
  sniper:   { hp: 30,  spd: 46,  r: 11, weapon: 'Mosin 91/30', dmg: 26, rpm: 22, range: 680, spread: .03, score: 40,  col: '#3a4b2a' },
  grenadier:{ hp: 50,  spd: 58,  r: 12, weapon: 'M79 BG (VC)', dmg: 30, rpm: 28, range: 520, spread: .06, score: 45,  col: '#55513a' },
  sapper:   { hp: 24,  spd: 112, r: 10, weapon: null, dmg: 45, rpm: 0, range: 0, spread: 0, score: 30,  col: '#2a2a2a', explode: 60 },
  heavy:    { hp: 110, spd: 44,  r: 13, weapon: 'RPK r', dmg: 11, rpm: 210, range: 470, spread: .14, score: 90,  col: '#4b4b3a' },
};

// BOSSES: every 10th round. Rotate through these, HP scales per cycle.
const BOSSES = [
  { name: 'NVA Colonel Tran "The Iron Buffalo"', hp: 900,  spd: 52,  r: 22, dmg: 14, score: 1200, color: '#3a3a2a', gun: 'RPK r',  bursts: 6, cash: 300 },
  { name: 'VC Sapper King "Bamboo Viper"',        hp: 760,  spd: 80,  r: 20, dmg: 12, score: 1200, color: '#1e2418', gun: null,    bursts: 0, cash: 300 },
  { name: 'Captain Reyes (rogue MACV advisor)',   hp: 1000, spd: 60,  r: 22, dmg: 20, score: 1500, color: '#5a4a2a', gun: 'M60 r',  bursts: 9, cash: 400 },
  { name: 'NVA General Volkhov (Soviet advisor)', hp: 1300, spd: 48,  r: 24, dmg: 22, score: 2000, color: '#2a2f3a', gun: 'SVD r',  bursts: 5, cash: 500 },
];

// ECON->SQUAD DATA LOG

// Economy tuning
const ECON = {
  startReq: 80,
  clearBase: 60,      // requisition for clearing a round
  clearPerRound: 16,  // added per round number
  killRatio: 0.45,    // of enemy score -> cash
};

// ============ SQUAD — HUMAN REINFORCEMENTS ============
// 5 rarity tiers x 10 soldiers each. Ranks rise with tier; units come from US, ARVN (South Vietnam),
// ROK Marines (South Korea) and Australian detachments, matching the in-country order of battle.
const TIER_NAMES = ['COMMON', 'UNCOMMON', 'RARE', 'ULTRA RARE', 'WAR GRADE'];
const TIER_COL = ['#8a8065', '#5a7a45', '#3a6aa8', '#7a3a8a', '#b8860b'];
const NAT_COL = { US: ['#4a5b3a', '#3d4b30'], ARVN: ['#6b5a38', '#8a5f2b'], ROK: ['#3f5a6e', '#32474f'], AUS: ['#55663f', '#46552f'] };
const NAT_LABEL = { US: 'US ARMY', ARVN: 'ARVN (S. VIETNAM)', ROK: 'ROK MARINES', AUS: 'AUSTRALIAN SAS' };
const TRAIT_INFO = {
  gunner:   { n: 'Belt-Fed Gunner',       d: 'Rakes hostile lines with an M60 off its drum.' },
  marksman: { n: 'Designated Marksman',   d: 'Picks single high-value shots out of the treeline.' },
  scatter:  { n: 'Tunnel Rat',           d: 'Takes point with a shotgun and a flashlight. Clears close brush.' },
  medic:    { n: 'Medic / Corpsman',     d: 'Patches you up mid-firefight from the aid bag.' },
  frag:     { n: 'Grenadier',            d: 'Lobs 40mm and frags into clustered hostiles on a timer.' },
  jammer:   { n: 'RTO / Arty Spotter',   d: 'Calls spotting rounds — hostiles in radius slow to a crawl under fire.' },
  supply:   { n: 'Ammo Bearer',          d: 'Humps crates up to your position on patrol.' },
  taunt:    { n: 'Platoon Sergeant',     d: 'Barks over the net — hostiles in radius turn on him instead.' },
};
// name, nationality — ranks rise by tier (private → colonel)
const SOLDIER_NAMES = [
  // Tier 1 — COMMON: green privates & PFCs
  [['PFC L. "Butterbar" Vance', 'US'], ['Pvt. Nguyen Van Duong', 'ARVN'], ['Pvt. D. Kowalski', 'US'], ['Pvt. "Texas" Bragg', 'US'],
   ['Pvt. Kim Min-Jun', 'ROK'], ['PFC B. Serrano', 'US'], ['Pvt. Odell Grant', 'US'], ['Pvt. Sonny Trujillo', 'US'],
   ['Pvt. Le Minh Tub', 'ARVN'], ['Pvt. "Radio" Byrd', 'US']],
  // Tier 2 — UNCOMMON: corporals & sergeants
  [['Cpl. Reyes', 'US'], ['Sgt. Okafor', 'US'], ['Cpl. Tran Van Loc', 'ARVN'], ['Cpl. "Sledge" Mahar', 'US'],
   ['Sgt. Park Ji-Ho', 'ROK'], ['Cpl. Bluey Frazer', 'AUS'], ['Sgt. Mae Delgado', 'US'], ['Cpl. Whitfield', 'US'],
   ['Sgt. Tran Hoi', 'ARVN'], ['Cpl. Dan "Slick" Rivers', 'US']],
  // Tier 3 — RARE: staff sergeants & lieutenants
  [['2Lt. Eliot Vance', 'US'], ['SSgt. Marcus Boone', 'US'], ['1Lt. Pham Quang Dien', 'ARVN'], ['SSgt. "Digger" Ross', 'AUS'],
   ['1Lt. Rhee Woo-Jin', 'ROK'], ['SSgt. Gloria Reyes', 'US'], ['2Lt. Tom Corliss', 'US'], ['SSgt. "Deacon" Wells', 'US'],
   ['1Lt. Thuy Nguyen', 'ARVN'], ['SSgt. Eugene Otto', 'US']],
  // Tier 4 — ULTRA RARE: captains, majors, SOG & Ranger officers
  [['Cpt. Jack "Spectre" Corso', 'US'], ['Maj. Tri Van Hau', 'ARVN'], ['Cpt. James Corrigan', 'US'], ['Maj. Hwang Dae-Sun', 'ROK'],
   ['Cpt. "Whisper" Kohl', 'US'], ['Maj. Everett Shaw', 'US'], ['Cpt. Quang Vinh Loc', 'ARVN'], ['Maj. "Wirebrush" Doyle', 'AUS'],
   ['Cpt. Sarah Corliss', 'US'], ['Maj. "Static" Rousseau', 'US']],
  // Tier 5 — WAR GRADE: lieutenant colonels & full colonels
  [['LtCol. John "Anvil" Vale', 'US'], ['Col. Bao Dai Loc', 'ARVN'], ['LtCol. Marcus Rhyne', 'US'], ['Col. Park Seung-Ro', 'ROK'],
   ['LtCol. "Hanoi Hotel" Kane', 'US'], ['Col. Everett Mace', 'US'], ['LtCol. Nguyen Van Huy', 'ARVN'], ['Col. Arlo Quist', 'US'],
   ['LtCol. Marie Fournier', 'AUS'], ['Col. "Big Red" Duquesne', 'US']],
];
// trait pools per tier (later tiers unlock heavier specialties)
const TRAIT_POOL = [
  ['gunner', 'scatter', 'supply', 'medic'],
  ['gunner', 'scatter', 'medic', 'frag', 'supply'],
  ['gunner', 'marksman', 'scatter', 'frag', 'jammer'],
  ['marksman', 'gunner', 'frag', 'jammer', 'taunt'],
  ['marksman', 'gunner', 'frag', 'jammer', 'taunt', 'medic'],
];
const BUFF_POOL = ['dmg', 'spd', 'hp', 'prot', 'reload'];
const MATES = [];
for (let t = 1; t <= 5; t++) {
  const baseHp = [70, 105, 150, 210, 300][t - 1];
  const dmgMul = [1, 1.35, 1.8, 2.4, 3.2][t - 1];
  const buffVal = [.04, .06, .09, .13, .18][t - 1];
  const pool = TRAIT_POOL[t - 1];
  SOLDIER_NAMES[t - 1].forEach(([n, nat], i) => {
    MATES.push({
      name: n, nat, tier: t, trait: pool[i % pool.length],
      buff: BUFF_POOL[(i + t) % BUFF_POOL.length], buffVal,
      hp: baseHp + i * 6, dmgMul, col: TIER_COL[t - 1],
    });
  });
}
const MATE_VAL = t => Math.round([55, 95, 150, 230, 340][t - 1]); // reassignment value when roster is full

// Player buff labels
const BUFF_LABEL = { dmg: 'WEAPON DMG', spd: 'MOVE SPEED', hp: 'MAX HP', prot: 'ARMOR', reload: 'RELOAD RATE' };

// ============ REINFORCEMENT OFFICE — 3 price ranges ============
// Each package: requisition price; grants 1 character gear item + 2 soldier transfers (weighted tier).
const CRATES = [
  { n: 'FIELD TRANSFER PAPERS', price: 160,
    d: 'Detachment orders stamped by a harried S-1 clerk. Green troops straight off the bus and whatever gear came in the same crate.',
    tierW: [70, 25, 5, 0, 0] },
  { n: 'THEATER ROTATION ORDERS', price: 380,
    d: 'Mandated rotation paperwork from MACV. Line-certified troops cycle in — sergeants, medics, the occasional gem.',
    tierW: [15, 45, 30, 10, 0] },
  { n: 'MACV-SOG BLACK FILE', price: 720,
    d: 'Names that never existed, signatures that were never signed. Operators and officers nobody can see — and no paperwork to stop them.',
    tierW: [0, 10, 35, 40, 15] },
];

// ============ AREAS — one biome per level ============
const BIOMES = [
  { n: 'VIETNAMESE VILLAGE', short: 'VILLAGE',
    hint: 'Huts, fences and pigpens. Fight door to door around Tonle Sap hamlets.',
    types: ['hut', 'hut', 'hut', 'bags', 'trunk'], slow: null },
  { n: 'RICE PADDIES', short: 'PADDIES',
    hint: 'Flooded terraces. Wading through water bogs you down — use the dikes.',
    types: ['trunk', 'trunk', 'bags', 'bags'], slow: .58 },
  { n: 'DENSE JUNGLE', short: 'JUNGLE',
    hint: 'Triple canopy. Sightlines are short and the brush is everywhere.',
    types: ['trunk', 'trunk', 'trunk', 'trunk', 'trunk', 'bags'], slow: null },
  { n: 'OPEN FIELD', short: 'OPEN',
    hint: 'Burned ground and shell craters. Long sightlines, no cover but sandbags.',
    types: ['bags', 'bags', 'crater', 'crater', 'crater'], slow: null },
];
