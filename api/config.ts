import type { IncomingMessage, ServerResponse } from 'node:http';
import { getConfiguredWhatsAppNumber } from '../server/apiHandlers.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method && req.method !== 'GET') {
    res.statusCode = 405;
    res.end(JSON.stringify({ code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }));
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ whatsappNumber: getConfiguredWhatsAppNumber() }));
}
