import { Response, NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
    businessId: string | null;
  };
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      data: null,
      message: 'Access denied. No token provided.',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'payflow_gst_secret_key_2026_super_secure_principal_level';
    const decoded = jwt.verify(token, secret) as {
      id: string;
      email: string;
      role: Role;
      businessId: string | null;
    };
    
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      data: null,
      message: 'Invalid or expired token.',
    });
  }
};

export const requireRole = (roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Unauthorized. Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        data: null,
        message: 'Forbidden. Insufficient permissions.',
      });
    }

    return next();
  };
};

export const requireBusiness = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      data: null,
      message: 'Unauthorized. Authentication required.',
    });
  }

  if (!req.user.businessId) {
    return res.status(400).json({
      success: false,
      data: null,
      message: 'Onboarding required. Business profile not set up.',
    });
  }

  return next();
};
