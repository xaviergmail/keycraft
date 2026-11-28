'use strict';

const lesson = (id, label, mode, hint, settings = {}) => ({ id, label, mode, hint, ...settings });
const intervalLesson = (id, label, distance, hint) =>
  lesson(id, label, 'intervals', hint, { intervals: [distance] });
const chordLesson = (id, label, chordType, hint) =>
  lesson(id, label, 'chords', hint, { chordType });
const scaleLesson = (id, label, scale, starterKey, hint) =>
  lesson(id, label, 'scales', hint, { scales: [scale], starterKey, level: 'jazz' });

const CURRICULUM = [
  { title: 'Find your way around the keyboard', skills: [
    lesson('notes', 'Find a note by name', 'notes', 'Look for groups of two and three black keys. The white key just left of each pair is C. Follow the white keys in letter order, starting again at A after G. A sharp moves one key right and a flat moves one key left, including black keys.')
  ] },
  { title: 'Intervals', skills: [
    intervalLesson('m2', 'Minor second', 1, 'A minor second is one half step. Start on the root and move to the very next key on the right, whether it is black or white.'),
    intervalLesson('M2', 'Major second', 2, 'A major second is a whole step. Count two half steps to the right from the root, passing over exactly one key.'),
    intervalLesson('m3', 'Minor third', 3, 'A minor third spans three half steps. From the root, move up a whole step and then a half step.'),
    intervalLesson('M3', 'Major third', 4, 'A major third is two whole steps above the root. It is one half step wider than a minor third.'),
    intervalLesson('P4', 'Perfect fourth', 5, 'A perfect fourth is one half step wider than a major third. Find the major third, then move its upper note up one key.'),
    intervalLesson('P5', 'Perfect fifth', 7, 'A perfect fifth is one whole step wider than a perfect fourth. Listen to the open sound when you hold both notes together.')
  ] },
  { title: 'Chords - Triads', skills: [
    chordLesson('major-triad', 'Major triad', 'major', 'Build a major third and a perfect fifth above the root. From bottom to top the gaps are four half steps, then three. Play all three notes together.'),
    chordLesson('minor-triad', 'Minor triad', 'minor', 'Keep the root and fifth of a major triad. Lower its middle note by one half step. The gaps are now three half steps, then four.')
  ] },
  { title: 'Scales', skills: [
    scaleLesson('major', 'Major scale', 'major', 'C', 'Start on the root. Move whole, whole, half, whole, whole, whole, half. A whole step skips one key. A half step lands on the adjacent key.'),
    scaleLesson('natural-minor', 'Natural minor scale', 'minor', 'A', 'From the root move whole, half, whole, whole, half, whole, whole. Compare the third, sixth, and seventh with the major scale from the same root. Each is a half step lower.'),
    scaleLesson('harmonic-minor', 'Harmonic minor scale', 'harmonic', 'A', 'Start with natural minor and raise only the seventh degree by a half step. Listen for the three half steps from the sixth to the seventh, then the small step home.'),
    scaleLesson('melodic-minor', 'Ascending melodic minor', 'melodic', 'A', 'Raise the sixth and seventh degrees of natural minor by a half step. Another route is to play a major scale with a lowered third. Jazz melodic minor keeps this shape in either direction.')
  ] },
  { title: 'Suspended chords and inversions', skills: [
    chordLesson('diminished', 'Diminished triad', 'diminished', 'Stack two minor thirds. From a minor triad, keep the root and third in place and lower the fifth by a half step.'),
    chordLesson('sus2', 'Suspended second', 'sus2', 'Keep the root and perfect fifth. Replace the third with a major second, one whole step above the root.'),
    chordLesson('sus4', 'Suspended fourth', 'sus4', 'Keep the root and perfect fifth. Replace the third with a perfect fourth. Try hearing how that fourth wants to fall back to the third.'),
    lesson('inversion-1', 'First inversion', 'inversions', 'Start from a root position triad. Move its root up an octave so the third becomes the lowest note. Listen for the same chord color above a different bass.', { inversion: 1 }),
    lesson('inversion-2', 'Second inversion', 'inversions', 'Move the lowest note of a first inversion triad up an octave. The fifth is now the bass. Keep the same three pitch names.', { inversion: 2 })
  ] },
  { title: 'Extended intervals', skills: [
    intervalLesson('P8', 'Octave', 12, 'An octave takes you from one note to the next higher key of the same name. Use the repeating black key groups to find it.'),
    intervalLesson('A4', 'Tritone', 6, 'Three whole steps make a tritone. It sits halfway through the octave, between a perfect fourth and a perfect fifth.'),
    intervalLesson('m6', 'Minor sixth', 8, 'A minor sixth lies one half step above a perfect fifth. Move the upper note only.'),
    intervalLesson('M6', 'Major sixth', 9, 'A major sixth lies one whole step above a perfect fifth. You can also find the octave and come down a minor third.'),
    intervalLesson('m7-interval', 'Minor seventh', 10, 'Find the octave above the root, then come down one whole step. The span from the original root is a minor seventh.'),
    intervalLesson('M7', 'Major seventh', 11, 'Find the octave and come down one half step. That small remaining distance gives the major seventh its pull toward the octave.')
  ] },
  { title: 'Seventh chords and cadences', skills: [
    chordLesson('major-seventh', 'Major seventh chord', 'maj7', 'Build a major triad and add the note a half step below the octave. Listen for the major seventh against the root.'),
    chordLesson('minor-seventh', 'Minor seventh chord', 'm7', 'Build a minor triad and add the note a whole step below the octave. The minor third and minor seventh establish the color.'),
    chordLesson('dominant-seventh', 'Dominant seventh chord', 'dom7', 'Build a major triad and add a minor seventh. Listen for the tritone between the third and seventh. That tension drives a dominant chord toward resolution.'),
    chordLesson('half-diminished', 'Half-diminished seventh chord', 'halfdim', 'Build a diminished triad and add a minor seventh. You can also start with a minor seventh chord and lower just its fifth.'),
    lesson('cadence', 'Connect a major two–five–one', 'cadence', 'Build chords on the second, fifth, then first degrees of a major scale. Use minor seventh, dominant seventh, then major seventh. Look for nearby inversions that connect the three shapes.'),
    lesson('guides', 'Lead two voices through a cadence', 'guides', 'Play only each chord’s third and seventh. At each change, listen for a common tone. Keep it still and move the other voice the shortest distance.')
  ] },
  { title: 'Phrase over changing harmony', skills: [
    scaleLesson('dorian', 'Dorian over a minor seventh', 'dorian', 'D', 'Take natural minor and raise its sixth degree a half step. Listen for that bright sixth against the minor third. Dorian fits the two chord in a major two–five–one.'),
    scaleLesson('mixolydian', 'Mixolydian over a dominant seventh', 'mixolydian', 'G', 'Play a major scale with a lowered seventh. Listen for the third and flat seventh. They are also the guide tones of the dominant chord.'),
    lesson('targets', 'Land a phrase on a guide tone', 'notes', 'Picture the chord as a stack of thirds. Aim for its third or seventh as requested. Sing a short phrase that you can imagine landing on that tone before you play it.')
  ] },
  { title: 'Voice an advanced jazz cadence', skills: [
    lesson('shells', 'Comp with guide-tone shells', 'voicings', 'Imagine a bass player supplying the root. Supply the third and seventh above it. Both minor seventh and dominant seventh chords have a flat seventh. Their thirds distinguish them.'),
    lesson('rootless', 'Add ninths and thirteenths', 'voicings', 'Begin with the third and seventh. A ninth has the pitch class of the second, and a thirteenth has the pitch class of the sixth. Add the requested colors above the guide tones.', { level: 'intermediate' }),
    lesson('altered', 'Create tension on an altered dominant', 'voicings', 'Keep the dominant third and flat seventh. Add a flat ninth and flat thirteenth. Hear how each altered color could move a half step when the chord resolves.', { level: 'jazz' })
  ] },
  { title: 'Apply harmony to a jazz progression', skills: [
    lesson('minor-cadence', 'Resolve a minor two–five–one', 'cadence', 'Begin on a half diminished two chord. Move to a dominant seventh on five. Resolve to a minor tonic, listening for the leading tone rising a half step.', { progression: [[2, 2, 'halfdim'], [5, 7, 'dom7'], [1, 0, 'minor']] }),
    lesson('turnaround', 'Connect a one–six–two–five turnaround', 'cadence', 'Start on the major seventh tonic. Move to a dominant seventh on six, then a minor seventh on two and a dominant seventh on five. Listen for the roots moving in fifths.', { progression: [[1, 0, 'maj7'], [6, 9, 'dom7'], [2, 2, 'm7'], [5, 7, 'dom7']] }),
    lesson('tritone-sub', 'Resolve a tritone substitute', 'cadence', 'After the minor two chord, slide its root down one half step and build a dominant seventh there. Resolve down another half step to the major tonic. The substitute shares its guide tones with the original dominant.', { progression: [[2, 2, 'm7'], [2, 1, 'dom7'], [1, 0, 'maj7']] })
  ] }
];
