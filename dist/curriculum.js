'use strict';

const CURRICULUM_SKILLS = CURRICULUM.flatMap(phase => phase.skills);
const MINUTE = 60000;
const INITIAL_HALF_LIFE = 45 * MINUTE;
const MAX_HALF_LIFE = 180 * 24 * 60 * MINUTE;
const FOCUS_WINDOW = 4;
const ADVANCE_COOLDOWN = 10 * MINUTE;

function emptyTrace() {
  return { recent: [], timings: [], halfLife: INITIAL_HALF_LIFE, lastAnswered: 0, lastAsked: 0 };
}

function courseMemory(progress) {
  const old = progress.curriculum ||= {};
  if (old.courseV2) return old.courseV2;
  const course = old.courseV2 = { concepts: {}, items: {} };
  for (const skill of CURRICULUM_SKILLS) {
    const semis = skill.intervals?.[0];
    const legacyGroup = semis && ({1:'seconds',2:'seconds',3:'thirds',4:'thirds',5:'perfect-intervals',7:'perfect-intervals',8:'sixths',9:'sixths',10:'seventh-intervals',11:'seventh-intervals',6:'tritone-octave',12:'tritone-octave'})[semis];
    const records = Object.values(old[skill.id] || old[legacyGroup] || {}).filter(x => x && Number.isFinite(x.lastPracticed));
    if (!records.length) continue;
    records.sort((a,b) => a.lastPracticed - b.lastPracticed);
    const recent = records.flatMap(x => semis ? x.intervalHistory?.[semis] || [] : x.recent || []).filter(x => typeof x === 'boolean').slice(-10);
    if (!recent.length) continue;
    const trace = course.concepts[skill.id] = emptyTrace();
    trace.recent = recent;
    trace.lastAnswered = trace.lastAsked = records.at(-1).lastPracticed;
    trace.learned = records.some(x => x.mastered) && recent.filter(Boolean).length >= Math.min(5, recent.length) && recent.length >= 2;
  }
  return course;
}

function retention(trace, now) {
  if (!trace?.lastAnswered) return 0;
  return 2 ** (-Math.max(0, now - trace.lastAnswered) / trace.halfLife);
}

function medianTime(samples) {
  if (!samples?.length) return null;
  return [...samples].sort((a,b) => a - b)[Math.floor(samples.length / 2)];
}

// Latency grows as retrieval becomes harder. The initial slope is a scheduling
// prior; clean, delayed recalls calibrate it separately for each learner.
function latencyMultiplier(trace, now) {
  const retentionFloor = Math.max(0.05, retention(trace, now));
  return Math.min(5, retentionFloor ** -(trace.latencySlope ?? 1.75));
}

function reviewNeed(trace, now, baseline) {
  if (!trace?.recent.length) return 1.4;
  const misses = trace.recent.slice(-5).filter(ok => !ok).length / Math.min(5, trace.recent.length);
  const latency = medianTime(trace.timings.slice(-3));
  const slowing = baseline && latency ? Math.min(2, Math.max(0, latency / baseline - 1)) : 0;
  return 0.2 + 2 * (1 - retention(trace, now)) + 2 * misses + slowing + 0.2 * (latencyMultiplier(trace, now) - 1);
}

function knowledgeStrength(trace) {
  return trace?.solidified ?? proficiencyPoints(trace);
}

function practiceWeight(trace, now) {
  const strength = knowledgeStrength(trace) * retention(trace, now);
  return reviewNeed(trace, now, trace?.baseline) / (1 + strength / 50);
}

function lastPresented(trace) {
  return trace?.lastAsked || trace?.lastAnswered || 0;
}

function setLearningFocus(progress, skill, key) {
  return courseMemory(progress).pacing = { skillId: skill.id, key, outcomes: [] };
}

function learningFocus(progress) {
  const course = courseMemory(progress);
  if (course.pacing) return course.pacing;
  const saved = course.focus;
  let skill = CURRICULUM_SKILLS.find(entry => entry.id === saved?.skillId);
  if (!skill) {
    skill = CURRICULUM_SKILLS.reduce((latest, entry) =>
      lastPresented(course.concepts[entry.id]) > lastPresented(course.concepts[latest.id]) ? entry : latest);
  }
  let key = null;
  if (skill.scales) {
    if (saved?.skillId === skill.id && COURSE_KEYS.some(root => root.name === saved.key)) key = saved.key;
    else {
      key = skill.starterKey;
      let latest = 0;
      for (const root of COURSE_KEYS) {
        const seen = lastPresented(rootTrace(course.concepts[skill.id], root.name));
        if (seen <= latest) continue;
        latest = seen;
        key = root.name;
      }
    }
  }
  return setLearningFocus(progress, skill, key);
}

function recordFocusOutcome(progress, prompt, recalled) {
  const focus = learningFocus(progress);
  if (prompt.skill.id !== focus.skillId || (focus.key !== null && focus.key !== prompt.statRoot)) return;
  focus.outcomes.push(recalled ? prompt.statRoot : null);
  if (focus.outcomes.length > FOCUS_WINDOW) focus.outcomes.shift();
}

function onlyRecallPitch(outcomes) {
  let pc = null;
  for (const root of outcomes) {
    if (root === null) continue;
    const next = pcOf(root);
    if (pc !== null && pc !== next) return null;
    pc = next;
  }
  return pc;
}

function focusReady(focus) {
  const outcomes = focus.outcomes;
  if (outcomes.at(-1) == null) return false;
  let clean = 0;
  for (const root of outcomes) if (root !== null) clean += 1;
  return clean >= 3 && (focus.key !== null || onlyRecallPitch(outcomes) === null);
}

function selectReview(course, focus, now) {
  const weighted = [];
  let oldest = Infinity;
  let overdue;
  let totalWeight = 0;
  const consider = (skill, key, trace) => {
    const presented = lastPresented(trace);
    if (!presented || (skill.id === focus?.skillId && key === focus.key)) return;
    if (trace.lastAnswered && now - trace.lastAnswered >= trace.halfLife) {
      if (presented < oldest) {
        oldest = presented;
        overdue = { skill, key, role: 'review' };
      }
    } else if (!overdue) {
      const weight = practiceWeight(trace, now);
      weighted.push({ skill, key, weight });
      totalWeight += weight;
    }
  };
  for (const skill of CURRICULUM_SKILLS) {
    const trace = course.concepts[skill.id];
    if (skill.scales) {
      for (const {name} of COURSE_KEYS) consider(skill, name, rootTrace(trace, name));
    } else consider(skill, null, trace);
  }
  if (overdue) return overdue;
  let point = weighted.length ? Math.random() * totalWeight : 0;
  for (const {skill, key, weight} of weighted) {
    point -= weight;
    if (point <= 0) return { skill, key, role: 'review' };
  }
  const last = weighted.at(-1);
  return last ? { skill: last.skill, key: last.key, role: 'review' } : null;
}

function scheduledLesson(progress, round, now = Date.now()) {
  const course = courseMemory(progress);
  const focus = learningFocus(progress);
  const skill = CURRICULUM_SKILLS.find(entry => entry.id === focus.skillId);
  const ready = focusReady(focus);
  const reviewOnly = ready && !nextCurriculumEntry(course, focus);
  const slot = (round - 1) % 3;
  if (reviewOnly || slot === 2 || (slot === 1 && ready)) {
    const review = selectReview(course, reviewOnly ? null : focus, now);
    if (review) return review;
  }
  return { skill, key: focus.key, role: 'focus' };
}

const PROFICIENCY_WINDOW = 20;
const ROOT_STREAK = 4;

function proficiencyPoints(trace) {
  if (trace?.points != null) return trace.points;
  const clean = trace?.recent.filter(Boolean).length || 0;
  return Math.min(100, clean * 100 / 8);
}

function rootTrace(trace, root) {
  const saved = trace?.rootTraces?.[root];
  if (saved) return saved;
  const recent = trace?.roots?.[root];
  return recent?.length ? {...emptyTrace(), recent, lastAnswered: trace.lastAnswered, halfLife: trace.halfLife} : null;
}

function rootProficient(trace, root) {
  const recent = rootTrace(trace, root)?.recent.slice(-ROOT_STREAK) || [];
  return recent.length === ROOT_STREAK && recent.every(Boolean);
}

function proficient(skill, trace) {
  return Boolean(trace && proficiencyPoints(trace) >= 80 &&
    trace.recent.length >= PROFICIENCY_WINDOW &&
    trace.recent.filter(Boolean).length >= 18 &&
    COURSE_KEYS.every(key => rootProficient(trace, key.name)));
}

function nextCurriculumEntry(course, focus) {
  const index = CURRICULUM_SKILLS.findIndex(skill => skill.id === focus.skillId);
  for (let offset = 1; offset < CURRICULUM_SKILLS.length; offset += 1) {
    const skill = CURRICULUM_SKILLS[(index + offset) % CURRICULUM_SKILLS.length];
    if (!lastPresented(course.concepts[skill.id])) return { skill, key: skill.starterKey ?? null };
  }
  for (const skill of CURRICULUM_SKILLS) {
    if (!skill.scales) continue;
    const trace = course.concepts[skill.id];
    for (const {name: key} of COURSE_KEYS) {
      if (skill.id === focus.skillId && key === focus.key) continue;
      if (!lastPresented(rootTrace(trace, key))) return { skill, key };
    }
  }
  return null;
}

function advancement(progress, now = Date.now()) {
  const course = courseMemory(progress);
  const focus = learningFocus(progress);
  return now >= (course.offerAfter || 0) && focusReady(focus) ? nextCurriculumEntry(course, focus) : null;
}

function itemPriority(progress, itemId, skill, now = Date.now()) {
  const {items, concepts} = courseMemory(progress);
  const item = items[itemId];
  if (!item) return 1.5;
  const age = Math.max(0, now - item.lastAsked);
  return practiceWeight(item, now) * (0.08 + Math.min(1, age / (2 * MINUTE)));
}

function markPresented(progress, prompt, now = Date.now()) {
  const {items, concepts} = courseMemory(progress);
  const item = items[prompt.itemId] ||= emptyTrace();
  const concept = concepts[prompt.skill.id] ||= emptyTrace();
  item.lastAsked = concept.lastAsked = now;
  const roots = concept.rootTraces ||= {};
  const root = roots[prompt.statRoot] ||= rootTrace(concept, prompt.statRoot) || emptyTrace();
  root.lastAsked = now;
}

function updateTrace(trace, clean, ms, now, baseline) {
  const recall = retention(trace, now);
  const strength = knowledgeStrength(trace);
  trace.solidified = clean
    ? strength + 2 + 4 * (1 - recall)
    : Math.max(0, strength * 0.85 - 6);
  if (trace.lastAnswered) {
    if (ms && baseline && recall > 0.05 && recall < 0.9) {
      const observedSlope = Math.min(3, Math.max(0, Math.log(ms / baseline) / -Math.log(recall)));
      trace.latencySlope = (trace.latencySlope ?? 1.75) * 0.75 + observedSlope * 0.25;
    }
    const speed = ms && baseline ? Math.min(1.2, Math.max(0.4, baseline / ms)) : 1;
    const factor = clean ? 1.005 + 0.7 * (1 - recall) * speed : 0.52;
    trace.halfLife = Math.min(MAX_HALF_LIFE, Math.max(5 * MINUTE, trace.halfLife * factor));
  }
  trace.recent = [...trace.recent, clean].slice(-PROFICIENCY_WINDOW);
  if (ms) trace.timings = [...trace.timings, ms].slice(-21);
  trace.lastAnswered = now;
}

function recordLesson(progress, prompt, clean, responseMs, now = Date.now()) {
  const {items, concepts} = courseMemory(progress);
  const item = items[prompt.itemId] ||= emptyTrace();
  const concept = concepts[prompt.skill.id] ||= emptyTrace();
  const ms = clean && Number.isFinite(responseMs) && responseMs > 0 ? responseMs : null;
  updateTrace(item, clean, ms, now, concept.baseline);
  const points = proficiencyPoints(concept);
  concept.solidified ??= points;
  concept.points = Math.max(0, Math.min(100, points + (clean ? 2 : -6)));
  updateTrace(concept, clean, ms, now, concept.baseline);
  if (concept.timings.length >= 3) {
    const sorted = [...concept.timings].sort((a,b) => a - b);
    concept.baseline = sorted[Math.floor(sorted.length / 3)];
  }
  const roots = concept.rootTraces ||= {};
  const root = roots[prompt.statRoot] ||= rootTrace(concept, prompt.statRoot) || emptyTrace();
  root.solidified ??= proficiencyPoints(root);
  root.points = Math.max(0, Math.min(100, proficiencyPoints(root) + (clean ? 2 : -6)));
  updateTrace(root, clean, ms, now, concept.baseline);
  if (clean) concept.examples = [...new Set([...(concept.examples || []), prompt.itemId])].slice(-10);
  if (proficient(prompt.skill, concept)) concept.learned = true;
}

function renderCurriculum() {
  renderModes();
  const progress = state.progress;
  const course = courseMemory(progress);
  const focus = learningFocus(progress);
  const skill = CURRICULUM_SKILLS.find(entry => entry.id === focus.skillId);
  const ready = focusReady(focus);
  const reviewOnly = ready && !nextCurriculumEntry(course, focus);
  const focusLabel = focus.key ? curriculumRootLabel(skill, focus.key) : skill.label;
  const suggestion = reviewOnly ? 'Review · Introduced lessons' : `Focus · ${focusLabel}`;
  const session = state.session;
  const active = session?.finished ? null : session?.prompt;
  const panel = active?.practiceRole === 'review'
    ? `Review · ${active.skill.scales ? curriculumRootLabel(active.skill, active.statRoot) : active.skill.label}`
    : suggestion + (ready && !reviewOnly ? ' · Ready to try more' : '');
  $('#free-suggestion').textContent = suggestion;
  $('#curriculum-next').textContent = panel;
  const list = $('#curriculum-phases');
  list.replaceChildren();
  for (const group of CURRICULUM) {
    const row = document.createElement('li');
    const heading = document.createElement('strong');
    heading.textContent = group.title;
    const skills = document.createElement('ul');
    for (const entry of group.skills) {
      const item = document.createElement('li');
      const status = !reviewOnly && entry === skill ? (ready ? 'Ready to try more' : 'Current focus')
        : lastPresented(course.concepts[entry.id]) ? 'In review rotation' : 'Upcoming';
      item.textContent = `${entry.label} · ${status}`;
      skills.append(item);
    }
    row.append(heading, skills);
    list.append(row);
  }
}
