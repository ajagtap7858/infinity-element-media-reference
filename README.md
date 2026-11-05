# Media access reference Element

HTTPS reference page for AXP-90021. Register its GitHub Pages URL as a URL-hosted Infinity Element.

The page does not call `getUserMedia()` on load. **Start camera and microphone** requests both devices. **Stop** ends every track from that session. Camera-only and microphone-only buttons are device-request checks; they are not separate administrator settings.

## Deploy

Create a public GitHub repository and place these files at the repository root, including `.github/workflows/pages.yml`.

1. Push the `pages` branch. Do not use `main` for this test site.
2. In GitHub, open **Settings → Pages → Build and deployment**, and choose **GitHub Actions**.
3. After the workflow finishes, open the Pages URL. The status must say that camera and microphone have not been requested, and the camera light must stay off.

The Pages URL is the remote Element URL. Do not append query parameters that contain secrets.

## Lab test

1. Create a URL-hosted Element with the Pages URL.
2. Enable **Allow camera and microphone**. Same-origin access must also be on.
3. Open the Element in Agent Desktop and choose **Start camera and microphone**.
4. Confirm the preview and microphone level, then choose **Stop** and confirm the tracks end.
5. Turn the administrator setting off and load the Element again. Start must show the not-permitted message.

The environment panel shows the page origin and the saved Element setting. Camera and microphone stay off until this Element's `cameraMicrophoneEnabled` value is true. Opening the GitHub page directly has no Element configuration, so both stay off.

## Local check

```bash
npm test
npx --yes serve .
```

Open the local HTTPS or localhost URL directly. `file://` is not a secure context, so media requests fail before reaching the browser prompt.
