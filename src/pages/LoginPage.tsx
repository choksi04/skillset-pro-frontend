import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, LogIn, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary mb-4">
            <Brain size={24} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">SIAP</h1>
          <p className="text-sm text-muted-foreground mt-1">Skill Intelligence &amp; Assessment Platform</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 space-y-5 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-card-foreground">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
              className="h-10" />
            
          </div>

          {error &&
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          }

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            <LogIn size={16} />
            {loading ? "Signing in…" : "Sign In"}
          </Button>

          <p className="text-muted-foreground text-center text-base">USE DEMO ACCOUNTS MENTIONED BELOW 👇👇

          </p>
        </form>

        {/* Demo accounts hint */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
          <p className="font-medium text-muted-foreground text-xl font-mono">Demo accounts:</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p><span className="font-medium text-foreground">Admin:</span>jagdish@1rivet.com
            </p>
            <p className="mx-0 my-[16px]"<span className="font-medium text-foreground">Manager:</span>ashish@1rivet.com, purvesh@1rivet.com,
              gaurav@1rivet.com
            </p>
            <p><span className="font-medium text-foreground">Employee:</span> mitul@1rivet.com, akash@1rivet.com
            </p>
          </div>
        </div>
      </div>
    </div>);

}