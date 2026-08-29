import express from 'express';
import { ChatRequest, ChatResponseData, ServiceResponse } from '../types';
import { AgentConfigError, runAgent } from '../agent/runAgent';

const router = express.Router();

router.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body as ChatRequest;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'message is required and must be a string',
      } as ServiceResponse);
    }

    if (!Array.isArray(history)) {
      return res.status(400).json({
        success: false,
        error: 'history must be an array',
      } as ServiceResponse);
    }

    const { reply, products } = await runAgent(message, history);

    const response: ServiceResponse<ChatResponseData> = {
      success: true,
      data: {
        reply,
        products,
      },
    };

    res.json(response);
  } catch (error) {
    if (error instanceof AgentConfigError) {
      return res.status(503).json({
        success: false,
        error: error.message,
      } as ServiceResponse);
    }

    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: 'Failed to process chat' });
  }
});

export { router as chatRoutes };
