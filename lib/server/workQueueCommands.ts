import 'server-only';

import { NextRequest } from 'next/server';
import type { WorkflowContentKey } from '@/lib/admin/articleWorkflowOverview';

export type WorkQueueCommandInput = {
  contentType: WorkflowContentKey;
  id: string;
  action: string;
  expectedVersion?: number;
  assignedToId?: string;
  priority?: string;
  dueAt?: string;
  scheduledFor?: string;
  reason?: string;
};

function buildRequest(request: Request, input: WorkQueueCommandInput) {
  const body = input.contentType === 'epaper'
    ? { assignedToId: input.assignedToId }
    : {
        action: input.action,
        expectedVersion: input.expectedVersion,
        assignedToId: input.assignedToId,
        priority: input.priority,
        dueAt: input.dueAt,
        scheduledFor: input.scheduledFor,
        comment: input.reason,
        rejectionReason: input.reason,
      };
  return new NextRequest(request.url, {
    method: 'PATCH',
    headers: request.headers,
    body: JSON.stringify(body),
  });
}

export async function dispatchWorkQueueCommand(request: Request, input: WorkQueueCommandInput) {
  const id = input.id.trim();
  if (!id) return Response.json({ success: false, error: 'Content id is required.' }, { status: 400 });
  const commandRequest = buildRequest(request, input);
  const context = { params: Promise.resolve({ id }) };

  switch (input.contentType) {
    case 'article': {
      const route = await import('@/app/api/admin/articles/[id]/route');
      return route.PATCH(commandRequest, context);
    }
    case 'story': {
      const route = await import('@/app/api/admin/stories/[id]/route');
      return route.PATCH(commandRequest, context);
    }
    case 'video': {
      const route = await import('@/app/api/admin/videos/[id]/route');
      return route.PATCH(commandRequest, context);
    }
    case 'epaper': {
      if (input.action !== 'assign') {
        return Response.json(
          { success: false, error: 'Publication production actions must be completed from the publication desk.' },
          { status: 400 }
        );
      }
      const route = await import('@/app/api/admin/epapers/[id]/route');
      return route.PATCH(commandRequest, context);
    }
  }
}
