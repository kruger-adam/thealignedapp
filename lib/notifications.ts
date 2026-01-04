import twilio from 'twilio';
import { Resend } from 'resend';

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
 * Send email notification via Resend
 */
async function sendEmail(subject: string, body: string): Promise<boolean> {
  if (!resend) {
    console.log('Resend not configured, skipping email');
    return false;
  }

  try {
    await resend.emails.send({
      from: 'Consensus App <notifications@resend.dev>',
      to: ADMIN_EMAIL,
      subject,
      text: body,
    });
    console.log('Email notification sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
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
  
  const emailSubject = `🎉 New Consensus Signup: ${user.username}`;
  const emailBody = `A new user just signed up for Consensus!\n\nUsername: ${user.username}\nEmail: ${user.email}\nTime: ${time}`;

  // Try SMS first (preferred)
  const smsSent = await sendSMS(smsMessage);
  
  // Also send email as backup/record
  await sendEmail(emailSubject, emailBody);
  
  if (!smsSent) {
    console.log('SMS not sent - check Twilio configuration');
  }
}

