// /api/vercel_index.js (Round-Robin Final Version)
import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

export default async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const search = url.search;

  if (pathname === '/' || pathname === '/index.html') {
    return new Response('Proxy is Running!');
  }

  const targetUrl = `https://generativelanguage.googleapis.com${pathname}${search}`;

  try {
    // --- Security Checkpoint (保持不变) ---
    const serverAccessKey = process.env.ACCESS_KEY;
    const clientProvidedKey = request.headers.get('x-goog-api-key');

    if (!serverAccessKey || !clientProvidedKey || clientProvidedKey !== serverAccessKey) {
        return new Response(JSON.stringify({ error: { message: 'Unauthorized: Invalid API Key provided.' } }), { status: 401, headers: {'Content-Type': 'application/json'} });
    }
    
    // --- Round-Robin Load Balancing Logic (全新升级) ---
    const serverKeyPool = process.env.GEMINI_API_KEYS;
    if (!serverKeyPool) {
        return new Response(JSON.stringify({ error: { message: 'Server configuration error: Key pool is not set.' } }), { status: 500, headers: {'Content-Type': 'application/json'} });
    }

    const apiKeys = serverKeyPool.split(',').map(k => k.trim()).filter(k => k);
    if (apiKeys.length === 0) {
        return new Response(JSON.stringify({ error: { message: 'Server configuration error: Key pool is empty.' } }), { status: 500, headers: {'Content-Type': 'application/json'} });
    }

    // 1. 从 Vercel KV "记事本" 中读取上一次的索引
    // 我们使用 'gemini_rr_index' 作为键名，以确保唯一性
    let currentIndex = await kv.get('gemini_rr_index') || 0;
    
    // 2. 从密钥池中取出当前要使用的密钥
    const selectedKey = apiKeys[currentIndex];
    
    // 3. 计算下一次应该使用的索引 (如果到底了，就回到开头)
    const nextIndex = (currentIndex + 1) % apiKeys.length;

    // 4. 将下一次的索引，写回到 Vercel KV "记事本" 中，为下一个请求做准备
    await kv.set('gemini_rr_index', nextIndex);

    // 5. [用于验证] 在日志中打印出本次和下次的索引
    console.log(`Round-Robin: Using key at index ${currentIndex}. Next index will be ${nextIndex}.`);

    // --- 准备向上游发送的请求 (保持不变) ---
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

    const responseHeaders = new Headers(response.headers);
    // 清理 response headers 的代码保持不变...
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
