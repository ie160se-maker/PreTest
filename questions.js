/* ============================================================
   questions.js — 測定バッテリーの単一情報源（プレテスト）
   ・文言は確定版。逆転項目は reverse:true として記録（採点は解析側で逆転）
   ・{CAUSE}=業界の社会問題, {BRAND}=ブランド名 を提示時に置換
   ・回答はすべて RAW 値で保存（逆転コーディングは解析時に実施）
   ============================================================ */
(function (global) {
  'use strict';

  const CAUSE = { MIRAINE: '衣料品の廃棄問題', TSUMUGI: '食品ロス問題', KIORI: '家具の廃棄問題' };
  const BRAND = { MIRAINE: 'MIRAINE', TSUMUGI: 'TSUMUGI', KIORI: 'KIORI' };
  const LIK = { min: '全くそう思わない', max: '非常にそう思う' };
  const insta_MIN_FREQ = 3; // 適格性下限（SNS利用頻度1-5。既定=3=月2〜3回以上。調整可）
  const FREQ5 = ['全く使わない', '月1回以下', '月2〜3回', '週数回', '毎日'];

  const Battery = {
    CAUSE: CAUSE, BRAND: BRAND, LIK: LIK, FREQ5: FREQ5, insta_MIN_FREQ: insta_MIN_FREQ,

    // 動機帰属（Rifon et al. 2004）7件法・提示ランダム・M2逆転
    motive: {
      type: 'likert7', randomize: true,
      prompt: 'この投稿を見て、この企業について、次の各文がどの程度あてはまると感じましたか。',
      items: [
        { id: 'motive_1', text: 'この企業がこの活動を行うのは、最終的に顧客を大切に思っているからだ。', reverse: false },
        { id: 'motive_2', text: 'この企業は、消費者の幸福を本心では気にかけていない。', reverse: true },
        { id: 'motive_3', text: 'この企業は、{CAUSE}に取り組むことを本当に大切に思っている。', reverse: false },
        { id: 'motive_4', text: 'この企業がこの活動を行うのは、私に商品を買わせるためだ。', reverse: false },
        { id: 'motive_5', text: 'この企業がこの活動を行うのは、最終的に自社の利益を大切に思っているからだ。', reverse: false },
        { id: 'motive_6', text: 'この企業がこの活動を行うのは、活動が良い企業イメージを生むからだ。', reverse: false },
        { id: 'motive_7', text: '最終的に、この企業は{CAUSE}に取り組むことで利益を得る。', reverse: false },
        { id: 'motive_8', text: 'この企業がこの活動を行うのは、それが道徳的に「正しい」ことだからだ。', reverse: false },
      ],
    },

    // 1A：企業利益言及の認知（独自・F&G2003/Boerman2012/Seo2019準拠）7件法
    item1A: {
      type: 'likert7',
      prompt: 'この投稿の内容について、次の各文がどの程度あてはまりますか。',
      items: [
        { id: '1A_1', text: 'この投稿は、活動が企業自身の利益にもつながることに触れていた。' },
        { id: '1A_2', text: 'この投稿は、企業側のメリットをはっきりと述べていた。' },
        { id: '1A_3', text: 'この投稿には、企業にとっての利点（利益・イメージ向上など）に関する記述が含まれていた。' },
      ],
    },

    // 1B：明確さ知覚（Grossbart 1986 / Woodroof 2020操作）7件法・意味微分
    item1B: {
      type: 'semdiff7',
      prompt: 'この投稿は、企業のメリットについてどのように伝えていましたか。各対について、あてはまる位置を選んでください。',
      items: [
        { id: '1B_1', left: '曖昧な', right: '明確な' },
        { id: '1B_2', left: 'わかりにくい', right: 'わかりやすい' },
        { id: '1B_3', left: '紛らわしい', right: '理解しやすい' },
      ],
    },

    // 適合度（Menon & Kahn 2003操作 / Rifon 2004理論核）7件法・fit_4逆転
    fit: {
      type: 'likert7',
      prompt: 'この企業とこの活動の関係について、次の各文がどの程度あてはまりますか。',
      items: [
        { id: 'fit_1', text: 'この企業（{BRAND}）と、この社会問題（{CAUSE}）は、論理的に関連していると思う。', reverse: false },
        { id: 'fit_2', text: 'この投稿の内容は、この企業（{BRAND}）の事業内容とよく調和している。', reverse: false },
        { id: 'fit_3', text: '全体として、この活動とこの企業（{BRAND}）の組み合わせは、相性が良い。', reverse: false },
        { id: 'fit_4', text: 'この企業（{BRAND}）がこのような活動をしているのを見て、違和感があった。', reverse: true },
      ],
    },

    // 注意チェック（業界別・内容再認・4択。未提示コーズを妨害肢に）
    attention: {
      type: 'mc',
      prompt: 'この投稿が扱っていた社会問題は、次のうちどれですか。',
      byIndustry: {
        MIRAINE: { correct: '衣料品の廃棄', options: ['衣料品の廃棄', 'プラスチックごみ', '食品ロス', '二酸化炭素の排出'] },
        TSUMUGI: { correct: '食品ロス', options: ['食品ロス', '水質汚染', '衣料品の廃棄', 'エネルギー消費'] },
        KIORI: { correct: '家具の廃棄', options: ['家具の廃棄', '食品ロス', '大気汚染', 'プラスチックごみ'] },
      },
    },

    // ブランド親近性（Boerman 2012 / Rossiter 2011）
    familiarity: {
      bf1: { id: 'bf1', type: 'yesno', text: 'この投稿を見る前から、「{BRAND}」というブランドを知っていましたか。' },
      bf2: { id: 'bf2', type: 'scale7', text: '「{BRAND}」について、どの程度知っていますか。', min: '全く知らない', max: '非常によく知っている' },
      bf3: { id: 'bf3', type: 'freetext', text: '（前問で「はい」を選んだ方のみ）どこで知りましたか。また、どのようなブランドだと思いますか。' },
    },

    // スクリーニング（Phase 0）
 // screening 内：sns を insta に変更
screening: {
  age: { id: 'age', type: 'number', text: '年齢を半角数字で入力してください。', min: 0, max: 120 },
  insta: { id: 'insta_freq', type: 'freq5', text: 'ふだん、Instagramをどのくらいの頻度で利用しますか。' },
},

// demographics 配列から insta_freq の行を削除（gender と occupation のみ残す）

    // デモグラフィック（Phase 3。sns_freq はスクリーニングで取得済）
    demographics: [
      { id: 'gender', type: 'mc', text: '性別を教えてください。', options: ['男性', '女性', 'その他', '回答しない'] },
      { id: 'occupation', type: 'mc', text: '現在の主な立場を教えてください。', options: ['学生', '被雇用', 'その他'] },
    ],
  };

  global.Battery = Battery;
})(window);
