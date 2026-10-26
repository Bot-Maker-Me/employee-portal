import { SignOutButton } from "@/components/sign-out-button";
import type { Profile } from "@/lib/profile";

function initials(name: string | null, username: string | null) {
  const source = (name ?? username ?? "?").trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return chars.join("") || "?";
}

export function UserFooter({ profile }: { profile: Profile }) {
  const name = profile.full_name ?? profile.username ?? "Team member";

  return (
    <div className="space-y-3 border-t border-line px-3 pt-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-tint font-mono text-[11px] text-accent-soft">
          {initials(profile.full_name, profile.username)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] text-ink">{name}</span>
          <span className="label-mono block truncate text-muted">
            {profile.username ? `@${profile.username}` : "No username"}
          </span>
        </span>
      </div>
      <SignOutButton />
    </div>
  );
}
