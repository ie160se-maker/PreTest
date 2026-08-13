/* ============================================================
   datasink.js — DataPipe への保存（②チェックポイント & 最終）
   ・最終：CSV（ヘッダ+1行, ファイル名 <pid>.csv）→ そのまま表計算解析可
   ・途中：JSONバックアップ（<pid>_ckptN.json, 脱落データ保護）
   ・列順は提示順に依存せず固定（M→T→K）で全参加者統一
   依存：仕様書v2 §10 のデータスキーマ
   ============================================================ */
(function (global) {
  'use strict';

  const EXPERIMENT_ID = 'N7nTHi1ax3WB'; /*'oOubRKqJH0OF';*/
  const DATA_URL = 'https://pipe.jspsych.org/api/data/';

  async function postToDataPipe(filename, dataString) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(DATA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: '*/*' },
          body: JSON.stringify({ experimentID: EXPERIMENT_ID, filename: filename, data: dataString }),
        });
        if (res.ok) return true;                       // 201 期待
        if (res.status >= 400 && res.status < 500) return false; // クライアント側エラーはリトライ不可
      } catch (e) { /* ネットワーク断 → リトライ */ }
      await sleep(1000 * Math.pow(2, attempt));
    }
    return false;
  }

  // 途中保存：JSONで累積状態を退避（脱落時の復元用バックアップ）
  async function saveCheckpoint(state, blockIndex) {
    const filename = `${state.participant_id}_ckpt${blockIndex}.json`;
    return postToDataPipe(filename, JSON.stringify(state));
  }

  // 最終保存：CSV（ヘッダ+1行）。成功時のみ完了コードを表示すること
  async function submitFinal(state) {
    const filename = `${state.participant_id}.csv`;
    return postToDataPipe(filename, stateToCSV(state));
  }

  // ---- CSV 生成（§10スキーマ準拠・列順固定） ----
  function stateToCSV(state) {
    const row = flattenState(state);
    const header = Object.keys(row);
    const line = header.map((k) => csvEscape(row[k])).join(',');
    return header.join(',') + '\n' + line + '\n';
  }

  function flattenState(s) {
    const r = {};
    // --- メタ ---
    r.participant_id = s.participant_id;
    r.condition = s.disclosure;                 // A/B/C
    r.condition_index = s.conditionIndex;
    r.industry_order = s.orderKey;              // MTK/TKM/KMT
    r.assignment_fallback = s.assignmentFallback ? 1 : 0;
    r.ts_start = s.ts_start;
    r.ts_end = s.ts_end;
    r.duration_total_sec = s.duration_total_sec;
    r.user_agent = s.user_agent;
    r.screen_w = s.screen_w;
    r.screen_h = s.screen_h;

    // --- 業界別（提示順に関係なく固定順 M→T→K で列を生成） ---
    const FIXED = ['MIRAINE', 'TSUMUGI', 'KIORI'];
    const PREFIX = { MIRAINE: 'M', TSUMUGI: 'T', KIORI: 'K' };
    const byInd = {};
    (s.blocks || []).forEach((b) => { byInd[b.industry] = b; });

    FIXED.forEach((ind) => {
      const p = PREFIX[ind];
      const b = byInd[ind] || {};
      for (let i = 1; i <= 8; i++) r[`${p}_motive_${i}`] = at(b.motive, i);
      for (let i = 1; i <= 3; i++) r[`${p}_1A_${i}`] = at(b.item1A, i);
      for (let i = 1; i <= 3; i++) r[`${p}_1B_${i}`] = at(b.item1B, i);
      for (let i = 1; i <= 4; i++) r[`${p}_fit_${i}`] = at(b.fit, i);
      r[`${p}_attn`] = b.attn_correct === undefined ? '' : (b.attn_correct ? 1 : 0);
      r[`${p}_attn_choice`] = def(b.attn_choice);
      r[`${p}_bf1`] = def(b.bf1);
      r[`${p}_bf2`] = def(b.bf2);
      r[`${p}_bf3`] = def(b.bf3);
      r[`${p}_position`] = def(b.position);
      const t = b.timing || {};
      r[`${p}_dwell_total`] = def(t.dwellTotal);
      for (let i = 1; i <= 5; i++) r[`${p}_dwell_s${i}`] = at(t.dwell, i);
      r[`${p}_slide4_first_arrival`] = def(t.slide4FirstArrival);
      r[`${p}_n_nav`] = def(t.nNav);
      r[`${p}_caption_expanded`] = t.captionExpanded === undefined ? '' : (t.captionExpanded ? 1 : 0);
      r[`${p}_forced_pass`] = t.forcedPass === undefined ? '' : (t.forcedPass ? 1 : 0);
    });

    // --- 事後 ---
    r.age = def(s.age);
    r.gender = def(s.gender);
    r.occupation = def(s.occupation);
    r.insta_freq = def(s.insta_freq);
    r.feedback_text = def(s.feedback_text);

    // --- 品質フラグ（クライアント算出。詳細判定は解析側でも実施可） ---
    r.flag_attn_fail = def(s.flag_attn_fail);
    r.flag_straightline = def(s.flag_straightline);
    r.flag_slide4_underdwell = def(s.flag_slide4_underdwell);
    return r;
  }

  function at(arr, oneBasedIdx) { return (arr && arr[oneBasedIdx - 1] !== undefined) ? arr[oneBasedIdx - 1] : ''; }
  function def(v) { return (v === null || v === undefined) ? '' : v; }
  function csvEscape(v) {
    if (v === null || v === undefined) return '';
    const str = String(v);
    return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
  }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  global.DataSink = { saveCheckpoint, submitFinal, stateToCSV };
})(window);
