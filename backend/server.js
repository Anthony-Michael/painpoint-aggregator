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

// POST endpoint to save pain points
app.post('/painpoints', async (req, res) => {
  try {
    const painPointData = req.body;
    
    // Create and validate pain point
    const painPoint = new PainPoint(painPointData);
    painPoint.validate();
    
    // Classify the pain point
    const classification = await classifyPainPoint(painPoint.description);
    
    // Merge the classification result with the pain point data
    const painPointWithClassification = {
      ...painPoint.toFirestore(),
      industry: classification.industry || 'unknown',
      sentiment: classification.sentiment || 'neutral'
    };
    
    // Save to Firestore
    const docRef = await db.collection('painpoints').add(painPointWithClassification);
    
    // Return success with the document ID
    res.status(201).json({
      success: true,
      id: docRef.id,
      message: 'Pain point saved successfully',
      data: { 
        ...painPointWithClassification, 
        id: docRef.id 
      }
    });
  } catch (error) {
    console.error('Error saving pain point:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to save pain point',
      error: error.toString()
    });
  }
});

// GET endpoint to retrieve all pain points
app.get('/painpoints', async (req, res) => {
  try {
    const painPointsSnapshot = await db.collection('painpoints').get();
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

