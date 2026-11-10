// 五條夢想的字（標題、物件名稱與一行字、帶回物）。
// 來源只採 _agent/v3a/fable52-draft.md（claude-fable-5-2，推理預設）的 JSON 區塊，逐字照抄，所有新文字保留【待定】。
// 會顯示給玩家的只有：title、objects[].line（點了才出現）、bringBack.name（回店時手上那樣東西）；
// objects[].name 只當無障礙標籤；scene、oldLady、interaction 是給程式與美術的欄位，不顯示。
// seed 是規格書種子清單的原文（含「被窝」「玩耗」原有用字）；fable 稿的 title 把這兩處改成「被窩」「玩耍」，照稿保留。
// 檢核結果與來源說明見同目錄的「夢想文案來源與檢核.md」。

export const SOURCE = { model: 'claude-fable-5-2', file: '_agent/v3a/fable52-draft.md', status: 'integrated' };

export const DREAM_TEXT = [
  {
    id: 'rain-quilt-tv',
    seed: '下雨天在被窝裡看電視聽雨聲',
    order: 1,
    stage: '前',
    title: '【待定】下雨天在被窩裡看電視聽雨聲',
    scene: {
      place: '舊公寓頂樓加蓋的小房間，鐵皮屋頂，一扇對著巷子的窗',
      season: '春末梅雨',
      time: '下午四點',
      light: '窗外灰白，房裡沒開燈，只有電視的光照在被子上',
      sound: '雨打鐵皮屋頂',
    },
    objects: [
      { id: 'tv', name: '【待定】映像管電視', line: '【待定】第四台在重播，這一集看過了。', memoryLike: false },
      { id: 'quilt', name: '【待定】牡丹花被套', line: '【待定】牡丹花的被套。腳伸出去的那一角補過。', memoryLike: true },
      { id: 'basin', name: '【待定】接漏水的鋁臉盆', line: '【待定】臉盆接了半盆，滴下來的聲音比雨慢。', memoryLike: false },
      { id: 'remote', name: '【待定】遙控器', line: '【待定】電池蓋不見了，用橡皮筋綁著。', memoryLike: false },
    ],
    oldLady: { anchor: '窗外，巷子對面那棟的騎樓下，撐傘站著', yawDeg: 70, distanceM: 25, facing: '背對鏡頭', clickable: false, labeled: false },
    bringBack: { id: 'basin', name: '【待定】鋁臉盆' },
    interaction: { status: '【待定】', gesture: '拖曳', target: 'quilt', action: '往上拖，把被子拉到下巴', count: 1 },
  },
  {
    id: 'hut-heater-hands',
    seed: '冬天在暖氣機出風口暖手（山上的中繼小屋）',
    order: 2,
    stage: '前',
    title: '【待定】冬天在暖氣機出風口暖手',
    scene: {
      place: '山上的中繼小屋，一間長形的木板房，兩排長椅',
      season: '冬天',
      time: '傍晚五點前',
      light: '日光燈偏白，暖氣機的指示燈是橘的，窗外起霧',
      sound: '暖氣機的風聲',
    },
    objects: [
      { id: 'heater', name: '【待定】煤油暖氣機', line: '【待定】出風口的鐵片燙，手要離一個拳頭。', memoryLike: false },
      { id: 'gloves', name: '【待定】椅背上的毛線手套', line: '【待定】手套掛在椅背上，指尖還在滴水。', memoryLike: false },
      { id: 'thermos', name: '【待定】保溫瓶', line: '【待定】保溫瓶的蓋子當杯子。杯緣缺了一角，要轉到另一邊喝。', memoryLike: true },
      { id: 'window', name: '【待定】起霧的玻璃窗', line: '【待定】玻璃上都是霧，外面的山只剩一條線。', memoryLike: false },
    ],
    oldLady: { anchor: '屋內最裡面，長椅的盡頭，坐著', yawDeg: 160, distanceM: 8, facing: '背對鏡頭，面向裡側的窗', clickable: false, labeled: false },
    bringBack: { id: 'gloves', name: '【待定】烤乾的毛線手套' },
    interaction: { status: '【待定】', gesture: '拖曳', target: 'heater', action: '把手拖向出風口，停在前面', count: 1 },
  },
  {
    id: 'watch-dog-eat-play',
    seed: '盯著寵物吃飯玩耗',
    order: 3,
    stage: '前',
    title: '【待定】盯著寵物吃飯玩耍',
    scene: {
      place: '巷子裡的雜貨店門口，店家養的黑狗在騎樓下吃飯',
      season: '秋天',
      time: '上午十點',
      light: '斜的日光，騎樓的影子把地面切成一半',
      sound: '飼料在不鏽鋼碗裡的聲音',
    },
    objects: [
      { id: 'bowl', name: '【待定】不鏽鋼狗碗', line: '【待定】碗被他越推越遠，推到牆邊才停。', memoryLike: false },
      { id: 'ball', name: '【待定】咬扁的網球', line: '【待定】網球咬扁了一邊，丟出去滾不直。', memoryLike: false },
      { id: 'leash', name: '【待定】紅色牽繩', line: '【待定】紅色的牽繩，握把纏了一圈電火布。', memoryLike: true },
      { id: 'stool', name: '【待定】塑膠矮凳', line: '【待定】坐在矮凳上，剛好看得到他吃飯。', memoryLike: false },
    ],
    oldLady: { anchor: '巷子對面，另一戶門口的長椅，坐著', yawDeg: 200, distanceM: 5, facing: '側身，臉朝巷尾', clickable: false, labeled: false },
    bringBack: { id: 'ball', name: '【待定】咬扁的網球' },
    interaction: { status: '【待定】', gesture: '拖曳', target: 'ball', action: '拖曳後放開，把網球丟出去，狗追過去', count: 1 },
  },
  {
    id: 'read-in-cafe',
    seed: '在咖啡廳讀一本書',
    order: 4,
    stage: '前',
    title: '【待定】在咖啡廳讀一本書',
    scene: {
      place: '市區二樓的老咖啡廳，靠窗的兩人桌（不是主角的店）',
      season: '夏天',
      time: '下午兩點',
      light: '百葉窗把日光切成一條一條，落在桌面',
      sound: '吊扇',
    },
    objects: [
      { id: 'book', name: '【待定】桌上的舊書', line: '【待定】第八十七頁折了一個角。', memoryLike: false },
      { id: 'ticket', name: '【待定】夾在書裡的票根', line: '【待定】書裡夾著一張電影票根，場次是下午兩點十分。', memoryLike: true },
      { id: 'glass', name: '【待定】冰咖啡的玻璃杯', line: '【待定】杯子下面一圈水，杯墊已經濕透了。', memoryLike: false },
      { id: 'blinds', name: '【待定】百葉窗', line: '【待定】百葉窗有一片歪了，光從那裡多漏一條。', memoryLike: false },
    ],
    oldLady: { anchor: '隔兩桌，靠牆的角落卡座，坐著，桌上一杯', yawDeg: 230, distanceM: 3, facing: '低頭，只看得到側後方', clickable: false, labeled: false },
    bringBack: { id: 'book', name: '【待定】折了角的舊書' },
    interaction: { status: '【待定】', gesture: '翻頁', target: 'book', action: '翻一頁', count: 1 },
  },
  {
    id: 'door-coffee-smell',
    seed: '剛進店就聞到咖啡香',
    order: 5,
    stage: '前',
    title: '【待定】剛進店就聞到咖啡香',
    scene: {
      place: '市場邊的老咖啡豆行，從門口進場（不是主角的店）',
      season: '冬末',
      time: '早上七點半',
      light: '門玻璃透進來的斜光，店裡是黃燈',
      sound: '磨豆機',
    },
    objects: [
      { id: 'door', name: '【待定】木門的銅門把', line: '【待定】門把的銅磨亮了一塊，是手握的地方。', memoryLike: false },
      { id: 'sack', name: '【待定】開口的麻布袋', line: '【待定】麻布袋開著口，站在這裡味道最濃。', memoryLike: false },
      { id: 'scale', name: '【待定】老磅秤', line: '【待定】磅秤的指針回不到零，差一小格。', memoryLike: false },
      { id: 'jar', name: '【待定】貼手寫標籤的玻璃罐', line: '【待定】標籤是手寫的，「寧」字寫得比另外兩個字大。', memoryLike: true },
    ],
    oldLady: { anchor: '進門右手邊，靠牆的單人位，坐著', yawDeg: 60, distanceM: 1.5, facing: '面向櫃台，背對門口', clickable: false, labeled: false },
    bringBack: { id: 'beans', name: '【待定】牛皮紙袋裝的半磅豆子' },
    interaction: { status: '【待定】', gesture: '拖曳', target: 'door', action: '拖曳推門，門開了磨豆機的聲音才變大', count: 1 },
  },
];
