// ================= 0. 自動注入 v3.2 專屬 UI 樣式 (確保血條與折疊說明 100% 生效) =================
(function injectV32Styles() {
  const style = document.createElement('style');
  style.innerHTML = `
    .skill-title-bar { font-size: 0.9rem; font-weight: bold; color: #f6e05e; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
    .skill-bullets { display: flex; flex-direction: column; gap: 7px; margin-bottom: 8px; }
    .skill-bullet-item { display: flex; flex-direction: column; gap: 2px; padding: 4px 8px 4px 10px; border-left: 3px solid #4e5058; background: rgba(17, 19, 25, 0.55); border-radius: 0 6px 6px 0; text-align: left; }
    .bullet-label { font-size: 0.75rem; font-weight: bold; letter-spacing: 0.3px; }
    .bullet-desc { font-size: 0.84rem; color: #e2e8f0; line-height: 1.35; }
    .skill-bullet-item.b-dmg   { border-left-color: #f87171; }
    .skill-bullet-item.b-heal  { border-left-color: #4ade80; }
    .skill-bullet-item.b-mp    { border-left-color: #60a5fa; }
    .skill-bullet-item.b-buff  { border-left-color: #facc15; }
    .skill-bullet-item.b-crit  { border-left-color: #facc15; }
    .skill-bullet-item.b-event { border-left-color: #c084fc; }
    .skill-bullet-item.b-nerf  { border-left-color: #fb923c; }
    .b-dmg-text   { color: #f87171 !important; font-weight: bold; }
    .b-heal-text  { color: #4ade80 !important; font-weight: bold; }
    .b-mp-text    { color: #60a5fa !important; font-weight: bold; }
    .b-buff-text  { color: #facc15 !important; font-weight: bold; }
    .b-crit-text  { color: #facc15 !important; font-weight: bold; }
    .b-event-text { color: #c084fc !important; font-weight: bold; }
    .b-nerf-text  { color: #fb923c !important; font-weight: bold; }
    .toggle-desc-btn { background: transparent !important; border: none !important; color: #8b92a5 !important; font-size: 0.76rem; cursor: pointer; text-align: left; padding: 4px 0; display: flex; align-items: center; gap: 4px; margin-top: 2px; font-weight: bold; }
    .toggle-desc-btn:hover { color: #fff !important; }
    .full-desc-box { font-size: 0.78rem; color: #cbd5e1; background: #111319; padding: 8px 10px; border-radius: 6px; margin-top: 4px; border: 1px solid #2a2e43; line-height: 1.45; display: none !important; text-align: left; }
    .full-desc-box.show { display: block !important; }
    .card-footer-stats { display: flex; justify-content: space-between; align-items: center; font-size: 0.76rem; font-weight: bold; border-top: 1px solid #2a2e43; padding-top: 8px; margin-top: 8px; flex-wrap: nowrap; gap: 4px; }
    .card-footer-stats span { white-space: nowrap; }
    .stat-hp  { color: #4ade80; }
    .stat-atk { color: #f87171; }
    .stat-spd { color: #facc15; }
    .stat-mp  { color: #60a5fa; }
  `;
  document.head.appendChild(style);
})();

// ================= 1. 遊戲全局狀態與統計 =================
let currentStage = 1;
const maxStage = 5;
let playerRoster = [];
let playerAugments = [];
let enemyRoster = [];
let battleInterval = null;
let battleSpeed = 900;
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
let expandedDescIds = new Set(); // 記住哪些卡片展開了「完整說明」，戰鬥刷新時不會自動跳回！

const tooltipEl = document.getElementById('customTooltip');
function showTooltip(e, title, desc, lore = '') {
  tooltipEl.innerHTML = `<div class="tt-title">${title}</div><div>${desc}</div>${lore ? `<div class="tt-lore">${lore}</div>` : ''}`;
  tooltipEl.style.display = 'block';
  moveTooltip(e);
}
function moveTooltip(e) {
  if (tooltipEl.style.display === 'none') return;
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + 340 > window.innerWidth) x = e.clientX - 340;
  if (y + 180 > window.innerHeight) y = e.clientY - 180;
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
}
function hideTooltip() { tooltipEl.style.display = 'none'; }
document.addEventListener('mousemove', moveTooltip);

function showTraitTooltip(e, traitName) {
  e.stopPropagation();
  const info = TRAIT_INFO[traitName];
  if (info) showTooltip(e, `🔗 羈絆：【${traitName}】(${info.req})`, info.desc, info.lore);
}

// 卡片「完整說明」折疊/展開切換 (支援狀態記憶)
function toggleFullDesc(cardPrefix, idx, e) {
  if (e) e.stopPropagation();
  const key = `${cardPrefix}_${idx}`;
  const box = document.getElementById(`${cardPrefix}_desc_${idx}`);
  const btn = document.getElementById(`${cardPrefix}_btn_${idx}`);
  if (!box || !btn) return;
  if (box.classList.contains('show')) {
    box.classList.remove('show');
    btn.innerHTML = `▶ 完整說明`;
    expandedDescIds.delete(key);
  } else {
    box.classList.add('show');
    btn.innerHTML = `▼ 收起說明`;
    expandedDescIds.add(key);
  }
}

// 🎨 智能彩色技能條列渲染器
function highlightSkillNumbers(desc, defaultType) {
  return desc
    .replace(/([+\-]?\d+%?\s*(?:範圍|真實|Apex\s*|神聖|暴衝|毀滅)?傷害)/g, '<span class="b-dmg-text">$1</span>')
    .replace(/([+\-]?\d+\s*HP)/g, '<span class="b-heal-text">$1</span>')
    .replace(/([+\-]?\d+\s*(?:點)?(?:魔力|MP)(?:\(MP\))?)/g, '<span class="b-mp-text">$1</span>')
    .replace(/((?:攻擊力|攻速|暴擊率|治療量|治療效果|速度|SPD)(?:永久|提升)?\s*[+\-]\d+%?|[+\-]\d+%?\s*(?:攻擊力|攻速|速度|SPD|暴擊率))/g, `<span class="${defaultType === 'b-nerf' ? 'b-nerf-text' : 'b-buff-text'}">$1</span>`)
    .replace(/(觸發[^\s，！!]+|重啟強化)/g, '<span class="b-event-text">$1</span>');
}

function renderSkillBulletsHtml(bullets) {
  if (!bullets || bullets.length === 0) return '';
  return bullets.map(b => {
    const colonIdx = b.text.indexOf('：');
    let label = b.text;
    let desc = '';
    if (colonIdx !== -1) {
      label = b.text.slice(0, colonIdx);
      desc = b.text.slice(colonIdx + 1);
    }
    const coloredDesc = highlightSkillNumbers(desc, b.type);
    return `
      <div class="skill-bullet-item ${b.type}">
        <div class="bullet-label ${b.type}-text">${label}</div>
        ${desc ? `<div class="bullet-desc">${coloredDesc}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ================= 2. 初始化與流程控制 =================
function initGame() {
  currentStage = 1;
  playerRoster = [];
  playerAugments = [];
  bonusAugmentPending = 0;
  nemesisEventCompleted = false;
  isBattling = false;
  isPausedForEvent = false;
  clearInterval(battleInterval);
  document.getElementById('battleLog').innerHTML = '<div class="log-entry">🎮 歡迎來到 **DC BON 全明星自動戰棋 v3.2**！卡牌技能已全面套用性質色彩區分。</div>';
  generateEnemyTeam(currentStage);
  updateUI();
  showHeroDraft('選擇你的初始英雄 (第 1 關)', '挑選 1 位 Discord 朋友作為開局隊長 (Andy安迪將於第 2 關後解鎖)');
}

function resetGame() {
  if (confirm('確定要重新開始新一局遊戲嗎？')) initGame();
}

function togglePeekBoard() {
  const content = document.getElementById('draftModalContent');
  const overlay = document.getElementById('modalOverlay');
  if (content.classList.contains('hidden')) {
    content.classList.remove('hidden');
    overlay.style.background = 'rgba(0,0,0,0.85)';
  } else {
    content.classList.add('hidden');
    overlay.style.background = 'rgba(0,0,0,0.15)';
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
        u.skillDesc = '【寶怪回歸轉職】捨棄華爾街空頭，化身為狂熱寶怪粉絲！揮舞手燈為我方全體回復 145 點生命值，並使全體隊友攻速 (SPD) 提升 +18！';
        u.skillBullets = [
          { type: 'b-heal', text: '+ 應援治癒：為全體隊友回復 145 HP' },
          { type: 'b-buff', text: '↑ 攻速加成：全體友軍攻速 +18 SPD' }
        ];
      } else {
        u.traits = ['華爾街空頭'];
        u.icon = '📈';
        u.skillName = '百倍槓桿爆倉';
        u.skillDesc = '投下金融核彈！隨機觸發【牛市暴漲】(全隊攻擊+25% 並轟炸敵方全體) 或【割韭菜】(吸取敵方最高血量者 165% 傷害轉為自身生命)。';
        u.skillBullets = [
          { type: 'b-buff', text: '↑ 牛市暴漲：55%機率全隊攻擊力 +25% 並群體轟炸' },
          { type: 'b-dmg', text: '⚔️ 割韭菜：45%機率重傷單體 165% 傷害' },
          { type: 'b-heal', text: '+ 吸血轉化：割韭菜傷害 100% 轉為自身 HP' }
        ];
      }
    }
  });
}

function getRandomItems(arr, count) {
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, count);
}

function getEligibleHeroPool(stage, forEnemy = false) {
  return HERO_POOL.filter(h => {
    if (h.minStage && stage < h.minStage) return false;
    if (nemesisEventCompleted && (h.id === 'andy' || h.id === 'stock_opp')) return false;
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
    teamEl.innerHTML = playerRoster.map((u, i) => `<span class="mini-unit-pill">${i === 0 ? '🛡️' : ''}${u.icon} ${u.name} ★${u.stars}</span>`).join('');
    const syn = getActiveSynergies(playerRoster);
    synEl.innerHTML = Object.entries(syn).map(([k, v]) => `<span class="trait-pill" onmouseenter="showTraitTooltip(event, '${k}')" onmouseleave="hideTooltip()">${k} (${v})</span>`).join('');
  }

  if (playerAugments.length === 0) {
    augEl.innerHTML = '<span style="color:var(--text-muted)">無</span>';
  } else {
    augEl.innerHTML = playerAugments.map(a => `<span class="badge augment" onmouseenter="showTooltip(event, '${a.name}', '${a.desc}')" onmouseleave="hideTooltip()">${a.name}</span>`).join('');
  }
}

function showHeroDraft(title, subtitle) {
  updateDraftOverview();
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('draftModalContent').classList.remove('hidden');
  overlay.style.background = 'rgba(0,0,0,0.85)';
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalSub').innerText = subtitle;
  const grid = document.getElementById('choicesGrid');
  grid.innerHTML = '';

  const pool = getEligibleHeroPool(currentStage, false);
  const choices = getRandomItems(pool, 3);
  choices.forEach((hero, idx) => {
    const existing = playerRoster.find(h => h.id === hero.id);
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.innerHTML = `
      <div>
        <h4>
          <span>${hero.icon} ${hero.name}</span>
          ${existing ? `<span class="upgrade-tag">可升星 ★${existing.stars + 1}</span>` : ''}
        </h4>
        <div class="trait-row">
          ${hero.traits.map(t => `<span class="card-trait-pill" onmouseenter="showTraitTooltip(event, '${t}')" onmouseleave="hideTooltip()">${t}</span>`).join('')}
        </div>
        <div class="skill-title-bar">✦ ${hero.skillName}</div>
        <div class="skill-bullets">
          ${renderSkillBulletsHtml(hero.skillBullets)}
        </div>
        <button class="toggle-desc-btn" id="draft_btn_${idx}" onclick="toggleFullDesc('draft', ${idx}, event)">▶ 完整說明</button>
        <div class="full-desc-box" id="draft_desc_${idx}">
          ${hero.skillDesc}
          ${hero.lore ? `<div style="margin-top:4px; font-style:italic; color:#f9a8d4;">"${hero.lore}"</div>` : ''}
        </div>
      </div>
      <div class="card-footer-stats">
        <span class="stat-hp">❤️ HP ${hero.hp}</span>
        <span class="stat-atk">⚔️ ATK ${hero.atk}</span>
        <span class="stat-spd">⚡ SPD ${hero.spd}</span>
        <span class="stat-mp">♦ MP ${hero.maxMp}</span>
      </div>
    `;
    card.onclick = () => { hideTooltip(); selectHero(hero); };
    grid.appendChild(card);
  });
  overlay.classList.remove('hidden');
}

function selectHero(heroTemplate) {
  const existing = playerRoster.find(h => h.id === heroTemplate.id);
  if (existing) {
    existing.stars += 1;
    existing.baseHp = Math.round(existing.baseHp * 1.35);
    existing.baseAtk = Math.round(existing.baseAtk * 1.35);
    addLog(`⭐ <strong>${existing.icon} ${existing.name}</strong> <span class="tag-buff">🟢 升星 ★${existing.stars}</span>！`);
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
  document.getElementById('modalSub').innerText = `點擊下方現有隊員將其替換為【${newHero.icon} ${newHero.name}】，或點擊略過`;
  const grid = document.getElementById('choicesGrid');
  grid.innerHTML = '';

  playerRoster.forEach((ally, idx) => {
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.innerHTML = `
      <div>
        <h4><span>替換：${ally.icon} ${ally.name} (★${ally.stars})</span></h4>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:6px;">將此位置換成 <strong>${newHero.icon} ${newHero.name} (★1)</strong></div>
      </div>
      <div class="card-footer-stats">
        <span class="stat-hp">❤️ HP ${ally.baseHp}</span>
        <span class="stat-atk">⚔️ ATK ${ally.baseAtk}</span>
      </div>
    `;
    card.onclick = () => {
      playerRoster[idx] = { ...newHero, traits: [...newHero.traits], stars: 1, baseHp: newHero.hp, baseAtk: newHero.atk };
      syncBaemonTransformation();
      proceedAfterHeroSelection();
    };
    grid.appendChild(card);
  });

  const skipCard = document.createElement('div');
  skipCard.className = 'choice-card';
  skipCard.innerHTML = `<h4>🚫 不替換，維持現有陣容</h4><div style="font-size:0.8rem; color:var(--text-muted); margin-top:6px;">直接進入海克斯增幅選擇階段</div>`;
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
  overlay.style.background = 'rgba(0,0,0,0.85)';
  document.getElementById('modalTitle').innerText = isBonus ? `🏆 【宿敵死鬥獎勵】額外海克斯增幅 3 選 1！` : `⚡ 海克斯增幅 3 選 1 (第 ${currentStage} 關前強化)`;
  document.getElementById('modalSub').innerText = `已選過的增幅不會重複出現`;
  const grid = document.getElementById('choicesGrid');
  grid.innerHTML = '';

  const eligibleAugments = AUGMENT_POOL.filter(aug => {
    if (playerAugments.some(a => a.id === aug.id)) return false;
    if (aug.reqHero && !playerRoster.some(u => u.id === aug.reqHero)) return false;
    return true;
  });

  const choices = getRandomItems(eligibleAugments, Math.min(3, eligibleAugments.length));
  choices.forEach(aug => {
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.innerHTML = `
      <div>
        <h4><span>${aug.name}</span></h4>
        <div class="choice-desc" style="font-size:0.82rem; color:#d1d5db; line-height:1.4;">${aug.desc}</div>
      </div>
      <div class="choice-stats">${aug.reqHero ? '🌟 角色專屬轉職增幅' : '永久全隊生效 (不重複)'}</div>
    `;
    card.onclick = () => {
      playerAugments.push(aug);
      syncBaemonTransformation();
      addLog(`⚡ 獲得海克斯增幅：<span class="tag-event">${aug.name}</span>！`);
      if (bonusAugmentPending > 0) {
        bonusAugmentPending--;
        showAugmentDraft(true);
      } else {
        overlay.classList.add('hidden');
        generateEnemyTeam(currentStage);
        prepareUnitsForStage();
        updateUI();
      }
    };
    grid.appendChild(card);
  });
  overlay.classList.remove('hidden');
}

function generateEnemyTeam(stage) {
  const enemyCount = Math.min(stage, 4);
  const pool = getEligibleHeroPool(stage, true);
  let templates = getRandomItems(pool, enemyCount);

  const allyHasOpp = playerRoster.some(u => u.id === 'stock_opp');
  const allyHasAndy = playerRoster.some(u => u.id === 'andy');
  if (stage >= 2 && !nemesisEventCompleted && (allyHasOpp || allyHasAndy) && Math.random() < 0.35) {
    const nemesisId = allyHasOpp ? 'andy' : 'stock_opp';
    if (!templates.some(t => t.id === nemesisId)) {
      const nemesisTemplate = HERO_POOL.find(h => h.id === nemesisId);
      if (nemesisTemplate) {
        templates[0] = nemesisTemplate;
        addLog(`<span class="tag-event">⚡ 宿命引力</span> 對面陣營出現了宿敵 <strong>${nemesisTemplate.icon} ${nemesisTemplate.name}</strong>！`);
      }
    }
  }

  const scale = 0.82 + (stage * 0.14);
  enemyRoster = templates.map(t => {
    const stars = (stage >= 4 && Math.random() > 0.5) ? 2 : 1;
    const hp = Math.round(t.hp * scale * (stars === 2 ? 1.25 : 1));
    const atk = Math.round(t.atk * scale * (stars === 2 ? 1.2 : 1));
    return {
      ...t,
      traits: [...t.traits],
      stars,
      maxHp: hp, hp: hp,
      atk: atk, spd: t.spd, curSpd: t.spd,
      mp: 0, maxMp: t.maxMp,
      isAlly: false,
      ritualCount: t.id === 'andy' ? 0 : null,
      inRitual: t.id === 'andy' && enemyCount > 1,
      sisMarks: 0,
      petSingleBar: false,
      isWeakened: false,
      stats: { dmgDealt: 0, dmgTaken: 0, healed: 0 }
    };
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

  playerRoster.forEach((u, idx) => {
    let maxHp = u.baseHp;
    let atk = u.baseAtk;
    let spd = u.spd;
    let startMp = 0;

    if ((syn['S.I.S'] || 0) >= 3 && u.traits.includes('S.I.S')) {
      maxHp = Math.round(maxHp * 1.25);
      atk = Math.round(atk * 1.25);
    }

    if ((syn['3幻神'] || 0) >= 2) { atk = Math.round(atk * 1.15); spd += 12; }
    if ((syn['3幻神'] || 0) >= 3) { maxHp = Math.round(maxHp * 1.2); atk = Math.round(atk * 1.25); }
    if ((syn['華爾街空頭'] || 0) >= 2) { atk = Math.round(atk * 1.2); }
    if ((syn['科技代碼'] || 0) >= 2) { startMp += 30; }
    if ((syn['狂熱信仰'] || 0) >= 2) { maxHp = Math.round(maxHp * 1.2); }
    if ((syn['大佬時代'] || 0) >= 2) { maxHp += 150; atk += 10; }

    const petSingleBar = (syn['貓狗領導'] || 0) >= 2 && u.traits.includes('貓狗領導');
    if (u.id === 'st_sis') spd += 15;
    if (u.id === 'icy_sis') atk = Math.round(atk * 1.25);

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
    }
    if (hasAug('aug_leverage') && idx > 0) {
      startMp += 30;
      maxHp = Math.round(maxHp * 0.75);
    }

    u.maxHp = maxHp;
    u.hp = maxHp;
    u.atk = atk;
    u.curSpd = spd;
    u.mp = Math.min(u.maxMp, startMp);
    u.isAlly = true;
    u.inRitual = (u.id === 'andy' && playerRoster.length > 1);
    u.ritualCount = (u.id === 'andy') ? (hasAug('aug_oil') ? 1 : 0) : 0;
    u.sisMarks = 0;
    u.petSingleBar = petSingleBar;
    u.isWeakened = false;
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
      floatEl.className = `float-text ${type === 'heal' ? 'float-heal' : (text.includes('CRIT') ? 'float-crit' : 'float-dmg')}`;
      floatEl.innerText = text;
      card.appendChild(floatEl);
      setTimeout(() => floatEl.remove(), 850);
    }
  });
}

function updateUI() {
  document.getElementById('stageDisplay').innerText = `第 ${currentStage} / ${maxStage} 關`;
  document.getElementById('allyCount').innerText = `${playerRoster.length} / 4`;
  document.getElementById('enemyStageName').innerText = currentStage === 5 ? `🔥 最終關大佬隊伍` : `第 ${currentStage} 關鏡像守衛`;

  const syn = getActiveSynergies(playerRoster);
  const synEl = document.getElementById('synergyList');
  if (Object.keys(syn).length === 0) {
    synEl.innerHTML = `<span class="badge">尚未上陣英雄</span>`;
  } else {
    synEl.innerHTML = Object.entries(syn).map(([name, count]) => {
      const isSisActive = name === 'S.I.S' && count >= 3;
      const isDuoActive = name === '最強之兩人' && count >= 1;
      const isGold = isSisActive || isDuoActive || (name === '3幻神' && count >= 3) || (name !== 'S.I.S' && count >= 2);
      let bonusText = '';
      if (name === 'S.I.S') bonusText = count >= 3 ? '(屬性1.25x + 獨立自主!)' : `(${count}/3人)`;
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
    const mpPct = Math.max(0, Math.min(100, Math.round((u.mp / u.maxMp) * 100)));
    const hasDualBar = u.dualHpPet && !u.petSingleBar;

    const baseHalfWidth = Math.min(50, hpPct);
    const petHalfWidth = Math.max(0, hpPct - 50);

    let cardCls = `unit-card ${idx === 0 ? 'frontline' : ''} ${u.hp <= 0 ? 'dead' : ''} ${u.inRitual ? 'ritual-mode' : ''}`;
    if (u.dualHpPet) cardCls += u.isWeakened ? ' pet-weakened' : ' pet-buffed';
    if (isAlly && overdriveActive && u.hp > 0) cardCls += ' overdrive-mode';

    const card = document.createElement('div');
    card.className = cardCls;
    card.id = `${isAlly ? 'ally' : 'enemy'}_card_${idx}`;

    let statusTag = idx === 0 ? '🛡️ 1號前排' : `${idx + 1}號後排`;
    let statusTooltip = idx === 0 ? '位於 1 號位，優先承受單體攻擊。' : '位於後排受到前排保護。';

    if (u.inRitual) {
      statusTag = `🔮 儀式 (${u.ritualCount}/3)`;
      statusTooltip = '正在場外進行末日儀式，友軍每放 1 次大招 +1 儀式，滿 3 次攜帶隕石降臨！';
    } else if (u.dualHpPet) {
      if (u.petSingleBar) {
        statusTag = `🐾 ${u.dualHpPet}合一`;
        statusTooltip = `【貓狗領導】生效！雙血條合一，全程維持 ${u.petBuffDesc}。`;
      } else if (u.isWeakened) {
        statusTag = `💔 ${u.dualHpPet}受損`;
        statusTooltip = `${u.petWeakDesc}。可透過技能回血至 50% 以上重新啟動強化！`;
      } else {
        statusTag = `🐾 ${u.dualHpPet}`;
        statusTooltip = `${u.petBuffDesc}。當跌破 50% 血量時將進入弱化狀態：${u.petWeakDesc}`;
      }
    }

    if (isAlly && overdriveActive && u.hp > 0) statusTag += ' | 🔥爆肝';
    if (u.sisMarks > 0) statusTag += ` | 💅印記x${u.sisMarks}`;

    const safeSkillDesc = u.skillDesc.replace(/'/g, "\\'");
    const safeLore = (u.lore || '').replace(/'/g, "\\'");
    const hpTooltip = hasDualBar
      ? `【雙血量機制】<br>• 右半青色 (50%~100%)：${u.petBuffDesc}<br>• 左半綠色 (0%~50%)：${u.petWeakDesc}`
      : '角色當前生命值與上限。';

    const bulletsHtml = renderSkillBulletsHtml(u.skillBullets);

    card.innerHTML = `
      <div>
        <div class="unit-top">
          <div class="unit-name">
            <span>${u.icon} ${u.name}</span>
            <span class="stars">${'★'.repeat(u.stars)}</span>
          </div>
          <span class="pos-tag" onmouseenter="showTooltip(event, '📌 狀態與位置說明', '${statusTooltip}')" onmouseleave="hideTooltip()">${statusTag}</span>
        </div>
        
        <div class="trait-row">
          ${u.traits.map(t => `<span class="card-trait-pill" onmouseenter="showTraitTooltip(event, '${t}')" onmouseleave="hideTooltip()">${t}</span>`).join('')}
        </div>

        <div class="skill-title-bar">✦ ${u.skillName}</div>
        <div class="skill-bullets">
          ${bulletsHtml}
        </div>

        <button class="toggle-desc-btn" id="${isAlly ? 'ally' : 'enemy'}_btn_${idx}" onclick="toggleFullDesc('${isAlly ? 'ally' : 'enemy'}', ${idx}, event)">▶ 完整說明</button>
        <div class="full-desc-box" id="${isAlly ? 'ally' : 'enemy'}_desc_${idx}">
          ${safeSkillDesc}
          ${safeLore ? `<div style="margin-top:4px; font-style:italic; color:#f9a8d4;">"${safeLore}"</div>` : ''}
        </div>

        <div class="bars">
          <div class="bar-wrap" onmouseenter="showTooltip(event, '❤️ 生命值 (HP)', '${hpTooltip}')" onmouseleave="hideTooltip()">
            ${hasDualBar ? `
              <div class="hp-base-half" style="width:${baseHalfWidth}%"></div>
              <div class="hp-pet-half" style="width:${petHalfWidth}%"></div>
              <div class="bar-divider"></div>
            ` : `<div class="hp-fill" style="width:${Math.round(hpPct)}%"></div>`}
            <div class="bar-text">❤️ ${Math.max(0, u.hp)} / ${u.maxHp}</div>
          </div>
          <div class="bar-wrap" onmouseenter="showTooltip(event, '💧 魔力值 (MP)', '普攻 +30 MP、受擊 +15 MP。集滿時下次行動自動施放大招！')" onmouseleave="hideTooltip()">
            <div class="mp-fill" style="width:${mpPct}%"></div>
            <div class="bar-text">💧 MP ${u.mp} / ${u.maxMp}</div>
          </div>
        </div>
      </div>

      <div>
        <div class="card-footer-stats">
          <span class="stat-hp">❤️ HP ${u.maxHp}</span>
          <span class="stat-atk">⚔️ ATK ${u.atk}</span>
          <span class="stat-spd">⚡ SPD ${u.curSpd || u.spd}</span>
          <span class="stat-mp">♦ MP ${u.maxMp}</span>
        </div>
        ${isAlly && !isBattling ? `
          <div class="move-btns">
            <button onclick="moveUnit(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>⬅️ 前移</button>
            <button onclick="moveUnit(${idx}, 1)" ${idx === roster.length - 1 ? 'disabled' : ''}>後移 ➡️</button>
          </div>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

// ================= 6. 宿敵彩蛋與 3盤2勝 3D6 骰子單挑系統 =================
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
    <h2 class="modal-title" style="color:var(--discord-yellow);">🚨 隱藏宿敵劇情：【華爾街的終局對決】</h2>
    <p class="modal-sub">當站在 1 號位的 <strong>📈 股票奧本海默</strong> 遇上現身戰場的 <strong>🛢️ Andy安迪</strong>，兩大宿敵終於正面碰頭！</p>
    <div style="background:#111319; padding:15px; border-radius:8px; margin-bottom:18px; text-align:left; font-size:0.88rem; line-height:1.6; border:1px solid var(--border-card);">
      <p>💬 <strong>股票奧本海默</strong>：「安迪！你的末日負油價理論在我的百倍槓桿面前一文不值！」</p>
      <p>💬 <strong>Andy安迪</strong>：「奧本海默！柏克末日已經降臨，今天我們就賭上性命做個了斷！」</p>
    </div>
    <div class="choices-grid">
      <div class="choice-card" style="border-color:var(--discord-red);" onclick="startDiceDuel()">
        <div>
          <h4><span>🗡️ 選擇一：【戰到死 (3盤2勝 3D6 硬核賭命單挑)】</span></h4>
          <div class="choice-desc" style="font-size:0.8rem; color:#d1d5db; line-height:1.4;">
            三盤兩勝制 3D6 鐵籠死鬥！<br>
            • <strong>若我方勝出</strong>：敵方宿敵暴斃！勝者滿血、<strong>攻擊力永久翻倍 (2x) +50 MP</strong>，過關多拿 1 個海克斯！<br>
            • <strong style="color:#f87171;">⚠️ 敗北懲罰</strong>：落敗者直接<strong>永久戰死除名（消失）</strong>！
          </div>
        </div>
        <div class="choice-stats" style="color:#f87171;">🔥 高風險高回報</div>
      </div>

      <div class="choice-card" style="border-color:var(--discord-yellow);" onclick="executeNemesisPeace()">
        <div>
          <h4><span>🤝 選擇二：【大和解 (兄弟合體)】</span></h4>
          <div class="choice-desc" style="font-size:0.8rem; color:#d1d5db; line-height:1.4;">
            「兩兄弟沒有隔夜仇！」兩人握手言和，合體進化為超規格神卡 —— <strong>【☯️ 安迪與奧本海默】</strong>！<br>
            • <strong>最強之兩人</strong>：免儀式站場、單人計 2 個華爾街空頭，<strong>普攻與大招全體 AOE 金融風暴</strong>！
          </div>
        </div>
        <div class="choice-stats" style="color:var(--discord-yellow);">🌟 永久合體變身</div>
      </div>
    </div>
  `;
}

function executeNemesisPeace() {
  battleComboLogs.push('🤝 觸發【宿敵大和解】：合體誕生神卡「☯️ 安迪與奧本海默」');
  addLog(`<span class="tag-event">☯️ 世紀大和解</span> 股票奧本海默與 Andy安迪 合體進化為<strong>【☯️ 安迪與奧本海默】</strong>！`);

  const existingAllyOpp = playerRoster.find(u => u.id === 'stock_opp');
  const existingAllyAndy = playerRoster.find(u => u.id === 'andy');
  const fusedStars = Math.max(existingAllyOpp ? existingAllyOpp.stars : 1, existingAllyAndy ? existingAllyAndy.stars : 1);
  const starMult = Math.pow(1.35, fusedStars - 1);

  enemyRoster.forEach(e => {
    if (e.id === 'andy' || e.id === 'stock_opp') e.hp = 0;
  });

  playerRoster = playerRoster.filter(u => u.id !== 'stock_opp' && u.id !== 'andy');
  const fusedUnit = {
    ...FUSED_HERO_TEMPLATE,
    traits: [...FUSED_HERO_TEMPLATE.traits],
    stars: fusedStars,
    baseHp: Math.round(FUSED_HERO_TEMPLATE.hp * starMult),
    baseAtk: Math.round(FUSED_HERO_TEMPLATE.atk * starMult),
    maxHp: Math.round(FUSED_HERO_TEMPLATE.hp * starMult),
    hp: Math.round(FUSED_HERO_TEMPLATE.hp * starMult),
    atk: Math.round(FUSED_HERO_TEMPLATE.atk * starMult),
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
    <h2 class="modal-title" style="color:var(--discord-red);">🎲 華爾街鐵籠死鬥（三盤兩勝・3D6 賭命單挑）</h2>
    <p class="modal-sub">規則：每盤雙方各擲出 <strong>3 顆 6 面骰（3～18 點）</strong>。先贏 2 盤者勝出，<strong>敗者將當場戰死並永久從隊伍除名！</strong></p>
    
    <div style="margin: 10px 0;">
      <span class="score-board">📈 股票奧本海默 【 ${duelState.oppWins}  :  ${duelState.andyWins} 】 🛢️ Andy安迪 （第 ${Math.min(3, duelState.round)} 盤）</span>
    </div>

    <div class="duel-arena">
      <div class="duel-fighter">
        <h3 style="color:#60a5fa;">📈 股票奧本海默</h3>
        <div class="dice-row">
          ${oppDice.map(d => `<div class="die-box ${duelState.rolling ? 'rolling' : ''}">${d}</div>`).join('')}
        </div>
        <div style="font-size:1rem; font-weight:bold;">點數總和：<span style="color:var(--discord-yellow);">${oppSum}</span></div>
      </div>

      <div style="font-size:1.6rem; font-weight:900; color:var(--discord-red);">VS</div>

      <div class="duel-fighter">
        <h3 style="color:#c084fc;">🛢️ Andy安迪</h3>
        <div class="dice-row">
          ${andyDice.map(d => `<div class="die-box ${duelState.rolling ? 'rolling' : ''}">${d}</div>`).join('')}
        </div>
        <div style="font-size:1rem; font-weight:bold;">點數總和：<span style="color:var(--discord-yellow);">${andySum}</span></div>
      </div>
    </div>

    <div style="background:#111319; padding:12px; border-radius:8px; margin-bottom:15px; font-weight:bold; color:#fff; border:1px solid var(--border-card);">
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
      msg += `<br><span style="color:var(--discord-yellow);">🏆 決鬥結束！【${winnerName}】以 ${duelState.oppWins}:${duelState.andyWins} 勝出！【${loserName}】遭到永久除名！</span>`;
    } else {
      duelState.round++;
    }

    renderDiceDuelUI(msg, oppRolls, andyRolls, oppSum, andySum);
  }, 600);
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
    if (e.id === loserId) e.hp = 0;
  });

  const myWinner = playerRoster.find(u => u.id === winnerId);
  const enemyWinner = enemyRoster.find(e => e.id === winnerId && e.hp > 0);

  if (myWinner) {
    myWinner.inRitual = false;
    myWinner.hp = myWinner.maxHp;
    myWinner.baseAtk = myWinner.baseAtk * 2;
    myWinner.atk = myWinner.atk * 2;
    myWinner.mp = Math.min(myWinner.maxMp, myWinner.mp + 50);
    bonusAugmentPending += 1;
    battleComboLogs.push(`🎲 【宿敵死鬥大勝】：我方 ${myWinner.name} 勝出，永久雙倍攻擊力並獲額外海克斯！`);
    addLog(`🏆 <span class="tag-buff">🟢 死鬥大勝</span> 我方 <strong>${myWinner.icon} ${myWinner.name}</strong> 贏得決鬥！滿血恢復、<span class="tag-buff">🟢 攻擊力永久翻倍 (${myWinner.atk})</span> 並鎖定額外海克斯獎勵！`);
  } else if (enemyWinner) {
    enemyWinner.inRitual = false;
    enemyWinner.hp = Math.max(1, Math.round(enemyWinner.maxHp * 0.5));
    battleComboLogs.push(`💀 【宿敵死鬥落敗】：我方宿敵永久戰死除名，敵方 ${enemyWinner.name} 半血存留！`);
    addLog(`⚠️ <span class="tag-nerf">🔴 死鬥落敗懲罰</span> 敵方 <strong>${enemyWinner.icon} ${enemyWinner.name}</strong> 贏得決鬥並保留 50% 血量（${enemyWinner.hp} HP）繼續作戰，我方須靠剩餘隊員硬打！`);
  }

  document.getElementById('nemesisModal').classList.add('hidden');
  isPausedForEvent = false;
  updateUI();
}

// ================= 7. 回合制自動戰鬥核心引擎 =================
function toggleSpeed() {
  battleSpeed = battleSpeed === 900 ? 420 : 900;
  document.getElementById('speedBtn').innerText = `⏩ 戰鬥速度: ${battleSpeed === 420 ? '2x' : '1x'}`;
}

function addLog(html, cls = '') {
  const box = document.getElementById('battleLog');
  const div = document.createElement('div');
  div.className = `log-entry ${cls}`;
  div.innerHTML = html;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
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
  updateUI();

  const syn = getActiveSynergies(playerRoster);
  addLog(`🔔 <strong>=== 第 ${currentStage} 關戰鬥開始！ ===</strong>`);

  if ((syn['S.I.S'] || 0) >= 3) {
    addLog(`💅 <span class="tag-buff">🟢 S.I.S 啟動</span> 全體 S.I.S 屬性 1.25x，並解鎖追加技【獨立自主】！`);
  }
  if ((syn['貓狗領導'] || 0) >= 2) {
    addLog(`🐾 <span class="tag-buff">🟢 貓狗領導</span> 雙血量合為單一強化血條，免疫弱化狀態！`);
  }

  if (playerAugments.some(a => a.id === 'aug_glitch')) {
    addLog(`💻 <span class="tag-nerf">🔴 Glitch 觸發</span> 敵方全體扣除 20% 生命與 15 點速度！`);
    enemyRoster.forEach(e => {
      e.hp = Math.max(1, Math.round(e.hp * 0.8));
      e.curSpd = Math.max(50, (e.curSpd || e.spd) - 15);
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
      addLog(`🔥 <span class="tag-buff">🟢 死線戰神・爆肝狀態啟動</span> 我方全體造成的最終傷害永久提升 <strong>+50%</strong>！`);
    }

    if (turnIndex >= turnOrder.length) {
      turnOrder = [...aliveAllies, ...aliveEnemies].sort((a, b) => (b.curSpd || b.spd) - (a.curSpd || a.spd));
      turnIndex = 0;
      currentRoundNumber++;
    }

    const actor = turnOrder[turnIndex];
    turnIndex++;

    if (!actor || actor.hp <= 0) return;

    if (actor.inRitual) {
      const teamAlive = (actor.isAlly ? playerRoster : enemyRoster).filter(u => u.hp > 0);
      if (teamAlive.length <= 1) {
        actor.inRitual = false;
        addLog(`🕯️ <strong>${actor.name}</strong> 因隊友全滅被迫提早現身參戰！`);
        if (checkNemesisEasterEgg(actor)) return;
      } else {
        addLog(`🔮 <strong>${actor.name}</strong> 正在場外進行柏克末日儀式 (${actor.ritualCount}/3)...`);
        return;
      }
    }

    executeUnitTurn(actor);
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

function dealDamage(attacker, target, rawDmg, isTrueDamage = false) {
  let dmg = Math.round(rawDmg);
  let isCrit = false;

  if (!isTrueDamage) {
    if (attacker.traits && attacker.traits.includes('S.I.S') && (target.sisMarks || 0) > 0) {
      dmg = Math.round(dmg * (1 + 0.05 * target.sisMarks));
    }

    if (attacker.isAlly) {
      if (playerAugments.some(a => a.id === 'aug_leverage') && playerRoster.indexOf(attacker) > 0) {
        dmg = Math.round(dmg * 1.35);
      }
      if (overdriveActive) {
        dmg = Math.round(dmg * 1.50);
      }

      const shortAug = playerAugments.some(a => a.id === 'aug_short');
      const icyBuff = playerRoster.some(u => u.id === 'icy_sis' && u.hp > 0 && !u.isWeakened);
      const critChance = (shortAug ? 0.35 : 0) + (icyBuff ? 0.20 : 0);
      if (critChance > 0 && Math.random() < critChance) {
        dmg = Math.round(dmg * 1.6);
        isCrit = true;
      }
    } else {
      if (playerAugments.some(a => a.id === 'aug_shield') && playerRoster.indexOf(target) === 0) {
        dmg = Math.round(dmg * 0.8);
      }
      if (playerAugments.some(a => a.id === 'aug_leverage') && playerRoster.indexOf(target) > 0) {
        dmg = Math.round(dmg * 1.15);
      }
    }
  }

  if (target.isAlly && bankruptAvailable && target.hp - dmg <= 0) {
    bankruptAvailable = false;
    dmg = Math.max(0, target.hp - 1);
    target.hp = 1;
    target.isWeakened = false;
    target.mp = target.maxMp;

    if (attacker && attacker.stats) attacker.stats.dmgDealt += dmg;
    if (target.stats) target.stats.dmgTaken += dmg;
    queueVisualEffect(target, 'hit', `🛡️鎖血 1 HP!`);

    battleComboLogs.push(`🛡️ ${target.name} 觸發【破產保護令】鎖血 1 HP 絕地反擊！`);
    addLog(`🛡️ <span class="tag-event">破產保護令觸發</span> <strong>${target.icon} ${target.name}</strong> 鎖定 <strong>1 HP</strong> 不死、清除弱化並立即滿魔施放絕地大招！`);

    const allies = playerRoster;
    const opponents = enemyRoster;
    const counterTarget = getTarget(opponents);
    if (counterTarget) {
      target.mp = 0;
      castSkill(target, allies, opponents, counterTarget);
    }
    return dmg;
  }

  target.hp = Math.max(0, target.hp - dmg);
  target.mp = Math.min(target.maxMp, target.mp + 15);

  if (attacker && attacker.stats) attacker.stats.dmgDealt += dmg;
  if (target.stats) target.stats.dmgTaken += dmg;

  queueVisualEffect(target, 'hit', isCrit ? `💥CRIT -${dmg}` : `-${dmg}`);
  updateDualHealthState(target);
  return dmg;
}

function recordHeal(healer, target, amount) {
  const actual = Math.min(target.maxHp - target.hp, amount);
  target.hp = Math.min(target.maxHp, target.hp + amount);
  if (healer && healer.stats && actual > 0) healer.stats.healed += actual;
  if (actual > 0) queueVisualEffect(target, 'heal', `+${actual}`);
  updateDualHealthState(target);
}

function executeUnitTurn(actor) {
  const allies = actor.isAlly ? playerRoster : enemyRoster;
  const opponents = actor.isAlly ? enemyRoster : playerRoster;
  const syn = getActiveSynergies(allies);
  const target = getTarget(opponents);
  if (!target || isPausedForEvent) return;

  queueVisualEffect(actor, 'lunge');
  const extraMp = (actor.isAlly && playerAugments.some(a => a.id === 'aug_battery')) ? 15 : 0;

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
      allies.filter(u => u.hp > 0).forEach(u => recordHeal(actor, u, 65));
      addLog(`💖 <span class="tag-heal">💚 偶像應援 全隊+65 HP</span>`);
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
    const mobiusTarget = getTarget(opponents);
    if (mobiusTarget) {
      const mDmg = dealDamage(actor, mobiusTarget, actor.atk * 0.55);
      battleComboLogs.push(`🕵️‍♂️ Loki 背後靈【Mobius】協同電擊`);
      addLog(`🕵️‍♂️ <strong>背後靈【Mobius】</strong> 電擊 <strong>${mobiusTarget.name}</strong> <span class="tag-dmg">⚔️ -${mDmg}</span>`);
    }
  }
}

function castSkill(actor, allies, opponents, mainTarget) {
  const skillBoost = (actor.isAlly && playerAugments.some(a => a.id === 'aug_oil')) ? 1.2 : 1;
  const aliveOpps = opponents.filter(u => u.hp > 0 && !u.inRitual);
  const aliveAllies = allies.filter(u => u.hp > 0);

  switch (actor.id) {
    case 'andy_opp_fused': {
      aliveOpps.forEach(e => dealDamage(actor, e, actor.atk * 2.0 * skillBoost));
      aliveAllies.forEach(a => {
        recordHeal(actor, a, Math.round(150 * skillBoost));
        a.atk = Math.round(a.atk * 1.25);
      });
      addLog(`☯️ <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>！<span class="tag-dmg">⚔️ 全體200%轟炸</span> <span class="tag-heal">💚 全隊+150 HP</span> <span class="tag-buff">🟢 全隊攻+25%</span>`);
      break;
    }
    case 'mouse_sis': {
      const otherAllies = aliveAllies.filter(a => a !== actor);
      otherAllies.forEach(a => a.mp = Math.min(a.maxMp, a.mp + 40));
      aliveAllies.forEach(a => {
        recordHeal(actor, a, Math.round(90 * skillBoost));
        a.atk = Math.round(a.atk * 1.15);
      });
      if (otherAllies.length === 0 && mainTarget) {
        const soloDmg = dealDamage(actor, mainTarget, actor.atk * 1.6 * skillBoost);
        addLog(`🍵 <strong>${actor.name}</strong> 施放【${actor.skillName}】！<span class="tag-heal">💚 +90 HP</span> <span class="tag-buff">🟢 攻+15%</span> 並單挑潑出熱抹茶 <span class="tag-dmg">⚔️ -${soloDmg}</span>！`);
      } else {
        addLog(`🍵 <strong>${actor.name}</strong> 施放【${actor.skillName}】！<span class="tag-buff">🟢 隊友+40 MP</span> <span class="tag-heal">💚 全隊+90 HP</span> <span class="tag-buff">🟢 全隊攻+15%</span>`);
      }
      break;
    }
    case 'st_sis': {
      const healMultiplier = (!actor.isWeakened ? 1.3 : 1) * skillBoost;
      const healAmt = Math.round(150 * healMultiplier);
      aliveAllies.forEach(a => recordHeal(actor, a, healAmt));
      addLog(`🐶 <strong>${actor.name}</strong> 施放【${actor.skillName}】！<span class="tag-heal">💚 全隊+${healAmt} HP</span>`);
      break;
    }
    case 'icy_sis': {
      const healAmt = Math.round(115 * skillBoost);
      aliveAllies.forEach(a => {
        recordHeal(actor, a, healAmt);
        a.atk = Math.round(a.atk * 1.20);
      });
      addLog(`🐱 <strong>${actor.name}</strong> 施放【${actor.skillName}】！<span class="tag-heal">💚 全隊+${healAmt} HP</span> <span class="tag-buff">🟢 全隊攻+20%</span>`);
      break;
    }
    case 'shijie_sis': {
      const dmg = dealDamage(actor, mainTarget, actor.atk * 2.15 * skillBoost);
      addLog(`🔫 <strong>${actor.name}</strong> 施放【${actor.skillName}】➔ ${mainTarget.name} <span class="tag-dmg">⚔️ -${dmg}</span>`);
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
    case 'dc_tesla': {
      const isCrit = Math.random() < 0.3;
      const mult = isCrit ? 3.2 : 1.8;
      let totalDmg = 0;
      aliveOpps.forEach(e => {
        totalDmg += dealDamage(actor, e, actor.atk * mult * skillBoost);
      });
      aliveAllies.forEach(a => a.mp = Math.min(a.maxMp, a.mp + 25));
      addLog(`🚗 <strong>${actor.name}</strong> 大喊「Panther Mode 彈射！」紅色 Model 3 飄移切入撞飛敵方全體！${isCrit ? '<span class="tag-crit">⚡FSD暴衝雙倍!</span>' : ''} <span class="tag-dmg">⚔️ 全體共-${totalDmg}</span> <span class="tag-buff">🟢 全隊+25 MP</span>`);
      break;
    }
    case 'stock_opp': {
      if (actor.isAlly && playerAugments.some(a => a.id === 'aug_baemon')) {
        const healAmt = Math.round(145 * skillBoost);
        aliveAllies.forEach(a => {
          recordHeal(actor, a, healAmt);
          a.curSpd = (a.curSpd || a.spd) + 18;
        });
        addLog(`👾 <strong>${actor.name}</strong> 發動【寶怪應援・SHEESH打Call】！<span class="tag-heal">💚 全隊+${healAmt} HP</span> <span class="tag-buff">🟢 全隊攻速+18</span>`);
      } else {
        if (Math.random() < 0.55) {
          aliveAllies.forEach(a => a.atk = Math.round(a.atk * 1.25));
          aliveOpps.forEach(e => dealDamage(actor, e, actor.atk * 1.15 * skillBoost));
          addLog(`📈 <strong>${actor.name}</strong> 開出【牛市暴漲】！<span class="tag-buff">🟢 全隊攻+25%</span> <span class="tag-dmg">⚔️ 全體115%轟炸</span>`);
        } else {
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
      });
      mainTarget.atk = Math.max(20, Math.round(mainTarget.atk * 0.85));
      addLog(`🎤 <strong>${actor.name}</strong> 施放【${actor.skillName}】！<span class="tag-heal">💚 全隊+130 HP</span> <span class="tag-buff">🟢 全隊攻+15%</span> <span class="tag-nerf">🔴 ${mainTarget.name} 攻-15%</span>`);
      break;
    }
    case 'loki': {
      const dmg = dealDamage(actor, mainTarget, actor.atk * 1.7 * skillBoost);
      aliveAllies.forEach(a => { if (a !== actor) a.mp = Math.min(a.maxMp, a.mp + 30); });
      addLog(`🦊 <strong>${actor.name}</strong> 施放【時間線收割】➔ ${mainTarget.name} <span class="tag-dmg">⚔️ -${dmg}</span> <span class="tag-buff">🟢 隊友+30 MP</span>`);
      break;
    }
    case 'andy': {
      aliveOpps.forEach(e => dealDamage(actor, e, actor.atk * 1.85 * skillBoost));
      addLog(`🛢️ <strong>${actor.name}</strong> 引爆【負油價末日震波】<span class="tag-dmg">⚔️ 全體185%轟炸</span>！`);
      break;
    }
    case 'aming': {
      aliveOpps.slice(0, 2).forEach(t => {
        const dmg = dealDamage(actor, t, actor.atk * 1.45 * skillBoost);
        t.mp = Math.max(0, t.mp - 40);
      });
      addLog(`💻 <strong>${actor.name}</strong> 執行【rm -rf /*】！<span class="tag-dmg">⚔️ 雙目標145%傷害</span> <span class="tag-nerf">🔴 扣魔-40 MP</span>`);
      break;
    }
    case 'dashen': {
      const hasPartner = aliveAllies.some(a => a.id === 'loki' || a.id === 'hugo');
      const mult = hasPartner ? 1.7 : 1.25;
      aliveOpps.forEach(e => dealDamage(actor, e, actor.atk * mult * skillBoost));
      addLog(`👑 <strong>${actor.name}</strong> 降下【神諭裁決】<span class="tag-dmg">⚔️ 全體${Math.round(mult*100)}%轟炸</span>！`);
      break;
    }
    case 'hugo': {
      const weakest = [...aliveOpps].sort((a, b) => a.hp - b.hp)[0] || mainTarget;
      const dmg = dealDamage(actor, weakest, actor.atk * 2.1 * skillBoost);
      const hasPartner = aliveAllies.some(a => a.id === 'loki' || a.id === 'dashen');
      if (hasPartner) {
        aliveAllies.forEach(a => recordHeal(actor, a, 90));
      }
      addLog(`🌌 <strong>${actor.name}</strong> 施放【次元共鳴斬】➔ ${weakest.name} <span class="tag-dmg">⚔️ -${dmg}</span> ${hasPartner ? '<span class="tag-heal">💚 全隊+90 HP</span>' : ''}`);
      break;
    }
    case 'dv': {
      const missingHpRatio = 1 + ((actor.maxHp - actor.hp) / actor.maxHp);
      let total = 0;
      for (let i = 0; i < 3; i++) {
        const t = aliveOpps[Math.floor(Math.random() * aliveOpps.length)] || mainTarget;
        total += dealDamage(actor, t, actor.atk * 0.8 * missingHpRatio * skillBoost);
      }
      addLog(`💢 <strong>${actor.name}</strong> 躁狂 3 連擊 <span class="tag-dmg">⚔️ 共-${total}</span>！`);
      break;
    }
    case 'dvp': {
      recordHeal(actor, actor, Math.round(220 * skillBoost));
      const dmg = dealDamage(actor, mainTarget, actor.atk * 1.5 * skillBoost);
      addLog(`🛡️ <strong>${actor.name}</strong> 施放【共同富裕】！<span class="tag-heal">💚 自癒+220 HP</span> <span class="tag-dmg">⚔️ 反震-${dmg}</span>`);
      break;
    }
    case 'ansir': {
      recordHeal(actor, actor, 180);
      actor.curSpd = (actor.curSpd || actor.spd) + 15;
      const dmg = dealDamage(actor, mainTarget, actor.atk * 1.5 * skillBoost);
      addLog(`⚡ <strong>${actor.name}</strong> 施放【${actor.skillName}】！<span class="tag-heal">💚 +180 HP</span> <span class="tag-buff">🟢 速度+15</span> <span class="tag-dmg">⚔️ -${dmg}</span>`);
      break;
    }
    case 'lg': {
      const dmg = dealDamage(actor, mainTarget, actor.atk * 1.65 * skillBoost);
      const lowestAlly = [...aliveAllies].sort((a, b) => a.hp - b.hp)[0];
      if (lowestAlly) recordHeal(actor, lowestAlly, Math.round(180 * skillBoost));
      addLog(`✝️ <strong>${actor.name}</strong> 審判 ${mainTarget.name} <span class="tag-dmg">⚔️ -${dmg}</span> <span class="tag-heal">💚 治療${lowestAlly ? lowestAlly.name : ''}+180 HP</span>`);
      break;
    }
  }
}

function checkAndyRitual(allies, opponents) {
  const andy = allies.find(u => u.id === 'andy' && u.hp > 0 && u.inRitual);
  if (!andy) return;
  andy.ritualCount += 1;
  addLog(`🕯️ <strong>${andy.name}</strong> 完成第 <strong>${andy.ritualCount} / 3</strong> 個柏克末日儀式！`);

  if (andy.ritualCount >= 3) {
    andy.inRitual = false;
    battleComboLogs.push(`☄️ Andy安迪 完成 3 儀式攜帶【負油價隕石】降臨`);
    addLog(`☄️ <span class="tag-event">末日降臨</span> <strong>Andy安迪</strong> 攜帶負油價隕石降臨戰場 <span class="tag-dmg">⚔️ 全體220%轟炸</span>！`);
    opponents.filter(u => u.hp > 0 && !u.inRitual).forEach(e => {
      dealDamage(andy, e, andy.atk * 2.2);
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

// ================= 8. 賽後戰報數據統計面板 =================
function handleBattleEnd(isWin) {
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

  content.innerHTML = `
    <h2 class="modal-title" style="color:${isWin ? 'var(--discord-green)' : 'var(--discord-red)'};">
      ${isWin ? `🏆 第 ${currentStage} 關戰鬥勝利！賽後戰報` : `💀 第 ${currentStage} 關戰鬥失敗...賽後檢討`}
    </h2>
    <p class="modal-sub">MVP 最佳表現：<strong>${mvpUnit ? `${mvpUnit.icon} ${mvpUnit.name} (輸出 ${mvpUnit.stats?.dmgDealt || 0} 傷害)` : '無'}</strong></p>

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

    <div style="background:#111319; padding:12px; border-radius:8px; text-align:left; margin:12px 0; font-size:0.84rem; border:1px solid var(--border-card);">
      <strong style="color:var(--discord-yellow);">✨ 本場觸發的特殊聯動與機制亮點：</strong>
      <div style="margin-top:6px; color:#d1d5db;">
        ${uniqueCombos.length > 0 ? uniqueCombos.map(c => `<div>• ${c}</div>`).join('') : '本場無觸發特殊合體或額外追擊聯動。'}
      </div>
    </div>

    <button class="btn btn-primary" style="width:240px;" onclick="closeReportAndProceed(${isWin})">
      ${isWin ? (currentStage >= maxStage ? '🎉 慶祝全破通關！' : '🎁 領取過關獎勵 (下一關)') : '🔄 返回調整站位重試'}
    </button>
  `;
}

function closeReportAndProceed(isWin) {
  document.getElementById('reportModal').classList.add('hidden');
  if (playerRoster.length === 0 && !isWin) {
    alert('💀 你的唯一隊員已在華爾街死鬥中戰死除名！即將重新開局。');
    initGame();
    return;
  }

  prepareUnitsForStage();
  updateUI();

  if (isWin) {
    if (currentStage >= maxStage) {
      addLog(`🏆 <strong>恭喜通關全部 5 關！你的 DC BON 全明星小隊稱霸了整個 Discord！</strong>`);
    } else {
      currentStage++;
      updateUI();
      showHeroDraft(
        `🎉 通過第 ${currentStage - 1} 關！獎勵 1：招募或升星英雄`,
        `選完英雄後將進入海克斯增幅 3 選 1 ${bonusAugmentPending > 0 ? '(含宿敵死鬥額外 +1 次增幅！)' : ''}`
      );
    }
  } else {
    addLog(`💡 提示：你可以將高血量角色移至 1 號位前排承受傷害，再點擊開始戰鬥重試！`);
  }
}

// ================= 9. 內建「全英雄 & 羈絆圖鑑」系統 =================
function openCodex() {
  document.getElementById('codexModal').classList.remove('hidden');
  renderCodexTab('heroes');
}

function closeCodex() {
  document.getElementById('codexModal').classList.add('hidden');
}

function renderCodexTab(tab) {
  ['Heroes', 'Traits', 'Augments'].forEach(t => {
    document.getElementById(`tab${t}`).classList.toggle('active', t.toLowerCase() === tab);
  });

  const body = document.getElementById('codexBody');
  if (tab === 'heroes') {
    const allHeroes = [FUSED_HERO_TEMPLATE, ...HERO_POOL];
    body.innerHTML = `<div class="choices-grid">` + allHeroes.map((h, idx) => `
      <div class="choice-card" style="cursor:default; ${h.id === 'andy_opp_fused' ? 'border-color:var(--discord-yellow);' : ''}">
        <div>
          <h4><span>${h.icon} ${h.name}</span> ${h.id === 'andy_opp_fused' ? '<span class="upgrade-tag">隱藏合體卡</span>' : ''}</h4>
          <div class="trait-row">${h.traits.map(t => `<span class="card-trait-pill">${t}</span>`).join('')}</div>
          <div class="skill-title-bar">✦ ${h.skillName}</div>
          <div class="skill-bullets">
            ${renderSkillBulletsHtml(h.skillBullets)}
          </div>
          <button class="toggle-desc-btn" id="codex_btn_${idx}" onclick="toggleFullDesc('codex', ${idx}, event)">▶ 完整說明</button>
          <div class="full-desc-box" id="codex_desc_${idx}">
            ${h.skillDesc}
            ${h.lore ? `<div style="margin-top:4px; font-style:italic; color:#f9a8d4;">"${h.lore}"</div>` : ''}
          </div>
        </div>
        <div class="card-footer-stats">
          <span class="stat-hp">❤️ HP ${h.hp}</span>
          <span class="stat-atk">⚔️ ATK ${h.atk}</span>
          <span class="stat-spd">⚡ SPD ${h.spd}</span>
          <span class="stat-mp">♦ MP ${h.maxMp}</span>
        </div>
      </div>
    `).join('') + `</div>`;
  } else if (tab === 'traits') {
    body.innerHTML = `<div class="choices-grid">` + Object.entries(TRAIT_INFO).map(([name, info]) => `
      <div class="choice-card" style="cursor:default;">
        <div>
          <h4><span>🔗 ${name}</span> <span class="trait-pill">${info.req}</span></h4>
          <div class="choice-desc" style="font-size:0.82rem; color:#d1d5db; line-height:1.4;">${info.desc}</div>
        </div>
        <div class="choice-stats" style="color:#f9a8d4; font-style:italic;">${info.lore}</div>
      </div>
    `).join('') + `</div>`;
  } else if (tab === 'augments') {
    body.innerHTML = `<div class="choices-grid">` + AUGMENT_POOL.map(a => `
      <div class="choice-card" style="cursor:default;">
        <div>
          <h4><span>${a.name}</span></h4>
          <div class="choice-desc" style="font-size:0.82rem; color:#d1d5db; line-height:1.4;">${a.desc}</div>
        </div>
        <div class="choice-stats">${a.reqHero ? '🌟 角色專屬轉職增幅' : '通用增幅 (不重複抽取)'}</div>
      </div>
    `).join('') + `</div>`;
  }
}

window.onload = initGame;
