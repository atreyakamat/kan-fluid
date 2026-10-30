/**
 * Server-Sent Events hub.
 * Tracks live connections for presence and pushes change notifications so every
 * open tab stays in sync without polling.
 */

const clients = new Set();
let nextId = 1;

function write(res, payload) {
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    /* connection closed */
  }
}

export function onlineUsers() {
  const byId = new Map();
  for (const client of clients) {
    if (!byId.has(client.user.id)) {
      byId.set(client.user.id, {
        id: client.user.id,
        username: client.user.username,
        name: client.user.name,
        role: client.user.role,
      });
    }
  }
  return Array.from(byId.values());
}

function presenceEvent() {
  return { type: 'presence', users: onlineUsers() };
}

export function broadcast(payload, { except } = {}) {
  for (const client of clients) {
    if (except && client.clientId === except) continue;
    write(client.res, payload);
  }
}

export function notify(req, payload, type = 'change') {
  const actor = req.user ? { id: req.user.id, name: req.user.name } : null;
  broadcast({ type, ...payload, actor }, { except: req.get('x-kan-client') });
}

export function addClient(req, res) {
  const client = {
    id: nextId++,
    clientId: req.query.client || '',
    user: req.user,
    res,
  };
  clients.add(client);

  req.socket?.setTimeout?.(0);
  req.socket?.setNoDelay?.(true);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  write(res, { type: 'hello', user: client.user.id, users: onlineUsers() });
  broadcast(presenceEvent(), { except: client.clientId });

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* ignore */
    }
  }, 25000);

  const cleanup = () => {
    if (!clients.has(client)) return;
    clients.delete(client);
    clearInterval(heartbeat);
    broadcast(presenceEvent(), { except: client.clientId });
  };

  req.on('close', cleanup);
  req.on('error', cleanup);
  return client;
}
