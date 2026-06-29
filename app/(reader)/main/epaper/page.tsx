import type { Metadata } from 'next';
import {
  generateEPaperMetadata,
  renderEPaperPage,
  type EPaperReaderPageProps,
} from './EPaperPageServer';

export function generateMetadata(props: EPaperReaderPageProps): Promise<Metadata> {
  return generateEPaperMetadata(props, 'epaper');
}

export default function EPaperPage(props: EPaperReaderPageProps) {
  return renderEPaperPage(props, 'epaper');
}
