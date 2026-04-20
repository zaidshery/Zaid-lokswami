import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionMock = vi.fn();
const createStoryVideoUploadTargetMock = vi.fn();
const parseStoryVideoSizeMock = vi.fn();
const validateStoryVideoSelectionMock = vi.fn();
const verifyStoryVideoUploadMock = vi.fn();

vi.mock('@/lib/auth/admin', () => ({
  getAdminSession: getAdminSessionMock,
}));

vi.mock('@/lib/storage/storyVideoUpload', () => ({
  createStoryVideoUploadTarget: createStoryVideoUploadTargetMock,
  parseStoryVideoSize: parseStoryVideoSizeMock,
  validateStoryVideoSelection: validateStoryVideoSelectionMock,
  verifyStoryVideoUpload: verifyStoryVideoUploadMock,
}));

function createJsonRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/uploads/story-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('story video upload admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseStoryVideoSizeMock.mockImplementation((value: unknown) => Number(value || 0));
    validateStoryVideoSelectionMock.mockReturnValue(null);
  });

  it('rejects unauthenticated init requests', async () => {
    getAdminSessionMock.mockResolvedValue(null);

    const { POST } = await import('@/app/api/admin/uploads/story-video/init/route');
    const response = await POST(createJsonRequest({ fileName: 'clip.mp4', fileType: 'video/mp4', fileSize: 25 }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      success: false,
      error: 'Unauthorized',
    });
    expect(createStoryVideoUploadTargetMock).not.toHaveBeenCalled();
  });

  it('returns validation failures before creating an upload target', async () => {
    getAdminSessionMock.mockResolvedValue({ id: 'reporter-1', role: 'reporter' });
    validateStoryVideoSelectionMock.mockReturnValue('Video must be an MP4 file.');

    const { POST } = await import('@/app/api/admin/uploads/story-video/init/route');
    const response = await POST(createJsonRequest({ fileName: 'clip.mov', fileType: 'video/quicktime', fileSize: 30 }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      success: false,
      error: 'Video must be an MP4 file.',
    });
    expect(createStoryVideoUploadTargetMock).not.toHaveBeenCalled();
  });

  it('creates a signed upload target for valid files', async () => {
    getAdminSessionMock.mockResolvedValue({ id: 'reporter-1', role: 'reporter' });
    createStoryVideoUploadTargetMock.mockReturnValue({
      mediaKey: 'stories/videos/2026/04/18/story-1.mp4',
      mediaUrl: 'https://cdn.example.com/stories/videos/2026/04/18/story-1.mp4',
      uploadUrl: 'https://origin.example.com/signed-put',
      uploadHeaders: {
        'Content-Type': 'video/mp4',
        'x-amz-acl': 'public-read',
      },
      expiresAt: '2026-04-18T12:00:00.000Z',
    });

    const { POST } = await import('@/app/api/admin/uploads/story-video/init/route');
    const response = await POST(
      createJsonRequest({
        storyId: 'story-1',
        fileName: 'clip.mp4',
        fileType: 'video/mp4',
        fileSize: 28 * 1024 * 1024,
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(createStoryVideoUploadTargetMock).toHaveBeenCalledWith({
      storyId: 'story-1',
      fileName: 'clip.mp4',
      fileType: 'video/mp4',
      fileSize: 28 * 1024 * 1024,
    });
    expect(payload).toEqual({
      success: true,
      message: 'Story video upload initialized successfully',
      data: {
        mediaKey: 'stories/videos/2026/04/18/story-1.mp4',
        mediaUrl: 'https://cdn.example.com/stories/videos/2026/04/18/story-1.mp4',
        uploadUrl: 'https://origin.example.com/signed-put',
        uploadHeaders: {
          'Content-Type': 'video/mp4',
          'x-amz-acl': 'public-read',
        },
        expiresAt: '2026-04-18T12:00:00.000Z',
      },
    });
  });

  it('verifies uploaded files before returning story metadata', async () => {
    getAdminSessionMock.mockResolvedValue({ id: 'reporter-1', role: 'reporter' });
    verifyStoryVideoUploadMock.mockResolvedValue({
      mediaUrl: 'https://cdn.example.com/stories/videos/2026/04/18/story-1.mp4',
      mediaKey: 'stories/videos/2026/04/18/story-1.mp4',
      mediaSizeBytes: 30 * 1024 * 1024,
      mediaMimeType: 'video/mp4',
      storageProvider: 'do-spaces',
    });

    const { POST } = await import('@/app/api/admin/uploads/story-video/complete/route');
    const response = await POST(
      createJsonRequest({
        mediaKey: 'stories/videos/2026/04/18/story-1.mp4',
        expectedSize: 30 * 1024 * 1024,
        expectedFileType: 'video/mp4',
        expectedFileName: 'story-1.mp4',
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(verifyStoryVideoUploadMock).toHaveBeenCalledWith(
      'stories/videos/2026/04/18/story-1.mp4'
    );
    expect(payload).toEqual({
      success: true,
      message: 'Story video upload verified successfully',
      data: {
        mediaUrl: 'https://cdn.example.com/stories/videos/2026/04/18/story-1.mp4',
        mediaKey: 'stories/videos/2026/04/18/story-1.mp4',
        mediaSizeBytes: 30 * 1024 * 1024,
        mediaMimeType: 'video/mp4',
        storageProvider: 'do-spaces',
      },
    });
  });
});
