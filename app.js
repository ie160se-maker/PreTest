/* ============================================================
   app.js — プレテストSPA制御本体
   フロー：同意 → スクリーニング → 教示 → 3業界ループ
           （刺激ゲート → 注意チェック → 動機/1A/1B/適合度 → 親近性 → 途中保存）
           → デモグラ → 最終送信 → デブリーフ/エラー
   依存：assignment.js / stimuli.js / carousel_instrumented.js /
         datasink.js / questions.js(Battery) / render.js(Render)
   ============================================================ */
(function (global) {
  'use strict';

  var app = document.getElementById('app');
  var B = global.Battery, R = global.Render;
  var STATE = null, blockPtr = 0, controller = null;

  function show(html) { app.innerHTML = html; global.scrollTo(0, 0); }
  function ctxFor(brand) {
    return { cause: B.CAUSE[brand], brand: B.BRAND[brand], likMin: B.LIK.min, likMax: B.LIK.max };
  }

  /* ---------- Phase 0: 入場・割当 ---------- */
  async function start() {
    show('<div class="screen"><p class="lead">準備しています…</p></div>');
    var pid = global.Assignment.getParticipantId();
    var a = await global.Assignment.assignCondition();
    STATE = {
      participant_id: pid,
      conditionIndex: a.conditionIndex,
      disclosure: a.disclosure,           // 'A'/'B'/'C'
      orderKey: a.orderKey,
      assignmentFallback: a.assignmentFallback,
      industries: a.industries,           // 提示順（3業界）
      ts_start: new Date().toISOString(),
      user_agent: navigator.userAgent,
      screen_w: (global.screen && global.screen.width) || '',
      screen_h: (global.screen && global.screen.height) || '',
      blocks: [],
    };
    screenConsent();
  }

  function screenConsent() {
    show(
      '<div class="screen">' +
      '<h1>研究へのご協力のお願い</h1>' +
      '<p>本調査は、SNS上の投稿に対する印象を調べる学術研究です。所要時間は約10〜15分です。</p>' +
      '<ul class="notes">' +
      '<li>回答は匿名で処理され、研究目的以外には使用しません。</li>' +
      '<li>参加は任意で、いつでも中断できます。</li>' +
      '<li>ご質問は [山下将輝 / un131miworld@stu.kanazawa-u.ac.jp] までお問い合わせください。</li>' +
      '</ul>' +
      '<p>内容に同意いただける場合は「同意して開始」を押してください。</p>' +
      '<div class="actions"><button class="btn secondary" id="declineBtn">同意しない</button>' +
      '<button class="btn" id="agreeBtn">同意して開始</button></div></div>'
    );
    document.getElementById('agreeBtn').onclick = screenScreening;
    document.getElementById('declineBtn').onclick = function () {
      show('<div class="screen"><h1>ありがとうございました</h1><p>調査を終了しました。ウィンドウを閉じてください。</p></div>');
    };
  }

  /* ---------- Phase 0: スクリーニング・適格性 ---------- */
  function screenScreening() {
    var html = '<div class="screen"><h1>はじめに</h1>' +
      '<div class="qform" id="scrForm">' +
      R.item(B.screening.age, {}, 'number') +
      R.item(B.screening.insta, {}, 'freq5') +
      '</div>' +
      '<div class="actions"><button class="btn" id="scrNext">次へ</button></div></div>';
    show(html);
    document.getElementById('scrNext').onclick = function () {
      var root = document.getElementById('scrForm');
      var miss = R.firstMissing(root, ['age', 'insta_freq']);
      if (miss) { R.markMissing(root, miss); return; }
      var v = R.collect(root);
      var age = parseInt(v.age, 10);
      var sns = parseInt(v.insta_freq, 10);
      // 適格性：18–29歳 かつ SNS頻度 >= 下限
      if (isNaN(age) || age < 18 || age > 29 || sns < B.insta_MIN_FREQ) {
        show('<div class="screen"><h1>ありがとうございました</h1><p>今回の調査の対象条件に合致しないため、ここで終了となります。ご協力に感謝いたします。</p></div>');
        return;
      }
      STATE.age = age;
      STATE.insta_freq = insta;
      screenInstructions();
    };
  }

  /* ---------- Phase 1: 教示 ---------- */
  function screenInstructions() {
    show(
      '<div class="screen"><h1>ご回答の進め方</h1>' +
      '<p>これから <strong>3件</strong> のInstagram投稿を順番にご覧いただきます。</p>' +
      '<ul class="notes">' +
      '<li>各投稿は左右スワイプ（またはボタン）で<strong>最後の画像まで</strong>ご覧ください。</li>' +
      '<li><strong>すべての画像とキャプション文を十分に見終わると</strong>「質問へ進む」が押せるようになります。</li>' +
      '<li>その後、その投稿についていくつかの質問にお答えいただきます。</li>' +
      '</ul>' +
      '<div class="actions"><button class="btn" id="beginBtn">はじめる</button></div></div>'
    );
    document.getElementById('beginBtn').onclick = function () { blockPtr = 0; screenStimulus(); };
  }

  /* ---------- Phase 2a: 刺激（強制閲覧ゲート） ---------- */
  function screenStimulus() {
    var brand = STATE.industries[blockPtr];
    show(
      '<div class="screen wide">' +
      '<div class="progress">投稿 ' + (blockPtr + 1) + ' / 3</div>' +
      '<p class="lead">すべての画像とキャプション文をご覧ください。</p>' +
      '<div id="stimStage"></div>' +
      '<div class="actions"><button class="btn" id="toQuestions" disabled>質問へ進む</button></div></div>'
    );
    controller = global.Stimuli.mountStimulus(
      document.getElementById('stimStage'), brand, STATE.disclosure.toLowerCase(),
      { onGate: function () { var b = document.getElementById('toQuestions'); if (b) b.disabled = false; } }
    );
    document.getElementById('toQuestions').onclick = function () {
      var timing = controller.getTimingData();
      controller.destroy(); controller = null;
      screenBlockQuestions(brand, timing);
    };
  }

  /* ---------- Phase 2c/2d: 注意チェック + 測定項目 + 親近性 ---------- */
  function screenBlockQuestions(brand, timing) {
    var ctx = ctxFor(brand);
    var att = B.attention.byIndustry[brand];
    var attItem = { id: 'attn', text: B.attention.prompt, type: 'mc', options: att.options.slice() };
    R.shuffle(attItem.options);

    var html = '<div class="screen"><h1>この投稿についてお答えください</h1>' +
      '<div class="qform" id="blkForm">' +
      '<section class="q-section">' + R.item(attItem, ctx) + '</section>' +
      '<section class="q-section">' + R.block(B.motive, ctx) + '</section>' +
      '<section class="q-section">' + R.block(B.item1A, ctx) + '</section>' +
      '<section class="q-section">' + R.block(B.item1B, ctx) + '</section>' +
      '<section class="q-section">' + R.block(B.fit, ctx) + '</section>' +
      '<section class="q-section">' +
      R.item(B.familiarity.bf1, ctx) + R.item(B.familiarity.bf2, ctx) + R.item(B.familiarity.bf3, ctx) +
      '</section>' +
      '</div>' +
      '<div class="actions"><button class="btn" id="blkNext">回答して次へ</button></div></div>';
    show(html);

    document.getElementById('blkNext').onclick = async function () {
      var root = document.getElementById('blkForm');
      var required = ['attn']
        .concat(B.motive.items.map(function (i) { return i.id; }))
        .concat(B.item1A.items.map(function (i) { return i.id; }))
        .concat(B.item1B.items.map(function (i) { return i.id; }))
        .concat(B.fit.items.map(function (i) { return i.id; }))
        .concat(['bf1', 'bf2']); // bf3は任意
      var miss = R.firstMissing(root, required);
      if (miss) { R.markMissing(root, miss); return; }

      var v = R.collect(root);
      var block = {
        industry: brand,
        position: blockPtr + 1,
        timing: timing,
        attn_choice: v.attn,
        attn_correct: (v.attn === att.correct),
        motive: B.motive.items.map(function (i) { return num(v[i.id]); }),
        item1A: B.item1A.items.map(function (i) { return num(v[i.id]); }),
        item1B: B.item1B.items.map(function (i) { return num(v[i.id]); }),
        fit: B.fit.items.map(function (i) { return num(v[i.id]); }),
        bf1: (v.bf1 === 'はい') ? 1 : 0,
        bf2: num(v.bf2),
        bf3: v.bf3 || '',
      };
      STATE.blocks.push(block);

      // 途中保存（バックアップ。失敗しても継続）
      var btn = document.getElementById('blkNext');
      btn.disabled = true; btn.textContent = '保存中…';
      try { await global.DataSink.saveCheckpoint(STATE, blockPtr + 1); } catch (e) { /* 継続 */ }

      blockPtr++;
      if (blockPtr < STATE.industries.length) screenStimulus();
      else screenDemographics();
    };
  }

  /* ---------- Phase 3: デモグラフィック ---------- */
  function screenDemographics() {
    var html = '<div class="screen"><h1>最後に、あなたについて教えてください</h1>' +
      '<div class="qform" id="demoForm">' +
      B.demographics.map(function (it) { return R.item(it, {}); }).join('') +
      '<div class="q-item"><div class="q-text">最後に、お気づきの点があればご自由にお書きください（任意）。</div>' +
      '<textarea class="q-textarea" name="feedback_text" rows="3"></textarea></div>' +
      '</div>' +
      '<div class="actions"><button class="btn" id="demoNext">回答を送信する</button></div></div>';
    show(html);
    document.getElementById('demoNext').onclick = function () {
      var root = document.getElementById('demoForm');
      var miss = R.firstMissing(root, ['gender', 'occupation', 'insta_freq']);
      if (miss) { R.markMissing(root, miss); return; }
      var v = R.collect(root);
      STATE.gender = v.gender; STATE.occupation = v.occupation;
      STATE.insta_freq = num(v.insta_freq); STATE.feedback_text = v.feedback_text || '';
      finish();
    };
  }

  /* ---------- Phase 4: フラグ算出・最終送信・デブリーフ ---------- */
  async function finish() {
    show('<div class="screen"><p class="lead">回答を保存しています。ページを閉じずにお待ちください…</p></div>');

    STATE.ts_end = new Date().toISOString();
    STATE.duration_total_sec = Math.round((Date.parse(STATE.ts_end) - Date.parse(STATE.ts_start)) / 1000);

    var failCount = STATE.blocks.filter(function (b) { return !b.attn_correct; }).length;
    STATE.flag_attn_fail = (failCount >= 2) ? 1 : 0;
    STATE.flag_slide4_underdwell = STATE.blocks.some(function (b) {
      var d4 = (b.timing && b.timing.dwell && b.timing.dwell[3]) || 0;
      return !(b.timing && b.timing.forcedPass) || d4 < 5000;
    }) ? 1 : 0;
    STATE.flag_straightline = STATE.blocks.some(function (b) {
      var arr = [].concat(b.motive || [], b.item1A || [], b.fit || []).map(Number);
      return arr.length > 0 && arr.every(function (x) { return x === arr[0]; });
    }) ? 1 : 0;

    var ok = false;
    try { ok = await global.DataSink.submitFinal(STATE); } catch (e) { ok = false; }

    if (ok) screenDebrief();
    else screenError();
  }

  function screenDebrief() {
    show(
      '<div class="screen"><h1>ご回答ありがとうございました</h1>' +
      '<p>これで調査は終了です。ご協力に感謝いたします。</p>' +
      '<div class="notes"><p><strong>この調査について</strong>：本研究で提示したブランドはすべて研究用に作成した架空のものです。実在の企業・商品とは関係ありません。</p></div>' +
      '<p class="code">完了確認コード：<strong>' + esc('CMP-' + STATE.participant_id) + '</strong></p>' +
      '<p class="small">（募集元の指示がある場合は、このコードを提出してください。）</p></div>'
    );
  }

  function screenError() {
    show(
      '<div class="screen"><h1>送信に失敗しました</h1>' +
      '<p>通信環境により保存が完了しませんでした。下のボタンをもう一度お試しください。解決しない場合は [連絡先] までご連絡ください。</p>' +
      '<div class="actions"><button class="btn" id="retryBtn">もう一度送信する</button></div></div>'
    );
    document.getElementById('retryBtn').onclick = finish;
  }

  function num(v) { var n = Number(v); return isNaN(n) ? '' : n; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // 起動
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  global.App = { getState: function () { return STATE; } };
})(window);
