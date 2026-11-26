type Entry<T> = { at: number; value: T };

const store = new Map<string, Entry<unknown>>();
const pending = new Map<string, Promise<unknown>>();
let generation = 0;

export function touchBackofficeData() {
  generation += 1;
  store.clear();
}

export function remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.value);
  const current = pending.get(key) as Promise<T> | undefined;
  if (current) return current;
  const seen = generation;
  const promise = load()
    .then((value) => {
      if (generation === seen) store.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      if (pending.get(key) === promise) pending.delete(key);
    });
  pending.set(key, promise);
  return promise;
}
