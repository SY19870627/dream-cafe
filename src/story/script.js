// v3b 劇本播放層（純邏輯）：把 final-source.json 攤成「頁」的順序，不碰 DOM、不碰 localStorage，用 node --test 測試。
// 規則：
// - 劇本字（title／text／label）原樣使用，不改字；stage 只給演出用，永遠不會出現在頁面的字裡。
// - stage 寫「同框累加」的句子併進上一頁（同一個節點清單裡才併）。
// - when:{ key, value } 跟已選的答案不符就略去；還沒選的 key 一律不符。
// - focus 在同一場內沿用到下一次指定，換場歸零；立繪預設是場景的 portrait，演出表（direction.js）可在某一句換人。
// - 開場第四幕的兩句原文（德叔）接在坐下之後、第一天之前，杯子只是已在桌上的道具。
// - 第三天最後一頁之後是 end：停在店裡，可環視、可回顧，沒有第四天。
import { ACT4_CUP, ACT4_EMPTY } from '../lines/opening.js';
import { NODE_DIRECTION, SCENE_DIRECTION } from './direction.js';

export const MERGE_MARK = '同框累加';
export const END_ID = 'end';
export const SPEAKERS = {
  narrator: '',
  me: '怡君',
  deshu: '德叔',
  gui: '阿桂',
  junior: '宜蓁',
  manager: '主管',
};

// 開場第四幕（原文在 src/lines/opening.js，不改字）
export const ACT4_PAGES = [
  { id: 'op-act4-1', speaker: 'deshu', text: ACT4_CUP },
  { id: 'op-act4-2', speaker: 'deshu', text: ACT4_EMPTY },
];
const ACT4_SCENE = { id: 'op-act4', title: '', background: 'shopMorning', portrait: 'deshu', ambient: 'radio_low' };

const isMerge = (n) => typeof n.stage === 'string' && n.stage.includes(MERGE_MARK);
const passes = (n, choices) => !n.when || (Object.prototype.hasOwnProperty.call(choices, n.when.key) && choices[n.when.key] === n.when.value);

// 所有選項（依劇本順序）
export function listChoices(source) {
  const out = [];
  const walk = (nodes, scene, day) => {
    for (const n of nodes) {
      if (n.type === 'choice') {
        out.push({ id: n.id, key: n.key, day, scene: scene.id, values: n.options.map((o) => o.value), options: n.options });
        for (const o of n.options) walk(o.nodes, scene, day);
      }
    }
  };
  for (const d of source.days) for (const sc of d.scenes) walk(sc.nodes, sc, d.day);
  return out;
}

// 依已選的答案攤開整份劇本 → 頁的陣列。遇到還沒選的選項就停在那一頁（之後的頁還不存在）。
export function sequence(source, choices = {}) {
  const pages = [];
  let blocked = false;
  const line = (n) => ({ id: n.id, speaker: n.speaker, name: SPEAKERS[n.speaker] ?? '', text: n.text });

  const runScene = (scene, day, nodes, ctx) => {
    for (const n of nodes) {
      if (blocked) return;
      if (n.type === 'choice') {
        const chosen = Object.prototype.hasOwnProperty.call(choices, n.key) ? choices[n.key] : undefined;
        const opt = n.options.find((o) => o.value === chosen);
        pages.push({
          id: n.id, kind: 'choice', day, scene: scene.id, key: n.key,
          options: n.options.map((o) => ({ value: o.value, label: o.label })),
          chosen: opt ? opt.value : null,
          sfx: [],
          ...ctx.snapshot(),
        });
        ctx.last = null;
        if (!opt) { blocked = true; return; }
        runScene(scene, day, opt.nodes, ctx);
        continue;
      }
      if (n.type !== 'line' || !passes(n, choices)) continue;
      ctx.apply(n);
      const sfx = NODE_DIRECTION[n.id]?.sfx || [];
      if (isMerge(n) && ctx.last && ctx.last.kind === 'line' && ctx.last.scene === scene.id && ctx.last.list === nodes) {
        ctx.last.lines.push(line(n));
        Object.assign(ctx.last, ctx.snapshot());
        ctx.last.sfx.push(...sfx);
        continue;
      }
      const page = { id: n.id, kind: 'line', day, scene: scene.id, lines: [line(n)], sfx: [...sfx], ...ctx.snapshot() };
      Object.defineProperty(page, 'list', { value: nodes, enumerable: false });
      pages.push(page);
      ctx.last = page;
    }
  };

  const sceneCtx = (scene) => {
    const sd = SCENE_DIRECTION[scene.id] || {};
    const ctx = {
      last: null,
      focus: 'none',
      portrait: sd.portrait || scene.portrait || 'none',
      phone: 'on',
      ambientLevel: sd.ambientLevel ?? 1,
      cat: sd.cat ?? null,
      apply(n) {
        if (typeof n.focus === 'string') this.focus = n.focus;
        const d = NODE_DIRECTION[n.id];
        if (d) {
          if (d.portrait) this.portrait = d.portrait;
          if (d.phone) this.phone = d.phone;
          if (d.ambientLevel != null) this.ambientLevel = d.ambientLevel;
          if (d.cat) this.cat = d.cat;
        }
      },
      snapshot() {
        return {
          background: scene.background, ambient: scene.ambient, sceneTitle: scene.title,
          focus: this.focus, portrait: this.portrait, phone: this.phone, ambientLevel: this.ambientLevel, cat: this.cat,
        };
      },
    };
    return ctx;
  };

  // 開場第四幕
  {
    const ctx = sceneCtx(ACT4_SCENE);
    for (const p of ACT4_PAGES) {
      ctx.apply(p);
      pages.push({ id: p.id, kind: 'line', day: 0, scene: ACT4_SCENE.id, lines: [{ ...p, name: SPEAKERS[p.speaker] }], sfx: [], ...ctx.snapshot() });
    }
  }
  for (const d of source.days) {
    if (blocked) break;
    const first = d.scenes[0];
    pages.push({
      id: `d${d.day}-title`, kind: 'title', day: d.day, scene: first.id, text: d.title, sfx: [],
      background: first.background, ambient: first.ambient, sceneTitle: '', focus: 'none', portrait: 'none', phone: 'on', ambientLevel: 1,
      cat: (SCENE_DIRECTION[first.id] || {}).cat ?? null,
    });
    for (const sc of d.scenes) {
      if (blocked) break;
      runScene(sc, d.day, sc.nodes, sceneCtx(sc));
    }
  }
  if (!blocked) {
    const lastDay = source.days.at(-1);
    const lastScene = lastDay.scenes.at(-1);
    const prev = pages.at(-1);
    pages.push({ id: END_ID, kind: 'end', day: lastDay.day, sfx: [], scene: lastScene.id, background: lastScene.background, ambient: lastScene.ambient, sceneTitle: '', focus: 'none', portrait: 'none', phone: 'on', ambientLevel: prev.ambientLevel, cat: prev.cat });
  }
  return pages;
}

// 每一個可能出現的節點 id（含兩條分支），用來驗證存檔與唯一性
export function allNodeIds(source) {
  const ids = [];
  const walk = (nodes) => {
    for (const n of nodes) {
      ids.push(n.id);
      if (n.type === 'choice') for (const o of n.options) walk(o.nodes);
    }
  };
  for (const d of source.days) for (const sc of d.scenes) walk(sc.nodes);
  return ids;
}

// 劇本裡所有字串欄位（給「原字」檢查用）
export function allTexts(source) {
  const out = [];
  for (const d of source.days) {
    out.push(d.title);
    for (const sc of d.scenes) {
      out.push(sc.title);
      const walk = (nodes) => {
        for (const n of nodes) {
          if (n.text != null) out.push(n.text);
          if (n.type === 'choice') for (const o of n.options) { out.push(o.label); walk(o.nodes); }
        }
      };
      walk(sc.nodes);
    }
  }
  return out;
}

export function allStages(source) {
  const out = [];
  for (const d of source.days) {
    for (const sc of d.scenes) {
      if (sc.stage) out.push(sc.stage);
      const walk = (nodes) => {
        for (const n of nodes) {
          if (n.stage) out.push(n.stage);
          if (n.type === 'choice') for (const o of n.options) walk(o.nodes);
        }
      };
      walk(sc.nodes);
    }
  }
  return out;
}
