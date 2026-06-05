import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { authenticate, AuthenticatedRequest, requireBusiness } from '../middlewares/auth.middleware';
import logger from '../config/logger';

const router = Router();

const invoiceItemSchema = z.object({
  productName: z.string().min(1, 'Product name is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  gstRate: z.number().nonnegative('GST rate cannot be negative'),
});

const invoiceCreateSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  invoiceDate: z.string().transform((str) => new Date(str)),
  dueDate: z.string().transform((str) => new Date(str)),
  discountAmount: z.number().nonnegative('Discount cannot be negative').default(0),
  status: z.enum(['draft', 'unpaid']).default('unpaid'),
  items: z.array(invoiceItemSchema).min(1, 'Invoice must contain at least one item'),
});

// List Invoices
router.get('/', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const businessId = req.user!.businessId!;
    const { status, customerId } = req.query;

    const whereClause: any = { businessId };

    if (status) {
      whereClause.status = status;
    }
    if (customerId) {
      whereClause.customerId = customerId;
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            name: true,
            email: true,
            gstin: true,
          },
        },
        payments: {
          select: {
            amount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const invoicesWithOutstanding = invoices.map((inv) => {
      const total = Number(inv.totalAmount);
      const paid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const outstanding = total - paid;
      return {
        ...inv,
        paidAmount: paid,
        outstandingAmount: outstanding,
      };
    });

    return res.json({
      success: true,
      data: { invoices: invoicesWithOutstanding },
      message: 'Invoices retrieved successfully.',
    });
  } catch (err) {
    return next(err);
  }
});

// Create Invoice (With automated running invoice numbering and GST calculation)
router.post('/', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const businessId = req.user!.businessId!;
    const body = invoiceCreateSchema.parse(req.body);

    // Verify Customer exists
    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, businessId },
    });

    if (!customer) {
      return res.status(404).json({ success: false, data: null, message: 'Customer not found.' });
    }

    // Generate Invoice Number: INV-YYYY-MM-[SEQ]
    const year = new Date().getFullYear();
    const invoiceCount = await prisma.invoice.count({
      where: { businessId },
    });
    
    // Formatting running sequence as 4 digit string: 0001, 0002, etc.
    const seq = String(invoiceCount + 1).padStart(4, '0');
    const invoiceNumber = `INV-${year}-${seq}`;

    // Perform GST Calculations
    let subtotal = 0;
    let gstAmount = 0;

    const itemsData = body.items.map((item) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemGst = itemSubtotal * (item.gstRate / 100);
      const itemLineTotal = itemSubtotal + itemGst;

      subtotal += itemSubtotal;
      gstAmount += itemGst;

      return {
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        lineTotal: itemLineTotal,
      };
    });

    const totalAmount = subtotal + gstAmount - body.discountAmount;

    // Database transaction to create Invoice and Items
    const invoice = await prisma.$transaction(async (tx) => {
      return await tx.invoice.create({
        data: {
          businessId,
          customerId: body.customerId,
          invoiceNumber,
          invoiceDate: body.invoiceDate,
          dueDate: body.dueDate,
          subtotal,
          gstAmount,
          discountAmount: body.discountAmount,
          totalAmount,
          status: body.status,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        entityType: 'invoice',
        entityId: invoice.id,
        action: 'CREATE',
        metadata: { invoiceNumber: invoice.invoiceNumber, totalAmount: invoice.totalAmount },
      },
    });

    logger.info(`Invoice created: ${invoice.invoiceNumber} for Customer: ${customer.name}`);

    return res.status(201).json({
      success: true,
      data: { invoice },
      message: 'Invoice generated successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: err.errors, message: 'Validation failed.' });
    }
    return next(err);
  }
});

// Get Single Invoice Details
router.get('/:id', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.businessId!;

    const invoice = await prisma.invoice.findFirst({
      where: { id, businessId },
      include: {
        items: true,
        customer: true,
        payments: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, data: null, message: 'Invoice not found.' });
    }

    const total = Number(invoice.totalAmount);
    const paid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = total - paid;

    return res.json({
      success: true,
      data: {
        invoice: {
          ...invoice,
          paidAmount: paid,
          outstandingAmount: outstanding,
        },
      },
      message: 'Invoice fetched successfully.',
    });
  } catch (err) {
    return next(err);
  }
});

// Update Invoice Status (e.g. Cancelled / Draft to Unpaid)
router.put('/:id/status', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.businessId!;
    const statusSchema = z.object({ status: z.enum(['draft', 'unpaid', 'paid', 'partial', 'overdue']) });
    const { status } = statusSchema.parse(req.body);

    const invoice = await prisma.invoice.findFirst({
      where: { id, businessId },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, data: null, message: 'Invoice not found.' });
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: { status },
    });

    return res.json({
      success: true,
      data: { invoice: updatedInvoice },
      message: 'Invoice status updated successfully.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: err.errors, message: 'Validation failed.' });
    }
    return next(err);
  }
});

// Mock Invoice PDF Download Link / Base64 Content
router.get('/:id/pdf', authenticate, requireBusiness, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.businessId!;

    const invoice = await prisma.invoice.findFirst({
      where: { id, businessId },
      include: {
        items: true,
        customer: true,
        business: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, data: null, message: 'Invoice not found.' });
    }

    // In a real application, we would use pdfkit or another library.
    // For MVP efficiency and reliability, we generate a mock base64 of an HTML print-ready file
    // that the client can easily trigger a browser print/download for.
    const pdfHtml = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #ddd; padding-bottom: 20px; }
            .logo { font-size: 24px; font-weight: bold; color: #10b981; }
            .title { font-size: 28px; text-align: right; }
            .details { margin: 20px 0; display: flex; justify-content: space-between; }
            .details div { width: 45%; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            th { background-color: #f3f4f6; text-align: left; padding: 10px; border-bottom: 2px solid #ddd; }
            td { padding: 10px; border-bottom: 1px solid #eee; }
            .total-section { margin-top: 30px; text-align: right; font-size: 16px; line-height: 1.6; }
            .highlight { font-size: 20px; font-weight: bold; color: #111827; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">${invoice.business.name}</div>
              <p>GSTIN: ${invoice.business.gstin}<br>Email: ${invoice.business.email || 'N/A'}<br>${invoice.business.address || ''}</p>
            </div>
            <div class="title">
              TAX INVOICE
              <p style="font-size: 14px; color: #666; margin-top: 5px;">Invoice No: ${invoice.invoiceNumber}<br>Date: ${invoice.invoiceDate.toISOString().split('T')[0]}<br>Due: ${invoice.dueDate.toISOString().split('T')[0]}</p>
            </div>
          </div>
          
          <div class="details">
            <div>
              <h3>Bill To:</h3>
              <p><strong>${invoice.customer.name}</strong><br>
              GSTIN: ${invoice.customer.gstin || 'Unregistered'}<br>
              Phone: ${invoice.customer.phone || 'N/A'}<br>
              ${invoice.customer.address || ''}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Details</th>
                <th>Qty</th>
                <th>Unit Price (INR)</th>
                <th>GST Rate</th>
                <th>Total (INR)</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map(item => `
                <tr>
                  <td>${item.productName}</td>
                  <td>${item.quantity}</td>
                  <td>${Number(item.unitPrice).toFixed(2)}</td>
                  <td>${Number(item.gstRate)}%</td>
                  <td>${Number(item.lineTotal).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total-section">
            <p>Subtotal: ₹${Number(invoice.subtotal).toFixed(2)}</p>
            <p>GST Tax: ₹${Number(invoice.gstAmount).toFixed(2)}</p>
            ${Number(invoice.discountAmount) > 0 ? `<p>Discount: -₹${Number(invoice.discountAmount).toFixed(2)}</p>` : ''}
            <p class="highlight">Total Amount: ₹${Number(invoice.totalAmount).toFixed(2)}</p>
          </div>
        </body>
      </html>
    `;

    const base64Html = Buffer.from(pdfHtml).toString('base64');

    return res.json({
      success: true,
      data: {
        pdfBase64: base64Html,
        fileName: `${invoice.invoiceNumber}.pdf`,
      },
      message: 'PDF generated successfully.',
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
