'use strict';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const mod = (value, length = 12) => ((value % length) + length) % length;
const choose = (items) => items[Math.floor(Math.random() * items.length)];
const rand = (max) => Math.floor(Math.random() * max);

const KEYS = [
  { name: 'C', pc: 0 }, { name: 'G', pc: 7 }, { name: 'D', pc: 2 },
  { name: 'A', pc: 9 }, { name: 'E', pc: 4 }, { name: 'B', pc: 11 },
  { name: 'F#', pc: 6 }, { name: 'Db', pc: 1 }, { name: 'Ab', pc: 8 },
  { name: 'Eb', pc: 3 }, { name: 'Bb', pc: 10 }, { name: 'F', pc: 5 }
];
const COURSE_KEYS = [
  ...['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map((name, pc) => ({name, pc})),
  ...['Db','Eb','Gb','Ab','Bb'].map((name, i) => ({name, pc:[1,3,6,8,10][i]}))
];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const PRETTY = (value) => value.replaceAll('#', '♯').replaceAll('b', '♭');
const NOTE_NAMES = (pc, preferFlats = false) => (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod(pc)];
const pcName = (pc, key = null) => PRETTY(NOTE_NAMES(pc, key?.name?.includes('b')));
const noteOctave = (note) => `${pcName(note)}${Math.floor(note / 12) - 1}`;
const pcOf = (rootName) => {
  const match = /^([A-G])(#*|b*)$/.exec(rootName);
  if (!match) throw new Error(`Invalid note: ${rootName}`);
  const index = LETTERS.indexOf(match[1]);
  const accidental = match[2];
  return mod(NATURAL_PCS[index] + accidental.length * (accidental.startsWith('b') ? -1 : 1));
};
const spellDegree = (rootName, degree, semitones) => {
  const index = LETTERS.indexOf(rootName[0]);
  const targetLetter = mod(index + degree - 1, 7);
  const targetPc = mod(pcOf(rootName) + semitones);
  let alteration = mod(targetPc - NATURAL_PCS[targetLetter]);
  if (alteration > 6) alteration -= 12;
  return LETTERS[targetLetter] + (alteration > 0 ? '#'.repeat(alteration) : 'b'.repeat(-alteration));
};
const scaleNameAt = (key, degreeIndex) => spellDegree(key.name, degreeIndex + 1, MAJOR[degreeIndex]);
const makeTones = (root, specs) => specs.map(([degree, semis]) => ({
  pc: mod(pcOf(root) + semis), name: spellDegree(root, degree, semis), degree
}));

const CHORD_TYPES = {
  major: { suffix: '', formula: '1 · 3 · 5', specs: [[1, 0], [3, 4], [5, 7]], quality: 'major triad' },
  minor: { suffix: 'm', formula: '1 · ♭3 · 5', specs: [[1, 0], [3, 3], [5, 7]], quality: 'minor triad' },
  sus2: { suffix: "sus2", formula: "1 · 2 · 5", specs: [[1, 0], [2, 2], [5, 7]], quality: "suspended second" },
  sus4: { suffix: "sus4", formula: "1 · 4 · 5", specs: [[1, 0], [4, 5], [5, 7]], quality: "suspended fourth" },
  diminished: { suffix: 'dim', formula: '1 · ♭3 · ♭5', specs: [[1, 0], [3, 3], [5, 6]], quality: 'diminished triad' },
  maj7: { suffix: 'maj7', formula: '1 · 3 · 5 · 7', specs: [[1, 0], [3, 4], [5, 7], [7, 11]], quality: 'major seventh' },
  m7: { suffix: 'm7', formula: '1 · ♭3 · 5 · ♭7', specs: [[1, 0], [3, 3], [5, 7], [7, 10]], quality: 'minor seventh' },
  dom7: { suffix: '7', formula: '1 · 3 · 5 · ♭7', specs: [[1, 0], [3, 4], [5, 7], [7, 10]], quality: 'dominant seventh' },
  halfdim: { suffix: 'm7♭5', formula: '1 · ♭3 · ♭5 · ♭7', specs: [[1, 0], [3, 3], [5, 6], [7, 10]], quality: 'half-diminished seventh' }
};
const DIATONIC_TYPES = ['maj7', 'm7', 'm7', 'maj7', 'dom7', 'm7', 'halfdim'];
const TRIAD_TYPES = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'];
const DEGREE_LABELS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const SCALE_TYPES = [
  { id: 'major', label: 'major', steps: [0, 2, 4, 5, 7, 9, 11, 12], theory: 'W – W – H – W – W – W – H' },
  { id: 'minor', label: 'natural minor', steps: [0, 2, 3, 5, 7, 8, 10, 12], theory: 'W – H – W – W – H – W – W' },
  { id: 'dorian', label: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10, 12], theory: 'Minor color with a natural sixth' },
  { id: 'mixolydian', label: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10, 12], theory: 'Major color with a flat seventh' },
  { id: 'harmonic', label: 'harmonic minor', steps: [0, 2, 3, 5, 7, 8, 11, 12], theory: 'Natural minor with a raised seventh' },
  { id: 'melodic', label: 'jazz melodic minor', steps: [0, 2, 3, 5, 7, 9, 11, 12], theory: 'Jazz ascending melodic minor: 1 2 ♭3 4 5 6 7' }
];
const ROUND_COUNT = 10;
const HISTORY_LENGTH = 10;
const INTERVAL_SYMBOLS = ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
const INTERVALS = [
  { name: 'minor second', semis: 1, degree: 2 }, { name: 'major second', semis: 2, degree: 2 },
  { name: 'minor third', semis: 3, degree: 3 }, { name: 'major third', semis: 4, degree: 3 },
  { name: 'perfect fourth', semis: 5, degree: 4 }, { name: 'tritone (augmented fourth)', semis: 6, degree: 4 },
  { name: 'perfect fifth', semis: 7, degree: 5 }, { name: 'minor sixth', semis: 8, degree: 6 },
  { name: 'major sixth', semis: 9, degree: 6 }, { name: 'minor seventh', semis: 10, degree: 7 },
  { name: 'major seventh', semis: 11, degree: 7 }, { name: 'octave', semis: 12, degree: 8 }
];
const MODES = [
  { id: 'notes', title: 'Note Dash', sub: 'Instant note recognition', summary: 'Find requested notes instantly, in any octave.', kicker: 'LOCATE THE NOTE', intro: 'Lightning-fast note recognition. No guessing, no counting.' },
  { id: 'intervals', title: 'Interval Hunter', sub: 'Hear theory in distances', summary: 'Calculate intervals from a root and locate their notes.', kicker: 'FIND THE INTERVAL', intro: 'Learn the distances that build every chord and scale.' },
  { id: 'scales', title: 'Scale Sprint', sub: 'Patterns in every key', summary: 'Play an ascending octave, note by note, in the correct order.', kicker: 'PLAY THE ASCENDING SCALE', intro: 'Turn scale formulas into reliable muscle memory.' },
  { id: 'chords', title: 'Chord Forge', sub: 'Build chords from memory', summary: 'Construct triads and seventh chords, in any inversion.', kicker: 'BUILD THE CHORD', intro: 'Translate chord symbols into the notes beneath your fingers.' },
  { id: 'inversions', title: 'Inversion Lab', sub: 'Know every chord shape', summary: 'Construct a chord with its specified note in the bass.', kicker: 'VOICE THE INVERSION', intro: 'Keep the harmony; rearrange the notes and master the bass.' },
  { id: 'guides', title: 'Guide-Tone Glide', sub: 'Jazz voice leading', summary: 'Move through ii–V–I using only thirds and sevenths.', kicker: 'CONNECT THE VOICES', intro: 'The secret of jazz voice leading: tiny, purposeful note movement.' },
  { id: 'voicings', title: 'Voicing Studio', sub: 'Shells & rootless color', summary: 'Play shell voicings, rootless ninths/thirteenths, and altered chords.', kicker: 'COLOR THE HARMONY', intro: 'Build compact jazz voicings that leave space for the bass.' },
  { id: 'cadence', title: 'Cadence Quest', sub: 'ii–V–I fluency', summary: 'Connect complete seventh chords through a ii–V–I progression.', kicker: 'PLAY THE PROGRESSION', intro: 'Make the most important jazz cadence feel inevitable.' }
];
const ACHIEVEMENTS = [
  { id: 'first', symbol: '✦', title: 'First Contact', description: 'Clear your first challenge', unlocked: (p) => p.correct >= 1 },
  { id: 'streak', symbol: '⚡', title: 'On a Roll', description: 'Reach an 8-round combo', unlocked: (p) => p.bestStreak >= 8 },
  { id: 'scales', symbol: '♮', title: 'Scale Explorer', description: 'Complete 10 scale drills', unlocked: (p) => (p.modeStats.scales?.correct || 0) >= 10 },
  { id: 'jazz', symbol: '♭', title: 'Jazz Apprentice', description: 'Clear 10 guide-tone or voicing drills', unlocked: (p) => (p.modeStats.guides?.correct || 0) + (p.modeStats.voicings?.correct || 0) >= 10 },
  { id: 'keys', symbol: '◎', title: 'Circle Complete', description: 'Play successfully in all 12 keys', unlocked: (p) => KEYS.every((key) => (p.keyStats[key.name]?.correct || 0) > 0) },
  { id: 'century', symbol: '★', title: 'Centurion', description: 'Complete 100 challenges', unlocked: (p) => p.correct >= 100 }
];
const QUESTS = [
  { id: 'rounds', title: 'Repetition is power', desc: 'Clear 6 challenges', target: 6, symbol: '◎' },
  { id: 'notes', title: 'Hands on keys', desc: 'Play 30 notes', target: 30, symbol: '♬' },
  { id: 'jazz', title: 'Jazz moves', desc: 'Clear 2 jazz harmony challenges', target: 2, symbol: '♯' }
];
const STORAGE_KEY = 'keycraft-midi-arcade-v1';
const SPEECH_KEY = 'keycraft-spoken-prompts';
const browserVoiceAvailable = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
const speechAvailable = browserVoiceAvailable || neuralVoiceAvailable;
const spokenNote = note => PRETTY(note).replace(/^A/, 'Eh').replaceAll('♯', ' sharp').replaceAll('♭', ' flat');
let spokenPrompts = speechAvailable;
let voiceEngine = browserVoiceAvailable ? 'browser' : 'neural';
let promptRequest = 0;
let playingPrompt;
let speechTimingTimeout;
try {
  spokenPrompts = speechAvailable && localStorage.getItem(SPEECH_KEY) !== 'off';
  if (neuralVoiceAvailable && localStorage.getItem('keycraft-voice-engine') === 'neural') voiceEngine = 'neural';
} catch {}

function stopSpeech() {
  promptRequest += 1;
  releaseSpeechClock();
  if (browserVoiceAvailable) window.speechSynthesis.cancel();
  if (playingPrompt) {
    playingPrompt.audio.pause();
    URL.revokeObjectURL(playingPrompt.url);
    playingPrompt = undefined;
  }
  $('#speech-status').textContent = '';
}

function syncResponseClock(response, now = performance.now()) {
  if (response.waiting || document.hidden) response.pausedAt ??= now;
  else if (response.pausedAt !== null) {
    response.pausedMs += now - response.pausedAt;
    response.pausedAt = null;
  }
}

function holdSpeechClock() {
  const session = state.session;
  if (!session?.response || session.busy) return;
  session.response.waiting = true;
  syncResponseClock(session.response);
}

function releaseSpeechClock() {
  window.clearTimeout(speechTimingTimeout);
  const response = state.session?.response;
  if (!response?.waiting) return;
  response.waiting = false;
  syncResponseClock(response);
}

function speakWithBrowser(text, onDone) {
  if (!browserVoiceAvailable) { releaseSpeechClock(); return; }
  const request = promptRequest;
  holdSpeechClock();
  let done = false;
  const release = () => {
    if (done || request !== promptRequest) return;
    done = true;
    releaseSpeechClock();
    onDone?.();
  };
  const utterance = new window.SpeechSynthesisUtterance(text.replace(/\bEh\b/g, 'A,'));
  utterance.lang = 'en-US';
  utterance.onend = release;
  utterance.onerror = release;
  speechTimingTimeout = window.setTimeout(release, Math.max(12000, text.length * 120));
  window.speechSynthesis.speak(utterance);
}

async function speak(text, preparedAudio, onDone) {
  if (!speechAvailable || !text) return;
  if (playingPrompt?.text === text && playingPrompt.audio.paused) {
    holdSpeechClock();
    try {
      await playingPrompt.audio.play();
      $('#speech-status').textContent = '';
    } catch {
      releaseSpeechClock();
      $('#speech-status').textContent = 'Audio playback is blocked by the browser.';
    }
    return;
  }
  stopSpeech();
  if (voiceEngine === 'browser') {
    speakWithBrowser(text, onDone);
    return;
  }
  holdSpeechClock();
  const request = promptRequest;
  const isCurrent = () => request === promptRequest;
  const report = message => {
    if (isCurrent()) $('#speech-status').textContent = message;
  };
  try {
    let clip = preparedAudio ? await preparedAudio : undefined;
    if (!clip && isCurrent()) clip = await neuralPrompt(text, isCurrent, report);
    if (!isCurrent()) return;
    if (!clip) { releaseSpeechClock(); return; }
    const url = URL.createObjectURL(clip);
    const audio = new window.Audio(url);
    playingPrompt = { audio, url, text };
    audio.onended = () => {
      if (!isCurrent()) return;
      stopSpeech();
      onDone?.();
    };
    audio.onerror = () => { if (isCurrent()) stopSpeech(); };
    report('');
    await audio.play();
  } catch (error) {
    if (!isCurrent()) return;
    if (error.name === 'NotAllowedError') {
      releaseSpeechClock();
      $('#speech-status').textContent = 'Select Replay prompt to allow audio playback.';
    } else {
      stopSpeech();
      $('#speech-status').textContent = browserVoiceAvailable
        ? 'Neural voice unavailable. Using browser voice.'
        : 'Neural voice unavailable. Replay the prompt to retry.';
      speakWithBrowser(text, onDone);
    }
  }
}

function challengeSpeech(prompt, stage = 0) {
  return prompt.stages?.[stage]?.speech || prompt.speech;
}

function speakChallenge() {
  const session = state.session;
  if (!session?.prompt || session.busy) return;
  const text = challengeSpeech(session.prompt, session.stageIndex);
  const prepared = session.preparedAudio;
  if (spokenPrompts && !session.showingIntro) void speak(text, prepared?.text === text ? prepared.audio : undefined);
}

function prepareNextSpeech(session) {
  if (session.finished || !spokenPrompts || voiceEngine !== 'neural') return;
  const stage = session.stageIndex + 1;
  const prompt = session.prompt.stages?.[stage] ? session.prompt : session.nextPrompt;
  if (!prompt) return;
  const nextStage = prompt === session.prompt ? stage : 0;
  const text = challengeSpeech(prompt, nextStage);
  const existing = session.nextAudio;
  if (existing?.prompt === prompt && existing.stage === nextStage) return;
  const prepared = { prompt, stage: nextStage, text };
  session.nextAudio = prepared;
  const stillNeeded = () => state.session === session && spokenPrompts && voiceEngine === 'neural'
    && (session.nextAudio === prepared || session.preparedAudio === prepared);
  prepared.audio = neuralPrompt(text, stillNeeded, () => {}).catch(() => undefined);
}

function renderSpeechSetting() {
  const toggle = $('#spoken-prompts');
  toggle.hidden = !speechAvailable;
  const engine = $('#voice-engine');
  $('#voice-engine-setting').hidden = !neuralVoiceAvailable || !browserVoiceAvailable;
  engine.value = voiceEngine;
  $('#replay-prompt').hidden = !speechAvailable;
  toggle.setAttribute('aria-pressed', String(spokenPrompts));
  toggle.title = spokenPrompts ? 'Mute spoken prompts' : 'Unmute spoken prompts';
  const speaker = '<path d="M11 5 6 9H3v6h3l5 4V5Z"/>';
  const sound = spokenPrompts ? '<path d="M15 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/>' : '<path d="m16 9 5 6m0-6-5 6"/>';
  toggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${speaker}${sound}</svg>`;
  const cache = $('#voice-cache');
  const enabled = () => spokenPrompts && voiceEngine === 'neural';
  cache.hidden = !enabled();
  if (enabled()) void warmVoiceCache([...new Set(voiceCatalog())], enabled, (done, total) => {
    const progress = $('#voice-cache-progress');
    progress.max = total;
    if (done !== null) progress.value = done;
    $('#voice-cache-label').textContent = done === null ? 'Voice caching paused' : `Caching voice · ${done}/${total}`;
    cache.hidden = done === total;
  });
}
const today = () => new Date().toLocaleDateString('en-CA');
const newDaily = () => ({ date: today(), rounds: 0, notes: 0, jazz: 0, claimed: false });
function loadProgress() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { /* corrupt state: use defaults */ }
  return {
    xp: Number(saved.xp) || 0, correct: Number(saved.correct) || 0, attempts: Number(saved.attempts) || 0,
    bestStreak: Number(saved.bestStreak) || 0, modeStats: saved.modeStats || {},
    exerciseHistory: Array.isArray(saved.exerciseHistory) ? saved.exerciseHistory.slice(-HISTORY_LENGTH) : [],
    keyStats: saved.keyStats || {}, achievements: Array.isArray(saved.achievements) ? saved.achievements : [],
    freeDrills: saved.freeDrills || {}, bestScores: saved.bestScores || {}, responseTimes: saved.responseTimes || {}, curriculum: saved.curriculum || {}, daily: saved.daily?.date === today() ? saved.daily : newDaily()
  };
}
const state = {
  progress: loadProgress(), mode: 'chords', key: 'C', difficulty: 'foundation', runType: 'practice',
  session: null, held: new Set(), roundHeld: new Set(), virtualHeld: new Set(), computerHeld: new Map(),
  midiAccess: null, midiConnected: false, midiRequestPending: false, lastPromptRoot: null, hint: false, timer: null, transition: null,
  practice: false, feedbackTimeout: null, lastNote: null
};
const persist = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); }
  catch { /* browser storage may be disabled; session continues */ }
};

function weightedKey(excludedRoot, rootForKey) {
  if (state.key !== 'auto') return KEYS.find((key) => key.name === state.key) || KEYS[0];
  const pool = KEYS;
  const candidates = rootForKey ? pool.filter(key => rootForKey(key) !== excludedRoot) : pool;
  const weighted = candidates.map((key) => {
    const s = state.progress.keyStats[key.name] || { attempts: 0, correct: 0 };
    const errorRate = s.attempts ? (s.attempts - s.correct) / s.attempts : 0.4;
    return { key, weight: 1 + (5 / (1 + s.attempts)) + 4 * errorRate };
  });
  let point = Math.random() * weighted.reduce((total, item) => total + item.weight, 0);
  for (const item of weighted) { point -= item.weight; if (point <= 0) return item.key; }
  return weighted[0].key;
}
function chooseDifferentRoot(items, previousRoot, rootOf) {
  const alternatives = items.filter(item => pcOf(rootOf(item)) !== previousRoot);
  return choose(alternatives.length ? alternatives : items);
}

function voicingChoices(scaleNotes, level) {
  const choices = level === 'foundation'
    ? [{ root: scaleNotes[4], type: 'shell7', name: 'dominant shell', label: '7', specs: [[3, 4], [7, 10]], formula: '3 · ♭7' },
       { root: scaleNotes[1], type: 'shellm', name: 'minor shell', label: 'm7', specs: [[3, 3], [7, 10]], formula: '♭3 · ♭7' }]
    : [
      { root: scaleNotes[4], name: 'rootless dominant 13', label: '13', specs: [[3, 4], [7, 10], [9, 14], [13, 21]], formula: '3 · ♭7 · 9 · 13' },
      { root: scaleNotes[1], name: 'rootless minor 9', label: 'm9', specs: [[3, 3], [7, 10], [9, 14], [5, 7]], formula: '♭3 · ♭7 · 9 · 5' },
      { root: scaleNotes[0], name: 'rootless major 9', label: 'maj9', specs: [[3, 4], [7, 11], [9, 14], [5, 7]], formula: '3 · 7 · 9 · 5' }
    ];
  if (level === 'jazz') choices.push({ root: scaleNotes[4], name: 'rootless altered dominant', label: '7(♭9,♭13)', specs: [[3, 4], [7, 10], [9, 13], [13, 20]], formula: '3 · ♭7 · ♭9 · ♭13' });
  return choices;
}

const titleCase = text => text.replace(/\b[a-z]/g, letter => letter.toUpperCase());
const chordQuality = chord => chord.quality.replace(/ triad$/, '');
const chordTitle = (root, chord) => PRETTY(root) + ' ' + titleCase(chordQuality(chord));

const voiceLine = {
  note: note => `Play ${spokenNote(note)}.`,
  interval: (root, interval) => `${spokenNote(root)} ${interval.name}.`,
  scale: (root, scale) => `${spokenNote(root)} ${scale.label} scale.`,
  chord: (root, chord, inversion) => `${spokenNote(root)} ${chordQuality(chord)}${inversion ? ', ' + inversion : ''}.`,
  guides: (root, chord) => `Third and seventh of ${spokenNote(root)} ${chord.quality}.`,
  target: (root, chord, tone) => `Land on the ${tone} of ${spokenNote(root)} ${chord.quality}.`,
  voicing: item => `The ${item.name.replace('13', 'thirteenth').replace('9', 'ninth')} voicing for ${spokenNote(item.root)}.`
};
const INVERSIONS = ['root position', 'first inversion', 'second inversion'];
const CADENCE_CHORDS = [[1, 'm7'], [4, 'dom7'], [0, 'maj7']];

function* voiceCatalog() {
  yield 'Spoken prompts on.';
  for (const key of COURSE_KEYS) {
    const notes = MAJOR.map((_, index) => scaleNameAt(key, index));
    for (const [index, note] of notes.entries()) {
      yield voiceLine.note(note);
      for (const interval of INTERVALS) yield voiceLine.interval(note, interval);
      const triad = CHORD_TYPES[TRIAD_TYPES[index]];
      yield voiceLine.chord(note, triad);
      for (const inversion of INVERSIONS) yield voiceLine.chord(note, triad, inversion);
      yield voiceLine.chord(note, CHORD_TYPES[DIATONIC_TYPES[index]]);
    }
    for (const chord of Object.values(CHORD_TYPES)) yield voiceLine.chord(key.name, chord);
    for (const type of ['major', 'minor', 'diminished']) {
      for (const inversion of INVERSIONS) yield voiceLine.chord(key.name, CHORD_TYPES[type], inversion);
    }
    for (const skill of CURRICULUM.flatMap(phase => phase.skills)) {
      for (const [degree, distance, type] of skill.progression || []) {
        yield voiceLine.chord(spellDegree(key.name, degree, distance), CHORD_TYPES[type]);
      }
    }
    for (const scale of SCALE_TYPES) yield voiceLine.scale(key.name, scale);
    for (const [index, type] of CADENCE_CHORDS) {
      yield voiceLine.guides(notes[index], CHORD_TYPES[type]);
      for (const tone of ['third', 'seventh']) yield voiceLine.target(notes[index], CHORD_TYPES[type], tone);
    }
    for (const level of ['foundation', 'jazz']) {
      for (const item of voicingChoices(notes, level)) yield voiceLine.voicing(item);
    }
  }
}

function planChallenge(previousRoot, round) {
  const guided = state.session.guided;
  const branchEntry = guided?.branch?.[round - 1];
  const focus = guided?.skill;
  if (!focus) return generateChallenge(previousRoot);
  const scheduled = guided.scheduled ? scheduledLesson(state.progress, round) : null;
  const skill = branchEntry?.skill || scheduled?.skill || focus;
  const items = new Map();
  const trace = courseMemory(state.progress).concepts[skill.id];
  const simpleRoots = skill.mode === 'notes' ? ['C', 'D', 'E', 'F', 'G', 'A', 'B'] : ['C', 'F', 'G', 'A'];
  const fixedKey = branchEntry?.key || scheduled?.key || (skill === focus ? guided.key : null);
  const introduced = COURSE_KEYS.filter(key => {
    const root = rootTrace(trace, key.name);
    return root?.lastAsked || root?.lastAnswered;
  });
  const keyPool = fixedKey ? COURSE_KEYS.filter(key => key.name === fixedKey)
    : skill.scales ? (introduced.length ? introduced : COURSE_KEYS.slice(0, 1))
    : trace?.learned || (trace?.recent.filter(Boolean).length || 0) >= 4
      ? COURSE_KEYS : COURSE_KEYS.filter(key => simpleRoots.includes(key.name));
  for (const key of keyPool) {
    const prompt = generateChallenge(previousRoot, {skill, key: key.name});
    prompt.skill = skill;
    prompt.statRoot = key.name;
    const identity = [skill.id, prompt.rootPc, prompt.semitones, prompt.targetPc,
      prompt.stages?.map(stage => [stage.tones.map(tone => tone.pc), stage.bassPc]), prompt.steps];
    if (!KEYS.some(k => k.name === key.name)) identity.push(key.name);
    prompt.itemId = JSON.stringify(identity);
    items.set(prompt.itemId, prompt);
  }
  const candidates = [...items.values()];
  const alternatives = candidates.filter(prompt => prompt.rootPc !== previousRoot);
  const ranked = (alternatives.length ? alternatives : candidates).map(prompt => ({
    prompt, priority: (1 / (1 + knowledgeStrength(rootTrace(trace, prompt.statRoot)) * retention(rootTrace(trace, prompt.statRoot), Date.now()) / 50)) * (prompt.statRoot && !rootProficient(trace, prompt.statRoot) ? 2 : 1) * itemPriority(state.progress, prompt.itemId, skill) * (0.85 + Math.random() * 0.3)
  }));
  ranked.sort((a, b) => b.priority - a.priority);
  return ranked[0].prompt;
}

function generateChallenge(previousRoot = null, guided = null) {
  const mode = guided?.skill.mode || state.mode;
  const rootForKey = mode === 'scales' ? key => key.pc
    : ['guides', 'cadence'].includes(mode) ? key => mod(key.pc + 2) : null;
  const key = guided ? COURSE_KEYS.find(item => item.name === guided.key) : weightedKey(previousRoot, rootForKey);
  const level = guided ? guided.skill.level || 'foundation' : state.difficulty;
  const scaleNotes = MAJOR.map((_, index) => scaleNameAt(key, index));
  const degrees = scaleNotes.map((_, index) => index);

  if (guided?.skill.id === 'targets') {
    const [degree, quality] = chooseDifferentRoot(CADENCE_CHORDS, previousRoot, ([degree]) => scaleNotes[degree]);
    const root = scaleNotes[degree];
    const chord = CHORD_TYPES[quality];
    const [toneDegree, semitones] = choose([chord.specs[1], chord.specs[3]]);
    const note = spellDegree(root, toneDegree, semitones);
    return {
      kind: 'single', mode, key, rootPc: pcOf(root), title: chordTitle(root, chord), targetPc: pcOf(note),
      speech: voiceLine.target(root, chord, toneDegree === 3 ? 'third' : 'seventh'),
      instruction: `Imagine a phrase over this chord. Land on its ${toneDegree === 3 ? 'third' : 'seventh'}.`,
      theoryTitle: 'Give your phrase a destination',
      theory: 'Aim for a third or seventh at the chord change to outline the harmony. Play the target note first, then try connecting it to another target between rounds.',
      hintText: `Land on ${PRETTY(note)}.`, targetNotes: [{ pc: pcOf(note), name: note }]
    };
  }
  if (mode === 'notes') {
    const degree = guided && (mode === "notes" || guided.skill.chordType || mode === "inversions") ? 0 : chooseDifferentRoot(degrees, previousRoot, index => scaleNotes[index]);
    const target = scaleNotes[degree];
    return {
      kind: 'single', mode, key, rootPc: pcOf(target), title: 'Play ' + PRETTY(target), targetPc: pcOf(target),
      speech: voiceLine.note(target),
      instruction: guided ? "Find this note in any octave." : `Play the note anywhere on your keyboard. Scale degree ${degree + 1} in ${PRETTY(key.name)} major.`,
      theoryTitle: 'Know the keyboard in every key',
      theory: `The target is scale degree ${degree + 1} of ${PRETTY(key.name)} major. Pitch classes repeat every 12 semitones, so any octave counts.`,
      theoryExample: `${PRETTY(key.name)} major: ${scaleNotes.map(PRETTY).join(' – ')}`,
      hintText: `Play ${PRETTY(target)} in any octave.`, targetNotes: [{ pc: pcOf(target), name: target }]
    };
  }
  if (mode === 'intervals') {
    const root = guided ? key.name : chooseDifferentRoot(scaleNotes, previousRoot, note => note);
    const bank = guided?.skill.intervals ? INTERVALS.filter(item => guided.skill.intervals.includes(item.semis))
      : level === 'foundation' ? INTERVALS.filter((i) => [2, 3, 4, 5, 7].includes(i.semis))
      : level === 'intermediate' ? INTERVALS.filter((i) => i.semis < 11) : INTERVALS;
    let interval = choose(bank);
    if (guided?.skill.intervals) {
      const counts = state.session.intervalCounts;
      const leastUsed = Math.min(...bank.map(item => counts[item.semis] || 0));
      interval = choose(bank.filter(item => (counts[item.semis] || 0) === leastUsed));
    }
    const symbol = INTERVAL_SYMBOLS[interval.semis - 1];
    const result = spellDegree(root, interval.degree, interval.semis);
    return {
      kind: 'interval', mode, key, title: `${PRETTY(root)} + ${symbol}`, symbol, targetPc: pcOf(result), rootPc: pcOf(root), rootName: root, semitones: interval.semis,
      speech: voiceLine.interval(root, interval),
      instruction: `Find the ${interval.name} above ${PRETTY(root)}. Play the root and upper note together, or play the root first and then the upper note.`,
      theoryTitle: 'Intervals are measured in semitones',
      theory: `A ${interval.name} spans ${interval.semis} semitone${interval.semis === 1 ? '' : 's'}. Build it from ${PRETTY(root)} rather than counting all the white keys.`,
      theoryExample: `${PRETTY(root)} + ${interval.semis} semitone${interval.semis === 1 ? '' : 's'} = ${PRETTY(result)}`,
      hintText: `The answer is ${PRETTY(result)}.`, targetNotes: [{ pc: pcOf(result), name: result }]
    };
  }
  if (mode === 'scales') {
    const bank = level === 'foundation' ? SCALE_TYPES.slice(0, 1)
      : level === 'intermediate' ? SCALE_TYPES.slice(0, 4) : SCALE_TYPES;
    const scale = choose(guided?.skill.scales ? SCALE_TYPES.filter(item => guided.skill.scales.includes(item.id)) : bank);
    const tones = scale.steps.map((step, index) => ({
      pc: mod(key.pc + step), name: spellDegree(key.name, index + 1, step)
    }));
    return {
      kind: 'scale', mode, key, rootPc: key.pc, title: `${PRETTY(key.name)} ${titleCase(scale.label)} Scale`,
      speech: voiceLine.scale(key.name, scale),
      instruction: 'Play one ascending octave, starting on the root in any register.',
      steps: scale.steps, tones,
      theoryTitle: 'Learn the distance between scale degrees',
      theory: `The ${scale.label} scale is a formula, not a memorized collection of white and black keys. ${scale.theory}.`,
      theoryExample: `${tones.map((tone) => PRETTY(tone.name)).join(' – ')}`,
      hintText: `Ascending: ${tones.map((tone) => PRETTY(tone.name)).join(' → ')}`, targetNotes: tones
    };
  }
  if (mode === 'chords' || mode === 'inversions') {
    const degree = guided && (mode === "notes" || guided.skill.chordType || mode === "inversions") ? 0 : chooseDifferentRoot(degrees, previousRoot, index => scaleNotes[index]);
    const root = scaleNotes[degree];
    const type = guided?.skill.chordType || (guided && mode === "inversions" ? choose(["major", "minor", "diminished"]) : null) || (mode === 'inversions' || level === 'foundation' ? TRIAD_TYPES[degree] : DIATONIC_TYPES[degree]);
    const spec = CHORD_TYPES[type];
    const tones = makeTones(root, spec.specs);
    const chordName = chordTitle(root, spec);
    const inversion = mode === 'inversions' ? (guided?.skill.inversion ?? rand(3)) : 0;
    const bass = tones[inversion];
    return {
      kind: 'stack', mode, key, rootPc: pcOf(root), title: mode === 'inversions' ? `${chordName} · ${INVERSIONS[inversion]}` : chordName,
      speech: voiceLine.chord(root, spec, mode === 'inversions' ? INVERSIONS[inversion] : undefined),
      instruction: mode === 'inversions'
        ? `Play the ${spec.quality} with its ${inversion === 1 ? "third" : inversion === 2 ? "fifth" : "root"} as the lowest note.`
        : `Play all ${tones.length} notes of this ${spec.quality} together, in any inversion.`,
      stages: [{ label: chordName, tones, bassPc: mode === 'inversions' ? bass.pc : null, inversion }],
      theoryTitle: mode === 'inversions' ? 'The bass determines the inversion' : 'Intervals define the chord',
      theory: mode === 'inversions'
        ? `${chordName} has the same chord tones in every inversion. The ${INVERSIONS[inversion]} puts ${PRETTY(bass.name)} at the bottom.`
        : `The ${spec.quality} formula is ${spec.formula}. Build it relative to ${PRETTY(root)}.`,
      theoryExample: `${chordName} = ${tones.map((tone) => PRETTY(tone.name)).join(' – ')}`,
      hintText: `Use ${tones.map((tone) => PRETTY(tone.name)).join(' · ')}${mode === 'inversions' ? `; lowest note ${PRETTY(bass.name)}` : ''}.`,
      targetNotes: tones
    };
  }
  if (mode === 'guides' || mode === 'cadence') {
    const progression = guided?.skill.progression || CADENCE_CHORDS.map(([index, type]) => [index + 1, MAJOR[index], type]);
    const stages = progression.map(([degree, distance, type]) => {
      const root = spellDegree(key.name, degree, distance);
      const chord = CHORD_TYPES[type];
      const fullTones = makeTones(root, chord.specs);
      const tones = mode === 'guides' ? [fullTones[1], fullTones[3]] : fullTones;
      return { label: chordTitle(root, chord), tones, speech: mode === 'guides' ? voiceLine.guides(root, chord) : voiceLine.chord(root, chord) };
    });
    const chordLine = stages.map((s) => s.label).join(' → ');
    return {
      kind: 'stack', mode, key, rootPc: mod(key.pc + progression[0][1]), title: stages[0].label,
      instruction: guided?.skill.progression ? 'Play each chord in order. Keep common tones close as the harmony changes.' : mode === 'guides' ? 'Play the 3rd and 7th, then connect all three chords.'
        : 'Play each full seventh chord. Find the smoothest inversion.',
      stages,
      theoryTitle: guided?.skill.progression ? guided.skill.label : mode === 'guides' ? 'The 3rd and 7th are the guide tones' : 'ii–V–I: predominant → dominant → tonic',
      theory: guided?.skill.progression ? guided.skill.hint : mode === 'guides'
        ? `The third and seventh tell your ear what a chord is doing. Across ii–V–I, a guide tone often stays put while the other moves by a semitone.`
        : `The ii–V–I is the central jazz cadence: minor-seventh, dominant-seventh, and major-seventh. Notice the leading tones resolving by step.`,
      theoryExample: `${chordLine}. ${mode === 'guides' ? 'Try to move both hands as little as possible.' : 'Use inversions to keep the voices close.'}`,
      hintText: stages.map((s) => `${s.label}: ${s.tones.map((tone) => PRETTY(tone.name)).join(' ')}`).join('   |   '),
      targetNotes: stages[0].tones
    };
  }
  if (mode === 'voicings') {
    const choices = voicingChoices(scaleNotes, level);
    const item = guided?.skill.id === 'altered' ? choices.at(-1) : chooseDifferentRoot(choices, previousRoot, choice => choice.root);
    const tones = makeTones(item.root, item.specs);
    return {
      kind: 'stack', mode, key, rootPc: pcOf(item.root), title: PRETTY(item.root) + item.label,
      speech: voiceLine.voicing(item),
      instruction: `Play a ${item.name}. Omit the root; play the indicated colors.`,
      stages: [{ label: PRETTY(item.root) + item.label, tones }],
      theoryTitle: 'Rootless shapes create space',
      theory: `For ${PRETTY(item.root)}${item.label}, play degrees ${item.formula}. The bass player can supply the root while you supply quality, tension and color.`,
      theoryExample: `${item.formula} = ${tones.map((tone) => PRETTY(tone.name)).join(' – ')}`,
      hintText: `Play ${tones.map((tone) => PRETTY(tone.name)).join(' · ')}.`,
      targetNotes: tones
    };
  }
  throw new Error(`Unknown drill: ${mode}`);
}

function saveSettingSnapshot() {
  state.key = $('#key-select').value;
  state.difficulty = $('#difficulty-select').value;
}
function selectMode(modeId) {
  if (!MODES.find((mode) => mode.id === modeId)) return;
  stopTimers();
  releaseVirtual();
  $('#key-select').disabled = $('#difficulty-select').disabled = false;
  state.mode = modeId;
  state.session = null;
  state.roundHeld.clear();
  state.hint = false;
  renderModes();
  renderReady();
  renderCounters();
  renderKeyboardState();
  const mode = MODES.find((item) => item.id === modeId);
  $('#crumb-mode').textContent = mode.title.toUpperCase();
  $('#mode-description').textContent = mode.summary;
}
function lessonScore(trace) {
  return Math.round(proficiencyPoints(trace));
}

function curriculumRootLabel(skill, key) {
  if (skill.scales) return PRETTY(key) + ' ' + titleCase(SCALE_TYPES.find(scale => scale.id === skill.scales[0]).label) + ' Scale';
  if (skill.chordType) return chordTitle(key, CHORD_TYPES[skill.chordType]);
  if (skill.intervals) return PRETTY(key) + ' + ' + INTERVAL_SYMBOLS[skill.intervals[0] - 1];
  return PRETTY(key);
}

function renderModes() {
  const tree = $('#mode-nav');
  if (!tree.children.length) {
    const next = curriculumRecommendation(state.progress).skill;
    const meter = '<span class="tree-score"></span><progress max="100" aria-hidden="true"></progress>';
    tree.innerHTML = CURRICULUM.map((group, index) => `
      <div class="tree-branch">
        <button type="button" class="branch-play" data-phase="${index}" aria-label="Play ${group.title}">Play</button>
        <details ${group.skills.includes(next) ? 'open' : ''}>
          <summary><span>${group.title}</span>${meter}</summary>
          <ul>${group.skills.map(skill => `
            <li class="tree-branch">
              <button type="button" class="branch-play" data-lesson-play="${skill.id}" aria-label="Play ${skill.label}">Play</button>
              <details data-lesson="${skill.id}"><summary><span>${skill.label}</span>${meter}</summary>
                <ul>${COURSE_KEYS.map(key => `<li><button type="button" data-skill="${skill.id}" data-root="${key.name}"><span>${curriculumRootLabel(skill,key.name)}</span>${meter}</button></li>`).join('')}</ul>
              </details>
            </li>`).join('')}</ul>
        </details>
      </div>`).join('');
  }
  highlightPracticeBranches();
  const concepts = courseMemory(state.progress).concepts;
  const update = (row, score) => {
    row.querySelector('.tree-score').textContent = score + '%';
    row.querySelector('progress').value = score;
  };
  CURRICULUM.forEach((group, index) => {
    const section = tree.children[index];
    const scores = group.skills.map(skill => lessonScore(concepts[skill.id]));
    update(section.querySelector('summary'), Number((scores.reduce((sum, n) => sum + n, 0) / scores.length).toFixed(1)));
    section.querySelectorAll('[data-lesson]').forEach((lesson, i) => {
      const skill = group.skills[i];
      const trace = concepts[skill.id];
      update(lesson.querySelector('summary'), scores[i]);
      lesson.querySelectorAll('button').forEach(button => {
        const key = button.dataset.root;
        update(button, lessonScore(rootTrace(trace, key)));
        button.setAttribute('aria-current', String(state.session?.prompt?.skill?.id === skill.id &&
          state.session.prompt.statRoot === key));
      });
    });
  });
}

function highlightPracticeBranches() {
  const rotation = state.practiceRotation;
  for (const button of $$('#mode-nav [data-lesson-play]')) {
    button.classList.toggle('practice-tested', Boolean(rotation?.has(button.dataset.lessonPlay)));
  }
  for (const button of $$('#mode-nav [data-phase]')) {
    const group = CURRICULUM[Number(button.dataset.phase)];
    button.classList.toggle('practice-tested', group.skills.some(skill => rotation?.has(skill.id)));
  }
}

function branchRounds(skills) {
  return COURSE_KEYS.flatMap((_, index) => skills.map((skill, offset) => ({
    skill, key: COURSE_KEYS[(index + offset) % COURSE_KEYS.length].name
  })));
}

function startBranch(skills, title) {
  const branch = branchRounds(skills);
  const {skill} = branch[0];
  setContinuousPractice(false);
  selectMode(skill.mode);
  startRun({skill, branch, branchTitle: title});
  $('#challenge-title').scrollIntoView({block: 'nearest'});
}

function startFreeLesson(skill, key) {
  setContinuousPractice(false);
  selectMode(skill.mode);
  startRun({skill, key, freeLesson: true});
  $('#challenge-title').scrollIntoView({block: 'nearest'});
}

function renderReady() {
  const mode = MODES.find((item) => item.id === state.mode);
  $('#board-ready').classList.remove('hidden');
  $('#board-active').classList.add('hidden');
  $('#board-summary').classList.add('hidden');
  $('#ready-title').innerHTML = `${mode.title}.<br><span>Level up your instincts.</span>`;
  $('#ready-copy').textContent = mode.intro;
  $('#challenge-tag').innerHTML = `${mode.title.toUpperCase()} <span class="tag-divider">·</span> ${state.runType === 'arcade' ? 'ARCADE' : 'PRACTICE'}`;
  $('#round-label').textContent = 'READY TO PLAY';
  $('#time-label').textContent = state.runType === 'arcade' ? '3 HEARTS' : 'UNTIMED';
  renderTheory({ theoryTitle: 'What you will train', theory: mode.summary, theoryExample: 'Play with your MIDI keyboard, the on-screen keys, or your computer keyboard.' });
}
function startRun(guided = null) {
  stopTimers();
  releaseVirtual();
  saveSettingSnapshot();
  $('#key-select').disabled = $('#difficulty-select').disabled = Boolean(guided);
  state.session = {
    mode: state.mode, guided, arcade: (!guided || guided.freeLesson) && state.runType === 'arcade', total: guided?.branch?.length ?? ROUND_COUNT, intervalCounts: {}, cleanRounds: 0, responseSamples: [], round: 0, score: 0,
    completed: 0, errors: 0, combo: 0, bestCombo: 0, hearts: 3,
    earnedXP: 0, prompt: null, stageIndex: 0, scaleIndex: 0, scaleAnchor: null, intervalAnchor: null, intervalPending: null, intervalTimer: null,
    roundErrors: 0, roundHint: false, busy: false, startedAt: performance.now(),
    lastBadInversion: '', roundRecorded: false
  };
  $('#board-ready').classList.add('hidden');
  $('#board-summary').classList.add('hidden');
  $('#board-active').classList.remove('hidden');
  nextRound();
  renderModes();
}
function nextRound() {
  const s = state.session;
  if (!s) return;
  stopTimers();
  releaseVirtual();
  state.roundHeld.clear();
  if (s.round >= s.total || (s.arcade && s.hearts <= 0)) { finishRun(); return; }
  s.round += 1;
  s.prompt = s.nextPrompt ?? planChallenge(state.lastPromptRoot, s.round);
  s.mode = s.prompt.mode;
  if (s.prompt.skill) {
    (s.testedSkills ||= new Set()).add(s.prompt.skill.id);
    const trace = courseMemory(state.progress).concepts[s.prompt.skill.id];
    const exposure = s.prompt.skill.scales ? rootTrace(trace, s.prompt.statRoot) : trace;
    s.firstExposure = !exposure?.lastAsked && !exposure?.lastAnswered && !exposure?.explainedAt;
    markPresented(state.progress, s.prompt, Date.now());
    if (state.practice && !state.practiceRotation.has(s.prompt.skill.id)) {
      state.practiceRotation = new Set(reviewGroups(state.progress).flat().map(skill => skill.id));
      highlightPracticeBranches();
    }
    persist();
  }
  state.lastPromptRoot = s.prompt.rootPc;
  s.preparedAudio = s.nextAudio?.prompt === s.prompt ? s.nextAudio : undefined;
  s.nextAudio = undefined;
  if (s.prompt.skill?.intervals) {
    const interval = s.prompt.semitones;
    s.intervalCounts[interval] = (s.intervalCounts[interval] || 0) + 1;
  }
  s.nextPrompt = s.round < s.total ? planChallenge(state.lastPromptRoot, s.round + 1) : undefined;
  s.stageIndex = 0;
  s.scaleIndex = 0;
  s.scaleAnchor = null;
  s.scaleWrongNotes = new Set();
  s.intervalAnchor = null;
  s.roundErrors = 0;
  s.roundPenalized = false;
  s.roundHint = false;
  s.roundRecorded = false;
  s.lastBadInversion = '';
  s.busy = false;
  state.hint = false;
  s.response = {
    start: performance.now(), pausedMs: 0, pausedAt: document.hidden ? performance.now() : null,
    waiting: false, notes: [], invalid: document.hidden, lastNoteAt: 0
  };
  renderChallenge();
  setupLessonHint(s);
  if (spokenPrompts) speakChallenge();
  prepareNextSpeech(s);
  if (s.arcade) startTimer(s.prompt.kind === 'scale' || s.prompt.stages?.length > 1 ? 52 : s.prompt.kind === 'single' ? 20 : 35);
}
function renderTheory(prompt) {
  const target = $('#theory-content');
  target.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = prompt.theoryTitle;
  const paragraph = document.createElement('p');
  paragraph.textContent = prompt.theory;
  target.append(title, paragraph);
  if (prompt.theoryExample && (!state.session?.prompt || state.hint || state.session.busy)) {
    const ex = document.createElement('p');
    ex.className = 'example';
    ex.textContent = prompt.theoryExample;
    target.appendChild(ex);
  }
}
function renderChallenge() {
  const s = state.session;
  if (!s || !s.prompt) return;
  const p = s.prompt;
  const mode = MODES.find((m) => m.id === p.mode);
  const stage = p.kind === 'stack' ? p.stages[s.stageIndex] : null;
  if (p.skill) {
    $('#crumb-mode').textContent = (s.guided.branchTitle || s.guided.skill.label).toUpperCase();
    $('#mode-description').textContent = s.guided.branch || p.skill.id === s.guided.skill.id ? p.skill.label : 'Review · ' + p.skill.label;
  }
  $('#challenge-tag').innerHTML = `${mode.title.toUpperCase()} <span class="tag-divider">·</span> ${p.skill ? p.skill.label.toUpperCase() : s.arcade ? 'ARCADE' : 'PRACTICE'}`;
  $('#round-label').textContent = `ROUND ${String(s.round).padStart(2, '0')} / ${String(s.total).padStart(2, '0')}`;
  $('#challenge-kicker').textContent = p.kind === 'stack' && p.stages.length > 1
    ? `${mode.kicker} · ${s.stageIndex + 1} / ${p.stages.length}` : mode.kicker;
  $('#challenge-title').textContent = stage && p.stages.length > 1 ? stage.label : p.title;
  $('#challenge-instruction').textContent = p.instruction;
  const sequence = $('#sequence-pills');
  sequence.replaceChildren();
  if (p.kind === 'stack' && p.stages.length > 1) {
    p.stages.forEach((item, index) => {
      const pill = document.createElement('span');
      pill.className = index === s.stageIndex ? 'step-active' : index < s.stageIndex ? 'step-done' : '';
      pill.textContent = item.label;
      sequence.appendChild(pill);
    });
    sequence.classList.remove('hidden');
  } else if (p.kind === 'scale') {
    p.tones.forEach((item, index) => {
      const pill = document.createElement('span');
      pill.className = index === s.scaleIndex ? 'step-active' : index < s.scaleIndex ? 'step-done' : '';
      pill.textContent = state.hint || index < s.scaleIndex ? PRETTY(item.name) : String(index + 1);
      sequence.appendChild(pill);
    });
    sequence.classList.remove('hidden');
  } else sequence.classList.add('hidden');
  $('#hint-button').textContent = $('#lesson-hint').hidden ? 'Show hint (less XP)' : 'Hide hint';
  $('#answer-feedback').textContent = '';
  $('#answer-feedback').classList.remove('warning');
  renderTheory(p);
  renderHeld();
  renderCounters();
  renderKeyboardState();
}
function renderHeld() {
  const host = $('#held-notes');
  host.replaceChildren();
  if (!state.roundHeld.size) {
    const el = document.createElement('span');
    el.className = 'empty-held';
    el.textContent = 'Waiting for notes…';
    host.appendChild(el);
    return;
  }
  const prompt = state.session?.prompt;
  const targets = prompt ? currentTargets(prompt) : [];
  const pcs = new Set(targets.map((item) => item.pc));
  for (const note of [...state.roundHeld].sort((a, b) => a - b)) {
    const el = document.createElement('span');
    const anchor = state.session?.intervalAnchor;
    const wrong = prompt?.kind === 'scale' ? state.session.scaleWrongNotes?.has(note)
      : prompt?.kind === 'interval' && anchor != null
        ? note !== anchor && note !== anchor + prompt.semitones
        : state.session?.intervalPending !== note && pcs.size && !pcs.has(mod(note));
    el.className = `held-chip${wrong ? ' wrong' : ''}`;
    el.textContent = noteOctave(note);
    host.appendChild(el);
  }
}
function currentTargets(prompt) {
  const s = state.session;
  if (!prompt) return [];
  if (prompt.kind === 'single') return prompt.targetNotes;
  if (prompt.kind === 'interval') return [s?.intervalAnchor !== null ? prompt.targetNotes[0] : {pc:prompt.rootPc,name:prompt.rootName}];
  if (prompt.kind === 'scale') return [prompt.tones[s?.scaleIndex || 0] || prompt.tones[0]];
  return prompt.stages[s?.stageIndex || 0]?.tones || [];
}
function renderCounters() {
  const s = state.session;
  $('#live-score').textContent = s ? s.score.toLocaleString() : '0';
  $('#live-combo').textContent = s ? s.combo : '0';
  $('#hearts').textContent = s?.arcade ? '♥ '.repeat(s.hearts).trim() + ' ♡'.repeat(3 - s.hearts) : '∞ LIVES';
  const host = $('#round-progress');
  host.replaceChildren();
  for (let i = 0; i < (s?.total || ROUND_COUNT); i += 1) {
    const cell = document.createElement('span');
    if (s && i < s.round - 1) cell.className = 'filled';
    if (s && i === s.round - 1) cell.className = 'current';
    host.appendChild(cell);
  }
}
function renderKeyboard() {
  const keyboard = $('#keyboard');
  keyboard.replaceChildren();
  let whites = 0;
  const blackList = [];
  for (let midi = 48; midi <= 83; midi += 1) {
    const pc = mod(midi);
    const isBlack = [1, 3, 6, 8, 10].includes(pc);
    const node = document.createElement('button');
    node.type = 'button';
    node.dataset.note = String(midi);
    node.className = `piano-key ${isBlack ? 'black' : 'white'}`;
    node.setAttribute('aria-label', `${noteOctave(midi)}. Click to toggle.`);
    node.setAttribute('aria-pressed', 'false');
    node.title = noteOctave(midi);
    if (isBlack) {
      node.style.left = `${whites * 42 - 13.5}px`;
      blackList.push(node);
    } else {
      node.textContent = pc === 0 ? `C${Math.floor(midi / 12) - 1}` : '';
      keyboard.appendChild(node);
      whites += 1;
    }
  }
  blackList.forEach((node) => keyboard.appendChild(node));
}
function renderKeyboardState() {
  const p = state.session?.prompt;
  const targets = state.hint && p ? new Set(currentTargets(p).map((item) => item.pc)) : new Set();
  $$('.piano-key').forEach((button) => {
    const note = Number(button.dataset.note);
    button.classList.toggle('active', state.held.has(note));
    button.classList.toggle('target', targets.has(mod(note)));
    button.setAttribute('aria-pressed', String(state.virtualHeld.has(note)));
  });
  $('#last-note').textContent = state.lastNote !== null ? `LAST NOTE: ${noteOctave(state.lastNote)}` : 'LAST NOTE: —';
}
function feedback(message, bad = false) {
  const node = $('#answer-feedback');
  node.textContent = message;
  node.classList.toggle('warning', bad);
}
function toast(message, variant = '') {
  const el = document.createElement('div');
  el.className = `toast ${variant}`;
  el.textContent = message;
  $('#toast-stack').appendChild(el);
  setTimeout(() => el.remove(), 3400);
}
function responseElapsed(response, now = performance.now()) {
  const paused = response.pausedAt === null ? 0 : now - response.pausedAt;
  return Math.max(0, now - response.start - response.pausedMs - paused);
}

function recordNoteTime(session, note) {
  const response = session.response;
  if (response.waiting || document.hidden) response.invalid = true;
  const elapsed = responseElapsed(response);
  response.notes.push({ pitch: mod(note), ms: elapsed - response.lastNoteAt });
  response.lastNoteAt = elapsed;
}

function saveResponseSample(key, ms, minimum = 0, maximum = 15000) {
  if (!Number.isFinite(ms) || ms < minimum || ms > maximum) return null;
  const history = state.progress.responseTimes[key] ||= [];
  const sorted = history.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (sorted.length >= 5 && ms > Math.max(4000, median * 3)) return null;
  const sample = Math.round(ms);
  history.push(sample);
  if (history.length > 25) history.shift();
  return sample;
}

function saveRoundTiming(session) {
  const response = session.response;
  if (!response || response.invalid || response.notes.length === 0 || response.notes.some(note => note.ms > 15000)) return null;
  const prompt = session.prompt;
  const clean = session.roundErrors === 0 && !session.roundHint;
  if (!clean) return null;
  let fluency = null;
  if (prompt.kind === 'single' || prompt.kind === 'interval') {
    const key = prompt.kind === 'interval'
      ? `interval:${prompt.rootPc}:${prompt.semitones}` : `${session.mode}:target:${prompt.targetPc}`;
    fluency = saveResponseSample(key, response.lastNoteAt, 100, prompt.kind === 'single' ? 8000 : 12000);
    if (fluency === null) return null;
  }
  if (fluency === null && prompt.itemId) fluency = saveResponseSample(prompt.itemId, response.notes[0].ms, 100, 10000);
  for (const note of response.notes) saveResponseSample(`${session.mode}:note:${note.pitch}`, note.ms);
  return fluency;
}

function onNoteOn(note, source = 'midi') {
  if (!Number.isInteger(note) || note < 0 || note > 127) return;
  if (state.session?.continuation) {
    const {exercise} = state.session.continuation;
    if (!state.held.has(note)) playExample(exercise, note);
    return;
  }
  if (state.session?.showingIntro) {
    playExample(state.session, note);
    return;
  }
  if (state.held.has(note)) return;
  state.held.add(note);
  state.lastNote = note;
  state.progress.daily.notes += 1;
  persist();
  if (state.session?.prompt && !state.session.busy) {
    state.roundHeld.add(note);
    scheduleLessonHint(state.session);
    recordNoteTime(state.session, note);
    evaluateNote(note);
  }
  renderHeld();
  renderKeyboardState();
  renderQuests();
}
function onNoteOff(note) {
  state.session?.continuation?.exercise.example.held.delete(note);
  if (state.session?.showingIntro) state.session.example.held.delete(note);
  if (!state.held.has(note)) return;
  state.held.delete(note);
  state.roundHeld.delete(note);
  state.session?.scaleWrongNotes?.delete(note);
  if (state.session?.prompt && !state.session.busy && state.session.prompt.kind === 'stack') evaluateStack(null);
  renderHeld();
  renderKeyboardState();
}
function releaseVirtual() {
  for (const note of state.virtualHeld) {
    state.held.delete(note);
    state.roundHeld.delete(note);
  }
  state.virtualHeld.clear();
  renderKeyboardState();
}
function toggleVirtual(note) {
  if (state.virtualHeld.has(note)) {
    state.virtualHeld.delete(note);
    onNoteOff(note);
  } else {
    state.virtualHeld.add(note);
    onNoteOn(note, 'virtual');
  }
}
function evaluateNote(note) {
  const s = state.session;
  if (!s || s.busy) return;
  const p = s.prompt;
  if (p.kind === 'single') {
    if (mod(note) === p.targetPc) completeRound();
    else mistake(`That's ${noteOctave(note)}. Try again.`);
    return;
  }
  if (p.kind === 'interval') {
    if (s.intervalAnchor === null) {
      if (mod(note) !== p.rootPc) {
        if (mod(note) === p.targetPc && s.intervalPending === null) {
          s.intervalPending = note;
          s.intervalTimer = window.setTimeout(() => {
            s.intervalPending = null;
            s.intervalTimer = null;
            if (state.session !== s || s.busy) return;
            mistake(`First, find ${PRETTY(p.rootName)}.`);
            renderHeld();
          }, 100);
        } else mistake(`First, find ${PRETTY(p.rootName)}.`);
        return;
      }
      if (note + p.semitones > 127) { mistake('Start an octave lower to leave room for the interval.'); return; }
      s.intervalAnchor = note;
      const pending = s.intervalPending;
      clearPendingInterval(s);
      if (pending === note + p.semitones && state.roundHeld.has(pending)) completeRound();
      else if (pending !== null) mistake(`Find + ${p.symbol} above ${noteOctave(note)}.`);
      else feedback(`✓ Root ${noteOctave(note)}. Now find + ${p.symbol}.`);
    } else if (note === s.intervalAnchor + p.semitones) completeRound();
    else if (p.semitones === 12 && note + 12 === s.intervalAnchor && state.roundHeld.has(s.intervalAnchor)) {
      s.intervalAnchor = note;
      completeRound();
    }
    else if (note === s.intervalAnchor) feedback(`✓ Root ${noteOctave(note)}. Now find + ${p.symbol}.`);
    else mistake(`That's not ${p.semitones} semitones above ${noteOctave(s.intervalAnchor)}. Try again.`);
    return;
  }
  if (p.kind === 'scale') {
    const expectedPc = p.tones[s.scaleIndex]?.pc;
    if (expectedPc === undefined) return;
    const starting = s.scaleIndex === 0;
    const valid = starting ? mod(note) === expectedPc : note === s.scaleAnchor + p.steps[s.scaleIndex];
    const octaveFits = !starting || note + p.steps.at(-1) <= 127;
    if (!valid || !octaveFits) {
      const root = PRETTY(p.tones[0].name);
      s.scaleIndex = 0;
      s.scaleAnchor = null;
      s.scaleWrongNotes.add(note);
      mistake(!octaveFits && valid
        ? 'Start an octave lower to leave room for the scale.'
        : `Restart the scale on ${root}.`);
      renderChallengeProgress();
      return;
    }
    if (starting) s.scaleAnchor = note;
    s.scaleWrongNotes.delete(note);
    s.scaleIndex += 1;
    renderChallengeProgress();
    if (s.scaleIndex === p.tones.length) completeRound();
    else feedback(`✓ ${PRETTY(p.tones[s.scaleIndex - 1].name)} · ${s.scaleIndex} / ${p.tones.length}`);
    return;
  }
  evaluateStack(note);
}
function renderChallengeProgress() {
  const s = state.session;
  if (!s || !s.prompt) return;
  const p = s.prompt;
  if (p.kind === 'scale') {
    [...$('#sequence-pills').children].forEach((pill, index) => {
      const current = s.scaleIndex;
      pill.className = index === current ? 'step-active' : index < current ? 'step-done' : '';
      pill.textContent = state.hint || index < current ? PRETTY(p.tones[index].name) : String(index + 1);
    });
  }
  renderKeyboardState();
}
function evaluateStack(newNote) {
  const s = state.session;
  if (!s || s.busy || s.prompt.kind !== 'stack') return;
  const stage = s.prompt.stages[s.stageIndex];
  const expected = new Set(stage.tones.map((tone) => tone.pc));
  const notes = [...state.roundHeld];
  const actual = new Set(notes.map((note) => mod(note)));
  if (newNote !== null && !expected.has(mod(newNote))) {
    mistake(`${noteOctave(newNote)} isn't in this voicing. Release it and try again.`);
    return;
  }
  if (!notes.length || [...expected].some((pc) => !actual.has(pc)) || [...actual].some((pc) => !expected.has(pc))) return;
  if (stage.bassPc !== null && stage.bassPc !== undefined) {
    const actualBass = mod(Math.min(...notes));
    if (actualBass !== stage.bassPc) {
      const config = notes.sort((a, b) => a - b).join(',');
      if (s.lastBadInversion !== config) {
        s.lastBadInversion = config;
        mistake(`Right notes, wrong inversion. Make ${pcName(stage.bassPc, s.prompt.key)} the bass.`);
      }
      return;
    }
  }
  if (s.stageIndex + 1 >= s.prompt.stages.length) { completeRound(); return; }
  s.busy = true;
  feedback(`✓ ${stage.label} — smooth!`);
  window.setTimeout(() => {
    if (state.session !== s) return;
    releaseVirtual();
    state.roundHeld.clear();
    s.stageIndex += 1;
    s.preparedAudio = s.nextAudio?.prompt === s.prompt && s.nextAudio.stage === s.stageIndex ? s.nextAudio : undefined;
    s.nextAudio = undefined;
    s.busy = false;
    renderChallenge();
    if (spokenPrompts) speakChallenge();
    prepareNextSpeech(s);
  }, 560);
}
const ROUND_POINTS = {
  notes: 40, intervals: 55, scales: 80, chords: 65, inversions: 75, guides: 95, voicings: 88, cadence: 108
};

function deductMistake(session) {
  if (session.roundPenalized) return 0;
  session.roundPenalized = true;
  const penalty = 4 * ROUND_POINTS[session.mode];
  session.score -= penalty;
  if (session.guided) {
    recordLesson(state.progress, session.prompt, false, null);
    persist();
    renderCurriculum();
  }
  return penalty;
}

function mistake(message) {
  const s = state.session;
  if (!s || s.busy) return;
  s.errors += 1;
  s.roundErrors += 1;
  s.combo = 0;
  if (s.arcade) s.hearts -= 1;
  const penalty = deductMistake(s);
  feedback(`✕ ${message}${penalty ? ` · −${penalty} pts` : ""}`, true);
  renderCounters();
  if (s.arcade && s.hearts <= 0) {
    s.busy = true;
    state.transition = window.setTimeout(() => {
      if (state.session !== s) return;
      recordRound(false);
      finishRun();
    }, 850);
  }
}
function recordRound(success) {
  const s = state.session;
  if (!s || s.roundRecorded) return;
  s.roundRecorded = true;
  const p = s.prompt;
  state.progress.attempts += 1;
  if (success) state.progress.correct += 1;
  const mode = state.progress.modeStats[p.mode] ||= { attempts: 0, correct: 0 };
  mode.attempts += 1;
  if (success) mode.correct += 1;
  const key = state.progress.keyStats[p.key.name] ||= { attempts: 0, correct: 0 };
  key.attempts += 1;
  if (success && s.roundErrors === 0) key.correct += 1;
  if (success) {
    state.progress.daily.rounds += 1;
    if (['guides', 'voicings', 'cadence'].includes(p.mode)) state.progress.daily.jazz += 1;
  }
  const responseMs = success ? saveRoundTiming(s) : null;
  if (responseMs !== null) s.responseSamples.push(responseMs);
  if (s.guided) {
    const clean = success && s.roundErrors === 0 && !s.roundHint;
    s.cleanRounds += Number(clean);
    if (clean) recordLesson(state.progress, p, true, responseMs);
    renderCurriculum();
  }
  persist();
  renderProgress();
  renderQuests();
}
function completeRound() {
  const s = state.session;
  if (!s || s.busy) return;
  s.busy = true;
  s.completed += 1;
  const perfect = s.roundErrors === 0;
  if (perfect) s.combo += 1;
  s.bestCombo = Math.max(s.bestCombo, s.combo);
  const basePoints = ROUND_POINTS[s.mode];
  const streakMultiplier = Math.min(2, 1 + Math.floor((s.combo - 1) / 3) * 0.2);
  const roundPoints = perfect ? Math.round(basePoints * streakMultiplier * (s.roundHint ? 0.5 : 1) * (s.arcade ? 1.35 : 1)) : 0;
  const earnedXP = perfect ? Math.round((12 + basePoints * 0.25) * (s.roundHint ? 0.5 : 1) * (s.arcade ? 1.25 : 1)) : 0;
  s.score += roundPoints;
  s.earnedXP += earnedXP;
  state.progress.xp += earnedXP;
  state.progress.bestStreak = Math.max(state.progress.bestStreak, s.combo);
  recordRound(true);
  persist();
  renderProgress();
  renderCounters();
  checkAchievements();
  renderTheory(s.prompt);
  let result = `✓ ${perfect ? 'Clean!' : 'Recovered!'} +${roundPoints} pts · +${earnedXP} XP`;
  if (s.guided) {
    const {skill, statRoot} = s.prompt;
    const trace = courseMemory(state.progress).concepts[skill.id];
    const score = lessonScore(rootTrace(trace, statRoot));
    result += ` · ${curriculumRootLabel(skill, statRoot)} ${score}%`;
    if (perfect && s.roundHint) result += ' (hint used)';
  }
  feedback(result);
  state.transition = window.setTimeout(() => {
    if (state.session !== s) return;
    if (s.round >= s.total || !offerNext(s)) nextRound();
  }, 930);
}
function skipRound(reason = 'Skipped') {
  const s = state.session;
  if (!s || s.busy) return;
  s.busy = true;
  s.combo = 0;
  s.errors += 1;
  if (s.arcade) s.hearts -= 1;
  s.roundErrors += 1;
  const penalty = deductMistake(s);
  recordRound(false);
  renderTheory(s.prompt);
  feedback(`${reason}${penalty ? ` · −${penalty} pts` : ""}. ${s.prompt.hintText}`, true);
  renderCounters();
  state.transition = window.setTimeout(() => {
    if (state.session !== s) return;
    if (s.arcade && s.hearts <= 0) finishRun();
    else nextRound();
  }, 1300);
}
function finishRun() {
  const s = state.session;
  if (!s || s.finished) return;
  s.finished = true;
  s.busy = true;
  s.nextPrompt = undefined;
  s.nextAudio = undefined;
  s.preparedAudio = undefined;
  stopTimers();
  releaseVirtual();
  state.roundHeld.clear();
  const key = s.guided?.branch ? `branch:${s.guided.branchTitle}` : s.guided ? `curriculum:${s.guided.skill.id}` : `${state.mode}:${s.arcade ? 'arcade' : 'practice'}`;
  if (s.guided) {

    renderCurriculum();
  }
  if (s.score > (state.progress.bestScores[key] || 0)) state.progress.bestScores[key] = s.score;
  $('#board-active').classList.add('hidden');
  $('#board-ready').classList.add('hidden');
  $('#board-summary').classList.remove('hidden');
  $('#round-label').textContent = 'SESSION FINISHED';
  $('#time-label').textContent = `${s.completed} / ${s.total} CLEARED`;
  $('#summary-head').textContent = s.completed === s.total ? 'Perfect attendance.' : s.completed >= 5 ? 'Solid progress.' : 'Keep the momentum.';
  $('#summary-copy').textContent = `You cleared ${s.completed} challenge${s.completed === 1 ? '' : 's'} and built a ${s.bestCombo}-round best combo.`;
  $('#summary-points').textContent = s.score.toLocaleString();
  const totalJudgements = s.completed + s.errors;
  const accuracy = totalJudgements ? Math.round((s.completed / totalJudgements) * 100) : 0;
  $('#summary-accuracy').textContent = `${accuracy}%`;
  const history = state.progress.exerciseHistory;
  const number = (history.at(-1)?.number || 0) + 1;
  const label = s.guided?.branchTitle || s.guided?.skill.label || MODES.find(mode => mode.id === s.mode).title;
  const curriculumScores = captureCurriculumScores(state.progress);
  const testedSkills = [...(s.testedSkills || [])];
  state.progress.exerciseHistory = [...history, {number, label, accuracy, curriculumScores, testedSkills}].slice(-HISTORY_LENGTH);
  persist();
  renderExerciseHistory();
  showContinuation(s, number);
  $('#summary-xp').textContent = `+${s.earnedXP}`;
  $('#live-score').textContent = s.score.toLocaleString();
  $('#last-note').textContent = state.lastNote === null ? 'LAST NOTE: —' : `LAST NOTE: ${noteOctave(state.lastNote)}`;
  checkAchievements();
  if (s.responseSamples.length) {
    const average = s.responseSamples.reduce((sum, ms) => sum + ms, 0) / s.responseSamples.length;
    $('#summary-copy').textContent += ` Average response: ${(average / 1000).toFixed(2)}s across ${s.responseSamples.length} timed rounds.`;
  }
}

const SCORE_GROUPS = [
  ['Note recognition', ['notes']],
  ['Intervals', ['m2', 'M2', 'm3', 'M3', 'P4', 'P5']],
  ['Major triads', ['major-triad']],
  ['Minor triads', ['minor-triad']],
  ['Major scale', ['major']],
  ['Natural minor scale', ['natural-minor']],
  ['Harmonic minor scale', ['harmonic-minor']],
  ['Melodic minor', ['melodic-minor']],
  ['Diminished triads', ['diminished']],
  ['Suspended chords', ['sus2', 'sus4']],
  ['Chord inversions', ['inversion-1', 'inversion-2']],
  ['Extended intervals', ['P8', 'A4', 'm6', 'M6', 'm7-interval', 'M7']],
  ['Seventh chords', ['major-seventh', 'minor-seventh', 'dominant-seventh', 'half-diminished']],
  ['Cadence', ['cadence', 'guides']],
  ['Phrasing', ['dorian', 'mixolydian', 'targets']],
  ['Advanced voicing', ['shells', 'rootless', 'altered']],
  ['Jazz harmony', ['minor-cadence', 'turnaround', 'tritone-sub']]
];
const CHART_COLORS = ['#a9ebaf', '#ffcb85', '#8ccbff', '#f7a9dc', '#c9b2ff',
  '#78e4df', '#ffab9f', '#e4e38e', '#b9cdff'];

function captureCurriculumScores(progress) {
  const {concepts} = courseMemory(progress);
  return Object.fromEntries(Object.entries(concepts).map(([id, trace]) => [id, lessonScore(trace)]));
}

function groupScore(run, skills) {
  return Number((skills.reduce((sum, id) => sum + (run.curriculumScores[id] || 0), 0) / skills.length).toFixed(1));
}

function renderExerciseHistory() {
  const history = state.progress.exerciseHistory.filter(run => run.curriculumScores);
  const tested = new Set(history.at(-1)?.testedSkills || []);
  const selected = SCORE_GROUPS.map(([label, skills], index) => ({
    label, skills, color: CHART_COLORS[index % CHART_COLORS.length],
    dash: index < CHART_COLORS.length ? [] : [7, 4]
  })).filter(entry => entry.skills.some(id => tested.has(id)));
  const legend = $('#exercise-chart-legend');
  legend.replaceChildren();
  for (const {label, color, dash} of selected) {
    const item = document.createElement('li');
    const line = document.createElement('span');
    line.style.borderColor = color;
    line.style.borderStyle = dash.length ? 'dashed' : 'solid';
    item.append(line, label);
    legend.append(item);
  }
  $('#exercise-chart-empty').hidden = selected.length > 0;
  $('#exercise-chart-details').hidden = !selected.length;
  const chart = $('#exercise-chart');
  chart.hidden = !selected.length;
  const ctx = chart.getContext('2d');
  const {width, height} = chart;
  const left = 52, right = width - 20, top = 15, bottom = height - 25;
  const y = score => bottom - score * (bottom - top) / 100;
  const x = index => history.length === 1 ? (left + right) / 2
    : left + index * (right - left) / (history.length - 1);

  if (ctx) {
    ctx.clearRect(0, 0, width, height);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#c4d3c9';
    ctx.strokeStyle = '#50665b';
    ctx.lineWidth = 1;
    for (const score of [0, 25, 50, 75, 100]) {
      ctx.fillText(`${score}%`, 2, y(score) + 5);
      ctx.beginPath();
      ctx.moveTo(left, y(score));
      ctx.lineTo(right, y(score));
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    history.forEach((run, index) => ctx.fillText(String(run.number), x(index), height - 5));
    selected.forEach(({skills, color, dash}) => {
      const points = history.map((run, i) => [x(i), y(groupScore(run, skills))]);
      ctx.strokeStyle = ctx.fillStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash(dash);
      ctx.beginPath();
      points.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
      ctx.stroke();
      points.forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
    ctx.setLineDash([]);
    ctx.textAlign = 'start';
  }
  const values = $('#exercise-chart-values');
  values.replaceChildren();
  for (const run of history) {
    const row = document.createElement('li');
    const scores = selected.map(entry => `${entry.label} ${groupScore(run, entry.skills)}%`);
    row.textContent = `Exercise ${run.number} · ${scores.join(' · ')}`;
    values.append(row);
  }
}

function showContinuation(session, number) {
  const useScale = number % 2 === 0;
  const key = choose(KEYS);
  const scale = choose(SCALE_TYPES);
  const type = choose(Object.keys(CHORD_TYPES));
  const prompt = useScale
    ? {kind: 'scale', title: `${PRETTY(key.name)} ${titleCase(scale.label)} Scale`, rootPc: key.pc, steps: scale.steps}
    : {kind: 'stack', title: chordTitle(key.name, CHORD_TYPES[type]), stages: [{tones: makeTones(key.name, CHORD_TYPES[type].specs)}]};
  const exercise = {
    prompt,
    example: {stage: 0, index: 0, held: new Set()},
    complete: continueAfterRun,
    redraw() { renderExampleKeyboard($('#continue-keys'), exercise); }
  };
  session.continuation = {exercise};
  $('#continuation-label').textContent = 'Play ' + prompt.title + ' to continue';
  if (useScale) renderConceptCopy($('#continuation-formula'), prompt);
  else $('#continuation-formula').textContent = CHORD_TYPES[type].formula;
  exercise.redraw();
  if (spokenPrompts) void speak('Play ' + (useScale
    ? spokenNote(key.name) + ' ' + scale.label + ' scale.'
    : spokenNote(key.name) + ' ' + chordQuality(CHORD_TYPES[type]) + '.'));
}

function continueAfterRun() {
  const session = state.session;
  if (!session?.continuation) return;
  session.continuation = null;
  if (state.practice) {
    if (!offerNext(session)) startCurriculum(true);
  } else {
    const {guided} = session;
    if (guided?.branch) startBranch([...new Set(guided.branch.map(entry => entry.skill))], guided.branchTitle);
    else if (guided?.freeLesson) startFreeLesson(guided.skill, guided.key);
    else if (guided) startCurriculum(false);
    else startRun();
  }
}

function clearPendingInterval(session) {
  if (session?.intervalTimer == null) return;
  window.clearTimeout(session.intervalTimer);
  session.intervalTimer = null;
  session.intervalPending = null;
}
function stopTimers() {
  window.clearTimeout(lessonHintTimer);
  stopSpeech();
  clearPendingInterval(state.session);
  if (state.timer !== null) window.clearInterval(state.timer);
  if (state.transition !== null) window.clearTimeout(state.transition);
  state.timer = null;
  state.transition = null;
}
function startTimer(seconds) {
  const s = state.session;
  if (!s || !s.arcade) return;
  const budget = seconds * 1000;
  $('#time-label').textContent = `${seconds}s LEFT`;
  state.timer = window.setInterval(() => {
    if (state.session !== s || s.busy || document.hidden || s.response.waiting) return;
    const remain = Math.max(0, Math.ceil((budget - responseElapsed(s.response)) / 1000));
    $('#time-label').textContent = `${remain}s LEFT`;
    if (remain === 0) {
      stopTimers();
      skipRound('Time expired');
    }
  }, 100);
}

let lessonHintTimer;

function scaleRows(steps) {
  const moves = steps.slice(1).map((pitch, i) => {
    const gap = pitch - steps[i];
    return gap === 1 ? 'H' : 'W' + '#'.repeat(gap - 2);
  });
  const degrees = steps.map((pitch, i) => {
    const delta = pitch - (MAJOR[i % 7] + 12 * Math.floor(i / 7));
    return (i % 7 + 1) + (delta < 0 ? 'b' : '#').repeat(Math.abs(delta));
  });
  return ['R ' + moves.slice(0, 3).join('') + ' ' + moves.slice(3).join(''), degrees.join(' ')];
}

function renderConceptCopy(node, prompt) {
  if (prompt.kind !== 'scale') { node.textContent = practiceHint(prompt); return; }
  node.replaceChildren();
  const block = document.createElement('span');
  block.className = 'scale-formula';
  for (const row of scaleRows(prompt.steps)) {
    const line = document.createElement('span');
    line.textContent = row;
    block.append(line);
  }
  node.append(block);
}

function exampleNotes(prompt, stage) {
  if (prompt.kind === 'scale') return prompt.steps.map(step => 60 + prompt.rootPc + step);
  if (prompt.kind === 'interval') return [60 + prompt.rootPc, 60 + prompt.rootPc + prompt.semitones];
  if (prompt.kind === 'single') return [60 + prompt.targetPc];
  const chord = prompt.stages[stage];
  const bass = chord.bassPc ?? chord.tones[0].pc;
  return chord.tones.map(t => 60 + bass + mod(t.pc - bass)).sort((a,b) => a-b);
}

function drawKeyboardDiagram(board, notes, {stack = false, current, onPlay} = {}) {
  board.replaceChildren();
  const start = 60, end = 12 * Math.floor(Math.max(...notes) / 12) + 11;
  const whites = 7 * ((end - start + 1) / 12);
  let white = 0;
  for (let n = start; n <= end; n++) {
    const black = !NATURAL_PCS.includes(mod(n));
    const key = document.createElement(onPlay ? 'button' : 'span');
    key.className = 'example-key' + (black ? ' black' : '');
    key.style.left = (white - (black ? 0.3 : 0)) * 100 / whites + '%';
    key.style.width = (black ? 0.6 : 1) * 100 / whites + '%';
    const index = notes.indexOf(n);
    if (index >= 0) {
      key.classList.add('target');
      key.textContent = stack ? '●' : String(index + 1);
      if (!stack && index === current) key.classList.add('current');
    }
    if (onPlay) {
      key.type = 'button';
      key.setAttribute('aria-label', noteOctave(n));
      key.onclick = () => onPlay(n);
    }
    board.append(key);
    if (!black) white++;
  }
}

function renderExampleKeyboard(board, session) {
  const {prompt, example} = session;
  const stack = prompt.kind === 'stack';
  drawKeyboardDiagram(board, exampleNotes(prompt, example.stage), {
    stack,
    current: example.index,
    onPlay(note) {
      if (stack && example.held.delete(note)) return;
      playExample(session, note);
      if (!stack) example.held.delete(note);
    }
  });
}

function drawExample(session) {
  const {prompt, example} = session;
  renderExampleKeyboard($('#example-keys'), session);
  $('#example-label').textContent = (prompt.stages?.[example.stage]?.label || prompt.title) +
    (prompt.kind === 'stack' ? ' · Hold the marked keys together' : ' · Follow the numbered keys');
}

function playExample(session, note) {
  const {prompt, example, complete = dismissConcept, redraw = () => drawExample(session)} = session;
  if (example.held.has(note)) return;
  example.held.add(note);
  const notes = exampleNotes(prompt, example.stage);
  if (prompt.kind === 'stack') {
    const held = [...example.held];
    const chord = prompt.stages[example.stage];
    if (!held.every(n => notes.some(t => mod(t) === mod(n))) ||
        !notes.every(t => held.some(n => mod(n) === mod(t))) ||
        (chord.bassPc != null && mod(Math.min(...held)) !== chord.bassPc)) return;
    if (++example.stage === prompt.stages.length) { complete(); return; }
  } else {
    if (prompt.kind === 'interval' && mod(note) === prompt.rootPc &&
        example.held.has(note + prompt.semitones)) { complete(); return; }
    if (example.index && note === example.anchor + notes[example.index] - notes[0]) example.index++;
    else {
      example.index = Number(mod(note) === mod(notes[0]));
      example.anchor = note;
    }
    if (example.index === notes.length) { complete(); return; }
  }
  redraw();
}

function practiceHint(p) {
  if (p.skill?.hint) return p.skill.hint;
  if (p.kind === 'interval') {
    return p.semitones === 5 ? 'A perfect fourth is one semitone above a major third.'
      : `Count ${p.semitones} half steps up from the root. Each neighboring key is one half step away.`;
  }
  if (p.kind === 'scale') {
    const steps = p.steps.slice(1).map((step, i) => ({1: 'H', 2: 'W', 3: '3H'})[step - p.steps[i]]);
    return `Start at the root. ${steps.join(' – ')}. W is a whole step and H is a half step.`;
  }
  if (p.mode === 'notes') return 'Locate the groups of two and three black keys. The white-key letter pattern repeats in each octave.';
  if (p.mode === 'inversions') return 'Keep the same chord tones. Use the third as the bass in first inversion and the fifth in second inversion.';
  if (p.mode === 'guides') return 'Use just the third and seventh of each chord. Look for common tones and half-step resolutions.';
  if (p.mode === 'cadence') return 'Build a minor seventh on degree two, a dominant seventh on degree five, and a major seventh on the tonic.';
  if (p.mode === 'voicings') return 'Start with the third and seventh. Count any requested extensions above the root, then leave the root out.';
  return 'Count each chord degree from its root. Stack thirds for triads and seventh chords. For a suspended chord, replace the third with the indicated second or fourth.';
}

function showLessonHint(session, heading) {
  const {prompt} = session;
  renderConceptCopy($('#lesson-hint-copy'), prompt);
  const diagram = $('#lesson-hint-keys');
  diagram.hidden = prompt.kind !== 'scale';
  if (prompt.kind === 'scale') {
    diagram.setAttribute('aria-label', prompt.tones.map(tone => PRETTY(tone.name)).join(', '));
    drawKeyboardDiagram(diagram, exampleNotes(prompt));
  }
  $('#lesson-hint-title').textContent = heading;
  $('#lesson-hint').hidden = false;
  $('#hint-button').textContent = 'Hide hint';
}

function scheduleLessonHint(session) {
  window.clearTimeout(lessonHintTimer);
  if (!$('#lesson-hint').hidden) return;
  const prompt = session.prompt;
  lessonHintTimer = window.setTimeout(() => {
    if (state.session === session && session.prompt === prompt && !session.busy && !session.finished) {
      showLessonHint(session, 'Hint');
    }
  }, 6000);
}

function setupLessonHint(session) {
  const skill = session.prompt.skill;
  $('#lesson-hint').hidden = true;
  $('#hint-button').textContent = 'Show hint (less XP)';
  if (!skill) { scheduleLessonHint(session); return; }
  const concept = courseMemory(state.progress).concepts[skill.id];
  const trace = skill.scales ? rootTrace(concept, session.prompt.statRoot) : concept;
  const now = Date.now();
  const refresher = needsRefresher(trace, now);
  if (!session.firstExposure && !refresher) { scheduleLessonHint(session); return; }
  trace.explainedAt = now;
  persist();
  session.showingIntro = true;
  $('#concept-kind').textContent = refresher ? 'Concept refresher' : 'New concept';
  $('#concept-name').textContent = skill.scales ? session.prompt.title : skill.label;
  renderConceptCopy($('#concept-copy'), session.prompt);
  session.example = { index: 0, stage: 0, held: new Set() };
  drawExample(session);
  $('#concept-intro').showModal();
}

function needsRefresher(trace, now) {
  return trace.lastAnswered > (trace.explainedAt || 0)
    && now - (trace.explainedAt || 0) >= 86400000
    && trace.recent.slice(-8).filter(clean => !clean).length >= 2
    && retention(trace, now) < 0.25;
}

function dismissConcept() {
  const session = state.session;
  if (!session?.showingIntro) return;
  $('#concept-intro').close();
  session.showingIntro = false;
  session.response.start = performance.now();
  session.response.pausedAt = document.hidden ? performance.now() : null;
  scheduleLessonHint(session);
  if (spokenPrompts) speakChallenge();

}

function revealHint() {
  const session = state.session;
  if (!session?.prompt || session.busy) return;
  window.clearTimeout(lessonHintTimer);
  if ($('#lesson-hint').hidden) {
    session.roundHint = true;
    showLessonHint(session, 'Hint');
  } else {
    $('#lesson-hint').hidden = true;
    $('#hint-button').textContent = 'Show hint (less XP)';
    scheduleLessonHint(session);
  }
}
function renderProgress() {
  const p = state.progress;
  const level = Math.floor(p.xp / 500) + 1;
  const ranks = ['Novice', 'Foundation Builder', 'Chord Explorer', 'Harmony Seeker', 'Jazz Apprentice', 'Voicing Architect', 'Jazz Navigator', 'Improviser'];
  $('#rank-label').textContent = ranks[Math.min(Math.floor((level - 1) / 2), ranks.length - 1)];
  $('#rank-level').textContent = `LVL ${String(level).padStart(2, '0')}`;
  $('#xp-fill').style.width = `${(p.xp % 500) / 5}%`;
  $('#xp-progress').textContent = `${p.xp % 500} / 500 XP to next level`;
  $('#xp-total').textContent = `${p.xp.toLocaleString()} XP`;
  $('#total-answered').textContent = p.correct.toLocaleString();
  $('#key-mastery').replaceChildren();
  KEYS.forEach((key) => {
    const s = p.keyStats[key.name];
    const acc = s?.attempts ? Math.round(s.correct / s.attempts * 100) : 0;
    const levelName = s?.attempts >= 4 && acc >= 80 ? 'strong' : s?.attempts ? 'learning' : 'new';
    const item = document.createElement('div');
    item.className = `mastery-key ${levelName === 'new' ? '' : levelName}`;
    item.textContent = PRETTY(key.name);
    item.title = s?.attempts ? `${s.correct} / ${s.attempts} correct (${acc}%)` : 'Not practiced yet';
    $('#key-mastery').appendChild(item);
  });
  renderAchievements();
}
function renderQuests() {
  const daily = state.progress.daily;
  const allComplete = QUESTS.every((q) => daily[q.id] >= q.target);
  $('#quest-list').innerHTML = QUESTS.map((quest) => {
    const value = Math.min(daily[quest.id] || 0, quest.target);
    return `<div class="quest"><div class="quest-icon">${quest.symbol}</div><div class="quest-text"><strong>${quest.title}</strong><small>${quest.desc} · ${value}/${quest.target}</small><div class="mini-track"><span style="width:${100 * value / quest.target}%"></span></div></div></div>`;
  }).join('');
  const button = $('#claim-reward');
  button.disabled = !allComplete || daily.claimed;
  if (daily.claimed) button.innerHTML = 'Reward claimed <span>✓ +200 XP</span>';
  else if (allComplete) button.innerHTML = 'Claim daily reward <span>+200 XP</span>';
  else button.innerHTML = 'Complete all quests <span>+200 XP</span>';
}
function claimQuestReward() {
  if (state.progress.daily.claimed || QUESTS.some((q) => state.progress.daily[q.id] < q.target)) return;
  state.progress.daily.claimed = true;
  state.progress.xp += 200;
  persist();
  toast('Daily mission complete! +200 XP');
  renderQuests();
  renderProgress();
}
function renderAchievements() {
  const p = state.progress;
  $('#achievement-list').innerHTML = ACHIEVEMENTS.slice(0, 5).map((a) => `
    <div class="achievement ${p.achievements.includes(a.id) ? 'unlocked' : ''}"><div class="achievement-mark">${a.symbol}</div><div><strong>${a.title}</strong><small>${a.description}</small></div></div>`).join('');
}
function checkAchievements() {
  for (const item of ACHIEVEMENTS) {
    if (!state.progress.achievements.includes(item.id) && item.unlocked(state.progress)) {
      state.progress.achievements.push(item.id);
      state.progress.xp += 100;
      toast(`Achievement unlocked: ${item.title} · +100 XP`, 'purple');
    }
  }
  persist();
  renderProgress();
}
function setMidiStatus(text, status = '') {
  $('#midi-status-text').textContent = text;
  $('#midi-status').className = `midi-status ${status}`;
}
function onMidiMessage(event) {
  const [first, data1, data2] = event.data;
  const command = first & 0xF0;
  if (command === 0x90 && data2 > 0) onNoteOn(data1);
  else if (command === 0x80 || (command === 0x90 && data2 === 0)) onNoteOff(data1);
}
function bindMidiPorts() {
  if (!state.midiAccess) return;
  const inputs = [...state.midiAccess.inputs.values()].filter((input) => input.state === 'connected');
  inputs.forEach((port) => { port.onmidimessage = onMidiMessage; });
  state.midiConnected = inputs.length > 0;
  if (inputs.length) {
    setMidiStatus(inputs.length === 1 ? inputs[0].name || 'MIDI connected' : `${inputs.length} MIDI inputs`, 'connected');
    $('#input-label').textContent = `· ${inputs.map((input) => input.name || 'MIDI input').join(', ')}`;
    $('#connect-midi').textContent = '✓ MIDI ready';
  } else {
    setMidiStatus('No MIDI input found');
    $('#input-label').textContent = '· ON-SCREEN / COMPUTER KEYBOARD';
    $('#connect-midi').textContent = '⌁ Retry MIDI';
  }
}
async function reconnectMidiOnLoad() {
  if (!navigator.requestMIDIAccess || !window.isSecureContext) return;
  let permission;
  try {
    permission = await navigator.permissions?.query({ name: 'midi', sysex: false });
  } catch {
    return;
  }
  if (permission?.state === 'granted' && !state.midiAccess) await connectMidi(true);
}

async function connectMidi(automatic = false) {
  if (state.midiRequestPending) return;
  if (!('requestMIDIAccess' in navigator)) {
    setMidiStatus('Web MIDI unsupported', 'error');
    toast('Web MIDI requires a compatible browser such as Chrome or Edge.', 'bad');
    return;
  }
  if (!window.isSecureContext) {
    setMidiStatus('HTTPS / localhost required', 'error');
    toast('Open this app via HTTPS or http://localhost to use Web MIDI.', 'bad');
    return;
  }
  state.midiRequestPending = true;
  try {
    setMidiStatus(automatic ? 'Connecting MIDI…' : 'Requesting MIDI permission…');
    state.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    state.midiAccess.onstatechange = bindMidiPorts;
    bindMidiPorts();
    if (!automatic) {
      if (state.midiConnected) toast('MIDI keyboard detected. Play a note!');
      else toast('MIDI permission granted. Connect your keyboard and try again.');
    }
  } catch (error) {
    if (automatic) setMidiStatus('MIDI not connected');
    else {
      setMidiStatus('MIDI access unavailable', 'error');
      toast(`Could not access MIDI: ${error?.message || 'permission denied'}`, 'bad');
    }
  } finally {
    state.midiRequestPending = false;
  }
}
function exportProgress() {
  const data = JSON.stringify({ exportedAt: new Date().toISOString(), application: 'Keycraft', progress: state.progress }, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `keycraft-progress-${today()}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const COMPUTER_KEYS = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72 };
function refreshNextPrompt() {
  const session = state.session;
  if (!session?.nextPrompt || session.guided) return;
  session.nextPrompt = generateChallenge(state.lastPromptRoot);
  if (session.nextAudio?.prompt !== session.prompt) session.nextAudio = undefined;
  prepareNextSpeech(session);
}

function bindEvents() {
  $('#advance-next').addEventListener('click', () => resolveOffer(true));
  $('#advance-keep').addEventListener('click', () => resolveOffer(false));
  $('#advance-dialog').addEventListener('cancel', event => {event.preventDefault(); resolveOffer(false);});
  $('#concept-continue').addEventListener('click', dismissConcept);
  $('#concept-intro').addEventListener('cancel', event => { event.preventDefault(); dismissConcept(); });
  $('#spoken-prompts').addEventListener('click', () => {
    spokenPrompts = !spokenPrompts;
    try { localStorage.setItem(SPEECH_KEY, spokenPrompts ? 'on' : 'off'); } catch {}
    renderSpeechSetting();
    if (!spokenPrompts) stopSpeech();
    else if (state.session?.prompt && !state.session.busy) speakChallenge();
    else speak('Spoken prompts on.');
    if (state.session) prepareNextSpeech(state.session);
  });
  $('#voice-engine').addEventListener('change', event => {
    stopSpeech();
    voiceEngine = event.target.value;
    try { localStorage.setItem('keycraft-voice-engine', voiceEngine); } catch {}
    renderSpeechSetting();
    if (spokenPrompts) speakChallenge();
    if (state.session) prepareNextSpeech(state.session);
  });
  $('#replay-prompt').addEventListener('click', speakChallenge);
  $('#mode-nav').addEventListener('click', (event) => {
    const phase = event.target.closest('[data-phase]');
    if (phase) {
      const group = CURRICULUM[Number(phase.dataset.phase)];
      startBranch(group.skills, group.title);
      return;
    }
    const lesson = event.target.closest('[data-lesson-play]');
    if (lesson) {
      const skill = CURRICULUM.flatMap(group => group.skills).find(item => item.id === lesson.dataset.lessonPlay);
      startBranch([skill], skill.label);
      return;
    }
    const node = event.target.closest('[data-skill]');
    if (node) {
      const skill = CURRICULUM.flatMap(group => group.skills).find(item => item.id === node.dataset.skill);
      if (skill) startFreeLesson(skill, node.dataset.root);
    }
  });
  $('#key-select').addEventListener('change', (event) => { state.key = event.target.value; refreshNextPrompt(); if (!state.session) renderReady(); });
  $('#difficulty-select').addEventListener('change', (event) => { state.difficulty = event.target.value; refreshNextPrompt(); if (!state.session) renderReady(); });
  $('#practice-btn').addEventListener('click', () => setRunType('practice'));
  $('#arcade-btn').addEventListener('click', () => setRunType('arcade'));
  $('#start-game').addEventListener('click', () => startRun());
  $('#play-again').addEventListener('click', continueAfterRun);
  $('#start-curriculum').addEventListener('click', startSuggestedDrill);
  $('#just-practice').addEventListener('click', () => {
    if (state.practice) {
      setContinuousPractice(false);
      selectMode(state.mode);
    } else startCurriculum(true);
  });
  $('#connect-midi').addEventListener('click', () => connectMidi());
  $('#hint-button').addEventListener('click', revealHint);
  $('#skip-button').addEventListener('click', () => skipRound());
  $('#claim-reward').addEventListener('click', claimQuestReward);
  $('#export-progress').addEventListener('click', exportProgress);
  $('#keyboard').addEventListener('click', (event) => {
    const key = event.target.closest('[data-note]');
    if (key) toggleVirtual(Number(key.dataset.note));
  });
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    const midi = COMPUTER_KEYS[event.key.toLowerCase()];
    if (midi === undefined || state.computerHeld.has(event.code)) return;
    event.preventDefault();
    state.computerHeld.set(event.code, midi);
    onNoteOn(midi, 'computer');
  });
  window.addEventListener('keyup', (event) => {
    if (!state.computerHeld.has(event.code)) return;
    const midi = state.computerHeld.get(event.code);
    state.computerHeld.delete(event.code);
    onNoteOff(midi);
  });
  window.addEventListener('blur', () => {
    if (state.session?.response) state.session.response.invalid = true;
    for (const midi of state.computerHeld.values()) onNoteOff(midi);
    state.computerHeld.clear();
  });
  document.addEventListener('visibilitychange', () => {
    const response = state.session?.response;
    if (!response) return;
    if (document.hidden) response.invalid = true;
    syncResponseClock(response);
  });
  if (!('requestMIDIAccess' in navigator)) setMidiStatus('Keyboard simulation available');
}
function setRunType(type) {
  state.runType = type;
  $('#practice-btn').classList.toggle('selected', type === 'practice');
  $('#arcade-btn').classList.toggle('selected', type === 'arcade');
  $('#practice-btn').setAttribute('aria-pressed', String(type === 'practice'));
  $('#arcade-btn').setAttribute('aria-pressed', String(type === 'arcade'));
  if (!state.session) renderReady();
}
function setContinuousPractice(enabled) {
  state.practice = enabled;
  state.practiceRotation = enabled ? new Set(reviewGroups(state.progress).flat().map(skill => skill.id)) : null;
  highlightPracticeBranches();
  const button = $('#just-practice');
  button.textContent = enabled ? 'Stop practice' : 'Just Practice';
  button.setAttribute('aria-pressed', String(enabled));
}

function startSuggestedDrill() {
  setRunType('practice');
  learningFocus(state.progress);
  const {skill} = scheduledLesson(state.progress, 1);
  setContinuousPractice(false);
  selectMode(skill.mode);
  startRun({skill, scheduled: true});
}

function startCurriculum(continuous = true) {
  setContinuousPractice(continuous);
  const {skill} = scheduledLesson(state.progress, 1);
  selectMode(skill.mode);
  startRun({skill, scheduled: true});
  $('#challenge-title').scrollIntoView({block:'nearest'});
}

function offerNext(session) {
  const next = session.guided && !session.guided.branch && advancement(state.progress, Date.now());
  if (!next) return false;
  session.offer = next;
  $('#advance-next').textContent = 'Take it one step further — ' +
    (next.key ? curriculumRootLabel(next.skill, next.key) : next.skill.label);
  $('#advance-dialog').showModal();
  return true;
}

function resolveOffer(advance) {
  const s = state.session;
  if (!s?.offer) return;
  const {skill, key} = s.offer;
  s.offer = null;
  $('#advance-dialog').close();
  if (advance) {
    courseMemory(state.progress).focus = {skillId: skill.id, key: key || null, clean: 0};
    persist();
    selectMode(skill.mode);
    startRun({skill, scheduled: true});
  } else {
    courseMemory(state.progress).offerAfter = Date.now() + 600000;
    persist();
    if (s.finished) startCurriculum(true);
    else nextRound();
  }
}

function initialize() {
  renderSpeechSetting();
  renderCurriculum();
  renderModes();
  renderKeyboard();
  bindEvents();
  renderReady();
  renderCounters();
  renderKeyboardState();
  renderProgress();
  renderQuests();
  checkAchievements();
  reconnectMidiOnLoad();
}
initialize();
