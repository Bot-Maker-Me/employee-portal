"use client";

import { usePathname, useRouter } from "next/navigation";

/** Platform admins without an organization choose whose reference data to view. */
export function OrgPicker({ value, choices }: { value: string; choices: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  if (choices.length < 2) return null;
  return (
    <label className="label-mono inline-flex items-center gap-2 text-muted">
      Organization
      <select
        value={value}
        onChange={(event) => router.replace(`${pathname}?org=${encodeURIComponent(event.target.value)}`)}
        className="rounded-btn border border-line bg-sunken px-3 py-2 text-[13px] normal-case tracking-normal text-ink focus:border-accent focus:outline-none"
      >
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    </label>
  );
}
