import WorkQueuePage from '@/components/admin/WorkQueuePage';

export const dynamic = 'force-dynamic';

export default function AdminReviewQueuePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  return <WorkQueuePage searchParams={searchParams} defaultView="review" routePath="/admin/review-queue" requiredPageKey="review_queue" />;
}
