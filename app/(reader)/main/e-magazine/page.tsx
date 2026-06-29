import type { Metadata } from 'next';
import {
  generateEPaperMetadata,
  renderEPaperPage,
} from '../epaper/EPaperPageServer';

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata(props: PageProps): Promise<Metadata> {
  return generateEPaperMetadata(props, 'emagazine');
}

export default function EMagazinePage(props: PageProps) {
  return renderEPaperPage(props, 'emagazine');
}
