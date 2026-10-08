const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');

// Comprehensive realistic retail catalog (Indian Rupee INR)
// Exactly 5 categories: Electronics, Kitchen, Accessories, Home, Sports
// 60 total standardized products (Zero duplicates, professional e-commerce names)
const catalogProducts = [
  // ==========================================
  // CATEGORY: Electronics (13 products)
  // ==========================================
  {
    name: 'Mechanical Gaming Keyboard',
    oldName: 'Mechanical Gaming Keyboard',
    category: 'Electronics',
    price: 1299,
    stock: 15,
    description: 'Precision mechanical keyboard with responsive tactile switches, dynamic RGB backlighting, and durable aluminum top plate.',
    image: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Wireless Noise-Canceling Headphones',
    oldName: 'Wireless Noise-Canceling Headphones',
    category: 'Electronics',
    price: 3499,
    stock: 12,
    description: 'Over-ear Bluetooth headphones with premium active noise cancellation, 40-hour battery life, and crystal-clear sound.',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Smart Fitness Watch',
    oldName: 'Smart Fitness Watch',
    category: 'Electronics',
    price: 2499,
    stock: 20,
    description: 'Waterproof smartwatch featuring continuous heart-rate tracking, sleep insights, GPS tracking, and 7-day battery life.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: '4K USB-C Monitor',
    oldName: 'Ultra-Slim 4K USB-C Monitor',
    category: 'Electronics',
    price: 18499,
    stock: 15,
    description: '27-inch IPS UHD 4K display with 99% sRGB color gamut, HDR400, USB-C 65W power delivery, and ultra-thin bezel design.',
    image: 'https://images.unsplash.com/photo-1666771410140-0573b232426e?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Wireless Vertical Mouse',
    oldName: 'Ergonomic Wireless Vertical Mouse',
    category: 'Electronics',
    price: 1499,
    stock: 25,
    description: 'Natural handshake angle ergonomic mouse with adjustable DPI switch, silent click buttons, and dual Bluetooth/2.4GHz connectivity.',
    image: 'https://images.unsplash.com/photo-1750767303635-4df246680549?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Waterproof Bluetooth Speaker',
    oldName: 'Portable Waterproof Bluetooth Speaker',
    category: 'Electronics',
    price: 2199,
    stock: 30,
    description: 'Compact 360-degree wireless speaker with deep bass radiator, IPX7 waterproof rating, and 16-hour continuous playback time.',
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Wireless ANC Earbuds',
    oldName: 'True Wireless Stereo Earbuds with ANC',
    category: 'Electronics',
    price: 2999,
    stock: 20,
    description: 'In-ear wireless earbuds featuring active noise cancellation, transparency mode, wireless charging case, and IPX5 sweat resistance.',
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: '65W GaN Fast Charger',
    oldName: 'High-Speed 65W GaN Fast Charger',
    category: 'Electronics',
    price: 1299,
    stock: 40,
    description: 'Compact Gallium Nitride wall charger with dual USB-C Power Delivery and USB-A quick charge ports for laptops and smartphones.',
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: '1080p Streaming Webcam',
    oldName: 'Full HD 1080p Streaming Webcam',
    category: 'Electronics',
    price: 1899,
    stock: 18,
    description: 'Pro streaming webcam with dual omnidirectional stereo microphones, auto low-light correction, and built-in physical privacy shutter.',
    image: '/images/streaming_webcam.jpg'
  },
  {
    name: '10,000mAh Magnetic Power Bank',
    oldName: '10,000mAh Magnetic Wireless Power Bank',
    category: 'Electronics',
    price: 1699,
    stock: 25,
    description: 'Slim MagSafe compatible portable battery pack with 15W wireless output, foldable kickstand, and 20W PD bidirectional fast charging.',
    image: '/images/magnetic_powerbank.jpg'
  },
  {
    name: '7-in-1 USB-C Hub',
    oldName: 'USB-C 7-in-1 Aluminum Multiport Hub',
    category: 'Electronics',
    price: 1799,
    stock: 35,
    description: 'Precision-milled aluminum docking hub featuring 4K HDMI, 100W PD pass-through, dual USB 3.0 ports, and SD/TF card readers.',
    image: 'https://images.unsplash.com/photo-1760376789487-994070337c76?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'USB Condenser Microphone',
    oldName: 'Studio Condenser USB Microphone',
    category: 'Electronics',
    price: 3299,
    stock: 14,
    description: 'Cardioid condenser microphone with tap-to-mute sensor, LED status indicator, gain adjustment dial, and zero-latency headphone monitoring.',
    image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'RGB Gaming Soundbar',
    oldName: 'RGB Curved Gaming Soundbar',
    category: 'Electronics',
    price: 1999,
    stock: 22,
    description: 'Under-monitor stereo soundbar with dynamic dual drivers, Bluetooth 5.3 + Aux inputs, and customizable rhythmic lighting modes.',
    image: 'https://images.unsplash.com/photo-1557376382-e96b6778ffdc?w=800&auto=format&fit=crop&q=80'
  },

  // ==========================================
  // CATEGORY: Kitchen (12 products)
  // ==========================================
  {
    name: 'Ceramic Coffee Dripper',
    oldName: 'Ceramic Pour-Over Coffee Dripper',
    category: 'Kitchen',
    price: 799,
    stock: 18,
    description: 'Artisan ceramic coffee dripper engineered for optimal flow rate and uniform water distribution for clean, aromatic coffee.',
    image: 'https://images.unsplash.com/photo-1617590591232-26315f8482cb?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Stainless Steel Chef\'s Knife',
    oldName: 'Stainless Steel Chef\'s Knife',
    category: 'Kitchen',
    price: 1199,
    stock: 14,
    description: '8-inch precision-forged high-carbon German stainless steel knife with ergonomic wooden handle for seamless slicing.',
    image: 'https://images.unsplash.com/photo-1593618998160-e34014e67546?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Electric Gooseneck Kettle',
    oldName: 'Electric Gooseneck Temperature Kettle',
    category: 'Kitchen',
    price: 2699,
    stock: 16,
    description: 'Precision pour-over kettle with digital LED base, 1-degree temperature control, 60-minute keep-warm function, and matte black finish.',
    image: 'https://images.unsplash.com/photo-1592417766326-088bf3da80c5?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Cast Iron Dutch Oven',
    oldName: 'Cast Iron Pre-Seasoned Dutch Oven',
    category: 'Kitchen',
    price: 2499,
    stock: 12,
    description: 'Heavy-duty 5-quart enameled cast iron Dutch oven with self-basting condensation lid and dual side handles for braising and baking.',
    image: 'https://images.unsplash.com/photo-1556911820-1238441ed1a7?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Bamboo Cutting Board',
    oldName: 'Premium Organic Bamboo Cutting Board',
    category: 'Kitchen',
    price: 899,
    stock: 35,
    description: 'Extra-large thick end-grain organic bamboo chopping board with deep juice groove, non-slip silicone feet, and knife-friendly surface.',
    image: 'https://images.unsplash.com/photo-1624811533744-f85d5325d49c?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Manual Burr Coffee Grinder',
    oldName: 'Stainless Steel Manual Burr Coffee Grinder',
    category: 'Kitchen',
    price: 1399,
    stock: 20,
    description: 'Handheld coffee mill with CNC conical stainless steel burrs, dual bearing stabilization, and micro-stepped grind size adjustment.',
    image: 'https://images.unsplash.com/photo-1573066380308-24ff4c273dbc?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Non-Stick Frying Pan',
    oldName: 'Non-Stick Hard Anodized Frying Pan',
    category: 'Kitchen',
    price: 1299,
    stock: 24,
    description: '10-inch scratch-resistant induction compatible skillet with 3-layer granite non-stick coating and stay-cool riveted stainless handle.',
    image: 'https://images.unsplash.com/photo-1592156328697-079f6ee0cfa5?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Digital Kitchen Scale',
    oldName: 'High-Precision Digital Kitchen Scale',
    category: 'Kitchen',
    price: 649,
    stock: 40,
    description: 'Ultra-slim tempered glass food scale with 1g/0.05oz precision graduation, tare function, touch sensor controls, and backlit LCD.',
    image: 'https://images.unsplash.com/photo-1753091122032-ddfb454849cc?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Borosilicate Glass French Press',
    oldName: 'Double-Walled Borosilicate Glass French Press',
    category: 'Kitchen',
    price: 1099,
    stock: 18,
    description: '1-liter thermal insulated glass French press with 4-level stainless steel filtration system to ensure rich sediment-free brew.',
    image: 'https://images.unsplash.com/photo-1708127368781-cd5f069a90a5?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Silicone Cooking Utensil Set',
    oldName: 'Silicone Heat-Resistant Utensil Set',
    category: 'Kitchen',
    price: 999,
    stock: 28,
    description: '12-piece BPA-free food-grade cooking utensils with natural acacia hardwood handles, non-scratch silicone heads, and matching holder.',
    image: 'https://images.unsplash.com/photo-1587742378970-0c834078a7ce?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Glass Food Storage Canisters',
    oldName: 'Airtight Borosilicate Food Storage Canisters',
    category: 'Kitchen',
    price: 1199,
    stock: 22,
    description: 'Set of 5 clear glass pantry containers with natural bamboo suction lids and silicone sealing rings for cereal, pasta, and spices.',
    image: 'https://images.unsplash.com/photo-1594813591867-02e797aa4581?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Stainless Steel Garlic Press',
    oldName: 'Heavy-Duty Stainless Steel Garlic Press',
    category: 'Kitchen',
    price: 499,
    stock: 45,
    description: 'Ergonomic rocker garlic press crafted from solid 304 food-grade stainless steel with non-slip handle and quick rinse cleaning.',
    image: 'https://images.unsplash.com/photo-1780789529280-b989601c53f2?w=800&auto=format&fit=crop&q=80'
  },

  // ==========================================
  // CATEGORY: Accessories (12 products)
  // ==========================================
  {
    name: 'Canvas Laptop Backpack',
    oldName: 'Everyday Canvas Backpack',
    category: 'Accessories',
    price: 1499,
    stock: 8,
    description: 'Rugged vintage canvas backpack with padded laptop sleeve, water-resistant base, and ergonomic airflow shoulder straps.',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Polarized Aviator Sunglasses',
    oldName: 'Polarized Aviator Sunglasses',
    category: 'Accessories',
    price: 899,
    stock: 25,
    description: 'Classic metal frame sunglasses with 100% UV400 polarized lenses for crystal-clear vision and glare protection.',
    image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Leather Bi-Fold Wallet',
    oldName: 'Full-Grain Leather Bi-Fold Wallet',
    category: 'Accessories',
    price: 1199,
    stock: 30,
    description: 'Handcrafted genuine vegetable-tanned leather wallet with RFID blocking lining, 8 card slots, dual cash pockets, and slim profile.',
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Stainless Steel Mesh Watch',
    oldName: 'Minimalist Stainless Steel Mesh Watch',
    category: 'Accessories',
    price: 1999,
    stock: 15,
    description: 'Ultra-thin analog timepiece with scratch-resistant sapphire-coated glass, Japanese quartz movement, and breathable magnetic mesh strap.',
    image: '/images/mesh_watch.jpg'
  },
  {
    name: 'Crossbody Sling Bag',
    oldName: 'Waterproof Commuter Sling Bag',
    category: 'Accessories',
    price: 1399,
    stock: 20,
    description: 'Compact urban crossbody chest pack with weatherproof Cordura fabric, magnetic quick-release buckle, and concealed passport pocket.',
    image: '/images/crossbody_sling.jpg'
  },
  {
    name: '14-Inch Laptop Sleeve',
    oldName: 'Padded Travel Laptop Sleeve 14-Inch',
    category: 'Accessories',
    price: 799,
    stock: 35,
    description: 'Shockproof water-resistant neoprene notebook case with fleece interior lining, durable YKK zippers, and accessory storage pouch.',
    image: '/images/laptop_sleeve.jpg'
  },
  {
    name: 'Braided Leather Belt',
    oldName: 'Handmade Braided Leather Belt',
    category: 'Accessories',
    price: 899,
    stock: 25,
    description: 'Durable Italian bridle leather woven belt with brushed zinc alloy pin buckle and adjustable stretch weave fit.',
    image: '/images/braided_belt.jpg'
  },
  {
    name: 'Merino Wool Beanie',
    oldName: 'Merino Wool Winter Beanie',
    category: 'Accessories',
    price: 699,
    stock: 40,
    description: 'Ultra-soft 100% fine Australian merino wool ribbed knit watch cap offering breathable thermal warmth without itchiness.',
    image: '/images/merino_beanie.jpg'
  },
  {
    name: 'Canvas Toiletry Bag',
    oldName: 'Canvas Travel Toiletry Wash Bag',
    category: 'Accessories',
    price: 749,
    stock: 28,
    description: 'Waterproof waxed canvas dopp kit with leak-proof nylon lining, brass zip pulls, and wide opening for grooming essentials.',
    image: '/images/toiletry_bag.jpg'
  },
  {
    name: 'Titanium Key Carabiner',
    oldName: 'Titanium Key Organizer & Carabiner',
    category: 'Accessories',
    price: 599,
    stock: 50,
    description: 'Featherlight aerospace-grade titanium everyday carry key clip with integrated bottle opener, pocket pry tool, and anti-lost ring.',
    image: '/images/titanium_carabiner.jpg'
  },
  {
    name: 'Blue-Light Blocking Glasses',
    oldName: 'Tortoiseshell Blue-Light Blocking Glasses',
    category: 'Accessories',
    price: 849,
    stock: 32,
    description: 'Vintage round cellulose acetate frame glasses with anti-glare lenses that filter 99% of harmful digital blue light rays.',
    image: '/images/blue_light_glasses.jpg'
  },
  {
    name: 'Waxed Canvas Duffel Bag',
    oldName: 'Waxed Canvas Weekend Duffel Bag',
    category: 'Accessories',
    price: 2299,
    stock: 14,
    description: 'Rugged 45L travel duffel with genuine crazy-horse leather accents, reinforced shoe compartment, and padded shoulder strap.',
    image: '/images/canvas_duffel.jpg'
  },

  // ==========================================
  // CATEGORY: Home (12 products)
  // ==========================================
  {
    name: 'Minimalist LED Desk Lamp',
    oldName: 'Minimalist Desk Lamp',
    category: 'Home',
    price: 999,
    stock: 10,
    description: 'Modern LED desk lamp with touch-sensitive dimming, 3 color temperatures, and integrated USB charging port.',
    image: 'https://images.unsplash.com/photo-1543512214-4f76e81f8bfc?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Aromatherapy Essential Oil Diffuser',
    oldName: 'Aromatherapy Essential Oil Diffuser',
    category: 'Home',
    price: 699,
    stock: 16,
    description: 'Ultrasonic cool mist aroma diffuser with 7 ambient LED light modes and whisper-quiet timer settings for bedroom or office.',
    image: 'https://images.unsplash.com/photo-1768471569643-717e823b5f9a?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Linen Throw Blanket',
    oldName: 'Natural Linen Textured Throw Blanket',
    category: 'Home',
    price: 1299,
    stock: 20,
    description: 'Breathable 100% pure washed linen waffle weave throw with hand-fringed edges, ideal for all-season sofa or bed layering.',
    image: 'https://images.unsplash.com/photo-1600369672770-985fd30004eb?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Ceramic Fluted Plant Pot',
    oldName: 'Ceramic Modern Ribbed Plant Pot',
    category: 'Home',
    price: 699,
    stock: 30,
    description: 'Matte white fluted ceramic planter with drainage hole, removable silicone plug, and matching bamboo moisture saucer.',
    image: 'https://images.unsplash.com/photo-1604762525953-2c80447cc4a6?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Soy Wax Scented Candle',
    oldName: 'Hand-Poured Soy Wax Scented Candle',
    category: 'Home',
    price: 599,
    stock: 45,
    description: 'Clean-burning non-toxic soy wax candle in amber glass jar infused with cedarwood, amber, and vanilla essential oils (50-hr burn).',
    image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Memory Foam Seat Cushion',
    oldName: 'Ergonomic Memory Foam Seat Cushion',
    category: 'Home',
    price: 1199,
    stock: 22,
    description: 'High-density orthopedic coccyx relief seat pad with breathable 3D mesh cover and non-slip rubber bottom for office chairs.',
    image: 'https://images.unsplash.com/photo-1673201102066-b0599d45002b?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Floating Wall Shelves (Set of 2)',
    oldName: 'Solid Oak Floating Wall Shelves (Set of 2)',
    category: 'Home',
    price: 1499,
    stock: 16,
    description: 'Pair of 24-inch natural solid oak ledge shelves with hidden heavy-duty metal mounting brackets and protective wax oil finish.',
    image: 'https://images.unsplash.com/photo-1615884241431-d07c87e30ab2?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Silent Quartz Wall Clock',
    oldName: 'Nordic Minimalist Silent Wall Clock',
    category: 'Home',
    price: 899,
    stock: 25,
    description: '12-inch modern round quartz clock with sweep movement, zero ticking noise, curved glass lens, and solid wood frame.',
    image: 'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Bamboo Bathroom Floor Mat',
    oldName: 'Bamboo Slatted Bathroom Shower Mat',
    category: 'Home',
    price: 999,
    stock: 18,
    description: 'Eco-friendly water-resistant bamboo floor mat with elevated anti-slip rubber pads for bathroom, spa, or sauna airflow.',
    image: 'https://images.unsplash.com/photo-1643763846408-e1c69783ac92?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Cotton Rope Storage Basket',
    oldName: 'Woven Cotton Rope Laundry Storage Basket',
    category: 'Home',
    price: 849,
    stock: 26,
    description: 'Sturdy collapsible natural cotton cord basket with reinforced slit handles for blankets, toys, towels, and clothing storage.',
    image: 'https://images.unsplash.com/photo-1626037235530-fe56de7d6459?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Velvet Cushion Covers (Set of 2)',
    oldName: 'Abstract Boho Velvet Cushion Covers (Set of 2)',
    category: 'Home',
    price: 649,
    stock: 35,
    description: 'Set of two 18x18 inch ultra-soft velvet decorative throw pillow cases with hidden zip closure and contemporary geometric print.',
    image: 'https://images.unsplash.com/photo-1559051668-9024c9b5e84b?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Rechargeable LED Table Lamp',
    oldName: 'Cordless Ambient Rechargeable Table Lamp',
    category: 'Home',
    price: 1399,
    stock: 20,
    description: 'Portable touch-control aluminum mood light with stepless dimming, warm 2700K LED glow, and 24-hour rechargeable battery life.',
    image: 'https://images.unsplash.com/photo-1580130281320-0ef0754f2bf7?w=800&auto=format&fit=crop&q=80'
  },

  // ==========================================
  // CATEGORY: Sports (9 products)
  // ==========================================
  {
    name: 'Non-Slip Yoga Mat',
    oldName: 'Eco-Friendly Non-Slip Yoga Mat',
    category: 'Sports',
    price: 899,
    stock: 22,
    description: 'Extra thick high-density TPE exercise mat with textured dual-sided grip and carrying strap for pilates and yoga.',
    image: 'https://images.unsplash.com/photo-1646239646963-b0b9be56d6b5?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Insulated Sports Bottle 1L',
    oldName: 'Insulated Stainless Steel Sports Bottle 1L',
    category: 'Sports',
    price: 799,
    stock: 35,
    description: 'Double-wall vacuum insulated flask keeping liquids ice cold for 24 hours or steaming hot for 12 hours with leak-proof chug cap.',
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80'
  },
  {
    name: 'Adjustable Speed Jump Rope',
    oldName: 'Adjustable Speed Jump Rope with Ball Bearings',
    category: 'Sports',
    price: 449,
    stock: 50,
    description: 'Tangle-free steel wire skipping rope with 360-degree smooth ball bearings and anti-slip aluminum handles for cardio workouts.',
    image: 'https://images.unsplash.com/photo-1520334298038-4182dac472e8?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'High-Density Foam Roller',
    oldName: 'Deep Tissue High-Density Foam Roller',
    category: 'Sports',
    price: 699,
    stock: 28,
    description: '18-inch grid trigger point massage roller for physical therapy, muscle myofascial release, and post-workout recovery.',
    image: 'https://images.unsplash.com/photo-1653617748437-895c016e88b1?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Resistance Bands (Set of 5)',
    oldName: 'Resistance Loop Exercise Bands Set of 5',
    category: 'Sports',
    price: 499,
    stock: 45,
    description: 'Five color-coded 100% natural latex strength bands from X-Light to X-Heavy with compact mesh travel pouch for home gym.',
    image: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Running Waist Pack',
    oldName: 'Waterproof Breathable Running Waist Pack',
    category: 'Sports',
    price: 599,
    stock: 32,
    description: 'Bounce-free sweat-resistant running belt with expandable smartphone zippered pocket, earphone port, and reflective night strips.',
    image: 'https://images.unsplash.com/photo-1645276281394-395ff9f072a7?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Padded Weightlifting Gloves',
    oldName: 'Breathable Padded Gym Workout Gloves',
    category: 'Sports',
    price: 549,
    stock: 30,
    description: 'Half-finger weightlifting gloves with cushioned microfiber palm grip, integrated wrist wrap support, and quick pull tabs.',
    image: 'https://images.unsplash.com/photo-1557127972-1c446ea89ea5?w=800&auto=format&fit=crop&q=80'
  },
  {
    name: 'Microfiber Sports Towel Set',
    oldName: 'Quick-Dry Microfiber Sports Towel Set',
    category: 'Sports',
    price: 499,
    stock: 35,
    description: 'Ultra-absorbent lightweight fast-drying gym and travel towels with hanging snap loop and breathable zippered case.',
    image: '/images/microfiber_sports_towels.jpg'
  },
  {
    name: 'Stainless Steel Shaker Bottle 750ml',
    oldName: 'Stainless Steel Protein Shaker Bottle 750ml',
    category: 'Sports',
    price: 699,
    stock: 30,
    description: 'Odor-resistant metallic shaker cup with built-in blending whisk ball, measurement markings, and secure leak-proof flip cap.',
    image: '/images/stainless_steel_shaker.jpg'
  }
];

async function seedProducts() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mini_ecommerce';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    const initialTotal = await Product.countDocuments();
    const initialCategories = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const initialCatMap = {};
    initialCategories.forEach(c => { initialCatMap[c._id] = c.count; });
    console.log(`Initial total products: ${initialTotal}`);
    console.log('Initial category counts:', initialCatMap);

    // Remove retired products if present in database
    const retiredNames = [
      'Agility Ladder & Cones Set',
      'Pro Agility Ladder & Training Cones Set',
      'Adjustable Hand Grip Strengthener',
      'Adjustable Hand Grip Strength Exerciser'
    ];
    await Product.deleteMany({ name: { $in: retiredNames } });

    let skippedCount = 0;
    let insertedCount = 0;

    for (const prodData of catalogProducts) {
      // Safe check: match by current standardized name OR legacy old name to prevent duplicates
      const queryNames = [prodData.name];
      if (prodData.oldName && prodData.oldName !== prodData.name) {
        queryNames.push(prodData.oldName);
      }

      const existing = await Product.findOne({ name: { $in: queryNames } });

      if (existing) {
        let changed = false;
        // If legacy name was stored, update it to the standardized name
        if (existing.name !== prodData.name) {
          existing.name = prodData.name;
          changed = true;
        }
        // If image was updated, sync image
        if (prodData.image && existing.image !== prodData.image) {
          existing.image = prodData.image;
          changed = true;
        }
        if (changed) {
          await existing.save();
          console.log(`[UPDATED] "${prodData.name}" (${prodData.category})`);
        } else {
          console.log(`[PRESERVED] "${prodData.name}" (${prodData.category}) - already in catalog.`);
        }
        skippedCount++;
      } else {
        const { oldName, ...cleanData } = prodData;
        const product = new Product(cleanData);
        await product.save();
        console.log(`[INSERTED] Added product: "${prodData.name}" (${prodData.category}) - ₹${prodData.price}`);
        insertedCount++;
      }
    }

    const finalTotal = await Product.countDocuments();
    const finalCategories = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const finalCatMap = {};
    finalCategories.forEach(c => { finalCatMap[c._id] = c.count; });

    console.log('\n========================================');
    console.log('           SEEDING SUMMARY              ');
    console.log('========================================');
    console.log(`Initial Products : ${initialTotal}`);
    console.log(`Newly Inserted   : ${insertedCount}`);
    console.log(`Preserved/Skipped: ${skippedCount}`);
    console.log(`Final Products   : ${finalTotal}`);
    console.log('\nFinal Category Breakdown:');
    for (const [cat, count] of Object.entries(finalCatMap)) {
      const added = count - (initialCatMap[cat] || 0);
      console.log(`  - ${cat}: ${count} total (+${added} added)`);
    }
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  } catch (error) {
    console.error('Error seeding products:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

// Export catalogProducts and seedProducts for programmatic and CLI use
module.exports = {
  catalogProducts,
  seedProducts
};

if (require.main === module) {
  seedProducts();
}
