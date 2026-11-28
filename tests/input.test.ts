import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput, type InputController, type InputDependencies, type MidiStatus } from '../src/input.ts';

class Events {
  readonly listeners = new Map<string, Set<(event?: unknown) => void>>();

  addEventListener(type: string, listener: (event?: unknown) => void): void {
    let values = this.listeners.get(type);
    if (!values) {
      values = new Set();
      this.listeners.set(type, values);
    }
    values.add(listener);
  }

  removeEventListener(type: string, listener: (event?: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

interface FakePort extends Events {
  name: string;
  type: 'input';
  state: 'connected' | 'disconnected';
  onmidimessage: ((event: { data: number[] }) => void) | null;
}

function port(name: string): FakePort {
  const value = new Events() as FakePort;
  value.name = name;
  value.type = 'input';
  value.state = 'connected';
  value.onmidimessage = null;
  return value;
}

function midiFixture(initial: FakePort[] = []): {
  access: Events & { inputs: Map<string, FakePort> };
  request: (options?: { sysex?: boolean }) => Promise<unknown>;
  calls: Array<{ sysex?: boolean }>;
} {
  const access = new Events() as Events & { inputs: Map<string, FakePort> };
  access.inputs = new Map(initial.map((value) => [value.name, value]));
  const calls: Array<{ sysex?: boolean }> = [];
  const request = (options?: { sysex?: boolean }): Promise<unknown> => {
    calls.push(options ?? {});
    return Promise.resolve(access);
  };
  return { access, request, calls };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function deps(request: (options?: { sysex?: boolean }) => Promise<unknown>, window: Events, document: Events): InputDependencies {
  return {
    requestMIDIAccess: request as InputDependencies['requestMIDIAccess'],
    window,
    document,
  };
}

test('startup requests basic MIDI once with sysex disabled', async () => {
  const window = new Events();
  const document = new Events();
  const fixture = midiFixture();
  const statuses: MidiStatus[] = [];
  const input = createInput(() => {}, (value) => statuses.push(value), () => {}, deps(fixture.request, window, document));
  input.start();
  input.start();
  await settle();
  assert.deepEqual(fixture.calls, [{ sysex: false }]);
  assert.equal(statuses.at(-1)?.connected, false);
});

test('denied startup access can be retried explicitly', async () => {
  const window = new Events();
  const document = new Events();
  let attempts = 0;
  const fixture = midiFixture();
  const request = (): Promise<unknown> => {
    attempts += 1;
    return attempts === 1 ? Promise.reject(new Error('denied')) : fixture.request();
  };
  const statuses: MidiStatus[] = [];
  const input = createInput(() => {}, (value) => statuses.push(value), () => {}, deps(request, window, document));
  input.start();
  await settle();
  assert.equal(statuses.at(-1)?.canConnect, true);
  input.connectMidi();
  await settle();
  assert.equal(attempts, 2);
  assert.equal(statuses.at(-1)?.connecting, false);
});

test('MIDI ownership is aggregate across channels and disconnect clears one port only', async () => {
  const window = new Events();
  const document = new Events();
  const first = port('first');
  const second = port('second');
  const fixture = midiFixture([first, second]);
  const events: Array<{ kind: 'attack' | 'release'; note: number }> = [];
  const input = createInput((event) => events.push(event), () => {}, () => {}, deps(fixture.request, window, document));
  input.start();
  await settle();

  first.onmidimessage?.({ data: [0x90, 60, 100] });
  second.onmidimessage?.({ data: [0x91, 60, 100] });
  first.state = 'disconnected';
  fixture.access.inputs.delete(first.name);
  fixture.access.emit('statechange', { port: first });
  assert.deepEqual(events, [{ kind: 'attack', note: 60 }]);
  assert.equal(input.held.has(60), true);
  second.onmidimessage?.({ data: [0x81, 60, 0] });
  assert.deepEqual(events, [{ kind: 'attack', note: 60 }, { kind: 'release', note: 60 }]);
});

test('register shift keeps held pitch until keyup and allows playing from an octave button', () => {
  const window = new Events();
  const document = new Events();
  const events: Array<{ kind: 'attack' | 'release'; note: number }> = [];
  const input = createInput((event) => events.push(event), () => {}, () => {}, { window, document, secureContext: false });
  input.start();
  window.emit('keydown', { key: 'a', target: { tagName: 'body' }, preventDefault() {} });
  input.shift(1);
  window.emit('keyup', { key: 'a' });
  window.emit('keydown', { key: 'a', target: { tagName: 'button' }, preventDefault() {} });
  window.emit('keydown', { key: 's', ctrlKey: true, target: { tagName: 'body' } });
  window.emit('keydown', { key: 'd', target: { tagName: 'input' } });
  window.emit('blur');
  assert.deepEqual(events, [
    { kind: 'attack', note: 60 },
    { kind: 'release', note: 60 },
    { kind: 'attack', note: 72 },
    { kind: 'release', note: 72 },
  ]);
});

test('virtual release guards callback reentrancy', () => {
  const window = new Events();
  const document = new Events();
  let input: InputController;
  const events: Array<{ kind: 'attack' | 'release'; note: number }> = [];
  input = createInput((event) => {
    events.push(event);
    if (event.kind === 'release') input.releaseVirtual();
  }, () => {}, () => {}, { window, document, secureContext: false });
  input.start();
  input.toggleVirtual(60);
  input.toggleVirtual(64);
  input.releaseVirtual();
  assert.deepEqual(events, [
    { kind: 'attack', note: 60 },
    { kind: 'attack', note: 64 },
    { kind: 'release', note: 60 },
    { kind: 'release', note: 64 },
  ]);
  assert.equal(input.virtualHeld.size, 0);
});
