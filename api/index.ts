import type { Request, Response } from 'express';
import { createApiApp } from '../serverApp';

const app = createApiApp();

export default function handler(req: Request, res: Response) {
  const rawUrl = req.url || '/';
  const parsed = new URL(rawUrl, 'http://localhost');
  const rewrittenPath = parsed.searchParams.get('__vercel_path');
  if (rewrittenPath !== null) {
    parsed.searchParams.delete('__vercel_path');
    const qs = parsed.searchParams.toString();
    req.url = `/api/${rewrittenPath.replace(/^\/+/, '')}${qs ? `?${qs}` : ''}`;
  }
  return app(req, res);
}
