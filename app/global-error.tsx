'use client';
import ErrorState from './error-state';
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorState
          code="500"
          title="schwank hit a snag"
          copy="The application could not finish loading. Please try again."
          retry={reset}
        />
      </body>
    </html>
  );
}
