import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payment, paymentAllocation, invoice, bill } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError, notFound } from "@/lib/api/response";
import { logAudit } from "@/lib/api/audit";
import { assertNotLocked } from "@/lib/api/period-lock";
import { createPaymentJournalEntry } from "@/lib/api/journal-automation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext(request);
    requireRole(ctx, "manage:payments");

    // Find the pending payment
    const existing = await db.query.payment.findFirst({
      where: and(
        eq(payment.id, id),
        eq(payment.organizationId, ctx.organizationId),
        eq(payment.status, "pending")
      ),
      with: { allocations: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Pending payment not found" },
        { status: 404 }
      );
    }

    await assertNotLocked(ctx.organizationId, existing.date);

    const today = new Date().toISOString().split("T")[0];

    // Update allocated documents (apply allocations now)
    for (const alloc of existing.allocations) {
      if (alloc.documentType === "invoice") {
        const doc = await db.query.invoice.findFirst({
          where: and(
            eq(invoice.id, alloc.documentId),
            eq(invoice.organizationId, ctx.organizationId)
          ),
        });
        if (doc) {
          const newAmountPaid = doc.amountPaid + alloc.amount;
          const newAmountDue = doc.amountDue - alloc.amount;
          const newStatus = newAmountDue <= 0 ? "paid" : "partial";
          await db
            .update(invoice)
            .set({
              amountPaid: newAmountPaid,
              amountDue: Math.max(0, newAmountDue),
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(invoice.id, alloc.documentId));
        }
      } else if (alloc.documentType === "bill") {
        const doc = await db.query.bill.findFirst({
          where: and(
            eq(bill.id, alloc.documentId),
            eq(bill.organizationId, ctx.organizationId)
          ),
        });
        if (doc) {
          const newAmountPaid = doc.amountPaid + alloc.amount;
          const newAmountDue = doc.amountDue - alloc.amount;
          const newStatus = newAmountDue <= 0 ? "paid" : "partial";
          await db
            .update(bill)
            .set({
              amountPaid: newAmountPaid,
              amountDue: Math.max(0, newAmountDue),
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(bill.id, alloc.documentId));
        }
      }
    }

    // Create journal entry
    const journalEntry = await createPaymentJournalEntry(
      { organizationId: ctx.organizationId, userId: ctx.userId },
      {
        type: existing.type === "received" ? "invoice" : "bill",
        reference: existing.paymentNumber,
        amount: existing.amount,
        date: today,
      }
    );

    // Update payment to completed
    const updateData: Record<string, unknown> = {
      status: "completed",
      receivedDate: today,
      updatedAt: new Date(),
    };
    if (journalEntry) {
      updateData.journalEntryId = journalEntry.id;
    }

    await db
      .update(payment)
      .set(updateData)
      .where(eq(payment.id, id));

    const result = await db.query.payment.findFirst({
      where: eq(payment.id, id),
      with: { contact: true, allocations: true },
    });

    logAudit({
      ctx,
      action: "update",
      entityType: "payment",
      entityId: id,
      request,
    });

    return NextResponse.json({ payment: result });
  } catch (err) {
    return handleError(err);
  }
}
