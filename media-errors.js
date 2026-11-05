export const MEDIA_FAILURE_MESSAGES = {
  NotAllowedError:
    "Camera or microphone access is not permitted. Check the Element, browser, and operating-system settings.",
  NotFoundError: "No camera or microphone was found.",
  NotReadableError:
    "The camera or microphone is unavailable or being used by another application.",
  OverconstrainedError:
    "No available device supports the requested configuration.",
  insecureContext: "Media access requires a supported secure browser context.",
};

const NAMED_FAILURES = new Set([
  "NotAllowedError",
  "NotFoundError",
  "NotReadableError",
  "OverconstrainedError",
]);

export function classifyMediaFailure({
  error = null,
  mediaDevicesAvailable = true,
  secureContext = true,
} = {}) {
  if (!secureContext || !mediaDevicesAvailable) {
    return {
      browserResult: "API unavailable / insecure context",
      message: MEDIA_FAILURE_MESSAGES.insecureContext,
    };
  }

  const name = typeof error?.name === "string" ? error.name : "";
  if (NAMED_FAILURES.has(name)) {
    return {
      browserResult: name,
      message: MEDIA_FAILURE_MESSAGES[name],
    };
  }

  if (name === "SecurityError" || name === "TypeError") {
    return {
      browserResult: "API unavailable / insecure context",
      message: MEDIA_FAILURE_MESSAGES.insecureContext,
    };
  }

  return {
    browserResult: name || "Error",
    message: "The media request failed. Retry Start or check the browser and device settings.",
  };
}

export function describeEnvironment({
  origin,
  secureContext,
  mediaDevicesAvailable,
  cameraAllowed,
  microphoneAllowed,
}) {
  const normalizedOrigin = !origin || origin === "null" ? "opaque (null)" : origin;
  return {
    origin: normalizedOrigin,
    secureContext: secureContext ? "yes" : "no",
    mediaDevicesAvailable: mediaDevicesAvailable ? "yes" : "no",
    cameraAllowed,
    microphoneAllowed,
  };
}

export function readPermission(policy, feature) {
  if (!policy || typeof policy.allowsFeature !== "function") {
    return "unavailable";
  }
  try {
    return policy.allowsFeature(feature) ? "allowed" : "blocked";
  } catch {
    return "unavailable";
  }
}
