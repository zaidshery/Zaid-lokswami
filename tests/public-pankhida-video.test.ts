import { beforeEach, describe, expect, it, vi } from 'vitest';

const isMongoAvailableMock = vi.fn();
const findMock = vi.fn();
const listAllStoredVideosMock = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/mongoAvailability', () => ({ isMongoAvailable: isMongoAvailableMock }));
vi.mock('@/lib/models/Video', () => ({ default: { find: findMock } }));
vi.mock('@/lib/storage/videosFile', () => ({ listAllStoredVideos: listAllStoredVideosMock }));

const NOW = new Date('2026-10-10T10:00:00.000Z');
const live = {
  title: 'Pankhida Live',
  videoUrl: 'https://www.youtube.com/live/dQw4w9WgXcQ',
  destination: 'pankhida-2026',
  isPublished: true,
  workflow: { status: 'published' },
  processingStatus: 'ready',
  publishedAt: '2026-10-10T09:00:00.000Z',
};

describe('Pankhida public video selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMongoAvailableMock.mockResolvedValue(false);
    listAllStoredVideosMock.mockResolvedValue([]);
  });

  it('uses the latest eligible assigned video from file storage', async () => {
    listAllStoredVideosMock.mockResolvedValue([
      live,
      { ...live, title: 'Future', publishedAt: '2026-10-11T09:00:00.000Z' },
      { ...live, title: 'Draft', workflow: { status: 'draft' } },
    ]);
    const { getCurrentPankhidaVideo } = await import('@/lib/server/publicPankhidaVideo');
    await expect(getCurrentPankhidaVideo(NOW)).resolves.toEqual({
      title: 'Pankhida Live',
      youtubeUrl: live.videoUrl,
      publishedAt: live.publishedAt,
    });
  });

  it('uses MongoDB as the authoritative source when available', async () => {
    isMongoAvailableMock.mockResolvedValue(true);
    findMock.mockReturnValue({
      select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [live] }) }) }),
    });
    const { getCurrentPankhidaVideo } = await import('@/lib/server/publicPankhidaVideo');
    await expect(getCurrentPankhidaVideo(NOW)).resolves.toEqual({
      title: 'Pankhida Live',
      youtubeUrl: live.videoUrl,
      publishedAt: live.publishedAt,
    });
    expect(listAllStoredVideosMock).not.toHaveBeenCalled();
    expect(findMock).toHaveBeenCalledWith(expect.objectContaining({ destination: 'pankhida-2026', isPublished: true }));
  });
});
