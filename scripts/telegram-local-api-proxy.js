#!/usr/bin/env node

const http = require('http');

const host = process.env.TELEGRAM_PROXY_HOST || '127.0.0.1';
const port = Number(process.env.TELEGRAM_PROXY_PORT || '8081');
const upstream = 'https://api.telegram.org';

function pickHeaders(input) {
  const output = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (key.toLowerCase() === 'host') continue;
    if (typeof value === 'string') {
      output[key] = value;
    } else if (Array.isArray(value)) {
      output[key] = value.join(', ');
    }
  }
  return output;
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || req.url === '/' || req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, mode: 'proxy', upstream }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    const upstreamResponse = await fetch(`${upstream}${req.url}`, {
      method: req.method || 'GET',
      headers: pickHeaders(req.headers),
      body: body && body.length > 0 ? body : undefined,
    });

    const responseHeaders = {};
    upstreamResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return;
      responseHeaders[key] = value;
    });
    res.writeHead(upstreamResponse.status, responseHeaders);

    const data = Buffer.from(await upstreamResponse.arrayBuffer());
    res.end(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy failure';
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
  }
});

server.listen(port, host, () => {
  process.stdout.write(
    `[telegram-local-api-proxy] listening on http://${host}:${port}, upstream=${upstream}\n`
  );
});
