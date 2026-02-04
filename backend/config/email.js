import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Helper function to escape HTML characters
const escapeHtml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Helper function to convert newlines to <br> tags (for pre-formatted text)
const nl2br = (text) => {
  if (!text) return '';
  return String(text).replace(/\n/g, '<br>');
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    // Plain text version
    const textVersion = `Mirai Innovation Research Institute - Password Recovery

We received a request to reset the password for your account.

To reset your password, click on the following link or copy and paste it into your browser:

${resetUrl}

IMPORTANT: This link will expire in 1 hour for security reasons.

If you did not request this change, you can safely ignore this email. Your password will not be modified.

If you have any questions, please contact our support team.

Best regards,
Mirai Innovation Research Institute Team
Evaluation and Selection System`;

    // Enhanced HTML version
    const htmlVersion = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Recovery</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0; text-align: center; background-color: #ffffff;">
        <table role="presentation" style="width: 600px; margin: 0 auto; border-collapse: collapse; background-color: #ffffff;">
          <tr>
            <td style="padding: 40px 30px; text-align: center; border-bottom: 3px solid #2563eb;">
              <h1 style="margin: 0; color: #1e40af; font-size: 24px; font-weight: bold;">
                Mirai Innovation Research Institute
              </h1>
              <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">
                Evaluation and Selection System
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px; font-weight: 600;">
                Password Recovery
              </h2>
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                We received a request to reset the password for your account in our evaluation system.
              </p>
              <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                To reset your password, click on the following button:
              </p>
              <table role="presentation" style="width: 100%; margin: 0 0 30px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 15px 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 30px 0; color: #2563eb; font-size: 12px; word-break: break-all; background-color: #f1f5f9; padding: 12px; border-radius: 4px; border-left: 3px solid #2563eb;">
                ${resetUrl}
              </p>
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">
                  ⚠️ Important:
                </p>
                <p style="margin: 5px 0 0 0; color: #78350f; font-size: 13px; line-height: 1.5;">
                  This link will expire in <strong>1 hour</strong> for security reasons. If you did not request this change, you can safely ignore this email.
                </p>
              </div>
              <p style="margin: 30px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                If you have any questions or did not request this change, please contact our support team.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px;">
                <strong>Mirai Innovation Research Institute</strong>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.6;">
                Edge Honmachi Bldg 3F<br>
                2-3-12 Minamihonmachi, Chuo-ku, Osaka, Japan 541-0054<br>
                <a href="mailto:contact@mirai-innovation-lab.com" style="color: #2563eb; text-decoration: none;">contact@mirai-innovation-lab.com</a>
              </p>
              <p style="margin: 15px 0 0 0; color: #cbd5e1; font-size: 11px;">
                This is an automated email, please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    
    const mailOptions = {
      from: `"Mirai Innovation Research Institute" <${process.env.EMAIL_USER}>`,
      to: email,
      replyTo: process.env.EMAIL_USER,
      subject: 'Password Recovery - Mirai Innovation Research Institute',
      text: textVersion,
      html: htmlVersion,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=Unsubscribe>`,
      },
      // Agregar información adicional para mejorar deliverabilidad
      list: {
        unsubscribe: {
          url: `mailto:${process.env.EMAIL_USER}?subject=Unsubscribe`,
          comment: 'Unsubscribe'
        }
      }
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const sendPasswordChangeConfirmation = async (email, userName) => {
  try {
    const transporter = createTransporter();
    
    // Plain text version
    const textVersion = `Mirai Innovation Research Institute - Password Change Confirmation

Hello ${userName},

Your password has been successfully changed in our evaluation system.

If you did not make this change, please contact our support team immediately.

Best regards,
Mirai Innovation Research Institute Team
Evaluation and Selection System`;

    // Enhanced HTML version
    const htmlVersion = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0; text-align: center; background-color: #ffffff;">
        <table role="presentation" style="width: 600px; margin: 0 auto; border-collapse: collapse; background-color: #ffffff;">
          <tr>
            <td style="padding: 40px 30px; text-align: center; border-bottom: 3px solid #10b981;">
              <h1 style="margin: 0; color: #059669; font-size: 24px; font-weight: bold;">
                Mirai Innovation Research Institute
              </h1>
              <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">
                Evaluation and Selection System
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; width: 64px; height: 64px; background-color: #d1fae5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                  <span style="font-size: 32px;">✓</span>
                </div>
              </div>
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px; font-weight: 600; text-align: center;">
                Password Changed Successfully
              </h2>
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Hello <strong>${userName}</strong>,
              </p>
              <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Your password has been successfully changed in our evaluation and selection system.
              </p>
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">
                  ⚠️ Important:
                </p>
                <p style="margin: 5px 0 0 0; color: #78350f; font-size: 13px; line-height: 1.5;">
                  If you <strong>did not make this change</strong>, please contact our support team immediately.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px;">
                <strong>Mirai Innovation Research Institute</strong>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.6;">
                Edge Honmachi Bldg 3F<br>
                2-3-12 Minamihonmachi, Chuo-ku, Osaka, Japan 541-0054<br>
                <a href="mailto:contact@mirai-innovation-lab.com" style="color: #2563eb; text-decoration: none;">contact@mirai-innovation-lab.com</a>
              </p>
              <p style="margin: 15px 0 0 0; color: #cbd5e1; font-size: 11px;">
                This is an automated email, please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    
    const mailOptions = {
      from: `"Mirai Innovation Research Institute" <${process.env.EMAIL_USER}>`,
      to: email,
      replyTo: process.env.EMAIL_USER,
      subject: 'Password Changed - Mirai Innovation Research Institute',
      text: textVersion,
      html: htmlVersion,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
      }
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Send bulk email to all active users
export const sendBulkEmailToActiveUsers = async (userEmails, subject, htmlContent, textContent) => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    
    // Send emails in batches to avoid overwhelming the email service
    const batchSize = 10;
    const results = {
      success: [],
      failed: []
    };

    for (let i = 0; i < userEmails.length; i += batchSize) {
      const batch = userEmails.slice(i, i + batchSize);
      
      // Send to multiple recipients at once using BCC
      const mailOptions = {
        from: `"Mirai Innovation Research Institute" <${process.env.EMAIL_USER}>`,
        bcc: batch, // Use BCC to send to multiple users without exposing their emails
        replyTo: process.env.EMAIL_USER,
        subject: subject,
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high',
        }
      };

      try {
        const result = await transporter.sendMail(mailOptions);
        batch.forEach(email => {
          results.success.push({ email, messageId: result.messageId });
        });
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < userEmails.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        batch.forEach(email => {
          results.failed.push({ email, error: error.message });
        });
      }
    }

    return {
      success: true,
      totalSent: results.success.length,
      totalFailed: results.failed.length,
      results: results
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const sendCompletionNotificationToAdmins = async (adminEmail, userName, userEmail, digitalId, program) => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    
    // Plain text version
    const textVersion = `Mirai Innovation Research Institute - New Application Completed

A new applicant has completed 100% of the evaluation process.

Applicant Information:
- Name: ${userName}
- Email: ${userEmail}
- Digital ID: ${digitalId || 'N/A'}
- Program: ${program || 'N/A'}

Please review the application in the admin panel.

Best regards,
Mirai Innovation Research Institute
Evaluation and Selection System`;

    // Enhanced HTML version
    const htmlVersion = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Application Completed</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0; text-align: center; background-color: #ffffff;">
        <table role="presentation" style="width: 600px; margin: 0 auto; border-collapse: collapse; background-color: #ffffff;">
          <tr>
            <td style="padding: 40px 30px; text-align: center; border-bottom: 3px solid #10b981;">
              <h1 style="margin: 0; color: #059669; font-size: 24px; font-weight: bold;">
                Mirai Innovation Research Institute
              </h1>
              <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">
                Evaluation and Selection System
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; width: 64px; height: 64px; background-color: #d1fae5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                  <span style="font-size: 32px;">✓</span>
                </div>
              </div>
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px; font-weight: 600; text-align: center;">
                New Application Completed
              </h2>
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                A new applicant has completed <strong>100%</strong> of the evaluation process, including CV analysis and interview.
              </p>
              
              <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0 0 15px 0; color: #1e40af; font-size: 16px; font-weight: 600;">
                  Applicant Information:
                </p>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #475569; font-size: 14px; border-bottom: 1px solid #e2e8f0;">
                      <strong style="color: #1e293b;">Name:</strong> ${userName}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #475569; font-size: 14px; border-bottom: 1px solid #e2e8f0;">
                      <strong style="color: #1e293b;">Email:</strong> ${userEmail}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #475569; font-size: 14px; border-bottom: 1px solid #e2e8f0;">
                      <strong style="color: #1e293b;">Digital ID:</strong> ${digitalId || 'N/A'}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #475569; font-size: 14px;">
                      <strong style="color: #1e293b;">Program:</strong> ${program || 'N/A'}
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="margin: 30px 0 0 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Please review the application in the admin panel to proceed with the selection process.
              </p>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL}/admin" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                  Go to Admin Panel
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px;">
                <strong>Mirai Innovation Research Institute</strong>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.6;">
                Edge Honmachi Bldg 3F<br>
                2-3-12 Minamihonmachi, Chuo-ku, Osaka, Japan 541-0054<br>
                <a href="mailto:contact@mirai-innovation-lab.com" style="color: #2563eb; text-decoration: none;">contact@mirai-innovation-lab.com</a>
              </p>
              <p style="margin: 15px 0 0 0; color: #cbd5e1; font-size: 11px;">
                This is an automated email, please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    
    const mailOptions = {
      from: `"Mirai Innovation Research Institute" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      replyTo: process.env.EMAIL_USER,
      subject: `New Application Completed - ${userName}`,
      text: textVersion,
      html: htmlVersion,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
      }
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const sendReportResponseNotification = async (userEmail, userName, reportSubject, adminMessage, adminName) => {
  try {
    console.log(`[sendReportResponseNotification] Starting email send to ${userEmail}`);
    
    // Validate required environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('[sendReportResponseNotification] Missing email credentials');
      return { success: false, error: 'Email credentials not configured' };
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      console.error(`[sendReportResponseNotification] Invalid email format: ${userEmail}`);
      return { success: false, error: 'Invalid email format' };
    }
    
    if (!process.env.FRONTEND_URL) {
      console.warn('[sendReportResponseNotification] FRONTEND_URL not set, using placeholder');
    }
    
    const transporter = createTransporter();
    console.log(`[sendReportResponseNotification] Verifying email connection...`);
    await transporter.verify();
    console.log(`[sendReportResponseNotification] Email connection verified successfully`);
    
    const reportUrl = `${process.env.FRONTEND_URL || 'https://studentportal.mirai-education.tech'}/report`;
    
    // Escape HTML for safe insertion
    const safeUserName = escapeHtml(userName || 'User');
    const safeReportSubject = escapeHtml(reportSubject || 'Your Report');
    const safeAdminName = escapeHtml(adminName || 'Admin');
    // For adminMessage, we want to preserve line breaks, so escape HTML first, then convert newlines
    const safeAdminMessage = nl2br(escapeHtml(adminMessage || ''));
    
    // Plain text version
    const textVersion = `Mirai Innovation Research Institute - Response to Your Report

Hello ${userName || 'User'},

You have received a response to your report: "${reportSubject || 'Your Report'}"

Admin Response:
${adminMessage || ''}

To view the full conversation and respond, please visit:
${reportUrl}

Best regards,
Mirai Innovation Research Institute Team
Evaluation and Selection System`;

    // Enhanced HTML version with properly escaped content
    const htmlVersion = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Response to Your Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0; text-align: center; background-color: #ffffff;">
        <table role="presentation" style="width: 600px; margin: 0 auto; border-collapse: collapse; background-color: #ffffff;">
          <tr>
            <td style="padding: 40px 30px; text-align: center; border-bottom: 3px solid #2563eb;">
              <h1 style="margin: 0; color: #1e40af; font-size: 24px; font-weight: bold;">
                Mirai Innovation Research Institute
              </h1>
              <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">
                Evaluation and Selection System
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px; font-weight: 600;">
                Response to Your Report
              </h2>
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Hello <strong>${safeUserName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                You have received a response to your report: <strong>"${safeReportSubject}"</strong>
              </p>
              
              <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; color: #1e40af; font-size: 14px; font-weight: 600;">
                  Response from ${safeAdminName}:
                </p>
                <p style="margin: 0; color: #475569; font-size: 16px; line-height: 1.6;">
                  ${safeAdminMessage}
                </p>
              </div>
              
              <p style="margin: 30px 0 0 0; color: #475569; font-size: 16px; line-height: 1.6;">
                To view the full conversation and respond, please visit the report page:
              </p>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${reportUrl}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                  View Report & Respond
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px;">
                <strong>Mirai Innovation Research Institute</strong>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.6;">
                Edge Honmachi Bldg 3F<br>
                2-3-12 Minamihonmachi, Chuo-ku, Osaka, Japan 541-0054<br>
                <a href="mailto:contact@mirai-innovation-lab.com" style="color: #2563eb; text-decoration: none;">contact@mirai-innovation-lab.com</a>
              </p>
              <p style="margin: 15px 0 0 0; color: #cbd5e1; font-size: 11px;">
                This is an automated email, please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    
    const mailOptions = {
      from: `"Mirai Innovation Research Institute" <${process.env.EMAIL_USER}>`,
      to: userEmail.trim(), // Trim whitespace
      replyTo: process.env.EMAIL_USER,
      subject: `Response to Your Report: ${reportSubject || 'Your Report'}`,
      text: textVersion,
      html: htmlVersion,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
      }
    };

    console.log(`[sendReportResponseNotification] Sending email to ${userEmail}...`);
    console.log(`[sendReportResponseNotification] Email details:`, {
      to: userEmail,
      subject: mailOptions.subject,
      userName: userName,
      adminName: adminName
    });
    
    const result = await transporter.sendMail(mailOptions);
    console.log(`[sendReportResponseNotification] Email sent successfully. Message ID: ${result.messageId}`);
    console.log(`[sendReportResponseNotification] Email response:`, {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response,
      pending: result.pending
    });
    
    // Check if email was actually accepted
    if (result.accepted && result.accepted.length > 0) {
      console.log(`[sendReportResponseNotification] Email accepted by server for: ${result.accepted.join(', ')}`);
    }
    if (result.rejected && result.rejected.length > 0) {
      console.error(`[sendReportResponseNotification] Email rejected by server for: ${result.rejected.join(', ')}`);
      return { success: false, error: 'Email was rejected by server', rejected: result.rejected };
    }
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`[sendReportResponseNotification] Error sending email:`, {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack
    });
    return { success: false, error: error.message, details: error };
  }
};

/**
 * Notify user that their acceptance letter is ready and they can download it from the dashboard.
 * @param {string} userEmail - User email
 * @param {string} userName - User name
 * @param {string} dashboardUrl - Dashboard URL
 * @param {string} programType - Program type: 'MIRI' or 'FIJSE' (default: 'MIRI')
 */
export const sendAcceptanceLetterReadyNotification = async (userEmail, userName, dashboardUrl, programType = 'MIRI') => {
  try {
    const transporter = createTransporter();
    await transporter.verify();

    const safeUserName = escapeHtml(userName || 'Applicant');
    const portalBase = process.env.STUDENT_PORTAL_URL || process.env.FRONTEND_URL || 'https://studentportal.mirai-education.tech';
    const finalDashboardUrl = (dashboardUrl || `${portalBase.replace(/\/$/, '')}/dashboard`).trim();
    const safeDashboardUrl = escapeHtml(finalDashboardUrl);

    const programName = programType === 'FIJSE' 
      ? 'Future Innovators Japan Selection Entry Program'
      : 'Mirai Innovation Research Immersion (MIRI) Program';
    const safeProgramName = escapeHtml(programName);

    // Different content for FIJSE vs MIRI
    const isFIJSE = programType === 'FIJSE';
    
    const textVersion = isFIJSE 
      ? `Mirai Innovation Research Institute - You have been accepted to MIRI program in Osaka, Japan 2026

Hello ${userName || 'Applicant'},

We are pleased to inform you that you have been accepted to the Mirai Innovation Research Immersion (MIRI) Program in Osaka, Japan 2026.

Your official acceptance letter is now ready and available for download from your dashboard:

${finalDashboardUrl || '(Log in to the evaluation system and go to your Dashboard)'}

Log in to your account and you will see the "Acceptance Letter" step with a "Download PDF" button to get your letter with all the details about your acceptance, scholarship, and program information.

If you have any questions, please contact us.

Best regards,
Mirai Innovation Research Institute
Evaluation Committee`
      : `Mirai Innovation Research Institute - Your Acceptance Letter is Ready

Hello ${userName || 'Applicant'},

Your official acceptance letter for the ${programName} is now ready.

You can download your acceptance letter PDF from your dashboard:

${finalDashboardUrl || '(Log in to the evaluation system and go to your Dashboard)'}

Log in to your account and you will see the "Acceptance Letter" step with a "Download PDF" button.

If you have any questions, please contact us.

Best regards,
Mirai Innovation Research Institute
Evaluation Committee`;

    const htmlVersion = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isFIJSE ? 'You have been accepted to MIRI program' : 'Your Acceptance Letter is Ready'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px 0; text-align: center; background-color: #ffffff;">
        <table role="presentation" style="width: 600px; margin: 0 auto; border-collapse: collapse; background-color: #ffffff;">
          <tr>
            <td style="padding: 40px 30px; text-align: center; border-bottom: 3px solid #059669;">
              <h1 style="margin: 0; color: #047857; font-size: 24px; font-weight: bold;">
                Mirai Innovation Research Institute
              </h1>
              <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">
                Evaluation and Selection System
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; width: 64px; height: 64px; background-color: #d1fae5; border-radius: 50%; line-height: 64px; text-align: center; margin: 0 auto;">
                  <span style="font-size: 32px; color: #059669;">✓</span>
                </div>
              </div>
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px; font-weight: 600; text-align: center;">
                ${isFIJSE ? 'You have been accepted to MIRI program in Osaka, Japan 2026' : 'Your Acceptance Letter is Ready'}
              </h2>
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                Hello <strong>${safeUserName}</strong>,
              </p>
              ${isFIJSE 
                ? `<p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                    We are pleased to inform you that you have been <strong>accepted to the Mirai Innovation Research Immersion (MIRI) Program in Osaka, Japan 2026</strong>.
                  </p>
                  <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                    Your official acceptance letter is now ready and available for download from your dashboard.
                  </p>
                  <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                    Log in to your account and go to your <strong>Dashboard</strong>. You will see the &quot;Acceptance Letter&quot; step with a <strong>Download PDF</strong> button to get your letter with all the details about your acceptance, scholarship, and program information.
                  </p>`
                : `<p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                    Your official acceptance letter for the <strong>${safeProgramName}</strong> is now ready.
                  </p>
                  <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                    Log in to your account and go to your <strong>Dashboard</strong>. You will see the &quot;Acceptance Letter&quot; step with a <strong>Download PDF</strong> button to get your letter.
                  </p>`
              }
              <div style="text-align: center; margin-top: 30px;">
                <a href="${finalDashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">
                  Go to Dashboard &amp; Download
                </a>
              </div>
              <p style="margin: 30px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                If you have any questions, please contact our support team.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px;">
                <strong>Mirai Innovation Research Institute</strong>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.6;">
                Edge Honmachi Bldg 3F<br>
                2-3-12 Minamihonmachi, Chuo-ku, Osaka, Japan 541-0054<br>
                <a href="mailto:contact@mirai-innovation-lab.com" style="color: #2563eb; text-decoration: none;">contact@mirai-innovation-lab.com</a>
              </p>
              <p style="margin: 15px 0 0 0; color: #cbd5e1; font-size: 11px;">
                This is an automated email, please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const emailSubject = isFIJSE
      ? 'You have been accepted to MIRI program in Osaka, Japan 2026 - Mirai Innovation Research Institute'
      : 'Your Acceptance Letter is Ready - Mirai Innovation Research Institute';

    const mailOptions = {
      from: `"Mirai Innovation Research Institute" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      replyTo: process.env.EMAIL_USER,
      subject: emailSubject,
      text: textVersion,
      html: htmlVersion,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
      },
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};