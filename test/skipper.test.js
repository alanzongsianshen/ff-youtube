import assert from 'node:assert';
import { createSkipper, clusterVoices, tick, WIN } from '../skipper.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loud = (v) => new Float32Array(WIN).fill(v); // v encodes the "speaker" for the fake embed
const quiet = () => new Float32Array(WIN);

const log = [];
let embeds = 0, fail = false, errors = 0;
const sk = createSkipper({
  embed: async (x) => { if (fail) { fail = false; throw new Error('gpu lost'); } embeds++; return x[0] > 0 ? [1, 0] : [0, 1]; },
  targets: [[1, 0]],
  threshold: 0.85,
  ff: (on) => log.push(on),
  onError: () => errors++,
  burstMs: 30,
});

await sk.push(quiet());
assert.equal(embeds, 0, 'silence must not run the model');

fail = true;
await sk.push(loud(-0.5));
assert.equal(errors, 1, 'embed error is reported');

await sk.push(loud(-0.5));
assert.deepEqual(log, [], 'other speaker must not fast-forward');

await sk.push(loud(0.5));
assert.deepEqual(log, [true], 'target speaker starts a burst');

await sk.push(loud(0.5));
assert.equal(embeds, 2, 'audio during a burst is dropped');

await sleep(50);
assert.deepEqual(log, [true, false], 'burst ends and restores playback');

await sk.push(loud(0.5));
sk.stop();
assert.deepEqual(log, [true, false, true, false], 'stop mid-burst restores playback');

const multi = [];
const sk2 = createSkipper({ embed: async (x) => (x[0] > 0 ? [1, 0] : [0, 1]), targets: [[1, 0], [0, 1]], threshold: 0.85, ff: (on) => multi.push(on), burstMs: 0 });
await sk2.push(loud(-0.5));
assert.deepEqual(multi, [true], 'any of several target voices starts a burst');
sk2.stop();

const noisy = (base) => base.map((x) => x + (Math.random() - 0.5) * 0.4);
const vs = [[1, 0, 0], [0, 1, 0], [1, 0, 0], [1, 0, 0], [0, 1, 0]].map(noisy);
const cs = clusterVoices(vs);
assert.deepEqual(cs.map((c) => c.idx), [[0, 2, 3], [1, 4]], 'two voices, biggest first');

const vs3 = [{ id: 1, skip: true }, { id: 2, skip: false }];
const ticked = (v) => v.filter((x) => x.skip).map((x) => x.id);
assert.deepEqual(ticked(tick(vs3, 2, true, false)), [2], 'single mode: ticking one unticks the rest');
assert.deepEqual(ticked(tick(vs3, 2, true, true)), [1, 2], 'multi mode keeps other ticks');
assert.deepEqual(ticked(tick(vs3, 1, false, true)), [], 'untick');

console.log('skipper test ok');
