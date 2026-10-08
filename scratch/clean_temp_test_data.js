const mongoose = require('../backend/node_modules/mongoose');
const User = require('../backend/models/User');
const Order = require('../backend/models/Order');
const Address = require('../backend/models/Address');
const Cart = require('../backend/models/Cart');

async function clean() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mini_ecommerce');
  const testUsers = await User.find({ email: { $regex: /^(paytest|admintest_cust|payother)/ } });
  const ids = testUsers.map(u => u._id);
  await Order.deleteMany({ user: { $in: ids } });
  await Address.deleteMany({ user: { $in: ids } });
  await Cart.deleteMany({ user: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
  console.log(`Cleaned ${testUsers.length} temporary test user accounts and their associated records.`);
  await mongoose.disconnect();
}

clean().catch(console.error);
