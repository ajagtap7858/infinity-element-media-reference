import { mediaGrantForPage } from "./element-media.js";
import { describeEnvironment } from "./media-errors.js";
import { createMediaSession } from "./media-session.js";

const REQUESTS = {
  both: { video: true, audio: true },
  camera: { video: true, audio: false },
  microphone: { video: false, audio: true },
};

const statusNode = document.querySelector("#status");
const failureNode = document.querySelector("#failure");
const browserResultNode = document.querySelector("#browser-result");
const tracksNode = document.querySelector("#tracks");
const previewNode = document.querySelector("#preview");
const meterNode = document.querySelector("#meter");
const meterBarNode = document.querySelector("#meter-bar");
const environmentNode = document.querySelector("#environment");
const startButtons = [...document.querySelectorAll("[data-request]")];
const stopButton = document.querySelector("#stop");

let audioContext = null;
let meterFrame = 0;

const session = createMediaSession({
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  isSecureContext: () => window.isSecureContext === true,
  hasMediaDevices: () => typeof navigator.mediaDevices?.getUserMedia === "function",
});

function setStatus(message) {
  statusNode.textContent = message;
}

function setFailure(failure) {
  failureNode.textContent = failure?.message ?? "";
  browserResultNode.textContent = failure?.browserResult ?? "none";
}

function setBusy(busy) {
  for (const button of startButtons) {
    button.disabled = busy;
  }
  stopButton.disabled = false;
}

function renderTracks(stream) {
  const tracks = stream?.getTracks?.() ?? [];
  if (tracks.length === 0) {
    tracksNode.textContent = "No active tracks.";
    return;
  }
  tracksNode.textContent = tracks
    .map((track) => `${track.kind}: ${track.readyState}`)
    .join(", ");
}

function stopMeter() {
  cancelAnimationFrame(meterFrame);
  meterFrame = 0;
  meterBarNode.style.transform = "scaleX(0)";
  meterNode.hidden = true;
  if (audioContext) {
    const closing = audioContext;
    audioContext = null;
    closing.close().catch(() => {});
  }
}

function startMeter(stream) {
  stopMeter();
  const audioTrack = stream.getAudioTracks?.()[0];
  if (!audioTrack || typeof AudioContext === "undefined") {
    return;
  }
  const context = new AudioContext();
  audioContext = context;
  const source = context.createMediaStreamSource(new MediaStream([audioTrack]));
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  meterNode.hidden = false;
  context.resume().catch(() => {});

  const draw = () => {
    if (audioContext !== context) {
      return;
    }
    analyser.getByteTimeDomainData(samples);
    let energy = 0;
    for (const value of samples) {
      const centered = (value - 128) / 128;
      energy += centered * centered;
    }
    const level = Math.min(1, Math.sqrt(energy / samples.length) * 4);
    meterBarNode.style.transform = `scaleX(${level})`;
    meterFrame = requestAnimationFrame(draw);
  };
  meterFrame = requestAnimationFrame(draw);
}

function showPreview(stream) {
  const hasVideo = (stream.getVideoTracks?.() ?? []).length > 0;
  if (!hasVideo) {
    previewNode.srcObject = null;
    previewNode.hidden = true;
    return;
  }
  previewNode.hidden = false;
  previewNode.srcObject = stream;
  previewNode.play().catch(() => {});
}

function resetDisplay() {
  stopMeter();
  previewNode.pause();
  previewNode.srcObject = null;
  previewNode.hidden = true;
  renderTracks(null);
  setBusy(false);
}

function renderEnvironment(grant = mediaGrantForPage(null, location.href)) {
  const environment = describeEnvironment({
    origin: window.origin || location.origin,
    secureContext: window.isSecureContext === true,
    mediaDevicesAvailable: typeof navigator.mediaDevices?.getUserMedia === "function",
    cameraAllowed: grant.camera,
    microphoneAllowed: grant.microphone,
  });
  environmentNode.textContent = [
    `Origin: ${environment.origin}`,
    `Secure context: ${environment.secureContext}`,
    `getUserMedia available: ${environment.mediaDevicesAvailable}`,
    `Element camera: ${environment.cameraAllowed}`,
    `Element microphone: ${environment.microphoneAllowed}`,
  ].join("\n");
}

function requestElementMediaGrant() {
  if (window.parent === window) {
    return Promise.resolve(mediaGrantForPage(null, location.href));
  }

  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    const timer = window.setTimeout(finish, 3000);

    function finish(grant) {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(grant ?? mediaGrantForPage(null, location.href));
    }

    function onMessage(event) {
      if (event.source !== window.parent) {
        return;
      }
      const data = event.data;
      if (!data || data.type !== "api-response" || data.requestId !== requestId || data.success !== true) {
        return;
      }
      const elements = data.data?.infinityElements;
      finish(mediaGrantForPage(elements, location.href));
    }

    window.addEventListener("message", onMessage);
    window.parent.postMessage(
      { type: "api-request", requestId, method: "getUserInfo", params: {} },
      "*",
    );
  });
}

async function start(requestName) {
  setBusy(true);
  setFailure(null);
  setStatus("Requesting media from the browser.");
  const result = await session.start(REQUESTS[requestName]);
  if (result.status === "discarded") {
    return;
  }
  if (result.status === "failed") {
    resetDisplay();
    setFailure(result.failure);
    setStatus("The media request failed. Agent Desktop remains usable.");
    return;
  }
  renderTracks(result.stream);
  showPreview(result.stream);
  startMeter(result.stream);
  setBusy(false);
  setStatus("Media is active. Choose Stop to release every track.");
}

function stop() {
  session.stop();
  resetDisplay();
  setFailure(null);
  setStatus("Stopped. Every track from this session has been released.");
}

for (const button of startButtons) {
  button.addEventListener("click", () => {
    start(button.dataset.request).catch(() => {
      resetDisplay();
      setFailure({
        browserResult: "Error",
        message: "The media request failed. Retry Start or check the browser and device settings.",
      });
      setStatus("The media request failed. Agent Desktop remains usable.");
    });
  });
}

stopButton.addEventListener("click", stop);
window.addEventListener("pagehide", stop);

renderEnvironment();
requestElementMediaGrant().then((grant) => {
  renderEnvironment(grant);
});
renderTracks(null);
setStatus("Idle. Camera and microphone have not been requested.");
setFailure(null);
