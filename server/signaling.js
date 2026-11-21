// Signaling: "calo perkenalan" antar peer.
// Server HANYA meneruskan offer / answer / ice. Pesan chat TIDAK pernah lewat sini,
// semua data mengalir langsung antar browser lewat WebRTC DataChannel.

const ID_RE = /^[A-Z0-9]{6}$/;
const KEEPALIVE_MS = 25_000;

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, max);

export function createSignaling({ log = () => {} } = {}) {
  /** peerId -> { conn, name, token } */
  const peers = new Map();

  const send = (conn, obj) => conn.send(JSON.stringify(obj));

  function onConnection(conn) {
    let myId = null;

    conn.on('message', (raw) => {
      conn.alive = true;
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return send(conn, { type: 'error', code: 'bad-json' });
      }
      if (!msg || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case 'register': {
          const id = String(msg.peerId || '').toUpperCase();
          if (!ID_RE.test(id)) return send(conn, { type: 'error', code: 'bad-id' });

          const existing = peers.get(id);
          if (existing && existing.conn !== conn && !existing.conn.closed) {
            // Token sama = pemilik yang sama (reload / koneksi putus) -> boleh ambil alih.
            if (existing.token && existing.token === msg.token) {
              existing.conn.close(4000);
            } else {
              return send(conn, { type: 'error', code: 'id-in-use' });
            }
          }
          if (myId && myId !== id && peers.get(myId)?.conn === conn) peers.delete(myId);

          myId = id;
          peers.set(id, { conn, name: clean(msg.name, 32) || `Peer ${id}`, token: clean(msg.token, 64) });
          send(conn, { type: 'registered', peerId: id, online: peers.size });
          log(`+ ${id} (${peers.get(id).name}) online=${peers.size}`);
          break;
        }

        case 'offer':
        case 'answer':
        case 'ice': {
          if (!myId) return send(conn, { type: 'error', code: 'not-registered' });
          const target = peers.get(String(msg.to || '').toUpperCase());
          if (!target || target.conn.closed) {
            return send(conn, { type: 'error', code: 'peer-not-found', to: msg.to });
          }
          send(target.conn, {
            type: msg.type,
            from: myId,
            name: peers.get(myId)?.name,
            payload: msg.payload,
          });
          break;
        }

        case 'lookup': {
          const id = String(msg.peerId || '').toUpperCase();
          const found = peers.get(id);
          send(conn, {
            type: 'lookup-result',
            peerId: id,
            online: !!found && !found.conn.closed,
            name: found?.name || null,
          });
          break;
        }

        case 'ping':
          send(conn, { type: 'pong' });
          break;

        default:
          send(conn, { type: 'error', code: 'unknown-type' });
      }
    });

    conn.on('close', () => {
      if (myId && peers.get(myId)?.conn === conn) {
        peers.delete(myId);
        log(`- ${myId} online=${peers.size}`);
      }
    });
  }

  // Jaga koneksi tetap hidup (hosting seperti Render/Railway memutus koneksi idle)
  const timer = setInterval(() => {
    for (const { conn } of peers.values()) {
      if (!conn.alive) {
        conn.terminate();
        continue;
      }
      conn.alive = false;
      conn.ping();
    }
  }, KEEPALIVE_MS);
  timer.unref();

  return { onConnection, online: () => peers.size };
}
