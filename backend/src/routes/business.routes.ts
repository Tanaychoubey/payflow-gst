import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/db';
import { authenticate, AuthenticatedRequest, requireRole, requireBusiness } from '../middlewares/auth.middleware';
import logger from '../config/logger';

const router = Router();

const businessSetupSchema = z.object({
  name: z.string().min(3, 'Business name must be at least 3 characters'),
  gstin: z.string().length(15, 'GSTIN must be exactly 15 characters'),
  address: z.string().min(5, 'Address is too short'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional(),
  logoUrl: z.string().url('Invalid logo URL').optional().or(z.literal('')),
});

const staffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['owner', 'manager', 'staff']),
});

const generateAccessToken = (user: { id: string; email: string; role: string; businessId: string | null }) => {
  const secret = process.env.JWT_SECRET || 'payflow_gst_secret_key_2026_super_secure_principal_level';
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, businessId: user.businessId },
    secret,
    { expiresIn: '1d' }
  );
};

// Onboarding: Business Setup
router.post('/setup', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, data: null, message: 'Unauthorized.' });
    }

    const body = businessSetupSchema.parse(req.body);

    // Validate unique GSTIN
    const existingBusiness = await prisma.business.findUnique({
      where: { gstin: body.gstin },
    });

    if (existingBusiness) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'A business with this GSTIN is already registered.',
      });
    }

    // Database transaction to create business and assign to user
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: body.name,
          gstin: body.gstin,
          address: body.address,
          phone: body.phone,
          email: body.email,
          logoUrl: body.logoUrl || null,
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: req.user!.id },
        data: {
          businessId: business.id,
          role: 'owner', // The creator becomes the owner
        },
      });

      return { business, updatedUser };
    });

    const accessToken = generateAccessToken(result.updatedUser);

    logger.info(`Business set up successfully: ${result.business.name} by User: ${result.updatedUser.email}`);

    return res.status(201).json({
      success: true,
      data: {
        business: result.business,
        user: {
          id: result.updatedUser.id,
          name: result.updatedUser.name,
          email: result.updatedUser.email,
          role: result.updatedUser.role,
          businessId: result.updatedUser.businessId,
        },
        accessToken,
      },
      message: 'Business onboarded successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: err.errors, message: 'Validation failed.' });
    }
    return next(err);
  }
});

// Get Business Profile
router.get('/profile', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.user!.businessId! },
    });

    if (!business) {
      return res.status(404).json({ success: false, data: null, message: 'Business profile not found.' });
    }

    return res.json({
      success: true,
      data: { business },
      message: 'Business profile fetched successfully.',
    });
  } catch (err) {
    return next(err);
  }
});

// Update Business Profile
router.put('/profile', authenticate, requireBusiness, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = businessSetupSchema.partial().parse(req.body);

    const updatedBusiness = await prisma.business.update({
      where: { id: req.user!.businessId! },
      data: {
        name: body.name,
        address: body.address,
        phone: body.phone,
        email: body.email,
        logoUrl: body.logoUrl !== undefined ? (body.logoUrl || null) : undefined,
      },
    });

    // Note: GSTIN cannot be changed as it is static for tax registration
    logger.info(`Business profile updated for: ${updatedBusiness.name}`);

    return res.json({
      success: true,
      data: { business: updatedBusiness },
      message: 'Business profile updated successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: err.errors, message: 'Validation failed.' });
    }
    return next(err);
  }
});

// Get Team List
router.get('/team', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const team = await prisma.user.findMany({
      where: { businessId: req.user!.businessId! },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({
      success: true,
      data: { team },
      message: 'Team members fetched successfully.',
    });
  } catch (err) {
    return next(err);
  }
});

// Add Team Member (Staff/Manager/Owner)
router.post('/team', authenticate, requireBusiness, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = staffSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'A user with this email is already registered.',
      });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        passwordHash,
        role: body.role,
        businessId: req.user!.businessId!,
      },
    });

    logger.info(`Staff member added: ${newUser.email} under Business: ${req.user!.businessId}`);

    return res.status(201).json({
      success: true,
      data: {
        member: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          isActive: newUser.isActive,
        },
      },
      message: 'Team member added successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: err.errors, message: 'Validation failed.' });
    }
    return next(err);
  }
});

export default router;
