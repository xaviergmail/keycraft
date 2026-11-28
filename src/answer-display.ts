import { pretty } from './domain.ts';
import type { Prompt } from './domain.ts';

export function answerText(prompt: Prompt): string {
  switch (prompt.kind) {
    case 'note': return pretty(prompt.target.name);
    case 'interval': return `${pretty(prompt.root.name)} → ${pretty(prompt.target.name)} (${prompt.semitones} semitones up)`;
    case 'scale': return `${prompt.tones.map(tone => pretty(tone.name)).join(' → ')} (ascending)`;
    case 'stack': return prompt.stages.map(stage => {
      const tones = stage.tones.map(tone => pretty(tone.name)).join(', ');
      const bass = stage.tones.find(tone => tone.pc === stage.bass);
      return `${stage.label}: ${tones}${bass ? `; ${pretty(bass.name)} lowest` : ''}`;
    }).join(' → ');
  }
}

export function exampleKeys(prompt: Prompt, stageIndex = 0): number[] {
  const root = 60 + prompt.root.pc;
  switch (prompt.kind) {
    case 'note': return [60 + prompt.target.pc];
    case 'interval': return [root, root + prompt.semitones];
    case 'scale': return prompt.steps.map(step => root + step);
    case 'stack': {
      const stage = prompt.stages[stageIndex];
      return stage.tones.map(tone => (tone.pc === stage.bass ? 48 : 60) + tone.pc);
    }
  }
}
