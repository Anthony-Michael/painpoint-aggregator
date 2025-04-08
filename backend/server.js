const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { db } = require('./firebase');
const PainPoint = require('../models/PainPoint');
const { classifyPainPoint } = require('./classifyPainPoints');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// --- Middleware Setup ---
// CORS Configuration
app.use(cors({
	origin: [
		'https://painpointinsightai.netlify.app',  // Production frontend
		'http://localhost:5173',  // Vite development server
		'https://painsignal.io',   // Production domain
		'https://www.painsignal.io'  // Production domain with www
	],
	methods: ['GET', 'POST', 'OPTIONS'],
	credentials: true,
	allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept']
}));

// Handle preflight requests for specific routes
app.options('/api/painpoints', cors());      // Handle preflight for main endpoint
app.options('/painpoints', cors());          // Handle preflight for non-api endpoint
app.options('/api/recent-painpoints', cors()); // Handle preflight for recent endpoint
app.options('/api/public-analyze', cors());  // Handle preflight for public analyze
app.options('/api/waitlist', cors());        // Handle preflight for waitlist

// Global preflight handler for other routes
app.options('*', cors({
	origin: [
		'https://painpointinsightai.netlify.app',
		'http://localhost:5173',
		'https://painsignal.io',
		'https://www.painsignal.io'
	],
	methods: ['GET', 'POST', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
	credentials: true,
	maxAge: 86400 // Cache preflight response for 24 hours
}));

// --- Rate Limiting ---
// Specific limiter for /api/painpoints
const apiPainPointsLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 5, // Limit each IP to 5 requests per windowMs for this specific route
	message: 'Too many requests to /api/painpoints from this IP, please try again after a minute',
	standardHeaders: true, 
	legacyHeaders: false, 
});

// JSON Body Parser (should come after CORS/RateLimit)
app.use(express.json());

// Routes
app.get('/', (req, res) => {
	res.send('Pain Point Aggregator API is running');
});

// POST endpoint to save pain points
app.post('/api/painpoints', apiPainPointsLimiter, cors(), async (req, res) => {
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
		const savedData = { ...newPainPointData, id: docRef.id };

		// --- Send Email Notification ---
		const emailFrom = process.env.EMAIL_FROM;
		const emailTo = process.env.EMAIL_TO;
		if (process.env.RESEND_API_KEY && emailFrom && emailTo) {
			try {
				const subject = `New Pain Point Submitted: ${savedData.industry || 'Unknown Industry'}`;
				const htmlBody = `
					<h1>New Pain Point Submission</h1>
					<p><strong>ID:</strong> ${savedData.id}</p>
					<p><strong>Description:</strong></p>
					<pre>${savedData.description}</pre>
					<hr>
					<h2>Classification Results:</h2>
					<ul>
						<li><strong>Industry:</strong> ${savedData.industry}</li>
						<li><strong>Sentiment:</strong> ${savedData.sentiment}</li>
						<li><strong>Confidence Score:</strong> ${savedData.confidenceScore}</li>
						<li><strong>Confidence Explanation:</strong> ${savedData.confidenceExplanation}</li>
					</ul>
					<p><em>Submitted At: ${new Date(savedData.createdAt).toLocaleString()}</em></p>
				`;

				await resend.emails.send({
					from: emailFrom,
					to: emailTo,
					subject: subject,
					html: htmlBody,
				});
				console.log(`📧 Email notification sent successfully to ${emailTo}`);
			} catch (emailError) {
				console.error('❌ Failed to send email notification:', emailError.message);
				// Do not block the API response if email fails
			}
		} else {
			console.warn('⚠️ Email configuration (RESEND_API_KEY, EMAIL_FROM, EMAIL_TO) missing in .env. Skipping email notification.');
		}
		// --- End Email Notification ---

		// Return success with the data that was actually saved
		res.status(201).json({ 
			success: true, 
			data: savedData 
		});
	} catch (err) {
		console.error('❌ Failed to save pain point:', err);
		// Check if it's a classification error vs. database error
		const message = err.message.includes('classify') ? 'Classification failed' : 'Failed to save pain point';
		res.status(500).json({ success: false, message: message });
	}
});

// Also handle POST requests to /painpoints (without /api prefix) for backward compatibility
app.post('/painpoints', cors(), async (req, res) => {
	// Reuse the same handler logic as the /api/painpoints endpoint
	const { description } = req.body;

	if (!description || typeof description !== 'string') {
		return res.status(400).json({ success: false, message: 'Invalid description' });
	}

	try {
		const classification = await classifyPainPoint(description);
		const { 
			industry, 
			sentiment, 
			confidenceScore, 
			confidenceExplanation 
		} = classification;
		
		const isTestEntry = /\[test\]/i.test(description);
		const newPainPointData = {
			description,
			industry: industry || 'unknown',
			sentiment: sentiment || 'neutral',
			confidenceScore: confidenceScore !== undefined ? confidenceScore : 0,
			confidenceExplanation: confidenceExplanation || 'No explanation provided.',
			createdAt: new Date().toISOString(),
			...(isTestEntry && { isTest: true })
		};

		const docRef = await db.collection('painpoints').add(newPainPointData);
		res.status(201).json({ 
			success: true, 
			data: { ...newPainPointData, id: docRef.id } 
		});
	} catch (err) {
		console.error('❌ Failed to save pain point:', err);
		const message = err.message.includes('classify') ? 'Classification failed' : 'Failed to save pain point';
		res.status(500).json({ success: false, message: message });
	}
});

// GET endpoint to retrieve all pain points
app.get('/api/painpoints', apiPainPointsLimiter, cors(), async (req, res) => {
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
app.get('/api/recent-painpoints', cors(), async (req, res) => {
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

// GET endpoint for backward compatibility (without /api prefix)
app.get('/painpoints', cors(), async (req, res) => {
	try {
		const painPointsSnapshot = await db.collection('painpoints').get();
		const painPoints = [];
		
		painPointsSnapshot.forEach(doc => {
			const data = doc.data();
			
			if (data.isTest === true && process.env.NODE_ENV !== 'development') {
				return;
			}
			
			painPoints.push({
				id: doc.id, 
				description: data.description || '',
				industry: data.industry || '', 
				sentiment: data.sentiment || '', 
				confidenceScore: data.confidenceScore !== undefined ? data.confidenceScore : null, 
				confidenceExplanation: data.confidenceExplanation || null, 
				createdAt: data.createdAt 
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

// Also handle GET requests for recent pain points without /api prefix
app.get('/recent-painpoints', cors(), async (req, res) => {
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
app.post('/api/public-analyze', cors(), async (req, res) => {
	const { description } = req.body;

	// Basic Input Validation & Sanitization
	if (!description || typeof description !== 'string' || description.trim().length === 0) {
		return res.status(400).json({ success: false, message: 'Invalid or empty description provided.' });
	}
	
	const sanitizedDescription = description.trim().slice(0, 5000); 

	try {
		// 1. Use existing classification function
		const classification = await classifyPainPoint(sanitizedDescription);

		// 2. Store the result (with capping logic)
		const publicPainPointsRef = db.collection('publicPainPoints');
		const MAX_ENTRIES = 1000;

		// Get current count (can be slow at scale, consider alternatives like counters)
		const countSnapshot = await publicPainPointsRef.count().get();
		const currentCount = countSnapshot.data().count;

		if (currentCount >= MAX_ENTRIES) {
			// Find the oldest entry
			const oldestQuery = publicPainPointsRef.orderBy('createdAt', 'asc').limit(1);
			const oldestSnapshot = await oldestQuery.get();
			if (!oldestSnapshot.empty) {
				const oldestDocId = oldestSnapshot.docs[0].id;
				console.log(`Public collection full, deleting oldest entry: ${oldestDocId}`);
				await publicPainPointsRef.doc(oldestDocId).delete();
			}
		}

		// Prepare data to save
		const dataToSave = {
			description: sanitizedDescription,
			industry: classification.industry,
			sentiment: classification.sentiment,
			confidenceScore: classification.confidenceScore,
			confidenceExplanation: classification.confidenceExplanation,
			createdAt: new Date().toISOString(),
			isAnonymous: true
		};

		// Add the new entry
		await publicPainPointsRef.add(dataToSave);
		console.log('Saved public analysis entry.');

		// 3. Return only specific fields to the user
		res.status(200).json({
			success: true,
			data: {
				industry: classification.industry,
				sentiment: classification.sentiment,
				confidenceScore: classification.confidenceScore
				// NOTE: confidenceExplanation is NOT returned publicly here
			}
		});

	} catch (err) {
		console.error('❌ Error during public analysis or saving:', err);
		res.status(500).json({ success: false, message: 'Analysis failed due to an internal error.' });
	}
});

// --- New Waitlist Signup Endpoint ---
app.post('/api/waitlist', cors(), async (req, res) => {
	const { email } = req.body;

	// Basic Email Validation (consider a more robust library for production)
	if (!email || typeof email !== 'string' || !/\S+@\S+\.\S+/.test(email)) {
		return res.status(400).json({ success: false, message: 'Invalid email format provided.' });
	}

	const sanitizedEmail = email.trim().toLowerCase(); // Normalize email

	try {
		const waitlistRef = db.collection('waitlist');
		// Check if email already exists
		const snapshot = await waitlistRef.where('email', '==', sanitizedEmail).limit(1).get();

		if (!snapshot.empty) {
			// Email already exists
			return res.status(409).json({ success: false, message: 'This email is already on the waitlist.' });
		}

		// Add new email to waitlist
		await waitlistRef.add({
			email: sanitizedEmail,
			signedUpAt: new Date().toISOString()
		});

		res.status(201).json({ success: true, message: 'Successfully joined the waitlist!' });

	} catch (err) {
		console.error('❌ Error adding to waitlist:', err);
		res.status(500).json({ success: false, message: 'Failed to join waitlist due to an internal error.' });
	}
});

// Start server
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});

module.exports = app;

