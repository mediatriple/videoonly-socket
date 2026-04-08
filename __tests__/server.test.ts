import 'dotenv/config';
import { createServer } from 'http';
import { createHmac } from 'crypto';
import { Server } from 'socket.io';
import { io as clientIO, Socket as ClientSocket } from 'socket.io-client';
import { authMiddleware } from '../src/auth';
import { registerHandlers as registerTextareaHandlers } from '../src/handlers/textarea';
import { registerHandlers as registerSoundHandlers } from '../src/handlers/sound';
import { registerHandlers as registerEncoderHandlers } from '../src/handlers/encoder';

// Use a fixed secret so tests are self-contained.
const TEST_SECRET = 'test-secret-123';
const TEST_LEGACY_SECRET = 'legacy-test-secret-456';
process.env.TOKEN_SECRET = TEST_SECRET;
process.env.LEGACY_HMAC_SECRET = TEST_LEGACY_SECRET;
process.env.NODE_ENV = 'test';

// ── Test server helpers ──────────────────────────────────────────────────────

let io: Server;
let serverUrl: string;

function buildClient(opts: {
  token?: string;
  user_id?: string;
  encoders_id?: string;
}): ClientSocket {
  return clientIO(serverUrl, {
    autoConnect: false,
    transports: ['websocket'],
    query: {
      token: opts.token ?? TEST_SECRET,
      user_id: opts.user_id ?? 'user1',
      encoders_id: opts.encoders_id ?? 'enc1',
    },
  });
}

function buildLegacyToken(userId: string, encoderId: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const date = `${year}-${month}-${day}`;

  return createHmac('sha256', TEST_LEGACY_SECRET)
    .update(`${userId}|${encoderId}|${date}`)
    .digest('hex');
}

function connected(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
    socket.connect();
  });
}

function once<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll((done) => {
  const httpServer = createServer();
  io = new Server(httpServer, { transports: ['websocket'] });
  io.use(authMiddleware);

  io.on('connection', (socket) => {
    const { user_id, encoders_id } = socket.handshake.query as Record<
      string,
      string
    >;
    socket.join(`encoder:${encoders_id}`);
    registerTextareaHandlers(io, socket);
    registerSoundHandlers(io, socket);
    registerEncoderHandlers(io, socket);
    // Suppress unused-var lint inside test file.
    void user_id;
  });

  httpServer.listen(0, () => {
    const addr = httpServer.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    serverUrl = `http://localhost:${port}`;
    done();
  });
});

afterAll(() => {
  io.close();
});

// ── Authentication ───────────────────────────────────────────────────────────

describe('Authentication', () => {
  test('valid token connects successfully', async () => {
    const client = buildClient({ token: TEST_SECRET });
    await expect(connected(client)).resolves.toBeUndefined();
    client.disconnect();
  });

  test('legacy HMAC token connects successfully', async () => {
    const userId = 'legacy-user';
    const encoderId = 'legacy-encoder';
    const client = buildClient({
      token: buildLegacyToken(userId, encoderId),
      user_id: userId,
      encoders_id: encoderId,
    });

    await expect(connected(client)).resolves.toBeUndefined();
    client.disconnect();
  });

  test('invalid token is rejected', async () => {
    const client = buildClient({ token: 'wrong-token' });
    await expect(connected(client)).rejects.toBeTruthy();
    client.disconnect();
  });

  test('missing token is rejected', async () => {
    const client = buildClient({ token: '' });
    await expect(connected(client)).rejects.toBeTruthy();
    client.disconnect();
  });
});

// ── Room isolation ───────────────────────────────────────────────────────────

describe('Room isolation', () => {
  test('event from encoder A is NOT received by encoder B client', async () => {
    const clientA = buildClient({ user_id: 'userA', encoders_id: 'encA' });
    const clientB = buildClient({ user_id: 'userB', encoders_id: 'encB' });

    await Promise.all([connected(clientA), connected(clientB)]);

    let received = false;
    clientB.on('textarea-update', () => {
      received = true;
    });

    clientA.emit('textarea-change', {
      user_id: 'userA',
      encoders_id: 'encA',
      value: 'hello',
      user_name: 'Alice',
    });

    await sleep(200);
    expect(received).toBe(false);

    clientA.disconnect();
    clientB.disconnect();
  });
});

// ── textarea-change ──────────────────────────────────────────────────────────

describe('Event: textarea-change', () => {
  test('sender does NOT receive textarea-update', async () => {
    const sender = buildClient({ user_id: 'u1', encoders_id: 'enc-ta' });
    await connected(sender);

    let selfReceived = false;
    sender.on('textarea-update', () => {
      selfReceived = true;
    });

    sender.emit('textarea-change', {
      user_id: 'u1',
      encoders_id: 'enc-ta',
      value: 'test',
      user_name: 'User1',
    });

    await sleep(150);
    expect(selfReceived).toBe(false);
    sender.disconnect();
  });

  test('other client in same room receives textarea-update', async () => {
    const sender = buildClient({ user_id: 'u1', encoders_id: 'enc-tb' });
    const receiver = buildClient({ user_id: 'u2', encoders_id: 'enc-tb' });

    await Promise.all([connected(sender), connected(receiver)]);

    const payload = {
      user_id: 'u1',
      encoders_id: 'enc-tb',
      value: 'hello world',
      user_name: 'User1',
    };

    const receivedPayload = once(receiver, 'textarea-update');
    sender.emit('textarea-change', payload);

    await expect(receivedPayload).resolves.toMatchObject(payload);

    sender.disconnect();
    receiver.disconnect();
  });
});

// ── encoder_action_button ────────────────────────────────────────────────────

describe('Event: encoder_action_button', () => {
  test('broadcasts socket_encoder_action_buttonton_update to room', async () => {
    const sender = buildClient({ user_id: 'u1', encoders_id: 'enc-eab' });
    const receiver = buildClient({ user_id: 'u2', encoders_id: 'enc-eab' });

    await Promise.all([connected(sender), connected(receiver)]);

    const payload = { user_id: 'u1', encoders_id: 'enc-eab', value: 'start' };
    const received = once(receiver, 'socket_encoder_action_buttonton_update');
    sender.emit('encoder_action_button', payload);

    await expect(received).resolves.toMatchObject(payload);

    sender.disconnect();
    receiver.disconnect();
  });
});

// ── preview_normal_sound_warning ─────────────────────────────────────────────

describe('Event: preview_normal_sound_warning', () => {
  test('broadcasts preview_normal_sound_warning_update to room', async () => {
    const sender = buildClient({ user_id: 'u1', encoders_id: 'enc-psw' });
    const receiver = buildClient({ user_id: 'u2', encoders_id: 'enc-psw' });

    await Promise.all([connected(sender), connected(receiver)]);

    const payload = {
      user_id: 'u1',
      encoders_id: 'enc-psw',
      is_mismatch: true,
      sound_scope: 'preview' as const,
    };
    const received = once(receiver, 'preview_normal_sound_warning_update');
    sender.emit('preview_normal_sound_warning', payload);

    await expect(received).resolves.toMatchObject(payload);

    sender.disconnect();
    receiver.disconnect();
  });
});

// ── socket_sound_right ───────────────────────────────────────────────────────

describe('Event: socket_sound_right', () => {
  test('broadcasts socket_sound_right_update to room', async () => {
    const sender = buildClient({ user_id: 'u1', encoders_id: 'enc-ssr' });
    const receiver = buildClient({ user_id: 'u2', encoders_id: 'enc-ssr' });

    await Promise.all([connected(sender), connected(receiver)]);

    const payload = {
      user_id: 'u1',
      encoders_id: 'enc-ssr',
      value: 80,
      sound_scope: 'normal' as const,
    };
    const received = once(receiver, 'socket_sound_right_update');
    sender.emit('socket_sound_right', payload);

    await expect(received).resolves.toMatchObject(payload);

    sender.disconnect();
    receiver.disconnect();
  });
});

// ── socket_sound_left ────────────────────────────────────────────────────────

describe('Event: socket_sound_left', () => {
  test('broadcasts socket_sound_left_update to room', async () => {
    const sender = buildClient({ user_id: 'u1', encoders_id: 'enc-ssl' });
    const receiver = buildClient({ user_id: 'u2', encoders_id: 'enc-ssl' });

    await Promise.all([connected(sender), connected(receiver)]);

    const payload = {
      user_id: 'u1',
      encoders_id: 'enc-ssl',
      value: 60,
      sound_scope: 'normal' as const,
    };
    const received = once(receiver, 'socket_sound_left_update');
    sender.emit('socket_sound_left', payload);

    await expect(received).resolves.toMatchObject(payload);

    sender.disconnect();
    receiver.disconnect();
  });
});

// ── encoder_icon_button ──────────────────────────────────────────────────────

describe('Event: encoder_icon_button', () => {
  test('broadcasts icon-status-update to room', async () => {
    const sender = buildClient({ user_id: 'u1', encoders_id: 'enc-eib' });
    const receiver = buildClient({ user_id: 'u2', encoders_id: 'enc-eib' });

    await Promise.all([connected(sender), connected(receiver)]);

    const payload = { user_id: 'u1', encoders_id: 'enc-eib', value: true };
    const received = once(receiver, 'icon-status-update');
    sender.emit('encoder_icon_button', payload);

    await expect(received).resolves.toMatchObject(payload);

    sender.disconnect();
    receiver.disconnect();
  });
});

// ── encoder_logo_button ──────────────────────────────────────────────────────

describe('Event: encoder_logo_button', () => {
  test('broadcasts logo-status-update to room', async () => {
    const sender = buildClient({ user_id: 'u1', encoders_id: 'enc-elb' });
    const receiver = buildClient({ user_id: 'u2', encoders_id: 'enc-elb' });

    await Promise.all([connected(sender), connected(receiver)]);

    const payload = { user_id: 'u1', encoders_id: 'enc-elb', value: 1 };
    const received = once(receiver, 'logo-status-update');
    sender.emit('encoder_logo_button', payload);

    await expect(received).resolves.toMatchObject(payload);

    sender.disconnect();
    receiver.disconnect();
  });
});

// ── encoder_kj_control_button ────────────────────────────────────────────────

describe('Event: encoder_kj_control_button', () => {
  test('broadcasts kj-control-status-update to room', async () => {
    const sender = buildClient({ user_id: 'u1', encoders_id: 'enc-kj' });
    const receiver = buildClient({ user_id: 'u2', encoders_id: 'enc-kj' });

    await Promise.all([connected(sender), connected(receiver)]);

    const payload = { user_id: 'u1', encoders_id: 'enc-kj', value: false };
    const received = once(receiver, 'kj-control-status-update');
    sender.emit('encoder_kj_control_button', payload);

    await expect(received).resolves.toMatchObject(payload);

    sender.disconnect();
    receiver.disconnect();
  });
});

// ── Disconnect ───────────────────────────────────────────────────────────────

describe('Disconnect', () => {
  test('socket leaves room on disconnect', async () => {
    const client = buildClient({ user_id: 'u1', encoders_id: 'enc-disc' });
    await connected(client);

    const socketId = client.id!;
    client.disconnect();

    // Give the server a moment to process the disconnect.
    await sleep(200);

    const room = io.sockets.adapter.rooms.get('encoder:enc-disc');
    expect(room?.has(socketId) ?? false).toBe(false);
  });
});
