import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
  footerText?: string;
  preferencesUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aligned.so';

export function BaseLayout({
  preview,
  children,
  footerText,
  preferencesUrl,
}: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Link href={baseUrl} style={logoLink}>
              <Row>
                <Column style={logoColumn}>
                  <Img
                    src={`${baseUrl}/logo-email.png`}
                    width="36"
                    height="36"
                    alt="Aligned"
                    style={logoImage}
                  />
                </Column>
                <Column>
                  <Text style={logoText}>Aligned</Text>
                </Column>
              </Row>
            </Link>
          </Section>

          {/* Content */}
          <Section style={content}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={footer}>
            {footerText && (
              <Text style={footerNote}>{footerText}</Text>
            )}
            {preferencesUrl && (
              <Link href={preferencesUrl} style={footerLink}>
                Manage email preferences
              </Link>
            )}
            <Text style={footerCopyright}>
              © {new Date().getFullYear()} Aligned
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  maxWidth: '560px',
  borderRadius: '8px',
  border: '1px solid #e4e4e7',
  marginTop: '40px',
  marginBottom: '40px',
  overflow: 'hidden' as const,
};

const header = {
  backgroundColor: '#09090b',
  padding: '24px 32px',
};

const logoLink = {
  textDecoration: 'none',
};

const logoColumn = {
  width: '44px',
  verticalAlign: 'middle' as const,
};

const logoImage = {
  borderRadius: '6px',
};

const logoText = {
  color: '#fafafa',
  fontSize: '20px',
  fontWeight: '600' as const,
  margin: '0',
  letterSpacing: '-0.02em',
  verticalAlign: 'middle' as const,
};

const content = {
  padding: '32px',
};

const footer = {
  borderTop: '1px solid #e4e4e7',
  padding: '24px 32px',
  textAlign: 'center' as const,
};

const footerNote = {
  color: '#71717a',
  fontSize: '13px',
  margin: '0 0 8px 0',
};

const footerLink = {
  color: '#71717a',
  fontSize: '13px',
  textDecoration: 'underline',
};

const footerCopyright = {
  color: '#a1a1aa',
  fontSize: '12px',
  margin: '16px 0 0 0',
};

// Shared component styles for child templates
export const styles = {
  heading: {
    color: '#09090b',
    fontSize: '20px',
    fontWeight: '600' as const,
    margin: '0 0 16px 0',
    lineHeight: '28px',
  },
  paragraph: {
    color: '#3f3f46',
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 16px 0',
  },
  quote: {
    backgroundColor: '#f4f4f5',
    borderLeft: '3px solid #09090b',
    padding: '12px 16px',
    margin: '16px 0',
    borderRadius: '0 4px 4px 0',
  },
  quoteText: {
    color: '#3f3f46',
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0',
    fontStyle: 'italic' as const,
  },
  button: {
    backgroundColor: '#09090b',
    borderRadius: '6px',
    color: '#fafafa',
    display: 'inline-block',
    fontSize: '14px',
    fontWeight: '500' as const,
    padding: '12px 24px',
    textDecoration: 'none',
  },
  buttonContainer: {
    textAlign: 'center' as const,
    margin: '24px 0',
  },
  muted: {
    color: '#71717a',
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0',
  },
};

