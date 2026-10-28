/* 魔法陣ゲームの冒険シミュレーション。
   召喚のときに冒険を最後まで計算して、ログ1行ずつの出来事の列を返す（再生は index.html）。
   window.MahoSim.run(hero, { seed, lang }) → { events, win, area, lv, name } */
(function (global) {
  "use strict";

  function rngOf(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 言葉 [ja, en, ko, zh, tw]（tw が無ければ zh） */
  var LI = { ja: 0, en: 1, ko: 2, zh: 3, tw: 4 };
  var TX = {
    summon: ["{a}が召喚された！", "{a} has been summoned!", "{a}이(가) 소환되었다!", "{a}被召唤出来了！", "{a}被召喚出來了！"],
    depart: ["{a}は旅立った。", "{a} sets out on a journey.", "{a}은(는) 여행을 떠났다.", "{a}踏上了旅途。", "{a}踏上了旅途。"],
    enter: ["{a}に入った。", "Entered the {a}.", "{a}에 들어섰다.", "进入了{a}。", "進入了{a}。"],
    walk: ["{a}たちは先へ進む…", "{a}'s party presses on...", "{a} 일행은 앞으로 나아간다…", "{a}一行继续前进……", "{a}一行繼續前進……"],
    walk1: ["{a}は先へ進む…", "{a} presses on...", "{a}은(는) 앞으로 나아간다…", "{a}继续前进……", "{a}繼續前進……"],
    appear: ["{a}があらわれた！", "A {a} appears!", "{a}이(가) 나타났다!", "{a}出现了！", "{a}出現了！"],
    appearN: ["{a}が{b}匹あらわれた！", "{b} {a}s appear!", "{a} {b}마리가 나타났다!", "出现了{b}只{a}！", "出現了{b}隻{a}！"],
    atk: ["{a}の攻撃！ {b}に{c}のダメージ", "{a} attacks! {c} damage to {b}", "{a}의 공격! {b}에게 {c}의 피해", "{a}的攻击！对{b}造成{c}点伤害", "{a}的攻擊！對{b}造成{c}點傷害"],
    crit: ["会心の一撃！ {b}に{c}のダメージ", "Critical hit! {c} damage to {b}", "회심의 일격! {b}에게 {c}의 피해", "会心一击！对{b}造成{c}点伤害", "會心一擊！對{b}造成{c}點傷害"],
    spell: ["{a}の魔法！ {b}に{c}のダメージ", "{a} casts a spell! {c} damage to {b}", "{a}의 마법! {b}에게 {c}의 피해", "{a}的魔法！对{b}造成{c}点伤害", "{a}的魔法！對{b}造成{c}點傷害"],
    spellAll: ["{a}の魔法！ 敵全体に{c}のダメージ", "{a} casts a spell! {c} damage to all foes", "{a}의 마법! 적 전체에게 {c}의 피해", "{a}的魔法！对全体敌人造成{c}点伤害", "{a}的魔法！對全體敵人造成{c}點傷害"],
    heal: ["{a}の回復魔法！ {b}のHPが{c}回復", "{a} heals {b} for {c} HP", "{a}의 회복 마법! {b}의 HP가 {c} 회복", "{a}的回复魔法！{b}恢复了{c}点HP", "{a}的回復魔法！{b}恢復了{c}點HP"],
    herb: ["{a}は薬草を使った。HPが{c}回復", "{a} uses an herb. +{c} HP", "{a}은(는) 약초를 사용했다. HP {c} 회복", "{a}使用了药草。恢复{c}点HP", "{a}使用了藥草。恢復{c}點HP"],
    miss: ["{a}の攻撃！ ミス", "{a} attacks! Miss", "{a}의 공격! 빗나갔다", "{a}的攻击！没有命中", "{a}的攻擊！沒有命中"],
    eatk: ["{a}の攻撃！ {b}は{c}のダメージ", "{a} attacks! {b} takes {c} damage", "{a}의 공격! {b}은(는) {c}의 피해", "{a}的攻击！{b}受到{c}点伤害", "{a}的攻擊！{b}受到{c}點傷害"],
    dodge: ["{a}の攻撃！ {b}はひらりとかわした", "{a} attacks! {b} dodges", "{a}의 공격! {b}은(는) 재빨리 피했다", "{a}的攻击！{b}轻巧地躲开了", "{a}的攻擊！{b}輕巧地躲開了"],
    kill: ["{a}をたおした！", "Defeated the {a}!", "{a}을(를) 쓰러뜨렸다!", "打倒了{a}！", "打倒了{a}！"],
    won: ["戦闘に勝利！ {c}の経験値と{d}ゴールド", "Victory! {c} EXP and {d} gold", "전투 승리! 경험치 {c}, {d} 골드", "战斗胜利！获得{c}经验值和{d}金币", "戰鬥勝利！獲得{c}經驗值和{d}金幣"],
    lvup: ["{a}はレベル{c}に上がった！", "{a} reached level {c}!", "{a}은(는) 레벨 {c}이(가) 되었다!", "{a}升到了{c}级！", "{a}升到了{c}級！"],
    fall: ["{a}は倒れた…", "{a} has fallen...", "{a}은(는) 쓰러졌다…", "{a}倒下了……", "{a}倒下了……"],
    chestG: ["宝箱を見つけた！ {c}ゴールド手に入れた", "Found a chest! Got {c} gold", "보물상자 발견! {c} 골드 획득", "发现宝箱！获得{c}金币", "發現寶箱！獲得{c}金幣"],
    chestH: ["宝箱を見つけた！ 薬草を手に入れた", "Found a chest! Got an herb", "보물상자 발견! 약초를 얻었다", "发现宝箱！获得了药草", "發現寶箱！獲得了藥草"],
    chestE: ["宝箱を見つけた！ {a}を手に入れた", "Found a chest! Got the {a}", "보물상자 발견! {a}을(를) 얻었다", "发现宝箱！获得了{a}", "發現寶箱！獲得了{a}"],
    trap: ["わなだ！ {a}は{c}のダメージ", "A trap! {a} takes {c} damage", "함정이다! {a}은(는) {c}의 피해", "是陷阱！{a}受到{c}点伤害", "是陷阱！{a}受到{c}點傷害"],
    spring: ["泉を見つけた。傷が癒えた", "Found a spring. Wounds are healed", "샘을 발견했다. 상처가 나았다", "发现了泉水。伤痊愈了", "發現了泉水。傷痊癒了"],
    town: ["{a}の町に着いた", "Arrived at the town of {a}", "{a} 마을에 도착했다", "抵达了{a}镇", "抵達了{a}鎮"],
    inn: ["宿屋に泊まった。HPが全回復！", "Rested at the inn. HP fully restored!", "여관에서 묵었다. HP 전부 회복!", "在旅店住了一晚。HP完全恢复！", "在旅店住了一晚。HP完全恢復！"],
    revive: ["{a}が生き返った", "{a} was revived", "{a}이(가) 되살아났다", "{a}复活了", "{a}復活了"],
    buy: ["{a}を買った！", "Bought the {a}!", "{a}을(를) 샀다!", "买了{a}！", "買了{a}！"],
    buyH: ["薬草を{c}個買った", "Bought {c} herbs", "약초를 {c}개 샀다", "买了{c}个药草", "買了{c}個藥草"],
    boss: ["{a}が立ちはだかる！", "The {a} blocks the way!", "{a}이(가) 앞을 가로막았다!", "{a}挡住了去路！", "{a}擋住了去路！"],
    gate: ["ついに魔王の間にたどり着いた…", "At last, the Demon King's chamber...", "마침내 마왕의 방에 도착했다…", "终于抵达了魔王之间……", "終於抵達了魔王之間……"],
    maou: ["魔王「よくぞ来た、{a}よ」", "Demon King: \"So you have come, {a}.\"", "마왕 「잘 왔다, {a}여」", "魔王「你终于来了，{a}」", "魔王「你終於來了，{a}」"],
    clear: ["魔王をたおした！ 世界に平和が戻った！", "The Demon King is defeated! Peace returns!", "마왕을 쓰러뜨렸다! 세계에 평화가 돌아왔다!", "打倒了魔王！世界恢复了和平！", "打倒了魔王！世界恢復了和平！"],
    flee: ["{a}は逃げ出した！", "{a} ran away!", "{a}은(는) 도망쳤다!", "{a}逃跑了！", "{a}逃跑了！"],
    gear: ["{a}は{b}を手にしている", "{a} holds the {b}", "{a}은(는) {b}을(를) 들고 있다", "{a}手持{b}", "{a}手持{b}"],
    curse: ["呪いが{a}をむしばむ… {c}のダメージ", "The curse eats at {a}... {c} damage", "저주가 {a}을(를) 좀먹는다… {c}의 피해", "诅咒侵蚀着{a}……受到{c}点伤害", "詛咒侵蝕著{a}……受到{c}點傷害"],
    dance: ["{a}はおどっている", "{a} is dancing", "{a}은(는) 춤추고 있다", "{a}在跳舞", "{a}在跳舞"],
    yawn: ["{a}はあくびをしている", "{a} is yawning", "{a}은(는) 하품을 하고 있다", "{a}在打哈欠", "{a}在打哈欠"],
    steal: ["{a}は{b}から{c}ゴールドぬすんだ", "{a} stole {c} gold from {b}", "{a}은(는) {b}에게서 {c} 골드를 훔쳤다", "{a}从{b}那里偷了{c}金币", "{a}從{b}那裡偷了{c}金幣"],
    fire: ["{a}の血がたぎる！", "{a}'s blood is boiling!", "{a}의 피가 끓어오른다!", "{a}热血沸腾！", "{a}熱血沸騰！"],
    snack: ["{a}は薬草をおやつに食べた", "{a} snacked on an herb", "{a}은(는) 약초를 간식으로 먹었다", "{a}把药草当零食吃了", "{a}把藥草當零食吃了"],
    over: ["{a}の冒険はここで終わった", "{a}'s adventure ends here", "{a}의 모험은 여기서 끝났다", "{a}的冒险到此结束了", "{a}的冒險到此結束了"]
  };
  var AREAS = [
    ["はじまりの草原", "Starting Meadow", "시작의 초원", "起始草原", "起始草原"],
    ["まよいの森", "Forest of Wandering", "미혹의 숲", "迷途森林", "迷途森林"],
    ["古代の洞窟", "Ancient Cave", "고대 동굴", "古代洞窟", "古代洞窟"],
    ["氷雪の山", "Frozen Peaks", "빙설의 산", "冰雪山", "冰雪山"],
    ["灼熱の火山", "Blazing Volcano", "작열의 화산", "灼热火山", "灼熱火山"],
    ["魔王城", "Demon King's Castle", "마왕성", "魔王城", "魔王城"]
  ];
  /* 魔物 [形, 色, 名前...] */
  var MON = [
    [["slime", "#3d8bff", "スライム", "Slime", "슬라임", "史莱姆", "史萊姆"], ["bat", "#6b5aa8", "コウモリ", "Bat", "박쥐", "蝙蝠", "蝙蝠"], ["beast", "#9a6a3a", "イノシシ", "Boar", "멧돼지", "野猪", "野豬"]],
    [["slime", "#7bc043", "毒スライム", "Poison Slime", "독 슬라임", "毒史莱姆", "毒史萊姆"], ["beast", "#7d8590", "オオカミ", "Wolf", "늑대", "狼", "狼"], ["ghost", "#9be37a", "鬼火", "Wisp", "도깨비불", "鬼火", "鬼火"]],
    [["skel", "#e8e2d0", "ガイコツ剣士", "Skeleton", "해골 검사", "骷髅剑士", "骷髏劍士"], ["bat", "#a33a6a", "吸血コウモリ", "Vampire Bat", "흡혈박쥐", "吸血蝙蝠", "吸血蝙蝠"], ["ghost", "#c8c8e0", "ゴースト", "Ghost", "유령", "幽灵", "幽靈"]],
    [["beast", "#e8f0ff", "雪オオカミ", "Snow Wolf", "설원 늑대", "雪狼", "雪狼"], ["slime", "#8fe3ff", "アイススライム", "Ice Slime", "아이스 슬라임", "冰史莱姆", "冰史萊姆"], ["golem", "#a8d8f0", "氷のゴーレム", "Ice Golem", "얼음 골렘", "冰魔像", "冰魔像"]],
    [["slime", "#ff6a2a", "溶岩スライム", "Lava Slime", "용암 슬라임", "熔岩史莱姆", "熔岩史萊姆"], ["bat", "#ff9a2a", "ファイアバット", "Fire Bat", "화염 박쥐", "火焰蝙蝠", "火焰蝙蝠"], ["ghost", "#ff5a3a", "炎の亡霊", "Flame Wraith", "화염 망령", "火焰亡灵", "火焰亡靈"]],
    [["skel", "#6a6a80", "デスナイト", "Death Knight", "데스 나이트", "死亡骑士", "死亡騎士"], ["ghost", "#9a5ad0", "悪霊", "Specter", "악령", "恶灵", "惡靈"], ["golem", "#50505a", "鉄の番人", "Iron Warden", "강철 파수꾼", "钢铁守卫", "鋼鐵守衛"]]
  ];
  var BOSS = [
    ["slime", "#2a6ae0", "大スライム", "Giant Slime", "거대 슬라임", "巨型史莱姆", "巨型史萊姆"],
    ["beast", "#4a6a3a", "森の主", "Forest Lord", "숲의 주인", "森林之主", "森林之主"],
    ["golem", "#9a8a6a", "ストーンゴーレム", "Stone Golem", "스톤 골렘", "石魔像", "石魔像"],
    ["dragon", "#cfe8ff", "フロストドラゴン", "Frost Dragon", "프로스트 드래곤", "冰霜巨龙", "冰霜巨龍"],
    ["dragon", "#e03a2a", "レッドドラゴン", "Red Dragon", "레드 드래곤", "赤龙", "赤龍"],
    ["maou", "#5a2a8a", "魔王", "Demon King", "마왕", "魔王", "魔王"]
  ];
  var WEAPONS = [
    null,
    ["銅の剣", "Copper Sword", "구리 검", "铜剑", "銅劍"],
    ["鉄の剣", "Iron Sword", "철 검", "铁剑", "鐵劍"],
    ["鋼の剣", "Steel Sword", "강철 검", "钢剑", "鋼劍"],
    ["銀の剣", "Silver Sword", "은 검", "银剑", "銀劍"],
    ["炎の剣", "Flame Sword", "화염 검", "火焰剑", "火焰劍"],
    ["伝説の剣", "Legendary Sword", "전설의 검", "传说之剑", "傳說之劍"]
  ];
  var ARMORS = [
    null,
    ["革の鎧", "Leather Armor", "가죽 갑옷", "皮甲", "皮甲"],
    ["鎖かたびら", "Chain Mail", "사슬 갑옷", "锁子甲", "鎖子甲"],
    ["鉄の鎧", "Iron Armor", "철 갑옷", "铁铠甲", "鐵鎧甲"],
    ["銀の鎧", "Silver Armor", "은 갑옷", "银铠甲", "銀鎧甲"],
    ["竜の鎧", "Dragon Armor", "용의 갑옷", "龙之铠甲", "龍之鎧甲"],
    ["光の鎧", "Armor of Light", "빛의 갑옷", "光之铠甲", "光之鎧甲"]
  ];
  var W_ATK = [0, 4, 9, 15, 23, 33, 48], A_DEF = [0, 3, 7, 12, 18, 26, 36];
  var PRICE = [0, 40, 130, 380, 900, 2000, 99999];

  /* 名前（カタカナとローマ字の対） */
  var SYL = [["ア", "a"], ["イ", "i"], ["ウ", "u"], ["エ", "e"], ["オ", "o"], ["カ", "ka"], ["キ", "ki"], ["ク", "ku"], ["ケ", "ke"], ["コ", "ko"],
    ["サ", "sa"], ["シ", "shi"], ["ス", "su"], ["セ", "se"], ["ソ", "so"], ["タ", "ta"], ["チ", "chi"], ["ト", "to"], ["ナ", "na"], ["ニ", "ni"],
    ["ノ", "no"], ["ハ", "ha"], ["ヒ", "hi"], ["フ", "fu"], ["ミ", "mi"], ["ム", "mu"], ["メ", "me"], ["ラ", "ra"], ["リ", "ri"], ["ル", "ru"],
    ["レ", "re"], ["ロ", "ro"], ["ガ", "ga"], ["ギ", "gi"], ["グ", "gu"], ["ゼ", "ze"], ["ダ", "da"], ["ド", "do"], ["バ", "ba"], ["ビ", "bi"],
    ["ベ", "be"], ["ボ", "bo"], ["ザ", "za"], ["ジ", "ji"], ["ヴァ", "va"], ["ティ", "ti"], ["ディ", "di"], ["ファ", "fa"]];
  var TAIL = [["ン", "n"], ["ス", "s"], ["ル", "l"], ["ド", "d"], ["ト", "t"], ["", ""], ["", ""], ["", ""]];
  function makeName(rand, li) {
    var n = 2 + Math.floor(rand() * 2), ja = "", ro = "";
    for (var i = 0; i < n; i++) { var s = SYL[Math.floor(rand() * SYL.length)]; ja += s[0]; ro += s[1]; }
    var t = TAIL[Math.floor(rand() * TAIL.length)];
    if (i < 4) { ja += t[0]; ro += t[1]; }
    ro = ro.charAt(0).toUpperCase() + ro.slice(1);
    return li === 0 ? ja : ro;
  }

  /* 難しさ（勝率がごく低くなるように合わせた値） */
  var K = { regen: 0.2, mhp: 4.5, matk: 1.5, mdef: 0.9, mexp: 0.7, bhp: 2.2, alv: 2.2, ex: 2.0, blv: 2, maouLv: 3, maouHp: 2.6, maouAtk: 1.35 };

  /* 性格 [ja, en, ko, zh, tw] */
  var TRAITS = {
    brave: ["ゆうかん", "Brave", "용감", "勇敢", "勇敢"],
    coward: ["おくびょう", "Timid", "겁쟁이", "胆小", "膽小"],
    hasty: ["せっかち", "Hasty", "성급", "急躁", "急躁"],
    lazy: ["のんき", "Easygoing", "느긋", "悠哉", "悠哉"],
    sly: ["ずるがしこい", "Sly", "교활", "狡猾", "狡猾"],
    hot: ["ねっけつ", "Hot-blooded", "열혈", "热血", "熱血"],
    lucky: ["ラッキー", "Lucky", "행운아", "幸运儿", "幸運兒"],
    glutton: ["くいしんぼう", "Glutton", "먹보", "贪吃鬼", "貪吃鬼"]
  };
  /* 職業 [★, 名前5言語, 能力の倍率 hp atk def mag spd luk] */
  /* 職業 [★, 名前(ja,en,ko,zh,tw), 能力の倍率(hp atk def mag spd luk), 見た目の元になる職業] */
  var JOBS = {
    jester: [1, ["遊び人", "Jester", "놀이꾼", "艺人", "藝人"], [0.8, 0.75, 0.7, 0.6, 1.1, 1.6]],
    villager: [1, ["村人", "Villager", "마을 사람", "村民", "村民"], [0.85, 0.8, 0.8, 0.5, 0.9, 1.0]],
    bard: [1, ["吟遊詩人", "Bard", "음유시인", "吟游诗人", "吟遊詩人"], [0.8, 0.7, 0.7, 0.8, 1.0, 1.4], "jester"],
    dancer: [1, ["踊り子", "Dancer", "무희", "舞者", "舞者"], [0.8, 0.75, 0.7, 0.6, 1.3, 1.3], "jester"],
    woodcutter: [1, ["木こり", "Woodcutter", "나무꾼", "樵夫", "樵夫"], [0.95, 0.9, 0.8, 0.4, 0.8, 0.9], "villager"],
    fisher: [1, ["漁師", "Fisher", "어부", "渔夫", "漁夫"], [0.9, 0.8, 0.8, 0.5, 0.9, 1.1], "villager"],
    merchant: [1, ["商人", "Merchant", "상인", "商人", "商人"], [0.85, 0.7, 0.85, 0.5, 0.9, 1.4], "villager"],
    cook: [1, ["料理人", "Cook", "요리사", "厨师", "廚師"], [0.95, 0.75, 0.8, 0.6, 0.9, 1.0], "villager"],
    squire: [1, ["見習い戦士", "Squire", "견습 전사", "见习战士", "見習戰士"], [0.9, 0.9, 0.85, 0.4, 0.9, 0.9], "swordsman"],
    novice: [1, ["見習い魔法使い", "Novice Mage", "견습 마법사", "见习魔法师", "見習魔法師"], [0.75, 0.6, 0.7, 1.1, 0.9, 1.0], "mage"],
    thief: [2, ["盗賊", "Thief", "도적", "盗贼", "盜賊"], [0.9, 0.95, 0.85, 0.6, 1.4, 1.3]],
    fighter: [2, ["武闘家", "Martial Artist", "무도가", "武斗家", "武鬥家"], [1.0, 1.2, 0.9, 0.4, 1.2, 1.0]],
    hunter: [2, ["狩人", "Hunter", "사냥꾼", "猎人", "獵人"], [0.95, 1.05, 0.85, 0.5, 1.25, 1.1], "thief"],
    pirate: [2, ["海賊", "Pirate", "해적", "海盗", "海盜"], [1.0, 1.1, 0.85, 0.4, 1.1, 1.2], "thief"],
    ninja: [2, ["忍者", "Ninja", "닌자", "忍者", "忍者"], [0.85, 1.0, 0.8, 0.7, 1.5, 1.1], "thief"],
    mercenary: [2, ["傭兵", "Mercenary", "용병", "佣兵", "傭兵"], [1.05, 1.1, 1.0, 0.4, 1.0, 0.9], "swordsman"],
    axeman: [2, ["斧使い", "Axe Fighter", "도끼잡이", "斧战士", "斧戰士"], [1.1, 1.2, 0.9, 0.3, 0.9, 0.9], "fighter"],
    monk: [2, ["修道士", "Monk", "수도사", "修道士", "修道士"], [1.0, 0.9, 1.0, 1.0, 1.0, 1.0], "priest"],
    seer: [2, ["占い師", "Fortune Teller", "점술사", "占卜师", "占卜師"], [0.85, 0.7, 0.8, 1.2, 1.0, 1.4], "mage"],
    swordsman: [3, ["剣士", "Swordsman", "검사", "剑士", "劍士"], [1.1, 1.2, 1.1, 0.6, 1.0, 1.0]],
    mage: [3, ["魔法使い", "Mage", "마법사", "魔法师", "魔法師"], [0.9, 0.7, 0.85, 1.6, 1.0, 1.0]],
    priest: [3, ["僧侶", "Priest", "성직자", "僧侣", "僧侶"], [1.05, 0.85, 1.1, 1.35, 0.9, 1.0]],
    samurai: [3, ["侍", "Samurai", "사무라이", "武士", "武士"], [1.1, 1.35, 1.05, 0.5, 1.1, 0.9], "swordsman"],
    spellblade: [3, ["魔法剣士", "Spellblade", "마검사", "魔剑士", "魔劍士"], [1.05, 1.1, 1.05, 1.3, 1.0, 1.0], "swordsman"],
    alchemist: [3, ["錬金術師", "Alchemist", "연금술사", "炼金术师", "鍊金術師"], [0.95, 0.8, 0.95, 1.4, 0.9, 1.3], "mage"],
    summoner: [3, ["召喚士", "Summoner", "소환사", "召唤师", "召喚師"], [0.9, 0.7, 0.85, 1.7, 0.95, 1.0], "mage"],
    brawler: [3, ["格闘王", "Brawler King", "격투왕", "格斗王", "格鬥王"], [1.15, 1.35, 1.0, 0.4, 1.2, 1.0], "fighter"],
    shadow: [3, ["暗殺者", "Assassin", "암살자", "刺客", "刺客"], [1.0, 1.25, 0.95, 0.6, 1.5, 1.2], "thief"],
    knight: [4, ["騎士", "Knight", "기사", "骑士", "騎士"], [1.3, 1.25, 1.35, 0.6, 0.9, 1.0]],
    sage: [4, ["賢者", "Sage", "현자", "贤者", "賢者"], [1.1, 0.9, 1.1, 1.8, 1.1, 1.1]],
    paladin: [4, ["聖騎士", "Paladin", "성기사", "圣骑士", "聖騎士"], [1.3, 1.15, 1.3, 1.1, 0.9, 1.0], "knight"],
    dragoon: [4, ["竜騎士", "Dragoon", "용기사", "龙骑士", "龍騎士"], [1.25, 1.4, 1.2, 0.5, 1.1, 1.0], "knight"],
    swordsaint: [4, ["剣聖", "Sword Saint", "검성", "剑圣", "劍聖"], [1.2, 1.5, 1.15, 0.6, 1.2, 1.0], "swordsman"],
    archmage: [4, ["大魔導士", "Archmage", "대마도사", "大魔导士", "大魔導士"], [1.0, 0.8, 1.0, 2.0, 1.1, 1.1], "sage"],
    fistsaint: [4, ["拳聖", "Fist Saint", "권성", "拳圣", "拳聖"], [1.25, 1.55, 1.1, 0.5, 1.35, 1.0], "fighter"],
    legend: [5, ["伝説の勇者", "Legendary Hero", "전설의 용사", "传说中的勇者", "傳說中的勇者"], [1.45, 1.45, 1.4, 1.4, 1.3, 1.3]],
    dragonslayer: [5, ["竜殺し", "Dragonslayer", "용살자", "屠龙者", "屠龍者"], [1.5, 1.6, 1.4, 1.1, 1.2, 1.2], "legend"],
    heroking: [5, ["勇者王", "Hero King", "용사왕", "勇者王", "勇者王"], [1.55, 1.45, 1.5, 1.3, 1.2, 1.3], "legend"],
    chosen: [5, ["神託の勇者", "Chosen One", "신탁의 용사", "神谕勇者", "神諭勇者"], [1.4, 1.4, 1.35, 1.6, 1.3, 1.4], "legend"]
  };
  function jobBase(cls) { var J = JOBS[cls]; return J && J[3] || cls; }
  /* 呪文のような名前（コードから決まる文字の並び） */
  var KANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわがぎぐげござじずぜぞだでどばびぶべぼぱぴぷぺぽ";
  function jumon(rand, lang) {
    var n, out = "", i;
    if (lang === "ja") {
      n = 3 + Math.floor(rand() * 3);
      for (i = 0; i < n; i++) out += KANA.charAt(Math.floor(rand() * KANA.length));
      return out;
    }
    if (lang === "ko") {
      n = 2 + Math.floor(rand() * 3);
      for (i = 0; i < n; i++) out += String.fromCharCode(0xAC00 + (Math.floor(rand() * 19) * 21 + Math.floor(rand() * 21)) * 28 + (rand() < 0.3 ? 1 + Math.floor(rand() * 27) : 0));
      return out;
    }
    var C = "bcdfghjklmnpqrstvwxyz", V = "aeiouy";
    n = 4 + Math.floor(rand() * 4);
    for (i = 0; i < n; i++) out += (i % 2 ? V : C).charAt(Math.floor(rand() * (i % 2 ? V : C).length));
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  function run(base, opt) {
    opt = opt || {};
    if (opt.K) for (var kk in opt.K) K[kk] = opt.K[kk];
    var rand = rngOf(opt.seed || 1);
    var li = LI[opt.lang] != null ? LI[opt.lang] : 0;
    function w(arr) { return arr[li] || arr[li === 4 ? 3 : 1]; }
    function L(key, a, b, c, d) {
      return w(TX[key]).replace("{a}", a).replace("{b}", b).replace("{c}", c).replace("{d}", d);
    }
    function ri(a, b) { return a + Math.floor(rand() * (b - a + 1)); }
    function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

    var CL = JOBS[base.cls];
    if (CL) {
      var m = CL[2];
      base = { gear: base.gear, hp: Math.round(base.hp * m[0]), atk: base.atk * m[1], def: base.def * m[2], mag: base.mag * m[3], spd: base.spd * m[4], luk: base.luk * m[5], look: base.look, trait: base.trait, name: base.name, cls: base.cls };
    }
    var events = [];
    var area = 0, prog = 0, gold = 0, herbs = 1, wpn = 0, arm = 0;
    var enemies = [];
    var hero = {
      name: base.name || makeName(rand, li), job: "hero", lv: 1,
      mhp: base.hp, hp: base.hp, atk: base.atk, def: base.def, mag: base.mag, spd: base.spd, luk: base.luk,
      g: { hp: 5 + base.hp * 0.12, atk: 1.2 + base.atk * 0.1, def: 0.8 + base.def * 0.1, mag: 0.8 + base.mag * 0.1, spd: 0.5 + base.spd * 0.06 },
      exp: 0, alive: true, look: base.look
    };
    var party = [hero];
    var TR = base.trait || "";
    if (TR === "glutton") herbs = 1;

    /* 召喚のときに持っていた武器（QRから作る）。店や宝箱の武器のほうが強ければそちらを使う */
    var gear = base.gear || { atk: 0, mag: 0, cursed: false, name: "" };
    function atkOf(p) { return p.atk + Math.max(W_ATK[wpn], gear.atk); }
    function magOf(p) { return p.mag + gear.mag; }
    function defOf(p) { return p.def + (p === hero ? A_DEF[arm] : 0); }
    function snap() {
      return {
        p: party.map(function (p) { return { job: p.job, hp: Math.max(0, Math.round(p.hp)), mhp: Math.round(p.mhp), lv: p.lv, alive: p.alive, look: p.look }; }),
        e: enemies.map(function (e) { return { shape: e.shape, color: e.color, hp: Math.max(0, e.hp), mhp: e.mhp, alive: e.alive, boss: e.boss }; })
      };
    }
    function log(k, t, act) {
      var s = snap();
      events.push({ k: k, t: t, area: area, prog: prog, p: s.p, e: s.e, act: act || null, wpn: wpn, gold: gold });
    }
    function expNeed(lv) { return Math.round(6 * Math.pow(lv, 1.6)); }
    function gain(p, ex) {
      if (!p.alive) return;
      p.exp += ex;
      while (p.exp >= expNeed(p.lv)) {
        p.exp -= expNeed(p.lv);
        p.lv++;
        var r = 0.8 + rand() * 0.4;
        p.mhp += Math.round(p.g.hp * r); p.atk += p.g.atk * r; p.def += p.g.def * r; p.mag += p.g.mag * r; p.spd += p.g.spd * r;
        p.atk = Math.round(p.atk * 10) / 10;
        p.hp = Math.min(p.mhp, p.hp + Math.round(p.g.hp * 2));
        log("lv", L("lvup", p.name, "", p.lv), { who: party.indexOf(p) });
      }
    }
    /* 戦闘。全滅か勇者が倒れたら false */
    function battle(list) {
      enemies = list;
      var mname = list[0].name;
      if (list[0].boss) log("boss", L("boss", mname));
      else if (list.length > 1) log("appear", L("appearN", mname, list.length));
      else log("appear", L("appear", mname));
      var hot = false;
      if (TR === "coward" && !list[0].boss && rand() < 0.14) { log("flee", L("flee", hero.name)); enemies = []; return true; }
      for (var round = 0; round < 40; round++) {
        var actors = [];
        party.forEach(function (p) { if (p.alive) actors.push({ p: p, o: p.spd + rand() * 10 + (TR === "hasty" ? 30 : 0) }); });
        enemies.forEach(function (e) { if (e.alive) { actors.push({ e: e, o: e.spd + rand() * 10 }); if (e.twice) actors.push({ e: e, o: e.spd + rand() * 10 - 5 }); } });
        actors.sort(function (a, b) { return b.o - a.o; });
        for (var i = 0; i < actors.length; i++) {
          var A = actors[i];
          var liveE = enemies.filter(function (e) { return e.alive; });
          if (!liveE.length) break;
          if (A.p) {
            if (!A.p.alive) continue;
            if (TR === "hot" && !hot && hero.hp < hero.mhp * 0.4) { hot = true; log("fire", L("fire", hero.name)); }
            partyAct(A.p, liveE, hot);
          } else {
            if (!A.e.alive) continue;
            enemyAct(A.e);
            if (!hero.alive) return false;
          }
        }
        if (!enemies.some(function (e) { return e.alive; })) break;
      }
      if (enemies.some(function (e) { return e.alive; })) return false;
      var ex = 0, gd = 0;
      list.forEach(function (e) { ex += e.exp; gd += e.gold; });
      if (TR === "sly") gd = Math.round(gd * 1.6);
      gold += gd;
      log("won", L("won", "", "", ex, gd));
      if (gear.cursed && hero.alive) {
        var cd = Math.max(1, Math.round(hero.mhp * 0.06));
        hero.hp = Math.max(1, hero.hp - cd);
        log("curse", L("curse", hero.name, "", cd), { at: 0, dmg: cd });
      }
      party.forEach(function (p) { gain(p, ex); if (p.alive) p.hp = Math.min(p.mhp, p.hp + Math.round(p.mhp * (TR === "lazy" ? 0.35 : K.regen))); });
      enemies = [];
      return true;
    }
    function hurtEnemy(e, dmg, k, t, who) {
      e.hp = Math.max(0, e.hp - dmg);
      log(k, t, { who: who, tgt: enemies.indexOf(e), dmg: dmg });
      if (e.hp <= 0 && e.alive) { e.alive = false; log("kill", L("kill", e.name), { tgt: enemies.indexOf(e) }); }
    }
    function partyAct(p, liveE, hot) {
      var who = party.indexOf(p);
      if (jobBase(base.cls) === "jester" && rand() < 0.1) { log("yawn", L("dance", p.name), { who: who }); return; }
      if (TR === "lazy" && rand() < 0.07) { log("yawn", L("yawn", p.name), { who: who }); return; }
      if (TR === "sly" && rand() < 0.1) { var st = ri(3, 10) * (area + 1); gold += st; log("steal", L("steal", p.name, liveE[0].name, st), { who: who }); return; }
      /* 回復 */
      if (p.job === "priest" || (p === hero && magOf(p) > p.atk * 1.2)) {
        var low = party.filter(function (q) { return q.alive && q.hp < q.mhp * 0.45; }).sort(function (a, b) { return a.hp / a.mhp - b.hp / b.mhp; })[0];
        if (low && (p.job === "priest" || rand() < 0.5)) {
          var hv = Math.round(magOf(p) * 2.2 + p.lv * 2 + rand() * 6);
          low.hp = Math.min(low.mhp, low.hp + hv);
          log("heal", L("heal", p.name, low.name, hv), { who: who, heal: party.indexOf(low) });
          return;
        }
      }
      var herbAt = TR === "brave" ? 0.2 : TR === "glutton" ? 0.35 : 0.3;
      if (p === hero && hero.hp < hero.mhp * herbAt && herbs > 0) {
        herbs--;
        var hh = Math.round(hero.mhp * 0.45);
        hero.hp = Math.min(hero.mhp, hero.hp + hh);
        log("heal", L(TR === "glutton" && rand() < 0.5 ? "snack" : "herb", hero.name, "", hh), { who: 0, heal: 0 });
        return;
      }
      var t = pick(liveE);
      if (p.job === "mage" || (p === hero && magOf(p) > p.atk && rand() < 0.45)) {
        if (liveE.length > 1 && (p.job === "mage" || rand() < 0.5)) {
          var da = Math.max(1, Math.round(magOf(p) * (0.9 + rand() * 0.3) - t.def * 0.15));
          log("spell", L("spellAll", p.name, "", da), { who: who, all: 1, dmg: da });
          liveE.forEach(function (e) {
            e.hp = Math.max(0, e.hp - da);
            if (e.hp <= 0) { e.alive = false; log("kill", L("kill", e.name), { tgt: enemies.indexOf(e) }); }
          });
          return;
        }
        var ds = Math.max(1, Math.round(magOf(p) * (1.3 + rand() * 0.4) - t.def * 0.2));
        hurtEnemy(t, ds, "spell", L("spell", p.name, t.name, ds), who);
        return;
      }
      if (rand() < 0.05 - p.spd * 0.0005 + (TR === "hasty" ? 0.08 : 0)) { log("miss", L("miss", p.name), { who: who }); return; }
      var crit = rand() < 0.04 + p.luk * 0.004 + (TR === "brave" ? 0.08 : 0);
      var mul = hot ? 1.12 : 1;
      var d = Math.round(atkOf(p) * mul * (0.85 + rand() * 0.3) - (crit ? 0 : t.def * 0.5));
      if (crit) d = Math.round(atkOf(p) * mul * 1.8);
      d = Math.max(1, d);
      hurtEnemy(t, d, crit ? "crit" : "atk", crit ? L("crit", p.name, t.name, d) : L("atk", p.name, t.name, d), who);
    }
    function enemyAct(e) {
      var live = party.filter(function (p) { return p.alive; });
      var t = rand() < 0.4 && hero.alive ? hero : pick(live);
      var ti = party.indexOf(t);
      if (rand() < Math.min(0.3, t.spd * 0.004 + t.luk * 0.003 + (TR === "coward" ? 0.08 : 0))) { log("dodge", L("dodge", e.name, t.name), { tgt: enemies.indexOf(e), at: ti }); return; }
      var d = Math.max(1, Math.round(e.atk * (0.85 + rand() * 0.3) - defOf(t) * 0.5));
      t.hp = Math.max(0, t.hp - d);
      log("hit", L("eatk", e.name, t.name, d), { tgt: enemies.indexOf(e), at: ti, dmg: d });
      if (t.hp <= 0) { t.alive = false; log("fall", L("fall", t.name), { at: ti }); }
    }
    function monster(def, mlv, boss) {
      var m = {
        shape: def[0], color: def[1], name: def[2 + li] || def[li === 4 ? 5 : 3], boss: !!boss, alive: true,
        mhp: Math.round((8 + mlv * K.mhp) * (boss ? K.bhp : 1) * (0.9 + rand() * 0.2)),
        atk: (3 + mlv * K.matk) * (boss ? 1.2 : 1), def: 1 + mlv * K.mdef, spd: 3 + mlv * 0.7,
        exp: Math.round((4 + mlv * mlv * K.mexp) * (boss ? 4 : 1)), gold: Math.round((2 + mlv * 2.5) * (boss ? 6 : 1))
      };
      m.hp = m.mhp;
      return m;
    }

    log("summon", L("summon", hero.name), { who: 0 });
    if (gear.name) log("gear", L("gear", hero.name, gear.name));
    log("walk", L("depart", hero.name));
    var STEPS = 11;
    for (area = 0; area < 6; area++) {
      log("enter", L("enter", w(AREAS[area])));
      for (var s = 0; s < STEPS; s++) {
        prog = (area * (STEPS + 1) + s) / (6 * (STEPS + 1));
        var mlv = 1 + K.alv * Math.pow(area + s / STEPS, K.ex);
        var r = rand();
        if (r < 0.6) {
          var n = Math.min(4, 1 + Math.floor(rand() * (1.6 + area * 0.45)));
          var def = pick(MON[area]), list = [];
          for (var k = 0; k < n; k++) list.push(monster(def, mlv));
          if (!battle(list)) return finish(false);
        } else if (r < 0.72) {
          var c = rand();
          if (c < 0.12 + hero.luk * 0.004 + (TR === "lucky" ? 0.1 : 0) && wpn < 6) {
            var tier = Math.min(6, Math.max(wpn + 1, area + 1 + (rand() < hero.luk * 0.006 ? 1 : 0)));
            if (area >= 4 && rand() < hero.luk * 0.008) tier = 6;
            wpn = tier;
            log("chest", L("chestE", w(WEAPONS[wpn])));
          } else if (c < 0.45) { herbs++; log("chest", L("chestH")); }
          else { var gg = ri(5, 20) * (area + 1); gold += gg; log("chest", L("chestG", "", "", gg)); }
        } else if (r < 0.8) {
          var td = Math.round(hero.mhp * (0.12 + rand() * 0.15));
          hero.hp = Math.max(1, hero.hp - td);
          log("trap", L("trap", hero.name, "", td), { at: 0, dmg: td });
        } else if (r < 0.87) {
          party.forEach(function (p) { if (p.alive) p.hp = p.mhp; });
          log("spring", L("spring"));
        } else {
          log("walk", party.length > 1 ? L("walk", hero.name) : L("walk1", hero.name));
        }
      }
      prog = (area * (STEPS + 1) + STEPS) / (6 * (STEPS + 1));
      if (area === 5) {
        log("gate", L("gate"));
        log("maou", L("maou", hero.name));
        var mo = monster(BOSS[5], mlv + K.maouLv, true);
        mo.mhp = mo.hp = Math.round(mo.mhp * K.maouHp); mo.atk *= K.maouAtk; mo.twice = true;
        if (!battle([mo])) return finish(false);
        prog = 1;
        log("clear", L("clear"));
        return finish(true);
      }
      if (!battle([monster(BOSS[area], mlv + K.blv, true)])) return finish(false);
      /* 町 */
      log("town", L("town", makeName(rand, li)));
      party.forEach(function (p) {
        if (!p.alive) { p.alive = true; p.hp = p.mhp; log("revive", L("revive", p.name), { who: party.indexOf(p) }); }
        p.hp = p.mhp;
      });
      log("inn", L("inn"));
      if (wpn < 5 && gold >= PRICE[wpn + 1] && W_ATK[wpn + 1] > gear.atk) { gold -= PRICE[wpn + 1]; wpn++; log("buy", L("buy", w(WEAPONS[wpn]))); }
      if (arm < 5 && gold >= PRICE[arm + 1]) { gold -= PRICE[arm + 1]; arm++; log("buy", L("buy", w(ARMORS[arm]))); }
      var hb = Math.min(5, Math.floor(gold / 20));
      if (hb > 0) { herbs += hb; gold -= hb * 20; log("buy", L("buyH", "", "", hb)); }
    }
    return finish(false);

    function finish(win) {
      enemies = enemies.filter(function (e) { return e.alive; });
      if (!win) log("over", L("over", hero.name));
      return { events: events, win: win, area: area, areaName: w(AREAS[Math.min(5, area)]), lv: hero.lv, name: hero.name, prog: prog };
    }
  }

  global.MahoSim = { run: run, AREAS: AREAS, rngOf: rngOf, TRAITS: TRAITS, JOBS: JOBS, jobBase: jobBase, jumon: jumon };
})(typeof window !== "undefined" ? window : globalThis);
