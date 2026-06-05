import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { authenticate, AuthenticatedRequest, requireBusiness } from '../middlewares/auth.middleware';
import logger from '../config/logger';

const router = Router();

const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentMethod: z.enum(['cash', 'upi', 'bank', 'cheque']),
  referenceNo: z.string().optional().or(z.literal('')),
  paymentDate: z.string().transform((str) => new Date(str)),
});

// Record Payment
router.post('/', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const businessId = req.user!.businessId!;
    const body = recordPaymentSchema.parse(req.body);

    // Verify Invoice exists and belongs to the business
    const invoice = await prisma.invoice.findFirst({
      where: { id: body.invoiceId, businessId },
      include: {
        payments: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, data: null, message: 'Invoice not found.' });
    }

    const totalInvoiceAmount = Number(invoice.totalAmount);
    const existingPaymentsTotal = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remainingBalance = totalInvoiceAmount - existingPaymentsTotal;

    // Validation: payment cannot exceed outstanding balance
    // Allowing a very tiny floating point leeway (e.g. 0.01) for safety
    if (body.amount > remainingBalance + 0.01) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Payment amount (₹${body.amount.toFixed(2)}) exceeds the remaining outstanding balance of ₹${remainingBalance.toFixed(2)}.`,
      });
    }

    // Perform database transaction to record payment and update invoice status
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: body.invoiceId,
          amount: body.amount,
          paymentMethod: body.paymentMethod,
          referenceNo: body.referenceNo || null,
          paymentDate: body.paymentDate,
        },
      });

      // Calculate new total paid
      const newPaidTotal = existingPaymentsTotal + body.amount;
      
      let newStatus: 'paid' | 'partial' = 'partial';
      if (Math.abs(newPaidTotal - totalInvoiceAmount) < 0.05) {
        newStatus = 'paid';
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: body.invoiceId },
        data: {
          status: newStatus,
        },
      });

      return { payment, updatedInvoice };
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        entityType: 'payment',
        entityId: result.payment.id,
        action: 'RECORD_PAYMENT',
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: body.amount,
          newStatus: result.updatedInvoice.status,
        },
      },
    });

    logger.info(`Payment of ₹${body.amount} recorded for Invoice: ${invoice.invoiceNumber}. New Status: ${result.updatedInvoice.status}`);

    return res.status(201).json({
      success: true,
      data: {
        payment: result.payment,
        invoice: {
          id: result.updatedInvoice.id,
          invoiceNumber: result.updatedInvoice.invoiceNumber,
          status: result.updatedInvoice.status,
        },
      },
      message: 'Payment recorded successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: err.errors, message: 'Validation failed.' });
    }
    return next(err);
  }
});

// Get Payment History
router.get('/', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const businessId = req.user!.businessId!;

    const payments = await prisma.payment.findMany({
      where: {
        invoice: {
          businessId,
        },
      },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            totalAmount: true,
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: { payments },
      message: 'Payment history retrieved successfully.',
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
