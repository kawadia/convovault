/**
 * Test the parser against Browser Rendering output
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the parser
import { claudeWebParser } from '../src/parsers/claude-web.js';

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
// Test URLs - can override with command line arg
const TEST_URLS = [
  'https://claude.ai/share/c0d98864-5724-49a0-8df9-10e74bd3b415',
  'https://claude.ai/share/271f5aec-5ba4-4385-9ac6-cceaaa45b9f7',
];
const TEST_URL = process.argv[2] || TEST_URLS[0];

async function main() {
  console.log('Fetching page via Browser Rendering API...\n');

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
  const html = json.result;

  console.log('HTML length:', html.length);

  // Save HTML for inspection
  const outputPath = resolve(__dirname, '../test-output.html');
  writeFileSync(outputPath, html);
  console.log('HTML saved to:', outputPath);
  console.log('');

  // Check for key markers
  console.log('=== Key Markers ===');
  console.log('Contains data-test-render-count:', html.includes('data-test-render-count'));
  console.log('Contains font-user-message:', html.includes('font-user-message'));
  console.log('Contains data-is-streaming:', html.includes('data-is-streaming'));
  console.log('');

  // Test the parser
  console.log('=== Running Parser ===');
  const result = claudeWebParser.parse(html, TEST_URL);

  console.log('Title:', result.title);
  console.log('Message count:', result.messageCount);
  console.log('Word count:', result.wordCount);
  console.log('');

  console.log('=== Messages ===');
  result.messages.forEach((msg, i) => {
    const preview = msg.content[0]?.content.substring(0, 100) || '';
    console.log(`[${i}] ${msg.role}: ${preview}...`);
  });
  console.log('');

  // Count by role
  const userCount = result.messages.filter(m => m.role === 'user').length;
  const assistantCount = result.messages.filter(m => m.role === 'assistant').length;
  console.log(`User messages: ${userCount}`);
  console.log(`Assistant messages: ${assistantCount}`);

  // Look at assistant message patterns in HTML
  console.log('\n=== Debugging Assistant Message Detection ===');

  // Check the pattern we're looking for
  const assistantPattern = /<div[^>]*class="group relative pb-3"[^>]*data-is-streaming[^>]*>/gi;
  const assistantMatches = html.match(assistantPattern);
  console.log('Matches for "group relative pb-3" + data-is-streaming:', assistantMatches?.length || 0);

  // Try alternate pattern - data-is-streaming first
  const altPattern = /<div[^>]*data-is-streaming[^>]*class="[^"]*group[^"]*"[^>]*>/gi;
  const altMatches = html.match(altPattern);
  console.log('Matches for data-is-streaming + group class:', altMatches?.length || 0);

  // What does data-is-streaming actually look like?
  const streamingTags = html.match(/<div[^>]*data-is-streaming[^>]*>/gi);
  console.log('\nTotal data-is-streaming divs:', streamingTags?.length || 0);
  if (streamingTags && streamingTags.length > 0) {
    console.log('First 3 data-is-streaming tags:');
    streamingTags.slice(0, 3).forEach((tag, i) => {
      console.log(`  [${i}]: ${tag.substring(0, 200)}`);
    });
  }

  // What's the actual class on streaming elements?
  const streamingWithClass = html.match(/<div[^>]*data-is-streaming="false"[^>]*class="([^"]*)"/gi);
  console.log('\nStreaming elements with class attr:', streamingWithClass?.length || 0);
  if (streamingWithClass) {
    console.log('Sample classes:');
    streamingWithClass.slice(0, 3).forEach((match, i) => {
      const classMatch = match.match(/class="([^"]*)"/);
      console.log(`  [${i}]: ${classMatch?.[1]}`);
    });
  }
}

main().catch(console.error);
