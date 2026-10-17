// ================= 1. 遊戲全局狀態與統計 =================
let currentStage = 1;
const maxStage = 8;
const MAX_STARS = 3;
const MAX_TEAM_SIZE = 4;
const MAX_BENCH_SIZE = 2;

let playerLives = 2;
const maxLives = 2;
let rerollsLeft = 2;
const maxRerolls = 2;

let playerRoster = [];
let playerBench = [];
let playerAugments = [];
let enemyRoster = [];

let battleInterval = null;
let battleSpeed = 850;
let isBattling = false;
let isPausedForEvent = false;
let isManualPaused = false;

let nemesisTriggeredThisBattle = false;
let nemesisEventCompleted = false;
let bonusAugmentPending = 0;
let battleComboLogs = [];
let bankruptAvailable = false;
let overdriveActive = false;

let actionTickCount = 0;
let currentRoundNumber = 1;
let suddenDeathActive = false;
let suddenDeathStacks = 0;
let turnQueue = [];

let currentDraftMode = null; // 'hero' | 'augment'
let currentDraftTitle = '';
let currentDraftSub = '';

// ================= 2. 懸浮視窗與安全詳情彈窗 (杜絕引號轉義外露) =================
const tooltipEl = document.getElementById('customTooltip');

function showTooltip(e, title, desc, lore = '') {
  if (!tooltipEl) return;
  tooltipEl.innerHTML = `<div class="tt-title">${title}</div><div>${desc}</div>${lore ? `<div class="tt-lore">${lore}</div>` : ''}`;
  tooltipEl.style.display = 'block';
  moveTooltip(e);
}

function moveTooltip(e) {
  if (!tooltipEl || tooltipEl.style.display === 'none') return;
  let x = e.clientX + 14;
  let y = e.clientY + 14;
  if (x + 350 > window.innerWidth) x = Math.max(10, e.clientX - 350);
  if (y + 200 > window.innerHeight) y = Math.max(10, e.clientY - 200);
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.style.display = 'none';
}
document.addEventListener('mousemove', moveTooltip);

function showTraitTooltip(e, traitName) {
  if (e) e.stopPropagation();
  const info = TRAIT_INFO[traitName];
  if (info) showTooltip(e, `🔗 羈絆：【${traitName}】(${info.req})`, info.desc, info.lore);
}

function showAugmentTooltipById(e, augId) {
  if (e) e.stopPropagation();
  const aug = AUGMENT_POOL.find(a => a.id === augId);
  if (aug) showTooltip(e, `⚡ 海克斯：【${aug.name}】`, aug.desc);
}

// 點擊卡片「詳情」開啟完整技能與極意視窗
function openUnitDetailById(heroId, side = 'ally', idx = 0) {
  let u = null;
  if (side === 'ally') u = playerRoster[idx];
  else if (side === 'bench') u = playerBench[idx];
  else if (side === 'enemy') u = enemyRoster[idx];

  if (!u) {
    u = HERO_POOL.find(h => h.id === heroId) ||
        (FUSED_HERO_TEMPLATE.id === heroId ? FUSED_HERO_TEMPLATE : null) ||
        (FINAL_BOSS_TEMPLATE.id === heroId ? FINAL_BOSS_TEMPLATE : null);
  }
  if (!u) return;

  const modal = document.getElementById('unitDetailModal');
  const content = document.getElementById('unitDetailContent');
  if (!modal || !content) return;

  const stars = u.stars || 1;
  const rangeVal = u.range || 1;
  const tagsHtml = (u.skillTags || []).map(t => `<span class="skill-cat-pill">${t}</span>`).join(' ');

  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #3f3f46; padding-bottom:10px; margin-bottom:12px;">
      <div>
        <h3 style="font-size:1.3rem; color:var(--p5-yellow); font-weight:900;">
          ${u.icon} ${u.name} <span style="color:#fff;">${'★'.repeat(stars)}</span>
        </h3>
        <div style="font-size:0.84rem; color:#f9a8d4; font-weight:700;">${u.title || ''}</div>
      </div>
      <button class="btn btn-danger" style="padding:4px 12px;" onclick="closeUnitDetailModal()">✖ 關閉</button>
    </div>

    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
      ${(u.traits || []).map(t => `<span class="trait-pill">${t}</span>`).join('')}
      <span class="trait-pill" style="color:var(--p5-cyan);">🎯 攻擊距離：${rangeVal} 格 (${rangeVal === 1 ? '近戰前排' : '遠程後排'})</span>
    </div>

    <div style="background:#09090b; padding:10px 12px; border:1px solid #3f3f46; margin-bottom:12px; font-size:0.84rem; display:flex; justify-content:space-around; flex-wrap:wrap; gap:8px;">
      <span>❤️ 生命：<strong>${u.hp || u.maxHp}</strong></span>
      <span>⚔️ 攻擊：<strong>${u.atk}</strong></span>
      <span>⚡ 速度：<strong>${u.curSpd || u.spd}</strong></span>
      <span>💧 魔力：<strong>${u.noMpHero ? '無魔力鬥士' : `${u.mp || 0} / ${u.maxMp}`}</strong></span>
    </div>

    <div style="margin-bottom:8px;">${tagsHtml}</div>

    <div style="background:#111116; border-left:4px solid var(--p5-red); padding:10px 12px; font-size:0.86rem; line-height:1.6; margin-bottom:10px;">
      <div style="color:var(--p5-yellow); font-weight:900; margin-bottom:4px;">💥 主動與被動技能：【${u.skillName}】</div>
      <div>${u.skillDesc}</div>
    </div>

    ${u.awakeningName ? `
      <div style="background:rgba(230,0,18,0.16); border-left:4px solid var(--p5-yellow); padding:10px 12px; font-size:0.85rem; line-height:1.55; margin-bottom:10px;">
        <div style="color:#fde047; font-weight:900; margin-bottom:4px;">⚡ ${u.awakeningName} ${stars >= 3 ? '<span class="tag-crit">已解鎖!</span>' : '<span style="color:var(--text-muted)">(升至 ★3 解鎖)</span>'}</div>
        <div>${u.awakeningDesc}</div>
      </div>
    ` : ''}

    ${u.lore ? `<div style="font-size:0.78rem; color:#a1a1aa; font-style:italic; margin-top:6px;">「${u.lore}」</div>` : ''}
  `;
  modal.classList.remove('hidden');
}

function closeUnitDetailModal() {
  const modal = document.getElementById('unitDetailModal');
  if (modal) modal.classList.add('hidden');
}

// ================= 3. Persona 5 特寫橫幅佇列 (Cut-in Queue・絕不重疊) =================
let cutInQueue = [];
let isPlayingCutIn = false;

function triggerCutIn(icon, name, subTitle, styleType = 'ult') {
  cutInQueue.push({ icon, name, subTitle, styleType });
  if (!isPlayingCutIn) {
    playNextCutIn();
  }
}

function playNextCutIn() {
  if (cutInQueue.length === 0) {
    isPlayingCutIn = false;
    return;
  }
  isPlayingCutIn = true;
  const item = cutInQueue.shift();
  const banner = document.getElementById('p5CutInOverlay');
  const speedLines = document.getElementById('p5SpeedLines');
  const contentEl = document.getElementById('p5CutInContent');

  if (!banner || !contentEl) {
    isPlayingCutIn = false;
    return;
  }

  banner.className = 'p5-cutin-overlay hidden';
  void banner.offsetWidth; // 強制 Reflow 重新觸發動畫
  banner.className = `p5-cutin-overlay active-${item.styleType}`;
  if (speedLines) speedLines.classList.add('active');

  contentEl.innerHTML = `
    <div class="p5-cutin-slash">
      <div class="p5-cutin-icon">${item.icon}</div>
      <div class="p5-cutin-text">
        <div class="p5-cutin-name">${item.name}</div>
        <div class="p5-cutin-sub">${item.subTitle}</div>
      </div>
    </div>
  `;

  // 延長 Cut-in 特寫時間至 1650ms，播畢後自動播放佇列下一發
  setTimeout(() => {
    banner.className = 'p5-cutin-overlay hidden';
    if (speedLines) speedLines.classList.remove('active');
    setTimeout(() => {
      playNextCutIn();
    }, 120);
  }, 1650);
}

// ================= 4.《聖火降魔錄》式左右對峙交戰橫幅更新 =================
function updateFEClashBanner(attacker, defender, actionTitle, detailBadge = '') {
  const leftEl = document.getElementById('feLeftSide');
  const rightEl = document.getElementById('feRightSide');
  const centerEl = document.getElementById('feCenterText');
  if (!leftEl || !rightEl || !centerEl) return;

  if (!attacker) {
    leftEl.innerHTML = '🟢 我方陣列待命';
    centerEl.innerHTML = actionTitle || '⚔️ 戰場空間準備就緒';
    rightEl.innerHTML = '🔴 深淵守衛鎮守中';
    return;
  }

  const allyUnit = attacker.isAlly ? attacker : (defender && defender.isAlly ? defender : null);
  const enemyUnit = !attacker.isAlly ? attacker : (defender && !defender.isAlly ? defender : null);

  leftEl.innerHTML = allyUnit
    ? `<span>${allyUnit.icon} <strong>${allyUnit.name}</strong> (★${allyUnit.stars})</span> <span class="tag-buff">HP ${Math.max(0, allyUnit.hp)}</span> <span style="font-size:0.75rem; color:var(--p5-cyan);">射程:${allyUnit.range || 1}格</span>`
    : '<span>🟢 我方小隊</span>';

  rightEl.innerHTML = enemyUnit
    ? `<span style="font-size:0.75rem; color:#fca5a5;">射程:${enemyUnit.range || 1}格</span> <span class="tag-nerf">HP ${Math.max(0, enemyUnit.hp)}</span> <span>${enemyUnit.icon} <strong>${enemyUnit.name}</strong> (★${enemyUnit.stars})</span>`
    : '<span>🔴 敵方全體</span>';

  centerEl.innerHTML = `${attacker.icon} ${actionTitle} ${detailBadge}`;
}

// ================= 5. 初始化、命數、重骰與冷板凳管理 =================
function initGame() {
  currentStage = 1;
  playerLives = maxLives;
  rerollsLeft = maxRerolls;
  playerRoster = [];
  playerBench = [];
  playerAugments = [];
  bonusAugmentPending = 0;
  nemesisEventCompleted = false;
  isBattling = false;
  isPausedForEvent = false;
  isManualPaused = false;
  cutInQueue = [];
  isPlayingCutIn = false;
  clearInterval(battleInterval);

  const sdBanner = document.getElementById('suddenDeathBanner');
  if (sdBanner) sdBanner.classList.add('hidden');
  const confirmModal = document.getElementById('confirmResetModal');
  if (confirmModal) confirmModal.classList.add('hidden');
  const reportModal = document.getElementById('reportModal');
  if (reportModal) reportModal.classList.add('hidden');

  document.getElementById('battleLog').innerHTML =
    '<div class="log-entry">🎩 歡迎來到 <strong>《DC BON 全明星自動戰棋》【硬核深淵：命數與極意】</strong>！指揮你的小隊與 2 格冷板凳備戰區，靈活運用 2 次重骰與 ★3 覺醒極意，擊破第 8 層深淵魔王！</div>';

  updateFEClashBanner(null, null, '⚔️ 戰場空間準備就緒');
  generateEnemyTeam(currentStage);
  updateUI();
  showHeroDraft(
    '選擇你的初始英雄 (第 1 / 8 關)',
    '挑選 1 位成員作為開局隊長 (全場擁有 2 次重骰機會；滿 ★3 英雄將解鎖專屬極意並移出卡池)'
  );
}

function resetGame() {
  const modal = document.getElementById('confirmResetModal');
  if (modal) modal.classList.remove('hidden');
}

function closeResetModal() {
  const modal = document.getElementById('confirmResetModal');
  if (modal) modal.classList.add('hidden');
}

function confirmResetGame() {
  closeResetModal();
  initGame();
}

function togglePeekBoard() {
  const content = document.getElementById('draftModalContent');
  const overlay = document.getElementById('modalOverlay');
  if (content.classList.contains('hidden')) {
    content.classList.remove('hidden');
    overlay.style.background = 'rgba(0,0,0,0.86)';
  } else {
    content.classList.add('hidden');
    overlay.style.background = 'rgba(0,0,0,0.18)';
  }
}

function getAllOwnedPlayerUnits() {
  return [...playerRoster, ...playerBench];
}

function findOwnedUnitById(heroId) {
  return playerRoster.find(u => u.id === heroId) || playerBench.find(u => u.id === heroId) || null;
}

function syncBaemonTransformation() {
  const hasBaemon = playerAugments.some(a => a.id === 'aug_baemon');
  getAllOwnedPlayerUnits().forEach(u => {
    if (u.id === 'stock_opp') {
      if (hasBaemon) {
        u.traits = ['狂熱信仰'];
        u.icon = '👾';
        u.skillName = '寶怪應援・SHEESH打Call';
        u.skillDesc = '【寶怪回歸轉職】捨棄華爾街空頭，化身為狂熱寶怪粉絲！揮舞手燈為我方全體回復 220 點生命值，並使全體隊友速度 (SPD) 提升 +18！';
      } else {
        u.traits = ['華爾街空頭'];
        u.icon = '📈';
        u.skillName = '百倍槓桿爆倉';
        u.skillDesc = '投下金融核彈！隨機觸發【牛市暴漲】(全隊攻擊+25% 並對敵全體造成 115% 轟炸) 或【割韭菜】(吸取敵方最高血量者 165% 傷害轉為自身生命)。';
      }
    }
  });
}

// ================= 6. 選秀、跨板凳自動升星、2次重骰與【🥬 大力生菜】 =================
function getRandomItems(arr, count) {
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, count);
}

function getEligibleHeroPool(stage, forEnemy = false) {
  return HERO_POOL.filter(h => {
    if (h.minStage && stage < h.minStage) return false;
    if (nemesisEventCompleted && (h.id === 'andy' || h.id === 'stock_opp')) return false;
    if (!forEnemy) {
      const existing = findOwnedUnitById(h.id);
      if (existing && existing.stars >= MAX_STARS) return false;
    }
    return true;
  });
}

function updateRerollButtonsUI() {
  const headerReroll = document.getElementById('rerollHeaderDisplay');
  if (headerReroll) headerReroll.innerText = `🎲 重骰: ${rerollsLeft}/${maxRerolls}`;
  const draftBtn = document.getElementById('rerollDraftBtn');
  if (draftBtn) {
    draftBtn.innerText = `🎲 重骰選項 (剩餘 ${rerollsLeft} 次)`;
    draftBtn.disabled = rerollsLeft <= 0 || currentDraftMode === 'lettuce' || currentDraftMode === 'replace';
  }
}

function rerollDraftChoices() {
  if (rerollsLeft <= 0) return;
  if (currentDraftMode !== 'hero' && currentDraftMode !== 'augment') return;
  rerollsLeft--;
  addLog(`🎲 使用了 1 次選秀重骰！（剩餘 <strong>${rerollsLeft}</strong> 次重骰機會）`);
  updateRerollButtonsUI();
  if (currentDraftMode === 'hero') {
    showHeroDraft(currentDraftTitle, currentDraftSub);
  } else if (currentDraftMode === 'augment') {
    showAugmentDraft();
  }
}

function updateDraftOverview() {
  const teamEl = document.getElementById('draftTeamPreview');
  const benchEl = document.getElementById('draftBenchPreview');
  const synEl = document.getElementById('draftSynergyPreview');
  const augEl = document.getElementById('draftAugmentPreview');

  if (playerRoster.length === 0) {
    teamEl.innerHTML = '<span style="color:var(--text-muted)">尚未招募</span>';
    synEl.innerHTML = '<span style="color:var(--text-muted)">無</span>';
  } else {
    teamEl.innerHTML = playerRoster.map((u, i) =>
      `<span class="mini-unit-pill ${u.stars >= 3 ? 'max-star-pill' : ''}">${i === 0 ? '🛡️' : ''}${u.icon} ${u.name} ★${u.stars}${u.stars >= 3 ? '【極意】' : ''}</span>`
    ).join('');
    const syn = getActiveSynergies(playerRoster);
    synEl.innerHTML = Object.entries(syn).map(([k, v]) =>
      `<span class="trait-pill" onmouseenter="showTraitTooltip(event, '${k}')" onmouseleave="hideTooltip()">${k} (${v})</span>`
    ).join('');
  }

  if (benchEl) {
    if (playerBench.length === 0) {
      benchEl.innerHTML = '<span style="color:var(--text-muted)">空置 (0/2)</span>';
    } else {
      benchEl.innerHTML = playerBench.map(u =>
        `<span class="mini-unit-pill ${u.stars >= 3 ? 'max-star-pill' : ''}">🪑 ${u.icon} ${u.name} ★${u.stars}</span>`
      ).join('');
    }
  }

  if (playerAugments.length === 0) {
    augEl.innerHTML = '<span style="color:var(--text-muted)">無</span>';
  } else {
    augEl.innerHTML = playerAugments.map(a =>
      `<span class="badge augment" onmouseenter="showAugmentTooltipById(event, '${a.id}')" onmouseleave="hideTooltip()">${a.name}</span>`
    ).join('');
  }
  updateRerollButtonsUI();
}

function createUnitInstance(template, stars = 1, isAlly = true) {
  const starMult = Math.pow(1.35, stars - 1);
  let baseHp = Math.round(template.hp * starMult);
  let baseAtk = Math.round(template.atk * starMult);
  let spd = template.spd;
  if (template.id === 'freeted' && stars >= 3) {
    spd = Math.round(template.spd * 1.25);
  }
  const maxMp = template.noMpHero ? 0 : (template.lockedMaxMp || template.maxMp || 80);

  return {
    ...template,
    traits: [...(template.traits || [])],
    skillTags: [...(template.skillTags || [])],
    range: template.range || 1,
    stars,
    baseHp,
    baseAtk,
    maxHp: baseHp,
    hp: baseHp,
    ghostHp: baseHp,
    shield: template.shield || 0,
    atk: baseAtk,
    spd,
    curSpd: spd,
    mp: 0,
    maxMp,
    isAlly,
    inRitual: false,
    ritualCount: 0,
    sisMarks: 0,
    basicAtkCount: 0,
    isDemonized: false,
    dcMode: null,
    dcCritBonus: 0,
    bDogTransferActive: false,
    stats: { dmgDealt: 0, dmgTaken: 0, healed: 0 }
  };
}

function upgradeExistingUnit(unit) {
  if (unit.stars >= MAX_STARS) return;
  unit.stars += 1;
  const starMult = Math.pow(1.35, unit.stars - 1);
  const template = HERO_POOL.find(h => h.id === unit.id) ||
                   (unit.id === 'andy_opp_fused' ? FUSED_HERO_TEMPLATE : unit);
  unit.baseHp = Math.round(template.hp * starMult);
  unit.baseAtk = Math.round(template.atk * starMult);
  unit.maxHp = unit.baseHp;
  unit.hp = unit.baseHp;
  unit.ghostHp = unit.baseHp;
  unit.atk = unit.baseAtk;
  if (unit.id === 'freeted' && unit.stars >= 3) {
    unit.spd = Math.round(template.spd * 1.25);
    unit.curSpd = unit.spd;
  }
  if (unit.stars >= 3) {
    triggerCutIn(unit.icon, unit.name, `★3 覺醒極意解鎖：${unit.awakeningName || '終極進化'}`, 'awakening');
    addLog(`🔥 <strong>${unit.icon} ${unit.name}</strong> 升滿 <span class="tag-crit">★3 覺醒極意</span>！解鎖<strong>${unit.awakeningName || ''}</strong>並移出招募池！`);
  } else {
    addLog(`⬆️ <strong>${unit.icon} ${unit.name}</strong> 合成升星至 <strong>★${unit.stars}</strong>！基礎生命與攻擊力提升 +35%！`);
  }
}

function showHeroDraft(title, subtitle) {
  currentDraftMode = 'hero';
  currentDraftTitle = title;
  currentDraftSub = subtitle;
  updateDraftOverview();

  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('hidden');
  document.getElementById('draftModalContent').classList.remove('hidden');
  overlay.style.background = 'rgba(0,0,0,0.86)';
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalSub').innerText = subtitle;

  const grid = document.getElementById('choicesGrid');
  grid.innerHTML = '';

  const pool = getEligibleHeroPool(currentStage, false);
  const choices = getRandomItems(pool, Math.min(3, pool.length));

  if (choices.length === 0) {
    proceedAfterHeroSelection();
    return;
  }

  choices.forEach(hero => {
    const existingInField = playerRoster.find(h => h.id === hero.id);
    const existingInBench = playerBench.find(h => h.id === hero.id);
    const existing = existingInField || existingInBench;
    const nextStar = existing ? existing.stars + 1 : 1;
    const locTag = existingInField ? '場上合成' : (existingInBench ? '板凳合成' : '');

    const card = document.createElement('div');
    card.className = 'choice-card';
    card.innerHTML = `
      <div>
        <h4>
          <span>${hero.icon} ${hero.name}</span>
          ${existing ? `<span class="upgrade-tag">${nextStar === 3 ? `🔥 ${locTag}升 ★3 極意!` : `⬆️ ${locTag}升 ★${nextStar}`}</span>` : ''}
        </h4>
        ${hero.title ? `<div style="font-size:0.74rem; color:#fde047; margin-bottom:5px; font-weight:bold;">${hero.title}</div>` : ''}
        <div class="choice-traits">
          ${hero.traits.map(t => `<span class="trait-pill" onmouseenter="showTraitTooltip(event, '${t}')" onmouseleave="hideTooltip()">${t}</span>`).join('')}
          <span class="trait-pill" style="color:var(--p5-cyan);">🎯 射程:${hero.range || 1}格</span>
        </div>
        <div class="choice-desc">
          <strong>【${hero.skillName}】</strong><br>${hero.skillDesc}
          ${hero.awakeningName ? `<div class="awakening-box"><strong>⚡ ${hero.awakeningName}：</strong>${hero.awakeningDesc}</div>` : ''}
          ${hero.easterEggHint ? `<div class="easter-hint">${hero.easterEggHint}</div>` : ''}
        </div>
      </div>
      <div class="choice-stats">
        ❤️ HP: ${hero.hp} | ⚔️ ATK: ${hero.atk} | ⚡ SPD: ${hero.spd} | 💧 MP: ${hero.noMpHero ? '無魔力' : hero.maxMp}
      </div>
    `;
    card.onclick = () => selectHeroFromDraft(hero);
    grid.appendChild(card);
  });
}

function selectHeroFromDraft(heroTemplate) {
  const existing = findOwnedUnitById(heroTemplate.id);
  if (existing) {
    upgradeExistingUnit(existing);
    syncBaemonTransformation();
    updateUI();
    proceedAfterHeroSelection();
    return;
  }

  const newUnit = createUnitInstance(heroTemplate, 1, true);
  if (playerRoster.length < MAX_TEAM_SIZE) {
    playerRoster.push(newUnit);
    addLog(`🟢 招募了 <strong>${newUnit.icon} ${newUnit.name}</strong> 加入出戰小隊！`);
    syncBaemonTransformation();
    updateUI();
    proceedAfterHeroSelection();
  } else if (playerBench.length < MAX_BENCH_SIZE) {
    playerBench.push(newUnit);
    addLog(`🪑 出戰小隊已滿，<strong>${newUnit.icon} ${newUnit.name}</strong> 已進入<strong>冷板凳備戰區</strong>（戰前可隨時與場上交換）！`);
    syncBaemonTransformation();
    updateUI();
    proceedAfterHeroSelection();
  } else {
    showReplaceUnitPrompt(newUnit);
  }
}

function showReplaceUnitPrompt(newUnit) {
  currentDraftMode = 'replace';
  updateRerollButtonsUI();
  document.getElementById('modalTitle').innerText = `隊伍與冷板凳已滿！請選擇處理【${newUnit.icon} ${newUnit.name}】`;
  document.getElementById('modalSub').innerText = '可選擇替換場上隊員、替換冷板凳成員，或放棄本次招募';
  const grid = document.getElementById('choicesGrid');
  grid.innerHTML = '';

  playerRoster.forEach((u, idx) => {
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.innerHTML = `
      <div>
        <h4>🔄 替換場上 ${idx + 1} 號位：${u.icon} ${u.name} (★${u.stars})</h4>
        <div class="choice-desc">將場上的 <strong>${u.name}</strong> 替換為新招募的 <strong>${newUnit.icon} ${newUnit.name} (★1)</strong></div>
      </div>
      <div class="choice-stats">點擊確認替換場上位置</div>
    `;
    card.onclick = () => {
      playerRoster[idx] = newUnit;
      syncBaemonTransformation();
      updateUI();
      proceedAfterHeroSelection();
    };
    grid.appendChild(card);
  });

  playerBench.forEach((u, bIdx) => {
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.innerHTML = `
      <div>
        <h4>🪑 替換冷板凳 ${bIdx + 1} 號位：${u.icon} ${u.name} (★${u.stars})</h4>
        <div class="choice-desc">將冷板凳上的 <strong>${u.name}</strong> 替換為新招募的 <strong>${newUnit.icon} ${newUnit.name} (★1)</strong></div>
      </div>
      <div class="choice-stats">點擊確認替換板凳位置</div>
    `;
    card.onclick = () => {
      playerBench[bIdx] = newUnit;
      syncBaemonTransformation();
      updateUI();
      proceedAfterHeroSelection();
    };
    grid.appendChild(card);
  });

  const skipCard = document.createElement('div');
  skipCard.className = 'choice-card';
  skipCard.style.borderColor = 'var(--p5-red)';
  skipCard.innerHTML = `
    <div>
      <h4>❌ 維持原陣容（放棄招募 ${newUnit.name}）</h4>
      <div class="choice-desc">保留目前場上 4 人與冷板凳 2 人配置，直接進入下一步。</div>
    </div>
    <div class="choice-stats" style="color:#f87171;">放棄本次新角色</div>
  `;
  skipCard.onclick = () => proceedAfterHeroSelection();
  grid.appendChild(skipCard);
}

function proceedAfterHeroSelection() {
  if (currentStage === 1 && playerRoster.length === 1 && playerAugments.length === 0 && bonusAugmentPending === 0) {
    document.getElementById('modalOverlay').classList.add('hidden');
    resetPlayerUnitsForStage();
    updateUI();
    return;
  }
  showAugmentDraft();
}

function showAugmentDraft() {
  currentDraftMode = 'augment';
  updateDraftOverview();

  const available = AUGMENT_POOL.filter(a => {
    if (playerAugments.some(pa => pa.id === a.id)) return false;
    if (a.id === 'aug_lettuce') {
      const hasUpgradable = getAllOwnedPlayerUnits().some(u => u.stars < MAX_STARS);
      if (!hasUpgradable) return false;
    }
    return true;
  });

  if (available.length === 0) {
    finishAllDrafts();
    return;
  }

  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('hidden');
  document.getElementById('draftModalContent').classList.remove('hidden');
  document.getElementById('modalTitle').innerText = bonusAugmentPending > 0
    ? '🎁 宿敵死鬥勝利獎勵：額外挑選 1 個海克斯增幅'
    : `選擇海克斯增幅 (準備挑戰第 ${currentStage} / ${maxStage} 關)`;
  document.getElementById('modalSub').innerText = '挑選 1 項全隊永久強化效果（可使用右上角重骰機會）';

  const grid = document.getElementById('choicesGrid');
  grid.innerHTML = '';

  const choices = getRandomItems(available, Math.min(3, available.length));
  choices.forEach(aug => {
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.innerHTML = `
      <div>
        <h4><span>${aug.name}</span></h4>
        <div class="choice-desc">${aug.desc}</div>
      </div>
      <div class="choice-stats" style="color:var(--p5-yellow);">⚡ 點擊裝備此海克斯增幅</div>
    `;
    card.onclick = () => selectAugment(aug);
    grid.appendChild(card);
  });
}

function selectAugment(aug) {
  playerAugments.push(aug);
  addLog(`⚡ 獲得海克斯增幅：<strong>【${aug.name}】</strong>！`);
  syncBaemonTransformation();

  if (aug.id === 'aug_lettuce') {
    showLettuceTargetModal();
    return;
  }

  if (bonusAugmentPending > 0) {
    bonusAugmentPending--;
    if (bonusAugmentPending > 0) {
      showAugmentDraft();
      return;
    }
  }
  finishAllDrafts();
}

function showLettuceTargetModal() {
  currentDraftMode = 'lettuce';
  updateRerollButtonsUI();
  document.getElementById('modalTitle').innerText = '🥬【大力生菜】請指定 1 名隊員直接升星！';
  document.getElementById('modalSub').innerText = '可選擇場上或冷板凳中任何未滿 ★3 的英雄立即提升 1 顆星';
  const grid = document.getElementById('choicesGrid');
  grid.innerHTML = '';

  const upgradable = [
    ...playerRoster.map((u, idx) => ({ unit: u, loc: `🟢 場上 ${idx + 1} 號位` })),
    ...playerBench.map((u, idx) => ({ unit: u, loc: `🪑 冷板凳 ${idx + 1} 號位` }))
  ].filter(item => item.unit.stars < MAX_STARS);

  if (upgradable.length === 0) {
    finishAllDrafts();
    return;
  }

  upgradable.forEach(item => {
    const u = item.unit;
    const nextStar = u.stars + 1;
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.innerHTML = `
      <div>
        <h4>
          <span>${u.icon} ${u.name} (★${u.stars} ➔ ★${nextStar})</span>
          <span class="upgrade-tag">${item.loc}</span>
        </h4>
        <div class="choice-desc">
          ${nextStar === 3 && u.awakeningName
            ? `🔥 <strong>升上 ★3 立即解鎖極意：【${u.awakeningName}】</strong><br>${u.awakeningDesc}`
            : '基礎生命值與攻擊力永久提升 +35%！'}
        </div>
      </div>
      <div class="choice-stats" style="color:var(--p5-green);">🥬 點擊餵食大力生菜升星</div>
    `;
    card.onclick = () => {
      upgradeExistingUnit(u);
      if (bonusAugmentPending > 0) {
        bonusAugmentPending--;
        if (bonusAugmentPending > 0) {
          showAugmentDraft();
          return;
        }
      }
      finishAllDrafts();
    };
    grid.appendChild(card);
  });
}

function finishAllDrafts() {
  document.getElementById('modalOverlay').classList.add('hidden');
  resetPlayerUnitsForStage();
  updateUI();
}

// ================= 7. 場上站位移動與冷板凳互換系統 =================
function moveUnit(idx, dir) {
  if (isBattling) return;
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= playerRoster.length) return;
  const temp = playerRoster[idx];
  playerRoster[idx] = playerRoster[targetIdx];
  playerRoster[targetIdx] = temp;
  resetPlayerUnitsForStage();
  updateUI();
}

function sendFieldToBench(fieldIdx) {
  if (isBattling) return;
  if (playerRoster.length <= 1 && playerBench.length === 0) {
    addLog('<span class="tag-nerf">⚠️ 場上至少需保留 1 名出戰英雄！</span>');
    return;
  }
  if (playerBench.length < MAX_BENCH_SIZE) {
    const [unit] = playerRoster.splice(fieldIdx, 1);
    playerBench.push(unit);
    if (playerRoster.length === 0 && playerBench.length > 0) {
      playerRoster.push(playerBench.shift());
    }
  } else {
    // 若板凳已滿 2 人，與板凳第 1 格交換
    const temp = playerRoster[fieldIdx];
    playerRoster[fieldIdx] = playerBench[0];
    playerBench[0] = temp;
  }
  resetPlayerUnitsForStage();
  updateUI();
}

function deployBenchUnit(benchIdx, targetFieldIdx = -1) {
  if (isBattling) return;
  const benchUnit = playerBench[benchIdx];
  if (!benchUnit) return;

  if (playerRoster.length < MAX_TEAM_SIZE && targetFieldIdx === -1) {
    playerBench.splice(benchIdx, 1);
    playerRoster.push(benchUnit);
  } else {
    const swapIdx = targetFieldIdx >= 0 ? targetFieldIdx : playerRoster.length - 1;
    const temp = playerRoster[swapIdx];
    playerRoster[swapIdx] = benchUnit;
    playerBench[benchIdx] = temp;
  }
  resetPlayerUnitsForStage();
  updateUI();
}

// ================= 8. 羈絆計算與戰前屬性重置 (護盾獨特性嚴格執行) =================
function getActiveSynergies(roster) {
  const counts = {};
  const seenIds = new Set();

  roster.forEach(u => {
    if (!u || seenIds.has(u.id)) return;
    seenIds.add(u.id);
    (u.traits || []).forEach(t => {
      const weight = (u.traitWeight && u.traitWeight[t]) ? u.traitWeight[t] : 1;
      counts[t] = (counts[t] || 0) + weight;
    });
  });

  if (roster === playerRoster) {
    if (playerAugments.some(a => a.id === 'aug_trinity_crown') && (counts['3幻神'] || 0) > 0) {
      counts['3幻神'] += 1;
    }
    if (playerAugments.some(a => a.id === 'aug_sis_power') && (counts['S.I.S'] || 0) > 0) {
      counts['S.I.S'] += 1;
    }
  }
  return counts;
}

function isTraitActive(traitName, count) {
  if (traitName === '父親大人') return count >= 1;
  if (traitName === '大佬時代') return count >= 1;
  if (traitName === '窮閪走數團 / 賭狗 / 司機') return count >= 1;
  if (traitName === 'S.I.S') return count >= 3;
  if (traitName === '貓狗領導') return count >= 2;
  if (traitName === '最強之兩人') return count >= 1;
  if (traitName === '3幻神') return count >= 2;
  if (traitName === '華爾街空頭') return count >= 2;
  if (traitName === '科技代碼') return count >= 2;
  if (traitName === '狂熱信仰') return count >= 2;
  return false;
}

function applyPreBattleModifiers(roster, isAllyTeam) {
  const syn = getActiveSynergies(roster);
  const hasCatDog = (syn['貓狗領導'] || 0) >= 2;
  const hasSis3 = (syn['S.I.S'] || 0) >= 3;
  const dalaoCount = syn['大佬時代'] || 0;
  const fatherCount = syn['父親大人'] || 0;
  const trinityCount = syn['3幻神'] || 0;
  const shortCount = syn['華爾街空頭'] || 0;
  const codeCount = syn['科技代碼'] || 0;
  const faithCount = syn['狂熱信仰'] || 0;

  // 檢查是否有 ★3 合體神卡提供全隊 +250 HP
  const hasStar3Fused = roster.some(u => u.id === 'andy_opp_fused' && u.stars >= 3);

  roster.forEach((u, idx) => {
    const starMult = Math.pow(1.35, (u.stars || 1) - 1);
    const tpl = HERO_POOL.find(h => h.id === u.id) ||
                (u.id === 'andy_opp_fused' ? FUSED_HERO_TEMPLATE : FINAL_BOSS_TEMPLATE);

    let hp = Math.round(tpl.hp * starMult);
    let atk = Math.round(tpl.atk * starMult);
    let spd = tpl.spd;
    if (u.id === 'freeted' && u.stars >= 3) spd = Math.round(tpl.spd * 1.25);

    if (u.nemesisMultiplier) {
      atk = Math.round(atk * u.nemesisMultiplier);
    }

    // S.I.S 1.25x
    if (hasSis3 && u.traits.includes('S.I.S')) {
      hp = Math.round(hp * 1.25);
      atk = Math.round(atk * 1.25);
    }

    // 大佬時代：1人自身+10% HP / 2人自身+15% HP / 3人全隊+20% HP
    if (dalaoCount >= 3) {
      hp = Math.round(hp * 1.20);
    } else if (dalaoCount === 2 && u.traits.includes('大佬時代')) {
      hp = Math.round(hp * 1.15);
    } else if (dalaoCount === 1 && u.traits.includes('大佬時代')) {
      hp = Math.round(hp * 1.10);
    }

    // 狂熱信仰：2人全隊 +20% HP
    if (faithCount >= 2) {
      hp = Math.round(hp * 1.20);
    }

    // 3幻神：2人全隊攻+15%、速+12；3人全隊生命+20%、攻額外+25%
    if (trinityCount >= 2) {
      atk = Math.round(atk * 1.15);
      spd += 12;
    }
    if (trinityCount >= 3) {
      hp = Math.round(hp * 1.20);
      atk = Math.round(atk * 1.25);
    }

    // 華爾街空頭：2人全隊攻+20%
    if (shortCount >= 2) {
      atk = Math.round(atk * 1.20);
    }

    // DVP ★3 極意：開局自身最大生命 +400 HP (不給護盾)
    if (u.id === 'dvp' && u.stars >= 3) {
      hp += 400;
    }

    // 合體卡 ★3 極意：全隊最大生命 +250 HP (不給護盾)
    if (hasStar3Fused) {
      hp += 250;
    }

    // 我方海克斯增幅加成
    if (isAllyTeam) {
      if (playerAugments.some(a => a.id === 'aug_trinity_crown')) atk = Math.round(atk * 1.10);
      if (playerAugments.some(a => a.id === 'aug_sis_power')) spd += 10;
      if (playerAugments.some(a => a.id === 'aug_father_majesty')) hp += 150;
      if (playerAugments.some(a => a.id === 'aug_leverage') && idx > 0) hp = Math.round(hp * 0.90);
      if (playerAugments.some(a => a.id === 'aug_youth')) spd += 20;
    }

    // 貓狗雙血量強化初始狀態
    u.isWeakened = false;
    u.mergedPetBar = hasCatDog && u.hasPetBar;
    if (u.id === 'st_sis') spd += 15;
    if (u.id === 'icy_sis') atk = Math.round(atk * 1.25);

    u.baseHp = hp;
    u.baseAtk = atk;
    u.maxHp = hp;
    u.hp = hp;
    u.ghostHp = hp;
    u.atk = atk;
    u.spd = spd;
    u.curSpd = spd;

    // 起始 MP
    let startMp = 0;
    if (!u.noMpHero) {
      if (codeCount >= 2) startMp += 30;
      if (isAllyTeam && playerAugments.some(a => a.id === 'aug_super_charger')) startMp += 35;
      if (isAllyTeam && playerAugments.some(a => a.id === 'aug_baemon') && !roster.some(x => x.id === 'stock_opp')) {
        startMp += 25;
      }
      u.maxMp = u.lockedMaxMp || tpl.maxMp || 80;
      u.mp = Math.min(u.maxMp, startMp);
    } else {
      u.mp = 0;
      u.maxMp = 0;
    }

    // 🛡️ 護盾獨特性：開局僅【父親大人】羈絆成員 (DV、FreeTed) 與第8關 Boss 楊守正擁有護盾！
    let initShield = 0;
    if (u.id === 'boss_yeung') {
      initShield = 1000;
    } else if (u.traits.includes('父親大人')) {
      let shieldPct = fatherCount >= 2 ? 0.20 : 0.10;
      if (isAllyTeam && playerAugments.some(a => a.id === 'aug_father_majesty')) {
        shieldPct *= 2;
      }
      initShield = Math.round(u.maxHp * shieldPct);
    }
    u.shield = initShield;

    // 重置戰鬥狀態
    u.inRitual = (u.id === 'andy');
    u.ritualCount = 0;
    u.sisMarks = 0;
    u.basicAtkCount = 0;
    u.isDemonized = false;
    u.dcMode = null;
    u.dcCritBonus = 0;
    u.bDogTransferActive = false;
    u.bossPhase2Triggered = false;
    u.vulnerableBonus = 0;
    u.spdDebuffTurns = 0;
    u.immuneDebuff = false;
    u.stats = { dmgDealt: 0, dmgTaken: 0, healed: 0 };
  });
}

function resetPlayerUnitsForStage() {
  applyPreBattleModifiers(playerRoster, true);
  playerBench.forEach(u => {
    const starMult = Math.pow(1.35, (u.stars || 1) - 1);
    const tpl = HERO_POOL.find(h => h.id === u.id) || u;
    u.maxHp = Math.round(tpl.hp * starMult);
    u.hp = u.maxHp;
    u.ghostHp = u.maxHp;
    u.atk = Math.round(tpl.atk * starMult);
    u.shield = 0;
  });
}

// ================= 9. 敵方關卡陣容生成 (Stage 1 ~ 8) =================
function generateEnemyTeam(stage) {
  enemyRoster = [];
  if (stage === 8) {
    const boss = createUnitInstance(FINAL_BOSS_TEMPLATE, 3, false);
    boss.isBoss = true;
    const pool = getEligibleHeroPool(stage, true).filter(h => h.id !== 'andy');
    const guards = getRandomItems(pool, 2).map(g => createUnitInstance(g, 3, false));
    enemyRoster = [boss, ...guards];
    applyPreBattleModifiers(enemyRoster, false);
    boss.hp = 3200;
    boss.maxHp = 3200;
    boss.ghostHp = 3200;
    boss.shield = 1000;
    return;
  }

  const countMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4, 6: 4, 7: 4 };
  const unitCount = countMap[stage] || 4;
  const pool = getEligibleHeroPool(stage, true);
  const picked = getRandomItems(pool, unitCount);

  enemyRoster = picked.map((tpl, idx) => {
    let stars = 1;
    if (stage === 4 && idx === 0) stars = 2;
    else if (stage === 5 && idx < 2) stars = 2;
    else if (stage === 6) stars = idx === 0 ? 3 : 2;
    else if (stage === 7) stars = idx < 2 ? 3 : 2;
    return createUnitInstance(tpl, stars, false);
  });

  applyPreBattleModifiers(enemyRoster, false);
}

// ================= 10. UI 渲染：TFT 式羈絆頭像點亮 + 極簡技能標籤 + 冷板凳 =================
function updateUI() {
  document.getElementById('stageDisplay').innerText = `STAGE ${currentStage} / ${maxStage}`;
  document.getElementById('livesDisplay').innerText = `${'❤️'.repeat(playerLives)}${'🖤'.repeat(maxLives - playerLives)} (${playerLives}/${maxLives})`;
  document.getElementById('allyCount').innerText = `${playerRoster.length} / ${MAX_TEAM_SIZE}`;
  const benchCountEl = document.getElementById('benchCount');
  if (benchCountEl) benchCountEl.innerText = `${playerBench.length} / ${MAX_BENCH_SIZE}`;

  const stageNames = {
    1: '第 1 關：深淵入口斥候 (1人)',
    2: '第 2 關：雙子守衛 (2人)',
    3: '第 3 關：前哨小隊 (3人)',
    4: '第 4 關：★2 菁英守門員 (4人)',
    5: '第 5 關：中層雙 ★2 戰隊 (4人)',
    6: '第 6 關：★3 極意覺醒守衛 (4人)',
    7: '第 7 關：雙 ★3 親衛隊 (4人)',
    8: '第 8 關：👹 終極魔王・楊守正'
  };
  document.getElementById('enemyStageName').innerText = stageNames[currentStage] || `第 ${currentStage} 關對手`;

  updateRerollButtonsUI();
  renderSynergyBarTFT();
  renderAugmentBar();
  renderTeamGrid('allyGrid', playerRoster, true);
  renderTeamGrid('enemyGrid', enemyRoster, false);
  renderBenchGrid();
}

// TFT 式羈絆顯示：明確列出該羈絆所有成員頭像，已上陣者點亮金框
function renderSynergyBarTFT() {
  const container = document.getElementById('synergyList');
  if (!container) return;
  if (playerRoster.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">尚未上陣英雄</span>';
    return;
  }

  const syn = getActiveSynergies(playerRoster);
  const activeFieldIds = new Set(playerRoster.map(u => u.id));

  const entries = Object.entries(syn).sort((a, b) => {
    const actA = isTraitActive(a[0], a[1]) ? 1 : 0;
    const actB = isTraitActive(b[0], b[1]) ? 1 : 0;
    return actB - actA || b[1] - a[1];
  });

  container.innerHTML = entries.map(([traitName, count]) => {
    const info = TRAIT_INFO[traitName];
    const active = isTraitActive(traitName, count);
    const memberIds = (info && info.members) ? info.members : [];

    const avatarsHtml = memberIds.map(mId => {
      const heroObj = HERO_POOL.find(h => h.id === mId) ||
                      (mId === 'andy_opp_fused' ? FUSED_HERO_TEMPLATE : null);
      if (!heroObj) return '';
      const isLit = activeFieldIds.has(mId);
      return `<span class="tft-avatar-dot ${isLit ? 'lit' : ''}" title="${heroObj.name} (${isLit ? '已上陣' : '未上陣'})">${heroObj.icon}</span>`;
    }).join('');

    return `
      <div class="tft-trait-chip ${active ? 'active-gold' : ''}"
           onmouseenter="showTraitTooltip(event, '${traitName}')"
           onmouseleave="hideTooltip()">
        <span>${active ? '✨' : '▫️'} ${traitName} <strong>(${count})</strong></span>
        <span class="tft-trait-avatars">${avatarsHtml}</span>
      </div>
    `;
  }).join('');
}

function renderAugmentBar() {
  const container = document.getElementById('augmentList');
  if (!container) return;
  if (playerAugments.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">尚未獲得增幅</span>';
    return;
  }
  container.innerHTML = playerAugments.map(a =>
    `<span class="badge augment" onmouseenter="showAugmentTooltipById(event, '${a.id}')" onmouseleave="hideTooltip()">${a.name}</span>`
  ).join('');
}

function renderTeamGrid(containerId, roster, isAlly) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  roster.forEach((u, idx) => {
    const card = document.createElement('div');
    card.id = `${isAlly ? 'ally' : 'enemy'}_card_${idx}`;
    const classes = ['unit-card'];
    if (idx === 0) classes.push('frontline');
    if (u.stars >= 3) classes.push('awakened-star3');
    if (u.hp <= 0) classes.push('dead');
    if (u.inRitual) classes.push('ritual-mode');
    if (u.isDemonized) classes.push('demonized-mode');
    if (u.isBoss) classes.push('boss-card-mode');
    card.className = classes.join(' ');

    const hpPct = Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100));
    const ghostPct = Math.max(0, Math.min(100, ((u.ghostHp ?? u.hp) / u.maxHp) * 100));
    const shieldPct = Math.max(0, Math.min(100, ((u.shield || 0) / u.maxHp) * 100));
    const mpPct = u.noMpHero
      ? Math.min(100, ((u.basicAtkCount || 0) / (u.stars >= 3 ? 3 : 5)) * 100)
      : Math.max(0, Math.min(100, ((u.mp || 0) / (u.maxMp || 80)) * 100));

    const hasDualBar = u.hasPetBar && !u.mergedPetBar;
    const baseHalfWidth = hasDualBar ? Math.min(50, hpPct) : 0;
    const petHalfWidth = hasDualBar ? Math.max(0, hpPct - 50) : 0;

    let statusTag = idx === 0 ? '🛡️1號前排' : `🎯${idx + 1}號・射程${u.range || 1}`;
    if (u.inRitual) statusTag = `⏳儀式(${u.ritualCount || 0}/${u.stars >= 3 ? 2 : 3})`;
    else if (u.isDemonized) statusTag = '👹無慘鬼化';
    else if (u.dcMode === 'B_KEE') statusTag = '🟢B記義氣';
    else if (u.dcMode === 'B_DOG') statusTag = '💸B狗走數';
    else if (u.hasPetBar) statusTag = u.isWeakened ? '💧本人弱化' : `🐾${u.petName}`;

    const sideKey = isAlly ? 'ally' : 'enemy';
    const tagsHtml = (u.skillTags || []).map(t => `<span class="skill-cat-pill">${t}</span>`).join('');

    card.innerHTML = `
      <div>
        <div class="unit-top">
          <div class="unit-name">
            <span>${u.icon} ${u.name}</span>
            <span class="stars">${'★'.repeat(u.stars)}</span>
            ${u.stars >= 3 ? '<span class="p5-awake-badge">極意</span>' : ''}
          </div>
          <span class="pos-tag">${statusTag}</span>
        </div>

        <div class="bars">
          <div class="bar-wrap">
            <div class="hp-ghost-fill" style="width:${Math.round(ghostPct)}%"></div>
            ${hasDualBar ? `
              <div class="hp-base-half" style="width:${baseHalfWidth}%"></div>
              <div class="hp-pet-half" style="width:${petHalfWidth}%"></div>
              <div class="bar-divider"></div>
            ` : `<div class="hp-fill" style="width:${Math.round(hpPct)}%"></div>`}
            ${(u.shield || 0) > 0 ? `<div class="shield-fill" style="width:${Math.round(shieldPct)}%"></div>` : ''}
            <div class="bar-text">
              ❤️ ${Math.max(0, u.hp)} / ${u.maxHp}
              ${(u.shield || 0) > 0 ? `<span class="shield-text-inline">🛡️+${u.shield}</span>` : ''}
            </div>
          </div>

          <div class="bar-wrap">
            <div class="mp-fill ${u.noMpHero ? 'no-mp-fill' : ''}" style="width:${Math.round(mpPct)}%"></div>
            <div class="bar-text">
              ${u.noMpHero
                ? `⚡ 閃電計數 (${u.basicAtkCount || 0}/${u.stars >= 3 ? 3 : 5}) ${u.isDemonized ? '| 👹45%吸血' : '| 🩸20%吸血'}`
                : `💧 MP ${u.mp} / ${u.maxMp}${u.lockedMaxMp ? ' (鎖定55)' : ''}`}
            </div>
          </div>
        </div>

        <div class="unit-stats">
          <span>⚔️${u.atk} ⚡${u.curSpd || u.spd} 🎯${u.range || 1}格</span>
          <span>
            ${(u.traits || []).map(t => `<span class="mini-trait" onmouseenter="showTraitTooltip(event, '${t}')" onmouseleave="hideTooltip()">${t}</span>`).join(' ')}
          </span>
        </div>

        <div class="skill-tags-row">${tagsHtml}</div>

        <div class="unit-skill-bar" onclick="openUnitDetailById('${u.id}', '${sideKey}', ${idx})">
          <span>💡 ${u.skillName}</span>
          <span class="detail-btn-inline">🔍 詳情</span>
        </div>
      </div>

      ${isAlly && !isBattling ? `
        <div class="move-btns">
          <button onclick="moveUnit(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>⬅️ 前移</button>
          <button onclick="moveUnit(${idx}, 1)" ${idx === roster.length - 1 ? 'disabled' : ''}>後移 ➡️</button>
          <button onclick="sendFieldToBench(${idx})" style="color:var(--p5-cyan);">⬇️ 板凳</button>
        </div>
      ` : ''}
    `;
    container.appendChild(card);
  });
}

function renderBenchGrid() {
  const container = document.getElementById('benchGrid');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < MAX_BENCH_SIZE; i++) {
    const u = playerBench[i];
    if (!u) {
      const empty = document.createElement('div');
      empty.className = 'bench-empty-slot';
      empty.innerHTML = `🪑 冷板凳空位 #${i + 1}（選秀滿人時自動存放，可跨板凳合成升星）`;
      container.appendChild(empty);
      continue;
    }

    const card = document.createElement('div');
    card.className = `unit-card ${u.stars >= 3 ? 'awakened-star3' : ''}`;
    const tagsHtml = (u.skillTags || []).map(t => `<span class="skill-cat-pill">${t}</span>`).join('');

    card.innerHTML = `
      <div>
        <div class="unit-top">
          <div class="unit-name">
            <span>🪑 ${u.icon} ${u.name}</span>
            <span class="stars">${'★'.repeat(u.stars)}</span>
          </div>
          <span class="pos-tag" style="color:var(--p5-cyan);">備戰中・射程${u.range || 1}</span>
        </div>
        <div class="unit-stats">
          <span>❤️${u.maxHp} ⚔️${u.atk} ⚡${u.spd}</span>
          <span>${(u.traits || []).map(t => `<span class="mini-trait" onmouseenter="showTraitTooltip(event, '${t}')" onmouseleave="hideTooltip()">${t}</span>`).join(' ')}</span>
        </div>
        <div class="skill-tags-row">${tagsHtml}</div>
        <div class="unit-skill-bar" onclick="openUnitDetailById('${u.id}', 'bench', ${i})">
          <span>💡 ${u.skillName}</span>
          <span class="detail-btn-inline">🔍 詳情</span>
        </div>
      </div>
      ${!isBattling ? `
        <div class="move-btns">
          ${playerRoster.length < MAX_TEAM_SIZE
            ? `<button onclick="deployBenchUnit(${i}, -1)" style="color:var(--p5-green);">⬆️ 直接派上場</button>`
            : playerRoster.map((fUnit, fIdx) =>
                `<button onclick="deployBenchUnit(${i}, ${fIdx})">🔄 換${fIdx + 1}號(${fUnit.name.slice(0, 3)})</button>`
              ).join('')}
        </div>
      ` : ''}
    `;
    container.appendChild(card);
  }
}

// ================= 11. 戰鬥控制：回合暫停 / 單步推進 / 速度切換 =================
function toggleSpeed() {
  if (battleSpeed === 850) {
    battleSpeed = 480;
    document.getElementById('speedBtn').innerText = '⏩ 戰鬥速度: 2x';
  } else if (battleSpeed === 480) {
    battleSpeed = 240;
    document.getElementById('speedBtn').innerText = '⏩ 戰鬥速度: 3x';
  } else {
    battleSpeed = 850;
    document.getElementById('speedBtn').innerText = '⏩ 戰鬥速度: 1x';
  }
  if (isBattling && !isManualPaused) {
    clearInterval(battleInterval);
    battleInterval = setInterval(battleStepTick, battleSpeed);
  }
}

function togglePauseBattle() {
  if (!isBattling) return;
  isManualPaused = !isManualPaused;
  const pauseBtn = document.getElementById('pauseBattleBtn');
  const stepBtn = document.getElementById('stepBattleBtn');

  if (isManualPaused) {
    if (pauseBtn) pauseBtn.innerText = '▶️ 繼續戰鬥';
    if (stepBtn) stepBtn.disabled = false;
    addLog('<span class="tag-event">⏸️ 戰鬥已手動暫停（可點擊「⏭️ 單步推進」逐回合檢視，或點擊「▶️ 繼續戰鬥」）</span>');
  } else {
    if (pauseBtn) pauseBtn.innerText = '⏸️ 暫停回合';
    if (stepBtn) stepBtn.disabled = true;
    addLog('<span class="tag-buff">▶️ 戰鬥繼續推進！</span>');
  }
}

function stepSingleTurn() {
  if (!isBattling || !isManualPaused) return;
  battleStepTick(true);
}

function startBattle() {
  if (isBattling || playerRoster.length === 0) return;

  resetPlayerUnitsForStage();
  generateEnemyTeam(currentStage);

  isBattling = true;
  isPausedForEvent = false;
  isManualPaused = false;
  nemesisTriggeredThisBattle = false;
  actionTickCount = 0;
  currentRoundNumber = 1;
  suddenDeathActive = false;
  suddenDeathStacks = 0;
  turnQueue = [];
  battleComboLogs = [];

  bankruptAvailable = playerAugments.some(a => a.id === 'aug_bankrupt');
  overdriveActive = false;

  const sdBanner = document.getElementById('suddenDeathBanner');
  if (sdBanner) sdBanner.classList.add('hidden');

  document.getElementById('startBattleBtn').disabled = true;
  const pauseBtn = document.getElementById('pauseBattleBtn');
  const stepBtn = document.getElementById('stepBattleBtn');
  if (pauseBtn) {
    pauseBtn.disabled = false;
    pauseBtn.innerText = '⏸️ 暫停回合';
  }
  if (stepBtn) stepBtn.disabled = true;

  // 系統 Glitch 海克斯：敵方起始降速與清魔
  if (playerAugments.some(a => a.id === 'aug_glitch')) {
    enemyRoster.forEach(e => {
      e.curSpd = Math.max(40, e.curSpd - 18);
      e.mp = 0;
    });
    addLog('💻 <strong>【系統 Glitch 覆寫】</strong>生效！敵方全體初始速度 -18 且起始魔力歸零！');
  }

  addLog(`⚔️ <strong>=== 第 ${currentStage} 關戰鬥開始！ ===</strong>`);
  updateUI();

  clearInterval(battleInterval);
  battleInterval = setInterval(battleStepTick, battleSpeed);
}

function battleStepTick(forceSingleStep = false) {
  if (!isBattling || isPausedForEvent) return;
  if (isManualPaused && !forceSingleStep) return;
  // 若 Cut-in 特寫佇列正在播放，等待播畢再推進下一動，確保 Cut-in 不重疊
  if (isPlayingCutIn && !forceSingleStep) return;

  const aliveAllies = playerRoster.filter(u => u.hp > 0);
  const aliveEnemies = enemyRoster.filter(u => u.hp > 0);
  if (aliveAllies.length === 0 || aliveEnemies.length === 0) {
    endBattle(aliveAllies.length > 0);
    return;
  }

  checkAllFreeTedDemonize();

  if (turnQueue.length === 0) {
    currentRoundNumber++;
    if (currentRoundNumber >= 4 && playerAugments.some(a => a.id === 'aug_overdrive') && !overdriveActive) {
      overdriveActive = true;
      addLog('🔥 <strong>【末日超載核心】</strong>啟動！我方全體造成傷害提升 +50%！');
    }
    const allAlive = [...playerRoster, ...enemyRoster].filter(u => u.hp > 0 && !u.inRitual);
    allAlive.sort((a, b) => (b.curSpd || b.spd) - (a.curSpd || a.spd));
    turnQueue = allAlive;
  }

  const actor = turnQueue.shift();
  if (!actor || actor.hp <= 0 || actor.inRitual) return;

  actionTickCount++;

  // 🔥 全局「死鬥疲勞 (Sudden Death)」機制：累積達 120 次行動啟動，每 12 動疊加 1 層 (+15% 傷害 / -15% 治療)
  if (actionTickCount >= 120 && (actionTickCount - 120) % 12 === 0) {
    suddenDeathActive = true;
    suddenDeathStacks++;
    const sdBanner = document.getElementById('suddenDeathBanner');
    if (sdBanner) {
      sdBanner.classList.remove('hidden');
      const dmgBonusPct = suddenDeathStacks * 15;
      const healPenaltyPct = Math.min(90, suddenDeathStacks * 15);
      sdBanner.innerHTML = `🔥 【死鬥疲勞 第 ${suddenDeathStacks} 階（行動數 ${actionTickCount}）】全場造成傷害 +${dmgBonusPct}%、治療效果 -${healPenaltyPct}%！`;
    }
    if (suddenDeathStacks === 1) {
      addLog(`🔥 <span class="tag-crit">【死鬥疲勞啟動！】</span>戰鬥超過 120 次行動，全場開始每輪遞增 15% 傷害並遞減 15% 治療效果！`);
    }
  }

  executeUnitTurn(actor);
  checkAllFreeTedDemonize();
  updateUI();

  const afterAllies = playerRoster.filter(u => u.hp > 0);
  const afterEnemies = enemyRoster.filter(u => u.hp > 0);
  if (afterAllies.length === 0 || afterEnemies.length === 0) {
    endBattle(afterAllies.length > 0);
  }
}

// ================= 12. 傷害、護盾、吸血與戰鬥核心邏輯 =================
function showFloatingText(unit, type, text) {
  const roster = unit.isAlly ? playerRoster : enemyRoster;
  const idx = roster.indexOf(unit);
  if (idx === -1) return;
  const card = document.getElementById(`${unit.isAlly ? 'ally' : 'enemy'}_card_${idx}`);
  if (!card) return;

  const badge = document.createElement('div');
  badge.className = `float-text float-${type}`;
  badge.innerText = text;
  card.appendChild(badge);
  setTimeout(() => badge.remove(), 900);
}

function animateUnitAction(unit, animClass) {
  const roster = unit.isAlly ? playerRoster : enemyRoster;
  const idx = roster.indexOf(unit);
  if (idx === -1) return;
  const card = document.getElementById(`${unit.isAlly ? 'ally' : 'enemy'}_card_${idx}`);
  if (!card) return;
  card.classList.remove('anim-lunge-ally', 'anim-lunge-enemy', 'anim-hit');
  void card.offsetWidth;
  card.classList.add(animClass);
}

function addShield(caster, target, amount) {
  if (!target || target.hp <= 0 || amount <= 0) return;
  const val = Math.round(amount);
  target.shield = (target.shield || 0) + val;
  if (caster && caster.stats) caster.stats.healed += val;
  showFloatingText(target, 'shield', `🛡️+${val}`);
}

function healUnit(caster, target, rawAmount) {
  if (!target || target.hp <= 0 || rawAmount <= 0) return 0;
  let mult = 1.0;
  if (suddenDeathActive) {
    mult = Math.max(0.10, 1 - 0.15 * suddenDeathStacks);
  }
  const healVal = Math.max(1, Math.round(rawAmount * mult));
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + healVal);
  target.ghostHp = target.hp;
  const actual = target.hp - before;
  if (caster && caster.stats) caster.stats.healed += healVal;
  showFloatingText(target, 'heal', `+${healVal}`);
  checkPetDualBarState(target);
  return actual;
}

function checkPetDualBarState(unit) {
  if (!unit || !unit.hasPetBar) return;
  if (unit.mergedPetBar) {
    unit.isWeakened = false;
    return;
  }
  const ratio = unit.hp / unit.maxHp;
  if (ratio < 0.5 && !unit.isWeakened) {
    unit.isWeakened = true;
    unit.atk = Math.max(20, Math.round(unit.baseAtk * 0.80));
    unit.curSpd = Math.max(50, unit.spd - 20);
  } else if (ratio >= 0.5 && unit.isWeakened) {
    unit.isWeakened = false;
    unit.atk = unit.id === 'icy_sis' ? Math.round(unit.baseAtk * 1.25) : unit.baseAtk;
    unit.curSpd = unit.spd;
  }
}

function getTarget(opponents) {
  const targetable = opponents.filter(u => u.hp > 0 && !u.inRitual);
  if (targetable.length > 0) return targetable[0];
  const fallback = opponents.filter(u => u.hp > 0);
  if (fallback.length > 0) {
    fallback[0].inRitual = false;
    checkNemesisEasterEgg(fallback[0]);
    return fallback[0];
  }
  return null;
}

function dealDamage(attacker, target, rawDmg, isTrueDamage = false, ignoreShield = false, isTransferred = false) {
  if (!target || target.hp <= 0) return 0;

  let dmg = Math.round(rawDmg);
  let isCrit = false;

  // 死鬥疲勞增傷 (+15% / 層)
  if (suddenDeathActive) {
    dmg = Math.round(dmg * (1 + 0.15 * suddenDeathStacks));
  }

  if (!isTrueDamage) {
    if (attacker && attacker.traits && attacker.traits.includes('S.I.S') && (target.sisMarks || 0) > 0) {
      dmg = Math.round(dmg * (1 + 0.05 * target.sisMarks));
    }
    if (target.vulnerableBonus) {
      dmg = Math.round(dmg * (1 + target.vulnerableBonus));
    }
    if (attacker && attacker.isAlly) {
      if (playerAugments.some(a => a.id === 'aug_leverage') && playerRoster.indexOf(attacker) > 0) {
        dmg = Math.round(dmg * 1.35);
      }
      if (overdriveActive) {
        dmg = Math.round(dmg * 1.50);
      }
      if (playerAugments.some(a => a.id === 'aug_giant_slayer') && target.maxHp >= 1000) {
        dmg = Math.round(dmg * 1.35);
      }
    }

    // 暴擊計算
    let critChance = 0.10 + (attacker ? (attacker.dcCritBonus || 0) : 0);
    let critMult = 1.50;
    const allies = attacker && attacker.isAlly ? playerRoster : enemyRoster;
    const hasIcyBuff = allies.some(u => u.id === 'icy_sis' && u.hp > 0 && !u.isWeakened);
    const hasIcyStar3 = allies.some(u => u.id === 'icy_sis' && u.hp > 0 && u.stars >= 3);
    if (hasIcyBuff) critChance += 0.20;
    if (hasIcyStar3) critMult += 0.30;

    if (attacker && attacker.isAlly && playerAugments.some(a => a.id === 'aug_short')) {
      critChance += 0.25;
      critMult += 0.25;
    }

    if (Math.random() < critChance) {
      isCrit = true;
      dmg = Math.round(dmg * critMult);
    }

    // FreeTed 鬼化常駐 50% 減傷
    if (target.isDemonized) {
      dmg = Math.round(dmg * 0.50);
    }
  }

  // DC齊發達 B狗形態：50% 受傷轉嫁給最高血量隊友
  if (target.id === 'dc_tesla' && target.bDogTransferActive && !isTransferred) {
    const allies = (target.isAlly ? playerRoster : enemyRoster).filter(a => a !== target && a.hp > 0 && !a.inRitual);
    if (allies.length > 0) {
      allies.sort((a, b) => b.hp - a.hp);
      const scapegoat = allies[0];
      const transferDmg = Math.round(dmg * 0.50);
      dmg = dmg - transferDmg;
      dealDamage(attacker, scapegoat, transferDmg, true, false, true);
      addLog(`💸 <strong>${target.name}</strong>【B狗走數轉嫁】將 <strong>${transferDmg}</strong> 點傷害帳單推給 <strong>${scapegoat.name}</strong> 埋單！`);
    }
  }

  dmg = Math.max(1, dmg);

  // 護盾優先抵銷
  if (!ignoreShield && (target.shield || 0) > 0) {
    if (target.shield >= dmg) {
      target.shield -= dmg;
      showFloatingText(target, 'shield', `🛡️抵銷-${dmg}`);
      if (attacker && attacker.stats) attacker.stats.dmgDealt += dmg;
      target.stats.dmgTaken += dmg;
      return dmg;
    } else {
      const absorbed = target.shield;
      dmg -= absorbed;
      target.shield = 0;
    }
  }

  const prevHp = target.hp;
  target.hp = Math.max(0, target.hp - dmg);
  setTimeout(() => { target.ghostHp = target.hp; }, 90);

  // 破產保護令海克斯
  if (target.hp <= 0 && target.isAlly && bankruptAvailable) {
    bankruptAvailable = false;
    target.hp = Math.max(1, Math.round(target.maxHp * 0.35));
    target.ghostHp = target.hp;
    addLog(`🛡️ <strong>【破產保護令】</strong>觸發！<strong>${target.name}</strong> 強制鎖血並緊急回復至 ${target.hp} HP！`);
  }

  // 末日超載核心半血觸發
  if (target.isAlly && target.hp > 0 && (target.hp / target.maxHp) < 0.5 && playerAugments.some(a => a.id === 'aug_overdrive') && !overdriveActive) {
    overdriveActive = true;
    addLog('🔥 <strong>【末日超載核心】</strong>因友軍半血緊急啟動！我方全體造成傷害提升 +50%！');
  }

  // 受擊回魔 +15 MP
  if (target.hp > 0 && !target.noMpHero) {
    target.mp = Math.min(target.maxMp, target.mp + 15);
  }

  checkPetDualBarState(target);

  if (attacker && attacker.stats) attacker.stats.dmgDealt += dmg;
  target.stats.dmgTaken += dmg;

  animateUnitAction(target, 'anim-hit');
  showFloatingText(target, isCrit ? 'crit' : 'dmg', `${isCrit ? '💥' : '-'}${dmg}`);

  // 華爾街吸血鬼海克斯 (20% 吸血)
  if (attacker && attacker.isAlly && attacker.hp > 0 && playerAugments.some(a => a.id === 'aug_vamp')) {
    healUnit(attacker, attacker, Math.round(dmg * 0.20));
  }

  // 第 8 關 Boss 楊守正半血二階段【100% 中的 100%】
  if (target.id === 'boss_yeung' && target.hp > 0 && !target.bossPhase2Triggered && (target.hp / target.maxHp) <= 0.50) {
    target.bossPhase2Triggered = true;
    triggerCutIn('👹', '楊守正', '二階段覺醒【100% 中的 100%】！', 'boss');
    addShield(target, target, 800);
    target.atk = Math.round(target.atk * 1.35);
    target.curSpd = Math.round(target.curSpd * 1.35);
    addLog(`👹 <span class="tag-crit">【深淵狂暴二階段】</span> <strong>楊守正</strong> 解放「100% 中的 100%」！獲得 <strong>+800 護盾</strong>、攻擊與速度暴增 +35% 並釋放深淵震波！`);
    playerRoster.filter(a => a.hp > 0 && !a.inRitual).forEach(a => {
      dealDamage(target, a, target.atk * 0.85, false, false, true);
    });
  }

  // FreeTed 鬼化擊殺復活隊友至 25% HP
  if (prevHp > 0 && target.hp <= 0 && attacker && attacker.id === 'freeted' && attacker.isDemonized) {
    const allies = attacker.isAlly ? playerRoster : enemyRoster;
    const deadAllies = allies.filter(a => a !== attacker && a.hp <= 0);
    if (deadAllies.length > 0) {
      const revived = deadAllies[Math.floor(Math.random() * deadAllies.length)];
      revived.hp = Math.max(1, Math.round(revived.maxHp * 0.25));
      revived.ghostHp = revived.hp;
      revived.inRitual = false;
      addLog(`⚡ <strong>${attacker.name}</strong>【無慘鬼化斬殺】擊斃 ${target.name}，將隊友 <strong>${revived.icon} ${revived.name}</strong> 復活至 25% HP！`);
    }
  }

  return dmg;
}

// ================= 13. FreeTed 隊友全滅【在座各位都係垃圾】全面鬼化 =================
function checkAllFreeTedDemonize() {
  [playerRoster, enemyRoster].forEach(roster => {
    const freeted = roster.find(u => u.id === 'freeted' && u.hp > 0 && !u.isDemonized);
    if (!freeted) return;
    const otherAlive = roster.filter(u => u !== freeted && u.hp > 0);
    if (otherAlive.length === 0) {
      activateFreeTedDemonize(freeted, roster);
    }
  });
}

function activateFreeTedDemonize(freeted, roster) {
  freeted.isDemonized = true;
  freeted.immuneDebuff = true;
  freeted.curSpd = Math.max(freeted.curSpd, freeted.spd);
  const idx = roster.indexOf(freeted);
  if (idx > 0) {
    roster.splice(idx, 1);
    roster.unshift(freeted);
  }
  triggerCutIn('⚡', 'FreeTed (無慘大人)', '【在座各位都係垃圾】全面鬼化覺醒！', 'awakening');
  addLog(`📢 <span class="tag-crit">【全場廣播】FreeTed：「在座各位都係垃圾。」</span> 隊友全滅，<strong>FreeTed</strong> 移至 1 號位全面鬼化！常駐減傷 50%、吸血提升至 45%、免疫減益，每擊殺 1 人隨機復活 1 名隊友至 25% HP！`);
}

// ================= 14. 單一角色行動與技能施放 (含聖火對峙橫幅與平衡修改) =================
function executeUnitTurn(actor) {
  const allies = actor.isAlly ? playerRoster : enemyRoster;
  const opponents = actor.isAlly ? enemyRoster : playerRoster;
  const aliveOpps = opponents.filter(u => u.hp > 0 && !u.inRitual);
  if (aliveOpps.length === 0) {
    const anyOpp = opponents.find(u => u.hp > 0);
    if (anyOpp) {
      anyOpp.inRitual = false;
      checkNemesisEasterEgg(anyOpp);
    } else {
      return;
    }
  }

  animateUnitAction(actor, actor.isAlly ? 'anim-lunge-ally' : 'anim-lunge-enemy');

  // 處理短暫減速回合恢復
  if (actor.spdDebuffTurns && actor.spdDebuffTurns > 0) {
    actor.spdDebuffTurns--;
    if (actor.spdDebuffTurns === 0) actor.curSpd = actor.spd;
  }

  // 判斷是否施放主動大招
  if (!actor.noMpHero && actor.mp >= actor.maxMp) {
    actor.mp = 0;
    castSkill(actor, allies, opponents);
    triggerPostSkillHooks(actor, allies, opponents);
    return;
  }

  // 普通攻擊
  const target = getTarget(opponents);
  if (!target) return;

  if (actor.id === 'andy_opp_fused') {
    let total = 0;
    opponents.filter(e => e.hp > 0 && !e.inRitual).forEach(e => {
      total += dealDamage(actor, e, actor.atk);
    });
    updateFEClashBanner(actor, target, '☯️ 最強之兩人・全體普攻轟炸', `-${total}`);
    addLog(`${actor.icon} <strong>${actor.name}</strong> 普攻轟炸敵方全體，造成 <span class="tag-dmg">-${total}</span> 傷害！`);
  } else {
    const dealt = dealDamage(actor, target, actor.atk);
    updateFEClashBanner(actor, target, `🎯 射程${actor.range || 1}格・普通攻擊`, `-${dealt}`);

    // ⚡ FreeTed 上修：普攻自帶吸血 (基礎 20%，鬼化 45%) + 擴散閃電
    if (actor.id === 'freeted') {
      const vampRate = actor.isDemonized ? 0.45 : 0.20;
      const vampHeal = healUnit(actor, actor, Math.round(dealt * vampRate));
      actor.basicAtkCount = (actor.basicAtkCount || 0) + 1;
      const reqHits = actor.stars >= 3 ? 3 : 5;

      addLog(`⚡ <strong>${actor.name}</strong> 普攻斬擊 <strong>${target.name}</strong> (<span class="tag-dmg">-${dealt}</span>) 並吸血 <span class="tag-heal">+${vampHeal} HP</span>！`);

      if (actor.basicAtkCount >= reqHits) {
        actor.basicAtkCount = 0;
        let chainTotal = 0;
        opponents.filter(e => e.hp > 0 && !e.inRitual).forEach((e, eIdx) => {
          chainTotal += dealDamage(actor, e, actor.atk * 0.55);
          if (eIdx >= 2 && !e.immuneDebuff) {
            e.curSpd = Math.max(40, Math.round(e.spd * 0.60));
            e.spdDebuffTurns = 2;
          }
        });
        const chainVamp = healUnit(actor, actor, Math.round(chainTotal * vampRate));
        updateFEClashBanner(actor, target, '⚡ 擴散閃電・全體雷擊吸血', `-${chainTotal} / +${chainVamp}HP`);
        addLog(`⚡ <strong>${actor.name}</strong> 觸發<strong>【擴散閃電】</strong>！全體雷擊 <span class="tag-dmg">-${chainTotal}</span>、生命偷取 <span class="tag-heal">+${chainVamp} HP</span>，並使敵方後排減速 40%！`);
      }
    } else {
      addLog(`${actor.icon} <strong>${actor.name}</strong> 攻擊 <strong>${target.name}</strong>，造成 <span class="tag-dmg">-${dealt}</span> 傷害。`);
    }
  }

  // 普攻回藍 (+30 MP，超級充電站 +10 MP)
  if (!actor.noMpHero) {
    let mpGain = 30;
    if (actor.isAlly && playerAugments.some(a => a.id === 'aug_super_charger')) mpGain += 10;
    actor.mp = Math.min(actor.maxMp, actor.mp + mpGain);
  }

  // 🦊 Loki 被動：背後靈【Mobius】連攜追擊
  if (actor.id === 'loki') {
    triggerLokiMobiusFollowUp(actor, opponents);
  }
}

function triggerLokiMobiusFollowUp(loki, opponents) {
  const targets = opponents.filter(e => e.hp > 0 && !e.inRitual);
  if (targets.length === 0) return;

  if (loki.stars >= 3) {
    const hitTargets = targets.slice(0, 2);
    let total = 0;
    hitTargets.forEach(t => {
      total += dealDamage(loki, t, loki.atk * 0.75);
      if (!t.noMpHero) {
        const stolen = Math.min(10, t.mp || 0);
        t.mp -= stolen;
        loki.mp = Math.min(loki.maxMp, loki.mp + stolen);
      }
    });
    updateFEClashBanner(loki, hitTargets[0], '🦊 Loki × ⚡ Mobius 連攜雙重電擊', `-${total} & 偷魔`);
    addLog(`🦊 <strong>${loki.name}</strong> 背後靈<strong>【Mobius (★3極意)】</strong>連攜彈射 2 名敵人造成 <span class="tag-dmg">-${total}</span> 並偷取魔力！`);
  } else {
    const t = targets[0];
    const dmg = dealDamage(loki, t, loki.atk * 0.55);
    updateFEClashBanner(loki, t, '🦊 Loki × ⚡ Mobius 連攜追擊', `-${dmg}`);
    addLog(`🦊 <strong>${loki.name}</strong> 背後靈<strong>【Mobius】</strong>追加連攜電擊，對 <strong>${t.name}</strong> 造成 <span class="tag-dmg">-${dmg}</span> 傷害！`);
  }
}

function castSkill(actor, allies, opponents) {
  const aliveAllies = allies.filter(u => u.hp > 0 && !u.inRitual);
  const aliveOpps = opponents.filter(u => u.hp > 0 && !u.inRitual);
  const isStar3 = actor.stars >= 3;

  // 所有大招皆進入 Cut-in 佇列依序播放，絕不重疊
  triggerCutIn(
    actor.icon,
    actor.name,
    isStar3 && actor.awakeningName ? `${actor.awakeningName}・${actor.skillName}` : actor.skillName,
    actor.isBoss ? 'boss' : (isStar3 ? 'awakening' : 'ult')
  );

  const mainTarget = getTarget(opponents);
  updateFEClashBanner(actor, mainTarget, `💥 必殺技【${actor.skillName}】`, isStar3 ? '★3極意' : '');

  switch (actor.id) {
    case 'boss_yeung': {
      let total = 0;
      aliveOpps.forEach(e => { total += dealDamage(actor, e, actor.atk * 1.65); });
      addShield(actor, actor, 300);
      addLog(`👹 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>！全體毀滅打擊 <span class="tag-dmg">-${total}</span> 並獲得 <span class="tag-buff">🛡️+300 護盾</span>！`);
      break;
    }

    case 'dc_tesla': {
      // 🚗 DC齊發達 V5 大幅下修：
      // 1. 施放大招時才抽選【B記】或【B狗】並維持至下次開大
      // 2. 加攻改為基於 baseAtk 的非累乘固定加成
      // 3. 移除大招全隊 +25 MP 充能
      // 4. ★3 僅保留綁隊友撞擊追加 150% 傷害與敵全體 SPD -20 (1回合)
      const otherAllies = aliveAllies.filter(u => u !== actor);
      if (Math.random() < 0.5) {
        actor.dcMode = 'B_KEE';
        actor.dcCritBonus = 0.25;
        actor.bDogTransferActive = false;
        aliveAllies.forEach(a => {
          a.atk = Math.round(a.baseAtk * 1.25); // 非累乘固定 +25% 基礎攻擊
        });
        addLog(`🚗 <strong>${actor.name}</strong> 開大抽籤 ➔ <span class="tag-buff">🟢【B記】義氣形態</span> 全隊非累乘 +25% 基礎攻擊、自身暴擊 +25%！`);
      } else {
        actor.dcMode = 'B_DOG';
        actor.dcCritBonus = 0;
        actor.bDogTransferActive = true;
        actor.atk = Math.round(actor.baseAtk * 1.45); // 非累乘固定 +45% 基礎攻擊
        if (otherAllies.length > 0) {
          const victim = otherAllies[Math.floor(Math.random() * otherAllies.length)];
          const drainHp = Math.min(Math.max(0, victim.hp - 1), Math.round(victim.maxHp * 0.15));
          const drainMp = victim.noMpHero ? 0 : Math.min(victim.mp, 20);
          victim.hp -= drainHp;
          victim.ghostHp = victim.hp;
          if (drainMp > 0) {
            victim.mp -= drainMp;
            actor.mp = Math.min(actor.maxMp, actor.mp + drainMp);
          }
          addLog(`🚗 <strong>${actor.name}</strong> 開大抽籤 ➔ <span class="tag-nerf">💸【B狗】走數形態</span> 自身非累乘 +45% 攻擊、吸取 <strong>${victim.name}</strong> ${drainHp} HP & ${drainMp} MP 並啟動 50% 受傷轉嫁！`);
        }
      }

      const isDouble = Math.random() < 0.30;
      const baseMult = isDouble ? 3.60 : 1.80;
      const star3Extra = (isStar3 && otherAllies.length > 0) ? 1.50 : 0;
      let totalDmg = 0;

      aliveOpps.forEach(e => {
        totalDmg += dealDamage(actor, e, actor.atk * (baseMult + star3Extra));
        if (isStar3 && !e.immuneDebuff) {
          e.curSpd = Math.max(40, (e.curSpd || e.spd) - 20);
          e.spdDebuffTurns = 1;
        }
      });

      addLog(`🚗 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>${isDouble ? '<span class="tag-crit">（360%走數暴衝！）</span>' : ''}${star3Extra > 0 ? '（★3車頭綁隊友衝撞 +150%！）' : ''}造成全體 <span class="tag-dmg">-${totalDmg}</span> 傷害！`);
      break;
    }

    case 'dv': {
      // 💢 DV (父親大人)：殘血狂戰連擊，★3 極意保留 20% 護盾與 25% 吸血
      const hits = isStar3 ? 4 : 3;
      const missingRatio = 1 - (actor.hp / actor.maxHp);
      const multPerHit = 0.85 * (1 + missingRatio * 0.75);
      let total = 0;

      if (isStar3) {
        addShield(actor, actor, Math.round(actor.maxHp * 0.20));
      }

      for (let i = 0; i < hits; i++) {
        const pool = opponents.filter(e => e.hp > 0 && !e.inRitual);
        if (pool.length === 0) break;
        const t = pool[Math.floor(Math.random() * pool.length)];
        total += dealDamage(actor, t, actor.atk * multPerHit);
      }

      if (isStar3 && total > 0) {
        healUnit(actor, actor, Math.round(total * 0.25));
      }
      addLog(`💢 <strong>${actor.name}</strong> 狂暴施放<strong>【${actor.skillName}】</strong>連斬 ${hits} 刀，共造成 <span class="tag-dmg">-${total}</span> 傷害${isStar3 ? '並獲得 20% 父親護盾與 25% 吸血' : ''}！`);
      break;
    }

    case 'mouse_sis': {
      // 🍵 鼠姐 sis：唯一保留 ★3 極意護盾的輔助之二
      const others = aliveAllies.filter(a => a !== actor);
      const mpBoost = isStar3 ? 55 : 40;
      if (others.length === 0) {
        if (mainTarget) {
          const dmg = dealDamage(actor, mainTarget, actor.atk * 1.60);
          addLog(`🍵 <strong>${actor.name}</strong> 孤軍奮戰潑出滾燙抹茶，對 <strong>${mainTarget.name}</strong> 造成 <span class="tag-dmg">-${dmg}</span> 傷害！`);
        }
      } else {
        others.forEach(a => {
          if (!a.noMpHero) a.mp = Math.min(a.maxMp, a.mp + mpBoost);
        });
        aliveAllies.forEach(a => {
          healUnit(actor, a, 90);
          a.atk = Math.round(a.atk * 1.15);
          if (isStar3) addShield(actor, a, 120);
        });
        addLog(`🍵 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>！全體隊友 <span class="tag-buff">+${mpBoost} MP</span>、回血 +90、攻擊 +15%${isStar3 ? ' 並附加 <span class="tag-buff">🛡️120 護盾</span>' : ''}！`);
      }
      break;
    }

    case 'st_sis': {
      // 🐶 ST sis：唯一保留 ★3 極意溢奶轉盾的輔助之二
      let baseHeal = 150;
      if (!actor.isWeakened) baseHeal = Math.round(baseHeal * 1.30);
      if (isStar3) baseHeal = Math.round(baseHeal * 1.35);

      aliveAllies.forEach(a => {
        healUnit(actor, a, baseHeal);
        if (isStar3) {
          addShield(actor, a, Math.round(baseHeal * 0.40));
        }
      });
      addLog(`🐶 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>！全隊回復 <span class="tag-heal">+${baseHeal} HP</span>${isStar3 ? ` 並轉化 <span class="tag-buff">🛡️+${Math.round(baseHeal * 0.40)} 護盾</span>` : ''}！`);
      break;
    }

    case 'icy_sis': {
      aliveAllies.forEach(a => {
        healUnit(actor, a, 115);
        a.atk = Math.round(a.atk * 1.20);
      });
      let extraLog = '';
      if (isStar3) {
        let total = 0;
        aliveOpps.forEach(e => { total += dealDamage(actor, e, actor.atk * 1.30); });
        extraLog = `，並召喚烏冬冰霜貓爪轟炸敵全體 <span class="tag-dmg">-${total}</span>`;
      }
      addLog(`🐱 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>！全隊回復 +115 HP、攻擊力 +20%${extraLog}！`);
      break;
    }

    case 'shijie_sis': {
      if (mainTarget) {
        const mult = isStar3 ? 2.80 : 2.15;
        const dmg = dealDamage(actor, mainTarget, actor.atk * mult, false, isStar3);
        if (isStar3 && mainTarget.hp <= 0) {
          actor.mp = Math.min(actor.maxMp, actor.mp + 50);
        }
        addLog(`🔫 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>狙擊 <strong>${mainTarget.name}</strong> 造成 <span class="tag-dmg">-${dmg}</span> 傷害！`);

        // DV 老婆分靈體聯動
        const dvUnit = aliveAllies.find(a => a.id === 'dv');
        if (dvUnit && mainTarget.hp > 0) {
          const followDmg = dealDamage(dvUnit, mainTarget, dvUnit.atk * 1.20);
          dvUnit.atk = Math.round(dvUnit.atk * 1.20);
          actor.atk = Math.round(actor.atk * 1.20);
          addLog(`💕 <strong>【老婆分靈體聯動】DV</strong> 激發護妻狂暴，對 <strong>${mainTarget.name}</strong> 追加 <span class="tag-dmg">-${followDmg}</span> 合擊！`);
        }
      }
      break;
    }

    case 'stock_opp': {
      if (actor.traits.includes('狂熱信仰')) {
        // 寶怪轉職 (已移除護盾，改為高回血+加速)
        aliveAllies.forEach(a => {
          healUnit(actor, a, 220);
          a.curSpd += 18;
        });
        addLog(`👾 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>！全隊回復 <span class="tag-heal">+220 HP</span> 並提升 +18 SPD！`);
      } else {
        const doBull = isStar3 || Math.random() < 0.55;
        const doRug = isStar3 || !doBull;
        if (doBull) {
          aliveAllies.forEach(a => { a.atk = Math.round(a.atk * 1.25); });
          let total = 0;
          aliveOpps.forEach(e => { total += dealDamage(actor, e, actor.atk * 1.15); });
          addLog(`📈 <strong>${actor.name}</strong> 觸發<strong>【牛市暴漲】</strong>！全隊攻擊 +25% 並轟炸敵全體 <span class="tag-dmg">-${total}</span>！`);
        }
        if (doRug && aliveOpps.length > 0) {
          const richest = [...aliveOpps].sort((a, b) => b.hp - a.hp)[0];
          const dmg = dealDamage(actor, richest, actor.atk * 1.65);
          healUnit(actor, actor, dmg);
          addLog(`📉 <strong>${actor.name}</strong> 觸發<strong>【割韭菜】</strong>！吸取 <strong>${richest.name}</strong> <span class="tag-dmg">-${dmg}</span> 轉為自身生命！`);
        }
      }
      break;
    }

    case 'satsuki': {
      // 🎤 菅原咲月 (已移除 ★3 護盾，改為提升群奶量與全隊加速)
      const healVal = isStar3 ? 220 : 130;
      aliveAllies.forEach(a => {
        healUnit(actor, a, healVal);
        a.atk = Math.round(a.atk * 1.15);
        if (isStar3) a.curSpd += 18;
      });
      if (aliveOpps.length > 0) {
        const topEnemy = [...aliveOpps].sort((a, b) => b.atk - a.atk)[0];
        if (!topEnemy.immuneDebuff) topEnemy.atk = Math.max(20, Math.round(topEnemy.atk * 0.85));
      }
      addLog(`🎤 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>！全隊回復 <span class="tag-heal">+${healVal} HP</span>、攻擊 +15%${isStar3 ? '、速度 +18' : ''}！`);
      break;
    }

    case 'loki': {
      if (mainTarget) {
        const dmg = dealDamage(actor, mainTarget, actor.atk * 1.70);
        aliveAllies.forEach(a => {
          if (a !== actor && !a.noMpHero) a.mp = Math.min(a.maxMp, a.mp + 30);
        });
        addLog(`🦊 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>對 <strong>${mainTarget.name}</strong> 造成 <span class="tag-dmg">-${dmg}</span> 並為隊友充能 +30 MP！`);
      }
      triggerLokiMobiusFollowUp(actor, opponents);
      break;
    }

    case 'andy': {
      let total = 0;
      aliveOpps.forEach(e => { total += dealDamage(actor, e, actor.atk * 1.85); });
      addLog(`🛢️ <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>轟炸敵全體造成 <span class="tag-dmg">-${total}</span> 傷害！`);
      break;
    }

    case 'ming': {
      const targets = isStar3 ? aliveOpps : aliveOpps.slice(0, 2);
      const mpCut = isStar3 ? 50 : 40;
      let total = 0;
      targets.forEach(t => {
        if (isStar3 && (t.shield || 0) > 0) {
          t.shield = Math.round(t.shield * 0.50);
        }
        total += dealDamage(actor, t, actor.atk * 1.45);
        if (!t.noMpHero) t.mp = Math.max(0, t.mp - mpCut);
      });
      addLog(`💻 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>造成 <span class="tag-dmg">-${total}</span> 傷害並扣除目標 ${mpCut} MP${isStar3 ? '（削敵 50% 護盾）' : ''}！`);
      break;
    }

    case 'ogami': {
      // 👑 大神 (已移除 ★3 護盾，改為全隊神聖回血 160 HP)
      const hasOtherGod = aliveAllies.some(a => a !== actor && a.traits.includes('3幻神'));
      let mult = hasOtherGod ? 1.70 : 1.25;
      if (isStar3) mult += 0.45;
      let total = 0;
      aliveOpps.forEach(e => { total += dealDamage(actor, e, actor.atk * mult); });
      if (isStar3) {
        aliveAllies.forEach(a => healUnit(actor, a, 160));
      }
      addLog(`👑 <strong>${actor.name}</strong> 降下<strong>【${actor.skillName}】</strong>全體神諭 <span class="tag-dmg">-${total}</span>${isStar3 ? ' 並為全隊回復 +160 HP' : ''}！`);
      break;
    }

    case 'hugo': {
      if (aliveOpps.length > 0) {
        const weakest = [...aliveOpps].sort((a, b) => a.hp - b.hp)[0];
        const mult = isStar3 ? 2.75 : 2.10;
        const dmg = dealDamage(actor, weakest, actor.atk * mult);
        const hasOtherGod = aliveAllies.some(a => a !== actor && a.traits.includes('3幻神'));
        if (hasOtherGod) {
          aliveAllies.forEach(a => healUnit(actor, a, 90));
        }
        addLog(`🌌 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>斬殺 <strong>${weakest.name}</strong> (<span class="tag-dmg">-${dmg}</span>)！`);

        if (isStar3 && weakest.hp <= 0) {
          const nextPool = opponents.filter(e => e.hp > 0 && !e.inRitual);
          if (nextPool.length > 0) {
            nextPool.sort((a, b) => a.hp - b.hp);
            const exDmg = dealDamage(actor, nextPool[0], actor.atk * 1.50);
            addLog(`🌌 <strong>${actor.name} (★3連環收割)</strong> 擊殺刷新，對 <strong>${nextPool[0].name}</strong> 追加 <span class="tag-dmg">-${exDmg}</span> 次元斬！`);
          }
        }
      }
      break;
    }

    case 'dvp': {
      // 🛡️ DVP (已移除技能與極意護盾，改為高額自癒與全隊回血)
      const selfHeal = isStar3 ? 520 : 320;
      healUnit(actor, actor, selfHeal);
      if (isStar3) {
        aliveAllies.forEach(a => { if (a !== actor) healUnit(actor, a, 180); });
      }
      if (mainTarget) {
        const dmg = dealDamage(actor, mainTarget, actor.atk * 1.65);
        addLog(`🛡️ <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>自癒 <span class="tag-heal">+${selfHeal} HP</span> 並反震 <strong>${mainTarget.name}</strong> <span class="tag-dmg">-${dmg}</span>！`);
      }
      break;
    }

    case 'an_sir': {
      // 🏃 AN SIR (已移除護盾，保留自癒+永久加速+速度差真傷)
      healUnit(actor, actor, 260);
      const spdGain = isStar3 ? 30 : 15;
      actor.spd += spdGain;
      actor.curSpd += spdGain;
      if (mainTarget) {
        let dmg = dealDamage(actor, mainTarget, actor.atk * 1.60);
        if (isStar3) {
          const spdDiff = Math.max(0, actor.curSpd - (mainTarget.curSpd || mainTarget.spd));
          dmg += dealDamage(actor, mainTarget, spdDiff * 2, true);
        }
        addLog(`🏃 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>自癒 +260 HP、速度 +${spdGain} 並打擊 <strong>${mainTarget.name}</strong> (<span class="tag-dmg">-${dmg}</span>)！`);
      }
      break;
    }

    case 'lg': {
      // ✝️ LG (已移除護盾，改為神聖治療與全隊加攻)
      if (mainTarget) {
        dealDamage(actor, mainTarget, actor.atk * 1.65);
      }
      if (isStar3) {
        aliveAllies.forEach(a => {
          healUnit(actor, a, 240);
          a.atk = Math.round(a.atk * 1.15);
        });
        addLog(`✝️ <strong>${actor.name}</strong> 施放<strong>【大聖堂奇蹟恩典】</strong>天罰敵人並為全隊回復 <span class="tag-heal">+240 HP</span>、攻擊 +15%！`);
      } else if (aliveAllies.length > 0) {
        const lowest = [...aliveAllies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
        healUnit(actor, lowest, 260);
        addLog(`✝️ <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>天罰敵人並為 <strong>${lowest.name}</strong> 回復 <span class="tag-heal">+260 HP</span>！`);
      }
      break;
    }

    case 'andy_opp_fused': {
      let total = 0;
      aliveOpps.forEach(e => {
        total += dealDamage(actor, e, actor.atk * 2.00);
        if (isStar3) {
          e.vulnerableBonus = (e.vulnerableBonus || 0) + 0.20;
          if (!e.noMpHero) {
            const stolen = Math.min(20, e.mp || 0);
            e.mp -= stolen;
            actor.mp = Math.min(actor.maxMp, actor.mp + stolen);
          }
        }
      });
      aliveAllies.forEach(a => {
        healUnit(actor, a, 180);
        a.atk = Math.round(a.atk * 1.25);
      });
      addLog(`☯️ <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>！全體金融風暴 <span class="tag-dmg">-${total}</span>、全隊回血 +180 HP 並提升 25% 攻擊力！`);
      break;
    }
  }
}

function triggerPostSkillHooks(actor, allies, opponents) {
  const syn = getActiveSynergies(allies);
  const aliveOpps = opponents.filter(e => e.hp > 0 && !e.inRitual);

  // S.I.S 3人羈絆：【獨立自主】追擊 + 疊印記
  if ((syn['S.I.S'] || 0) >= 3 && actor.traits.includes('S.I.S') && aliveOpps.length > 0) {
    const t = aliveOpps[0];
    t.sisMarks = (t.sisMarks || 0) + 1;
    const bonus = dealDamage(actor, t, actor.atk * 0.75);
    addLog(`💅 <strong>${actor.name}</strong> 觸發 S.I.S<strong>【獨立自主】</strong>追加 <span class="tag-dmg">-${bonus}</span> 傷害並疊加印記 (${t.sisMarks}層)！`);
  }

  // 3幻神 3人羈絆：三位一體神聖追擊
  if ((syn['3幻神'] || 0) >= 3 && actor.traits.includes('3幻神') && aliveOpps.length > 0) {
    const t = aliveOpps[0];
    const bonus = dealDamage(actor, t, actor.atk * 0.90, true);
    addLog(`🌟 <strong>${actor.name}</strong> 觸發 3幻神<strong>【三位一體追擊】</strong>造成 <span class="tag-dmg">-${bonus}</span> 神聖傷害！`);
  }

  // Andy安迪 場外末日儀式推進
  const ritualAndy = allies.find(a => a.id === 'andy' && a.hp > 0 && a.inRitual);
  if (ritualAndy) {
    ritualAndy.ritualCount = (ritualAndy.ritualCount || 0) + 1;
    const req = ritualAndy.stars >= 3 ? 2 : 3;
    if (ritualAndy.ritualCount >= req) {
      ritualAndy.inRitual = false;
      triggerCutIn('🛢️', 'Andy安迪', '末日儀式完成・負油價隕石降臨！', 'awakening');
      const mult = ritualAndy.stars >= 3 ? 3.00 : 2.20;
      let total = 0;
      opponents.filter(e => e.hp > 0 && !e.inRitual).forEach(e => {
        total += dealDamage(ritualAndy, e, ritualAndy.atk * mult);
      });
      if (ritualAndy.stars >= 3) {
        healUnit(ritualAndy, ritualAndy, 350);
        ritualAndy.atk = Math.round(ritualAndy.atk * 1.25);
      }
      addLog(`☄️ <strong>${ritualAndy.name}</strong> 完成末日儀式降臨戰場！負油價隕石轟炸敵全體 <span class="tag-dmg">-${total}</span> 傷害！`);
      checkNemesisEasterEgg(ritualAndy);
    }
  }
}

// ================= 15. 宿敵彩蛋與 3盤2勝 3D6 骰子單挑系統 =================
let currentNemesisContext = null;
let duelState = { round: 1, oppWins: 0, andyWins: 0, rolling: false };

function checkNemesisEasterEgg(descendingAndy) {
  if (nemesisTriggeredThisBattle || nemesisEventCompleted) return false;
  const allyFront = playerRoster[0];
  if (!allyFront || allyFront.hp <= 0) return false;

  const condA = (allyFront.id === 'stock_opp' && descendingAndy.id === 'andy');
  const oppUnit = [...playerRoster, ...enemyRoster].find(u => u.id === 'stock_opp' && u.hp > 0);
  const condB = (allyFront.id === 'andy' && descendingAndy === allyFront && oppUnit);

  if (!condA && !condB) return false;

  nemesisTriggeredThisBattle = true;
  nemesisEventCompleted = true;
  isPausedForEvent = true;

  const myHero = condA ? allyFront : descendingAndy;
  const rivalHero = condA ? descendingAndy : oppUnit;
  currentNemesisContext = { myHero, rivalHero };

  showNemesisChoiceModal();
  return true;
}

function showNemesisChoiceModal() {
  const modal = document.getElementById('nemesisModal');
  const content = document.getElementById('nemesisContent');
  modal.classList.remove('hidden');

  content.innerHTML = `
    <h2 class="modal-title" style="color:var(--p5-yellow);">🚨 隱藏宿敵劇情：【華爾街的終局對決】</h2>
    <p class="modal-sub">當站在 1 號位的 <strong>📈 股票奧本海默</strong> 遇上現身戰場的 <strong>🛢️ Andy安迪</strong>，兩大宿敵正面碰頭！</p>
    <div style="background:#0d0e11; padding:15px; border:2px solid var(--p5-red); margin-bottom:18px; text-align:left; font-size:0.88rem; line-height:1.6;">
      <p>💬 <strong>股票奧本海默</strong>：「安迪！你的末日負油價理論在我的百倍槓桿面前一文不值！」</p>
      <p>💬 <strong>Andy安迪</strong>：「奧本海默！柏克末日已經降臨，今天我們就賭上性命做個了斷！」</p>
    </div>
    <div class="choices-grid">
      <div class="choice-card" style="border-color:var(--p5-red);" onclick="startDiceDuel()">
        <div>
          <h4><span>🗡️ 選擇一：【戰到死 (3盤2勝 3D6 賭命單挑)】</span></h4>
          <div class="choice-desc">
            兩人展開<strong>「三盤兩勝・3顆6面骰(3D6)鐵籠死鬥」</strong>！<br><br>
            • <strong>勝者獎勵</strong>：滿血、<strong>攻擊力永久翻倍 (2x) 且 +50 MP</strong>，過關後<strong>額外多拿 1 個海克斯增幅</strong>！<br>
            • <strong style="color:#f87171;">⚠️ 敗北懲罰</strong>：落敗方將直接從隊伍中永久戰死除名！
          </div>
        </div>
        <div class="choice-stats" style="color:#f87171;">🔥 高風險高回報・敗者永久除名</div>
      </div>

      <div class="choice-card" style="border-color:var(--p5-yellow);" onclick="executeNemesisPeace()">
        <div>
          <h4><span>🤝 選擇二：【大和解 (兄弟合體)】</span></h4>
          <div class="choice-desc">
            「兩兄弟沒有隔夜仇！」兩人當場握手言和，直接合體進化為隱藏神卡 —— <strong>【☯️ 安迪與奧本海默】</strong>！<br><br>
            • <strong>專屬羈絆【最強之兩人】</strong>：免儀式站場、單人計 2 個華爾街空頭，且<strong>普攻與大招全部變成全體 AOE 金融風暴</strong>！
          </div>
        </div>
        <div class="choice-stats" style="color:var(--p5-yellow);">🌟 永久合體變身為隱藏神卡</div>
      </div>
    </div>
  `;
}

function executeNemesisPeace() {
  battleComboLogs.push('🤝 觸發【宿敵大和解】：合體誕生神卡「☯️ 安迪與奧本海默」');
  addLog(`<span class="tag-event">☯️ 世紀大和解</span> 股票奧本海默與 Andy安迪 合體進化為<strong>【☯️ 安迪與奧本海默】</strong>！`);
  triggerCutIn('☯️', '安迪與奧本海默', '世紀大和解・最強之兩人合體降臨！', 'awakening');

  const allOwned = getAllOwnedPlayerUnits();
  const existingAllyOpp = allOwned.find(u => u.id === 'stock_opp');
  const existingAllyAndy = allOwned.find(u => u.id === 'andy');
  const fusedStars = Math.max(existingAllyOpp ? existingAllyOpp.stars : 1, existingAllyAndy ? existingAllyAndy.stars : 1);

  enemyRoster.forEach(e => {
    if (e.id === 'andy' || e.id === 'stock_opp') { e.hp = 0; e.ghostHp = 0; e.shield = 0; }
  });

  playerRoster = playerRoster.filter(u => u.id !== 'stock_opp' && u.id !== 'andy');
  playerBench = playerBench.filter(u => u.id !== 'stock_opp' && u.id !== 'andy');

  const fusedUnit = createUnitInstance(FUSED_HERO_TEMPLATE, fusedStars, true);
  fusedUnit.mp = 50;
  playerRoster.unshift(fusedUnit);

  document.getElementById('nemesisModal').classList.add('hidden');
  isPausedForEvent = false;
  updateUI();
}

function startDiceDuel() {
  duelState = { round: 1, oppWins: 0, andyWins: 0, rolling: false };
  renderDiceDuelUI('準備開始第 1 盤擲骰對決！（點擊下方按鈕擲出 3 顆 6 面骰）');
}

function renderDiceDuelUI(statusMsg, oppDice = ['🎲','🎲','🎲'], andyDice = ['🎲','🎲','🎲'], oppSum = '-', andySum = '-') {
  const content = document.getElementById('nemesisContent');
  const isFinished = duelState.oppWins >= 2 || duelState.andyWins >= 2;

  content.innerHTML = `
    <h2 class="modal-title" style="color:var(--p5-red);">🎲 華爾街鐵籠死鬥（三盤兩勝・3D6 賭命單挑）</h2>
    <div style="margin: 10px 0;">
      <span class="score-board">📈 奧本海默 【 ${duelState.oppWins} : ${duelState.andyWins} 】 🛢️ Andy安迪</span>
    </div>
    <div class="duel-arena">
      <div class="duel-fighter">
        <h3 style="color:#60a5fa;">📈 股票奧本海默</h3>
        <div class="dice-row">${oppDice.map(d => `<div class="die-box">${d}</div>`).join('')}</div>
        <div>點數總和：<strong style="color:var(--p5-yellow);">${oppSum}</strong></div>
      </div>
      <div style="font-size:1.6rem; font-weight:900; color:var(--p5-red);">VS</div>
      <div class="duel-fighter">
        <h3 style="color:#c084fc;">🛢️ Andy安迪</h3>
        <div class="dice-row">${andyDice.map(d => `<div class="die-box">${d}</div>`).join('')}</div>
        <div>點數總和：<strong style="color:var(--p5-yellow);">${andySum}</strong></div>
      </div>
    </div>
    <div style="background:#0d0e11; padding:12px; border:1px solid #3f4147; margin-bottom:15px; font-weight:bold; color:#fff;">
      ${statusMsg}
    </div>
    ${!isFinished
      ? `<button class="btn btn-primary" style="width:240px;" onclick="rollDuelRound()">🎲 擲出第 ${duelState.round} 盤骰子</button>`
      : `<button class="btn btn-secondary" style="width:240px;" onclick="finishDiceDuel()">✔ 確認死鬥結果並返回戰場</button>`}
  `;
}

function rollDuelRound() {
  if (duelState.rolling) return;
  const r = () => Math.floor(Math.random() * 6) + 1;
  const oD = [r(), r(), r()];
  const aD = [r(), r(), r()];
  const oSum = oD.reduce((a, b) => a + b, 0);
  const aSum = aD.reduce((a, b) => a + b, 0);

  let msg = '';
  if (oSum > aSum) {
    duelState.oppWins++;
    msg = `第 ${duelState.round} 盤：📈 股票奧本海默 (${oSum}點) 擊敗 🛢️ Andy安迪 (${aSum}點)！`;
    duelState.round++;
  } else if (aSum > oSum) {
    duelState.andyWins++;
    msg = `第 ${duelState.round} 盤：🛢️ Andy安迪 (${aSum}點) 擊敗 📈 股票奧本海默 (${oSum}點)！`;
    duelState.round++;
  } else {
    msg = `第 ${duelState.round} 盤雙方平手 (${oSum}點)！重新加賽！`;
  }
  renderDiceDuelUI(msg, oD, aD, oSum, aSum);
}

function finishDiceDuel() {
  const oppWon = duelState.oppWins >= 2;
  const winnerId = oppWon ? 'stock_opp' : 'andy';
  const loserId = oppWon ? 'andy' : 'stock_opp';

  playerRoster = playerRoster.filter(u => u.id !== loserId);
  playerBench = playerBench.filter(u => u.id !== loserId);
  enemyRoster.forEach(e => {
    if (e.id === loserId) { e.hp = 0; e.ghostHp = 0; }
  });

  let winnerUnit = findOwnedUnitById(winnerId);
  if (winnerUnit) {
    winnerUnit.nemesisMultiplier = 2.0;
    winnerUnit.atk = Math.round(winnerUnit.atk * 2.0);
    winnerUnit.hp = winnerUnit.maxHp;
    winnerUnit.ghostHp = winnerUnit.maxHp;
    winnerUnit.mp = Math.min(winnerUnit.maxMp, (winnerUnit.mp || 0) + 50);
    bonusAugmentPending++;
    enemyRoster.forEach(e => { if (e.id === winnerId) e.hp = 0; });
    addLog(`🎲 <strong>【3D6 鐵籠死鬥】${winnerUnit.name}</strong> 勝出！攻擊力永久翻倍 (2x) 並獲得過關額外海克斯獎勵！`);
  }

  document.getElementById('nemesisModal').classList.add('hidden');
  isPausedForEvent = false;
  updateUI();
}

// ================= 16. 戰鬥結算、❤️×2 心心命數制與賽後戰報 =================
function endBattle(playerWon) {
  isBattling = false;
  isManualPaused = false;
  clearInterval(battleInterval);

  document.getElementById('startBattleBtn').disabled = false;
  const pauseBtn = document.getElementById('pauseBattleBtn');
  const stepBtn = document.getElementById('stepBattleBtn');
  if (pauseBtn) pauseBtn.disabled = true;
  if (stepBtn) stepBtn.disabled = true;

  if (!playerWon) {
    playerLives = Math.max(0, playerLives - 1);
  }
  updateUI();
  showPostBattleReport(playerWon);
}

function showPostBattleReport(playerWon) {
  const modal = document.getElementById('reportModal');
  const content = document.getElementById('reportContent');
  modal.classList.remove('hidden');

  let mvpUnit = playerRoster[0];
  playerRoster.forEach(u => {
    if ((u.stats.dmgDealt + u.stats.healed) > ((mvpUnit?.stats.dmgDealt || 0) + (mvpUnit?.stats.healed || 0))) {
      mvpUnit = u;
    }
  });

  const rowsHtml = playerRoster.map(u => `
    <tr>
      <td><strong>${u.icon} ${u.name} (★${u.stars})</strong> ${u === mvpUnit ? '<span class="tag-crit">👑 MVP</span>' : ''}</td>
      <td style="color:#fdba74; font-weight:bold;">${u.stats.dmgDealt}</td>
      <td style="color:#67e8f9; font-weight:bold;">${u.stats.healed}</td>
      <td style="color:#fca5a5;">${u.stats.dmgTaken}</td>
    </tr>
  `).join('');

  let titleHtml = '';
  let btnHtml = '';

  if (playerWon) {
    if (currentStage >= maxStage) {
      titleHtml = `<h2 class="modal-title" style="color:var(--p5-yellow);">🏆 恭喜全破 8 層深淵！成功擊潰終極魔王【👹 楊守正】！</h2>`;
      btnHtml = `<button class="btn btn-primary" style="width:260px;" onclick="initGame()">🔄 開啟新一輪深淵遠征</button>`;
    } else {
      titleHtml = `<h2 class="modal-title" style="color:var(--p5-green);">🎉 第 ${currentStage} 關挑戰成功！</h2>`;
      btnHtml = `<button class="btn btn-primary" style="width:260px;" onclick="advanceToNextStage()">➡️ 領取獎勵並前往第 ${currentStage + 1} 關</button>`;
    }
  } else {
    if (playerLives > 0) {
      titleHtml = `<h2 class="modal-title" style="color:var(--p5-yellow);">💔 第 ${currentStage} 關戰敗（扣除 1 命，尚餘 ❤️×${playerLives} 命）</h2>
                   <p class="modal-sub">當關敵方已重置！你可在戰前調整 1～4 號站位或與冷板凳交換成員後再次挑戰！</p>`;
      btnHtml = `<button class="btn btn-secondary" style="width:260px;" onclick="retryCurrentStage()">🛡️ 調整站位並重戰第 ${currentStage} 關</button>`;
    } else {
      titleHtml = `<h2 class="modal-title" style="color:var(--p5-red);">💀 2 顆心心命數耗盡 — 深淵遠征失敗 (GAME OVER)</h2>`;
      btnHtml = `<button class="btn btn-danger" style="width:260px;" onclick="initGame()">🔄 重新開始新一局</button>`;
    }
  }

  content.innerHTML = `
    ${titleHtml}
    <table class="stats-table">
      <thead>
        <tr>
          <th>出戰英雄</th>
          <th>⚔️ 造成傷害</th>
          <th>💚 治療與護盾</th>
          <th>🛡️ 承受傷害</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div style="margin-top:16px;">${btnHtml}</div>
  `;
}

function advanceToNextStage() {
  document.getElementById('reportModal').classList.add('hidden');
  currentStage++;
  generateEnemyTeam(currentStage);
  resetPlayerUnitsForStage();
  updateUI();
  showHeroDraft(
    `過關招募獎勵 (準備挑戰第 ${currentStage} / ${maxStage} 關)`,
    '挑選 1 位英雄加入小隊或冷板凳（選中同名英雄可跨板凳直接合成升星！）'
  );
}

function retryCurrentStage() {
  document.getElementById('reportModal').classList.add('hidden');
  resetPlayerUnitsForStage();
  generateEnemyTeam(currentStage);
  updateUI();
}

// ================= 17. 深淵全圖鑑系統 (Codex) =================
function openCodex() {
  const modal = document.getElementById('codexModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderCodexTab('heroes');
}

function closeCodex() {
  const modal = document.getElementById('codexModal');
  if (modal) modal.classList.add('hidden');
}

function renderCodexTab(tab) {
  ['tabHeroes', 'tabTraits', 'tabAugments'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const body = document.getElementById('codexBody');
  if (!body) return;

  if (tab === 'heroes') {
    document.getElementById('tabHeroes').classList.add('active');
    const allList = [FINAL_BOSS_TEMPLATE, FUSED_HERO_TEMPLATE, ...HERO_POOL];
    body.innerHTML = `<div class="choices-grid">` + allList.map(h => `
      <div class="choice-card" style="cursor:default;">
        <div>
          <h4><span>${h.icon} ${h.name}</span> <span class="trait-pill">🎯射程:${h.range || 1}</span></h4>
          <div style="font-size:0.75rem; color:#fde047; margin-bottom:6px;">${h.title || ''}</div>
          <div class="choice-traits">${(h.traits || []).map(t => `<span class="trait-pill">${t}</span>`).join('')}</div>
          <div class="choice-desc">
            <strong>【${h.skillName}】</strong><br>${h.skillDesc}
            ${h.awakeningName ? `<div class="awakening-box"><strong>⚡ ${h.awakeningName}：</strong>${h.awakeningDesc}</div>` : ''}
          </div>
        </div>
        <div class="choice-stats">❤️ ${h.hp} | ⚔️ ${h.atk} | ⚡ ${h.spd} | 💧 ${h.noMpHero ? '無魔力' : h.maxMp}</div>
      </div>
    `).join('') + `</div>`;
  } else if (tab === 'traits') {
    document.getElementById('tabTraits').classList.add('active');
    body.innerHTML = `<div class="choices-grid">` + Object.entries(TRAIT_INFO).map(([k, v]) => `
      <div class="choice-card" style="cursor:default;">
        <div>
          <h4><span>🔗 ${k}</span> <span class="upgrade-tag">${v.req}</span></h4>
          <div class="choice-desc">${v.desc}</div>
        </div>
        <div class="choice-stats" style="color:#f9a8d4;">${v.lore}</div>
      </div>
    `).join('') + `</div>`;
  } else {
    document.getElementById('tabAugments').classList.add('active');
    body.innerHTML = `<div class="choices-grid">` + AUGMENT_POOL.map(a => `
      <div class="choice-card" style="cursor:default;">
        <div>
          <h4><span>${a.name}</span></h4>
          <div class="choice-desc">${a.desc}</div>
        </div>
      </div>
    `).join('') + `</div>`;
  }
}

// ================= 18. 戰鬥紀錄輔助與 DOMContentLoaded 啟動 =================
function addLog(html) {
  const logBox = document.getElementById('battleLog');
  if (!logBox) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = html;
  logBox.appendChild(entry);
  logBox.scrollTop = logBox.scrollHeight;
}

window.addEventListener('DOMContentLoaded', () => {
  initGame();
});