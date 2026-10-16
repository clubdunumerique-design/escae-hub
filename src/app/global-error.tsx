"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/errors/ErrorFallback";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root rendering failed", { digest: error.digest });
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <ErrorFallback error={error} retry={reset} />
      </body>
    </html>
  );
}
