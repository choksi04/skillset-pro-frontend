import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Brain, AlertCircle, ShieldCheck, Target, BarChart3 } from "lucide-react";

import rivetLogo from "@/assets/1rivet-logo.svg";

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function FeatureRow({ icon: Icon, title, desc }: { icon: typeof ShieldCheck; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon size={18} />
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { isAuthenticated, loginWithAzure } = useAuth();
  const [error, setError] = useState("");
  const [azureLoading, setAzureLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleAzureLogin = async () => {
    setError("");
    setAzureLoading(true);
    const result = await loginWithAzure();
    if (!result.success) setError(result.error ?? "Sign-in failed.");
    setAzureLoading(false);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-background">
      {/* LEFT — Brand panel */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between bg-gradient-to-br from-primary/10 via-background to-primary/5 p-12 xl:p-16">
        {/* Decorative accents */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

        {/* Top: Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Brain size={20} className="text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <p className="text-base font-bold tracking-tight text-foreground">SIAP</p>
            <p className="text-[11px] text-muted-foreground">Skill Intelligence &amp; Assessment Platform</p>
          </div>
        </div>

        {/* Middle: Hero + features */}
        <div className="relative z-10 max-w-md space-y-10">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-foreground xl:text-[2.75rem]">
              Skill intelligence,
              <br />
              <span className="text-primary">made measurable.</span>
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Replace spreadsheets with evidence-based skill assessments — designed for modern teams who care about
              capability, not guesswork.
            </p>
          </div>

          <div className="space-y-5">
            <FeatureRow
              icon={ShieldCheck}
              title="Enterprise SSO"
              desc="Secure, single-click access with your 1Rivet account."
            />
            <FeatureRow
              icon={Target}
              title="Validated Skills"
              desc="AI-evaluated assessments, finalized by manager review."
            />
            <FeatureRow
              icon={BarChart3}
              title="Capability Visibility"
              desc="Know your team's strengths at a glance — for better staffing decisions."
            />
          </div>
        </div>

        {/* Bottom: Powered by */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Powered by</span>
          <img src={rivetLogo} alt="1Rivet" className="h-5 dark:invert" />
        </div>
      </div>

      {/* RIGHT — Auth panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile brand (visible < lg) */}
          <div className="flex flex-col items-center text-center lg:hidden">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Brain size={22} className="text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">SIAP</h1>
          </div>

          {/* Heading */}
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to continue to SIAP.</p>
          </div>

          {/* Primary action */}
          <div className="space-y-4">
            <Button
              type="button"
              className="h-11 w-full gap-2.5 text-sm font-medium"
              onClick={handleAzureLogin}
              disabled={azureLoading}
            >
              <MicrosoftIcon />
              {azureLoading ? "Signing in…" : "Continue with 1Rivet Account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              For organization members with company credentials
            </p>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Preview-only demo login — hidden on production custom domain */}
          {/*
          
          {typeof window !== "undefined" && window.location.hostname !== "skillset.1rivet.com" && (
            <div className="space-y-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Preview only · Demo login
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full text-xs"
                onClick={() => {
                  localStorage.setItem("siap_user_id", "b81a6961-d6f7-470b-960e-b675f9cf3c6c");
                  window.location.href = "/";
                }}
              >
                Sign in as Admin{" "}
              </Button>
            </div>
          )}
          /*} 

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground">
            Don't have an account? Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
