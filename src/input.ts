export interface MidiStatus {
  text: string;
  canConnect: boolean;
  connecting: boolean;
  connected: boolean;
}

interface MidiMessageEventLike {
  data?: ArrayLike<number>;
}

interface MidiInputLike {
  id?: string;
  name?: string;
  type?: string;
  state?: string;
  onmidimessage?: ((event: MidiMessageEventLike) => void) | null;
  addEventListener?: (type: string, listener: (event?: unknown) => void) => void;
  removeEventListener?: (type: string, listener: (event?: unknown) => void) => void;
}

interface MidiInputsLike {
  values?: () => Iterable<MidiInputLike>;
  forEach?: (callback: (value: MidiInputLike) => void) => void;
  [Symbol.iterator]?: () => Iterator<MidiInputLike>;
}

interface MidiAccessLike {
  inputs?: MidiInputsLike;
  addEventListener?: (type: string, listener: (event?: unknown) => void) => void;
  removeEventListener?: (type: string, listener: (event?: unknown) => void) => void;
  onstatechange?: ((event?: unknown) => void) | null;
}

interface RequestMidiOwner {
  requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MidiAccessLike>;
}

interface EventTargetLike {
  addEventListener?: (type: string, listener: (event?: unknown) => void) => void;
  removeEventListener?: (type: string, listener: (event?: unknown) => void) => void;
}

export interface InputDependencies {
  [name: string]: unknown;
  requestMIDIAccess?: RequestMidiOwner['requestMIDIAccess'];
  midi?: RequestMidiOwner;
  navigator?: RequestMidiOwner;
  window?: EventTargetLike;
  document?: EventTargetLike;
  secureContext?: boolean;
  baseNote?: number;
}

export interface InputController {
  start(): void;
  dispose(): void;
  connectMidi(): void;
  toggleVirtual(note: number): void;
  releaseVirtual(): void;
  shift(delta: -1 | 1): void;
  readonly held: ReadonlySet<number>;
  readonly virtualHeld: ReadonlySet<number>;
  readonly baseNote: number;
}

interface KeyboardEventLike {
  key?: string;
  code?: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: unknown;
  preventDefault?: () => void;
}

interface StateChangeEventLike {
  port?: MidiInputLike;
}

interface PortState {
  port: MidiInputLike;
  handler: (event?: unknown) => void;
  sourcePrefix: string;
}

const KEY_OFFSETS: Readonly<Record<string, number>> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
};

function mergeDependencies(dependencies: readonly InputDependencies[]): InputDependencies {
  const merged: InputDependencies = {};
  for (const dependency of dependencies) {
    if (dependency && typeof dependency === 'object') Object.assign(merged, dependency);
  }
  return merged;
}

function globalRequest(): { owner: RequestMidiOwner; request: NonNullable<RequestMidiOwner['requestMIDIAccess']> } | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  const candidate = (globalThis as { navigator?: RequestMidiOwner }).navigator;
  if (!candidate?.requestMIDIAccess) return undefined;
  return { owner: candidate, request: candidate.requestMIDIAccess };
}

function globalEventTarget(name: 'window' | 'document'): EventTargetLike | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  const value = (globalThis as Record<string, unknown>)[name];
  return value && typeof value === 'object' ? value as EventTargetLike : undefined;
}

function isSecureBrowserContext(): boolean {
  if (typeof globalThis === 'undefined') return false;
  const globalValue = globalThis as { isSecureContext?: boolean; location?: { hostname?: string } };
  if (globalValue.isSecureContext === true) return true;
  if (globalValue.isSecureContext === false) {
    const hostname = globalValue.location?.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  }
  return true;
}

function eventTargetName(target: unknown): string | undefined {
  if (!target || typeof target !== 'object') return undefined;
  const value = target as { tagName?: unknown; nodeName?: unknown };
  const name = value.tagName ?? value.nodeName;
  return typeof name === 'string' ? name.toLowerCase() : undefined;
}

function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const value = target as { isContentEditable?: boolean; contentEditable?: string; getAttribute?: (name: string) => string | null };
  if (value.isContentEditable || value.contentEditable === 'true') return true;
  const tag = eventTargetName(target);
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option') return true;
  return value.getAttribute?.('contenteditable') === 'true';
}

function inputPorts(access: MidiAccessLike): MidiInputLike[] {
  const inputs = access.inputs;
  if (!inputs) return [];
  if (typeof inputs.values === 'function') return [...inputs.values()];
  if (typeof inputs.forEach === 'function') {
    const ports: MidiInputLike[] = [];
    inputs.forEach((port) => ports.push(port));
    return ports;
  }
  if (typeof inputs[Symbol.iterator] === 'function') return [...(inputs as Iterable<MidiInputLike>)];
  return [];
}

function noteData(event: unknown): { command: number; channel: number; note: number; velocity: number } | undefined {
  if (!event || typeof event !== 'object') return undefined;
  const data = (event as MidiMessageEventLike).data;
  if (!data || data.length < 2) return undefined;
  const status = Number(data[0]);
  const note = Number(data[1]);
  const velocity = Number(data[2] ?? 0);
  if (!Number.isInteger(status) || !Number.isInteger(note) || note < 0 || note > 127) return undefined;
  return { command: status & 0xf0, channel: status & 0x0f, note, velocity };
}

function addListener(target: EventTargetLike | undefined, type: string, listener: (event?: unknown) => void): () => void {
  target?.addEventListener?.(type, listener);
  return () => target?.removeEventListener?.(type, listener);
}

/**
 * Normalize MIDI, computer-key, and virtual-piano ownership into aggregate
 * attacks/releases. MIDI ownership is keyed by port and channel; a note leaves
 * `held` only after its final source releases it.
 */
export function createInput(
  onNote: (event: { kind: 'attack' | 'release'; note: number }) => void,
  onStatus: (status: MidiStatus) => void,
  onChange: () => void,
  ...injected: readonly InputDependencies[]
): InputController {
  const dependencies = mergeDependencies(injected);
  const explicitRequest = dependencies.requestMIDIAccess ?? dependencies.midi?.requestMIDIAccess ?? dependencies.navigator?.requestMIDIAccess;
  const browserRequest = globalRequest();
  const request = explicitRequest ?? browserRequest?.request;
  const secure = dependencies.secureContext ?? (explicitRequest ? true : isSecureBrowserContext());
  const midiAvailable = Boolean(request) && secure;
  const windowTarget = dependencies.window ?? globalEventTarget('window');
  const documentTarget = dependencies.document ?? globalEventTarget('document');
  const keyboardTarget = windowTarget ?? documentTarget;

  const aggregateHeld = new Set<number>();
  const virtualHeld = new Set<number>();
  const sourceNotes = new Map<string, Set<number>>();
  const owners = new Map<number, Set<string>>();
  const keyboardNotes = new Map<string, { note: number; source: string }>();
  const ports = new Map<MidiInputLike, PortState>();
  const portIds = new Map<MidiInputLike, number>();
  let nextPortId = 1;
  let midiAccess: MidiAccessLike | undefined;
  let removeMidiStateListener: (() => void) | undefined;
  let removeKeyboardListeners: (() => void) | undefined;
  let removeFocusListeners: (() => void) | undefined;
  let started = false;
  let disposed = false;
  let connecting = false;
  let releasingVirtual = false;
  let baseNote = Number.isInteger(dependencies.baseNote) ? Math.max(0, Math.min(115, dependencies.baseNote as number)) : 60;
  let lastFailure = false;
  let failureMessage = '';

  const status = (text: string): MidiStatus => ({
    text,
    canConnect: midiAvailable && !connecting,
    connecting,
    connected: ports.size > 0,
  });

  const emitStatus = (text?: string): void => {
    let message = text;
    if (message === undefined) {
      if (!midiAvailable) message = 'Web MIDI requires HTTPS or localhost.';
      else if (connecting) message = 'Connecting MIDI…';
      else if (ports.size > 0) {
        const names = [...ports.values()].map((entry) => entry.port.name || 'MIDI input');
        message = names.length === 1 ? `${names[0]} ready` : `${names.length} MIDI inputs ready`;
      } else if (lastFailure) message = failureMessage || 'MIDI not connected — Connect MIDI to retry.';
      else message = 'No MIDI input found';
    }
    onStatus(status(message ?? 'MIDI unavailable.'));
  };

  const emitAttackOrRelease = (kind: 'attack' | 'release', note: number): void => {
    onNote({ kind, note });
    onChange();
  };

  const ownNote = (source: string, note: number): void => {
    if (disposed || !Number.isInteger(note) || note < 0 || note > 127) return;
    let notes = sourceNotes.get(source);
    if (!notes) {
      notes = new Set<number>();
      sourceNotes.set(source, notes);
    }
    if (notes.has(note)) return;
    notes.add(note);
    let noteOwners = owners.get(note);
    if (!noteOwners) {
      noteOwners = new Set<string>();
      owners.set(note, noteOwners);
    }
    const wasHeld = noteOwners.size > 0;
    noteOwners.add(source);
    if (!wasHeld) {
      aggregateHeld.add(note);
      emitAttackOrRelease('attack', note);
    }
    else onChange();
  };

  const releaseNote = (source: string, note: number): void => {
    const notes = sourceNotes.get(source);
    if (!notes?.delete(note)) return;
    if (notes.size === 0) sourceNotes.delete(source);
    const noteOwners = owners.get(note);
    if (!noteOwners) return;
    noteOwners.delete(source);
    if (noteOwners.size === 0) {
      owners.delete(note);
      aggregateHeld.delete(note);
      emitAttackOrRelease('release', note);
    }
    else onChange();
  };

  const releaseSource = (source: string): void => {
    const notes = sourceNotes.get(source);
    if (!notes) return;
    for (const note of [...notes]) releaseNote(source, note);
  };

  const portSourcePrefix = (port: MidiInputLike): string => {
    let id = portIds.get(port);
    if (id === undefined) {
      id = nextPortId;
      nextPortId += 1;
      portIds.set(port, id);
    }
    return `midi:${id}`;
  };

  const disconnectPortNotes = (prefix: string): void => {
    for (const source of [...sourceNotes.keys()]) {
      if (source.startsWith(`${prefix}:`)) releaseSource(source);
    }
  };

  const refreshStatus = (): void => {
    lastFailure = false;
    emitStatus();
  };

  const attachPort = (port: MidiInputLike): void => {
    if (disposed || (port.type !== undefined && port.type !== 'input') || ports.has(port)) return;
    const sourcePrefix = portSourcePrefix(port);
    const handler = (event?: unknown): void => {
      const data = noteData(event);
      if (!data) return;
      const source = `${sourcePrefix}:${data.channel}`;
      if (data.command === 0x90 && data.velocity > 0) ownNote(source, data.note);
      else if (data.command === 0x80 || (data.command === 0x90 && data.velocity === 0)) releaseNote(source, data.note);
    };
    port.onmidimessage = handler;
    ports.set(port, { port, handler, sourcePrefix });
  };

  const detachPort = (port: MidiInputLike): void => {
    const state = ports.get(port);
    if (!state) return;
    disconnectPortNotes(state.sourcePrefix);
    if (port.onmidimessage === state.handler) port.onmidimessage = null;
    ports.delete(port);
  };

  const syncPorts = (): void => {
    if (!midiAccess) return;
    const active = new Set(inputPorts(midiAccess));
    for (const port of [...ports.keys()]) {
      if (!active.has(port) || port.state === 'disconnected') detachPort(port);
    }
    for (const port of active) {
      if (port.state !== 'disconnected') attachPort(port);
    }
    refreshStatus();
  };

  const onStateChange = (event?: unknown): void => {
    const port = (event as StateChangeEventLike | undefined)?.port;
    if (port && (port.type === undefined || port.type === 'input')) {
      if (port.state === 'disconnected') detachPort(port);
      else attachPort(port);
      refreshStatus();
      return;
    }
    syncPorts();
  };

  const requestAccess = (manual = false): void => {
    if (disposed || !midiAvailable || connecting || !request) return;
    connecting = true;
    lastFailure = false;
    failureMessage = '';
    emitStatus('Connecting MIDI…');
    let pending: Promise<MidiAccessLike>;
    try {
      const owner = explicitRequest ? dependencies.requestMIDIAccess ? dependencies : dependencies.midi ?? dependencies.navigator : browserRequest?.owner;
      const requestOwner = owner ?? undefined;
      const result = request.call(requestOwner, { sysex: false });
      pending = Promise.resolve(result);
    } catch {
      connecting = false;
      lastFailure = true;
      failureMessage = manual ? 'MIDI access unavailable — permission denied or blocked. Connect MIDI to retry.' : 'MIDI not connected — Connect MIDI to retry.';
      emitStatus();
      return;
    }
    pending.then((access) => {
      if (disposed) return;
      midiAccess = access;
      connecting = false;
      removeMidiStateListener?.();
      const listener = (event?: unknown): void => onStateChange(event);
      if (access.addEventListener) {
        access.addEventListener('statechange', listener);
        removeMidiStateListener = () => access.removeEventListener?.('statechange', listener);
      } else {
        access.onstatechange = listener;
        removeMidiStateListener = () => {
          if (access.onstatechange === listener) access.onstatechange = null;
        };
      }
      syncPorts();
    }).catch(() => {
      if (disposed) return;
      connecting = false;
      lastFailure = true;
      failureMessage = manual ? 'MIDI access unavailable — permission denied or blocked. Connect MIDI to retry.' : 'MIDI not connected — Connect MIDI to retry.';
      emitStatus();
    });
  };

  const onKeyDown = (event?: unknown): void => {
    const keyboard = event as KeyboardEventLike | undefined;
    if (!keyboard || isTypingTarget(keyboard.target) || keyboard.repeat || keyboard.ctrlKey || keyboard.altKey || keyboard.metaKey || keyboard.shiftKey) return;
    const key = (keyboard.key ?? (keyboard.code?.startsWith('Key') ? keyboard.code.slice(3) : '')).toLowerCase();
    const offset = KEY_OFFSETS[key];
    if (offset === undefined || keyboardNotes.has(key)) return;
    const note = baseNote + offset;
    const source = `keyboard:${key}`;
    keyboardNotes.set(key, { note, source });
    keyboard.preventDefault?.();
    ownNote(source, note);
  };

  const onKeyUp = (event?: unknown): void => {
    const keyboard = event as KeyboardEventLike | undefined;
    if (!keyboard) return;
    const key = (keyboard.key ?? (keyboard.code?.startsWith('Key') ? keyboard.code.slice(3) : '')).toLowerCase();
    const held = keyboardNotes.get(key);
    if (!held) return;
    keyboardNotes.delete(key);
    releaseNote(held.source, held.note);
  };

  const releaseKeyboard = (): void => {
    for (const held of keyboardNotes.values()) releaseNote(held.source, held.note);
    keyboardNotes.clear();
  };

  const start = (): void => {
    if (disposed || started) return;
    started = true;
    const removeKeyDown = addListener(keyboardTarget, 'keydown', onKeyDown);
    const removeKeyUp = addListener(keyboardTarget, 'keyup', onKeyUp);
    removeKeyboardListeners = () => {
      removeKeyDown();
      removeKeyUp();
    };
    const onBlur = (): void => releaseKeyboard();
    const onVisibility = (): void => {
      const hidden = documentTarget && (documentTarget as EventTargetLike & { hidden?: boolean }).hidden;
      if (hidden) releaseKeyboard();
    };
    const removeBlur = addListener(windowTarget ?? documentTarget, 'blur', onBlur);
    const removeVisibility = addListener(documentTarget, 'visibilitychange', onVisibility);
    removeFocusListeners = () => {
      removeBlur();
      removeVisibility();
    };
    emitStatus();
    requestAccess(false);
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    removeKeyboardListeners?.();
    removeFocusListeners?.();
    removeMidiStateListener?.();
    for (const port of [...ports.keys()]) detachPort(port);
    for (const source of [...sourceNotes.keys()]) releaseSource(source);
    virtualHeld.clear();
    keyboardNotes.clear();
  };

  const connectMidi = (): void => {
    if (!started) start();
    else requestAccess(true);
  };

  const toggleVirtual = (note: number): void => {
    if (disposed || !Number.isInteger(note) || note < 0 || note > 127 || releasingVirtual) return;
    const source = `virtual:${note}`;
    if (virtualHeld.has(note)) {
      virtualHeld.delete(note);
      releaseNote(source, note);
      return;
    }
    virtualHeld.add(note);
    ownNote(source, note);
  };

  const releaseVirtual = (): void => {
    if (disposed || releasingVirtual) return;
    releasingVirtual = true;
    const notes = [...virtualHeld];
    virtualHeld.clear();
    for (const note of notes) releaseNote(`virtual:${note}`, note);
    releasingVirtual = false;
  };

  const shift = (delta: -1 | 1): void => {
    if (disposed || (delta !== -1 && delta !== 1)) return;
    const next = Math.max(0, Math.min(115, baseNote + delta * 12));
    if (next === baseNote) return;
    baseNote = next;
    onChange();
  };

  return {
    start,
    dispose,
    connectMidi,
    toggleVirtual,
    releaseVirtual,
    shift,
    get held(): ReadonlySet<number> {
      return aggregateHeld;
    },
    get virtualHeld(): ReadonlySet<number> {
      return virtualHeld;
    },
    get baseNote(): number {
      return baseNote;
    },
  };
}
