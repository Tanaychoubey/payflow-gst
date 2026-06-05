import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/db';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.middleware';
import logger from '../config/logger';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string(),
});

const generateTokens = (user: { id: string; email: string; role: string; businessId: string | null }) => {
  const secret = process.env.JWT_SECRET || 'payflow_gst_secret_key_2026_super_secure_principal_level';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'payflow_gst_refresh_secret_key_2026_super_secure_principal_level';
  
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, businessId: user.businessId },
    secret,
    { expiresIn: '1d' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    refreshSecret,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Register
router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'A user with this email already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        passwordHash,
        role: 'owner', // Default register makes owner
      },
    });

    const tokens = generateTokens(user);

    logger.info(`User registered successfully: ${user.email}`);

    return res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          businessId: user.businessId,
        },
        ...tokens,
      },
      message: 'Registration successful.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        data: err.errors,
        message: 'Validation failed.',
      });
    }
    return next(err);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Invalid credentials or inactive account.',
      });
    }

    const isMatch = await bcrypt.compare(body.password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Invalid credentials.',
      });
    }

    const tokens = generateTokens(user);

    logger.info(`User logged in: ${user.email}`);

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          businessId: user.businessId,
        },
        ...tokens,
      },
      message: 'Login successful.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        data: err.errors,
        message: 'Validation failed.',
      });
    }
    return next(err);
  }
});

// Current User info
router.get('/me', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        message: 'Not authenticated.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        businessId: true,
        business: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        message: 'User not found.',
      });
    }

    return res.json({
      success: true,
      data: { user },
      message: 'User details fetched successfully.',
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
