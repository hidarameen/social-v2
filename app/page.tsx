import { redirect } from 'next/navigation';
import { unifiedPanelRoute } from '@/lib/unified-panel';

export default function HomePage() {
  redirect(unifiedPanelRoute('/dashboard'));
}
