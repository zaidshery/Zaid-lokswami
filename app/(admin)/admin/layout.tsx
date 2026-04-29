import { auth } from '@/lib/auth';
import AdminShell from './AdminShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user;

  return (
    <AdminShell
      initialUser={{
        name: user?.name ?? null,
        email: user?.email ?? null,
        image: user?.image ?? null,
        role: user?.role,
      }}
    >
      {children}
    </AdminShell>
  );
}
