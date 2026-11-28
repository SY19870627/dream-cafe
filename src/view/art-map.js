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
import { cutFile } from './shop-pieces.js';
// 規則：
// - assets/art/、assets/art-v56/、public/bg/ 只讀：不覆寫、不重新壓縮、不刪、不搬。
// - 背景只用直式（1170×2532，檔名有 _portrait）；橫版不用。村子路用 _portrait_v2。
//   例外：第一天的空信箱 scene_mailboxes_empty 是定版橫圖（1950×1200），用信箱專用圖框整張放進去（見 bg_mailbox）。
// - 龍眼貓（cat_longan_*）只當龍眼，不當花斑貓；花斑貓只用 cat_huaban_*。char_grandpa_* 是阿哲的阿公，不當坤伯。
// - 物件小圖不畫手；圖上不指望有字（「農藥」、超商場景上遠看的「誠徵門市人員」由程式疊）。
// - 分鏡格（sb_*）也不畫手（貓爪可以）；圖上的字全部畫進圖（10,000／160,000、紙袋上的字），程式不疊字。
// 程式取圖：refOf(id, 差分) → 參照（舊圖是檔名，新圖是「art-v56/B/檔名」）；artUrl(參照) → 網址。

const V56 = { A: 'art-v56/A', B: 'art-v56/B', C: 'art-v56/C', S: 'art-v56/S' };

export const ART_MAP = {
  /* ---------- 背景（整張直式圖，1170×2532） ---------- */
  // 護龍早上改用 _v2（畫師 2026-11 codeart 交稿）；原檔 bg_v56_hulong_morning_portrait.webp 留在磁碟，不覆蓋、不刪，只是不再引用
  bg_room_morning: { use: '第一天早上：護龍房間（唯一一次在護龍醒來）', planned: 'bg_v56_hulong_morning_portrait_v2', status: 'ready', dir: V56.B, src: 'bg_v56_hulong_morning_portrait_v2' },
  // 洗臉：早晨洗手台底圖（紅磚牆、木框鏡子、銅色水龍頭、石洗手台）。鏡面原圖 x 458–878、y 588–1215；銅色水龍頭 x 615–760、y 1290–1530。
  // 鏡子裡仍由程式放角色卡（flawed_v4）、霧氣，水龍頭下淡藍水流；最上層疊鏡框前景 fg_basin_mirror，蓋住角色卡的邊。不再疊 CSS 水槽／塑膠框
  bg_basin: { use: '第一天早上：洗臉（鏡子裡是帶缺點的角色卡）', planned: 'bg_v56_hulong_basin_morning_portrait', status: 'ready', dir: V56.B, src: 'bg_v56_hulong_basin_morning_portrait' },
  fg_basin_mirror: { use: '洗臉：木頭鏡框前景（1170×2532 透明對齊層，疊在鏡子裡的角色卡與霧氣上面）', planned: 'prop_v56_basin_mirror_frame_v1', status: 'ready', dir: V56.C, src: 'prop_v56_basin_mirror_frame_v1' },
  bg_road: { use: '下山的路，接省道進市區', planned: 'scene_county_road', status: 'ready', src: 'scene_county_road' },
  // 第一天「信箱是空的」：定版空信箱 scene_mailboxes_empty（承峰 2026-11-21 23:25 定版；1950×1200 橫圖，門都關著、沒有信封）。
  // 不再用 scene_mailboxes.webp（舊圖有一格門開著、畫著棕色信封；檔案原樣留著，只是不引用）。
  // 這是唯一的橫圖背景：畫面用專用圖框（.dy-place.mbox，1950/1200、整張放進框裡），可點的格子位置見 view/days.js 的 MAILBOX_HOT_CELL。
  bg_mailbox: { use: '租屋處信箱（可點一格，打開是空的）', planned: 'scene_mailboxes_empty', status: 'ready', src: 'scene_mailboxes_empty' },
  bg_stairs: { use: '租屋處樓梯間（房東下樓）', planned: 'bg_v56_stairwell_portrait', status: 'ready', dir: V56.B, src: 'bg_v56_stairwell_portrait' },
  bg_home: { use: '租屋處房間（八月，悶；窗戶下的水痕約在原圖 y 1110–1640、桌上的錢包、抽屜）', planned: 'bg_v56_rental_room_day_portrait', status: 'ready', dir: V56.B, src: 'bg_v56_rental_room_day_portrait' },
  bg_atm: { use: '郵局外面的提款機（八月下午，柏油路冒熱氣；承峰 2026-11-25 定版郵局版）', planned: 'bg_v56_post_atm_portrait', status: 'ready', dir: V56.B, src: 'bg_v56_post_atm_portrait' },
  // 超商：定版 bg_v56_store_interior_seating_portrait（承峰 2026-11-22「超商圖定版」；1170×2532）。有座位區，
  // 座位區後牆（吧台上方、窗戶左側）畫好一張有框的空白徵人海報：外框原圖 x 348–646、y 569–977，紙面 x 358–638、y 580–967。
  // 熱點 .dy-poster 對準外框，程式只在紙面疊「誠徵門市人員」（不疊薪水、不再疊 CSS 白紙）。
  // 舊圖 bg_v56_store_interior_portrait.webp 原樣留在 assets/art-v56/B/，只是不再引用。
  bg_store: { use: '回家路上的超商內部（座位區後牆上有框的空白徵人海報，程式在紙面疊「誠徵門市人員」）', planned: 'bg_v56_store_interior_seating_portrait', status: 'ready', dir: V56.B, src: 'bg_v56_store_interior_seating_portrait' },
  // v5.9 超商轉場：提款機淡出到黑底，三句旁白在黑底上出，再淡入超商（承峰 2026-11-22 17:15「超商轉場照用」）
  bg_black: { use: '提款機之後、超商之前的黑底（三句旁白在黑底上出）', planned: null, status: 'none', src: null, temp: '不用圖：純 CSS 黑底（.dy-css-black）' },
  bg_village: { use: '三天後：村子的路（一戶一戶敲門；花斑貓從圍牆上跳下來）', planned: 'bg_v56_village_lane_portrait_v2', status: 'ready', dir: V56.B, src: 'bg_v56_village_lane_portrait_v2' },
  bg_kunyard: { use: '坤伯家的院子（龍眼樹、水桶、空罐子）', planned: 'bg_v56_kunbo_yard_portrait', status: 'ready', dir: V56.B, src: 'bg_v56_kunbo_yard_portrait' },
  // 坤伯院子的去背層（皆 1170×2532 透明對齊層，整張疊上）：取代原本兩個 CSS 色塊罐子
  //   空罐子倒在地上（原圖約 x 205–335、y 2030–2110；可點，點了淡出 → 標籤小圖）；立著的肥料罐一直留著；
  //   提水桶那句：地面補丁（蓋住原圖院子中間的水桶）＋牆角水桶淡入，之後留著
  // 空罐子、地面補丁、牆角水桶改用畫師 2026-11 交的 v2（v1 原檔留在磁碟，不覆蓋、不刪，只是不再引用）。
  //   補丁 v2 裡畫了一小截立著的肥料罐（瓶蓋與肩）：圖層維持「補丁在下、立罐（yard_fertilizer_can，一直留著）在上」，那一截被立罐蓋住。
  //   牆角水桶 v2 放在磚屋右側、木凳右邊靠牆。
  yard_empty_can: { use: '坤伯院子：倒在地上的空罐子（可點；點了淡出，接標籤小圖）', planned: 'prop_v56_yard_empty_can_down_v2', status: 'ready', dir: V56.C, src: 'prop_v56_yard_empty_can_down_v2' },
  yard_fertilizer_can: { use: '坤伯院子：立著、還沒開的肥料罐（一直留著）', planned: 'prop_v56_yard_fertilizer_can_stand_v1', status: 'ready', dir: V56.C, src: 'prop_v56_yard_fertilizer_can_stand_v1' },
  yard_bucket_patch: { use: '坤伯院子：地面補丁（水桶提到牆角後，蓋住原圖上的水桶；疊在立著的肥料罐下面）', planned: 'prop_v56_yard_bucket_patch_v2', status: 'ready', dir: V56.C, src: 'prop_v56_yard_bucket_patch_v2' },
  yard_bucket_corner: { use: '坤伯院子：提到牆角的水桶（磚屋右側、木凳右邊靠牆）', planned: 'prop_v56_yard_bucket_corner_v2', status: 'ready', dir: V56.C, src: 'prop_v56_yard_bucket_corner_v2' },
  // 店內 2D 定景（店內環景與「看看店裡」已拔掉，承峰 2026-11-21 20:48）。見下面 SHOP_STILL_NIGHT／SHOP_STILL_DAY／SHOP_STILL_SEATED。
  // 店內定版圖 scene_shop_interior_night_lit_v2（承峰 2026-11-21 23:47「店內圖定版」）：晚上燈亮、左邊一扇窗、右邊吧台（一排杯子、磨豆機）、兩張桌子。
  // 進門／站在店裡用這張；椅子、德叔、龍眼、杯子、窗、吧台的位置都在 shop-still.js 對準這張（SHOP_CHAIR、*_STAND）。
  // 坤伯答謝開頭改用傍晚圖 bg_shop_dusk；「外面天色慢慢暗下來」那句交叉淡化到這張，之後停在夜景。
  bg_shop_night: { use: '晚上、燈亮著的店內：開場進門、點椅子坐下、晚上回來；坤伯答謝天暗之後；研發咖啡（答謝開頭改用傍晚圖）', planned: 'scene_shop_interior_night_lit_v2', status: 'ready', src: 'scene_shop_interior_night_lit_v2' },
  // 點了椅子坐下（coffee）之後：靠窗坐下的特寫（杯子、對面椅子上的龍眼、窗的位置對準這張；檔案原樣留著，不覆寫）
  bg_shop_seated: { use: '坐下喝咖啡：靠窗坐下的特寫（桌上的杯子、對面椅子上的龍眼）', planned: 'scene_v3b_shop_window_night_seated', status: 'ready', src: 'scene_v3b_shop_window_night_seated' },
  // 早上店內正式圖 scene_shop_interior_day_v1（承峰 2026-11-22 17:20「白天店內圖可以，接進遊戲」；1170×2532，放在 assets/art-v59/，不進 assets/art）。
  // 與夜景 v2 同構圖（椅子、吧台、窗的位置沿用 *_STAND／SHOP_CHAIR／SHOP_BAR）；早晨光線與窗外白天已畫在圖上，不再疊天色。
  bg_shop_day: { use: '早上的店內：第一天挑豆、第二天回店、三天後', planned: 'scene_shop_interior_day_v1', status: 'ready', dir: 'art-v59', src: 'scene_shop_interior_day_v1' },
  // 傍晚店內正式圖 scene_shop_interior_dusk_v1（承峰 2026-11-22 19:16「傍晚店內圖可以，接進遊戲」；1170×2532，放在 assets/art-v59/，不進 assets/art）。
  // 與夜景 v2 同構圖（位置沿用 *_STAND）；傍晚窗外與光線已畫在圖上，不再疊天色。
  bg_shop_dusk: { use: '傍晚的店內：三天後坤伯來答謝的開頭（天暗下來之前）', planned: 'scene_shop_interior_dusk_v1', status: 'ready', dir: 'art-v59', src: 'scene_shop_interior_dusk_v1' },
  bg_office: { use: '開場：辦公室', planned: 'scene_office_night', status: 'ready', src: 'scene_office_night' },
  bg_sanheyuan_dusk: { use: '開場：三合院外（傍晚）。劇本 v5.8 是「夜裡，東山。」，三合院外三幕都用晚上那張；這張不再出場（檔案留著）', planned: 'scene_v3b_sanheyuan_dusk_v2', status: 'ready', src: 'scene_v3b_sanheyuan_dusk_v2' },
  bg_sanheyuan_night: { use: '開場：三合院外（夜裡到東山、晚上發動、晚上回來）', planned: 'scene_v3b_sanheyuan_night_v2', status: 'ready', src: 'scene_v3b_sanheyuan_night_v2' },
  // 三合院的雙扇門（皆 1170×2532 透明對齊層）：取代 CSS 假門板。固定扇（左，原圖 x 621–685）不動；活動扇（觀眾面對大門的右扇，x 685–748、y 1506–1706）
  // 依拖曳淡換三張開度（關／開一道縫／全開），門後暖光跟著變亮。圖層：暖光 → 固定扇 → 活動扇 → 台階上的貓。「推門進去」由程式疊，不畫進門板
  door_glow: { use: '三合院門：門後暖光（拖曳時跟著變亮）', planned: 'prop_v56_sanheyuan_door_glow_v1', status: 'ready', dir: V56.C, src: 'prop_v56_sanheyuan_door_glow_v1' },
  door_fixed: { use: '三合院門：固定扇（左扇，不動）', planned: 'prop_v56_sanheyuan_door_fixed_v1', status: 'ready', dir: V56.C, src: 'prop_v56_sanheyuan_door_fixed_v1' },
  door_leaf_shut: { use: '三合院門：活動扇關著', planned: 'prop_v56_sanheyuan_door_leaf_shut_v1', status: 'ready', dir: V56.C, src: 'prop_v56_sanheyuan_door_leaf_shut_v1' },
  door_leaf_ajar: { use: '三合院門：活動扇開一道縫（只點一下時閃一下再彈回）', planned: 'prop_v56_sanheyuan_door_leaf_ajar_v1', status: 'ready', dir: V56.C, src: 'prop_v56_sanheyuan_door_leaf_ajar_v1' },
  door_leaf_open: { use: '三合院門：活動扇全開', planned: 'prop_v56_sanheyuan_door_leaf_open_v1', status: 'ready', dir: V56.C, src: 'prop_v56_sanheyuan_door_leaf_open_v1' },
  bg_courtyard_night: { use: '開場：庭埕（晚上）', planned: 'scene_v3b_courtyard_night_v2', status: 'ready', src: 'scene_v3b_courtyard_night_v2' },
  bg_room_night: { use: '開場：護龍房間（晚上）', planned: 'scene_v3b_room_night', status: 'ready', src: 'scene_v3b_room_night' },
  bg_bed_pov: { use: '開場：躺下的視角', planned: 'scene_v3b_bed_pov_night', status: 'ready', src: 'scene_v3b_bed_pov_night' },
  /* 劇本 v5.8（開場第二幕　房間裡那封信） */
  // 傍晚的租屋處房間正式圖（傍晚光已畫在圖上，不再疊橘色濾鏡）；摺疊桌上的信封是去背層 pp_envelope／pp_envelope_opened
  bg_letter_room: { use: 'v5.8 第二幕與特休前一晚：租屋處房間（傍晚；回到家、包包放在床上、摺疊桌上的信）',
    planned: 'bg_v58_rental_room_evening_portrait', status: 'ready', dir: V56.B, src: 'bg_v58_rental_room_evening_portrait' },
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
  mini_passbook: { use: '小圖：抽屜裡的綠色郵局存簿（爸幫我開的戶頭；封面「郵政存簿儲金簿」是產圖時程式疊進圖，遊戲不另疊字）', planned: 'prop_v56_passbook_drawer_v3', status: 'ready', dir: V56.C, src: 'prop_v56_passbook_drawer_v3' },
  mini_hat: { use: '小圖：斗笠（德叔從門邊拿的）', planned: 'prop_v56_douli_v2', status: 'ready', dir: V56.C, src: 'prop_v56_douli_v2' },
  mini_label: { use: '小圖：空罐子的標籤（標籤留白，程式疊「農藥」）', planned: 'prop_v56_empty_can_label_v2', status: 'ready', dir: V56.C, src: 'prop_v56_empty_can_label_v2' },
  mini_longan: { use: '小圖：龍眼乾（剝開的殼、黑亮的果肉）', planned: 'prop_v56_dried_longan_v2', status: 'ready', dir: V56.C, src: 'prop_v56_dried_longan_v2' },

  /* ---------- 分鏡格（#op-prop 的 pp-mini.sb；承峰 2026-11-24 提案、11-25 八組定版） ---------- */
  // 咖啡館畫師產圖（AI 生成後由程式加框與紙感；不是手繪）。橫式 4:3，每格 2048×1536；直排圖格距 64px 透明。
  // 取代原本用程式演的動作（點 CSS 信封抽信、點錢包數錢、點抽屜、點存摺放進提款機與 CSS 存摺、CSS 紙袋疊字）。用法見 view/days.js 的 STORYBOARDS。
  // 郵局版 v3（承峰 2026-11-25 定版）：刷存簿、開抽屜、存簿小圖用畫師交的有損 webp 原樣放進來；無損 PNG 原檔留在 storyboard-panels/art-v56/（不進 repo）。
  sb_envelope: { use: '分鏡：開信封（第二幕，三句旁白之後；點一下收掉進信件）', planned: 'sb_envelope_open_v1', status: 'ready', dir: V56.S, src: 'sb_envelope_open_v1' },
  sb_wallet: { use: '分鏡：數錢（第一天房間，「繳完房租，剩下五千塊錢。」之前）', planned: 'sb_wallet_count_v1', status: 'ready', dir: V56.S, src: 'sb_wallet_count_v1' },
  sb_drawer: { use: '分鏡：開抽屜，印章在最裡面、綠色郵局存簿露一角（「印章還在。」之前）', planned: 'sb_drawer_seal_v3', status: 'ready', dir: V56.S, src: 'sb_drawer_seal_v3' },
  sb_atm: { use: '分鏡：刷存簿直排三格（郵局存簿插在存摺口／內頁一排 10,000／內頁特寫 160,000；照台詞依序亮）', planned: 'sb_atm_passbook_strip_v3', status: 'ready', dir: V56.S, src: 'sb_atm_passbook_strip_v3' },
  sb_calico: { use: '分鏡：花斑貓撥龍眼乾，一顆滾到桌上（坤伯「欸，這個不是給你吃的啦。」之前）', planned: 'sb_calico_paw_v1', status: 'ready', dir: V56.S, src: 'sb_calico_paw_v1' },
  sb_brew: { use: '分鏡：研發咖啡開頭，五杯一字排開（只亮一次就收起；承峰拿掉第 2 格）', planned: 'sb_brew_cups_v2', status: 'ready', dir: V56.S, src: 'sb_brew_cups_v2' },
  sb_paperbag: { use: '分鏡：測試品紙袋寫好「提神醒腦」「過目不忘」，筆擱在旁邊（字畫進圖）', planned: 'sb_paperbag_writing_v2', status: 'ready', dir: V56.S, src: 'sb_paperbag_writing_v2' },
  sb_cat: { use: '分鏡：貓靠近怡君直排兩格（聞鞋 → 貼著小腿蹭）', planned: 'sb_cat_approach_strip_v1', status: 'ready', dir: V56.S, src: 'sb_cat_approach_strip_v1' },
  // codeart 交稿（2026-11）：坤伯院子的肥料罐、夜騎三格（工寮、土地公廟用 v2；掉頭用 v3；都不用 v1）
  sb_fertilizer: { use: '分鏡：坤伯瞇眼看還沒開的肥料罐（「旁邊這罐才是肥料，還沒開。」之前；點一下出這句，翻到下一句收掉）', planned: 'sb_fertilizer_can_v1', status: 'ready', dir: V56.S, src: 'sb_fertilizer_can_v1' },
  sb_ride_shed: { use: '分鏡：夜路盡頭的鐵皮工寮，後面沒有路（工寮那句；點一下收掉，短黑幕與引擎聲之後換另一條）', planned: 'sb_ride_shed_v2', status: 'ready', dir: V56.S, src: 'sb_ride_shed_v2' },
  sb_ride_temple: { use: '分鏡：路邊的土地公廟（土地公廟那句起一路留到按「掉頭回去」）', planned: 'sb_ride_temple_v2', status: 'ready', dir: V56.S, src: 'sb_ride_temple_v2' },
  // 掉頭格改用 v3（畫師 2026-11 交稿；v1／v2 原檔留在磁碟，不再引用）
  sb_ride_uturn: { use: '分鏡：在廟前掉頭（按「掉頭回去」後疊上；再點一下收掉，黑幕淡出回三合院外）', planned: 'sb_ride_uturn_v3', status: 'ready', dir: V56.S, src: 'sb_ride_uturn_v3' },
  // 徵人海報特寫：原本是 CSS 白紙特寫卡（pp_poster，程式疊「誠徵門市人員」），2026-11 改成分鏡格 v3（去膠帶版、單格 2048×1536）。
  // 字全部畫在圖上，程式不疊字、不疊薪水。v1／v2 已退回，不進遊戲。場景上（遠看）的海報熱點仍疊「誠徵門市人員」（見 bg_store）。
  sb_store_poster: { use: '分鏡：超商座位區後牆的徵人海報特寫（點海報後疊上；點一下出「領這種餓不死、穿不暖的薪水，還要被這樣罵。」，翻到下一句收掉）', planned: 'sb_store_poster_v3', status: 'ready', dir: V56.S, src: 'sb_store_poster_v3' },

  /* ---------- 特寫卡（#op-prop 的 pp-card） ---------- */
  pp_key: { use: '鑰匙（第一天早上拖向德叔，沒有接、回到手上；第二天點包包裡的鑰匙放到吧台上）', planned: 'key', status: 'ready', src: 'key' },
  /* 劇本 v5.8 */
  // 摺疊桌上的牛皮紙信封（1170×2532 透明對齊層，整張疊在 bg_letter_room 上）。只是擺著，不是按鈕；開信封仍是分鏡格 sb_envelope。
  // 第二幕：前兩句桌面空；「我在摺疊桌前坐下來，把信封放在桌上。」淡入合著的；開信封分鏡格疊上的同時換成拆過的。特休前一晚整場都是拆過的
  // 合著／拆過的信封改用畫師 2026-11 交的 v2（v1 原檔留在磁碟，不再引用）
  pp_envelope: { use: '第二幕：摺疊桌上合著的牛皮紙信封（只是擺著，不能點）', planned: 'prop_v58_envelope_desk_closed_v2', status: 'ready', dir: V56.C, src: 'prop_v58_envelope_desk_closed_v2' },
  pp_envelope_opened: { use: '第二幕開信封之後與特休前一晚：摺疊桌上拆過的信封（只是擺著，不能點）', planned: 'prop_v58_envelope_desk_opened_v2', status: 'ready', dir: V56.C, src: 'prop_v58_envelope_desk_opened_v2' },
  bg_cafe_bamboo: { use: '第一天早上店裡：吧台上攤著兩個竹篩，生豆鋪滿；德叔背後架子上自己放一格的杯子', planned: 'bg_shop_day_bar_beans', status: 'temp', src: null, temp: '用店內 2D 定景的早上底圖（SHOP_STILL_DAY，已換成白天正式圖 scene_shop_interior_day_v1）；竹篩、生豆、架子上的杯子沒有另畫' },
};

// 店內定景。換圖只改 src（不要改 id）。
// SHOP_STILL_NIGHT：晚上、燈亮、進門／點椅子坐下之前／晚上回來／答謝天暗之後／研發 → scene_shop_interior_night_lit_v2（定版）
// SHOP_STILL_DUSK：坤伯答謝開頭（傍晚、還沒入夜）→ art-v59/scene_shop_interior_dusk_v1（傍晚正式圖，不疊天色）。
// SHOP_STILL_SEATED：點了椅子、坐下喝咖啡（coffee）→ scene_v3b_shop_window_night_seated（靠窗特寫）
// SHOP_STILL_DAY：早上店裡（第一天挑豆、第二天回店、三天後）→ art-v59/scene_shop_interior_day_v1（白天正式圖，不疊天色）。
export const SHOP_STILL_NIGHT = 'bg_shop_night';
export const SHOP_STILL_SEATED = 'bg_shop_seated';
export const SHOP_STILL_DAY = 'bg_shop_day';
export const SHOP_STILL_DUSK = 'bg_shop_dusk';

// 店內家具切片（y-sort 遮擋用；排序資料見 shop-pieces.js，裁圖工具 tools/shop-cut.mjs）。
// 畫師交與各張店內底圖逐像素對齊的 1170×2532 透明母檔，程式裁成小圖另存新檔名；原底圖、母檔都不動。
// 不放進 ART_MAP：檔案到了才用（見 shop-cut-ready.js），還沒到的片不引用、不預載。
// 資料夾 assets/art-v60（承峰 2026-11-28 09:59 定名）。
export const SHOP_CUT_DIR = 'art-v60';
// slot → 片 id 與各光線的檔名（variants 的鍵＝光線：night 夜景 v2／day 白天／dusk 傍晚／seated 靠窗特寫）
//   檔名＝shop-pieces.js 的 cutFile（lyr_shop_{光線}_{片}_v{ver}；ver＝該片採用的母檔版本）
const cutVariants = (id, lights) => Object.fromEntries(lights.map((l) => [l, cutFile(l, id)]));
export const SHOP_CUT_MAP = {
  shop_cut_bar_front: { piece: 'bar_front', use: '吧台檯面＋正面板＋檯上白杯＋磨豆機（德叔站在後面）', variants: cutVariants('bar_front', ['night', 'day', 'dusk']) },
  shop_cut_table_left: { piece: 'table_left', use: '左桌＋後面的椅子＋桌上盆栽杯', variants: cutVariants('table_left', ['night', 'day', 'dusk']) },
  shop_cut_chair_mid: { piece: 'chair_mid', use: '吧台前中間那張椅', variants: cutVariants('chair_mid', ['night', 'day', 'dusk']) },
  shop_cut_table_right: { piece: 'table_right', use: '右桌（含桌後椅子）', variants: cutVariants('table_right', ['night', 'day', 'dusk']) },
  shop_cut_chair_front_right: { piece: 'chair_front_right', use: '右前曲木椅', variants: cutVariants('chair_front_right', ['night', 'day', 'dusk']) },
  shop_cut_table_corner: { piece: 'table_corner', use: '靠窗特寫的桌角', variants: cutVariants('table_corner', ['seated']) },
  shop_cut_chair_back: { piece: 'chair_back', use: '靠窗特寫對面那張椅子的椅背', variants: cutVariants('chair_back', ['seated']) },
  // 【待定】龍眼乾袋、花斑貓（店內定景）：樣子／桌位／姿勢未定案，這次不接（承峰 2026-11-28 08:19），不留會被執行的 slot
};
// 某片在某光線的參照（art-v60/lyr_shop_night_bar_front_v1）；沒有這個光線就 null
export function cutRefOf(piece, light) {
  const s = Object.values(SHOP_CUT_MAP).find((x) => x.piece === piece);
  const f = s?.variants[light];
  return f ? `${SHOP_CUT_DIR}/${f}` : null;
}

// 程式疊在圖上的字（不指望圖上有字）
export const OVERLAY_TEXT = {
  label: '農藥', // 空罐子的標籤（劇本：「坤伯，這上面寫的是農藥。」）
  poster: '誠徵門市人員', // 徵人海報：只疊在超商場景上遠看的海報熱點（薪水數字劇本沒寫，不疊）；特寫是分鏡格 sb_store_poster，字畫在圖上，不疊
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
