import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionMarker } from "@/components/section-marker";
import { SignupForm } from "@/components/signup-form";
import { Wordmark } from "@/components/wordmark";

export default async function SignupPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/home");

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md items-center px-5 py-10">
      <div className="animate-rise">
        <Wordmark />
        <div className="mt-6 rounded-ledger border border-line bg-raised p-6 shadow-raised sm:p-8">
          <SectionMarker index="02" label="Register" />
          <h1 className="mt-4 font-serif text-2xl text-ink">Create your account</h1>
          <p className="mt-1.5 text-[14px] text-muted">
            Sign up, then an administrator approves you and links you to your
            organization.
          </p>
          <SignupForm />
        </div>
      </div>
    </main>
  );
}
