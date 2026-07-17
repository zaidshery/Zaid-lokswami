import WorkQueuePage from '@/components/admin/WorkQueuePage';

export const dynamic = 'force-dynamic';

export default function AdminContentQueuePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  return <WorkQueuePage searchParams={searchParams} defaultView="publishing" routePath="/admin/content-queue" requiredPageKey="content_queue" />;
}
