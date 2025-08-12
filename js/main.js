/* main.js */
document.addEventListener("DOMContentLoaded", () => {
  /* ① フェード（スクロールで表示） */
  const fadeElems = document.querySelectorAll(
    ".fade-in-section, .fade-up, .fade-left, .fade-right"
  );
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("show");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
  );
  fadeElems.forEach((el) => io.observe(el));

  /* ② 横スクロール（クリック＝カード1枚、長押し＝連続→離したらスナップ） */
  document.querySelectorAll(".hscroll-wrap").forEach((wrap) => {
    const scroller = wrap.querySelector(".otherWorks-grid--hscroll");
    const prev = wrap.querySelector(".hscroll-prev");
    const next = wrap.querySelector(".hscroll-next");
    if (!scroller || !prev || !next) return;

    // フォーム誤送信防止
    prev.type = "button";
    next.type = "button";

    /* --- スナップ位置の管理 --- */
    let snaps = [];
    const computeSnaps = () => {
      const items = Array.from(scroller.querySelectorAll(":scope > li"));
      snaps = items.map((li) => Math.round(li.offsetLeft));
    };

    const nearestIndex = (x = scroller.scrollLeft) => {
      let best = Infinity,
        idx = 0;
      snaps.forEach((p, i) => {
        const d = Math.abs(p - x);
        if (d < best) {
          best = d;
          idx = i;
        }
      });
      return idx;
    };

    /* --- 矢印の活性/非活性（無効でもイベントは吸収） --- */
    const updateArrows = () => {
      const atStart = scroller.scrollLeft <= 0;
      const atEnd =
        scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1;

      prev.disabled = atStart;
      next.disabled = atEnd;

      prev.setAttribute("aria-disabled", String(atStart));
      next.setAttribute("aria-disabled", String(atEnd));

      const apply = (el, off) => {
        el.style.opacity = off ? 0.35 : 1;
        el.style.pointerEvents = "auto"; // 常に受け止める（下に抜けさせない）
        el.style.cursor = off ? "default" : "pointer";
        el.classList.toggle("is-disabled", off); // 見た目フラグ
      };
      apply(prev, atStart);
      apply(next, atEnd);
    };

    /* --- 左右フェード（のれん） --- */
    const updateFade = () => {
      const tolerance = 2;
      const maxScroll = scroller.scrollWidth - scroller.clientWidth - tolerance;

      if (scroller.scrollLeft <= tolerance) {
        wrap.classList.remove("show-left-fade");
      } else {
        wrap.classList.add("show-left-fade");
      }

      if (scroller.scrollLeft >= maxScroll) {
        wrap.classList.remove("show-right-fade");
      } else {
        wrap.classList.add("show-right-fade");
      }
    };

    /* --- カード単位アニメ --- */
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    let rafId = null;
    const stopAnim = () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const animateTo = (target, duration = 240) => {
      stopAnim();
      computeSnaps();

      const start = scroller.scrollLeft;
      const dist = Math.round(target) - Math.round(start);
      if (Math.abs(dist) < 1) {
        updateArrows();
        updateFade();
        return;
      }

      scroller.classList.add("no-snap");
      const t0 = performance.now();

      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        scroller.scrollLeft = start + dist * easeOutCubic(t);
        if (t < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          scroller.scrollLeft = Math.round(target);
          setTimeout(() => scroller.classList.remove("no-snap"), 10);
          rafId = null;
          updateArrows();
          updateFade();
        }
      };
      rafId = requestAnimationFrame(step);
    };

    const go = (dir) => {
      const i = nearestIndex();
      const nextIdx = Math.max(0, Math.min(snaps.length - 1, i + dir));
      animateTo(snaps[nextIdx]);
    };

    /* --- クリック&長押し：Pointer Events で統一 --- */
    const setupButton = (btn, dir) => {
      let holdRaf = null;
      let isHolding = false;
      let v = 0;

      // チューニング用
      const HOLD_DELAY = 140; // 長押し判定(ms)
      const ACCEL = 7000; // px/s^2
      const MAX_V = 2200; // px/s
      const TAP_MOVE_TOL = 6; // タップ扱いの移動許容(px)

      let holdTimer = null;
      let downX = 0,
        downY = 0;
      let didHoldStart = false;

      const stopHold = () => {
        if (!isHolding) return;
        isHolding = false;
        if (holdRaf) {
          cancelAnimationFrame(holdRaf);
          holdRaf = null;
        }
        // 吸着
        scroller.classList.remove("no-snap");
        computeSnaps();
        animateTo(snaps[nearestIndex()]);
      };

      const startHold = () => {
        stopAnim(); // 競合防止
        scroller.classList.add("no-snap");

        isHolding = true;
        didHoldStart = true;
        v = 0;
        let prevT = performance.now();

        const step = (now) => {
          if (!isHolding) return;
          const dt = (now - prevT) / 1000;
          prevT = now;

          v = Math.min(MAX_V, v + ACCEL * dt); // 加速
          scroller.scrollLeft += dir * v * dt; // 連続移動

          // 端で停止
          const atStart = scroller.scrollLeft <= 0;
          const atEnd =
            scroller.scrollLeft + scroller.clientWidth >=
            scroller.scrollWidth - 1;

          updateArrows();
          updateFade();

          if ((dir < 0 && atStart) || (dir > 0 && atEnd)) {
            stopHold();
            return;
          }
          holdRaf = requestAnimationFrame(step);
        };

        holdRaf = requestAnimationFrame(step);
      };

      const onPointerDown = (e) => {
        // 無効時はイベントを飲み込んで終了（下へ抜けさせない）
        if (btn.disabled || btn.classList.contains("is-disabled")) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();

        didHoldStart = false;
        downX = e.clientX;
        downY = e.clientY;

        clearTimeout(holdTimer);
        holdTimer = setTimeout(startHold, HOLD_DELAY);

        // ドラッグしても追跡できるようにキャプチャ
        btn.setPointerCapture?.(e.pointerId);
      };

      const onPointerMove = (e) => {
        // 大きく動いたらタップ扱いは取り消し（＝長押し待機も解除）
        if (
          Math.abs(e.clientX - downX) > TAP_MOVE_TOL ||
          Math.abs(e.clientY - downY) > TAP_MOVE_TOL
        ) {
          clearTimeout(holdTimer);
        }
      };

      const onPointerUpLike = () => {
        clearTimeout(holdTimer);

        if (isHolding) {
          // 連続スクロール中 → 吸着して終了
          stopHold();
        } else if (!didHoldStart && !btn.disabled) {
          // 長押し未開始＝短タップ → 1枚送り
          go(dir);
        }
      };

      const onKeyDown = (e) => {
        if (btn.disabled || btn.classList.contains("is-disabled")) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go(dir);
        }
      };

      // Pointer Events に一本化
      btn.addEventListener("pointerdown", onPointerDown);
      btn.addEventListener("pointermove", onPointerMove);
      btn.addEventListener("pointerup", onPointerUpLike);
      btn.addEventListener("pointercancel", onPointerUpLike);
      btn.addEventListener("lostpointercapture", onPointerUpLike);
      btn.addEventListener("keydown", onKeyDown);

      // アクセシビリティ
      if (!btn.hasAttribute("tabindex")) btn.setAttribute("tabindex", "0");
      if (!btn.hasAttribute("role")) btn.setAttribute("role", "button");
      if (!btn.hasAttribute("aria-label")) {
        btn.setAttribute(
          "aria-label",
          dir < 0 ? "previous items" : "next items"
        );
      }
    };

    setupButton(prev, -1);
    setupButton(next, 1);

    /* --- 無効時イベントを先取りして“飲み込む”（保険） --- */
    const swallowDisabled = (btn) => {
      const stopIfDisabled = (e) => {
        if (btn.disabled || btn.classList.contains("is-disabled")) {
          e.preventDefault();
          e.stopPropagation();
        }
      };
      btn.addEventListener("click", stopIfDisabled, true); // capture
      btn.addEventListener("pointerup", stopIfDisabled, true); // capture
      btn.addEventListener("keydown", stopIfDisabled, true);
    };
    swallowDisabled(prev);
    swallowDisabled(next);

    /* --- 現在ページのカードを自動除外（HTML変更不要・URL突き合わせ） --- */
    const normalizePath = (p) => {
      p = p.replace(/\/index\.(html?|php)$/, "/");
      if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
      return p;
    };
    const getCurrentPath = () => {
      const canonical = document.querySelector('link[rel="canonical"]')?.href;
      try {
        return normalizePath(
          new URL(canonical || window.location.href).pathname
        );
      } catch {
        return normalizePath(window.location.pathname);
      }
    };
    const excludeCurrentWorkByUrl = () => {
      const currentPath = getCurrentPath();
      const lis = scroller.querySelectorAll(":scope > li");
      for (const li of lis) {
        const a = li.querySelector("a[href]");
        if (!a) continue;
        let cardPath = "";
        try {
          cardPath = normalizePath(
            new URL(a.getAttribute("href"), window.location.href).pathname
          );
        } catch {}
        if (cardPath && cardPath === currentPath) {
          li.remove();
          break;
        }
      }
      if (scroller.children.length === 0) wrap.setAttribute("hidden", "");
    };

    /* --- 初期化 --- */
    const init = () => {
      excludeCurrentWorkByUrl(); // 先に除外
      computeSnaps();
      updateArrows();
      updateFade();
    };
    init();

    window.addEventListener("load", init);
    window.addEventListener("resize", init);
    scroller.addEventListener("scroll", () => {
      updateArrows();
      updateFade();
    });

    // タブ切り替え等
    window.addEventListener("blur", () => {
      /* 進行中アニメは停止だけでOK */
    });
  });

  /* ③（任意）他の初期化をここへ追加 */
});

/* ==== モックアップ（バー無し／白フチ角丸／枠内スクロール）
        └ PCの高さをSPに常時同期（SPを基準にスケール） ==== */
(() => {
  const host = document.querySelector(".project-preview .project-image");
  if (!host) return;
  if (host.dataset.mockupApplied === "1") return;
  host.dataset.mockupApplied = "1";

  // --- 設定（必要なら数値だけ変更OK） ---
  const CFG = {
    SP_WIDTH: 24,
    PC_WIDTH: 76,
    SP_MIN: 260,
    SP_MAX: 330,
    PC_MAX: 700,
    RIM: 10,
    RADIUS: 20,
    // SPの“見せたい1画面”比率（幅:高さ）→SPの高さはこの比率で決まる
    SP_AR_W: 9,
    SP_AR_H: 19,
    MIN_H: 320,
    MAX_H: 900,
  };

  // 旧スタイルが残っていたら除去（競合回避）
  document.getElementById("mockupStyles")?.remove();

  // スタイル注入（PCは高さをJSで設定するため、PC側の高さはCSSで固定しない）
  const style = document.createElement("style");
  style.id = "mockupStyles";
  style.textContent = `
    :root{ --rim:${CFG.RIM}px; --radius:${CFG.RADIUS}px; }

    /* 外枠：白フチ＋角丸＋影（フチ込みで幅計算） */
    .mockup{
      background:#fff;
      border:var(--rim) solid #fff;
      border-radius:var(--radius);
      box-shadow:0 0 0 1px rgba(0,0,0,.06) inset, 0 8px 30px rgba(0,0,0,.08);
      overflow:hidden;
      box-sizing:border-box;
    }
    /* Flexで勝手に伸びないよう固定 */
    .project-image > .mockup{ flex:0 0 auto; align-self:flex-start; }

    /* 横幅：SPはスマホ幅にクランプ、PCは残り幅（上限あり） */
    .mockup--sp{ width:clamp(${CFG.SP_MIN}px, ${CFG.SP_WIDTH}%, ${CFG.SP_MAX}px); }
    .mockup--pc{ width:${CFG.PC_WIDTH}%; max-width:${CFG.PC_MAX}px; }

    /* 枠内：SPは aspect-ratio で高さ決定（＝基準）。PCはJSで同期するので高さは書かない */
    .mockup-body{
      overflow:auto;
      -webkit-overflow-scrolling:touch;
      border-radius:calc(var(--radius) - 2px);
    }
    .mockup--sp .mockup-body{
      aspect-ratio: ${CFG.SP_AR_W} / ${CFG.SP_AR_H};
      min-height:${CFG.MIN_H}px; max-height:${CFG.MAX_H}px;
    }

    /* 画像は枠にフィット（元CSSのmax-width等を打ち消す） */
    .mockup .mockup-body img{
      width:100% !important;
      max-width:100% !important;
      height:auto; display:block;
    }

    /* 既存レイアウトと調和 */
    .project-image{ align-items:flex-start; gap:32px; }

    /* スマホ幅：縦積み。PCは全幅、SPは上限までで中央寄せ（PC高さはJSで同期） */
    @media (max-width:853px){
      .project-image{ align-items:center; }
      .mockup--pc{ width:100%; max-width:none; }
      .project-image > .mockup--sp{ width:min(100%, ${CFG.SP_MAX}px); margin:0 auto; }
    }
  `.replace(/\s+/g, " ");
  document.head.appendChild(style);

  // 画像を枠で包む（バー無し）
  const wrap = (img, kind) => {
    if (!img || img.closest(".mockup")) return;
    const fig = document.createElement("figure");
    fig.className = `mockup mockup--${kind}`;
    const body = document.createElement("div");
    body.className = "mockup-body";
    const parent = img.parentNode;
    parent.insertBefore(fig, img);
    body.appendChild(img);
    fig.appendChild(body);
  };
  wrap(host.querySelector(".image-sp"), "sp");
  wrap(host.querySelector(".image-pc"), "pc");

  // ---- 高さ同期：PCの高さをSPの高さに常時合わせる ----
  const spBody = host.querySelector(".mockup--sp .mockup-body");
  const pcBody = host.querySelector(".mockup--pc .mockup-body");
  if (!spBody || !pcBody) return;

  const syncPcHeight = () => {
    const h = Math.round(spBody.getBoundingClientRect().height);
    pcBody.style.height = `${h}px`;
  };

  // 初回＆リサイズで同期
  const ro = new ResizeObserver(syncPcHeight);
  ro.observe(spBody);
  window.addEventListener("resize", () => {
    syncPcHeight();
  });

  // 画像ロード後にも同期（SP画像の自然高さが変わる瞬間を拾うため）
  const ensureAfterLoad = () => {
    const imgs = spBody.querySelectorAll("img");
    let pending = imgs.length;
    if (pending === 0) {
      syncPcHeight();
      return;
    }
    imgs.forEach((img) => {
      if (img.complete) {
        if (--pending === 0) syncPcHeight();
      } else
        img.addEventListener(
          "load",
          () => {
            if (--pending === 0) syncPcHeight();
          },
          { once: true }
        );
    });
  };
  ensureAfterLoad();
  // 念のため遅延同期（フォント適用後等）
  setTimeout(syncPcHeight, 150);
})();
