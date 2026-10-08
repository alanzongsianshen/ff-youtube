// Smoke check: model loads, embeds, and separates speakers. Downloads ~100MB once.
import assert from 'node:assert';
import { AutoProcessor, AutoModel, cos_sim } from '@huggingface/transformers';

const ID = 'Xenova/wavlm-base-plus-sv';
const processor = await AutoProcessor.from_pretrained(ID);
const model = await AutoModel.from_pretrained(ID, { dtype: 'q8' });
const BASE = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/sv_speaker';
// Node has no AudioContext; parse 16kHz 16-bit mono PCM WAV by hand.
async function readWav(url) {
  const v = new DataView(await (await fetch(url)).arrayBuffer());
  assert.equal(v.getUint32(24, true), 16000);
  assert.equal(v.getUint16(22, true), 1);
  let o = 12;
  while (v.getUint32(o, false) !== 0x64617461) o += 8 + v.getUint32(o + 4, true); // 'data'
  const n = v.getUint32(o + 4, true) / 2, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = v.getInt16(o + 8 + i * 2, true) / 32768;
  return out;
}
const embed = async (url) => (await model(await processor(await readWav(url)))).embeddings.data;

const [a1, a2, b1] = await Promise.all(['-1_1', '-1_2', '-2_1'].map((s) => embed(`${BASE}${s}.wav`)));
assert.equal(a1.length, 512);
const same = cos_sim(a1, a2), diff = cos_sim(a2, b1);
console.log({ same, diff });
assert(same > 0.85 && diff < 0.85, 'default threshold 0.85 fails to separate speakers');
console.log('model check ok');
