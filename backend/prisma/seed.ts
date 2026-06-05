import { PrismaClient, Role, InvoiceStatus, PaymentMethod } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.auditLog.deleteMany({});
  await prisma.reminder.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.business.deleteMany({});

  const passwordHash = await bcrypt.hash('password123', 10);

  // Create Business
  const business = await prisma.business.create({
    data: {
      name: 'Supertronics Electricals',
      gstin: '27AAAAA1111A1Z1',
      address: '102, Industrial Area Phase II, Mumbai, Maharashtra, 400011',
      phone: '9876543210',
      email: 'info@supertronics.com',
      logoUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150&h=150&fit=crop',
    },
  });

  // Create Users
  const owner = await prisma.user.create({
    data: {
      name: 'Rajesh Kumar',
      email: 'rajesh@supertronics.com',
      phone: '9876543211',
      passwordHash,
      role: Role.owner,
      businessId: business.id,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Suresh Sharma',
      email: 'suresh@supertronics.com',
      phone: '9876543212',
      passwordHash,
      role: Role.manager,
      businessId: business.id,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Amit Patel',
      email: 'amit@supertronics.com',
      phone: '9876543213',
      passwordHash,
      role: Role.staff,
      businessId: business.id,
    },
  });

  // Create Customers
  const customer1 = await prisma.customer.create({
    data: {
      name: 'Apex Electrical Distributors',
      email: 'contact@apexelectricals.com',
      phone: '8765432100',
      gstin: '27BBBBB2222B2Z2',
      address: 'G-14, Commercial Plaza, Sector 15, Vashi, Navi Mumbai, 400703',
      businessId: business.id,
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      name: 'Nutan Light House',
      email: 'nutanlights@gmail.com',
      phone: '8765432101',
      gstin: '27CCCCC3333C3Z3',
      address: 'Shop No 4, Market Road, Thane West, Maharashtra, 400601',
      businessId: business.id,
    },
  });

  const customer3 = await prisma.customer.create({
    data: {
      name: 'Sardar Cables & Wires',
      email: 'sales@sardarcables.com',
      phone: '8765432102',
      gstin: '', // unregistered dealer
      address: 'Lamington Road, Grant Road, Mumbai, 400007',
      businessId: business.id,
    },
  });

  // Create Invoices
  // Invoice 1: Paid
  const invoice1 = await prisma.invoice.create({
    data: {
      businessId: business.id,
      customerId: customer1.id,
      invoiceNumber: 'INV-2026-001',
      invoiceDate: new Date('2026-05-01'),
      dueDate: new Date('2026-05-15'),
      subtotal: 10000.00,
      gstAmount: 1800.00,
      discountAmount: 0.00,
      totalAmount: 11800.00,
      status: InvoiceStatus.paid,
      items: {
        create: [
          {
            productName: 'Heavy Duty Copper Wires (100m)',
            quantity: 5,
            unitPrice: 2000.00,
            gstRate: 18.00,
            lineTotal: 11800.00,
          }
        ]
      },
      payments: {
        create: [
          {
            amount: 11800.00,
            paymentMethod: PaymentMethod.bank,
            referenceNo: 'TXN987654321',
            paymentDate: new Date('2026-05-10'),
          }
        ]
      }
    }
  });

  // Invoice 2: Unpaid (Overdue)
  await prisma.invoice.create({
    data: {
      businessId: business.id,
      customerId: customer2.id,
      invoiceNumber: 'INV-2026-002',
      invoiceDate: new Date('2026-05-10'),
      dueDate: new Date('2026-05-24'), // overdue as of June 4, 2026
      subtotal: 25000.00,
      gstAmount: 4500.00,
      discountAmount: 500.00,
      totalAmount: 29000.00,
      status: InvoiceStatus.overdue,
      items: {
        create: [
          {
            productName: 'LED Panel Lights 15W',
            quantity: 50,
            unitPrice: 500.00,
            gstRate: 18.00,
            lineTotal: 29500.00,
          }
        ]
      }
    }
  });

  // Invoice 3: Partial
  await prisma.invoice.create({
    data: {
      businessId: business.id,
      customerId: customer1.id,
      invoiceNumber: 'INV-2026-003',
      invoiceDate: new Date('2026-05-20'),
      dueDate: new Date('2026-06-15'), // outstanding but not overdue
      subtotal: 50000.00,
      gstAmount: 9000.00,
      discountAmount: 1000.00,
      totalAmount: 58000.00,
      status: InvoiceStatus.partial,
      items: {
        create: [
          {
            productName: 'Industrial Distribution Boards',
            quantity: 2,
            unitPrice: 25000.00,
            gstRate: 18.00,
            lineTotal: 59000.00,
          }
        ]
      },
      payments: {
        create: [
          {
            amount: 20000.00,
            paymentMethod: PaymentMethod.upi,
            referenceNo: 'UPI11223344',
            paymentDate: new Date('2026-05-25'),
          }
        ]
      }
    }
  });

  // Invoice 4: Draft
  await prisma.invoice.create({
    data: {
      businessId: business.id,
      customerId: customer3.id,
      invoiceNumber: 'INV-2026-004',
      invoiceDate: new Date('2026-06-02'),
      dueDate: new Date('2026-06-30'),
      subtotal: 8000.00,
      gstAmount: 1440.00,
      discountAmount: 0.00,
      totalAmount: 9440.00,
      status: InvoiceStatus.draft,
      items: {
        create: [
          {
            productName: 'Modular Switches Board Romolo',
            quantity: 20,
            unitPrice: 400.00,
            gstRate: 18.00,
            lineTotal: 9440.00,
          }
        ]
      }
    }
  });

  // Create Audit Logs
  await prisma.auditLog.create({
    data: {
      userId: owner.id,
      entityType: 'invoice',
      entityId: invoice1.id,
      action: 'CREATE',
      metadata: { invoiceNumber: 'INV-2026-001' },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: owner.id,
      entityType: 'payment',
      entityId: invoice1.id,
      action: 'RECORD_PAYMENT',
      metadata: { amount: 11800.00, status: 'paid' },
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
