"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Container } from "@/components/shared/container";
import { OrbitalDecoration } from "@/components/shared/orbital-decoration";
import { GrainGradient } from "@paper-design/shaders-react";
import { ArrowUpRight } from "lucide-react";

const features: { text: string; icon: React.ComponentType<{ className?: string }> }[] = [];

const networkNodes = [
  { label: "Invoices", x: 10, y: 10 },
  { label: "Accounts", x: 30, y: 6 },
  { label: "Contacts", x: 8, y: 38 },
  { label: "Expenses", x: 28, y: 44 },
  { label: "P&L Report", x: 52, y: 12 },
  { label: "Tax filing", x: 75, y: 8 },
  { label: "Clients", x: 88, y: 16 },
  { label: "Bills", x: 70, y: 40 },
  { label: "Payroll", x: 10, y: 72 },
  { label: "Receipts", x: 45, y: 75 },
  { label: "Inventory", x: 78, y: 72 },
  { label: "Multi-currency", x: 88, y: 52 },
  { label: "Balance sheet", x: 55, y: 50 },
  { label: "Journal entries", x: 18, y: 24 },
];

const networkEdges = [
  [0, 1], [0, 13], [1, 4], [2, 3], [2, 8], [3, 12],
  [4, 5], [5, 6], [6, 7], [7, 11], [8, 9], [9, 10],
  [10, 11], [12, 7], [12, 9], [13, 3],
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Background effects */}
      <div className="noise-overlay pointer-events-none fixed inset-0 z-0" />
      <div className="pointer-events-none fixed inset-0 z-0 gradient-mesh" />

      {/* Animated orbital SVGs */}
      <OrbitalDecoration className="fixed -right-[10%] -top-[15%] z-0 h-[800px] w-[800px] lg:h-[900px] lg:w-[900px]" />
      <OrbitalDecoration className="fixed -bottom-[20%] -left-[12%] z-0 h-[600px] w-[600px] rotate-180 lg:h-[700px] lg:w-[700px]" />

      {/* Container edge lines */}
      <div className="pointer-events-none fixed inset-0 z-[60] flex justify-center">
        <div className="w-full max-w-[1400px]">
          <div className="relative h-full">
            <div className="absolute inset-y-0 left-0 w-px bg-foreground/10" />
            <div className="absolute inset-y-0 right-0 w-px bg-foreground/10" />
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="relative z-20">
        <Container className="flex items-center justify-between py-5">
          <span className="text-lg font-semibold tracking-tight text-foreground">
            Robert Maefs Consulting
          </span>
          <ThemeToggle />
        </Container>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 items-center justify-center pb-8">
        <Container>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/5 dark:shadow-black/40">
            {/* Mobile banner */}
            <div className="relative overflow-hidden lg:hidden">
              <div className="relative flex flex-col items-center gap-1.5 py-8">
                <span className="text-lg font-bold tracking-tight text-foreground">
                  Robert Maefs Consulting
                </span>
                <p className="text-xs text-muted-foreground">
                  Invoicing & payments
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1.2fr_1fr]">
              {/* ---- Left: brand panel ---- */}
              <div className="relative hidden overflow-hidden border-r border-border bg-card lg:flex lg:items-center lg:justify-center">
                <motion.div
                  className="flex flex-col items-center gap-4 px-10"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    Robert Maefs Consulting
                  </span>
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    Invoicing, time tracking, and payment management
                  </p>
                </motion.div>
              </div>

              {/* ---- Right: form panel ---- */}
              <div className="relative flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12 lg:py-12">
                <div className="mx-auto w-full max-w-sm">{children}</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <a
              href="https://robertmaefs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 transition-colors hover:text-foreground"
            >
              robertmaefs.com
              <ArrowUpRight className="size-3" />
            </a>
            <span className="text-border">&middot;</span>
            <span>Robert Maefs Consulting, LLC</span>
          </div>
        </Container>
      </main>
    </div>
  );
}
