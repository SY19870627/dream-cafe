// 可玩流程（劇本 v5.6：第一天～研發咖啡）的素材對照表：每個 slot 一列，換正式圖時只改這裡。
// 欄位：
//   id      ：slot 名（程式用的鍵）
//   use     ：用途（哪一場、畫什麼）
//   planned ：正式圖預定鍵（畫師交圖時用這個檔名放進 assets/art/，副檔名 .webp）
//   status  ：ready＝已有正式圖，src 就是它；temp＝暫代（src 是暫用的既有圖，或 null＝純 CSS）；none＝不顯示（只有名牌）
//   src     ：目前畫面實際用的 assets/art 檔名（不含副檔名）；null＝不用圖
//   temp    ：目前暫代方式（status 不是 ready 時一定要寫）
// 規則：
// - assets/art/、public/bg/ 只讀：不覆寫、不重新壓縮、不刪；暫代不放新圖進去（純 CSS 或沿用既有圖並註明）。
// - 龍眼貓（cat_longan_*）只當龍眼，不當花斑貓；char_grandpa_* 是阿哲的阿公，不當坤伯。
// - 物件小圖不畫手。
// 換圖：把該列的 status 改成 'ready'、src 改成 planned（或畫師給的檔名），刪掉 temp。

export const ART_MAP = {
  /* ---------- 背景（整張直式圖，1170×2532） ---------- */
  bg_room_morning: { use: '第一天早上：護龍房間（唯一一次在護龍醒來）', planned: 'scene_v3b_room_morning', status: 'temp', src: 'scene_v3b_room_night', temp: '護龍夜景原圖＋顯示時疊早晨色調（不改原圖）' },
  bg_basin: { use: '第一天早上：洗臉（鏡子裡是帶缺點的角色卡）', planned: 'scene_v3b_basin_morning', status: 'temp', src: 'scene_v3b_room_night', temp: '護龍原圖上疊 CSS 洗手台與鏡子，鏡子裡放 char_v3b_yijun_card_flawed_v4' },
  bg_road: { use: '下山的路，接省道進市區', planned: 'scene_county_road', status: 'ready', src: 'scene_county_road' },
  bg_mailbox: { use: '租屋處信箱（可點，空的）', planned: 'scene_mailboxes', status: 'ready', src: 'scene_mailboxes' },
  bg_stairs: { use: '租屋處樓梯間（房東下樓）', planned: 'scene_v3b_stairwell', status: 'temp', src: null, temp: 'CSS 中性暗色底（樓梯間灰牆、一道斜光），無人形' },
  bg_home: { use: '租屋處房間（八月，悶；窗戶、桌上的錢包、抽屜）', planned: 'scene_v3b_rental_room_aug', status: 'temp', src: 'scene_v3_rain_room', temp: '暫用 scene_v3_rain_room（雨天房，不是正式的八月房間；檔案不覆寫）＋ CSS 錢包與抽屜熱點' },
  bg_atm: { use: '銀行外面的提款機（八月下午，柏油路冒熱氣）', planned: 'scene_v3b_atm_outside', status: 'temp', src: null, temp: 'CSS 中性底（騎樓與機台的方塊），不拿辦公大廳冒充' },
  bg_store: { use: '回家路上的超商內部（櫃檯、門邊的徵人海報）', planned: 'scene_v3b_store_inside', status: 'temp', src: null, temp: 'CSS 中性底（冷白燈、貨架色塊）＋ CSS 海報熱點；海報字由程式疊' },
  bg_village: { use: '三天後：村子的路（一戶一戶敲門；花斑貓從圍牆上跳下來）', planned: 'scene_v3b_village_road', status: 'temp', src: null, temp: 'CSS 中性底（圍牆、路面色塊）' },
  bg_kunyard: { use: '坤伯家的院子（龍眼樹、水桶、空罐子）', planned: 'scene_v3b_kunbo_yard', status: 'temp', src: null, temp: 'CSS 中性底（院子地面、樹影）＋ CSS 水桶與空罐子熱點' },
  bg_shop: { use: '咖啡館店內（沿用開場的店內 360）', planned: 'shop_pano', status: 'ready', src: null },
  bg_office: { use: '開場：辦公室', planned: 'scene_office_night', status: 'ready', src: 'scene_office_night' },
  bg_sanheyuan_dusk: { use: '開場：三合院外（傍晚）', planned: 'scene_v3b_sanheyuan_dusk_v2', status: 'ready', src: 'scene_v3b_sanheyuan_dusk_v2' },
  bg_sanheyuan_night: { use: '開場：三合院外（晚上）', planned: 'scene_v3b_sanheyuan_night_v2', status: 'ready', src: 'scene_v3b_sanheyuan_night_v2' },
  bg_courtyard_night: { use: '開場：庭埕（晚上）', planned: 'scene_v3b_courtyard_night_v2', status: 'ready', src: 'scene_v3b_courtyard_night_v2' },
  bg_room_night: { use: '開場：護龍房間（晚上）', planned: 'scene_v3b_room_night', status: 'ready', src: 'scene_v3b_room_night' },
  bg_bed_pov: { use: '開場：躺下的視角', planned: 'scene_v3b_bed_pov_night', status: 'ready', src: 'scene_v3b_bed_pov_night' },

  /* ---------- 角色 ---------- */
  ch_deshu: { use: '德叔立繪（店裡說話時）', planned: 'char_deshu_stand', status: 'ready', src: 'char_deshu_stand' },
  ch_deshu_smile: { use: '德叔微笑（「我相信妳一定可以的。」「如果包含找龍眼玩的貓客人……」）', planned: 'char_deshu_smile', status: 'ready', src: 'char_deshu_smile' },
  ch_yijun_flawed: { use: '洗臉時鏡子裡的怡君（帶缺點：雀斑、黑眼圈）', planned: 'char_v3b_yijun_card_flawed_v4', status: 'ready', src: 'char_v3b_yijun_card_flawed_v4' },
  ch_longan: { use: '龍眼（店裡的橘貓）', planned: 'cat_longan_*', status: 'ready', src: 'cat_longan_sleep' },
  ch_landlord: { use: '房東（六十幾歲，汗衫）', planned: 'char_v3b_landlord', status: 'none', src: null, temp: '不顯示立繪，只有名牌「房東」' },
  ch_kunbo: { use: '坤伯', planned: 'char_v3b_kunbo', status: 'none', src: null, temp: '不顯示立繪，只有名牌「坤伯」（不用 char_grandpa_*）' },
  ch_store_manager: { use: '超商店長', planned: 'char_v3b_store_manager', status: 'none', src: null, temp: '不顯示立繪，只有名牌「店長」' },
  ch_clerk: { use: '超商店員', planned: 'char_v3b_store_clerk', status: 'none', src: null, temp: '不顯示立繪，只有名牌「店員」' },
  ch_calico: { use: '花斑貓（村子路上可點；院子）', planned: 'cat_v3b_calico', status: 'temp', src: null, temp: 'CSS 中性剪影（灰色貓形輪廓，不用龍眼貓圖）' },
  ch_passerby: { use: '路過的客人（只在旁白提到）', planned: null, status: 'none', src: null, temp: '不出現' },

  /* ---------- 小圖（疊在原場景上；先疊上來，點一下才出句子，講完收掉；不畫手） ---------- */
  mini_stain: { use: '小圖：窗戶下的水痕', planned: 'mini_v3b_window_stain', status: 'temp', src: null, temp: 'CSS：米白牆面＋一塊褐色水痕形狀' },
  mini_passbook: { use: '小圖：存摺（抽屜裡、爸幫我開的戶頭）', planned: 'mini_v3b_passbook', status: 'temp', src: null, temp: 'CSS：沿用 .pp-passbook 的存摺外形（同一件東西，不是無關道具）' },
  mini_hat: { use: '小圖：斗笠（德叔從門邊拿的）', planned: 'mini_v3b_douli', status: 'temp', src: null, temp: 'CSS：圓錐斗笠剪影' },
  mini_label: { use: '小圖：空罐子的標籤（寫著農藥）', planned: 'mini_v3b_pesticide_label', status: 'temp', src: null, temp: 'CSS：中性罐身＋標籤，程式疊「農藥」二字（正式圖也不指望圖上有字）' },
  mini_longan: { use: '小圖：龍眼乾（剝開的殼、黑亮的果肉）', planned: 'mini_v3b_dried_longan', status: 'temp', src: null, temp: 'CSS：褐色圓殼＋深色果肉（不用既有 longanBag／longanJar）' },

  /* ---------- 特寫卡（#op-prop 的 pp-card） ---------- */
  pp_printing: { use: '提款機補刷：存摺一行一行印', planned: null, status: 'temp', src: null, temp: '既有 CSS .pp-passbook.printing' },
  pp_passbook: { use: '存摺退出來（餘額十六萬）', planned: null, status: 'temp', src: null, temp: '既有 CSS .pp-passbook（不疊數字，劇本沒寫畫面上的字）' },
  pp_poster: { use: '超商門邊的徵人海報（畫面拉近）', planned: 'prop_v3b_store_poster', status: 'temp', src: null, temp: 'CSS 白紙海報，程式疊「誠徵門市人員」（劇本沒寫薪資數字，不疊薪水）' },
  pp_paperbag: { use: '測試品的紙袋（德叔寫上「提神醒腦，過目不忘」）', planned: 'prop_v3b_test_paperbag', status: 'temp', src: null, temp: 'CSS 牛皮紙袋，程式疊德叔寫的字' },
  pp_key: { use: '包包裡的鑰匙（點了放到吧台上）', planned: 'key', status: 'ready', src: 'key' },
};

// 程式疊在圖上的字（不指望圖上有字）
export const OVERLAY_TEXT = {
  label: '農藥', // 空罐子的標籤（劇本：「坤伯，這上面寫的是農藥。」）
  poster: '誠徵門市人員', // 徵人海報（劇本：上面寫「誠徵門市人員」和薪水；薪水數字劇本沒寫，不疊）
  paperbag: '提神醒腦，過目不忘', // 德叔在紙袋上寫的字
};

// 這個 slot 現在要用的圖（null＝純 CSS 或不顯示）
export const srcOf = (id) => ART_MAP[id]?.src ?? null;
// 會用到的既有原圖（預載用）
export const ART_MAP_FILES = [...new Set(Object.values(ART_MAP).map((s) => s.src).filter(Boolean))];
