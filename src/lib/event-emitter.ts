// src/lib/event-emitter.ts

export class EventEmitter<Events extends Record<string, (...args: any[]) => void> = Record<string, (...args: any[]) => void>> {
  private events: { [K in keyof Events]?: Events[K][] } = {} as any;

  on<K extends keyof Events>(eventName: K, listener: Events[K]): void {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName]!.push(listener);
  }

  emit<K extends keyof Events>(eventName: K, ...args: Parameters<Events[K]>): void {
    const listeners = this.events[eventName];
    if (listeners) {
      listeners.forEach((listener) => listener(...args));
    }
  }

  off<K extends keyof Events>(eventName: K, listenerToRemove: Events[K]): void {
    const listeners = this.events[eventName];
    if (listeners) {
      this.events[eventName] = listeners.filter(
        (listener) => listener !== listenerToRemove
      );
    }
  }
}
