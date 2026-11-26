import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { createApiApp, isSupabaseMode } from './serverApp.ts';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = createApiApp();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `SMK Prima Unggul Attendance Server listening on http://localhost:${PORT} (mode: ${
        isSupabaseMode ? 'supabase' : 'local-sqlite'
      })`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
