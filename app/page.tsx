import HouseholdApp from './household-app';
import { getUserFromCookie } from '@/db/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const requestHeaders = await headers();
  const user = await getUserFromCookie(requestHeaders.get('cookie'));
  if (!user) redirect('/login');
  return <HouseholdApp initialUser={user} />;
}
