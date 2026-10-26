"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Eye, EyeOff, Lock, TriangleAlert, User } from "lucide-react";
import { usernameSignIn } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginCard } from "@/components/login/login-card";
import { MagneticButton } from "@/components/login/magnetic-button";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

const FIELD =
  "h-12 w-full rounded-field border border-paper-line bg-field pl-11 pr-11 text-[15px] text-paper-ink shadow-field transition-all duration-300 placeholder:text-paper-muted focus:border-accent focus:outline-none focus:shadow-[0_0_0_4px_var(--accent-ring)]";

/** Coral underline that draws in from the left while the field has focus. */
function FocusUnderline() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-1.5 left-3 right-3 h-px origin-left scale-x-0 bg-accent transition-transform duration-300 group-focus-within:scale-x-100"
    />
  );
}

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [busy, setBusy] = useState(false);

  const loading = busy || success;
  const canSubmit = username.trim().length > 0 && password.length > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !canSubmit) return;
    setError(null);
    setBusy(true);

    let result: Awaited<ReturnType<typeof usernameSignIn>>;
    try {
      result = await usernameSignIn({ username, password, redirectTo });
    } catch {
      setBusy(false);
      setError("We couldn’t complete that request. Please try again.");
      return;
    }

    if (!result.ok) {
      setBusy(false);
      setError(result.message);
      return;
    }

    setSuccess(true);
    // Let the success morph land before the route changes.
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    router.replace(result.next);
    router.refresh();
  }

  function syncCapsLock(event: ReactKeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState?.("CapsLock") ?? false);
  }

  return (
    <LoginCard error={error} success={success}>
      <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              key="error"
              role="alert"
              initial={{ opacity: 0, y: -12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -12, height: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="overflow-hidden rounded-field border border-accent-ring bg-accent-tint px-4 py-3 text-[13px] text-ink"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Username */}
        <div className="group space-y-2">
          <Label
            htmlFor="username"
            className="transition-all duration-300 group-focus-within:-translate-y-0.5 group-focus-within:text-accent"
          >
            Username
          </Label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-muted transition-all duration-300 group-focus-within:translate-x-0.5 group-focus-within:text-accent"
              aria-hidden="true"
            />
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="your.username"
              className={FIELD}
            />
            <FocusUnderline />
          </div>
        </div>

        {/* Password */}
        <div className="group space-y-2">
          <Label
            htmlFor="password"
            className="transition-all duration-300 group-focus-within:-translate-y-0.5 group-focus-within:text-accent"
          >
            Password
          </Label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-muted transition-all duration-300 group-focus-within:translate-x-0.5 group-focus-within:text-accent"
              aria-hidden="true"
            />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => {
                setPasswordFocused(false);
                setCapsLock(false);
              }}
              onKeyUp={syncCapsLock}
              onKeyDown={syncCapsLock}
              placeholder="••••••••"
              className={cn(FIELD, "pr-12")}
            />
            <FocusUnderline />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-paper-muted transition-all duration-300 hover:text-accent active:scale-90"
            >
              <AnimatePresence mode="wait" initial={false}>
                {showPassword ? (
                  <motion.span
                    key="hide"
                    className="block"
                    initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
                    transition={{ duration: 0.2 }}
                  >
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="show"
                    className="block"
                    initial={{ opacity: 0, rotate: 45, scale: 0.7 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: -45, scale: 0.7 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>

          <AnimatePresence>
            {capsLock && passwordFocused && (
              <motion.p
                key="caps"
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -4 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="flex items-center gap-1.5 overflow-hidden text-[12px] text-warn"
              >
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Caps Lock is on
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <MagneticButton
          type="submit"
          loading={loading}
          success={success}
          disabled={loading || !canSubmit}
        >
          Sign in
        </MagneticButton>

        <div className="space-y-2 pt-1 text-center">
          <Link
            href="/forgot-password"
            className="link-underline label-mono block text-muted transition-colors hover:text-ink"
          >
            Forgot password? Ask your administrator
          </Link>
          <p className="text-[12px] leading-relaxed text-muted">
            Sign in with the username your administrator gave you. Accounts are
            created by an administrator — there is no email sign-up.
          </p>
        </div>
      </form>
    </LoginCard>
  );
}
