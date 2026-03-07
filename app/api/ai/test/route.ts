import { NextResponse } from 'next/server';
import {
  generateContentWithMeta,
  getGeminiCandidateModels,
  getGeminiConfiguredModelName,
} from '@/lib/ai/gemini';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  const configuredModel = getGeminiConfiguredModelName();

  if (!apiKey) {
    return NextResponse.json({
      status: 'error',
      message: 'GEMINI_API_KEY is not set in environment',
      fix: 'Add GEMINI_API_KEY to .env.local and restart server',
    });
  }

  try {
    const result = await generateContentWithMeta(
      'Say "Lokswami AI is working!" in Hindi in one sentence.'
    );

    return NextResponse.json({
      status: 'ok',
      message: 'Gemini API is working correctly',
      model: result.model,
      configuredModel,
      candidateModels: getGeminiCandidateModels(),
      testResponse: result.text,
      apiKeyPrefix: `${apiKey.substring(0, 8)}...`,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      apiKeyPrefix: `${apiKey.substring(0, 8)}...`,
      model: configuredModel,
      candidateModels: getGeminiCandidateModels(),
    });
  }
}
