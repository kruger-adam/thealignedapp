import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout, styles } from './base-layout';

interface NewSignupEmailProps {
  username: string;
  email: string;
  signupTime: string;
}

export function NewSignupEmail({
  username,
  email,
  signupTime,
}: NewSignupEmailProps) {
  return (
    <BaseLayout
      preview={`🎉 New signup: ${username}`}
    >
      <Text style={styles.heading}>
        🎉 New Signup!
      </Text>

      <Text style={styles.paragraph}>
        A new user just joined Aligned.
      </Text>

      <Section style={statsContainer}>
        <Section style={statRow}>
          <Text style={statLabel}>Username</Text>
          <Text style={statValue}>{username}</Text>
        </Section>
        <Section style={statRow}>
          <Text style={statLabel}>Email</Text>
          <Text style={statValue}>{email}</Text>
        </Section>
        <Section style={statRow}>
          <Text style={statLabel}>Time</Text>
          <Text style={statValue}>{signupTime}</Text>
        </Section>
      </Section>
    </BaseLayout>
  );
}

const statsContainer = {
  backgroundColor: '#f4f4f5',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0 0 0',
};

const statRow = {
  marginBottom: '12px',
};

const statLabel = {
  color: '#71717a',
  fontSize: '12px',
  fontWeight: '500' as const,
  margin: '0 0 2px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const statValue = {
  color: '#09090b',
  fontSize: '15px',
  fontWeight: '500' as const,
  margin: '0',
};

export default NewSignupEmail;

