import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Link,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface LayoutProps {
  preview: string;
  children: React.ReactNode;
  unsubscribeUrl?: string;
  organizationName?: string;
  logoUrl?: string;
  organizationAddress?: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export function EmailLayout({
  preview,
  children,
  unsubscribeUrl,
  organizationName,
  logoUrl,
  organizationAddress,
}: LayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Logo header */}
          <Section style={logoSection}>
            {logoUrl ? (
              <Img
                src={logoUrl}
                width="160"
                height="auto"
                alt={organizationName || ""}
                style={{ display: "block", maxWidth: "160px" }}
              />
            ) : (
              <Text style={logoText}>
                {organizationName || "Invoice"}
              </Text>
            )}
          </Section>

          {children}

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerLinks}>
              <Link href="https://robertmaefs.com/terms" style={footerLink}>
                Terms of Service
              </Link>
              {" · "}
              <Link href="https://robertmaefs.com/privacy" style={footerLink}>
                Privacy Policy
              </Link>
              {unsubscribeUrl && (
                <>
                  {" · "}
                  <Link href={unsubscribeUrl} style={footerLink}>
                    Unsubscribe
                  </Link>
                </>
              )}
            </Text>
            <Text style={companyText}>
              {organizationName || "Robert Maefs Consulting, LLC"}
            </Text>
            <Text style={companyText}>
              {organizationAddress || "62 Elmwood Ave · Buffalo, NY 14201"}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#f4f7fa",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  maxWidth: "600px",
  borderRadius: "12px",
  overflow: "hidden",
  marginTop: "48px",
  marginBottom: "48px",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
};

const logoSection: React.CSSProperties = {
  padding: "28px 40px 0",
};

const logoText: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  color: "#1a1a1a",
  margin: 0,
  letterSpacing: "-0.3px",
  lineHeight: "26px",
};

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "0 40px",
};

const footer: React.CSSProperties = {
  padding: "20px 40px 28px",
};

const footerLinks: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: "20px",
  margin: "0 0 10px",
  color: "#9ca3af",
};

const footerLink: React.CSSProperties = {
  color: "#9ca3af",
  textDecoration: "underline",
};

const companyText: React.CSSProperties = {
  color: "#b0b8c4",
  fontSize: "11px",
  lineHeight: "16px",
  margin: 0,
};
