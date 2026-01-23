import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocket } from 'ws';
import { priceBroadcaster, PriceUpdate, FxUpdate } from '../../services/price-broadcaster.service.js';
import { getCurrentPrices, getCurrentFxRate } from '../../services/price-fetcher.service.js';
import type { AssetId } from '../../types/domain.js';

const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const CLIENT_TIMEOUT_MS = 35000; // 35 seconds (slightly longer than heartbeat)

interface SubscriptionMessage {
  type: 'subscribe' | 'unsubscribe';
  assets?: AssetId[]; // Subscribe to specific assets, or all if empty
}

interface ClientState {
  subscribedAssets: Set<AssetId>;
  subscribeAll: boolean;
  isAlive: boolean;
}

export async function registerPriceWebSocket(app: FastifyInstance): Promise<void> {
  // Track connected clients
  const clients = new Map<WebSocket, ClientState>();

  // Heartbeat interval to detect stale connections
  const heartbeatInterval = setInterval(() => {
    clients.forEach((state, socket) => {
      if (!state.isAlive) {
        console.log('📡 Terminating inactive WebSocket client');
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

  // Allowed WebSocket origins for production
  const allowedWsOrigins = [
    'https://blumarkets.ir',
    'https://www.blumarkets.ir',
    'https://api.blumarkets.ir',
  ];

  // WebSocket endpoint: /api/v1/prices/stream
  app.get('/stream', { websocket: true }, async (socket: WebSocket, req: FastifyRequest) => {
    // SECURITY: Validate origin in production to prevent cross-site WebSocket hijacking
    const origin = req.headers.origin;
    const isDev = process.env.NODE_ENV === 'development';

    if (!isDev && origin && !allowedWsOrigins.includes(origin)) {
      console.log(`📡 WebSocket connection rejected: Invalid origin ${origin}`);
      socket.close(4003, 'Origin not allowed');
      return;
    }

    // JWT Authentication - prefer Authorization header over query string
    // SECURITY: Query string tokens can leak via proxy logs, referrers, or analytics
    // Prefer: Authorization header (works in React Native/mobile clients)
    // Fallback: Query string (for browser clients that can't set headers)
    const headerToken = req.headers.authorization?.replace('Bearer ', '');
    const queryToken = (req.query as Record<string, string>).token;

    if (queryToken && !headerToken) {
      console.warn('📡 WebSocket using query string token (deprecated) - consider using Authorization header');
    }

    const token = headerToken || queryToken;

    if (!token) {
      console.log('📡 WebSocket connection rejected: No token provided');
      socket.close(4001, 'Authentication required');
      return;
    }

    try {
      // Use access namespace for token verification (separate from refresh tokens)
      await (req as any).accessVerify({ token });
    } catch (error) {
      console.log('📡 WebSocket connection rejected: Invalid token');
      socket.close(4001, 'Invalid token');
      return;
    }

    console.log('📡 WebSocket client connected (authenticated)');

    // Initialize client state
    const clientState: ClientState = {
      subscribedAssets: new Set(),
      subscribeAll: true, // Default: subscribe to all prices
      isAlive: true,
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
      console.error('Failed to send initial prices:', error);
    }

    // Handle incoming messages (subscriptions)
    socket.on('message', (message: Buffer) => {
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

    // Handle disconnect
    socket.on('close', () => {
      console.log('📡 WebSocket client disconnected');
      clients.delete(socket);
    });

    socket.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      clients.delete(socket);
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

  console.log('✅ Price WebSocket registered at /api/v1/prices/stream');
}
