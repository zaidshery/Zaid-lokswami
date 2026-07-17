import WorkQueuePage from '@/components/admin/WorkQueuePage';

export const dynamic = 'force-dynamic';

export default function AdminMyWorkPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  return <WorkQueuePage searchParams={searchParams} defaultView="mine" routePath="/admin/my-work" requiredPageKey="my_work" />;
}
