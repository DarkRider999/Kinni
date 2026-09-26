// On-device photo description. Runs in a Web Worker so the page stays responsive.
// The model (Florence-2 base, ~215 MB) downloads once from Hugging Face and is then
// cached by the browser; photos never leave the device.
//
// Messages in:  { type: 'describe', id, image: Blob }
// Messages out: { type: 'progress', loaded, total }            (model download)
//               { type: 'status', status: 'loading' | 'ready' }
//               { type: 'result', id, caption }
//               { type: 'error', id, message }

import {
  AutoProcessor,
  Florence2ForConditionalGeneration,
  RawImage,
  env,
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js';

const MODEL_ID = 'onnx-community/Florence-2-base-ft';
// 4-bit weights with 8-bit embeddings: ~215 MB, same caption quality as all-8-bit in testing.
const DTYPE = { embed_tokens: 'q8', vision_encoder: 'q4', encoder_model: 'q4', decoder_model_merged: 'q4' };
const TASK = '<MORE_DETAILED_CAPTION>';

env.allowLocalModels = false;

const files = new Map(); // file -> { loaded, total }
function onProgress(p) {
  if (p.status !== 'progress' || !p.total) return;
  files.set(p.file, { loaded: p.loaded, total: p.total });
  let loaded = 0;
  let total = 0;
  for (const f of files.values()) {
    loaded += f.loaded;
    total += f.total;
  }
  self.postMessage({ type: 'progress', loaded, total });
}

async function loadOn(device) {
  const model = await Florence2ForConditionalGeneration.from_pretrained(MODEL_ID, {
    dtype: DTYPE,
    device,
    progress_callback: onProgress,
  });
  const processor = await AutoProcessor.from_pretrained(MODEL_ID);
  return { model, processor };
}

let loading = null;
function load() {
  if (!loading) {
    self.postMessage({ type: 'status', status: 'loading' });
    // Prefer the GPU when the browser offers WebGPU; fall back to WebAssembly (CPU).
    loading = (self.navigator && 'gpu' in self.navigator ? loadOn('webgpu').catch(() => loadOn('wasm')) : loadOn('wasm'))
      .then((m) => {
        self.postMessage({ type: 'status', status: 'ready' });
        return m;
      })
      .catch((err) => {
        loading = null; // allow a retry
        throw err;
      });
  }
  return loading;
}

self.onmessage = async (event) => {
  const { type, id, image } = event.data || {};
  if (type !== 'describe') return;
  try {
    const { model, processor } = await load();
    const raw = await RawImage.fromBlob(image);
    const inputs = await processor(raw, processor.construct_prompts(TASK));
    const ids = await model.generate({ ...inputs, max_new_tokens: 256 });
    const text = processor.batch_decode(ids, { skip_special_tokens: false })[0];
    const caption = processor.post_process_generation(text, TASK, raw.size)[TASK];
    self.postMessage({ type: 'result', id, caption: String(caption || '').trim() });
  } catch (err) {
    self.postMessage({ type: 'error', id, message: (err && err.message) || String(err) });
  }
};
