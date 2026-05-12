import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin';
import { canManageSettings } from '@/lib/auth/permissions';
import connectDB from '@/lib/db/mongoose';
import TtsAsset from '@/lib/models/TtsAsset';
import TtsAuditEvent from '@/lib/models/TtsAuditEvent';
import { getTtsStorageConfig } from '@/lib/utils/ttsStorage';

// Auto-TTS (Gemini TTS) has been removed from this platform.
// All article audio is uploaded manually via DigitalOcean Spaces.
// This settings endpoint now only reports on manual upload storage and asset health.

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canManageSettings(admin.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const storage = await getTtsStorageConfig().catch(() => null);
    const [failedAssets, staleAssets, readyAssets] = await Promise.all([
      TtsAsset.countDocuments({ status: 'failed' }),
      TtsAsset.countDocuments({ status: 'stale' }),
      TtsAsset.countDocuments({ status: 'ready', provider: 'manual' }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        mode: 'manual-upload-only',
        message: 'Auto-TTS (Gemini) has been removed. Audio is uploaded manually via DigitalOcean Spaces.',
        storage: {
          mode: storage?.mode || 'unavailable',
          writable: Boolean(storage),
          digitalOceanSpacesConfigured: Boolean(
            process.env.DIGITALOCEAN_SPACES_ACCESS_KEY?.trim() &&
              process.env.DIGITALOCEAN_SPACES_SECRET_KEY?.trim() &&
              process.env.DIGITALOCEAN_SPACES_BUCKET?.trim() &&
              process.env.DIGITALOCEAN_SPACES_REGION?.trim()
          ),
        },
        assets: {
          ready: readyAssets,
          failed: failedAssets,
          stale: staleAssets,
        },
      },
    });
  } catch (error) {
    console.error('Failed to load admin TTS settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load TTS settings.' },
      { status: 500 }
    );
  }
}

// PUT is no longer supported — auto-TTS configuration has been removed.
export async function PUT() {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await TtsAuditEvent.create({
      action: 'config_update',
      result: 'skipped',
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: admin.role,
      message: 'Admin attempted TTS settings update but auto-TTS has been removed.',
      metadata: {},
    }).catch(() => undefined);

    return NextResponse.json(
      {
        success: false,
        error: 'Auto-TTS configuration has been removed. Audio is uploaded manually.',
      },
      { status: 405 }
    );
  } catch (error) {
    console.error('Failed to handle admin TTS settings PUT:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to handle TTS settings request.' },
      { status: 500 }
    );
  }
}
