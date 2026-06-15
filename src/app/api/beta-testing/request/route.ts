import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { mailer as transporter, getFromAddress, isEmailConfigured } from '@/lib/email-service';
import { promises as fs } from 'fs';
import path from 'path';

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
    // Public form — rate-limit per IP so it can't be abused to send spam email.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rl = checkRateLimit(`beta-request:${ip}`, 60 * 60_000, 5); // 5 per hour
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!isEmailConfigured()) {
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
        from: getFromAddress(),
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
        from: getFromAddress('HybridX Beta Requests'),
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
