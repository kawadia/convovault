/**
 * Test script for Cloudflare Browser Rendering API
 *
 * Run with: npx tsx scripts/test-browser-rendering.ts
 *
 * Requires .dev.vars to have CF_ACCOUNT_ID and CF_API_TOKEN set
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .dev.vars
const devVarsPath = resolve(__dirname, '../.dev.vars');
const devVars = readFileSync(devVarsPath, 'utf-8');
const env: Record<string, string> = {};
devVars.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const CF_ACCOUNT_ID = env.CF_ACCOUNT_ID;
const CF_API_TOKEN = env.CF_API_TOKEN;

if (!CF_ACCOUNT_ID || !CF_API_TOKEN || CF_ACCOUNT_ID === 'your-account-id-here') {
  console.error('Please set CF_ACCOUNT_ID and CF_API_TOKEN in .dev.vars');
  process.exit(1);
}

const TEST_URL = 'https://claude.ai/share/ec0a6320-d9ab-4598-b2be-ac5d9d2c24d1';

async function testBrowserRendering() {
  console.log('Testing Browser Rendering API...');
  console.log('URL:', TEST_URL);
  console.log('Account ID:', CF_ACCOUNT_ID.substring(0, 8) + '...');
  console.log('');

  const response = await fetch(
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

  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));
  console.log('');

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response:', errorText);
    return;
  }

  const html = await response.text();

  console.log('HTML length:', html.length);
  console.log('');

  // Check for key markers
  console.log('=== Key Markers ===');
  console.log('Contains data-test-render-count:', html.includes('data-test-render-count'));
  console.log('Contains font-user-message:', html.includes('font-user-message'));
  console.log('Contains data-is-streaming:', html.includes('data-is-streaming'));
  console.log('Contains "Wealth inequality":', html.includes('Wealth inequality'));
  console.log('');

  // Show first 3000 chars
  console.log('=== HTML Preview (first 3000 chars) ===');
  console.log(html.substring(0, 3000));
  console.log('');

  // Try to find message patterns
  console.log('=== Looking for message patterns ===');

  const userMsgMatch = html.match(/font-user-message[^>]*>([^<]{0,100})/);
  if (userMsgMatch) {
    console.log('Found user message pattern:', userMsgMatch[0].substring(0, 200));
  } else {
    console.log('No font-user-message pattern found');
  }

  const streamingMatch = html.match(/data-is-streaming[^>]*>([^<]{0,100})/);
  if (streamingMatch) {
    console.log('Found streaming pattern:', streamingMatch[0].substring(0, 200));
  } else {
    console.log('No data-is-streaming pattern found');
  }

  // Save full HTML to file for inspection
  const outputPath = resolve(__dirname, '../test-output.html');
  writeFileSync(outputPath, html);
  console.log('');
  console.log('Full HTML saved to:', outputPath);
}

testBrowserRendering().catch(console.error);
