/* ============================================================
   carousel_instrumented.js — 計測付きカルーセル（既存 carousel.js を置換）
   反映パラメータ：
     ③ 強制閲覧ゲート = 全5枚到達 + 各スライド2秒以上 + スライド4(index3)は5秒以上
     ⑥ 強制内省なし（本モジュールでは扱わない。SPA側でも挿入しない）
     ⑨ いいね/保存トグルを無効化（表示は保持、いいね数15,376は画像/HTML側で固定）
   追加計測：スライド別滞在(Page Visibilityで非表示時は計時停止)、スライド4初到達、
             ナビ回数、キャプション展開有無。
   前提マークアップ：.instagram-post 内に
     .carousel-track / .carousel-slide / .carousel-btn.prev/.next /
     .dot / .slide-counter / .carousel-wrapper /（任意）.caption-toggle
   API：init(post, {industry, disclosure, onGate}) →
        { getTimingData(), destroy(), isGateSatisfied() }
   ============================================================ */
(function (global) {
  'use strict';

  const MIN_SLIDE_MS = 2000;   // 各スライド最小滞在（③）
  const MIN_SLIDE4_MS = 5000;  // スライド4(IV)最小滞在（③）
  const IV_SLIDE_INDEX = 3;    // 4枚目 = 0基準 index 3

  function init(post, options) {
    options = options || {};
    const onGate = options.onGate || function () {};
    const industry = options.industry || '';
    const disclosure = options.disclosure || '';

    const track = post.querySelector('.carousel-track');
    const slides = post.querySelectorAll('.carousel-slide');
    const prevBtn = post.querySelector('.carousel-btn.prev');
    const nextBtn = post.querySelector('.carousel-btn.next');
    const dots = post.querySelectorAll('.dot');
    const counter = post.querySelector('.slide-counter');
    const wrapper = post.querySelector('.carousel-wrapper');
    const total = slides.length;

    // ---- 計測状態 ----
    const dwell = new Array(total).fill(0); // ms
    const viewed = new Set();
    let current = 0, nNav = 0, captionExpanded = false, gatePassed = false;
    let slide4FirstArrival = null;

    const t0 = performance.now();
    let slideEnter = t0;
    let visible = (document.visibilityState === 'visible');

    function accrue() {
      if (visible) {
        const now = performance.now();
        dwell[current] += now - slideEnter;
        slideEnter = now;
      }
    }
    function markViewed(i) {
      viewed.add(i);
      if (i === IV_SLIDE_INDEX && slide4FirstArrival === null) {
        slide4FirstArrival = Math.round(performance.now() - t0);
      }
    }

    function updateUI() {
      track.style.transform = `translateX(-${current * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
      if (counter) counter.textContent = `${current + 1}/${total}`;
      if (prevBtn) prevBtn.disabled = current === 0;
      if (nextBtn) nextBtn.disabled = current === total - 1;
    }
    function goTo(i) {
      if (i < 0 || i >= total || i === current) return;
      accrue();                 // 離脱スライドの滞在を確定
      current = i;
      slideEnter = performance.now();
      nNav++;
      markViewed(i);
      updateUI();
      checkGate();
    }

    function checkGate() {
      accrue();
      const allViewed = viewed.size >= total;
      let eachOK = true;
      for (let i = 0; i < total; i++) {
        const need = (i === IV_SLIDE_INDEX) ? MIN_SLIDE4_MS : MIN_SLIDE_MS;
        if (dwell[i] < need) { eachOK = false; break; }
      }
      const pass = allViewed && eachOK;
      if (pass && !gatePassed) { gatePassed = true; onGate(true); }
      return pass;
    }

    // 滞在時間依存ゲートのため、未達の間は定期再判定
    const gateTimer = setInterval(function () { if (!gatePassed) checkGate(); }, 500);

    // ---- ナビゲーション ----
    function onPrev() { goTo(current - 1); }
    function onNext() { goTo(current + 1); }
    if (prevBtn) prevBtn.addEventListener('click', onPrev);
    if (nextBtn) nextBtn.addEventListener('click', onNext);
    const dotHandlers = [];
    dots.forEach((dot, i) => { const h = () => goTo(i); dotHandlers.push([dot, h]); dot.addEventListener('click', h); });

    // スワイプ/ドラッグ
    let startX = 0, curX = 0, dragging = false;
    const ts = (e) => { startX = e.touches[0].clientX; dragging = true; };
    const tm = (e) => { if (dragging) curX = e.touches[0].clientX; };
    const te = () => { if (dragging) { dragging = false; swipe(); } };
    const mdn = (e) => { e.preventDefault(); startX = e.clientX; dragging = true; };
    const mm = (e) => { if (dragging) curX = e.clientX; };
    const mu = () => { if (dragging) { dragging = false; swipe(); } };
    function swipe() {
      const diff = startX - curX;
      if (Math.abs(diff) > 50) { if (diff > 0) goTo(current + 1); else goTo(current - 1); }
    }
    if (wrapper) {
      wrapper.addEventListener('touchstart', ts, { passive: true });
      wrapper.addEventListener('touchmove', tm, { passive: true });
      wrapper.addEventListener('touchend', te);
      wrapper.addEventListener('mousedown', mdn);
      wrapper.addEventListener('mousemove', mm);
      wrapper.addEventListener('mouseup', mu);
      wrapper.addEventListener('mouseleave', mu);
    }

    // キーボード
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') goTo(current - 1);
      if (e.key === 'ArrowRight') goTo(current + 1);
    };
    document.addEventListener('keydown', onKey);

    // Page Visibility：非表示で計時停止、復帰で再開
    const onVis = () => {
      if (document.visibilityState === 'hidden') { accrue(); visible = false; }
      else { visible = true; slideEnter = performance.now(); }
    };
    document.addEventListener('visibilitychange', onVis);

    // キャプション展開（残すがログを取る）
    const capToggle = post.querySelector('.caption-toggle');
    let onCap = null;
    if (capToggle) {
      onCap = function () {
        const caption = this.previousElementSibling;
        const expanded = caption.classList.toggle('expanded');
        this.textContent = expanded ? '一部を表示' : '...続きを読む';
        if (expanded) captionExpanded = true;
      };
      capToggle.addEventListener('click', onCap);
    }

    // ⑨ いいね/保存トグルを無効化（表示は保持）
    post.querySelectorAll('.action-icon.like, .action-icon.bookmark').forEach((el) => {
      el.style.pointerEvents = 'none';
      el.setAttribute('aria-disabled', 'true');
    });

    // 初期化
    markViewed(0);
    updateUI();
    checkGate();

    // ---- 公開API ----
    function getTimingData() {
      accrue();
      return {
        industry: industry,
        disclosure: disclosure,
        dwell: dwell.map((x) => Math.round(x)),
        dwellTotal: Math.round(dwell.reduce((a, b) => a + b, 0)),
        slide4FirstArrival: slide4FirstArrival,
        nNav: nNav,
        captionExpanded: captionExpanded,
        viewedAll: viewed.size >= total,
        forcedPass: gatePassed,
      };
    }
    function destroy() {
      clearInterval(gateTimer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      if (prevBtn) prevBtn.removeEventListener('click', onPrev);
      if (nextBtn) nextBtn.removeEventListener('click', onNext);
      dotHandlers.forEach(([dot, h]) => dot.removeEventListener('click', h));
      if (capToggle && onCap) capToggle.removeEventListener('click', onCap);
      if (wrapper) {
        wrapper.removeEventListener('touchstart', ts);
        wrapper.removeEventListener('touchmove', tm);
        wrapper.removeEventListener('touchend', te);
        wrapper.removeEventListener('mousedown', mdn);
        wrapper.removeEventListener('mousemove', mm);
        wrapper.removeEventListener('mouseup', mu);
        wrapper.removeEventListener('mouseleave', mu);
      }
    }

    return { getTimingData, destroy, isGateSatisfied: () => gatePassed };
  }

  global.InstrumentedCarousel = { init: init };
})(window);
