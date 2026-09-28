/* Usage: node scripts/create-admin.js <email> <password> [name] */
require('../config/env');
const mongoose = require('mongoose');
const User = require('../models/User');
const { config } = require('../config/env');

async function main() {
  const [, , email, password, name] = process.argv;
  if (!email || !password) {
    console.error('Usage: node scripts/create-admin.js <email> <password> [name]');
    process.exit(1);
  }
  await mongoose.connect(config.mongoUri);
  let user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    user.role = 'admin';
    user.status = 'active';
    if (password) user.password = password;
    await user.save();
    console.log(`Updated existing user ${user.email} -> admin`);
  } else {
    user = await User.create({
      name: name || 'Administrator',
      email: email.toLowerCase(),
      password,
      role: 'admin',
      status: 'active',
    });
    console.log(`Created admin ${user.email}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
