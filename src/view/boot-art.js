// 分段預載：開機只等開場（辦公室到第一晚）與店內 360 用到的圖；第一天以後的圖開機畫面出來後在背景（閒置時）載，
// 進某一幕前再補那一幕的背景。缺圖時各畫面本來就「留底色、不擋閱讀」。
import { allArt } from '../story/manifest.js';
import { DAY_ART, PLACES, placesOf } from './days.js';

// 開機要等的：開場圖＋店內 SHOP_ART（＋杯子、店內故事鏡頭的貓，都已在 SHOP_ART 裡）
export const BOOT_ART = allArt();
// 開機之後在背景載的：第一天以後的場景、半身與差分、小圖（art-v56）、德叔微笑等
export const LATER_ART = DAY_ART.filter((n) => !BOOT_ART.includes(n));
// 某一幕整張背景圖用到的圖（換幕前先開始載）
export const actArt = (lines) => placesOf(lines || []).map((k) => PLACES[k]?.src).filter(Boolean);
