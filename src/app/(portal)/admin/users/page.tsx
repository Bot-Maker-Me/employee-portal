import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/guard";
import { listUsersForAdmin } from "@/lib/admin/identity";
import { getAdminOrganizations } from "@/lib/admin";
import { SectionMarker } from "@/components/section-marker";
import { AdminNav } from "@/components/admin/admin-nav";
import { UserAccounts } from "@/components/admin/user-accounts";

export default async function AdminUsersPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/home");

  const [users, organizations] = await Promise.all([
    listUsersForAdmin(ctx),
    getAdminOrganizations(),
  ]);

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <header>
        <SectionMarker index="05" label="Admin" />
        <h1 className="mt-4 font-serif text-3xl text-ink">User accounts</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-muted">
          Create accounts, give existing people a username, and switch access to
          this app on or off. Sign-in is by username and password — accounts
          created here have no real email address.
        </p>
      </header>

      <AdminNav />

      <UserAccounts
        users={users}
        currentUserId={ctx.userId}
        isSuperAdmin={ctx.isSuperAdmin}
        organizations={organizations.map((org) => org.name)}
        defaultOrg={ctx.profile.organization ?? organizations[0]?.name ?? ""}
      />
    </div>
  );
}
