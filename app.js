(() => {
  'use strict';

  const RUNES = window.RUNES;
  const CORPUS = window.CORPUS;
  const BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const EXTRA = ['Ä', 'Ö', 'Ü', 'ß'];
  const VIEWS = ['quiz', 'letters', 'library', 'convert', 'zukan', 'about'];
  const ZUKAN = window.ZUKAN || [];

  const SCRIPTS = {
    archaic: { label: 'Archaic', hint: 'アニメで最もよく見られる、標準的な書体です。' },
    modern: { label: 'Modern', hint: '簡略化された書体。P・V・X は Archaic 体で代用します。' },
    musical: { label: 'Musical', hint: '音符でできた書体。J・Q・W・X・Ä・Ö・Ü・ß は Archaic 体で代用します。' },
    latin: { label: 'Latin', hint: '『マギアレコード』『ワルプルギスの廻天』などの書体。Ä・Ö・Ü・ß は Archaic 体で代用します。' }
  };

  const MODES = [
    { id: 'r2l', title: '文字を読む', desc: '魔女文字を見て、アルファベットを選ぶ', sample: 'A' },
    { id: 'l2r', title: '文字を探す', desc: 'アルファベットを見て、魔女文字を選ぶ', sample: 'B' },
    { id: 'word', title: '言葉を読む', desc: '名前や作中の文を読み、4択で答える', sample: 'HEXE' },
    { id: 'spell', title: '書き取り', desc: '魔女文字の言葉を、アルファベットで入力する', sample: 'ROSE' },
    { id: 'flash', title: '瞬間読み', desc: '一瞬だけ映る魔女文字を読み取る', sample: 'ZEIT' },
    { id: 'predict', title: '予測読み', desc: '前半だけ見えている文から、全体を推測する', sample: 'TRAUM' },
    { id: 'lang', title: '言語を見分ける', desc: '一瞬映る魔女文字が、何語で書かれているかを当てる', sample: 'SIE' }
  ];
  const LANGS = { de: 'ドイツ語', en: '英語', ja: '日本語（ローマ字）', other: 'その他（伊・仏・羅など）' };
  const LANG_BADGE = { de: 'ドイツ語', en: '英語', ja: 'ローマ字', other: 'その他の言語', mix: '複数の言語', name: '名前', 'de-name': 'ドイツ語の名前' };
  const TIMED_MODES = ['flash', 'lang'];
  const LETTER_MODES = ['r2l', 'l2r'];

  // ---------- storage (always optional) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('mm.' + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('mm.' + key, JSON.stringify(value)); } catch (e) { /* private mode etc. */ }
    }
  };

  const settings = Object.assign(
    {
      script: 'archaic', count: '10', flash: 'auto', original: true, umlaut: false, weak: true, auto: false,
      voice: '', rate: '0.85', speak: false,
      cats: CORPUS.filter((c) => c.defaultOn).map((c) => c.id)
    },
    store.get('settings', {})
  );
  if (!SCRIPTS[settings.script]) settings.script = 'archaic';
  if (settings.v !== 2) { // v1 had different categories
    settings.cats = CORPUS.filter((c) => c.defaultOn).map((c) => c.id);
    settings.v = 2;
  }
  let stats = store.get('stats', {});     // per letter: { "archaic:A": {a, c} }
  let wstats = store.get('wstats', {});   // per entry:  { "tv:KEIN DURCHGANG:": {a, c} }
  const saveSettings = () => { store.set('settings', settings); renderSummary(); };

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const sample = (arr, n) => shuffle(arr).slice(0, n);
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const upper = (s) => Array.from(s).map((c) => (c === 'ß' ? c : c.toUpperCase())).join(''); // keep ß
  const lettersOf = (s) => upper(s).replace(/[^A-ZÄÖÜß]/g, '');
  const fold = (s) => upper(s).replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').replace(/[^A-Z0-9]/g, '');

  /** Returns { svg, fallback } for a character in a script, or null if no rune exists. */
  function glyph(ch, script) {
    if (/[0-9]/.test(ch)) return RUNES.digits[ch] ? { svg: RUNES.digits[ch], fallback: false } : null;
    if (RUNES.punct[ch]) return { svg: RUNES.punct[ch], fallback: false };
    const set = RUNES[script] || RUNES.archaic;
    if (set[ch]) return { svg: set[ch], fallback: false };
    if (RUNES.archaic[ch]) return { svg: RUNES.archaic[ch], fallback: true };
    return null;
  }

  function runeSingle(ch, script) {
    const g = glyph(ch, script);
    const n = el('span', 'rune-single' + (g && g.fallback ? ' fallback' : ''), g ? g.svg : '');
    n.setAttribute('role', 'img');
    n.setAttribute('aria-label', '魔女文字');
    return n;
  }

  /**
   * Renders text as runes.
   * opts.labels: show latin letters under each glyph
   * opts.reveal: number of letters to draw; the rest become blank slots (predict mode)
   */
  function runeWord(text, script, opts = {}) {
    const wrap = el('span', 'rune-word');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', opts.labels ? upper(text) : '魔女文字の言葉');
    let drawn = 0;
    for (const token of upper(text).split(/\s+/).filter(Boolean)) {
      const t = el('span', 'rune-token');
      for (const ch of token) {
        const g = glyph(ch, script);
        let c;
        if (!g) {
          c = el('span', 'rune-char', `<span class="rune-punct">${escapeHtml(ch)}</span>`);
        } else if (opts.reveal != null && drawn >= opts.reveal) {
          c = el('span', 'rune-char hole');
          drawn++;
        } else {
          c = el('span', 'rune-char' + (g.fallback ? ' fallback' : ''), g.svg);
          if (opts.labels) c.appendChild(el('small', null, escapeHtml(ch)));
          drawn++;
        }
        t.appendChild(c);
      }
      wrap.appendChild(t);
    }
    return wrap;
  }

  /** Shrinks rune height so the longest word fits the container on one line. */
  function fitRunes(container, base, maxH) {
    const word = container.querySelector('.rune-word');
    if (!word) return;
    // lay out at full size, then scale down by the widest word (tokens don't wrap at this point)
    word.style.setProperty('--rh', base + 'px');
    word.classList.add('measuring');
    const widest = Math.max(1, ...Array.from(word.querySelectorAll('.rune-token')).map((t) => t.scrollWidth));
    word.classList.remove('measuring');
    const cs = getComputedStyle(container);
    const avail = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4;
    let h = widest > avail ? Math.max(18, Math.floor(base * avail / widest * .97)) : base;
    word.style.setProperty('--rh', h + 'px');
    // optionally also fit the height (long sentences on short screens)
    while (maxH && h > 14 && word.offsetHeight > maxH) {
      h -= 2;
      word.style.setProperty('--rh', h + 'px');
    }
  }

  // ---------- corpus ----------
  const ENTRIES = CORPUS.flatMap((cat) => cat.items.map((it) => Object.assign({ cat: cat.id, catLabel: cat.label, scene: !!cat.scene, key: `${cat.id}:${it.w}:${it.script || ''}` }, it)));
  const runeText = (e) => e.shown || e.w;
  /** Script used to draw an entry: the on-screen script for scene texts when enabled. */
  const entryScript = (e) => (settings.original && e.scene ? e.script || 'archaic' : settings.script);

  function wordPool() {
    const cats = settings.cats.filter((c) => CORPUS.some((x) => x.id === c));
    return ENTRIES.filter((e) => cats.includes(e.cat));
  }

  // ---------- stats ----------
  const statKey = (ch) => settings.script + ':' + ch;
  function bump(obj, key, ok) {
    const s = obj[key] || { a: 0, c: 0 };
    s.a += 1; if (ok) s.c += 1;
    obj[key] = s;
  }
  function accuracy(ch) {
    const s = stats[statKey(ch)];
    return s && s.a ? s.c / s.a : null;
  }
  const weight = (s) => (s ? 1 + 3 * (s.a - s.c + 0.5) / (s.a + 1) : 2.5);

  /** Picks n items; weightOf returns the item's {a, c} stats, so weak items (more misses) are likelier. Items repeat only after the pool is used up. */
  function pick(pool, n, weightOf) {
    const out = [];
    while (out.length < n && pool.length) {
      const items = pool.map((x) => ({ x, w: settings.weak ? weight(weightOf(x)) : 1 }));
      while (out.length < n && items.length) {
        const total = items.reduce((t, i) => t + i.w, 0);
        let r = Math.random() * total;
        let idx = items.findIndex((i) => (r -= i.w) <= 0);
        if (idx < 0) idx = items.length - 1;
        out.push(items.splice(idx, 1)[0].x);
      }
    }
    return out;
  }

  /** Letters available in the chosen script (no fallbacks in single-letter quizzes). */
  function letterPool() {
    const set = RUNES[settings.script];
    return (settings.umlaut ? BASE.concat(EXTRA) : BASE).filter((ch) => set[ch]);
  }

  // ---------- speech (German read-aloud) ----------
  const synth = window.speechSynthesis;
  let deVoices = [];
  // 女性の声を優先するための手がかり（端末ごとに名前が違うので、よくあるものを並べている）
  const FEMALE_HINTS = ['anna', 'petra', 'katja', 'hedda', 'marlene', 'vicki', 'helena', 'amelie', 'eva', 'female', 'frau', 'weiblich'];

  // ドイツ語の文・単語と、ドイツ語圏の名前（魔女や手下）を読み上げる
  const speakable = (e) => !!synth && ['de', 'mix', 'de-name'].includes(e.lang);

  function pickVoice() {
    if (!deVoices.length) return null;
    const saved = deVoices.find((v) => v.voiceURI === settings.voice || v.name === settings.voice);
    if (saved) return saved;
    const female = deVoices.find((v) => FEMALE_HINTS.some((h) => v.name.toLowerCase().includes(h)));
    return female || deVoices[0];
  }

  /** 全部大文字だと略語として一文字ずつ読まれる端末があるので、文の形に直す */
  const cap = (w) => w.charAt(0).toLocaleUpperCase('de-DE') + w.slice(1);
  const speechText = (t, isName) => {
    const s = t.toLocaleLowerCase('de-DE');
    // 名前は単語ごとに大文字（ただし von などの前置詞はドイツ語の慣習どおり小文字のまま）
    const PARTICLES = ['von', 'van', 'der', 'die', 'das', 'de'];
    return isName
      ? s.split(' ').map((w, i) => (i > 0 && PARTICLES.includes(w) ? w : cap(w))).join(' ')
      : cap(s);
  };

  function speak(text, isName) {
    if (!synth) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(speechText(text, isName));
      const v = pickVoice();
      if (v) u.voice = v;
      u.lang = (v && v.lang) || 'de-DE';
      u.rate = parseFloat(settings.rate) || 1;
      synth.speak(u);
    } catch (e) { /* 読み上げに対応していない端末 */ }
  }

  /** 「♪」の読み上げボタン */
  function speakBtn(text, isName) {
    const b = el('button', 'speak-btn', '♪');
    b.type = 'button';
    b.title = '読み上げる';
    b.setAttribute('aria-label', 'ドイツ語を読み上げる');
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      b.classList.add('playing');
      setTimeout(() => b.classList.remove('playing'), 900);
      speak(text, isName);
    });
    return b;
  }

  function renderVoices() {
    const box = $('#speechBox'), sel = $('#optVoice'), hint = $('#speechHint');
    if (!synth) {
      box.hidden = true;
      return;
    }
    deVoices = synth.getVoices().filter((v) => /^de/i.test(v.lang));
    sel.innerHTML = '';
    const auto = el('option', null, 'おまかせ（女性の声を優先）');
    auto.value = '';
    sel.appendChild(auto);
    for (const v of deVoices) {
      const o = el('option', null, escapeHtml(`${v.name}（${v.lang}）`));
      o.value = v.voiceURI;
      sel.appendChild(o);
    }
    sel.value = deVoices.some((v) => v.voiceURI === settings.voice) ? settings.voice : '';
    sel.disabled = !deVoices.length;
    hint.textContent = deVoices.length
      ? 'ドイツ語の言葉・文・名前には「♪」が付きます。タップすると読み上げます。'
      : 'この端末にはドイツ語の音声が見つかりませんでした。「♪」は表示しますが、標準の声で読み上げます。';
  }

  if (synth) {
    synth.addEventListener?.('voiceschanged', renderVoices);
    // 一部の端末では声の一覧が遅れて届く
    setTimeout(renderVoices, 500);
  }

  // ---------- theme ----------
  function currentTheme() {
    const t = document.documentElement.dataset.theme;
    if (t) return t;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  $('#themeBtn').addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('mm.theme', next); } catch (e) {}
  });

  // ---------- navigation ----------
  const navItems = document.querySelectorAll('.nav-item');
  let currentView = null;
  function showView(name) {
    currentView = name;
    navItems.forEach((t) => (t.dataset.view === name ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current')));
    document.querySelectorAll('.view').forEach((v) => v.toggleAttribute('data-active', v.id === 'view-' + name));
    if (name === 'letters') renderLetters();
    if (name === 'library') renderLibrary();
    if (name === 'convert') renderConvert();
    store.set('view', name);
    window.scrollTo(0, 0);
  }
  navItems.forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

  // ---------- script selectors (shared setting) ----------
  const segs = ['#scriptSeg', '#scriptSeg2', '#scriptSeg3', '#scriptSeg4', '#scriptSeg5'].map((s) => $(s));
  function setScript(id) {
    settings.script = id; saveSettings();
    renderSegs(); renderModes();
    if (currentView === 'letters') renderLetters();
    if (currentView === 'library') renderLibrary();
    if (currentView === 'convert') renderConvert();
    if (currentView === 'zukan' && !$('#zukanPage').hidden) renderZukanPage();
  }
  function renderSegs() {
    for (const seg of segs) {
      seg.innerHTML = '';
      for (const [id, s] of Object.entries(SCRIPTS)) {
        const b = el('button', null, s.label);
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(settings.script === id));
        b.addEventListener('click', () => setScript(id));
        seg.appendChild(b);
      }
    }
    $('#scriptHint').textContent = SCRIPTS[settings.script].hint;
  }

  // ---------- quiz setup ----------
  function renderModes() {
    const list = $('#modeList');
    list.innerHTML = '';
    for (const m of MODES) {
      const b = el('button', 'mode');
      b.type = 'button';
      const r = el('span', 'mode-rune');
      for (const ch of m.sample) { const g = glyph(ch, settings.script); if (g) r.insertAdjacentHTML('beforeend', g.svg); }
      b.append(r, el('span', 'mode-title', m.title), el('span', 'mode-desc', m.desc));
      b.addEventListener('click', () => startQuiz(m.id));
      list.appendChild(b);
    }
  }

  function renderSummary() {
    const count = settings.count === 'all' ? '全部' : settings.count + '問';
    $('#settingsSummary').textContent = `${SCRIPTS[settings.script].label}・${count}・範囲 ${settings.cats.length}`;
    $('#poolHint').textContent = `言葉のクイズの対象：${wordPool().length} 件`;
  }

  function renderSettings() {
    const bind = (id, key, prop = 'checked') => {
      const n = $(id);
      n[prop] = settings[key];
      n.onchange = () => { settings[key] = n[prop]; saveSettings(); };
    };
    bind('#optCount', 'count', 'value');
    bind('#optFlash', 'flash', 'value');
    bind('#optOriginal', 'original');
    $('#optOriginal').addEventListener('change', () => { $('#libOriginal').checked = settings.original; });
    bind('#optUmlaut', 'umlaut');
    bind('#optWeak', 'weak');
    bind('#optAuto', 'auto');
    bind('#optRate', 'rate', 'value');
    bind('#optSpeak', 'speak');
    bind('#optVoice', 'voice', 'value');
    $('#optVoice').addEventListener('change', () => speak('Hexe'));  // 選んだ声をその場で確認できる  // 選んだ声をその場で確認できる
    renderVoices();

    const chips = $('#catChips');
    chips.innerHTML = '';
    for (const c of CORPUS) {
      const b = el('button', 'chip', escapeHtml(c.label) + (c.spoiler ? '<span class="spoiler">ネタバレ</span>' : ''));
      b.type = 'button';
      b.title = c.desc;
      b.setAttribute('aria-pressed', String(settings.cats.includes(c.id)));
      b.addEventListener('click', () => {
        const on = settings.cats.includes(c.id);
        if (on && settings.cats.length === 1) return; // keep at least one
        settings.cats = on ? settings.cats.filter((x) => x !== c.id) : settings.cats.concat(c.id);
        saveSettings(); renderSettings();
      });
      chips.appendChild(b);
    }
    renderSummary();
  }

  // ---------- quiz play ----------
  let quiz = null;
  let flashTimer = null;
  let autoTimer = null;

  function questionCount(poolSize) {
    return settings.count === 'all' ? poolSize : Math.max(1, parseInt(settings.count, 10) || 10);
  }

  /** Distractors: similar length, and for predict mode, preferably the same first letter. */
  function distractors(item, pool, mode) {
    const len = lettersOf(item.w).length;
    const first = lettersOf(item.w)[0];
    const seen = new Set([fold(item.w)]);
    const others = pool.filter((x) => {
      const f = fold(x.w);
      if (seen.has(f)) return false;
      seen.add(f);
      return true;
    });
    const score = (x) => {
      let s = Math.abs(lettersOf(x.w).length - len);
      if (mode === 'predict' && lettersOf(x.w)[0] !== first) s += 6;
      return s + Math.random() * 2;
    };
    return others.sort((a, b) => score(a) - score(b)).slice(0, 3);
  }

  function modePool(mode) {
    let pool = wordPool();
    if (mode === 'predict') pool = pool.filter((e) => lettersOf(runeText(e)).length >= 4);
    if (mode === 'lang') {
      const ok = (e) => LANGS[e.lang];
      pool = pool.filter(ok);
      // too few in the chosen range: use every text with a known language
      if (pool.length < 8) pool = ENTRIES.filter(ok);
    }
    return pool.length ? pool : ENTRIES.filter((e) => e.cat === 'witch');
  }

  function buildQuestions(mode, only) {
    if (LETTER_MODES.includes(mode)) {
      const pool = letterPool();
      const letters = only ? only.map((q) => q.answer) : pick(pool, questionCount(pool.length), (ch) => stats[statKey(ch)]);
      return letters.map((ch) => ({
        answer: ch,
        options: shuffle([ch].concat(sample(pool.filter((x) => x !== ch), 3)))
      }));
    }
    const pool = modePool(mode);
    const items = only ? only.map((q) => q.item) : pick(pool, questionCount(pool.length), (e) => wstats[e.key]);
    if (mode === 'lang') return items.map((item) => ({ item, answer: item.lang, options: Object.keys(LANGS) }));
    return items.map((item) => ({
      item,
      answer: item.w,
      options: shuffle([item].concat(distractors(item, pool, mode))).map((x) => x.w)
    }));
  }

  function setPlaying(on) {
    document.body.classList.toggle('playing', on);
  }

  function startQuiz(mode, only) {
    quiz = { mode, i: 0, score: 0, questions: buildQuestions(mode, only), misses: [], answered: false, typed: '' };
    $('#quizSetup').hidden = true;
    $('#quizResult').hidden = true;
    $('#quizPlay').hidden = false;
    $('#quizPlay').dataset.mode = mode;
    setPlaying(true);
    window.scrollTo(0, 0);
    renderQuestion();
  }

  function flashDuration(text) {
    if (settings.flash !== 'auto') return parseInt(settings.flash, 10);
    return Math.min(6000, 600 + 110 * lettersOf(text).length);
  }

  function stageBase() {
    // smaller runes when the screen is short, so the whole question fits without scrolling
    return window.innerHeight < 700 ? 44 : 56;
  }

  function stageMaxH() {
    return Math.max(80, Math.round(window.innerHeight * (quiz && quiz.answered ? 0.26 : 0.3)));
  }

  function showRunes(q, opts = {}) {
    const stage = $('#stage');
    stage.innerHTML = '';
    stage.appendChild(runeWord(runeText(q.item), entryScript(q.item), opts));
    fitRunes(stage, stageBase(), stageMaxH());
  }

  function runFlash(q) {
    clearTimeout(flashTimer);
    const ms = flashDuration(runeText(q.item));
    showRunes(q);
    const bar = el('span', 'countdown', '<span></span>');
    $('#stage').appendChild(bar);
    bar.firstChild.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms, easing: 'linear', fill: 'forwards' });
    $('#choices').style.visibility = 'hidden';
    flashTimer = setTimeout(() => {
      if (!quiz || quiz.answered) return;
      $('#stage').innerHTML = '<span class="veil">· · ·</span>';
      $('#choices').style.visibility = '';
      $('#replayBtn').hidden = false;
    }, ms);
  }

  // on-screen keyboard for the dictation mode (no OS keyboard)
  const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM', 'ÄÖÜß'];
  function buildKeyboard() {
    const kbd = $('#kbd');
    kbd.innerHTML = '';
    KEY_ROWS.forEach((row, r) => {
      const line = el('div', 'kbd-row');
      for (const ch of row) {
        const k = el('button', 'key', escapeHtml(ch));
        k.type = 'button';
        k.dataset.key = ch;
        line.appendChild(k);
      }
      if (r === 2) {
        const bs = el('button', 'key key-wide', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11v12H9l-6-6z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>');
        bs.type = 'button'; bs.dataset.key = 'Backspace'; bs.setAttribute('aria-label', '1文字消す');
        line.appendChild(bs);
      }
      if (r === 3) {
        const sp = el('button', 'key key-space', 'space');
        sp.type = 'button'; sp.dataset.key = ' '; sp.setAttribute('aria-label', 'スペース');
        const ok = el('button', 'key key-enter', '答える');
        ok.type = 'button'; ok.dataset.key = 'Enter';
        line.append(sp, ok);
      }
      kbd.appendChild(line);
    });
    kbd.addEventListener('click', (e) => {
      const k = e.target.closest('.key');
      if (k) typeKey(k.dataset.key);
    });
  }

  function renderTyped() {
    const d = $('#typeDisplay');
    d.textContent = quiz.typed;
    d.classList.toggle('empty', !quiz.typed);
  }

  function typeKey(key) {
    if (!quiz || quiz.mode !== 'spell' || quiz.answered) return;
    if (key === 'Backspace') quiz.typed = quiz.typed.slice(0, -1);
    else if (key === 'Enter') { if (quiz.typed.trim()) answer(quiz.typed); return; }
    else if (key === ' ') { if (quiz.typed && !quiz.typed.endsWith(' ')) quiz.typed += ' '; }
    else if (quiz.typed.length < 80) quiz.typed += key;
    renderTyped();
  }

  function renderQuestion() {
    const q = quiz.questions[quiz.i];
    const stage = $('#stage'), choices = $('#choices'), typing = $('#typing');
    clearTimeout(flashTimer);
    clearTimeout(autoTimer);
    quiz.answered = false;
    quiz.typed = '';
    $('#typing').removeAttribute('data-done');
    stage.className = 'stage';
    stage.innerHTML = '';
    choices.innerHTML = '';
    choices.style.visibility = '';
    $('#gloss').innerHTML = '';
    $('#where').textContent = '';
    $('#nextBtn').hidden = true;
    $('#replayBtn').hidden = true;
    $('#progressLabel').textContent = `${quiz.i + 1} / ${quiz.questions.length}`;
    $('#scoreLabel').textContent = `${quiz.score} 正解`;
    $('#progressBar').style.width = (quiz.i / quiz.questions.length) * 100 + '%';

    const isLetter = LETTER_MODES.includes(quiz.mode);
    choices.classList.toggle('wide', !isLetter);
    choices.classList.toggle('long', !isLetter && q.options.some((o) => String(o).length > 24));
    choices.hidden = quiz.mode === 'spell';
    typing.hidden = quiz.mode !== 'spell';

    if (quiz.mode === 'r2l') {
      $('#prompt').textContent = 'この魔女文字は？';
      stage.appendChild(runeSingle(q.answer, settings.script));
    } else if (quiz.mode === 'l2r') {
      $('#prompt').textContent = 'この文字を魔女文字で書くと？';
      stage.appendChild(el('span', 'letter-single', escapeHtml(q.answer)));
    } else {
      const s = entryScript(q.item);
      const tag = s !== 'archaic' ? `（${SCRIPTS[s].label}）` : '';
      if (quiz.mode === 'spell') {
        $('#prompt').textContent = 'アルファベットで書き取ってください' + tag;
        showRunes(q);
      } else if (quiz.mode === 'flash') {
        $('#prompt').textContent = '一瞬だけ表示されます' + tag;
        runFlash(q);
      } else if (quiz.mode === 'lang') {
        $('#prompt').textContent = '何語で書かれている？' + tag;
        runFlash(q);
      } else if (quiz.mode === 'predict') {
        const total = lettersOf(runeText(q.item)).length;
        q.reveal = q.reveal || Math.max(2, Math.ceil(total * 0.45));
        $('#prompt').textContent = '続きを予測して、全体を選んでください' + tag;
        showRunes(q, { reveal: q.reveal });
      } else {
        $('#prompt').textContent = 'なんと書いてある？' + tag;
        showRunes(q);
      }
      if (q.item.where && quiz.mode !== 'lang') $('#where').textContent = q.item.where;
    }

    if (quiz.mode === 'spell') { renderTyped(); return; }

    q.options.forEach((opt, idx) => {
      const b = el('button', 'choice');
      b.type = 'button';
      b.dataset.value = opt;
      if (quiz.mode === 'l2r') b.appendChild(runeSingle(opt, settings.script));
      else b.textContent = quiz.mode === 'lang' ? LANGS[opt] : opt;
      b.setAttribute('aria-keyshortcuts', String(idx + 1));
      b.addEventListener('click', () => answer(opt));
      choices.appendChild(b);
    });
  }

  function answer(value) {
    if (!quiz || quiz.answered) return;
    clearTimeout(flashTimer);
    quiz.answered = true;
    const q = quiz.questions[quiz.i];
    let ok;
    if (quiz.mode === 'spell') {
      const v = fold(value);
      ok = v !== '' && (v === fold(q.answer) || (q.item.shown && v === fold(q.item.shown)));
    } else {
      ok = value === q.answer;
    }
    if (ok) quiz.score += 1; else quiz.misses.push({ q, given: quiz.mode === 'lang' ? LANGS[value] : value });

    if (LETTER_MODES.includes(quiz.mode)) {
      bump(stats, statKey(q.answer), ok);
    } else {
      bump(wstats, q.item.key, ok);
      store.set('wstats', wstats);
      // reading a whole word correctly counts for each of its letters
      if (ok && quiz.mode !== 'lang' && entryScript(q.item) === settings.script) new Set(lettersOf(runeText(q.item))).forEach((ch) => bump(stats, statKey(ch), true));
    }
    store.set('stats', stats);

    const stage = $('#stage');
    stage.classList.add(ok ? 'flash-good' : 'flash-bad');
    $('#choices').style.visibility = '';
    document.querySelectorAll('.choice').forEach((b) => {
      b.disabled = true;
      if (b.dataset.value === q.answer) b.classList.add('is-correct');
      else if (b.dataset.value === value) b.classList.add('is-wrong');
      else b.classList.add('dim');
    });
    $('#replayBtn').hidden = true;
    $('#typing').toggleAttribute('data-done', quiz.mode === 'spell');

    // reveal the full text with its reading
    if (!LETTER_MODES.includes(quiz.mode)) showRunes(q, { labels: true });

    const mark = ok ? '<span class="ok">正解</span>' : '<span class="ng">残念</span>';
    let detail;
    if (LETTER_MODES.includes(quiz.mode)) detail = ok ? '' : `　正しくは「${escapeHtml(q.answer)}」`;
    else if (quiz.mode === 'lang') detail = `　${LANGS[q.answer]}：${escapeHtml(q.item.ja)}`;
    else detail = `　${escapeHtml(q.answer)} ── ${escapeHtml(q.item.ja)}`;
    if (!LETTER_MODES.includes(quiz.mode) && q.item.note) detail += `<br><small>${escapeHtml(q.item.note)}</small>`;
    if (quiz.mode === 'spell' && !ok) detail = `　あなたの答え：${escapeHtml(upper(value))}<br>正解：${escapeHtml(q.answer)} ── ${escapeHtml(q.item.ja)}`;
    $('#gloss').innerHTML = mark + detail;
    if (!LETTER_MODES.includes(quiz.mode) && speakable(q.item)) {
      const isName = q.item.lang === 'de-name';
      $('#gloss').appendChild(speakBtn(q.item.w, isName));
      if (settings.speak) speak(q.item.w, isName);
    }
    $('#scoreLabel').textContent = `${quiz.score} 正解`;
    $('#progressBar').style.width = ((quiz.i + 1) / quiz.questions.length) * 100 + '%';

    const next = $('#nextBtn');
    next.textContent = quiz.i + 1 < quiz.questions.length ? '次へ' : '結果を見る';
    next.hidden = false;
    next.focus({ preventScroll: true });
    if (ok && settings.auto) autoTimer = setTimeout(nextQuestion, 1100);
  }

  function nextQuestion() {
    if (!quiz || !quiz.answered) return;
    clearTimeout(autoTimer);
    quiz.i += 1;
    if (quiz.i < quiz.questions.length) renderQuestion();
    else showResult();
  }

  function rankTitle(score, total) {
    const r = score / total;
    if (r === 1) return '魔女文字の達人。結界の落書きも、もう読めるはず。';
    if (r >= .8) return '一人前の魔法少女。あと少しで完璧です。';
    if (r >= .5) return '見習い魔法少女。だいぶ目が慣れてきました。';
    if (r >= .2) return '契約前の少女。一覧を眺めてから再挑戦しましょう。';
    return 'まだ始まったばかり。まずは文字一覧から。';
  }

  function showResult() {
    setPlaying(false);
    $('#quizPlay').hidden = true;
    $('#quizResult').hidden = false;
    window.scrollTo(0, 0);
    $('#resultScore').textContent = quiz.score;
    $('#resultTotal').textContent = ' / ' + quiz.questions.length;
    $('#resultTitle').textContent = rankTitle(quiz.score, quiz.questions.length);
    $('#retryMissBtn').hidden = !quiz.misses.length;
    const review = $('#review');
    review.innerHTML = '';
    if (!quiz.misses.length) {
      review.appendChild(el('p', 'review-empty', '全問正解です。'));
      return;
    }
    review.appendChild(el('p', 'review-empty', '間違えた問題'));
    const isLetter = LETTER_MODES.includes(quiz.mode);
    for (const m of quiz.misses) {
      const row = el('div', 'review-item');
      row.appendChild(isLetter ? runeWord(m.q.answer, settings.script) : runeWord(runeText(m.q.item), entryScript(m.q.item)));
      const given = m.given ? `あなたの答え：${escapeHtml(upper(m.given))}<br>` : '';
      let body;
      if (isLetter) body = `正解：<b>${escapeHtml(m.q.answer)}</b>`;
      else if (quiz.mode === 'lang') body = `正解：<b>${LANGS[m.q.answer]}</b><br>${escapeHtml(m.q.item.w)}　${escapeHtml(m.q.item.ja)}`;
      else body = `正解：<b>${escapeHtml(m.q.answer)}</b><br>${escapeHtml(m.q.item.ja)}`;
      const ans = el('span', 'ans', given + body);
      if (!isLetter && speakable(m.q.item)) ans.appendChild(speakBtn(m.q.item.w, m.q.item.lang === 'de-name'));
      row.appendChild(ans);
      review.appendChild(row);
    }
  }

  function backToSetup() {
    clearTimeout(flashTimer);
    clearTimeout(autoTimer);
    quiz = null;
    setPlaying(false);
    $('#quizPlay').hidden = true;
    $('#quizResult').hidden = true;
    $('#quizSetup').hidden = false;
  }

  buildKeyboard();
  $('#nextBtn').addEventListener('click', nextQuestion);
  $('#replayBtn').addEventListener('click', () => { if (quiz && !quiz.answered) runFlash(quiz.questions[quiz.i]); $('#replayBtn').hidden = true; });
  $('#quitBtn').addEventListener('click', backToSetup);
  $('#backBtn').addEventListener('click', backToSetup);
  $('#againBtn').addEventListener('click', () => startQuiz(quiz.mode));
  $('#retryMissBtn').addEventListener('click', () => startQuiz(quiz.mode, quiz.misses.map((m) => m.q)));
  // tapping the stage after answering also advances (thumb-friendly)
  $('#stage').addEventListener('click', () => { if (quiz && quiz.answered) nextQuestion(); });

  document.addEventListener('keydown', (e) => {
    if (!quiz || $('#quizPlay').hidden || currentView !== 'quiz') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (quiz.mode === 'spell' && !quiz.answered) {
      const k = e.key.length === 1 ? upper(e.key) : e.key;
      if (/^[A-ZÄÖÜß ]$/.test(k) || k === 'Backspace' || k === 'Enter') { e.preventDefault(); typeKey(k); }
      return;
    }
    if (!quiz.answered && /^[1-4]$/.test(e.key)) {
      const b = document.querySelectorAll('.choice')[+e.key - 1];
      if (b && $('#choices').style.visibility !== 'hidden') b.click();
    } else if (quiz.answered && e.key === 'Enter' && document.activeElement !== $('#nextBtn')) {
      e.preventDefault(); nextQuestion();
    }
  });

  // ---------- letters ----------
  function letterCard(ch, g, label) {
    const card = el('button', 'card' + (g && g.fallback ? ' fallback' : '') + (g ? '' : ' missing'));
    card.type = 'button';
    card.appendChild(el('span', 'glyph', g ? g.svg : ''));
    card.appendChild(el('span', 'lat', escapeHtml(label || ch)));
    card.setAttribute('aria-label', label || ch);
    if (g) card.addEventListener('click', () => openGlyph(ch));
    return card;
  }

  function renderLetters() {
    const grid = $('#alphaGrid');
    grid.innerHTML = '';
    for (const ch of BASE.concat(EXTRA)) {
      const card = letterCard(ch, glyph(ch, settings.script));
      const acc = accuracy(ch);
      if (acc != null) {
        const m = el('span', 'meter');
        m.appendChild(el('span')).style.width = Math.round(acc * 100) + '%';
        card.appendChild(m);
      }
      grid.appendChild(card);
    }
    const dg = $('#digitGrid');
    dg.innerHTML = '';
    for (const d of '0123456789%') dg.appendChild(letterCard(d, glyph(d, settings.script)));
    applyHide();
  }

  const hideLatin = $('#hideLatin');
  hideLatin.checked = store.get('hideLatin', false);
  const applyHide = () => document.querySelectorAll('.grid').forEach((g) => g.classList.toggle('hide-latin', hideLatin.checked));
  hideLatin.addEventListener('change', () => { store.set('hideLatin', hideLatin.checked); applyHide(); });

  const dlg = $('#glyphDialog');
  function openGlyph(ch) {
    const g = glyph(ch, settings.script);
    $('#dlgRune').innerHTML = g.svg;
    $('#dlgLetter').textContent = ch;
    const s = stats[statKey(ch)];
    let note = s && s.a ? `正答率 ${Math.round((s.c / s.a) * 100)}%（${s.c} / ${s.a}）` : 'まだ出題されていません';
    if (g.fallback) note += '　※Archaic 体で代用';
    $('#dlgStat').textContent = /[0-9%]/.test(ch) ? '数字・記号' : note;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  // ---------- library ----------
  let libCat = store.get('libCat', 'all');
  const libOpen = new Set(store.get('libOpen', []));
  const libSearch = $('#libSearch');
  const libHide = $('#libHide');
  libHide.checked = store.get('libHide', false);

  function renderLibCats() {
    const box = $('#libCats');
    box.innerHTML = '';
    const opts = [{ id: 'all', label: 'すべて' }].concat(CORPUS);
    for (const c of opts) {
      const b = el('button', 'chip', escapeHtml(c.label) + (c.spoiler ? '<span class="spoiler">ネタバレ</span>' : ''));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(libCat === c.id));
      b.addEventListener('click', () => { libCat = c.id; store.set('libCat', libCat); renderLibrary(); });
      box.appendChild(b);
    }
  }

  function renderLibrary() {
    renderLibCats();
    const q = libSearch.value.trim().toLowerCase();
    const list = $('#libList');
    list.innerHTML = '';
    list.classList.toggle('lib-hide', libHide.checked);
    let shown = 0;
    for (const cat of CORPUS) {
      if (libCat !== 'all' && libCat !== cat.id) continue;
      const items = ENTRIES.filter((e) => e.cat === cat.id && (!q || [e.w, e.shown, e.ja, e.where, e.note].some((v) => v && v.toLowerCase().includes(q))));
      if (!items.length) continue;
      shown += items.length;
      const group = el('details', 'lib-group');
      group.open = !!q || libOpen.has(cat.id) || libCat === cat.id;
      group.addEventListener('toggle', () => {
        if (q) return;
        if (group.open) libOpen.add(cat.id); else libOpen.delete(cat.id);
        store.set('libOpen', [...libOpen]);
        if (group.open) group.querySelectorAll('.lib-item').forEach((n) => fitRunes(n, 34));
      });
      group.appendChild(el('summary', null, `<h2>${escapeHtml(cat.label)}${cat.spoiler ? '<span class="spoiler">ネタバレ</span>' : ''} <small>${items.length}</small></h2>`));
      const src = (cat.sources || []).map((s) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a>`).join('・');
      group.appendChild(el('p', 'desc', escapeHtml(cat.desc) + (src ? `<br>出典：${src}` : '')));
      const box = el('div', 'lib-items');
      for (const e of items) {
        const item = el('div', 'lib-item');
        const script = entryScript(e);
        item.appendChild(runeWord(runeText(e), script));
        const meta = el('div', 'meta');
        const lat = el('span', 'lat', escapeHtml(e.w));
        if (speakable(e)) lat.appendChild(speakBtn(e.w, e.lang === 'de-name'));
        meta.appendChild(lat);
        meta.appendChild(el('span', 'ja', escapeHtml(e.ja)));
        const sub = [];
        if (e.where) sub.push(escapeHtml(e.where));
        if (script !== 'archaic' || e.script) sub.push(`<span class="badge">${SCRIPTS[script].label}</span>`);
        if (e.lang && e.lang !== 'name' && e.lang !== 'de-name') sub.push(`<span class="badge lang">${LANG_BADGE[e.lang]}</span>`);
        if (e.shown) sub.push(`作中表記：${escapeHtml(e.shown)}`);
        if (e.note) sub.push(escapeHtml(e.note));
        const s = wstats[e.key];
        if (s && s.a) sub.push(`正答 ${s.c}/${s.a}`);
        if (sub.length) meta.appendChild(el('span', 'sub', sub.join('<span aria-hidden="true">·</span>')));
        item.appendChild(meta);
        item.addEventListener('click', () => { if (libHide.checked) item.classList.toggle('open'); });
        box.appendChild(item);
      }
      group.appendChild(box);
      list.appendChild(group);
    }
    $('#libCount').textContent = `${shown} 件` + (libHide.checked ? '　タップで読みを表示します。' : '');
    if (!shown) list.appendChild(el('p', 'lib-empty', '見つかりませんでした'));
    // size each rune line after layout
    list.querySelectorAll('details[open] .lib-item').forEach((n) => fitRunes(n, 34));
  }
  libSearch.addEventListener('input', renderLibrary);
  // shares the quiz setting: draw scene texts in their on-screen script
  const libOriginal = $('#libOriginal');
  libOriginal.checked = settings.original;
  libOriginal.addEventListener('change', () => {
    settings.original = libOriginal.checked;
    $('#optOriginal').checked = settings.original;
    saveSettings();
    renderLibrary();
  });
  libHide.addEventListener('change', () => { store.set('libHide', libHide.checked); renderLibrary(); });

  // ---------- convert ----------
  const convInput = $('#convInput');
  const convLabels = $('#convLabels');
  convInput.value = store.get('convText', convInput.value);
  convLabels.checked = store.get('convLabels', true);
  function renderConvert() {
    const out = $('#convOut');
    out.innerHTML = '';
    const text = convInput.value.trim();
    if (!text) { out.appendChild(el('span', 'hint', 'ここに魔女文字が表示されます')); return; }
    out.appendChild(runeWord(text, settings.script, { labels: convLabels.checked }));
    fitRunes(out, 52);
  }
  convInput.addEventListener('input', () => { store.set('convText', convInput.value); renderConvert(); });
  convLabels.addEventListener('change', () => { store.set('convLabels', convLabels.checked); renderConvert(); });

  // ---------- about ----------
  function renderSources() {
    const ul = $('#sourceList');
    const seen = new Set();
    for (const c of CORPUS) {
      for (const s of c.sources || []) {
        if (seen.has(s.url)) continue;
        seen.add(s.url);
        ul.appendChild(el('li', null, `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a>`));
      }
    }
  }
  $('#resetStats').addEventListener('click', () => {
    if (!confirm('正答率の記録をすべて消します。よろしいですか？')) return;
    stats = {}; wstats = {};
    store.set('stats', stats); store.set('wstats', wstats);
  });

  // ---------- zukan (long reading) ----------
  const zk = Object.assign({ witch: ZUKAN[0] && ZUKAN[0].id, lang: 'ro', trans: 'line' }, store.get('zukan', {}));
  function renderZukanSetup() {
    const sel = $('#zkWitch');
    sel.innerHTML = '';
    for (const w of ZUKAN) {
      const o = el('option', null, `${escapeHtml(w.title.ja)}（${escapeHtml(w.name)}）`);
      o.value = w.id;
      sel.appendChild(o);
    }
    const bindZ = (id, key) => {
      const n = $(id);
      n.value = zk[key];
      n.onchange = () => { zk[key] = n.value; store.set('zukan', zk); };
    };
    bindZ('#zkWitch', 'witch');
    bindZ('#zkLang', 'lang');
    bindZ('#zkTrans', 'trans');
  }

  function renderZukanPage() {
    const w = ZUKAN.find((x) => x.id === zk.witch) || ZUKAN[0];
    const card = $('#zkCard');
    card.innerHTML = '';
    const head = el('header', 'zk-head');
    const title = el('div', 'zk-title');
    title.appendChild(runeWord(w.title[zk.lang], settings.script));
    const name = el('div', 'zk-name');
    name.appendChild(runeWord(w.name, settings.script));
    head.append(title, name);
    if (zk.trans === 'line') head.appendChild(el('p', 'zk-ja', `${escapeHtml(w.title.ja)}　${escapeHtml(w.name)}`));
    card.appendChild(head);
    const body = el('div', 'zk-body');
    for (const line of w.lines) {
      const row = el('div', 'zk-line');
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', 'タップで読みを表示');
      const runes = el('div', 'zk-runes');
      runes.appendChild(runeWord(line[zk.lang], settings.script));
      row.appendChild(runes);
      row.appendChild(el('p', 'zk-read', escapeHtml(line[zk.lang])));
      if (zk.trans === 'line') row.appendChild(el('p', 'zk-ja', escapeHtml(line.ja)));
      const toggle = () => row.classList.toggle('open');
      row.addEventListener('click', toggle);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      body.appendChild(row);
    }
    card.appendChild(body);
    const small = window.innerWidth < 520;
    requestAnimationFrame(() => {
      card.querySelectorAll('.zk-title').forEach((n) => fitRunes(n, small ? 26 : 30));
      card.querySelectorAll('.zk-name').forEach((n) => fitRunes(n, small ? 32 : 38));
      card.querySelectorAll('.zk-runes').forEach((n) => fitRunes(n, small ? 22 : 26));
    });
    card.appendChild(el('p', 'zk-src', `公式サイトの<a href="${escapeHtml(w.card)}" target="_blank" rel="noopener">魔女図鑑</a>をもとに本アプリで書き起こした紹介文です。`));
    $('#zkRevealAll').textContent = '読みをすべて表示';
  }
  $('#zkOpen').addEventListener('click', () => {
    $('#zukanSetup').hidden = true;
    $('#zukanPage').hidden = false;
    renderZukanPage();
    window.scrollTo(0, 0);
  });
  $('#zkBack').addEventListener('click', () => { $('#zukanPage').hidden = true; $('#zukanSetup').hidden = false; });
  $('#zkRevealAll').addEventListener('click', () => {
    const rows = document.querySelectorAll('.zk-line');
    const open = ![...rows].every((r) => r.classList.contains('open'));
    rows.forEach((r) => r.classList.toggle('open', open));
    $('#zkRevealAll').textContent = open ? '読みをすべて隠す' : '読みをすべて表示';
  });

  // ---------- install (PWA) ----------
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    $('#installBtn').hidden = false;
  });
  $('#installBtn').addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => {});
    installPrompt = null;
    $('#installBtn').hidden = true;
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  window.addEventListener('resize', () => {
    if (!$('#quizPlay').hidden) fitRunes($('#stage'), stageBase(), stageMaxH());
    if (currentView === 'convert') fitRunes($('#convOut'), 52);
    if (currentView === 'library') document.querySelectorAll('.lib-item').forEach((n) => fitRunes(n, 34));
  });

  // ---------- boot ----------
  $('#brandMark').innerHTML = RUNES.archaic.M;
  renderSegs();
  renderModes();
  renderSettings();
  renderSources();
  renderZukanSetup();
  const lastView = store.get('view', 'quiz');
  showView(VIEWS.includes(lastView) ? lastView : 'quiz');
})();
