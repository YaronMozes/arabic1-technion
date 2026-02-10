import { getParam, loadEntriesNdjson, loadJson, shuffle } from "./data.js";

function byId(id){ return document.getElementById(id); }

function renderLessonCards(){
  const grid = byId("lessons-grid");
  if(!grid) return;
  for(let i=1;i<=13;i++){
    const l = String(i).padStart(2,"0");
    const a = document.createElement("a");
    a.className = "card lesson-card";
    a.href = `lesson.html?l=${l}`;
    a.innerHTML = `<h3>שיעור ${i}</h3>`;
    grid.appendChild(a);
  }

  const extra = document.createElement("a");
  extra.className = "card lesson-card";
  extra.href = "lesson.html?l=14";
  extra.innerHTML = "<h3>העשרה</h3>";
  grid.appendChild(extra);
}

async function loadLessonSet(l){
  const lesson = await loadJson(`data/lessons/${l}.json`);
  const entries = await loadEntriesNdjson("data/entries.ndjson");
  const map = new Map(entries.map(e => [e.id, e]));
  const items = (lesson.items || []).map(id => map.get(id)).filter(Boolean);
  return { lesson, entries, items };
}

function fmtHe(he){
  if(Array.isArray(he)) return he.join(" / ");
  return he ?? "";
}

function fmtTr(entry){
  const tr = entry.translit || entry.tr || {};
  const he = tr.he || tr.hebrew || "";
  return he || "—";
}

function entryArabic(entry){
  const ar = entry.ar || {};
  return ar.vocalized || ar.v || ar.plain || ar.p || "";
}

function storageKey(prefix, scope){ return `a1:${prefix}:${scope}`; }

function normalizeLessonValue(raw){
  const n = parseInt(String(raw ?? ""), 10);
  if(Number.isNaN(n)) return String(raw ?? "");
  return (n >= 1 && n <= 13) ? String(n).padStart(2, "0") : String(n);
}

function lessonLabelByValue(value){
  const n = parseInt(value, 10);
  return n === 14 ? "העשרה" : `שיעור ${n}`;
}

function setupSideToolbar(currentLesson, context = "game", mode = "quiz"){
  const homeBtn = byId("btn-side-home");
  if(homeBtn) homeBtn.href = "index.html";

  const select = byId("game-lesson-select");
  if(!select) return;

  const rows = [];
  for(let i=1;i<=13;i++){
    rows.push({ value: String(i).padStart(2, "0"), label: lessonLabelByValue(String(i)) });
  }
  rows.push({ value: "14", label: "העשרה" });

  select.innerHTML = rows.map((row) => `<option value="${row.value}">${row.label}</option>`).join("");
  const normalizedCurrent = normalizeLessonValue(currentLesson);
  select.value = rows.some((row) => row.value === normalizedCurrent) ? normalizedCurrent : rows[0].value;

  const safeMode = mode === "match" ? "match" : "quiz";
  select.addEventListener("change", () => {
    const chosen = select.value;
    if(context === "lesson"){
      window.location.href = `lesson.html?l=${encodeURIComponent(chosen)}`;
      return;
    }
    window.location.href = `game.html?l=${encodeURIComponent(chosen)}&mode=${encodeURIComponent(safeMode)}`;
  });
}

async function initLessonPage(){
  const l = getParam("l");
  if(!l) return;
  const { lesson, items } = await loadLessonSet(l);
  const lessonTitle = lesson?.title || `שיעור ${parseInt(l,10)}`;
  byId("lesson-title").textContent = lessonTitle;

  const topNav = document.querySelector(".game-header .game-nav") || document.querySelector(".header .row");
  if(topNav){
    const legacyTopHomeBtn = topNav.querySelector('a[href="index.html"]');
    if(legacyTopHomeBtn){
      legacyTopHomeBtn.remove();
    }
    if(!byId("btn-lesson-vocab")){
      const a = document.createElement("a");
      a.className = "btn";
      a.id = "btn-lesson-vocab";
      a.href = "#";
      a.textContent = "אוצר מילים";
      topNav.insertBefore(a, topNav.firstChild);
    }
  }

  if(items.length === 0){
    byId("lesson-empty").style.display = "block";
    byId("lesson-table-wrap").style.display = "none";
  }else{
    byId("lesson-empty").style.display = "none";
    byId("lesson-table-wrap").style.display = "block";
  }

  const words = byId("lesson-words");
  words.innerHTML = "";
  for(const e of items){
    const card = document.createElement("article");
    card.className = "card lesson-word-card";
    card.innerHTML = `
      <div class="lesson-word-he rtl">${fmtHe(e.he)}</div>
      <div class="lesson-word-ar rtl ar">${entryArabic(e)}</div>
      <div class="lesson-word-tr rtl muted">${fmtTr(e)}</div>
    `;
    words.appendChild(card);
  }

  const vocabBtn = byId("btn-lesson-vocab");
  if(vocabBtn){
    vocabBtn.href = `lesson.html?l=${l}`;
    vocabBtn.classList.add("primary");
  }
  byId("btn-quiz").href = `game.html?l=${l}`;
  byId("btn-match").href = `game.html?l=${l}&mode=match`;
  setupSideToolbar(l, "lesson");
}

async function initGamePage(){
  const l = getParam("l");
  const mode = getParam("mode") || "quiz";
  if(!l) return;

  const { lesson, items } = await loadLessonSet(l);
  const lessonTitle = lesson?.title || `שיעור ${parseInt(l,10)}`;
  byId("game-title").textContent = lessonTitle;

  const quizBtn = byId("btn-game-quiz");
  const matchBtn = byId("btn-game-match");
  const vocabBtn = byId("btn-game-vocab");
  if(quizBtn && matchBtn){
    if(vocabBtn){
      vocabBtn.href = `lesson.html?l=${l}`;
    }
    quizBtn.href = `game.html?l=${l}&mode=quiz`;
    matchBtn.href = `game.html?l=${l}&mode=match`;
    quizBtn.classList.toggle("primary", mode !== "match");
    matchBtn.classList.toggle("primary", mode === "match");
  }

  setupSideToolbar(l, "game", mode);

  if(items.length === 0){
    byId("game-wrap").innerHTML = `<div class="notice">אין עדיין מילים זמינות בשיעור הזה.</div>`;
    return;
  }

  if(mode === "match"){
    runMatch({ items });
  }else{
    runQuiz({ items, scope: l });
  }
}

function runQuiz({ items, scope }){
  const wrap = byId("game-wrap");
  const pool = [...new Map(items.map((entry) => [entry.id, entry])).values()];
  const autoKey = "a1:auto-next";
  const state = {
    streak: 0,
    total: 0,
    current: null,
    locked: false,
    deck: [],
    lastPromptId: null,
    lastResult: null,
    autoAdvance: localStorage.getItem(autoKey) !== "0"
  };
  let autoTimer = null;

  wrap.innerHTML = "";

  const card = document.createElement("div");
  card.className = "card quiz-card";
  card.innerHTML = `
    <div class="quiz-top quiz-top-quiz">
      <span class="quiz-edge-stat" id="quiz-total">שאלה: 0</span>
      <span class="quiz-edge-stat" id="quiz-streak">רצף: 0</span>
    </div>
    <div class="quiz-card-head">
      <div id="prompt" class="quiz-prompt"></div>
    </div>
    <div id="choices" class="choicegrid quiz-choicegrid"></div>
    <div id="feedback" class="quiz-feedback muted"></div>
    <div class="quiz-next-row">
      <button class="btn primary" id="nextq" type="button" disabled>שאלה הבאה</button>
    </div>
    <div class="quiz-auto-row">
      <label class="quiz-auto-toggle" for="quiz-auto-next">
        <input id="quiz-auto-next" type="checkbox" />
        <span>בטל מעבר אוטומטי לשאלה הבאה לאחר תשובה נכונה</span>
      </label>
    </div>
    <div class="quiz-keyboard">
      <span class="muted">מקלדת:</span>
      <span class="kbd">1</span>
      <span class="kbd">2</span>
      <span class="kbd">3</span>
      <span class="kbd">4</span>
      <span class="muted">לבחירה</span>
      <span class="kbd">Enter/Space</span>
      <span class="muted">לשאלה הבאה</span>
    </div>
  `;

  wrap.appendChild(card);

  const streakEl = byId("quiz-streak");
  const totalEl = byId("quiz-total");
  const promptEl = byId("prompt");
  const choicesEl = byId("choices");
  const feedbackEl = byId("feedback");
  const nextBtn = byId("nextq");
  const autoToggleEl = byId("quiz-auto-next");

  if(autoToggleEl){
    autoToggleEl.checked = !state.autoAdvance;
  }

  function refillDeck(){
    state.deck = shuffle(pool);
    if(state.lastPromptId && state.deck.length > 1 && state.deck[0].id === state.lastPromptId){
      const swapIdx = 1 + Math.floor(Math.random() * (state.deck.length - 1));
      [state.deck[0], state.deck[swapIdx]] = [state.deck[swapIdx], state.deck[0]];
    }
  }

  function nextAnswer(){
    if(state.deck.length === 0){
      refillDeck();
    }
    const answer = state.deck.pop();
    state.lastPromptId = answer ? answer.id : null;
    return answer;
  }

  function updateScore(){
    streakEl.textContent = `רצף: ${state.streak}`;
    totalEl.textContent = `שאלה: ${state.total}`;
  }

  function setFeedback(message, type = "muted"){
    feedbackEl.textContent = message;
    feedbackEl.className = `quiz-feedback ${type}`;
  }

  function clearAutoTimer(){
    if(!autoTimer) return;
    window.clearTimeout(autoTimer);
    autoTimer = null;
  }

  function queueAutoAdvance(){
    clearAutoTimer();
    if(!state.autoAdvance || nextBtn.disabled || state.lastResult !== "correct") return;
    autoTimer = window.setTimeout(() => {
      autoTimer = null;
      if(!nextBtn.disabled){
        nextBtn.click();
      }
    }, 1000);
  }

  function translitText(entry){
    const tr = fmtTr(entry);
    return tr === "—" ? "" : tr;
  }

  function renderPrompt(answer, direction){
    if(direction === "ar_to_he"){
      const tr = translitText(answer);
      promptEl.innerHTML = `
        <span class="quiz-prompt-main quiz-prompt-main-ar rtl ar">${entryArabic(answer)}</span>
        ${tr ? `<span class="quiz-prompt-sub rtl">${tr}</span>` : ""}
      `;
      return;
    }

    promptEl.innerHTML = `<span class="quiz-prompt-main rtl">${fmtHe(answer.he)}</span>`;
  }

  function renderOption(entry, direction, index){
    if(direction === "ar_to_he"){
      return `
        <span class="choice-index ltr">${index + 1}</span>
        <span class="choice-text">${fmtHe(entry.he)}</span>
      `;
    }

    const tr = translitText(entry);
    return `
      <span class="choice-index ltr">${index + 1}</span>
      <span class="choice-stack">
        <span class="choice-text choice-ar rtl ar">${entryArabic(entry)}</span>
        ${tr ? `<span class="choice-sub rtl">${tr}</span>` : ""}
      </span>
    `;
  }

  function formatCorrectAnswer(answer, direction){
    if(direction === "ar_to_he"){
      return fmtHe(answer.he);
    }
    const tr = translitText(answer);
    return tr ? `${entryArabic(answer)} (${tr})` : entryArabic(answer);
  }

  function makeQuestion(){
    clearAutoTimer();
    state.locked = false;
    state.lastResult = null;
    state.total += 1;

    const answer = nextAnswer();
    const distractors = shuffle(pool.filter(x => x.id !== answer.id)).slice(0,3);
    const options = shuffle([answer, ...distractors]);
    const direction = Math.random() < 0.5 ? "ar_to_he" : "he_to_ar";
    state.current = { answer, options, direction };

    renderPrompt(answer, direction);
    choicesEl.innerHTML = "";
    options.forEach((opt, index) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "choice quiz-choice rtl";
      b.dataset.id = opt.id;
      b.innerHTML = renderOption(opt, direction, index);
      b.addEventListener("click", () => onPick(b, opt));
      choicesEl.appendChild(b);
    });

    nextBtn.disabled = true;
    setFeedback("");
    updateScore();
  }

  function onPick(el, picked){
    if(state.locked) return;
    state.locked = true;

    const { answer, direction } = state.current;
    const correct = picked.id === answer.id;
    const choiceButtons = [...choicesEl.querySelectorAll(".choice")];
    choiceButtons.forEach(btn => { btn.disabled = true; });

    if(correct){
      state.lastResult = "correct";
      state.streak += 1;
      el.classList.add("correct");
      setFeedback("נכון!", "good");
    }else{
      state.lastResult = "wrong";
      state.streak = 0;
      el.classList.add("wrong");
      const answerButton = choiceButtons.find(btn => btn.dataset.id === answer.id);
      if(answerButton) answerButton.classList.add("correct");
      setFeedback(`לא נכון. התשובה הנכונה: ${formatCorrectAnswer(answer, direction)}`, "bad");

      const missKey = storageKey("missed", scope);
      const prev = new Set(JSON.parse(localStorage.getItem(missKey) || "[]"));
      prev.add(answer.id);
      localStorage.setItem(missKey, JSON.stringify([...prev]));
    }

    nextBtn.disabled = false;
    updateScore();
    queueAutoAdvance();
  }

  function onKeyDown(e){
    const key = e.key;
    if(/^[1-4]$/.test(key) && !state.locked){
      const idx = Number(key) - 1;
      const btn = choicesEl.querySelectorAll(".choice")[idx];
      if(btn){
        e.preventDefault();
        btn.click();
      }
      return;
    }

    const activeTag = document.activeElement?.tagName;
    const isFormField = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";
    const isNextKey = key === "Enter" || key === " " || key === "Spacebar";
    if(isNextKey && !nextBtn.disabled && !isFormField){
      e.preventDefault();
      nextBtn.click();
    }
  }

  nextBtn.addEventListener("click", () => {
    clearAutoTimer();
    makeQuestion();
  });
  if(autoToggleEl){
    autoToggleEl.addEventListener("change", () => {
      state.autoAdvance = !autoToggleEl.checked;
      localStorage.setItem(autoKey, state.autoAdvance ? "1" : "0");
      if(state.autoAdvance){
        queueAutoAdvance();
      }else{
        clearAutoTimer();
      }
    });
  }
  window.addEventListener("keydown", onKeyDown);
  makeQuestion();
}

function runMatch({ items }){
  const wrap = byId("game-wrap");
  wrap.innerHTML = "";

  const state = {
    pairs: [],
    matched: 0,
    attempts: 0,
    leftSelected: null,
    rightSelected: null
  };

  const card = document.createElement("div");
  card.className = "card match-card";
  card.innerHTML = `
    <div class="match-top match-top-strip">
      <span class="match-edge-stat" id="match-attempts">ניסיונות: 0</span>
      <span class="match-edge-stat" id="match-progress">התאמות: 0 / 0</span>
    </div>
    <div class="match-grid">
      <section class="match-col">
        <h3 class="match-col-title">עברית</h3>
        <div id="match-right" class="match-list"></div>
      </section>
      <section class="match-col">
        <h3 class="match-col-title">ערבית + תעתיק</h3>
        <div id="match-left" class="match-list"></div>
      </section>
    </div>
    <div id="match-feedback" class="quiz-feedback muted"></div>
    <div class="match-next-row">
      <button class="btn primary" id="new-round" type="button">סבב חדש</button>
    </div>
  `;

  wrap.appendChild(card);

  const progressEl = byId("match-progress");
  const attemptsEl = byId("match-attempts");
  const leftEl = byId("match-left");
  const rightEl = byId("match-right");
  const feedbackEl = byId("match-feedback");

  function setFeedback(message, type = "muted"){
    feedbackEl.textContent = message;
    feedbackEl.className = `quiz-feedback ${type}`;
  }

  function updateStats(){
    const total = state.pairs.length;
    progressEl.textContent = `התאמות: ${state.matched} / ${total}`;
    attemptsEl.textContent = `ניסיונות: ${state.attempts}`;
  }

  function clearSelection(side){
    const key = side === "left" ? "leftSelected" : "rightSelected";
    const selected = state[key];
    if(!selected) return;
    selected.el.classList.remove("selected");
    state[key] = null;
  }

  function markPairAsMatched(pairId){
    const leftBtn = leftEl.querySelector(`.match-item[data-id="${pairId}"]`);
    const rightBtn = rightEl.querySelector(`.match-item[data-id="${pairId}"]`);
    if(leftBtn){
      leftBtn.classList.remove("selected");
      leftBtn.classList.add("matched");
      leftBtn.disabled = true;
    }
    if(rightBtn){
      rightBtn.classList.remove("selected");
      rightBtn.classList.add("matched");
      rightBtn.disabled = true;
    }
  }

  function checkMatch(){
    if(!state.leftSelected || !state.rightSelected) return;

    state.attempts += 1;
    const leftId = state.leftSelected.id;
    const rightId = state.rightSelected.id;
    if(leftId === rightId){
      state.matched += 1;
      markPairAsMatched(leftId);
      clearSelection("left");
      clearSelection("right");
      if(state.matched === state.pairs.length){
        setFeedback("מעולה! סיימתם את כל ההתאמות.", "good");
      }else{
        setFeedback("יפה! התאמה נכונה.", "good");
      }
    }else{
      const leftBtn = state.leftSelected.el;
      const rightBtn = state.rightSelected.el;
      leftBtn.classList.add("wrong");
      rightBtn.classList.add("wrong");
      setFeedback("לא מתאים. נסו שוב.", "bad");
      window.setTimeout(() => {
        leftBtn.classList.remove("wrong");
        rightBtn.classList.remove("wrong");
      }, 420);
      clearSelection("left");
      clearSelection("right");
    }
    updateStats();
  }

  function onPick(side, el, id){
    if(el.disabled || el.classList.contains("matched")) return;
    const key = side === "left" ? "leftSelected" : "rightSelected";
    const current = state[key];

    if(current && current.el === el){
      clearSelection(side);
      return;
    }

    clearSelection(side);
    state[key] = { id, el };
    el.classList.add("selected");
    checkMatch();
  }

  function renderColumn(container, rows, side){
    container.innerHTML = "";
    rows.forEach((row) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = side === "left" ? "match-item match-item-ar" : "match-item match-item-he rtl";
      b.dataset.id = row.id;
      if(side === "left"){
        b.innerHTML = `
          <span class="match-item-ar-main rtl">${row.ar}</span>
          <span class="match-item-ar-tr rtl">${row.tr}</span>
        `;
      }else{
        b.textContent = row.he;
      }
      b.addEventListener("click", () => onPick(side, b, row.id));
      container.appendChild(b);
    });
  }

  function startRound(){
    const chosen = shuffle(items);
    state.pairs = chosen.map((e) => ({
      id: e.id,
      ar: entryArabic(e),
      he: fmtHe(e.he),
      tr: fmtTr(e)
    }));
    state.matched = 0;
    state.attempts = 0;
    state.leftSelected = null;
    state.rightSelected = null;

    const leftRows = shuffle(state.pairs.map((p) => ({ id: p.id, ar: p.ar, tr: p.tr })));
    const rightRows = shuffle(state.pairs.map((p) => ({ id: p.id, he: p.he })));
    renderColumn(leftEl, leftRows, "left");
    renderColumn(rightEl, rightRows, "right");
    setFeedback("");
    updateStats();
  }

  byId("new-round").addEventListener("click", startRound);
  startRound();
}

async function initTestPage(){
  const form = byId("test-form");
  if(!form) return;

  const box = byId("lesson-checks");
  for(let i=1;i<=13;i++){
    const l = String(i).padStart(2,"0");
    const label = document.createElement("label");
    label.style.display = "inline-flex";
    label.style.alignItems = "center";
    label.style.gap = "8px";
    label.style.margin = "6px 12px 6px 0";
    label.innerHTML = `<input type="checkbox" name="lesson" value="${l}" checked /> שיעור ${i}`;
    box.appendChild(label);
  }

  const extraLabel = document.createElement("label");
  extraLabel.style.display = "inline-flex";
  extraLabel.style.alignItems = "center";
  extraLabel.style.gap = "8px";
  extraLabel.style.margin = "6px 12px 6px 0";
  extraLabel.innerHTML = `<input type="checkbox" name="lesson" value="14" checked /> העשרה`;
  box.appendChild(extraLabel);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const chosen = [...form.querySelectorAll('input[name="lesson"]:checked')].map(x => x.value);
    if(chosen.length === 0){
      alert("בחרו לפחות שיעור אחד.");
      return;
    }

    const entries = await loadEntriesNdjson("data/entries.ndjson");
    const map = new Map(entries.map(e => [e.id, e]));

    const allItems = [];
    for(const l of chosen){
      const lesson = await loadJson(`data/lessons/${l}.json`);
      for(const id of (lesson.items || [])){
        const ent = map.get(id);
        if(ent) allItems.push(ent);
      }
    }

    if(allItems.length === 0){
      alert("השיעורים שבחרתם עדיין ללא מילים זמינות. נסו לבחור שיעורים אחרים.");
      return;
    }

    const packId = `pack-${Date.now()}`;
    sessionStorage.setItem(packId, JSON.stringify({ items: allItems }));
    window.location.href = `test-run.html?pack=${encodeURIComponent(packId)}`;
  });
}

async function initTestRunPage(){
  const packId = getParam("pack");
  if(!packId) return;

  const payload = sessionStorage.getItem(packId);
  if(!payload){
    byId("run-wrap").innerHTML = `<div class="notice">החבילה לא נמצאה (אולי ריעננתם). חזרו ללמידה למבחן והתחילו מחדש.</div>`;
    return;
  }

  const { items } = JSON.parse(payload);
  byId("run-title").textContent = `למידה למבחן • חידון • ${items.length} פריטים`;

  const gameWrap = document.createElement("div");
  gameWrap.id = "game-wrap";
  byId("run-wrap").appendChild(gameWrap);

  runQuiz({
    items,
    scope: "test"
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderLessonCards();
  initLessonPage().catch(console.error);
  initGamePage().catch(console.error);
  initTestPage().catch(console.error);
  initTestRunPage().catch(console.error);
});
