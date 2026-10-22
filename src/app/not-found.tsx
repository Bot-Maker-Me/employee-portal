import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md animate-rise text-center">
        <Wordmark />
        <h1 className="mt-6 font-serif text-3xl text-ink">Page not found</h1>
        <p className="mt-2 text-[14px] text-muted">
          The page you’re looking for doesn’t exist.
        </p>
        <Link
          href="/home"
          className="label-mono mt-6 inline-block rounded-btn bg-accent px-4 py-2.5 text-white transition-colors hover:bg-accent-hover"
        >
          Go to portal
        </Link>
      </div>
    </main>
  );
}
