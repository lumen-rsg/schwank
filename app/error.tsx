'use client';
import { useEffect } from 'react';
import ErrorState from './error-state';
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorState
      code="500"
      title="Something went wrong"
      copy="Your private data is safe. Try the page again, or return home."
      retry={reset}
    />
  );
}
