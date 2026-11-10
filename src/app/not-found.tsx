import Link from "next/link";
import { PageContainer } from "@/components/shell/PageContainer";
import { BACK_TO_MAP, PAGE_NOT_FOUND } from "@/ui-copy/states";

export default function NotFound() {
  return (
    <PageContainer>
      <h1>{PAGE_NOT_FOUND}</h1>
      <p>
        <Link href="/">{BACK_TO_MAP}</Link>
      </p>
    </PageContainer>
  );
}
