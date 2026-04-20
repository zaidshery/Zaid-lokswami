import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionMock = vi.fn();
const getStoredStoryByIdMock = vi.fn();
const updateStoredStoryMock = vi.fn();
const canReadContentMock = vi.fn();

vi.mock('@/lib/auth/admin', () => ({
  getAdminSession: getAdminSessionMock,
}));

vi.mock('@/lib/storage/storiesFile', () => ({
  getStoredStoryById: getStoredStoryByIdMock,
  updateStoredStory: updateStoredStoryMock,
}));

vi.mock('@/lib/auth/permissions', () => ({
  canReadContent: canReadContentMock,
}));

vi.mock('@/lib/models/User', () => ({
  default: {
    findOne: vi.fn(),
  },
}));

function createJsonRequest(method: 'POST' | 'PATCH', body?: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/stories/story-1/video-production', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

const approvedStory = {
  _id: 'story-1',
  title: 'Approved story',
  author: 'Reporter',
  workflow: { status: 'approved' },
  videoProduction: {
    status: 'not_started',
    assignedTo: null,
    editorNotes: '',
    masterExportUrl: '',
    thumbnailUrl: '',
    updatedAt: null,
  },
};

describe('/api/admin/stories/[id]/video-production route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MONGODB_URI;
    canReadContentMock.mockReturnValue(true);
  });

  it('starts video production for approved stories', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'copy-1',
      email: 'copy@example.com',
      name: 'Copy Editor',
      role: 'copy_editor',
    });
    getStoredStoryByIdMock.mockResolvedValue(approvedStory);
    updateStoredStoryMock.mockImplementation(async (_id: string, updates: Record<string, unknown>) => ({
      ...approvedStory,
      ...updates,
    }));

    const { POST } = await import('@/app/api/admin/stories/[id]/video-production/route');
    const response = await POST(createJsonRequest('POST'), {
      params: Promise.resolve({ id: 'story-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateStoredStoryMock).toHaveBeenCalledWith(
      'story-1',
      expect.objectContaining({
        videoProduction: expect.objectContaining({
          status: 'editing',
          assignedTo: expect.objectContaining({
            id: 'copy-1',
            role: 'copy_editor',
          }),
        }),
      })
    );
    expect(payload).toEqual({
      success: true,
      data: {
        storyId: 'story-1',
        videoProduction: expect.objectContaining({
          status: 'editing',
        }),
      },
    });
  });

  it('updates production metadata once editing has started', async () => {
    getAdminSessionMock.mockResolvedValue({
      id: 'admin-1',
      email: 'desk@example.com',
      name: 'Desk',
      role: 'admin',
    });
    getStoredStoryByIdMock.mockResolvedValue({
      ...approvedStory,
      videoProduction: {
        ...approvedStory.videoProduction,
        status: 'editing',
      },
    });
    updateStoredStoryMock.mockImplementation(async (_id: string, updates: Record<string, unknown>) => ({
      ...approvedStory,
      ...updates,
    }));

    const { PATCH } = await import('@/app/api/admin/stories/[id]/video-production/route');
    const response = await PATCH(
      createJsonRequest('PATCH', {
        status: 'ready_to_publish',
        masterExportUrl: 'https://cdn.example.com/final.mp4',
        thumbnailUrl: 'https://cdn.example.com/final-thumb.jpg',
        editorNotes: 'Final export uploaded',
      }),
      {
        params: Promise.resolve({ id: 'story-1' }),
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateStoredStoryMock).toHaveBeenCalledWith(
      'story-1',
      expect.objectContaining({
        videoProduction: expect.objectContaining({
          status: 'ready_to_publish',
          masterExportUrl: 'https://cdn.example.com/final.mp4',
          thumbnailUrl: 'https://cdn.example.com/final-thumb.jpg',
          editorNotes: 'Final export uploaded',
        }),
      })
    );
    expect(payload).toEqual({
      success: true,
      data: {
        storyId: 'story-1',
        videoProduction: expect.objectContaining({
          status: 'ready_to_publish',
        }),
      },
    });
  });
});
