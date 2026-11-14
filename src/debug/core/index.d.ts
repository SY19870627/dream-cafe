// 除錯核心的型別宣告（給 TypeScript 專案 import './debug/core/index.js' 用；strict 模式可用）。
// 實作在同資料夾的 .js（純 ES module，不用打包）。欄位說明見 README.md。

/* ---------- 版本 ---------- */
export declare const CORE_VERSION: string;

/* ---------- 開關 ---------- */
/** 查詢字串裡有沒有 `<param>=<value>`（預設 debug=1）。 */
export declare function debugOn(search: string | null | undefined, param?: string, value?: string): boolean;

/* ---------- 版本字串 ---------- */
export declare const BUILD_TIME_RE: RegExp;
/** 台北時間「YYYY-MM-DD HH:mm:ss」；時間不對丟 RangeError。 */
export declare function taipeiStamp(date?: Date | number | string): string;
export interface VersionParts { time: string; hash: string }
export declare function versionParts(buildTime: unknown, running: unknown): VersionParts;
/** 「日期 時間（running）」；沒有 commit 時間就只回 running。 */
export declare function formatVersion(buildTime: unknown, running: unknown): string;
/** formatVersion 的反過來。 */
export declare function splitVersion(display: unknown): VersionParts;

/* ---------- 回報內容 ---------- */
export type Category = '台詞' | '畫面' | '圖' | '操作' | '其他';
export declare const CATEGORIES: Category[];
export declare const COMMENT_MAX: number;
export declare const SHOT_MAX_WIDTH: number;
export declare const SHOT_QUALITY: number;
export declare const SHOT_MAX_BASE64: number;
export declare const SHOT_REV: number;
export declare const NO_LINE: string;

/** 回報框「自動帶入」的位置。 */
export interface Position {
  /** 第幾天（顯示用，例如「第2天」） */
  day?: string | number;
  /** 場景／關卡代號 */
  scene?: string;
  /** 第幾句（0 起算） */
  line?: number;
  /** 說話的人 */
  speaker?: string;
  /** 這一句的純文字 */
  text?: string;
}

/** 送出、存佇列都是這個形狀（欄位順序固定）。 */
export interface Payload {
  time: string;
  version: string;
  day: string | number;
  scene: string;
  line: number;
  speaker: string;
  text: string;
  category: string;
  comment: string;
  screenshot: string;
  device: string;
  game: string;
  owner: string;
}

export interface DeviceInfo {
  ua?: string;
  maxTouchPoints?: number;
  screenW?: number;
  screenH?: number;
  viewW?: number;
  viewH?: number;
  dpr?: number;
}

export declare function plainText(html: unknown): string;
export declare function deviceSummary(info?: DeviceInfo): string;
export declare function buildPayload(ctx?: {
  position?: Position | null;
  game?: string;
  version?: string;
  now?: Date | number | string;
  category?: string;
  comment?: string;
  screenshot?: string;
  device?: string;
  owner?: string;
}): Payload;
export declare function reportText(p: Partial<Payload>): string;
export declare function rewriteCssUrls(css: unknown, fn: (url: string) => string): string;
export declare function shotFits(dataUrl: unknown, max?: number): boolean;
export declare function shotScale(width: number, dpr?: number, maxWidth?: number): number;
export declare function charUnits(ch: string): number;
export declare function wrapText(text: unknown, maxUnits: number, maxLines?: number): string[];
export interface StepError { index: number; message: string }
export declare function firstOk<T>(tries: Array<() => T | Promise<T>>): Promise<{ ok: boolean; value: T | undefined; index: number; errors: StepError[] }>;
export declare function shotErrorText(errors?: StepError[], rev?: number): string;
export declare function textShotLines(ctx?: { position?: Position | null; label?: string; version?: string; maxUnits?: number }): string[];

/* ---------- 佇列 ---------- */
/** 和 localStorage 一樣的介面。 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface SendDeps {
  endpoint?: string;
  key?: string;
  owner?: string;
  fetch?: (url: string, init: RequestInit) => Promise<unknown>;
  storage?: StorageLike | null;
  online?: boolean;
}
export type QueueItem = Record<string, unknown>;
export declare const RETRY_MS: number;
export declare function withoutOwner<T extends Record<string, unknown>>(x: T | null | undefined): Omit<T, 'owner'>;
export declare function post(payload: QueueItem, deps?: SendDeps): Promise<boolean>;
export declare function exportText(list: QueueItem[]): string;
export interface Queue {
  key: string;
  readQueue(storage: StorageLike | null | undefined): QueueItem[];
  writeQueue(storage: StorageLike | null | undefined, list: QueueItem[]): QueueItem[] | null;
  enqueue(storage: StorageLike | null | undefined, payload: QueueItem): QueueItem[] | null;
  submit(payload: QueueItem, deps?: SendDeps): Promise<'sent' | 'queued'>;
  flush(deps?: SendDeps): Promise<{ sent: number; left: number }>;
}
export declare function createQueue(queueKey: string): Queue;

/* ---------- 清除存檔、識別碼 ---------- */
export interface ClearRule {
  isGameSaveKey(key: string): boolean;
  keepKeys?: string[];
  keepPrefixes?: string[];
}
export declare function keysToClear(keys: Iterable<unknown>, rule: ClearRule): string[];
export declare function storageKeys(storage: { length: number; key(i: number): string | null } | null | undefined): string[];
export declare function bustUrl(url: string, now?: number): string;
export declare function ownerStore(storage: StorageLike | null | undefined, key: string): {
  read(): string;
  write(v: string): boolean;
  clear(): void;
};

/* ---------- 截圖 ---------- */
/** 快照掛勾可以回傳的東西（例如 Phaser renderer.snapshot 給的 HTMLImageElement）。 */
export type SnapshotResult = HTMLCanvasElement | HTMLImageElement | ImageBitmap | OffscreenCanvas | string | null | undefined;
export interface CaptureSettings {
  /** 要截的元素（預設 options.app） */
  root?: HTMLElement;
  /** html2canvas 1.4.1 的網址（相對於頁面；必填） */
  html2canvasSrc: string;
  /** 圖片網址改寫（例如換成有 CORS 的直連網址） */
  assetUrl?: (url: string) => string;
  /** 截圖背景色（預設 '#1a1612'） */
  background?: string;
  /** 另外不入鏡的元素 */
  ignore?: (node: Element) => boolean;
  /** 遊戲畫面快照（WebGL 畫布用；例如 Phaser 的 game.renderer.snapshot） */
  snapshot?: () => SnapshotResult | Promise<SnapshotResult>;
  /** overlay＝快照放進遊戲畫布、其他 DOM 照常截（預設）；only＝截圖就是快照本身 */
  snapshotMode?: 'overlay' | 'only';
  /** 快照放在哪個元素（預設：畫面上最大的畫布） */
  snapshotElement?: () => Element | null | undefined;
}
export declare function capture(o: {
  target: HTMLElement;
  debugRoot?: HTMLElement;
  html2canvasSrc: string;
  assetUrl?: (url: string) => string;
  background?: string;
  ignore?: (node: Element) => boolean;
  snapshot?: () => SnapshotResult | Promise<SnapshotResult>;
  snapshotMode?: 'overlay' | 'only';
  snapshotElement?: () => Element | null | undefined;
  lostNote?: string;
  text: { position?: Position | null; label?: string; version?: string };
}): Promise<{ url: string; note: string }>;
export declare function loadHtml2canvas(src: string): Promise<unknown>;
export declare function toJpeg(canvas: HTMLCanvasElement): string;
export declare function taintCheck(memo: Map<Element, boolean>): (node: Element) => boolean;

/* ---------- 面板 ---------- */
export interface LatestInfo { id: string; label: string }
export interface VersionSettings {
  /** 顯示用的版本字串，例如「2026-11-14 20:14:11（70638dd）」；送出的回報 version 欄也是它 */
  display(): string;
  /** 拆成 { time, hash }（面板括號部分畫小字）；沒給就用 splitVersion(display()) */
  parts?(): VersionParts;
  /** 版本旁邊的提示（例如「可能不是最新版」）；空字串就不顯示 */
  note?(): string;
  /** 查最新版本：回 { id, label }、字串或 null（查不到） */
  latest?(): Promise<LatestInfo | string | null | undefined>;
  /** 「重新載入最新版」要去的網址；沒給就是目前網址加 _r＝時間 */
  reloadUrl?(latest: LatestInfo | null): string;
  /** 開機先換到釘版本的網址：回傳 true＝正在換頁，startDebug 回傳 null、不畫面板 */
  autoPin?(): Promise<boolean> | boolean;
}
export interface JumpItem {
  /** 交給 jump() 的場景代號 */
  scene: string;
  /** 選單上的字 */
  label: string;
  /** 有幾句（顯示成「（N 句）」；不給就不顯示） */
  lines?: number;
}
export interface JumpGroup { name: string; items: JumpItem[] }
export interface DebugText {
  /** 跳關選單的無障礙名稱（預設「場景」） */
  sceneAria?: string;
  /** 跳關下面的說明 */
  jumpHint?: string;
  /** jump() 回傳 false 時的訊息 */
  jumpFail?: string;
  /** 有畫布被汙染、截圖跳過它時的提示 */
  shotLost?: string;
}
export declare const DEFAULT_TEXT: Required<DebugText>;
export interface DebugOptions {
  /** 面板掛在哪個元素（也是預設的截圖範圍、快轉 CSS 動畫的範圍）；要是 position 不是 static 的容器 */
  app: HTMLElement;
  /** 遊戲代號（送出的 game 欄、複製文字的標題） */
  game: string;
  /** 收件網址（空字串＝只存佇列）；也可以給函式 */
  endpoint?: string | (() => string);
  /** 收件端密語 */
  key?: string;
  /** localStorage 的鍵 */
  storageKeys: { queue: string; fast: string; owner: string };
  /** 「清除存檔重來」：這個鍵是不是遊戲存檔（是才刪） */
  isGameSaveKey?: (key: string) => boolean;
  /** 絕不刪的鍵（storageKeys 三個一定不刪） */
  keepKeys?: string[];
  /** 絕不刪的鍵的開頭 */
  keepPrefixes?: string[];
  /** 目前位置（面板「目前位置」、回報框「自動帶入」、送出的回報） */
  position: () => Position;
  /** 場景的中文名（給了才顯示） */
  sceneLabel?: (scene: string) => string;
  /** 跳關選單（和 jump 都給才有跳關） */
  jumpGroups?: () => JumpGroup[];
  /** 跳關；回傳 false 顯示 jumpFail */
  jump?: (scene: string, line: number) => boolean | Promise<boolean>;
  /** 快轉：等待時間的倍率（快轉時 1/fastRate，恢復 1） */
  setTimeScale?: (k: number) => void;
  /** 快轉倍數（預設 5） */
  fastRate?: number;
  /** 版本 */
  version: VersionSettings;
  /** 截圖（html2canvasSrc 必填） */
  capture: CaptureSettings;
  /** 換掉面板上跟遊戲有關的說法 */
  text?: DebugText;
  /** 測試用：換掉 localStorage（null＝沒有 storage） */
  storage?: (StorageLike & { length: number; key(i: number): string | null }) | null;
  /** 自動重送間隔（毫秒，預設 30000） */
  retryMs?: number;
}
export interface DebugHandle {
  root: HTMLElement;
  setFast(on: boolean): void;
  retry(): Promise<{ sent: number; left: number } | null>;
  close(): void;
}
export declare function startDebug(options: DebugOptions): Promise<DebugHandle | null>;
export declare function copyText(text: string): Promise<boolean>;
export declare function clearCaches(): Promise<void>;
