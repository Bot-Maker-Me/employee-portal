import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/guard";
import { listUsersForAdmin } from "@/lib/admin/identity";
import { getAdminOrganizations } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { isPharmaConfigured } from "@/lib/pharma/client";
import { listPharmacies } from "@/lib/pharma/directory";
import { listMyPharmacies } from "@/lib/sites/data";
import { SectionMarker } from "@/components/section-marker";
import { AdminNav } from "@/components/admin/admin-nav";
import { PharmacyAccessAdmin } from "@/components/admin/pharmacy-access";

export default async function AdminPharmaciesPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/home");

  const supabase = createClient();
  const [pharmacies, users, organizations, access, tenants] = await Promise.all([
    listMyPharmacies(),
    listUsersForAdmin(ctx),
    ctx.isSuperAdmin
      ? getAdminOrganizations().then((orgs) => orgs.map((org) => org.name))
      : Promise.resolve(ctx.profile.organization ? [ctx.profile.organization] : []),
    supabase
      .from("pharmacy_access")
      .select("pharmacy_id, user_id")
      .then(({ data }) => (data ?? []).map((row) => `${row.pharmacy_id}:${row.user_id}`)),
    isPharmaConfigured() ? listPharmacies().catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <header>
        <SectionMarker index="05" label="Admin" />
        <h1 className="mt-4 font-serif text-3xl text-ink">Pharmacies</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-muted">
          Choose which staff can see each pharmacy’s Notices, Policies, Chat and
          Formulary. Drug Database and Intervention Codes are always open to
          everyone; administrators always see every pharmacy.
        </p>
      </header>

      <AdminNav />

      <PharmacyAccessAdmin
        pharmacies={pharmacies}
        users={users
          .filter((user) => user.organization && user.status === "active")
          .map((user) => ({
            id: user.id,
            name: user.fullName || user.username || "Unnamed",
            username: user.username,
            organization: user.organization as string,
            isAdmin: user.role === "admin" || user.role === "super_admin",
            appActive: user.appActive,
          }))}
        access={access}
        organizations={organizations}
        tenants={tenants}
        isSuperAdmin={ctx.isSuperAdmin}
      />
    </div>
  );
}
