const express = require('express');
const cors = require('cors');
const { db } = require('./firebase');
const PainPoint = require('../models/PainPoint');
const { classifyPainPoint } = require('./classifyPainPoints');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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

    const newPainPoint = {
      description,
      industry: classification.industry || 'Unknown',
      sentiment: classification.sentiment || 'Neutral',
      createdAt: new Date().toISOString()
    };

    // Save to Firestore
    const docRef = await db.collection('painpoints').add(newPainPoint);

    // Return success with the newly created data (including Firestore ID)
    res.status(201).json({ 
        success: true, 
        data: { ...newPainPoint, id: docRef.id } 
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
      // Construct the object for the response, including classification fields
      painPoints.push({
        id: doc.id, // Include the document ID
        description: data.description || '', // Use data from Firestore
        industry: data.industry || '', // Include industry (fallback to empty string)
        sentiment: data.sentiment || '', // Include sentiment (fallback to empty string)
        createdAt: data.createdAt // Include createdAt
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

