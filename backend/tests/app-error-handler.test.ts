import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/logging', () => ({
  log: vi.fn(),
}));

import { createApp } from '../src/app';
import { log } from '../src/utils/logging';

describe('application error handler', () => {
  it('does not expose unexpected server error details', async () => {
    const app = createApp();
    app.get('/test/error', async () => {
      throw new Error('database password=super-secret exploded');
    });
    await app.ready();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/test/error',
      });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: 'Internal Server Error',
      });
      expect(response.body).not.toContain('database');
      expect(response.body).not.toContain('super-secret');
      expect(log).toHaveBeenCalledWith(
        'APP',
        'error',
        expect.stringContaining('GET /test/error failed: database password=super-secret exploded'),
        'WEB',
      );
    } finally {
      await app.close();
    }
  });
  it('preserves explicit HTTP error status codes without exposing messages', async () => {
    const app = createApp();
    app.get('/test/rate-limit', async () => {
      const error = Object.assign(new Error('secret internal rate limit information'), {
        statusCode: 429,
      });
      throw error;
    });
    await app.ready();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/test/rate-limit',
      });
      expect(response.statusCode).toBe(429);
      expect(response.json()).toEqual({
        error: 'Too Many Requests',
      });
      expect(response.body).not.toContain('secret internal rate limit information');
    } finally {
      await app.close();
    }
  });
  it('maps errors without a valid HTTP status to 500', async () => {
    const app = createApp();
    app.get('/test/invalid-status', async () => {
      throw Object.assign(new Error('internal failure'), {
        statusCode: 999,
      });
    });
    await app.ready();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/test/invalid-status',
      });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: 'Internal Server Error',
      });
    } finally {
      await app.close();
    }
  });
});
