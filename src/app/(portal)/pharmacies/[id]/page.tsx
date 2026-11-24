import { redirect } from "next/navigation";

export default function PharmacyIndexPage({ params }: { params: { id: string } }) {
  redirect(`/pharmacies/${params.id}/notices`);
}
