import { PathogenSchema } from "@/evidence/schemas";
import { CityDetail } from "@/components/city/CityDetail";
import { PageContainer } from "@/components/shell/PageContainer";

export default async function CityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ virus?: string | string[] }>;
}) {
  const { locationId } = await params;
  const sp = await searchParams;
  const parsed = PathogenSchema.safeParse(Array.isArray(sp.virus) ? sp.virus[0] : sp.virus);
  return (
    <PageContainer variant="city">
      <CityDetail
        locationId={decodeURIComponent(locationId)}
        variant="page"
        {...(parsed.success ? { virus: parsed.data } : {})}
      />
    </PageContainer>
  );
}
