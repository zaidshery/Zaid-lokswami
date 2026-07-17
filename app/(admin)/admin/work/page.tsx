import WorkQueuePage from '@/components/admin/WorkQueuePage';

export const dynamic = 'force-dynamic';

export default function AdminWorkQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <WorkQueuePage searchParams={searchParams} defaultView="mine" routePath="/admin/work" />;
}
