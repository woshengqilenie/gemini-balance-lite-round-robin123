// /api/vercel_index.js (Final Body Clone Fix)

export const config = {
  runtime: 'edge',
};

export default async function handleRequest(request) {
  // --- 【最终修复】在所有操作之前，先克隆请求对象 ---
  const clonedRequest = request.clone();

  // --- 关键的环境变量健壮性检查 ---
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    console.error("Vercel KV environment variables are not set.");
    return new Response(JSON.stringify({ error: { message: 'Server configuration error: Vercel KV is not configured.' } }), { status: 500, headers: {'Content-Type': 'application/json'} });
  }
  
  const url = new URL(request.url);
  const pathname = url.pathname;
  const search = url.search;

  if (pathname === '/' || pathname === '/index.html') {
    return new Response('Proxy is Running!');
  }

  const targetUrl = `https://generativelanguage.googleapis.com${pathname}${search}`;

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
        return new Response(JSON.stringify({ error: { message: 'Server configuration error: Key pool is not set.' } }), { status: 500, headers: {'Content-Type': 'application/json'} });
    }

    const apiKeys = serverKeyPool.split(',').map(k => k.trim()).filter(k => k);
    if (apiKeys.length === 0) {
        return new Response(JSON.stringify({ error: { message: 'Server configuration error: Key pool is empty.' } }), { status: 500, headers: {'Content-Type': 'application/json'} });
    }
    
    const readResponse = await fetch(`${KV_URL}/get/gemini_rr_index`, {
        headers: { 'Authorization': `Bearer ${KV_TOKEN}` }
    });
    
    const readResult = await readResponse.json();
    let currentIndex = readResult.result ? parseInt(readResult.result, 10) : 0;
    
    if (isNaN(currentIndex) || currentIndex >= apiKeys.length) {
        currentIndex = 0;
    }

    const selectedKey = apiKeys[currentIndex];
    
    const nextIndex = (currentIndex + 1) % apiKeys.length;

    const writePromise = fetch(`${KV_URL}/set/gemini_rr_index/${nextIndex}`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${KV_TOKEN}`
        }
    });

    writePromise.catch(err => console.error("Error writing to KV:", err));

    console.log(`Round-Robin: Using key at index ${currentIndex}. Next index will be ${nextIndex}.`);

    // --- 准备向上游发送的请求 ---
    const headers = new Headers();
    headers.set('x-goog-api-key', selectedKey);

    if (clonedRequest.headers.has('content-type')) {
        headers.set('content-type', clonedRequest.headers.get('content-type'));
    }

    const response = await fetch(targetUrl, {
      // 【最终修复】使用克隆后的请求对象
      method: clonedRequest.method,
      headers: headers,
      body: clonedRequest.body
    });

    // --- 清理并返回响应 ---
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
   return new Response('Internal Server Error\n' + error?.stack, { status: 500, headers: {'Content-Type': 'text/plain'} });
  }
}
