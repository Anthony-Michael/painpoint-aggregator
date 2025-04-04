require('dotenv').config();

const cron = require('node-cron');
const { db } = require('../firebase');

// Schedule task to run at 9:00 AM every day
cron.schedule('0 9 * * *', async () => {
  console.log('Running daily summary job at:', new Date().toLocaleString());
  
  try {
    // Query Firestore for top 10 most recent SaaS pain points with frustrated sentiment
    const snapshot = await db.collection('painpoints')
      //.where('industry', '==', 'SaaS')
      //.where('sentiment', '==', 'frustrated')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    if (snapshot.empty) {
      console.log('No frustrated SaaS pain points found in the last day.');
      return;
    }
    
    console.log('=== DAILY SUMMARY: TOP 10 FRUSTRATED SAAS PAIN POINTS ===');
    console.log(`Total count: ${snapshot.size}`);
    console.log('-----------------------------------------------------------');
    
    snapshot.forEach((doc, index) => {
      const painPoint = doc.data();
      console.log(`#${index + 1} - ${new Date(painPoint.createdAt).toLocaleString()}`);
      console.log(`Description: ${painPoint.description}`);
      console.log('-----------------------------------------------------------');
    });
    
    console.log('Daily summary completed successfully.');
  } catch (error) {
    console.error('Error generating daily summary:', error);
  }
});

console.log('Daily summary cron job scheduled to run at 9:00 AM every day.');
