import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import { serverConfig } from './config.js';
import routes from './routes.js';
import {
  cloudflareService,
  type ProgressCallback,
} from './services/cloudflare/index.js';
import { sessionManager } from './services/session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: serverConfig.isDev ? 'http://localhost:5173' : false,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', routes);

// Serve static files in production
if (!serverConfig.isDev) {
  const clientPath = path.join(__dirname, '../client');
  app.use(express.static(clientPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// WebSocket handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  const sendOutput: ProgressCallback = (output) => {
    socket.emit('command-output', output);
  };

  // Generate config / discover zones from Cloudflare token
  socket.on(
    'generate-config',
    async (data: {
      cloudflareToken: string;
      crowdsecLapiUrl: string;
      crowdsecLapiKey: string;
    }) => {
      console.log('Discovering zones...');
      console.log('crowdsecLapiUrl:', data.crowdsecLapiUrl);
      console.log(
        'crowdsecLapiKey:',
        data.crowdsecLapiKey ? '[REDACTED]' : 'EMPTY'
      );

      try {
        const zones = await cloudflareService.discoverAndStoreZones(
          socket.id,
          data.cloudflareToken,
          data.crowdsecLapiUrl,
          data.crowdsecLapiKey,
          sendOutput
        );

        // Send exit event to signal completion
        sendOutput({ type: 'exit', data: '', code: 0 });

        // Also emit zones-loaded for the frontend to show zone selection
        socket.emit('zones-loaded', { zones });
      } catch (error) {
        sendOutput({ type: 'error', data: String(error) });
        sendOutput({ type: 'exit', data: '', code: 1 });
      }
    }
  );

  // Get zones from session
  socket.on('get-zones', async () => {
    try {
      const zones = cloudflareService.getZones(socket.id);
      socket.emit('zones-loaded', { zones });
    } catch (error) {
      socket.emit('zones-error', { error: String(error) });
    }
  });

  // Update selected zones in session
  socket.on('update-zones', async (data: { selectedZoneIds: string[] }) => {
    try {
      cloudflareService.updateSelectedZones(socket.id, data.selectedZoneIds);
      socket.emit('zones-updated', { success: true });
    } catch (error) {
      socket.emit('zones-error', { error: String(error) });
    }
  });

  // Deploy in autonomous mode
  socket.on(
    'deploy',
    async () => {
      console.log('Deploying autonomous bouncer...');
      try {
        await cloudflareService.deploy(socket.id, sendOutput);
        // Send exit event on success
        sendOutput({ type: 'exit', data: '', code: 0 });
      } catch (error) {
        sendOutput({ type: 'error', data: String(error) });
        sendOutput({ type: 'exit', data: '', code: 1 });
      }
    }
  );

  // Clear infrastructure
  socket.on('clear', async (data: { cloudflareToken: string }) => {
    console.log('Clearing infrastructure...');
    try {
      await cloudflareService.clear(socket.id, data.cloudflareToken, sendOutput);
      // Send exit event on success
      sendOutput({ type: 'exit', data: '', code: 0 });
    } catch (error) {
      sendOutput({ type: 'error', data: String(error) });
      sendOutput({ type: 'exit', data: '', code: 1 });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Clean up session on disconnect
    sessionManager.delete(socket.id);
  });
});

// Start server - bind to 0.0.0.0 for external access (e.g., KillerCoda)
const host = process.env.HOST || '0.0.0.0';
httpServer.listen(serverConfig.port, host, () => {
  console.log(`Server running on http://${host}:${serverConfig.port}`);
});
