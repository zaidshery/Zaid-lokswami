import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectDBMock = vi.fn();
const ttsAssetUpdateManyMock = vi.fn();
const ttsAssetFindOneAndUpdateMock = vi.fn();
const ttsAuditEventCreateMock = vi.fn();

vi.mock('@/lib/db/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/lib/models/TtsAsset', () => ({
  default: {
    updateMany: ttsAssetUpdateManyMock,
    findOneAndUpdate: ttsAssetFindOneAndUpdateMock,
  },
}));

vi.mock('@/lib/models/TtsAuditEvent', () => ({
  default: {
    create: ttsAuditEventCreateMock,
  },
}));

vi.mock('@/lib/models/TtsConfig', () => ({
  default: {},
}));

vi.mock('@/lib/ai/geminiTts', () => ({
  getGeminiTtsRuntimeConfig: vi.fn(),
  getGeminiTtsUnavailableStatus: vi.fn(),
  isGeminiTtsConfigured: vi.fn(),
  synthesizeGeminiSpeech: vi.fn(),
}));

vi.mock('@/lib/utils/ttsStorage', () => ({
  deleteStoredTtsAsset: vi.fn(),
  hasStoredTtsAsset: vi.fn(() => true),
  saveTtsAudioBuffer: vi.fn(),
}));

describe('manual TTS assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectDBMock.mockResolvedValue(undefined);
    ttsAssetUpdateManyMock.mockResolvedValue({ modifiedCount: 1 });
    ttsAuditEventCreateMock.mockResolvedValue({});
  });

  it('saves uploaded manual audio as ready and marks older manual audio stale', async () => {
    const readyAsset = {
      _id: { toString: () => 'tts-new' },
      sourceType: 'epaperArticle',
      sourceId: 'story-1',
      variant: 'epaper_story',
      provider: 'manual',
      status: 'ready',
      audioUrl: 'https://cdn.example.com/lokswami/tts/epaperArticle/story-1/manual/listen.mp3',
    };
    ttsAssetFindOneAndUpdateMock.mockResolvedValue(readyAsset);

    const { saveManualTtsAsset } = await import('@/lib/server/ttsAssets');
    const result = await saveManualTtsAsset({
      sourceType: 'epaperArticle',
      sourceId: 'story-1',
      sourceParentId: 'paper-1',
      variant: 'epaper_story',
      title: 'Lead Story',
      text: 'Readable story text',
      audioUrl: 'https://cdn.example.com/lokswami/tts/epaperArticle/story-1/manual/listen.mp3',
      mimeType: 'audio/mpeg',
      mediaKey: 'lokswami/tts/epaperArticle/story-1/manual/listen.mp3',
      actor: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });

    expect(result).toBe(readyAsset);
    expect(ttsAssetUpdateManyMock).toHaveBeenCalledWith(
      {
        sourceType: 'epaperArticle',
        sourceId: 'story-1',
        variant: 'epaper_story',
        provider: 'manual',
        status: 'ready',
        contentVersionHash: { $ne: expect.any(String) },
      },
      {
        $set: expect.objectContaining({
          status: 'stale',
          lastError: 'Superseded by a newer manually uploaded audio file.',
        }),
      }
    );
    expect(ttsAssetFindOneAndUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'epaperArticle',
        sourceId: 'story-1',
        variant: 'epaper_story',
        provider: 'manual',
        model: 'manual-upload',
        voice: 'manual-upload',
        languageCode: 'manual',
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          sourceParentId: 'paper-1',
          status: 'ready',
          storageMode: 'spaces',
          audioUrl: 'https://cdn.example.com/lokswami/tts/epaperArticle/story-1/manual/listen.mp3',
          mimeType: 'audio/mpeg',
          chunkCount: 1,
          charCount: 19,
          metadata: expect.objectContaining({
            manualUpload: true,
            mediaKey: 'lokswami/tts/epaperArticle/story-1/manual/listen.mp3',
          }),
        }),
        $setOnInsert: { failureCount: 0 },
      }),
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    expect(ttsAuditEventCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'generate',
        result: 'success',
        assetId: 'tts-new',
        sourceType: 'epaperArticle',
        sourceId: 'story-1',
        variant: 'epaper_story',
      })
    );
  });
});
