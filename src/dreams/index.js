// 夢想場景資料：底圖（程式粗稿）、可點物件的位置、老太太位置、出口、帶回的東西。
// 字全部在 src/lines/dreams.js（fable52 稿）；這裡只放「畫在哪裡、畫成什麼形狀」。
// 驗證版：五張都是粗稿（draft: true, art: '粗稿'），由 src/view/draft.js 用程式畫，不是正式美術，也不動 assets/art/。
// 角度：0 是一進場面對的方向，順時針為正（度）；depth：0 最遠、1 最近；y：物件底邊在畫面高度的比例；h：高度佔畫面的比例。
import { DREAM_TEXT } from '../lines/dreams.js';

// 固定順序：規格書種子清單前五條，第 1 天到第 5 天（id 用 fable52 稿的）
export const DREAM_ORDER = ['rain-quilt-tv', 'hut-heater-hands', 'watch-dog-eat-play', 'read-in-cafe', 'door-coffee-smell'];

// 公尺 → depth（越近越大）。fable52 稿的距離 25 → 8 → 5 → 3 → 1.5 公尺
export const depthFromDistance = (m) => Math.max(0.02, Math.min(0.9, 0.8 - 0.25 * Math.log(m)));
export const wrapDeg = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

// 每條夢想的版面。objects 依 fable 稿的物件 id 對上；props 是不可點的佈景（粗稿）
const LAYOUT = {
  'rain-quilt-tv': {
    palette: { wall: ['#5d6068', '#3f424a'], floor: ['#6a6152', '#4a4339'], ceiling: '#7a7d84', tint: 'rgba(60,80,110,.16)' },
    ambient: 'rain',
    objects: {
      tv: { angle: 0, depth: 0.55, y: 0.66, h: 0.2, shape: 'tv' },
      quilt: { angle: -22, depth: 0.95, y: 1.02, h: 0.2, shape: 'futon' },
      basin: { angle: -58, depth: 0.62, y: 0.8, h: 0.08, shape: 'basin' },
      remote: { angle: 24, depth: 0.9, y: 0.95, h: 0.06, shape: 'remote' },
    },
    props: [{ angle: 70, depth: 0.3, y: 0.62, h: 0.34, shape: 'window', opt: { weather: 'rain' } }],
    granny: { pose: 'stand', umbrella: true, y: 0.56, z: 0.31 }, // 窗外：畫在窗戶上面（z），看起來在窗裡很遠
    exit: { angle: -125 },
    takeawayShape: 'basin',
  },
  'hut-heater-hands': {
    palette: { wall: ['#8a6a4a', '#6a4f37'], floor: ['#5a4632', '#3f3124'], ceiling: '#e8eef2', tint: 'rgba(230,240,255,.08)' },
    ambient: 'heater',
    objects: {
      heater: { angle: 0, depth: 0.66, y: 0.82, h: 0.22, shape: 'heater' },
      gloves: { angle: -42, depth: 0.6, y: 0.72, h: 0.1, shape: 'gloves' },
      thermos: { angle: 36, depth: 0.78, y: 0.84, h: 0.14, shape: 'thermos' },
      window: { angle: -88, depth: 0.42, y: 0.6, h: 0.26, shape: 'window', opt: { weather: 'fog' } },
    },
    props: [
      { angle: -42, depth: 0.55, y: 0.84, h: 0.12, shape: 'bench' },
      { angle: 40, depth: 0.7, y: 0.9, h: 0.12, shape: 'bench' },
      { angle: 160, depth: 0.2, y: 0.74, h: 0.08, shape: 'bench' },
    ],
    granny: { pose: 'sit' },
    exit: { angle: 105 },
    takeawayShape: 'gloves',
  },
  'watch-dog-eat-play': {
    palette: { wall: ['#c9b48e', '#a8946f'], floor: ['#9a8a74', '#6f6252'], ceiling: '#5e5244', tint: 'rgba(255,220,160,.08)', shade: true },
    ambient: 'room',
    objects: {
      bowl: { angle: 2, depth: 0.82, y: 0.95, h: 0.06, shape: 'bowl', opt: { steel: true } },
      ball: { angle: 38, depth: 0.85, y: 0.97, h: 0.06, shape: 'ball' },
      leash: { angle: -34, depth: 0.55, y: 0.7, h: 0.2, shape: 'leash' },
      stool: { angle: 70, depth: 0.75, y: 0.95, h: 0.12, shape: 'stool' },
    },
    props: [
      { id: 'dog', angle: 14, depth: 0.8, y: 0.95, h: 0.15, shape: 'dog' },
      { angle: -10, depth: 0.3, y: 0.66, h: 0.3, shape: 'storefront' },
      { angle: -160, depth: 0.25, y: 0.72, h: 0.08, shape: 'bench' },
    ],
    granny: { pose: 'sit' },
    exit: { angle: -100 },
    takeawayShape: 'ball',
  },
  'read-in-cafe': {
    palette: { wall: ['#7a5a40', '#5a412e'], floor: ['#6a4a32', '#4a3324'], ceiling: '#5a4434', tint: 'rgba(255,200,130,.08)', blinds: true },
    ambient: 'fan',
    objects: {
      book: { angle: 0, depth: 0.92, y: 0.98, h: 0.1, shape: 'book' },
      ticket: { angle: -16, depth: 0.93, y: 0.97, h: 0.05, shape: 'ticket' },
      glass: { angle: 20, depth: 0.9, y: 0.95, h: 0.13, shape: 'glass' },
      blinds: { angle: 52, depth: 0.45, y: 0.62, h: 0.3, shape: 'blinds' },
    },
    props: [
      { angle: 0, depth: 0.88, y: 1.06, h: 0.12, shape: 'tabletop' },
      { angle: -130, depth: 0.5, y: 0.82, h: 0.12, shape: 'booth' },
    ],
    granny: { pose: 'sit', cup: true },
    exit: { angle: 125 },
    takeawayShape: 'book',
  },
  'door-coffee-smell': {
    palette: { wall: ['#9a7650', '#74573b'], floor: ['#7a6048', '#584432'], ceiling: '#4a3a2a', tint: 'rgba(255,200,110,.12)' },
    ambient: 'grinder',
    objects: {
      door: { angle: 180, depth: 0.62, y: 0.9, h: 0.5, shape: 'brassDoor' },
      sack: { angle: -38, depth: 0.72, y: 0.92, h: 0.18, shape: 'sack' },
      scale: { angle: -4, depth: 0.6, y: 0.68, h: 0.13, shape: 'scale' },
      jar: { angle: 24, depth: 0.55, y: 0.56, h: 0.12, shape: 'jar' },
    },
    props: [
      { angle: 0, depth: 0.5, y: 0.82, h: 0.16, shape: 'counter' },
      { angle: 24, depth: 0.45, y: 0.58, h: 0.04, shape: 'plank' },
    ],
    granny: { pose: 'sit' },
    exit: { angle: -105 },
    takeawayShape: 'beanbag',
  },
};

// 合併：字（lines/dreams.js）＋版面
export function getDream(id) {
  const i = DREAM_ORDER.indexOf(id);
  if (i < 0) return null;
  const text = DREAM_TEXT.find((d) => d.id === id);
  const lay = LAYOUT[id];
  const objects = text.objects.map((o) => ({
    id: o.id,
    name: o.name,
    line: o.line,
    memory: !!o.memoryLike, // 像主角記憶的那一個：點了停一拍才出字
    ...lay.objects[o.id],
  }));
  const ol = text.oldLady;
  return {
    id,
    day: i + 1,
    draft: true, // 粗稿：底圖是程式畫的，不是正式美術
    art: '粗稿',
    seed: text.seed,
    title: text.title,
    takeaway: { ...text.bringBack, shape: lay.takeawayShape },
    interaction: text.interaction, // 稿子標【待定】，驗證版沒有做
    palette: lay.palette,
    ambient: lay.ambient,
    props: lay.props,
    objects,
    // 老太太：不可點、不標示；位置與距離照 fable52 稿
    granny: {
      angle: wrapDeg(ol.yawDeg),
      distanceM: ol.distanceM,
      depth: depthFromDistance(ol.distanceM),
      clickable: false,
      labeled: false,
      ...lay.granny,
    },
    exit: lay.exit, // 回店的出口：場景裡的一扇門
  };
}

export const DREAMS = DREAM_ORDER.map(getDream);
