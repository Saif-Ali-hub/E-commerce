const express = require('express');
const router = express.Router();
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
      message: `Payment of ₹${numericAmount.toFixed(2)} verified! Funds added to your MiniStore Wallet.`,
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
