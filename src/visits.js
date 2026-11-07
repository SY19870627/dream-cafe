// 熟客的來訪段落（文本與關係鋪陳，提案 _agent/relationship-proposal-a161cf1.md 與補稿 relationship-drafts-zhe-kevin.md，
// 依 fable（claude-fable-5-1）審稿 _agent/fable-relationship-review.md 全部建議改過；採納清單見 _agent/fable-applied-summary.md）：
// - 陌生 → 點單寒暄 → 閒聊 → 自己說出身世 → 熟了以後才請咖啡。予安前 4 次＋第 5 次與 yuan3、阿哲到 zhe2、凱文到 kevin3 的鋪陳。
// - 段落綁在「兩個里程碑之間的窗口」，不是綁在次數（fable 第四節 1）：窗口關了（下一個里程碑已經發生）就跳過，不補演、不在日誌倒播。
// - 里程碑當天的擴寫（kind: 'with'）：老闆坐著時取代那個里程碑的場景；原場景的每一句 say 照順序都在裡面（單元測試檢查子序列）。
//   老闆站著、或里程碑離線發生時，照舊演原場景、寫日誌（條件、順序一字不改）。
// - 接回（kind: 'reconnect'）：yuan2、zhe2、kevin3 沒有在老闆坐著時演到擴寫版，之後第一次見到他時演一段短的接回（zhe2、kevin3 結尾一樣問第一杯）。
// - 第一杯（最愛第一段）延到 yuan3／zhe2／kevin3 之後開放（favorites.js 的 after），在那一段的末尾用選項自然邀請一次（invite）。
// - 每位熟客一天最多一段、全店一天最多兩段；在場的里程碑（含同日擴寫）算一段（fable 第四節 10），里程碑本身也受這個上限（承峰採用預設）：
//   今天這位熟客已經有一段、或全店已經兩段時，那個里程碑今天不開始演（milestoneRoom()）：不記完成、不給獎勵、不跳過，
//   條件、順序、獎勵一字不改，只是開始演的那一刻延到下一個有份量的遊玩日；老闆不在的日子照舊由營業日誌結算（story.js 的 settleThrough()）。
//   所以擴寫與結尾的第一杯不會因為份量滿了消失（有份量時里程碑和擴寫一起演；沒份量時兩個都等）。
// - yuan3 演過、結尾的第一杯卻沒問到（選項出來前重新整理、換了一天等）：之後第一次見到她時的短接回（yuan-r3），只補那個邀請，
//   用 yuan-v6 結尾那一組選項與分支（fable 審過），不另寫新句、不重演 yuan3。
// - 閒聊只在老闆坐著時演（推近鏡頭只在坐著時有）；站著時德叔提一次「先坐。」（開場原句）。
// - 點熟客時「請德叔端一杯」的選項：每位熟客一天只主動問一次（offered）。
// 步驟沿用 story.js 的格式（say／look／wait／glance／pose／deshuTo／deshuHome／serve／choice／branch／laugh），只多幾種：
//   choice 的 speak：選了以後，老闆那句以「你」的泡泡說出來（括號開頭的「（點點頭）」這種不出泡泡，fable 第四節 8）
//   when：只在某個狀態下演（catSill＝龍眼此刻在窗台上，peeked／!peeked＝第一天門口那位小姐的小段落演過沒，met／!met＝予安說過名字沒）
//     條件的判斷在 condOk()（main.js 傳進來龍眼在不在窗台）
//   mark：記一件事（flag: 'metYuan' 予安說出名字；early: 'd2-refill' 第二杯在段落裡演過，前三天的小段落不再演）
//   catMove：龍眼在窗台上的小動作（不離開窗台，Q64）
// 存檔第 13 版的 rel（save.js）。純邏輯，不依賴 Three.js 或 DOM；不 import story.js（story.js 的 allLines() 讀這裡）。
// 新寫的句子全部【待定】；標【原句】的是已上線的句子，一字不改搬進來。
import * as FV from './favorites.js';
import * as M from './menu.js';

export const REL_IDS = ['yuan', 'zhe', 'kevin'];
export const DAY_CAP = 2; // 全店一天最多兩段（含在場的里程碑）
export const SEAT_HINT = '先坐。'; // 開場原句（德叔），閒聊要老闆坐著時提一次
export const YUAN_STRANGER = '窗邊的小姐'; // 予安說出名字以前，泡泡上的名字【待定】（提案原則 4）

const say = (who, text) => ({ do: 'say', who, text });
const wait = (sec) => ({ do: 'wait', sec });
const look = (who) => ({ do: 'look', who });
const choice = (key, options) => ({ do: 'choice', key, options, speak: true });
const branch = (key, ...cases) => ({ do: 'branch', key, cases });
const when = (cond, steps) => ({ do: 'when', if: cond, steps });

// 段落：id、who、kind（with＝里程碑當天的擴寫；visit＝里程碑之間；reconnect＝離線發生之後的接回）
//   with：取代哪一個里程碑的場景（id）；after／before：窗口（第幾個里程碑發生之後、第幾個發生之前）；of：接回哪一個里程碑
//   invite：結尾的第一杯 { options（第一個是請）, yes, no, missing（黑板上沒有那一杯）, drink, any（喝的不限）, need（黑板上要有的點心） }
export const SEGMENTS = [
  /* ---------- 林予安 ---------- */
  // 第 1 次｜陌生（與 yuan1 同天）
  { id: 'yuan-v1', who: 'yuan', kind: 'with', with: 'yuan1', steps: [
    when('peeked', [say('deshu', '昨天在門口看了很久的那位小姐，今天一開門就進來了。')]), // 【待定】
    when('!peeked', [say('deshu', '窗邊來了一位小姐。一開門就進來了。')]), // 【待定】
    { do: 'deshuTo', who: 'yuan' },
    say('deshu', '要喝什麼？慢慢看。'), // 【待定】
    say('yuan', '……黑咖啡。'), // 【待定】
    say('deshu', '熱的？'), // 【待定】
    say('yuan', '嗯。謝謝。'), // 【待定】
    { do: 'deshuHome' }, { do: 'serve', who: 'yuan', kind: 'hot' }, { do: 'deshuHome' }, { do: 'pose', who: 'yuan', pose: 'type' },
    say('deshu', '她只看了黑板一眼，就知道要什麼。'), // 【待定】
    wait(3),
    say('yuan', '……不對。'), // 【待定】小聲，對著螢幕
    choice('vYuan1Note', ['她好像在寫東西。', '我們小聲一點。']), // 【待定】
    branch('vYuan1Note',
      [say('deshu', '打字的聲音，停停走走。')], // 【待定】
      [say('deshu', '嗯。')]), // 【待定】
    wait(4), look('yuan'),
    say('deshu', '窗邊那位小姐，從開門就坐在那裡。'), // 【原句】yuan1
    say('deshu', '她把同一句話刪了三次。'), // 【原句】劇本
    when('catSill', [say('deshu', '龍眼在窗台上睡，她在窗台下面寫。')]), // 【待定】
    choice('vYuan1Stay', ['讓她坐到打烊吧。']), // 【待定】
    say('deshu', '本來就是這樣。'), // 【待定】
  ] },
  // 第 2 次｜點單寒暄（yuan1 之後、yuan2 之前）
  { id: 'yuan-v2', who: 'yuan', kind: 'visit', after: 1, before: 2, steps: [
    look('yuan'),
    say('deshu', '她又坐窗邊了。'), // 【待定】
    { do: 'deshuTo', who: 'yuan' },
    say('deshu', '一樣？'), // 【待定】
    say('yuan', '嗯。一樣。'), // 【待定】
    { do: 'serve', who: 'yuan', kind: 'hot' },
    say('deshu', '這位是老闆。店，是老闆的。'), // 【待定】
    choice('vYuan2Hello', ['你好，慢慢坐。', '（點點頭）']), // 【待定】
    branch('vYuan2Hello',
      [when('!met', [say('yuan', '……啊，你好。我叫予安，常坐在這裡寫稿。'), { do: 'mark', flag: 'metYuan' }]), // 【原句】原本第一次點她時說的那句（main.js talkTo），搬到這裡；舊存檔已經聽過就不再說
        say('player', '想坐多久都可以。'), // 【待定】
        say('yuan', '……謝謝。我會小聲一點打字。')], // 【待定】
      [say('yuan', '……你好。'), // 【待定】
        say('deshu', '點過頭了。在這裡，這樣就算打過招呼。')]), // 【待定】
    { do: 'deshuHome' }, { do: 'pose', who: 'yuan', pose: 'type' }, wait(5),
    say('yuan', '這句我又刪掉了。'), // 【原句】TALK
    say('deshu', '那一句，她打了很久。'), // 【待定】
    wait(4), { do: 'serve', who: 'yuan', kind: 'hot' }, { do: 'mark', early: 'd2-refill' },
    say('yuan', '謝謝。'), // 【待定】
    say('yuan', '窗外那片山，今天的顏色很好看。'), // 【原句】TALK
    choice('vYuan2Hill', ['下午會更好看。', '（一起看一下窗外）']), // 【待定】
    branch('vYuan2Hill',
      [say('yuan', '那我等到下午。')], // 【待定】
      [look('window'), wait(3), say('yuan', '……嗯。')]), // 【待定】
    { do: 'deshuHome' },
    say('deshu', '她今天，多說了一句。'), // 【待定】
  ] },
  // 第 3 次｜閒聊的開始（與 yuan2 借筆同天）
  { id: 'yuan-v3', who: 'yuan', kind: 'with', with: 'yuan2', steps: [
    { do: 'deshuTo', who: 'yuan' },
    say('deshu', '黑的。'), // 【待定】
    say('yuan', '嗯。……謝謝德叔。'), // 【待定】
    { do: 'serve', who: 'yuan', kind: 'hot' }, { do: 'deshuHome' }, { do: 'pose', who: 'yuan', pose: 'type' }, wait(6),
    say('yuan', '啊……筆電沒電了。'), // 【原句】yuan2
    choice('vYuan3Plug', ['吧台那邊有插座嗎？', '（看向德叔）']), // 【待定】
    branch('vYuan3Plug',
      [say('deshu', '插座在吧台底下，線拉不過去。')], // 【待定】
      [{ do: 'glance', who: 'deshu' }]),
    say('yuan', '德叔，可以跟你借一支筆嗎？'), // 【原句】yuan2
    { do: 'deshuTo', who: 'yuan' }, { do: 'pose', who: 'yuan', pose: 'napkin' }, { do: 'deshuHome' },
    say('deshu', '紙巾是她自己拿的。我沒說可以，也沒說不行。'), // 【待定】
    wait(3),
    say('yuan', '奇怪，寫在紙巾上反而寫得出來。'), // 【原句】劇本
    choice('vYuan3Napkin', ['那就多拿幾張。', '寫得出來就好。']), // 【待定】
    branch('vYuan3Napkin',
      [say('yuan', '……那我不客氣了。')], // 【待定】
      [say('yuan', '嗯。……今天好像可以。')]), // 【待定】
    wait(4),
    say('yuan', '這張……可以留在店裡嗎？'), // 【待定】
    say('deshu', '那張紙巾，她說要留給店裡。我收在倉庫，老闆想擺就擺。'), // 【原句】yuan2
    say('deshu', '寫滿了。背面也是。'), // 【待定】
    wait(3),
    say('yuan', '德叔，筆可以先借我到打烊嗎？'), // 【待定】
    say('deshu', '不用還。'), // 【待定】
  ] },
  // yuan2 沒有演到擴寫版（離線、或老闆站著）：之後第一次見到她時的接回（取代第 3 次）
  { id: 'yuan-r2', who: 'yuan', kind: 'reconnect', of: 'yuan2', after: 2, before: 3, steps: [
    look('yuan'),
    say('deshu', '那天的紙巾，我收在倉庫了。'), // 【待定】
    say('yuan', '……那天寫的，我後來都打進去了。'), // 【待定】
  ] },
  // 第 4 次｜閒聊（問她才答，說到一半停住；yuan2 之後、yuan3 之前）
  { id: 'yuan-v4', who: 'yuan', kind: 'visit', after: 2, before: 3, steps: [
    look('yuan'),
    say('deshu', '她今天寫得比較多。打字的聲音，沒有停。'), // 【待定】
    choice('vYuan4Ask', ['德叔，她在寫什麼？', '那就別打擾她。']), // 【待定】
    branch('vYuan4Ask',
      [say('deshu', '我沒問。她的事，等她想說再說。')], // 【待定】
      [say('deshu', '嗯。')]), // 【待定】
    wait(5),
    say('yuan', '……德叔，可以再一杯嗎？'), // 【待定】
    say('deshu', '黑的。'), // 【待定】
    { do: 'serve', who: 'yuan', kind: 'hot' },
    say('yuan', '謝謝。'), // 【待定】
    choice('vYuan4Write', ['今天寫得順嗎？', '窗邊會不會太亮？']), // 【待定】
    branch('vYuan4Write',
      [say('yuan', '……比昨天多一頁。'), // 【待定】
        say('yuan', '不過明天，大概又會刪掉。')], // 【待定】
      [say('yuan', '剛好。亮一點，比較不會睡著。'), // 【待定】
        say('yuan', '……我是說，不是這間店讓人想睡。')]), // 【待定】
    { do: 'deshuHome' }, look('window'),
    say('player', '這條路兩邊，都是龍眼樹。'), // 【待定】fable 換時機：老闆先說，她才接（不碰「第六次來才第一次主動開口」）
    look('yuan'),
    say('yuan', '我阿公以前也在這條路上烤龍眼。'), // 【原句】TALK
    choice('vYuan4Longan', ['烤龍眼？', '（等她說下去）']), // 【待定】
    branch('vYuan4Longan',
      [say('yuan', '……嗯。很久以前了。')], // 【待定】
      [wait(3), say('yuan', '……沒事。我繼續寫。')]), // 【待定】
    { do: 'pose', who: 'yuan', pose: 'type' },
    say('deshu', '她說到一半，自己停了。'), // 【待定】
    say('deshu', '沒關係。話說到一半的人，通常還會回來說完。'), // 【待定】全篇只用這一次；yuan3 的「她說完了。」兌現
    wait(4),
    say('yuan', '……這段，先留著。'), // 【待定】
    when('catSill', [{ do: 'catMove', kind: 'roll' }, say('deshu', '龍眼在窗台上翻了個身。他也在等。')]), // 【待定】
  ] },
  // 第 5 次｜閒聊（yuan3 前一次）
  { id: 'yuan-v5', who: 'yuan', kind: 'visit', after: 2, before: 3, steps: [
    { do: 'serve', who: 'yuan', kind: 'hot' },
    say('deshu', '第二杯。'), // 【待定】
    say('yuan', '……謝謝。'), // 【待定】
    { do: 'deshuHome' }, wait(3),
    say('yuan', '紙巾上的，打進去就不對了。'), // 【待定】看著紙巾，又看筆電
    choice('vYuan5Napkin', ['那就先寫在紙巾上。', '（點點頭）']), // 【待定】
    branch('vYuan5Napkin',
      [say('yuan', '……嗯。德叔，紙巾可以再給我幾張嗎？'), // 【待定】
        say('deshu', '整包。')], // 【待定】
      [say('yuan', '……嗯。')]), // 【待定】
    say('deshu', '她今天，抬頭看了門口兩次。'), // 【待定】
  ] },
  // 第 6 次｜yuan3：原句 3 句之後，德叔「她說完了。」（fable 換時機：兩個分支都聽得到），再自然問第一杯
  { id: 'yuan-v6', who: 'yuan', kind: 'with', with: 'yuan3', steps: [
    look('yuan'),
    say('yuan', '老闆，我好像一直沒說過我在寫什麼。'), // 【原句】yuan3
    say('yuan', '我在寫我阿公的龍眼窯。'), // 【原句】yuan3
    say('yuan', '窯熄了以後，阿公就很少說話了。我想把那個煙寫回來。'), // 【原句】yuan3
    wait(2),
    say('deshu', '她說完了。'), // 【待定】
  ], invite: { drink: 'black',
    options: ['再一杯黑咖啡？我請。', '慢慢寫。'], // 【待定】
    yes: [say('yuan', '……好。謝謝老闆。')], // 【待定】
    no: [say('yuan', '……嗯。謝謝你聽。')], // 【待定】
    missing: [say('yuan', '……好。謝謝老闆。'), say('deshu', '黑板上現在沒有這一杯。老闆，要端哪一杯？')] } }, // 【待定】黑板上沒有黑咖啡時
  // yuan3 已經發生、結尾的第一杯沒有問到（rel.invited 沒有予安、第一段還沒找到）：之後第一次見到她時只補那個邀請。
  // 沒有新句：選項與分支就是 yuan-v6 的 invite（uninvited：窗口看「問過沒」，不看擴寫版演過沒）
  { id: 'yuan-r3', who: 'yuan', kind: 'reconnect', of: 'yuan3', uninvited: true, after: 3, before: 4, steps: [
    look('yuan'),
  ], invite: 'yuan-v6' },

  /* ---------- 陳柏哲（阿哲） ---------- */
  // 第 1 次｜陌生（與 zhe1 同天）
  { id: 'zhe-v1', who: 'zhe', kind: 'with', with: 'zhe1', steps: [
    { do: 'prop', prop: 'longanBag' },
    say('zhe', '我阿公說新店開張要送東西。我是被逼來的。'), // 【原句】zhe1
    say('deshu', '替我謝謝阿公。'), // 【原句】zhe1
    say('zhe', '窯烤的，配咖啡剛好。不是我說的，是我阿公說的。'), // 【原句】zhe1
    say('deshu', '隔壁龍眼園的阿哲。'), // 【待定】對老闆，小聲
    say('deshu', '他講話快。沒聽清楚的，我再說一次給老闆聽。'), // 【待定】
    say('zhe', '德叔，我聽得到喔。'), // 【待定】
    choice('vZhe1Thanks', ['謝謝你的龍眼乾。', '（點點頭）']), // 【待定】
    branch('vZhe1Thanks',
      [say('zhe', '不用謝我啦，是我阿公——'), // 【待定】
        say('zhe', '……好啦，我也有幫忙翻。')], // 【待定】
      [say('zhe', '老闆話很少喔。跟德叔一樣。')]), // 【待定】
    say('zhe', '那袋要綁緊喔，東山很潮。'), // 【待定】
    say('deshu', '知道了。'), // 【待定】
  ] },
  // 第 2 次｜點單寒暄（zhe1 之後、zhe2 之前）
  { id: 'zhe-v2', who: 'zhe', kind: 'visit', after: 1, before: 2, steps: [
    look('zhe'),
    say('zhe', '我阿公叫我來看看你們缺什麼。我是被逼來的。'), // 【原句】TALK
    say('deshu', '不缺。坐一下再走。'), // 【待定】
    say('zhe', '老闆，你以前是上班族喔？看得出來啦，坐得很直。'), // 【待定】
    choice('vZhe2Office', ['這麼明顯？', '以前是。']), // 【待定】
    branch('vZhe2Office',
      [say('zhe', '超明顯。我們這邊的人，坐椅子都歪一邊。')], // 【待定】
      [say('zhe', '以前喔。……那現在是老闆了。很好啊。')]), // 【待定】
    say('deshu', '阿哲，鞋。'), // 【待定】
    say('zhe', '啊，又踩進來了。歹勢歹勢。果園的土，洗不掉啦。'), // 【待定】
    choice('vZhe2Mud', ['沒關係，店裡不怕泥。', '（笑一下）']), // 【待定】
    branch('vZhe2Mud',
      [say('zhe', '老闆人很好喔。德叔，你要學一下。'), // 【待定】
        say('deshu', '嗯。')], // 【待定】
      [{ do: 'laugh', who: ['zhe'] }]),
    say('deshu', '門口的泥，我晚一點擦。'), // 【待定】
  ] },
  // 第 3 次｜閒聊
  { id: 'zhe-v3', who: 'zhe', kind: 'visit', after: 1, before: 2, steps: [
    look('zhe'),
    say('zhe', '德叔，你們的豆子是哪一區的？……我只是問問。'), // 【原句】TALK
    say('deshu', '窗外那片山。'), // 【待定】
    say('zhe', '我就知道。聞得出來啦，我們那邊的味道。'), // 【待定】
    choice('vZhe3Beans', ['你家也種咖啡？', '聞得出來？']), // 【待定】
    branch('vZhe3Beans',
      [say('zhe', '龍眼跟咖啡都有。阿公種的，現在換我顧。')], // 【待定】
      [say('zhe', '天天在曬場，鼻子會變好。')]), // 【待定】
    say('zhe', '今天果園的龍眼開花了，整片都是蜂。'), // 【原句】TALK
    say('deshu', '蜂多，好。'), // 【待定】
    say('zhe', '阿公也這樣說。……他只有這個，會跟我站同一邊。'), // 【待定】
    choice('vZhe3More', ['其他的呢？', '（等他說下去）']), // 【待定】
    branch('vZhe3More',
      [say('zhe', '其他的喔……下次再說啦，說了會氣。')], // 【待定】
      [wait(2), say('zhe', '……沒事啦。今天講蜂就好。')]), // 【待定】
    say('deshu', '他話很多。剛才那句，沒說完。'), // 【待定】
  ] },
  // 第 4 次｜zhe2：原句之後說出自己的事，再自然問第一杯
  { id: 'zhe-v4', who: 'zhe', kind: 'with', with: 'zhe2', steps: [
    say('zhe', '德叔，我跟你說，我阿公喔，咖啡豆只肯日曬。'), // 【原句】zhe2
    say('zhe', '我想試蜜處理、試厭氧，他連聽都不聽，說古早就是這樣曬。'), // 【原句】zhe2
    say('deshu', '你阿公曬的豆，我年輕時喝過。'), // 【原句】劇本
    say('zhe', '蛤？'), // 【原句】劇本
    { do: 'glance', who: 'deshu' },
    say('deshu', '很久以前。'), // 【待定】
    say('zhe', '……阿公從來沒說過。'), // 【待定】
    look('zhe'),
    say('zhe', '欸老闆，你不要笑喔。我想試新的，不是不要他的。……他都聽成不要。'), // 【待定】
  ], invite: { drink: 'dongshan', any: true, need: 'longan',
    options: ['喝一杯再回去吧，我請。', '慢慢來。他會懂的。'], // 【待定】
    yes: [say('zhe', '老闆請喔？那……有龍眼乾嗎？'), // 【待定】
      say('deshu', '有。')], // 【待定】
    no: [say('zhe', '……希望啦。下次換我請你們——用龍眼乾。')], // 【待定】
    missing: [say('zhe', '老闆請喔？那……有龍眼乾嗎？'), say('deshu', '黑板上現在沒有龍眼乾。老闆，要端哪一杯？')] } }, // 【待定】fable 第四節 4
  // zhe2 沒有演到擴寫版：之後第一次見到他時的接回（結尾一樣問第一杯）
  { id: 'zhe-r2', who: 'zhe', kind: 'reconnect', of: 'zhe2', after: 2, before: 3, steps: [
    look('zhe'),
    say('zhe', '德叔，你上次說喝過我阿公的豆，我回去問了。'), // 【待定】
    say('zhe', '阿公只說『喔』。就一個字。'), // 【待定】fable：之後寫阿公時，以「阿哲問過、阿公沒正面答」為底
    say('deshu', '嗯。'), // 【待定】
    say('zhe', '你們兩個講話，都很省。'), // 【待定】
  ], invite: 'zhe-v4' },

  /* ---------- 張凱文 ---------- */
  // 第 1 次｜陌生（與 kevin1 同天）
  { id: 'kevin-v1', who: 'kevin', kind: 'with', with: 'kevin1', steps: [
    wait(2), { do: 'serve', who: 'kevin', kind: 'iced' },
    say('deshu', '冰美式。他說，以後每天這個時間都會來。'), // 【原句】kevin1
    { do: 'deshuHome' },
    say('deshu', '冰塊，我等他坐下才放。'), // 【待定】回到吧台，小聲；「冰塊」只留這裡和 kevin3（fable 第二節 6）
    choice('vKevin1Busy', ['他好像很忙。', '（不打擾他）']), // 【待定】
    branch('vKevin1Busy',
      [say('deshu', '耳機戴著。這種時候，不用說話。')], // 【待定】
      [say('deshu', '嗯。')]), // 【待定】
    wait(3), { do: 'deshuTo', who: 'kevin' },
    say('kevin', '……抱歉，我在開會。'), // 【原句】TALK
    say('deshu', '水，我放這裡。'), // 【待定】
    { do: 'deshuHome' },
  ] },
  // 第 2 次｜點單寒暄（kevin1 之後、kevin2 之前）
  { id: 'kevin-v2', who: 'kevin', kind: 'visit', after: 1, before: 2, steps: [
    { do: 'deshuTo', who: 'kevin' },
    say('deshu', '一樣？'), // 【待定】
    say('kevin', '嗯？喔，冰美式，謝謝。'), // 【原句】TALK
    { do: 'serve', who: 'kevin', kind: 'iced' },
    say('deshu', '五點整。他推門的時候，我才開始磨。'), // 【待定】
    wait(3),
    say('kevin', '這裡的網路比台北的辦公室穩。'), // 【原句】TALK；fable 換時機：對還站在旁邊的德叔說，說完德叔才回吧台
    { do: 'deshuHome' },
    choice('vKevin2Net', ['台北來的？', '網路穩就好。']), // 【待定】
    branch('vKevin2Net',
      [say('kevin', '……公司在台北。我是說，我人在這裡。')], // 【待定】
      [say('kevin', '嗯。斷線的話，會被……'), // 【待定】
        say('kevin', '……沒事。')]), // 【待定】
    say('deshu', '說完，他就把耳機戴回去了。'), // 【待定】
  ] },
  // 第 3 次｜點單寒暄（還沒有名字）
  { id: 'kevin-v3', who: 'kevin', kind: 'visit', after: 1, before: 2, steps: [
    when('catSill', [say('deshu', '窗台上的龍眼，一直在看他。')]), // 【待定】
    look('kevin'),
    say('kevin', '……那隻貓，叫什麼名字？'), // 【待定】
    { do: 'glance', who: 'deshu' }, // fable 換說話者：德叔不替老闆答，只看老闆一眼
    choice('vKevin3Cat', ['他叫龍眼。這間店，其實是他的。', '（看向德叔）']), // 【待定】
    branch('vKevin3Cat',
      [say('kevin', '店是貓的？……我是說，那我要跟他打招呼嗎。')], // 【待定】
      [say('deshu', '龍眼。'), // 【待定】
        say('kevin', '龍眼。……好。')]), // 【待定】
    say('deshu', '他問了貓的名字。人的，還沒問。'), // 【待定】
  ] },
  // 第 4 次是 kevin2（被罵）：原句照舊，不加句（fable 第三節）
  // 第 5 次｜閒聊（第一次叫他的名字；kevin2 之後、kevin3 之前）
  { id: 'kevin-v5', who: 'kevin', kind: 'visit', after: 2, before: 3, steps: [
    { do: 'serve', who: 'kevin', kind: 'iced' },
    say('deshu', '凱文先生，冰美式。'), // 【待定】
    say('kevin', '……你知道我的名字了。'), // 【待定】
    say('deshu', '那天，聽到的。'), // 【待定】
    say('kevin', '喔。……那天，大家都聽到了。'), // 【待定】
    { do: 'deshuHome' },
    choice('vKevin5Day', ['那天的事，不用放在心上。', '今天的山很清楚。']), // 【待定】
    branch('vKevin5Day',
      [say('kevin', '……嗯。謝謝。我是說，我盡量。')], // 【待定】
      [look('window'), say('kevin', '山？……我還沒看。'), // 【待定】
        say('kevin', '……真的很清楚。')]), // 【待定】
    say('deshu', '他今天，拿下了一邊的耳機。'), // 【待定】
  ] },
  // 第 6 次｜閒聊
  { id: 'kevin-v6', who: 'kevin', kind: 'visit', after: 2, before: 3, steps: [
    look('kevin'),
    say('kevin', '我把會議的鏡頭關掉了。看山比較好。'), // 【原句】TALK
    choice('vKevin6Cam', ['會議沒關係嗎？', '看山好。']), // 【待定】
    branch('vKevin6Cam',
      [say('kevin', '……沒人發現。大概。')], // 【待定】
      [say('kevin', '嗯。以前我都不知道，窗外有山。')]), // 【待定】
    when('catSill', [say('kevin', '龍眼今天，也睡在那裡。'), // 【待定】
      say('deshu', '老闆在的時候，他都睡窗台。')]), // 【待定】
    say('kevin', '……下次，我帶點東西給他。可以嗎？'), // 【待定】只在 kevin3 還沒發生時（窗口）
    say('deshu', '問他。'), // 【待定】
  ] },
  // 第 7 次｜kevin3：原句之後一句，再自然問第一杯（五點那杯已經端過，請的是第二杯）
  { id: 'kevin-v7', who: 'kevin', kind: 'with', with: 'kevin3', steps: [
    { do: 'cat', who: 'kevin', lap: false },
    say('kevin', '我在台北租的地方不能養。這裡可以嗎？'), // 【原句】劇本
    say('kevin', '我是說……來這裡看他。'), // 【原句】劇本
    say('deshu', '龍眼說可以。'), // 【原句】kevin3
    say('kevin', '……那我明天也來。我是說，本來就會來。'), // 【待定】
  ], invite: { drink: 'iced',
    options: ['再一杯冰美式，我請。', '龍眼會很高興。'], // 【待定】
    yes: [say('kevin', '……老闆請？'), // 【待定】
      say('deshu', '冰塊，最後才放。')], // 【待定】第 1 次「冰塊，我等他坐下才放」的兌現
    no: [say('kevin', '……希望是。')], // 【待定】
    missing: [say('kevin', '……老闆請？'), say('deshu', '黑板上現在沒有這一杯。老闆，要端哪一杯？')] } }, // 【待定】
  // kevin3 沒有演到擴寫版：之後第一次見到他時的接回（結尾一樣問第一杯）
  { id: 'kevin-r3', who: 'kevin', kind: 'reconnect', of: 'kevin3', after: 3, before: 4, steps: [
    look('kevin'),
    say('kevin', '上次帶的零食，龍眼沒吃。……他有聞。'), // 【待定】
    say('deshu', '他聞過，就是吃了。'), // 【待定】
  ], invite: 'kevin-v7' },
];

const BY_ID = new Map(SEGMENTS.map((s) => [s.id, s]));
export const segmentById = (id) => BY_ID.get(id) || null;
// 接回的 invite 寫成另一段的 id（同一組選項與分支）
export function inviteOf(seg) {
  if (!seg?.invite) return null;
  return typeof seg.invite === 'string' ? segmentById(seg.invite)?.invite || null : seg.invite;
}

// invited：段落結尾的第一杯已經問過（老闆選了其中一個選項）的熟客
export const blankRel = () => ({ done: [], seen: [], today: { day: 0, slots: [] }, offered: { yuan: 0, zhe: 0, kevin: 0 }, invited: [] });
const relOf = (save) => {
  if (!save.rel) save.rel = blankRel();
  if (!save.rel.invited) save.rel.invited = []; // 第 13 版剛加上 rel 時還沒有這一欄
  return save.rel;
};
const has = (save, who, n) => (save.regulars?.[who]?.milestones || []).includes(n);
const milestoneN = (id) => Number(String(id).replace(/\D+/g, '')) || 0;
const whoOf = (id) => String(id).replace(/\d+$/, '');

// 段落現在的窗口：'open' 可以演、'early' 還沒到、'closed' 過了（作廢）
export function windowOf(save, seg) {
  const r = relOf(save);
  if (r.done.includes(seg.id)) return 'closed';
  if (seg.kind === 'with') return has(save, seg.who, milestoneN(seg.with)) ? 'closed' : 'early';
  if (seg.before && has(save, seg.who, seg.before)) return 'closed';
  if (seg.kind === 'reconnect') {
    if (!has(save, seg.who, milestoneN(seg.of))) return 'early';
    // 只補第一杯的接回（yuan-r3）：已經問過、或第一段已經找到（點她請過了）就不用補
    if (seg.uninvited) return r.invited.includes(seg.who) || FV.current(save, seg.who)?.n !== 1 ? 'closed' : 'open';
    return r.seen.includes(seg.of) ? 'closed' : 'open';
  }
  return has(save, seg.who, seg.after) ? 'open' : 'early';
}
// 過期的段落記成演過（跳過，不補演、不倒播）。回傳這次跳過的 id
export function expire(save) {
  const r = relOf(save), out = [];
  for (const seg of SEGMENTS) if (!r.done.includes(seg.id) && windowOf(save, seg) === 'closed') { r.done.push(seg.id); out.push(seg.id); }
  return out;
}

// 今天的份量：slots＝今天已經用掉一段的熟客（在場的里程碑、擴寫、來訪段落都算一段）
function todayOf(save, day) {
  const r = relOf(save);
  if (r.today.day !== day) r.today = { day, slots: [] };
  return r.today;
}
export const slotsToday = (save, day) => [...todayOf(save, day).slots];
// 老闆在店裡看到一個里程碑演完（不管有沒有擴寫）：那位熟客今天的一段用掉了
export function noteMilestone(save, who, day) {
  const t = todayOf(save, day);
  if (!t.slots.includes(who)) t.slots.push(who);
}

// 老闆在場時，這位熟客現在可以演的來訪段落／接回（沒有就是 null）。不看老闆坐著沒（呼叫端看；站著時德叔提一次 SEAT_HINT）
// c：{ milestoneDue 這位熟客今天還有里程碑要演（里程碑優先）, reserved 今天別的熟客還要演的里程碑有幾個（先留給它們） }
export function dueVisit(save, who, day, { milestoneDue = false, reserved = 0 } = {}) {
  if (milestoneDue) return null;
  if (!roomToday(save, who, day, reserved)) return null;
  if ((save.regulars?.[who]?.lastMilestoneDay || 0) === day) return null;
  expire(save);
  return SEGMENTS.find((s) => s.who === who && s.kind !== 'with' && windowOf(save, s) === 'open') || null;
}
// 今天還能不能多演一段（在場的里程碑、擴寫、來訪段落）：這位熟客今天還沒有一段，全店（加上先留給別的熟客的里程碑 reserved）還沒滿兩段
export function roomToday(save, who, day, reserved = 0) {
  const t = todayOf(save, day);
  return !t.slots.includes(who) && t.slots.length + reserved < DAY_CAP;
}
// 老闆在場時，這位熟客的里程碑今天能不能開始演：在場的里程碑（含同日擴寫）算那位熟客今天的一段，和來訪段落共用一天的份量。
// false＝今天不開始演（main.js 的 liveScene() 當作今天沒有里程碑）：不記完成、不給獎勵、不跳過，條件與順序不動，
// 等下一個有份量的遊玩日；老闆不在的日子照舊由 story.js 的 settleThrough() 結算（可離線的寫日誌，在場的寫「想等老闆在」）
export const milestoneRoom = (save, who, day) => roomToday(save, who, day);
// 這個里程碑當天的擴寫（老闆坐著時取代原場景）；已經演過或作廢了是 null。
// 給了 day 就看今天的份量（roomToday）：滿了是 null。正式流程裡份量滿了里程碑本身也不演（milestoneRoom()），
// 所以只有開發者直接演（__cafe.playScene）時才會在滿了的時候拿到 null、演原場景
export function expansionFor(save, milestoneId, day) {
  const seg = SEGMENTS.find((s) => s.kind === 'with' && s.with === milestoneId);
  if (!seg || relOf(save).done.includes(seg.id)) return null;
  return day === undefined || roomToday(save, seg.who, day) ? seg : null;
}
// 演完一段：記下來、用掉那位熟客今天的一段；擴寫版演過的里程碑記成「老闆看過」（之後不演接回）
export function markPlayed(save, seg, day) {
  const r = relOf(save);
  if (!r.done.includes(seg.id)) r.done.push(seg.id);
  if (seg.kind === 'with' && !r.seen.includes(seg.with)) r.seen.push(seg.with);
  if (seg.kind === 'reconnect' && !r.seen.includes(seg.of)) r.seen.push(seg.of);
  noteMilestone(save, seg.who, day);
}
export const played = (save, id) => relOf(save).done.includes(id);

// 點熟客時「請德叔端一杯」：每位熟客一天只主動問一次
export const offerable = (save, who, day) => (relOf(save).offered?.[who] || 0) !== day;
export function markOffered(save, who, day) { const r = relOf(save); r.offered = { ...blankRel().offered, ...r.offered, [who]: day }; }
export function resetOffered(save, who) { const r = relOf(save); r.offered = { ...blankRel().offered, ...r.offered, [who]: 0 }; }

// 段落結尾的第一杯問過了（老闆選了其中一個選項；選項出來前中斷不算）：yuan-r3 的窗口看這個
export function markInvited(save, who) { const r = relOf(save); if (!r.invited.includes(who)) r.invited.push(who); }
export const invited = (save, who) => relOf(save).invited.includes(who);
// 段落結尾的第一杯：還在找第一段、今天還沒收過才問（舊存檔已經找過第一段就不問）
export function inviteReady(save, who, day) {
  const s = FV.current(save, who);
  return !!s && s.n === 1 && FV.canServe(save, who, day);
}
// 選「我請」時直接端哪一杯：黑板上有那一杯（阿哲是任何喝的，黑板上要有龍眼乾）；沒有就是 null（德叔問要端哪一杯，照平常的選杯流程）
export function inviteDrink(save, inv, shift = 0) {
  if (!inv) return null;
  if (inv.need && !M.onBoard(save, inv.need)) return null;
  const drinks = M.boardDrinks(save, shift);
  if (drinks.includes(inv.drink)) return inv.drink;
  return inv.any && drinks.length ? drinks[0] : null;
}

// 予安說出名字（第一次點她時說「……啊，你好。我叫予安……」）的時機：第 2 次來訪演過（選了點頭，名字留到下次點她）或那個窗口已經過了
export const yuanIntroReady = (save) => relOf(save).done.includes('yuan-v2') || has(save, 'yuan', 2);
// 泡泡上的名字：予安說出名字以前（而且還沒到 yuan2，日誌裡德叔已經叫她予安小姐）是「窗邊的小姐」
export const yuanStranger = (save) => !save.flags?.metYuan && !has(save, 'yuan', 2);

// 存檔 12 → 13：舊存檔已經發生的里程碑，當天的擴寫與接回都記成演過（不補演舊的事）；過期的段落跳過；照片、最愛的段落都不動
export function migrateRel(save) {
  const r = relOf(save);
  for (const seg of SEGMENTS) {
    const ms = seg.kind === 'with' ? seg.with : seg.kind === 'reconnect' ? seg.of : '';
    if (ms && has(save, whoOf(ms), milestoneN(ms))) {
      if (!r.done.includes(seg.id)) r.done.push(seg.id);
      if (!r.seen.includes(ms)) r.seen.push(ms);
    }
  }
  expire(save);
  return save;
}

// when 的條件：c＝{ catSill 龍眼此刻在窗台上（main.js 看） }；peeked、met 從存檔讀
export function condOk(save, cond, c = {}) {
  const not = String(cond).startsWith('!'), k = not ? cond.slice(1) : cond;
  const v = k === 'catSill' ? !!c.catSill
    : k === 'peeked' ? (save.moments?.early || []).includes('d1-peek')
      : k === 'met' ? !!save.flags?.metYuan : false;
  return not ? !v : v;
}

// 一段裡所有說出口的句子（子序列檢查用）：branch 的每個分支、when 的步驟都算
export function sayTexts(steps, { branches = 'all' } = {}) {
  const out = [];
  const walk = (list) => {
    for (const s of list || []) {
      if (s.do === 'say') out.push(s.text);
      if (s.do === 'when') walk(s.steps);
      if (s.do === 'branch') (branches === 'all' ? s.cases : [s.cases[0]]).forEach(walk);
    }
  };
  walk(steps);
  return out;
}

// 測試與校稿用：這個檔案裡所有玩家看得到的字
export function allVisitLines() {
  const out = [];
  const walk = (steps) => {
    for (const s of steps || []) {
      if (s.text) out.push(s.text);
      if (s.options) out.push(...s.options);
      if (s.cases) s.cases.forEach(walk);
      if (s.steps) walk(s.steps);
    }
  };
  for (const seg of SEGMENTS) {
    walk(seg.steps);
    if (seg.invite && typeof seg.invite === 'object') {
      out.push(...seg.invite.options);
      walk(seg.invite.yes); walk(seg.invite.no); walk(seg.invite.missing);
    }
  }
  out.push(SEAT_HINT, YUAN_STRANGER);
  return [...new Set(out)];
}
