import { Miniflare } from 'miniflare';
import { beforeAll, afterAll } from 'vitest';

// Global miniflare instance for tests
export let mf: Miniflare;

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: '',
    d1Databases: ['DB'],
  });
});

afterAll(async () => {
  await mf?.dispose();
});

// Helper to get a fresh D1 database for each test
export async function getTestDb() {
  return await mf.getD1Database('DB');
}
