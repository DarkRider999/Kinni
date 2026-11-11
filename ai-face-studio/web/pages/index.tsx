import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    const seen = typeof window !== 'undefined' && window.localStorage.getItem('aifs.onboarded.v1');
    router.replace(seen ? '/home' : '/onboarding');
  }, [router]);
  return null;
}
