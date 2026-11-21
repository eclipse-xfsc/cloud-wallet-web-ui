import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
const index = args.indexOf('--port');
const port = index >= 0 ? args[index + 1] : process.env.PORT || '3000';
const env = {
  ...process.env,
  MOCK_MODE: 'true',
  MOCK_WALLET_URL: process.env.MOCK_WALLET_URL || `http://localhost:${port}`,
};
const children = [
  spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', ...args], { env, stdio: 'inherit' }),
  spawn(process.execPath, ['mock/merchant-server.mjs'], { env, stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', error => {
    console.error(error);
    stop(1);
  });
  child.on('exit', code => stop(code ?? 0));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
