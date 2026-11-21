// Event emitter kecil. core/ berkomunikasi ke UI hanya lewat event, tidak pernah import ui/.
export class Emitter {
  #handlers = new Map();

  on(event, fn) {
    if (!this.#handlers.has(event)) this.#handlers.set(event, new Set());
    this.#handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this.#handlers.get(event)?.delete(fn);
  }

  emit(event, payload) {
    for (const fn of [...(this.#handlers.get(event) || [])]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[Emitter] handler "${event}" error:`, err);
      }
    }
  }
}
