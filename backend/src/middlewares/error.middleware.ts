import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export interface CustomError extends Error {
  statusCode?: number;
  details?: any;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  logger.error(`Error: ${message}`, {
    method: req.method,
    url: req.originalUrl,
    status: statusCode,
    stack: err.stack,
    details: err.details,
  });

  return res.status(statusCode).json({
    success: false,
    data: err.details || null,
    message,
  });
};
