// 人物誌分段揭露（承峰 11/6：「我希望你直接完成這兩項 烘豆……人物誌分段揭露……做完後跑冒煙測試」，D218；
// 承峰 11/5「人物誌放記事本和相簿」D209；文件 docs/人物誌.md 各角色的「分段揭露表」）：
// - 記事本「店裡的熟客」每一位點開是他的人物誌頁（德叔、龍眼、阿哲的阿公、老先生放同一區）；相簿每位熟客那一頁有一個連到人物誌的入口。
// - 每一頁照分段揭露表，在里程碑、回憶照片、信、告別發生時一段一段寫進去（syncProfiles() 記下第幾天寫的）；
//   還沒寫進去的段落不顯示、不寫「還有幾段」、不跳提示框、不催（共同規則「不計數、不催促」）。
// - 秘密不先說：德叔是老先生咖啡店的學徒、琺瑯杯的來歷第一站不寫（Q124）；老先生以已故為準（D208），他的頁只指向信、不新增揭露（Q142 的建議）；
//   凱文在主管叫出名字（kevin2）以前叫「冰美式先生」（D65），店長的事等交鑰匙（handover）才寫（Q145）；予安的阿公在不在世不寫（Q134）。
// - 每一段的字：已上線的句子照抄（標「已上線」），其餘是自行補寫的人物誌頁的字（每一句都標了待定，等承峰審）。
// 存檔第 12 版 save.profiles。純邏輯，不依賴 Three.js 或 DOM。
import { REGULARS } from './story.js';

const ms = (who, n) => (s) => (s.regulars?.[who]?.milestones || []).includes(n);
const photo = (id) => (s) => (s.photos || []).some((p) => p.id === id);
const letter = (id) => (s) => (s.letters || []).some((l) => l.id === id);
const task = (id) => (s) => (s.tasks || []).some((t) => t.id === id);
const farewell = (n) => (s) => (Number(s.farewell?.step) || 0) >= n;
const seen = (s) => !!s.flags?.seenOpening;
const both = (a, b) => (s) => a(s) && b(s);

// 人物誌的頁（記事本裡的順序：熟客在前、見過才列；德叔、龍眼、阿公、老先生在後）
// name(save)：頁的標題（凱文在 kevin2 以前是「冰美式先生」）；segs：分段揭露表的每一段
//   when(save)：寫進去的條件（實際的 id）；text：這一段的字；photo：這一段跟著哪一張回憶照片（相簿的 id，頁上放那張的縮圖，沒有圖用佔位圖）；
//   letter：這一段指向哪一封信（頁上放「重讀」）
export const PROFILES = {
  yuan: {
    name: () => `${REGULARS.yuan.name}（${REGULARS.yuan.short}）`,
    segs: [
      { n: 1, when: ms('yuan', 1), text: REGULARS.yuan.about }, // 已上線（story.js 的 REGULARS.about）
      { n: 2, when: photo('yuan-1'), photo: 'yuan-1',
        text: '在台北的時候，她的工作是替別人寫字。輪到自己的字，反而寫不出來。' }, // 【待定】Q133
      { n: 3, when: ms('yuan', 3),
        text: '她寫的是阿公的龍眼窯。窯熄了以後，阿公就很少說話了。小時候，她常在窯邊等龍眼乾燻好，一等就是一個下午。' }, // 【待定】前半是已上線的內容
      { n: 4, when: photo('yuan-2'), photo: 'yuan-2',
        text: '退稿那天以後，她想過要不要回台北。爸媽在台北，對她留職停薪寫書，一直不太放心。' }, // 【待定】家人
      { n: 5, when: photo('yuan-3'), photo: 'yuan-3',
        text: '她想寫出阿公的窯的味道，寫了很久。後來她說，煙是甜的。' }, // 【待定】
      { n: 6, when: farewell(4), text: '她說，下一本書要寫這間店。' }, // 【待定】尾聲（內容已上線：farewell.js 第 4 段）
    ],
  },
  zhe: {
    name: () => `${REGULARS.zhe.name}（${REGULARS.zhe.short}）`,
    segs: [
      { n: 1, when: ms('zhe', 1), text: REGULARS.zhe.about }, // 已上線
      { n: 2, when: photo('zhe-1'), photo: 'zhe-1',
        text: '本來想留在都市做研究。阿公年紀大了，他才回來。嘴上說是被逼的。' }, // 【待定】Q133
      { n: 3, when: ms('zhe', 3),
        text: '颱風那夜，阿公種了四十年的樹倒了幾棵。他和阿公為了古法吵過很多次。爸媽在外地工作，他是阿公帶大的暑假孩子。' }, // 【待定】前半是已上線的內容；父母 Q133
      { n: 4, when: photo('zhe-2'), photo: 'zhe-2',
        text: '小時候，他在阿公的曬場幫忙翻竹篩，一天翻好幾次。' }, // 【待定】
      { n: 5, when: photo('zhe-3'), photo: 'zhe-3',
        text: '「阿哲的豆」，一半古法、一半新法。以前是阿公的，以後是他自己的。' }, // 【待定】
      { n: 6, when: farewell(5), text: '他要去花蓮舞鶴找學長，看一棵很老的咖啡樹。' }, // 【待定】尾聲（內容已上線：farewell.js 第 5 段）
    ],
  },
  kevin: {
    name: (s) => (ms('kevin', 2)(s) ? `${REGULARS.kevin.name}（${REGULARS.kevin.short}）` : '冰美式先生'),
    segs: [
      { n: 1, when: ms('kevin', 1), text: REGULARS.kevin.about }, // 已上線（記事本原本就寫這句，名字等 kevin2）
      { n: 2, when: both(ms('kevin', 2), photo('kevin-1')), photo: 'kevin-1',
        text: '他叫凱文。在台北的公司寫程式、開會，也在視訊會議上被主管當眾叫名字。' }, // 【待定】工作內容
      { n: 3, when: ms('kevin', 4),
        text: '他也想辭職。會來東山，是因為公司說可以遠端，這裡網路穩，房租也便宜。' }, // 【待定】原因
      { n: 4, when: photo('kevin-2'), photo: 'kevin-2',
        text: '「以後都不用開會了。」怎麼離開那份工作的，他只說了一半。' }, // 【待定】Q138
      { n: 5, when: photo('kevin-3'), photo: 'kevin-3',
        text: '他說，他是不太會生活的人。想在這裡學。' }, // 【待定】
      { n: 6, when: farewell(6), text: '他接下了吧台的鑰匙。龍眼也是。' }, // 【待定】尾聲（店長的事等交鑰匙才寫，Q145）
    ],
  },
  deshu: {
    name: () => '德叔',
    segs: [
      { n: 1, when: seen, text: '咖啡管家。叫你老闆，對每個推門進來的人都說「歡迎回來」。' }, // 【待定】
      { n: 2, when: letter('first'), letter: 'first',
        text: '老先生的信裡叫他「德昌」。他煮咖啡很慢；信上說，他年輕的時候更慢。' }, // 【待定】
      { n: 3, when: ms('zhe', 2), text: '他年輕時喝過阿哲的阿公曬的豆。在哪裡喝到的，他沒說。' }, // 【待定】
      { n: 4, when: task('open-7-days'), text: '打烊以後，他會擦一個舊的琺瑯杯。那個杯子，他不借人。' }, // 【待定】條件用溫度任務「開店滿 7 天」（人物誌.md 第 4 段的選項之一）
      { n: 5, when: farewell(7), text: '最後一晚，他用那個琺瑯杯沖了一杯給老闆，第一次叫了老闆的名字。' }, // 【待定】
    ],
  },
  longan: {
    name: () => '龍眼',
    segs: [
      { n: 1, when: seen, text: '這間三合院本來就有的橘貓。德叔說，他不是我們的，是我們是他的。' }, // 【待定】後半是已上線的內容
      { n: 2, when: letter('first'), letter: 'first', text: '老先生的信裡，要老闆摸摸他。' }, // 【待定】
      { n: 3, when: task('cat-chair'), text: '喜歡還熱著的椅子。點他太多次，他會走開。' }, // 【待定】
      { n: 4, when: ms('kevin', 3), text: '凱文開始帶貓零食來看他。他假裝沒興趣。' }, // 【待定】
      { n: 5, when: farewell(7), text: '他留在東山，睡在凱文腿上。' }, // 【待定】尾聲
    ],
  },
  grandpa: {
    name: () => '阿公（阿哲的阿公）', // 【待定】予安也有一位阿公，只出現在她的話裡（人物誌.md 留意 2）
    segs: [
      { n: 1, when: ms('zhe', 4), text: '東山的老農，只肯用古法日曬，種了四十年的樹。喝一口就說：「這是阮的豆仔。」' }, // 【待定】台詞已上線（劇本原文）
      { n: 2, when: photo('zhe-2'), photo: 'zhe-2', text: '他的曬場上，竹篩一列一列排開，一天要翻好幾次。' }, // 【待定】
      { n: 3, when: ms('zhe', 5), text: '阿哲說，阿公的古法，是他的底。' }, // 【待定】
    ],
  },
  // 老先生以已故為準（D208）：只指向信，不寫他現在在哪裡、不新增揭露（Q142 的建議）
  oldman: {
    name: () => '老先生',
    segs: [
      { n: 1, when: seen, letter: 'lawyer', text: '溫度基金的委託人，已經過世了。條件只有一個：讓店溫暖。' }, // 【待定】內容是律師信
      { n: 2, when: letter('first'), letter: 'first', text: '他留下的第一封信。' }, // 【待定】
      { n: 3, when: letter('second'), letter: 'second', text: '他留下的第二封信。' }, // 【待定】
    ],
  },
};
export const PROFILE_IDS = Object.keys(PROFILES);
export const REGULAR_PROFILES = ['yuan', 'zhe', 'kevin'];
export const OTHER_PROFILES = ['deshu', 'longan', 'grandpa', 'oldman'];

// 人物誌頁上的字（每一句都標了待定）
export const PROFILE_TEXT = {
  sub: '見過的事，慢慢記下來。', // 【待定】人物誌頁標題下的一句
  open: '人物誌', // 【待定】相簿每位熟客那一頁的入口
  reread: '重讀這封信', // 【待定】
  photo: '看這張照片', // 【待定】縮圖的說明（給讀螢幕的人）
  day: (d) => `開店第 ${d} 天`, // 【待定】這一段是哪一天寫進來的（舊存檔升上來時寫進去的不顯示）
};

// 存檔 save.profiles（第 12 版）：got[who] = [{ n, day }]，寫進去的段落與第幾天（0＝舊存檔升上來時補的）
export const blankProfiles = () => ({ got: {} });
const P = (save) => {
  if (!save.profiles || typeof save.profiles !== 'object') save.profiles = blankProfiles();
  if (!save.profiles.got || typeof save.profiles.got !== 'object') save.profiles.got = {};
  return save.profiles;
};

// 把現在已經達到條件、還沒寫進去的段落寫進去（照順序；同一段只寫一次）。回傳這次新寫的 [{ who, n }]
export function syncProfiles(save, day = 0) {
  const got = P(save).got, added = [];
  for (const who of PROFILE_IDS) {
    for (const seg of PROFILES[who].segs) {
      const list = got[who] || [];
      if (list.some((x) => x.n === seg.n) || !seg.when(save)) continue;
      list.push({ n: seg.n, day });
      got[who] = list;
      added.push({ who, n: seg.n });
    }
  }
  return added;
}

// 一頁開了沒：第一段寫進去了（還沒見過的人不列，不劇透）
export const pageOpen = (save, who) => (P(save).got[who] || []).some((x) => x.n === 1);
export const openPages = (save, ids = PROFILE_IDS) => ids.filter((w) => pageOpen(save, w));
export const profileName = (save, who) => PROFILES[who]?.name(save) || '';

// 一頁的內容：寫進去的段落（照段的順序），[{ n, day, text, photo, letter }]；沒寫進去的不出現
export function profilePage(save, who) {
  const prof = PROFILES[who];
  if (!prof || !pageOpen(save, who)) return null;
  const got = P(save).got[who] || [];
  const segs = prof.segs.filter((s) => got.some((x) => x.n === s.n)).map((s) => ({
    n: s.n, day: got.find((x) => x.n === s.n).day, text: s.text, photo: s.photo || '', letter: s.letter || '',
  }));
  return { who, name: prof.name(save), segs };
}

// 測試與校稿用：這個檔案裡所有玩家看得到的字
export function allProfileLines() {
  const s0 = { regulars: { kevin: { milestones: [2] } } };
  const out = [];
  for (const who of PROFILE_IDS) {
    out.push(PROFILES[who].name(s0));
    for (const seg of PROFILES[who].segs) out.push(seg.text);
  }
  out.push(PROFILES.kevin.name({}), PROFILE_TEXT.sub, PROFILE_TEXT.open, PROFILE_TEXT.reread, PROFILE_TEXT.photo, PROFILE_TEXT.day(3));
  return out;
}
