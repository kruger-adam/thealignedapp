import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout, styles } from './base-layout';

interface MentionEmailProps {
  mentionedUsername: string;
  mentionerUsername: string;
  commentContent: string;
  questionUrl: string;
  preferencesUrl: string;
}

export function MentionEmail({
  mentionedUsername,
  mentionerUsername,
  commentContent,
  questionUrl,
  preferencesUrl,
}: MentionEmailProps) {
  return (
    <BaseLayout
      preview={`@${mentionerUsername} mentioned you in a comment`}
      footerText="You're receiving this because you were mentioned."
      preferencesUrl={preferencesUrl}
    >
      <Text style={styles.heading}>
        Hey {mentionedUsername}! 👋
      </Text>

      <Text style={styles.paragraph}>
        <strong>@{mentionerUsername}</strong> mentioned you in a comment:
      </Text>

      <Section style={styles.quote}>
        <Text style={styles.quoteText}>
          "{commentContent}"
        </Text>
      </Section>

      <Section style={styles.buttonContainer}>
        <Button href={questionUrl} style={styles.button}>
          View Conversation
        </Button>
      </Section>
    </BaseLayout>
  );
}

export default MentionEmail;

