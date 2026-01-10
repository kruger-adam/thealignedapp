import twilio from 'twilio';
import { Resend } from 'resend';
import { MentionEmail } from '@/emails/mention-email';
import { CommentEmail } from '@/emails/comment-email';
import { NewSignupEmail } from '@/emails/new-signup-email';

// Twilio configuration
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Resend configuration
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Your notification preferences
const ADMIN_PHONE = '647-969-1037';
const ADMIN_EMAIL = 'adamkruger94@gmail.com';

interface NewUserInfo {
  email: string;
  username: string;
  signupTime: Date;
}

/**
 * Send SMS notification via Twilio
 */
async function sendSMS(message: string): Promise<boolean> {
  if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
    console.log('Twilio not configured, skipping SMS');
    return false;
  }

  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+1${ADMIN_PHONE.replace(/-/g, '')}`,
    });
    console.log('SMS notification sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return false;
  }
}

/**
 * Format comment content for email display
 * Converts @[username](id) to @username for readability
 */
function formatContentForEmail(content: string): string {
  // Replace @[username](uuid) with @username
  return content.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
}

/**
 * Notify admin of a new user signup
 * Tries SMS first (preferred), falls back to email
 */
export async function notifyNewSignup(user: NewUserInfo): Promise<void> {
  const time = user.signupTime.toLocaleString('en-US', {
    timeZone: 'America/Toronto',
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const smsMessage = `🎉 New Consensus signup!\n${user.username}\n${user.email}\n${time}`;

  // Try SMS first (preferred)
  const smsSent = await sendSMS(smsMessage);
  
  // Also send branded email as backup/record
  if (resend) {
    try {
      await resend.emails.send({
        from: 'Aligned <hello@thealignedapp.com>',
        to: ADMIN_EMAIL,
        subject: `🎉 New Signup: ${user.username}`,
        react: NewSignupEmail({
          username: user.username,
          email: user.email,
          signupTime: time,
        }),
      });
      console.log('Admin signup email sent successfully');
    } catch (error) {
      console.error('Failed to send admin signup email:', error);
    }
  }
  
  if (!smsSent) {
    console.log('SMS not sent - check Twilio configuration');
  }
}

interface MentionNotificationInfo {
  mentionedUserEmail: string;
  mentionedUsername: string;
  mentionerUsername: string;
  commentContent: string;
  questionId: string;
}

/**
 * Send email notification when a user is mentioned in a comment
 */
export async function notifyMention(info: MentionNotificationInfo): Promise<boolean> {
  const { mentionedUserEmail, mentionedUsername, mentionerUsername, commentContent, questionId } = info;
  
  if (!resend) {
    console.log('Resend not configured, skipping email');
    return false;
  }
  
  console.log(`[notifyMention] Sending email to ${mentionedUserEmail} (${mentionedUsername}) - mentioned by ${mentionerUsername}`);
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aligned.so';
  const questionUrl = `${baseUrl}/question/${questionId}`;
  const preferencesUrl = `${baseUrl}/preferences/email`;
  
  // Format content to be human-readable (remove UUIDs from mentions)
  const formattedContent = formatContentForEmail(commentContent);
  
  try {
    await resend.emails.send({
      from: 'Aligned <hello@thealignedapp.com>',
      to: mentionedUserEmail,
      subject: `@${mentionerUsername} mentioned you in a comment`,
      react: MentionEmail({
        mentionedUsername,
        mentionerUsername,
        commentContent: formattedContent,
        questionUrl,
        preferencesUrl,
      }),
    });
    console.log(`[notifyMention] Email sent successfully`);
    return true;
  } catch (error) {
    console.error('Failed to send mention email:', error);
    return false;
  }
}

interface CommentNotificationInfo {
  authorEmail: string;
  authorUsername: string;
  commenterUsername: string;
  commentContent: string;
  questionId: string;
  questionTitle?: string;
}

/**
 * Send email notification when someone comments on a poll you created
 */
export async function notifyComment(info: CommentNotificationInfo): Promise<boolean> {
  const { authorEmail, authorUsername, commenterUsername, commentContent, questionId, questionTitle } = info;
  
  if (!resend) {
    console.log('Resend not configured, skipping email');
    return false;
  }
  
  console.log(`[notifyComment] Sending email to ${authorEmail} (${authorUsername}) - comment by ${commenterUsername}`);
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aligned.so';
  const questionUrl = `${baseUrl}/question/${questionId}`;
  const preferencesUrl = `${baseUrl}/preferences/email`;
  
  // Format content to be human-readable (remove UUIDs from mentions)
  const formattedContent = formatContentForEmail(commentContent);
  
  const pollReference = questionTitle ? `"${questionTitle}"` : 'your poll';
  
  try {
    await resend.emails.send({
      from: 'Aligned <hello@thealignedapp.com>',
      to: authorEmail,
      subject: `${commenterUsername} commented on ${pollReference}`,
      react: CommentEmail({
        authorUsername,
        commenterUsername,
        commentContent: formattedContent,
        questionTitle,
        questionUrl,
        preferencesUrl,
      }),
    });
    console.log(`[notifyComment] Email sent successfully`);
    return true;
  } catch (error) {
    console.error('Failed to send comment email:', error);
    return false;
  }
}
