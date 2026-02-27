import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import { verifyAdminToken } from '@/lib/auth/adminToken';
import { generatePageImagesFromPdf } from '@/lib/utils/epaperPageImageGeneration';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (process.env.EPAPER_ENABLE_PAGE_IMAGE_GENERATION !== '1') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Page image generation is disabled. Enable EPAPER_ENABLE_PAGE_IMAGE_GENERATION=1 to use this endpoint.',
        },
        { status: 400 }
      );
    }

    await connectDB();
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid e-paper ID' },
        { status: 400 }
      );
    }

    const epaper = await EPaper.findById(id)
      .select('_id pdfPath pageCount pages')
      .lean();
    if (!epaper) {
      return NextResponse.json(
        { success: false, error: 'E-paper not found' },
        { status: 404 }
      );
    }

    if (/^https?:\/\//i.test(String(epaper.pdfPath || ''))) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Automatic server-side page-image generation is not available for cloud-hosted PDFs. Upload page images manually.',
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const source = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
    const requestedPageCount = Number.parseInt(String(source.pageCount ?? ''), 10);
    const pageCountFromRequest =
      Number.isFinite(requestedPageCount) && requestedPageCount > 0
        ? Math.floor(requestedPageCount)
        : 0;
    const targetPageCount = pageCountFromRequest || Math.max(1, Number(epaper.pageCount || 0));
    if (targetPageCount > 1000) {
      return NextResponse.json(
        { success: false, error: 'pageCount must be <= 1000' },
        { status: 400 }
      );
    }

    try {
      const generated = await generatePageImagesFromPdf({
        pdfPath: String(epaper.pdfPath || ''),
        pageCount: targetPageCount,
      });

      const pageMap = new Map<
        number,
        { pageNumber: number; imagePath?: string; width?: number; height?: number }
      >();

      const currentPages = Array.isArray(epaper.pages) ? epaper.pages : [];
      for (const page of currentPages) {
        const pageNumber = Number(page?.pageNumber || 0);
        if (!Number.isFinite(pageNumber) || pageNumber < 1) continue;
        pageMap.set(pageNumber, {
          pageNumber,
          imagePath: String(page?.imagePath || ''),
          width: Number.isFinite(Number(page?.width)) ? Number(page?.width) : undefined,
          height: Number.isFinite(Number(page?.height)) ? Number(page?.height) : undefined,
        });
      }

      for (const generatedPage of generated.generatedPages) {
        pageMap.set(generatedPage.pageNumber, generatedPage);
      }

      const nextPageCount = Math.max(
        Number(epaper.pageCount || 0),
        targetPageCount,
        ...Array.from(pageMap.keys())
      );

      const pages = Array.from({ length: nextPageCount }, (_, index) => {
        const pageNumber = index + 1;
        const existing = pageMap.get(pageNumber);
        return {
          pageNumber,
          imagePath: existing?.imagePath || '',
          width: existing?.width,
          height: existing?.height,
        };
      });

      const updated = await EPaper.findByIdAndUpdate(
        id,
        {
          pageCount: nextPageCount,
          pages,
        },
        { new: true, runValidators: true }
      ).lean();

      return NextResponse.json({
        success: true,
        message: 'Page images generated successfully',
        data: updated,
        generated: {
          converter: generated.converter,
          count: generated.generatedPages.length,
          requestedPageCount: targetPageCount,
        },
        warning:
          generated.generatedPages.length < targetPageCount
            ? `Generated ${generated.generatedPages.length}/${targetPageCount} pages. Upload the rest manually if required.`
            : null,
      });
    } catch (generationError: unknown) {
      const message =
        generationError instanceof Error ? generationError.message.trim() : '';
      const status =
        /No PDF converter found|invalid|outside e-paper storage|page count/i.test(message)
          ? 400
          : 500;
      return NextResponse.json(
        {
          success: false,
          error:
            message ||
            'Page image generation failed. Keep manual mode and upload page images.',
        },
        { status }
      );
    }
  } catch (error) {
    console.error('Failed to generate page images:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate page images' },
      { status: 500 }
    );
  }
}
