// 店裡的字。
// 「今天的，請慢用。」是規格書原文（每杯咖啡的流程第 3 步）。
// 菜單三樣的名字沿用第一版菜單（legacy/src/menu.js 的 name：東山的豆、黑咖啡、冰美式），只用名字，不用第一版的說明句。
import { ACT4_CUP, ACT4_EMPTY } from './opening.js';

export const SERVE = '今天的，請慢用。';

export const MENU = [
  { id: 'dongshan', name: '東山的豆' },
  { id: 'black', name: '黑咖啡' },
  { id: 'iced', name: '冰美式' },
];
export const menuName = (id) => MENU.find((m) => m.id === id)?.name || '';

// 德叔在店裡各步驟說的話（依序自動換句，最後一句留著；不需要玩家點）
// 第 1 天是開場第四幕的延續：端上第一杯時先說「東山的豆……」，再說「今天的，請慢用。」；
// 喝完、筆記本放上桌時說「店是空的……」（第一版這句之後是佈置模式，v3 接的是筆記本）。
export function deshuLines(phase, day) {
  if (phase === 'drink') return day === 1 ? [ACT4_CUP, SERVE] : [SERVE];
  if (phase === 'notebook' && day === 1) return [ACT4_EMPTY];
  return [];
}
