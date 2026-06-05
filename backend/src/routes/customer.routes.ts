import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { authenticate, AuthenticatedRequest, requireBusiness } from '../middlewares/auth.middleware';
import logger from '../config/logger';

const router = Router();

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  gstin: z.string().max(15, 'GSTIN cannot exceed 15 characters').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
});

// List Customers (Searchable)
router.get('/', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { search } = req.query;
    const businessId = req.user!.businessId!;

    const whereClause: any = { businessId };

    if (search) {
      whereClause.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        { gstin: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        invoices: {
          select: {
            totalAmount: true,
            status: true,
            payments: {
              select: {
                amount: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Calculate outstanding balance for each customer
    const customersWithBalances = customers.map((c) => {
      let totalInvoiced = 0;
      let totalPaid = 0;

      c.invoices.forEach((inv) => {
        if (inv.status !== 'draft') {
          const invTotal = Number(inv.totalAmount);
          totalInvoiced += invTotal;
          
          const paidTotal = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0);
          totalPaid += paidTotal;
        }
      });

      const outstandingBalance = totalInvoiced - totalPaid;

      // Exclude full invoices relation details from main list to keep payload light
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { invoices, ...customerData } = c;

      return {
        ...customerData,
        outstandingBalance,
      };
    });

    return res.json({
      success: true,
      data: { customers: customersWithBalances },
      message: 'Customers retrieved successfully.',
    });
  } catch (err) {
    return next(err);
  }
});

// Create Customer
router.post('/', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = customerSchema.parse(req.body);
    const businessId = req.user!.businessId!;

    // Duplicate Check
    const duplicate = await prisma.customer.findFirst({
      where: {
        businessId,
        name: { equals: body.name, mode: 'insensitive' },
      },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `A customer named "${body.name}" already exists for this business.`,
      });
    }

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        phone: body.phone || null,
        email: body.email || null,
        gstin: body.gstin || null,
        address: body.address || null,
        businessId,
      },
    });

    logger.info(`Customer created: ${customer.name} under Business: ${businessId}`);

    return res.status(201).json({
      success: true,
      data: { customer },
      message: 'Customer created successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: err.errors, message: 'Validation failed.' });
    }
    return next(err);
  }
});

// Get Single Customer details + Ledger/Invoices
router.get('/:id', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.businessId!;

    const customer = await prisma.customer.findFirst({
      where: { id, businessId },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: {
            payments: true,
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ success: false, data: null, message: 'Customer not found.' });
    }

    // Calculate outstanding
    let totalInvoiced = 0;
    let totalPaid = 0;
    customer.invoices.forEach((inv) => {
      if (inv.status !== 'draft') {
        totalInvoiced += Number(inv.totalAmount);
        totalPaid += inv.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      }
    });

    const outstandingBalance = totalInvoiced - totalPaid;

    return res.json({
      success: true,
      data: {
        customer: {
          ...customer,
          outstandingBalance,
        },
      },
      message: 'Customer details retrieved successfully.',
    });
  } catch (err) {
    return next(err);
  }
});

// Update Customer
router.put('/:id', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.businessId!;
    const body = customerSchema.parse(req.body);

    const customer = await prisma.customer.findFirst({
      where: { id, businessId },
    });

    if (!customer) {
      return res.status(404).json({ success: false, data: null, message: 'Customer not found.' });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        name: body.name,
        phone: body.phone || null,
        email: body.email || null,
        gstin: body.gstin || null,
        address: body.address || null,
      },
    });

    logger.info(`Customer updated: ${updatedCustomer.name}`);

    return res.json({
      success: true,
      data: { customer: updatedCustomer },
      message: 'Customer updated successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: err.errors, message: 'Validation failed.' });
    }
    return next(err);
  }
});

export default router;
