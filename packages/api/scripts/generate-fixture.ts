/**
 * Generate a test fixture from Browser Rendering output
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load credentials
const devVarsPath = resolve(__dirname, '../.dev.vars');
const devVars = readFileSync(devVarsPath, 'utf-8');
const env: Record<string, string> = {};
devVars.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.startsWith('#')) {
    env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
  }
});

const CF_ACCOUNT_ID = env.CF_ACCOUNT_ID;
const CF_API_TOKEN = env.CF_API_TOKEN;

// The short chat for testing
const TEST_URL = 'https://claude.ai/share/6c9019ea-a06f-42d1-87dd-67db6c8703a0';

async function main() {
  console.log('Fetching page via Browser Rendering API...');
  console.log('URL:', TEST_URL);
  console.log('');

  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/content`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: TEST_URL,
        gotoOptions: { waitUntil: 'networkidle0' },
        waitForSelector: {
          selector: '[data-is-streaming]',
          options: { timeout: 15000 },
        },
      }),
    }
  );

  const json = await resp.json() as { success: boolean; result: string };

  if (!json.success || !json.result) {
    console.error('Failed to fetch:', json);
    process.exit(1);
  }

  const html = json.result;
  console.log('HTML length:', html.length);

  // Create fixtures directory
  const fixturesDir = resolve(__dirname, '../src/__tests__/fixtures');
  mkdirSync(fixturesDir, { recursive: true });

  // Save the fixture
  const fixturePath = resolve(fixturesDir, 'browser-rendering-output.html');
  writeFileSync(fixturePath, html);
  console.log('Fixture saved to:', fixturePath);

  // Quick validation
  console.log('\n=== Validation ===');
  console.log('Contains data-is-streaming:', html.includes('data-is-streaming'));
  console.log('Contains font-user-message:', html.includes('font-user-message'));

  // Count messages
  const streamingDivs = html.match(/<div[^>]*data-is-streaming[^>]*>/gi);
  const userMsgs = html.match(/font-user-message/gi);
  console.log('data-is-streaming divs:', streamingDivs?.length || 0);
  console.log('font-user-message occurrences:', userMsgs?.length || 0);
}

main().catch(console.error);
