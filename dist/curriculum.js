'use strict';

const CURRICULUM_KEYS = ['C', 'F', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb'];
const MINUTE = 60000;
const INITIAL_HALF_LIFE = 45 * MINUTE;
const MAX_HALF_LIFE = 180 * 24 * 60 * MINUTE;

function emptyTrace() {
  return { recent: [], timings: [], halfLife: INITIAL_HALF_LIFE, lastAnswered: 0, lastAsked: 0 };
}

function courseMemory(progress) {
  const old = progress.curriculum ||= {};
  if (old.courseV2) return old.courseV2;
  const course = old.courseV2 = { concepts: {}, items: {} };
  for (const skill of CURRICULUM.flatMap(phase => phase.skills)) {
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

function curriculumRecommendation(progress, now = Date.now()) {
  const {concepts} = courseMemory(progress);
  const started = reviewGroups(progress).flat();
  const due = started.filter(skill => {
    const trace = concepts[skill.id];
    return retention(trace, now) < 0.6 || practiceWeight(trace, now) >= 1;
  });
  const skill = due[0] || [...started].sort((a,b) =>
    practiceWeight(concepts[b.id], now) - practiceWeight(concepts[a.id], now))[0];
  const trace = concepts[skill.id];
  const roots = skill.scales ? COURSE_KEYS.filter(key => rootTrace(trace, key.name)?.lastAsked) : [];
  roots.sort((a,b) => practiceWeight(rootTrace(trace, b.name), now) - practiceWeight(rootTrace(trace, a.name), now));
  return {skill, key: roots[0]?.name, reason: due.length ? 'Refresh' : 'Practice'};
}

function reviewGroups(progress) {
  const {concepts} = courseMemory(progress);
  const groups = CURRICULUM.map(phase => phase.skills.filter(skill => concepts[skill.id]?.lastAsked))
    .filter(group => group.length);
  return groups.length ? groups : [[CURRICULUM[0].skills[0]]];
}

function reviewSkill(progress, now = Date.now()) {
  const {concepts} = courseMemory(progress);
  const pool = reviewGroups(progress).flat();
  let point = Math.random() * pool.reduce((sum, skill) => sum + practiceWeight(concepts[skill.id], now), 0);
  for (const skill of pool) {
    point -= practiceWeight(concepts[skill.id], now);
    if (point <= 0) return skill;
  }
  return pool.at(-1);
}

function learningFocus(progress) {
  const course = courseMemory(progress);
  if (course.focus) return course.focus;
  const started = reviewGroups(progress).flat();
  const latest = [...started].sort((a,b) =>
    (course.concepts[b.id]?.lastAsked || 0) - (course.concepts[a.id]?.lastAsked || 0))[0];
  const trace = course.concepts[latest.id];
  course.focus = {
    skillId: latest.id,
    key: latest.scales ? COURSE_KEYS.filter(key => rootTrace(trace, key.name)?.lastAsked)
      .sort((a,b) => rootTrace(trace, b.name).lastAsked - rootTrace(trace, a.name).lastAsked)[0]?.name || 'C' : null,
    clean: Math.min(10, trace?.recent.filter(Boolean).length || 0)
  };
  return course.focus;
}

function scheduledLesson(progress, round) {
  const course = courseMemory(progress);
  const focus = learningFocus(progress);
  const skill = CURRICULUM.flatMap(group => group.skills).find(skill => skill.id === focus.skillId);
  const started = reviewGroups(progress).flat();
  const trace = course.concepts[skill.id];
  const roots = skill.scales ? COURSE_KEYS.filter(key => rootTrace(trace, key.name)?.lastAsked) : [];
  const entries = started.length + Math.max(0, roots.length - 1);
  const focusTurn = focus.clean < 10 && entries === 1 ||
    entries === 2 && round % 2 === 1 ||
    entries !== 2 && round % 3 === 1;
  if (focusTurn) return {skill, key: focus.key};
  return {skill: reviewSkill(progress)};
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

function nextScaleRoot(trace) {
  return COURSE_KEYS.find(key => !rootTrace(trace, key.name)?.lastAsked &&
    !rootTrace(trace, key.name)?.lastAnswered)?.name;
}

function curriculumSteps() {
  return CURRICULUM.flatMap(group => {
    if (group.skills.some(skill => skill.id === 'major')) {
      const major = group.skills.find(skill => skill.id === 'major');
      const minor = group.skills.find(skill => skill.id === 'natural-minor');
      const common = COURSE_KEYS.flatMap(key => [
        {skill: major, key: key.name},
        {skill: minor, key: spellDegree(key.name, 6, 9)}
      ]);
      const valid = common.filter(step => COURSE_KEYS.some(key => key.name === step.key));
      const remaining = COURSE_KEYS.filter(key => !valid.some(step => step.skill === minor && step.key === key.name))
        .map(key => ({skill: minor, key: key.name}));
      return [...valid, ...remaining, ...group.skills.filter(skill => !['major', 'natural-minor'].includes(skill.id))
        .flatMap(skill => COURSE_KEYS.map(key => ({skill, key: key.name})))];
    }
    return group.skills.flatMap(skill => skill.scales
      ? COURSE_KEYS.map(key => ({skill, key: key.name})) : [{skill}]);
  });
}

function advancement(progress, now) {
  const course = courseMemory(progress);
  if (now < (course.offerAfter || 0)) return null;
  const focus = learningFocus(progress);
  for (const step of curriculumSteps()) {
    const trace = course.concepts[step.skill.id];
    const memory = step.key ? rootTrace(trace, step.key) : trace;
    if (!memory?.lastAsked && !memory?.lastAnswered) return step;
    if (step.key) {
      if (focus.skillId === step.skill.id && focus.key === step.key && focus.clean < 10) return null;
      const recent = memory.recent.slice(-10);
      if (recent.length < 10 || recent.filter(Boolean).length < 8) return null;
    } else if (!proficient(step.skill, trace)) return null;
  }
  return null;
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
  const focus = courseMemory(progress).focus;
  if (focus?.skillId === prompt.skill.id && (!focus.key || focus.key === prompt.statRoot)) {
    focus.clean = clean ? focus.clean + 1 : Math.max(0, focus.clean - 2);
  }
  if (proficient(prompt.skill, concept)) concept.learned = true;
}

function renderCurriculum() {
  renderModes();
  const now = Date.now();
  const {concepts} = courseMemory(state.progress);
  const next = curriculumRecommendation(state.progress, now);
  $('#free-suggestion').textContent = next.reason + ' · ' + (next.key ? curriculumRootLabel(next.skill, next.key) : next.skill.label);
  const phase = CURRICULUM.find(p => p.skills.includes(next.skill));
  $('#curriculum-next').textContent = `${phase.title} · ${next.reason}: ${next.skill.label}`;
  const list = $('#curriculum-phases');
  list.replaceChildren();
  for (const group of CURRICULUM) {
    const row = document.createElement('li');
    const heading = document.createElement('strong');
    heading.textContent = group.title;
    const skills = document.createElement('ul');
    for (const skill of group.skills) {
      const item = document.createElement('li');
      const trace = concepts[skill.id];
      const status = trace?.learned ? retention(trace, now) < 0.6 ? 'Ready for review' : 'In review rotation' : skill === next.skill ? 'Current lesson' : 'Upcoming';
      item.textContent = `${skill.label} · ${status}`;
      skills.append(item);
    }
    row.append(heading, skills);
    list.append(row);
  }
}
