// 店裡的碰撞與循路（承峰 11/6：「要做有碰撞物設計的循路設計，桌子與擺設都加上碰撞，走路的時候自動循路」）。
// 純邏輯：不依賴 Three.js 與 DOM，用 node --test 測（tests/unit/pathfind.test.mjs）。
//
// 地面切成 cell 公尺一格的網格；每個擋路的東西（blocker）是圓（x, z, r）或長方形（x0, x1, z0, z1），
// 依走路的人的半徑（radius）往外膨脹後標成不能走的格子；八方向 A*（不切角）找格子路徑，再用視線檢查拉直成幾個轉折點。
// soft 的 blocker（椅子、高腳椅、擺飾）：起點或終點就在它上面時這一趟不算（坐上椅子、走到唱機旁、龍眼跳上書櫃），
// 其他時候照樣繞開；桌子、吧台、牆是硬的，任何時候都不能穿過。
// 終點在膨脹範圍裡（例如德叔站到吧台裡離檯面很近的地方）：走到最近的可走格子，最後一小段直走過去，前提是這一段不穿過任何硬的東西；
// 穿得過去才走，不然停在最近的可走格子。找不到路：走到離終點最近、走得到的格子（ok 為 false，呼叫的人可以記 log），不會直接穿過去。

export function createNav({ bounds, cell = 0.1, radius = 0.12 } = {}) {
  const { x0, x1, z0, z1 } = bounds;
  const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell);
  let blockers = [];
  let base = null; // 沒有忽略任何 blocker 時的格子（快取）

  const cx = (i) => x0 + (i + 0.5) * cell;
  const cz = (j) => z0 + (j + 0.5) * cell;
  const ci = (x) => Math.min(nx - 1, Math.max(0, Math.floor((x - x0) / cell)));
  const cj = (z) => Math.min(nz - 1, Math.max(0, Math.floor((z - z0) / cell)));

  // 一點到 blocker 的距離（在裡面是 0 以下）
  function dist(b, x, z) {
    if (b.r !== undefined) return Math.hypot(x - b.x, z - b.z) - b.r;
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dz = Math.max(b.z0 - z, 0, z - b.z1);
    if (dx === 0 && dz === 0) return -Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);
    return Math.hypot(dx, dz);
  }
  function bbox(b, pad) {
    return b.r !== undefined ? [b.x - b.r - pad, b.x + b.r + pad, b.z - b.r - pad, b.z + b.r + pad] : [b.x0 - pad, b.x1 + pad, b.z0 - pad, b.z1 + pad];
  }

  function rasterize(skip) {
    const g = new Uint8Array(nx * nz);
    // 牆：離店的邊界不到半徑的格子不能走
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = cx(i), z = cz(j);
      if (x - x0 < radius || x1 - x < radius || z - z0 < radius || z1 - z < radius) g[j * nx + i] = 1;
    }
    for (const b of blockers) {
      if (skip && skip.has(b)) continue;
      const [a0, a1, b0, b1] = bbox(b, radius);
      for (let j = cj(b0); j <= cj(b1); j++) for (let i = ci(a0); i <= ci(a1); i++) {
        if (dist(b, cx(i), cz(j)) < radius) g[j * nx + i] = 1;
      }
    }
    return g;
  }

  // 起點或終點在上面的 soft blocker
  function ignoredFor(from, to) {
    const s = new Set();
    for (const b of blockers) if (b.soft && (dist(b, from.x, from.z) < radius + 0.05 || dist(b, to.x, to.z) < radius + 0.05)) s.add(b);
    return s;
  }
  function gridFor(skip) {
    if (!skip.size) return base || (base = rasterize(null));
    return rasterize(skip);
  }

  // 線段有沒有穿過 blocker 本體（不含半徑）：取樣檢查，間隔 2 公分
  function segmentHits(a, b, skip, hardOnly = false) {
    const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / 0.02));
    for (const bl of blockers) {
      if (skip?.has(bl) || (hardOnly && bl.soft)) continue;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        if (dist(bl, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) < 0) return bl;
      }
    }
    return null;
  }
  // 格子上的視線：線段經過的格子都可以走（取樣間隔 1/4 格）
  function lineFree(g, a, b) {
    const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / (cell / 4)));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      if (g[cj(a.z + (b.z - a.z) * t) * nx + ci(a.x + (b.x - a.x) * t)]) return false;
    }
    return true;
  }
  // 最近的可走格子（從某格往外一圈一圈找）
  function nearestFree(g, i0, j0) {
    if (!g[j0 * nx + i0]) return [i0, j0];
    for (let r = 1; r < Math.max(nx, nz); r++) {
      let best = null, bd = Infinity;
      for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
        if (i < 0 || j < 0 || i >= nx || j >= nz || (Math.abs(i - i0) !== r && Math.abs(j - j0) !== r)) continue;
        if (g[j * nx + i]) continue;
        const d = (i - i0) ** 2 + (j - j0) ** 2;
        if (d < bd) { bd = d; best = [i, j]; }
      }
      if (best) return best;
    }
    return null;
  }

  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  function astar(g, s, t) {
    const N = nx * nz, gs = new Float64Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const [ti, tj] = t;
    const h = (i, j) => { const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); };
    const heap = []; // [f, idx]
    const push = (f, k) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    const sk = s[1] * nx + s[0], tk = tj * nx + ti;
    gs[sk] = 0; push(h(s[0], s[1]), sk);
    let bestK = sk, bestH = h(s[0], s[1]);
    while (heap.length) {
      const [, k] = pop();
      if (closed[k]) continue;
      closed[k] = 1;
      if (k === tk) return { k, ok: true, came };
      const i = k % nx, j = (k - i) / nx;
      const hk = h(i, j);
      if (hk < bestH) { bestH = hk; bestK = k; }
      for (const [di, dj, c] of DIRS) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const nk = b * nx + a;
        if (g[nk] || closed[nk]) continue;
        if (di && dj && (g[j * nx + a] || g[b * nx + i])) continue; // 斜走不切角
        const ng = gs[k] + c;
        if (ng < gs[nk]) { gs[nk] = ng; came[nk] = k; push(ng + h(a, b), nk); }
      }
    }
    return { k: bestK, ok: false, came }; // 走不到：停在離終點最近的那一格
  }

  function findPath(from, to) {
    const skip = ignoredFor(from, to);
    const g = gridFor(skip);
    const s0 = nearestFree(g, ci(from.x), cj(from.z));
    const t0 = nearestFree(g, ci(to.x), cj(to.z));
    if (!s0 || !t0) return { pts: [], ok: false, reason: 'no-free-cell' };
    const res = astar(g, s0, t0);
    const cells = [];
    for (let k = res.k; k !== -1; k = res.came[k]) cells.push({ x: cx(k % nx), z: cz(Math.floor(k / nx)) });
    cells.reverse();
    // 起點不在可走的格子上（例如剛從椅子站起來）：第一段先走到最近的可走格子
    const start = { x: from.x, z: from.z };
    const fromFree = !g[cj(from.z) * nx + ci(from.x)];
    // 終點：在可走的格子上，或最後一小段不穿過硬的東西，才走到精確的位置
    const goal = { x: to.x, z: to.z };
    const last = cells[cells.length - 1];
    let reach = res.ok;
    let endExact = false;
    if (res.ok) {
      const toFree = !g[cj(to.z) * nx + ci(to.x)];
      endExact = toFree || !segmentHits(last, goal, skip, true);
      if (!endExact) reach = false;
    }
    // 拉直：從目前這一點，看得到的最遠那一格直接走過去
    const raw = [fromFree ? start : cells[0], ...cells.slice(1)];
    if (endExact) raw.push(goal);
    const pts = [];
    let cur = start, idx = 0;
    if (!fromFree) { pts.push(cells[0]); cur = cells[0]; idx = 0; }
    while (idx < raw.length - 1) {
      let far = idx + 1;
      for (let k = raw.length - 1; k > idx + 1; k--) if (lineFree(g, cur, raw[k])) { far = k; break; }
      cur = raw[far];
      pts.push(cur);
      idx = far;
    }
    if (!pts.length) pts.push(endExact ? goal : last);
    return { pts, ok: reach, reason: res.ok ? (endExact ? '' : 'goal-blocked') : 'unreachable' };
  }

  return {
    cell, radius, nx, nz,
    setBlockers(list) { blockers = list.slice(); base = null; },
    get blockers() { return blockers; },
    findPath,
    // 一點是不是在某個硬的東西裡面（測試用）
    hardAt: (x, z) => blockers.find((b) => !b.soft && dist(b, x, z) < 0) || null,
    segmentHits: (a, b, hardOnly = false) => segmentHits(a, b, null, hardOnly),
    walkable: (x, z) => !gridFor(new Set())[cj(z) * nx + ci(x)],
    dist,
  };
}
