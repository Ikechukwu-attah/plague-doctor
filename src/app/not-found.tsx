import Link from "next/link";
import { BACK_TO_MAP, PAGE_NOT_FOUND } from "@/ui-copy/states";

export default function NotFound() {
  return (
    <div>
      <h1>{PAGE_NOT_FOUND}</h1>
      <p>
        <Link href="/">{BACK_TO_MAP}</Link>
      </p>
    </div>
  );
}
