/* ============================================================
   stimuli.js — 刺激の単一情報源（3ブランド × 3条件）＋レンダラ
   ・画像パスは正規化済（<BRAND><n>.png / <BRAND>4<cond>.png。KIORI3のみ.jpg）
   ・キャプションは確定版（MIRAINE明確公言は「認知拡大」= Public image×2 に確定）
   ・マークアップ/CSSは既存 styles.css を再利用。carousel_instrumented.js が
     参照するクラス構造に一致させている。
   API：Stimuli.renderStimulus(brand, cond) → HTML文字列
        Stimuli.mountStimulus(container, brand, cond, {onGate}) → 計測カルーセルcontroller
   ============================================================ */
(function (global) {
  'use strict';

  // 画像ディレクトリ（必要に応じ 'images/' 等に変更）
  const IMG_BASE = '';

  // プロフィールアイコン（MIRAINE葉＝既存確定。TSUMUGI/KIORIは同スタイルの簡易版。
  //   確定SVGがあれば差し替え可）
  const ICON = {
    MIRAINE: '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
      '<g fill="none" stroke="#2D5016" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M 8 22 Q 10 12, 18 8 Q 22 7, 24 10 Q 25 18, 18 23 Q 12 25, 8 22 Z" fill="none"/>' +
      '<path d="M 9 21 Q 14 17, 23 10"/>' +
      '<path d="M 11 19 Q 13 18, 16 18" stroke-width="0.7"/>' +
      '<path d="M 13 17 Q 15 16, 18 16" stroke-width="0.7"/>' +
      '<path d="M 15 14 Q 17 14, 20 13" stroke-width="0.7"/>' +
      '<path d="M 17 12 Q 19 12, 22 11" stroke-width="0.7"/></g></svg>',
    TSUMUGI: '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
      '<g fill="none" stroke="#C04F2E" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="16" cy="19" r="8"/>' +
      '<path d="M16 11 L 13.5 8 M16 11 L 18.5 8 M16 11 L 16 7.5"/>' +
      '<path d="M16 11 C 17 9.5, 18.5 9, 20 9.2"/></g></svg>',
    KIORI: '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
      '<g fill="none" stroke="#5D4037" stroke-width="1.2" stroke-linecap="round">' +
      '<circle cx="16" cy="16" r="11"/>' +
      '<circle cx="16" cy="16" r="7.5" stroke-width="0.9"/>' +
      '<circle cx="16" cy="16" r="4" stroke-width="0.9"/>' +
      '<circle cx="16" cy="16" r="1.3" fill="#5D4037" stroke="none"/></g></svg>',
  };

  const STIMULI = {
    MIRAINE: {
      profileName: 'miraine_official',
      // スライド1,2,3,5（4はslide4[cond]で差し込み）
      slides: ['MIRAINE1.png', 'MIRAINE2.png', 'MIRAINE3.png', null, 'MIRAINE5.png'],
      slide4: { a: 'MIRAINE4-a.png', b: 'MIRAINE4-b.png', c: 'MIRAINE4-c.png' }, // ★c=旧MIRAINE4_0c(認知拡大)をリネーム
      alt: ['MIRAINE Re:Wear プロジェクト', '年間 約48万トン', 'Re:Wear の流れ', '動機公示スライド', 'あなたの服が、未来の素材に'],
      likes: '15,376 likes',
      caption: {
        hook: '✦ Re:Wear プロジェクト、はじまります。',
        intro: 'MIRAINEから大切なお知らせです。私たちは衣料品の大量廃棄に向き合うため、『Re:Wear プロジェクト』をスタートします。ご不要になった服を回収し、新たな商品の素材として生まれ変わらせます。',
        publicMain: '地球と次世代のために、私たちにできることを。',
        disclosure: {
          a: '',
          b: 'この活動は、MIRAINEの事業にとっても意味あるものになると考えています。',
          c: 'この活動は、MIRAINEのブランド価値向上と認知拡大にもつながります。', // Public image×2
        },
        hashtags: '#ReWearプロジェクト #MIRAINE #サステナブルファッション #古着リサイクル',
      },
    },
    TSUMUGI: {
      profileName: 'tsumugi_official',
      slides: ['TSUMUGI1.png', 'TSUMUGI2.png', 'TSUMUGI3.png', null, 'TSUMUGI5.png'],
      slide4: { a: 'TSUMUGI4-a.png', b: 'TSUMUGI4-b.png', c: 'TSUMUGI4-c.png' },
      alt: ['TSUMUGI Re:Table プロジェクト', '年間 約522万トン', 'Re:Table の流れ', '動機公示スライド', '食卓と地域の未来へ'],
      likes: '15,376 likes',
      caption: {
        hook: '✦ Re:Table プロジェクト、はじまります。',
        intro: 'TSUMUGIから大切なお知らせです。私たちは食品ロス問題に向き合うため、『Re:Table プロジェクト』をスタートします。規格外で廃棄されてきた野菜を回収し、毎日のお料理として生まれ変わらせます。',
        publicMain: '食卓と地域の未来のために、私たちにできることを。',
        disclosure: {
          a: '',
          b: 'この活動は、TSUMUGIの事業にとっても意味あるものになると考えています。',
          c: 'この活動は、TSUMUGIの売上向上と仕入れコスト削減にもつながります。', // Profit×2
        },
        hashtags: '#ReTableプロジェクト #TSUMUGI #食品ロス削減 #規格外野菜',
      },
    },
    KIORI: {
      profileName: 'kiori_official',
      slides: ['KIORI1.png', 'KIORI2.png', 'KIORI3.jpg', null, 'KIORI5.png'], // ★スライド3は.jpg
      slide4: { a: 'KIORI4-a.png', b: 'KIORI4-b.png', c: 'KIORI4-c.png' },
      alt: ['KIORI Re:Furniture プロジェクト', '年間 約60万トン', 'Re:Furniture の流れ', '動機公示スライド', '森と次世代へ'],
      likes: '15,376 likes',
      caption: {
        hook: '✦ Re:Furniture プロジェクト、はじまります。',
        intro: 'KIORIから大切なお知らせです。私たちは家具の大量廃棄問題に向き合うため、『Re:Furniture プロジェクト』をスタートします。ご不要になった家具を回収し、新たな商品の素材として生まれ変わらせます。',
        publicMain: '森と次世代のために、私たちにできることを。',
        disclosure: {
          a: '',
          b: 'この活動は、KIORIの事業にとっても意味あるものになると考えています。',
          c: 'この活動は、KIORIの新規市場開拓と長期的な顧客関係構築につながります。', // Profit + Public image
        },
        hashtags: '#ReFurnitureプロジェクト #KIORI #サステナブル家具 #循環型社会',
      },
    },
  };

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderStimulus(brand, cond) {
    const s = STIMULI[brand];
    if (!s) throw new Error('unknown brand: ' + brand);
    cond = (cond || 'a').toLowerCase();
    if (!s.slide4[cond]) throw new Error('unknown cond: ' + cond);

    const imgs = s.slides.slice();
    imgs[3] = s.slide4[cond];

    const slidesHtml = imgs.map(function (src, i) {
      return '<div class="carousel-slide"><img src="' + IMG_BASE + src + '" alt="' + escapeHtml(s.alt[i] || '') + '"></div>';
    }).join('\n');
    const dotsHtml = imgs.map(function (_, i) {
      return '<div class="dot' + (i === 0 ? ' active' : '') + '"></div>';
    }).join('');

    const c = s.caption;
    const disclosure = c.disclosure[cond] || '';
    const captionBody = c.hook + '\n\n' + c.intro + '\n\n' + c.publicMain + disclosure + '\n\n';

    return (
      '<div class="instagram-post" data-brand="' + brand + '" data-cond="' + cond + '">' +
        '<div class="post-header">' +
          '<div class="profile-icon">' + ICON[brand] + '</div>' +
          '<div class="profile-info"><div class="profile-name">' + s.profileName + '</div><div class="profile-meta">広告</div></div>' +
          '<div class="post-menu"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="5" cy="12" r="1.5" fill="#262626"/><circle cx="12" cy="12" r="1.5" fill="#262626"/><circle cx="19" cy="12" r="1.5" fill="#262626"/></svg></div>' +
        '</div>' +
        '<div class="carousel-container">' +
          '<div class="slide-counter">1/5</div>' +
          '<div class="carousel-wrapper"><div class="carousel-track">' + slidesHtml + '</div></div>' +
          '<button class="carousel-btn prev" aria-label="前へ"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>' +
          '<button class="carousel-btn next" aria-label="次へ"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg></button>' +
        '</div>' +
        '<div class="carousel-dots">' + dotsHtml + '</div>' +
        '<div class="action-bar">' +
          '<div class="action-icon like"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938z"/></svg></div>' +
          '<div class="action-icon comment"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z"/></svg></div>' +
          '<div class="action-icon share"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="22" y1="3" x2="9.218" y2="10.083"/><polygon points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334" stroke-linejoin="round"/></svg></div>' +
          '<div class="action-icon bookmark"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polygon points="20 21 12 13.44 4 21 4 3 20 3 20 21" stroke-linejoin="round"/></svg></div>' +
        '</div>' +
        '<div class="post-content">' +
          '<div class="likes-count">' + s.likes + '</div>' +
          '<div class="caption"><span class="username">' + s.profileName + '</span><span>' + escapeHtml(captionBody) + '</span><span class="hashtags">' + escapeHtml(c.hashtags) + '</span></div>' +
          '<div class="comments-link">コメント12件をすべて表示</div>' +
          '<div class="timestamp">3時間前</div>' +
        '</div>' +
        '<div class="comment-input-bar"><span class="emoji-icon">☺</span><span class="placeholder">コメントを追加...</span></div>' +
      '</div>'
    );
  }

  // container に注入し、計測付きカルーセルを初期化（SPA/preview共用）
  function mountStimulus(container, brand, cond, options) {
    container.innerHTML = renderStimulus(brand, cond);
    const post = container.querySelector('.instagram-post');
    const opts = Object.assign({ industry: brand, disclosure: (cond || 'a').toUpperCase() }, options || {});
    return global.InstrumentedCarousel.init(post, opts);
  }

  global.Stimuli = { data: STIMULI, renderStimulus: renderStimulus, mountStimulus: mountStimulus, escapeHtml: escapeHtml };
})(window);
