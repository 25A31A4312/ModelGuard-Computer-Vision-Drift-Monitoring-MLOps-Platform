import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './server/apiRouter.ts';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// Enable JSON parser with sufficient limit for computer vision image payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Mount API router
app.use('/api', apiRouter);

// In production, serve built frontend assets from dist directory
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

// For SPA client routing, serve index.html for all non-API paths
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      // If dist/index.html does not exist yet (e.g. running in development)
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>ModelGuard Server</title></head>
          <body style="background:#0b0f19;color:#e2e8f0;font-family:sans-serif;padding:40px;">
            <h2>ModelGuard — Computer Vision Drift Monitoring &amp; MLOps Platform</h2>
            <p>API Server is running on port ${PORT}.</p>
            <p>To run the frontend in development mode, run <code>npm run dev</code> or compile the client via <code>npm run build</code>.</p>
          </body>
        </html>
      `);
    }
  });
});

app.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`🛡️  ModelGuard MLOps Platform Server Active`);
  console.log(`📡 Listening on: http://${HOST}:${PORT}`);
  console.log(`🚀 Ready for Cloud Run & Localhost container healthchecks`);
  console.log(`=======================================================`);
});
