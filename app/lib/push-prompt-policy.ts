export const PUSH_PROMPT_SEEN_KEY = "quiniderio-push-prompt-seen-v1";
export const PUSH_PROMPT_INTERVAL = 7 * 24 * 60 * 60 * 1000;

export function pushPromptDue(lastSeen: string | null, now = Date.now()): boolean {
  if (!lastSeen) return true;
  const timestamp = Number(lastSeen);
  return !Number.isFinite(timestamp) || timestamp <= 0 || now - timestamp >= PUSH_PROMPT_INTERVAL;
}
