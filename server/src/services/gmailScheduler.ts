import { config } from "../config.js";
import { pollGmailOnce } from "./gmailIngest.js";

let timer: NodeJS.Timeout | null = null;
let running = false;

async function runPoll(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const result = await pollGmailOnce();
    if (result.processed > 0) {
      console.log(`[gmail-scheduler] processed ${result.processed} message(s)`);
    }
  } catch (err) {
    // invalid_grant is handled inside pollGmailOnce (no stack spam)
    console.error("[gmail-scheduler] poll failed", err);
  } finally {
    running = false;
  }
}

export function startGmailScheduler(): void {
  const intervalMinutes = Math.min(Math.max(config.autoPollMinutes, 2), 5);
  const intervalMs = intervalMinutes * 60 * 1000;
  void runPoll();
  timer = setInterval(() => {
    void runPoll();
  }, intervalMs);
  console.log(`[gmail-scheduler] started (${intervalMinutes} min interval)`);
}

export function stopGmailScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
