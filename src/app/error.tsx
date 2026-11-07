"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/design-system/Button";
import { Notice } from "@/components/design-system/Notice";
import { BACK_TO_MAP, ERROR_HEADING, RETRY, errorArea, routeError } from "@/ui-copy/states";

/** Route error boundary (UI-12): names the failing area, retries via reset, leaks no internals. */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const area = errorArea(usePathname());
  return (
    <div>
      <h1>{ERROR_HEADING}</h1>
      <Notice tone="error" action={<Button onClick={reset}>{RETRY}</Button>}>
        {routeError({ area })}
      </Notice>
      <p>
        <Link href="/">{BACK_TO_MAP}</Link>
      </p>
    </div>
  );
}
