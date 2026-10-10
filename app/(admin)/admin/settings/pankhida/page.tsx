import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import PankhidaSettingsForm from './PankhidaSettingsForm';

export default async function PankhidaSettingsPage() {
  const admin = await getAdminSession();
  if (!admin) redirect('/signin?redirect=/admin/settings/pankhida');
  if (!canViewPage(admin.role, 'newsroom_settings')) redirect('/admin');

  return <PankhidaSettingsForm />;
}
