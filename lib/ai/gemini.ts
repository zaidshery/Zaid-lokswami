import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const configuredModelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const fallbackModelNames = ['gemini-2.5-flash', 'gemini-2.0-flash'] as const;

export const LOKSWAMI_SYSTEM_PROMPT = `You are Lokswami AI, a warm and helpful Hindi news anchor for Lokswami.

CRITICAL RESPONSE RULES:
- NEVER say "उपलब्ध नहीं है", "उपलब्ध नहीं हैं", "नहीं मिला", "डेटा उपलब्ध नहीं", or "मेरे पास जानकारी नहीं है".
- NEVER say "I don't have", "no information", "no results found", "not available", or "cannot provide".
- NEVER give a dead-end response.
- ALWAYS end with at least one of these:
  1. A relevant article, video, e-paper, or Mojo suggestion
  2. A follow-up question
  3. A related topic to explore
  4. A call to action to visit Lokswami

WHEN NO ARTICLES MATCH:
- Use best-effort general news knowledge if needed.
- Then guide the user toward related Lokswami coverage.
- Suggest 1-2 related topics they can search next on Lokswami.

WHEN ASKED SOMETHING OFF-TOPIC:
- Gently redirect back to news and current affairs.
- Give one concrete example of what you can answer.
- Never refuse and stop.

TONE RULES:
- Sound warm, energetic, and helpful like a news anchor.
- Use respectful Hindi with "आप" when speaking in Hindi.
- If unsure, give a useful general answer and mention it may not be the latest.
- Keep answers concise, positive, and actionable.`;

if (!apiKey) {
  console.warn('[Gemini] GEMINI_API_KEY is not set.');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const candidateModelNames = Array.from(
  new Set([configuredModelName, ...fallbackModelNames].filter(Boolean))
);

function stripCodeFences(value: string) {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJsonCandidate(value: string) {
  const cleaned = stripCodeFences(value);
  const objectStart = cleaned.indexOf('{');
  const objectEnd = cleaned.lastIndexOf('}');

  if (objectStart !== -1 && objectEnd > objectStart) {
    return cleaned.slice(objectStart, objectEnd + 1).trim();
  }

  return cleaned;
}

export function isGeminiConfigured(): boolean {
  return Boolean(apiKey);
}

export function getGeminiConfiguredModelName(): string {
  return configuredModelName;
}

export function getGeminiCandidateModels(): string[] {
  return [...candidateModelNames];
}

function shouldRetryWithNextModel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /404|not found|not supported/i.test(message);
}

export async function generateContentWithMeta(
  prompt: string
): Promise<{ text: string; model: string }> {
  if (!genAI) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY.');
  }

  let lastError: unknown;

  for (let index = 0; index < candidateModelNames.length; index += 1) {
    const modelName = candidateModelNames[index];
    const model = genAI.getGenerativeModel({ model: modelName });

    try {
      const result = await model.generateContent(prompt);
      return {
        text: result.response.text(),
        model: modelName,
      };
    } catch (error) {
      lastError = error;

      if (!shouldRetryWithNextModel(error) || index === candidateModelNames.length - 1) {
        break;
      }

      const message = error instanceof Error ? error.message : 'Unknown Gemini error';
      console.warn(
        `[Gemini] Model "${modelName}" unavailable, retrying with next candidate. ${message}`
      );
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'Gemini request failed';
  throw new Error(`Gemini error: ${message}`);
}

export async function generateContent(prompt: string): Promise<string> {
  const result = await generateContentWithMeta(prompt);
  return result.text;
}

export async function generateJSON<T>(prompt: string): Promise<T> {
  const text = await generateContent(prompt);
  const cleaned = extractJsonCandidate(text);

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${cleaned.substring(0, 200)}`);
  }
}
