import { Link } from "react-router-dom";
import {
  Bell,
  Brain,
  FileText,
  Phone,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const SUPPORT_TEL = "tel:+15513671247";
const SUPPORT_DISPLAY = "(551) 367-1247";

const features = [
  {
    icon: Brain,
    title: "AI-powered analytics",
    description:
      "Surface patterns across sentiment, topics, and volume without digging through spreadsheets.",
    iconClass: "text-primary",
    iconBg: "bg-primary/10",
  },
  {
    icon: Bell,
    title: "Real-time alerts",
    description:
      "Catch escalations and outliers as they happen so supervisors can intervene with context.",
    iconClass: "text-accent",
    iconBg: "bg-accent/10",
  },
  {
    icon: Users,
    title: "Agent coaching",
    description:
      "Turn call insights into clear next steps for agents and team leads in one place.",
    iconClass: "text-primary",
    iconBg: "bg-primary/10",
  },
  {
    icon: TrendingUp,
    title: "Sentiment trends",
    description:
      "Track how customers feel over time and spot shifts before they become operational issues.",
    iconClass: "text-success",
    iconBg: "bg-success/10",
  },
  {
    icon: Search,
    title: "Call search",
    description:
      "Find the right conversation fast with search built for contact center workflows.",
    iconClass: "text-primary",
    iconBg: "bg-primary/10",
  },
  {
    icon: FileText,
    title: "Daily briefs",
    description:
      "Start each day with a concise snapshot of what mattered yesterday and what to watch today.",
    iconClass: "text-accent",
    iconBg: "bg-accent/10",
  },
] as const;

const steps = [
  {
    step: 1,
    title: "Connect your instance",
    description:
      "Link Amazon Connect so conversations and metadata flow into a single insights layer.",
  },
  {
    step: 2,
    title: "Monitor in real time",
    description:
      "Watch sentiment, alerts, and queue health from a supervisor view tuned for speed.",
  },
  {
    step: 3,
    title: "Coach your team",
    description:
      "Share exemplars, follow up on alerts, and keep agents aligned with what customers actually said.",
  },
] as const;

export default function Landing() {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <span className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
            Amazon Connect Insights
          </span>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle className="h-9 w-9 sm:h-10 sm:w-10" />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link to="/signin">Sign in</Link>
            </Button>
            <Button size="sm" className="sm:size-default" asChild>
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-4 pb-20 pt-12 sm:px-6 sm:pb-24 sm:pt-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.04] blur-[100px]" />
            <div className="absolute right-[12%] top-[22%] h-72 w-72 rounded-full bg-accent/[0.06] blur-[90px]" />
          </div>

          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="relative mb-10 flex h-48 w-48 items-center justify-center sm:mb-12 sm:h-56 sm:w-56">
              <div
                className="landing-ripple absolute rounded-full border border-primary/20"
                style={{ height: "100%", width: "100%", animationDelay: "0s" }}
              />
              <div
                className="landing-ripple absolute rounded-full border border-primary/15"
                style={{ height: "100%", width: "100%", animationDelay: "1.1s" }}
              />
              <div
                className="landing-ripple absolute rounded-full border border-accent/15"
                style={{ height: "100%", width: "100%", animationDelay: "2.2s" }}
              />

              <div className="absolute h-28 w-28 rounded-full border border-border/60 sm:h-32 sm:w-32" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/[0.08] ring-1 ring-primary/25 sm:h-24 sm:w-24">
                <Phone
                  className="h-9 w-9 text-primary sm:h-10 sm:w-10"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </div>
            </div>

            <div className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-border/50 bg-card/50 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Supervisor & agent insights
            </div>

            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-3 duration-500 sm:text-5xl lg:text-6xl">
              Clarity for every conversation
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75 sm:text-lg">
              Amazon Connect Insights brings AI-assisted analytics, alerts, and coaching into one
              calm workspace—built for supervisors who need signal, not noise.
            </p>

            <div className="mt-10 flex w-full flex-col gap-3 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150 sm:max-w-md sm:flex-row sm:justify-center">
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <Link to="/signup">Get started</Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                <Link to="/signin">Sign in</Link>
              </Button>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground animate-in fade-in duration-500 delay-200 sm:text-sm">
              Need help? Call{" "}
              <a
                href={SUPPORT_TEL}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {SUPPORT_DISPLAY}
              </a>
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border/60 bg-muted/20 px-4 py-20 sm:px-6 sm:py-24">
          <div className="container mx-auto max-w-6xl">
            <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
                Capabilities
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Everything your floor needs, nothing extra
              </h2>
              <p className="mt-3 text-muted-foreground sm:text-lg">
                Minimal surface, maximum context—aligned with how teams already run Amazon Connect.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {features.map(({ icon: Icon, title, description, iconClass, iconBg }) => (
                <Card
                  key={title}
                  className="border-border/60 bg-card/80 p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className={`mb-4 inline-flex rounded-lg p-3 ${iconBg}`}>
                    <Icon className={`h-6 w-6 ${iconClass}`} strokeWidth={1.75} aria-hidden />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 py-20 sm:px-6 sm:py-24">
          <div className="container mx-auto max-w-5xl">
            <div className="mb-12 text-center sm:mb-16">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
                How it works
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                From raw calls to confident coaching
              </h2>
            </div>

            <div className="relative grid gap-10 md:grid-cols-3 md:gap-6">
              <div
                className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px border-t border-dashed border-border/70 md:block"
                aria-hidden
              />
              {steps.map(({ step, title, description }) => (
                <div key={step} className="relative flex flex-col items-center text-center md:block">
                  <div className="relative z-10 mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-background text-lg font-semibold text-primary shadow-sm">
                    {step}
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Support CTA */}
        <section className="border-t border-border/60 px-4 py-16 sm:px-6 sm:py-20">
          <div className="container mx-auto max-w-4xl">
            <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card to-muted/40 p-8 shadow-sm sm:p-10">
              <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    Ready to transform your contact center?
                  </h2>
                  <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Real voice support is here—no simulated lines. Reach our team anytime you need
                    a human in the loop.
                  </p>
                  <a
                    href={SUPPORT_TEL}
                    className="inline-flex items-center gap-2 text-lg font-semibold text-primary hover:underline sm:text-xl"
                  >
                    <Phone className="h-5 w-5 shrink-0" aria-hidden />
                    {SUPPORT_DISPLAY}
                  </a>
                </div>
                <div className="flex shrink-0 flex-col gap-3 sm:items-end">
                  <Button size="lg" className="w-full sm:w-auto" asChild>
                    <Link to="/signup">Get started</Link>
                  </Button>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                    <a href={SUPPORT_TEL}>Contact support</a>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 px-4 py-6 sm:px-6">
        <div className="container mx-auto text-center text-xs text-muted-foreground">
          © {year} Amazon Connect Insights. Built for supervisors and agents.
        </div>
      </footer>
    </div>
  );
}
