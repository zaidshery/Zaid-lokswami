import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'disabled',
    provider: 'none',
    message:
      'Paid external AI APIs are disabled for this project. No OpenAI or Gemini API key is required.',
    mode: 'manual-plus-local',
  });
}
