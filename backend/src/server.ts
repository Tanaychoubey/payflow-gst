import dotenv from 'dotenv';
// Load environment variables before importing app
dotenv.config();

import app from './app';
import logger from './config/logger';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`⚡️[server]: PayFlow GST API server is running on http://localhost:${PORT}`);
});

process.on('unhandledRejection', (err: any) => {
  logger.error('Unhandled Rejection! Shutting down...', err);
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err: any) => {
  logger.error('Uncaught Exception! Shutting down...', err);
  server.close(() => {
    process.exit(1);
  });
});
