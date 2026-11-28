<script lang="ts">
  import { midiName, pc } from './domain.ts';

  interface Props {
    label: string;
    keys: { held: ReadonlySet<number>; latched: ReadonlySet<number> };
    targets?: readonly number[];
    play: (note: number) => void;
  }
  let { label, keys, targets = [], play }: Props = $props();

  const blackPitches = new Set([1, 3, 6, 8, 10]);
  let whiteIndex = 0;
  const layout = Array.from({ length: 36 }, (_, i) => {
    const note = i + 48;
    const black = blackPitches.has(pc(note));
    const index = black ? whiteIndex - 0.31 : whiteIndex++;
    return { note, name: midiName(note), black, index };
  });
</script>

<div class="piano-scroll">
  <div class="piano" role="group" aria-label={label}>
    {#each layout as key (key.note)}
      <button
        type="button"
        data-note={key.note}
        class:black={key.black}
        class:held={keys.held.has(key.note)}
        class:target={targets.includes(key.note)}
        style:left={`${key.index * 100 / 21}%`}
        aria-label={key.name}
        aria-pressed={keys.latched.has(key.note)}
        onclick={() => play(key.note)}
      ><span>{key.name}</span></button>
    {/each}
  </div>
</div>

<style>
  .piano-scroll { overflow-x: auto; padding: 5px 3px; }
  .piano { position: relative; min-width: 39rem; height: 8.5rem; }
  button {
    position: absolute; top: 0; bottom: 0; width: calc(100% / 21); min-width: 0;
    padding: 0 .1rem .45rem; border: 1px solid #939d90; border-radius: 0 0 .25rem .25rem;
    display: flex; flex-direction: column; justify-content: end; align-items: center;
    background: #faf8ea; color: #24322d; font-size: .68rem; font-weight: 700;
  }
  .black {
    z-index: 1; bottom: 38%; width: calc(62% / 21); background: #24322d; color: #f4f1e3;
    border-color: #101b17; padding-bottom: .32rem; font-size: .61rem;
  }
  button:focus-visible { z-index: 2; }
  .target { box-shadow: inset 0 -5px var(--accent); }
  .held, .black.held { color: #122119; background: var(--accent); border-color: #355a45; }
</style>
