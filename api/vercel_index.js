// /api/vercel_index.js (Round-Robin with REST API & Health Checks)

export const config = {
  runtime: 'edge',
};

export default async function handleRequest(request) {
  // --- 关键的环境变量健壮性检查 ---
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    console.error("Vercel KV environment variables (KV_REST_API_URL, KV_REST_API_TOKEN) are not set.");
    return new Response(JSON.stringify({ error: { message: 'Server configuration error: Vercel KV is not configured.' } }), { status: 500, headers: {'Content-Type': 'application/json'} });
  }
  
  const url = new URL(request.url);
  const pathname = url.pathname;
  const search = url.search;

  if (pathname === '/' || pathname === '/index.html') {
    return new Response('Proxy is Running!');
  }

  const targetUrl = `https.generativelanguage.googleapis.com${pathname}${search}`;

  try {
    // --- Security Checkpoint ---
    const serverAccessKey = process.env.ACCESS_KEY;
    const clientProvidedKey = request.headers.get('x-goog-api-key');

    if (!serverAccessKey || !clientProvidedKey || clientProvidedKey !== serverAccessKey) {
        return new Response(JSON.stringify({ error: { message: 'Unauthorized: Invalid API Key provided.' } }), { status: 401, headers: {'Content-Type': 'application/json'} });
    }
    
    // --- Round-Robin Load Balancing Logic ---
    const serverKeyPool = process.env.GEMINI_API_KEYS;
    if (!serverKeyPool) {
        return new Response(JSON.stringify({ error: { message: 'Server configuration error: Key pool is not set.' } }), { status: 500 });
    }

    const apiKeys = serverKeyPool.split(',').map(k => k.trim()).filter(k => k);
    if (apiKeys.length === 0) {
        return new Response(JSON.stringify({ error: { message: 'Server configuration error: Key pool is empty.' } }), { status: 500 });
    }
    
    const readResponse = await fetch(`${KV_URL}/get/gemini_rr_index`, {
        headers: { 'Authorization': `Bearer ${KV_TOKEN}` }
    });
    const readResult = await readResponse.json();
    let currentIndex = readResult.result ? parseInt(readResult.result, 10) : 0;
    
    // 增加一个额外的边界检查，防止索引越界
    if (currentIndex >= apiKeys.length) {
        currentIndex = 0;
    }

    const selectedKey = apiKeys[currentIndex];
    
    const nextIndex = (currentIndex + 1) % apiKeys.length;

    // fire-and-forget
    fetch(`${KV_URL}/set/gemini_rr_index/${nextIndex}`, {
        headers: { 'Authorization': `Bearer ${KV_TOKEN}` },
        method: 'POST',
    });

    console.log(`Round-Robin: Using key at index ${currentIndex}. Next index will be ${nextIndex}.`);

    // --- 准备向上游发送的请求 ---
    const headers = new Headers();
    headers.set('x-goog-api-key', selectedKey);

    if (request.headers.has('content-type')) {
        headers.set('content-type', request.headers.get('content-type'));
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body
    });

    // ... (response handling)
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('connection');
    responseHeaders.delete('keep-alive');
    responseHeaders.delete('content-encoding');
    responseHeaders.set('Referrer-Policy', 'no-referrer');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
   console.error('Failed to fetch:', error);
   return new Response('Internal Server Error\n' + error?.stack, { status: 500 });
  }
}
