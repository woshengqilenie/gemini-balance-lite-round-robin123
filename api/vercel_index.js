// /api/vercel_index.js (Final Round-Robin with Corrected REST API & Health Checks)

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
    
    // 1. 通过 fetch 从 KV 读取当前索引
    const readResponse = await fetch(`${KV_URL}/get/gemini_rr_index`, {
        headers: { 'Authorization': `Bearer ${KV_TOKEN}` }
    });
    
    if (!readResponse.ok) {
        const errorText = await readResponse.text();
        console.error("Failed to read from KV:", errorText);
        // 如果读取失败，我们可以默认从 0 开始，而不是中断服务
    }

    const readResult = await readResponse.json();
    let currentIndex = readResult.result ? parseInt(readResult.result, 10) : 0;
    
    // 增加一个额外的边界检查，防止因密钥池缩减导致索引越界
    if (isNaN(currentIndex) || currentIndex >= apiKeys.length) {
        currentIndex = 0;
    }

    const selectedKey = apiKeys[currentIndex];
    
    const nextIndex = (currentIndex + 1) % apiKeys.length;

    // 2. 【最终修复】通过 fetch 将下一个索引写回 KV
    // Upstash REST API 的 SET 命令格式为: /set/[key]/[value]
    // 它使用 GET 或 POST 方法都可以工作
    const writePromise = fetch(`${KV_URL}/set/gemini_rr_index/${nextIndex}`, {
        method: 'POST', // 使用 POST 更符合 RESTful 规范
        headers: { 
            'Authorization': `Bearer ${KV_TOKEN}`
        }
    });

    // 为了不阻塞主流程（降低延迟），我们不 await 它，但在后台处理它的错误
    writePromise.catch(err => console.error("Error writing to KV:", err));

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
