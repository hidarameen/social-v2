import { redirect } from 'next/navigation';

export default function LegacyDashboardCreatePostPage() {
  redirect('/publish/manual');
}
