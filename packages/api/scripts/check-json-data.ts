/**
 * Check if Claude share pages have embedded JSON data we could use
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
        url: 'https://claude.ai/share/ec0a6320-d9ab-4598-b2be-ac5d9d2c24d1',
        gotoOptions: { waitUntil: 'networkidle0' },
      }),
    }
  );

  const json = await resp.json() as { success: boolean; result: string };
  const html = json.result;

  console.log('HTML length:', html.length);
  console.log('');

  // Look for __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    console.log('=== Found __NEXT_DATA__! ===');
    console.log('Length:', nextDataMatch[1].length);
    try {
      const data = JSON.parse(nextDataMatch[1]);
      console.log('Top-level keys:', Object.keys(data));
      if (data.props?.pageProps) {
        console.log('pageProps keys:', Object.keys(data.props.pageProps));
      }
    } catch (e) {
      console.log('Failed to parse:', e);
    }
  } else {
    console.log('No __NEXT_DATA__ found');
  }

  // Look for RSC payload (self.__next_f.push)
  const rscMatches = html.match(/self\.__next_f\.push\(\[[\d,]+,"([^"]+)"/g);
  if (rscMatches) {
    console.log('\n=== Found RSC Payload (self.__next_f.push) ===');
    console.log('Number of chunks:', rscMatches.length);

    // Try to find chat/message data in the RSC payload
    const fullRsc = rscMatches.join('\n');
    console.log('Contains "chat_messages":', fullRsc.includes('chat_messages'));
    console.log('Contains "messages":', fullRsc.includes('messages'));
    console.log('Contains "content":', fullRsc.includes('content'));
    console.log('Contains "user":', fullRsc.includes('user'));
    console.log('Contains "assistant":', fullRsc.includes('assistant'));

    // Show a sample
    console.log('\nFirst RSC chunk (first 500 chars):');
    console.log(rscMatches[0]?.substring(0, 500));
  } else {
    console.log('\nNo RSC payload found');
  }

  // Check for any JSON-like structures with message data
  console.log('\n=== Searching for message patterns ===');

  // Look for something like "role":"user" or "role":"assistant"
  const roleMatches = html.match(/"role"\s*:\s*"(user|assistant)"/g);
  if (roleMatches) {
    console.log('Found role patterns:', roleMatches.length, 'occurrences');
    console.log('Sample:', roleMatches.slice(0, 5));
  }

  // Look for chat_messages array
  const chatMsgMatch = html.match(/chat_messages["\s:[\]]*\[/);
  if (chatMsgMatch) {
    console.log('\nFound chat_messages pattern!');
    const idx = html.indexOf('chat_messages');
    console.log('Context:', html.substring(idx, idx + 200));
  }
}

main().catch(console.error);
