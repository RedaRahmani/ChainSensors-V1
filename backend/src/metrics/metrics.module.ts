import { Module, Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as client from 'prom-client';

// Singleton registry and metrics
const register = new client.Registry();

// Default label on ALL metrics (custom + default)
register.setDefaultLabels({ service: 'backend' });

// Add default metrics (Node.js process metrics) with cs_ prefix
client.collectDefaultMetrics({
  register,
  prefix: 'cs_',
});

// Custom metrics
export const indexerMetrics = {
  eventsTotal: new client.Counter({
    name: 'cs_indexer_events_total',
    help: 'Total number of events processed by type',
    labelNames: ['type', 'program'],
    registers: [register],
  }),
  backfillPagesTotal: new client.Counter({
    name: 'cs_indexer_backfill_pages_total',
    help: 'Total backfill pages processed',
    labelNames: ['program'],
    registers: [register],
  }),
  slotLag: new client.Gauge({
    name: 'cs_indexer_slot_lag',
    help: 'Difference between current slot and last processed slot',
    labelNames: ['program'],
    registers: [register],
  }),
  lastSlot: new client.Gauge({
    name: 'cs_indexer_last_slot',
    help: 'Last processed slot number',
    labelNames: ['program'],
    registers: [register],
  }),
  errorsTotal: new client.Counter({
    name: 'cs_indexer_errors_total',
    help: 'Total indexer errors by phase',
    labelNames: ['phase', 'program'],
    registers: [register],
  }),
};

export const walrusMetrics = {
  putTotal: new client.Counter({
    name: 'cs_walrus_put_total',
    help: 'Total Walrus PUT requests by status',
    labelNames: ['status'],
    registers: [register],
  }),
  getTotal: new client.Counter({
    name: 'cs_walrus_get_total',
    help: 'Total Walrus GET requests by status',
    labelNames: ['status'],
    registers: [register],
  }),
  putDuration: new client.Histogram({
    name: 'cs_walrus_put_duration_seconds',
    help: 'Walrus PUT request duration in seconds',
    registers: [register],
  }),
  getDuration: new client.Histogram({
    name: 'cs_walrus_get_duration_seconds',
    help: 'Walrus GET request duration in seconds',
    registers: [register],
  }),
};

export const arciumMetrics = {
  resealCallbacksTotal: new client.Counter({
    name: 'cs_reseal_callbacks_total',
    help: 'Total reseal callbacks by method',
    labelNames: ['via'],
    registers: [register],
  }),
  resealCallbackWaitSeconds: new client.Histogram({
    name: 'cs_reseal_callback_wait_seconds',
    help: 'Time waiting for reseal callback completion',
    registers: [register],
  }),
};

export const healthGauge = new client.Gauge({
  name: 'cs_health_status',
  help: 'Health status of the service',
  registers: [register],
});

// Set initial health to healthy
healthGauge.set(1);

@Controller()
export class MetricsController {
  @Get('/metrics')
  async getMetrics(@Res() res: Response) {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.send(metrics);
  }

  @Get('/healthz')
  getHealth() {
    return {
      ok: true,
      timestamp: new Date().toISOString(),
      service: 'chainsensors-backend',
    };
  }
}

@Module({
  controllers: [MetricsController],
  exports: [],
})
export class MetricsModule {}

// Helper creators (kept, but not required with default labels)
export function createCounter(name: string, help: string, labelNames: string[] = []) {
  return new client.Counter({
    name: `cs_${name}`,
    help,
    labelNames,
    registers: [register],
  });
}

export function createGauge(name: string, help: string, labelNames: string[] = []) {
  return new client.Gauge({
    name: `cs_${name}`,
    help,
    labelNames,
    registers: [register],
  });
}

export function createHistogram(name: string, help: string, labelNames: string[] = []) {
  return new client.Histogram({
    name: `cs_${name}`,
    help,
    labelNames,
    registers: [register],
  });
}
