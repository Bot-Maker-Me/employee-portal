"use client";

import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Eye, EyeOff, Lock, Mail, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginCard } from "@/components/login/login-card";
import { MagneticButton } from "@/components/login/magnetic-button";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

const FIELD =
  "h-12 w-full rounded-field border border-paper-line bg-field pl-11 pr-11 text-[15px] text-paper-ink shadow-field transition-all duration-300 placeholder:text-paper-muted focus:border-accent focus:outline-none focus:shadow-[0_0_0_4px_var(--accent-ring)]";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const emailShake = useAnimationControls();
  const emailValid = EMAIL_RE.test(email.trim());

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(friendlyAuthError(signInError.message));
      setLoading(false);
      return;
    }

    setSuccess(true);
    // Give the success morph a moment to land before the route changes.
    await new Promise((resolve) => window.setTimeout(resolve, 750));

    const target = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/home";
    router.replace(target);
    router.refresh();
  }

  function handleEmailBlur() {
    if (email.length > 0 && !emailValid) {
      emailShake.start(
        { x: [0, -8, 8, -6, 6, -3, 0] },
        { duration: 0.4, ease: "easeInOut" },
      );
    }
  }

  function syncCapsLock(event: ReactKeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState?.("CapsLock") ?? false);
  }

  return (
    <LoginCard error={error} success={success}>
      <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
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

        {/* Email */}
        <div className="group space-y-2">
          <Label
            htmlFor="email"
            className="transition-all duration-300 group-focus-within:-translate-y-0.5 group-focus-within:text-accent"
          >
            Email
          </Label>
          <motion.div animate={emailShake} className="relative">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-muted transition-all duration-300 group-focus-within:translate-x-0.5 group-focus-within:text-accent"
              aria-hidden="true"
            />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={handleEmailBlur}
              placeholder="you@organisation.com"
              className={FIELD}
            />
            <FocusUnderline />
            <AnimatePresence>
              {emailValid && (
                <motion.span
                  key="valid"
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ok"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.2 }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      d="M4 12.5l5 5L20 6.5"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </svg>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
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
          disabled={loading || success}
        >
          Sign in
        </MagneticButton>

        <div className="pt-1 text-center">
          <Link
            href="/forgot-password"
            className="link-underline label-mono text-muted transition-colors hover:text-ink"
          >
            Forgot password?
          </Link>
        </div>
      </form>
    </LoginCard>
  );
}
