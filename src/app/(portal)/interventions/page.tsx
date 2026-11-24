import { isAdmin } from "@/lib/profile";
import { listRecords, resolveWorkingOrganization } from "@/lib/sites/data";
import { requirePortalUser } from "@/lib/sites/session";
import { SectionMarker } from "@/components/section-marker";
import { RecordTable } from "@/components/sites/record-table";
import { OrgPicker } from "@/components/sites/org-picker";

export default async function InterventionCodesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ q?: string; org?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const { profile } = await requirePortalUser();
  const { organization, choices } = await resolveWorkingOrganization(profile, searchParams.org);
  const result = await listRecords({
    entity: "intervention_codes",
    organization,
    query: searchParams.q,
  });

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionMarker index="02" label="Reference" />
          <h1 className="text-reveal mt-4 font-serif text-3xl text-ink">Intervention Codes</h1>
          <p className="mt-1.5 text-[14px] text-muted">
            Codes to use when documenting a pharmacist intervention.
          </p>
        </div>
        {organization && <OrgPicker value={organization} choices={choices} />}
      </header>
      <RecordTable
        entity="intervention_codes"
        rows={result.rows}
        total={result.total}
        truncated={result.truncated}
        canEdit={isAdmin(profile) && Boolean(organization)}
        organization={organization}
        searchPlaceholder="Search codes or descriptions"
      />
    </div>
  );
}
