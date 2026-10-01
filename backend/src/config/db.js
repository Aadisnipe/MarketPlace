const dns = require('dns');
const mongoose = require('mongoose');
const env = require('./env');

// Optional: bypass a DNS resolver that can't answer SRV queries (set in .env)
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));
}

mongoose.set('strictQuery', true);

async function connectDB() {
  await mongoose.connect(env.mongoUri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = connectDB;