// lib/openaiClient.ts
import OpenAI from 'openai';

// Either use env, or hardcode as fallback for StackBlitz
const apiKey = process.env.OPENAI_API_KEY || 'sk-PASTE-YOUR-KEY-HERE';

if (!apiKey) {
  throw new Error('OPENAI_API_KEY is not set.');
}

export const openai = new OpenAI({
  apiKey,
});
