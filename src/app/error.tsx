"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/errors/ErrorFallback";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route rendering failed", { digest: error.digest });
  }, [error]);

  return <ErrorFallback error={error} retry={reset} />;
}
