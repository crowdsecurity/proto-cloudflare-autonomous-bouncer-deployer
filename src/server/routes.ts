import { Router, type Request, type Response } from 'express';

const router = Router();

// Note: Zone operations are now handled via WebSocket with session-based state.
// These REST endpoints are kept for backward compatibility but return empty/error responses.

// Get zones - requires WebSocket session, returns empty array for REST
router.get('/zones', async (_req: Request, res: Response) => {
  // Zones are stored in WebSocket sessions, not accessible via REST
  res.json({ zones: [], message: 'Use WebSocket for zone operations' });
});

// Update config with selected zones - requires WebSocket session
router.post('/zones/select', async (_req: Request, res: Response) => {
  // Zone selection is now session-based via WebSocket
  res.status(400).json({
    error: 'Zone selection is now handled via WebSocket. Use the socket connection instead.',
  });
});

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default router;
