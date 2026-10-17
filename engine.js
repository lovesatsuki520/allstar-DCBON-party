// ============================================================================
// 《DC BON 全明星自動戰棋》— 空間棋盤與聖火演出戰鬥引擎 (engine.js)
// ============================================================================

const BOARD_COLS = 6;
const BOARD_ROWS = 4;
const MAX_ACTIVE_ALLIES = 4;
const MAX_BENCH_ALLIES = 2;
const MAX_STARS = 3;
const SUDDEN_DEATH_START_TICK = 120; // 第 120 次行動啟動死鬥疲勞

let currentStage = 1;
const maxStage = 8;
let playerLives = 2;
let rerollsLeft = 2; // 全場共用 2 次重骰

let playerRoster = []; // 場上主力 (最多 4 人，帶 gridX, gridY)
let benchRoster = [null, null]; // 2 格冷板凳
let enemyRoster = [];  // 敵方陣容 (帶 gridX, gridY)
let playerAugments = [];

let selectedSlot = null; // { type: 'board' | 'bench', x, y, index }
let inspectedHero = null;

// 戰鬥狀態與回合暫停控制
let inBattle = false;
let battlePaused = false;
let stepOnceRequested = false;
let actionTickCount = 0;
let fatigueStacks = 0;
let nemesisEventCompleted = false;

// Cut-in 序列佇列（確保同時開大絕不重疊，且延長展示時間）
let cutInChain = Promise.resolve();

// 目前彈窗重骰回呼
let currentDraftRerollCallback = null;

// ================= 1. 初始化與選秀系統 =================
window.addEventListener('DOMContentLoaded', () => {
  inspectedHero = HERO_POOL[0];
  renderInspector(inspectedHero);
  startNewGame();
});

function startNewGame() {
  currentStage = 1;
  playerLives = 2;
  rerollsLeft = 2;
  playerRoster = [];
  benchRoster = [null, null];
  enemyRoster = [];
  playerAugments = [];
  nemesisEventCompleted = false;
  inBattle = false;
  battlePaused = false;
  actionTickCount = 0;
  fatigueStacks = 0;

  clearBattleLog();
  addLog('🔥 歡迎來到深淵戰棋！請先招募你的初始主力英雄。');
  showHeroDraft('🌟 初始英雄招募（第 1 關）', '選擇 1 名英雄加入戰場（擁有 2 格冷板凳與全場 2 次重骰機會）');
}

function getEligibleHeroPool(stage, forEnemy = false) {
  return HERO_POOL.filter(h => {
    if (h.minStage && stage < h.minStage) return false;
    if (!forEnemy) {
      const existing = findPlayerUnitById(h.id);
      if (existing && existing.stars >= MAX_STARS) return false;
    }
    return true;
  });
}

function findPlayerUnitById(id) {
  return playerRoster.find(u => u.id === id) || benchRoster.find(u => u && u.id === id);
}

function getRandomItems(arr, count) {
  const copy = [...arr];
  const result = [];
  while (result.length < count && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

function handleModalReroll() {
  if (rerollsLeft <= 0 || !currentDraftRerollCallback) return;
  rerollsLeft--;
  updateTopBar();
  currentDraftRerollCallback();
}

function updateModalRerollButton() {
  const btn = document.getElementById('modalRerollBtn');
  if (!currentDraftRerollCallback) {
    btn.classList.add('hidden');
    return;
  }
  btn.classList.remove('hidden');
  btn.textContent = `🎲 重骰選項 (剩餘 ${rerollsLeft} 次)`;
  btn.disabled = rerollsLeft <= 0;
}

function showHeroDraft(title, subtitle) {
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const subEl = document.getElementById('modalSub');
  const grid = document.getElementById('modalGrid');

  overlay.classList.remove('hidden');
  titleEl.textContent = title;
  subEl.textContent = subtitle;

  const renderChoices = () => {
    grid.innerHTML = '';
    const pool = getEligibleHeroPool(currentStage, false);
    const choices = getRandomItems(pool, 3);

    choices.forEach(tmpl => {
      const existing = findPlayerUnitById(tmpl.id);
      const nextStar = existing ? existing.stars + 1 : 1;
      const isFull = !existing && playerRoster.length >= MAX_ACTIVE_ALLIES && benchRoster.every(b => b !== null);

      const card = document.createElement('div');
      card.className = 'choice-card';
      const tagsHtml = (tmpl.tags || []).map(t => `<span class="emoji-tag">${t}</span>`).join('');

      card.innerHTML = `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:1.8rem;">${tmpl.icon}</span>
            <span style="font-weight:900;color:var(--p5-gold);">${existing ? `⬆️ 升至 ★${nextStar}` : '🆕 新招募 ★1'}</span>
          </div>
          <div style="font-size:1.15rem;font-weight:900;margin-top:4px;">${tmpl.name}</div>
          <div style="font-size:0.78rem;color:#94a3b8;margin-bottom:6px;">${tmpl.title} ｜ 射程 ${tmpl.range || 1} 格</div>
          <div class="tag-row">${ `<span class="emoji-tag role">${tmpl.roleTag || '主力'}</span>` + tagsHtml }</div>
          <div style="font-size:0.82rem;color:#e2e8f0;margin-top:6px;">${tmpl.shortDesc || tmpl.skillDesc}</div>
        </div>
        <div style="margin-top:12px;padding-top:8px;border-top:1px solid #334155;font-size:0.78rem;color:var(--p5-cyan);display:flex;justify-content:space-between;">
          <span>❤️ ${tmpl.hp} ｜ ⚔️ ${tmpl.atk} ｜ ⚡ ${tmpl.spd}</span>
          <span>${isFull ? '⚠️ 隊伍與板凳已滿' : '點擊選擇'}</span>
        </div>
      `;

      card.onclick = () => {
        if (isFull) {
          alert('場上 4 人與冷板凳 2 格皆已滿員！請優先選擇能合成升星的英雄。');
          return;
        }
        recruitOrUpgradeHero(tmpl);
        currentDraftRerollCallback = null;
        overlay.classList.add('hidden');
        proceedAfterHeroDraft();
      };
      grid.appendChild(card);
    });
    updateModalRerollButton();
  };

  currentDraftRerollCallback = renderChoices;
  renderChoices();
}

function recruitOrUpgradeHero(tmpl) {
  const existing = findPlayerUnitById(tmpl.id);
  if (existing) {
    upgradeUnitStar(existing, '招募合成');
    inspectedHero = existing;
    renderInspector(existing);
    return;
  }

  const newUnit = createUnitFromTemplate(tmpl, true, 1);
  if (playerRoster.length < MAX_ACTIVE_ALLIES) {
    const pos = findFreeAllyBoardCell();
    newUnit.gridX = pos.x;
    newUnit.gridY = pos.y;
    playerRoster.push(newUnit);
    addLog(`✨ 招募了 <strong>${newUnit.icon} ${newUnit.name} (★1)</strong> 並部署至戰場！`);
  } else {
    const benchIdx = benchRoster.findIndex(b => b === null);
    benchRoster[benchIdx] = newUnit;
    addLog(`🪑 場上已滿，<strong>${newUnit.icon} ${newUnit.name} (★1)</strong> 已進入冷板凳備戰區！`);
  }
  inspectedHero = newUnit;
  renderInspector(newUnit);
}

function createUnitFromTemplate(tmpl, isAlly, stars = 1) {
  const mult = stars === 3 ? 1.65 : (stars === 2 ? 1.28 : 1.0);
  const hp = Math.round(tmpl.hp * mult);
  const atk = Math.round(tmpl.atk * mult);
  const spd = (tmpl.id === 'freeted' && stars === 3) ? Math.round(tmpl.spd * 1.25) : tmpl.spd;
  const maxMp = tmpl.noMpHero ? 0 : (tmpl.lockedMaxMp || tmpl.maxMp);

  return {
    ...tmpl,
    traits: [...tmpl.traits],
    stars,
    baseHp: hp,
    baseAtk: atk,
    baseSpd: spd,
    maxHp: hp,
    hp: hp,
    ghostHp: hp,
    shield: 0,
    atk: atk,
    spd: spd,
    curSpd: spd,
    mp: 0,
    maxMp: maxMp,
    range: tmpl.range || 1,
    isAlly,
    gridX: 0,
    gridY: isAlly ? 2 : 1,
    dcMode: null,
    bDogTransferActive: false,
    isDemonized: false,
    immuneDebuff: false,
    basicAtkCount: 0,
    actionGauge: 0,
    inRitual: false,
    ritualCount: 0,
    hugoUndyingUsed: false,
    faithStacks: 0,
    nextAtkBonus: 0,
    dmgReduction: 0,
    stats: { dmgDealt: 0, dmgTaken: 0, healed: 0 }
  };
}

function upgradeUnitStar(unit, reason = '升星') {
  if (unit.stars >= MAX_STARS) return;
  unit.stars++;
  const mult = unit.stars === 3 ? 1.65 : 1.28;
  unit.baseHp = Math.round(unit.hp * (unit.stars === 3 ? 1.28 : 1.28));
  const tmpl = HERO_POOL.find(h => h.id === unit.id) || unit;
  unit.baseHp = Math.round(tmpl.hp * mult);
  unit.baseAtk = Math.round(tmpl.atk * mult);
  unit.baseSpd = (unit.id === 'freeted' && unit.stars === 3) ? Math.round(tmpl.spd * 1.25) : tmpl.spd;
  addLog(`🌟 <strong>${unit.icon} ${unit.name}</strong> 透過【${reason}】升至 <strong>★${unit.stars}</strong>！${unit.stars === 3 ? `解鎖極意：${unit.awakeningName}` : ''}`);
}

function findFreeAllyBoardCell() {
  const defaultCoords = [
    { x: 2, y: 2 }, { x: 3, y: 2 },
    { x: 1, y: 3 }, { x: 4, y: 3 },
    { x: 0, y: 2 }, { x: 5, y: 2 }
  ];
  for (const c of defaultCoords) {
    if (!playerRoster.some(u => u.gridX === c.x && u.gridY === c.y)) return c;
  }
  for (let y = 2; y <= 3; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      if (!playerRoster.some(u => u.gridX === x && u.gridY === y)) return { x, y };
    }
  }
  return { x: 0, y: 2 };
}

function proceedAfterHeroDraft() {
  if ([2, 4, 6].includes(currentStage)) {
    showAugmentDraft();
  } else {
    setupStageReady();
  }
}

function showAugmentDraft() {
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const subEl = document.getElementById('modalSub');
  const grid = document.getElementById('modalGrid');

  overlay.classList.remove('hidden');
  titleEl.textContent = '💠 深淵海克斯強化選秀';
  subEl.textContent = '選擇 1 項全局強化支援你的隊伍';

  const renderAugs = () => {
    grid.innerHTML = '';
    const available = AUGMENT_POOL.filter(a => !playerAugments.some(pa => pa.id === a.id));
    const choices = getRandomItems(available, 3);

    choices.forEach(aug => {
      const card = document.createElement('div');
      card.className = 'choice-card';
      card.innerHTML = `
        <div>
          <div style="font-size:2rem;">${aug.icon}</div>
          <div style="font-size:1.1rem;font-weight:900;color:var(--p5-gold);margin:6px 0;">${aug.name}</div>
          <div style="font-size:0.84rem;color:#e2e8f0;">${aug.desc}</div>
        </div>
        <div style="margin-top:12px;font-size:0.76rem;color:var(--p5-cyan);">點擊啟用海克斯</div>
      `;
      card.onclick = () => {
        playerAugments.push(aug);
        currentDraftRerollCallback = null;
        addLog(`💠 獲得海克斯強化：<strong>${aug.icon} ${aug.name}</strong>`);
        if (aug.id === 'aug_reroll_dice') {
          rerollsLeft += 2;
        }
        if (aug.id === 'aug_lettuce') {
          showLettuceUpgradeModal();
        } else {
          overlay.classList.add('hidden');
          setupStageReady();
        }
      };
      grid.appendChild(card);
    });
    updateModalRerollButton();
  };

  currentDraftRerollCallback = renderAugs;
  renderAugs();
}

function showLettuceUpgradeModal() {
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const subEl = document.getElementById('modalSub');
  const grid = document.getElementById('modalGrid');

  currentDraftRerollCallback = null;
  updateModalRerollButton();

  const allAllies = [...playerRoster, ...benchRoster.filter(Boolean)].filter(u => u.stars < MAX_STARS);
  if (allAllies.length === 0) {
    overlay.classList.add('hidden');
    setupStageReady();
    return;
  }

  overlay.classList.remove('hidden');
  titleEl.textContent = '🥬 大力生菜：指定隊員直升 1 星';
  subEl.textContent = '選擇場上或冷板凳上的 1 名隊員立即提升星級';
  grid.innerHTML = '';

  allAllies.forEach(ally => {
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.innerHTML = `
      <div>
        <div style="font-size:1.8rem;">${ally.icon}</div>
        <div style="font-size:1.1rem;font-weight:900;">${ally.name} (★${ally.stars} ➡️ ★${ally.stars + 1})</div>
        <div style="font-size:0.8rem;color:#cbd5e1;margin-top:6px;">${ally.stars + 1 === 3 ? `🔥 解鎖 ${ally.awakeningName}` : '大幅強化基礎生命與攻擊力'}</div>
      </div>
      <div style="margin-top:10px;color:var(--p5-gold);font-weight:900;">點擊餵食生菜</div>
    `;
    card.onclick = () => {
      upgradeUnitStar(ally, '🥬大力生菜');
      overlay.classList.add('hidden');
      setupStageReady();
    };
    grid.appendChild(card);
  });
}

// ================= 2. 關卡敵軍生成與羈絆護盾準備 =================
function setupStageReady() {
  generateEnemyTeam(currentStage);
  prepareUnitsForStage();
  updateUI();
}

function generateEnemyTeam(stage) {
  if (stage === 8) {
    const elitePool = HERO_POOL.filter(h => ['freeted', 'dv', 'dashen', 'hugo', 'loki', 'dc_tesla'].includes(h.id));
    const guards = getRandomItems(elitePool, 2);

    const bossUnit = createUnitFromTemplate(FINAL_BOSS_TEMPLATE, false, 3);
    bossUnit.maxHp = 3200;
    bossUnit.hp = 3200;
    bossUnit.ghostHp = 3200;
    bossUnit.shield = 1000;
    bossUnit.isBoss = true;
    bossUnit.phase2Triggered = false;
    bossUnit.gridX = 2;
    bossUnit.gridY = 0;

    const guardCoords = [{ x: 1, y: 1 }, { x: 4, y: 1 }];
    const guardUnits = guards.map((g, i) => {
      const u = createUnitFromTemplate(g, false, 3);
      u.gridX = guardCoords[i].x;
      u.gridY = guardCoords[i].y;
      // 僅父親大人角色擁有護盾，移除其他護衛預設護盾
      u.shield = u.traits.includes('父親大人') ? Math.round(u.maxHp * 0.2) : 0;
      return u;
    });

    enemyRoster = [bossUnit, ...guardUnits];
    addLog('👹 <strong>第 8 關深淵終極主宰【楊守正 (3,200 HP + 1,000 護盾)】</strong> 率領 ★3 護衛降臨棋盤！');
    return;
  }

  const enemyCount = stage === 1 ? 1 : (stage === 2 ? 2 : (stage === 3 ? 3 : 4));
  const pool = getEligibleHeroPool(stage, true);
  const templates = getRandomItems(pool, enemyCount);
  const scaleTable = { 1: 0.85, 2: 0.94, 3: 1.03, 4: 1.12, 5: 1.22, 6: 1.35, 7: 1.48 };
  const scale = scaleTable[stage] || 1.0;

  const presetPositions = [
    { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 0 }, { x: 4, y: 0 }
  ];

  enemyRoster = templates.map((t, idx) => {
    let stars = 1;
    if (stage >= 4 && idx === 0) stars = 2;
    if (stage >= 6 && idx === 0) stars = 3;
    const u = createUnitFromTemplate(t, false, stars);
    u.maxHp = Math.round(u.baseHp * scale);
    u.hp = u.maxHp;
    u.ghostHp = u.maxHp;
    u.atk = Math.round(u.baseAtk * scale);
    u.gridX = presetPositions[idx % presetPositions.length].x;
    u.gridY = presetPositions[idx % presetPositions.length].y;
    return u;
  });
}

function getTraitCounts(team) {
  const counts = {};
  team.forEach(u => {
    (u.traits || []).forEach(t => {
      counts[t] = (counts[t] || 0) + 1;
    });
  });
  return counts;
}

function prepareUnitsForStage() {
  actionTickCount = 0;
  fatigueStacks = 0;
  document.getElementById('fatigueBanner').classList.add('hidden');

  const prepareSide = (team, isAlly) => {
    const counts = getTraitCounts(team);
    const fatherCount = counts['父親大人'] || 0;
    const bossEraCount = counts['大佬時代'] || 0;
    const godCount = counts['3幻神'] || 0;

    team.forEach(u => {
      if (u.origX === undefined) {
        u.origX = u.gridX;
        u.origY = u.gridY;
      } else {
        u.gridX = u.origX;
        u.gridY = u.origY;
      }

      let hpMult = 1.0;
      if (bossEraCount >= 3) hpMult += 0.20;
      else if (bossEraCount === 2 && u.traits.includes('大佬時代')) hpMult += 0.15;
      else if (bossEraCount === 1 && u.traits.includes('大佬時代')) hpMult += 0.10;

      u.maxHp = u.isBoss ? 3200 : Math.round(u.baseHp * hpMult);
      u.hp = u.maxHp;
      u.ghostHp = u.maxHp;
      u.atk = u.baseAtk;
      u.spd = u.baseSpd;

      if (isAlly && playerAugments.some(a => a.id === 'aug_feather')) {
        u.spd = Math.round(u.spd * 1.18);
      }
      if (godCount >= 2 && u.traits.includes('3幻神')) {
        u.atk = Math.round(u.atk * (godCount >= 3 ? 1.35 : 1.22));
        if (godCount >= 3) u.spd = Math.round(u.spd * 1.15);
      }

      u.curSpd = u.spd;
      u.mp = 0;
      if (!u.noMpHero) {
        if (godCount >= 2 && u.traits.includes('3幻神')) u.mp += (godCount >= 3 ? 35 : 20);
        if (isAlly && playerAugments.some(a => a.id === 'aug_mana_battery')) u.mp += 30;
        u.mp = Math.min(u.maxMp, u.mp);
      }

      // 護盾嚴格限制：僅【父親大人】成員與終極 Boss 楊守正開局擁有護盾
      if (u.isBoss) {
        u.shield = 1000;
      } else if (u.traits.includes('父親大人') && fatherCount >= 1) {
        let shieldRatio = fatherCount >= 2 ? 0.20 : 0.10;
        if (u.id === 'dv' && u.stars === 3) shieldRatio += 0.15;
        u.shield = Math.round(u.maxHp * shieldRatio);
      } else {
        u.shield = 0;
      }

      u.dcMode = null;
      u.bDogTransferActive = false;
      u.isDemonized = false;
      u.immuneDebuff = false;
      u.basicAtkCount = 0;
      u.actionGauge = 0;
      u.faithStacks = 0;
      u.dmgReduction = 0;
      u.nextAtkBonus = 0;
      u.hugoUndyingUsed = false;
      u.inRitual = (u.id === 'andy');
      u.ritualCount = 0;
      u.hadTeammatesAtStart = team.length > 1;
      u.stats = { dmgDealt: 0, dmgTaken: 0, healed: 0 };
    });
  };

  playerRoster.forEach(u => { u.origX = u.gridX; u.origY = u.gridY; });
  enemyRoster.forEach(u => { u.origX = u.gridX; u.origY = u.gridY; });
  prepareSide(playerRoster, true);
  prepareSide(enemyRoster, false);
}

// ================= 3. 棋盤擺位、冷板凳交換與 UI 渲染 =================
function updateTopBar() {
  document.getElementById('stagePill').textContent = `第 ${currentStage} / ${maxStage} 關`;
  document.getElementById('livesPill').textContent = `命數：${'❤️'.repeat(Math.max(0, playerLives)) || '💀'}`;
  document.getElementById('rerollPill').textContent = `重骰：🎲×${rerollsLeft}`;
  document.getElementById('turnCounterPill').textContent = `行動：${actionTickCount}${fatigueStacks > 0 ? ` (疲勞×${fatigueStacks})` : ''}`;

  const startBtn = document.getElementById('startBattleBtn');
  const pauseBtn = document.getElementById('pauseBattleBtn');
  const stepBtn = document.getElementById('stepBattleBtn');

  if (!inBattle) {
    startBtn.textContent = '⚔️ 開戰';
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    stepBtn.disabled = true;
  } else {
    startBtn.textContent = '⚔️ 交戰中';
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    pauseBtn.textContent = battlePaused ? '▶️ 繼續' : '⏸️ 暫停';
    stepBtn.disabled = !battlePaused;
  }
}

function updateUI() {
  updateTopBar();
  renderTraitTracker();
  renderAugmentList();
  renderBoardGrid();
  renderBench();
  renderDpsMeter();
}

// TFT 風格羈絆追蹤：直接顯示屬於該羈絆的所有英雄頭像，場上角色高亮發光
function renderTraitTracker() {
  const container = document.getElementById('traitListContainer');
  container.innerHTML = '';
  const counts = getTraitCounts(playerRoster);

  Object.keys(TRAIT_INFO).forEach(traitName => {
    const info = TRAIT_INFO[traitName];
    const count = counts[traitName] || 0;
    const heroesWithTrait = HERO_POOL.filter(h => h.traits.includes(traitName));
    const activeTier = [...info.tiers].reverse().find(t => count >= t.count);

    const card = document.createElement('div');
    card.className = `trait-card ${activeTier ? 'active' : ''}`;

    const avatarsHtml = heroesWithTrait.map(h => {
      const onBoardUnit = playerRoster.find(u => u.id === h.id);
      return `<span class="trait-mini-avatar ${onBoardUnit ? 'on-board' : ''}">
        ${h.icon} ${h.name}${onBoardUnit ? `★${onBoardUnit.stars}` : ''}
      </span>`;
    }).join('');

    card.innerHTML = `
      <div class="trait-header">
        <span>${info.icon} ${traitName}</span>
        <span class="trait-tier-badge">${count} 人在場</span>
      </div>
      <div class="trait-desc-line">${activeTier ? `✅ ${activeTier.label}` : info.tiers[0].label}</div>
      <div class="trait-avatars">${avatarsHtml}</div>
    `;
    container.appendChild(card);
  });
}

function renderAugmentList() {
  const box = document.getElementById('augmentListContainer');
  if (playerAugments.length === 0) {
    box.innerHTML = '尚未獲得海克斯強化';
    return;
  }
  box.innerHTML = playerAugments.map(a => `
    <div style="margin-bottom:6px;padding:6px;background:#12121c;border-left:3px solid var(--p5-gold);">
      <strong>${a.icon} ${a.name}</strong>
      <div style="font-size:0.74rem;color:#94a3b8;">${a.desc}</div>
    </div>
  `).join('');
}

function renderBoardGrid() {
  const grid = document.getElementById('tacticalGrid');
  grid.innerHTML = '';

  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      const cell = document.createElement('div');
      const isAllyZone = y >= 2;
      cell.className = `grid-cell ${isAllyZone ? 'ally-zone' : 'enemy-zone'}`;
      cell.dataset.x = x;
      cell.dataset.y = y;

      if (selectedSlot && selectedSlot.type === 'board' && selectedSlot.x === x && selectedSlot.y === y) {
        cell.classList.add('selected-cell');
      }

      const unit = [...playerRoster, ...enemyRoster].find(u => u.hp > 0 && u.gridX === x && u.gridY === y);
      if (unit) {
        cell.appendChild(createUnitTokenDOM(unit));
      }

      const coordLabel = document.createElement('span');
      coordLabel.className = 'cell-coord';
      coordLabel.textContent = `${x},${y}`;
      cell.appendChild(coordLabel);

      cell.onclick = () => handleBoardCellClick(x, y, unit);
      grid.appendChild(cell);
    }
  }
}

function createUnitTokenDOM(unit) {
  const token = document.createElement('div');
  token.className = `unit-token ${unit.isAlly ? 'ally' : 'enemy'} ${unit.stars === 3 ? 'star-3' : ''} ${unit.isDemonized ? 'demonized' : ''}`;
  token.id = `token-${unit.isAlly ? 'ally' : 'enemy'}-${unit.id}`;

  const hpPct = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100));
  const ghostPct = Math.max(hpPct, Math.min(100, ((unit.ghostHp || unit.hp) / unit.maxHp) * 100));
  const shieldPct = Math.max(0, Math.min(100, ((unit.shield || 0) / unit.maxHp) * 100));
  const mpPct = unit.noMpHero ? 0 : Math.max(0, Math.min(100, (unit.mp / unit.maxMp) * 100));

  const companionHtml = unit.companionIcon ? `<span class="companion-float" title="替身 Mobius">${unit.companionIcon}</span>` : '';
  let modeHtml = '';
  if (unit.id === 'dc_tesla' && unit.dcMode) {
    modeHtml = `<span class="mode-pill">${unit.dcMode === 'B_KEE' ? 'B記' : 'B狗'}</span>`;
  } else if (unit.inRitual) {
    modeHtml = `<span class="mode-pill">儀式${unit.ritualCount}/${unit.stars === 3 ? 2 : 3}</span>`;
  }

  token.innerHTML = `
    <div class="token-top">
      <span class="token-stars">${'★'.repeat(unit.stars)}</span>
      <span class="token-range-badge">射程${unit.range}</span>
    </div>
    <div class="token-center">
      ${modeHtml}
      <span class="token-icon">${unit.icon}</span>
      ${companionHtml}
    </div>
    <div class="token-name">${unit.name}</div>
    <div class="bars-box">
      <div class="hp-bar-outer">
        <div class="hp-ghost-fill" style="width:${ghostPct}%"></div>
        <div class="hp-fill" style="width:${hpPct}%"></div>
        <div class="shield-fill" style="width:${shieldPct}%"></div>
      </div>
      <div class="mp-bar-outer">
        <div class="mp-fill" style="width:${mpPct}%"></div>
      </div>
    </div>
  `;
  return token;
}

function renderBench() {
  const benchBox = document.getElementById('benchContainer');
  benchBox.innerHTML = '';

  for (let i = 0; i < MAX_BENCH_ALLIES; i++) {
    const slot = document.createElement('div');
    slot.className = 'bench-slot';
    if (selectedSlot && selectedSlot.type === 'bench' && selectedSlot.index === i) {
      slot.classList.add('selected-cell');
    }
    const unit = benchRoster[i];
    if (unit) {
      slot.appendChild(createUnitTokenDOM(unit));
    } else {
      slot.innerHTML = `<span style="font-size:0.75rem;color:#64748b;">空備戰格 #${i + 1}</span>`;
    }
    slot.onclick = () => handleBenchSlotClick(i);
    benchBox.appendChild(slot);
  }
}

function handleBoardCellClick(x, y, unitOnCell) {
  if (unitOnCell) {
    inspectedHero = unitOnCell;
    renderInspector(unitOnCell);
  }
  if (inBattle) return; // 戰鬥中僅供檢視，不可移位
  if (y < 2) return;    // 敵方半場不可部署我方棋子

  const allyOnCell = playerRoster.find(u => u.gridX === x && u.gridY === y);

  if (!selectedSlot) {
    if (allyOnCell) {
      selectedSlot = { type: 'board', x, y };
      updateUI();
    }
    return;
  }

  // 從棋盤移動或交換至棋盤
  if (selectedSlot.type === 'board') {
    const sourceAlly = playerRoster.find(u => u.gridX === selectedSlot.x && u.gridY === selectedSlot.y);
    if (sourceAlly) {
      if (allyOnCell && allyOnCell !== sourceAlly) {
        allyOnCell.gridX = selectedSlot.x;
        allyOnCell.gridY = selectedSlot.y;
      }
      sourceAlly.gridX = x;
      sourceAlly.gridY = y;
      prepareUnitsForStage();
    }
    selectedSlot = null;
    updateUI();
  } else if (selectedSlot.type === 'bench') {
    const benchUnit = benchRoster[selectedSlot.index];
    if (benchUnit) {
      if (allyOnCell) {
        // 場上與板凳交換
        const idx = playerRoster.indexOf(allyOnCell);
        benchUnit.gridX = x;
        benchUnit.gridY = y;
        playerRoster[idx] = benchUnit;
        benchRoster[selectedSlot.index] = allyOnCell;
      } else if (playerRoster.length < MAX_ACTIVE_ALLIES) {
        benchUnit.gridX = x;
        benchUnit.gridY = y;
        playerRoster.push(benchUnit);
        benchRoster[selectedSlot.index] = null;
      } else {
        alert('場上最多同時上陣 4 名英雄！請點擊場上已有的英雄格進行交換。');
      }
      prepareUnitsForStage();
    }
    selectedSlot = null;
    updateUI();
  }
}

function handleBenchSlotClick(benchIndex) {
  const unit = benchRoster[benchIndex];
  if (unit) {
    inspectedHero = unit;
    renderInspector(unit);
  }
  if (inBattle) return;

  if (!selectedSlot) {
    if (unit) {
      selectedSlot = { type: 'bench', index: benchIndex };
      updateUI();
    }
    return;
  }

  if (selectedSlot.type === 'bench') {
    const temp = benchRoster[selectedSlot.index];
    benchRoster[selectedSlot.index] = benchRoster[benchIndex];
    benchRoster[benchIndex] = temp;
    selectedSlot = null;
    updateUI();
  } else if (selectedSlot.type === 'board') {
    const boardAlly = playerRoster.find(u => u.gridX === selectedSlot.x && u.gridY === selectedSlot.y);
    if (boardAlly) {
      if (unit) {
        unit.gridX = boardAlly.gridX;
        unit.gridY = boardAlly.gridY;
        const rIdx = playerRoster.indexOf(boardAlly);
        playerRoster[rIdx] = unit;
        benchRoster[benchIndex] = boardAlly;
      } else {
        if (playerRoster.length <= 1) {
          alert('場上至少需保留 1 名出戰英雄！');
        } else {
          playerRoster = playerRoster.filter(u => u !== boardAlly);
          benchRoster[benchIndex] = boardAlly;
        }
      }
      prepareUnitsForStage();
    }
    selectedSlot = null;
    updateUI();
  }
}

function renderInspector(hero) {
  if (!hero) return;
  document.getElementById('inspName').textContent = `${hero.icon} ${hero.name} ${hero.stars ? `★${hero.stars}` : ''}`;
  document.getElementById('inspTitle').textContent = `${hero.title} ｜ 射程 ${hero.range || 1} 格 ｜ ❤️${hero.maxHp || hero.hp} ⚔️${hero.atk} ⚡${hero.spd}`;

  const tagRow = document.getElementById('inspTags');
  const tags = hero.tags || [];
  tagRow.innerHTML = `<span class="emoji-tag role">${hero.roleTag || '主力'}</span>` +
    tags.map(t => `<span class="emoji-tag">${t}</span>`).join('') +
    (hero.traits || []).map(tr => `<span class="emoji-tag">🔗 ${tr}</span>`).join('');

  document.getElementById('inspShortDesc').textContent = `${hero.shortDesc || hero.skillDesc}`;
}

function openHeroDetailModal() {
  if (!inspectedHero) return;
  const h = inspectedHero;
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const subEl = document.getElementById('modalSub');
  const grid = document.getElementById('modalGrid');

  currentDraftRerollCallback = null;
  updateModalRerollButton();

  overlay.classList.remove('hidden');
  titleEl.textContent = `${h.icon} ${h.name} — 完整技能與極意檔案`;
  subEl.textContent = `${h.title} ｜ 羈絆：${(h.traits || []).join('、')}`;

  grid.innerHTML = `
    <div class="choice-card" style="grid-column: 1 / -1; cursor: default;">
      <div style="font-size:0.95rem;margin-bottom:10px;color:var(--p5-cyan);font-weight:900;">
        ❤️ 生命：${h.maxHp || h.hp} ｜ 🛡️ 護盾：${h.shield || 0} ｜ ⚔️ 攻擊：${h.atk} ｜ ⚡ 速度：${h.spd} ｜ 💧 魔力：${h.noMpHero ? '無魔力英雄' : `${h.mp \vert{}\vert{} 0}/${h.maxMp}`} ｜ 🎯 射程：${h.range || 1} 格
      </div>
      <div style="margin-bottom:12px;">
        <div style="color:var(--p5-gold);font-weight:900;margin-bottom:4px;">⚡ 招牌技能：【${h.skillName}】</div>
        <div style="font-size:0.9rem;line-height:1.5;color:#f1f5f9;">${h.skillDesc}</div>
      </div>
      <div style="padding:10px;background:#12121a;border-left:4px solid var(--p5-gold);">
        <div style="color:var(--p5-gold);font-weight:900;margin-bottom:4px;">🌟 ${h.awakeningName}</div>
        <div style="font-size:0.88rem;color:#e2e8f0;">${h.awakeningDesc}</div>
      </div>
      <div style="margin-top:14px;text-align:right;">
        <button class="p5-btn" onclick="document.getElementById('modalOverlay').classList.add('hidden')">關閉詳情</button>
      </div>
    </div>
  `;
}

function renderDpsMeter() {
  const box = document.getElementById('dpsMeterContainer');
  const sorted = [...playerRoster].sort((a, b) => (b.stats?.dmgDealt || 0) - (a.stats?.dmgDealt || 0));
  box.innerHTML = sorted.map(u => `
    <div class="dps-row">
      <span>${u.icon} <strong>${u.name}</strong> (★${u.stars})</span>
      <span style="color:var(--p5-gold);">⚔️ ${u.stats?.dmgDealt || 0} ｜ ✨ ${u.stats?.healed || 0}</span>
    </div>
  `).join('');
}

// ================= 4. 空間尋路、聖火對峙演出與回合暫停控制 =================
function gridDistance(a, b) {
  return Math.abs(a.gridX - b.gridX) + Math.abs(a.gridY - b.gridY);
}

function findNearestTarget(unit, opponents) {
  const valid = opponents.filter(o => o.hp > 0 && !o.inRitual);
  if (valid.length === 0) return null;
  valid.sort((a, b) => gridDistance(unit, a) - gridDistance(unit, b));
  return valid[0];
}

function moveUnitOneStepTowards(unit, target) {
  const candidates = [
    { x: unit.gridX + 1, y: unit.gridY },
    { x: unit.gridX - 1, y: unit.gridY },
    { x: unit.gridX, y: unit.gridY + 1 },
    { x: unit.gridX, y: unit.gridY - 1 }
  ].filter(c => c.x >= 0 && c.x < BOARD_COLS && c.y >= 0 && c.y < BOARD_ROWS);

  const occupied = [...playerRoster, ...enemyRoster].filter(u => u.hp > 0 && !u.inRitual);
  const freeCandidates = candidates.filter(c => !occupied.some(u => u.gridX === c.x && u.gridY === c.y));
  if (freeCandidates.length === 0) return false;

  freeCandidates.sort((a, b) => {
    const dA = Math.abs(a.x - target.gridX) + Math.abs(a.y - target.gridY);
    const dB = Math.abs(b.x - target.gridX) + Math.abs(b.y - target.gridY);
    return dA - dB;
  });

  unit.gridX = freeCandidates[0].x;
  unit.gridY = freeCandidates[0].y;
  return true;
}

// 《聖火降魔錄》式頂部對峙視窗更新
function updateFeForecast(attacker, defender, actionLabel) {
  const leftUnit = attacker.isAlly ? attacker : defender;
  const rightUnit = attacker.isAlly ? defender : attacker;

  if (leftUnit) {
    document.getElementById('feLeftIcon').textContent = leftUnit.icon;
    document.getElementById('feLeftName').textContent = `${leftUnit.name} (★${leftUnit.stars})`;
    const followUp = leftUnit.id === 'loki' ? ' ×2 (Mobius追擊⚡)' : '';
    document.getElementById('feLeftStats').textContent = `HP ${leftUnit.hp} | 攻 ${leftUnit.atk}${followUp}`;
  }
  if (rightUnit) {
    document.getElementById('feRightIcon').textContent = rightUnit.icon;
    document.getElementById('feRightName').textContent = `${rightUnit.name} (★${rightUnit.stars})`;
    document.getElementById('feRightStats').textContent = `HP ${rightUnit.hp} | 護盾 ${rightUnit.shield || 0}`;
  }
  document.getElementById('feCenterVs').textContent = actionLabel || 'VS';
}

// 彈道與閃電 SVG 視覺演出
function drawAttackVfx(fromUnit, toUnit, color = '#facc15', isLightning = false) {
  const svg = document.getElementById('vfxSvgLayer');
  const fromCell = document.querySelector(`.grid-cell[data-x="${fromUnit.gridX}"][data-y="${fromUnit.gridY}"]`);
  const toCell = document.querySelector(`.grid-cell[data-x="${toUnit.gridX}"][data-y="${toUnit.gridY}"]`);
  if (!fromCell || !toCell || !svg) return;

  const boardRect = svg.getBoundingClientRect();
  const r1 = fromCell.getBoundingClientRect();
  const r2 = toCell.getBoundingClientRect();

  const x1 = r1.left - boardRect.left + r1.width / 2;
  const y1 = r1.top - boardRect.top + r1.height / 2;
  const x2 = r2.left - boardRect.left + r2.width / 2;
  const y2 = r2.top - boardRect.top + r2.height / 2;

  if (isLightning) {
    const midX = (x1 + x2) / 2 + (Math.random() * 26 - 13);
    const midY = (y1 + y2) / 2 + (Math.random() * 26 - 13);
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', `${x1},${y1} ${midX},${midY} ${x2},${y2}`);
    poly.setAttribute('stroke', color);
    poly.setAttribute('stroke-width', '4');
    poly.setAttribute('fill', 'none');
    svg.appendChild(poly);
    setTimeout(() => poly.remove(), 380);
  } else {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '4');
    svg.appendChild(line);
    setTimeout(() => line.remove(), 320);
  }
}

function showFloatingTextOnUnit(unit, text, color = '#fff') {
  const cell = document.querySelector(`.grid-cell[data-x="${unit.gridX}"][data-y="${unit.gridY}"]`);
  if (!cell) return;
  const floatEl = document.createElement('div');
  floatEl.className = 'floating-text';
  floatEl.style.color = color;
  floatEl.textContent = text;
  cell.appendChild(floatEl);
  setTimeout(() => floatEl.remove(), 820);
}

// 序列式不重疊 Cut-in 特寫（每次完整展示 1.35 秒）
function triggerCutIn(icon, name, subTitle) {
  cutInChain = cutInChain.then(() => new Promise(resolve => {
    const overlay = document.getElementById('cutInOverlay');
    document.getElementById('cutInIcon').textContent = icon;
    document.getElementById('cutInName').textContent = name;
    document.getElementById('cutInSub').textContent = subTitle;
    overlay.classList.remove('hidden');
    setTimeout(() => {
      overlay.classList.add('hidden');
      setTimeout(resolve, 120);
    }, 1350);
  }));
  return cutInChain;
}

// 暫停與單步控制
function togglePauseBattle() {
  if (!inBattle) return;
  battlePaused = !battlePaused;
  updateTopBar();
}

function stepNextTurn() {
  if (!inBattle || !battlePaused) return;
  stepOnceRequested = true;
}

async function waitIfPaused() {
  while (battlePaused && !stepOnceRequested && inBattle) {
    await new Promise(r => setTimeout(r, 80));
  }
  if (stepOnceRequested) {
    stepOnceRequested = false;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ================= 5. 核心戰鬥迴圈（含死鬥疲勞、DC齊發達新機制、FreeTed吸血鬼化） =================
async function startOrToggleBattle() {
  if (inBattle) return;
  inBattle = true;
  battlePaused = false;
  stepOnceRequested = false;
  selectedSlot = null;
  prepareUnitsForStage();
  updateUI();

  addLog(`⚔️ <strong>第 ${currentStage} 關戰鬥開始！</strong>`);

  while (inBattle) {
    await waitIfPaused();

    const aliveAllies = playerRoster.filter(u => u.hp > 0);
    const aliveEnemies = enemyRoster.filter(u => u.hp > 0);
    if (aliveAllies.length === 0 || aliveEnemies.length === 0) break;

    // 選出行動條最快的角色
    const activeActors = [...aliveAllies, ...aliveEnemies].filter(u => !u.inRitual);
    if (activeActors.length === 0) break;

    activeActors.forEach(u => { u.actionGauge += u.curSpd; });
    activeActors.sort((a, b) => b.actionGauge - a.actionGauge);
    const actor = activeActors[0];
    actor.actionGauge -= 100;

    await executeUnitTurn(actor);
    updateUI();
    await sleep(420);
  }

  finishBattlePhase();
}

async function executeUnitTurn(actor) {
  if (actor.hp <= 0 || actor.inRitual) return;

  actionTickCount++;
  // 死鬥疲勞檢查（第 120 次行動啟動，每 12 次行動 +1 層）
  if (actionTickCount >= SUDDEN_DEATH_START_TICK && (actionTickCount - SUDDEN_DEATH_START_TICK) % 12 === 0) {
    fatigueStacks++;
    const banner = document.getElementById('fatigueBanner');
    banner.classList.remove('hidden');
    const healCut = Math.min(90, fatigueStacks * 15);
    const dmgBoost = fatigueStacks * 15;
    banner.textContent = `⚠️ 死鬥疲勞 (第 ${fatigueStacks} 階)：全場治療效果 -${healCut}%、雙方造成傷害 +${dmgBoost}%！`;
    if (fatigueStacks === 1) {
      addLog(`🔥 <strong>【死鬥疲勞啟動】</strong> 戰鬥進入高熱化階段，全場治療遞減 15%、傷害遞增 15%！`);
    }
  }

  const allies = actor.isAlly ? playerRoster.filter(u => u.hp > 0) : enemyRoster.filter(u => u.hp > 0);
  const opponents = actor.isAlly ? enemyRoster.filter(u => u.hp > 0 && !u.inRitual) : playerRoster.filter(u => u.hp > 0 && !u.inRitual);
  if (opponents.length === 0) return;

  // 閃耀偶像每回合回血
  const idolCount = getTraitCounts(allies)['閃耀偶像'] || 0;
  if (idolCount >= 2) {
    const missing = actor.maxHp - actor.hp;
    if (missing > 0) {
      healUnit(actor, actor, Math.round(missing * (idolCount >= 3 ? 0.08 : 0.05)));
    }
  }

  const target = findNearestTarget(actor, opponents);
  if (!target) return;

  // 檢查射程：若目標超出 range，向目標移動 1 格
  const dist = gridDistance(actor, target);
  if (dist > (actor.range || 1)) {
    moveUnitOneStepTowards(actor, target);
    updateFeForecast(actor, target, 'MOVE');
    showFloatingTextOnUnit(actor, '👟 推進', '#38bdf8');
    updateUI();
    await sleep(220);
  }

  // 若移動後進入射程，發動攻擊或施放大招
  if (gridDistance(actor, target) <= (actor.range || 1)) {
    if (!actor.noMpHero && actor.mp >= actor.maxMp) {
      actor.mp = 0;
      await castUnitSkill(actor, target, allies, opponents);
    } else {
      await performBasicAttack(actor, target, allies, opponents);
    }
  }

  // 狂熱信仰行動後疊加
  const faithCount = getTraitCounts(allies)['狂熱信仰'] || 0;
  if (faithCount >= 2 && actor.traits.includes('狂熱信仰') && actor.faithStacks < 5) {
    actor.faithStacks++;
    actor.atk = Math.round(actor.atk * (faithCount >= 3 ? 1.10 : 1.06));
  }
}

async function performBasicAttack(actor, target, allies, opponents) {
  updateFeForecast(actor, target, actor.id === 'loki' ? 'ATK ×2' : 'ATK');
  drawAttackVfx(actor, target, actor.isAlly ? '#38bdf8' : '#ef4444', false);

  dealDamage(actor, target, actor.atk, false);

  // 回魔計算
  if (!actor.noMpHero) {
    let mpGain = 18;
    const techCount = getTraitCounts(allies)['科技代碼'] || 0;
    if (techCount >= 2 && actor.traits.includes('科技代碼')) mpGain += (techCount >= 3 ? 14 : 8);
    if (actor.isAlly && playerAugments.some(a => a.id === 'aug_mana_battery')) mpGain += 5;
    actor.mp = Math.min(actor.maxMp, actor.mp + mpGain);
  }

  // 🦊 Loki 被動：背後靈 Mobius 追加電擊（聖火連攜追擊演出）
  if (actor.id === 'loki' && target.hp > 0) {
    await sleep(220);
    const mobiusTargets = actor.stars === 3 ? getRandomItems(opponents.filter(o => o.hp > 0), 2) : [target];
    mobiusTargets.forEach(t => {
      drawAttackVfx(actor, t, '#facc15', true);
      dealDamage(actor, t, Math.round(actor.atk * 0.45), false);
      showFloatingTextOnUnit(t, '⚡Mobius!', '#facc15');
      if (actor.stars === 3 && !t.noMpHero) {
        const stolen = Math.min(10, t.mp);
        t.mp -= stolen;
        actor.mp = Math.min(actor.maxMp, actor.mp + stolen);
      }
    });
  }

  // ⚡ FreeTed 普攻擴散閃電（含吸血）
  if (actor.id === 'freeted') {
    actor.basicAtkCount++;
    const triggerEvery = actor.stars === 3 ? 3 : 5;
    if (actor.basicAtkCount % triggerEvery === 0) {
      await sleep(180);
      addLog(`⚡ <strong>${actor.name}</strong> 釋放無慘擴散閃電並吸取鮮血！`);
      opponents.forEach(opp => {
        if (opp.hp > 0) {
          drawAttackVfx(actor, opp, '#a855f7', true);
          dealDamage(actor, opp, Math.round(actor.atk * 0.55), false);
        }
      });
      // 降低最遠 2 名敵人 40% 攻速
      const farthest = [...opponents].sort((a, b) => gridDistance(actor, b) - gridDistance(actor, a)).slice(0, 2);
      farthest.forEach(f => {
        if (!f.immuneDebuff) {
          f.curSpd = Math.max(45, Math.round(f.curSpd * 0.6));
          showFloatingTextOnUnit(f, '⚡減速-40%', '#a855f7');
        }
      });
    }
  }

  // 🌙 菅原咲月 ★3 普攻回血
  if (actor.id === 'satsuki' && actor.stars === 3) {
    const wounded = [...allies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    if (wounded) healUnit(actor, wounded, 45);
  }
}

// 施放大招（含序列式 Cut-in 與 DC齊發達 V4.1 重製版開大抽狀態）
async function castUnitSkill(actor, target, allies, opponents) {
  updateFeForecast(actor, target, 'SKILL!');
  await triggerCutIn(actor.icon, `${actor.name} ★${actor.stars}`, `【${actor.skillName}】`);

  if (actor.id === 'dc_tesla') {
    // V4.1 下修版：每次開大時抽選【B記】或【B狗】，非累乘覆蓋，維持至下次開大，無 +25MP 充能
    const pickedMode = Math.random() < 0.5 ? 'B_KEE' : 'B_DOG';
    actor.dcMode = pickedMode;

    // 先重置全隊與自身來自 DC 的非累乘攻擊倍率
    allies.forEach(a => { a.atk = a.baseAtk; });

    if (pickedMode === 'B_KEE') {
      actor.bDogTransferActive = false;
      allies.forEach(a => { a.atk = Math.round(a.baseAtk * 1.20); });
      showFloatingTextOnUnit(actor, '🎲抽中【B記】全隊+20%攻', '#facc15');
      addLog(`🚗 <strong>${actor.name}</strong> 開大抽中【B記】：全隊 +20% 攻擊（非累乘，維持至下次開大）！`);
    } else {
      actor.bDogTransferActive = true;
      actor.atk = Math.round(actor.baseAtk * 1.35);
      const otherAllies = allies.filter(a => a !== actor && a.hp > 0);
      if (otherAllies.length > 0) {
        const victim = otherAllies[Math.floor(Math.random() * otherAllies.length)];
        const drain = Math.round(victim.maxHp * 0.12);
        victim.hp = Math.max(1, victim.hp - drain);
        healUnit(actor, actor, drain);
        showFloatingTextOnUnit(victim, `🩸被B狗吸血-${drain}`, '#ef4444');
      }
      showFloatingTextOnUnit(actor, '🐶抽中【B狗】轉嫁傷害', '#a855f7');
      addLog(`🚗 <strong>${actor.name}</strong> 開大抽中【B狗】：自身 +35% 攻、吸取隊友生命並開啟 40% 傷害轉嫁！`);
    }

    const mult = Math.random() < 0.25 ? 2.80 : 1.65;
    opponents.forEach(opp => {
      drawAttackVfx(actor, opp, '#a855f7', false);
      dealDamage(actor, opp, Math.round(actor.atk * mult), false);
      if (actor.stars === 3) {
        opp.curSpd = Math.max(45, opp.curSpd - 20);
      }
    });
    if (actor.stars === 3 && target.hp > 0) {
      dealDamage(actor, target, Math.round(actor.atk * 1.40), false);
      addLog(`🚗 <strong>${actor.name} ★3【車頭綁人】</strong> 對 ${target.name} 追加 140% 衝撞傷害！`);
    }
  } else if (actor.id === 'dv') {
    actor.dmgReduction = 0.30;
    const bonusShock = actor.stars === 3 ? Math.round((actor.maxHp - actor.hp) * 0.25) : 0;
    opponents.slice(0, 2).forEach(opp => {
      drawAttackVfx(actor, opp, '#38bdf8', false);
      dealDamage(actor, opp, Math.round(actor.atk * 1.85) + bonusShock, false);
      opp.atk = Math.round(opp.atk * 0.75);
    });
  } else if (actor.id === 'loki') {
    drawAttackVfx(actor, target, '#22c55e', true);
    dealDamage(actor, target, Math.round(actor.atk * 1.70), false);
    allies.forEach(a => {
      if (!a.noMpHero && a !== actor) {
        a.mp = Math.min(a.maxMp, a.mp + 30);
        showFloatingTextOnUnit(a, '+30 MP', '#38bdf8');
      }
    });
  } else if (actor.id === 'aming') {
    const targets = actor.stars === 3 ? opponents : opponents.slice(0, 2);
    targets.forEach(opp => {
      drawAttackVfx(actor, opp, '#10b981', true);
      dealDamage(actor, opp, Math.round(actor.atk * 1.45), false);
      if (!opp.noMpHero) opp.mp = Math.max(0, opp.mp - (actor.stars === 3 ? 50 : 40));
      if (actor.stars === 3) opp.atk = Math.round(opp.atk * 0.75);
    });
  } else if (actor.id === 'dashen') {
    const trueRatio = actor.stars === 3 ? 0.60 : 0.30;
    opponents.forEach(opp => {
      drawAttackVfx(actor, opp, '#facc15', true);
      const total = Math.round(actor.atk * 1.60);
      dealDamage(actor, opp, Math.round(total * (1 - trueRatio)), false);
      dealDamage(actor, opp, Math.round(total * trueRatio), true);
    });
    allies.forEach(a => { a.nextAtkBonus = 0.25; });
  } else if (actor.id === 'hugo') {
    const hits = actor.stars === 3 ? 4 : 3;
    const missingPct = Math.floor(((actor.maxHp - actor.hp) / actor.maxHp) * 10);
    const boost = 1 + missingPct * 0.08;
    for (let i = 0; i < hits; i++) {
      if (target.hp > 0) {
        drawAttackVfx(actor, target, '#ef4444', false);
        dealDamage(actor, target, Math.round(actor.atk * 0.80 * boost), false);
      }
    }
  } else if (actor.id === 'stock_opp') {
    const highestEnemy = [...opponents].sort((a, b) => b.atk - a.atk)[0] || target;
    drawAttackVfx(actor, highestEnemy, '#ef4444', false);
    dealDamage(actor, highestEnemy, Math.round(actor.atk * 2.10), false);
    const stolenAtk = Math.round(highestEnemy.atk * 0.20);
    highestEnemy.atk -= stolenAtk;
    actor.atk += stolenAtk;
  } else if (actor.id === 'shu_sis') {
    const lowestAlly = [...allies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    if (lowestAlly) {
      healUnit(actor, lowestAlly, Math.round(actor.atk * 1.65));
      lowestAlly.curSpd = Math.round(lowestAlly.curSpd * 1.20);
      // 保留鼠姐 sis ★3 極意護盾
      if (actor.stars === 3) {
        lowestAlly.shield += 220;
        actor.shield += 220;
        showFloatingTextOnUnit(lowestAlly, '🛡️+220護盾', '#38bdf8');
      }
    }
  } else if (actor.id === 'st_sis') {
    allies.forEach(a => {
      healUnit(actor, a, Math.round(actor.atk * 1.15));
      // 保留 ST sis ★3 極意群體護盾
      if (actor.stars === 3) {
        a.shield += Math.round(actor.atk * 1.60);
      }
    });
  } else if (actor.id === 'satsuki') {
    allies.forEach(a => {
      a.atk = Math.round(a.atk * 1.22);
      healUnit(actor, a, Math.round(actor.atk * 0.95));
      if (actor.stars === 3 && !a.noMpHero) a.mp = Math.min(a.maxMp, a.mp + 25);
    });
  } else if (actor.id === 'dvp') {
    const targets = actor.stars === 3 ? opponents.slice(0, 2) : [target];
    targets.forEach(t => {
      drawAttackVfx(actor, t, '#a855f7', false);
      const dealt = dealDamage(actor, t, Math.round(actor.atk * 1.65), false);
      const lowestAlly = [...allies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      if (lowestAlly) healUnit(actor, lowestAlly, Math.round(dealt * 0.65));
    });
  } else if (actor.isBoss) {
    opponents.forEach(opp => {
      drawAttackVfx(actor, opp, '#ef4444', true);
      dealDamage(actor, opp, Math.round(actor.atk * 1.90), false);
      opp.atk = Math.round(opp.atk * 0.80);
    });
  }

  // 友軍開大推進 Andy安迪 場外末日儀式
  const andyList = allies.filter(a => a.id === 'andy' && a.inRitual && a.hp > 0);
  for (const andy of andyList) {
    andy.ritualCount++;
    const needed = andy.stars === 3 ? 2 : 3;
    if (andy.ritualCount >= needed) {
      andy.inRitual = false;
      await triggerCutIn(andy.icon, `${andy.name} 降臨！`, '☄️【柏克末日・負油價隕石】');
      const mult = andy.stars === 3 ? 3.10 : 2.20;
      opponents.forEach(opp => {
        dealDamage(andy, opp, Math.round(andy.atk * mult), false);
      });
    }
  }
}

// 傷害結算（含護盾抵銷、死鬥疲勞增傷、FreeTed 吸血與滅團鬼化、Boss 二階段）
function dealDamage(attacker, defender, rawAmount, isTrueDamage = false) {
  if (defender.hp <= 0) return 0;

  let dmg = rawAmount;
  if (attacker.nextAtkBonus > 0) {
    dmg = Math.round(dmg * (1 + attacker.nextAtkBonus));
    attacker.nextAtkBonus = 0;
  }

  // 死鬥疲勞增傷
  if (fatigueStacks > 0) {
    dmg = Math.round(dmg * (1 + fatigueStacks * 0.15));
  }

  // 減傷計算
  if (!isTrueDamage) {
    if (defender.isDemonized) dmg = Math.round(dmg * 0.50);
    if (defender.dmgReduction > 0) dmg = Math.round(dmg * (1 - defender.dmgReduction));
  }

  // 🚗 DC齊發達【B狗】轉嫁 40% 傷害給最高血量隊友
  if (defender.id === 'dc_tesla' && defender.bDogTransferActive) {
    const team = defender.isAlly ? playerRoster : enemyRoster;
    const healthyAllies = team.filter(u => u !== defender && u.hp > 0 && !u.inRitual).sort((a, b) => b.hp - a.hp);
    if (healthyAllies.length > 0) {
      const scapegoat = healthyAllies[0];
      const transferred = Math.round(dmg * 0.40);
      dmg -= transferred;
      scapegoat.hp = Math.max(1, scapegoat.hp - transferred);
      showFloatingTextOnUnit(scapegoat, `🔄替DC承受-${transferred}`, '#a855f7');
    }
  }

  dmg = Math.max(1, dmg);

  // 護盾優先抵銷
  if (defender.shield > 0 && !isTrueDamage) {
    if (defender.shield >= dmg) {
      defender.shield -= dmg;
      showFloatingTextOnUnit(defender, `🛡️-${dmg}`, '#38bdf8');
      return dmg;
    } else {
      const rem = dmg - defender.shield;
      defender.shield = 0;
      dmg = rem;
    }
  }

  const prevGhost = defender.hp;
  defender.hp = Math.max(0, defender.hp - dmg);
  setTimeout(() => { defender.ghostHp = defender.hp; updateUI(); }, 350);

  attacker.stats.dmgDealt += dmg;
  defender.stats.dmgTaken += dmg;
  showFloatingTextOnUnit(defender, `-${dmg}`, attacker.isAlly ? '#facc15' : '#ef4444');

  // 🩸 生命偷取（FreeTed 無慘吸血 + 鮮血聖杯海克斯）
  let lifestealRate = attacker.lifesteal || 0;
  if (attacker.id === 'freeted' && attacker.isDemonized) lifestealRate = 0.45;
  if (attacker.isAlly && playerAugments.some(a => a.id === 'aug_blood_chalice')) lifestealRate += 0.15;
  if (lifestealRate > 0 && attacker.hp > 0) {
    healUnit(attacker, attacker, Math.max(1, Math.round(dmg * lifestealRate)));
  }

  // 🗡️ Hugo ★3 致命鎖血
  if (defender.id === 'hugo' && defender.stars === 3 && defender.hp === 0 && !defender.hugoUndyingUsed) {
    defender.hugoUndyingUsed = true;
    defender.hp = 1;
    defender.mp = defender.maxMp;
    showFloatingTextOnUnit(defender, '🔥不屈鎖血1HP!', '#facc15');
  }

  // 👹 終極 Boss 楊守正 50% HP 狂暴二階段
  if (defender.isBoss && !defender.phase2Triggered && defender.hp > 0 && defender.hp <= defender.maxHp * 0.5) {
    defender.phase2Triggered = true;
    defender.shield += 800;
    defender.atk = Math.round(defender.atk * 1.35);
    defender.curSpd = Math.round(defender.curSpd * 1.35);
    triggerCutIn('👹', '楊守正・狂暴二階段', '【100% 中的 100%】護盾 +800 & 全場深淵震波！');
    addLog('👹 <strong>楊守正觸發「100% 中的 100%」狂暴二階段！</strong> 獲得 800 護盾並釋放全體震波！');
  }

  // 擊殺判定與 FreeTed 鬼化復活 / 隊友全滅監測
  if (defender.hp <= 0) {
    addLog(`💀 <strong>${defender.icon} ${defender.name}</strong> 陣亡！`);
    if (attacker.id === 'freeted' && attacker.isDemonized) {
      const team = attacker.isAlly ? playerRoster : enemyRoster;
      const deadAllies = team.filter(u => u !== attacker && u.hp <= 0);
      if (deadAllies.length > 0) {
        const revived = deadAllies[Math.floor(Math.random() * deadAllies.length)];
        revived.hp = Math.round(revived.maxHp * 0.25);
        revived.ghostHp = revived.hp;
        showFloatingTextOnUnit(revived, '⚡無慘復活25%!', '#a855f7');
        addLog(`⚡ <strong>${attacker.name}</strong> 擊殺敵人，將 <strong>${revived.name}</strong> 復活至 25% HP！`);
      }
    }
    checkAllFreeTedDemonize();
  }

  return prevGhost - defender.hp;
}

function healUnit(healer, target, rawHeal) {
  if (target.hp <= 0) return;
  let heal = rawHeal;
  if (fatigueStacks > 0) {
    const mult = Math.max(0.10, 1 - fatigueStacks * 0.15);
    heal = Math.round(heal * mult);
  }
  heal = Math.max(1, heal);
  target.hp = Math.min(target.maxHp, target.hp + heal);
  target.ghostHp = target.hp;
  healer.stats.healed += heal;
  showFloatingTextOnUnit(target, `+${heal}`, '#4ade80');
}

function checkAllFreeTedDemonize() {
  [playerRoster, enemyRoster].forEach(team => {
    const freeted = team.find(u => u.id === 'freeted' && u.hp > 0 && !u.isDemonized);
    if (!freeted || !freeted.hadTeammatesAtStart) return;
    const otherAlive = team.filter(u => u !== freeted && u.hp > 0);
    if (otherAlive.length === 0) {
      freeted.isDemonized = true;
      freeted.immuneDebuff = true;
      triggerCutIn('⚡', `${freeted.name} 全面鬼化！`, '【在座各位都係垃圾】減傷 50%・吸血 45%・擊殺復活隊友！');
      addLog(`👹 <strong>${freeted.name}</strong> 在隊友全滅後觸發全面鬼化【在座各位都係垃圾】！`);
    }
  });
}

// ================= 6. 勝負結算與命數重試 =================
function finishBattlePhase() {
  inBattle = false;
  battlePaused = false;
  const allyAlive = playerRoster.some(u => u.hp > 0);

  if (allyAlive) {
    if (currentStage >= maxStage) {
      addLog('🏆 <strong>恭喜通關！你成功擊潰深淵主宰楊守正，制霸全明星深淵！</strong>');
      alert('🏆 恭喜通關！你已擊敗終極 Boss【楊守正】，完成全部 8 關深淵挑戰！');
      startNewGame();
      return;
    }
    currentStage++;
    addLog(`🎉 第 ${currentStage - 1} 關勝利！進入下一輪英雄招募。`);
    showHeroDraft(`🌟 第 ${currentStage} 關戰前招募`, '選擇 1 名英雄加入戰場或冷板凳（相同英雄自動升星）');
  } else {
    playerLives--;
    if (playerLives > 0) {
      addLog(`💔 戰鬥失利！扣除 1 顆心（剩餘 ❤️×${playerLives}）。敵方狀態已重置，請調整棋盤擺位或替換冷板凳後重試！`);
      prepareUnitsForStage();
      updateUI();
    } else {
      addLog('💀 2 顆命數耗盡，深淵挑戰失敗！');
      alert('💀 命數耗盡！點擊確定重新開啟新一局深淵挑戰。');
      startNewGame();
    }
  }
}

function addLog(html) {
  const box = document.getElementById('battleLogBox');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = html;
  box.prepend(div);
}

function clearBattleLog() {
  const box = document.getElementById('battleLogBox');
  if (box) box.innerHTML = '';
}