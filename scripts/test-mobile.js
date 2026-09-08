const { chromium } = require('playwright');
// Defaults to the live site; override to test a local build:
//   TEST_URL=http://localhost:4200/ npm run test:mobile
const SITE = process.env.TEST_URL || 'https://simonrijsselaere.github.io/caraconverterupdate/';
const R = [];
const rec = (suite, name, pass, detail) => R.push({ suite, name, pass, detail });

const PHONES = {
  'iPhone SE 375x667':       { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  'iPhone 12 390x844':       { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  'Pixel 5 393x851':         { viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  'Galaxy S8 360x740':       { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  'iPhone 14 PM 430x932':    { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
};

async function enter(page, val) {
  await page.fill('input', String(val));
  await page.waitForTimeout(500);
}
async function selectBeer(page, name) {
  await page.locator('ion-segment-button', { hasText: name }).first().click();
  await page.waitForTimeout(450);
}
async function txt(page, sel) {
  const n = await page.locator(sel).count();
  if (!n) return null;
  const t = await page.locator(sel).first().textContent();
  return t ? t.trim().replace(/\s+/g, ' ') : null;
}
function contrast(fg, bg) {
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const L1 = lum(fg), L2 = lum(bg);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
const parseRGB = (s) => (String(s).match(/\d+/g) || []).slice(0, 3).map(Number);

(async () => {
  const browser = await chromium.launch();

  // ---------- A/B/H: render, overflow, fold, console, network ----------
  for (const [label, cfg] of Object.entries(PHONES)) {
    const ctx = await browser.newContext(cfg);
    const page = await ctx.newPage();
    const errs = [], failed = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url().split('/').pop()); });

    await page.goto(SITE, { waitUntil: 'networkidle' });
    const tabs = await page.locator('ion-segment-button').count();
    rec('A. Render', label + ' boots', tabs === 4, tabs + ' beer tabs');

    const ov = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      const w = Math.max(el.scrollWidth, document.body.scrollWidth);
      return { w: w, c: el.clientWidth, over: w - el.clientWidth };
    });
    rec('A. Render', label + ' no horizontal scroll', ov.over <= 1, 'scrollW=' + ov.w + ' clientW=' + ov.c);

    await enter(page, 20);
    const fold = await page.evaluate(() => {
      const p = document.querySelector('.pyramid');
      if (!p) return { found: false };
      const r = p.getBoundingClientRect();
      return { found: true, top: Math.round(r.top), vh: window.innerHeight };
    });
    rec('B. Above the fold', label + ' pyramid visible without scrolling',
      fold.found && fold.top < fold.vh && fold.top > 0,
      fold.found ? 'pyramid top=' + fold.top + 'px, viewport=' + fold.vh + 'px' : 'no .pyramid rendered');

    rec('H. Console', label, errs.length === 0, errs.length ? errs.slice(0, 2).join(' | ') : 'no JS errors');
    rec('H. Network', label, failed.length === 0, failed.length ? failed.slice(0, 4).join(' | ') : 'no failed requests');
    await ctx.close();
  }

  // ---------- deep tests on one device ----------
  const ctx = await browser.newContext(PHONES['iPhone 12 390x844']);
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: 'networkidle' });

  // C. conversion math
  const cases = [
    ['20', '51 Cara', 'floor(20/0.39)=51'],
    ['0', '0 Cara', 'zero money'],
    ['0.39', '1 Cara', 'exactly one can'],
    ['1,5', '3 Cara', 'comma decimal accepted'],
    ['1000000', '2.564.102', 'nl-BE thousand separators'],
  ];
  for (const c of cases) {
    await enter(page, c[0]);
    const b = await txt(page, '.result-banner');
    rec('C. Conversion', '"' + c[0] + '" -> ' + c[1], !!b && b.indexOf(c[1]) !== -1, 'got "' + b + '" (' + c[2] + ')');
  }

  // C. validation
  const bad = [['abc', 'geen geld'], ['-5', 'geen geld'], ['9999999999', 'miljard']];
  for (const c of bad) {
    await enter(page, c[0]);
    const err = await txt(page, '.input-error');
    const shown = await page.locator('.result-banner').count();
    rec('C. Validation', '"' + c[0] + '" rejected, no result',
      !!err && err.indexOf(c[1]) !== -1 && shown === 0,
      'error="' + err + '" resultShown=' + (shown > 0));
  }

  // D. alcohol-free dead end
  await enter(page, '20');
  await selectBeer(page, '0.0');
  const zero = await page.evaluate(() => {
    const q = document.querySelector('input');
    const inp = document.querySelector('input');
    const ion = document.querySelector('ion-input');
    const cs = getComputedStyle(ion);
    return {
      label: q ? q.getAttribute('placeholder') : null,
      disabled: inp ? inp.disabled : null,
      opacity: parseFloat(cs.opacity),
      bg: cs.backgroundColor,
      value: inp ? inp.value : null,
      resultShown: !!document.querySelector('.result-banner'),
    };
  });
  rec('D. Alcohol-free', 'disabled field shows "Doe normaal"', zero.label === 'Doe normaal', 'got "' + zero.label + '"');
  rec('D. Alcohol-free', 'input disabled', zero.disabled === true, 'disabled=' + zero.disabled);
  rec('D. Alcohol-free', 'input visibly greyed', zero.opacity < 1 || zero.bg !== 'rgb(255, 255, 255)',
    'opacity=' + zero.opacity + ' bg=' + zero.bg);
  rec('D. Alcohol-free', 'stale result cleared', zero.resultShown === false && zero.value === '',
    'value="' + zero.value + '" resultShown=' + zero.resultShown);

  // E. nightshop
  await selectBeer(page, 'PILS');
  const dayPrice = await txt(page, 'ion-segment-button .segment-price');
  await page.locator('.app-header ion-button').first().click();
  await page.waitForTimeout(500);
  const night = await page.evaluate(() => {
    const c = document.querySelector('ion-content');
    const p = document.querySelector('ion-segment-button .segment-price');
    const l = document.querySelector('.nightshop-label');
    return {
      price: p ? p.textContent.trim() : null,
      label: l ? l.textContent.trim() : null,
      dark: c ? c.classList.contains('nightshop') : false,
    };
  });
  rec('E. Nightshop', 'prices switch to nightshop rate',
    night.price !== dayPrice && (String(night.price).indexOf('1.00') !== -1 || String(night.price).indexOf('1,00') !== -1),
    'day=' + dayPrice + ' night=' + night.price);
  rec('E. Nightshop', 'mode label shown', night.label === 'Nachtwinkel-modus', 'got "' + night.label + '"');
  rec('E. Nightshop', 'dark theme applied', night.dark === true, 'nightshop class=' + night.dark);
  await enter(page, '100');
  const crate = await page.locator('.crate-line').count();
  rec('E. Nightshop', 'crate optimizer hidden (nightshops sell no crates)', crate === 0, 'crate lines=' + crate);
  await page.locator('.app-header ion-button').first().click();
  await page.waitForTimeout(450);

  // F. touch targets
  await enter(page, '20');
  const targets = await page.evaluate(() => {
    const out = [];
    const push = (name, el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push({ name: name, w: Math.round(r.width), h: Math.round(r.height) });
    };
    const hdr = document.querySelector('.app-header ion-button');
    if (hdr) push('nightshop toggle', hdr);
    document.querySelectorAll('ion-segment-button').forEach((el, i) => push('beer tab ' + i, el));
    const inp = document.querySelector('ion-input');
    if (inp) push('money input', inp);
    const share = Array.prototype.slice.call(document.querySelectorAll('ion-button')).find((b) => /Deel/.test(b.textContent));
    if (share) push('share button', share);
    const tip = document.querySelector('.tip-jar ion-button');
    if (tip) push('tip jar button', tip);
    return out;
  });
  const small = targets.filter((t) => t.h < 44);
  rec('F. Touch targets', 'all interactive targets >= 44px tall (Apple HIG)', small.length === 0,
    small.length ? small.map((t) => t.name + ' ' + t.w + 'x' + t.h).join(', ') : targets.length + ' targets checked, all ok');

  // G. accessibility
  const a11y = await page.evaluate(() => {
    const inp = document.querySelector('input');
    const imgs = Array.prototype.slice.call(document.querySelectorAll('img'));
    const noAlt = imgs.filter((i) => i.getAttribute('alt') === null).length;
    // Ionic forwards aria-label onto the inner shadow-DOM <button>, so the host
    // often has none. Check both before calling a button unnamed.
    const unnamed = Array.prototype.slice.call(document.querySelectorAll('ion-button'))
      .filter((b) => {
        const inner = b.shadowRoot ? b.shadowRoot.querySelector('button') : null;
        return !(b.getAttribute('aria-label') || b.textContent.trim() ||
                 (inner && inner.getAttribute('aria-label')));
      }).length;
    const bgOf = (el) => {
      let n = el;
      while (n) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
        n = n.parentElement;
      }
      return 'rgb(250, 245, 233)';
    };
    const measure = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { sel: sel, color: cs.color, opacity: parseFloat(cs.opacity), fontSize: cs.fontSize, bg: bgOf(el) };
    };
    return {
      inputName: inp ? (inp.getAttribute('aria-label') || inp.getAttribute('placeholder')) : null,
      noAlt: noAlt, totalImgs: imgs.length, unnamed: unnamed,
      faded: ['.disclaimer', '.gag-stat', '.abv-line'].map(measure).filter(Boolean),
    };
  });
  rec('G. A11y', 'money input has accessible name', !!a11y.inputName, 'name="' + a11y.inputName + '"');
  rec('G. A11y', 'every image has an alt attribute', a11y.noAlt === 0, a11y.noAlt + '/' + a11y.totalImgs + ' missing alt');
  rec('G. A11y', 'every button has an accessible name', a11y.unnamed === 0, a11y.unnamed + ' unnamed buttons');
  for (const f of a11y.faded) {
    const fg = parseRGB(f.color), bg = parseRGB(f.bg);
    const blended = fg.map((c, i) => Math.round(c * f.opacity + bg[i] * (1 - f.opacity)));
    const ratio = contrast(blended, bg);
    const px = parseFloat(f.fontSize);
    const need = px >= 18.66 ? 3.0 : 4.5;
    rec('G. Contrast', f.sel + ' (' + f.fontSize + ', opacity ' + f.opacity + ')', ratio >= need,
      ratio.toFixed(2) + ':1, WCAG AA needs ' + need + ':1');
  }

  // K. stylesheet + fonts actually apply (regression guard for the CSP bug:
  // inlineCritical emitted <link media="print" onload="this.media='all'"> and the
  // strict CSP blocked the onload, leaving every global rule and @font-face inert)
  const assets = await page.evaluate(async () => {
    await document.fonts.ready;
    const link = document.querySelector('link[rel="stylesheet"]');
    // NB: document.fonts is a FontFaceSet (a Set), so slice.call() on it yields
    // [] and quietly fails. Use forEach / check() instead.
    const faces = [];
    document.fonts.forEach((f) => faces.push(f.family.replace(/['"]/g, '') + ':' + f.status));
    return {
      media: link ? link.getAttribute('media') : null,
      inlineHandlers: document.querySelectorAll('[onload],[onclick],[onerror]').length,
      fontCount: document.fonts.size,
      faces: faces.join(', '),
      carafont: document.fonts.check('16px Carafont'),
    };
  });
  rec('K. Styles', 'global stylesheet applies to screen (not media=print)',
    assets.media === null || assets.media === 'all', 'media=' + assets.media);
  rec('K. Styles', 'no inline event handlers for the CSP to block',
    assets.inlineHandlers === 0, assets.inlineHandlers + ' inline handlers');
  rec('K. Styles', 'Carafont actually loads', assets.carafont === true,
    'fontFaces=' + assets.fontCount + ' [' + assets.faces + ']');

  // I. landscape
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(450);
  const land = await page.evaluate(() => {
    const el = document.scrollingElement;
    return Math.max(el.scrollWidth, document.body.scrollWidth) - el.clientWidth;
  });
  rec('I. Landscape', '844x390 no horizontal scroll', land <= 1, 'overflow=' + land + 'px');
  await page.setViewportSize({ width: 390, height: 844 });

  // J. PWA / offline
  await page.goto(SITE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);
  let sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false };
    const regs = await navigator.serviceWorker.getRegistrations();
    return { supported: true, registered: regs.length > 0, controlled: !!navigator.serviceWorker.controller };
  });
  rec('J. PWA', 'service worker registers', sw.registered === true, JSON.stringify(sw));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  sw = await page.evaluate(() => ({ controlled: !!navigator.serviceWorker.controller }));
  rec('J. PWA', 'service worker controls the page after reload', sw.controlled === true, JSON.stringify(sw));
  if (sw.controlled) {
    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1500);
    const offlineTabs = await page.locator('ion-segment-button').count().catch(() => 0);
    rec('J. PWA', 'app still works with no network', offlineTabs === 4, 'beer tabs rendered offline=' + offlineTabs);
    await ctx.setOffline(false);
  } else {
    rec('J. PWA', 'app still works with no network', false, 'SW not controlling page, offline not verifiable');
  }

  await browser.close();

  const bySuite = {};
  for (const r of R) { (bySuite[r.suite] = bySuite[r.suite] || []).push(r); }
  let pass = 0, fail = 0;
  for (const s of Object.keys(bySuite)) {
    console.log('\n## ' + s);
    for (const r of bySuite[s]) {
      r.pass ? pass++ : fail++;
      console.log('  ' + (r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + (r.detail ? '  -- ' + r.detail : ''));
    }
  }
  console.log('\n===== ' + pass + ' passed, ' + fail + ' failed =====');
  process.exit(fail > 0 ? 1 : 0);
})();
