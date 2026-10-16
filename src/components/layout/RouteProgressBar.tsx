"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  // When pathname or searchParams change, the navigation has completed
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname, searchParams]);

  // Intercept click on links to show immediate progress
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (
        target &&
        target.href &&
        target.href.startsWith(window.location.origin) &&
        !target.hasAttribute("download") &&
        target.target !== "_blank" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        const nextUrl = new URL(target.href);
        const currentUrl = new URL(window.location.href);
        if (nextUrl.pathname !== currentUrl.pathname || nextUrl.search !== currentUrl.search) {
          setIsNavigating(true);
        }
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-transparent overflow-hidden pointer-events-none">
      <div className="h-full bg-gradient-to-r from-[#03A61C] via-[#05F228] to-[#79F281] shadow-[0_0_12px_#05F228] animate-progress origin-left" />
    </div>
  );
}
