// MV3 blocks remote code, so ship transformers.js and the ORT wasm inside the extension.
import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('vendor', { recursive: true });
for (const f of [
  '@huggingface/transformers/dist/transformers.min.js',
  'onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs',
  'onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm',
]) cpSync(`node_modules/${f}`, `vendor/${f.split('/').pop()}`);
