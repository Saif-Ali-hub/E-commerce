const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// ============================================================
// 1. POST /api/contacts - Submit a contact / support inquiry
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name and message are required'
      });
    }

    const contact = new Contact({
      name: name.trim(),
      email: email ? email.trim() : '',
      phone: phone ? phone.trim() : '',
      message: message.trim()
    });

    const saved = await contact.save();

    res.status(201).json({
      success: true,
      message: 'Inquiry received successfully. Our team will contact you shortly.',
      data: saved
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error submitting contact inquiry',
      error: error.message
    });
  }
});

// ============================================================
// 2. GET /api/contacts - Retrieve all contact inquiries (Admin only)
// ============================================================
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const contacts = await Contact.find({}).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving contacts',
      error: error.message
    });
  }
});

module.exports = router;
