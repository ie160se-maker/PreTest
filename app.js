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

      '<h2 class="sec">1. SNS広告に関する調査</h2>' +
      '<p>実施者：金沢大学人間社会学域人文学類心理学P４年　山下将輝</p>' +

      '<h2 class="sec">2. 研究の目的</h2>' +
      '<p>本調査は、SNS上の投稿に対する印象を調べる学術研究（卒業研究）です。研究の性質上、詳細な目的は回答終了後にご説明します。</p>' +

      '<h2 class="sec">3. ご協力いただく内容と所要時間</h2>' +
      '<p>SNS投稿を模した画像を3件ご覧いただき、それぞれについて印象をお答えいただきます。所要時間は約10〜15分です。</p>' +

      '<h2 class="sec">4. 収集する情報</h2>' +
      '<ul class="notes">' +
      '<li>質問項目へのご回答（年齢、性別、職業区分など）</li>' +
      '<li>操作の記録（所要時間など）</li>' +
      '<li>氏名・住所・メールアドレスなど、個人を直接特定できる情報は収集しません。</li>' +
      '</ul>' +

      '<h2 class="sec">5. データの取扱いと保管</h2>' +
      '<p>ご回答は匿名で処理し、研究目的以外には使用しません。データは研究用データ保管サービス（OSF）上に保管し、調査期間中は非公開とします。研究成果を公表する際も、個人が特定される形で示すことはありません。期間終了後は適切に廃棄します。</p>' +

      '<h2 class="sec">6. 参加の任意性と撤回について</h2>' +
      '<ul class="notes">' +
      '<li>参加は任意です。参加しないことによる不利益は一切ありません。</li>' +
      '<li>回答の途中でいつでも中断できます。中断された場合、それまでのデータは使用しません。</li>' +
      '<li>ご回答は匿名で収集されるため、送信完了後は個々のデータを特定して削除することができません。この点をご理解のうえ、ご同意ください。</li>' +
      '</ul>' +

      '<h2 class="sec">7. 予想される負担・リスク</h2>' +
      '<p>本調査による身体的・心理的な負担は最小限ですが、回答したくない設問がある場合は、参加を中断していただいて構いません。</p>' +

      '<h2 class="sec">8. お問い合わせ先</h2>' +
      '<p>本研究に関するご質問は、下記までご連絡ください。<br>' +
      '山下将輝　連絡先：un131miworld@stu.kanazawa-u.ac.jp</p>' +

      '<h2 class="sec">9. 同意の確認</h2>' +
      '<p>上記の内容をお読みいただき、内容を理解したうえで本研究に参加することに同意される場合は、「同意して開始」を押してください。</p>' +

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
      var insta = parseInt(v.insta_freq, 10);
      // 適格性：18–29歳 かつ SNS頻度 >= 下限
      if (isNaN(age) || age < 18 || age > 29 || insta < B.insta_MIN_FREQ) {
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
      '<div class="screen"><h1>この調査で行っていただくこと</h1>' +

      '<p>これから、<strong>架空の企業のSNS広告を想定した投稿</strong>を、全部で3件ご覧いただきます。' +
      '登場する企業名・活動内容はすべて研究用に作成したもので、実在の企業とは関係ありません。</p>' +

      '<p>各投稿は、Instagramでよく見られる<strong>複数枚の画像（カルーセル）とキャプション（本文）</strong>で構成されています。' +
      '画像の中にも文章が書かれていますので、<strong>画像とキャプションの両方</strong>に目を通してください。' +
      '普段SNSで気になった投稿を読むときと同じように、内容を読み進めていただければ結構です。</p>' +

      '<p>1件の投稿を読み終えるごとに、<strong>その投稿から受けた印象についていくつかの質問</strong>にお答えいただきます。' +
      'ご自身が感じたままにお答えください。<strong>正解・不正解はありません。</strong></p>' +

      '<h2 class="sec">操作方法</h2>' +
      '<ul class="notes">' +
      '<li>画像は、左右のスワイプ（またはボタン）で next へ進みます。</li>' +
      '<li>キャプションが途中で省略されている場合は「…続きを読む」で全文が表示されます。</li>' +
      '<li>すべての画像を読み終えると「質問へ進む」ボタンが押せるようになります。</li>' +
      '</ul>' +

      '<p>準備ができましたら、「はじめる」を押してください。</p>' +
      '<div class="actions"><button class="btn" id="beginBtn">はじめる</button></div></div>'
    );
    document.getElementById('beginBtn').onclick = function () { blockPtr = 0; screenStimulus(); };
  }
  /* ---------- Phase 2a: 刺激（強制閲覧ゲート） ---------- */
 function screenStimulus() {
    var brand = STATE.industries[blockPtr];
    var ord = ['1つ目', '2つ目', '3つ目'][blockPtr];
    show(
      '<div class="screen wide">' +
      '<div class="progress">投稿 ' + (blockPtr + 1) + ' / 3</div>' +
      '<div class="stim-instruction">' +
      '<p><strong>' + ord + 'の投稿です。</strong></p>' +
      '<p><strong>1枚1枚の画像に書かれている文章およびキャプション（本文）を最後まで読んでください。</strong>' +
      '十分に画像内の文章とキャプション（本文）を読まないと、<strong>次に進めない仕様になっています。</strong></p>' +
      '<p class="sub">この後、この投稿について印象をお伺いします。急がず内容を確かめながら、よくお読みください。</p>' +
      '</div>' +
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
      var miss = R.firstMissing(root, ['gender', 'occupation']);
      if (miss) { R.markMissing(root, miss); return; }
      var v = R.collect(root);
      STATE.gender = v.gender; STATE.occupation = v.occupation;
      STATE.feedback_text = v.feedback_text || '';
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
