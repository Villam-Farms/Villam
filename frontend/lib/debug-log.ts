import Constants from "expo-constants";

const SESSION_ID = "158ca1";
const INGEST_PATH = "/ingest/bc43a9d6-ae9b-4156-9b29-faa0cd203f7e";

function getDevHostIp() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as { manifest?: { hostUri?: string } }).manifest?.hostUri;
  return typeof hostUri === "string" ? hostUri.split(":")[0] : undefined;
}

function getIngestUrl() {
  const ip = getDevHostIp();
  const host = ip ?? "127.0.0.1";
  return `http://${host}:7513${INGEST_PATH}`;
}

export function debugLog(payload: {
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
}) {
  const body = {
    sessionId: SESSION_ID,
    timestamp: Date.now(),
    ...payload,
  };
  if (__DEV__) {
    console.log("[debug]", body.location, body.message, body.data ?? {});
  }
  fetch(getIngestUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION_ID,
    },
    body: JSON.stringify(body),
  }).catch(() => {});
}
