import { ClockAhead, retryDelay, sync, UpgradeRequired, type LocalStore, type RemoteApi, type Study } from "@dilkart/core";
import { AppState } from "react-native";

export enum SyncProblem {
  None = "none",
  Offline = "offline",
  ClockAhead = "clock",
  Upgrade = "upgrade",
}

export interface SyncStatus {
  lastSyncAt?: number;
  pending: number;
  failed: number;
  problem: SyncProblem;
}

// Edits come in bursts while studying; wait for a pause before sending.
const AFTER_EDIT_MS = 3_000;
// Picks up other devices' changes and retries after reconnecting (plan section 12: ≤60 s).
const POLL_MS = 30_000;

/** Runs sync rounds on edits, on foreground, on a timer and with backoff after failures. */
export class SyncService {
  private timer?: ReturnType<typeof setTimeout>;
  private poll?: ReturnType<typeof setInterval>;
  private stopListening: (() => void)[] = [];
  private running?: Promise<void>;
  private attempt = 0;
  private status: SyncStatus = { pending: 0, failed: 0, problem: SyncProblem.None };

  constructor(
    private readonly store: LocalStore,
    private readonly remote: RemoteApi,
    private readonly study: Study,
    private readonly onStatus: (status: SyncStatus) => void,
    private readonly now: () => number = Date.now,
  ) {}

  start(): void {
    this.stopListening.push(this.store.subscribe(() => this.schedule(AFTER_EDIT_MS)));
    const appState = AppState.addEventListener("change", (state) => state === "active" && this.schedule(0));
    this.stopListening.push(() => appState.remove());
    this.poll = setInterval(() => this.schedule(0), POLL_MS);
  }

  stop(): void {
    clearTimeout(this.timer);
    clearInterval(this.poll);
    this.stopListening.forEach((stop) => stop());
    this.stopListening = [];
  }

  /** One round now; resolves when it ends, whatever the outcome. */
  run(): Promise<void> {
    this.running ??= this.round().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private schedule(delayMs: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), delayMs);
  }

  private async round(): Promise<void> {
    let problem = SyncProblem.None;
    try {
      const touched = await sync(this.store, this.remote, this.now);
      await this.study.refresh(touched);
      this.attempt = 0;
      this.status.lastSyncAt = this.now();
    } catch (e) {
      problem = e instanceof ClockAhead ? SyncProblem.ClockAhead : e instanceof UpgradeRequired ? SyncProblem.Upgrade : SyncProblem.Offline;
      // A wrong clock or an old app will not fix itself; foreground or the timer retries.
      if (problem === SyncProblem.Offline) {
        this.schedule(retryDelay(this.attempt++));
      }
    }
    this.status = { ...this.status, ...(await this.store.counts()), problem };
    this.onStatus({ ...this.status });
  }
}
