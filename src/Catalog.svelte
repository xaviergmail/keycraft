<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { SECTIONS } from './catalog.ts';
  import { KEYS, pretty } from './domain.ts';
  import type { Progress, Scope, Trace } from './domain.ts';
  import type { GameView } from './game.ts';

  let { progress, view, revision, start }: {
    progress: Progress; view: GameView; revision: number; start: (scope: Scope) => void;
  } = $props();
  const expandedSections = new SvelteSet<string>();
  const expandedLessons = new SvelteSet<string>();
  const sections = $derived.by(() => {
    const course = progress.curriculum.courseV3;
    // Progress is persisted as ordinary JS data; the commit counter invalidates this view.
    revision;
    return SECTIONS.map(section => ({
      ...section,
      score: section.lessons.reduce((sum, lesson) => sum + (course.concepts[lesson.id]?.points ?? 0), 0) / section.lessons.length,
      lessons: section.lessons.map(lesson => ({ ...lesson, trace: course.concepts[lesson.id], admitted: course.admitted.includes(lesson.id) })),
    }));
  });

  function accuracy(trace: Trace | undefined) {
    return trace?.attempts ? `${trace.firstTry}/${trace.attempts} first try (${Math.round(trace.firstTry / trace.attempts * 100)}%)` : 'Not yet practiced';
  }
</script>

<nav aria-labelledby="catalog-title">
  <h2 id="catalog-title">Free Play</h2>
  <p class="muted">Choose any lesson or key without advancing the guided path.</p>
  {#each sections as section (section.title)}
    <details class="catalog-section" ontoggle={event => event.currentTarget.open ? expandedSections.add(section.title) : expandedSections.delete(section.title)}>
      <summary>{section.title} <span class="muted">· {section.score.toFixed(1)}%</span></summary>
      {#if expandedSections.has(section.title)}
        <button type="button" class="small" onclick={() => start({ kind: 'rotation', label: section.title, lessonIds: section.lessons.map(lesson => lesson.id), section: true })}>
          Practice section
        </button>
        {#each section.lessons as lesson (lesson.id)}
          <details class="catalog-lesson" data-lesson={lesson.id} ontoggle={event => event.currentTarget.open ? expandedLessons.add(lesson.id) : expandedLessons.delete(lesson.id)}>
            <summary>
              {lesson.title} <span class="muted">· {lesson.trace?.points ?? 0}% ·
                {view.prompt?.lessonId === lesson.id ? view.role === 'review' ? 'Review' : view.role === 'focus' ? 'Focus' : 'Current' : lesson.admitted ? 'Admitted' : 'Upcoming'}
              </span>
            </summary>
            {#if expandedLessons.has(lesson.id)}
              <button type="button" class="small" onclick={() => start({ kind: 'rotation', label: lesson.title, lessonIds: [lesson.id], section: false })}>Practice whole lesson</button>
              <ul class="key-scores">
                {#each KEYS as key}
                  {@const root = lesson.trace?.rootTraces[key]}
                  {@const current = view.prompt?.lessonId === lesson.id && view.prompt?.key === key}
                  <li>
                    <button type="button" class="small" data-spelled-key={key} aria-label={`Practice ${pretty(key)} · ${lesson.title}`}
                      aria-current={current ? 'true' : undefined} onclick={() => start({ kind: 'fixed', lessonId: lesson.id, key })}>
                      <strong>{pretty(key)}</strong> · {root?.points ?? 0}%{current ? ' · Current' : ''}
                      <small>{accuracy(root)}</small>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </details>
        {/each}
      {/if}
    </details>
  {/each}
</nav>

<style>
  h2 { margin: 0; }
  .catalog-section, .catalog-lesson { margin-top: .5rem; }
  .catalog-lesson { margin-left: .6rem; }
  details > button { margin-top: .5rem; }
  .key-scores { list-style: none; margin: .5rem 0; padding: 0; display: grid; gap: .35rem; }
  .key-scores button { text-align: left; width: 100%; }
  .key-scores small { display: block; }
</style>
