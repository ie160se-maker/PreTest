/* ============================================================
   assignment.js — 参加者ID発行 & DataPipe 均衡割当
   プレテスト設計：3(開示 A/B/C・被験者間) × 3(業界順序・ラテン方格)
   = 9セルを DataPipe /api/condition で逐次均衡割当し、復号する。
   ※開示(重要な被験者間要因)を最速で循環させ、部分周期でも均衡を保つ
     設計：disclosure = index % 3, order = floor(index / 3)
   ============================================================ */
(function (global) {
  'use strict';

  // ★実装時に DataPipe ダッシュボードの実験IDへ置換
  const EXPERIMENT_ID = 'N7nTHi1ax3WB'; /*'oOubRKqJH0OF';*/
  const CONDITION_URL = 'https://pipe.jspsych.org/api/condition/';

  const DISCLOSURE = ['A', 'B', 'C'];          // A=公益のみ / B=曖昧公言 / C=明確公言
  const ORDER_KEYS = ['MTK', 'TKM', 'KMT'];    // ラテン方格3系列（⑤）
  const ORDER_MAP = {
    MTK: ['MIRAINE', 'TSUMUGI', 'KIORI'],
    TKM: ['TSUMUGI', 'KIORI', 'MIRAINE'],
    KMT: ['KIORI', 'MIRAINE', 'TSUMUGI'],
  };

  // 参加者ID：募集URLの ?pid= を優先（⑦・経路非依存設計）、無ければ乱数生成
  function getParticipantId() {
    const params = new URLSearchParams(global.location.search);
    const pid = params.get('pid');
    if (pid && /^[A-Za-z0-9_-]{3,64}$/.test(pid)) return pid;
    return 'gen-' + randomID(10);
  }

  function randomID(n) {
    const chars = '0123456789abcdefghjklmnopqrstuvwxyz';
    let s = '';
    for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  // DataPipe 条件割当（リトライ3回）。失敗時のみクライアント乱数へフォールバックし flag を立てる
  async function assignCondition() {
    let index = null;
    let fallback = false;
    for (let attempt = 0; attempt < 3 && index === null; attempt++) {
      try {
        const res = await fetch(CONDITION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: '*/*' },
          body: JSON.stringify({ experimentID: EXPERIMENT_ID }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        // ★レスポンス項目名は実機で要確認（想定: json.condition が 0..8）
        const raw = (json && json.condition !== undefined) ? json.condition : json;
        index = (typeof raw === 'number') ? raw : parseInt(raw, 10);
      } catch (e) {
        await sleep(1000 * Math.pow(2, attempt)); // 1s, 2s, 4s
      }
    }
    if (index === null || isNaN(index) || index < 0 || index > 8) {
      index = Math.floor(Math.random() * 9); // フォールバック（均衡は崩れる→事後にセルN確認）
      fallback = true;
    }
    return decode(index, fallback);
  }

  function decode(index, fallback) {
    const disclosure = DISCLOSURE[index % 3];            // 0→A,1→B,2→C,3→A...（開示を最速循環）
    const orderKey = ORDER_KEYS[Math.floor(index / 3)];  // 0-2→MTK,3-5→TKM,6-8→KMT
    return {
      conditionIndex: index,
      disclosure: disclosure,
      orderKey: orderKey,
      industries: ORDER_MAP[orderKey].slice(),
      assignmentFallback: fallback,
    };
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  global.Assignment = { getParticipantId, assignCondition, EXPERIMENT_ID };
})(window);
