<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Catalog from './Catalog.svelte';
  import Piano from './Piano.svelte';
  import RunHistory from './RunHistory.svelte';
  import { answerText, exampleKeys } from './answer-display.ts';
  import { LESSONS, LESSON_BY_ID } from './catalog.ts';
  import { CANONICAL_KEYS, KEYS, MODES, midiName, pretty } from './domain.ts';
  import type { Difficulty, Key, Mode, RunType, Scope } from './domain.ts';
  import { Game } from './game.ts';
  import type { GameView } from './game.ts';
  import { createInput } from './input.ts';
  import type { MidiStatus } from './input.ts';
  import { registerOffline } from './offline.ts';
  import type { OfflineState } from './offline.ts';
  import { voiceCatalog } from './prompts.ts';
  import { BADGES, QUESTS, levelFor } from './results.ts';
  import { lessonMastered } from './schedule.ts';
  import { exportProgress, openProgress } from './storage.ts';
  import { createVoice } from './voice.ts';
  import type { VoiceState } from './voice.ts';

  const local = openProgress();
  const progress = local.progress;
  let input: ReturnType<typeof createInput> | undefined;
  let voice: ReturnType<typeof createVoice> | undefined;
  let offline: ReturnType<typeof registerOffline> | undefined;
  let mounted = false;
  let wake: ReturnType<typeof setTimeout> | undefined;
  let midnight: ReturnType<typeof setTimeout> | undefined;
  let revision = $state(0);
  let storageError = $state(local.error);
  let mode = $state<Mode>('chords');
  let modeType = $state<RunType>('practice');
  let midi = $state.raw<MidiStatus>({ text: 'Checking MIDI availability…', canConnect: false, connecting: false, connected: false });
  let piano = $state.raw<{ held: ReadonlySet<number>; latched: ReadonlySet<number>; base: number }>({ held: new Set(), latched: new Set(), base: 60 });
  let heldNames = $state('No notes held');
  let voiceStatus = $state.raw<VoiceState>();
  let offlineStatus = $state.raw<OfflineState>();
  let teachingDialog = $state<HTMLDialogElement>();
  let advanceDialog = $state<HTMLDialogElement>();
  let playHeading = $state<HTMLElement>();
  let drillHeading = $state<HTMLElement>();
  let pathOpen = $state(false);

  const game = new Game(progress, {
    changed: draw,
    save: () => {
      local.save();
      storageError = local.error;
      revision += 1;
    },
    clearVirtual: () => { input?.releaseVirtual(); },
    speech: (text, next) => {
      if (!voice) return;
      if (text) voice.play(text);
      else voice.stop();
      if (next) voice.prepare([next]);
    },
  });
  const start: (scope: Scope) => void = game.start.bind(game);

  let view = $state.raw(game.view());
  const currentLesson = $derived(view.prompt?.lessonId ? LESSON_BY_ID.get(view.prompt.lessonId) : undefined);
  const stage = $derived(view.prompt?.kind === 'stack' ? view.prompt.stages[view.stage] : undefined);
  const continuous = $derived(view.scope?.kind === 'guided' && view.scope.entry === 'continuous');
  const noteTargets = $derived(view.hint && view.prompt ? exampleKeys(view.prompt, view.stage) : undefined);
  const stats = $derived.by(() => {
    revision;
    return {
      ...levelFor(progress.xp), xp: progress.xp, clears: progress.correct,
      date: progress.daily.date, daily: progress.daily, earned: new Set(progress.achievements),
      keys: CANONICAL_KEYS.map(key => ({ key, ...progress.keyStats[key] })),
    };
  });
  const guidance = $derived.by(() => {
    revision;
    const course = progress.curriculum.courseV3;
    const last = course.admitted.at(-1)!;
    const target = !lessonMastered(course, last) ? last : course.admitted.find(id => !lessonMastered(course, id));
    if (!target) return 'Continue spaced review. A new lesson is offered at the end of an exercise when eligible.';
    const roots = course.concepts[target]?.rootTraces;
    const ready = KEYS.filter(key => {
      const recent = roots?.[key]?.mastery.slice(-4);
      return recent?.length === 4 && recent.every(result => result === 'unaided-success');
    }).length;
    return `${LESSON_BY_ID.get(target)!.title}: ${ready}/${KEYS.length} keys with four consecutive unaided clears. Earlier lessons stay in review.`;
  });

  function draw() {
    if (!mounted) return;
    const previous = view;
    view = game.view();
    if (view.phase === 'playing' &&
        (previous.scope !== view.scope || (previous.phase !== 'playing' && previous.phase !== 'feedback'))) {
      void tick().then(() => { if (view.phase === 'playing') playHeading?.focus(); });
    } else if (view.phase === 'summary' && previous.phase !== 'summary') {
      void tick().then(() => { if (view.phase === 'summary') drillHeading?.focus(); });
    }
    clearTimeout(wake);
    const delay = game.wakeAfter();
    if (delay !== undefined) wake = setTimeout(() => game.tick(), Math.ceil(delay));
  }

  function scheduleMidnight() {
    clearTimeout(midnight);
    const next = new Date();
    next.setHours(24, 0, 0, 0);
    midnight = setTimeout(() => {
      game.maintenance();
      scheduleMidnight();
    }, Math.max(1, next.getTime() - Date.now()));
  }

  function playVirtual(note: number) { input?.toggleVirtual(note); }

  function chooseRunType(type: RunType) {
    modeType = type;
    game.settings.runType = type;
  }

  function toggleVoice() {
    if (!voice) return;
    const enable = !voice.state.enabled;
    voice.setEnabled(enable);
    if (enable) game.replay();
  }

  onMount(() => {
    mounted = true;
    function refreshPiano() {
      if (!input) return;
      piano = { held: input.held, latched: input.virtualHeld, base: input.baseNote };
      heldNames = input.held.size ? [...input.held].sort((a, b) => a - b).map(midiName).join(', ') : 'No notes held';
    }
    input = createInput(event => game.input(event), status => { midi = status; }, refreshPiano);
    voice = createVoice(state => { voiceStatus = state; }, active => game.setSpeaking(active));
    voiceStatus = voice.state;
    refreshPiano();
    const onVisibility = () => {
      game.setHidden(document.hidden);
      scheduleMidnight();
    };
    const onBlur = () => game.invalidateTiming();
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    input.start();
    if (import.meta.env.PROD) offline = registerOffline(state => { offlineStatus = state; });

    return () => {
      mounted = false;
      clearTimeout(wake);
      clearTimeout(midnight);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      game.stop();
      input?.dispose();
      voice?.dispose();
      offline?.dispose();
    };
  });

  $effect(() => {
    if (!teachingDialog || !advanceDialog) return;
    const teaching = view.phase === 'teaching';
    const advancing = view.phase === 'advance';
    if (!teaching && teachingDialog.open) teachingDialog.close();
    if (!advancing && advanceDialog.open) advanceDialog.close();
    if (teaching && !teachingDialog.open) teachingDialog.showModal();
    if (advancing && !advanceDialog.open) advanceDialog.showModal();
  });
</script>

{#snippet keyboardRegister()}
  <div class="controls register" role="group" aria-label="Computer keyboard register">
    <button type="button" class="small" onclick={() => input?.shift(-1)} aria-label="Shift computer keyboard down one octave" disabled={piano.base <= 0}>Octave down</button>
    <span>{midiName(piano.base)}–{midiName(piano.base + 12)}</span>
    <button type="button" class="small" onclick={() => input?.shift(1)} aria-label="Shift computer keyboard up one octave" disabled={piano.base >= 108}>Octave up</button>
  </div>
{/snippet}

{#snippet workedExample(example: NonNullable<GameView['preview']>, label: string)}
  <p class="answer-text">{answerText(example.prompt)}</p>
  {#if example.prompt.kind === 'scale'}
    <p>Ascending · {example.step} of {example.prompt.steps.length} notes</p>
  {:else if example.prompt.kind === 'stack' && example.prompt.stages.length > 1}
    <p>Stage {example.stage + 1}/{example.prompt.stages.length}: {example.prompt.stages[example.stage].label}</p>
  {/if}
  <Piano {label} keys={piano} targets={exampleKeys(example.prompt, example.stage)} play={playVirtual} />
  <p role="status" class="feedback">{example.message}</p>
{/snippet}

<header class="topbar">
  <div><div class="eyebrow">PIANO THEORY PRACTICE</div><h1>KeyCraft</h1></div>
  <div class="controls">
    <span id="midi-status" role="status">{midi.text}</span>
    {#if midi.canConnect && !midi.connected}
      <button type="button" disabled={midi.connecting} onclick={() => void input?.connectMidi()}>Connect MIDI</button>
    {/if}
  </div>
</header>

<div class="layout">
  <aside class="rail">
    <section class="panel guided" aria-labelledby="guided-title">
      <h2 id="guided-title">Guided curriculum</h2>
      <div class="controls">
        <button type="button" id="just-practice" class="primary" aria-pressed={continuous}
          onclick={() => continuous ? game.stop() : start({ kind: 'guided', entry: 'continuous' })}>{continuous ? 'Stop practice' : 'Just Practice'}</button>
        <button type="button" id="start-suggested" onclick={() => start({ kind: 'guided', entry: 'suggested' })}>Start suggested drill</button>
      </div>
      <p class="muted">{guidance}</p>
      <details bind:open={pathOpen}>
        <summary>View learning path</summary>
        {#if pathOpen}
          <ol class="learning-path">
            {#each LESSONS as lesson, index (lesson.id)}
              <li aria-current={view.scope?.kind === 'guided' && currentLesson?.id === lesson.id ? 'step' : undefined}>
                {lesson.title} · {view.scope?.kind === 'guided' && currentLesson?.id === lesson.id && view.prompt
                  ? `${view.role === 'review' ? 'Review' : 'Focus'} · ${pretty(view.prompt.key)}`
                  : index < progress.curriculum.courseV3.admitted.length ? 'Admitted' : 'Upcoming'}
              </li>
            {/each}
          </ol>
        {/if}
      </details>
    </section>
    <section class="panel"><Catalog {progress} {view} {revision} {start} /></section>
  </aside>

  <main>
    <section class="panel" aria-labelledby="settings-title">
      <h2 id="settings-title">Standalone drills</h2>
      <div class="controls">
        <label>Mode<select value={mode} onchange={event => { mode = event.currentTarget.value as Mode; game.stop(); }}>
          {#each Object.entries(MODES) as [id, title] (id)}<option value={id}>{title}</option>{/each}
        </select></label>
        <label>Key focus<select value={game.settings.key} onchange={event => { game.settings.key = event.currentTarget.value as Key | 'auto'; }}>
          <option value="auto">Automatic · all keys</option>
          {#each CANONICAL_KEYS as key}<option value={key}>{pretty(key)} major</option>{/each}
        </select></label>
        <label>Difficulty<select value={game.settings.difficulty} onchange={event => { game.settings.difficulty = event.currentTarget.value as Difficulty; }}>
          <option value="foundation">Foundation</option><option value="intermediate">Intermediate</option><option value="jazz">Jazz</option>
        </select></label>
        <button type="button" class="primary" id="start-game" onclick={() => start({ kind: 'standalone', mode })}>Start training</button>
      </div>
      <div class="controls" role="group" aria-label="Scored run type">
        <button type="button" aria-pressed={modeType === 'practice'} onclick={() => chooseRunType('practice')}>Practice</button>
        <button type="button" aria-pressed={modeType === 'arcade'} onclick={() => chooseRunType('arcade')}>Arcade</button>
        <span class="muted">Arcade applies to standalone and fixed-key runs.</span>
      </div>
    </section>

    <section class="panel drill" aria-labelledby="drill-title">
      <div class="section-heading">
        <div><div class="eyebrow">{view.label ?? 'LIVE DRILL'}</div><h2 id="drill-title" tabindex="-1" bind:this={drillHeading}>{view.summary ? 'Exercise complete' : view.phase === 'ready' ? 'Ready to play' : 'Current drill'}</h2></div>
        {#if view.phase !== 'ready' && !continuous}
          <button type="button" class="small" onclick={() => game.stop()}>{view.summary ? 'Back to ready' : 'End drill'}</button>
        {/if}
      </div>
      {#if view.phase === 'ready'}
        <p>Start {MODES[mode]}, choose a Free Play lesson, or follow Just Practice.</p>
      {:else if view.summary}
        {@const result = view.summary}
        <p>Exercise {result.number} · {result.label}</p>
        <dl class="run-totals">
          <div><dt>Clears</dt><dd>{result.clears}/{result.planned}</dd></div>
          <div><dt>Points</dt><dd>{result.points}</dd></div>
          <div><dt>Accuracy</dt><dd>{result.accuracy}%</dd></div>
          <div><dt>XP earned</dt><dd>+{result.xp}</dd></div>
          <div><dt>Best combo</dt><dd>{result.bestCombo}</dd></div>
          <div><dt>Best score for this drill</dt><dd>{result.bestScore}</dd></div>
        </dl>
        {#if result.responseAverageMs !== undefined}
          <p>Average response: {(result.responseAverageMs / 1_000).toFixed(2)} s across {result.responseCount} timed rounds.</p>
        {/if}
        <RunHistory history={progress.exerciseHistory} />
        {#if view.preview}
          <section aria-labelledby="preview-title" class="preview">
            <h3 id="preview-title">Play {view.preview.prompt.title.replace(/^Play /, '')} to continue</h3>
            <p class="muted">Unscored example · {view.preview.prompt.instruction}</p>
            {@render workedExample(view.preview, 'Continuation piano')}
            {@render keyboardRegister()}
            <div class="controls">
              <button type="button" class="primary" onclick={() => game.continue()}>Continue</button>
              {#if voiceStatus?.enabled}<button type="button" onclick={() => game.replay()}>Replay prompt</button>{/if}
            </div>
          </section>
        {/if}
      {:else if view.prompt}
        {@const prompt = view.prompt}
        <p class="prompt-meta">{MODES[prompt.mode]} · {currentLesson ? currentLesson.title + ' · ' : ''}{pretty(prompt.key)}{view.role ? ` · ${view.role === 'focus' ? 'Focus' : 'Review'}` : ''}</p>
        <div class="controls clock">
          <span id="round-label">Round {view.round}/{view.total}</span>
          <span>{view.seconds === undefined ? 'Untimed Practice' : `${view.seconds} s remaining`}</span>
          {#if view.hearts !== undefined}<span>{view.hearts} {view.hearts === 1 ? 'heart' : 'hearts'} remaining</span>{/if}
          <span>{view.points} pts · Combo {view.combo}</span>
        </div>
        <h3 id="challenge-title" tabindex="-1" bind:this={playHeading} aria-live="polite">{prompt.kind === 'stack' && prompt.stages.length > 1 ? stage?.label : prompt.title}</h3>
        <p>{prompt.instruction}</p>
        {#if prompt.kind === 'scale'}
          <ol class="steps" aria-label="Scale progress">
            {#each prompt.tones as tone, index}
              <li class:reached={index < view.step} aria-current={index === view.step ? 'step' : undefined}>
                {index < view.step || view.hint ? pretty(tone.name) : index + 1}{index < view.step ? ' ✓' : ''}
              </li>
            {/each}
          </ol>
        {:else if prompt.kind === 'stack' && prompt.stages.length > 1}
          <ol class="steps" aria-label="Progression stages">
            {#each prompt.stages as item, index}
              {@const completed = index < view.stage || (view.phase === 'feedback' && !view.error)}
              <li class:reached={completed} aria-current={!completed && index === view.stage ? 'step' : undefined}>{item.label}{completed ? ' ✓' : ''}</li>
            {/each}
          </ol>
        {/if}
        {#if view.hint}
          <aside class="hint" aria-label="Answer hint"><strong>How to build it</strong><p>{prompt.theory}</p><p>{answerText(prompt)}</p></aside>
        {/if}
        <p class="feedback" class:error={view.error} role="status">{view.message}</p>
        <div class="controls">
          {#if voiceStatus?.enabled}<button type="button" onclick={() => game.replay()} disabled={view.phase !== 'playing'}>Replay prompt</button>{/if}
          <button type="button" onclick={() => game.toggleHint()} disabled={view.phase !== 'playing'}>{view.hint ? 'Hide hint' : 'Show hint (less XP)'}</button>
          <button type="button" onclick={() => game.skip()} disabled={view.phase !== 'playing'}>Skip</button>
        </div>
        <aside class="theory"><h3>Theory Lens</h3><p>{prompt.theory}</p></aside>
      {/if}
    </section>

    {#if !view.summary}
      <section class="panel monitor" aria-labelledby="input-title">
        <h2 id="input-title">Piano & input</h2>
        <Piano label="On-screen piano" keys={piano} targets={noteTargets} play={playVirtual} />
        {@render keyboardRegister()}
        <p class="muted">Click or focus a piano key and press Space to latch it. Computer keys: A W S E D F T G Y H U J K.</p>
        <p><strong>Last note:</strong> {view.lastNote === undefined ? '—' : midiName(view.lastNote)} · <strong>Held:</strong> {heldNames}</p>
      </section>
    {/if}

    <section class="panel" aria-labelledby="voice-title">
      <h2 id="voice-title">Spoken prompts</h2>
      {#if voiceStatus && (voiceStatus.browserAvailable || voiceStatus.neuralAvailable)}
        <div class="controls">
          <button type="button" aria-pressed={voiceStatus.enabled} onclick={toggleVoice}>{voiceStatus.enabled ? 'Mute spoken prompts' : 'Enable spoken prompts'}</button>
          {#if voiceStatus.browserAvailable && voiceStatus.neuralAvailable}
            <label>Voice engine<select value={voiceStatus.engine} onchange={event => voice?.setEngine(event.currentTarget.value as VoiceState['engine'])}>
              <option value="neural">Kokoro with browser fallback</option><option value="browser">Browser voice</option>
            </select></label>
          {/if}
          {#if voiceStatus.enabled && voiceStatus.engine === 'neural' && voiceStatus.neuralAvailable}
            <button type="button" onclick={() => voice?.warm(voiceCatalog())} disabled={Boolean(voiceStatus.warming)}>Prepare voice catalog (~90 MB model)</button>
          {/if}
        </div>
        {#if voiceStatus.warming}
          <p><progress value={voiceStatus.warming.done} max={voiceStatus.warming.total} aria-label="Prepared voice clips"></progress> {voiceStatus.warming.done}/{voiceStatus.warming.total} clips</p>
        {/if}
        <p class="muted" role="status">{voiceStatus.message}</p>
      {:else}
        <p>Speech is unavailable. Follow the written prompts.</p>
      {/if}
    </section>
  </main>

  <aside class="insights" aria-label="Progress and app status">
    <section class="panel" aria-labelledby="progress-title">
      <h2 id="progress-title">Progress</h2>
      <p><strong>{stats.rank}</strong> · Level {stats.level}</p>
      <progress max="500" value={stats.progress} aria-label="XP toward next level"></progress>
      <p>{stats.progress}/500 XP to next level · {stats.xp} lifetime XP · {stats.clears} clears</p>
      <button type="button" id="export-progress" onclick={() => exportProgress(progress)}>Export progress</button>
      <p class="muted">JSON backup. Saves and voice caches live on this site and do not transfer automatically to another host.</p>
      {#if storageError}<p role="status" class="error">{storageError}</p>{/if}
      <details>
        <summary>Accuracy by key</summary>
        <ul class="accuracy">
          {#each stats.keys as key (key.key)}
            <li><strong>{pretty(key.key)}</strong> · {key.attempts ? `${key.correct ?? 0}/${key.attempts} first try (${Math.round((key.correct ?? 0) / key.attempts * 100)}%)${key.attempts >= 4 && (key.correct ?? 0) / key.attempts >= 0.8 ? ' · Strong' : ''}` : 'Not yet practiced'}</li>
          {/each}
        </ul>
      </details>
    </section>
    <section class="panel" aria-labelledby="quests-title">
      <h2 id="quests-title">Daily quests</h2>
      <p class="muted">{stats.date}</p>
      <ul class="quests">
        {#each QUESTS as quest (quest.id)}
          <li><strong>{quest.title}</strong>: {quest.description} · {Math.min(stats.daily[quest.id], quest.target)}/{quest.target}</li>
        {/each}
      </ul>
      <button type="button" disabled={stats.daily.claimed || QUESTS.some(quest => stats.daily[quest.id] < quest.target)} onclick={() => game.claimReward()}>
        {stats.daily.claimed ? 'Reward claimed' : 'Claim daily reward (+200 XP)'}
      </button>
    </section>
    <section class="panel" aria-labelledby="badges-title">
      <h2 id="badges-title">Achievements</h2>
      <ul class="badges">
        {#each BADGES as badge (badge.id)}
          <li><strong>{badge.title}</strong> · {stats.earned.has(badge.id) ? 'Earned' : 'Not yet earned'}<br><small>{badge.description}</small></li>
        {/each}
      </ul>
    </section>
    {#if offlineStatus}
      <section class="panel" aria-labelledby="offline-title">
        <h2 id="offline-title">Offline practice</h2>
        <p role="status">{offlineStatus.message}</p>
        {#if offlineStatus.update}
          <button type="button" disabled={view.phase !== 'ready'} onclick={() => offline?.applyUpdate()}>Reload to update</button>
          {#if view.phase !== 'ready'}<p>Return to Ready to play to switch versions.</p>{/if}
        {/if}
      </section>
    {/if}
  </aside>
</div>

<dialog bind:this={teachingDialog} aria-labelledby="teaching-title" oncancel={event => { event.preventDefault(); game.dismissTeaching(); }}>
  {#if view.teaching}
    <div class="eyebrow">{view.teaching.title}</div>
    <h2 id="teaching-title">{currentLesson?.title ?? view.teaching.prompt.title} · {pretty(view.teaching.prompt.key)}</h2>
    <p>{view.teaching.prompt.theory}</p>
    <p class="muted">Play the example or continue to the scored round.</p>
    <button type="button" class="primary" onclick={() => game.dismissTeaching()}>Continue to drill</button>
    {@render workedExample(view.teaching, 'Teaching piano')}
    {@render keyboardRegister()}
  {/if}
</dialog>

<dialog bind:this={advanceDialog} aria-labelledby="advance-title" oncancel={event => { event.preventDefault(); game.answerOffer(false); }}>
  {#if view.offer}
    <div class="eyebrow">NEXT GUIDED LESSON</div>
    <h2 id="advance-title">Try {view.offer.title}?</h2>
    <p>All admitted lessons meet the current mastery gate. You can start the new lesson or keep reviewing.</p>
    <div class="controls">
      <button type="button" class="primary" onclick={() => game.answerOffer(true)}>Start next lesson</button>
      <button type="button" onclick={() => game.answerOffer(false)}>Keep practicing</button>
    </div>
  {/if}
</dialog>
