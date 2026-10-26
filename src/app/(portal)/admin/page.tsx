import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { getProfile, isAdmin, isSuperAdmin } from "@/lib/profile";
import { getAdminOrganizations, getAdminUsers } from "@/lib/admin";
import { listPendingResetRequests } from "@/lib/admin/identity";
import { SectionMarker } from "@/components/section-marker";
import { AdminConsole } from "@/components/admin/admin-console";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const profile = await getProfile(userId);
  if (!isAdmin(profile) || !profile) redirect("/home");

  const [users, organizations, resetRequests] = await Promise.all([
    getAdminUsers(),
    getAdminOrganizations(),
    listPendingResetRequests({
      userId,
      profile,
      isSuperAdmin: isSuperAdmin(profile),
    }),
  ]);

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <div>
        <SectionMarker index="05" label="Admin" />
        <h1 className="mt-4 font-serif text-3xl text-ink">Admin console</h1>
        <p className="mt-1.5 text-[14px] text-muted">
          Approve people, manage organizations, and switch features on or off.
          Sign-in accounts and password resets live in the sections below.
        </p>
      </div>

      <AdminNav pendingRequests={resetRequests.length} />

      <AdminConsole
        users={users}
        organizations={organizations}
        currentUserId={userId}
        isSuperAdmin={isSuperAdmin(profile)}
        defaultOrg={profile.organization ?? organizations[0]?.name ?? ""}
      />
    </div>
  );
}
