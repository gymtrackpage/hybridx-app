import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Check if API key is configured
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not configured in environment variables');
  console.error('Please add GEMINI_API_KEY to your .env.local file');
  console.error('Get your API key from: https://aistudio.google.com/app/apikey');
}

// Use GEMINI_API_KEY from environment
export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
  model: 'googleai/gemini-2.5-flash',
});
