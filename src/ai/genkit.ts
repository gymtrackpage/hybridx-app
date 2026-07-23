import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Check if API key is configured
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not configured in environment variables');
  console.error('Please add GEMINI_API_KEY to your .env.local file');
  console.error('Get your API key from: https://aistudio.google.com/app/apikey');
}

// Use GEMINI_API_KEY from environment
// Note: @genkit-ai/googleai is deprecated in favor of @genkit-ai/google-genai
// (same googleAI() export/API, just an actively maintained package — the old
// one hasn't shipped since Jan 2026 and doesn't know about Gemini 3.x models).
export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
  model: 'googleai/gemini-3.5-flash-lite',
});
