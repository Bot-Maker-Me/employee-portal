import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/guard";
import { listPendingResetRequests } from "@/lib/admin/identity";
import { SectionMarker } from "@/components/section-marker";
import { AdminNav } from "@/components/admin/admin-nav";
import { PasswordRequests } from "@/components/admin/password-requests";

export default async function PasswordRequestsPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/home");

  const requests = await listPendingResetRequests(ctx);

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <header>
        <SectionMarker index="05" label="Admin" />
        <h1 className="mt-4 font-serif text-3xl text-ink">Password requests</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-muted">
          People who forgot their password ask an administrator for help. Set a
          temporary password, hand it over in person or by phone, and they choose
          their own password the next time they sign in.
        </p>
      </header>

      <AdminNav pendingRequests={requests.length} />

      <PasswordRequests requests={requests} />
    </div>
  );
}
