import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseLayout, styles } from './base-layout';

interface CommentEmailProps {
  authorUsername: string;
  commenterUsername: string;
  commentContent: string;
  questionTitle?: string;
  questionUrl: string;
  preferencesUrl: string;
}

export function CommentEmail({
  authorUsername,
  commenterUsername,
  commentContent,
  questionTitle,
  questionUrl,
  preferencesUrl,
}: CommentEmailProps) {
  const pollReference = questionTitle ? `"${questionTitle}"` : 'your poll';

  return (
    <BaseLayout
      preview={`${commenterUsername} commented on ${pollReference}`}
      footerText="You're receiving this because someone commented on your poll."
      preferencesUrl={preferencesUrl}
    >
      <Text style={styles.heading}>
        Hey {authorUsername}! 💬
      </Text>

      <Text style={styles.paragraph}>
        <strong>{commenterUsername}</strong> left a comment on {pollReference}:
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

export default CommentEmail;

