import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import {
  buildSignedCloudinaryRawUploadUrl,
  parseCloudinaryAssetFromUrl,
} from '@/lib/utils/cloudinary';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function normalizePdfFormat(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized || '';
}

function resolvePdfFormatFromUrl(value: string) {
  try {
    const parsed = new URL(value);
    const lastSegment = decodeURIComponent(parsed.pathname.split('/').pop() || '');
    const ext = lastSegment.split('.').pop() || '';
    return normalizePdfFormat(ext);
  } catch {
    return '';
  }
}

function resolveCloudinaryPdfInfo(source: Record<string, unknown>) {
  const explicitPublicId = firstNonEmptyString(source.pdfPublicId);
  const explicitFormat = normalizePdfFormat(String(source.pdfFormat || ''));

  if (explicitPublicId) {
    return {
      publicId: explicitPublicId,
      format: explicitFormat || 'pdf',
    };
  }

  const pdfUrl = firstNonEmptyString(source.pdfUrl, source.pdfPath);
  if (!pdfUrl) return null;

  const parsed = parseCloudinaryAssetFromUrl(pdfUrl);
  if (!parsed || parsed.resourceType !== 'raw') return null;

  return {
    publicId: parsed.publicId,
    format: explicitFormat || resolvePdfFormatFromUrl(pdfUrl) || 'pdf',
  };
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'E-paper not found' },
        { status: 404 }
      );
    }

    await connectDB();
    const epaper = await EPaper.findById(id)
      .select('_id pdfPublicId pdfFormat pdfPath pdfUrl')
      .lean();

    if (!epaper) {
      return NextResponse.json(
        { success: false, error: 'E-paper not found' },
        { status: 404 }
      );
    }

    const source = asObject(epaper);
    const cloudinaryPdf = resolveCloudinaryPdfInfo(source);
    if (!cloudinaryPdf) {
      return NextResponse.json(
        { success: false, error: 'Cloudinary PDF metadata not available' },
        { status: 502 }
      );
    }

    let signedUrl = '';
    try {
      signedUrl = buildSignedCloudinaryRawUploadUrl({
        publicId: cloudinaryPdf.publicId,
        format: cloudinaryPdf.format || 'pdf',
      });
    } catch (error) {
      console.error('Failed to generate signed Cloudinary PDF URL:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create signed Cloudinary URL' },
        { status: 502 }
      );
    }

    if (!signedUrl) {
      return NextResponse.json(
        { success: false, error: 'Failed to create signed Cloudinary URL' },
        { status: 502 }
      );
    }

    const response = NextResponse.redirect(signedUrl, { status: 302 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('Failed to resolve e-paper PDF redirect:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to serve e-paper PDF' },
      { status: 500 }
    );
  }
}

