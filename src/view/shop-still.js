// 店內 2D 定景（取代已拔掉的店內環景；承峰 2026-11-21 20:48「把 3D 拿掉，查看店內景象的功能也拔除」，23:14 點頭的做法）。
// 一張整張直式靜照（1170×2532）＋疊上去的德叔（不說話時）、龍眼、桌上的杯子、點椅子坐下的那張椅子、吧台檯面。
// 背景圖只從 art-map.js 的常數來（換圖只改那裡的 src）：
//   進門／站在店裡（deshu、sit、stay、晚上回來）＝SHOP_STILL_NIGHT → scene_shop_interior_night_lit_v2（承峰 2026-11-21 23:47 定版）
//   第一天起早上的店裡＝SHOP_STILL_DAY → art-v59/scene_shop_interior_day_v1（承峰 2026-11-22 17:20 接進遊戲；與 v2 同構圖，位置共用）
//   坤伯答謝開頭（傍晚、還沒入夜）＝SHOP_STILL_DUSK → art-v59/scene_shop_interior_dusk_v1（承峰 2026-11-22 19:16 接進遊戲；同構圖）；
//     天暗下來那句交叉淡化到 SHOP_STILL_NIGHT，之後停在夜景
//   點了椅子、坐下喝咖啡（coffee，opts.seated）＝SHOP_STILL_SEATED → scene_v3b_shop_window_night_seated（靠窗特寫）
// 兩張的構圖不同，位置分兩套：*_STAND／SHOP_CHAIR／SHOP_BAR 對準 v2；SHOP_WINDOW／SHOP_CUP／CAT_2D.feetSeated／CAT_2D.across 對準靠窗特寫。
// 位置都是 .op-art 的百分比（相對 1170×2532 整張圖）。
// 沒有 canvas、沒有動畫迴圈：換動作用計時器換圖，摸頭與喝一口用 CSS 動畫。
// 前後遮擋（承峰 2026-11-28 同意的 Phase 1–3）：家具切片（shop-pieces.js）、角色、杯子都在 .sh-cam 同一個 stacking context，
// 每次 beat 依腳線設 z-index（y-sort）；切片檔還沒到的光線不放片，畫面與改動前相同。德叔站吧台後一律 clip（見 BAR_TOP）。
// 2026-11-28 畫師 17 片母檔到位、實量裁好（shop-cut-ready.js）：夜／白天／傍晚各 5 片、靠窗特寫 table_corner＋chair_back。
import { makeStage } from './days.js';
import { srcOf, artUrl, cutRefOf, SHOP_STILL_NIGHT, SHOP_STILL_SEATED, SHOP_STILL_DAY, SHOP_STILL_DUSK } from './art-map.js';
import { SHOP_PIECES, ART_W, ART_H, Z_FRONT, zOf, pxY } from './shop-pieces.js';
import { SHOP_CUT_READY } from './shop-cut-ready.js';

const art = (ref) => artUrl(ref);

/* ---------- 進門／站著：對準 scene_shop_interior_night_lit_v2 ---------- */
// 點椅子坐下的目標：對準 v2 左側靠窗那張桌的椅子（承峰 2026-11-22 17:15「坐下那一幕移到靠窗那張」）
// （約 x 199–491、y 1089–1620，含靠背與椅座，方便點；椅座約 y 1310–1430）
export const SHOP_CHAIR = { left: 17, top: 43, width: 25, height: 21 };
// v2 左側那扇窗的玻璃（約 x 25–355、y 470–955）：傍晚在窗裡疊一層天色（原圖窗外是晚上；早上用白天圖，不疊）
export const SHOP_WINDOW_STAND = { left: 2.1, top: 18.6, width: 28.2, height: 19.2 };
// v2 右側吧台的檯面（一排白杯子與磨豆機那條檯面，約 x 440–1170、y 880–1015）：第二天「把鑰匙放到吧台」的放置目標
export const SHOP_BAR = { left: 37.6, top: 34.8, width: 62.4, height: 5.3 };
// 吧台檯面的高度（約 y 965）：德叔站在吧台後面時，這條線以下被吧台擋住（clip）。
// bar_front 切片到位後仍要 clip（2026-11-28 對母檔實量）：德叔腳線 y 1299 比吧台在他那一段（x 900–1100）的下緣（約 y 1185）還低，
// 只靠切片排序的話，小腿與腳會從吧台下緣、右桌與右前椅之間的地板漏出來（夜 stand 約 740px、brew 約 800px）。
// 所以兩個一起用：clip 切掉檯面以下（與改動前同一條線），切片再把檯上白杯、磨豆機、檯面前緣蓋在他前面
const BAR_TOP = 38.1;
// 桌上的杯子（prop_cup，站著看）：左側靠窗桌面上、白色馬克杯盆栽的右手邊（盆栽右緣約 x 11%），
// 整杯含把手都在桌面內側、不懸在桌緣（承峰 2026-11-24 21:24）；杯底中心約 x 240、y 1220；把手朝右
export const SHOP_CUP_STAND = { x: 20.5, y: 48.2, h: 3.6 };
// 杯子放在哪一片家具上（z＝那片 base＋1）：站著＝左桌，坐下特寫＝桌角
export const CUP_ON = { stand: 'table_left', seated: 'table_corner' };
// 德叔不說話時站在畫面裡的樣子（立繪出來時這裡不畫，不會同時兩個德叔）：x＝立繪中心、y＝腳線（DESHU_FOOT）、身高＝立繪圖框高（佔原圖高）
// behind：站在這片家具後面（z＝那片 base−1）；clip：那片切片還沒到位時的 fallback，這條 y 以下切掉（腳底在吧台後的地板約 y 1300）
export const DESHU_2D = {
  stand: { img: 'char_deshu_stand', x: 85.5, y: 51.3, h: 24, behind: 'bar_front', clip: BAR_TOP }, // 吧台後面、磨豆機旁
  brew: { img: 'char_deshu_brew', x: 85.5, y: 51.3, h: 24, behind: 'bar_front', clip: BAR_TOP },
  broom: { img: 'char_deshu_broom', x: 38, y: 70, h: 41 }, // 晚上回來：拿著掃把，站在兩張桌子之間的地上
  // 端杯子：剛把杯子放在左側靠窗桌（SHOP_CUP_STAND），人站在靠窗桌那張椅子的右手邊走道上（兩桌之間、緊貼左桌）。
  // h40 時立繪最左緣（左手）約 x 51% − 134px ≈ 463px，在左椅椅背／椅座右緣（約 450px）右邊，不疊在椅子上；
  // 手上那杯約 x 497–566px、y ~1080，離桌上杯子（約 x 176–306、杯底 y 1220）很遠；腳底 y 67% 與靠窗桌前腳同一層地板。
  serveTable: { img: 'char_deshu_serve', x: 51, y: 67, h: 40 },
};
// 腳線（實量 2026-11-28，tools/measure-alpha.mjs）：alpha ≥ 128 的最低一列的 y（512×384 貓圖／1024×2048 德叔立繪）；
// body：不透明範圍的左右 x（接觸陰影的寬度用）。圖框底邊不是腳線：貓圖腳下還有 24–45px 透明，所以以前看起來浮高。
//   sleep 339（舊紀錄 339，相符）、knead_v2 348（舊紀錄 349 是外框下緣、不含的那一列；改用同一定義）、
//   sit 360、walk 340、lick_paw_v2 359、ears_turn_v2 360、ears_back_v2 360、headbump_v2 359
//   德叔 stand 2006、brew 2006、broom 2011、serve 2005
export const CAT_FOOT = {
  cat_longan_sleep: { y: 339, body: [25, 486] },
  cat_longan_knead_v2: { y: 348, body: [64, 449] },
  cat_longan_sit: { y: 360, body: [137, 375] },
  cat_longan_walk: { y: 340, body: [25, 486] },
  cat_longan_lick_paw_v2: { y: 359, body: [129, 384] },
  cat_longan_ears_turn_v2: { y: 360, body: [140, 371] },
  cat_longan_ears_back_v2: { y: 360, body: [122, 392] },
  cat_longan_headbump_v2: { y: 359, body: [132, 380] },
};
export const DESHU_FOOT = {
  char_deshu_stand: { y: 2006, contact: [493, 587] },
  char_deshu_brew: { y: 2006, contact: [566, 662] },
  char_deshu_broom: { y: 2011, contact: [584, 667] },
  char_deshu_serve: { y: 2005, contact: [492, 588] },
};
export const CAT_IMG = { w: 512, h: 384 };
export const DESHU_IMG = { w: 1024, h: 2048 };
// 貓圖寬 1% 時，圖框高佔原圖高的比例（384/512 × 1170/2532）
export const CAT_H = (CAT_IMG.h / CAT_IMG.w) * (ART_W / ART_H);
// 貓圖框的位置（% 相對原圖）：腳線對到 spot.y、圖中心對到 spot.x（貓圖都是 512 寬、同一個中心）
export function catFrame(spot, img) {
  const foot = CAT_FOOT[img]?.y ?? CAT_IMG.h; // 沒量過的圖退回圖框底邊
  return { left: spot.x - spot.w / 2, width: spot.w, top: spot.y - spot.w * CAT_H * (foot / CAT_IMG.h), foot };
}
// 德叔立繪框：腳線對到 d.y；clip（fallback）時，原圖 y＝clip 以下切掉的比例（% 相對立繪框高）
export function deshuFrame(d) {
  const foot = DESHU_FOOT[d.img]?.y ?? DESHU_IMG.h;
  const top = d.y - d.h * (foot / DESHU_IMG.h);
  return { top, foot, clipBottom: d.clip != null ? ((top + d.h - d.clip) / d.h) * 100 : null };
}
// 配光（日／傍晚／夜）：貓、德叔、杯子走同一套，避免只有貓變暗。參考庭埕貓 .op-yn-cat 的 brightness(.82) sepia(.15)
export const LIGHT_FILTER = {
  day: 'brightness(1)', // 白天接近原圖
  dusk: 'brightness(.94) sepia(.2) saturate(1.08)', // 傍晚偏暖
  night: 'brightness(.85) sepia(.12)', // 夜：燈亮著，比白天暗一階
  seated: 'brightness(.85) sepia(.12)', // 靠窗特寫也是夜
};
// 龍眼：x＝貓圖中心、y＝腳線（CAT_FOOT 量的那一列，不是圖框底邊）、w＝貓圖寬（佔原圖寬）。閱讀框蓋住原圖約 78% 以下，地上的位置放在框的上緣
// （例外：feetSeated 腳線可進框，但圖框上緣＝頭要在 78% 以上；承峰 2026-11-28 09:59）。
// on：趴／站在哪一片家具上（z＝那片 base＋1，不被自己那張擋住；shop-pieces.js）；沒寫＝站在地上，z＝腳線 y（像素）
// seq：照劇本換動作（每一步的原圖、停多久；s 是放大，以腳線為中心）。換圖時各張用自己的腳線，不再另加偏移
// 除了 feetSeated／across（坐下以後，對準靠窗特寫）之外都對準 v2：「那張椅子」＝吧台前中間那張紅墊椅（椅面約 x 665–930、y 1390）
export const CAT_2D = {
  doorway: { x: 22, y: 76, w: 28, img: 'cat_longan_walk' }, // 剛進門：從鏡頭左下的地板走進來
  chair: { x: 63, y: 55, w: 22, img: 'cat_longan_sleep', on: 'chair_mid', seq: [ // 跳上吧台前那張椅子踩兩圈 → 趴下 → 耳朵轉過來
    { img: 'cat_longan_knead_v2', ms: 2200, bob: true },
    { img: 'cat_longan_sleep', ms: 1600 },
    { img: 'cat_longan_ears_turn_v2', s: 1.05 },
  ] },
  shoes: { x: 55, y: 77, w: 30, img: 'cat_longan_walk', flip: true }, // 走過來聞我的鞋（鏡頭前的地板）
  rub: { x: 48, y: 77.5, w: 32, img: 'cat_longan_walk' }, // 在我小腿上蹭（可以摸）
  feet: { x: 48, y: 77.5, w: 30, img: 'cat_longan_sit', lick: true }, // 蹭完坐在腳邊；沒摸就舔前腳（在椅子熱區下方，不擋）
  earsBack: { x: 48, y: 77.5, w: 30, img: 'cat_longan_sit', seq: [{ img: 'cat_longan_ears_back_v2', ms: 1800 }, { img: 'cat_longan_sit' }] }, // 磨豆機響：耳朵往後壓
  // before: 'chair_back'（2026-11-28 對母檔實量、看原生像素截圖後加的例外，位置不動）：照腳線 1861 排序，貓會被
  //   table_corner（2005）與 chair_back（2050）擋掉 53%（趴姿）——但擋住牠的是 table_corner 裡的桌子右後腳（在椅座後面）
  //   與椅背立桿（也在座面後面），兩者都在座上的貓後面，遮擋是錯的（貓身上出現一條深色桌腳）。所以畫在兩片前面（z＝2051），畫面與切片前相同
  across: { x: 59, y: 73.5, w: 28, img: 'cat_longan_sleep', before: 'chair_back', seq: [ // 坐下以後（靠窗特寫）：跳上對面那張椅子，踩兩圈，趴下
    { img: 'cat_longan_knead_v2', ms: 2400, bob: true },
    { img: 'cat_longan_sleep' },
  ] },
  // 坐下以後（靠窗特寫）、跳上對面椅子之前：坐在對面那張椅子（chair_back）右邊的地板上（觀者視角，椅背右側與右牆之間），
  // 沒摸就舔前腳。承峰 2026-11-28 11:25 從桌前地板改到椅右地板。沒有 before、沒有 on，照腳線排序；78% 的寬限（09:59）沿用：
  //   椅背母檔每列最右不透明 x：y 1775→918、1850→905、1900→896、1975–2050→892–895；右邊到 x 1170 是地板（牆腳約 y 1760 以下）。
  //   腳線 78.6%（1990）：z＝1990 < chair_back.base 2050，排序上在椅背後面一點（坐在椅子右後側的地板），
  //   但 sit／lick_paw_v2／headbump_v2 三張的不透明像素與 chair_back、table_corner 遮罩交疊都是 0 px
  //   （貓最左不透明 x 942–947，比同列椅背右緣多 26–31px），所以沒有任何一塊被家具蓋到，不用例外。
  //   w 26（與先前相同）：貓框 x 866–1170（右緣剛好貼畫面右緣、不出畫），不透明 x 942–1093；摸頭的手不翻轉，從右上伸進來。
  //   腳只進閱讀框 15px（框上緣約 y 1975＝78%），圖框上緣約 70.2%、不透明頂約 y 1790：頭、臉、身體約 9 成露在框上方。
  //   臉在 y 約 1800–1880，地板中間調、還沒到 y 2060 以下的暗部。
  //   杯子（SHOP_CUP）在桌上、桌角左邊：貓框（＝點貓的熱點）與杯子熱點不重疊
  feetSeated: { x: 87, y: 78.6, w: 26, img: 'cat_longan_sit', lick: true },
  // 第一天起／坤伯答謝：趴在左側靠窗桌（table_left）的桌面上，臉要看得到（承峰 2026-11-28 09:59 從右桌改到左桌：
  //   右桌那個位置臉被右前曲木椅的椅背擋住）。z＝table_left.base＋1，桌子、後面的椅子、盆栽都在牠後面，沒有別的片蓋到牠。
  //   承峰 2026-11-28 11:25 看了對照圖：舊位置（x 23.5、y 49.7、w 18，腳線 1258 貼著前緣、前爪搭在桌緣上）「看起來會掉下來」，
  //   往桌面內側移。對母檔重量的左桌桌面（後緣＝遮罩頂、前緣＝底圖桌面→前裙板的亮暗交界，各擬合一條線；三光差 ≤ 7px）：
  //   後緣 x 120→1153、280→1173（y ≈ 1126＋0.17x）；前緣 x 90→1286、210→1257、330→1227（y ≈ 1310−0.25x）；
  //   右前角約 x 438、y 1200；盆栽杯底約 y 1216–1218、把手右緣約 x 100–105。
  //   桌面是往右收窄的楔形（x 230 處前後緣只差約 90px），睡姿圖 w 18 時身高約 122px，整隻塞進桌面只能縮到 w 12（r3，看起來像小貓）。
  //   承峰 2026-11-28 14:13：「午睡的貓放回原本大小，挪到桌心，背可以稍超過後緣」。所以 w 回到 18，x 19.5、腳線 48.3%（1223）：
  //   睡姿不透明像素 x 134–323（中心約 228，盆栽與右前角之間），前爪／身體下緣逐欄離前緣 ≥ 20px，腳線離前緣 ≥ 29px、
  //   圖框底邊（1242）離前緣 ≥ 11px，穩穩趴在桌面上。背（上半身）越出後緣最多約 63–65px（夜 63／白天 65／傍晚 63），
  //   越出的部分襯在後面的磚牆上，看起來是貓背高過桌面後緣、不是浮在空中；w 18 要讓前爪離前緣 ≥ 18px，背至少越出約 57px，
  //   再往左就貼盆栽，所以取桌心這個位置。左邊離盆栽把手約 28px，不擋盆栽；離右前角 ≥ 114px。
  //   flip（既有欄位，與 shoes 相同）：睡姿圖頭在左，翻轉後頭朝走道（右），臉在桌面上看得清。三種光線同一份座標。
  //   道具杯 SHOP_CUP_STAND（x 175–305、y 1129–1220）在貓身後，幾乎整個被貓蓋住（杯框約 96% 與貓的不透明像素重疊）；
  //   目前劇本裡 nap 的句子都是 cup: false，杯子不會同時出現；之後若要同框，要再決定杯子或貓移位（未定）
  nap: { x: 19.5, y: 48.3, w: 18, img: 'cat_longan_sleep', on: 'table_left', flip: true },
};
// 【待定】花斑貓（店內定景：在椅上、前爪伸進龍眼乾袋裡撥）：承峰已選主圖，但袋子樣子與椅子未定、這場這次不做，
//   不接進定景、不寫位置（不拿村子路的 cat_huaban_* 充數）。

/* ---------- 坐下喝咖啡：對準 scene_v3b_shop_window_night_seated（靠窗特寫，原樣沿用） ---------- */
// 窗玻璃（原圖 x 300–985、y 355–1135）
export const SHOP_WINDOW = { left: 25.6, top: 14, width: 58.5, height: 30.8 };
// 桌上的杯子（prop_cup）：杯底中心 x、杯底 y、杯高（佔原圖高）；我右手邊、把手朝右
export const SHOP_CUP = { x: 38.9, y: 72.5, h: 5.9 };
// 點貓：怡君的手從上方伸進來摸頭，龍眼把頭頂上來（headbump_v2）。手（char_v3b_yijun_hand_v2，800×600）與貓圖同比例，
// 指尖 (332,147) 對準頭頂 (205,58)：在貓框裡的位置用貓圖 512×384 的比例算（見 index.html 的 .sh-hand）。
// 手不包在貓裡：放在跟頂頭圖貓框同位置的 .sh-hand-box（.sh-cat 的兄弟），z＝Z_FRONT，不會跟著貓被椅背切掉
export const PET_MS = 2800;
// 預載清單在 view/art.js 的 SHOP_ART（開機要等）；這裡用到的圖都要在那裡（有單元測試）

let petted = false; // 這次開著的頁面裡摸過龍眼了（摸過就不再舔前腳）
export function resetPet() { petted = false; }

const pct = (n) => `${n}%`;
// 第 i 句的天色：morning 早上（用白天正式圖 SHOP_STILL_DAY，光線與窗外已畫好，不疊：alpha 0）／
// dusk 傍晚還沒入夜（用傍晚正式圖 SHOP_STILL_DUSK，窗外傍晚已畫好，不疊：alpha 0）／
// 晚上（night 1：夜景定版圖原圖的夜色，不再壓暗）。沒寫 tone 也沒入夜的句子照舊在夜圖窗上疊傍晚天色
export function skyOf(look = {}) {
  const night = look.night || 0;
  if ((look.tone === 'morning' || look.tone === 'dusk') && !night) return { kind: look.tone, alpha: 0 };
  const alpha = Math.max(0, 1 - night) * 0.9;
  return { kind: 'dusk', alpha: Number(alpha.toFixed(3)) };
}
// 這一句用哪一張：坐下喝咖啡＝靠窗特寫；入夜（night 為真）＝夜景定版圖；早上＝白天圖；傍晚還沒入夜＝傍晚圖
export const stillOf = (look = {}, seated = false) => {
  if (seated) return SHOP_STILL_SEATED;
  if (look.night) return SHOP_STILL_NIGHT;
  if (look.tone === 'morning') return SHOP_STILL_DAY;
  if (look.tone === 'dusk') return SHOP_STILL_DUSK;
  return SHOP_STILL_NIGHT;
};
// 這一句的光線（切片與配光用）：定景 → night／day／dusk／seated
const LIGHT_OF_STILL = { [SHOP_STILL_NIGHT]: 'night', [SHOP_STILL_DAY]: 'day', [SHOP_STILL_DUSK]: 'dusk', [SHOP_STILL_SEATED]: 'seated' };
export const lightOf = (look = {}, seated = false) => LIGHT_OF_STILL[stillOf(look, seated)];
// 這一種光線已經到位的切片（片的資料＋遊戲檔參照）；沒到的片不在裡面
export const readyPieces = (light, ready = SHOP_CUT_READY) => (SHOP_PIECES[light] || [])
  .filter((p) => ready[light]?.[p.id]).map((p) => ({ ...p, ref: cutRefOf(p.id, light) }));
// 德叔要不要用 clip-path 擋：有寫 clip（站吧台後）就一律 clip，不論 bar_front 切片到了沒（見上面 BAR_TOP 的說明：
// 只靠切片，腳會從吧台下緣漏出來）。切片到了的話另外由 y-sort 把檯上白杯、磨豆機蓋在他前面。light／ready 留著給呼叫端，不影響結果
export const deshuClipped = (d) => d.clip != null;
// 換底圖要不要交叉淡化：只有同一幕裡從傍晚圖換成夜景（坤伯答謝「外面天色慢慢暗下來」）才淡；
// 進幕、跳關、第一次 beat（from 是 null）直接到這一句的圖，不從 showShop 初始的夜圖淡過去
export const fadesBetween = (from, to) => from === SHOP_STILL_DUSK && to === SHOP_STILL_NIGHT;
export const BG_FADE_MS = 1200; // 與 .sh-sky 的 1.2s 一致（index.html 的 .sh-bg-old）
// 這一張的窗與杯子位置（進門／站著＝v2；坐下＝靠窗特寫）
export const layoutOf = (seated = false) => (seated
  ? { window: SHOP_WINDOW, cup: SHOP_CUP }
  : { window: SHOP_WINDOW_STAND, cup: SHOP_CUP_STAND });
// 桌上的杯子看不看得到：坐下喝咖啡（靠窗特寫）預設一定在桌上（與舊環景的 seatedScene 一樣，不靠句子寫 cup: true；
// 句子漏寫也不會藏起來，點杯子喝一口的熱點才量得到）；只有明寫 cup: false 才藏。站著時照句子的 cup。
export const cupShown = (look = {}, seated = false) => (seated ? look.cup !== false : !!look.cup);

// root：#opening；opts.seated：坐下喝咖啡（背景換成靠窗特寫；德叔不在畫面裡，只有說話時出立繪）
// 回傳 { beat(look), hot(name) → 元素, pet(), sip(), stop() }
export function showShop(root, act, opts = {}) {
  const { stage } = makeStage(root);
  const seated = !!opts.seated;
  const c = SHOP_CHAIR;
  const b = SHOP_BAR;
  const { window: w, cup: cp } = layoutOf(seated);
  // 椅子與吧台的熱區只在 v2（站著）上有：坐下特寫不放
  const standOnly = seated ? '' : `
      <div class="sh-chair" id="sh-chair" style="left:${pct(c.left)};top:${pct(c.top)};width:${pct(c.width)};height:${pct(c.height)}"></div>
      <div class="sh-bar" id="sh-bar" style="left:${pct(b.left)};top:${pct(b.top)};width:${pct(b.width)};height:${pct(b.height)}"></div>`;
  const el = stage('shop', `<div class="op-art"><div class="sh-cam">
      <img class="op-art-img sh-bg" src="${art(srcOf(stillOf({ night: 1 }, seated)))}" alt="">
      <span class="sh-sky" aria-hidden="true" style="left:${pct(w.left)};top:${pct(w.top)};width:${pct(w.width)};height:${pct(w.height)}"></span>
      <img class="sh-deshu" alt="" aria-hidden="true" hidden><span class="sh-deshu-shadow" aria-hidden="true" hidden></span>${standOnly}
      <img class="sh-cup" src="${art('prop_cup')}" alt="" hidden style="left:${pct(cp.x)};top:${pct(cp.y - cp.h)};height:${pct(cp.h)}">
      <div class="sh-cat" hidden><span class="sh-cat-shadow" aria-hidden="true"></span><img class="sh-cat-img" alt="" aria-hidden="true"></div>
      <div class="sh-hand-box" aria-hidden="true"><img class="sh-hand" src="${art('char_v3b_yijun_hand_v2')}" alt="" aria-hidden="true"></div>
    </div></div>`);
  el.dataset.act = act;
  el.dataset.view = seated ? 'seated' : 'stand';
  for (const im of el.querySelectorAll('img')) im.addEventListener('error', () => { im.style.visibility = 'hidden'; }); // 缺圖：留底色，不擋閱讀
  const bg = el.querySelector('.sh-bg');
  const sky = el.querySelector('.sh-sky');
  const deshu = el.querySelector('.sh-deshu');
  const deshuShadow = el.querySelector('.sh-deshu-shadow');
  const cup = el.querySelector('.sh-cup');
  const cat = el.querySelector('.sh-cat');
  const catImg = cat.querySelector('.sh-cat-img');
  const catShadow = cat.querySelector('.sh-cat-shadow');
  const handBox = el.querySelector('.sh-hand-box');
  const hand = handBox.querySelector('.sh-hand');
  handBox.style.zIndex = String(Z_FRONT);
  let timers = [];
  let catKey;
  let spot = null;
  let petTimer = 0;
  let shown = null; // 上一次 beat 用的定景（null＝這一幕還沒 beat：第一次直接換，不淡）
  let light = null; // 上一次 beat 的光線（切片、配光）
  let pieces = []; // 這種光線已放上去的切片 <img>
  let fadeTimer = 0;
  let oldBg = null; // 交叉淡化時疊在上面、正在淡掉的舊底圖
  let oldPieces = []; // 交叉淡化時正在淡掉的舊光線切片
  const dropOld = () => {
    clearTimeout(fadeTimer);
    if (oldBg) oldBg.remove();
    oldBg = null;
    oldPieces.forEach((p) => p.remove());
    oldPieces = [];
  };
  // 放這種光線的切片（只放 shop-cut-ready.js 有的；沒有就一片都不放、不發請求）。新的插在底圖正後面：
  // 同 z 時 DOM 在後的蓋前面，所以正在淡掉的舊片（DOM 較後）會蓋在新片上面一起淡掉
  const placePieces = (lt, fade) => {
    const old = pieces;
    pieces = readyPieces(lt).map((p) => {
      const im = document.createElement('img');
      im.className = 'sh-piece';
      im.alt = '';
      im.setAttribute('aria-hidden', 'true');
      im.dataset.piece = p.id;
      im.addEventListener('error', () => { im.style.visibility = 'hidden'; });
      const [x0, y0, x1, y1] = p.box;
      Object.assign(im.style, { left: pct((x0 / ART_W) * 100), top: pct((y0 / ART_H) * 100), width: pct(((x1 - x0) / ART_W) * 100), height: pct(((y1 - y0) / ART_H) * 100), zIndex: String(p.base) });
      im.src = art(p.ref);
      return im;
    });
    for (const im of [...pieces].reverse()) bg.after(im);
    if (fade && old.length) {
      for (const o of old) { o.classList.add('sh-piece-old'); void o.offsetWidth; o.style.opacity = '0'; }
      oldPieces.push(...old);
    } else old.forEach((o) => o.remove());
  };
  // 舊底圖（與舊光線的切片）複製一張疊在新圖上面（窗的天色、德叔、貓都在它上面），再把它淡掉：兩張圖疊著淡，不是瞬間切；
  // 切片跟底圖一起淡，淡到一半不會出現錯光線的家具
  const crossFade = (fromSrc) => {
    dropOld();
    oldBg = bg.cloneNode(false);
    oldBg.classList.remove('sh-bg');
    oldBg.classList.add('sh-bg-old');
    oldBg.src = fromSrc;
    bg.after(oldBg);
    void oldBg.offsetWidth;
    oldBg.style.opacity = '0';
    fadeTimer = setTimeout(dropOld, BG_FADE_MS + 100);
  };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  // 貓圖框跟著這張圖的腳線放：腳線對到 spot.y（不是圖框底邊）；接觸陰影在腳線上、寬度照身體範圍
  const frameCat = (img) => {
    const f = catFrame(spot, img);
    Object.assign(cat.style, { left: pct(f.left), width: pct(f.width), top: pct(f.top) });
    const fy = (f.foot / CAT_IMG.h) * 100;
    const [b0, b1] = CAT_FOOT[img]?.body || [CAT_IMG.w * 0.2, CAT_IMG.w * 0.8];
    const inset = (b1 - b0) * 0.1;
    Object.assign(catShadow.style, { left: pct(((b0 + inset) / CAT_IMG.w) * 100), width: pct(((b1 - b0 - 2 * inset) / CAT_IMG.w) * 100), top: pct(fy) });
    return fy;
  };
  const step = (st) => {
    const src = art(st.img);
    if (catImg.getAttribute('src') !== src) catImg.src = src;
    const fy = frameCat(st.img);
    catImg.style.transformOrigin = `50% ${fy.toFixed(2)}%`;
    catImg.style.transform = `scale(${st.s || 1})`;
    cat.classList.toggle('bob', !!st.bob);
  };
  const rest = () => step({ img: spot.lick && !petted ? 'cat_longan_lick_paw_v2' : spot.img });
  const setCat = (key) => {
    if (key === catKey) return;
    catKey = key;
    clearTimers();
    spot = CAT_2D[key] || null;
    if (!spot) { cat.hidden = true; return; }
    cat.hidden = false;
    cat.classList.toggle('flip', !!spot.flip);
    if (!spot.seq) { rest(); return; }
    let t = 0;
    for (const st of spot.seq) {
      const at = t;
      if (at === 0) step(st);
      else timers.push(setTimeout(() => step(st), at));
      if (st.ms == null) break;
      t += st.ms;
    }
  };
  const ctl = {
    beat(look = {}) {
      const id = stillOf(look, seated);
      const ref = srcOf(id);
      const fade = fadesBetween(shown, id);
      if (ref && bg.getAttribute('src') !== art(ref)) {
        if (fade) crossFade(bg.getAttribute('src'));
        else dropOld();
        bg.src = art(ref);
      }
      shown = id;
      const lt = lightOf(look, seated);
      if (lt !== light) { placePieces(lt, fade); light = lt; }
      el.dataset.light = lt;
      el.style.setProperty('--lit', LIGHT_FILTER[lt]);
      el.dataset.frame = look.frame || 'counter';
      const s = skyOf(look);
      sky.dataset.kind = s.kind;
      sky.style.opacity = String(s.alpha);
      const d = !seated && look.deshu ? DESHU_2D[look.deshu] : null;
      deshu.hidden = !d;
      deshuShadow.hidden = true;
      if (d) {
        if (deshu.getAttribute('src') !== art(d.img)) deshu.src = art(d.img);
        const f = deshuFrame(d);
        // 站在吧台後面：吧台檯面以下切掉（一律）；z 排在 bar_front 下面（切片到位時檯上白杯、磨豆機在他前面）
        const clipped = deshuClipped(d);
        const z = zOf({ foot: pxY(d.y), behind: d.behind }, lt);
        Object.assign(deshu.style, { left: pct(d.x), top: pct(f.top), height: pct(d.h), zIndex: String(z), clipPath: clipped ? `inset(0 0 ${f.clipBottom.toFixed(1)}% 0)` : '' });
        // 接觸陰影：腳底那一條（被 clip 擋住時腳在吧台後面看不到，不放陰影）
        if (!clipped) {
          const wPct = d.h * (DESHU_IMG.w / DESHU_IMG.h) * (ART_H / ART_W); // 立繪框寬（% 相對原圖寬）
          const [c0, c1] = DESHU_FOOT[d.img]?.contact || [DESHU_IMG.w * 0.4, DESHU_IMG.w * 0.6];
          const cw = ((c1 - c0) / DESHU_IMG.w) * wPct * 1.8;
          const cx = d.x + (((c0 + c1) / 2 - DESHU_IMG.w / 2) / DESHU_IMG.w) * wPct;
          Object.assign(deshuShadow.style, { left: pct(cx - cw / 2), width: pct(cw), top: pct(d.y), zIndex: String(z) });
          deshuShadow.hidden = false;
        }
      }
      cup.hidden = !cupShown(look, seated);
      cup.style.zIndex = String(zOf({ foot: pxY(cp.y), on: CUP_ON[seated ? 'seated' : 'stand'] }, lt));
      setCat(look.cat || null);
      if (spot) cat.style.zIndex = String(zOf({ foot: pxY(spot.y), on: spot.on, before: spot.before }, lt));
    },
    // 熱點目標元素（藏起來時量不到大小，熱點自己不出現；見 main.js 的 elRect）
    hot(name) {
      if (name === 'chair') return el.querySelector('#sh-chair');
      if (name === 'bar') return el.querySelector('#sh-bar'); // 吧台檯面（第二天把鑰匙放到吧台的放置目標）
      if (name === 'cat') return cat;
      if (name === 'cup') return cup;
      return null;
    },
    // 點貓：手入鏡摸頭、頭頂上來（摸完坐著，不再舔前腳）
    pet() {
      if (!spot) return;
      petted = true;
      clearTimers();
      step({ img: 'cat_longan_headbump_v2' });
      // 手的框＝頂頭圖的貓框（同位置、同翻轉），但是 .sh-cat 的兄弟、z 最高：不被椅背切掉
      const f = catFrame(spot, 'cat_longan_headbump_v2');
      Object.assign(handBox.style, { left: pct(f.left), width: pct(f.width), top: pct(f.top) });
      handBox.classList.toggle('flip', !!spot.flip);
      hand.classList.remove('go');
      void hand.offsetWidth;
      hand.classList.add('go');
      clearTimeout(petTimer);
      petTimer = setTimeout(() => { hand.classList.remove('go'); if (spot) rest(); }, PET_MS);
    },
    // 拿起杯子喝一口
    sip() {
      cup.classList.remove('sip');
      void cup.offsetWidth;
      cup.classList.add('sip');
    },
    stop() { clearTimers(); clearTimeout(petTimer); dropOld(); },
  };
  return ctl;
}
