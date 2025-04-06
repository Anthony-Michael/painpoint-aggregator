const express = require('express');
const cors = require('cors');
const { db } = require('./firebase');
const PainPoint = require('../models/PainPoint');
const { classifyPainPoint } = require('./classifyPainPoints');
const rateLimit = require('express-rate-limit'); // Import rate limiter
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// --- Rate Limiter Setup ---
const analyzeLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 5, // Limit each IP to 5 requests per windowMs
	message:
		'Too many analysis requests created from this IP, please try again after an hour',
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiter specifically to the public analyze endpoint
app.use('/api/public-analyze', analyzeLimiter);

// Routes
app.get('/', (req, res) => {
  res.send('Pain Point Aggregator API is running');
});

// POST endpoint to save pain points (Simplified version)
app.post('/painpoints', async (req, res) => {
  const { description } = req.body;

  if (!description || typeof description !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid description' });
  }

  try {
    const classification = await classifyPainPoint(description);

    // Extract all expected fields from classification result
    const { 
      industry, 
      sentiment, 
      confidenceScore, 
      confidenceExplanation 
    } = classification;
    
    // Check if description contains [test] (case-insensitive)
    const isTestEntry = /\[test\]/i.test(description);
    
    // Create the final object to save to Firestore
    const newPainPointData = {
      description,
      industry: industry || 'unknown', // Use fallback from classifyPainPoint if needed
      sentiment: sentiment || 'neutral', // Use fallback from classifyPainPoint if needed
      confidenceScore: confidenceScore !== undefined ? confidenceScore : 0, // Ensure it's a number or 0
      confidenceExplanation: confidenceExplanation || 'No explanation provided.', // Use fallback
      createdAt: new Date().toISOString(),
      // Add isTest field if the condition is met
      ...(isTestEntry && { isTest: true })
    };

    // Save to Firestore
    const docRef = await db.collection('painpoints').add(newPainPointData);

    // Return success with the data that was actually saved (including Firestore ID)
    res.status(201).json({ 
        success: true, 
        data: { ...newPainPointData, id: docRef.id } 
    });
  } catch (err) {
    console.error('❌ Failed to save pain point:', err);
    // Check if it's a classification error vs. database error
    const message = err.message.includes('classify') ? 'Classification failed' : 'Failed to save pain point';
    res.status(500).json({ success: false, message: message });
  }
});

// GET endpoint to retrieve all pain points
app.get('/painpoints', async (req, res) => {
  try {
    const painPointsSnapshot = await db.collection('painpoints').get();
    const painPoints = [];
    
    painPointsSnapshot.forEach(doc => {
      const data = doc.data(); // Get data directly from Firestore doc
      
      // Filter out test entries unless in development mode
      if (data.isTest === true && process.env.NODE_ENV !== 'development') {
        return; // Skip this document
      }
      
      // Construct the object for the response, including all necessary fields
      painPoints.push({
        id: doc.id, 
        description: data.description || '',
        industry: data.industry || '', 
        sentiment: data.sentiment || '', 
        confidenceScore: data.confidenceScore !== undefined ? data.confidenceScore : null, 
        confidenceExplanation: data.confidenceExplanation || null, 
        createdAt: data.createdAt 
        // Optionally include isTest in the response if needed for debugging
        // ...(process.env.NODE_ENV === 'development' && { isTest: data.isTest })
      });
    });
    
    res.status(200).json({
      success: true,
      count: painPoints.length,
      data: painPoints
    });
  } catch (error) {
    console.error('Error retrieving pain points:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pain points',
      error: error.toString()
    });
  }
});

// GET endpoint to retrieve recent pain points
app.get('/recent-painpoints', async (req, res) => {
  try {
    const painPointsSnapshot = await db.collection('painpoints')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    
    const painPoints = [];
    painPointsSnapshot.forEach(doc => {
      const painPoint = PainPoint.fromFirestore(doc, doc.id);
      painPoints.push(painPoint);
    });

    res.status(200).json({
      success: true,
      count: painPoints.length,
      data: painPoints
    });
  } catch (error) {
    console.error('Error retrieving recent pain points:', error);
    res.status(500).json({
      success: false, 
      message: 'Failed to retrieve recent pain points',
      error: error.toString()
    });
  }
});

// --- New Public Analyze Endpoint ---
app.post('/api/public-analyze', async (req, res) => {
  const { description } = req.body;

  // Basic Input Validation & Sanitization
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid or empty description provided.' });
  }
  
  // Simple sanitization: Limit length (adjust as needed)
  const sanitizedDescription = description.trim().slice(0, 5000); 

  try {
    // Use existing classification function
    const classification = await classifyPainPoint(sanitizedDescription);

    // Return only specific fields
    res.status(200).json({
      success: true,
      data: {
        industry: classification.industry,
        sentiment: classification.sentiment,
        confidenceScore: classification.confidenceScore
      }
    });

  } catch (err) {
    console.error('❌ Error during public analysis:', err);
    res.status(500).json({ success: false, message: 'Analysis failed due to an internal error.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

