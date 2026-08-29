import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import { chatRoutes } from './routes/chat';
import { metricsMiddleware, setupMetrics } from './metrics';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../../../.env') });

const app = express();
const PORT = process.env.PORT || 3008;

app.use(helmet());
app.use(cors());
app.use(express.json());

setupMetrics(app, { serviceName: 'ai-agent', serviceVersion: '1.0.0' });

app.use(metricsMiddleware);

app.use('', chatRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const startServer = async () => {
  try {
    app.listen(PORT, () => {
      console.log(`AI agent service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start AI agent service:', error);
    process.exit(1);
  }
};

startServer();
