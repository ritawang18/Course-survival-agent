"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Mail, User, ArrowRight } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";
import { getSupabaseClient } from "@/lib/supabase/client";

function scorePassword(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0..4
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);
  const strengthLabel =
    strength <= 1 ? "Weak" : strength === 2 ? "Okay" : strength === 3 ? "Good" : "Strong";
  const strengthColor =
    strength <= 1
      ? "bg-danger"
      : strength === 2
      ? "bg-warning"
      : strength === 3
      ? "bg-accent"
      : "bg-success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/dashboard`
              : undefined,
        },
      });
      if (signUpError) throw signUpError;

      // If email confirmation is required, session will be null here.
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/dashboard`
              : undefined,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign up with Google");
    }
  };

  if (success) {
    return (
      <AuthCard
        title="Check your email"
        description="We sent a confirmation link to your inbox. Click it to activate your account."
        footer={
          <>
            Wrong address?{" "}
            <button
              onClick={() => setSuccess(false)}
              className="text-accent font-medium hover:underline"
            >
              Try again
            </button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center py-4">
          <div className="h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center mb-3">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <p className="text-sm text-text/90">
            A verification email has been sent to{" "}
            <span className="font-medium">{email}</span>.
          </p>
          <p className="text-xs text-muted mt-2">
            Didn't receive it? Check spam or request a new link.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      description="Track courses, plan study time, and stay ahead of deadlines."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-accent font-medium hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2.5 text-xs text-danger">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="name" className="text-xs font-medium">
            Full name
          </label>
          <div className="relative mt-1.5">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Marco Silva"
              className="h-10 pl-9"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="text-xs font-medium">
            Email
          </label>
          <div className="relative mt-1.5">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className="h-10 pl-9"
            />
          </div>
        </div>

        <PasswordField
          label="Password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />

        {password.length > 0 && (
          <div className="flex items-center gap-2 -mt-2">
            <div className="flex-1 h-1 rounded-full bg-[hsl(var(--surface-2))] overflow-hidden">
              <div
                className={cn("h-full transition-all", strengthColor)}
                style={{ width: `${(strength / 4) * 100}%` }}
              />
            </div>
            <span className="text-[11px] text-muted w-12 text-right">
              {strengthLabel}
            </span>
          </div>
        )}

        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter your password"
        />

        <p className="text-[11px] text-muted leading-relaxed">
          By signing up you agree to our{" "}
          <a href="#" className="text-accent hover:underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="#" className="text-accent hover:underline">
            Privacy Policy
          </a>
          .
        </p>

        <Button
          type="submit"
          size="lg"
          className="w-full h-11"
          loading={loading}
        >
          {!loading && <ArrowRight className="h-4 w-4 order-last" />}
          Create account
        </Button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/60" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-surface px-3 text-[11px] uppercase tracking-wider text-muted">
            or sign up with
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full h-11"
        onClick={handleGoogle}
      >
        <GoogleIcon />
        Google
      </Button>
    </AuthCard>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09 0-.73.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
