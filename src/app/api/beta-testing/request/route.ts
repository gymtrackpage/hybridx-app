import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('Email credentials not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    // Send confirmation email to user
    const userTemplate = await getEmailTemplate('beta-tester-confirmation.html', {
      name: name || 'Athlete',
    });

    if (userTemplate) {
      await transporter.sendMail({
        from: `"HybridX Training" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Android Beta Testing Request Received',
        html: userTemplate,
      });
      console.log(`Beta testing confirmation email sent to ${email}`);
    }

    // Send notification email to admin
    const adminTemplate = await getEmailTemplate('beta-tester-admin-notification.html', {
      name: name || 'Unknown',
      email: email,
      timestamp: new Date().toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long',
      }),
    });

    if (adminTemplate) {
      await transporter.sendMail({
        from: `"HybridX Beta Requests" <${process.env.GMAIL_USER}>`,
        to: 'training@hybridx.club',
        subject: `New Android Beta Tester Request: ${email}`,
        html: adminTemplate,
        replyTo: email,
      });
      console.log(`Beta testing admin notification sent for ${email}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Beta testing request submitted successfully',
    });

  } catch (error) {
    console.error('Error processing beta testing request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
