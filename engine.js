// ================= 1. 遊戲全局狀態與統計 (V4 硬核深淵：命數與極意) =================
let currentStage = 1;
const maxStage = 8;
const MAX_STARS = 3;
let playerLives = 2;
const maxLives = 2;

let playerRoster = [];
let playerAugments = [];
let enemyRoster = [];
let battleInterval = null;
let battleSpeed = 850;
let isBattling = false;
let isPausedForEvent = false;
let nemesisTriggeredThisBattle = false;
let nemesisEventCompleted = false;
let bonusAugmentPending = 0;
let battleComboLogs = [];
let visualQueue = [];
let bankruptAvailable = false;
let overdriveActive = false;
let currentRoundNumber = 1;
let battleStartTime = 0;

// 懸浮視窗控制
const tooltipEl = document.getElementById('customTooltip');
function showTooltip(e, title, desc, lore = '') {
  if (!tooltipEl) return;
  tooltipEl.innerHTML = `<div class="tt-title">${title}</div><div>${desc}</div>${lore ? `<div class="tt-lore">${lore}</div>` : ''}`;
  tooltipEl.style.display = 'block';
  moveTooltip(e);
}
function moveTooltip(e) {
  if (!tooltipEl || tooltipEl.style.display === 'none') return;
  let x = e.clientX + 14, y = e.clientY + 14;
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
  e.stopPropagation();
  const info = TRAIT_INFO[traitName];
  if (info) showTooltip(e, `🔗 羈絆：【${traitName}】(${info.req})`, info.desc, info.lore);
}

// ================= 2. Persona 5 (P5) 放射集中線與斜切特寫橫幅 (Cut-in Banner) =================
let cutInTimeout = null;
function triggerCutIn(icon, name, subTitle, styleType = 'ult') {
  const banner = document.getElementById('p5CutInOverlay');
  const speedLines = document.getElementById('p5SpeedLines');
  if (!banner) return;

  const contentEl = document.getElementById('p5CutInContent');
  banner.className = `p5-cutin-overlay active-${styleType}`;
  if (speedLines) speedLines.classList.add('active');

  contentEl.innerHTML = `
    <div class="p5-cutin-slash">
      <div class="p5-cutin-icon">${icon}</div>
      <div class="p5-cutin-text">
        <div class="p5-cutin-name">${name}</div>
        <div class="p5-cutin-sub">${subTitle}</div>
      </div>
    </div>
  `;

  if (cutInTimeout) clearTimeout(cutInTimeout);
  cutInTimeout = setTimeout(() => {
    banner.className = 'p5-cutin-overlay hidden';
    if (speedLines) speedLines.classList.remove('active');
  }, 1150);
}

// ================= 3. 初始化、命數顯示與流程控制 =================
function initGame() {
  currentStage = 1;
  playerLives = 2;
  playerRoster = [];
  playerAugments = [];
  bonusAugmentPending = 0;
  nemesisEventCompleted = false;
  isBattling = false;
  isPausedForEvent = false;
  clearInterval(battleInterval);

  const confirmModal = document.getElementById('confirmResetModal');
  if (confirmModal) confirmModal.classList.add('hidden');
  const reportModal = document.getElementById('reportModal');
  if (reportModal) reportModal.classList.add('hidden');

  document.getElementById('battleLog').innerHTML =
    '<div class="log-entry">🎩 歡迎來到 <strong>《DC BON 全明星自動戰棋》V4【硬核深淵：命數與極意】</strong>！本版本導入 <strong>Persona 5 戰鬥視覺</strong>、<span class="tag-buff">🛡️ 護盾系統</span>、<span class="tag-crit">★3 專屬覺醒極意</span> 與 <strong>❤️×2 心心命數制</strong>！</div>';

  generateEnemyTeam(currentStage);
  updateUI();
  showHeroDraft('選擇你的初始英雄 (第 1 / 8 關)', '挑選 1 位 Discord 成員作為開局隊長 (Andy安迪將於第 2 關後解鎖；滿 ★3 英雄將解鎖覺醒極意並移出卡池)');
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

function syncBaemonTransformation() {
  const hasBaemon = playerAugments.some(a => a.id === 'aug_baemon');
  playerRoster.forEach(u => {
    if (u.id === 'stock_opp') {
      if (hasBaemon) {
        u.traits = ['狂熱信仰'];
        u.icon = '👾';
        u.skillName = '寶怪應援・SHEESH打Call';
        u.skillDesc = '【寶怪回歸轉職】捨棄華爾街空頭，化身為狂熱寶怪粉絲！揮舞手燈為我方全體回復 145 點生命值、附加 100 護盾並使全體隊友攻速 (SPD) 提升 +18！';
      } else {
        u.traits = ['華爾街空頭'];
        u.icon = '📈';
        u.skillName = '百倍槓桿爆倉';
        u.skillDesc = '投下金融核彈！隨機觸發【牛市暴漲】(全隊攻擊+25% 並轟炸敵方全體) 或【割韭菜】(吸取敵方最高血量者 165% 傷害轉為自身生命)。';
      }
    }
  });
}

// ================= 4. 選卡、★3 鎖定終點與【🥬 大力生菜】指定升星 =================
function getRandomItems(arr, count) {
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, count);
}

function getEligibleHeroPool(stage, forEnemy = false) {
  return HERO_POOL.filter(h => {
    // 規則 1：Andy安迪只會在第 2 關之後出現
    if (h.minStage && stage < h.minStage) return false;
    // 規則 2：一旦完成了宿敵事件，安迪與股票奧本海默不再出現於敵方或招募池中
    if (nemesisEventCompleted && (h.id === 'andy' || h.id === 'stock_opp')) return false;
    // 規則 3 (V4 新增)：★3 鎖定終點！已達 ★3 的我方英雄自動從招募池排除
    if (!forEnemy) {
      const existing = playerRoster.find(u => u.id === h.id);
      if (existing && existing.stars >= MAX_STARS) return false;
    }
    return true;
  });
}

function updateDraftOverview() {
  const teamEl = document.getElementById('draftTeamPreview');
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

  if (playerAugments.length === 0) {
    augEl.innerHTML = '<span style="color:var(--text-muted)">無</span>';
  } else {
    augEl.innerHTML = playerAugments.map(a => {
      const safeDesc = a.desc.replace(/'/g, "\\'");
      return `<span class="badge augment" onmouseenter="showTooltip(event, '${a.name}', '${safeDesc}')" onmouseleave="hideTooltip()">${a.name}</span>`;
    }).join('');
  }
}

function showHeroDraft(title, subtitle) {
  updateDraftOverview();
  const overlay = document.getElementById('modalOverlay');
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
    const existing = playerRoster.find(h => h.id === hero.id);
    const nextStar = existing ? existing.stars + 1 : 1;
    const card = document.createElement('div');
    card.className = 'choice-card p5-card-skew';
    card.innerHTML = `
      <div>
        <h4>
          <span>${hero.icon} ${hero.name}</span>
          ${existing ? `<span class="upgrade-tag">${nextStar === 3 ? '🔥 升 ★3 解鎖極意!' : `可升星 ★${nextStar}`}</span>` : ''}
        </h4>
        ${hero.title ? `<div style="font-size:0.74rem; color:#fde047; margin-bottom:5px; font-weight:bold;">${hero.title}</div>` : ''}
        <div class="choice-traits">
          ${hero.traits.map(t => `<span class="trait-pill" onmouseenter="showTraitTooltip(event, '${t}')" onmouseleave="hideTooltip()">${t}</span>`).join('')}
        </div>
        <div class="choice-desc">
          <strong>【${hero.skillName}】</strong><br>${hero.skillDesc}
          ${hero.awakeningName ? `<div class="awakening-box"><strong>⚡ ${hero.awakeningName}：</strong>${hero.awakeningDesc}</div>` : ''}
          ${hero.easterEggHint ? `<div class="easter-hint">${hero.easterEggHint}</div>` : ''}
        </div>
      </div>
      <div class="choice-stats">❤️ HP: ${hero.hp} | ⚔️ ATK: ${hero.atk} | ⚡ SPD: ${hero.spd} | 💧 MP: ${hero.noMpHero ? '無魔力(0)' : hero.maxMp}</div>
    `;
    card.onclick = () => { hideTooltip(); selectHero(hero); };
    grid.appendChild(card);
  });
  overlay.classList.remove('hidden');
}

function upgradeUnitStar(unit, sourceLabel = '招募升星') {
  if (unit.stars >= MAX_STARS) return;
  unit.stars += 1;
  unit.baseHp = Math.round(unit.baseHp * 1.35);
  unit.baseAtk = Math.round(unit.baseAtk * 1.35);

  if (unit.stars >= MAX_STARS) {
    triggerCutIn(unit.icon, unit.name, unit.awakeningName || '★3 終極覺醒極意解鎖！', 'awakening');
    addLog(`🌟 <strong>${unit.icon} ${unit.name}</strong> 透過【${sourceLabel}】達成 <span class="tag-crit">★3 終極覺醒</span>！解鎖極意<strong>${unit.awakeningName || ''}</strong>（已自招募池封頂排除）！`);
  } else {
    addLog(`⭐ <strong>${unit.icon} ${unit.name}</strong> (${sourceLabel}) <span class="tag-buff">🟢 升星 ★${unit.stars}</span> 基礎生命與攻擊力 +35%！`);
  }
}

function selectHero(heroTemplate) {
  const existing = playerRoster.find(h => h.id === heroTemplate.id);
  if (existing) {
    upgradeUnitStar(existing, '招募合成');
    proceedAfterHeroSelection();
  } else if (playerRoster.length < 4) {
    playerRoster.push({
      ...heroTemplate,
      traits: [...heroTemplate.traits],
      stars: 1,
      baseHp: heroTemplate.hp,
      baseAtk: heroTemplate.atk
    });
    syncBaemonTransformation();
    addLog(`🎉 招募新隊員：<strong>${heroTemplate.icon} ${heroTemplate.name}</strong>！`);
    proceedAfterHeroSelection();
  } else {
    showReplaceModal(heroTemplate);
  }
}

function showReplaceModal(newHero) {
  updateDraftOverview();
  document.getElementById('modalTitle').innerText = `隊伍已滿 (4/4)！請選擇要替換的隊員`;
  document.getElementById('modalSub').innerText = `點擊下方現有隊員將其替換為【${newHero.icon} ${newHero.name}】，或點擊略過保持原陣容`;
  const grid = document.getElementById('choicesGrid');
  grid.innerHTML = '';

  playerRoster.forEach((ally, idx) => {
    const card = document.createElement('div');
    card.className = 'choice-card p5-card-skew';
    card.innerHTML = `
      <div>
        <h4><span>替換：${ally.icon} ${ally.name} (★${ally.stars})</span></h4>
        <div class="choice-desc">將此位置換成 <strong>${newHero.icon} ${newHero.name} (★1)</strong></div>
      </div>
      <div class="choice-stats">目前屬性：❤️ ${ally.baseHp} | ⚔️ ${ally.baseAtk}</div>
    `;
    card.onclick = () => {
      playerRoster[idx] = { ...newHero, traits: [...newHero.traits], stars: 1, baseHp: newHero.hp, baseAtk: newHero.atk };
      syncBaemonTransformation();
      proceedAfterHeroSelection();
    };
    grid.appendChild(card);
  });

  const skipCard = document.createElement('div');
  skipCard.className = 'choice-card p5-card-skew';
  skipCard.innerHTML = `<h4>🚫 不替換，維持現有陣容</h4><div class="choice-desc">直接進入海克斯增幅選擇階段</div><div class="choice-stats">保留原隊伍</div>`;
  skipCard.onclick = () => proceedAfterHeroSelection();
  grid.appendChild(skipCard);
}

function proceedAfterHeroSelection() {
  if (currentStage === 1 && playerAugments.length === 0 && bonusAugmentPending === 0 && document.getElementById('stageDisplay').innerText.includes('第 1')) {
    document.getElementById('modalOverlay').classList.add('hidden');
    generateEnemyTeam(currentStage);
    prepareUnitsForStage();
    updateUI();
  } else {
    showAugmentDraft();
  }
}

function showAugmentDraft(isBonus = false) {
  updateDraftOverview();
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('draftModalContent').classList.remove('hidden');
  overlay.style.background = 'rgba(0,0,0,0.86)';
  document.getElementById('modalTitle').innerText = isBonus ? `🏆 【宿敵死鬥獎勵】額外海克斯增幅 3 選 1！` : `⚡ 海克斯增幅 3 選 1 (第 ${currentStage} / ${maxStage} 關前強化)`;
  document.getElementById('modalSub').innerText = `已選過的增幅不會重複出現（新增【🥬 大力生菜】可手動指定隊員升星！）`;
  const grid = document.getElementById('choicesGrid');
  grid.innerHTML = '';

  const eligibleAugments = AUGMENT_POOL.filter(aug => {
    if (playerAugments.some(a => a.id === aug.id)) return false;
    if (aug.reqHero && !playerRoster.some(u => u.id === aug.reqHero)) return false;
    if (aug.id === 'aug_lettuce' && !playerRoster.some(u => u.stars < MAX_STARS)) return false;
    return true;
  });

  const choices = getRandomItems(eligibleAugments, Math.min(3, eligibleAugments.length));
  if (choices.length === 0) {
    finishAugmentStep();
    return;
  }

  choices.forEach(aug => {
    const card = document.createElement('div');
    card.className = 'choice-card p5-card-skew';
    card.innerHTML = `
      <div>
        <h4><span>${aug.name}</span></h4>
        <div class="choice-desc">${aug.desc}</div>
      </div>
      <div class="choice-stats">${aug.id === 'aug_lettuce' ? '🥬 立即手動指定 1 名隊員升 1 星' : (aug.reqHero ? '🌟 角色專屬轉職增幅' : '永久全隊生效 (不重複)')}</div>
    `;
    card.onclick = () => {
      playerAugments.push(aug);
      syncBaemonTransformation();
      addLog(`⚡ 獲得海克斯增幅：<span class="tag-event">${aug.name}</span>！`);
      if (aug.id === 'aug_lettuce') {
        showLettuceUpgradeModal();
      } else {
        finishAugmentStep();
      }
    };
    grid.appendChild(card);
  });
  overlay.classList.remove('hidden');
}

// V4 新海克斯【🥬 大力生菜】手動指定隊員升 1 星視窗
function showLettuceUpgradeModal() {
  updateDraftOverview();
  document.getElementById('modalTitle').innerText = `🥬 【大力生菜】發動！請指定 1 名隊員直接升 1 星`;
  document.getElementById('modalSub').innerText = `選中的隊員將立即提升 1 個星級（基礎 HP 與 ATK +35%，升至 ★3 立即解鎖專屬覺醒極意！）`;
  const grid = document.getElementById('choicesGrid');
  grid.innerHTML = '';

  const upgradableAllies = playerRoster.filter(u => u.stars < MAX_STARS);
  if (upgradableAllies.length === 0) {
    finishAugmentStep();
    return;
  }

  upgradableAllies.forEach(ally => {
    const nextStar = ally.stars + 1;
    const card = document.createElement('div');
    card.className = 'choice-card p5-card-skew';
    card.innerHTML = `
      <div>
        <h4>
          <span>${ally.icon} ${ally.name}</span>
          <span class="upgrade-tag">★${ally.stars} ➔ ★${nextStar}</span>
        </h4>
        <div class="choice-desc">
          ${nextStar === 3
            ? `<strong style="color:#fde047;">🔥 升上 ★3 終極星級！立即解鎖：${ally.awakeningName || '專屬極意'}</strong><br>${ally.awakeningDesc || ''}`
            : `基礎生命值提升至 <strong>${Math.round(ally.baseHp * 1.35)}</strong>，基礎攻擊力提升至 <strong>${Math.round(ally.baseAtk * 1.35)}</strong>！`}
        </div>
      </div>
      <div class="choice-stats">點擊立即餵食【🥬 大力生菜】升星</div>
    `;
    card.onclick = () => {
      upgradeUnitStar(ally, '🥬大力生菜');
      finishAugmentStep();
    };
    grid.appendChild(card);
  });
}

function finishAugmentStep() {
  const overlay = document.getElementById('modalOverlay');
  if (bonusAugmentPending > 0) {
    bonusAugmentPending--;
    showAugmentDraft(true);
  } else {
    overlay.classList.add('hidden');
    generateEnemyTeam(currentStage);
    prepareUnitsForStage();
    updateUI();
  }
}

// ================= 5. 8 關卡敵軍生成與第 8 關終極 Boss【👹 楊守正】 =================
function generateEnemyTeam(stage) {
  // 第 8 關：深淵終極 Boss【👹 楊守正（3,200 HP + 1,000 護盾）】帶領 2 名 ★3 菁英護衛
  if (stage === 8) {
    const elitePool = HERO_POOL.filter(h => ['freeted', 'dv', 'dvp', 'dashen', 'hugo', 'loki', 'dc_tesla'].includes(h.id));
    const guards = getRandomItems(elitePool, 2);

    const bossUnit = {
      ...FINAL_BOSS_TEMPLATE,
      traits: [...FINAL_BOSS_TEMPLATE.traits],
      stars: 3,
      maxHp: 3200,
      hp: 3200,
      ghostHp: 3200,
      shield: 1000,
      atk: FINAL_BOSS_TEMPLATE.atk,
      spd: FINAL_BOSS_TEMPLATE.spd,
      curSpd: FINAL_BOSS_TEMPLATE.spd,
      mp: 0,
      maxMp: FINAL_BOSS_TEMPLATE.maxMp,
      isAlly: false,
      isBoss: true,
      phase2Triggered: false,
      inRitual: false,
      sisMarks: 0,
      stats: { dmgDealt: 0, dmgTaken: 0, healed: 0 }
    };

    const guardUnits = guards.map(g => {
      const hp = Math.round(g.hp * 1.65);
      const atk = Math.round(g.atk * 1.5);
      const spd = g.id === 'freeted' ? Math.round(g.spd * 1.25) : g.spd;
      const maxMp = g.noMpHero ? 0 : (g.lockedMaxMp || g.maxMp);
      return {
        ...g,
        traits: [...g.traits],
        stars: 3,
        maxHp: hp,
        hp: hp,
        ghostHp: hp,
        shield: g.traits.includes('父親大人') ? Math.round(hp * 0.2) : 250,
        atk: atk,
        spd: spd,
        curSpd: spd,
        mp: 0,
        maxMp: maxMp,
        isAlly: false,
        inRitual: false,
        sisMarks: 0,
        basicAtkCount: 0,
        hadTeammatesAtStart: true,
        initialBattleAtk: atk,
        initialBattleSpd: spd,
        stats: { dmgDealt: 0, dmgTaken: 0, healed: 0 }
      };
    });

    enemyRoster = [bossUnit, ...guardUnits];
    addLog(`👹 <span class="tag-nerf">⚠️ 第 8 關深淵終極 Boss 降臨</span> <strong>【👹 楊守正 (3,200 HP + 1,000 護盾)】</strong> 率領 2 名 ★3 覺醒菁英護衛鎮守深淵！`);
    return;
  }

  // 第 1 ~ 7 關：前 5 關平緩過渡，第 6~7 關檢驗成型羈絆與 ★3 覺醒
  const enemyCount = stage === 1 ? 1 : (stage === 2 ? 2 : (stage === 3 ? 3 : 4));
  const pool = getEligibleHeroPool(stage, true);
  let templates = getRandomItems(pool, enemyCount);

  // 【宿命引力 35%】：第 2 關後且未完成宿敵事件時觸發
  const allyHasOpp = playerRoster.some(u => u.id === 'stock_opp');
  const allyHasAndy = playerRoster.some(u => u.id === 'andy');
  if (stage >= 2 && stage <= 7 && !nemesisEventCompleted && (allyHasOpp || allyHasAndy) && Math.random() < 0.35) {
    const nemesisId = allyHasOpp ? 'andy' : 'stock_opp';
    if (!templates.some(t => t.id === nemesisId)) {
      const nemesisTemplate = HERO_POOL.find(h => h.id === nemesisId);
      if (nemesisTemplate) {
        templates[0] = nemesisTemplate;
        addLog(`<span class="tag-event">⚡ 宿命引力</span> 對面陣營出現了宿敵 <strong>${nemesisTemplate.icon} ${nemesisTemplate.name}</strong>！（提示：將你的宿敵擺在 1 號位等待安迪完成儀式！）`);
      }
    }
  }

  // 平緩曲線 (1~5關) 與 覺醒檢驗曲線 (6~7關)
  const scaleTable = { 1: 0.85, 2: 0.94, 3: 1.03, 4: 1.12, 5: 1.22, 6: 1.36, 7: 1.50 };
  const scale = scaleTable[stage] || 1.0;

  enemyRoster = templates.map((t, idx) => {
    let stars = 1;
    if (stage === 4 && idx === 0) stars = 2;
    else if (stage === 5) stars = idx < 2 ? 2 : 1;
    else if (stage === 6) stars = idx === 0 ? 3 : 2;
    else if (stage === 7) stars = idx < 2 ? 3 : 2;

    const starHpMult = stars === 3 ? 1.5 : (stars === 2 ? 1.22 : 1);
    const starAtkMult = stars === 3 ? 1.42 : (stars === 2 ? 1.18 : 1);
    const hp = Math.round(t.hp * scale * starHpMult);
    const atk = Math.round(t.atk * scale * starAtkMult);
    const spd = (t.id === 'freeted' && stars >= 3) ? Math.round(t.spd * 1.25) : t.spd;
    const maxMp = t.noMpHero ? 0 : (t.lockedMaxMp || t.maxMp);
    const startShield = t.traits.includes('父親大人') ? Math.round(hp * 0.1) : (stage >= 6 && idx === 0 ? 150 : 0);

    return {
      ...t,
      traits: [...t.traits],
      stars,
      maxHp: hp,
      hp: hp,
      ghostHp: hp,
      shield: startShield,
      atk: atk,
      spd: spd,
      curSpd: spd,
      mp: 0,
      maxMp: maxMp,
      isAlly: false,
      ritualCount: t.id === 'andy' ? 0 : null,
      inRitual: t.id === 'andy' && enemyCount > 1,
      sisMarks: 0,
      petSingleBar: false,
      isWeakened: false,
      basicAtkCount: 0,
      hadTeammatesAtStart: enemyCount > 1,
      initialBattleAtk: atk,
      initialBattleSpd: spd,
      stats: { dmgDealt: 0, dmgTaken: 0, healed: 0 }
    };
  });
}

// 戰敗扣 1 命後重置當關敵方滿血與護盾
function resetCurrentEnemyStage() {
  enemyRoster.forEach(e => {
    e.hp = e.maxHp;
    e.ghostHp = e.maxHp;
    if (e.id === 'boss_yeung') {
      e.shield = 1000;
      e.phase2Triggered = false;
      e.atk = FINAL_BOSS_TEMPLATE.atk;
      e.curSpd = FINAL_BOSS_TEMPLATE.spd;
    } else {
      e.shield = e.traits.includes('父親大人') ? Math.round(e.maxHp * 0.1) : 0;
      e.curSpd = e.spd;
      e.atk = e.initialBattleAtk || e.atk;
    }
    e.mp = 0;
    e.sisMarks = 0;
    e.isWeakened = false;
    e.isDemonized = false;
    e.bDogTransferActive = false;
    e.inRitual = (e.id === 'andy' && enemyRoster.length > 1);
    e.ritualCount = e.id === 'andy' ? 0 : null;
    e.basicAtkCount = 0;
    e.stats = { dmgDealt: 0, dmgTaken: 0, healed: 0 };
  });
}

function getActiveSynergies(roster) {
  const counts = {};
  roster.forEach(u => {
    u.traits.forEach(t => {
      const weight = (u.traitWeight && u.traitWeight[t]) ? u.traitWeight[t] : 1;
      counts[t] = (counts[t] || 0) + weight;
    });
  });
  return counts;
}

function prepareUnitsForStage() {
  syncBaemonTransformation();
  const syn = getActiveSynergies(playerRoster);
  const hasAug = (id) => playerAugments.some(a => a.id === id);
  const hasAwakenedDcTesla = playerRoster.some(u => u.id === 'dc_tesla' && u.stars >= 3);
  const hasAwakenedFused = playerRoster.some(u => u.id === 'andy_opp_fused' && u.stars >= 3);

  playerRoster.forEach((u, idx) => {
    let maxHp = u.baseHp;
    let atk = u.baseAtk;
    let spd = u.spd;
    let startMp = 0;
    let startShield = 0;

    // 1. 【S.I.S】3人羈絆
    if ((syn['S.I.S'] || 0) >= 3 && u.traits.includes('S.I.S')) {
      maxHp = Math.round(maxHp * 1.25);
      atk = Math.round(atk * 1.25);
    }

    // 2. 【3幻神】
    if ((syn['3幻神'] || 0) >= 2) { atk = Math.round(atk * 1.15); spd += 12; }
    if ((syn['3幻神'] || 0) >= 3) { maxHp = Math.round(maxHp * 1.2); atk = Math.round(atk * 1.25); }

    // 3. 【華爾街空頭】、【科技代碼】、【狂熱信仰】
    if ((syn['華爾街空頭'] || 0) >= 2) { atk = Math.round(atk * 1.2); }
    if ((syn['科技代碼'] || 0) >= 2) { startMp += 30; }
    if ((syn['狂熱信仰'] || 0) >= 2) { maxHp = Math.round(maxHp * 1.2); }

    // 4. V4 重製【大佬時代】（最高 3 階：1人自身+10% HP；2人自身+15% HP；3人全隊+20% HP）
    const bigBossCount = syn['大佬時代'] || 0;
    if (bigBossCount >= 3) {
      maxHp = Math.round(maxHp * 1.20);
    } else if (bigBossCount === 2 && u.traits.includes('大佬時代')) {
      maxHp = Math.round(maxHp * 1.15);
    } else if (bigBossCount === 1 && u.traits.includes('大佬時代')) {
      maxHp = Math.round(maxHp * 1.10);
    }

    // 5. 寵物雙血量與 ★3 覺醒常駐加成
    const petSingleBar = (syn['貓狗領導'] || 0) >= 2 && u.traits.includes('貓狗領導');
    if (u.id === 'st_sis') spd += 15;
    if (u.id === 'icy_sis') atk = Math.round(atk * 1.25);

    // FreeTed ★3 覺醒【父親的腳毛】：SPD 提升 25%
    if (u.id === 'freeted' && u.stars >= 3) {
      spd = Math.round(spd * 1.25);
    }
    // DC齊發達 ★3 覺醒【極限雙重人格・全速走數】：全隊 +35% 攻
    if (hasAwakenedDcTesla) {
      atk = Math.round(atk * 1.35);
    }
    // DVP ★3 覺醒：開局 350 護盾
    if (u.id === 'dvp' && u.stars >= 3) {
      startShield += 350;
    }
    // 合體卡 ★3 覺醒：全隊 250 護盾
    if (hasAwakenedFused) {
      startShield += 250;
    }

    // 6. 海克斯增幅加成
    if (hasAug('aug_3god')) {
      maxHp += 150;
      if (u.traits.includes('3幻神')) startMp += 40;
    }
    if (hasAug('aug_youth')) {
      spd += 25;
      atk = Math.round(atk * 1.18);
    }
    if (hasAug('aug_shield') && idx === 0) {
      maxHp += 350;
      startShield += 250;
    }
    if (hasAug('aug_leverage') && idx > 0) {
      startMp += 30;
      maxHp = Math.round(maxHp * 0.75);
    }

    // 7. V4 新羈絆【父親大人】（1人自身獲 10% 最大生命護盾；2人自身獲 20% 護盾，僅限父親大人本人享有）
    const fatherCount = syn['父親大人'] || 0;
    if (fatherCount >= 2 && u.traits.includes('父親大人')) {
      startShield += Math.round(maxHp * 0.20);
    } else if (fatherCount === 1 && u.traits.includes('父親大人')) {
      startShield += Math.round(maxHp * 0.10);
    }

    // MP 上限處理（DC齊發達鎖定 45 MP；FreeTed 鎖定 0 MP）
    const unitMaxMp = u.noMpHero ? 0 : (u.lockedMaxMp || u.maxMp);

    u.maxHp = maxHp;
    u.hp = maxHp;
    u.ghostHp = maxHp;
    u.shield = startShield;
    u.atk = atk;
    u.curSpd = spd;
    u.maxMp = unitMaxMp;
    u.mp = u.noMpHero ? 0 : Math.min(unitMaxMp, startMp);
    u.isAlly = true;
    u.inRitual = (u.id === 'andy' && playerRoster.length > 1);
    u.ritualCount = (u.id === 'andy') ? (hasAug('aug_oil') ? 1 : 0) : 0;
    u.sisMarks = 0;
    u.petSingleBar = petSingleBar;
    u.isWeakened = false;
    u.isDemonized = false;
    u.immuneDebuff = false;
    u.basicAtkCount = 0;
    u.dcMode = (u.id === 'dc_tesla' && u.stars >= 3) ? 'BOTH' : null;
    u.dcCritBonus = (u.id === 'dc_tesla' && u.stars >= 3) ? 0.25 : 0;
    u.bDogTransferActive = false;
    u.hadTeammatesAtStart = playerRoster.length > 1;
    u.initialBattleAtk = atk;
    u.initialBattleSpd = spd;
    u.stats = { dmgDealt: 0, dmgTaken: 0, healed: 0 };
  });
}

function updateDualHealthState(unit) {
  if (!unit.dualHpPet || unit.hp <= 0) return;
  if (unit.petSingleBar) {
    unit.isWeakened = false;
    return;
  }
  const ratio = unit.hp / unit.maxHp;
  if (ratio < 0.5 && !unit.isWeakened) {
    unit.isWeakened = true;
    unit.atk = Math.max(20, Math.round(unit.atk * 0.8));
    unit.curSpd = Math.max(60, unit.curSpd - 20);
    addLog(`⚠️ <strong>${unit.name}</strong> 跌破50%血量！<span class="tag-nerf">🔴 弱化: 攻-20% 速-20</span>`);
  } else if (ratio >= 0.5 && unit.isWeakened) {
    unit.isWeakened = false;
    unit.atk = Math.round(unit.atk * 1.25);
    unit.curSpd += 20;
    addLog(`✨ <strong>${unit.name}</strong> 恢復至50%血量以上！<span class="tag-buff">🟢 重啟${unit.dualHpPet}強化</span>`);
  }
}

// ================= 6. P5 介面渲染、延遲扣血白殘影條與護盾條 =================
function moveUnit(index, dir) {
  if (isBattling) return;
  const targetIdx = index + dir;
  if (targetIdx < 0 || targetIdx >= playerRoster.length) return;
  const temp = playerRoster[index];
  playerRoster[index] = playerRoster[targetIdx];
  playerRoster[targetIdx] = temp;
  prepareUnitsForStage();
  updateUI();
}

function queueVisualEffect(unit, type, text = '') {
  visualQueue.push({ unit, type, text });
}

function flushVisualQueue() {
  // 延遲扣血白殘影條 (Ghost HP Bar) 動畫更新
  [...playerRoster, ...enemyRoster].forEach((u, idx) => {
    const roster = u.isAlly ? playerRoster : enemyRoster;
    const rIdx = roster.indexOf(u);
    if (rIdx === -1) return;
    const ghostEl = document.getElementById(`${u.isAlly ? 'ally' : 'enemy'}_ghost_${rIdx}`);
    if (ghostEl && u.ghostHp !== undefined && u.ghostHp !== u.hp) {
      const targetPct = Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100));
      setTimeout(() => {
        if (ghostEl) ghostEl.style.width = `${targetPct}%`;
        u.ghostHp = u.hp;
      }, 75);
    }
  });

  if (visualQueue.length === 0) return;
  const currentBatch = [...visualQueue];
  visualQueue = [];

  currentBatch.forEach(({ unit, type, text }) => {
    const roster = unit.isAlly ? playerRoster : enemyRoster;
    const idx = roster.indexOf(unit);
    if (idx === -1) return;
    const card = document.getElementById(`${unit.isAlly ? 'ally' : 'enemy'}_card_${idx}`);
    if (!card) return;

    if (type === 'lunge') {
      const cls = unit.isAlly ? 'anim-lunge-ally' : 'anim-lunge-enemy';
      card.classList.remove(cls);
      void card.offsetWidth;
      card.classList.add(cls);
    } else if (type === 'hit') {
      card.classList.remove('anim-hit');
      void card.offsetWidth;
      card.classList.add('anim-hit');
    }

    if (text) {
      const floatEl = document.createElement('div');
      let floatCls = 'float-dmg';
      if (type === 'heal') floatCls = 'float-heal';
      else if (type === 'shield') floatCls = 'float-shield';
      else if (text.includes('CRIT') || text.includes('極意') || text.includes('鬼化')) floatCls = 'float-crit';

      floatEl.className = `float-text ${floatCls}`;
      floatEl.innerText = text;
      card.appendChild(floatEl);
      setTimeout(() => floatEl.remove(), 900);
    }
  });
}

function updateUI() {
  document.getElementById('stageDisplay').innerText = `STAGE ${currentStage} / ${maxStage}`;
  const livesEl = document.getElementById('livesDisplay');
  if (livesEl) {
    const hearts = '❤️'.repeat(Math.max(0, playerLives)) + '🖤'.repeat(Math.max(0, maxLives - playerLives));
    livesEl.innerHTML = `${hearts} <span style="font-size:0.8rem;">(${playerLives}/${maxLives})</span>`;
  }

  document.getElementById('allyCount').innerText = `${playerRoster.length} / 4`;
  let stageEnemyTitle = `第 ${currentStage} 關鏡像守衛`;
  if (currentStage === 8) stageEnemyTitle = `👹 第 8 關深淵終極 Boss【楊守正】`;
  else if (currentStage >= 6) stageEnemyTitle = `🔥 第 ${currentStage} 關深淵覺醒守衛 (★3檢驗)`;
  document.getElementById('enemyStageName').innerText = stageEnemyTitle;

  const syn = getActiveSynergies(playerRoster);
  const synEl = document.getElementById('synergyList');
  if (Object.keys(syn).length === 0) {
    synEl.innerHTML = `<span class="badge">尚未上陣英雄</span>`;
  } else {
    synEl.innerHTML = Object.entries(syn).map(([name, count]) => {
      const isSisActive = name === 'S.I.S' && count >= 3;
      const isFatherActive = name === '父親大人' && count >= 1;
      const isBigBossActive = name === '大佬時代' && count >= 1;
      const isSoloDc = name === '窮閪走數團 / 賭狗 / 司機';
      const isDuoActive = name === '最強之兩人' && count >= 1;
      const isGold = isSisActive || isDuoActive || isFatherActive || isBigBossActive || isSoloDc || (name === '3幻神' && count >= 3) || (name !== 'S.I.S' && count >= 2);

      let bonusText = '';
      if (name === '父親大人') bonusText = count >= 2 ? '(自身+20%護盾!)' : '(自身+10%護盾!)';
      else if (name === '大佬時代') bonusText = count >= 3 ? '(全隊HP+20%!)' : (count === 2 ? '(大佬HP+15%!)' : '(自身HP+10%!)');
      else if (name === '窮閪走數團 / 賭狗 / 司機') bonusText = '(薛丁格雙形態!)';
      else if (name === 'S.I.S') bonusText = count >= 3 ? '(屬性1.25x + 獨立自主!)' : `(${count}/3人)`;
      else if (name === '最強之兩人') bonusText = '(全體金融風暴!)';
      else if (name === '貓狗領導') bonusText = count >= 2 ? '(單一血條免弱化!)' : `(${count}/2人)`;
      else if (name === '3幻神') bonusText = count >= 3 ? '(幻神追擊共鳴!)' : count >= 2 ? '(全隊加速加攻)' : `(${count}/2人)`;
      else bonusText = count >= 2 ? '(已啟動!)' : `(${count}/2人)`;

      const badgeClass = isSisActive ? 'active-sis' : (isGold ? 'active-gold' : '');
      return `<span class="badge ${badgeClass}" onmouseenter="showTraitTooltip(event, '${name}')" onmouseleave="hideTooltip()">${name} ${count} ${bonusText}</span>`;
    }).join('');
  }

  const augEl = document.getElementById('augmentList');
  if (playerAugments.length === 0) {
    augEl.innerHTML = `<span class="badge">尚未獲得增幅</span>`;
  } else {
    augEl.innerHTML = playerAugments.map(a => {
      const safeDesc = a.desc.replace(/'/g, "\\'");
      return `<span class="badge augment" onmouseenter="showTooltip(event, '⚡ 海克斯增幅：${a.name}', '${safeDesc}')" onmouseleave="hideTooltip()">${a.name}</span>`;
    }).join('');
  }

  renderTeamGrid('allyGrid', playerRoster, true);
  renderTeamGrid('enemyGrid', enemyRoster, false);

  flushVisualQueue();
}

function renderTeamGrid(containerId, roster, isAlly) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  roster.forEach((u, idx) => {
    const hpPct = Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100));
    const ghostPct = Math.max(hpPct, Math.min(100, ((u.ghostHp !== undefined ? u.ghostHp : u.hp) / u.maxHp) * 100));
    const shieldPct = Math.max(0, Math.min(100, ((u.shield || 0) / u.maxHp) * 100));
    const mpPct = u.noMpHero ? 100 : Math.max(0, Math.min(100, Math.round((u.mp / Math.max(1, u.maxMp)) * 100)));
    const hasDualBar = u.dualHpPet && !u.petSingleBar;

    const baseHalfWidth = Math.min(50, hpPct);
    const petHalfWidth = Math.max(0, hpPct - 50);

    let cardCls = `unit-card p5-unit-card ${idx === 0 ? 'frontline' : ''} ${u.hp <= 0 ? 'dead' : ''} ${u.inRitual ? 'ritual-mode' : ''}`;
    if (u.dualHpPet) cardCls += u.isWeakened ? ' pet-weakened' : ' pet-buffed';
    if (isAlly && overdriveActive && u.hp > 0) cardCls += ' overdrive-mode';
    if (u.isDemonized) cardCls += ' demonized-mode';
    if (u.isBoss) cardCls += ' boss-card-mode';
    if (u.stars >= 3) cardCls += ' awakened-star3';

    const card = document.createElement('div');
    card.className = cardCls;
    card.id = `${isAlly ? 'ally' : 'enemy'}_card_${idx}`;

    let statusTag = idx === 0 ? '🛡️ 1號前排' : `${idx + 1}號後排`;
    let statusTooltip = idx === 0 ? '位於 1 號位，優先承受單體攻擊，也是觸發【宿敵彩蛋】的叫陣位！' : '位於後排受到前排保護。';

    if (u.inRitual) {
      const reqRitual = u.stars >= 3 ? 2 : 3;
      statusTag = `🔮 儀式 (${u.ritualCount}/${reqRitual})`;
      statusTooltip = `正在場外進行末日儀式，友軍每放 1 次大招 +1 儀式，滿 ${reqRitual} 次攜帶隕石降臨！`;
    } else if (u.isDemonized) {
      statusTag = `👹 全面鬼化 (減傷50%/免控)`;
      statusTooltip = `【在座各位都係垃圾】全面鬼化中！常駐減傷 50%、免疫降攻減速，每擊殺 1 人隨機復活 1 名隊友至 25% HP！`;
    } else if (u.id === 'dc_tesla') {
      if (u.stars >= 3) {
        statusTag = `🚗 B記+B狗雙常駐`;
      } else if (u.dcMode === 'B_KEE') {
        statusTag = `🟢 B記形態 (全隊加攻)`;
      } else if (u.dcMode === 'B_DOG') {
        statusTag = `🔴 B狗形態 ${u.bDogTransferActive ? '(轉嫁50%傷)' : '(吸隊友)'}`;
      }
    } else if (u.dualHpPet) {
      if (u.petSingleBar) {
        statusTag = `🐾 ${u.dualHpPet}合一`;
        statusTooltip = `【貓狗領導】生效！雙血條合一，全程維持 ${u.petBuffDesc}。`;
      } else if (u.isWeakened) {
        statusTag = `💔 ${u.dualHpPet}受損`;
        statusTooltip = `${u.petWeakDesc}`;
      } else {
        statusTag = `🐾 ${u.dualHpPet}強化`;
        statusTooltip = `${u.petBuffDesc}`;
      }
    }

    if (u.phase2Triggered) statusTag = '👹 100%中的100% 狂暴!';
    if (isAlly && overdriveActive && u.hp > 0) statusTag += ' | 🔥爆肝';
    if (u.sisMarks > 0) statusTag += ` | 💅x${u.sisMarks}`;

    const safeSkillDesc = (u.skillDesc + (u.awakeningName ? `<br><br><strong style="color:#fde047;">${u.awakeningName}：</strong>${u.awakeningDesc}` : '')).replace(/'/g, "\\'");
    const safeLore = (u.lore || '').replace(/'/g, "\\'");
    const hpTooltip = hasDualBar
      ? `【雙血量機制】<br>• 右半青色 (50%~100%)：${u.petBuffDesc}<br>• 左半綠色 (0%~50%)：${u.petWeakDesc}`
      : '角色當前生命值、白殘影扣血條與護盾值 (Shield 優先抵銷傷害)。';

    card.innerHTML = `
      <div>
        <div class="unit-top">
          <div class="unit-name">
            <span>${u.icon} ${u.name}</span>
            <span class="stars">${'★'.repeat(u.stars)}</span>
            ${u.stars >= 3 ? '<span class="p5-awake-badge">極意</span>' : ''}
          </div>
          <span class="pos-tag" onmouseenter="showTooltip(event, '📌 狀態與位置說明', '${statusTooltip}')" onmouseleave="hideTooltip()">${statusTag}</span>
        </div>
        <div class="bars">
          <!-- P5 血條：含延遲白殘影條 (hp-ghost-fill) + 主血條 + 護盾覆蓋條 (shield-fill) -->
          <div class="bar-wrap hp-bar-wrap" onmouseenter="showTooltip(event, '❤️ 生命值與護盾 (HP & Shield)', '${hpTooltip}')" onmouseleave="hideTooltip()">
            <div class="hp-ghost-fill" id="${isAlly ? 'ally' : 'enemy'}_ghost_${idx}" style="width:${Math.round(ghostPct)}%"></div>
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

          <div class="bar-wrap mp-bar-wrap" onmouseenter="showTooltip(event, '💧 魔力值 / 特殊資源', '${u.noMpHero ? '無魔力英雄 (MaxMP=0)：每 5 下普攻(★3為3下)觸發擴散閃電；隊友全滅時觸發全面鬼化！' : (u.lockedMaxMp ? 'MP上限鎖定減半為 45 MP！受擊 35% 機率免傷並偷取 15 MP。' : '普攻 +30 MP、受擊 +15 MP。集滿時下次行動自動施放大招！')}')" onmouseleave="hideTooltip()">
            <div class="mp-fill ${u.noMpHero ? 'no-mp-fill' : ''}" style="width:${mpPct}%"></div>
            <div class="bar-text">
              ${u.noMpHero
                ? `⚡ 閃電計數 (${u.basicAtkCount || 0}/${u.stars >= 3 ? 3 : 5}) ${u.isDemonized ? '| 👹鬼化常駐' : ''}`
                : `💧 MP ${u.mp} / ${u.maxMp}${u.lockedMaxMp ? ' (鎖定減半)' : ''}`}
            </div>
          </div>
        </div>
        <div class="unit-stats">
          <span>⚔️攻:${u.atk} ⚡速:${u.curSpd || u.spd} 🛡️盾:${u.shield || 0}</span>
          <span>
            ${u.traits.map(t => `<span class="mini-trait" onmouseenter="showTraitTooltip(event, '${t}')" onmouseleave="hideTooltip()">${t}</span>`).join(' ')}
          </span>
        </div>
        <div class="unit-skill-tag" onmouseenter="showTooltip(event, '💥 技能：【${u.skillName}】', '${safeSkillDesc}', '${safeLore}')" onmouseleave="hideTooltip()">
          💡 ${u.skillName} ${u.stars >= 3 && u.awakeningName ? `<span style="color:#fde047; font-weight:bold;">${u.awakeningName}</span>` : `<span style="font-size:0.65rem; color:var(--p5-yellow); float:right;">(詳情)</span>`}
        </div>
      </div>
      ${isAlly && !isBattling ? `
        <div class="move-btns">
          <button onclick="moveUnit(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>⬅️ 前移</button>
          <button onclick="moveUnit(${idx}, 1)" ${idx === roster.length - 1 ? 'disabled' : ''}>後移 ➡️</button>
        </div>
      ` : ''}
    `;
    container.appendChild(card);
  });
}

// ================= 7. 宿敵彩蛋與 3盤2勝 3D6 骰子單挑系統 =================
let currentNemesisContext = null;

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
  currentNemesisContext = { myHero, rivalHero, isSameTeam: myHero.isAlly === rivalHero.isAlly };

  showNemesisChoiceModal();
  return true;
}

function showNemesisChoiceModal() {
  const modal = document.getElementById('nemesisModal');
  const content = document.getElementById('nemesisContent');
  modal.classList.remove('hidden');

  content.innerHTML = `
    <h2 class="modal-title" style="color:var(--p5-yellow);">🚨 隱藏宿敵劇情：【華爾街的終局對決】</h2>
    <p class="modal-sub">當站在 1 號位的 <strong>📈 股票奧本海默</strong> 遇上現身戰場的 <strong>🛢️ Andy安迪</strong>，兩大宿敵終於正面碰頭！（本事件每局僅觸發一次）</p>
    <div style="background:#0d0e11; padding:15px; border:2px solid var(--p5-red); margin-bottom:18px; text-align:left; font-size:0.88rem; line-height:1.6;">
      <p>💬 <strong>股票奧本海默</strong>：「安迪！你的末日負油價理論在我的百倍槓桿面前一文不值！」</p>
      <p>💬 <strong>Andy安迪</strong>：「奧本海默！柏克末日已經降臨，今天我們就賭上性命做個了斷！」</p>
    </div>
    <div class="choices-grid">
      <div class="choice-card p5-card-skew" style="border-color:var(--p5-red);" onclick="startDiceDuel()">
        <div>
          <h4><span>🗡️ 選擇一：【戰到死 (3盤2勝 3D6 硬核賭命單挑)】</span></h4>
          <div class="choice-desc">
            兩人立刻展開<strong>「三盤兩勝制・3顆6面骰(3D6)鐵籠死鬥」</strong>！<br><br>
            • <strong>若我方獲勝</strong>：敵方宿敵當場暴斃！我方勝者滿血、<strong>攻擊力永久翻倍 (2x) 且 +50 MP</strong>，過關後<strong>額外多拿 1 個海克斯增幅</strong>！<br>
            • <strong style="color:#f87171;">⚠️ 敗北硬核懲罰</strong>：落敗的一方將<strong>直接從隊伍中永久戰死移除（消失）</strong>！若敵方宿敵獲勝，敵方宿敵將保留 50% 血量繼續作戰！
          </div>
        </div>
        <div class="choice-stats" style="color:#f87171;">🔥 高風險高回報・敗者永久除名</div>
      </div>

      <div class="choice-card p5-card-skew" style="border-color:var(--p5-yellow);" onclick="executeNemesisPeace()">
        <div>
          <h4><span>🤝 選擇二：【大和解 (兄弟合體)】</span></h4>
          <div class="choice-desc">
            「兩兄弟沒有隔夜仇！」兩人當場握手言和，直接合體進化為超規格神卡 —— <strong>【☯️ 安迪與奧本海默】</strong>！<br><br>
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

  const existingAllyOpp = playerRoster.find(u => u.id === 'stock_opp');
  const existingAllyAndy = playerRoster.find(u => u.id === 'andy');
  const fusedStars = Math.max(existingAllyOpp ? existingAllyOpp.stars : 1, existingAllyAndy ? existingAllyAndy.stars : 1);
  const starMult = Math.pow(1.35, fusedStars - 1);

  enemyRoster.forEach(e => {
    if (e.id === 'andy' || e.id === 'stock_opp') { e.hp = 0; e.ghostHp = 0; e.shield = 0; }
  });

  playerRoster = playerRoster.filter(u => u.id !== 'stock_opp' && u.id !== 'andy');
  const fusedHp = Math.round(FUSED_HERO_TEMPLATE.hp * starMult);
  const fusedAtk = Math.round(FUSED_HERO_TEMPLATE.atk * starMult);
  const fusedUnit = {
    ...FUSED_HERO_TEMPLATE,
    traits: [...FUSED_HERO_TEMPLATE.traits],
    stars: fusedStars,
    baseHp: fusedHp,
    baseAtk: fusedAtk,
    maxHp: fusedHp,
    hp: fusedHp,
    ghostHp: fusedHp,
    shield: 300,
    atk: fusedAtk,
    spd: FUSED_HERO_TEMPLATE.spd,
    curSpd: FUSED_HERO_TEMPLATE.spd,
    mp: 50,
    maxMp: FUSED_HERO_TEMPLATE.maxMp,
    isAlly: true,
    inRitual: false,
    sisMarks: 0,
    stats: { dmgDealt: 0, dmgTaken: 0, healed: 0 }
  };
  playerRoster.unshift(fusedUnit);

  document.getElementById('nemesisModal').classList.add('hidden');
  isPausedForEvent = false;
  updateUI();
}

let duelState = { round: 1, oppWins: 0, andyWins: 0, rolling: false };

function startDiceDuel() {
  duelState = { round: 1, oppWins: 0, andyWins: 0, rolling: false };
  renderDiceDuelUI('準備開始第 1 盤擲骰對決！（點擊下方按鈕擲出 3 顆 6 面骰）');
}

function renderDiceDuelUI(statusMsg, oppDice = ['🎲','🎲','🎲'], andyDice = ['🎲','🎲','🎲'], oppSum = '-', andySum = '-') {
  const content = document.getElementById('nemesisContent');
  const isFinished = duelState.oppWins >= 2 || duelState.andyWins >= 2;

  content.innerHTML = `
    <h2 class="modal-title" style="color:var(--p5-red);">🎲 華爾街鐵籠死鬥（三盤兩勝・3D6 賭命單挑）</h2>
    <p class="modal-sub">規則：每盤雙方各擲出 <strong>3 顆 6 面骰（3～18 點）</strong>。先贏 2 盤者勝出，<strong>敗者將當場戰死並永久從隊伍除名！</strong></p>
    
    <div style="margin: 10px 0;">
      <span class="score-board">📈 奧本海默 【 ${duelState.oppWins}  :  ${duelState.andyWins} 】 🛢️ Andy安迪 （第 ${Math.min(3, duelState.round)} 盤）</span>
    </div>

    <div class="duel-arena">
      <div class="duel-fighter">
        <h3 style="color:#60a5fa;">📈 股票奧本海默</h3>
        <div class="dice-row">
          ${oppDice.map(d => `<div class="die-box ${duelState.rolling ? 'rolling' : ''}">${d}</div>`).join('')}
        </div>
        <div style="font-size:1rem; font-weight:bold;">點數總和：<span style="color:var(--p5-yellow);">${oppSum}</span></div>
      </div>

      <div style="font-size:1.6rem; font-weight:900; color:var(--p5-red);">VS</div>

      <div class="duel-fighter">
        <h3 style="color:#c084fc;">🛢️ Andy安迪</h3>
        <div class="dice-row">
          ${andyDice.map(d => `<div class="die-box ${duelState.rolling ? 'rolling' : ''}">${d}</div>`).join('')}
        </div>
        <div style="font-size:1rem; font-weight:bold;">點數總和：<span style="color:var(--p5-yellow);">${andySum}</span></div>
      </div>
    </div>

    <div style="background:#0d0e11; padding:12px; border:1px solid #3f4147; margin-bottom:15px; font-weight:bold; color:#fff;">
      ${statusMsg}
    </div>

    ${!isFinished ? `
      <button class="btn btn-primary" style="width:260px; font-size:1.05rem;" onclick="rollDuelRound()" ${duelState.rolling ? 'disabled' : ''}>
        🎲 擲出第 ${duelState.round} 盤骰子 (3D6)
      </button>
    ` : `
      <button class="btn btn-secondary" style="width:260px; font-size:1.05rem;" onclick="finishDiceDuel()">
        ⚔️ 接受裁決並返回戰場！
      </button>
    `}
  `;
}

function rollDuelRound() {
  if (duelState.rolling) return;
  duelState.rolling = true;
  renderDiceDuelUI(`🎲 骰子高速旋轉中...`);

  setTimeout(() => {
    duelState.rolling = false;
    const roll3D6 = () => [1,2,3].map(() => Math.floor(Math.random() * 6) + 1);
    let oppRolls = roll3D6();
    let andyRolls = roll3D6();
    let oppSum = oppRolls.reduce((a,b) => a+b, 0);
    let andySum = andyRolls.reduce((a,b) => a+b, 0);

    if (oppSum === andySum) {
      if (Math.random() < 0.5) { oppRolls[2] = Math.min(6, oppRolls[2] + 1); oppSum++; }
      else { andyRolls[2] = Math.min(6, andyRolls[2] + 1); andySum++; }
    }

    let msg = '';
    if (oppSum > andySum) {
      duelState.oppWins++;
      msg = `🔥 第 ${duelState.round} 盤結果：股票奧本海默擲出 ${oppSum} 點 擊敗 Andy安迪的 ${andySum} 點！`;
    } else {
      duelState.andyWins++;
      msg = `☄️ 第 ${duelState.round} 盤結果：Andy安迪擲出 ${andySum} 點 擊敗 股票奧本海默的 ${oppSum} 點！`;
    }

    if (duelState.oppWins >= 2 || duelState.andyWins >= 2) {
      const winnerName = duelState.oppWins >= 2 ? '📈 股票奧本海默' : '🛢️ Andy安迪';
      const loserName = duelState.oppWins >= 2 ? '🛢️ Andy安迪' : '📈 股票奧本海默';
      msg += `<br><span style="color:var(--p5-yellow);">🏆 決鬥結束！【${winnerName}】以 ${duelState.oppWins}:${duelState.andyWins} 勝出！【${loserName}】遭到永久除名！</span>`;
    } else {
      duelState.round++;
    }

    renderDiceDuelUI(msg, oppRolls, andyRolls, oppSum, andySum);
  }, 550);
}

function finishDiceDuel() {
  const oppWon = duelState.oppWins >= 2;
  const winnerId = oppWon ? 'stock_opp' : 'andy';
  const loserId = oppWon ? 'andy' : 'stock_opp';

  const myLoserIdx = playerRoster.findIndex(u => u.id === loserId);
  if (myLoserIdx !== -1) {
    const removedHero = playerRoster[myLoserIdx];
    playerRoster.splice(myLoserIdx, 1);
    addLog(`💀 <span class="tag-nerf">🔴 死鬥戰死除名</span> 我方的 <strong>${removedHero.icon} ${removedHero.name}</strong> 在 3D6 決鬥落敗，已永久移出隊伍！`);
  }

  enemyRoster.forEach(e => {
    if (e.id === loserId) { e.hp = 0; e.ghostHp = 0; e.shield = 0; }
  });

  const myWinner = playerRoster.find(u => u.id === winnerId);
  const enemyWinner = enemyRoster.find(e => e.id === winnerId && e.hp > 0);

  if (myWinner) {
    myWinner.inRitual = false;
    myWinner.hp = myWinner.maxHp;
    myWinner.ghostHp = myWinner.maxHp;
    myWinner.shield += 250;
    myWinner.baseAtk = myWinner.baseAtk * 2;
    myWinner.atk = myWinner.atk * 2;
    myWinner.mp = Math.min(myWinner.maxMp, myWinner.mp + 50);
    bonusAugmentPending += 1;
    battleComboLogs.push(`🎲 【宿敵死鬥大勝】：我方 ${myWinner.name} 勝出，永久雙倍攻擊力並獲額外海克斯！`);
    addLog(`🏆 <span class="tag-buff">🟢 死鬥大勝</span> 我方 <strong>${myWinner.icon} ${myWinner.name}</strong> 贏得決鬥！滿血恢復、<span class="tag-buff">🟢 攻擊力永久翻倍 (${myWinner.atk})</span> 並鎖定額外海克斯獎勵！`);
  } else if (enemyWinner) {
    enemyWinner.inRitual = false;
    enemyWinner.hp = Math.max(1, Math.round(enemyWinner.maxHp * 0.5));
    enemyWinner.ghostHp = enemyWinner.hp;
    battleComboLogs.push(`💀 【宿敵死鬥落敗】：我方宿敵永久戰死除名，敵方 ${enemyWinner.name} 半血存留！`);
    addLog(`⚠️ <span class="tag-nerf">🔴 死鬥落敗懲罰</span> 敵方 <strong>${enemyWinner.icon} ${enemyWinner.name}</strong> 贏得決鬥並保留 50% 血量（${enemyWinner.hp} HP）繼續作戰！`);
  }

  document.getElementById('nemesisModal').classList.add('hidden');
  isPausedForEvent = false;
  checkAllFreeTedDemonize();
  updateUI();
}

// ================= 8. 回合制自動戰鬥核心引擎 (含護盾、薛丁格雙形態、無慘鬼化、楊守正二階段) =================
function toggleSpeed() {
  battleSpeed = battleSpeed === 850 ? 400 : 850;
  document.getElementById('speedBtn').innerText = `⏩ 戰鬥速度: ${battleSpeed === 400 ? '2x' : '1x'}`;
}

function addLog(html, cls = '') {
  const box = document.getElementById('battleLog');
  if (!box) return;
  const div = document.createElement('div');
  div.className = `log-entry ${cls}`;
  div.innerHTML = html;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function addShield(provider, target, amount) {
  const shieldAmt = Math.round(amount);
  if (shieldAmt <= 0 || target.hp <= 0) return;
  target.shield = (target.shield || 0) + shieldAmt;
  if (provider && provider.stats) provider.stats.healed += shieldAmt;
  queueVisualEffect(target, 'shield', `🛡️+${shieldAmt}`);
}

// 檢查 FreeTed【在座各位都係垃圾】隊友全滅全面鬼化
function checkAllFreeTedDemonize() {
  [playerRoster, enemyRoster].forEach(team => {
    const alive = team.filter(u => u.hp > 0);
    if (alive.length === 1 && alive[0].id === 'freeted' && !alive[0].isDemonized && alive[0].hadTeammatesAtStart) {
      activateFreeTedDemonize(alive[0], team);
    }
  });
}

function activateFreeTedDemonize(freeted, team) {
  freeted.isDemonized = true;
  freeted.immuneDebuff = true;
  // 移至 1 號位
  const idx = team.indexOf(freeted);
  if (idx > 0) {
    team.splice(idx, 1);
    team.unshift(freeted);
  }
  // 清除降攻與減速
  freeted.atk = Math.max(freeted.atk, freeted.initialBattleAtk || freeted.atk);
  freeted.curSpd = Math.max(freeted.curSpd || freeted.spd, freeted.initialBattleSpd || freeted.spd);
  addShield(freeted, freeted, Math.round(freeted.maxHp * 0.25));

  triggerCutIn('⚡', `${freeted.name}・無慘大人`, '「在座各位都係垃圾！」全面鬼化覺醒', 'awakening');
  battleComboLogs.push(`⚡ ${freeted.name} 隊友全滅觸發【在座各位都係垃圾】全面鬼化！`);
  addLog(`⚡ <span class="tag-event">全面鬼化覺醒</span> <strong>${freeted.name}</strong> 隊友全滅，發動大招<strong>【在座各位都係垃圾】</strong>！移至 1 號位、<span class="tag-buff">🟢 常駐減傷 50%</span>、<span class="tag-buff">🟢 免疫降攻減速</span>，每擊殺 1 人將隨機復活 1 名隊友至 25% HP！`);
}

function startBattle() {
  if (isBattling || playerRoster.length === 0) return;
  isBattling = true;
  isPausedForEvent = false;
  nemesisTriggeredThisBattle = false;
  battleComboLogs = [];
  visualQueue = [];
  bankruptAvailable = playerAugments.some(a => a.id === 'aug_bankrupt');
  overdriveActive = false;
  currentRoundNumber = 1;
  battleStartTime = Date.now();

  document.getElementById('startBattleBtn').disabled = true;
  prepareUnitsForStage();
  resetCurrentEnemyStage();
  updateUI();

  const syn = getActiveSynergies(playerRoster);
  addLog(`🔔 <strong>=== STAGE ${currentStage} / ${maxStage} 戰鬥開始！ ===</strong>`);

  if ((syn['父親大人'] || 0) >= 1) {
    addLog(`🧔♂️ <span class="tag-buff">🟢 父親大人啟動</span> 父親大人角色獲得開局 <strong>${(syn['父親大人'] >= 2) ? '20%' : '10%'} 最大生命護盾</strong>！`);
  }
  if ((syn['大佬時代'] || 0) >= 1) {
    const tierMsg = syn['大佬時代'] >= 3 ? '全隊最大生命 +20%' : (syn['大佬時代'] === 2 ? '大佬角色最大生命 +15%' : '大佬角色最大生命 +10%');
    addLog(`🛡️ <span class="tag-buff">🟢 大佬時代 (${syn['大佬時代']}階)</span> ${tierMsg}！`);
  }
  if ((syn['S.I.S'] || 0) >= 3) {
    addLog(`💅 <span class="tag-buff">🟢 S.I.S 啟動</span> 全體 S.I.S 屬性 1.25x，並解鎖追加技【獨立自主】！`);
  }

  if (playerAugments.some(a => a.id === 'aug_glitch')) {
    addLog(`💻 <span class="tag-nerf">🔴 Glitch 觸發</span> 敵方全體扣除 20% 現有生命與護盾，並減速 15 點！`);
    enemyRoster.forEach(e => {
      e.hp = Math.max(1, Math.round(e.hp * 0.8));
      e.ghostHp = e.hp;
      e.shield = Math.round((e.shield || 0) * 0.8);
      if (!e.immuneDebuff) e.curSpd = Math.max(50, (e.curSpd || e.spd) - 15);
    });
    updateUI();
  }

  let turnOrder = [];
  let turnIndex = 0;

  battleInterval = setInterval(() => {
    if (isPausedForEvent) return;

    const aliveAllies = playerRoster.filter(u => u.hp > 0);
    const aliveEnemies = enemyRoster.filter(u => u.hp > 0);

    if (aliveAllies.length === 0 || aliveEnemies.length === 0) {
      clearInterval(battleInterval);
      isBattling = false;
      document.getElementById('startBattleBtn').disabled = false;
      handleBattleEnd(aliveAllies.length > 0);
      return;
    }

    const elapsedSec = (Date.now() - battleStartTime) / 1000;
    if (!overdriveActive && playerAugments.some(a => a.id === 'aug_overdrive') && (currentRoundNumber >= 4 || elapsedSec >= 15)) {
      overdriveActive = true;
      battleComboLogs.push('🔥 觸發【伺服器過載 / 死線戰神】：全隊進入爆肝狀態最終傷害 +50%');
      addLog(`🔥 <span class="tag-buff">🟢 死線戰神・爆肝狀態啟動</span> 戰鬥進入白熱化！我方全體造成的最終傷害永久提升 <strong>+50%</strong>！`);
    }

    if (turnIndex >= turnOrder.length) {
      turnOrder = [...aliveAllies, ...aliveEnemies].sort((a, b) => (b.curSpd || b.spd) - (a.curSpd || a.spd));
      turnIndex = 0;
      currentRoundNumber++;
    }

    const actor = turnOrder[turnIndex];
    turnIndex++;

    if (!actor || actor.hp <= 0) return;

    // 回合減速狀態倒數恢復
    if (actor.spdDebuffTurns && actor.spdDebuffTurns > 0) {
      actor.spdDebuffTurns--;
      if (actor.spdDebuffTurns === 0) {
        actor.curSpd = (actor.curSpd || actor.spd) + 20;
      }
    }
    if (actor.freetedSlowTurns && actor.freetedSlowTurns > 0) {
      actor.freetedSlowTurns--;
      if (actor.freetedSlowTurns === 0) {
        actor.curSpd = actor.initialBattleSpd || actor.spd;
      }
    }

    if (actor.inRitual) {
      const teamAlive = (actor.isAlly ? playerRoster : enemyRoster).filter(u => u.hp > 0);
      if (teamAlive.length <= 1) {
        actor.inRitual = false;
        addLog(`🕯️ <strong>${actor.name}</strong> 因隊友全滅被迫提早現身參戰！`);
        if (checkNemesisEasterEgg(actor)) return;
      } else {
        const reqRitual = actor.stars >= 3 ? 2 : 3;
        addLog(`🔮 <strong>${actor.name}</strong> 正在場外進行柏克末日儀式 (${actor.ritualCount}/${reqRitual})...`);
        return;
      }
    }

    executeUnitTurn(actor);
    checkAllFreeTedDemonize();
    updateUI();
  }, battleSpeed);
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

  // 1. DC齊發達 被動：35% 受擊免傷並偷取 15 MP
  if (target.id === 'dc_tesla' && !isTransferred && Math.random() < 0.35) {
    if (attacker && !attacker.noMpHero) {
      const stolen = Math.min(15, attacker.mp || 0);
      attacker.mp = Math.max(0, (attacker.mp || 0) - stolen);
    }
    target.mp = Math.min(target.maxMp, target.mp + 15);
    queueVisualEffect(target, 'shield', '🚗走數免傷! +15MP');
    addLog(`🚗 <strong>${target.name}</strong> 觸發【FSD走數被動】！<span class="tag-buff">🟢 35%受擊免傷</span> 並反偷 <strong>15 MP</strong>！`);
    return 0;
  }

  let dmg = Math.round(rawDmg);
  let isCrit = false;

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

      const shortAug = playerAugments.some(a => a.id === 'aug_short');
      const icyUnit = playerRoster.find(u => u.id === 'icy_sis' && u.hp > 0 && !u.isWeakened);
      const dcCrit = attacker.dcCritBonus || 0;
      const critChance = (shortAug ? 0.35 : 0) + (icyUnit ? 0.20 : 0) + dcCrit;
      if (critChance > 0 && Math.random() < critChance) {
        const critMult = (icyUnit && icyUnit.stars >= 3) ? 1.9 : 1.6;
        dmg = Math.round(dmg * critMult);
        isCrit = true;
      }
    } else if (target.isAlly) {
      if (playerAugments.some(a => a.id === 'aug_shield') && playerRoster.indexOf(target) === 0) {
        dmg = Math.round(dmg * 0.8);
      }
      if (playerAugments.some(a => a.id === 'aug_leverage') && playerRoster.indexOf(target) > 0) {
        dmg = Math.round(dmg * 1.15);
      }
    }

    // FreeTed 全面鬼化：常駐減傷 50%
    if (target.isDemonized) {
      dmg = Math.max(1, Math.round(dmg * 0.5));
    }
  }

  // 2. DC齊發達【B狗】大招後：受傷轉嫁 50% 給最高血量隊友
  if (target.bDogTransferActive && !isTransferred) {
    const team = target.isAlly ? playerRoster : enemyRoster;
    const otherAllies = team.filter(u => u !== target && u.hp > 0 && !u.inRitual);
    if (otherAllies.length > 0) {
      const highestAlly = [...otherAllies].sort((a, b) => b.hp - a.hp)[0];
      const transferAmt = Math.floor(dmg * 0.5);
      if (transferAmt > 0) {
        dmg -= transferAmt;
        addLog(`💸 <strong>${target.name}</strong>【B狗走數轉嫁】將 <strong>50% 傷害 (${transferAmt})</strong> 推卸給最高血量隊友 <strong>${highestAlly.name}</strong>！`);
        dealDamage(attacker, highestAlly, transferAmt, true, false, true);
      }
    }
  }

  const totalDealt = dmg;

  // 3. V4 護盾 (Shield) 優先抵銷傷害機制
  if (!isTrueDamage && !ignoreShield && (target.shield || 0) > 0) {
    if (target.shield >= dmg) {
      target.shield -= dmg;
      if (attacker && attacker.stats) attacker.stats.dmgDealt += dmg;
      if (target.stats) target.stats.dmgTaken += dmg;
      queueVisualEffect(target, 'shield', `🛡️抵銷 -${dmg}`);
      return totalDealt;
    } else {
      const absorbed = target.shield;
      dmg -= absorbed;
      target.shield = 0;
      queueVisualEffect(target, 'shield', `🛡️破盾 -${absorbed}`);
    }
  }

  // 4. 海克斯【破產保護令】
  if (target.isAlly && bankruptAvailable && target.hp - dmg <= 0) {
    bankruptAvailable = false;
    dmg = Math.max(0, target.hp - 1);
    target.hp = 1;
    target.shield = (target.shield || 0) + 200;
    target.isWeakened = false;
    if (!target.noMpHero) target.mp = target.maxMp;

    if (attacker && attacker.stats) attacker.stats.dmgDealt += totalDealt;
    if (target.stats) target.stats.dmgTaken += totalDealt;
    queueVisualEffect(target, 'hit', `🛡️鎖血 1 HP!`);

    battleComboLogs.push(`🛡️ ${target.name} 觸發【破產保護令】鎖血 1 HP 絕地反擊！`);
    addLog(`🛡️ <span class="tag-event">破產保護令觸發</span> <strong>${target.icon} ${target.name}</strong> 鎖定 <strong>1 HP + 200 護盾</strong> 不死，立即施放絕地大招！`);

    if (!target.noMpHero) {
      const allies = playerRoster;
      const opponents = enemyRoster;
      const counterTarget = getTarget(opponents);
      if (counterTarget) {
        target.mp = 0;
        castSkill(target, allies, opponents, counterTarget);
      }
    }
    return totalDealt;
  }

  target.hp = Math.max(0, target.hp - dmg);
  if (!target.noMpHero) {
    target.mp = Math.min(target.maxMp, target.mp + 15);
  }

  if (attacker && attacker.stats) attacker.stats.dmgDealt += totalDealt;
  if (target.stats) target.stats.dmgTaken += totalDealt;

  queueVisualEffect(target, 'hit', isCrit ? `💥CRIT -${dmg}` : `-${dmg}`);
  updateDualHealthState(target);

  // 5. 第 8 關深淵終極 Boss【👹 楊守正】半血「100% 中的 100%」狂暴二階段
  if (target.id === 'boss_yeung' && target.hp > 0 && target.hp <= target.maxHp * 0.5 && !target.phase2Triggered) {
    target.phase2Triggered = true;
    target.shield = (target.shield || 0) + 800;
    target.atk = Math.round(target.atk * 1.35);
    target.curSpd = Math.round((target.curSpd || target.spd) * 1.35);

    triggerCutIn('👹', '楊守正・深淵終極形態', '「100% 中的 100%！」狂暴二階段覺醒', 'boss');
    battleComboLogs.push('👹 第 8 關 Boss 楊守正半血觸發【100% 中的 100%】狂暴二階段！');
    addLog(`👹 <span class="tag-nerf">⚠️ 100% 中的 100% 狂暴二階段</span> <strong>楊守正</strong> 半血覺醒！獲得 <span class="tag-buff">🛡️ +800 護盾</span>、攻擊與速度暴增 <strong>+35%</strong>，並立即震碎全場！`);

    playerRoster.filter(u => u.hp > 0 && !u.inRitual).forEach(ally => {
      dealDamage(target, ally, target.atk * 1.15);
    });
  }

  // 6. 擊殺判定：FreeTed 鬼化擊殺隨機復活 1 名隊友至 25% HP
  if (target.hp <= 0) {
    if (attacker && attacker.id === 'freeted' && attacker.isDemonized && attacker.hp > 0) {
      const team = attacker.isAlly ? playerRoster : enemyRoster;
      const deadTeammates = team.filter(u => u !== attacker && u.hp <= 0);
      if (deadTeammates.length > 0) {
        const revived = deadTeammates[Math.floor(Math.random() * deadTeammates.length)];
        revived.hp = Math.max(1, Math.round(revived.maxHp * 0.25));
        revived.ghostHp = revived.hp;
        revived.shield = 0;
        revived.inRitual = false;
        queueVisualEffect(revived, 'heal', `⚡復活 25% HP!`);
        battleComboLogs.push(`⚡ 無慘大人【鬼化掠奪】擊殺復活隊友 ${revived.name}`);
        addLog(`⚡ <span class="tag-heal">💚 無慘鬼化復活</span> <strong>${attacker.name}</strong> 擊殺 ${target.name}，將隊友 <strong>${revived.icon} ${revived.name}</strong> 復活至 <strong>25% HP (${revived.hp})</strong>（鬼化持續至戰鬥結束）！`);
      }
    }
    checkAllFreeTedDemonize();
  }

  return totalDealt;
}

function recordHeal(healer, target, amount) {
  if (target.hp <= 0) return;
  const healAmt = Math.round(amount);
  const actual = Math.min(target.maxHp - target.hp, healAmt);
  target.hp = Math.min(target.maxHp, target.hp + healAmt);
  target.ghostHp = target.hp;
  if (healer && healer.stats && actual > 0) healer.stats.healed += actual;
  if (actual > 0) queueVisualEffect(target, 'heal', `+${actual}`);
  updateDualHealthState(target);
}

// DC齊發達 每回合薛丁格雙形態抽籤：【B記】或【B狗】（★3 覺醒則雙形態常駐）
function processDcTeslaTurnStart(actor, allies) {
  const aliveAllies = allies.filter(u => u.hp > 0);
  const otherAllies = aliveAllies.filter(u => u !== actor && !u.inRitual);

  if (actor.stars >= 3) {
    actor.dcMode = 'BOTH';
    actor.dcCritBonus = 0.25;
    aliveAllies.forEach(a => a.atk = Math.round(a.atk * 1.15));
    actor.atk = Math.round(actor.atk * 1.25);
    if (otherAllies.length > 0) {
      const victim = otherAllies[Math.floor(Math.random() * otherAllies.length)];
      const drainHp = Math.min( Math.max(0, victim.hp - 1), Math.round(victim.maxHp * 0.15) );
      const drainMp = victim.noMpHero ? 0 : Math.min(victim.mp, 20);
      if (drainHp > 0) {
        victim.hp -= drainHp;
        victim.ghostHp = victim.hp;
        recordHeal(actor, actor, drainHp);
      }
      if (drainMp > 0) {
        victim.mp -= drainMp;
        actor.mp = Math.min(actor.maxMp, actor.mp + drainMp);
      }
      addLog(`🚗 <strong>${actor.name} (★3極意)</strong>【B記+B狗雙常駐】全隊加攻、自身暴擊+25%，並順手吸取 <strong>${victim.name}</strong> ${drainHp} HP & ${drainMp} MP！`);
    }
    return;
  }

  if (Math.random() < 0.5) {
    actor.dcMode = 'B_KEE';
    actor.dcCritBonus = 0.25;
    aliveAllies.forEach(a => a.atk = Math.round(a.atk * 1.30));
    addLog(`🚗 <strong>${actor.name}</strong> 薛丁格抽籤 ➔ <span class="tag-buff">🟢【B記】義氣形態</span> 全隊攻擊力 +30%、自身暴擊率 +25%！`);
  } else {
    actor.dcMode = 'B_DOG';
    actor.dcCritBonus = 0;
    actor.atk = Math.round(actor.atk * 1.50);
    if (otherAllies.length > 0) {
      const victim = otherAllies[Math.floor(Math.random() * otherAllies.length)];
      const drainHp = Math.min(Math.max(0, victim.hp - 1), Math.round(victim.maxHp * 0.15));
      const drainMp = victim.noMpHero ? 0 : Math.min(victim.mp, 20);
      if (drainHp > 0) {
        victim.hp -= drainHp;
        victim.ghostHp = victim.hp;
        recordHeal(actor, actor, drainHp);
        queueVisualEffect(victim, 'hit', `💸被B狗吸 -${drainHp}`);
      }
      if (drainMp > 0) {
        victim.mp -= drainMp;
        actor.mp = Math.min(actor.maxMp, actor.mp + drainMp);
      }
      addLog(`🚗 <strong>${actor.name}</strong> 薛丁格抽籤 ➔ <span class="tag-nerf">🔴【B狗】走數形態</span> 自身攻擊 +50%，並吸取隊友 <strong>${victim.name}</strong> 15% HP (${drainHp}) 與 ${drainMp} MP！`);
    } else {
      addLog(`🚗 <strong>${actor.name}</strong> 薛丁格抽籤 ➔ <span class="tag-nerf">🔴【B狗】走數形態</span> 自身攻擊力 +50%！`);
    }
  }
}

function executeUnitTurn(actor) {
  const allies = actor.isAlly ? playerRoster : enemyRoster;
  const opponents = actor.isAlly ? enemyRoster : playerRoster;
  const syn = getActiveSynergies(allies);
  const target = getTarget(opponents);
  if (!target || isPausedForEvent) return;

  // DC齊發達 每回合開始觸發薛丁格【B記 / B狗】判定
  if (actor.id === 'dc_tesla' && actor.hp > 0) {
    processDcTeslaTurnStart(actor, allies);
  }

  queueVisualEffect(actor, 'lunge');
  const extraMp = (actor.isAlly && playerAugments.some(a => a.id === 'aug_battery')) ? 15 : 0;

  // 無魔力英雄 FreeTed (MaxMP = 0)：專注普攻與擴散閃電
  if (actor.noMpHero) {
    actor.basicAtkCount = (actor.basicAtkCount || 0) + 1;
    const dmg = dealDamage(actor, target, actor.atk);
    const lightningReq = actor.stars >= 3 ? 3 : 5;
    addLog(`${actor.isAlly ? '🟢' : '🔴'} <strong>${actor.name}</strong> ${actor.isDemonized ? '【鬼化重擊】' : '普攻'} <strong>${target.name}</strong> <span class="tag-dmg">⚔️ -${dmg}</span> (${actor.basicAtkCount}/${lightningReq})`);

    if (actor.hp > 0 && actor.basicAtkCount % lightningReq === 0) {
      const aliveOpps = opponents.filter(u => u.hp > 0 && !u.inRitual);
      let totalSplash = 0;
      aliveOpps.forEach(e => {
        totalSplash += dealDamage(actor, e, actor.atk * 0.50);
      });
      // 降低敵方 3、4 號位 (index 2, 3) 40% 攻速 2 回合
      [2, 3].forEach(posIdx => {
        const backUnit = opponents[posIdx];
        if (backUnit && backUnit.hp > 0 && !backUnit.immuneDebuff) {
          backUnit.curSpd = Math.max(40, Math.round((backUnit.initialBattleSpd || backUnit.spd) * 0.60));
          backUnit.freetedSlowTurns = 2;
        }
      });
      battleComboLogs.push(`⚡ ${actor.name} 觸發【擴散閃電】降敵方後排 40% 攻速`);
      addLog(`⚡ <span class="tag-event">擴散閃電</span> <strong>${actor.name}</strong> 釋放雷霆連鎖 <span class="tag-dmg">⚔️ 全體共-${totalSplash}</span>，並使敵方 3、4 號位 <span class="tag-nerf">🔴 攻速 -40% (2回合)</span>！`);
    }
    return;
  }

  // 一般魔力英雄滿 MP 施放大招
  if (actor.mp >= actor.maxMp) {
    actor.mp = 0;
    castSkill(actor, allies, opponents, target);

    if (actor.isAlly && playerAugments.some(a => a.id === 'aug_key_echo')) {
      const aliveOpps = opponents.filter(u => u.hp > 0 && !u.inRitual);
      if (aliveOpps.length > 0) {
        const lowestEnemy = [...aliveOpps].sort((a, b) => a.hp - b.hp)[0];
        const echoDmg = dealDamage(actor, lowestEnemy, 110, true);
        battleComboLogs.push(`⌨️ 觸發【機械鍵盤的回音】真實傷害打擊`);
        addLog(`⌨️ <span class="tag-event">鍵盤回音</span> 對殘血 <strong>${lowestEnemy.name}</strong> 追加 <span class="tag-dmg">⚔️ -${echoDmg} 真實傷害</span>！`);
      }
    }

    if ((syn['S.I.S'] || 0) >= 3 && actor.traits.includes('S.I.S')) {
      const sisTarget = getTarget(opponents);
      if (sisTarget) {
        const sisDmg = dealDamage(actor, sisTarget, actor.atk * 0.75);
        sisTarget.sisMarks = (sisTarget.sisMarks || 0) + 1;
        battleComboLogs.push(`💅 ${actor.name} 觸發【獨立自主】印記追擊 (${sisTarget.sisMarks}層)`);
        addLog(`💅 <strong>${actor.name}</strong> 追加<strong>【獨立自主】</strong> ➔ ${sisTarget.name} <span class="tag-dmg">⚔️ -${sisDmg}</span> <span class="tag-nerf">🔴 印記x${sisTarget.sisMarks} (易傷+${sisTarget.sisMarks * 5}%)</span>`);
      }
    }

    if (actor.isAlly && playerAugments.some(a => a.id === 'aug_idol')) {
      allies.filter(u => u.hp > 0).forEach(u => {
        recordHeal(actor, u, 65);
        addShield(actor, u, 45);
      });
      addLog(`💖 <span class="tag-heal">💚 偶像應援 全隊+65 HP & 🛡️+45 護盾</span>`);
    }

    checkAndyRitual(allies, opponents);
    checkThreeGodsCombo(actor, allies, opponents);
  } else {
    if (actor.id === 'andy_opp_fused') {
      const aliveOpps = opponents.filter(u => u.hp > 0 && !u.inRitual);
      aliveOpps.forEach(e => dealDamage(actor, e, actor.atk));
      actor.mp = Math.min(actor.maxMp, actor.mp + 30 + extraMp);
      addLog(`☯️ <strong>${actor.name}</strong> 普攻橫掃敵方全體 <span class="tag-dmg">⚔️ 全體金融風暴</span>！`);
    } else {
      const dmg = dealDamage(actor, target, actor.atk);
      actor.mp = Math.min(actor.maxMp, actor.mp + 30 + extraMp);
      addLog(`${actor.isAlly ? '🟢' : '🔴'} <strong>${actor.name}</strong> 普攻 <strong>${target.name}</strong> <span class="tag-dmg">⚔️ -${dmg}</span>`);
    }
  }

  if (actor.id === 'loki' && actor.hp > 0 && !isPausedForEvent) {
    const aliveOpps = opponents.filter(u => u.hp > 0 && !u.inRitual);
    const targets = actor.stars >= 3 ? aliveOpps.slice(0, 2) : (getTarget(opponents) ? [getTarget(opponents)] : []);
    targets.forEach(mobiusTarget => {
      const mDmg = dealDamage(actor, mobiusTarget, actor.atk * 0.55);
      if (actor.stars >= 3 && !mobiusTarget.noMpHero) {
        const stolen = Math.min(10, mobiusTarget.mp || 0);
        mobiusTarget.mp -= stolen;
        actor.mp = Math.min(actor.maxMp, actor.mp + stolen);
      }
      addLog(`🕵️‍♂️ <strong>背後靈【Mobius】</strong> 電擊 <strong>${mobiusTarget.name}</strong> <span class="tag-dmg">⚔️ -${mDmg}</span>`);
    });
    if (targets.length > 0) battleComboLogs.push(`🕵️‍♂️ Loki 背後靈【Mobius】協同電擊`);
  }
}

function castSkill(actor, allies, opponents, mainTarget) {
  const skillBoost = (actor.isAlly && playerAugments.some(a => a.id === 'aug_oil')) ? 1.2 : 1;
  const aliveOpps = opponents.filter(u => u.hp > 0 && !u.inRitual);
  const aliveAllies = allies.filter(u => u.hp > 0);
  const isStar3 = actor.stars >= 3;

  // 觸發 Persona 5 大招 / ★3 極意斜切特寫橫幅
  if (isStar3 || actor.isBoss || actor.id === 'dc_tesla' || actor.id === 'andy_opp_fused') {
    triggerCutIn(
      actor.icon,
      actor.name,
      isStar3 && actor.awakeningName ? `${actor.awakeningName}・${actor.skillName}` : actor.skillName,
      actor.isBoss ? 'boss' : (isStar3 ? 'awakening' : 'ult')
    );
  }

  switch (actor.id) {
    case 'boss_yeung': {
      let total = 0;
      aliveOpps.forEach(e => {
        total += dealDamage(actor, e, actor.atk * 1.65);
      });
      addShield(actor, actor, 300);
      addLog(`👹 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>！<span class="tag-dmg">⚔️ 全體毀滅轟炸 -${total}</span> 並獲得 <span class="tag-buff">🛡️ +300 護盾</span>！`);
      break;
    }
    case 'dc_tesla': {
      // V4 重製大招：Tesla 全體 180% 傷害，30% 機率雙倍暴衝 (360%) + 全隊充能 25 MP
      // B記全隊加攻；B狗大招後獲得受傷轉嫁 50% 給最高血量隊友
      // ★3 覺醒【極限雙重人格・全速走數】：車頭必綁隊友撞擊造成額外 150% 傷害、敵方全體 SPD -20（1回合）
      const isDouble = Math.random() < 0.30;
      const baseMult = isDouble ? 3.60 : 1.80;
      const star3ExtraMult = isStar3 ? 1.50 : 0;
      const totalMult = (baseMult + star3ExtraMult) * skillBoost;

      let totalDmg = 0;
      aliveOpps.forEach(e => {
        totalDmg += dealDamage(actor, e, actor.atk * totalMult);
        if (isStar3 && !e.immuneDebuff) {
          e.curSpd = Math.max(40, (e.curSpd || e.spd) - 20);
          e.spdDebuffTurns = 1;
        }
      });

      aliveAllies.forEach(a => {
        if (!a.noMpHero) a.mp = Math.min(a.maxMp, a.mp + 25);
      });

      let modeEffects = [];
      if (actor.dcMode === 'B_KEE' || actor.dcMode === 'BOTH' || isStar3) {
        aliveAllies.forEach(a => a.atk = Math.round(a.atk * 1.20));
        modeEffects.push('<span class="tag-buff">🟢 B記全隊攻+20%</span>');
      }
      if (actor.dcMode === 'B_DOG' || actor.dcMode === 'BOTH' || isStar3) {
        actor.bDogTransferActive = true;
        modeEffects.push('<span class="tag-event">💸 B狗受傷轉嫁50%啟動</span>');
      }
      if (isStar3) {
        battleComboLogs.push('🚗 DC齊發達 ★3【極限雙重人格・全速走數】綁隊友撞擊 +150% 傷害');
        modeEffects.push('<span class="tag-crit">🔥 ★3綁隊友撞擊+150% & 敵全體SPD-20</span>');
      }

      addLog(`🚗 <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>！${isDouble ? '<span class="tag-crit">⚡360%雙倍暴衝!</span>' : ''} <span class="tag-dmg">⚔️ 全體共-${totalDmg}</span> <span class="tag-buff">🟢 全隊+25 MP</span> ${modeEffects.join(' ')}`);
      break;
    }
    case 'andy_opp_fused': {
      aliveOpps.forEach(e => {
        dealDamage(actor, e, actor.atk * 2.0 * skillBoost);
        if (isStar3) {
          e.vulnerableBonus = 0.20;
          if (!e.noMpHero) e.mp = Math.max(0, e.mp - 20);
        }
      });
      aliveAllies.forEach(a => {
        recordHeal(actor, a, Math.round(150 * skillBoost));
        a.atk = Math.round(a.atk * 1.25);
      });
      addLog(`☯️ <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>！<span class="tag-dmg">⚔️ 全體200%轟炸</span> <span class="tag-heal">💚 全隊+150 HP</span> <span class="tag-buff">🟢 全隊攻+25%</span>`);
      break;
    }
    case 'mouse_sis': {
      const mpGain = isStar3 ? 55 : 40;
      const otherAllies = aliveAllies.filter(a => a !== actor && !a.noMpHero);
      otherAllies.forEach(a => a.mp = Math.min(a.maxMp, a.mp + mpGain));
      aliveAllies.forEach(a => {
        recordHeal(actor, a, Math.round(90 * skillBoost));
        if (isStar3) addShield(actor, a, Math.round(120 * skillBoost));
        a.atk = Math.round(a.atk * 1.15);
      });
      if (aliveAllies.length === 1 && mainTarget) {
        const soloDmg = dealDamage(actor, mainTarget, actor.atk * 1.6 * skillBoost);
        addLog(`🍵 <strong>${actor.name}</strong> 施放【${actor.skillName}】！<span class="tag-heal">💚 +90 HP</span> 並單挑潑出熱抹茶 <span class="tag-dmg">⚔️ -${soloDmg}</span>！`);
      } else {
        addLog(`🍵 <strong>${actor.name}</strong> 施放【${actor.skillName}】！<span class="tag-buff">🟢 隊友+${mpGain} MP</span> <span class="tag-heal">💚 全隊+90 HP</span> ${isStar3 ? '<span class="tag-buff">🛡️ 全隊+120護盾</span>' : ''}`);
      }
      break;
    }
    case 'st_sis': {
      const healMultiplier = (!actor.isWeakened ? 1.3 : 1) * (isStar3 ? 1.35 : 1) * skillBoost;
      const healAmt = Math.round(150 * healMultiplier);
      aliveAllies.forEach(a => {
        recordHeal(actor, a, healAmt);
        if (isStar3) addShield(actor, a, Math.round(healAmt * 0.4));
      });
      addLog(`🐶 <strong>${actor.name}</strong> 施放【${actor.skillName}】！<span class="tag-heal">💚 全隊+${healAmt} HP</span> ${isStar3 ? `<span class="tag-buff">🛡️ +${Math.round(healAmt * 0.4)} 護盾</span>` : ''}`);
      break;
    }
    case 'icy_sis': {
      const healAmt = Math.round(115 * skillBoost);
      aliveAllies.forEach(a => {
        recordHeal(actor, a, healAmt);
        a.atk = Math.round(a.atk * 1.20);
      });
      if (isStar3) {
        aliveOpps.forEach(e => dealDamage(actor, e, actor.atk * 1.30 * skillBoost));
      }
      addLog(`🐱 <strong>${actor.name}</strong> 施放【${actor.skillName}】！<span class="tag-heal">💚 全隊+${healAmt} HP</span> <span class="tag-buff">🟢 全隊攻+20%</span> ${isStar3 ? '<span class="tag-dmg">⚔️ ★3冰霜貓爪全體130%</span>' : ''}`);
      break;
    }
    case 'shijie_sis': {
      const mult = isStar3 ? 2.80 : 2.15;
      const dmg = dealDamage(actor, mainTarget, actor.atk * mult * skillBoost, false, isStar3);
      if (isStar3 && mainTarget.hp <= 0) {
        actor.mp = Math.min(actor.maxMp, actor.mp + 50);
      }
      addLog(`🔫 <strong>${actor.name}</strong> 施放【${actor.skillName}】➔ ${mainTarget.name} <span class="tag-dmg">⚔️ -${dmg}${isStar3 ? ' (穿盾!)' : ''}</span>`);
      const dvAlly = aliveAllies.find(a => a.id === 'dv');
      if (dvAlly && mainTarget.hp > 0) {
        const dvDmg = dealDamage(dvAlly, mainTarget, dvAlly.atk * 1.2);
        actor.atk = Math.round(actor.atk * 1.2);
        dvAlly.atk = Math.round(dvAlly.atk * 1.2);
        battleComboLogs.push(`💢 師姐 sis + DV 觸發【老婆分靈體】狂暴合擊`);
        addLog(`💢 <span class="tag-event">分靈體聯動</span> <strong>DV</strong> 狂暴追擊 ${mainTarget.name} <span class="tag-dmg">⚔️ -${dvDmg}</span> <span class="tag-buff">🟢 兩人攻+20%</span>`);
      }
      break;
    }
    case 'stock_opp': {
      if (actor.isAlly && playerAugments.some(a => a.id === 'aug_baemon')) {
        const healAmt = Math.round(145 * skillBoost);
        aliveAllies.forEach(a => {
          recordHeal(actor, a, healAmt);
          addShield(actor, a, Math.round(100 * skillBoost));
          a.curSpd = (a.curSpd || a.spd) + 18;
        });
        addLog(`👾 <strong>${actor.name}</strong> 發動【寶怪應援・SHEESH打Call】！<span class="tag-heal">💚 全隊+${healAmt} HP & 🛡️+100盾</span> <span class="tag-buff">🟢 全隊攻速+18</span>`);
      } else {
        const triggerBull = isStar3 || Math.random() < 0.55;
        const triggerReap = isStar3 || !triggerBull;
        if (triggerBull) {
          aliveAllies.forEach(a => a.atk = Math.round(a.atk * 1.25));
          aliveOpps.forEach(e => dealDamage(actor, e, actor.atk * 1.15 * skillBoost));
          addLog(`📈 <strong>${actor.name}</strong> 開出【牛市暴漲】！<span class="tag-buff">🟢 全隊攻+25%</span> <span class="tag-dmg">⚔️ 全體115%轟炸</span>`);
        }
        if (triggerReap && mainTarget && mainTarget.hp > 0) {
          const dmg = dealDamage(actor, mainTarget, actor.atk * 1.65 * skillBoost);
          recordHeal(actor, actor, dmg);
          addLog(`📉 <strong>${actor.name}</strong> 發動【割韭菜】➔ ${mainTarget.name} <span class="tag-dmg">⚔️ -${dmg}</span> <span class="tag-heal">💚 吸血+${dmg}</span>`);
        }
      }
      break;
    }
    case 'satsuki': {
      aliveAllies.forEach(a => {
        recordHeal(actor, a, Math.round(130 * skillBoost));
        a.atk = Math.round(a.atk * 1.15);
        if (isStar3) {
          addShield(actor, a, Math.round(150 * skillBoost));
          a.curSpd = (a.curSpd || a.spd) + 15;
        }
      });
      if (!mainTarget.immuneDebuff) {
        mainTarget.atk = Math.max(20, Math.round(mainTarget.atk * 0.85));
      }
      addLog(`🎤 <strong>${actor.name}</strong> 施放【${actor.skillName}】！<span class="tag-heal">💚 全隊+130 HP</span> <span class="tag-buff">🟢 全隊攻+15%</span> ${isStar3 ? '<span class="tag-buff">🛡️ 全隊+150盾 & 速+15</span>' : ''}`);
      break;
    }
    case 'loki': {
      const dmg = dealDamage(actor, mainTarget, actor.atk * 1.7 * skillBoost);
      aliveAllies.forEach(a => { if (a !== actor && !a.noMpHero) a.mp = Math.min(a.maxMp, a.mp + 30); });
      addLog(`🦊 <strong>${actor.name}</strong> 施放【時間線收割】➔ ${mainTarget.name} <span class="tag-dmg">⚔️ -${dmg}</span> <span class="tag-buff">🟢 隊友+30 MP</span>`);
      break;
    }
    case 'andy': {
      const mult = isStar3 ? 2.40 : 1.85;
      aliveOpps.forEach(e => dealDamage(actor, e, actor.atk * mult * skillBoost));
      if (isStar3) addShield(actor, actor, 250);
      addLog(`🛢️ <strong>${actor.name}</strong> 引爆【負油價末日震波】<span class="tag-dmg">⚔️ 全體${Math.round(mult*100)}%轟炸</span>！`);
      break;
    }
    case 'aming': {
      const targets = isStar3 ? aliveOpps : aliveOpps.slice(0, 2);
      const mpDrain = isStar3 ? 50 : 40;
      targets.forEach(t => {
        if (isStar3 && (t.shield || 0) > 0) {
          t.shield = Math.round(t.shield * 0.5);
        }
        dealDamage(actor, t, actor.atk * 1.45 * skillBoost);
        if (!t.noMpHero) t.mp = Math.max(0, t.mp - mpDrain);
      });
      addLog(`💻 <strong>${actor.name}</strong> 執行【rm -rf /*】！<span class="tag-dmg">⚔️ ${isStar3 ? '全體削盾50%+' : '雙目標'}145%傷害</span> <span class="tag-nerf">🔴 扣魔-${mpDrain} MP</span>`);
      break;
    }
    case 'dashen': {
      const hasPartner = aliveAllies.some(a => a.id === 'loki' || a.id === 'hugo');
      const mult = (hasPartner ? 1.7 : 1.25) + (isStar3 ? 0.45 : 0);
      aliveOpps.forEach(e => dealDamage(actor, e, actor.atk * mult * skillBoost));
      if (isStar3) aliveAllies.forEach(a => addShield(actor, a, 140));
      addLog(`👑 <strong>${actor.name}</strong> 降下【神諭裁決】<span class="tag-dmg">⚔️ 全體${Math.round(mult*100)}%轟炸</span> ${isStar3 ? '<span class="tag-buff">🛡️ 全隊+140盾</span>' : ''}！`);
      break;
    }
    case 'hugo': {
      const weakest = [...aliveOpps].sort((a, b) => a.hp - b.hp)[0] || mainTarget;
      const mult = isStar3 ? 2.75 : 2.10;
      const dmg = dealDamage(actor, weakest, actor.atk * mult * skillBoost);
      const hasPartner = aliveAllies.some(a => a.id === 'loki' || a.id === 'dashen');
      if (hasPartner) aliveAllies.forEach(a => recordHeal(actor, a, 90));
      addLog(`🌌 <strong>${actor.name}</strong> 施放【次元共鳴斬】➔ ${weakest.name} <span class="tag-dmg">⚔️ -${dmg}</span> ${hasPartner ? '<span class="tag-heal">💚 全隊+90 HP</span>' : ''}`);
      if (isStar3 && weakest.hp <= 0) {
        const nextWeak = opponents.filter(u => u.hp > 0 && !u.inRitual).sort((a, b) => a.hp - b.hp)[0];
        if (nextWeak) {
          const extraDmg = dealDamage(actor, nextWeak, actor.atk * 1.50 * skillBoost);
          addLog(`🌌 <strong>${actor.name}</strong> ★3【無間次元】斬殺追擊 ➔ ${nextWeak.name} <span class="tag-dmg">⚔️ -${extraDmg}</span>！`);
        }
      }
      break;
    }
    case 'dv': {
      const missingHpRatio = 1 + ((actor.maxHp - actor.hp) / actor.maxHp);
      const hits = isStar3 ? 4 : 3;
      let total = 0;
      for (let i = 0; i < hits; i++) {
        const curAliveOpps = opponents.filter(u => u.hp > 0 && !u.inRitual);
        if (curAliveOpps.length === 0) break;
        const t = curAliveOpps[Math.floor(Math.random() * curAliveOpps.length)];
        total += dealDamage(actor, t, actor.atk * 0.85 * missingHpRatio * skillBoost);
      }
      if (isStar3) {
        addShield(actor, actor, Math.round(actor.maxHp * 0.20));
        recordHeal(actor, actor, Math.round(total * 0.25));
      }
      addLog(`💢 <strong>${actor.name}</strong> 躁狂 ${hits} 連擊 <span class="tag-dmg">⚔️ 共-${total}</span> ${isStar3 ? '<span class="tag-buff">🛡️ +20%護盾 & 吸血</span>' : ''}！`);
      break;
    }
    case 'dvp': {
      recordHeal(actor, actor, Math.round(200 * skillBoost));
      const shieldAmt = Math.round((isStar3 ? 400 : 220) * skillBoost);
      addShield(actor, actor, shieldAmt);
      if (isStar3) {
        aliveAllies.filter(a => a !== actor).forEach(a => addShield(actor, a, 150));
      }
      const dmg = dealDamage(actor, mainTarget, actor.atk * 1.5 * skillBoost);
      addLog(`🛡️ <strong>${actor.name}</strong> 施放【共同富裕】！<span class="tag-heal">💚 +200 HP & 🛡️+${shieldAmt}盾</span> <span class="tag-dmg">⚔️ 反震-${dmg}</span>`);
      break;
    }
    case 'ansir': {
      recordHeal(actor, actor, 180);
      addShield(actor, actor, 120);
      const spdGain = isStar3 ? 30 : 15;
      actor.curSpd = (actor.curSpd || actor.spd) + spdGain;
      const dmg = dealDamage(actor, mainTarget, actor.atk * 1.5 * skillBoost);
      if (isStar3 && mainTarget.hp > 0) {
        const spdDiff = Math.max(0, (actor.curSpd || actor.spd) - (mainTarget.curSpd || mainTarget.spd));
        if (spdDiff > 0) dealDamage(actor, mainTarget, spdDiff * 1.5, true);
      }
      addLog(`🏃 <strong>${actor.name}</strong> 施放【${actor.skillName}】！<span class="tag-heal">💚 +180 HP & 🛡️+120盾</span> <span class="tag-buff">🟢 速度+${spdGain}</span> <span class="tag-dmg">⚔️ -${dmg}</span>`);
      break;
    }
    case 'lg': {
      const dmg = dealDamage(actor, mainTarget, actor.atk * 1.65 * skillBoost);
      if (isStar3) {
        aliveAllies.forEach(a => {
          recordHeal(actor, a, Math.round(160 * skillBoost));
          addShield(actor, a, Math.round(120 * skillBoost));
        });
        addLog(`✝️ <strong>${actor.name}</strong> ★3 審判 ${mainTarget.name} <span class="tag-dmg">⚔️ -${dmg}</span> <span class="tag-heal">💚 全隊+160 HP & 🛡️+120盾</span>`);
      } else {
        const lowestAlly = [...aliveAllies].sort((a, b) => a.hp - b.hp)[0];
        if (lowestAlly) {
          recordHeal(actor, lowestAlly, Math.round(180 * skillBoost));
          addShield(actor, lowestAlly, Math.round(100 * skillBoost));
        }
        addLog(`✝️ <strong>${actor.name}</strong> 審判 ${mainTarget.name} <span class="tag-dmg">⚔️ -${dmg}</span> <span class="tag-heal">💚 治療${lowestAlly ? lowestAlly.name : ''}+180 HP & 🛡️+100盾</span>`);
      }
      break;
    }
  }
}

function checkAndyRitual(allies, opponents) {
  const andy = allies.find(u => u.id === 'andy' && u.hp > 0 && u.inRitual);
  if (!andy) return;
  andy.ritualCount += 1;
  const reqRitual = andy.stars >= 3 ? 2 : 3;
  addLog(`🕯️ <strong>${andy.name}</strong> 完成第 <strong>${andy.ritualCount} / ${reqRitual}</strong> 個柏克末日儀式！`);

  if (andy.ritualCount >= reqRitual) {
    andy.inRitual = false;
    const mult = andy.stars >= 3 ? 3.0 : 2.2;
    if (andy.stars >= 3) addShield(andy, andy, 300);
    triggerCutIn('🛢️', andy.name, '柏克末日・負油價隕石降臨！', 'ult');
    battleComboLogs.push(`☄️ Andy安迪 完成儀式攜帶【負油價隕石】降臨`);
    addLog(`☄️ <span class="tag-event">末日降臨</span> <strong>Andy安迪</strong> 攜帶負油價隕石降臨戰場 <span class="tag-dmg">⚔️ 全體${Math.round(mult*100)}%轟炸</span>！`);
    opponents.filter(u => u.hp > 0 && !u.inRitual).forEach(e => {
      dealDamage(andy, e, andy.atk * mult);
    });

    checkNemesisEasterEgg(andy);
  }
}

function checkThreeGodsCombo(actor, allies, opponents) {
  if (!['loki', 'dashen', 'hugo'].includes(actor.id)) return;
  const aliveGods = allies.filter(u => ['loki', 'dashen', 'hugo'].includes(u.id) && u.hp > 0);
  if (aliveGods.length >= 3) {
    const target = getTarget(opponents);
    if (target) {
      const comboDmg = dealDamage(actor, target, actor.atk * 0.9);
      battleComboLogs.push(`🌟 【3幻神】觸發三位一體追擊`);
      addLog(`🌟 <span class="tag-event">3幻神共鳴</span> 三位一體追擊 ${target.name} <span class="tag-dmg">⚔️ -${comboDmg}</span>！`);
    }
  }
}

// ================= 9. 賽後戰報數據統計與 ❤️×2 命數結算 =================
function handleBattleEnd(isWin) {
  if (!isWin) {
    playerLives = Math.max(0, playerLives - 1);
    addLog(`💔 <span class="tag-nerf">戰鬥敗北！扣除 1 顆心心命數</span>（剩餘命數：<strong>${playerLives} / ${maxLives}</strong>）`);
  }
  updateUI();
  showBattleReportModal(isWin);
}

function showBattleReportModal(isWin) {
  const modal = document.getElementById('reportModal');
  const content = document.getElementById('reportContent');
  modal.classList.remove('hidden');

  const sortedByDmg = [...playerRoster].sort((a, b) => (b.stats?.dmgDealt || 0) - (a.stats?.dmgDealt || 0));
  const mvpUnit = sortedByDmg[0];
  const uniqueCombos = [...new Set(battleComboLogs)];
  const isGameOver = (!isWin && playerLives <= 0) || (playerRoster.length === 0 && !isWin);

  let titleHtml = '';
  if (isWin) {
    titleHtml = currentStage >= maxStage
      ? `👑 恭喜擊潰深淵終極 Boss【楊守正】！全 8 關制霸！`
      : `🏆 STAGE ${currentStage} 戰鬥勝利！賽後戰報`;
  } else if (isGameOver) {
    titleHtml = `💀 GAME OVER・2 命耗盡徹底墜入深淵`;
  } else {
    titleHtml = `💔 STAGE ${currentStage} 戰敗扣 1 命（剩餘 ❤️×${playerLives} 命）`;
  }

  let btnText = '';
  if (isWin) {
    btnText = currentStage >= maxStage ? '🎉 完美全破！重新開啟新一輪深淵挑戰' : '🎁 領取過關獎勵 (進入下一關)';
  } else if (isGameOver) {
    btnText = '💀 命數耗盡・重新開局挑戰 (Reset)';
  } else {
    btnText = `🔄 敵方滿血重置・調整站位重戰第 ${currentStage} 關 (剩 ❤️×${playerLives})`;
  }

  content.innerHTML = `
    <h2 class="modal-title" style="color:${isWin ? 'var(--p5-yellow)' : 'var(--p5-red)'};">
      ${titleHtml}
    </h2>
    <p class="modal-sub">
      MVP 最佳表現：<strong>${mvpUnit ? `${mvpUnit.icon} ${mvpUnit.name} (輸出 ${mvpUnit.stats?.dmgDealt || 0} 傷害)` : '無'}</strong>
      | 當前命數：<strong>${'❤️'.repeat(playerLives)}${'🖤'.repeat(maxLives - playerLives)} (${playerLives}/${maxLives})</strong>
    </p>

    <table class="stats-table">
      <thead>
        <tr>
          <th>隊員名稱</th>
          <th>⚔️ 總輸出傷害</th>
          <th>🛡️ 承受傷害 (坦傷)</th>
          <th>💉 治療與護盾貢獻</th>
        </tr>
      </thead>
      <tbody>
        ${playerRoster.map(u => `
          <tr>
            <td><strong>${u.icon}${u.name} (★${u.stars})</strong>${u === mvpUnit ? '<span class="upgrade-tag">MVP</span>' : ''}</td>
            <td style="color:#f87171; font-weight:bold;">${u.stats?.dmgDealt || 0}</td>
            <td style="color:#60a5fa; font-weight:bold;">${u.stats?.dmgTaken || 0}</td>
            <td style="color:#4ade80; font-weight:bold;">${u.stats?.healed || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="background:#0d0e11; padding:12px; border:1px solid #3f4147; text-align:left; margin:12px 0; font-size:0.84rem;">
      <strong style="color:var(--p5-yellow);">✨ 本場觸發的特殊聯動與極意亮點：</strong>
      <div style="margin-top:6px; color:#d1d5db;">
        ${uniqueCombos.length > 0 ? uniqueCombos.map(c => `<div>• ${c}</div>`).join('') : '本場無觸發特殊合體或額外極意聯動。'}
      </div>
    </div>

    <button class="btn ${isGameOver ? 'btn-danger' : 'btn-primary'}" style="width:320px;" onclick="closeReportAndProceed(${isWin})">
      ${btnText}
    </button>
  `;
}

function closeReportAndProceed(isWin) {
  document.getElementById('reportModal').classList.add('hidden');

  if ((!isWin && playerLives <= 0) || (playerRoster.length === 0 && !isWin)) {
    initGame();
    return;
  }

  if (isWin) {
    if (currentStage >= maxStage) {
      addLog(`👑 <strong>恭喜擊敗【👹 楊守正】通關全部 8 關深淵！你的 DC BON 全明星小隊完成了 100% 中的 100% 傳奇！</strong>`);
      initGame();
    } else {
      currentStage++;
      prepareUnitsForStage();
      updateUI();
      showHeroDraft(
        `🎉 通過第 ${currentStage - 1} 關！獎勵 1：招募或升星英雄`,
        `選完英雄後將進入海克斯增幅 3 選 1 ${bonusAugmentPending > 0 ? '(含宿敵死鬥額外 +1 次增幅！)' : ''}`
      );
    }
  } else {
    // 尚有 1 命：敵方滿血與護盾重置，我方恢復滿狀態準備重試
    prepareUnitsForStage();
    resetCurrentEnemyStage();
    updateUI();
    addLog(`🔄 <strong>命數尚存 (❤️×${playerLives})！敵方已滿血重置，請調整我方 1~4 號站位後再次挑戰第 ${currentStage} 關！</strong>`);
  }
}

// ================= 10. 內建「全英雄 & 羈絆 & 海克斯 & Boss 圖鑑」系統 =================
function openCodex() {
  document.getElementById('codexModal').classList.remove('hidden');
  renderCodexTab('heroes');
}

function closeCodex() {
  document.getElementById('codexModal').classList.add('hidden');
}

function renderCodexTab(tab) {
  ['Heroes', 'Traits', 'Augments'].forEach(t => {
    const btn = document.getElementById(`tab${t}`);
    if (btn) btn.classList.toggle('active', t.toLowerCase() === tab);
  });

  const body = document.getElementById('codexBody');
  if (tab === 'heroes') {
    const allHeroes = [FUSED_HERO_TEMPLATE, FINAL_BOSS_TEMPLATE, ...HERO_POOL];
    body.innerHTML = `<div class="choices-grid">` + allHeroes.map(h => `
      <div class="choice-card p5-card-skew" style="cursor:default; ${h.id === 'andy_opp_fused' ? 'border-color:var(--p5-yellow);' : (h.id === 'boss_yeung' ? 'border-color:var(--p5-red);' : '')}">
        <div>
          <h4>
            <span>${h.icon} ${h.name}</span>
            ${h.id === 'andy_opp_fused' ? '<span class="upgrade-tag">隱藏合體卡</span>' : (h.id === 'boss_yeung' ? '<span class="upgrade-tag" style="background:var(--p5-red);color:#fff;">第8關終極Boss</span>' : '')}
          </h4>
          ${h.title ? `<div style="font-size:0.74rem; color:#fde047; margin-bottom:5px; font-weight:bold;">${h.title}</div>` : ''}
          <div class="choice-traits">${h.traits.map(t => `<span class="trait-pill">${t}</span>`).join('')}</div>
          <div class="choice-desc">
            <strong>【${h.skillName}】</strong><br>${h.skillDesc}
            ${h.awakeningName ? `<div class="awakening-box"><strong>⚡ ${h.awakeningName}：</strong>${h.awakeningDesc}</div>` : ''}
            ${h.easterEggHint ? `<div class="easter-hint">${h.easterEggHint}</div>` : ''}
          </div>
        </div>
        <div class="choice-stats">❤️ HP: ${h.hp}${h.shield ? ` (+🛡️${h.shield})` : ''} | ⚔️ ATK: ${h.atk} | ⚡ SPD: ${h.spd} | 💧 MP: ${h.noMpHero ? '無魔力(0)' : h.maxMp}</div>
      </div>
    `).join('') + `</div>`;
  } else if (tab === 'traits') {
    body.innerHTML = `<div class="choices-grid">` + Object.entries(TRAIT_INFO).map(([name, info]) => `
      <div class="choice-card p5-card-skew" style="cursor:default;">
        <div>
          <h4><span>🔗 ${name}</span> <span class="trait-pill">${info.req}</span></h4>
          <div class="choice-desc">${info.desc}</div>
        </div>
        <div class="choice-stats" style="color:#f9a8d4; font-style:italic;">${info.lore}</div>
      </div>
    `).join('') + `</div>`;
  } else if (tab === 'augments') {
    body.innerHTML = `<div class="choices-grid">` + AUGMENT_POOL.map(a => `
      <div class="choice-card p5-card-skew" style="cursor:default;">
        <div>
          <h4><span>${a.name}</span></h4>
          <div class="choice-desc">${a.desc}</div>
        </div>
        <div class="choice-stats">${a.id === 'aug_lettuce' ? '🥬 手動指定 1 名隊員升 1 星' : (a.reqHero ? '🌟 角色專屬轉職增幅' : '通用增幅 (不重複抽取)')}</div>
      </div>
    `).join('') + `</div>`;
  }
}

window.onload = initGame;
