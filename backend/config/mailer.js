const nodemailer = require('nodemailer');
const path = require('path');

let transporterInstance = null;

// Initialize or return Nodemailer Transporter
function getTransporter() {
  if (transporterInstance) {
    return transporterInstance;
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const isConfigured = Boolean(
    host &&
    user &&
    pass &&
    !host.includes('placeholder') &&
    !user.includes('placeholder') &&
    !pass.includes('placeholder') &&
    user !== 'test_smtp_user'
  );

  if (isConfigured) {
    transporterInstance = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  } else {
    // Safe mock transporter for local development / testing without throwing runtime errors
    transporterInstance = {
      isMock: true,
      sendMail: async (mailOptions) => {
        const previewId = `mock_mail_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        console.log(`\n📨 [MOCK EMAIL SENT] To: ${mailOptions.to} | Subject: "${mailOptions.subject}"`);
        if (mailOptions.attachments && mailOptions.attachments.length > 0) {
          console.log(`   📎 Attachments: ${mailOptions.attachments.map(a => a.filename).join(', ')}`);
        }
        return {
          messageId: previewId,
          response: '250 Mock email accepted for delivery',
          previewUrl: `https://ethereal.email/message/${previewId}`,
          isMock: true
        };
      }
    };
  }

  return transporterInstance;
}

/**
 * Universal Mail Sending Helper
 * @param {Object} options - { to, subject, html, text, attachments }
 * @returns {Promise<Object>} - { success: boolean, messageId, error }
 */
async function sendMail(options) {
  try {
    const transporter = getTransporter();
    const fromAddress = process.env.EMAIL_FROM || '"Nexura Support" <no-reply@nexura.com>';

    const mailOptions = {
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text || (options.html ? options.html.replace(/<[^>]*>/g, '') : ''),
      html: options.html,
      attachments: options.attachments || []
    };

    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: info.previewUrl || nodemailer.getTestMessageUrl(info) || null,
      isMock: Boolean(transporter.isMock)
    };
  } catch (error) {
    console.warn('⚠️ Mailer sendMail warning:', error.message);
    return {
      success: false,
      error: error.message,
      isMock: true
    };
  }
}

/**
 * Send Order Confirmation Transactional Email
 */
async function sendOrderConfirmationEmail(order, pdfBuffer, recipientEmail) {
  try {
    const to = recipientEmail || order.user?.email || order.shippingAddress?.email;
    if (!to) {
      console.warn('No recipient email found for order confirmation');
      return { success: false, message: 'Missing recipient email' };
    }

    const orderId = order.orderId || order._id || 'ORD-UNKNOWN';
    const trackingNumber = order.tracking?.trackingNumber || (order._id ? `NX-TRK-${order._id.toString().slice(-6).toUpperCase()}` : 'NX-TRK-000000');
    const totalFormatted = `INR ${(order.totalPrice ?? order.totalAmount ?? order.total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const orderItems = order.orderItems || order.items || [];
    const itemsListHtml = orderItems.map(item => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 0; font-weight: 500; color: #1e293b;">${item.title || item.name || 'Product'}</td>
        <td style="padding: 10px 0; text-align: center; color: #64748b;">${item.quantity || 1}</td>
        <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #0f172a;">₹${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Nexura</h1>
          <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Order Confirmation & Invoice Receipt</p>
        </div>
        <div style="padding: 24px;">
          <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">Thank you for your purchase! 🎉</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Your order <strong>#${orderId}</strong> has been confirmed and is being processed for dispatch.
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 18px 0;">
            <p style="margin: 4px 0; font-size: 14px; color: #334155;"><strong>Payment Method:</strong> ${order.paymentMethod || 'Online'}</p>
            <p style="margin: 4px 0; font-size: 14px; color: #334155;"><strong>Payment Status:</strong> <span style="color: #059669; font-weight: 600;">${order.paymentStatus || 'Paid'}</span></p>
            <p style="margin: 4px 0; font-size: 14px; color: #334155;"><strong>Live Tracking ID:</strong> <span style="font-family: monospace; color: #2563eb; font-weight: 700;">${trackingNumber}</span></p>
            <p style="margin: 4px 0; font-size: 14px; color: #334155;"><strong>Total Amount:</strong> <span style="font-weight: 700; color: #0f172a;">${totalFormatted}</span></p>
          </div>

          <h3 style="font-size: 15px; color: #1e293b; margin-bottom: 8px;">Order Summary</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
            <thead>
              <tr style="border-bottom: 2px solid #cbd5e1; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">
                <th style="padding-bottom: 6px;">Item</th>
                <th style="padding-bottom: 6px; text-align: center;">Qty</th>
                <th style="padding-bottom: 6px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsListHtml}
            </tbody>
          </table>

          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            📎 An official, printable PDF tax invoice is attached with this email for your records.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b;">
          &copy; ${new Date().getFullYear()} Nexura E-Commerce Ltd. All rights reserved.
        </div>
      </div>
    `;

    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `Invoice-${orderId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    return await sendMail({
      to,
      subject: `Order Confirmed: #${orderId} - Nexura`,
      html,
      attachments
    });
  } catch (err) {
    console.warn('sendOrderConfirmationEmail error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send Shipping / Delivery Status Update Email
 */
async function sendOrderStatusEmail(order, status, recipientEmail) {
  try {
    const to = recipientEmail || order.user?.email || order.shippingAddress?.email;
    if (!to) return { success: false, message: 'Missing recipient email' };

    const orderId = order.orderId || order._id || 'ORD-UNKNOWN';
    const trackingNumber = order.tracking?.trackingNumber || (order._id ? `NX-TRK-${order._id.toString().slice(-6).toUpperCase()}` : 'NX-TRK-000000');

    const isDelivered = status === 'Delivered';
    const title = isDelivered ? 'Your Order has been Delivered! 📦' : 'Your Order is on the Way! 🚚';
    const bannerColor = isDelivered ? '#059669' : '#2563eb';

    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: ${bannerColor}; padding: 22px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Nexura</h1>
          <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">Order Status Update</p>
        </div>
        <div style="padding: 24px;">
          <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">${title}</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            The fulfillment status for order <strong>#${orderId}</strong> has been updated to:
            <span style="display: inline-block; padding: 4px 10px; background: #f1f5f9; border-radius: 4px; font-weight: 700; color: ${bannerColor};">${status}</span>
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 18px 0;">
            <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Courier Partner:</strong> ${order.tracking?.carrier || 'Nexura Express'}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Live Tracking ID:</strong> <span style="font-family: monospace; font-weight: 700; color: #2563eb;">${trackingNumber}</span></p>
          </div>

          <p style="color: #64748b; font-size: 13px;">
            You can view complete delivery milestones in real-time under <strong>My Orders</strong> on the Nexura platform.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 14px; text-align: center; font-size: 12px; color: #64748b;">
          &copy; ${new Date().getFullYear()} Nexura E-Commerce Ltd.
        </div>
      </div>
    `;

    return await sendMail({
      to,
      subject: `Order Update: #${orderId} is ${status} - Nexura`,
      html
    });
  } catch (err) {
    console.warn('sendOrderStatusEmail error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send Password Reset OTP Email
 */
async function sendPasswordResetEmail(email, otp) {
  try {
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #1e293b; padding: 20px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Nexura Security</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">Password Reset Request</p>
        </div>
        <div style="padding: 24px; text-align: center;">
          <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">Reset Your Password</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
            We received a request to reset the password for your Nexura account. Use the verification code below to complete your reset:
          </p>

          <div style="display: inline-block; background: #f1f5f9; border: 2px dashed #94a3b8; border-radius: 8px; padding: 12px 28px; margin: 10px 0;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2563eb;">${otp}</span>
          </div>

          <p style="color: #dc2626; font-size: 12px; font-weight: 600; margin-top: 16px;">
            ⏱ This code is valid for 15 minutes.
          </p>
          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">
            If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
        </div>
        <div style="background: #f8fafc; padding: 12px; text-align: center; font-size: 11px; color: #94a3b8;">
          &copy; ${new Date().getFullYear()} Nexura Security Systems.
        </div>
      </div>
    `;

    return await sendMail({
      to: email,
      subject: 'Nexura Password Reset Verification Code',
      html
    });
  } catch (err) {
    console.warn('sendPasswordResetEmail error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getTransporter,
  sendMail,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendPasswordResetEmail
};
