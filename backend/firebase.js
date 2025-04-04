const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const admin = require('firebase-admin');

let serviceAccount;

try {
  // Try to parse embedded JSON string (if you ever use that format)
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (error) {
  // Fallback: resolve the absolute path and require the JSON file
  const fullPath = path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT);
  serviceAccount = require(fullPath);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { admin, db };
