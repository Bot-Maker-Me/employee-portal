import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/profile";
import { getMyPharmacy, listNotices } from "@/lib/sites/data";
import { requirePortalUser } from "@/lib/sites/session";
import { NoticeBoard } from "@/components/sites/notice-board";

export default async function PharmacyNoticesPage({ params }: { params: { id: string } }) {
  const { profile } = await requirePortalUser();
  const pharmacy = await getMyPharmacy(params.id);
  if (!pharmacy) notFound();
  const notices = await listNotices(pharmacy.id);
  return <NoticeBoard pharmacyId={pharmacy.id} notices={notices} canEdit={isAdmin(profile)} />;
}
