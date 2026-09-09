import { expect, test } from 'bun:test';
import { spawn } from 'bun';
import { join } from 'node:path';
import { execPath } from 'node:process';

test('save hydration and both resets use the configured storage without touching browser data', async () => {
  // A separate process installs an in-memory localStorage before importing the
  // singleton store, without changing other tests' module cache or globals.
  const child = spawn([execPath, join(import.meta.dir, '../../tests/save-round-trip.ts')], {
    stdout: 'pipe', stderr: 'pipe',
  });
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  expect(code, stderr).toBe(0);
}, 10_000);
