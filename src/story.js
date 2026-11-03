// 三位熟客的故事線：里程碑引擎（劇本「三位熟客」）。
// 每位熟客六個里程碑，以條件觸發（開店天數、來店次數、溫度、前一個里程碑、是否在場），不用固定日程。
// - 可離線的里程碑：老闆不在時，在營業日誌結算時發生並寫進日誌；老闆在店裡時就當場演出。
// - 「在場」里程碑：只在老闆在店裡時演出；老闆不在的日子，日誌只寫一次「想等老闆在」的提示。
// - 每位熟客一天最多一個里程碑；「在場」里程碑全店一天最多演一個（Q7 的暫定做法，決定 D53）。
// 場景（scene）是給 main.js 演出的步驟清單；台詞都放在這裡，方便校稿與測試。
// 純邏輯，不依賴 Three.js 或 DOM。
import { hash01 } from './weather.js';
import { temperature, pending } from './tasks.js';
import * as M from './menu.js';

export const WEEK2 = 8; // 「第 2 週」＝開店第 8 天起（Q7）
export const WEEK3 = 15; // 「第 3 週」＝開店第 15 天起
// 溫度門檻的保底：到了這天，溫度不夠也照樣發生（Q8，決定 D55）
export const FALLBACK_DAY = { yuan5: 16, kevin5: 17, zhe6: 19 };

// rate：平常日子來店的機率（予安整天坐窗邊、凱文每天下午五點、阿哲不固定）；first：第一次來的那天
export const REGULARS = {
  yuan: { name: '林予安', short: '予安', first: 2, rate: 0.85, salt: 101,
    about: '卡稿的作家，34 歲。辦了留職停薪，從台北搬回阿公的三合院寫書。總坐窗邊，只點黑咖啡。' },
  zhe: { name: '陳柏哲', short: '阿哲', first: 1, rate: 0.6, salt: 202,
    about: '返鄉青農，26 歲。農學院畢業後回來接阿公的龍眼園與咖啡園。說話快，鞋子上總是泥。' },
  kevin: { name: '張凱文', short: '凱文', first: 3, rate: 0.9, salt: 303,
    about: '遠距工作的工程師，31 歲。台北公司遠端上班，在東山租了一間老屋。和老闆最像的人。' },
};
export const REGULAR_IDS = ['yuan', 'zhe', 'kevin'];
export const KEVIN_HOUR = 17; // 凱文每天下午五點來

// 菜單（Q1 暫定的菜單風格：在地食材）：品項、黑板與菜單本在 menu.js（D185）。MENU 留著給舊的呼叫端讀名字
export const MENU = M.ITEMS;
export const DEFAULT_MENU = M.START_ITEMS;

// 讀得到的紙本：予安念的稿子、予安的書的扉頁（劇本原文）
export const DOCS = {
  manuscript: { id: 'manuscript', title: '予安的稿子', hand: true,
    paragraphs: ['阿公說，龍眼要燻三日三夜，窯火不能斷，人也不能睡。那三天，是他一年裡最清醒的時候。'] },
  dedication: { id: 'dedication', title: '予安的書・扉頁', hand: true,
    paragraphs: ['給一間讓人敢慢下來的店。'] },
};

// 颱風過後的隔天，日誌多一句 【待定】
export const AFTER_TYPHOON = '颱風過了。台階上都是葉子，我掃了一個早上。';

// 熟客的場景沒有按鈕時，畫面底部的提示（作者已確認，2026-11-02：「什麼都不用做，在這裡就好」，D177）
// 每個熟客場景都顯示，颱風夜也是；里程碑標 noHint: true 的場景不顯示（目前沒有劇情使用）
export const SCENE_HINT = '什麼都不用做，在這裡就好';
export const sceneHint = (m) => (m && !m.noHint ? SCENE_HINT : '');

// 等客人的時候，畫面底部的提示（承峰 11/3 試玩回饋：「要玩家等，但要等啥沒讓玩家知道，會以為當機了」，D179）
// 不催促、不報時間，只讓玩家知道店還活著、有人會來（或今天不會再有人來，也沒關係）。
// approach：有熟客快走到門口（門外同時有腳步聲、門上的鈴輕輕晃）；soon：一分半鐘內有人會來；
// later：今天還有人會來，但還要一陣子；quiet：今天不會再有人來，店裡也沒有人
export const WAIT_HINT = {
  approach: '好像有人往這邊走來了……', // 【待定】
  soon: '店裡很安靜。等一下，也許會有人推門進來', // 【待定】
  later: '晚一點也許還會有人來。想待多久都可以', // 【待定】
  quiet: '今天店裡很安靜。想待多久都可以', // 【待定】
};
export const APPROACH_MS = 7000; // 有人走進門之前幾毫秒開始有腳步聲
export const WAIT_IDLE_MS = 20000; // 坐著、沒有人說話超過這麼久，才把操作說明換成等待的句子
export const WAIT_SOON_MS = 90000;
// 坐著、沒在沖咖啡時的提示：回傳 '' 表示照舊顯示操作說明（左右拖曳環顧四周，點人物可以搭話）
// nextMs：下一位熟客還有幾毫秒走進門（今天沒有人要來是 null）；idleMs：多久沒有人說話；here：店裡有沒有熟客
export function waitHint({ approaching = false, nextMs = null, idleMs = 0, here = false } = {}) {
  if (approaching) return WAIT_HINT.approach;
  if (idleMs < WAIT_IDLE_MS) return '';
  if (nextMs !== null && nextMs <= WAIT_SOON_MS) return WAIT_HINT.soon;
  if (here) return ''; // 有人在店裡：點人物可以搭話，這句比較有用
  return nextMs !== null ? WAIT_HINT.later : WAIT_HINT.quiet;
}

// 場景步驟（main.js 依序演出）：
//   say：角色說話（who 可以是 deshu、yuan、zhe、kevin、grandpa、boss、player）；name：泡泡上的名字（覆寫）
//   wait：停一下（秒）；look：坐著時鏡頭轉向某人；pose：換姿勢；enter／walk／leave：走進來、走到某處、離開
//   arrived：等某人走到位子上；deshuTo／deshuHome：德叔走到某人旁邊、走回吧台（async：不等他走完）；serve：德叔端東西給某人（hot、iced、cocoa）
//   cat：龍眼走到某人身邊（lap：跳上腿）；music：德叔把音樂調小；laugh：笑（輕輕跳兩下）；glance：看一眼
//   weather：天氣變化（颱風）；prop：吧台上多一樣東西
//   needClosing：要老闆按了「打烊」、喝完最後一杯才演（予安念稿）；needSeat：要老闆坐著才演（凱文的問題）
//   choice：畫面下方出現選項（key 存在存檔）；branch：依選項接不同台詞；ifFire：開場選了「單方面辭退」才演
//   read：打開一張紙（予安的稿子、書的扉頁）；brewTaste：德叔在吧台試沖；
//   menu：阿哲的豆收進菜單本，德叔問老闆要不要寫上黑板（Q73 的暫定做法，D186）
//   品項的解鎖不寫在里程碑上：menu.js 的 ITEMS[].from 記著哪個里程碑解鎖哪一樣
const say = (who, text, name) => ({ do: 'say', who, text, ...(name ? { name } : {}) });
const wait = (sec) => ({ do: 'wait', sec });

export const MILESTONES = [
  /* ---------- 林予安：卡稿的作家 ---------- */
  { id: 'yuan1', who: 'yuan', n: 1, present: false,
    when: (c) => c.day >= 2,
    journal: ['窗邊來了一位小姐，筆電開著一頁空白的檔案，從開門坐到打烊。', '她把同一句話刪了三次。'], // 第一句【待定】，第二句劇本原文
    scene: [wait(4), say('deshu', '窗邊那位小姐，從開門就坐在那裡。'), say('deshu', '她把同一句話刪了三次。')] }, // 第一句【待定】
  { id: 'yuan2', who: 'yuan', n: 2, present: false, task: 'yuan-pen', gift: 'napkin',
    when: (c) => c.visits >= 3,
    journal: ['予安小姐的筆電沒電了，跟我借了一支筆，在紙巾上寫了一個下午。', // 【待定】
      '她說：「奇怪，寫在紙巾上反而寫得出來。」', // 劇本原文
      '走的時候，桌上留了一張寫滿字的紙巾。我收在倉庫了。'], // 【待定】
    scene: [say('yuan', '啊……筆電沒電了。'), say('yuan', '德叔，可以跟你借一支筆嗎？'), // 【待定】
      { do: 'deshuTo', who: 'yuan' }, { do: 'pose', who: 'yuan', pose: 'napkin' }, { do: 'deshuHome' }, wait(3),
      say('yuan', '奇怪，寫在紙巾上反而寫得出來。'), wait(2),
      say('deshu', '那張紙巾，她說要留給店裡。我收在倉庫，老闆想擺就擺。')] }, // 【待定】
  { id: 'yuan3', who: 'yuan', n: 3, present: true, task: 'yuan-kiln',
    when: (c) => c.visits >= 6,
    waiting: '予安小姐今天抬頭看了門口好幾次。大概有話，想等老闆在的時候說。', // 【待定】
    scene: [{ do: 'look', who: 'yuan' }, say('yuan', '老闆，我好像一直沒說過我在寫什麼。'), say('yuan', '我在寫我阿公的龍眼窯。'), // 前兩句【待定】
      say('yuan', '窯熄了以後，阿公就很少說話了。我想把那個煙寫回來。'), wait(2)] },
  { id: 'yuan4', who: 'yuan', n: 4, present: true,
    when: (c) => c.day >= WEEK2,
    waiting: '予安小姐今天寫得很少，一直在看手機。好像在等什麼消息。', // 【待定】
    scene: [{ do: 'look', who: 'yuan' }, say('yuan', '……退稿了。'), wait(2), // 【待定】
      say('yuan', '我是不是該回台北上班了。'), { do: 'serve', who: 'yuan', kind: 'cocoa' }, say('deshu', '喝完再想。'), wait(2),
      say('yuan', '……我沒有點這個。'), say('deshu', '我知道。')] }, // 最後兩句【待定】
  { id: 'yuan5', who: 'yuan', n: 5, present: true, task: 'yuan-reading', needClosing: true,
    when: (c) => c.temp >= 30 || c.day >= FALLBACK_DAY.yuan5,
    waiting: '予安小姐今天問我，老闆晚上會不會待到打烊。我說不一定。', // 【待定】
    needClosingHint: '予安小姐說，今天想等打烊以後再走。', // 【待定】老闆在店裡、還沒打烊時德叔說一次
    // 打烊後：老闆按「打烊」、喝完最後一杯，其他客人都走了，予安還在（決定 D57、D78）
    scene: [{ do: 'look', who: 'yuan' },
      say('yuan', '老闆，打烊了，我可以再待一下嗎？'), say('yuan', '我想把稿子念給你聽。只念一小段。'), // 【待定】
      { do: 'choice', key: 'listen', options: ['好，你念。'] }, // 【待定】
      { do: 'pose', who: 'yuan', pose: 'read' }, { do: 'cat', who: 'yuan', lap: false }, { do: 'read', doc: 'manuscript' },
      say('yuan', '……龍眼睡著了。我念得那麼無聊嗎。'), say('yuan', '謝謝你聽完。'), // 【待定】
      { do: 'pose', who: 'yuan', pose: 'type' }, wait(1.5), { do: 'leave', who: 'yuan' }] },
  { id: 'yuan6', who: 'yuan', n: 6, present: true, task: 'yuan-book', gift: 'yuan-book',
    when: (c) => c.day >= WEEK3,
    waiting: '予安小姐今天抱著一個牛皮紙袋來，一直沒打開。她說要等老闆在。', // 【待定】
    scene: [{ do: 'look', who: 'yuan' }, say('yuan', '老闆，書印好了。'), { do: 'pose', who: 'yuan', pose: 'book' }, // 【待定】
      say('yuan', '第一本，想先給這間店。'), { do: 'read', doc: 'dedication' }, // 【待定】
      say('deshu', '這本，我先收進倉庫。老闆想擺在書架上，就擺在書架上。'), // 【待定】
      { do: 'pose', who: 'yuan', pose: 'type' }] },

  /* ---------- 陳柏哲（阿哲）：返鄉青農 ---------- */
  { id: 'zhe1', who: 'zhe', n: 1, present: false, task: 'zhe-longan',
    when: (c) => c.day >= 1,
    journal: ['隔壁龍眼園的阿哲拎了一袋龍眼乾來，放在吧台上。', // 【待定】
      '他說：「我阿公說新店開張要送東西。我是被逼來的。」'], // 劇本原文
    scene: [{ do: 'prop', prop: 'longanBag' }, say('zhe', '我阿公說新店開張要送東西。我是被逼來的。'),
      say('deshu', '替我謝謝阿公。'), say('zhe', '窯烤的，配咖啡剛好。不是我說的，是我阿公說的。')] }, // 後兩句【待定】
  { id: 'zhe2', who: 'zhe', n: 2, present: false,
    when: (c) => c.visits >= 4,
    journal: ['阿哲坐在吧台抱怨他阿公，說咖啡豆只肯日曬，新方法連試都不讓他試。', // 【待定】
      '我跟他說，他阿公曬的豆，我年輕時喝過。', '他說：「蛤？」'], // 劇本台詞改成日誌的口吻
    scene: [say('zhe', '德叔，我跟你說，我阿公喔，咖啡豆只肯日曬。'), // 【待定】
      say('zhe', '我想試蜜處理、試厭氧，他連聽都不聽，說古早就是這樣曬。'), // 【待定】
      say('deshu', '你阿公曬的豆，我年輕時喝過。'), say('zhe', '蛤？'), { do: 'glance', who: 'deshu' }] },
  { id: 'zhe3', who: 'zhe', n: 3, present: true, task: 'typhoon', entrance: true,
    when: (c) => c.day >= WEEK2,
    waiting: '晚上的風很大。阿哲來看了一下天空，說果園的樹要綁一綁。', // 【待定】
    // 颱風夜：天色暗下來、風雨聲，阿哲全身是泥衝進店裡；德叔沒說話，遞毛巾與咖啡
    scene: [{ do: 'look', who: 'window' }, { do: 'weather', weather: 'typhoon' }, wait(3), { do: 'glance', who: 'deshu' }, wait(1.5),
      { do: 'enter', who: 'zhe', at: 'bar', pose: 'muddy', fast: true }, { do: 'look', who: 'zhe' }, say('zhe', '……德叔。'), // 【待定】
      { do: 'deshuTo', who: 'zhe' }, { do: 'pose', who: 'zhe', pose: 'towel' }, { do: 'deshuHome' },
      { do: 'serve', who: 'zhe', kind: 'hot' }, wait(1.5),
      say('zhe', '阿公種了四十年的樹，一個晚上就……'), wait(5)] }, // 停住，沒說完
  { id: 'zhe4', who: 'zhe', n: 4, present: false, task: 'zhe-grandpa', entrance: true, force: true,
    when: (c) => c.on[3] > 0 && c.day >= c.on[3] + 3, // 颱風後 3 天
    journal: ['阿哲帶他阿公來了。阿公坐在角落，喝了一口店裡的東山豆。', // 【待定】
      '阿公說：「這是阮的豆仔。」', // 劇本原文（台語，Q13）
      '祖孫兩個一起笑了。我第一次看到他們一起笑。'], // 【待定】
    scene: [{ do: 'enter', who: 'grandpa', at: 'corner', pose: 'stand', async: true }, { do: 'enter', who: 'zhe', at: 'cornerSide', pose: 'stand' },
      { do: 'arrived', who: 'grandpa' }, { do: 'pose', who: 'grandpa', pose: 'sit' }, { do: 'look', who: 'grandpa' }, { do: 'serve', who: 'grandpa', kind: 'hot' },
      { do: 'deshuHome', async: true }, wait(2.5),
      say('grandpa', '這是阮的豆仔。'), { do: 'laugh', who: ['zhe', 'grandpa'] }, wait(2)] },
  { id: 'zhe5', who: 'zhe', n: 5, present: true,
    when: (c) => c.visits >= 10,
    waiting: '阿哲帶了兩包豆子來，說要等老闆在才打開。', // 【待定】
    scene: [{ do: 'look', who: 'zhe' }, say('zhe', '德叔、老闆，這兩包是我自己處理的第一批。'), // 【待定】
      say('zhe', '一半照阿公的古法日曬，一半是我的新方法。你們喝喝看。'), // 【待定】
      { do: 'brewTaste' }, { do: 'glance', who: 'deshu' },
      say('deshu', '兩種都好。你阿公的是以前，你的是以後。'), { do: 'laugh', who: ['zhe'] }] },
  { id: 'zhe6', who: 'zhe', n: 6, present: false, task: 'zhe-beans',
    when: (c) => c.temp >= 33 || c.day >= FALLBACK_DAY.zhe6,
    journal: ['菜單上多了一杯「阿哲的豆」。', // 劇本原文
      '阿哲看了很久，說：「你確定要寫我的名字？……好啦，寫大一點。」'],
    scene: [say('deshu', '阿哲，菜單上，我想加一杯你的豆。'), // 【待定】
      say('zhe', '你確定要寫我的名字？……好啦，寫大一點。'), { do: 'menu' }] },

  /* ---------- 張凱文（Kevin）：遠距工作的工程師 ---------- */
  { id: 'kevin1', who: 'kevin', n: 1, present: false,
    when: (c) => c.day >= 3,
    journal: ['下午五點，來了一位先生，點了一杯冰美式。開筆電、戴耳機，從頭到尾沒看人。'], // 【待定】（劇本的「冰美式先生今天也來了」放進之後幾天的日誌）
    scene: [wait(2), { do: 'serve', who: 'kevin', kind: 'iced' }, say('deshu', '冰美式。他說，以後每天這個時間都會來。')] }, // 【待定】
  { id: 'kevin2', who: 'kevin', n: 2, present: true, task: 'kevin-scolded',
    when: (c) => c.visits >= 4,
    waiting: '冰美式先生今天一直盯著螢幕，好像在等一場不想開的會。', // 【待定】
    // 視訊會議被主管當眾罵；關掉鏡頭躲到角落；德叔把音樂調小，龍眼跳上他的腿
    scene: [{ do: 'look', who: 'kevin' }, say('boss', '張凱文，這個上禮拜就說好了吧？大家都在等你一個人。', '視訊裡的主管'), // 【待定】
      say('boss', '你到底有沒有在聽？', '視訊裡的主管'), say('kevin', '……是，我馬上改。'), // 【待定】
      { do: 'pose', who: 'kevin', pose: 'closed' }, wait(1.5), { do: 'walk', who: 'kevin', at: 'corner', pose: 'walk', then: 'hide' },
      { do: 'music' }, { do: 'cat', who: 'kevin', lap: true }, wait(2), { do: 'look', who: 'kevin' },
      say('kevin', '……謝謝。我是說貓。'), wait(2)] },
  { id: 'kevin3', who: 'kevin', n: 3, present: false,
    when: (c) => c.visits >= 7,
    journal: ['凱文先生開始帶貓零食來了。', // 劇本
      '他說：「我在台北租的地方不能養。這裡可以嗎？我是說……來這裡看他。」'],
    scene: [{ do: 'cat', who: 'kevin', lap: false }, say('kevin', '我在台北租的地方不能養。這裡可以嗎？'),
      say('kevin', '我是說……來這裡看他。'), say('deshu', '龍眼說可以。')] }, // 最後一句【待定】
  { id: 'kevin4', who: 'kevin', n: 4, present: true, needSeat: true,
    when: (c) => c.day >= WEEK2,
    waiting: '凱文先生今天好像有話想說，但想等老闆在。', // 劇本原文
    needSeatHint: '凱文先生好像有話想問老闆。老闆坐下來，他大概就會過去。', // 【待定】
    scene: [{ do: 'walk', who: 'kevin', at: 'opposite', pose: 'walk', then: 'free' }, { do: 'look', who: 'kevin' },
      say('kevin', '老闆，可以坐這裡嗎？'), // 【待定】
      say('kevin', '你當初怎麼敢辭職的？'),
      // 玩家從三句話選一句回答（不影響結果）【待定】三個回答與凱文的反應
      { do: 'choice', key: 'kevinQuit', options: ['其實沒有很敢。那天剛好寫完了。', '有人寄了一把鑰匙給我。', '我想坐在自己會想去的店裡。'] },
      { do: 'branch', key: 'kevinQuit', cases: [
        [say('kevin', '剛好寫完……我那封寫了三年，還沒寫完。')],
        [say('kevin', '鑰匙啊。我也想要一把。')],
        [say('kevin', '自己會想去的店……我好像沒想過，我想去哪裡。')],
      ] },
      // 開場選了「從今天起，我單方面辭退您」：多一句
      { do: 'ifFire', steps: [say('player', '辭呈最後一句，我寫「從今天起，我單方面辭退您」。'), say('kevin', '你真的這樣寫？'), // 玩家那句【待定】
        say('kevin', '……我也想寫一次看看。')] }, // 【待定】
      wait(1.5), { do: 'walk', who: 'kevin', at: 'home', pose: 'walk' }] },
  { id: 'kevin5', who: 'kevin', n: 5, present: false, task: 'kevin-no-laptop', arrivePose: 'free',
    when: (c) => c.temp >= 31 || c.day >= FALLBACK_DAY.kevin5,
    journal: ['凱文先生今天沒帶筆電，點了一杯熱的。', '他說：「今天不用開會。以後都不用了。」'], // 劇本
    scene: [wait(1.5), { do: 'serve', who: 'kevin', kind: 'hot' }, { do: 'look', who: 'kevin' }, say('kevin', '今天不用開會。以後都不用了。')] },
  { id: 'kevin6', who: 'kevin', n: 6, present: true,
    when: (c) => c.day >= WEEK3,
    waiting: '凱文先生今天在門口站了很久，看著山。他說等老闆在再說。', // 【待定】
    scene: [{ do: 'look', who: 'kevin' }, say('kevin', '老闆，我想留在東山。'), say('kevin', '可是我不知道，在這裡能做什麼。'), // 前兩句【待定】
      say('kevin', '我會寫程式，會開會，會被罵。就是不會生活。'), { do: 'serve', who: 'kevin', kind: 'hot' }, wait(2)] },
];

const BY_ID = new Map(MILESTONES.map((m) => [m.id, m]));
export const milestoneById = (id) => BY_ID.get(id);

// 點熟客搭話的台詞（依故事進度）。【待定】除了予安原型就有的四句，其他都是自行補寫
export const TALK = {
  yuan: [
    { lines: ['這句我又刪掉了。', '窗外那片山，今天的顏色很好看。', '再一杯黑咖啡，我就寫得出來。', '我阿公以前也在這條路上烤龍眼。'] },
    { after: 3, lines: ['今天寫了兩頁。龍眼窯那段，還是寫不好。', '阿公以前說，窯火要用龍眼木，煙才會甜。'] },
    { after: 6, lines: ['下一本要寫什麼，我還不知道。先坐著。', '書店說要辦簽書會。我比較想在這裡辦。'] },
  ],
  zhe: [
    { lines: ['我阿公叫我來看看你們缺什麼。我是被逼來的。', '今天果園的龍眼開花了，整片都是蜂。', '德叔，你們的豆子是哪一區的？……我只是問問。'] },
    { after: 2, lines: ['德叔，你真的喝過我阿公的豆？什麼時候？', '我阿公的日曬是曬在竹篩上，一天要翻好幾次。'] },
    { after: 3, lines: ['倒的那幾棵，阿公說要留著當柴。', '颱風那天，謝謝你們開著燈。'] },
    { after: 5, lines: ['新方法那包，我再調一下發酵的時間。', '阿公現在會問我，今天的豆子怎麼樣。'] },
  ],
  kevin: [
    { lines: ['……抱歉，我在開會。', '嗯？喔，冰美式，謝謝。', '這裡的網路比台北的辦公室穩。'] },
    { after: 2, lines: ['龍眼今天有來找我。', '我把會議的鏡頭關掉了。看山比較好。'] },
    { after: 5, lines: ['原來下午五點的山，是這個顏色。', '今天沒有會。我不太習慣。'] },
  ],
};

// 熟客「見過了沒」（給營業日誌挑句子用）：第一個里程碑發生在那天以前
export function metOn(save, day) {
  const on = (who, n) => { const d = save.regulars[who]?.on?.[n]; return d > 0 && d <= day; };
  return { yuan: on('yuan', 1), zhe: on('zhe', 1), kevin: on('kevin', 1), kevinFree: on('kevin', 5) };
}

const seedOf = (save) => (Number(save.createdAt) || 0) % 2147483647;
const R = (save, who) => save.regulars[who];
export const hasMilestone = (save, who, n) => (R(save, who)?.milestones || []).includes(n);

// 下一個還沒發生的里程碑（里程碑一定照順序，前一個沒發生，後一個不會發生）
export function nextMilestone(save, who) {
  const done = R(save, who).milestones;
  return MILESTONES.find((m) => m.who === who && !done.includes(m.n)) || null;
}

// 判定用的溫度：已完成的任務，加上條件已經達成、這次結算會一起完成的任務
export function projectedTemp(save, day) {
  return Math.round((temperature(save) + pending(save, { daysOpen: day }).reduce((s, t) => s + t.temp, 0)) * 10) / 10;
}

export function ctxOf(save, who, day) {
  const r = R(save, who);
  return { day, visits: r.visits, temp: projectedTemp(save, day), on: r.on };
}
export const isDue = (save, m, day) => !!m && m.when(ctxOf(save, m.who, day));

// 這位熟客這天平常會不會來（同一天永遠是同樣的結果）
export function scheduled(save, who, day) {
  const info = REGULARS[who];
  if (day < info.first) return false;
  if (!hasMilestone(save, who, 1)) return true; // 第一次來（里程碑 1）
  const m = nextMilestone(save, who);
  if (m && m.force && !m.present && isDue(save, m, day)) return true; // 例如阿哲帶阿公來的那天
  if (day - R(save, who).lastVisit >= 3) return true; // 熟客不會連續兩天以上沒來（決定 D54）
  return hash01(seedOf(save), day, info.salt) < info.rate;
}

// 里程碑發生：記進存檔，並處理解鎖（擺飾收進倉庫、品項收進菜單本、颱風那天）
// 回傳 false＝已經發生過；不然回傳這次解鎖的品項 [{ id, boarded }]（陣列，可能是空的）
export function complete(save, m, day, t = 0) {
  const r = R(save, m.who);
  if (r.milestones.includes(m.n)) return false;
  r.milestones.push(m.n);
  r.on[m.n] = day;
  r.lastMilestoneDay = day;
  if (m.present) save.story.lastPresentDay = day;
  if (m.gift && !save.owned.some((o) => o.item === m.gift)) save.owned.push({ uid: save.nextUid++, item: m.gift, placed: false, x: 0, z: 0 });
  const got = M.unlockFrom(save, m.id, day, t);
  // 劇情裡熟客已經看過它寫上黑板（阿哲第一幕的龍眼乾、第六幕的阿哲的豆），之後不再補一次「第一次寫上黑板」的反應
  for (const g of got) if (g.boarded) M.markNoticed(save, g.id, m.who);
  if (m.id === 'zhe3') save.story.typhoonDay = day;
  return got;
}

// 老闆不在的日子：一天一天結算到 upto（含）。熟客來店次數照常累計；
// 可離線的里程碑當天發生並寫進日誌，「在場」里程碑只寫一次「想等老闆在」的提示。
// 回傳日誌要寫的句子：[{ day, line, kind: 'milestone' | 'waiting' | 'note', id }]
export function settleThrough(save, upto) {
  const events = [];
  const from = Math.min(...REGULAR_IDS.map((w) => R(save, w).settled)) + 1;
  for (let d = from; d <= upto; d++) {
    for (const who of REGULAR_IDS) {
      const r = R(save, who);
      if (r.settled >= d) continue;
      r.settled = d;
      if (!scheduled(save, who, d)) continue;
      r.visits++;
      r.lastVisit = d;
      const m = nextMilestone(save, who);
      if (!m || r.lastMilestoneDay === d || !isDue(save, m, d)) continue;
      if (!m.present) {
        const got = complete(save, m, d);
        for (const line of m.journal) events.push({ day: d, line, kind: 'milestone', id: m.id });
        // 收進菜單本的東西：德叔在日誌寫一句（之後老闆在店裡時就不再說）
        for (const g of got) {
          const line = M.tellLine(save, g.id);
          M.markTold(save, g.id);
          if (line) events.push({ day: d, line, kind: 'menu', id: g.id });
        }
      } else if (!save.story.hinted.includes(m.id)) {
        save.story.hinted.push(m.id);
        events.push({ day: d, line: m.waiting, kind: 'waiting', id: m.id });
      }
    }
    if (save.story.typhoonDay && d === save.story.typhoonDay + 1) events.push({ day: d, line: AFTER_TYPHOON, kind: 'note' });
  }
  return events;
}

// 老闆在店裡的這一天：誰會來。already＝今天已經來過了（同一天重新整理）
export function planToday(save, day) {
  const out = [];
  for (const who of REGULAR_IDS) {
    const r = R(save, who);
    if (r.lastVisit === day) { out.push({ who, already: true }); continue; }
    if (r.settled >= day) continue; // 這天已經結算過（不會發生在老闆在的日子，保險起見）
    const m = nextMilestone(save, who);
    const wants = m && m.present && isDue(save, m, day) && day >= REGULARS[who].first; // 有話想等老闆在的人，今天一定來
    if (scheduled(save, who, day) || wants) out.push({ who, already: false, milestone: m && isDue(save, m, day) ? m.id : null });
  }
  return out;
}

// 熟客走進店裡：記一次來店（同一天只記一次）
export function arrive(save, who, day) {
  const r = R(save, who);
  if (r.lastVisit === day) return false;
  r.visits++;
  r.lastVisit = day;
  r.settled = Math.max(r.settled, day);
  return true;
}

// 老闆在店裡時，這位熟客現在可以演的里程碑（沒有就回傳 null）
// 規則：人要在店裡、這位熟客今天還沒有里程碑、條件達成；「在場」里程碑全店一天一個
export function liveNext(save, who, day) {
  const r = R(save, who);
  if (r.lastVisit !== day || r.lastMilestoneDay === day) return null;
  const m = nextMilestone(save, who);
  if (!isDue(save, m, day)) return null;
  if (m.present && save.story.lastPresentDay === day) return null;
  return m;
}

// 凱文下午五點才來：現在離他來還有幾毫秒（已經過了五點就是 0）
export function kevinWaitMs(date) {
  const five = new Date(date.getFullYear(), date.getMonth(), date.getDate(), KEVIN_HOUR).getTime();
  return Math.max(0, five - date.getTime());
}

// 測試與校稿用：所有寫得出來的台詞
export function allLines() {
  const out = [];
  const walk = (steps) => {
    for (const s of steps) {
      if (s.text) out.push(s.text);
      if (s.options) out.push(...s.options);
      if (s.cases) s.cases.forEach(walk);
      if (s.steps) walk(s.steps);
    }
  };
  for (const m of MILESTONES) {
    out.push(...(m.journal || []));
    if (m.waiting) out.push(m.waiting);
    if (m.needSeatHint) out.push(m.needSeatHint);
    if (m.needClosingHint) out.push(m.needClosingHint);
    walk(m.scene);
  }
  out.push(...Object.values(WAIT_HINT));
  for (const list of Object.values(TALK)) for (const t of list) out.push(...t.lines);
  out.push(AFTER_TYPHOON, ...Object.values(DOCS).flatMap((d) => d.paragraphs));
  return out;
}
