import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import ArticleCreatePageClient from './ArticleCreatePageClient';

export default async function NewArticlePage() {
  const admin = await getAdminSession();

  if (!admin) {
    redirect('/signin?redirect=/admin/articles/new');
  }

  if (!canViewPage(admin.role, 'article_create')) {
    redirect('/admin');
  }

  return <ArticleCreatePageClient />;
}
