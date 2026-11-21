// Penyimpanan lokal (No.5 Data): IndexedDB per identitas, tanpa database pusat.
// Bila IndexedDB tidak tersedia (mode privat dsb.), otomatis pakai memori sementara.
export function createDB(name) {
  let dbPromise = null;
  const mem = { peers: new Map(), messages: new Map() };

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) return reject(new Error('no indexedDB'));
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('peers', { keyPath: 'id' });
        const msgs = db.createObjectStore('messages', { keyPath: 'id' });
        msgs.createIndex('chatId', 'chatId');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch(() => null);
    return dbPromise;
  }

  /** Jalankan satu operasi pada object store. */
  async function run(store, mode, fn) {
    const db = await open();
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    }).catch(() => undefined);
  }

  const hasIDB = async () => !!(await open());

  return {
    async getPeers() {
      if (!(await hasIDB())) return [...mem.peers.values()];
      return (await run('peers', 'readonly', (s) => s.getAll())) || [];
    },
    async putPeer(peer) {
      if (!(await hasIDB())) return void mem.peers.set(peer.id, peer);
      await run('peers', 'readwrite', (s) => s.put(peer));
    },
    async deletePeer(id) {
      if (!(await hasIDB())) return void mem.peers.delete(id);
      await run('peers', 'readwrite', (s) => s.delete(id));
    },

    async getAllMessages() {
      if (!(await hasIDB())) return [...mem.messages.values()];
      return (await run('messages', 'readonly', (s) => s.getAll())) || [];
    },
    async putMessage(msg) {
      if (!(await hasIDB())) return void mem.messages.set(msg.id, msg);
      await run('messages', 'readwrite', (s) => s.put(msg));
    },
    async deleteMessages(chatId) {
      if (!(await hasIDB())) {
        for (const [id, m] of mem.messages) if (m.chatId === chatId) mem.messages.delete(id);
        return;
      }
      const all = (await run('messages', 'readonly', (s) => s.index('chatId').getAllKeys(chatId))) || [];
      await run('messages', 'readwrite', (s) => {
        all.forEach((k) => s.delete(k));
      });
    },
  };
}
