import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createDatabase } from '@helm/db';
import { PlcRuntime } from '@helm/plc-runtime';
import {
  DEFAULT_TAG_DEFINITIONS,
  type RealtimeMessage,
  type SystemSummary,
  type TagSnapshot,
  type TagValue,
  writeTagBodySchema,
} from '@helm/shared';

loadEnv();

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const webDistPath = resolve(repoRoot, 'apps/web/dist');

const envSchema = z.object({
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  SQLITE_PATH: z.string().default('./data/helm.sqlite'),
  PLC_MODE: z.enum(['mock', 'keyence']).default('mock'),
  PLC_HOST: z.string().optional(),
  PLC_PORT: z.coerce.number().int().positive().default(8501),
  PLC_STATION: z
    .string()
    .optional()
    .transform((value) => {
      if (!value || value.trim() === '') {
        return undefined;
      }

      const parsed = Number(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }),
  PLC_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  PLC_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
});

const env = envSchema.parse(process.env);
const database = createDatabase({
  filePath: resolve(repoRoot, env.SQLITE_PATH),
});

database.seedTags(DEFAULT_TAG_DEFINITIONS);

const plcRuntime = new PlcRuntime({
  mode: env.PLC_MODE,
  host: env.PLC_HOST,
  port: env.PLC_PORT,
  station: env.PLC_STATION,
  timeout: env.PLC_TIMEOUT_MS,
  initialTags: database.listTags(),
});

await plcRuntime.start();

const server = Fastify({ logger: true });
const wsClients = new Set<WebSocket>();

const buildSummary = (): SystemSummary => {
  const dbSummary = database.getSummary();

  return {
    appName: 'Helm HMI Platform',
    apiVersion: '0.1.0',
    serverTime: new Date().toISOString(),
    plc: plcRuntime.getStatus(),
    database: {
      path: dbSummary.path,
      tagCount: dbSummary.tagCount,
      auditCount: dbSummary.auditCount,
    },
  };
};

const sendMessage = (socket: WebSocket, message: RealtimeMessage) => {
  if (socket.readyState !== socket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
};

const broadcast = (message: RealtimeMessage) => {
  for (const socket of wsClients) {
    sendMessage(socket, message);
  }
};

const persistTags = (tags: TagSnapshot[]) => {
  for (const tag of tags) {
    database.upsertTagSnapshot(tag);
  }
};

const publishSnapshot = (tags: TagSnapshot[]) => {
  broadcast({
    type: 'tags',
    tags,
  });

  broadcast({
    type: 'summary',
    summary: buildSummary(),
  });
};

await server.register(cors, { origin: true });
await server.register(websocket);

if (existsSync(webDistPath)) {
  await server.register(fastifyStatic, {
    root: webDistPath,
    prefix: '/',
  });
}

server.get('/ws', { websocket: true }, (socket) => {
  wsClients.add(socket);

  sendMessage(socket, {
    type: 'hello',
    summary: buildSummary(),
    tags: plcRuntime.listTags(),
  });

  socket.onclose = () => {
    wsClients.delete(socket);
  };

  socket.onerror = () => {
    wsClients.delete(socket);
  };
});

server.get('/api/health', async () => ({
  ok: true,
  mode: env.PLC_MODE,
  now: new Date().toISOString(),
}));

server.get('/api/system/summary', async () => buildSummary());

server.get('/api/tags', async (request) => {
  const querySchema = z.object({
    refresh: z.coerce.number().int().optional(),
  });
  const query = querySchema.parse(request.query);
  const tags = query.refresh ? await plcRuntime.readAll() : plcRuntime.listTags();

  persistTags(tags);

  return { items: tags };
});

server.get('/api/tags/:name', async (request, reply) => {
  const paramsSchema = z.object({
    name: z.string().min(1),
  });
  const params = paramsSchema.parse(request.params);
  const tag = await plcRuntime.readTag(params.name);

  if (!tag) {
    return reply.code(404).send({ message: `Tag ${params.name} not found` });
  }

  database.upsertTagSnapshot(tag);
  return tag;
});

server.post('/api/tags/:name/write', async (request, reply) => {
  const paramsSchema = z.object({
    name: z.string().min(1),
  });
  const params = paramsSchema.parse(request.params);
  const body = writeTagBodySchema.parse(request.body);
  const previous = plcRuntime.getTag(params.name);
  const result = await plcRuntime.writeTag(params.name, body.value as TagValue);

  if (!result) {
    return reply.code(404).send({ message: `Tag ${params.name} not found` });
  }

  database.upsertTagSnapshot(result);
  database.recordAudit({
    tagName: result.name,
    operator: body.operator ?? 'system',
    source: body.source ?? 'web',
    previousValue: previous?.value ?? null,
    nextValue: result.value,
    result: 'success',
  });

  publishSnapshot(plcRuntime.listTags());
  return result;
});

server.post('/api/plc/reconnect', async () => {
  await plcRuntime.reconnect();
  const tags = await plcRuntime.readAll();
  persistTags(tags);
  publishSnapshot(tags);
  return plcRuntime.getStatus();
});

if (existsSync(webDistPath)) {
  server.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ message: 'Not Found' });
    }

    return reply.sendFile('index.html');
  });
}

const poller = setInterval(async () => {
  try {
    const tags = await plcRuntime.readAll();
    persistTags(tags);
    publishSnapshot(tags);
  } catch (error) {
    server.log.error(error);
    broadcast({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}, env.PLC_POLL_INTERVAL_MS);

const shutdown = async () => {
  clearInterval(poller);
  for (const socket of wsClients) {
    socket.close();
  }
  wsClients.clear();
  await plcRuntime.stop();
  await server.close();
  database.close();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});

await server.listen({
  host: env.API_HOST,
  port: env.API_PORT,
});
