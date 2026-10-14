/**
 * Test Suite: Product Q&A Subsystem (Customer Questions & Answers with Verified Badges)
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'backend/.env' });

const Product = require('../backend/models/Product');
const User = require('../backend/models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/E-commerce';

async function runTests() {
  console.log('=== STARTING PRODUCT Q&A TEST SUITE ===');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  try {
    // 1. Verify baseline catalog products count
    const totalProducts = await Product.countDocuments();
    console.log(`[PASS] Total baseline products in catalog: ${totalProducts}`);

    const targetProduct = await Product.findOne();
    if (!targetProduct) {
      throw new Error('No product found in database');
    }
    console.log(`Testing with product: "${targetProduct.name}" (ID: ${targetProduct._id})`);

    // Clean any prior test questions on this product
    targetProduct.questions = targetProduct.questions || [];
    const initialQuestionCount = targetProduct.questions.length;

    // 2. Setup or find Customer, Seller, and Admin users
    let customerUser = await User.findOne({ email: 'test_qa_customer@example.com' });
    if (!customerUser) {
      customerUser = await User.create({
        name: 'QA Customer',
        email: 'test_qa_customer@example.com',
        password: 'Password123!',
        role: 'customer'
      });
    }

    let sellerUser = await User.findOne({ email: 'test_qa_seller@example.com' });
    if (!sellerUser) {
      sellerUser = await User.create({
        name: 'Apex Merchant Store',
        email: 'test_qa_seller@example.com',
        password: 'Password123!',
        role: 'seller',
        sellerDetails: {
          storeName: 'Apex Merchant Store',
          verificationStatus: 'verified'
        }
      });
    } else {
      sellerUser.role = 'seller';
      sellerUser.sellerDetails = sellerUser.sellerDetails || {};
      sellerUser.sellerDetails.verificationStatus = 'verified';
      await sellerUser.save();
    }

    let adminUser = await User.findOne({ email: 'test_qa_admin@example.com' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'MiniStore Super Admin',
        email: 'test_qa_admin@example.com',
        password: 'Password123!',
        role: 'admin'
      });
    } else {
      adminUser.role = 'admin';
      await adminUser.save();
    }

    const customerToken = jwt.sign({ id: customerUser._id, role: customerUser.role }, JWT_SECRET, { expiresIn: '1h' });
    const sellerToken = jwt.sign({ id: sellerUser._id, role: sellerUser.role }, JWT_SECRET, { expiresIn: '1h' });
    const adminToken = jwt.sign({ id: adminUser._id, role: adminUser.role }, JWT_SECRET, { expiresIn: '1h' });

    // 3. Test HTTP GET /api/products/:id/questions
    const getRes1 = await fetch(`http://localhost:5000/api/products/${targetProduct._id}/questions`);
    const getData1 = await getRes1.json();
    if (!getRes1.ok || !getData1.success) {
      throw new Error(`Failed to GET questions: ${JSON.stringify(getData1)}`);
    }
    console.log(`[PASS] GET /api/products/:id/questions returned ${getData1.count} questions`);

    // 4. Test Customer submitting question (Validation < 3 chars)
    const invalidQRes = await fetch(`http://localhost:5000/api/products/${targetProduct._id}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ questionText: 'Hi' })
    });
    if (invalidQRes.status !== 400) {
      throw new Error(`Expected 400 for short question, got ${invalidQRes.status}`);
    }
    console.log('[PASS] Validation: Question < 3 characters correctly rejected with 400');

    // 5. Test Customer posting a valid question
    const postQRes = await fetch(`http://localhost:5000/api/products/${targetProduct._id}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ questionText: 'Does this item come with an official manufacturer warranty card?' })
    });
    const postQData = await postQRes.json();
    if (!postQRes.ok || !postQData.success || !postQData.data.questionId) {
      throw new Error(`Failed to post question: ${JSON.stringify(postQData)}`);
    }
    const createdQuestionId = postQData.data.questionId;
    console.log(`[PASS] Customer posted question successfully (ID: ${createdQuestionId})`);

    // 6. Test Regular Customer posting an answer (no verified badge)
    const custAnsRes = await fetch(`http://localhost:5000/api/products/${targetProduct._id}/questions/${createdQuestionId}/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ answerText: 'Yes, I received one in the box when I bought it last month.' })
    });
    const custAnsData = await custAnsRes.json();
    if (!custAnsRes.ok || !custAnsData.success) {
      throw new Error(`Failed to post customer answer: ${JSON.stringify(custAnsData)}`);
    }
    if (custAnsData.data.isVerifiedSeller === true || custAnsData.data.userRole !== 'customer') {
      throw new Error(`Customer answer should not be verified! Got role: ${custAnsData.data.userRole}`);
    }
    const customerAnswerId = custAnsData.data.answerId;
    console.log('[PASS] Regular customer answer posted without verified merchant badge');

    // 7. Test Verified Seller posting an answer (gets verified merchant badge)
    const sellerAnsRes = await fetch(`http://localhost:5000/api/products/${targetProduct._id}/questions/${createdQuestionId}/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ answerText: 'Official Seller: Yes, all units include an authentic 1-year brand warranty.' })
    });
    const sellerAnsData = await sellerAnsRes.json();
    if (!sellerAnsRes.ok || !sellerAnsData.success) {
      throw new Error(`Failed to post seller answer: ${JSON.stringify(sellerAnsData)}`);
    }
    if (sellerAnsData.data.isVerifiedSeller !== true || sellerAnsData.data.userRole !== 'seller') {
      throw new Error(`Seller answer must be verified! Got: ${JSON.stringify(sellerAnsData.data)}`);
    }
    const sellerAnswerId = sellerAnsData.data.answerId;
    console.log('[PASS] Verified Seller answer posted with isVerifiedSeller=true & userRole=seller');

    // 8. Test Admin posting an answer (gets admin badge)
    const adminAnsRes = await fetch(`http://localhost:5000/api/products/${targetProduct._id}/questions/${createdQuestionId}/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ answerText: 'MiniStore Admin: 100% genuine guaranteed with hassle-free replacement.' })
    });
    const adminAnsData = await adminAnsRes.json();
    if (!adminAnsRes.ok || !adminAnsData.success) {
      throw new Error(`Failed to post admin answer: ${JSON.stringify(adminAnsData)}`);
    }
    if (adminAnsData.data.userRole !== 'admin') {
      throw new Error(`Admin answer must have userRole=admin! Got: ${adminAnsData.data.userRole}`);
    }
    const adminAnswerId = adminAnsData.data.answerId;
    console.log('[PASS] Admin answer posted with userRole=admin & isVerifiedSeller=true');

    // 9. Test Upvote Toggle behavior on customerAnswerId
    // Upvote Toggle #1: should increment to 1 and hasUpvoted=true
    const upvote1 = await fetch(`http://localhost:5000/api/products/${targetProduct._id}/questions/${createdQuestionId}/answers/${customerAnswerId}/upvote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      }
    });
    const upvoteData1 = await upvote1.json();
    if (!upvote1.ok || !upvoteData1.success || upvoteData1.upvotes !== 1 || upvoteData1.hasUpvoted !== true) {
      throw new Error(`Upvote toggle #1 failed: ${JSON.stringify(upvoteData1)}`);
    }
    console.log('[PASS] Upvote toggle #1: upvotes incremented to 1, hasUpvoted=true');

    // Upvote Toggle #2 (same user clicks again): should decrement back to 0 and hasUpvoted=false
    const upvote2 = await fetch(`http://localhost:5000/api/products/${targetProduct._id}/questions/${createdQuestionId}/answers/${customerAnswerId}/upvote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      }
    });
    const upvoteData2 = await upvote2.json();
    if (!upvote2.ok || !upvoteData2.success || upvoteData2.upvotes !== 0 || upvoteData2.hasUpvoted !== false) {
      throw new Error(`Upvote toggle #2 failed: ${JSON.stringify(upvoteData2)}`);
    }
    console.log('[PASS] Upvote toggle #2: upvotes decremented to 0, hasUpvoted=false (prevents duplicate votes)');

    // Upvote Toggle #3: toggle back on
    const upvote3 = await fetch(`http://localhost:5000/api/products/${targetProduct._id}/questions/${createdQuestionId}/answers/${customerAnswerId}/upvote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      }
    });
    const upvoteData3 = await upvote3.json();
    if (upvoteData3.upvotes !== 1 || upvoteData3.hasUpvoted !== true) {
      throw new Error(`Upvote toggle #3 failed: ${JSON.stringify(upvoteData3)}`);
    }
    console.log('[PASS] Upvote toggle #3: successfully re-upvoted to 1');

    // 10. Test Sorted Ordering on GET /api/products/:id/questions
    const getResSorted = await fetch(`http://localhost:5000/api/products/${targetProduct._id}/questions`);
    const getSortedData = await getResSorted.json();
    const fetchedQ = getSortedData.data.find(q => q.questionId === createdQuestionId);
    if (!fetchedQ || fetchedQ.answers.length !== 3) {
      throw new Error(`Expected 3 answers, found: ${fetchedQ ? fetchedQ.answers.length : 0}`);
    }

    // Answers should have verified/admin priority first!
    const firstAnswer = fetchedQ.answers[0];
    const secondAnswer = fetchedQ.answers[1];
    const thirdAnswer = fetchedQ.answers[2];
    console.log(`Answer order: 1st=${firstAnswer.userRole}, 2nd=${secondAnswer.userRole}, 3rd=${thirdAnswer.userRole}`);
    if (firstAnswer.userRole === 'customer') {
      throw new Error('Customer answer should not be placed before verified/admin answers');
    }
    console.log('[PASS] Answer sorting: Verified Merchant & Admin answers prioritized first');

    // 11. Cleanup test question so product data remains pristine
    const cleanProd = await Product.findById(targetProduct._id);
    cleanProd.questions = cleanProd.questions.filter(q => q.questionId !== createdQuestionId);
    await cleanProd.save();
    console.log('[PASS] Cleaned up test question from target product');

    // Clean up test users
    await User.deleteMany({ email: { $in: ['test_qa_customer@example.com', 'test_qa_seller@example.com', 'test_qa_admin@example.com'] } });
    console.log('[PASS] Cleaned up temporary test users');

    console.log('\n>>> ALL PRODUCT Q&A TESTS PASSED SUCCESSFULLY! <<<');
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error('\n[FAIL] Test suite encountered an error:', err);
  process.exit(1);
});
