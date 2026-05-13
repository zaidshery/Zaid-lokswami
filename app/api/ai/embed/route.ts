import { NextResponse } from 'next/server';

const EMPTY_SUMMARY = {
  total: 0,
  trained: 0,
  percent: 0,
};

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      article: EMPTY_SUMMARY,
      epaper: EMPTY_SUMMARY,
      video: EMPTY_SUMMARY,
      story: EMPTY_SUMMARY,
      overall: EMPTY_SUMMARY,
      disabled: true,
      message:
        'Paid embedding training is disabled. Reader search uses local retrieval instead.',
    },
  });
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Paid embedding training is disabled. Use local search/retrieval mode.',
    },
    { status: 410 }
  );
}
