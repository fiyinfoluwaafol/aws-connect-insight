import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, PhoneOff } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const attemptedPath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <ThemeToggle className="absolute right-4 top-4 z-20 h-10 w-10" />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-10 flex max-w-lg flex-col items-center text-center animate-in fade-in slide-in-from-bottom-3 duration-500">
        {/* Signal ripple visual */}
        <div className="relative mb-12 flex h-52 w-52 items-center justify-center">
          {/* Expanding ripple rings */}
          <div
            className="notfound-ripple absolute rounded-full border border-muted-foreground/[0.07]"
            style={{ height: "100%", width: "100%", animationDelay: "0s" }}
          />
          <div
            className="notfound-ripple absolute rounded-full border border-muted-foreground/[0.07]"
            style={{ height: "100%", width: "100%", animationDelay: "1.2s" }}
          />
          <div
            className="notfound-ripple absolute rounded-full border border-muted-foreground/[0.07]"
            style={{ height: "100%", width: "100%", animationDelay: "2.4s" }}
          />

          {/* Static inner ring */}
          <div className="absolute h-24 w-24 rounded-full border border-border/40" />

          {/* Center icon */}
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-destructive/[0.08] ring-1 ring-destructive/20">
            <PhoneOff
              className="h-7 w-7 text-destructive/70"
              strokeWidth={1.5}
            />
          </div>
        </div>

        {/* Status badge */}
        <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-border/50 bg-card/50 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive/80" />
          404 · Not found
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Page not found
        </h1>

        {/* Description */}
        <p className="mt-4 max-w-sm text-[0.95rem] leading-relaxed text-muted-foreground">
          There isn&apos;t a page at this URL. It looks like your call got
          misplaced somewhere along the line—the route you dialed doesn&apos;t
          match any active line in our system.
        </p>

        {/* Attempted path */}
        <code className="mt-6 inline-block max-w-xs truncate rounded-lg border border-border/40 bg-muted/40 px-3.5 py-1.5 text-xs text-muted-foreground/80">
          {attemptedPath}
        </code>

        {/* Actions */}
        <div className="mt-9 flex gap-3">
          <Button asChild size="lg" className="gap-2">
            <Link to="/">
              <Home className="h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
