import assert from "node:assert/strict";
import test from "node:test";
import { classifyMediaFailure, describeEnvironment, readPermission } from "./media-errors.js";
import { createMediaSession } from "./media-session.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeStream(label) {
  const stopped = [];
  return {
    label,
    stopped,
    getTracks() {
      return [
        {
          kind: "video",
          readyState: "live",
          stop() {
            stopped.push("video");
          },
        },
        {
          kind: "audio",
          readyState: "live",
          stop() {
            stopped.push("audio");
          },
        },
      ];
    },
  };
}

test("creating a session does not request media", () => {
  let calls = 0;
  createMediaSession({
    getUserMedia: () => {
      calls += 1;
      return Promise.resolve(fakeStream("unused"));
    },
    isSecureContext: () => true,
    hasMediaDevices: () => true,
  });
  assert.equal(calls, 0);
});

test("start requests media and stop releases every track", async () => {
  const stream = fakeStream("session");
  const session = createMediaSession({
    getUserMedia: async () => stream,
    isSecureContext: () => true,
    hasMediaDevices: () => true,
  });

  const result = await session.start({ video: true, audio: true });
  assert.equal(result.status, "live");
  assert.equal(session.hasActiveStream(), true);

  session.stop();
  assert.deepEqual(stream.stopped, ["video", "audio"]);
  assert.equal(session.hasActiveStream(), false);
});

test("a replaced or stopped request releases the late stream", async () => {
  const first = deferred();
  const late = fakeStream("late");
  const session = createMediaSession({
    getUserMedia: () => first.promise,
    isSecureContext: () => true,
    hasMediaDevices: () => true,
  });

  const pending = session.start({ video: true, audio: true });
  session.stop();
  first.resolve(late);
  const result = await pending;

  assert.equal(result.status, "discarded");
  assert.deepEqual(late.stopped, ["video", "audio"]);
  assert.equal(session.hasActiveStream(), false);
});

test("insecure context fails without calling getUserMedia", async () => {
  let calls = 0;
  const session = createMediaSession({
    getUserMedia: () => {
      calls += 1;
      return Promise.resolve(fakeStream("unused"));
    },
    isSecureContext: () => false,
    hasMediaDevices: () => true,
  });

  const result = await session.start({ video: true, audio: true });
  assert.equal(calls, 0);
  assert.equal(result.status, "failed");
  assert.equal(
    result.failure.message,
    "Media access requires a supported secure browser context.",
  );
});

test("browser failures keep the approved Element messages", () => {
  const cases = [
    ["NotAllowedError", "Camera or microphone access is not permitted. Check the Element, browser, and operating-system settings."],
    ["NotFoundError", "No camera or microphone was found."],
    ["NotReadableError", "The camera or microphone is unavailable or being used by another application."],
    ["OverconstrainedError", "No available device supports the requested configuration."],
  ];

  for (const [name, message] of cases) {
    const failure = classifyMediaFailure({
      error: { name },
      mediaDevicesAvailable: true,
      secureContext: true,
    });
    assert.equal(failure.browserResult, name);
    assert.equal(failure.message, message);
  }
});

test("opaque origins are labeled without exposing a URL", () => {
  const environment = describeEnvironment({
    origin: "null",
    secureContext: true,
    mediaDevicesAvailable: true,
    cameraAllowed: "blocked",
    microphoneAllowed: "blocked",
  });
  assert.equal(environment.origin, "opaque (null)");
});

test("permission policy reads are defensive", () => {
  assert.equal(readPermission(null, "camera"), "unavailable");
  assert.equal(
    readPermission({ allowsFeature: () => true }, "camera"),
    "allowed",
  );
  assert.equal(
    readPermission({
      allowsFeature() {
        throw new Error("unsupported");
      },
    }, "microphone"),
    "unavailable",
  );
});
