import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

async function createTestApp() {
  const app = createApp();
  app.post('/api/admin/test', async () => ({
    ok: true,
  }));
  app.patch('/api/admin/test', async () => ({
    ok: true,
  }));
  app.delete('/api/admin/test', async () => ({
    ok: true,
  }));
  app.get('/api/admin/test', async () => ({
    ok: true,
  }));
  app.post('/api/public-test', async () => ({
    ok: true,
  }));
  await app.ready();
  return app;
}

describe('app request origin protection', () => {
  it('allows admin mutations outside production without an Origin header', async () => {
    process.env.NODE_ENV = 'development';
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/test',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ok: true,
      });
    } finally {
      await app.close();
    }
  });
  it('rejects production admin mutations without an Origin header', async () => {
    process.env.NODE_ENV = 'production';
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/test',
        headers: {
          host: 'lp-tracker.example.com',
        },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        error: 'Invalid request origin',
      });
    } finally {
      await app.close();
    }
  });
  it('rejects malformed Origin headers', async () => {
    process.env.NODE_ENV = 'production';
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/admin/test',
        headers: {
          host: 'lp-tracker.example.com',
          origin: 'definitely-not-a-url',
        },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        error: 'Invalid request origin',
      });
    } finally {
      await app.close();
    }
  });
  it('rejects admin mutations from another origin', async () => {
    process.env.NODE_ENV = 'production';
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/admin/test',
        headers: {
          host: 'lp-tracker.example.com',
          origin: 'https://evil.example.com',
        },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        error: 'Invalid request origin',
      });
    } finally {
      await app.close();
    }
  });
  it('allows production admin mutations from the same origin', async () => {
    process.env.NODE_ENV = 'production';
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/test',
        headers: {
          host: 'lp-tracker.example.com',
          origin: 'https://lp-tracker.example.com',
        },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ok: true,
      });
    } finally {
      await app.close();
    }
  });
  it('takes the port into account when comparing origin and host', async () => {
    process.env.NODE_ENV = 'production';
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/test',
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
        },
      });
      expect(response.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
  it('allows production GET requests to admin routes without Origin', async () => {
    process.env.NODE_ENV = 'production';
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/test',
        headers: {
          host: 'lp-tracker.example.com',
        },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ok: true,
      });
    } finally {
      await app.close();
    }
  });
  it('allows production mutations outside admin routes without Origin', async () => {
    process.env.NODE_ENV = 'production';
    const app = await createTestApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/public-test',
        headers: {
          host: 'lp-tracker.example.com',
        },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ok: true,
      });
    } finally {
      await app.close();
    }
  });
});
