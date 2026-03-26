import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, LogIn, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
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

export default function LoginPage() {
  const { isAuthenticated, login, loginWithAzure } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [azureLoading, setAzureLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setError("");
    setLoading(true);
    const result = await login(email);
    if (!result.success) setError(result.error ?? "Login failed.");
    setLoading(false);
  };

  const handleAzureLogin = async () => {
    setError("");
    setAzureLoading(true);
    const result = await loginWithAzure();
    if (!result.success) setError(result.error ?? "Microsoft sign-in failed.");
    setAzureLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary mb-4">
            <Brain size={24} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">SIAP</h1>
          <p className="text-sm text-muted-foreground mt-1">Skill Intelligence &amp; Assessment Platform</p>
        </div>

        {/* SSO Card */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5 shadow-sm">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 gap-3 text-sm font-medium"
            onClick={handleAzureLogin}
            disabled={azureLoading}
          >
            <MicrosoftIcon />
            {azureLoading ? "Signing in…" : "Sign in with Microsoft"}
          </Button>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Demo login collapsible */}
        <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDemo(!showDemo)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Demo Login
            {showDemo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showDemo && (
            <div className="px-4 pb-4 space-y-4">
              <form onSubmit={handleDemoSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="h-9 text-sm"
                  />
                </div>
                <Button type="submit" size="sm" className="w-full gap-2" disabled={loading}>
                  <LogIn size={14} />
                  {loading ? "Signing in…" : "Sign In"}
                </Button>
              </form>

              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground text-[11px] uppercase tracking-wider">Demo accounts</p>
                <p>
                  <span className="font-medium text-foreground">Admin:</span> test_admin@1rivet.com
                </p>
                <p>
                  <span className="font-medium text-foreground">Manager:</span> test_manager@1rivet.com
                </p>
                <p>
                  <span className="font-medium text-foreground">Employee:</span> test_emp@1rivet.com
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
