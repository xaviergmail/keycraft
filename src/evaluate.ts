import { midiName, pc, type Prompt, type Stage } from './domain.ts';

/**
 * A result from the answer state machine. `progress` means the current answer
 * is still incomplete, `stage` means one stack stage was accepted, and `clear`
 * means the whole prompt was accepted. A `miss` is recoverable by the caller.
 */
export interface Verdict {
  kind: 'miss' | 'progress' | 'stage' | 'clear';
  message: string;
}

const INTERVAL_GRACE_MS = 100;

/**
 * Per-round answer state. Keep one instance for each scored round, teaching
 * example, and continuation preview; sharing an instance leaks anchors and
 * held notes between those scopes.
 *
 * An upper-first interval has an inclusive grace window: an exact root attack
 * at `pendingUntil` (100 ms after the upper attack) is accepted when it is
 * processed before expiry. `expire(now)` expires only when `now` is greater
 * than `pendingUntil`; callers that run an explicit timer at the boundary
 * should process the timer before a same-time late attack and use the actual
 * timer clock (which is normally slightly greater than the boundary).
 */
export class Answer {
  readonly prompt: Prompt;

  private _stageIndex = 0;
  private _step = 0;
  private _pendingUntil: number | undefined;
  private readonly held = new Set<number>();
  private intervalAnchor: number | undefined;
  private intervalPending: { note: number; until: number } | undefined;
  private wrongBassSignature: string | undefined;
  private completed = false;

  constructor(prompt: Prompt) {
    this.prompt = prompt;
  }

  get stageIndex(): number {
    return this._stageIndex;
  }

  /** Number of accepted notes (scale) or whether an interval anchor exists. */
  get step(): number {
    return this._step;
  }

  get pendingUntil(): number | undefined {
    return this._pendingUntil;
  }

  /**
   * Accept a fresh aggregate attack. The input adapter is responsible for
   * emitting only the first attack from a source aggregate; this class also
   * ignores duplicate absolute notes defensively.
   */
  attack(note: number, now: number): Verdict | undefined {
    if (this.completed || !Number.isInteger(note) || note < 0 || note > 127) return undefined;

    // A caller normally invokes expire before forwarding a late attack. Keep
    // the ordering safe for direct users too, while retaining the inclusive
    // 100 ms boundary.
    if (this.intervalPending && now > this.intervalPending.until) {
      return this.expire(now);
    }

    if (this.held.has(note)) return undefined;
    this.held.add(note);
    const prompt = this.prompt;
    switch (prompt.kind) {
      case 'note':
        return this.attackNote(prompt, note);
      case 'interval':
        return this.attackInterval(prompt, note, now);
      case 'scale':
        return this.attackScale(prompt, note);
      case 'stack':
        return this.attackStack(prompt, note);
    }
  }

  /**
   * Release an absolute note. Stack answers are rechecked on release so an
   * extra can be removed after a recoverable miss without restriking members.
   */
  release(note: number): Verdict | undefined {
    if (!this.held.delete(note)) return undefined;

    const prompt = this.prompt;
    if (prompt.kind === 'stack' && !this.completed) {
      const signature = this.stackSignature();
      if (this.wrongBassSignature !== signature) this.wrongBassSignature = undefined;
      return this.checkStack(prompt);
    }
    return undefined;
  }

  /**
   * Expire an upper-first interval's grace period. The 100 ms boundary is
   * inclusive for an attack; therefore `now === pendingUntil` is not expired.
   */
  expire(now: number): Verdict | undefined {
    if (!this.intervalPending || now <= this.intervalPending.until) return undefined;
    this.intervalPending = undefined;
    this._pendingUntil = undefined;
    return {
      kind: 'miss',
      message: `Start with ${this.prompt.root.name}.`,
    };
  }

  private attackNote(prompt: Extract<Prompt, { kind: 'note' }>, note: number): Verdict {
    if (pc(note) === prompt.target.pc) {
      this.completed = true;
      return { kind: 'clear', message: `Correct: ${prompt.target.name}.` };
    }
    return {
      kind: 'miss',
      message: `${midiName(note)} is not ${prompt.target.name}.`,
    };
  }

  private attackInterval(prompt: Extract<Prompt, { kind: 'interval' }>, note: number, now: number): Verdict | undefined {
    const rootPc = pc(prompt.root.pc);

    if (this.intervalAnchor === undefined) {
      if (pc(note) !== rootPc) return this.beginPendingOrMiss(prompt, note, now);

      if (note + prompt.semitones > 127) {
        return {
          kind: 'miss',
          message: 'Start an octave lower so the interval fits.',
        };
      }

      this.intervalAnchor = note;
      this._step = 1;
      const pending = this.intervalPending;
      if (pending !== undefined) {
        const pendingHeld = this.held.has(pending.note);
        this.intervalPending = undefined;
        this._pendingUntil = undefined;
        if (pendingHeld && pending.note === note + prompt.semitones) {
          this.completed = true;
          return { kind: 'clear', message: 'Correct interval.' };
        }
        if (pendingHeld) {
          return { kind: 'miss', message: `Play exactly ${prompt.semitones} semitones above ${midiName(note)}.` };
        }
      }
      return {
        kind: 'progress',
        message: `Root ${midiName(note)} accepted. Play ${prompt.semitones} semitones above it.`,
      };
    }

    if (note === this.intervalAnchor) return undefined;
    const expected = this.intervalAnchor + prompt.semitones;
    if (note === expected || (prompt.semitones === 12 && note + 12 === this.intervalAnchor && this.held.has(this.intervalAnchor))) {
      this.completed = true;
      return { kind: 'clear', message: 'Correct interval.' };
    }
    return {
      kind: 'miss',
      message: `Play exactly ${prompt.semitones} semitones above ${midiName(this.intervalAnchor)}.`,
    };
  }

  /** Start (or replace) a grace window for an upper-first interval. */
  private beginPendingOrMiss(prompt: Extract<Prompt, { kind: 'interval' }>, note: number, now: number): Verdict {
    if (pc(note) === pc(prompt.target.pc)) {
      const until = now + INTERVAL_GRACE_MS;
      this.intervalPending = { note, until };
      this._pendingUntil = until;
      return {
        kind: 'progress',
        message: `Now find ${prompt.root.name} within ${INTERVAL_GRACE_MS} ms.`,
      };
    }
    return { kind: 'miss', message: `Start with ${prompt.root.name}.` };
  }
  private attackScale(prompt: Extract<Prompt, { kind: 'scale' }>, note: number): Verdict | undefined {
    const expected = prompt.tones[this._step];
    if (expected === undefined) return undefined;

    const finalOffset = prompt.steps[prompt.steps.length - 1] ?? 0;
    const valid = this._step === 0
      ? pc(note) === pc(expected.pc) && note + finalOffset <= 127
      : this.scaleAnchor !== undefined && note === this.scaleAnchor + (prompt.steps[this._step] ?? 0);

    if (!valid) {
      this._step = 0;
      this.scaleAnchor = undefined;
      return {
        kind: 'miss',
        message: note + finalOffset > 127 && pc(note) === pc(expected.pc)
          ? 'Start an octave lower so the scale fits.'
          : `Restart the scale on ${prompt.tones[0]?.name ?? prompt.root.name}.`,
      };
    }

    if (this._step === 0) this.scaleAnchor = note;
    this._step += 1;
    if (this._step >= prompt.tones.length) {
      this.completed = true;
      return { kind: 'clear', message: 'Scale complete.' };
    }
    return {
      kind: 'progress',
      message: `${expected.name} accepted (${this._step}/${prompt.tones.length}).`,
    };
  }

  private scaleAnchor: number | undefined;

  private attackStack(prompt: Extract<Prompt, { kind: 'stack' }>, note: number): Verdict {
    const stage = prompt.stages[this._stageIndex];
    if (!stage.tones.some((tone) => tone.pc === pc(note))) {
      return {
        kind: 'miss',
        message: `${midiName(note)} is not in this voicing. Release it and try again.`,
      };
    }

    return this.checkStack(prompt) ?? {
      kind: 'progress',
      message: `${midiName(note)} accepted; keep building the voicing.`,
    };
  }

  private stackSignature(): string {
    return [...this.held].sort((a, b) => a - b).join(',');
  }

  private checkStack(prompt: Extract<Prompt, { kind: 'stack' }>): Verdict | undefined {
    if (this.held.size === 0) return undefined;
    const stage = prompt.stages[this._stageIndex];
    const expected = new Set(stage.tones.map((tone) => pc(tone.pc)));
    const actual = new Set([...this.held].map((note) => pc(note)));
    const hasMissing = [...expected].some((pitch) => !actual.has(pitch));
    const hasExtra = [...actual].some((pitch) => !expected.has(pitch));
    if (hasMissing || hasExtra) return undefined;

    const requestedBass = stage.bass;
    if (requestedBass !== undefined) {
      const bass = pc(Math.min(...this.held));
      if (bass !== pc(requestedBass)) {
        const signature = this.stackSignature();
        if (signature === this.wrongBassSignature) return undefined;
        this.wrongBassSignature = signature;
        const bassTone = stage.tones.find((tone) => pc(tone.pc) === pc(requestedBass));
        const bassName = bassTone?.name ?? `pitch class ${pc(requestedBass)}`;
        return {
          kind: 'miss',
          message: `Right notes, wrong bass. Make ${bassName} the bass.`,
        };
      }
    }

    this.wrongBassSignature = undefined;
    if (this._stageIndex + 1 < prompt.stages.length) {
      const accepted = stage.label;
      this._stageIndex += 1;
      this._step = 0;
      return { kind: 'stage', message: `${accepted} accepted.` };
    }

    this.completed = true;
    return { kind: 'clear', message: 'Progression complete.' };
  }
}
