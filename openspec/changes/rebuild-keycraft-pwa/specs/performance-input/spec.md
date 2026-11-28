# Spec Delta

## Purpose

Let a learner answer the same musical prompt with a computer keyboard, an interactive piano, or a MIDI instrument without requiring a particular device.

## ADDED Requirements

### Requirement: Request basic MIDI access on startup
On every page or installed-app launch, the app SHALL attempt Web MIDI access once when the API exists in a secure context, with `sysex: false`, even without a prior permission grant. It SHALL not wait for MIDI before showing or enabling practice and SHALL not duplicate an in-flight request.

#### Scenario: Request previously ungranted access
- **GIVEN** HTTPS or localhost and an available Web MIDI API
- **WHEN** the app initializes with no prior permission decision
- **THEN** it asks for access without requiring a Connect MIDI click; the browser controls whether and how permission is shown

#### Scenario: Denied or blocked access is recoverable
- **WHEN** the startup request is rejected, including by a gesture or permissions policy
- **THEN** the app shows MIDI as not connected and allows a user-initiated retry when supported, without blocking mouse or computer-keyboard play
- **AND** an explicit failed retry explains the failure without repeatedly prompting automatically

#### Scenario: API not available
- **WHEN** the context is insecure or the browser does not expose the API
- **THEN** the app explains the supported-browser and HTTPS/localhost requirement and leaves the other inputs usable

### Requirement: Track live MIDI notes and inputs
The app SHALL accept notes 0–127 on all channels from all connected MIDI input ports. It SHALL handle Note On with nonzero velocity, Note Off, and Note On with velocity zero as release. Changes to attached ports SHALL update connection status and release only the disconnected port's notes.

#### Scenario: Attach a device after startup
- **WHEN** permission is granted without an input and a device is then connected
- **THEN** the status changes from no input found to MIDI ready, shows its name, and accepts its note messages without reloading

#### Scenario: Release a disconnected port's notes
- **GIVEN** device A and device B are both holding MIDI note 60
- **WHEN** A disconnects or sends a zero-velocity Note On
- **THEN** note 60 stays held until its last source releases it, and A cannot leave a stuck note
- **AND** unrelated messages, including control changes, do not create played notes

### Requirement: Provide a playable virtual piano
The main virtual piano SHALL expose MIDI 48–83 (C3–B5), with named keys and mouse or keyboard activation. Activating a key toggles its latch, so a learner can hold a chord without a MIDI instrument. The teaching and continuation diagrams SHALL also accept interactive note selection.

#### Scenario: Build a chord with a mouse
- **WHEN** the learner clicks C4, E4, and G4 on a C major chord prompt
- **THEN** the notes latch together and can clear the chord
- **AND** clicking a latched key releases only that virtual key; changing round, surface, or run clears unrelated latches

### Requirement: Map computer keys to playable registers
The app SHALL map `A W S E D F T G Y H U J K` to chromatic C4–C5 by default and offer octave shifts so any lesson's intervals and octave scales can be played without switching input source. A note SHALL keep the pitch assigned at keydown until its keyup. Editing text, using modifier shortcuts, and OS key repeat SHALL not enter notes.

#### Scenario: Play a non-C scale with only computer keys
- **WHEN** the learner starts a D natural minor run in the default register and shifts up an octave to complete the upper part
- **THEN** D4–E4–F4–G4–A4–B♭4–C5–D5 can be entered in order on that input alone; a shift does not synthesize a note or change a held key's release pitch

#### Scenario: Focus or control changes during a hold
- **WHEN** the browser loses focus or a typing control receives the shortcut
- **THEN** computer-keyboard notes are released on focus loss, other input sources retain ownership, and text entry or modified shortcuts are not piano attacks

### Requirement: Isolate note ownership and exercise state
The app SHALL track a hold by input source, MIDI port/channel where applicable, and absolute note. A note is held while any source owns it; repeats and overlapping ownership SHALL not create duplicate attacks. Scored rounds, teaching examples, and continuation previews SHALL use distinct evaluation state.

#### Scenario: A new round does not answer itself
- **WHEN** a note remains physically held from a completed round or dialog into a new scored round
- **THEN** the new round requires a fresh attack for that note; it is not accepted as a new answer or cleared from another source's live indicator
- **AND** a valid common tone between stages of the same multi-stage round can remain held under the guided-drill rules
