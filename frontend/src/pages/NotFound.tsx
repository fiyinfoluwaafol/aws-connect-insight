import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, PhoneOff, Radio, Route } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const missingPath = location.pathname === "/" ? "/unknown-route" : location.pathname;
  const pathLabel = `${missingPath}${location.search}${location.hash}`;

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-6 py-12">
      <ThemeToggle className="absolute right-4 top-4 z-20 h-10 w-10" />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-10rem] h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-6rem] h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute inset-x-0 top-24 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
              <PhoneOff className="h-4 w-4 text-destructive" />
              Call disconnected
            </div>

            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              This route dropped like a customer call in a dead zone.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              The page you dialed never made it through our queue. The signal cut out before the route could connect,
              so we parked you on a safe line instead of leaving you in silence.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link to="/">
                  <Home className="h-4 w-4" />
                  Back to dashboard
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
                Go back
              </Button>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <Card className="border-border/70 bg-card/70 backdrop-blur">
                <CardContent className="p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Route className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Route missing</p>
                  <p className="mt-1 text-sm text-muted-foreground">No page answered this path.</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-card/70 backdrop-blur">
                <CardContent className="p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Radio className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Signal lost</p>
                  <p className="mt-1 text-sm text-muted-foreground">Connection broke before render.</p>
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-card/70 backdrop-blur">
                <CardContent className="p-4">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <PhoneOff className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Fallback engaged</p>
                  <p className="mt-1 text-sm text-muted-foreground">You were rerouted to a safe landing page.</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="animate-in fade-in zoom-in-95 duration-500 lg:justify-self-end">
            <Card className="relative overflow-hidden border-border/70 bg-card/80 shadow-2xl backdrop-blur">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-destructive" />
              <CardContent className="p-6 sm:p-8">
                <div className="mb-8 flex items-center justify-between border-b border-border/70 pb-5">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.28em] text-muted-foreground">
                      Failed connection
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-foreground">404</p>
                  </div>
                  <div className="rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">
                    Line dropped
                  </div>
                </div>

                <div className="relative mx-auto flex h-64 max-w-sm items-center justify-center">
                  <div className="absolute h-56 w-56 rounded-full border border-primary/15" />
                  <div className="absolute h-44 w-44 rounded-full border border-accent/20 animate-pulse" />
                  <div className="absolute h-32 w-32 rounded-full border border-destructive/30" />

                  <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 shadow-lg shadow-destructive/10">
                    <PhoneOff className="h-12 w-12 text-destructive" strokeWidth={1.75} />
                  </div>

                  <div className="absolute left-4 top-12 h-px w-24 -rotate-12 bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
                  <div className="absolute right-4 top-16 h-px w-20 rotate-12 bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
                  <div className="absolute bottom-16 left-10 h-px w-16 rotate-[18deg] bg-gradient-to-r from-transparent via-destructive/70 to-transparent" />
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    <span>Route log</span>
                    <span>Unresolved</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                      <span className="text-muted-foreground">Requested path</span>
                      <code className="max-w-[13rem] truncate font-medium text-foreground">{pathLabel}</code>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                      <span className="text-muted-foreground">Connection status</span>
                      <span className="font-medium text-destructive">Disconnected</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                      <span className="text-muted-foreground">Suggested action</span>
                      <span className="font-medium text-foreground">Return to an active line</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
