// Port of objEventNotify (keepMePosted / eventNotify / requestNotification). A lightweight
// publish/subscribe bus. Subscribers auto-unsubscribe on entity finish (the original cancels
// its registrations in objEventNotify.finish) — call `unsubscribeAll(token)` from teardown.

export type Listener = (...args: any[]) => void;

export class EventBus {
  private byEvent = new Map<string, Set<Listener>>();
  private byToken = new Map<object, Array<{ event: string; fn: Listener }>>();

  /** keepMePosted: subscribe `fn` to `event`, tracked under `token` (usually the entity). */
  on(token: object, event: string, fn: Listener): void {
    let set = this.byEvent.get(event);
    if (!set) { set = new Set(); this.byEvent.set(event, set); }
    set.add(fn);
    let list = this.byToken.get(token);
    if (!list) { list = []; this.byToken.set(token, list); }
    list.push({ event, fn });
  }

  off(event: string, fn: Listener): void {
    this.byEvent.get(event)?.delete(fn);
  }

  /** eventNotify: fire `event`. */
  emit(event: string, ...args: any[]): void {
    const set = this.byEvent.get(event);
    if (!set) return;
    // copy to tolerate mutation during dispatch
    for (const fn of [...set]) fn(...args);
  }

  /** Cancel all subscriptions registered under a token (objEventNotify.finish). */
  unsubscribeAll(token: object): void {
    const list = this.byToken.get(token);
    if (!list) return;
    for (const { event, fn } of list) this.byEvent.get(event)?.delete(fn);
    this.byToken.delete(token);
  }

  clear(): void { this.byEvent.clear(); this.byToken.clear(); }
}
