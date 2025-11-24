import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Use GEMINI_API_KEY from environment
export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })],
  model: 'googleai/gemini-2.5-flash-lite',
});
