# MiniStore E-Commerce Platform — Master Technical Documentation & Living Changelog

> **Project Name:** MiniStore E-Commerce  
> **Repository Location:** `D:\MY Projects\E-commerce`  
> **Runtime Environment:** Node.js (v18+) / Express 5.2.1 / MongoDB (Mongoose 9.11.0) / Vanilla Modern JavaScript  
> **Document Purpose:** Single authoritative source of truth for all project features, architecture, database schemas, REST APIs, business rules, and chronological changelog. Maintained continuously across all development cycles.

---

## Table of Contents
1. [Executive Summary & Technology Stack](#1-executive-summary--technology-stack)
2. [Complete Directory & File Architecture Map](#2-complete-directory--file-architecture-map)
3. [System Architecture & Data Flow](#3-system-architecture--data-flow)
4. [Master Feature Catalog & Business Logic](#4-master-feature-catalog--business-logic)
   - [4.1 Baseline Catalog & Multi-Category Engine](#41-baseline-catalog--multi-category-engine)
   - [4.2 Optional Product Variants Subsystem](#42-optional-product-variants-subsystem)
   - [4.3 Real-Time Tokenized Search & Autocomplete](#43-real-time-tokenized-search--autocomplete)
   - [4.4 Faceted Search & Multi-Filter Engine](#44-faceted-search--multi-filter-engine)
   - [4.5 Customer Questions & Answers (Q&A) with Verified Badges](#45-customer-questions--answers-qa-with-verified-badges)
   - [4.6 Product Reviews, Ratings & Moderation](#46-product-reviews-ratings--moderation)
   - [4.7 User Authentication, RBAC & Security](#47-user-authentication-rbac--security)
   - [4.8 Secure Email Password Reset with Nodemailer](#48-secure-email-password-reset-with-nodemailer)
   - [4.9 Multi-Tenant Seller Portal & Merchant Isolation](#49-multi-tenant-seller-portal--merchant-isolation)
   - [4.10 User-Isolated Embedded Cart & Wishlist](#410-user-isolated-embedded-cart--wishlist)
   - [4.11 Indian Pincode Delivery Estimator & Address Book](#411-indian-pincode-delivery-estimator--address-book)
   - [4.12 1-Click Express Checkout ("Buy Now" with Cart Isolation)](#412-1-click-express-checkout-buy-now-with-cart-isolation)
   - [4.13 Standard Multi-Item Order Lifecycle & Checkout](#413-standard-multi-item-order-lifecycle--checkout)
   - [4.14 Razorpay Payment Gateway & Cryptographic Verification](#414-razorpay-payment-gateway--cryptographic-verification)
   - [4.15 MiniStore Wallet & SuperCoins Loyalty Engine](#415-ministore-wallet--supercoins-loyalty-engine)
   - [4.16 PDF Tax Invoices & Carrier Tracking Checkpoints](#416-pdf-tax-invoices--carrier-tracking-checkpoints)
   - [4.17 Atomic Order Cancellation & Stock Restoration Engine](#417-atomic-order-cancellation--stock-restoration-engine)
   - [4.18 Festive Sale Campaigns & Real-Time Countdowns](#418-festive-sale-campaigns--real-time-countdowns)
   - [4.19 Dynamic Coupon Discount Engine](#419-dynamic-coupon-discount-engine)
   - [4.20 Interactive Celebration Engine (Physics Firecrackers)](#420-interactive-celebration-engine-physics-firecrackers)
   - [4.21 SaaS-Grade Admin Operations Dashboard](#421-saas-grade-admin-operations-dashboard)
   - [4.22 Modern Design System & Complete Light/Dark Mode](#422-modern-design-system--complete-lightdark-mode)
5. [Complete REST API Reference](#5-complete-rest-api-reference)
6. [Database Architecture & Mongoose Data Models](#6-database-architecture--mongoose-data-models)
7. [Automated Verification & Test Suites](#7-automated-verification--test-suites)
8. [Living Changelog & Evolution History](#8-living-changelog--evolution-history)
9. [Maintenance Protocol & Developer Rules](#9-maintenance-protocol--developer-rules)

---

## 1. Executive Summary & Technology Stack

MiniStore is an enterprise-grade, single-to-multi-merchant e-commerce web application. It features a completely decoupled architecture comprising an Express 5 REST API communicating with MongoDB, and a zero-dependency, ultra-fast Vanilla JavaScript client leveraging native browser standards and CSS custom properties.

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                         │
│  HTML5 + Vanilla ES6+ JS + CSS3 Custom Properties Tokens    │
│  Pages: Home, Product Details, Category Browse, Festive Sale│
│         Seller Dashboard, Order Tracking, Checkout Modals   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON / Form-Data
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND LAYER                          │
│  Node.js (v18+) + Express 5.2.1 REST API                    │
│  Middleware: authMiddleware, adminGuard, sellerGuard, CORS  │
│  Utilities: PDFKit Invoices, Nodemailer SMTP, Razorpay SDK  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Mongoose 9.11.0 ODM
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                         │
│  MongoDB Community Edition (127.0.0.1:27017/E-commerce)    │
│  Collections: products, users, orders, coupons, addresses,  │
│               salecampaigns, product_images.files (GridFS)  │
└─────────────────────────────────────────────────────────────┘
```

### Core Technology Stack
- **Server Framework:** Node.js CommonJS with Express 5.2.1
- **Database Engine:** MongoDB 7+ (Mongoose 9.11.0 ODM)
- **Binary Storage:** MongoDB GridFSBucket (`product_images`) with public filesystem disk-caching fallback
- **Security & Cryptography:** `bcryptjs` (password hashing, 10 rounds), `jsonwebtoken` (JWT bearer authorization), `crypto` (HMAC-SHA256 signature verification and SHA256 password reset tokens)
- **External Gateways & Mail:** Razorpay Payment API SDK, Nodemailer SMTP with safe local preview transporter
- **Frontend Stack:** Pure Vanilla HTML5, CSS3 Custom Properties Design System (`styles.css`), ES6+ JavaScript modules

---

## 2. Complete Directory & File Architecture Map

```
D:\MY Projects\E-commerce\
├── PROJECT_DOCUMENTATION.docx             # Master Living Documentation in Microsoft Word Format
├── PROJECT_DOCUMENTATION.md               # Master Living Documentation & Changelog (Markdown Source)
├── PROJECT_TECHNICAL_DOCUMENTATION.md      # Deep-dive architectural specification
├── backend/
│   ├── .env                                # Local backend environment fallback
│   ├── .env.example                        # Template environment variables
│   ├── package.json                        # Backend dependencies & npm scripts
│   ├── server.js                           # Express app bootstrap, route mounting & DB connection
│   ├── config/
│   │   ├── db.js                           # Mongoose connection & GridFS bucket initialization
│   │   ├── festiveDeals.js                 # Campaign discount logic & psychological pricing rules
│   │   └── mailer.js                       # Nodemailer SMTP & local Ethereal fallback transporter
│   ├── middleware/
│   │   ├── auth.js                         # JWT Bearer token validation & req.user extraction
│   │   ├── admin.js                        # Grounded database-level admin authorization guard
│   │   └── seller.js                       # Grounded seller verification guard
│   ├── models/
│   │   ├── Address.js                      # Multi-address schema with PIN code validation
│   │   ├── Coupon.js                       # Percentage & flat discount coupon validation rules
│   │   ├── Order.js                        # Complete order lifecycle, variant snapshots & tracking
│   │   ├── Product.js                      # Product schema, variants, reviews, Q&A & GridFS meta
│   │   ├── SaleCampaign.js                 # Live festival campaign metadata & timer bounds
│   │   └── User.js                         # User profile, embedded cart/wishlist, wallet & seller details
│   ├── routes/
│   │   ├── addressRoutes.js                # Shipping address CRUD & pincode estimation
│   │   ├── adminRoutes.js                  # 8-tab SaaS admin management API
│   │   ├── analyticsRoutes.js              # Revenue settlements & reporting
│   │   ├── authRoutes.js                   # Auth, JWT, password reset, profile, merchant onboard
│   │   ├── cartRoutes.js                   # Cart operations (isolated inside User.cart)
│   │   ├── orderRoutes.js                  # Order placement, 1-Click Buy Now, cancellation & invoices
│   │   ├── paymentRoutes.js                # Razorpay order generation & webhook verification
│   │   ├── productRoutes.js                # Catalog, search, facets, variants, reviews & Q&A
│   │   ├── sellerRoutes.js                 # Multi-tenant seller portal management API
│   │   └── walletRoutes.js                 # Wallet top-up, SuperCoins & transaction ledger
│   └── utils/
│       └── invoiceGenerator.js             # Automated PDF tax invoice generator (PDFKit)
├── frontend/
│   ├── index.html                          # Primary storefront, catalog, cart/wishlist & checkout modals
│   ├── app.js                              # Main storefront logic & event controller
│   ├── category.html                       # Dedicated category browse & faceted search page
│   ├── category.js                         # Faceted filtering, URL query sync & sort controller
│   ├── product-details.html                # Dedicated product view, variant picker, reviews & Q&A
│   ├── product-details.js                  # Product details page logic, Q&A actions & Buy Now modal
│   ├── seller-dashboard.html               # Multi-tenant seller portal interface
│   ├── seller-dashboard.js                 # Seller product catalog, inventory & sales analytics
│   ├── festive-sale.html                   # Dedicated festive deals & countdown campaign page
│   ├── festive-sale.js                     # Campaign hero banner, timers & filtered product grid
│   ├── firecrackers.js                     # Particle physics celebration blast engine (toggleable)
│   └── styles.css                          # Master stylesheet with Light/Dark theme CSS tokens
└── scratch/                                # Automated verification & regression test suites
    ├── test_buy_now.js                     # 1-Click express checkout & cart isolation tests (34 tests)
    ├── test_faceted_search.js              # Faceted multi-filtering & URL query sync tests (12 tests)
    ├── test_product_qa.js                  # Q&A subsystem, badges & upvote toggle tests (11 tests)
    ├── test_product_variants.js            # Product variant pricing & stock deduction tests
    ├── test_email_password_reset.js        # Password reset token generation & verify tests
    ├── test_seller_portal.js               # Multi-tenant seller isolation tests
    ├── test_order_cancellation_suite.js    # Order cancellation & atomic restock tests
    └── test_project_stability_suite.js     # Master platform health & stability suite (45 tests)
```

---

## 3. System Architecture & Data Flow

```
[ User Action / Browser ]
           │
           ├─► (Public Browse) ──► GET /api/products (Faceted filters, pagination, sort)
           ├─► (Search Bar)    ──► GET /api/products/suggestions (Autocomplete)
           ├─► (Product View)  ──► GET /api/products/:id + GET /api/products/:id/questions
           ├─► (Q&A Vote/Post) ──► POST /api/products/:id/questions[/:qid/answers[/:aid/upvote]]
           ├─► (Buy Now)       ──► POST /api/orders/buy-now (Isolated single purchase)
           ├─► (Add to Cart)   ──► POST /api/cart (Embedded user.cart)
           ├─► (Cart Checkout) ──► POST /api/orders (Standard multi-item checkout)
           ├─► (Cancel Order)  ──► POST /api/orders/:id/cancel (Atomic refund & restock)
           └─► (Seller Portal) ──► /api/seller/* (Isolated seller catalog CRUD)
```

---

## 4. Master Feature Catalog & Business Logic

### 4.1 Baseline Catalog & Multi-Category Engine
- **Item Count:** Exactly 61 baseline products distributed across 6 categories: *Electronics, Computers, Home, Kitchen, Sports, Accessories*.
- **Integrity Rule:** Baseline catalog products are permanent fixtures; automated test suites must cleanly tear down temporary test records and never delete baseline products.
- **Image Resolution:** MongoDB GridFSBucket (`product_images`) with disk-based public fallback paths.

### 4.2 Optional Product Variants Subsystem
- **Schema:** Extended `ProductSchema` with a `variants` subdocument array.
- **Attributes Supported:** `size`, `color`, `storage`, `ram`, `material`, `sku`, `price`, `stock`, `image`.
- **Inheritance:** If a variant omits price, stock, or image, it seamlessly inherits the parent product's base attributes.
- **Atomic Concurrency:** When a customer purchases a variant, stock is atomically deducted from both `variants.$.stock` and overall product `stock`. On order cancellation, both inventories are restored.

### 4.3 Real-Time Tokenized Search & Autocomplete
- **Route:** `GET /api/products/suggestions?q=` and alias `GET /api/products/search/autocomplete?q=`.
- **Search Logic:** Regex tokenization matching against `name`, `title`, `brand`, `category`, and `tags`.
- **Dropdown Preview:** High-speed dropdown with product thumbnails, category badges, and direct navigation links.

### 4.4 Faceted Search & Multi-Filter Engine
- **Page Location:** `frontend/category.html` & `frontend/category.js`.
- **Supported Facets:**
  - `minPrice` & `maxPrice`: Numerical filter against effective selling prices (considering variant overrides).
  - `rating`: Minimum customer star rating (e.g., 4★ & above).
  - `inStock`: Boolean filter isolating immediately available inventory (`stock > 0`).
  - `sortBy`: Multiple sort modes (`featured`, `price_asc`, `price_desc`, `rating_desc`, `newest`).
- **Browser URL Query Sync:** Filter states are synchronized with browser URL parameters (`?category=Electronics&minPrice=500&rating=4&inStock=true&sortBy=price_asc`), allowing filtered views to be bookmarked and shared.

### 4.5 Customer Questions & Answers (Q&A) with Verified Badges
- **Schema:** Embedded `questions` array inside `Product` containing `questionId`, `user`, `userName`, `questionText`, `createdAt`, and `answers` subdocuments.
- **Official Role Badges:**
  - **`✓ Verified Merchant`**: Automatically granted to verified sellers (`user.role === 'seller'` or `sellerDetails.verificationStatus === 'verified'`). Displayed with an emerald gradient badge.
  - **`✓ Admin`**: Granted to platform administrators (`user.role === 'admin'`). Displayed with a violet gradient badge.
  - **Regular Customers**: Receive standard author attribution without verified merchant badges.
- **Upvote Deduplication & Toggling:** Customers can upvote helpful answers. The system atomically tracks upvoters in an `upvotedBy: [ObjectId]` array. Clicking an already upvoted answer toggles the vote OFF and decrements the counter, preventing duplicate voting.
- **Prioritized Sorting:** Answers are automatically sorted so that Verified Merchant and Admin answers appear at the top, followed by highest upvote count, then newest date.

### 4.6 Product Reviews, Ratings & Moderation
- **Dynamic Rating Calculation:** On every review submission, edit, or deletion, the parent product's `averageRating` and `totalReviews` are recalculated.
- **Duplicate Prevention:** A customer may only leave one review per product; subsequent attempts update their existing review.
- **Admin Moderation:** Administrators can delete abusive reviews from the admin dashboard, triggering automatic rating recalculation.

### 4.7 User Authentication, RBAC & Security
- **Roles:** Three distinct tiers: `customer`, `seller`, and `admin`.
- **Password Security:** Salted hashes using `bcryptjs` (minimum 8 characters, requiring mixed alphanumeric characters).
- **JWT Authorization:** Standard Bearer token authentication with 7-day expiration.
- **Defense-in-Depth Authorization:** Critical operations (such as merchant actions or admin tabs) query the live MongoDB database to verify user roles rather than trusting cached JWT claims.
- **PAN Masking:** Merchant PAN records are masked (`XXXXXX1234F`) in API responses.

### 4.8 Secure Email Password Reset with Nodemailer
- **Endpoints:** `POST /api/auth/forgot-password`, `POST /api/auth/verify-reset-token`, `POST /api/auth/reset-password`.
- **Cryptographic Security:** Generates a 32-byte random hex token, hashes it via SHA-256 before saving to `user.passwordResetToken`, and enforces a 1-hour expiration timestamp.
- **Transport Reliability:** Sends branded HTML recovery emails via configured SMTP credentials. If SMTP is unconfigured in development, it automatically boots an Ethereal virtual mailer with console preview URLs.

### 4.9 Multi-Tenant Seller Portal & Merchant Isolation
- **Portal Page:** `frontend/seller-dashboard.html` & `frontend/seller-dashboard.js`.
- **Merchant Isolation:** Sellers can only view, create, edit, or manage products where `product.seller == req.user.id`. They cannot modify other sellers' catalog items.
- **Application Workflow:** Customers can apply to become sellers by providing store details and PAN number. Admins review and approve applications via `PUT /api/admin/sellers/:id/verify`.

### 4.10 User-Isolated Embedded Cart & Wishlist
- **Embedded Document Storage:** Cart items and wishlist IDs are stored directly in `user.cart` and `user.wishlist` inside the `users` collection.
- **Cross-Account Privacy:** Modifying cart or wishlist requires an authenticated user token and only manipulates the calling user's document.

### 4.11 Indian Pincode Delivery Estimator & Address Book
- **Pincode Delivery Check:** `GET /api/addresses/check-pincode/:pincode` estimates delivery window (e.g. 2–3 days for metro, 4–5 days for rest of India) and checks COD eligibility.
- **Address Book:** Allows users to save multiple delivery addresses with default selection flags.

### 4.12 1-Click Express Checkout ("Buy Now" with Cart Isolation)
- **Endpoint:** `POST /api/orders/buy-now`.
- **Strict Cart Isolation:** Purchasing via "Buy Now" never clears, overwrites, or modifies the customer's active shopping cart (`user.cart`). Items currently in the cart remain intact.
- **Variant Support:** Supports both standard products and products with variants, attaching the `selectedVariant` snapshot to the order item.
- **Payment Flexibility:** Supports Razorpay, MiniStore Wallet, and Cash on Delivery.
- **Invoice & Tracking:** Instantly generates a tax invoice (`INV-...`) and carrier tracking number (`MS-TRK-XXXXXX`).

### 4.13 Standard Multi-Item Order Lifecycle & Checkout
- **Endpoint:** `POST /api/orders`.
- **Stock Decrement:** Validates stock across all line items and decrements inventory atomically.
- **Cart Cleanup:** Upon successful multi-item order placement, `user.cart` is reset to an empty array.

### 4.14 Razorpay Payment Gateway & Cryptographic Verification
- **Order Creation:** `POST /api/payments/razorpay/create-order` creates an official Razorpay gateway order in INR paise.
- **Signature Verification:** `POST /api/payments/razorpay/verify-signature` verifies HMAC-SHA256 signatures (`razorpay_order_id + "|" + razorpay_payment_id` against `RAZORPAY_KEY_SECRET`).

### 4.15 MiniStore Wallet & SuperCoins Loyalty Engine
- **Fair Usage Ceiling:** Customers may apply wallet balance up to a maximum of 50% of the payable order subtotal.
- **SuperCoins Cashback:** Every completed purchase awards 5% cashback in SuperCoins (guaranteed minimum 10 SuperCoins).
- **Loyalty Redemption:** SuperCoins can be redeemed for wallet credits at a rate of 20 SuperCoins = ₹10.

### 4.16 PDF Tax Invoices & Carrier Tracking Checkpoints
- **Invoice Streaming:** `GET /api/orders/:id/invoice` streams a PDF document generated via PDFKit containing MiniStore branding, GST breakdown, customer address, line items, and payment status.
- **Tracking Timelines:** Orders feature simulated checkpoint milestones: *Order Confirmed ➔ Packed ➔ Shipped ➔ Out for Delivery ➔ Delivered*.

### 4.17 Atomic Order Cancellation & Stock Restoration Engine
- **Endpoint:** `POST /api/orders/:id/cancel` and `PUT /api/orders/:id/cancel`.
- **Restoration Rules:** Only orders in `Pending` or `Confirmed` status can be cancelled.
- **Automatic Refunds:** Prepaid orders (Razorpay or Wallet) immediately credit the refunded amount back to the customer's MiniStore Wallet.
- **Inventory Restock:** All line items (both parent products and specific variants) have their stock restored automatically.

### 4.18 Festive Sale Campaigns & Real-Time Countdowns
- **Dedicated Page:** `frontend/festive-sale.html`.
- **Dynamic Campaign Engine:** Managed via `backend/config/festiveDeals.js` and `SaleCampaign` model.
- **Psychological Pricing:** Discounts enforce attractive price points (e.g., ending in ₹99, ₹499).

### 4.19 Dynamic Coupon Discount Engine
- **Types:** Percentage off (`percentage` with `maxDiscountAmount` cap) and flat rupee discount (`flat`).
- **Eligibility:** Enforces `minOrderAmount`, user usage limits, and expiration dates.

### 4.20 Interactive Celebration Engine (Physics Firecrackers)
- **Module:** `frontend/firecrackers.js`.
- **Canvas Particle Physics:** Simulates realistic fireworks with gravity, air drag, sparks, and randomized velocity explosions on milestone interactions (e.g. order completion).
- **User Preference:** Equipped with a toggle switch that remembers preferences in `localStorage.getItem('firecrackers_enabled')`.

### 4.21 SaaS-Grade Admin Operations Dashboard
- **8 Operations Tabs:** Overview statistics, Merchant verification, Live sale controls, Coupon management, Product catalog CRUD, Order fulfillment & payment toggles, Customer review moderation, and Revenue analytics.

### 4.22 Modern Design System & Complete Light/Dark Mode
- **Tokens:** Comprehensive CSS custom properties for sapphire brand palette, surface cards, typography, and elevations.
- **Theme Switcher:** Toggles between light and dark modes with instantaneous persistence via `localStorage.getItem('theme')` and `data-theme="dark"` attribute on `<html>`.

---

## 5. Complete REST API Reference

### Products & Catalog (`/api/products`)
| Method | Endpoint | Auth | Description |
|:---|:---|:---:|:---|
| `GET` | `/api/products` | None | Paginated products with faceted filters (`minPrice`, `maxPrice`, `category`, `rating`, `inStock`, `sortBy`, `search`, `page`, `limit`) |
| `GET` | `/api/products/suggestions` | None | Autocomplete suggestions matching query string |
| `GET` | `/api/products/search/autocomplete`| None | Alias for suggestions autocomplete |
| `GET` | `/api/products/:id` | None | Single product details with variants, specifications, reviews |
| `GET` | `/api/products/:id/related` | None | Related product recommendations based on category & stock |
| `POST` | `/api/products` | Admin / Seller | Create a new product (sellers auto-assigned `seller` ID) |
| `PUT` | `/api/products/:id` | Admin / Seller | Update existing product (sellers restricted to own items) |
| `DELETE` | `/api/products/:id` | Admin Only | Delete product from catalog |
| `POST` | `/api/products/:id/reviews` | Auth | Submit or update a product review |
| `DELETE` | `/api/products/:id/reviews/:reviewId`| Auth / Admin | Delete review and recalculate ratings |
| `GET` | `/api/products/:id/questions` | None | Retrieve questions and sorted answers (verified priority) |
| `POST` | `/api/products/:id/questions` | Auth | Submit customer question |
| `POST` | `/api/products/:id/questions/:questionId/answers` | Auth | Submit answer (merchants/admins get verified badge) |
| `POST/PUT`| `/api/products/:id/questions/:questionId/answers/:answerId/upvote` | Auth | Toggle helpful upvote on an answer |

### Express Checkout & Orders (`/api/orders`)
| Method | Endpoint | Auth | Description |
|:---|:---|:---:|:---|
| `POST` | `/api/orders/buy-now` | Auth | 1-Click Express Checkout (preserves active customer cart) |
| `POST` | `/api/orders` | Auth | Standard multi-item order placement from cart |
| `GET` | `/api/orders/my-orders` | Auth | List authenticated customer's order history |
| `GET` | `/api/orders/:id` | Auth | Order details with shipping, line items, and tracking checkpoints |
| `POST/PUT`| `/api/orders/:id/cancel` | Auth | Cancel order, refund to wallet, restore item & variant stock |
| `GET` | `/api/orders/:id/invoice` | Auth | Stream official PDF tax invoice |

### Authentication & Users (`/api/auth`)
| Method | Endpoint | Auth | Description |
|:---|:---|:---:|:---|
| `POST` | `/api/auth/register` | None | Register new customer account |
| `POST` | `/api/auth/login` | None | Authenticate with email/password; returns JWT |
| `GET` | `/api/auth/profile` | Auth | Fetch user profile, wallet balance, and SuperCoins |
| `PUT` | `/api/auth/profile` | Auth | Update name, phone, or avatar |
| `POST` | `/api/auth/seller-register` | Auth | Submit seller merchant application with PAN |
| `POST` | `/api/auth/forgot-password` | None | Initiate password reset email with secure token |
| `POST` | `/api/auth/verify-reset-token` | None | Validate reset token prior to password entry |
| `POST` | `/api/auth/reset-password` | None | Set new password with valid cryptographic token |

### Cart & Wishlist (`/api/cart` & `/api/wishlist`)
| Method | Endpoint | Auth | Description |
|:---|:---|:---:|:---|
| `GET` | `/api/cart` | Auth | Fetch customer's active cart |
| `POST` | `/api/cart` | Auth | Add item or variant to cart |
| `PUT` | `/api/cart/:id` | Auth | Update item quantity in cart |
| `DELETE` | `/api/cart/:id` | Auth | Remove item from cart |
| `DELETE` | `/api/cart` | Auth | Clear entire shopping cart |
| `GET` | `/api/wishlist` | Auth | Fetch customer wishlist items |
| `POST` | `/api/wishlist/:productId` | Auth | Add item to wishlist (idempotent) |
| `DELETE` | `/api/wishlist/:productId` | Auth | Remove item from wishlist |

### Multi-Tenant Seller Portal (`/api/seller`)
| Method | Endpoint | Auth | Description |
|:---|:---|:---:|:---|
| `GET` | `/api/seller/dashboard` | Seller | Retrieve seller store performance, revenue & order counts |
| `GET` | `/api/seller/products` | Seller | Retrieve only products belonging to authenticated seller |
| `POST` | `/api/seller/products` | Seller | Create a new product for seller catalog |
| `PUT` | `/api/seller/products/:id` | Seller | Update seller's own product |
| `DELETE` | `/api/seller/products/:id` | Seller | Delete seller's own product |
| `GET` | `/api/seller/orders` | Seller | Orders containing seller's products |

### Payments & Gateway (`/api/payments`)
| Method | Endpoint | Auth | Description |
|:---|:---|:---:|:---|
| `POST` | `/api/payments/razorpay/create-order` | Auth | Create Razorpay order with INR amount in paise |
| `POST` | `/api/payments/razorpay/verify-signature` | Auth | Verify HMAC-SHA256 signature and confirm payment |

---

## 6. Database Architecture & Mongoose Data Models

### Summary of MongoDB Collections
```
E-commerce
├── products         # Catalog items, variants, reviews, and Q&A subdocuments
├── users            # Customer/seller/admin profiles, wallet, embedded cart & wishlist
├── orders           # Placed orders, tracking timelines, line item variant snapshots
├── coupons          # Promotional discount codes and eligibility rules
├── addresses        # Customer shipping addresses
├── salecampaigns    # Active and scheduled promotional sale campaigns
└── product_images   # GridFS bucket files (.files and .chunks)
```

### Key Schema Definitions
- **`Product.questions` Subdocument:**
  ```javascript
  {
    questionId: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    questionText: { type: String, required: true, trim: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
    answers: [{
      answerId: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      userName: { type: String, required: true },
      userRole: { type: String, enum: ['admin', 'seller', 'customer'], default: 'customer' },
      isVerifiedSeller: { type: Boolean, default: false },
      answerText: { type: String, required: true, trim: true, maxlength: 1000 },
      createdAt: { type: Date, default: Date.now },
      upvotes: { type: Number, default: 0 },
      upvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }]
  }
  ```

- **`Product.variants` Subdocument:**
  ```javascript
  {
    variantId: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    sku: { type: String, trim: true },
    size: { type: String, trim: true },
    color: { type: String, trim: true },
    storage: { type: String, trim: true },
    ram: { type: String, trim: true },
    material: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, default: 0, min: 0 },
    image: { type: String, trim: true }
  }
  ```

---

## 7. Automated Verification & Test Suites

The project maintains standalone, self-cleaning automated test suites in the `scratch/` directory:

| Test Suite File | Focus Area | Status |
|:---|:---|:---:|
| `scratch/test_project_stability_suite.js` | 45-step master platform health, auth, catalog, cart, orders, wallet, and teardown | **Passing (45/45)** |
| `scratch/test_product_qa.js` | Q&A submission, verified merchant badges, admin badges, upvote toggle & deduplication | **Passing (11/11)** |
| `scratch/test_buy_now.js` | 1-Click Express Checkout, cart isolation, variant overrides, PDF invoices | **Passing (34/34)** |
| `scratch/test_faceted_search.js` | Faceted multi-filter queries, dynamic price range, rating, inStock, sort order | **Passing (12/12)** |
| `scratch/test_email_password_reset.js` | Cryptographic password reset token generation, verification, and expiry | **Passing** |
| `scratch/test_product_variants.js` | Variant pricing overrides, inventory decrement, restock restoration | **Passing** |
| `scratch/test_order_cancellation_suite.js` | Order cancellation, atomic wallet refunds, and stock restock | **Passing** |

### Running the Test Suites:
```bash
# Execute master platform stability test suite:
$env:NODE_PATH="backend/node_modules"; node scratch/test_project_stability_suite.js

# Execute Product Q&A automated test suite:
$env:NODE_PATH="backend/node_modules"; node scratch/test_product_qa.js

# Execute 1-Click Buy Now express checkout test suite:
$env:NODE_PATH="backend/node_modules"; node scratch/test_buy_now.js

# Execute Faceted Search & Multi-Filter test suite:
$env:NODE_PATH="backend/node_modules"; node scratch/test_faceted_search.js
```

---

## 8. Living Changelog & Evolution History

### Milestone 1.0 — Initial Platform Foundation
- Bootstrapped decoupled architecture with Express 5 backend and Vanilla JS frontend.
- Seeded baseline catalog of 61 products across 6 core categories.
- Implemented JWT bearer authentication and embedded user cart/wishlist storage.
- Created PDF tax invoice generation and simulated tracking checkpoints.

### Milestone 2.0 — Commerce Hardening & Marketing Capabilities
- Integrated Razorpay payment gateway with HMAC-SHA256 signature verification.
- Implemented MiniStore Wallet with 50% fair usage checkout deduction and SuperCoins rewards.
- Built Promotional Festive Sale campaign subsystem with live countdown clocks and psychological pricing.
- Added dynamic percentage and flat coupon discount engine.
- Implemented 8-tab SaaS Admin Operations Dashboard.

### Milestone 3.0 — Advanced Commerce & Marketplace Subsystems
- **Password Reset Engine:** Integrated Nodemailer with secure SHA-256 tokens and virtual Ethereal fallback.
- **Multi-Tenant Seller Portal:** Built dedicated `seller-dashboard.html` with merchant catalog isolation and PAN verification.
- **Order Cancellation Subsystem:** Added atomic order cancellation with automated wallet refunds and stock restoration.
- **Celebration Particle Engine:** Added `firecrackers.js` with canvas physics and user toggle preference.
- **Optional Product Variants:** Engineered variants schema (size, color, storage, SKU, price/stock overrides) and selector UI.
- **1-Click Express Checkout ("Buy Now"):** Implemented dedicated single-item modal purchasing with 100% active cart preservation.
- **Faceted Search & Multi-Filter System:** Added price sliders, star rating filters, in-stock filters, sorting modes, and browser URL query parameter synchronization.
- **Product Q&A Subsystem:** Built community Questions & Answers with official `✓ Verified Merchant` and `✓ Admin` badges, answer upvote deduplication, and verified answer sorting priority.

---

## 9. Maintenance Protocol & Developer Rules

When contributing to or modifying this codebase, developers and agents must adhere to the following maintenance commitments:

1. **Keep This Document Updated:** Every new endpoint, schema change, feature addition, or configuration modification must be documented in `PROJECT_DOCUMENTATION.docs` under the appropriate feature section and logged in the Living Changelog.
2. **Preserve Baseline Catalog:** The 61 baseline catalog products must never be modified or deleted. Automated test scripts must clean up temporary test records immediately upon test completion.
3. **Cart Isolation Invariant:** The "Buy Now" flow must never modify `user.cart`. The standard cart checkout must remain independent from express checkout.
4. **Verified Badge Integrity:** Verified Merchant badges must only be rendered for users with approved seller verification status, and Admin badges must be grounded in database role checks.
5. **Theme Token Consistency:** All new UI elements must use CSS custom properties from `styles.css` to ensure seamless compatibility with both Light and Dark themes.
6. **Zero Syntax Regressions:** Always verify backend and frontend syntax (`node -c <file>`) and run `test_project_stability_suite.js` before concluding tasks.
