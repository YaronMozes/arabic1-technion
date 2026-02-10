import { getParam, loadEntriesNdjson, loadJson, shuffle, stripHebrewNiqqud } from "./data.js";

function byId(id){ return document.getElementById(id); }

const LESSON_INDEX_PATH = "data/lessons/index.json";
const MATCH_ROUND_SIZE = 5;
const ARABIC_VISIBILITY_KEY = "a1:show-arabic";
const SENTENCE_COMPLETION_PATH = "data/test/sentence-completion.json";
const SENTENCE_TRANSLATION_PATH = "data/test/sentence-translation.json";
const GREETINGS_PACK_PATH = "data/test/greetings.json";
const TEST_MODE_HE_TO_TR_NIQQUD = "he_to_tr_niqqud";
const TEST_MODE_TR_TO_HE = "tr_to_he";
const TEST_MODE_SENTENCE_COMPLETION = "sentence_completion";
const TEST_MODE_GREETINGS_PLAIN = "greetings_he_to_tr_plain";
const TEST_MODES_USING_LESSONS = new Set();
const SENTENCE_DIR_BOTH = "both";
const SENTENCE_DIR_Q_TO_A = "question_to_answer";
const SENTENCE_DIR_A_TO_Q = "answer_to_question";
const TEST_MODE_LABELS = {
  [TEST_MODE_SENTENCE_COMPLETION]: "השלמת משפטים",
  [TEST_MODE_HE_TO_TR_NIQQUD]: "תרגום משפטים מעברית לתעתיק (עם ניקוד)",
  [TEST_MODE_TR_TO_HE]: "תרגום משפטים מתעתיק לעברית",
  [TEST_MODE_GREETINGS_PLAIN]: "ברכות מעברית לתעתיק (בלי ניקוד)"
};

let lessonMetaCache = null;
let entryMapCache = null;
let arabicVisible = true;
const hebrewCollator = new Intl.Collator("he", {
  sensitivity: "base",
  ignorePunctuation: true,
  numeric: true
});
const ARABIC_ALPHABET = [
  { letter: "ا", nameHe: "אלף", translit: "א" },
  { letter: "ب", nameHe: "באא", translit: "בּ" },
  { letter: "ت", nameHe: "תאא", translit: "ת" },
  { letter: "ث", nameHe: "ת׳אא", translit: "ת׳" },
  { letter: "ج", nameHe: "ג׳ים", translit: "ג׳" },
  { letter: "ح", nameHe: "חאא", translit: "ח" },
  { letter: "خ", nameHe: "ח׳אא", translit: "ח׳" },
  { letter: "د", nameHe: "דאל", translit: "ד" },
  { letter: "ذ", nameHe: "ד׳אל", translit: "ד׳" },
  { letter: "ر", nameHe: "ראא", translit: "ר" },
  { letter: "ز", nameHe: "זאי", translit: "ז" },
  { letter: "س", nameHe: "סין", translit: "ס" },
  { letter: "ش", nameHe: "שין", translit: "ש" },
  { letter: "ص", nameHe: "צאד", translit: "צ / ס׳" },
  { letter: "ض", nameHe: "צ׳אד", translit: "צ׳" },
  { letter: "ط", nameHe: "טאא", translit: "ט" },
  { letter: "ظ", nameHe: "ז׳אא", translit: "ז׳" },
  { letter: "ع", nameHe: "עין", translit: "ע" },
  { letter: "غ", nameHe: "ע׳ין", translit: "ע׳" },
  { letter: "ف", nameHe: "פאא", translit: "פ" },
  { letter: "ق", nameHe: "קאף", translit: "ק" },
  { letter: "ك", nameHe: "כאף", translit: "כּ" },
  { letter: "ل", nameHe: "לאם", translit: "ל" },
  { letter: "م", nameHe: "מים", translit: "מ" },
  { letter: "ن", nameHe: "נון", translit: "נ" },
  { letter: "ه", nameHe: "האא", translit: "ה" },
  { letter: "و", nameHe: "ואו", translit: "ו / וּ" },
  { letter: "ي", nameHe: "יאא", translit: "י" }
];

function readArabicVisibility(){
  try{
    return localStorage.getItem(ARABIC_VISIBILITY_KEY) !== "0";
  }catch(err){
    return true;
  }
}

function writeArabicVisibility(show){
  try{
    localStorage.setItem(ARABIC_VISIBILITY_KEY, show ? "1" : "0");
  }catch(err){
    // Ignore storage write failures.
  }
}

function updateArabicToggleButtons(){
  const text = arabicVisible ? "הסתר ערבית" : "הצג ערבית";
  document.querySelectorAll("[data-arabic-toggle]").forEach((btn) => {
    btn.textContent = text;
    btn.classList.toggle("primary", !arabicVisible);
    btn.setAttribute("aria-pressed", (!arabicVisible).toString());
  });
}

function applyArabicVisibility(show){
  arabicVisible = !!show;
  document.body.classList.toggle("hide-arabic", !arabicVisible);
  updateArabicToggleButtons();
}

function setArabicVisibility(show){
  writeArabicVisibility(show);
  applyArabicVisibility(show);
}

function attachArabicToggleToSideToolbar(select){
  const toolbar = select?.closest(".game-side-toolbar");
  if(!toolbar) return;

  let toggle = toolbar.querySelector("[data-arabic-toggle]");
  if(!toggle){
    toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn game-side-toggle";
    toggle.dataset.arabicToggle = "1";
    toggle.addEventListener("click", () => {
      setArabicVisibility(!arabicVisible);
    });
  }

  const testBtn = toolbar.querySelector("#btn-side-test");
  const anchor = testBtn || select;
  if(anchor?.nextElementSibling !== toggle){
    anchor.insertAdjacentElement("afterend", toggle);
  }
  updateArabicToggleButtons();
}

function buildFallbackLessons(){
  const lessons = [];
  for(let n = 1; n <= 13; n += 1){
    lessons.push({ code: String(n).padStart(2, "0"), lesson: n, title: `שיעור ${n}` });
  }
  lessons.push({ code: "16", lesson: 16, title: "כל השיעורים" });
  lessons.push({ code: "14", lesson: 14, title: "ברכות" });
  lessons.push({ code: "15", lesson: 15, title: "העשרה" });
  return lessons;
}

async function loadLessonMeta(){
  if(lessonMetaCache) return lessonMetaCache;

  try{
    const payload = await loadJson(LESSON_INDEX_PATH);
    const rows = Array.isArray(payload?.lessons) ? payload.lessons : [];
    const seenCodes = new Set();
    const lessons = [];

    for(const row of rows){
      const lessonNumber = Number.parseInt(String(row?.lesson ?? ""), 10);
      if(!Number.isInteger(lessonNumber) || lessonNumber < 1){
        continue;
      }

      const codeFromLesson = String(lessonNumber).padStart(2, "0");
      const codeRaw = typeof row?.code === "string" ? row.code.trim() : "";
      const code = codeRaw || codeFromLesson;
      if(!code || seenCodes.has(code)){
        continue;
      }

      const titleRaw = typeof row?.title === "string" ? row.title.trim() : "";
      const title = titleRaw || `שיעור ${lessonNumber}`;
      seenCodes.add(code);
      lessons.push({ code, lesson: lessonNumber, title });
    }

    lessonMetaCache = lessons.length > 0 ? lessons : buildFallbackLessons();
  }catch(err){
    console.warn("Failed to load lesson index, using fallback.", err);
    lessonMetaCache = buildFallbackLessons();
  }

  return lessonMetaCache;
}

function canonicalLessonCode(raw, lessons){
  if(!Array.isArray(lessons) || lessons.length === 0){
    return String(raw ?? "");
  }

  const value = String(raw ?? "").trim();
  if(lessons.some((row) => row.code === value)){
    return value;
  }

  const n = Number.parseInt(value, 10);
  if(!Number.isNaN(n)){
    const padded = String(n).padStart(2, "0");
    if(lessons.some((row) => row.code === padded)){
      return padded;
    }
    const plain = String(n);
    if(lessons.some((row) => row.code === plain)){
      return plain;
    }
  }

  return lessons[0].code;
}

async function renderLessonCards(){
  const grid = byId("lessons-grid");
  if(!grid) return;

  const lessons = await loadLessonMeta();
  grid.innerHTML = "";
  lessons.forEach((lessonMeta) => {
    const a = document.createElement("a");
    a.className = "card lesson-card";
    a.href = `lesson.html?l=${encodeURIComponent(lessonMeta.code)}`;
    a.innerHTML = `<h3>${lessonMeta.title}</h3>`;
    grid.appendChild(a);
  });
}

async function loadEntryMap(){
  if(entryMapCache) return entryMapCache;
  const entries = await loadEntriesNdjson("data/entries.ndjson");
  entryMapCache = new Map(entries.map((entry) => [entry.id, entry]));
  return entryMapCache;
}

async function loadAggregatedLessonItems(lessonCode, lesson, lessons, entries){
  const aggregateType = String(lesson?.aggregate ?? "").trim();
  if(aggregateType !== "all_lessons"){
    return null;
  }

  const sourceCodesRaw = Array.isArray(lesson?.source_lessons) && lesson.source_lessons.length > 0
    ? lesson.source_lessons
    : lessons.map((row) => row.code).filter((code) => code !== lessonCode);
  const sourceCodes = [...new Set(
    sourceCodesRaw
      .map((value) => canonicalLessonCode(value, lessons))
      .filter((code) => code && code !== lessonCode)
  )];

  const byId = new Map();
  for(const code of sourceCodes){
    try{
      const sourceLesson = await loadJson(`data/lessons/${code}.json`);
      for(const id of (sourceLesson.items || [])){
        const entry = entries.get(id);
        if(entry && !byId.has(entry.id)){
          byId.set(entry.id, entry);
        }
      }
    }catch(err){
      console.warn(`Failed to load aggregate source lesson "${code}".`, err);
    }
  }

  return [...byId.values()];
}

async function loadLessonSet(rawLessonCode){
  const lessons = await loadLessonMeta();
  const lessonCode = canonicalLessonCode(rawLessonCode, lessons);
  const lessonMeta = lessons.find((row) => row.code === lessonCode) || lessons[0];
  const lesson = await loadJson(`data/lessons/${lessonCode}.json`);
  const entries = await loadEntryMap();
  const aggregateItems = await loadAggregatedLessonItems(lessonCode, lesson, lessons, entries);
  const items = aggregateItems || (lesson.items || []).map((id) => entries.get(id)).filter(Boolean);
  return { lesson, lessonMeta, lessonCode, lessons, items };
}

async function loadItemsForLessonCodes(lessonCodes, entriesById = null){
  const map = entriesById || await loadEntryMap();
  const uniqueItems = [];
  const seenEntryIds = new Set();

  for(const lessonCode of lessonCodes){
    try{
      const lesson = await loadJson(`data/lessons/${lessonCode}.json`);
      for(const id of (lesson.items || [])){
        const entry = map.get(id);
        if(!entry || seenEntryIds.has(entry.id)){
          continue;
        }
        seenEntryIds.add(entry.id);
        uniqueItems.push(entry);
      }
    }catch(err){
      console.warn(`Failed to load lesson file for "${lessonCode}".`, err);
    }
  }

  return uniqueItems;
}

function fmtHe(he){
  if(Array.isArray(he)) return he.join(" / ");
  return he ?? "";
}

function primaryHe(he){
  if(Array.isArray(he)) return he[0] ?? "";
  return he ?? "";
}

function hebrewSortKey(entry){
  return primaryHe(entry?.he)
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[״"׳']/g, "")
    .trim();
}

function sortEntriesByHebrew(entries){
  return [...entries].sort((a, b) => hebrewCollator.compare(hebrewSortKey(a), hebrewSortKey(b)));
}

function normalizeTestMode(raw){
  const value = String(raw ?? "").trim();
  if(TEST_MODE_LABELS[value]) return value;
  return TEST_MODE_SENTENCE_COMPLETION;
}

function testModeUsesLessons(mode){
  return TEST_MODES_USING_LESSONS.has(normalizeTestMode(mode));
}

function plainHebrewTranslit(text){
  return stripHebrewNiqqud(String(text ?? "")).replace(/\s+/g, " ").trim();
}

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseSentenceDirection(raw){
  const value = String(raw ?? "").trim();
  if(value === SENTENCE_DIR_Q_TO_A || value === SENTENCE_DIR_A_TO_Q){
    return value;
  }
  return SENTENCE_DIR_BOTH;
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

function setupSideToolbar(currentLesson, lessons, context = "game", mode = "quiz"){
  const homeBtn = byId("btn-side-home");
  if(homeBtn) homeBtn.href = "index.html";
  const testBtn = byId("btn-side-test");
  if(testBtn) testBtn.href = "test.html";

  const select = byId("game-lesson-select");
  if(!select || !Array.isArray(lessons) || lessons.length === 0) return;

  const rows = lessons.map((lessonMeta) => ({
    value: lessonMeta.code,
    label: lessonMeta.title
  }));

  select.innerHTML = rows.map((row) => `<option value="${row.value}">${row.label}</option>`).join("");
  const normalizedCurrent = canonicalLessonCode(currentLesson, lessons);
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

  attachArabicToggleToSideToolbar(select);
}

function renderLessonSupplement(lessonCode){
  const container = byId("lesson-supplement");
  if(!container) return false;

  container.innerHTML = "";
  if(lessonCode !== "15") return false;

  const chunkSize = 7;
  const rows = [];
  for(let i = 0; i < ARABIC_ALPHABET.length; i += chunkSize){
    const cells = ARABIC_ALPHABET.slice(i, i + chunkSize)
      .map((entry) => `
        <td>
          <span class="alphabet-letter ar" lang="ar">${entry.letter}</span>
          <span class="alphabet-name rtl">${entry.nameHe}</span>
          <span class="alphabet-translit rtl">${entry.translit}</span>
        </td>
      `)
      .join("");
    rows.push(`<tr>${cells}</tr>`);
  }

  const card = document.createElement("section");
  card.className = "card alphabet-card";
  card.innerHTML = `
    <h2 class="alphabet-title">אותיות בערבית</h2>
    <table class="alphabet-table" aria-label="טבלת אותיות בערבית">
      <tbody>${rows.join("")}</tbody>
    </table>
  `;
  container.appendChild(card);
  return true;
}

async function initLessonPage(){
  const lessonTitleEl = byId("lesson-title");
  if(!lessonTitleEl) return;

  const l = getParam("l");
  const { lesson, lessonMeta, lessonCode, lessons, items } = await loadLessonSet(l);
  const lessonTitle = lesson?.title || lessonMeta?.title || "שיעור";
  lessonTitleEl.textContent = lessonTitle;

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

  const hasSupplement = renderLessonSupplement(lessonCode);

  if(items.length === 0 && !hasSupplement){
    byId("lesson-empty").style.display = "block";
    byId("lesson-table-wrap").style.display = "none";
  }else{
    byId("lesson-empty").style.display = "none";
    byId("lesson-table-wrap").style.display = "block";
  }

  const words = byId("lesson-words");
  words.innerHTML = "";
  for(const e of sortEntriesByHebrew(items)){
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
    vocabBtn.href = `lesson.html?l=${lessonCode}`;
    vocabBtn.classList.add("primary");
  }
  byId("btn-quiz").href = `game.html?l=${lessonCode}`;
  byId("btn-match").href = `game.html?l=${lessonCode}&mode=match`;
  setupSideToolbar(lessonCode, lessons, "lesson");
}

async function initGamePage(){
  const gameTitleEl = byId("game-title");
  if(!gameTitleEl) return;

  const l = getParam("l");
  const mode = getParam("mode") || "quiz";

  const { lesson, lessonMeta, lessonCode, lessons, items } = await loadLessonSet(l);
  const lessonTitle = lesson?.title || lessonMeta?.title || "שיעור";
  gameTitleEl.textContent = lessonTitle;

  const quizBtn = byId("btn-game-quiz");
  const matchBtn = byId("btn-game-match");
  const vocabBtn = byId("btn-game-vocab");
  if(quizBtn && matchBtn){
    if(vocabBtn){
      vocabBtn.href = `lesson.html?l=${lessonCode}`;
    }
    quizBtn.href = `game.html?l=${lessonCode}&mode=quiz`;
    matchBtn.href = `game.html?l=${lessonCode}&mode=match`;
    quizBtn.classList.toggle("primary", mode !== "match");
    matchBtn.classList.toggle("primary", mode === "match");
  }

  setupSideToolbar(lessonCode, lessons, "game", mode);

  if(items.length === 0){
    byId("game-wrap").innerHTML = `<div class="notice">אין עדיין מילים זמינות בשיעור הזה.</div>`;
    return;
  }

  if(mode === "match"){
    runMatch({ items });
  }else{
    runQuiz({ items, scope: lessonCode });
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
    if(!arabicVisible){
      return tr || entryArabic(answer);
    }
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

function buildQuestionPoolFromEntries(entries, mode){
  const normalizedMode = normalizeTestMode(mode);
  const pool = [];

  for(const entry of entries){
    const id = entry?.id;
    const he = fmtHe(entry?.he).trim();
    const trWithNiqqud = fmtTr(entry).trim();
    if(!id || !he || !trWithNiqqud || trWithNiqqud === "—"){
      continue;
    }

    if(normalizedMode === TEST_MODE_HE_TO_TR_NIQQUD){
      pool.push({ id, prompt: he, correct: trWithNiqqud });
      continue;
    }

    if(normalizedMode === TEST_MODE_TR_TO_HE){
      pool.push({ id, prompt: trWithNiqqud, correct: he });
    }
  }

  return pool;
}

function buildQuestionPoolFromSentenceTranslations(rows, mode){
  const normalizedMode = normalizeTestMode(mode);
  const pool = [];

  for(const row of rows){
    const id = String(row?.id ?? "").trim();
    const he = String(row?.he ?? "").trim();
    const trWithNiqqud = String(row?.tr ?? "").trim();
    if(!id || !he || !trWithNiqqud){
      continue;
    }

    if(normalizedMode === TEST_MODE_HE_TO_TR_NIQQUD){
      pool.push({ id, prompt: he, correct: trWithNiqqud });
      continue;
    }

    if(normalizedMode === TEST_MODE_TR_TO_HE){
      pool.push({ id, prompt: trWithNiqqud, correct: he });
    }
  }

  return pool;
}

function buildQuestionPoolFromGreetings(rows, plain = false){
  const pool = [];
  for(const row of rows){
    const id = String(row?.id ?? "").trim();
    const he = String(row?.he ?? "").trim();
    const trWithNiqqud = String(row?.tr ?? "").trim();
    if(!id || !he || !trWithNiqqud){
      continue;
    }
    const correct = plain ? plainHebrewTranslit(trWithNiqqud) : trWithNiqqud;
    if(!correct) continue;
    pool.push({ id, prompt: he, correct });
  }
  return pool;
}

function buildQuestionPoolFromSentences(rows){
  const pool = [];
  for(const row of rows){
    const id = String(row?.id ?? "").trim();
    const question = String(row?.question ?? "").trim();
    const answer = String(row?.answer ?? "").trim();
    if(!id || !question || !answer){
      continue;
    }

    const direction = parseSentenceDirection(row?.direction);
    const promptClass = "quiz-prompt-main quiz-prompt-main-sentence rtl";
    const optionClass = "choice-text choice-text-sentence";

    if(direction === SENTENCE_DIR_Q_TO_A || direction === SENTENCE_DIR_BOTH){
      pool.push({
        id: `${id}:q_to_a`,
        prompt: question,
        correct: answer,
        promptLayout: "qa_split",
        questionText: question,
        answerText: "",
        promptClass,
        optionClass
      });
    }

    if(direction === SENTENCE_DIR_A_TO_Q || direction === SENTENCE_DIR_BOTH){
      pool.push({
        id: `${id}:a_to_q`,
        prompt: answer,
        correct: question,
        promptLayout: "qa_split",
        questionText: "",
        answerText: answer,
        promptClass,
        optionClass
      });
    }
  }
  return pool;
}

function runChoiceQuiz({ questionPool, scope, promptClass = "quiz-prompt-main rtl", singleColumn = false }){
  const wrap = byId("game-wrap");
  const pool = [...new Map(questionPool.map((q) => [q.id, q])).values()];

  if(pool.length === 0){
    wrap.innerHTML = `<div class="notice">אין מספיק פריטים לתרגול בחלק הזה.</div>`;
    return;
  }

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
    <div id="choices" class="choicegrid quiz-choicegrid ${singleColumn ? "quiz-choicegrid-single" : ""}"></div>
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

  function nextQuestion(){
    if(state.deck.length === 0){
      refillDeck();
    }
    const question = state.deck.pop();
    state.lastPromptId = question ? question.id : null;
    return question;
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

  function buildOptions(question){
    const givenOptions = Array.isArray(question.options) ? question.options : [];
    const uniqueWrong = [...new Set(givenOptions.filter((option) => option !== question.correct))];
    const extraWrong = shuffle(
      pool
        .filter((row) => row.id !== question.id)
        .map((row) => row.correct)
        .filter((option) => option && option !== question.correct && !uniqueWrong.includes(option))
    );

    const wrongOptions = [...uniqueWrong, ...extraWrong].slice(0, 3);
    return shuffle([question.correct, ...wrongOptions]);
  }

  function renderPrompt(question){
    if(question.promptLayout === "qa_split"){
      promptEl.className = "quiz-prompt quiz-prompt-split";
      const questionBody = question.questionText
        ? `<span class="quiz-split-text rtl">${escapeHtml(question.questionText)}</span>`
        : `<span class="quiz-split-missing rtl">בחרו שאלה נכונה</span>`;
      const answerBody = question.answerText
        ? `<span class="quiz-split-text rtl">${escapeHtml(question.answerText)}</span>`
        : `<span class="quiz-split-missing rtl">בחרו תשובה נכונה</span>`;
      promptEl.innerHTML = `
        <div class="quiz-split">
          <section class="quiz-split-side quiz-split-question">
            <h3 class="quiz-split-title">שאלה</h3>
            <div class="quiz-split-body">${questionBody}</div>
          </section>
          <section class="quiz-split-side quiz-split-answer">
            <h3 class="quiz-split-title">תשובה</h3>
            <div class="quiz-split-body">${answerBody}</div>
          </section>
        </div>
      `;
      return;
    }

    promptEl.className = "quiz-prompt";
    const effectivePromptClass = question.promptClass || promptClass;
    promptEl.innerHTML = `<span class="${effectivePromptClass}">${escapeHtml(question.prompt)}</span>`;
  }

  function makeQuestion(){
    clearAutoTimer();
    state.locked = false;
    state.lastResult = null;
    state.total += 1;

    const question = nextQuestion();
    const options = buildOptions(question);
    state.current = { question, options };

    renderPrompt(question);

    choicesEl.innerHTML = "";
    options.forEach((option, index) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "choice quiz-choice rtl";
      b.dataset.value = option;
      const optionClass = question.optionClass || "choice-text";
      b.innerHTML = `
        <span class="choice-index ltr">${index + 1}</span>
        <span class="${optionClass}">${escapeHtml(option)}</span>
      `;
      b.addEventListener("click", () => onPick(b, option));
      choicesEl.appendChild(b);
    });

    nextBtn.disabled = true;
    setFeedback("");
    updateScore();
  }

  function onPick(el, option){
    if(state.locked) return;
    state.locked = true;

    const { question } = state.current;
    const correct = option === question.correct;
    const choiceButtons = [...choicesEl.querySelectorAll(".choice")];
    choiceButtons.forEach((btn) => { btn.disabled = true; });

    if(correct){
      state.lastResult = "correct";
      state.streak += 1;
      el.classList.add("correct");
      setFeedback("נכון!", "good");
    }else{
      state.lastResult = "wrong";
      state.streak = 0;
      el.classList.add("wrong");
      const answerButton = choiceButtons.find((btn) => btn.dataset.value === question.correct);
      if(answerButton) answerButton.classList.add("correct");
      setFeedback(`לא נכון. התשובה הנכונה: ${question.correct}`, "bad");

      const missKey = storageKey("missed", scope);
      const prev = new Set(JSON.parse(localStorage.getItem(missKey) || "[]"));
      prev.add(question.id);
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
          <span class="match-item-ar-main rtl ar">${row.ar}</span>
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
    const chosen = shuffle(items).slice(0, Math.min(MATCH_ROUND_SIZE, items.length));
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

  const lessons = await loadLessonMeta();
  const sideHomeBtn = byId("btn-side-home");
  if(sideHomeBtn){
    sideHomeBtn.href = "index.html";
  }
  const testLessonSelect = byId("test-lesson-select");
  if(testLessonSelect){
    testLessonSelect.innerHTML = lessons
      .map((lessonMeta) => `<option value="${lessonMeta.code}">${lessonMeta.title}</option>`)
      .join("");
    testLessonSelect.value = lessons[0]?.code ?? "";
    testLessonSelect.addEventListener("change", () => {
      const chosen = canonicalLessonCode(testLessonSelect.value, lessons);
      window.location.href = `lesson.html?l=${encodeURIComponent(chosen)}`;
    });
  }

  const entriesById = await loadEntryMap();
  const box = byId("lesson-checks");
  const lessonsWrap = byId("test-lessons-wrap");
  const modeInputs = [...form.querySelectorAll('input[name="test-mode"]')];
  if(box){
    box.innerHTML = "";
    lessons.forEach((lessonMeta) => {
      const label = document.createElement("label");
      label.className = "test-lesson-option";
      label.innerHTML = `<input type="checkbox" name="lesson" value="${lessonMeta.code}" checked /> ${lessonMeta.title}`;
      box.appendChild(label);
    });
  }

  const lessonInputs = box ? [...box.querySelectorAll('input[name="lesson"]')] : [];
  function selectedMode(){
    const raw = form.querySelector('input[name="test-mode"]:checked')?.value;
    return normalizeTestMode(raw);
  }
  let isStartingMode = false;

  async function startSelectedMode(){
    if(isStartingMode) return;
    isStartingMode = true;

    try{
      const mode = selectedMode();
      const packData = { mode };

      if(testModeUsesLessons(mode)){
        const chosen = lessonInputs.length > 0
          ? [...form.querySelectorAll('input[name="lesson"]:checked')].map((x) => x.value)
          : lessons.map((lessonMeta) => lessonMeta.code);
        if(chosen.length === 0){
          alert("בחרו לפחות שיעור אחד.");
          isStartingMode = false;
          return;
        }

        const allItems = await loadItemsForLessonCodes(chosen, entriesById);
        if(allItems.length === 0){
          alert("השיעורים שבחרתם עדיין ללא מילים זמינות. נסו לבחור שיעורים אחרים.");
          isStartingMode = false;
          return;
        }

        packData.lessons = chosen;
      }

      const packId = `pack-${Date.now()}`;
      sessionStorage.setItem(packId, JSON.stringify(packData));
      window.location.href = `test-run.html?pack=${encodeURIComponent(packId)}`;
    }catch(err){
      console.error(err);
      isStartingMode = false;
    }
  }

  function syncLessonModeState(){
    const mode = selectedMode();
    const usesLessons = testModeUsesLessons(mode);
    lessonsWrap?.classList.toggle("disabled", !usesLessons);
    lessonInputs.forEach((input) => {
      input.disabled = !usesLessons;
    });
  }

  modeInputs.forEach((input) => {
    input.addEventListener("change", syncLessonModeState);
    input.addEventListener("change", () => {
      startSelectedMode().catch(console.error);
    });
    input.addEventListener("click", () => {
      startSelectedMode().catch(console.error);
    });
  });
  syncLessonModeState();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    startSelectedMode().catch(console.error);
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

  let parsed = null;
  try{
    parsed = JSON.parse(payload);
  }catch(err){
    byId("run-wrap").innerHTML = `<div class="notice">שגיאה בטעינת חבילת התרגול. חזרו לעמוד הקודם והתחילו מחדש.</div>`;
    return;
  }

  const mode = normalizeTestMode(parsed?.mode);
  const modeLabel = TEST_MODE_LABELS[mode] || "תרגול";
  let questionPool = [];
  const isSentenceTranslationMode = mode === TEST_MODE_HE_TO_TR_NIQQUD || mode === TEST_MODE_TR_TO_HE;

  try{
    if(isSentenceTranslationMode){
      const payloadRows = await loadJson(SENTENCE_TRANSLATION_PATH);
      questionPool = buildQuestionPoolFromSentenceTranslations(payloadRows?.items || [], mode);
    }else if(testModeUsesLessons(mode)){
      const lessons = await loadLessonMeta();
      const lessonCodeSet = new Set(lessons.map((row) => row.code));
      const selectedLessons = [...new Set(
        (Array.isArray(parsed?.lessons) ? parsed.lessons : [])
          .map((value) => canonicalLessonCode(value, lessons))
          .filter((code) => lessonCodeSet.has(code))
      )];

      if(selectedLessons.length === 0){
        byId("run-wrap").innerHTML = `<div class="notice">לא נבחרו שיעורים לחלק הזה. חזרו ולחצו התחל מחדש.</div>`;
        return;
      }

      const items = await loadItemsForLessonCodes(selectedLessons);
      questionPool = buildQuestionPoolFromEntries(items, mode);
    }else if(mode === TEST_MODE_SENTENCE_COMPLETION){
      const payloadRows = await loadJson(SENTENCE_COMPLETION_PATH);
      questionPool = buildQuestionPoolFromSentences(payloadRows?.items || []);
    }else if(mode === TEST_MODE_GREETINGS_PLAIN){
      const payloadRows = await loadJson(GREETINGS_PACK_PATH);
      questionPool = buildQuestionPoolFromGreetings(payloadRows?.items || [], true);
    }
  }catch(err){
    console.error(err);
    byId("run-wrap").innerHTML = `<div class="notice">שגיאה בטעינת נתוני התרגול. נסו שוב בעוד רגע.</div>`;
    return;
  }

  const itemCount = questionPool.length;
  if(itemCount === 0){
    byId("run-wrap").innerHTML = `<div class="notice">אין כרגע מספיק פריטים לחלק שבחרתם. נסו חלק אחר.</div>`;
    return;
  }

  byId("run-title").textContent = `למידה למבחן • ${modeLabel}`;

  const gameWrap = document.createElement("div");
  gameWrap.id = "game-wrap";
  byId("run-wrap").appendChild(gameWrap);

  runChoiceQuiz({
    questionPool,
    scope: `test:${mode}`,
    singleColumn: isSentenceTranslationMode || mode === TEST_MODE_SENTENCE_COMPLETION
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyArabicVisibility(readArabicVisibility());
  renderLessonCards().catch(console.error);
  initLessonPage().catch(console.error);
  initGamePage().catch(console.error);
  initTestPage().catch(console.error);
  initTestRunPage().catch(console.error);
});
