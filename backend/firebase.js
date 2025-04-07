const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Path to service account file (on Render, it's mounted under /etc/secrets)
const serviceAccountPath = path.resolve('/etc/secrets/firebase-service-account.json');

// Load and parse service account
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Export Firestore
const db = admin.firestore();
module.exports = { db };
