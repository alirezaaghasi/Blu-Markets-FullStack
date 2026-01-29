import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocket } from 'ws';
import { priceBroadcaster, PriceUpdate, FxUpdate } from '../../services/price-broadcaster.service.js';
import { getCurrentPrices, getCurrentFxRate } from '../../services/price-fetcher.service.js';
import { verifyAccessTokenPayload } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import type { AssetId } from '../../types/domain.js';

const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const CLIENT_TIMEOUT_MS = 35000; // 35 seconds (slightly longer than heartbeat)

// Rate limiting constants
const MESSAGE_RATE_LIMIT = 30; // max messages per window
const MESSAGE_RATE_WINDOW_MS = 10000; // 10 seconds
const MAX_CONNECTIONS_PER_USER = 5; // prevent resource exhaustion

interface SubscriptionMessage {
  type: 'subscribe' | 'unsubscribe';
  assets?: AssetId[]; // Subscribe to specific assets, or all if empty
}

interface ClientState {
  subscribedAssets: Set<AssetId>;
  subscribeAll: boolean;
  isAlive: boolean;
  userId: string;
  // Rate limiting state
  messageCount: number;
  messageWindowStart: number;
}

/**
 * Check if client is within rate limit
 * Returns true if request is allowed, false if rate limited
 */
function checkRateLimit(state: ClientState): boolean {
  const now = Date.now();
  // Reset window if expired
  if (now - state.messageWindowStart > MESSAGE_RATE_WINDOW_MS) {
    state.messageCount = 0;
    state.messageWindowStart = now;
  }
  state.messageCount++;
  return state.messageCount <= MESSAGE_RATE_LIMIT;
}

export async function registerPriceWebSocket(app: FastifyInstance): Promise<void> {
  // Track connected clients
  const clients = new Map<WebSocket, ClientState>();
  // Track connections per user for rate limiting
  const userConnectionCounts = new Map<string, number>();

  // Heartbeat interval to detect stale connections
  const heartbeatInterval = setInterval(() => {
    clients.forEach((state, socket) => {
      if (!state.isAlive) {
        logger.debug('Terminating inactive WebSocket client');
        clients.delete(socket);
        return socket.terminate();
      }

      state.isAlive = false;
      socket.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  // Cleanup heartbeat on server shutdown
  app.addHook('onClose', async () => {
    clearInterval(heartbeatInterval);
    clients.forEach((_, socket) => socket.terminate());
    clients.clear();
  });

  // Allowed WebSocket origins - always validate, but include dev origins in development
  const productionOrigins = [
    'https://blumarkets.ir',
    'https://www.blumarkets.ir',
    'https://api.blumarkets.ir',
  ];
  const developmentOrigins = [
    'http://localhost:3000',
    'http://localhost:8081',
    'http://localhost:19006',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8081',
  ];
  const isDev = process.env.NODE_ENV === 'development';
  const allowedWsOrigins = isDev
    ? [...productionOrigins, ...developmentOrigins]
    : productionOrigins;

  // WebSocket endpoint: /api/v1/prices/stream
  app.get('/stream', { websocket: true }, async (socket: WebSocket, req: FastifyRequest) => {
    // SECURITY: Always validate origin to prevent cross-site WebSocket hijacking
    // In development, we allow localhost origins in addition to production origins
    const origin = req.headers.origin;

    if (origin && !allowedWsOrigins.includes(origin)) {
      logger.warn('WebSocket connection rejected: Invalid origin', { origin, allowedOrigins: allowedWsOrigins });
      socket.close(4003, 'Origin not allowed');
      return;
    }

    // AUDIT FIX #4: JWT Authentication via secure channels only
    // SECURITY: Query string tokens are no longer accepted as they leak via proxy logs
    // Supported auth methods (in order of preference):
    // 1. Authorization header: "Bearer <token>" (standard, works in most clients)
    // 2. Sec-WebSocket-Protocol header: "Bearer-<token>" (React Native workaround)
    const headerToken = req.headers.authorization?.replace('Bearer ', '');

    // React Native WebSocket doesn't support custom headers, so we use protocol header
    const protocolHeader = req.headers['sec-websocket-protocol'] as string | undefined;
    const protocolToken = protocolHeader?.startsWith('Bearer-')
      ? protocolHeader.replace('Bearer-', '')
      : null;

    const token = headerToken || protocolToken;

    if (!token) {
      logger.warn('WebSocket connection rejected: No token provided');
      socket.close(4001, 'Authentication required');
      return;
    }

    let userId: string;
    try {
      // Verify token using the same verifier as REST endpoints
      const payload = verifyAccessTokenPayload(token);
      userId = payload.sub || 'unknown';
    } catch (error) {
      logger.warn('WebSocket connection rejected: Invalid token');
      socket.close(4001, 'Invalid token');
      return;
    }

    // SECURITY: Enforce per-user connection limit to prevent resource exhaustion
    const currentConnections = userConnectionCounts.get(userId) || 0;
    if (currentConnections >= MAX_CONNECTIONS_PER_USER) {
      logger.warn('WebSocket connection rejected: Max connections exceeded', {
        userId,
        currentConnections,
        maxAllowed: MAX_CONNECTIONS_PER_USER,
      });
      socket.close(4429, 'Too many connections');
      return;
    }
    userConnectionCounts.set(userId, currentConnections + 1);

    logger.info('WebSocket client connected (authenticated)', { userId });

    // Initialize client state with rate limiting fields
    const clientState: ClientState = {
      subscribedAssets: new Set(),
      subscribeAll: true, // Default: subscribe to all prices
      isAlive: true,
      userId,
      messageCount: 0,
      messageWindowStart: Date.now(),
    };
    clients.set(socket, clientState);

    // Handle pong responses (heartbeat)
    socket.on('pong', () => {
      clientState.isAlive = true;
    });

    // Send initial connection confirmation
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to Blu Markets price stream',
      timestamp: new Date().toISOString(),
    }));

    // Send current prices immediately on connect
    try {
      const [currentPrices, fxRate] = await Promise.all([
        getCurrentPrices(),
        getCurrentFxRate(),
      ]);

      if (currentPrices.size > 0) {
        const pricesArray = Array.from(currentPrices.entries()).map(([assetId, data]) => ({
          assetId,
          priceUsd: data.priceUsd,
          priceIrr: data.priceIrr,
          change24hPct: data.change24hPct,
          source: 'cache',
          timestamp: new Date().toISOString(),
        }));

        socket.send(JSON.stringify({
          type: 'prices',
          data: pricesArray,
          timestamp: new Date().toISOString(),
        }));

        socket.send(JSON.stringify({
          type: 'fx',
          usdIrr: fxRate.usdIrr,
          source: fxRate.source,
          timestamp: fxRate.fetchedAt.toISOString(),
        }));
      }
    } catch (error) {
      logger.error('Failed to send initial prices', error);
    }

    // Handle incoming messages (subscriptions)
    socket.on('message', (message: Buffer) => {
      // SECURITY: Check rate limit before processing
      if (!checkRateLimit(clientState)) {
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Rate limit exceeded. Please slow down.',
        }));
        logger.warn('WebSocket rate limit exceeded', { userId: clientState.userId });
        return;
      }

      try {
        const data = JSON.parse(message.toString()) as SubscriptionMessage;

        if (data.type === 'subscribe') {
          if (data.assets && data.assets.length > 0) {
            clientState.subscribeAll = false;
            data.assets.forEach((asset) => clientState.subscribedAssets.add(asset));
            socket.send(JSON.stringify({
              type: 'subscribed',
              assets: Array.from(clientState.subscribedAssets),
            }));
          } else {
            clientState.subscribeAll = true;
            socket.send(JSON.stringify({
              type: 'subscribed',
              assets: 'all',
            }));
          }
        } else if (data.type === 'unsubscribe') {
          if (data.assets) {
            data.assets.forEach((asset) => clientState.subscribedAssets.delete(asset));
          } else {
            clientState.subscribedAssets.clear();
            clientState.subscribeAll = false;
          }
          socket.send(JSON.stringify({
            type: 'unsubscribed',
            assets: data.assets || 'all',
          }));
        }
      } catch (error) {
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    });

    // Helper to cleanup client state and decrement connection count
    const cleanupClient = () => {
      const state = clients.get(socket);
      if (state) {
        // Decrement user connection count
        const count = userConnectionCounts.get(state.userId) || 1;
        if (count <= 1) {
          userConnectionCounts.delete(state.userId);
        } else {
          userConnectionCounts.set(state.userId, count - 1);
        }
      }
      clients.delete(socket);
    };

    // Handle disconnect
    socket.on('close', () => {
      logger.debug('WebSocket client disconnected', { userId: clientState.userId });
      cleanupClient();
    });

    socket.on('error', (error: Error) => {
      logger.error('WebSocket error', error, { userId: clientState.userId });
      cleanupClient();
    });
  });

  // Listen for price updates and broadcast to subscribed clients
  priceBroadcaster.on('price:update', (data: { assetId: AssetId } & PriceUpdate) => {
    const message = JSON.stringify({
      type: 'price',
      ...data,
    });

    clients.forEach((state, socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        if (state.subscribeAll || state.subscribedAssets.has(data.assetId)) {
          socket.send(message);
        }
      }
    });
  });

  // Listen for all prices broadcast
  priceBroadcaster.on('prices:all', (prices: Array<{ assetId: AssetId } & PriceUpdate>) => {
    const message = JSON.stringify({
      type: 'prices',
      data: prices,
      timestamp: new Date().toISOString(),
    });

    clients.forEach((state, socket) => {
      if (socket.readyState === WebSocket.OPEN && state.subscribeAll) {
        socket.send(message);
      }
    });
  });

  // Listen for FX rate updates
  priceBroadcaster.on('fx:update', (data: FxUpdate) => {
    const message = JSON.stringify({
      type: 'fx',
      ...data,
    });

    clients.forEach((state, socket) => {
      if (socket.readyState === WebSocket.OPEN && state.subscribeAll) {
        socket.send(message);
      }
    });
  });

  logger.info('Price WebSocket registered', { path: '/api/v1/prices/stream' });
}
