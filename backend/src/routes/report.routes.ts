import { Router } from 'express';
import prisma from '../config/db';
import { authenticate, AuthenticatedRequest, requireBusiness } from '../middlewares/auth.middleware';

const router = Router();

// GET /reports/dashboard
router.get('/dashboard', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const businessId = req.user!.businessId!;
    const today = new Date();

    // Fetch all invoices for the business (excluding drafts from outstanding calculations)
    const invoices = await prisma.invoice.findMany({
      where: { businessId },
      include: {
        payments: {
          select: {
            amount: true,
          },
        },
        customer: {
          select: {
            name: true,
          },
        },
      },
    });

    let totalRevenue = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let overdueCount = 0;

    // Aging buckets
    const aging = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
    };

    invoices.forEach((inv) => {
      const total = Number(inv.totalAmount);
      const paid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const outstanding = total - paid;

      // Revenue is considered from all finalized (non-draft) invoices
      if (inv.status !== 'draft') {
        // Total subtotal + GST is revenue, or payments actually received?
        // Standard accrual accounting: Total invoiced (net of discount) is revenue
        totalRevenue += total;
        totalOutstanding += outstanding;

        // Check if overdue
        const dueDate = new Date(inv.dueDate);
        const isOverdue = inv.status !== 'paid' && dueDate < today;

        if (isOverdue) {
          totalOverdue += outstanding;
          overdueCount += 1;

          // Calculate age of overdue in days
          const diffTime = Math.abs(today.getTime() - dueDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays <= 30) {
            aging['0-30'] += outstanding;
          } else if (diffDays <= 60) {
            aging['31-60'] += outstanding;
          } else if (diffDays <= 90) {
            aging['61-90'] += outstanding;
          } else {
            aging['90+'] += outstanding;
          }
        }
      }
    });

    // Recent activity feed
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        user: {
          businessId,
        },
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    // Top Debtors (customers with most outstanding)
    const customers = await prisma.customer.findMany({
      where: { businessId },
      include: {
        invoices: {
          where: {
            status: { in: ['unpaid', 'partial', 'overdue'] },
          },
          include: {
            payments: { select: { amount: true } },
          },
        },
      },
    });

    const debtorList = customers
      .map((c) => {
        let outstanding = 0;
        c.invoices.forEach((inv) => {
          const total = Number(inv.totalAmount);
          const paid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0);
          outstanding += total - paid;
        });

        return {
          id: c.id,
          name: c.name,
          outstanding,
        };
      })
      .filter((d) => d.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5);

    return res.json({
      success: true,
      data: {
        metrics: {
          totalRevenue,
          totalOutstanding,
          totalOverdue,
          overdueCount,
          invoiceCount: invoices.length,
        },
        aging,
        topDebtors: debtorList,
        recentActivity: auditLogs,
      },
      message: 'Dashboard reports compiled successfully.',
    });
  } catch (err) {
    return next(err);
  }
});

// GET /reports/gst
router.get('/gst', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const businessId = req.user!.businessId!;
    
    // Fetch all invoice items from non-draft invoices
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: {
        invoice: {
          businessId,
          status: { not: 'draft' },
        },
      },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            invoiceDate: true,
          },
        },
      },
    });

    // Group items by GST rate
    const gstSummary: { [rate: string]: { taxableAmount: number; gstCollected: number; itemsCount: number } } = {};

    let totalTaxableSales = 0;
    let totalGstCollected = 0;

    invoiceItems.forEach((item) => {
      const rate = Number(item.gstRate).toFixed(1) + '%';
      const quantity = Number(item.quantity);
      const price = Number(item.unitPrice);
      const taxableValue = quantity * price;
      const gstVal = taxableValue * (Number(item.gstRate) / 100);

      totalTaxableSales += taxableValue;
      totalGstCollected += gstVal;

      if (!gstSummary[rate]) {
        gstSummary[rate] = {
          taxableAmount: 0,
          gstCollected: 0,
          itemsCount: 0,
        };
      }

      gstSummary[rate].taxableAmount += taxableValue;
      gstSummary[rate].gstCollected += gstVal;
      gstSummary[rate].itemsCount += 1;
    });

    return res.json({
      success: true,
      data: {
        totals: {
          totalTaxableSales,
          totalGstCollected,
          totalGrossSales: totalTaxableSales + totalGstCollected,
        },
        gstBreakdown: gstSummary,
      },
      message: 'GST Sales summary report generated.',
    });
  } catch (err) {
    return next(err);
  }
});

// GET /reports/ledger/:customerId
router.get('/ledger/:customerId', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { customerId } = req.params;
    const businessId = req.user!.businessId!;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });

    if (!customer) {
      return res.status(404).json({ success: false, data: null, message: 'Customer not found.' });
    }

    const invoices = await prisma.invoice.findMany({
      where: { customerId, businessId, status: { not: 'draft' } },
      orderBy: { invoiceDate: 'asc' },
    });

    const payments = await prisma.payment.findMany({
      where: {
        invoice: {
          customerId,
          businessId,
        },
      },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
          },
        },
      },
      orderBy: { paymentDate: 'asc' },
    });

    // Merge invoices and payments into a single chronological ledger transaction list
    interface LedgerTransaction {
      date: Date;
      type: 'INVOICE' | 'PAYMENT';
      reference: string;
      debit: number;  // invoice amount increases outstanding
      credit: number; // payment amount decreases outstanding
      runningBalance: number;
    }

    const ledger: LedgerTransaction[] = [];

    invoices.forEach((inv) => {
      ledger.push({
        date: inv.invoiceDate,
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        debit: Number(inv.totalAmount),
        credit: 0,
        runningBalance: 0,
      });
    });

    payments.forEach((p) => {
      ledger.push({
        date: p.paymentDate,
        type: 'PAYMENT',
        reference: `PAY-${p.referenceNo || p.id.substring(0, 8)} (${p.invoice.invoiceNumber})`,
        debit: 0,
        credit: Number(p.amount),
        runningBalance: 0,
      });
    });

    // Sort by date chronologically
    ledger.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate running balance
    let balance = 0;
    const ledgerWithRunningBalance = ledger.map((tx) => {
      balance += tx.debit - tx.credit;
      return {
        ...tx,
        runningBalance: balance,
      };
    });

    return res.json({
      success: true,
      data: {
        customer,
        ledger: ledgerWithRunningBalance,
        totalInvoiced: invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0),
        totalPaid: payments.reduce((sum, p) => sum + Number(p.amount), 0),
        outstandingBalance: balance,
      },
      message: 'Customer ledger statement generated successfully.',
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
