import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoice } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!stripe) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 404 });
  }

  const { token } = await params;

  // Parse optional body to determine payment method
  const body = await request.json().catch(() => ({}));
  const method = body.method === "bank" ? "bank" : "card";

  const inv = await db.query.invoice.findFirst({
    where: and(
      eq(invoice.paymentLinkToken, token),
      isNull(invoice.deletedAt)
    ),
    with: { organization: true },
  });

  if (!inv || inv.status === "paid" || inv.status === "void" || inv.status === "draft") {
    return NextResponse.json({ error: "Invoice not payable" }, { status: 400 });
  }

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  // Card: add 3% fee. Bank transfer (ACH): no fee
  const isCard = method === "card";
  const processingFee = isCard ? Math.round(inv.amountDue * 0.03) : 0;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: isCard ? ["card"] : ["us_bank_account"],
    payment_method_options: isCard
      ? undefined
      : {
          us_bank_account: {
            verification_method: "automatic",
          },
        },
    line_items: [
      {
        price_data: {
          currency: inv.currencyCode.toLowerCase(),
          product_data: {
            name: `Invoice ${inv.invoiceNumber}`,
            description: `Payment to ${inv.organization.name}`,
          },
          unit_amount: inv.amountDue,
        },
        quantity: 1,
      },
      ...(processingFee > 0
        ? [
            {
              price_data: {
                currency: inv.currencyCode.toLowerCase(),
                product_data: {
                  name: "Credit card processing fee (3%)",
                },
                unit_amount: processingFee,
              },
              quantity: 1,
            } as const,
          ]
        : []),
    ],
    metadata: {
      invoiceId: inv.id,
      organizationId: inv.organizationId,
      paymentLinkToken: token,
      paymentMethod: method,
    },
    success_url: `${baseUrl}/pay/${token}?status=success`,
    cancel_url: `${baseUrl}/pay/${token}?status=cancelled`,
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
