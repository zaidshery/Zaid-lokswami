import ElectionImageWidget from '@/components/ui/ElectionImageWidget';
import FeaturedElectionCoverage from '@/components/elections/FeaturedElectionCoverage';
import { readElectionResultsData } from '@/lib/elections/storage';

export const metadata = {
  title: 'Election Results and Live Counting Updates | Lokswami',
  description: 'Follow verified election counting trends, candidate positions, turnout, context, and final results from Lokswami.',
};

export const dynamic = 'force-dynamic';

export default async function ElectionsArchivePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await readElectionResultsData();
  const params = (await searchParams) || {};
  const isObsMode = params.obs === '1';
  return (
    <main className={isObsMode ? 'min-h-screen w-full bg-zinc-950 p-5' : 'mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8'}>
      <FeaturedElectionCoverage initialData={data} />

      {!isObsMode ? <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Previous elections</p>
        <h2 className="mt-2 text-2xl font-black text-zinc-950 dark:text-white">Results archive</h2>
        <div className="mt-5"><ElectionImageWidget surface="archive" /></div>
      </section> : null}
    </main>
  );
}
