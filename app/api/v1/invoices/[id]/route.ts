import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoice, invoiceLine, paymentAllocation } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, notFound } from "@/lib/api/response";
import { logAudit, diffChanges } from "@/lib/api/audit";
import { notDeleted, softDelete } from "@/lib/db/soft-delete";
import { assertNotLocked } from "@/lib/api/period-lock";
import { decimalToCents } from "@/lib/money";
import { calcTax, preloadTaxRates } from "@/lib/api/tax-calculator";
import { z } from "zod";

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().default(1),
  unitPrice: z.number().default(0),
  accountId: z.string().nullable().optional(),
  taxRateId: z.string().nullable().optional(),
  discountPercent: z.number().int().min(0).max(10000).default(0),
});

const updateSchema = z.object({
  issueDate: z.string().min(1),
  dueDate: z.string().min(1),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(lineSchema).min(1),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);

    const found = await db.query.invoice.findFirst({
      where: and(
        eq(invoice.id, id),
        eq(invoice.organizationId, ctx.organizationId),
        notDeleted(invoice.deletedAt)
      ),
      with: {
        contact: true,
        lines: {
          with: { account: true, taxRate: true },
        },
      },
    });

    if (!found) return notFound("Invoice");

    // Fetch payments allocated to this invoice
    const allocations = await db.query.paymentAllocation.findMany({
      where: and(
        eq(paymentAllocation.documentType, "invoice"),
        eq(paymentAllocation.documentId, id)
      ),
      with: { payment: true },
    });

    const payments = allocations
      .filter((a) => a.payment)
      .map((a) => ({
        id: a.payment.id,
        paymentNumber: a.payment.paymentNumber,
        date: a.payment.date,
        amount: a.amount,
        method: a.payment.method,
        status: a.payment.status,
        expectedDate: a.payment.expectedDate,
        receivedDate: a.payment.receivedDate,
      }));

    return NextResponse.json({ invoice: found, payments });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:invoices");

    const existing = await db.query.invoice.findFirst({
      where: and(
        eq(invoice.id, id),
        eq(invoice.organizationId, ctx.organizationId),
        notDeleted(invoice.deletedAt)
      ),
    });

    if (!existing) return notFound("Invoice");
    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft invoices can be edited" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = updateSchema.parse(body);

    await assertNotLocked(ctx.organizationId, parsed.issueDate);

    const taxRateIds = parsed.lines.map((l) => l.taxRateId).filter(Boolean) as string[];
    const ratesMap = await preloadTaxRates(taxRateIds);

    let subtotal = 0;
    const processedLines = parsed.lines.map((l, i) => {
      const grossAmount = decimalToCents(l.quantity * l.unitPrice);
      const discountAmount = l.discountPercent ? Math.round(grossAmount * l.discountPercent / 10000) : 0;
      const amount = grossAmount - discountAmount;
      subtotal += amount;
      const taxRateId = l.taxRateId || null;
      const taxAmount = taxRateId ? calcTax(amount, ratesMap.get(taxRateId) ?? 0) : 0;
      return {
        invoiceId: id,
        description: l.description,
        quantity: Math.round(l.quantity * 100),
        unitPrice: decimalToCents(l.unitPrice),
        accountId: l.accountId || null,
        taxRateId,
        discountPercent: l.discountPercent,
        taxAmount,
        amount,
        sortOrder: i,
      };
    });

    const taxTotal = processedLines.reduce((sum, l) => sum + l.taxAmount, 0);
    const total = subtotal + taxTotal;

    const updated = await db.transaction(async (tx) => {
      const [updatedInvoice] = await tx
        .update(invoice)
        .set({
          issueDate: parsed.issueDate,
          dueDate: parsed.dueDate,
          reference: parsed.reference || null,
          notes: parsed.notes || null,
          subtotal,
          taxTotal,
          total,
          amountDue: total,
          updatedAt: new Date(),
        })
        .where(eq(invoice.id, id))
        .returning();

      await tx.delete(invoiceLine).where(eq(invoiceLine.invoiceId, id));
      await tx.insert(invoiceLine).values(processedLines);

      return updatedInvoice;
    });

    logAudit({ ctx, action: "update", entityType: "invoice", entityId: id, changes: diffChanges(existing as Record<string, unknown>, updated as Record<string, unknown>), request });

    return NextResponse.json({ invoice: updated });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:invoices");

    const existing = await db.query.invoice.findFirst({
      where: and(
        eq(invoice.id, id),
        eq(invoice.organizationId, ctx.organizationId),
        notDeleted(invoice.deletedAt)
      ),
    });

    if (!existing) return notFound("Invoice");
    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft invoices can be deleted" },
        { status: 400 }
      );
    }

    await db.delete(invoiceLine).where(eq(invoiceLine.invoiceId, id));
    await db.update(invoice).set(softDelete()).where(eq(invoice.id, id));

    logAudit({
      ctx,
      action: "delete",
      entityType: "invoice",
      entityId: id,
      changes: existing as Record<string, unknown>,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
