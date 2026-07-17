import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('legacy workflow URLs', () => {
  it.each([
    ['my-work', 'mine'],
    ['review-queue', 'review'],
    ['assignments', 'unassigned'],
    ['content-queue', 'publishing'],
  ])('renders /admin/%s as the shared %s workbench view', (route, view) => {
    const source = read(`app/(admin)/admin/${route}/page.tsx`);
    expect(source).toContain("from '@/components/admin/WorkQueuePage'");
    expect(source).toContain(`defaultView="${view}"`);
  });
});
