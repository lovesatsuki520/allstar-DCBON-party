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
let bonusAugmentPending = 0;
let battleComboLogs = [];

// 懸浮視窗控制
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

// ================= 2. 初始化與流程控制 =================
function initGame() {
  currentStage = 1;
  playerRoster = [];
  playerAugments = [];
  bonusAugmentPending = 0;
  isBattling = false;
  isPausedForEvent = false;
  clearInterval(battleInterval);
  document.getElementById('battleLog').innerHTML = '<div class="log-entry">🎮 歡迎來到 **DC BON 全明星自動戰棋 v3.0**！將滑鼠移至技能、羈絆或雙血條上可查看詳細說明。</div>';
  generateEnemyTeam(currentStage);
  updateUI();
  showHeroDraft('選擇你的初始英雄 (第 1 關)', '挑選 1 位 Discord 朋友作為開局隊長');
}

function resetGame() {
  if (confirm('確定要重新開始新一局遊戲嗎？')) initGame();
}

function togglePeekBoard() {
  const content = document.getElementById('draftModalContent');
  const overlay = document.getElementById('modalOverlay');
  if (content.classList.contains('hidden')) {
    content.classList.remove('hidden');
    overlay.style.background = 'rgba(0,0,0,0.84)';
  } else {
    content.classList.add('hidden');
    overlay.style.background = 'rgba(0,0,0,0.15)';
  }
}

// 動態套用【寶怪回歸】對股票奧本海默的轉職
function syncBaemonTransformation() {
  const hasBaemon = playerAugments.some(a => a.id === 'aug_baemon');
  playerRoster.forEach(u => {
    if (u.id === 'stock_opp') {
      if (hasBaemon) {
        u.traits = ['狂熱信仰'];
        u.icon = '👾';
        u.skillName = '寶怪應援・SHEESH打Call';
        u.skillDesc = '【寶怪回歸轉職】捨棄華爾街空頭，化身為狂熱寶怪粉絲！揮舞手燈為我方全體回復 145 點生命值，並使全體隊友攻速 (SPD) 提升 +18！';
      } else {
        u.traits = ['華爾街空頭'];
        u.icon = '📈';
        u.skillName = '百倍槓桿爆倉';
        u.skillDesc = '投下金融核彈！隨機觸發【牛市暴漲】(全隊攻擊+25% 並轟炸敵方全體) 或【割韭菜】(吸取敵方最高血量者 165% 傷害轉為自身生命)。';
      }
    }
  });
}

// ================= 3. 選卡與海克斯增幅 (含現有陣容預覽 & 不重複增幅) =================
function getRandomItems(arr, count) {
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, count);
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
  overlay.style.background = 'rgba(0,0,0,0.84)';
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalSub').innerText = subtitle;
  const grid = document.getElementById('choicesGrid');
  grid.innerHTML = '';

  const choices = getRandomItems(HERO_POOL, 3);
  choices.forEach(hero => {
    const existing = playerRoster.find(h => h.id === hero.id);
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.innerHTML = `
      <div>
        <h4>
          <span>${hero.icon} ${hero.name}</span>
          ${existing ? `<span class="upgrade-tag">可升星 ★${existing.stars + 1}</span>` : ''}
        </h4>
        <div class="choice-traits">
          ${hero.traits.map(t => `<span class="trait-pill" onmouseenter="showTraitTooltip(event, '${t}')" onmouseleave="hideTooltip()">${t}</span>`).join('')}
        </div>
        <div class="choice-desc">
          <strong>【${hero.skillName}】</strong><br>${hero.skillDesc}
          ${hero.easterEggHint ? `<div class="easter-hint">${hero.easterEggHint}</div>` : ''}
        </div>
      </div>
      <div class="choice-stats">❤️ HP: ${hero.hp} | ⚔️ ATK: ${hero.atk} | ⚡ SPD: ${hero.spd}</div>
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
    addLog(`⭐ <strong>${existing.icon} ${existing.name}</strong> 升上了 <strong>★${existing.stars} 星</strong>！`, 'log-skill');
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
    addLog(`🎉 招募了新隊員：<strong>${heroTemplate.icon} ${heroTemplate.name}</strong>！`);
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
  skipCard.className = 'choice-card';
  skipCard.innerHTML = `<h4>🚫 不替換，維持現有陣容</h4><div class="choice-desc">直接進入海克斯增幅選擇階段</div>`;
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
  overlay.style.background = 'rgba(0,0,0,0.84)';
  document.getElementById('modalTitle').innerText = isBonus ? `🏆 【宿敵死鬥獎勵】額外海克斯增幅 3 選 1！` : `⚡ 海克斯增幅 3 選 1 (第 ${currentStage} 關前強化)`;
  document.getElementById('modalSub').innerText = `已選過的增幅不會重複出現`;
  const grid = document.getElementById('choicesGrid');
  grid.innerHTML = '';

  // 嚴格過濾：已選過的增幅絕不重複出現；【寶怪回歸】需有股票奧本海默
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
        <div class="choice-desc">${aug.desc}</div>
      </div>
      <div class="choice-stats">${aug.reqHero ? '🌟 角色專屬轉職增幅' : '永久全隊生效 (不重複)'}</div>
    `;
    card.onclick = () => {
      playerAugments.push(aug);
      syncBaemonTransformation();
      addLog(`⚡ 獲得海克斯增幅：<strong>${aug.name}</strong>！`, 'log-synergy');
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

// ================= 4. 鏡像對手生成 (含 35% 宿命引力) & 戰前數值計算 =================
function generateEnemyTeam(stage) {
  const enemyCount = Math.min(stage, 4);
  let templates = getRandomItems(HERO_POOL, enemyCount);

  // 【宿命引力 35%】：若我方有股票奧本海默或安迪，且未合體，敵方有 35% 機率刷出另一位宿敵
  const allyHasOpp = playerRoster.some(u => u.id === 'stock_opp');
  const allyHasAndy = playerRoster.some(u => u.id === 'andy');
  if ((allyHasOpp || allyHasAndy) && Math.random() < 0.35) {
    const nemesisId = allyHasOpp ? 'andy' : 'stock_opp';
    if (!templates.some(t => t.id === nemesisId)) {
      const nemesisTemplate = HERO_POOL.find(h => h.id === nemesisId);
      templates[0] = nemesisTemplate; // 放入敵方陣容
      addLog(`⚡ <strong>【宿命引力】</strong> 空氣中瀰漫著火藥味！你在對面陣營發現了宿敵 <strong>${nemesisTemplate.icon} ${nemesisTemplate.name}</strong> 的身影...（提示：將宿敵放上 1 號位並等待安迪完成儀式！）`, 'log-synergy');
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
      inRitual: t.id === 'andy',
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

    // 【S.I.S】v3.0 平衡調整：3人時數值 1.25 倍，移除自動回血
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

    u.maxHp = maxHp;
    u.hp = maxHp;
    u.atk = atk;
    u.curSpd = spd;
    u.mp = Math.min(u.maxMp, startMp);
    u.isAlly = true;
    u.inRitual = (u.id === 'andy');
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
    addLog(`⚠️ <strong>${unit.name}</strong> 跌破 50% 血量！前半【${unit.dualHpPet}】青色血條耗盡，進入<strong>弱化狀態 (攻-20%、速-20)</strong>！`, 'log-dmg');
  } else if (ratio >= 0.5 && unit.isWeakened) {
    unit.isWeakened = false;
    unit.atk = Math.round(unit.atk * 1.25);
    unit.curSpd += 20;
    addLog(`✨ <strong>${unit.name}</strong> 生命恢復至 50% 以上！【${unit.dualHpPet}】青色血條重啟，恢復<strong>強化狀態</strong>！`, 'log-heal');
  }
}

// ================= 5. 介面渲染與視覺特效 (含精準 50/50 雙血條) =================
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

function triggerVisualEffect(unit, type, text = '') {
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
}

function renderTeamGrid(containerId, roster, isAlly) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  roster.forEach((u, idx) => {
    const hpPct = Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100));
    const mpPct = Math.max(0, Math.min(100, Math.round((u.mp / u.maxMp) * 100)));
    const hasDualBar = u.dualHpPet && !u.petSingleBar;

    // 精準掛勾前 50% (寵物青色) 與後 50% (本人綠色)
    const baseHalfWidth = Math.min(50, hpPct);
    const petHalfWidth = Math.max(0, hpPct - 50);

    let cardCls = `unit-card ${idx === 0 ? 'frontline' : ''} ${u.hp <= 0 ? 'dead' : ''} ${u.inRitual ? 'ritual-mode' : ''}`;
    if (u.dualHpPet) cardCls += u.isWeakened ? ' pet-weakened' : ' pet-buffed';

    const card = document.createElement('div');
    card.className = cardCls;
    card.id = `${isAlly ? 'ally' : 'enemy'}_card_${idx}`;

    let statusTag = idx === 0 ? '🛡️ 1號前排' : `${idx + 1}號後排`;
    let statusTooltip = idx === 0 ? '位於 1 號位，優先承受單體攻擊，也是觸發【宿敵彩蛋】的叫陣位！' : '位於後排受到前排保護。';

    if (u.inRitual) {
      statusTag = `🔮 儀式 (${u.ritualCount}/3)`;
      statusTooltip = '正在場外進行末日儀式，友軍每放 1 次大招 +1 儀式，滿 3 次攜帶隕石降臨！';
    } else if (u.dualHpPet) {
      if (u.petSingleBar) {
        statusTag = `🐾 ${u.dualHpPet}合一 (免弱化)`;
        statusTooltip = `【貓狗領導】生效！雙血條合一，全程維持 ${u.petBuffDesc}，不會進入弱化狀態。`;
      } else if (u.isWeakened) {
        statusTag = `💔 ${u.dualHpPet}受損 (弱化中)`;
        statusTooltip = `${u.petWeakDesc}。可透過技能回血至 50% 以上重新啟動強化！`;
      } else {
        statusTag = `🐾 ${u.dualHpPet}強化中`;
        statusTooltip = `${u.petBuffDesc}。當跌破 50% 血量時將進入弱化狀態：${u.petWeakDesc}`;
      }
    }

    if (u.sisMarks > 0) statusTag += ` | 💅印記x${u.sisMarks}`;

    const safeSkillDesc = u.skillDesc.replace(/'/g, "\\'");
    const safeLore = (u.lore || '').replace(/'/g, "\\'");
    const hpTooltip = hasDualBar
      ? `【雙血量機制】<br>• 右半青色 (50%~100%)：${u.petBuffDesc}<br>• 左半綠色 (0%~50%)：${u.petWeakDesc}`
      : '角色當前生命值與上限。';

    card.innerHTML = `
      <div>
        <div class="unit-top">
          <div class="unit-name">
            <span>${u.icon} ${u.name}</span>
            <span class="stars">${'★'.repeat(u.stars)}</span>
          </div>
          <span class="pos-tag" onmouseenter="showTooltip(event, '📌 狀態與位置說明', '${statusTooltip}')" onmouseleave="hideTooltip()">${statusTag}</span>
        </div>
        <div class="bars">
          <div class="bar-wrap" onmouseenter="showTooltip(event, '❤️ 生命值 (HP)', '${hpTooltip}')" onmouseleave="hideTooltip()">
            ${hasDualBar ? `
              <div class="hp-base-half" style="width:${baseHalfWidth}%"></div>
              <div class="hp-pet-half" style="width:${petHalfWidth}%"></div>
              <div class="bar-divider"></div>
            ` : `<div class="hp-fill" style="width:${Math.round(hpPct)}%"></div>`}
            <div class="bar-text">❤️ ${Math.max(0, u.hp)} / ${u.maxHp} ${hasDualBar ? (u.isWeakened ? '(本人血量-弱化)' : '(寵物護盾-強化)') : ''}</div>
          </div>
          <div class="bar-wrap" onmouseenter="showTooltip(event, '💧 魔力值 (MP)', '普攻 +30 MP、受擊 +15 MP。集滿時下次行動自動施放大招！')" onmouseleave="hideTooltip()">
            <div class="mp-fill" style="width:${mpPct}%"></div>
            <div class="bar-text">💧 MP ${u.mp} / ${u.maxMp}</div>
          </div>
        </div>
        <div class="unit-stats">
          <span>⚔️攻:${u.atk} ⚡速:${u.curSpd || u.spd}</span>
          <span>
            ${u.traits.map(t => `<span class="mini-trait" onmouseenter="showTraitTooltip(event, '${t}')" onmouseleave="hideTooltip()">${t}</span>`).join(' ')}
          </span>
        </div>
        <div class="unit-skill-tag" onmouseenter="showTooltip(event, '💥 技能：【${u.skillName}】', '${safeSkillDesc}', '${safeLore}')" onmouseleave="hideTooltip()">
          💡 ${u.skillName} <span style="font-size:0.66rem; color:var(--discord-yellow); float:right;">(懸浮看詳情)</span>
        </div>
        ${u.easterEggHint ? `<div class="easter-hint">${u.easterEggHint}</div>` : ''}
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

// ================= 6. 宿敵彩蛋與 3盤2勝 3D6 骰子單挑系統 =================
function checkNemesisEasterEgg(descendingAndy) {
  if (nemesisTriggeredThisBattle) return false;

  const allyFront = playerRoster[0];
  if (!allyFront || allyFront.hp <= 0) return false;

  // 條件 A：我方 1 號位是股票奧本海默，且場上(我方或敵方)的 Andy安迪 完成儀式降臨
  const condA = (allyFront.id === 'stock_opp' && descendingAndy.id === 'andy');
  // 條件 B：我方 1 號位是剛完成儀式降臨的 Andy安迪，且場上(我方或敵方)有存活的股票奧本海默
  const oppUnit = [...playerRoster, ...enemyRoster].find(u => u.id === 'stock_opp' && u.hp > 0);
  const condB = (allyFront.id === 'andy' && descendingAndy === allyFront && oppUnit);

  if (!condA && !condB) return false;

  nemesisTriggeredThisBattle = true;
  isPausedForEvent = true;

  const myHero = condA ? allyFront : descendingAndy;
  const rivalHero = condA ? descendingAndy : oppUnit;
  const isSameTeam = (myHero.isAlly === rivalHero.isAlly);

  showNemesisChoiceModal(myHero, rivalHero, isSameTeam);
  return true;
}

function showNemesisChoiceModal(myHero, rivalHero, isSameTeam) {
  const modal = document.getElementById('nemesisModal');
  const content = document.getElementById('nemesisContent');
  modal.classList.remove('hidden');

  content.innerHTML = `
    <h2 class="modal-title" style="color:var(--discord-yellow);">🚨 隱藏宿敵劇情：【華爾街的終局對決】</h2>
    <p class="modal-sub">當站在 1 號位的 <strong>📈 股票奧本海默</strong> 遇上攜帶負油價隕石降臨的 <strong>🛢️ Andy安迪</strong>，兩大宿敵終於正面碰頭！</p>
    <div style="background:#1e1f22; padding:15px; border-radius:8px; margin-bottom:18px; text-align:left; font-size:0.88rem; line-height:1.6;">
      <p>💬 <strong>股票奧本海默</strong>：「安迪！你的末日負油價理論在我的百倍槓桿面前一文不值！」</p>
      <p>💬 <strong>Andy安迪</strong>：「奧本海默！柏克末日已經降臨，今天我們就用華爾街的方式做個了斷！」</p>
    </div>
    <div class="choices-grid">
      <div class="choice-card" style="border-color:var(--discord-red);" onclick="startDiceDuel()">
        <div>
          <h4><span>🗡️ 選擇一：【戰到死 (3盤2勝擲骰單挑)】</span></h4>
          <div class="choice-desc">
            兩人立刻在場中央展開<strong>「三盤兩勝制・3顆6面骰(3D6)鐵籠單挑」</strong>！<br><br>
            • <strong>勝者</strong>：留在我方陣營、滿血恢復、<strong>攻擊力永久翻倍 (2x) 且 +50 MP</strong>！<br>
            • <strong>敗者</strong>：當場倒地退場！<br>
            • <strong>額外大獎</strong>：本關獲勝後可<strong>額外多拿 1 個海克斯增幅</strong>！
          </div>
        </div>
        <div class="choice-stats" style="color:#f87171;">🔥 進入 3D6 骰子決鬥演出</div>
      </div>

      <div class="choice-card" style="border-color:var(--discord-yellow);" onclick="executeNemesisPeace()">
        <div>
          <h4><span>🤝 選擇二：【大和解 (兄弟合體)】</span></h4>
          <div class="choice-desc">
            「兩兄弟沒有隔夜仇！」兩人當場握手言和，直接合體進化為超規格神卡 —— <strong>【☯️ 安迪與奧本海默】</strong>！<br><br>
            • <strong>專屬羈絆【最強之兩人】</strong>：免儀式站場、單人計 2 個華爾街空頭，且<strong>普攻與大招全部變成全體 AOE 金融風暴</strong>！
          </div>
        </div>
        <div class="choice-stats" style="color:var(--discord-yellow);">🌟 永久合體變身為隱藏神卡</div>
      </div>
    </div>
  `;
}

// 執行【大和解】：合體為【安迪與奧本海默】
function executeNemesisPeace() {
  battleComboLogs.push('🤝 觸發【宿敵大和解】：合體誕生神卡「☯️ 安迪與奧本海默」');
  addLog(`☯️ <strong>【世紀大和解】</strong> 股票奧本海默與 Andy安迪 一笑泯恩仇！合體進化為<strong>【☯️ 安迪與奧本海默】</strong>！`, 'log-skill');

  // 計算合體星級 (取最高星級)
  const existingAllyOpp = playerRoster.find(u => u.id === 'stock_opp');
  const existingAllyAndy = playerRoster.find(u => u.id === 'andy');
  const fusedStars = Math.max(existingAllyOpp ? existingAllyOpp.stars : 1, existingAllyAndy ? existingAllyAndy.stars : 1);
  const starMult = Math.pow(1.35, fusedStars - 1);

  // 若敵方有安迪或奧本海默參與此次宿敵事件，從敵方移除或擊倒
  enemyRoster.forEach(e => {
    if (e.id === 'andy' || e.id === 'stock_opp') e.hp = 0;
  });

  // 移除我方原本的第二人（若同隊有兩人），並將 1 號位替換為合體神卡
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

// 執行【戰到死】：3盤2勝 3D6 骰子單挑介面與動畫
let duelState = { round: 1, oppWins: 0, andyWins: 0, rolling: false };

function startDiceDuel() {
  duelState = { round: 1, oppWins: 0, andyWins: 0, rolling: false };
  renderDiceDuelUI('準備開始第 1 盤擲骰對決！（點擊下方按鈕擲出 3 顆 6 面骰）');
}

function renderDiceDuelUI(statusMsg, oppDice = ['🎲','🎲','🎲'], andyDice = ['🎲','🎲','🎲'], oppSum = '-', andySum = '-') {
  const content = document.getElementById('nemesisContent');
  const isFinished = duelState.oppWins >= 2 || duelState.andyWins >= 2;

  content.innerHTML = `
    <h2 class="modal-title" style="color:var(--discord-red);">🎲 華爾街鐵籠死鬥（三盤兩勝・3D6 擲骰單挑）</h2>
    <p class="modal-sub">規則說明：每盤雙方各擲出 <strong>3 顆 6 面骰（點數總和 3～18 點）</strong>，點數高者拿下一盤（平手重擲）。先贏得 2 盤者獲勝留在我方並獲得雙倍攻擊力，敗者當場倒地！</p>
    
    <div style="margin: 10px 0;">
      <span class="score-board">📈 奧本海默 【 ${duelState.oppWins}  :  ${duelState.andyWins} 】 🛢️ Andy安迪 （第 ${Math.min(3, duelState.round)} 盤）</span>
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

    <div style="background:#1e1f22; padding:12px; border-radius:8px; margin-bottom:15px; font-weight:bold; color:#fff;">
      ${statusMsg}
    </div>

    ${!isFinished ? `
      <button class="btn btn-primary" style="width:260px; font-size:1.05rem;" onclick="rollDuelRound()" ${duelState.rolling ? 'disabled' : ''}>
        🎲 擲出第 ${duelState.round} 盤骰子 (3D6)
      </button>
    ` : `
      <button class="btn btn-secondary" style="width:260px; font-size:1.05rem;" onclick="finishDiceDuel()">
        ⚔️ 領取強化並返回戰場！
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

    // 避免平手拖延，若同分則微調最後一顆
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
      msg += `<br><span style="color:var(--discord-yellow);">🏆 決鬥結束！【${winnerName}】以 ${duelState.oppWins}:${duelState.andyWins} 贏得死鬥，留在我方獲得雙倍攻擊力，並鎖定過關額外海克斯獎勵！</span>`;
    } else {
      duelState.round++;
    }

    renderDiceDuelUI(msg, oppRolls, andyRolls, oppSum, andySum);
  }, 650);
}

function finishDiceDuel() {
  const oppWon = duelState.oppWins >= 2;
  const winnerId = oppWon ? 'stock_opp' : 'andy';
  const loserId = oppWon ? 'andy' : 'stock_opp';

  bonusAugmentPending += 1;
  battleComboLogs.push(`🎲 觸發【宿敵 3D6 死鬥】：${oppWon ? '股票奧本海默' : 'Andy安迪'} 勝出 (${duelState.oppWins}:${duelState.andyWins}) 獲得雙倍狂暴與額外海克斯`);

  // 敗者全部當場倒地 (無論在敵方或我方)
  [...playerRoster, ...enemyRoster].forEach(u => {
    if (u.id === loserId) u.hp = 0;
  });

  // 確保勝者留在我方陣營並獲得雙倍強化
  let myWinner = playerRoster.find(u => u.id === winnerId);
  if (!myWinner) {
    // 若勝者原本在敵方，直接折服加入我方 1 號位取代倒地的敗者
    const template = HERO_POOL.find(h => h.id === winnerId);
    myWinner = {
      ...template,
      traits: [...template.traits],
      stars: 1,
      baseHp: template.hp, baseAtk: template.atk,
      maxHp: template.hp, hp: template.hp,
      atk: template.atk, spd: template.spd, curSpd: template.spd,
      mp: 0, maxMp: template.maxMp,
      isAlly: true, inRitual: false, sisMarks: 0,
      stats: { dmgDealt: 0, dmgTaken: 0, healed: 0 }
    };
    const loserIdx = playerRoster.findIndex(u => u.id === loserId);
    if (loserIdx !== -1) playerRoster[loserIdx] = myWinner;
    else playerRoster.unshift(myWinner);
    // 同時將敵方該勝者單位移除避免分身
    enemyRoster.forEach(e => { if (e.id === winnerId) e.hp = 0; });
  }

  myWinner.inRitual = false;
  myWinner.hp = myWinner.maxHp;
  myWinner.atk = myWinner.atk * 2;
  myWinner.mp = Math.min(myWinner.maxMp, myWinner.mp + 50);

  addLog(`🎲 <strong>【死鬥裁決】${myWinner.icon} ${myWinner.name}</strong> 在 3D6 骰子決鬥中勝出！敗者當場倒地，勝者滿血狂暴化（<strong>攻擊力翻倍至 ${myWinner.atk}</strong>）並獲得額外海克斯增幅獎勵！`, 'log-skill');

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
  document.getElementById('startBattleBtn').disabled = true;
  prepareUnitsForStage();
  updateUI();

  const syn = getActiveSynergies(playerRoster);
  addLog(`🔔 <strong>=== 第 ${currentStage} 關戰鬥開始！ ===</strong>`);

  if ((syn['S.I.S'] || 0) >= 3) {
    addLog(`💅 <strong>【S.I.S 羈絆啟動】</strong> 全體 S.I.S 屬性 1.25x，並解鎖追加技【獨立自主】！`, 'log-sis');
  }
  if ((syn['貓狗領導'] || 0) >= 2) {
    addLog(`🐾 <strong>【貓狗領導啟動】</strong> 雙血量合為單一強化血條，免疫弱化狀態！`, 'log-synergy');
  }

  if (playerAugments.some(a => a.id === 'aug_glitch')) {
    addLog(`💻 <strong>【Mobius & Ultron Glitch】</strong> 觸發！敵方全體系統崩潰扣除 20% 生命與速度！`, 'log-synergy');
    enemyRoster.forEach(e => {
      e.hp = Math.max(1, Math.round(e.hp * 0.8));
      e.curSpd = Math.max(50, (e.curSpd || e.spd) - 15);
    });
    updateUI();
  }

  let turnOrder = [];
  let turnIndex = 0;

  battleInterval = setInterval(() => {
    if (isPausedForEvent) return; // 等待宿敵視窗操作

    const aliveAllies = playerRoster.filter(u => u.hp > 0);
    const aliveEnemies = enemyRoster.filter(u => u.hp > 0);

    if (aliveAllies.length === 0 || aliveEnemies.length === 0) {
      clearInterval(battleInterval);
      isBattling = false;
      document.getElementById('startBattleBtn').disabled = false;
      handleBattleEnd(aliveAllies.length > 0);
      return;
    }

    if (turnIndex >= turnOrder.length) {
      turnOrder = [...aliveAllies, ...aliveEnemies].sort((a, b) => (b.curSpd || b.spd) - (a.curSpd || a.spd));
      turnIndex = 0;
    }

    const actor = turnOrder[turnIndex];
    turnIndex++;

    if (!actor || actor.hp <= 0) return;

    if (actor.inRitual) {
      addLog(`🔮 <strong>${actor.name}</strong> 正在場外進行柏克末日儀式 (${actor.ritualCount}/3)...`);
      return;
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
    return fallback[0];
  }
  return null;
}

function dealDamage(attacker, target, rawDmg) {
  let dmg = Math.round(rawDmg);
  let isCrit = false;

  if (attacker.traits && attacker.traits.includes('S.I.S') && (target.sisMarks || 0) > 0) {
    dmg = Math.round(dmg * (1 + 0.05 * target.sisMarks));
  }

  if (attacker.isAlly) {
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
  }

  target.hp = Math.max(0, target.hp - dmg);
  target.mp = Math.min(target.maxMp, target.mp + 15);

  // 記錄傷害與承傷數據
  if (attacker.stats) attacker.stats.dmgDealt += dmg;
  if (target.stats) target.stats.dmgTaken += dmg;

  triggerVisualEffect(target, 'hit', isCrit ? `💥CRIT -${dmg}` : `-${dmg}`);
  updateDualHealthState(target);
  return dmg;
}

function recordHeal(healer, target, amount) {
  const actual = Math.min(target.maxHp - target.hp, amount);
  target.hp = Math.min(target.maxHp, target.hp + amount);
  if (healer && healer.stats && actual > 0) healer.stats.healed += actual;
  if (actual > 0) triggerVisualEffect(target, 'heal', `+${actual}`);
  updateDualHealthState(target);
}

function executeUnitTurn(actor) {
  const allies = actor.isAlly ? playerRoster : enemyRoster;
  const opponents = actor.isAlly ? enemyRoster : playerRoster;
  const syn = getActiveSynergies(allies);
  const target = getTarget(opponents);
  if (!target) return;

  triggerVisualEffect(actor, 'lunge');
  const extraMp = (actor.isAlly && playerAugments.some(a => a.id === 'aug_battery')) ? 15 : 0;

  if (actor.mp >= actor.maxMp) {
    actor.mp = 0;
    castSkill(actor, allies, opponents, target);

    // 【S.I.S】3人羈絆：追加技能【獨立自主】
    if ((syn['S.I.S'] || 0) >= 3 && actor.traits.includes('S.I.S')) {
      const sisTarget = getTarget(opponents);
      if (sisTarget) {
        const sisDmg = dealDamage(actor, sisTarget, actor.atk * 0.75);
        sisTarget.sisMarks = (sisTarget.sisMarks || 0) + 1;
        battleComboLogs.push(`💅 ${actor.name} 觸發【獨立自主】印記追擊 (${sisTarget.sisMarks}層)`);
        addLog(`💅 <strong>${actor.name}</strong> 追加發動<strong>【獨立自主】</strong>！對 ${sisTarget.name} 造成 <span class="log-dmg">${sisDmg}</span> 傷害並疊加印記 (目前 ${sisTarget.sisMarks} 層)！`, 'log-sis');
      }
    }

    if (actor.isAlly && playerAugments.some(a => a.id === 'aug_idol')) {
      allies.filter(u => u.hp > 0).forEach(u => recordHeal(actor, u, 65));
    }

    checkAndyRitual(allies, opponents);
    checkThreeGodsCombo(actor, allies, opponents);
  } else {
    // 若是合體神卡【安迪與奧本海默】，普通攻擊也是全體 AOE 金融風暴！
    if (actor.id === 'andy_opp_fused') {
      const aliveOpps = opponents.filter(u => u.hp > 0 && !u.inRitual);
      aliveOpps.forEach(e => dealDamage(actor, e, actor.atk));
      actor.mp = Math.min(actor.maxMp, actor.mp + 30 + extraMp);
      addLog(`☯️ <strong>${actor.name}</strong> 揮出【最強之兩人・全體金融風暴】普攻，橫掃敵方全體！`, 'log-skill');
    } else {
      const dmg = dealDamage(actor, target, actor.atk);
      actor.mp = Math.min(actor.maxMp, actor.mp + 30 + extraMp);
      addLog(`${actor.isAlly ? '🟢' : '🔴'} <strong>${actor.name}</strong> 攻擊了 <strong>${target.name}</strong>，造成 <span class="log-dmg">${dmg}</span> 傷害。`);
    }
  }

  if (actor.id === 'loki' && actor.hp > 0) {
    const mobiusTarget = getTarget(opponents);
    if (mobiusTarget) {
      const mDmg = dealDamage(actor, mobiusTarget, actor.atk * 0.55);
      battleComboLogs.push(`🕵️‍♂️ Loki 背後靈【Mobius】協同電擊`);
      addLog(`🕵️‍♂️ <strong>Loki 的背後靈【Mobius】</strong> 追擊 <strong>${mobiusTarget.name}</strong>，造成 <span class="log-dmg">${mDmg}</span> 電擊傷害！`, 'log-synergy');
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
      addLog(`☯️ <strong>${actor.name}</strong> 施放<strong>【${actor.skillName}】</strong>！負油價隕石結合百倍槓桿核彈轟炸敵方全體，並為全隊回血 +150、攻擊力 +25%！`, 'log-skill');
      break;
    }
    case 'mouse_sis': {
      aliveAllies.forEach(a => {
        a.mp = Math.min(a.maxMp, a.mp + 40);
        recordHeal(actor, a, Math.round(90 * skillBoost));
        a.atk = Math.round(a.atk * 1.15);
      });
      addLog(`🍵 <strong>${actor.name}</strong> 施放【${actor.skillName}】！全體友軍 <strong>+40 MP</strong>、回血 +90 並提升 15% 攻擊力！`, 'log-heal');
      break;
    }
    case 'st_sis': {
      const healMultiplier = (!actor.isWeakened ? 1.3 : 1) * skillBoost;
      const healAmt = Math.round(150 * healMultiplier);
      aliveAllies.forEach(a => recordHeal(actor, a, healAmt));
      addLog(`🐶 <strong>${actor.name}</strong> 施放【${actor.skillName}】！為全隊回復 <span class="log-heal">${healAmt}</span> 生命值！`, 'log-heal');
      break;
    }
    case 'icy_sis': {
      const healAmt = Math.round(115 * skillBoost);
      aliveAllies.forEach(a => {
        recordHeal(actor, a, healAmt);
        a.atk = Math.round(a.atk * 1.20);
      });
      addLog(`🐱 <strong>${actor.name}</strong> 發動【${actor.skillName}】！全體回血 <span class="log-heal">${healAmt}</span> 並提升 20% 攻擊力！`, 'log-heal');
      break;
    }
    case 'shijie_sis': {
      const dmg = dealDamage(actor, mainTarget, actor.atk * 2.15 * skillBoost);
      addLog(`🔫 <strong>${actor.name}</strong> 施放【${actor.skillName}】造成 <span class="log-dmg">${dmg}</span> 傷害！`, 'log-skill');
      const dvAlly = aliveAllies.find(a => a.id === 'dv');
      if (dvAlly && mainTarget.hp > 0) {
        const dvDmg = dealDamage(dvAlly, mainTarget, dvAlly.atk * 1.2);
        actor.atk = Math.round(actor.atk * 1.2);
        dvAlly.atk = Math.round(dvAlly.atk * 1.2);
        battleComboLogs.push(`💢 師姐 sis + DV 觸發【老婆分靈體】狂暴合擊`);
        addLog(`💢 <strong>【分靈體聯動】DV</strong> 把師姐 sis 認錯成老婆分靈體！狂暴追加 <span class="log-dmg">${dvDmg}</span> 傷害，兩人攻擊力 +20%！`, 'log-sis');
      }
      break;
    }
    case 'dc_tesla': {
      const isCrit = Math.random() < 0.3;
      const mult = isCrit ? 3.2 : 1.8;
      const dmg = dealDamage(actor, mainTarget, actor.atk * mult * skillBoost);
      aliveAllies.forEach(a => a.mp = Math.min(a.maxMp, a.mp + 25));
      addLog(`🚗 <strong>${actor.name}</strong> 發動【${actor.skillName}】${isCrit ? '⚡FSD暴衝雙倍！' : ''}造成 <span class="log-dmg">${dmg}</span> 傷害，全隊充電 +25 MP！`, 'log-skill');
      break;
    }
    case 'stock_opp': {
      if (actor.isAlly && playerAugments.some(a => a.id === 'aug_baemon')) {
        const healAmt = Math.round(145 * skillBoost);
        aliveAllies.forEach(a => {
          recordHeal(actor, a, healAmt);
          a.curSpd = (a.curSpd || a.spd) + 18;
        });
        addLog(`👾 <strong>${actor.name}</strong> 發動<strong>【寶怪應援・SHEESH打Call】</strong>！全隊回復 <span class="log-heal">${healAmt}</span> 生命值，全體友軍 <strong>+18 攻速(SPD)</strong>！`, 'log-heal');
      } else {
        if (Math.random() < 0.55) {
          aliveAllies.forEach(a => a.atk = Math.round(a.atk * 1.25));
          aliveOpps.forEach(e => dealDamage(actor, e, actor.atk * 1.15 * skillBoost));
          addLog(`📈 <strong>${actor.name}</strong> 開出【牛市暴漲】！全隊攻擊力 +25% 並轟炸敵方全體！`, 'log-skill');
        } else {
          const dmg = dealDamage(actor, mainTarget, actor.atk * 1.65 * skillBoost);
          recordHeal(actor, actor, dmg);
          addLog(`📉 <strong>${actor.name}</strong> 發動【Rug Pull 割韭菜】！吸取 ${mainTarget.name} <span class="log-dmg">${dmg}</span> 生命！`, 'log-skill');
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
      addLog(`🎤 <strong>${actor.name}</strong> 施放【${actor.skillName}】！全隊回血 +130、加攻 15%，並削弱 ${mainTarget.name}！`, 'log-heal');
      break;
    }
    case 'loki': {
      const dmg = dealDamage(actor, mainTarget, actor.atk * 1.7 * skillBoost);
      aliveAllies.forEach(a => { if (a !== actor) a.mp = Math.min(a.maxMp, a.mp + 30); });
      addLog(`🦊 <strong>${actor.name}</strong> 施放【時間線收割】造成 <span class="log-dmg">${dmg}</span> 傷害，全體隊友 +30 MP！`, 'log-skill');
      break;
    }
    case 'andy': {
      aliveOpps.forEach(e => dealDamage(actor, e, actor.atk * 1.85 * skillBoost));
      addLog(`🛢️ <strong>${actor.name}</strong> 引爆【負油價末日震波】轟炸敵方全體！`, 'log-skill');
      break;
    }
    case 'aming': {
      aliveOpps.slice(0, 2).forEach(t => {
        dealDamage(actor, t, actor.atk * 1.45 * skillBoost);
        t.mp = Math.max(0, t.mp - 40);
      });
      addLog(`💻 <strong>${actor.name}</strong> 執行【rm -rf /*】！對敵方植入 Bug 並清空 40 MP！`, 'log-skill');
      break;
    }
    case 'dashen': {
      const hasPartner = aliveAllies.some(a => a.id === 'loki' || a.id === 'hugo');
      const mult = hasPartner ? 1.7 : 1.25;
      aliveOpps.forEach(e => dealDamage(actor, e, actor.atk * mult * skillBoost));
      addLog(`👑 <strong>${actor.name}</strong> 降下【全知全能・神諭裁決】轟炸全場！`, 'log-skill');
      break;
    }
    case 'hugo': {
      const weakest = [...aliveOpps].sort((a, b) => a.hp - b.hp)[0] || mainTarget;
      const dmg = dealDamage(actor, weakest, actor.atk * 2.1 * skillBoost);
      if (aliveAllies.some(a => a.id === 'loki' || a.id === 'dashen')) {
        aliveAllies.forEach(a => recordHeal(actor, a, 90));
      }
      addLog(`🌌 <strong>${actor.name}</strong> 施放【次元共鳴斬】斬擊 ${weakest.name} <span class="log-dmg">${dmg}</span> 傷害！`, 'log-skill');
      break;
    }
    case 'dv': {
      const missingHpRatio = 1 + ((actor.maxHp - actor.hp) / actor.maxHp);
      let total = 0;
      for (let i = 0; i < 3; i++) {
        const t = aliveOpps[Math.floor(Math.random() * aliveOpps.length)] || mainTarget;
        total += dealDamage(actor, t, actor.atk * 0.8 * missingHpRatio * skillBoost);
      }
      addLog(`💢 <strong>${actor.name}</strong> 躁狂 3 連擊共造成 <span class="log-dmg">${total}</span> 點爆炸傷害！`, 'log-skill');
      break;
    }
    case 'dvp': {
      recordHeal(actor, actor, Math.round(220 * skillBoost));
      const dmg = dealDamage(actor, mainTarget, actor.atk * 1.5 * skillBoost);
      addLog(`🛡️ <strong>${actor.name}</strong> 開啟【雖遠必誅・共同富裕】！回復 220 生命並反震 ${mainTarget.name} <span class="log-dmg">${dmg}</span> 傷害！`, 'log-heal');
      break;
    }
    case 'ansir': {
      recordHeal(actor, actor, 180);
      actor.curSpd = (actor.curSpd || actor.spd) + 15;
      const dmg = dealDamage(actor, mainTarget, actor.atk * 1.5 * skillBoost);
      addLog(`⚡ <strong>${actor.name}</strong> 回血 +180、永久加速，並痛擊 ${mainTarget.name} <span class="log-dmg">${dmg}</span>！`, 'log-skill');
      break;
    }
    case 'lg': {
      const dmg = dealDamage(actor, mainTarget, actor.atk * 1.65 * skillBoost);
      const lowestAlly = [...aliveAllies].sort((a, b) => a.hp - b.hp)[0];
      if (lowestAlly) recordHeal(actor, lowestAlly, Math.round(180 * skillBoost));
      addLog(`✝️ <strong>${actor.name}</strong> 制裁 ${mainTarget.name} <span class="log-dmg">${dmg}</span>，並治療 ${lowestAlly ? lowestAlly.name : ''} +180 HP！`, 'log-heal');
      break;
    }
  }
}

function checkAndyRitual(allies, opponents) {
  const andy = allies.find(u => u.id === 'andy' && u.hp > 0 && u.inRitual);
  if (!andy) return;
  andy.ritualCount += 1;
  addLog(`🕯️ <strong>${andy.name}</strong> 完成第 <strong>${andy.ritualCount} / 3</strong> 個柏克末日儀式！`, 'log-synergy');

  if (andy.ritualCount >= 3) {
    andy.inRitual = false;
    battleComboLogs.push(`☄️ Andy安迪 完成 3 儀式攜帶【負油價隕石】降臨`);
    addLog(`☄️ <strong>【末日降臨】Andy安迪 完成 3 個儀式！攜帶「負油價隕石」毀滅性降臨戰場！</strong>`, 'log-skill');
    opponents.filter(u => u.hp > 0 && !u.inRitual).forEach(e => {
      dealDamage(andy, e, andy.atk * 2.2);
    });

    // 檢查是否觸發【宿敵彩蛋】
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
      addLog(`🌟 <strong>【3幻神全知全能共鳴】</strong> 觸發三位一體追擊，對 ${target.name} 追加 <span class="log-dmg">${comboDmg}</span> 神聖傷害！`, 'log-synergy');
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

    <div style="background:#1e1f22; padding:12px; border-radius:8px; text-align:left; margin:12px 0; font-size:0.84rem;">
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
  prepareUnitsForStage();
  updateUI();

  if (isWin) {
    if (currentStage >= maxStage) {
      addLog(`🏆 <strong>恭喜通關全部 5 關！你的 DC BON 全明星小隊稱霸了整個 Discord！</strong>`, 'log-skill');
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
    body.innerHTML = `<div class="choices-grid">` + allHeroes.map(h => `
      <div class="choice-card" style="cursor:default; ${h.id === 'andy_opp_fused' ? 'border-color:var(--discord-yellow);' : ''}">
        <div>
          <h4><span>${h.icon} ${h.name}</span> ${h.id === 'andy_opp_fused' ? '<span class="upgrade-tag">隱藏合體卡</span>' : ''}</h4>
          <div class="choice-traits">${h.traits.map(t => `<span class="trait-pill">${t}</span>`).join('')}</div>
          <div class="choice-desc">
            <strong>【${h.skillName}】</strong><br>${h.skillDesc}
            ${h.easterEggHint ? `<div class="easter-hint">${h.easterEggHint}</div>` : ''}
          </div>
        </div>
        <div class="choice-stats">❤️ HP: ${h.hp} | ⚔️ ATK: ${h.atk} | ⚡ SPD: ${h.spd} | 💧 MP: ${h.maxMp}</div>
      </div>
    `).join('') + `</div>`;
  } else if (tab === 'traits') {
    body.innerHTML = `<div class="choices-grid">` + Object.entries(TRAIT_INFO).map(([name, info]) => `
      <div class="choice-card" style="cursor:default;">
        <div>
          <h4><span>🔗 ${name}</span> <span class="trait-pill">${info.req}</span></h4>
          <div class="choice-desc">${info.desc}</div>
        </div>
        <div class="choice-stats" style="color:#f9a8d4; font-style:italic;">${info.lore}</div>
      </div>
    `).join('') + `</div>`;
  } else if (tab === 'augments') {
    body.innerHTML = `<div class="choices-grid">` + AUGMENT_POOL.map(a => `
      <div class="choice-card" style="cursor:default;">
        <div>
          <h4><span>${a.name}</span></h4>
          <div class="choice-desc">${a.desc}</div>
        </div>
        <div class="choice-stats">${a.reqHero ? '🌟 角色專屬轉職增幅' : '通用增幅 (不重複抽取)'}</div>
      </div>
    `).join('') + `</div>`;
  }
}

window.onload = initGame;