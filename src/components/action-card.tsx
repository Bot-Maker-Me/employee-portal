import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

export function ActionCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group hover-lift flex flex-col justify-between gap-6 rounded-ledger border border-line bg-raised p-6 shadow-raised hover:border-accent hover:shadow-[0_30px_54px_-32px_var(--accent)]"
    >
      <span className="grid h-10 w-10 place-items-center rounded-btn bg-accent-tint text-accent-soft transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-105">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        <span className="flex items-center gap-2 font-serif text-xl text-ink">
          {title}
          <ArrowRight
            className="h-4 w-4 text-accent-soft transition-transform duration-300 ease-out group-hover:translate-x-1"
            aria-hidden="true"
          />
        </span>
        <span className="mt-1.5 block text-[14px] text-muted">{description}</span>
      </span>
    </Link>
  );
}
