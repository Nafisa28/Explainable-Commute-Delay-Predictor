import Link from "next/link";
import RouteLineHero from "@/components/RouteLineHero";

export default function HomePage() {
  return (
    <div className="page-container">
      {/* Hero Section */}
      <section className="py-16 md:py-24 text-center">
        {/* Pill badge */}
        <div className="badge-pill mb-8 inline-flex">
          <span className="h-2 w-2 rounded-full bg-factor-rain animate-pulse" />
          <span>Live data collection running</span>
        </div>

        {/* Headline — Fraunces */}
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5 text-ink">
          Know your commute delay
          <br />
          <span className="text-accent-route">before you leave.</span>
        </h1>

        {/* Subheading — Inter */}
        <p className="mx-auto max-w-2xl text-lg text-text-secondary leading-relaxed mb-10">
          Predict travel delays on Bengaluru routes using real-time traffic and
          weather data — and understand{" "}
          <em className="not-italic text-ink font-medium">why</em> each
          prediction was made, powered by explainable AI.
        </p>

        {/* Animated street grid map SVG */}
        <RouteLineHero />

        {/* CTA buttons */}
        <div className="flex items-center justify-center gap-3 mt-10">
          <Link href="/predict" className="btn btn-primary text-base px-7 py-3">
            Try a Prediction →
          </Link>
          <Link href="/history" className="btn btn-secondary text-base px-7 py-3">
            View History
          </Link>
        </div>
      </section>

      <div className="divider" />

      {/* How it works */}
      <section className="py-14">
        <h2 className="font-display text-center text-2xl font-bold tracking-tight mb-12 text-ink">
          How it works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card text-center">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-route-dim text-accent-route text-xl">
              🛣️
            </div>
            <h3 className="text-lg font-semibold mb-2 text-ink">Pick a Route</h3>
            <p className="text-sm text-text-secondary">
              Choose from popular Bengaluru commute corridors with multiple path
              variants.
            </p>
          </div>

          <div className="card text-center">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-factor-rain-dim text-factor-rain text-xl">
              ⏱️
            </div>
            <h3 className="text-lg font-semibold mb-2 text-ink">Get a Prediction</h3>
            <p className="text-sm text-text-secondary">
              Our XGBoost model predicts your expected delay using live traffic
              and weather signals.
            </p>
          </div>

          <div className="card text-center">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-factor-event-dim text-factor-event text-xl">
              📊
            </div>
            <h3 className="text-lg font-semibold mb-2 text-ink">Understand Why</h3>
            <p className="text-sm text-text-secondary">
              SHAP explanations break down every prediction so you know exactly
              what&apos;s driving the delay.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
