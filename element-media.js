function pageIdentity(value) {
  const url = new URL(value);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  return `${url.origin}${pathname}`;
}

export function mediaGrantFromElementConfig(config) {
  const enabled = config?.hostingType === "remote" && config.cameraMicrophoneEnabled === true;
  return {
    camera: enabled ? "on" : "off",
    microphone: enabled ? "on" : "off",
  };
}

export function mediaGrantForPage(elements, pageUrl) {
  if (!Array.isArray(elements) || !pageUrl) {
    return mediaGrantFromElementConfig(null);
  }

  let pageKey = "";
  try {
    pageKey = pageIdentity(pageUrl);
  } catch {
    return mediaGrantFromElementConfig(null);
  }

  const match = elements.find((element) => {
    const remoteUrl = element?.config?.remoteUrl;
    if (typeof remoteUrl !== "string" || remoteUrl.length === 0) {
      return false;
    }
    try {
      return pageIdentity(remoteUrl) === pageKey;
    } catch {
      return false;
    }
  });

  return mediaGrantFromElementConfig(match?.config);
}
