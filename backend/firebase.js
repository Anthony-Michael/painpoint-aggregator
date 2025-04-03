const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin with service account
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (error) {
  // If the environment variable is not JSON, assume it's a path to the file
  serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

module.exports = { admin, db };
