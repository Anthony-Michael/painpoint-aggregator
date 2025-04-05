const axios = require('axios');
require('dotenv').config();

/**
 * Classifies a pain point description into industry and sentiment.
 * @param {string} text - The pain point description to classify.
 * @returns {Promise<Object>} - Object containing industry and sentiment.
 */
async function classifyPainPoint(text) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    // Replace the previous log with a more specific one
    // console.log('🔑 OpenAI API Key loaded:', apiKey ? '✅ Loaded' : '❌ Missing');
    console.log("🔑 Loaded API Key:", process.env.OPENAI_API_KEY?.slice(0, 12) + "...");

    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    // 🧪 Build the payload separately
    const payload = {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that classifies pain points. Respond only with a JSON object.'
        },
        {
          role: 'user',
          content: `Classify the following pain point into industry and sentiment. Return only a JSON object with these two fields: "${text}"`
        }
      ],
      temperature: 0.3,
      max_tokens: 150
    };

    // 🔍 Log payload before sending
    console.log("📤 Sending payload to OpenAI:\n", JSON.stringify(payload, null, 2));

    // 🚀 Send request
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    // 🧠 Extract response content
    const result = response.data.choices[0].message.content;

    // ✅ Log response for debug
    console.log("✅ OpenAI response:\n", result);

    // Parse the result and add the simulated confidence score
    const parsedResult = JSON.parse(result);
    const confidenceScore = Math.floor(Math.random() * 11) + 85; // Simulate score 85-95

    return { ...parsedResult, confidenceScore }; // Add score to the result

  } catch (error) {
    console.error('❌ Error classifying pain point:', error.message || error);
    // Include a default confidence score in the error case
    return {
      industry: 'unknown',
      sentiment: 'neutral',
      confidenceScore: 0, // Default confidence on error
      error: error.message
    };
  }
}

module.exports = { classifyPainPoint };
