const axios = require('axios');
require('dotenv').config();

/**
 * Classifies a pain point description into industry and sentiment
 * @param {string} text - The pain point description to classify
 * @returns {Promise<Object>} - Object containing industry and sentiment
 */
async function classifyPainPoint(text) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
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
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    const result = response.data.choices[0].message.content;
    return JSON.parse(result);
  } catch (error) {
    console.error('Error classifying pain point:', error);
    return { 
      industry: 'unknown', 
      sentiment: 'neutral',
      error: error.message
    };
  }
}

module.exports = { classifyPainPoint };