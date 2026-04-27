"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const SLIDES = [
  {
    title: "Project Setup & Scheduling",
    desc: "Plan, assign, and track every project with clarity.",
    points: [
      "Job creation with client, location & contract",
      "Milestones, scheduling & resource planning",
      "Assign team members & reviewers",
    ],
  },
  {
    title: "Estimating & Bid Management",
    desc: "Create accurate estimates and win more bids.",
    points: [
      "Templates with cost codes & materials",
      "Auto calculations: profit, overhead, commission",
      "Export + estimate history tracking",
    ],
  },
  {
    title: "Field Operations & Reports",
    desc: "Stay connected with real-time site updates.",
    points: [
      "Daily logs with weather & site data",
      "Images, comments & activity tracking",
      "Inspection report archive",
    ],
  },
  {
    title: "Job Cost Tracking",
    desc: "Control expenses and maximize profitability.",
    points: [
      "Track labor, materials & equipment",
      "Budget vs actual insights",
      "Expense logs with vendor & invoices",
    ],
  },
  {
    title: "Core System Features",
    desc: "Everything your construction workflow needs.",
    points: [
      "Role-based access control",
      "Scheduling + reporting system",
      "Profitability dashboards",
    ],
  },
];

export default function LandingHero() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const move = (e) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative w-full overflow-hidden text-[color:var(--acm-fg)]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(600px circle at ${pos.x}px ${pos.y}px, rgba(224,33,138,0.12), transparent 42%)`,
        }}
      />

      <div className="relative z-10 w-full px-6 py-20 sm:px-10">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="acm-badge">Construction App System</div>

            <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight">
              Build smarter.
              <br />
              Manage everything in one place.
            </h1>

            <p className="mt-6 max-w-2xl text-[color:var(--acm-muted-fg)]">
              A modern construction management platform combining scheduling,
              field reporting, cost tracking, and team collaboration into one
              powerful system.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/login/owner"
                className="acm-btn acm-btn-primary acm-btn-lift"
              >
                Continue as Owner
              </Link>

              <Link
                href="/login/manager"
                className="acm-btn acm-btn-secondary acm-btn-lift"
              >
                Continue as Manager
              </Link>

              <Link
                href="/login/employee"
                className="acm-btn acm-btn-employee acm-btn-lift"
              >
                Continue as Employee
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="acm-surface-strong p-8 shadow-2xl backdrop-blur-xl">
              <div className="text-sm font-semibold text-[color:var(--acm-accent-strong)]">
                Feature {index + 1}
              </div>

              <h3 className="mt-2 text-2xl font-semibold">
                {SLIDES[index].title}
              </h3>

              <p className="mt-2 text-[color:var(--acm-muted-fg)]">
                {SLIDES[index].desc}
              </p>

              <ul className="mt-6 space-y-3 text-sm text-[color:var(--acm-fg)]/85">
                {SLIDES[index].points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="text-[color:var(--acm-accent)]">+</span>
                    {point}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex gap-2">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === index
                        ? "w-8 bg-[color:var(--acm-accent)]"
                        : "w-3 bg-[color:var(--acm-border)]"
                    }`}
                    aria-label={`Show feature ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            <div
              aria-hidden="true"
              className="absolute -left-8 -top-8 -z-10 h-44 w-44 rounded-full bg-[color:var(--acm-accent-soft)] blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-8 -right-8 -z-10 h-44 w-44 rounded-full bg-[color:var(--acm-accent-soft)] blur-3xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

