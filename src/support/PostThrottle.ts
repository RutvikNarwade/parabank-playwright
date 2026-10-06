/**
 * Sliding-window limiter for POST requests, one instance per Playwright worker.
 *
 * Why: the public ParaBank instance blocks the caller's IP for 300s once it sends roughly
 * 20 POSTs within a short window (Cloudflare "error 1015"). GET traffic is not affected.
 * Every state-changing step in this suite is a POST: registration, login form, transfer,
 * bill pay, loans and profile updates. Pacing those POSTs keeps the suite under the limit
 * instead of failing at random. See docs/RELIABILITY.md (RC-2).
 *
 * The overall budget is split evenly across workers, so workers never need to coordinate
 * across processes. This only paces requests to respect a documented server policy.
 * It is not a wait for application state: tests still rely on web-first assertions.
 */
export class PostThrottle {
  private readonly sent: number[] = [];

  constructor(
    readonly maxPerWindow: number,
    private readonly windowMs: number,
  ) {}

  /** Takes one POST slot, waiting for the window to free one up if necessary. */
  async acquire(): Promise<void> {
    await this.waitForCapacity(1);
    this.sent.push(Date.now());
  }

  /**
   * Waits until `count` POSTs could be sent immediately. Browser tests call this during setup:
   * if a form submission waited in the throttle instead, the click's action timeout would expire
   * while it waited for the navigation to commit (docs/RELIABILITY.md, RC-5).
   */
  async waitForCapacity(count: number): Promise<void> {
    const needed = Math.min(count, this.maxPerWindow);
    for (;;) {
      const now = Date.now();
      while (this.sent.length && now - this.sent[0] >= this.windowMs) this.sent.shift();
      const free = this.maxPerWindow - this.sent.length;
      if (free >= needed) return;
      // The (needed - free)th oldest POST has to leave the window before enough slots are free.
      const oldestBlocking = this.sent[needed - free - 1];
      await new Promise((resolve) => setTimeout(resolve, this.windowMs - (now - oldestBlocking) + 25));
    }
  }
}
