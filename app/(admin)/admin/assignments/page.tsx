import WorkQueuePage from '@/components/admin/WorkQueuePage';

export const dynamic = 'force-dynamic';

export default function AdminAssignmentsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  return <WorkQueuePage searchParams={searchParams} defaultView="unassigned" routePath="/admin/assignments" requiredPageKey="assignments" />;
}
