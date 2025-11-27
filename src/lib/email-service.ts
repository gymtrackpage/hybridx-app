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
