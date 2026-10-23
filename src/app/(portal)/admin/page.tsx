import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin, isSuperAdmin } from "@/lib/profile";
import { getAdminOrganizations, getAdminUsers } from "@/lib/admin";
import { SectionMarker } from "@/components/section-marker";
import { AdminConsole } from "@/components/admin/admin-console";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!isAdmin(profile)) redirect("/home");

  const [users, organizations] = await Promise.all([
    getAdminUsers(),
    getAdminOrganizations(),
  ]);

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <div>
        <SectionMarker index="05" label="Admin" />
        <h1 className="mt-4 font-serif text-3xl text-ink">Admin console</h1>
        <p className="mt-1.5 text-[14px] text-muted">
          Approve people, manage organizations, and switch features on or off.
        </p>
      </div>

      <AdminConsole
        users={users}
        organizations={organizations}
        currentUserId={user.id}
        isSuperAdmin={isSuperAdmin(profile)}
        defaultOrg={profile?.organization ?? organizations[0]?.name ?? ""}
      />
    </div>
  );
}
