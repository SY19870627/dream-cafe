// 可玩流程（劇本 v5.8：開場～研發咖啡）的素材對照表：每個 slot 一列，換正式圖時只改這裡。
// v5.8 新增的格子在下面「劇本 v5.8」各段（開場第二幕的房間與信封）；其餘沿用 v5.6 定版圖。
// 圖放在兩個地方：v5.6 新圖在 assets/art-v56/，舊圖仍在 assets/art/，兩邊都不覆寫。
// 欄位：
//   id       ：slot 名（程式用的鍵）
//   use      ：用途（哪一場、畫什麼）
//   planned  ：正式圖預定鍵（舊稿時的命名；定版後以 src 為準）
//   status   ：ready＝已有正式圖，src 就是它；temp＝暫代（src 是暫用的既有圖，或 null＝純 CSS）；none＝不顯示
//   dir      ：圖在 assets/ 底下的哪個資料夾（不寫＝assets/art/；v5.6 定版圖是 art-v56/A、art-v56/B、art-v56/C）
//   src      ：目前畫面實際用的檔名（不含副檔名、不含資料夾）；null＝不用圖
//   variants ：差分（同一個角色的其他動作；檔案在 <dir>/variants/）：{ 差分名: 檔名 }
//   temp     ：目前暫代方式（status 不是 ready 時一定要寫）
// 規則：
// - assets/art/、assets/art-v56/、public/bg/ 只讀：不覆寫、不重新壓縮、不刪、不搬。
// - 背景只用直式（1170×2532，檔名有 _portrait）；橫版不用。村子路用 _portrait_v2。
//   例外：第一天的空信箱 scene_mailboxes_empty 是定版橫圖（1950×1200），用信箱專用圖框整張放進去（見 bg_mailbox）。
// - 龍眼貓（cat_longan_*）只當龍眼，不當花斑貓；花斑貓只用 cat_huaban_*。char_grandpa_* 是阿哲的阿公，不當坤伯。
// - 物件小圖不畫手；圖上不指望有字（「農藥」「誠徵門市人員」都由程式疊）。
// 程式取圖：refOf(id, 差分) → 參照（舊圖是檔名，新圖是「art-v56/B/檔名」）；artUrl(參照) → 網址。

const V56 = { A: 'art-v56/A', B: 'art-v56/B', C: 'art-v56/C' };

export const ART_MAP = {
  /* ---------- 背景（整張直式圖，1170×2532） ---------- */
  bg_room_morning: { use: '第一天早上：護龍房間（唯一一次在護龍醒來）', planned: 'bg_v56_hulong_morning_portrait', status: 'ready', dir: V56.B, src: 'bg_v56_hulong_morning_portrait' },
  bg_basin: { use: '第一天早上：洗臉（鏡子裡是帶缺點的角色卡）', planned: 'scene_v3b_basin_morning', status: 'temp', src: 'scene_v3b_room_night', temp: '護龍原圖上疊 CSS 洗手台與鏡子，鏡子裡放 char_v3b_yijun_card_flawed_v4' },
  bg_road: { use: '下山的路，接省道進市區', planned: 'scene_county_road', status: 'ready', src: 'scene_county_road' },
  // 第一天「信箱是空的」：定版空信箱 scene_mailboxes_empty（承峰 2026-11-21 23:25 定版；1950×1200 橫圖，門都關著、沒有信封）。
  // 不再用 scene_mailboxes.webp（舊圖有一格門開著、畫著棕色信封；檔案原樣留著，只是不引用）。
  // 這是唯一的橫圖背景：畫面用專用圖框（.dy-place.mbox，1950/1200、整張放進框裡），可點的格子位置見 view/days.js 的 MAILBOX_HOT_CELL。
  bg_mailbox: { use: '租屋處信箱（可點一格，打開是空的）', planned: 'scene_mailboxes_empty', status: 'ready', src: 'scene_mailboxes_empty' },
  bg_stairs: { use: '租屋處樓梯間（房東下樓）', planned: 'bg_v56_stairwell_portrait', status: 'ready', dir: V56.B, src: 'bg_v56_stairwell_portrait' },
  bg_home: { use: '租屋處房間（八月，悶；窗戶下的水痕約在原圖 y 1110–1640、桌上的錢包、抽屜）', planned: 'bg_v56_rental_room_day_portrait', status: 'ready', dir: V56.B, src: 'bg_v56_rental_room_day_portrait' },
  bg_atm: { use: '銀行外面的提款機（八月下午，柏油路冒熱氣）', planned: 'bg_v56_bank_atm_portrait', status: 'ready', dir: V56.B, src: 'bg_v56_bank_atm_portrait' },
  // 超商：定版 bg_v56_store_interior_seating_portrait（承峰 2026-11-22「超商圖定版」；1170×2532）。有座位區，
  // 座位區後牆（吧台上方、窗戶左側）畫好一張有框的空白徵人海報：外框原圖 x 348–646、y 569–977，紙面 x 358–638、y 580–967。
  // 熱點 .dy-poster 對準外框，程式只在紙面疊「誠徵門市人員」（不疊薪水、不再疊 CSS 白紙）。
  // 舊圖 bg_v56_store_interior_portrait.webp 原樣留在 assets/art-v56/B/，只是不再引用。
  bg_store: { use: '回家路上的超商內部（座位區後牆上有框的空白徵人海報，程式在紙面疊「誠徵門市人員」）', planned: 'bg_v56_store_interior_seating_portrait', status: 'ready', dir: V56.B, src: 'bg_v56_store_interior_seating_portrait' },
  bg_village: { use: '三天後：村子的路（一戶一戶敲門；花斑貓從圍牆上跳下來）', planned: 'bg_v56_village_lane_portrait_v2', status: 'ready', dir: V56.B, src: 'bg_v56_village_lane_portrait_v2' },
  bg_kunyard: { use: '坤伯家的院子（龍眼樹、水桶、空罐子）', planned: 'bg_v56_kunbo_yard_portrait', status: 'ready', dir: V56.B, src: 'bg_v56_kunbo_yard_portrait' },
  // 店內 2D 定景（店內環景與「看看店裡」已拔掉，承峰 2026-11-21 20:48）。見下面 SHOP_STILL_NIGHT／SHOP_STILL_DAY／SHOP_STILL_SEATED。
  // 店內定版圖 scene_shop_interior_night_lit_v2（承峰 2026-11-21 23:47「店內圖定版」）：晚上燈亮、左邊一扇窗、右邊吧台（一排杯子、磨豆機）、兩張桌子。
  // 進門／站在店裡用這張；椅子、德叔、龍眼、杯子、窗、吧台的位置都在 shop-still.js 對準這張（SHOP_CHAIR、*_STAND）。
  bg_shop_night: { use: '晚上、燈亮著的店內：進門、點椅子坐下、晚上回來、坤伯答謝、研發咖啡', planned: 'scene_shop_interior_night_lit_v2', status: 'ready', src: 'scene_shop_interior_night_lit_v2' },
  // 點了椅子坐下（coffee）之後：靠窗坐下的特寫（杯子、對面椅子上的龍眼、窗的位置對準這張；檔案原樣留著，不覆寫）
  bg_shop_seated: { use: '坐下喝咖啡：靠窗坐下的特寫（桌上的杯子、對面椅子上的龍眼）', planned: 'scene_v3b_shop_window_night_seated', status: 'ready', src: 'scene_v3b_shop_window_night_seated' },
  bg_shop_day: { use: '早上的店內：第一天挑豆、第二天回店、三天後', planned: 'bg_shop_day_bar', status: 'temp', src: 'scene_shop_interior_night_lit_v2',
    temp: '早上正式圖未到：暫用晚上的店內定版圖（看得到吧台，比舊佔位合適；色調仍是晚上，窗外仍是夜色）。有早上圖再只改這裡的 src' },
  bg_office: { use: '開場：辦公室', planned: 'scene_office_night', status: 'ready', src: 'scene_office_night' },
  bg_sanheyuan_dusk: { use: '開場：三合院外（傍晚）。劇本 v5.8 是「夜裡，東山。」，三合院外三幕都用晚上那張；這張不再出場（檔案留著）', planned: 'scene_v3b_sanheyuan_dusk_v2', status: 'ready', src: 'scene_v3b_sanheyuan_dusk_v2' },
  bg_sanheyuan_night: { use: '開場：三合院外（夜裡到東山、晚上發動、晚上回來）', planned: 'scene_v3b_sanheyuan_night_v2', status: 'ready', src: 'scene_v3b_sanheyuan_night_v2' },
  bg_courtyard_night: { use: '開場：庭埕（晚上）', planned: 'scene_v3b_courtyard_night_v2', status: 'ready', src: 'scene_v3b_courtyard_night_v2' },
  bg_room_night: { use: '開場：護龍房間（晚上）', planned: 'scene_v3b_room_night', status: 'ready', src: 'scene_v3b_room_night' },
  bg_bed_pov: { use: '開場：躺下的視角', planned: 'scene_v3b_bed_pov_night', status: 'ready', src: 'scene_v3b_bed_pov_night' },
  /* 劇本 v5.8（開場第二幕　房間裡那封信） */
  bg_letter_room: { use: 'v5.8 第二幕：租屋處房間（回到家、包包放在床上、摺疊桌上的信）。劇本：畫面同第一天的房間',
    planned: 'bg_v58_rental_room_evening_portrait', status: 'temp', dir: V56.B, src: 'bg_v56_rental_room_day_portrait',
    temp: '沿用第一天的 v5.6 定版房間原圖（白天、八月）；CSS 疊一層傍晚色調（.op-letterroom .op-art::after）。原圖沒有摺疊桌上的信封，信封用 CSS 疊（pp_envelope）' },
  /* ---------- 角色 ---------- */
  ch_deshu: { use: '德叔立繪（店裡說話時）', planned: 'char_deshu_stand', status: 'ready', src: 'char_deshu_stand' },
  ch_deshu_smile: { use: '德叔微笑（「我相信妳一定可以的。」「如果包含找龍眼玩的貓客人……」）', planned: 'char_deshu_smile', status: 'ready', src: 'char_deshu_smile' },
  ch_yijun_flawed: { use: '洗臉時鏡子裡的怡君（帶缺點：雀斑、黑眼圈）', planned: 'char_v3b_yijun_card_flawed_v4', status: 'ready', src: 'char_v3b_yijun_card_flawed_v4' },
  ch_longan: { use: '龍眼（店裡的橘貓）', planned: 'cat_longan_*', status: 'ready', src: 'cat_longan_sleep' },
  ch_landlord: { use: '房東（六十幾歲，汗衫）半身', planned: 'char_v56_landlord_half_v2', status: 'ready', dir: V56.A, src: 'char_v56_landlord_half_v2',
    variants: { nag: 'char_v56_landlord_half_nag', remind_rent: 'char_v56_landlord_half_remind_rent', shoo: 'char_v56_landlord_half_shoo' } },
  ch_kunbo: { use: '坤伯半身（不用 char_grandpa_*）', planned: 'char_v56_kunbo_half_v2', status: 'ready', dir: V56.A, src: 'char_v56_kunbo_half_v2',
    variants: { squint_bottle: 'char_v56_kunbo_half_squint_bottle', sheepish: 'char_v56_kunbo_half_sheepish', offer_longan: 'char_v56_kunbo_half_offer_longan' } },
  ch_store_manager: { use: '超商店長半身', planned: 'char_v56_store_manager_half_v2', status: 'ready', dir: V56.A, src: 'char_v56_store_manager_half_v2',
    variants: { scold_bento: 'char_v56_store_manager_half_scold_bento', exasperated: 'char_v56_store_manager_half_exasperated' } },
  ch_clerk: { use: '超商店員半身', planned: 'char_v56_store_clerk_half_v2', status: 'ready', dir: V56.A, src: 'char_v56_store_clerk_half_v2',
    variants: { downcast: 'char_v56_store_clerk_half_downcast', sorry_bow: 'char_v56_store_clerk_half_sorry_bow' } },
  ch_calico: { use: '花斑貓（村子路圍牆跳下、跟著走；院子；店裡撥龍眼乾）。不用龍眼貓圖', planned: 'cat_huaban_sit_v2', status: 'ready', dir: V56.A, src: 'cat_huaban_sit_v2',
    variants: { jump: 'cat_huaban_jump', walk: 'cat_huaban_walk', paw: 'cat_huaban_paw' } },
  ch_passerby: { use: '路過的客人（只在旁白提到）', planned: null, status: 'none', src: null, temp: '不出現' },
  /* ---------- 小圖（疊在原場景上；先疊上來，點一下才出句子，講完收掉；不畫手） ---------- */
  mini_stain: { use: '小圖：窗戶下的水痕', planned: 'prop_v56_water_stain_v2', status: 'ready', dir: V56.C, src: 'prop_v56_water_stain_v2' },
  mini_passbook: { use: '小圖：存摺（抽屜裡、爸幫我開的戶頭）', planned: 'prop_v56_passbook_drawer_v2', status: 'ready', dir: V56.C, src: 'prop_v56_passbook_drawer_v2' },
  mini_hat: { use: '小圖：斗笠（德叔從門邊拿的）', planned: 'prop_v56_douli_v2', status: 'ready', dir: V56.C, src: 'prop_v56_douli_v2' },
  mini_label: { use: '小圖：空罐子的標籤（標籤留白，程式疊「農藥」）', planned: 'prop_v56_empty_can_label_v2', status: 'ready', dir: V56.C, src: 'prop_v56_empty_can_label_v2' },
  mini_longan: { use: '小圖：龍眼乾（剝開的殼、黑亮的果肉）', planned: 'prop_v56_dried_longan_v2', status: 'ready', dir: V56.C, src: 'prop_v56_dried_longan_v2' },

  /* ---------- 特寫卡（#op-prop 的 pp-card） ---------- */
  pp_printing: { use: '提款機補刷：存摺一行一行印', planned: null, status: 'temp', src: null, temp: '既有 CSS .pp-passbook.printing' },
  pp_passbook: { use: '存摺退出來（餘額十六萬）', planned: null, status: 'temp', src: null, temp: '既有 CSS .pp-passbook（不疊數字，劇本沒寫畫面上的字）' },
  pp_poster: { use: '超商的徵人海報（畫面拉近）；場景上的海報是底圖座位區後牆上那張有框的空白海報（熱點 .dy-poster 對準外框）', planned: 'prop_v3b_store_poster', status: 'temp', src: null, temp: 'CSS 白紙海報，程式疊「誠徵門市人員」（劇本沒寫薪資數字，不疊薪水）' },
  pp_paperbag: { use: '測試品的紙袋（德叔寫上「提神醒腦，過目不忘」）', planned: 'prop_v3b_test_paperbag', status: 'temp', src: null, temp: 'CSS 牛皮紙袋，程式疊德叔寫的字' },
  pp_key: { use: '鑰匙（第一天早上拖向德叔，沒有接、回到手上；第二天點包包裡的鑰匙放到吧台上）', planned: 'key', status: 'ready', src: 'key' },
  /* 劇本 v5.8 */
  pp_envelope: { use: '第二幕：摺疊桌上的牛皮紙信封（點了把信抽出來，只能點一次）', planned: 'prop_v58_envelope_desk', status: 'temp', src: null, temp: 'CSS 牛皮紙信封（.op-env），疊在房間原圖右邊小桌上' },
  bg_cafe_bamboo: { use: '第一天早上店裡：吧台上攤著兩個竹篩，生豆鋪滿；德叔背後架子上自己放一格的杯子', planned: 'bg_shop_day_bar_beans', status: 'temp', src: null, temp: '用店內 2D 定景的早上佔位（SHOP_STILL_DAY）；竹篩、生豆、架子上的杯子沒有另畫' },
};

// 店內定景。換圖只改 src（不要改 id）。
// SHOP_STILL_NIGHT：晚上、燈亮、進門／點椅子坐下之前／晚上回來／答謝／研發 → scene_shop_interior_night_lit_v2（定版）
// SHOP_STILL_SEATED：點了椅子、坐下喝咖啡（coffee）→ scene_v3b_shop_window_night_seated（靠窗特寫）
// SHOP_STILL_DAY：早上店裡（第一天挑豆、第二天回店、三天後）。早上正式圖未到，暫與夜景用同一張 v2（色調仍是晚上）。
export const SHOP_STILL_NIGHT = 'bg_shop_night';
export const SHOP_STILL_SEATED = 'bg_shop_seated';
export const SHOP_STILL_DAY = 'bg_shop_day';

// 程式疊在圖上的字（不指望圖上有字）
export const OVERLAY_TEXT = {
  label: '農藥', // 空罐子的標籤（劇本：「坤伯，這上面寫的是農藥。」）
  poster: '誠徵門市人員', // 徵人海報（劇本：上面寫「誠徵門市人員」和薪水；薪水數字劇本沒寫，不疊）
  paperbag: '提神醒腦，過目不忘', // 德叔在紙袋上寫的字
};

// 參照 → 網址：舊圖（沒有斜線）在 assets/art/；新圖（art-v56/…）在 assets/ 底下照子路徑
export const artUrl = (ref) => (String(ref).includes('/') ? `assets/${ref}.webp` : `assets/art/${ref}.webp`);
// 這個 slot（與差分）現在要用的圖的參照；null＝純 CSS 或不顯示。差分沒有對上就用底卡
export function refOf(id, variant = null) {
  const s = ART_MAP[id];
  if (!s?.src) return null;
  const v = variant && s.variants?.[variant];
  if (v) return `${s.dir}/variants/${v}`;
  return s.dir ? `${s.dir}/${s.src}` : s.src;
}
export const srcOf = (id) => refOf(id);
export const urlOf = (id, variant = null) => { const r = refOf(id, variant); return r ? artUrl(r) : null; };
// 會用到的原圖（預載用；含差分）
export const ART_MAP_FILES = [...new Set(Object.keys(ART_MAP).flatMap((id) => [refOf(id), ...Object.keys(ART_MAP[id].variants || {}).map((v) => refOf(id, v))]).filter(Boolean))];
