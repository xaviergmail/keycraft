<script lang="ts">
  import type { HistoryRow } from './domain.ts';
  import { chartSeries } from './results.ts';

  let { history }: { history: readonly HistoryRow[] } = $props();
  const series = $derived(chartSeries(history));
  const numbers = $derived(history.filter(row => row.curriculumScores).map(row => row.number));
  const colors = ['#a9e3b5', '#ffd39f', '#9ed8ed', '#e8b5ef', '#dbe88d', '#ffb5aa', '#b2bcff', '#88ebe5'];
  const marks = [0, 25, 50, 75, 100];
  const y = (value: number) => 170 - value * 1.5;

  function x(number: number) {
    return numbers.length <= 1 ? 326 : 50 + 552 * numbers.indexOf(number) / (numbers.length - 1);
  }
</script>

<figure class="history">
  <figcaption><strong>Curriculum scores</strong> · Last ten exercises</figcaption>
  {#if series.length && numbers.length}
    <svg viewBox="0 0 630 200" role="img" aria-label="Curriculum score history for groups tested in this exercise. Values follow the chart.">
      {#each marks as mark}
        <line x1="47" x2="605" y1={y(mark)} y2={y(mark)} class="grid" />
        <text x="4" y={y(mark) + 4}>{mark}%</text>
      {/each}
      {#each numbers as number}
        <text x={x(number)} y="189" text-anchor="middle">{number}</text>
      {/each}
      {#each series as item, index (item.label)}
        <g stroke={colors[index % colors.length]} fill={colors[index % colors.length]}>
          <polyline points={item.points.map(point => `${x(point.number)},${y(point.value)}`).join(' ')}
            fill="none" stroke-width="2" stroke-dasharray={index >= colors.length ? '6 4' : undefined} />
          {#each item.points as point (point.number)}
            <circle cx={x(point.number)} cy={y(point.value)} r="3.5" />
          {/each}
        </g>
      {/each}
    </svg>
    <ul class="legend" aria-label="Tested curriculum groups">
      {#each series as item, index (item.label)}
        <li><span style:color={colors[index % colors.length]} aria-hidden="true">{index >= colors.length ? '┄' : '━'}</span> {item.label}</li>
      {/each}
    </ul>
    <details>
      <summary>View chart values</summary>
      <div class="table-scroll">
        <table>
          <thead><tr><th scope="col">Exercise</th>{#each series as item (item.label)}<th scope="col">{item.label}</th>{/each}</tr></thead>
          <tbody>
            {#each numbers as number (number)}
              <tr><th scope="row">{number}</th>{#each series as item (item.label)}<td>{item.points.find(point => point.number === number)?.value.toFixed(1) ?? '—'}%</td>{/each}</tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  {:else}
    <p>No curriculum group was tested in this exercise.</p>
  {/if}
</figure>

<style>
  figure { margin: 1.2rem 0; }
  svg { width: 100%; display: block; }
  text { fill: var(--muted); font-size: 12px; }
  .grid { stroke: var(--border); }
  .legend { display: flex; flex-wrap: wrap; gap: .4rem 1rem; padding: 0; list-style: none; }
  .table-scroll { overflow-x: auto; }
  td, th { padding: .25rem .5rem; text-align: left; white-space: nowrap; }
</style>
