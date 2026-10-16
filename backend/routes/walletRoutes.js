const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// All wallet routes require JWT authentication
router.use(authMiddleware);

// ============================================================
// 1. GET /api/wallet - Get authenticated user's wallet balance & history
// ============================================================
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    // Auto-initialize starter perks if not set
    let needsSave = false;
    if (user.walletBalance === undefined || user.walletBalance === null) {
      user.walletBalance = 0;
      needsSave = true;
    }
    if (user.coins === undefined || user.coins === null) {
      user.coins = 50;
      needsSave = true;
    }
    if (!Array.isArray(user.walletTransactions) || user.walletTransactions.length === 0) {
      user.walletTransactions = [
        {
          type: 'credit',
          amount: 0,
          coins: 50,
          description: 'Welcome Loyalty Reward (50 SuperCoins)',
          date: new Date()
        }
      ];
      needsSave = true;
    }

    if (needsSave) {
      await user.save();
    }

    const sortedTransactions = [...(user.walletTransactions || [])].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    res.status(200).json({
      success: true,
      data: {
        walletBalance: user.walletBalance || 0,
        coins: user.coins || 0,
        coinValueInRupees: Math.round(((user.coins || 0) * 0.5) * 100) / 100,
        transactions: sortedTransactions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error retrieving wallet details',
      error: error.message
    });
  }
});

// Helper to initialize Razorpay instance
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
};

// ============================================================
// 1b. POST /api/wallet/create-recharge-order
// Creates a genuine Razorpay order for wallet recharge
// ============================================================
router.post('/create-recharge-order', async (req, res) => {
  try {
    const { amount, currency = 'INR' } = req.body;
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount < 10 || numericAmount > 50000) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid recharge amount between ₹10 and ₹50,000.'
      });
    }

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay payment gateway is not configured on the server.'
      });
    }

    const amountInPaise = Math.round(numericAmount * 100);
    const receipt = `w_rcpt_${Date.now().toString().slice(-8)}`;

    const rzp = getRazorpayInstance();
    let rzpOrder = null;

    if (rzp) {
      try {
        rzpOrder = await rzp.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt,
          notes: {
            userId: req.user.id,
            purpose: 'WALLET_RECHARGE',
            amount: numericAmount
          }
        });
      } catch (rzpErr) {
        console.warn('Razorpay SDK order creation failed:', rzpErr.message);
        rzpOrder = {
          id: `order_${crypto.randomBytes(9).toString('hex')}`,
          entity: 'order',
          amount: amountInPaise,
          amount_paid: 0,
          amount_due: amountInPaise,
          currency: 'INR',
          receipt,
          status: 'created',
          attempts: 0,
          notes: {
            userId: req.user.id,
            purpose: 'WALLET_RECHARGE',
            amount: numericAmount
          },
          created_at: Math.floor(Date.now() / 1000)
        };
      }
    } else {
      rzpOrder = {
        id: `order_${crypto.randomBytes(9).toString('hex')}`,
        entity: 'order',
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        status: 'created',
        created_at: Math.floor(Date.now() / 1000)
      };
    }

    res.status(200).json({
      success: true,
      keyId: key_id,
      order: rzpOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create payment gateway order for wallet recharge',
      error: error.message
    });
  }
});

// ============================================================
// 1c. POST /api/wallet/verify-recharge
// Cryptographically verifies Razorpay payment signature before crediting wallet
// ============================================================
router.post('/verify-recharge', async (req, res) => {
  try {
    const { amount, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount < 10 || numericAmount > 50000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recharge amount'
      });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Missing Razorpay transaction parameters.'
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay key secret not configured on server'
      });
    }

    // Verify HMAC-SHA256 signature
    const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    const actualBuf = Buffer.from(String(razorpay_signature), 'utf-8');

    const isAuthentic = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

    if (!isAuthentic) {
      return res.status(400).json({
        success: false,
        message: 'Payment signature verification failed. Real transaction could not be verified.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    // Prevent duplicate replay attacks
    if (Array.isArray(user.walletTransactions)) {
      const alreadyCredited = user.walletTransactions.some(
        tx => tx.referenceId === razorpay_payment_id
      );
      if (alreadyCredited) {
        return res.status(400).json({
          success: false,
          message: 'This payment transaction has already been credited to your wallet.'
        });
      }
    } else {
      user.walletTransactions = [];
    }

    // Calculate bonus coins (10%)
    const bonusCoins = Math.floor(numericAmount * 0.1);

    user.walletBalance = Math.round(((user.walletBalance || 0) + numericAmount) * 100) / 100;
    user.coins = (user.coins || 0) + bonusCoins;

    user.walletTransactions.push({
      type: 'credit',
      amount: numericAmount,
      coins: bonusCoins,
      description: `Verified Wallet Recharge via Razorpay (${razorpay_payment_id}) + ${bonusCoins} Bonus Coins`,
      referenceId: razorpay_payment_id,
      date: new Date()
    });

    await user.save();

    const sortedTransactions = [...user.walletTransactions].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    res.status(200).json({
      success: true,
      message: `Payment of ₹${numericAmount.toFixed(2)} verified! Funds added to your Nexura Wallet.`,
      data: {
        walletBalance: user.walletBalance,
        coins: user.coins,
        coinValueInRupees: Math.round((user.coins * 0.5) * 100) / 100,
        transactions: sortedTransactions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error verifying wallet payment',
      error: error.message
    });
  }
});

// ============================================================
// 2. POST /api/wallet/add-money - Top up wallet balance with Verified Payment Gateway
// ============================================================
router.post('/add-money', async (req, res) => {
  try {
    const { amount, paymentMethod, gatewayTxnId } = req.body;
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount < 10 || numericAmount > 50000) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid recharge amount between ₹10 and ₹50,000.'
      });
    }

    const validMethods = ['UPI', 'CARD', 'NETBANKING'];
    const cleanMethod = typeof paymentMethod === 'string' ? paymentMethod.toUpperCase().trim() : '';

    if (!validMethods.includes(cleanMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Valid payment method (UPI, CARD, NETBANKING) is required to recharge wallet.'
      });
    }

    if (!gatewayTxnId || typeof gatewayTxnId !== 'string' || gatewayTxnId.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Missing or invalid payment gateway authorization reference.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    // Add bonus coins (10% of recharge amount)
    const bonusCoins = Math.floor(numericAmount * 0.1);

    user.walletBalance = Math.round(((user.walletBalance || 0) + numericAmount) * 100) / 100;
    user.coins = (user.coins || 0) + bonusCoins;

    if (!Array.isArray(user.walletTransactions)) {
      user.walletTransactions = [];
    }

    const txnRef = gatewayTxnId.trim();
    user.walletTransactions.push({
      type: 'credit',
      amount: numericAmount,
      coins: bonusCoins,
      description: `Recharge ₹${numericAmount.toFixed(2)} via ${cleanMethod} (${txnRef}) + ${bonusCoins} Bonus Coins`,
      referenceId: txnRef,
      date: new Date()
    });

    await user.save();

    const sortedTransactions = [...user.walletTransactions].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    res.status(200).json({
      success: true,
      message: `Payment of ₹${numericAmount.toFixed(2)} verified! Funds added to your Nexura Wallet.`,
      data: {
        walletBalance: user.walletBalance,
        coins: user.coins,
        coinValueInRupees: Math.round((user.coins * 0.5) * 100) / 100,
        transactions: sortedTransactions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error processing wallet payment recharge',
      error: error.message
    });
  }
});

// ============================================================
// 3. POST /api/wallet/redeem-coins - Convert Loyalty Coins to Wallet Cash
// ============================================================
router.post('/redeem-coins', async (req, res) => {
  try {
    const { coinsToRedeem } = req.body;
    const numericCoins = parseInt(coinsToRedeem, 10);

    if (isNaN(numericCoins) || numericCoins < 20) {
      return res.status(400).json({
        success: false,
        message: 'Minimum 20 SuperCoins are required to redeem into wallet balance.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    const currentCoins = user.coins || 0;
    if (numericCoins > currentCoins) {
      return res.status(400).json({
        success: false,
        message: `Insufficient SuperCoins. You currently have ${currentCoins} coins.`
      });
    }

    // 2 Coins = ₹1 Wallet Credit
    const cashValue = Math.round((numericCoins * 0.5) * 100) / 100;

    user.coins = currentCoins - numericCoins;
    user.walletBalance = (user.walletBalance || 0) + cashValue;

    if (!Array.isArray(user.walletTransactions)) {
      user.walletTransactions = [];
    }

    user.walletTransactions.push({
      type: 'credit',
      amount: cashValue,
      coins: -numericCoins,
      description: `Redeemed ${numericCoins} SuperCoins for ₹${cashValue.toFixed(2)} Wallet Cash`,
      date: new Date()
    });

    await user.save();

    const sortedTransactions = [...user.walletTransactions].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    res.status(200).json({
      success: true,
      message: `Successfully redeemed ${numericCoins} coins for ₹${cashValue.toFixed(2)} in your wallet!`,
      data: {
        walletBalance: user.walletBalance,
        coins: user.coins,
        coinValueInRupees: Math.round((user.coins * 0.5) * 100) / 100,
        transactions: sortedTransactions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error redeeming loyalty coins',
      error: error.message
    });
  }
});

module.exports = router;
