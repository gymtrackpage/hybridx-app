import nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import path from 'path';

// Email transport configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * Reads an HTML template from the public folder and replaces placeholders
 */
async function getEmailTemplate(templateName: string, replacements: Record<string, string>) {
  try {
    const templatePath = path.join(process.cwd(), 'public', templateName);
    let html = await fs.readFile(templatePath, 'utf8');

    // Replace all occurrences of placeholders
    Object.entries(replacements).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value);
    });

    return html;
  } catch (error) {
    console.error(`Error reading email template ${templateName}:`, error);
    return null;
  }
}

/**
 * Sends a welcome email to a new user
 */
export async function sendWelcomeEmail(email: string, name?: string) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.warn('Email credentials not configured, skipping welcome email');
      return;
    }

    const html = await getEmailTemplate('new-user-email.html', {
      name: name || 'Athlete',
      // Add other replacements if the template supports them
    });

    if (!html) {
      throw new Error('Could not load email template');
    }

    await transporter.sendMail({
      from: `"HybridX Training" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Welcome to the HybridX.club Community!',
      html: html,
    });

    console.log(`Welcome email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error };
  }
}

/**
 * Day 2 nudge — for users who quick-started (skipped onboarding) and haven't done a workout.
 * Reminds them their AI-built Hyrox starter plan is waiting.
 */
export async function sendOnboardingNudge1(email: string, name?: string) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

    const html = await getEmailTemplate('onboarding-nudge-email-1.html', {
      name: name || 'Athlete',
    });
    if (!html) return;

    await transporter.sendMail({
      from: `"HybridX Training" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `${name || 'Athlete'}, your Hyrox starter workouts are ready to go`,
      html,
    });
    console.log(`Onboarding nudge 1 sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send onboarding nudge 1:', error);
    return { success: false, error };
  }
}

/**
 * Day 6 nudge — for all users who haven't completed any workouts yet.
 * Lowers the barrier and reinforces what's waiting for them.
 */
export async function sendOnboardingNudge2(email: string, name?: string) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

    const html = await getEmailTemplate('onboarding-nudge-email-2.html', {
      name: name || 'Athlete',
    });
    if (!html) return;

    await transporter.sendMail({
      from: `"HybridX Training" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `One workout changes everything, ${name || 'Athlete'}`,
      html,
    });
    console.log(`Onboarding nudge 2 sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send onboarding nudge 2:', error);
    return { success: false, error };
  }
}

/**
 * Day 10 nudge — final urgency email for users still not training.
 * Drives program selection before the trial feeling lapses.
 */
export async function sendOnboardingNudge3(email: string, name?: string) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

    const html = await getEmailTemplate('onboarding-nudge-email-3.html', {
      name: name || 'Athlete',
    });
    if (!html) return;

    await transporter.sendMail({
      from: `"HybridX Training" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `10 days in, ${name || 'Athlete'} — don't let your free trial slip`,
      html,
    });
    console.log(`Onboarding nudge 3 sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send onboarding nudge 3:', error);
    return { success: false, error };
  }
}

/**
 * Sends a re-engagement email to an inactive user
 */
export async function sendReEngagementEmail(email: string, name?: string) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return;
    }

    const html = await getEmailTemplate('re-engagement-email-gmail.html', {
      name: name || 'Athlete',
    });

    if (!html) return;

    await transporter.sendMail({
      from: `"HybridX Training" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'We miss you at HybridX!',
      html: html,
    });

    console.log(`Re-engagement email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send re-engagement email:', error);
    return { success: false, error };
  }
}
