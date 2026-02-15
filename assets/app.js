import { getParam, loadEntriesNdjson, loadJson, shuffle, stripHebrewNiqqud } from "./data.js";

function byId(id){ return document.getElementById(id); }

const LESSON_INDEX_PATH = "data/lessons/index.json";
const MATCH_ROUND_SIZE = 5;
const ARABIC_VISIBILITY_KEY = "a1:show-arabic";
const SENTENCE_COMPLETION_PATH = "data/test/sentence-completion.json";
const SENTENCE_TRANSLATION_PATH = "data/test/sentence-translation.json";
const TRANSLIT_TO_HEBREW_PATH = "data/test/translit-to-hebrew.json";
const GREETINGS_PACK_PATH = "data/test/greetings.json";
const TEST_MODE_HE_TO_TR_NIQQUD = "he_to_tr_niqqud";
const TEST_MODE_HE_TO_TR_PLAIN_TYPING = "he_to_tr_plain_typing";
const TEST_MODE_TR_TO_HE = "tr_to_he";
const TEST_MODE_SENTENCE_COMPLETION = "sentence_completion";
const TEST_MODE_GREETINGS_PLAIN = "greetings_he_to_tr_plain";
const TEST_MODES_USING_LESSONS = new Set();
const SENTENCE_DIR_BOTH = "both";
const SENTENCE_DIR_Q_TO_A = "question_to_answer";
const SENTENCE_DIR_A_TO_Q = "answer_to_question";
const LESSON_CODE_VOCAB = "vocab";
const LESSON_CODE_GREETINGS = "greetings";
const LESSON_CODE_ENRICHMENT = "enrichment";
const DEFAULT_STUDY_LESSON_CODE = LESSON_CODE_VOCAB;
const DEFAULT_STUDY_TITLE = "אוצר מילים";
const PRIMARY_LESSON_CODES = [LESSON_CODE_VOCAB, LESSON_CODE_GREETINGS, LESSON_CODE_ENRICHMENT];
const TEST_TOOLBAR_VALUE = "__test_page__";
const TEST_TOOLBAR_LABEL = "למידה למבחן";
const LESSON_FILTER_ALL = "all";
const LESSON_FILTER_PRONOUNS = "pronouns";
const LESSON_FILTER_LABELS = {
  [LESSON_FILTER_ALL]: "כל המילים",
  [LESSON_FILTER_PRONOUNS]: "כינויי גוף"
};
const TEST_MODE_LABELS = {
  [TEST_MODE_SENTENCE_COMPLETION]: "השלמת משפטים",
  [TEST_MODE_HE_TO_TR_NIQQUD]: "תרגום משפטים מעברית לתעתיק (עם ניקוד)",
  [TEST_MODE_HE_TO_TR_PLAIN_TYPING]: "תרגום משפטים מעברית לתעתיק (הקלדה - בלי ניקוד ופיסוק)",
  [TEST_MODE_TR_TO_HE]: "תרגום משפטים מתעתיק לעברית",
  [TEST_MODE_GREETINGS_PLAIN]: "ברכות מעברית לתעתיק (בלי ניקוד)"
};
const LEGACY_LESSON_CODE_MAP = {
  "1": LESSON_CODE_VOCAB,
  "01": LESSON_CODE_VOCAB,
  "14": LESSON_CODE_GREETINGS,
  "15": LESSON_CODE_ENRICHMENT,
  "16": LESSON_CODE_VOCAB
};

let lessonMetaCache = null;
let entryMapCache = null;
let greetingsRowsCache = null;
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

function initSideToolbarDrawer(){
  if(!document.body){
    return;
  }

  const toolbar = document.querySelector(".game-side-toolbar");
  if(!toolbar || toolbar.dataset.drawerReady === "1"){
    return;
  }
  toolbar.dataset.drawerReady = "1";

  const toolbarId = toolbar.id || "side-toolbar-drawer";
  toolbar.id = toolbarId;

  const drawerHead = document.createElement("div");
  drawerHead.className = "side-drawer-head";
  drawerHead.innerHTML = `<span class="side-drawer-title">ניווט מהיר</span>`;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn side-drawer-close";
  closeBtn.setAttribute("aria-label", "סגירת חלון ניווט");
  closeBtn.textContent = "×";
  drawerHead.appendChild(closeBtn);
  toolbar.prepend(drawerHead);

  const overlay = document.createElement("button");
  overlay.type = "button";
  overlay.className = "side-drawer-overlay";
  overlay.setAttribute("aria-label", "סגירת חלון ניווט");

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "btn side-drawer-toggle";
  toggle.setAttribute("aria-controls", toolbarId);
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = `
    <span class="side-drawer-toggle-icon" aria-hidden="true">☰</span>
    <span>ניווט</span>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(toggle);

  const isOpen = () => document.body.classList.contains("drawer-open");

  function openDrawer(){
    document.body.classList.add("drawer-open");
    toggle.setAttribute("aria-expanded", "true");
    toolbar.setAttribute("aria-hidden", "false");
  }

  function closeDrawer(){
    document.body.classList.remove("drawer-open");
    toggle.setAttribute("aria-expanded", "false");
    toolbar.setAttribute("aria-hidden", "true");
  }

  closeDrawer();

  toggle.addEventListener("click", () => {
    if(isOpen()){
      closeDrawer();
      return;
    }
    openDrawer();
  });

  closeBtn.addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (event) => {
    if(event.key === "Escape" && isOpen()){
      closeDrawer();
    }
  });

  toolbar.addEventListener("click", (event) => {
    if(event.target.closest("a, button")){
      closeDrawer();
    }
  });

  toolbar.addEventListener("change", (event) => {
    if(event.target.closest("select")){
      closeDrawer();
    }
  });
}

function attachArabicToggleToSideToolbar(anchorEl){
  const toolbar = anchorEl?.closest(".game-side-toolbar") || document.querySelector(".game-side-toolbar");
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

  if(anchorEl && anchorEl.parentElement === toolbar){
    if(anchorEl.nextElementSibling !== toggle){
      anchorEl.insertAdjacentElement("afterend", toggle);
    }
  }else if(toggle.parentElement !== toolbar){
    toolbar.appendChild(toggle);
  }
  updateArabicToggleButtons();
}

function buildFallbackLessons(){
  return [
    { code: LESSON_CODE_VOCAB, lesson: 1, title: "אוצר מילים" },
    { code: LESSON_CODE_GREETINGS, lesson: 2, title: "ברכות" },
    { code: LESSON_CODE_ENRICHMENT, lesson: 3, title: "העשרה" }
  ];
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
  const legacyMappedCode = LEGACY_LESSON_CODE_MAP[value];
  if(legacyMappedCode && lessons.some((row) => row.code === legacyMappedCode)){
    return legacyMappedCode;
  }
  if(lessons.some((row) => row.code === value)){
    return value;
  }

  const n = Number.parseInt(value, 10);
  if(!Number.isNaN(n)){
    if(n >= 1 && n <= 13 && lessons.some((row) => row.code === LESSON_CODE_VOCAB)){
      return LESSON_CODE_VOCAB;
    }
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

function getUnifiedVocabLesson(lessons){
  if(!Array.isArray(lessons) || lessons.length === 0){
    return null;
  }
  return lessons.find((row) => row.code === DEFAULT_STUDY_LESSON_CODE) || lessons[0];
}

function displayLessonTitle(lessonCode, fallbackTitle = "שיעור"){
  if(String(lessonCode) === DEFAULT_STUDY_LESSON_CODE){
    return DEFAULT_STUDY_TITLE;
  }
  return fallbackTitle;
}

function getPrimaryLessonRows(lessons){
  if(!Array.isArray(lessons) || lessons.length === 0){
    return [];
  }

  const byCode = new Map(lessons.map((row) => [row.code, row]));
  const rows = [];
  const seen = new Set();

  PRIMARY_LESSON_CODES.forEach((code) => {
    const row = byCode.get(code);
    if(!row || seen.has(code)){
      return;
    }
    seen.add(code);
    rows.push({
      value: row.code,
      label: displayLessonTitle(row.code, row.title)
    });
  });

  if(rows.length === 0){
    const fallback = lessons[0];
    rows.push({
      value: fallback.code,
      label: displayLessonTitle(fallback.code, fallback.title)
    });
  }

  return rows;
}

async function renderLessonCards(){
  const grid = byId("lessons-grid");
  if(!grid) return;

  const lessons = await loadLessonMeta();
  const rows = getPrimaryLessonRows(lessons);
  if(rows.length === 0){
    grid.innerHTML = "";
    return;
  }

  grid.innerHTML = "";
  rows.forEach((row) => {
    const a = document.createElement("a");
    a.className = "card lesson-card";
    a.href = `lesson.html?l=${encodeURIComponent(row.value)}`;
    a.innerHTML = `<h3>${row.label}</h3>`;
    grid.appendChild(a);
  });
}

async function loadEntryMap(){
  if(entryMapCache) return entryMapCache;
  const entries = await loadEntriesNdjson("data/entries.ndjson");
  entryMapCache = new Map(entries.map((entry) => [entry.id, entry]));
  return entryMapCache;
}

async function loadGreetingsRows(){
  if(greetingsRowsCache){
    return greetingsRowsCache;
  }
  const payload = await loadJson(GREETINGS_PACK_PATH);
  greetingsRowsCache = Array.isArray(payload?.items) ? payload.items : [];
  return greetingsRowsCache;
}

function mapGreetingsRowsToEntries(rows){
  if(!Array.isArray(rows)){
    return [];
  }
  return rows
    .map((row, index) => {
      const idRaw = String(row?.id ?? "").trim();
      const he = String(row?.he ?? "").trim();
      const tr = String(row?.tr ?? "").trim();
      if(!he || !tr){
        return null;
      }
      const id = idRaw || `greet-${index + 1}`;
      return {
        id: `greetings:${id}`,
        he: [he],
        ar: {
          vocalized: tr,
          plain: tr
        },
        translit: {
          he: ""
        },
        tags: ["lesson:greetings", "topic:greetings"]
      };
    })
    .filter(Boolean);
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
  if(lessonCode === LESSON_CODE_GREETINGS){
    const greetingsRows = await loadGreetingsRows();
    const items = mapGreetingsRowsToEntries(greetingsRows);
    return { lesson, lessonMeta, lessonCode, lessons, items, greetingsRows };
  }
  const entries = await loadEntryMap();
  const aggregateItems = await loadAggregatedLessonItems(lessonCode, lesson, lessons, entries);
  const items = aggregateItems || (lesson.items || []).map((id) => entries.get(id)).filter(Boolean);
  return { lesson, lessonMeta, lessonCode, lessons, items, greetingsRows: [] };
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

function removePunctuationForTyping(text){
  try{
    return String(text ?? "").replace(/[^\p{L}\p{N}\s]/gu, " ");
  }catch(err){
    return String(text ?? "").replace(/[^0-9A-Za-z\u0590-\u05FF\u0600-\u06FF\s]/g, " ");
  }
}

function normalizePlainTypedTranslit(text){
  const plain = plainHebrewTranslit(text)
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[\u200e\u200f]/g, " ")
    .replace(/\(א\)|\(אל\)/g, " ")
    .replace(/\(a\)|\(al\)/gi, " ");
  return removePunctuationForTyping(plain)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchText(value){
  return stripHebrewNiqqud(String(value ?? ""))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlWithStableHyphens(value){
  return escapeHtml(value);
}

function escapeHtmlWithRaisedShadda(value){
  const raisedShadda = '<span class="raised-shadda" aria-hidden="true">\u0651</span>';
  const raw = String(value ?? "");
  let out = "";
  for(let idx = 0; idx < raw.length; idx += 1){
    const ch = raw[idx];
    if(ch !== "\u0651"){
      out += escapeHtml(ch);
      continue;
    }

    // Keep shadda inline when Hebrew combining marks follow it (e.g. הֻוֵּّ),
    // otherwise those marks can detach and render as orphan dots.
    const next = raw[idx + 1] || "";
    if(/[\u0591-\u05C7]/.test(next)){
      out += escapeHtml(ch);
      continue;
    }

    out += `&#8288;${raisedShadda}&#8288;`;
  }
  return out;
}

function shouldRaiseShadda(value){
  const text = String(value ?? "");
  return /\u0651/.test(text) && /[\u0590-\u05FF]/.test(text);
}

function escapeDisplayText(value){
  if(shouldRaiseShadda(value)){
    return escapeHtmlWithRaisedShadda(value);
  }
  return escapeHtmlWithStableHyphens(value);
}

function parseSentenceDirection(raw){
  const value = String(raw ?? "").trim();
  if(value === SENTENCE_DIR_Q_TO_A || value === SENTENCE_DIR_A_TO_Q){
    return value;
  }
  return SENTENCE_DIR_BOTH;
}

function countWords(value){
  const normalized = removePunctuationForTyping(String(value ?? ""))
    .replace(/\s+/g, " ")
    .trim();
  if(!normalized){
    return 0;
  }
  return normalized.split(" ").filter(Boolean).length;
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

function entryPrimaryForeign(entry){
  const ar = entryArabic(entry).trim();
  if(ar){
    return { text: ar, hasArabic: true };
  }
  const tr = fmtTr(entry).trim();
  if(tr && tr !== "—"){
    return { text: tr, hasArabic: false };
  }
  return { text: "", hasArabic: false };
}

function buildEntrySearchParts(entry){
  const he = fmtHe(entry?.he);
  const tr = fmtTr(entry);
  const arVocalized = entryArabic(entry);
  const arPlain = String(entry?.ar?.plain ?? "");
  return {
    he: normalizeSearchText(he),
    tr: normalizeSearchText(tr),
    ar: normalizeSearchText(`${arVocalized} ${arPlain}`),
    all: normalizeSearchText([he, tr, arVocalized, arPlain].join(" "))
  };
}

function entryIsPronoun(entry){
  const pos = String(entry?.pos ?? "").trim();
  if(pos === "pronoun"){
    return true;
  }
  const tags = Array.isArray(entry?.tags) ? entry.tags : [];
  return tags.includes("topic:pronouns");
}

function normalizeLessonFilter(raw){
  const value = String(raw ?? "").trim();
  return LESSON_FILTER_LABELS[value] ? value : LESSON_FILTER_ALL;
}

function cardMatchesLessonFilter(card, filter){
  if(filter === LESSON_FILTER_PRONOUNS){
    return card?.dataset?.filterPronouns === "1";
  }
  return true;
}

function ensureLessonSearchUi(){
  const tableWrap = byId("lesson-table-wrap");
  if(!tableWrap) return null;

  let wrap = byId("lesson-search-wrap");
  if(!wrap){
    wrap = document.createElement("section");
    wrap.id = "lesson-search-wrap";
    wrap.className = "lesson-search-wrap";
    wrap.innerHTML = `
      <label class="lesson-search-label" for="lesson-search-input">חיפוש באוצר המילים</label>
      <div class="lesson-search-controls">
        <input id="lesson-search-input" class="lesson-search-input" type="search" inputmode="search" autocomplete="off" placeholder="חיפוש מילה בעברית / בערבית / בתעתיק" />
        <label class="lesson-search-filter-label" for="lesson-filter-select">סינון</label>
        <select id="lesson-filter-select" class="lesson-search-filter" aria-label="סינון אוצר מילים">
          <option value="${LESSON_FILTER_ALL}">${LESSON_FILTER_LABELS[LESSON_FILTER_ALL]}</option>
          <option value="${LESSON_FILTER_PRONOUNS}">${LESSON_FILTER_LABELS[LESSON_FILTER_PRONOUNS]}</option>
        </select>
      </div>
      <div id="lesson-search-meta" class="lesson-search-meta muted"></div>
    `;
    const supplement = byId("lesson-supplement");
    if(supplement){
      tableWrap.insertBefore(wrap, supplement);
    }else{
      tableWrap.prepend(wrap);
    }
  }

  return {
    wrap,
    input: byId("lesson-search-input"),
    filter: byId("lesson-filter-select"),
    meta: byId("lesson-search-meta")
  };
}

function storageKey(prefix, scope){ return `a1:${prefix}:${scope}`; }

function setupSideToolbar(currentLesson, lessons, context = "game", mode = "quiz"){
  const homeBtn = byId("btn-side-home");
  if(homeBtn) homeBtn.href = "index.html";

  const actions = byId("game-lesson-actions");
  if(!actions || !Array.isArray(lessons) || lessons.length === 0) return;

  const isTestContext = context === "test";
  const isTestRunContext = context === "test_run";
  const isTestLikeContext = isTestContext || isTestRunContext;
  const primaryRows = getPrimaryLessonRows(lessons);
  const rows = context === "lesson" || context === "game" || isTestLikeContext
    ? [...primaryRows, { value: TEST_TOOLBAR_VALUE, label: TEST_TOOLBAR_LABEL }]
    : lessons.map((lessonMeta) => ({
      value: lessonMeta.code,
      label: lessonMeta.title
    }));

  actions.innerHTML = "";
  actions.style.display = rows.length <= 1 ? "none" : "";
  if(rows.length <= 1){
    if(!isTestLikeContext){
      attachArabicToggleToSideToolbar(actions);
    }
    return;
  }

  let activeValue = null;
  if(isTestLikeContext){
    activeValue = TEST_TOOLBAR_VALUE;
  }else{
    const hasCurrentLesson = currentLesson !== null && currentLesson !== undefined && String(currentLesson).trim() !== "";
    if(hasCurrentLesson){
      const normalizedCurrent = canonicalLessonCode(currentLesson, lessons);
      if(rows.some((row) => row.value === normalizedCurrent)){
        activeValue = normalizedCurrent;
      }
    }
  }

  const safeMode = mode === "match" ? "match" : "quiz";
  rows.forEach((row) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn game-side-nav-btn";
    btn.textContent = row.label;
    if(activeValue === row.value){
      btn.classList.add("primary");
      btn.setAttribute("aria-current", "page");
    }

    btn.addEventListener("click", () => {
      const chosen = row.value;
      if(chosen === TEST_TOOLBAR_VALUE){
        window.location.href = "test.html";
        return;
      }
      if(context === "game"){
        window.location.href = `game.html?l=${encodeURIComponent(chosen)}&mode=${encodeURIComponent(safeMode)}`;
        return;
      }
      if(context === "lesson" || isTestLikeContext){
        window.location.href = `lesson.html?l=${encodeURIComponent(chosen)}`;
        return;
      }
      window.location.href = `lesson.html?l=${encodeURIComponent(chosen)}`;
    });
    actions.appendChild(btn);
  });

  if(!isTestLikeContext){
    attachArabicToggleToSideToolbar(actions);
  }
}

function renderLessonSupplement(lessonCode){
  const container = byId("lesson-supplement");
  if(!container) return false;

  container.innerHTML = "";
  if(lessonCode !== LESSON_CODE_ENRICHMENT) return false;

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
    <h2 class="alphabet-title">האותיות בערבית</h2>
    <table class="alphabet-table" aria-label="טבלת האותיות בערבית">
      <tbody>${rows.join("")}</tbody>
    </table>
  `;
  container.appendChild(card);
  return true;
}

async function initLessonPage(){
  const lessonTitleEl = byId("lesson-title");
  if(!lessonTitleEl) return;

  const l = getParam("l") || DEFAULT_STUDY_LESSON_CODE;
  const { lesson, lessonMeta, lessonCode, lessons, items } = await loadLessonSet(l);
  const lessonTitle = displayLessonTitle(lessonCode, lesson?.title || lessonMeta?.title || "שיעור");
  const isEnrichmentLesson = lessonCode === LESSON_CODE_ENRICHMENT;
  const isGreetingsLesson = lessonCode === LESSON_CODE_GREETINGS;
  lessonTitleEl.textContent = lessonTitle;

  const lessonOverlineEl = document.querySelector(".page-lesson .game-header .brand p");
  if(lessonOverlineEl){
    lessonOverlineEl.style.display = "none";
  }

  const topNav = document.querySelector(".game-header .game-nav") || document.querySelector(".header .row");
  if(topNav){
    if(isEnrichmentLesson){
      topNav.style.display = "none";
    }else{
      topNav.style.display = "";
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
  words.classList.toggle("lesson-word-grid-greetings", isGreetingsLesson);
  for(const e of sortEntriesByHebrew(items)){
    const searchParts = buildEntrySearchParts(e);
    const arText = entryArabic(e);
    const trText = fmtTr(e);
    const heHtml = escapeDisplayText(fmtHe(e.he));
    const arHtml = escapeDisplayText(arText);
    const trHtml = escapeDisplayText(trText);
    const hasDistinctTr = trText && trText !== "—"
      && normalizeSearchText(trText) !== normalizeSearchText(arText);
    const card = document.createElement("article");
    card.className = isGreetingsLesson
      ? "card lesson-word-card lesson-word-card-greetings"
      : "card lesson-word-card";
    card.dataset.searchHe = searchParts.he;
    card.dataset.searchTr = searchParts.tr;
    card.dataset.searchAr = searchParts.ar;
    card.dataset.searchAll = searchParts.all;
    card.dataset.filterPronouns = entryIsPronoun(e) ? "1" : "0";
    card.innerHTML = `
      <div class="lesson-word-he rtl">${heHtml}</div>
      ${arText ? `<div class="lesson-word-ar rtl ar">${arHtml}</div>` : ""}
      ${hasDistinctTr ? `<div class="lesson-word-tr rtl muted">${trHtml}</div>` : ""}
    `;
    words.appendChild(card);
  }

  const searchUi = ensureLessonSearchUi();
  if(searchUi){
    const cards = [...words.querySelectorAll(".lesson-word-card")];
    const total = cards.length;
    const { wrap, input, filter, meta } = searchUi;
    if(isEnrichmentLesson || total === 0){
      wrap.style.display = "none";
      wrap.classList.remove("lesson-search-no-filter");
      if(input){
        input.value = "";
      }
      if(filter){
        filter.value = LESSON_FILTER_ALL;
        filter.disabled = false;
        filter.onchange = null;
      }
    }else{
      wrap.style.display = "";
      wrap.classList.toggle("lesson-search-no-filter", isGreetingsLesson);

      const applySearch = () => {
        const q = normalizeSearchText(input?.value || "");
        const activeFilter = isGreetingsLesson
          ? LESSON_FILTER_ALL
          : normalizeLessonFilter(filter?.value);
        const filteredCards = cards.filter((card) => cardMatchesLessonFilter(card, activeFilter));
        const filteredTotal = filteredCards.length;
        words.innerHTML = "";

        if(!q){
          words.classList.remove("lesson-word-grid-grouped");
          filteredCards.forEach((card) => {
            card.style.display = "";
            words.appendChild(card);
          });
          if(filteredTotal === 0){
            const empty = document.createElement("div");
            empty.className = "lesson-search-empty muted";
            empty.textContent = "אין מילים תואמות לסינון שנבחר";
            words.appendChild(empty);
          }
          if(meta){
            if(activeFilter === LESSON_FILTER_ALL){
              meta.textContent = `סה״כ ${total} מילים`;
            }else{
              meta.textContent = `${LESSON_FILTER_LABELS[activeFilter]}: ${filteredTotal} מתוך ${total} מילים`;
            }
          }
          return;
        }

        words.classList.add("lesson-word-grid-grouped");
        const groups = [
          { key: "he", title: "עברית", cards: [] },
          { key: "tr", title: "תעתיק", cards: [] },
          { key: "ar", title: "ערבית", cards: [] }
        ];

        let visible = 0;
        filteredCards.forEach((card) => {
          const heHit = String(card.dataset.searchHe || "").includes(q);
          const trHit = String(card.dataset.searchTr || "").includes(q);
          const arHit = String(card.dataset.searchAr || "").includes(q);

          if(heHit){
            groups[0].cards.push(card);
            visible += 1;
            return;
          }
          if(trHit){
            groups[1].cards.push(card);
            visible += 1;
            return;
          }
          if(arHit){
            groups[2].cards.push(card);
            visible += 1;
          }
        });

        groups.forEach((group) => {
          if(group.cards.length === 0){
            return;
          }
          const section = document.createElement("section");
          section.className = "lesson-search-group";
          section.innerHTML = `<h3 class="lesson-search-group-title">${group.title}</h3>`;
          const grid = document.createElement("div");
          grid.className = "lesson-word-grid lesson-search-group-grid";
          if(isGreetingsLesson){
            grid.classList.add("lesson-word-grid-greetings");
          }
          group.cards.forEach((card) => {
            card.style.display = "";
            grid.appendChild(card);
          });
          section.appendChild(grid);
          words.appendChild(section);
        });

        if(visible === 0){
          const empty = document.createElement("div");
          empty.className = "lesson-search-empty muted";
          empty.textContent = "לא נמצאו תוצאות";
          words.appendChild(empty);
        }

        if(meta){
          if(activeFilter === LESSON_FILTER_ALL){
            meta.textContent = `נמצאו ${visible} מתוך ${total} מילים`;
          }else{
            meta.textContent = `נמצאו ${visible} מתוך ${filteredTotal} מילים (${LESSON_FILTER_LABELS[activeFilter]})`;
          }
        }
      };

      if(input){
        input.value = "";
        input.oninput = applySearch;
      }
      if(filter){
        filter.value = LESSON_FILTER_ALL;
        filter.disabled = isGreetingsLesson;
        filter.onchange = isGreetingsLesson ? null : applySearch;
      }
      applySearch();
    }
  }

  if(!isEnrichmentLesson){
    const vocabBtn = byId("btn-lesson-vocab");
    if(vocabBtn){
      vocabBtn.href = `lesson.html?l=${lessonCode}`;
      vocabBtn.classList.add("primary");
    }
    byId("btn-quiz").href = `game.html?l=${lessonCode}`;
    byId("btn-match").href = `game.html?l=${lessonCode}&mode=match`;
  }
  setupSideToolbar(lessonCode, lessons, "lesson");
}

async function initGamePage(){
  const gameTitleEl = byId("game-title");
  if(!gameTitleEl) return;

  const l = getParam("l") || DEFAULT_STUDY_LESSON_CODE;
  const mode = getParam("mode") || "quiz";

  const { lessonCode, lessons, items, greetingsRows } = await loadLessonSet(l);
  const modeTitle = mode === "match" ? "התאמת מילים" : "חידון";
  const isEnrichmentLesson = lessonCode === LESSON_CODE_ENRICHMENT;
  gameTitleEl.textContent = modeTitle;
  const gameOverlineEl = document.querySelector(".page-game .game-header .brand p");
  if(gameOverlineEl){
    gameOverlineEl.style.display = "none";
  }
  const gameTopNav = document.querySelector(".page-game .game-header .game-nav");
  if(gameTopNav){
    gameTopNav.style.display = isEnrichmentLesson ? "none" : "";
  }

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

  if(lessonCode === LESSON_CODE_GREETINGS){
    if(mode === "match"){
      runMatch({ items });
      return;
    }
    const questionPool = buildQuestionPoolFromGreetings(greetingsRows || []);
    runChoiceQuiz({
      questionPool,
      scope: lessonCode,
      singleColumn: true
    });
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
    feedbackEl.innerHTML = escapeDisplayText(message);
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

  function hasArabicDiacritics(text){
    return /[\u064B-\u065F\u0670\u06D6-\u06ED]/.test(String(text ?? ""));
  }

  function normalizeOptionText(value){
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function optionKey(entry, direction){
    if(direction === "ar_to_he"){
      return `he:${normalizeOptionText(fmtHe(entry.he))}`;
    }
    const ar = normalizeOptionText(entryPrimaryForeign(entry).text);
    const tr = normalizeOptionText(translitText(entry));
    return `ar:${ar}|tr:${tr}`;
  }

  function pickDistractors(answer, direction, size = 3){
    const candidates = shuffle(pool.filter((entry) => entry.id !== answer.id));
    const chosen = [];
    const chosenIds = new Set();
    const seenKeys = new Set([optionKey(answer, direction)]);

    for(const candidate of candidates){
      const key = optionKey(candidate, direction);
      if(seenKeys.has(key)){
        continue;
      }
      chosen.push(candidate);
      chosenIds.add(candidate.id);
      seenKeys.add(key);
      if(chosen.length >= size){
        return chosen;
      }
    }

    for(const candidate of candidates){
      if(chosenIds.has(candidate.id)){
        continue;
      }
      chosen.push(candidate);
      if(chosen.length >= size){
        break;
      }
    }
    return chosen;
  }

  function isEquivalentPick(picked, answer, direction){
    if(direction === "ar_to_he"){
      return normalizeOptionText(fmtHe(picked.he)) === normalizeOptionText(fmtHe(answer.he));
    }
    return picked.id === answer.id;
  }

  function renderPrompt(answer, direction){
    if(direction === "ar_to_he"){
      const primary = entryPrimaryForeign(answer);
      const arText = primary.text;
      const trRaw = translitText(answer);
      const tr = primary.hasArabic && trRaw && normalizeOptionText(trRaw) !== normalizeOptionText(arText)
        ? trRaw
        : "";
      const arHtml = escapeDisplayText(arText);
      const trHtml = escapeDisplayText(tr);
      const arClasses = ["quiz-prompt-main", "quiz-prompt-main-ar", "rtl"];
      if(primary.hasArabic){
        arClasses.push("ar");
      }
      if(primary.hasArabic && hasArabicDiacritics(arText)){
        arClasses.push("quiz-prompt-main-ar-diacritic");
      }
      promptEl.innerHTML = `
        <span class="${arClasses.join(" ")}">${arHtml}</span>
        ${tr ? `<span class="quiz-prompt-sub rtl">${trHtml}</span>` : ""}
      `;
      return;
    }

    promptEl.innerHTML = `<span class="quiz-prompt-main rtl">${escapeDisplayText(fmtHe(answer.he))}</span>`;
  }

  function renderOption(entry, direction, index, showDisambiguator = false){
    if(direction === "ar_to_he"){
      const he = fmtHe(entry.he);
      const hint = translitText(entry) || entryArabic(entry);
      const heHtml = escapeDisplayText(he);
      const hintHtml = escapeDisplayText(hint);
      if(showDisambiguator){
        return `
          <span class="choice-index ltr">${index + 1}</span>
          <span class="choice-stack">
            <span class="choice-text">${heHtml}</span>
            ${hint ? `<span class="choice-sub choice-sub-disambiguator rtl">${hintHtml}</span>` : ""}
          </span>
        `;
      }

      return `
        <span class="choice-index ltr">${index + 1}</span>
        <span class="choice-text">${heHtml}</span>
      `;
    }

    const primary = entryPrimaryForeign(entry);
    const primaryText = primary.text;
    const tr = translitText(entry);
    const trLine = tr && normalizeOptionText(tr) !== normalizeOptionText(primaryText) ? tr : "";
    const primaryClasses = ["choice-text", "choice-ar", "rtl"];
    if(primary.hasArabic){
      primaryClasses.push("ar");
    }
    return `
      <span class="choice-index ltr">${index + 1}</span>
      <span class="choice-stack">
        <span class="${primaryClasses.join(" ")}">${escapeDisplayText(primaryText)}</span>
        ${trLine ? `<span class="choice-sub rtl">${escapeDisplayText(trLine)}</span>` : ""}
      </span>
    `;
  }

  function formatCorrectAnswer(answer, direction){
    if(direction === "ar_to_he"){
      return fmtHe(answer.he);
    }
    const primary = entryPrimaryForeign(answer);
    const tr = translitText(answer);
    if(!arabicVisible){
      return tr || primary.text;
    }
    if(!primary.text){
      return tr;
    }
    if(tr && normalizeOptionText(tr) !== normalizeOptionText(primary.text)){
      return `${primary.text} (${tr})`;
    }
    return primary.text;
  }

  function makeQuestion(){
    clearAutoTimer();
    state.locked = false;
    state.lastResult = null;
    state.total += 1;

    const answer = nextAnswer();
    const direction = Math.random() < 0.5 ? "ar_to_he" : "he_to_ar";
    const distractors = pickDistractors(answer, direction, 3);
    const options = shuffle([answer, ...distractors]);
    const duplicateHeCounts = new Map();
    if(direction === "ar_to_he"){
      options.forEach((opt) => {
        const key = normalizeOptionText(fmtHe(opt.he));
        duplicateHeCounts.set(key, (duplicateHeCounts.get(key) || 0) + 1);
      });
    }
    state.current = { answer, options, direction, duplicateHeCounts };

    renderPrompt(answer, direction);
    choicesEl.innerHTML = "";
    options.forEach((opt, index) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "choice quiz-choice rtl";
      b.dataset.id = opt.id;
      const heKey = normalizeOptionText(fmtHe(opt.he));
      const showDisambiguator = direction === "ar_to_he" && (duplicateHeCounts.get(heKey) || 0) > 1;
      b.innerHTML = renderOption(opt, direction, index, showDisambiguator);
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

    const { answer, direction, options } = state.current;
    const correct = isEquivalentPick(picked, answer, direction);
    const choiceButtons = [...choicesEl.querySelectorAll(".choice")];
    const optionById = new Map(options.map((option) => [String(option.id), option]));
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
      const correctButtons = choiceButtons.filter((btn) => {
        const option = optionById.get(String(btn.dataset.id || ""));
        return option ? isEquivalentPick(option, answer, direction) : false;
      });
      if(correctButtons.length > 0){
        correctButtons.forEach((btn) => btn.classList.add("correct"));
      }else{
        const answerButton = choiceButtons.find((btn) => btn.dataset.id === String(answer.id));
        if(answerButton) answerButton.classList.add("correct");
      }
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

    if(normalizedMode === TEST_MODE_HE_TO_TR_PLAIN_TYPING){
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
  const optionClass = "choice-text choice-text-sentence";

  for(const row of rows){
    const id = String(row?.id ?? "").trim();
    const he = String(row?.he ?? "").trim();
    const trWithNiqqud = String(row?.tr ?? "").trim();
    if(!id || !he || !trWithNiqqud){
      continue;
    }

    if(normalizedMode === TEST_MODE_HE_TO_TR_NIQQUD){
      pool.push({ id, prompt: he, correct: trWithNiqqud, optionClass });
      continue;
    }

    if(normalizedMode === TEST_MODE_HE_TO_TR_PLAIN_TYPING){
      pool.push({ id, prompt: he, correct: trWithNiqqud });
      continue;
    }

    if(normalizedMode === TEST_MODE_TR_TO_HE){
      pool.push({ id, prompt: trWithNiqqud, correct: he, optionClass });
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
    const requestedMinWords = Number.parseInt(String(row?.min_words ?? ""), 10);
    const minWords = Number.isInteger(requestedMinWords) ? Math.max(4, requestedMinWords) : 4;
    const promptClass = "quiz-prompt-main quiz-prompt-main-sentence rtl";
    const optionClass = "choice-text choice-text-sentence";
    const id = String(row?.id ?? "").trim();
    if(!id){
      continue;
    }

    const provided = String(row?.provided_sentence ?? "").trim();
    const completion = String(row?.good_completion ?? "").trim();
    const role = String(row?.role_of_provided ?? "").trim().toLowerCase();
    if(provided && completion && (role === "question" || role === "answer")){
      if(countWords(completion) >= minWords){
        const promptIsQuestion = role === "question";
        pool.push({
          id: `${id}:provided_${role}`,
          prompt: provided,
          correct: completion,
          promptLayout: "qa_split",
          questionText: promptIsQuestion ? provided : "",
          answerText: promptIsQuestion ? "" : provided,
          promptClass,
          optionClass,
          choiceGroup: promptIsQuestion ? "answer" : "question",
          options: Array.isArray(row?.options) ? row.options : []
        });
      }
      continue;
    }

    const question = String(row?.question ?? "").trim();
    const answer = String(row?.answer ?? "").trim();
    if(!question || !answer){
      continue;
    }

    const direction = parseSentenceDirection(row?.direction);
    if((direction === SENTENCE_DIR_Q_TO_A || direction === SENTENCE_DIR_BOTH) && countWords(answer) >= minWords){
      pool.push({
        id: `${id}:q_to_a`,
        prompt: question,
        correct: answer,
        promptLayout: "qa_split",
        questionText: question,
        answerText: "",
        promptClass,
        optionClass,
        choiceGroup: "answer",
        options: Array.isArray(row?.options) ? row.options : []
      });
    }

    if((direction === SENTENCE_DIR_A_TO_Q || direction === SENTENCE_DIR_BOTH) && countWords(question) >= minWords){
      pool.push({
        id: `${id}:a_to_q`,
        prompt: answer,
        correct: question,
        promptLayout: "qa_split",
        questionText: "",
        answerText: answer,
        promptClass,
        optionClass,
        choiceGroup: "question",
        options: Array.isArray(row?.options) ? row.options : []
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
    feedbackEl.innerHTML = escapeDisplayText(message);
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
    const candidatePool = pool.filter((row) => {
      if(row.id === question.id){
        return false;
      }
      if(!question.choiceGroup || !row.choiceGroup){
        return true;
      }
      return row.choiceGroup === question.choiceGroup;
    });

    // Use a Set to track seen normalized strings to avoid near-duplicates (like with/without niqqud)
    const seenNormalized = new Set();
    seenNormalized.add(stripHebrewNiqqud(question.correct).trim());
    uniqueWrong.forEach(opt => seenNormalized.add(stripHebrewNiqqud(opt).trim()));

    const extraWrong = shuffle(
      candidatePool
        .map((row) => row.correct)
        .filter((option) => {
          if (!option) return false;
          const norm = stripHebrewNiqqud(option).trim();
          if (seenNormalized.has(norm)) return false;
          seenNormalized.add(norm);
          return true;
        })
    );

    const wrongOptions = [...uniqueWrong, ...extraWrong].slice(0, 3);
    return shuffle([question.correct, ...wrongOptions]);
  }

  function renderPrompt(question){
    if(question.promptLayout === "qa_split"){
      promptEl.className = "quiz-prompt quiz-prompt-split";
      const questionBody = question.questionText
        ? `<span class="quiz-split-text rtl">${escapeDisplayText(question.questionText)}</span>`
        : `<span class="quiz-split-missing rtl">בחרו שאלה נכונה</span>`;
      const answerBody = question.answerText
        ? `<span class="quiz-split-text rtl">${escapeDisplayText(question.answerText)}</span>`
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
    promptEl.innerHTML = `<span class="${effectivePromptClass}">${escapeDisplayText(question.prompt)}</span>`;
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
        <span class="${optionClass}">${escapeDisplayText(option)}</span>
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

function runTypingQuiz({ questionPool, scope, promptClass = "quiz-prompt-main rtl" }){
  const wrap = byId("game-wrap");
  const pool = [...new Map(questionPool.map((q) => [q.id, q])).values()];

  if(pool.length === 0){
    wrap.innerHTML = `<div class="notice">אין מספיק פריטים לתרגול בחלק הזה.</div>`;
    return;
  }

  const state = {
    streak: 0,
    total: 0,
    current: null,
    locked: false,
    deck: [],
    lastPromptId: null
  };

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
    <div class="quiz-typing-wrap">
      <div class="quiz-typing-row">
        <input
          id="typing-answer"
          class="quiz-typing-input rtl"
          type="text"
          inputmode="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="כתבו כאן את התעתיק"
          aria-label="כתיבת תשובה בתעתיק"
        />
        <button class="btn" id="typing-check" type="button">בדיקה</button>
      </div>
      <div class="quiz-typing-hint muted">הבדיקה מתעלמת מניקוד וסימני פיסוק.</div>
    </div>
    <div id="feedback" class="quiz-feedback muted"></div>
    <div class="quiz-next-row">
      <button class="btn primary" id="nextq" type="button" disabled>שאלה הבאה</button>
    </div>
  `;
  wrap.appendChild(card);

  const streakEl = byId("quiz-streak");
  const totalEl = byId("quiz-total");
  const promptEl = byId("prompt");
  const feedbackEl = byId("feedback");
  const answerInput = byId("typing-answer");
  const checkBtn = byId("typing-check");
  const nextBtn = byId("nextq");

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
    feedbackEl.innerHTML = escapeDisplayText(message);
    feedbackEl.className = `quiz-feedback ${type}`;
  }

  function makeQuestion(){
    state.locked = false;
    state.total += 1;

    const question = nextQuestion();
    state.current = question;

    promptEl.className = "quiz-prompt";
    promptEl.innerHTML = `<span class="${promptClass}">${escapeDisplayText(question.prompt)}</span>`;

    answerInput.value = "";
    answerInput.disabled = false;
    checkBtn.disabled = false;
    nextBtn.disabled = true;
    setFeedback("");
    updateScore();
    answerInput.focus();
  }

  function onCheck(){
    if(state.locked) return;
    const question = state.current;
    if(!question) return;

    const givenRaw = String(answerInput.value ?? "").trim();
    if(!givenRaw){
      setFeedback("כתבו תשובה לפני בדיקה.", "muted");
      return;
    }

    const given = normalizePlainTypedTranslit(givenRaw);
    const correct = normalizePlainTypedTranslit(question.correct);
    const isCorrect = given === correct;

    state.locked = true;
    answerInput.disabled = true;
    checkBtn.disabled = true;
    nextBtn.disabled = false;

    if(isCorrect){
      state.streak += 1;
      setFeedback(`נכון! התשובה המלאה: ${question.correct}`, "good");
      updateScore();
      return;
    }

    state.streak = 0;
    setFeedback(`לא נכון. התשובה הנכונה: ${question.correct}`, "bad");
    const missKey = storageKey("missed", scope);
    const prev = new Set(JSON.parse(localStorage.getItem(missKey) || "[]"));
    prev.add(question.id);
    localStorage.setItem(missKey, JSON.stringify([...prev]));
    updateScore();
  }

  function onKeyDown(event){
    if(event.key !== "Enter"){
      return;
    }
    event.preventDefault();
    if(nextBtn.disabled){
      onCheck();
    }else{
      nextBtn.click();
    }
  }

  checkBtn.addEventListener("click", onCheck);
  nextBtn.addEventListener("click", makeQuestion);
  answerInput.addEventListener("keydown", onKeyDown);

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
    feedbackEl.innerHTML = escapeDisplayText(message);
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
        const arHtml = escapeDisplayText(row.ar);
        const trLine = row.tr && row.tr !== "—" && row.tr.trim() !== row.ar.trim()
          ? `<span class="match-item-ar-tr rtl">${escapeDisplayText(row.tr)}</span>`
          : "";
        const arClass = row.hasArabic ? "match-item-ar-main rtl ar" : "match-item-ar-main rtl";
        b.innerHTML = `
          <span class="${arClass}">${arHtml}</span>
          ${trLine}
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
    state.pairs = chosen.map((e) => {
      const primary = entryPrimaryForeign(e);
      return {
        id: e.id,
        ar: primary.text,
        hasArabic: primary.hasArabic,
        he: fmtHe(e.he),
        tr: fmtTr(e)
      };
    });
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
  setupSideToolbar(DEFAULT_STUDY_LESSON_CODE, lessons, "test");
  const sideHomeBtn = byId("btn-side-home");
  if(sideHomeBtn){
    sideHomeBtn.href = "index.html";
  }
  const testLessonSelect = byId("test-lesson-select");
  if(testLessonSelect){
    const unifiedLesson = getUnifiedVocabLesson(lessons);
    const selectedLesson = unifiedLesson || lessons[0];
    testLessonSelect.innerHTML = `<option value="${selectedLesson.code}">${DEFAULT_STUDY_TITLE}</option>`;
    testLessonSelect.value = selectedLesson.code;
    testLessonSelect.disabled = true;
    testLessonSelect.style.display = "none";
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
  const runWrapEl = byId("run-wrap");
  if(!runWrapEl) return;

  const lessons = await loadLessonMeta();
  setupSideToolbar(DEFAULT_STUDY_LESSON_CODE, lessons, "test_run");

  const packId = getParam("pack");
  if(!packId) return;

  const payload = sessionStorage.getItem(packId);
  if(!payload){
    runWrapEl.innerHTML = `<div class="notice">החבילה לא נמצאה (אולי ריעננתם). חזרו ללמידה למבחן והתחילו מחדש.</div>`;
    return;
  }

  let parsed = null;
  try{
    parsed = JSON.parse(payload);
  }catch(err){
    runWrapEl.innerHTML = `<div class="notice">שגיאה בטעינת חבילת התרגול. חזרו לעמוד הקודם והתחילו מחדש.</div>`;
    return;
  }

  const baseMode = normalizeTestMode(parsed?.mode);
  const variantParam = String(getParam("variant") || "").trim();
  let mode = baseMode;
  if(baseMode === TEST_MODE_HE_TO_TR_NIQQUD || baseMode === TEST_MODE_HE_TO_TR_PLAIN_TYPING){
    if(variantParam === "typing"){
      mode = TEST_MODE_HE_TO_TR_PLAIN_TYPING;
    }else if(variantParam === "mcq"){
      mode = TEST_MODE_HE_TO_TR_NIQQUD;
    }
  }

  const isHeToTrVariantMode = mode === TEST_MODE_HE_TO_TR_NIQQUD || mode === TEST_MODE_HE_TO_TR_PLAIN_TYPING;
  const modeLabel = TEST_MODE_LABELS[mode] || "תרגול";
  let questionPool = [];
  const isSentenceTranslationMode = mode === TEST_MODE_HE_TO_TR_NIQQUD
    || mode === TEST_MODE_TR_TO_HE
    || mode === TEST_MODE_HE_TO_TR_PLAIN_TYPING;
  const isTypedTranslitMode = mode === TEST_MODE_HE_TO_TR_PLAIN_TYPING;

  try{
    if(isSentenceTranslationMode){
      const sentencePath = mode === TEST_MODE_TR_TO_HE
        ? TRANSLIT_TO_HEBREW_PATH
        : SENTENCE_TRANSLATION_PATH;
      const payloadRows = await loadJson(sentencePath);
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
      const greetingsRows = await loadGreetingsRows();
      questionPool = buildQuestionPoolFromGreetings(greetingsRows, true);
    }
  }catch(err){
    console.error(err);
    runWrapEl.innerHTML = `<div class="notice">שגיאה בטעינת נתוני התרגול. נסו שוב בעוד רגע.</div>`;
    return;
  }

  const itemCount = questionPool.length;
  if(itemCount === 0){
    runWrapEl.innerHTML = `<div class="notice">אין כרגע מספיק פריטים לחלק שבחרתם. נסו חלק אחר.</div>`;
    return;
  }

  const runOverline = byId("run-overline");
  if(runOverline){
    runOverline.textContent = "למידה למבחן";
  }
  byId("run-title").textContent = modeLabel;

  const runWrap = runWrapEl;
  runWrap.innerHTML = "";

  if(isHeToTrVariantMode){
    const switchNav = document.createElement("div");
    switchNav.className = "test-run-mode-nav";
    const baseHref = `test-run.html?pack=${encodeURIComponent(packId)}`;
    const mcqHref = `${baseHref}&variant=mcq`;
    const typingHref = `${baseHref}&variant=typing`;
    switchNav.innerHTML = `
      <a class="btn ${mode === TEST_MODE_HE_TO_TR_NIQQUD ? "primary" : ""}" href="${mcqHref}">בחירה</a>
      <a class="btn ${mode === TEST_MODE_HE_TO_TR_PLAIN_TYPING ? "primary" : ""}" href="${typingHref}">הקלדה (בלי ניקוד)</a>
    `;
    runWrap.appendChild(switchNav);
  }

  if(mode === TEST_MODE_SENTENCE_COMPLETION){
    const tips = ["יא זלמה", "מש עארף", "ואללה", "יעני"];

    const tipsToggle = document.createElement("button");
    tipsToggle.type = "button";
    tipsToggle.className = "test-tips-toggle";
    tipsToggle.textContent = "טיפים לחלק זה (מילים שימושיות)";

    const tipsBox = document.createElement("div");
    tipsBox.className = "notice test-tips-box";
    tipsBox.innerHTML = `
      <div class="test-tips-list">
        ${tips.map((tip) => `
          <div class="test-tip-item">
            <span class="test-tip-he">${tip}</span>
          </div>
        `).join("")}
      </div>
    `;

    tipsToggle.addEventListener("click", () => {
      tipsBox.classList.toggle("open");
      tipsToggle.textContent = tipsBox.classList.contains("open")
        ? "הסתר טיפים"
        : "טיפים לחלק זה (מילים שימושיות)";
    });

    runWrap.appendChild(tipsToggle);
    runWrap.appendChild(tipsBox);
  }

  const gameWrap = document.createElement("div");
  gameWrap.id = "game-wrap";
  runWrap.appendChild(gameWrap);

  if(isTypedTranslitMode){
    runTypingQuiz({
      questionPool,
      scope: `test:${mode}`,
      promptClass: "quiz-prompt-main quiz-prompt-main-sentence rtl"
    });
    return;
  }

  runChoiceQuiz({
    questionPool,
    scope: `test:${mode}`,
    singleColumn: isSentenceTranslationMode || mode === TEST_MODE_SENTENCE_COMPLETION
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initSideToolbarDrawer();
  applyArabicVisibility(readArabicVisibility());
  renderLessonCards().catch(console.error);
  initLessonPage().catch(console.error);
  initGamePage().catch(console.error);
  initTestPage().catch(console.error);
  initTestRunPage().catch(console.error);
});
