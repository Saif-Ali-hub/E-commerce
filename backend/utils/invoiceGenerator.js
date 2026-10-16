const PDFDocument = require('pdfkit');

/**
 * Generates an official, printable Tax Invoice PDF as a Buffer in memory
 * @param {Object} order - MiniStore Order document
 * @returns {Promise<Buffer>} - Resolves with the generated PDF Buffer
 */
function generateInvoicePDF(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 45, size: 'A4' });
      const buffers = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const orderObj = order.toObject ? order.toObject() : order;
      const orderId = orderObj.orderId || orderObj._id?.toString() || 'ORD001';
      const invoiceNumber = orderObj.invoiceNumber || `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${orderId.toString().slice(-4).toUpperCase()}`;
      const orderDate = new Date(orderObj.createdAt || Date.now()).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      const trackingNumber = orderObj.tracking?.trackingNumber || `NX-TRK-${orderId.toString().slice(-6).toUpperCase()}`;
      const carrier = orderObj.tracking?.carrier || 'Nexura Express';

      // --------------------------------------------------
      // Header Section
      // --------------------------------------------------
      doc
        .fillColor('#1e3a8a')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('Nexura', 45, 45);

      doc
        .fillColor('#64748b')
        .fontSize(9)
        .font('Helvetica')
        .text('Official Tax Invoice & Delivery Receipt', 45, 72)
        .text('Nexura Retail Pvt. Ltd. | GSTIN: 27AABCM8291Q1Z4', 45, 84);

      // Right-aligned Invoice Metadata Box
      doc
        .fillColor('#0f172a')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('TAX INVOICE', 350, 45, { align: 'right' });

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#475569')
        .text(`Invoice No: ${invoiceNumber}`, 350, 64, { align: 'right' })
        .text(`Order ID: #${orderId}`, 350, 76, { align: 'right' })
        .text(`Invoice Date: ${orderDate}`, 350, 88, { align: 'right' });

      // Horizontal separator rule
      doc
        .strokeColor('#e2e8f0')
        .lineWidth(1)
        .moveTo(45, 108)
        .lineTo(550, 108)
        .stroke();

      // --------------------------------------------------
      // Billing & Shipping Information
      // --------------------------------------------------
      const addr = orderObj.shippingAddress || {};
      const buyerName = addr.fullName || 'Valued Customer';
      const buyerPhone = addr.phone || '';
      const addressLine1 = addr.addressLine1 || 'Delivery Address on File';
      const addressLine2 = addr.addressLine2 ? `${addr.addressLine2}, ` : '';
      const cityStateZip = `${addr.city || 'City'}, ${addr.state || 'State'} - ${addr.postalCode || 'Postal'}`;
      const country = addr.country || 'India';

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('BILLED & SHIPPED TO:', 45, 122);

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(buyerName, 45, 138);

      doc
        .font('Helvetica')
        .fillColor('#475569')
        .text(buyerPhone ? `Phone: ${buyerPhone}` : '', 45, 150)
        .text(`${addressLine1}, ${addressLine2}`, 45, 162)
        .text(`${cityStateZip}, ${country}`, 45, 174);

      // Payment & Logistics Box (Right side)
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('PAYMENT & FULFILLMENT:', 350, 122, { align: 'right' });

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#475569')
        .text(`Payment Method: ${orderObj.paymentMethod || 'Online'}`, 350, 138, { align: 'right' })
        .text(`Payment Status: ${orderObj.paymentStatus || 'Pending'}`, 350, 150, { align: 'right' });

      if (orderObj.paymentReference || orderObj.razorpayPaymentId) {
        const refId = orderObj.razorpayPaymentId || orderObj.paymentReference;
        doc.text(`Ref / Txn ID: ${refId}`, 350, 162, { align: 'right' });
      }

      doc
        .text(`Carrier: ${carrier}`, 350, 174, { align: 'right' })
        .text(`AWB / Tracking: ${trackingNumber}`, 350, 186, { align: 'right' });

      // --------------------------------------------------
      // Items Table Header
      // --------------------------------------------------
      const tableTop = 215;

      doc
        .rect(45, tableTop, 505, 22)
        .fillColor('#f1f5f9')
        .fill();

      doc
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .fillColor('#334155')
        .text('ITEM DESCRIPTION', 55, tableTop + 6)
        .text('QTY', 330, tableTop + 6, { width: 40, align: 'center' })
        .text('UNIT PRICE', 380, tableTop + 6, { width: 75, align: 'right' })
        .text('SUBTOTAL', 465, tableTop + 6, { width: 75, align: 'right' });

      // --------------------------------------------------
      // Table Line Items
      // --------------------------------------------------
      let y = tableTop + 28;
      const items = Array.isArray(orderObj.items) && orderObj.items.length > 0
        ? orderObj.items
        : (orderObj.products || []);

      items.forEach((item, index) => {
        const name = item.name || (item.product && item.product.name) || `Item #${index + 1}`;
        const qty = item.quantity || 1;
        const price = Number(item.price !== undefined ? item.price : (item.unitPrice || 0));
        const subtotal = Number(item.subtotal !== undefined ? item.subtotal : (price * qty));

        doc
          .fontSize(8.5)
          .font('Helvetica')
          .fillColor('#0f172a')
          .text(name, 55, y, { width: 265, ellipsis: true })
          .text(String(qty), 330, y, { width: 40, align: 'center' })
          .text(`INR ${price.toFixed(2)}`, 380, y, { width: 75, align: 'right' })
          .font('Helvetica-Bold')
          .text(`INR ${subtotal.toFixed(2)}`, 465, y, { width: 75, align: 'right' });

        y += 20;

        // Thin separator between items
        doc
          .strokeColor('#f1f5f9')
          .lineWidth(0.5)
          .moveTo(45, y - 4)
          .lineTo(550, y - 4)
          .stroke();
      });

      // --------------------------------------------------
      // Financial Summary Box
      // --------------------------------------------------
      const summaryTop = Math.max(y + 15, 360);

      doc
        .strokeColor('#cbd5e1')
        .lineWidth(1)
        .moveTo(330, summaryTop)
        .lineTo(550, summaryTop)
        .stroke();

      const subtotalVal = Number(orderObj.subtotalAmount || orderObj.totalAmount || 0);
      const discountVal = Number(orderObj.discountAmount || (orderObj.coupon?.discountAmount || 0));
      const walletVal = Number(orderObj.walletDiscount || 0);
      const grandTotalVal = Number(orderObj.totalAmount !== undefined ? orderObj.totalAmount : (orderObj.total || 0));

      let curY = summaryTop + 8;

      // Subtotal Row
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#475569')
        .text('Items Subtotal:', 340, curY)
        .text(`INR ${subtotalVal.toFixed(2)}`, 465, curY, { width: 75, align: 'right' });
      curY += 15;

      // Coupon Discount Row (if any)
      if (discountVal > 0) {
        const couponCode = orderObj.coupon?.code ? ` (${orderObj.coupon.code})` : '';
        doc
          .fillColor('#059669')
          .text(`Coupon Savings${couponCode}:`, 340, curY)
          .text(`- INR ${discountVal.toFixed(2)}`, 465, curY, { width: 75, align: 'right' });
        curY += 15;
      }

      // Wallet Deduction Row (if any)
      if (walletVal > 0) {
        doc
          .fillColor('#059669')
          .text('Nexura Wallet Applied:', 340, curY)
          .text(`- INR ${walletVal.toFixed(2)}`, 465, curY, { width: 75, align: 'right' });
        curY += 15;
      }

      // Delivery Charge Row
      doc
        .fillColor('#475569')
        .text('Standard Delivery:', 340, curY)
        .text('FREE', 465, curY, { width: 75, align: 'right' });
      curY += 18;

      // Grand Total Highlight
      doc
        .rect(330, curY - 4, 220, 26)
        .fillColor('#eff6ff')
        .fill();

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#1e3a8a')
        .text('Grand Total:', 340, curY + 4)
        .fontSize(11)
        .text(`INR ${grandTotalVal.toFixed(2)}`, 450, curY + 3, { width: 90, align: 'right' });

      // --------------------------------------------------
      // Footer & Disclaimer
      // --------------------------------------------------
      const footerY = 740;

      doc
        .strokeColor('#e2e8f0')
        .lineWidth(0.8)
        .moveTo(45, footerY)
        .lineTo(550, footerY)
        .stroke();

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text('Thank you for shopping with Nexura! For return requests or queries, visit Help & Support or contact support@nexura.com', 45, footerY + 8, { align: 'center', width: 505 })
        .text('This is a digitally generated tax invoice and does not require a physical signature.', 45, footerY + 20, { align: 'center', width: 505 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateInvoicePDF
};
