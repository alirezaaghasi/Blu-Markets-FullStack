import { EventEmitter } from 'events';
import type { AssetId } from '../types/domain.js';

// Price update event emitter - singleton
class PriceBroadcaster extends EventEmitter {
  private static instance: PriceBroadcaster;

  private constructor() {
    super();
    this.setMaxListeners(1000); // Support many WebSocket connections
  }

  static getInstance(): PriceBroadcaster {
    if (!PriceBroadcaster.instance) {
      PriceBroadcaster.instance = new PriceBroadcaster();
    }
    return PriceBroadcaster.instance;
  }

  // Broadcast price update to all listeners
  broadcastPriceUpdate(assetId: AssetId, data: PriceUpdate): void {
    this.emit('price:update', { assetId, ...data });
    this.emit(`price:${assetId}`, data);
  }

  // Broadcast all prices at once
  broadcastAllPrices(prices: Map<AssetId, PriceUpdate>): void {
    const pricesArray = Array.from(prices.entries()).map(([assetId, data]) => ({
      assetId,
      ...data,
    }));
    this.emit('prices:all', pricesArray);
  }

  // Broadcast FX rate update
  broadcastFxUpdate(data: FxUpdate): void {
    this.emit('fx:update', data);
  }
}

export interface PriceUpdate {
  priceUsd: number;
  priceIrr: number;
  change24hPct?: number;
  source: string;
  timestamp: string;
}

export interface FxUpdate {
  usdIrr: number;
  source: string;
  timestamp: string;
}

export const priceBroadcaster = PriceBroadcaster.getInstance();
