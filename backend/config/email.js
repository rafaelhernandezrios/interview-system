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

