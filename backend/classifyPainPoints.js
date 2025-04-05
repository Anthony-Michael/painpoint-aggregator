const axios = require('axios');
require('dotenv').config();

// Define the new system prompt
const SYSTEM_PROMPT = `
<System>
You are an autonomous AI scoring agent integrated into a Reddit pain point detection system. Your job is to analyze incoming pain point entries from users and automatically assign a confidence score that reflects how valid, urgent, and actionable each entry is.
</System>

<Context>
You are operating inside a backend environment where Reddit pain point posts are parsed and sent directly to you. Your evaluation will be used to determine whether a submission is high-priority, medium-priority, or discardable.
</Context>

<Instructions>
For each input pain point:
1. Examine its clarity (Is the user specific or vague?).
2. Assess emotional intensity (Is there frustration, urgency, or a repeated complaint?).
3. Determine actionability (Can this pain be addressed realistically?).
4. Evaluate relatability (Would others experience the same problem?).
5. Consider uniqueness vs. redundancy (Has this appeared multiple times already?).

Then:
- Generate a short explanation justifying your score.
- Output a score from 0–100:
  - 0–30 = low confidence (vague, unimportant, or unclear pain)
  - 31–69 = medium confidence (somewhat valuable, needs clarification)
  - 70–100 = high confidence (clear, validated, emotionally resonant, likely widespread)
- Determine the general industry (e.g., SaaS, E-commerce, Healthcare, Finance, Marketing, Education, Other).
- Determine the overall sentiment (e.g., Frustration, Confusion, Negative, Neutral, Positive, Suggestion).
</Instructions>

<Constraints>
- Do not ask questions or prompt the user.
- Ensure output remains under 250 words.
- Avoid hallucinations; base all analysis strictly on text content.
</Constraints>

<Output Format>
Respond ONLY with a valid JSON object matching this structure:
{
  "industry": "...",
  "sentiment": "...",
  "confidenceScore": 85,
  "confidenceExplanation": "..."
}
</Output Format>
`;

/**
 * Classifies a pain point and generates a confidence score using a detailed prompt.
 * @param {string} text - The pain point description to classify.
 * @returns {Promise<Object>} - Object with industry, sentiment, confidenceScore, and confidenceExplanation.
 */
async function classifyPainPoint(text) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    // Using a more capable model is recommended for complex instructions
    const model = 'gpt-4'; 

    console.log('🔑 Loaded API Key:', apiKey ? '✅ Loaded' : '❌ Missing');

    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    // Use the new system prompt and provide only the text as user input
    const payload = {
      model,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: text // Just the pain point text
        }
      ],
      temperature: 0.3, // Lower temperature for more deterministic JSON output
      max_tokens: 300 // Increased slightly to accommodate explanation
    };

    console.log('📤 Sending payload to OpenAI:\n', JSON.stringify(payload, null, 2));

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

    const resultText = response.data.choices[0].message.content;
    console.log('✅ OpenAI response:\n', resultText);

    let parsed = {}; // Initialize parsed object
    try {
      // Attempt to clean up the response and extract JSON
      const jsonMatch = resultText.match(/\{.*\}/s); // Find first { to last }
      if (jsonMatch && jsonMatch[0]) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback if no clear JSON object is found (maybe it's plain JSON already?)
        parsed = JSON.parse(resultText.trim()); 
      }
    } catch (parseError) {
      console.error('❌ Failed to parse JSON response:', parseError, '\nRaw response:', resultText);
      // Set defaults explicitly if parsing fails
      parsed = {
        industry: 'unknown',
        sentiment: 'neutral',
        confidenceScore: 0,
        confidenceExplanation: 'Failed to parse AI response.'
      };
    }

    // Return the structured data, applying fallbacks from the parsed (or default) object
    return {
      industry: parsed.industry || 'unknown',
      sentiment: parsed.sentiment || 'neutral',
      confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0,
      confidenceExplanation: parsed.confidenceExplanation || 'No explanation provided.'
    };

  } catch (error) { // Outer catch for API call errors etc.
    console.error('❌ Error in classifyPainPoint function:', error);
    // Return default structure on outer error
    return {
      industry: 'unknown',
      sentiment: 'neutral',
      confidenceScore: 0,
      confidenceExplanation: 'Classification failed due to an error.',
      error: error.message // Optionally include error message for debugging
    };
  }
}

module.exports = { classifyPainPoint };