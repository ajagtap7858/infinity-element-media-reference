import { classifyMediaFailure } from "./media-errors.js";

function releaseStream(stream) {
  if (!stream || typeof stream.getTracks !== "function") {
    return;
  }
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

export function createMediaSession({
  getUserMedia,
  isSecureContext,
  hasMediaDevices,
}) {
  let requestSerial = 0;
  let currentStream = null;

  return {
    hasActiveStream() {
      return currentStream !== null;
    },

    stop() {
      requestSerial += 1;
      releaseStream(currentStream);
      currentStream = null;
    },

    async start(constraints) {
      requestSerial += 1;
      const requestId = requestSerial;
      releaseStream(currentStream);
      currentStream = null;

      const secureContext = isSecureContext();
      const mediaDevicesAvailable = hasMediaDevices();
      if (!secureContext || !mediaDevicesAvailable) {
        return {
          status: "failed",
          failure: classifyMediaFailure({
            mediaDevicesAvailable,
            secureContext,
          }),
        };
      }

      try {
        const stream = await getUserMedia(constraints);
        if (requestId !== requestSerial) {
          releaseStream(stream);
          return { status: "discarded" };
        }
        currentStream = stream;
        return { status: "live", stream };
      } catch (error) {
        if (requestId !== requestSerial) {
          return { status: "discarded" };
        }
        return {
          status: "failed",
          failure: classifyMediaFailure({
            error,
            mediaDevicesAvailable: true,
            secureContext: true,
          }),
        };
      }
    },
  };
}
