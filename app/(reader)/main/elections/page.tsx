import ElectionImageWidget from '@/components/ui/ElectionImageWidget';

export const metadata = {
  title: 'Election Results 2026 | Lokswami',
  description: 'Archived election result graphics and seat tallies from Lokswami.',
};

export default function ElectionsArchivePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">
          Election Center
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 md:text-4xl dark:text-white">
          Election Results Archive
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Final seat tallies, state graphics, and result summaries are preserved here after live counting ends.
        </p>
      </div>

      <ElectionImageWidget surface="archive" />
    </main>
  );
}
