import { redirect } from "next/navigation";

export default async function PharmacyIndexPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  redirect(`/pharmacies/${params.id}/notices`);
}
