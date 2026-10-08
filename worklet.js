// Forwards mono 16 kHz frames to offscreen.js.
registerProcessor('tap', class extends AudioWorkletProcessor {
  process([input]) {
    if (input[0]) this.port.postMessage(input[0].slice());
    return true;
  }
});
