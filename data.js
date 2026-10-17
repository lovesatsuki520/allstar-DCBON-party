// ============================================================================
// 《DC BON 全明星自動戰棋》— 核心資料庫 (data.js)
// 純淨資料檔：僅包含 TRAIT_INFO, FUSED_HERO_TEMPLATE, FINAL_BOSS_TEMPLATE, HERO_POOL, AUGMENT_POOL
// ============================================================================

const TRAIT_INFO = {
  '父親大人': {
    icon: '🧔‍♂️',
    color: '#38bdf8',
    desc: '【專屬護盾】開局獲得基於自身最大生命的深淵護盾（僅父親大人成員生效）。',
    tiers: [
      { count: 1, label: '1人：自身獲得 10% 最大生命護盾' },
      { count: 2, label: '2人：自身獲得 20% 最大生命護盾' }
    ]
  },
  '大佬時代': {
    icon: '🛡️',
    color: '#f59e0b',
    desc: '大佬氣場加持，大幅提升生命上限。',
    tiers: [
      { count: 1, label: '1人：自身 HP +10%' },
      { count: 2, label: '2人：大佬成員 HP +15%' },
      { count: 3, label: '3人：我方全隊 HP +20%' }
    ]
  },
  '3幻神': {
    icon: '⚡',
    color: '#facc15',
    desc: '神領域共鳴，提升全能力與初始魔力。',
    tiers: [
      { count: 1, label: '1人：自身傷害 +12%' },
      { count: 2, label: '2人：幻神成員 ATK +22%、開局 +20 MP' },
      { count: 3, label: '3人：幻神成員 ATK +35%、SPD +15%、開局 +35 MP' }
    ]
  },
  '華爾街空頭': {
    icon: '📉',
    color: '#ef4444',
    desc: '精準狙擊弱者，對低血量目標造成斬殺增傷。',
    tiers: [
      { count: 2, label: '2人：對 50% HP 以下敵人傷害 +25%' },
      { count: 3, label: '3人：對 50% HP 以下敵人傷害 +45%，擊殺回 20 MP' }
    ]
  },
  '狂熱信仰': {
    icon: '🔥',
    color: '#f97316',
    desc: '信仰狂熱化，每回合行動後獲得攻速與攻擊堆疊。',
    tiers: [
      { count: 2, label: '2人：每次行動 ATK +6%（最高 5 層）' },
      { count: 3, label: '3人：每次行動 ATK +10%、SPD +5%（最高 5 層）' }
    ]
  },
  '科技代碼': {
    icon: '💻',
    color: '#10b981',
    desc: '演算法最佳化，加速技能迴轉並干擾敵方魔力。',
    tiers: [
      { count: 2, label: '2人：每次普攻額外 +8 MP' },
      { count: 3, label: '3人：每次普攻額外 +14 MP，技能造成 -15 MP 損毀' }
    ]
  },
  '閃耀偶像': {
    icon: '🌸',
    color: '#ec4899',
    desc: '舞台應援光環，為全隊提供續航與攻速支援。',
    tiers: [
      { count: 2, label: '2人：全隊每回合恢復 5% 已損生命' },
      { count: 3, label: '3人：全隊每回合恢復 8% 已損生命，且 SPD +12%' }
    ]
  },
  '窮閪走數團 / 賭狗 / 司機': {
    icon: '🚗',
    color: '#a855f7',
    desc: '獨立單兵身份，走數界傳奇司機（無額外數值加成）。',
    tiers: [
      { count: 1, label: '1人：獨立身份認同' }
    ]
  }
};

const FUSED_HERO_TEMPLATE = {
  id: 'fused_apex',
  name: '柏克萊・百倍槓桿末日神',
  title: '宿命融合・多空雙殺',
  icon: '🌌',
  traits: ['華爾街空頭', '狂熱信仰'],
  range: 3,
  roleTag: '💥 全場毀滅',
  tags: ['🔥 範圍轟炸', '🩸 斬殺收割', '⚡ 極速充能'],
  hp: 1650,
  atk: 145,
  spd: 135,
  maxMp: 75,
  shortDesc: '普攻附帶雙重雷擊，大招轟炸敵方全體並吸取魔力。',
  skillName: '多空雙殺・零和終審',
  skillDesc: '對敵方全體造成 260% 毀滅傷害，並吸收全場敵人各 20 MP。',
  awakeningName: '★3 覺醒【宇宙大爆倉】',
  awakeningDesc: '大招倍率提升至 350%，對半血以下敵人必定暴擊！'
};

const FINAL_BOSS_TEMPLATE = {
  id: 'boss_yeung',
  name: '楊守正',
  title: '深淵終極主宰・100%中的100%',
  icon: '👹',
  traits: ['父親大人', '大佬時代'],
  range: 2,
  roleTag: '👹 深淵主宰',
  tags: ['🛡️ 千點護盾', '💥 二段狂暴', '⚡ 全體震波'],
  hp: 3200,
  atk: 135,
  spd: 122,
  maxMp: 80,
  shortDesc: '半血時觸發「100%中的100%」狂暴，獲得護盾與全場震波。',
  skillName: '深淵裁決・絕對零度',
  skillDesc: '對敵方全體造成 190% 傷害並降低 20% 攻擊力。首次低於 50% HP 時觸發狂暴二階段（+800 護盾、ATK/SPD +35% 並釋放全體深淵震波）。',
  awakeningName: '★3 覺醒【100% 中的 100%】',
  awakeningDesc: '深淵主宰完全體，無視常規控制效果。'
};

const HERO_POOL = [
  {
    id: 'dc_tesla',
    name: 'DC齊發達',
    title: '華爾街窮閪・FSD走數大師',
    icon: '🚗',
    traits: ['窮閪走數團 / 賭狗 / 司機'],
    range: 1,
    roleTag: '🎲 賭狗戰車',
    tags: ['🎲 開大抽狀態', '🔄 傷害轉嫁', '🚗 直線衝撞'],
    hp: 640,
    atk: 68,
    spd: 112,
    maxMp: 55,
    lockedMaxMp: 55,
    shortDesc: '開大時抽選【B記】或【B狗】維持至下次大招，衝撞敵方全體。',
    skillName: 'FSD 全自動走數暴衝',
    skillDesc: '魔力上限鎖定 55 MP。施放大招時對全體造成 165% 傷害（25% 機率 280% 暴衝），並隨機抽選狀態維持至下次開大（非累乘）：【B記】全隊 +20% 攻、自身暴擊 +20%；【B狗】自身 +35% 攻、隨機吸取 1 名存活隊友 12% HP，且大招後將自身所受 40% 傷害轉嫁給最高血量隊友。',
    awakeningName: '★3 覺醒【極限走數・車頭綁人】',
    awakeningDesc: '大招把 1 名隊友綁在車頭撞擊敵陣，對主目標追加 140% 傷害，並使敵方全體 SPD -20（持續 1 回合）。'
  },
  {
    id: 'freeted',
    name: 'FreeTed',
    title: '無慘大人',
    icon: '⚡',
    traits: ['父親大人', '大佬時代'],
    range: 1,
    roleTag: '🩸 吸血鬼王',
    tags: ['🩸 普攻吸血', '⚡ 擴散閃電', '👹 滅團鬼化'],
    hp: 760,
    atk: 84,
    spd: 116,
    maxMp: 0,
    noMpHero: true,
    lifesteal: 0.25,
    shortDesc: '無魔力鬥士，自帶 25% 吸血與擴散閃電；隊友全滅時全面鬼化。',
    skillName: '在座各位都係垃圾',
    skillDesc: '無魔力英雄，攻擊自帶 25% 生命偷取。每 5 下普攻觸發擴散閃電（全體 55% 傷害並吸取生命，且降敵方最遠 2 人 40% 攻速 2 回合）。當隊友全滅時觸發全面鬼化：瞬移衝入敵陣、減傷 50%、吸血提升至 45%、免疫降攻減速，每擊殺 1 名敵人隨機復活 1 名隊友至 25% HP。',
    awakeningName: '★3 覺醒【父親的腳毛】',
    awakeningDesc: '基礎攻速提升 25%，普攻改為每 3 下即觸發吸血擴散閃電！'
  },
  {
    id: 'dv',
    name: 'DV',
    title: '深淵嚴父・絕對防線',
    icon: '💢',
    traits: ['父親大人'],
    range: 1,
    roleTag: '🛡️ 重裝巨盾',
    tags: ['🛡️ 父親護盾', '🛡️ 嘲諷減傷', '🔨 震地反擊'],
    hp: 860,
    atk: 72,
    spd: 98,
    maxMp: 85,
    shortDesc: '擁有父親大人專屬護盾，大招減傷並震擊敵方前排。',
    skillName: '家法伺候・絕對威壓',
    skillDesc: '對目標及周圍敵人造成 185% 傷害並降低其 25% 攻擊力 2 回合，自身獲得 30% 減傷持續 2 回合。',
    awakeningName: '★3 覺醒【父愛如山崩】',
    awakeningDesc: '開局父親大人護盾倍率額外 +15%，大招額外附帶自身已損生命 25% 的反震傷害！'
  },
  {
    id: 'loki',
    name: 'Loki',
    title: '時間變異管理局之神',
    icon: '🦊',
    traits: ['3幻神', '科技代碼'],
    range: 2,
    companionIcon: '⚡',
    roleTag: '⏱️ 替身連攜',
    tags: ['⚡ 替身追擊', '🔋 全隊回魔', '⏱️ 時間收割'],
    hp: 580,
    atk: 64,
    spd: 120,
    maxMp: 85,
    shortDesc: '每次行動後背後靈【Mobius】追加電擊，大招為全隊灌注魔力。',
    skillName: '時間線收割 (附帶 Mobius)',
    skillDesc: '被動：每次行動後背後靈【Mobius】追加 45% 電擊傷害。大招：對目標造成 170% 傷害，並為全體隊友灌注 +30 MP。',
    awakeningName: '★3 覺醒【故事之神・世界樹王座】',
    awakeningDesc: '背後靈【Mobius】電擊升級為彈射 2 名敵人並偷取 10 MP！'
  },
  {
    id: 'andy',
    name: 'Andy安迪',
    title: '柏克末日・負油價先知',
    icon: '🛢️',
    traits: ['華爾街空頭', '狂熱信仰'],
    range: 3,
    roleTag: '☄️ 場外降臨',
    tags: ['🕯️ 場外儀式', '☄️ 隕石轟炸', '🔥 全體高傷'],
    hp: 780,
    atk: 88,
    spd: 95,
    maxMp: 100,
    minStage: 2,
    shortDesc: '開局在場外詠唱，友軍施放 3 次大招後化為隕石轟炸全場並參戰。',
    skillName: '柏克末日・負油價隕石',
    skillDesc: '開局在場外進行末日儀式（不可被攻擊），友軍每施放 1 次大招完成 1 儀式。滿 3 儀式後空降棋盤轟炸敵方全體 220% 傷害並正式參戰！',
    awakeningName: '★3 覺醒【WTI 負四十美元終審】',
    awakeningDesc: '末日儀式縮短為只需 2 次即可降臨，且降臨轟炸倍率提升至 310% 並永久提升自身 30% 暴擊率！',
    easterEggHint: '🔮 宿敵暗語：當末日儀式完成降臨之際，若最前線站著那位操控百倍槓桿的宿敵...'
  },
  {
    id: 'aming',
    name: '阿明',
    title: '全棧刪庫工程師',
    icon: '💻',
    traits: ['科技代碼'],
    range: 3,
    roleTag: '👾 刪庫削魔',
    tags: ['💧 清空魔力', '👾 雙目標傷害', '⚡ 全體當機'],
    hp: 530,
    atk: 65,
    spd: 118,
    maxMp: 80,
    shortDesc: '遠程狙擊 2 名敵人並清空其魔力，使敵人無法開出大招。',
    skillName: 'rm -rf /* 刪庫跑路',
    skillDesc: '對 2 名敵人植入致命 Bug 造成 145% 傷害，並清空其 40 點魔力 (MP) 使其當機。',
    awakeningName: '★3 覺醒【Sudo 最高權限覆寫】',
    awakeningDesc: '大招改為攻擊敵方全體、削弱敵方 25% 攻擊力並扣除 50 MP！'
  },
  {
    id: 'dashen',
    name: '大神',
    title: '全知全能至高神諭',
    icon: '👑',
    traits: ['3幻神', '大佬時代'],
    range: 3,
    roleTag: '👑 神諭裁決',
    tags: ['💥 真實傷害', '📈 全隊增傷', '⚡ 神聖制裁'],
    hp: 680,
    atk: 82,
    spd: 114,
    maxMp: 90,
    shortDesc: '降下神諭轟炸敵方全體，並賦予全隊神聖增傷。',
    skillName: '神諭・降維打擊',
    skillDesc: '對敵方全體造成 160% 傷害（其中 30% 為無視減傷的真實傷害），並使我方全體下一次攻擊傷害 +25%。',
    awakeningName: '★3 覺醒【創世神格覺醒】',
    awakeningDesc: '大招真實傷害比例提升至 60%，且擊殺敵人時立即返還 45 MP！'
  },
  {
    id: 'hugo',
    name: 'Hugo',
    title: '深淵狂戰・暴走機關',
    icon: '🗡️',
    traits: ['大佬時代', '狂熱信仰'],
    range: 1,
    roleTag: '🗡️ 狂暴連斬',
    tags: ['🩸 壓血增傷', '🗡️ 多段連斬', '🔥 攻速疊加'],
    hp: 740,
    atk: 79,
    spd: 115,
    maxMp: 75,
    shortDesc: '血量越低攻速與傷害越高，大招進行狂暴三連斬。',
    skillName: '狂戰亂舞・三連絕殺',
    skillDesc: '對當前目標進行 3 段斬擊（總計 240% 傷害），自身每損失 10% 生命，此技能傷害額外提升 8%。',
    awakeningName: '★3 覺醒【不屈狂神】',
    awakeningDesc: '大招升級為 4 段斬擊（總計 320% 傷害），且首次受到致命傷時鎖血 1 HP 並立即回滿 MP！'
  },
  {
    id: 'stock_opp',
    name: '股海明燈',
    title: '百倍槓桿・反向指標',
    icon: '📈',
    traits: ['華爾街空頭'],
    range: 2,
    roleTag: '📉 槓桿爆倉',
    tags: ['🎲 雙倍暴擊', '📉 降敵攻擊', '🔮 宿敵彩蛋'],
    hp: 610,
    atk: 74,
    spd: 108,
    maxMp: 70,
    shortDesc: '高風險高報酬輸出，大招強行平倉敵方最高攻單位。',
    skillName: '百倍槓桿・強制平倉',
    skillDesc: '鎖定敵方攻擊力最高的單位造成 210% 傷害，並竊取其 20% 攻擊力持續 2 回合。',
    awakeningName: '★3 覺醒【無限印鈔機】',
    awakeningDesc: '大招必定暴擊，且竊取的攻擊力平分給全體隊友！'
  },
  {
    id: 'shu_sis',
    name: '鼠姐 sis',
    title: '閃耀護衛・舞台微光',
    icon: '🐭',
    traits: ['閃耀偶像', '科技代碼'],
    range: 2,
    roleTag: '🛡️ 偶像護盾',
    tags: ['✨ 單體治療', '🛡️ 極意護盾', '🌸 攻速支援'],
    hp: 620,
    atk: 58,
    spd: 116,
    maxMp: 75,
    shortDesc: '治療最低血量隊友並提升攻速，★3 極意可賦予偶像應援護盾。',
    skillName: '微光應援曲',
    skillDesc: '為我方血量最低的隊友恢復 165% ATK 生命值，並提升其 20% 攻速 2 回合。',
    awakeningName: '★3 覺醒【絕對偶像防禦領域】',
    awakeningDesc: '大招治療同時為該隊友與自身施加 220 點應援護盾，並驅散負面減速狀態！'
  },
  {
    id: 'st_sis',
    name: 'ST sis',
    title: '聖光歌姬・守護交響',
    icon: '🎤',
    traits: ['閃耀偶像'],
    range: 3,
    roleTag: '💖 群體守護',
    tags: ['💖 群體回血', '🛡️ 極意群盾', '🎵 魔力共鳴'],
    hp: 590,
    atk: 56,
    spd: 112,
    maxMp: 85,
    shortDesc: '全體治療歌姬，★3 極意可為全隊展開聖光護盾。',
    skillName: '星光治癒交響樂',
    skillDesc: '為我方全體恢復 115% ATK 生命值，並為血量最低的隊友額外恢復 80 點生命。',
    awakeningName: '★3 覺醒【永恆星光守護壁壘】',
    awakeningDesc: '施放大招時，額外為我方全體賦予相當於自身 160% ATK 的星光護盾！'
  },
  {
    id: 'satsuki',
    name: '菅原咲月',
    title: '小吉副隊長・元氣應援',
    icon: '🌙',
    traits: ['閃耀偶像', '3幻神'],
    range: 3,
    roleTag: '🌙 元氣鼓舞',
    tags: ['📈 全隊加攻', '💖 持續回血', '🔋 魔力加速'],
    hp: 600,
    atk: 62,
    spd: 122,
    maxMp: 80,
    shortDesc: '高速應援偶像，提升全隊攻擊力並恢復生命。',
    skillName: '小吉元氣全開應援！',
    skillDesc: '鼓舞全隊，使我方全體攻擊力提升 22%（持續 2 回合），並恢復全體 95% ATK 生命值。',
    awakeningName: '★3 覺醒【五期生之光・滿月綻放】',
    awakeningDesc: '大招額外為全體隊友注入 +25 MP，且自身每次普攻隨機為 1 名隊友恢復 45 HP！'
  },
  {
    id: 'dvp',
    name: 'DVP',
    title: '深淵祭司・暗影連結',
    icon: '🔮',
    traits: ['大佬時代', '狂熱信仰'],
    range: 2,
    roleTag: '🔗 靈魂汲取',
    tags: ['🩸 吸血轉化', '🔗 傷害分攤', '💀 暗影衝擊'],
    hp: 710,
    atk: 68,
    spd: 105,
    maxMp: 80,
    shortDesc: '汲取敵方生命治療隊友，兼具輸出與續航。',
    skillName: '暗影生命虹吸',
    skillDesc: '對目標造成 165% 傷害，並將造成傷害的 65% 轉化為治療量，治療我方血量最低的隊友。',
    awakeningName: '★3 覺醒【深淵不死契約】',
    awakeningDesc: '大招改為吸取敵方 2 名目標，且溢出的治療量會轉化為目標下回合的額外攻擊力！'
  }
];

const AUGMENT_POOL = [
  {
    id: 'aug_lettuce',
    name: '大力生菜',
    icon: '🥬',
    tier: 'PRISMATIC',
    desc: '立即手動指定 1 名未滿 ★3 的我方隊員（含冷板凳），直接提升 1 個星級！'
  },
  {
    id: 'aug_feather',
    name: '疾風之羽',
    icon: '🪶',
    tier: 'GOLD',
    desc: '我方全體英雄起始速度 (SPD) 永久提升 +18%。'
  },
  {
    id: 'aug_blood_chalice',
    name: '鮮血聖杯',
    icon: '🍷',
    tier: 'GOLD',
    desc: '我方全體所有攻擊與技能獲得 15% 生命偷取（與 FreeTed 吸血可疊加）。'
  },
  {
    id: 'aug_mana_battery',
    name: '超載魔力爐',
    icon: '🔋',
    tier: 'GOLD',
    desc: '我方全體開局初始獲得 +30 MP，且每次普攻額外回魔 +5 MP。'
  },
  {
    id: 'aug_executioner',
    name: '深淵處決令',
    icon: '🪓',
    tier: 'PRISMATIC',
    desc: '對生命值低於 35% 的敵人造成傷害提升 40%，擊殺敵人時全隊恢復 12% 最大生命。'
  },
  {
    id: 'aug_reroll_dice',
    name: '老千灌鉛骰',
    icon: '🎲',
    tier: 'SILVER',
    desc: '立即獲得 +2 次選秀重骰機會，且全隊暴擊率永久提升 +12%。'
  }
];