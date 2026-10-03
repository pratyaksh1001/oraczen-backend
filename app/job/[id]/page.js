"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api from "@/api";

const POLL_MS = 1000;

const tab =
  "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium text-[#6b6a64] transition-colors hover:bg-[#ebe9df] hover:text-[#1f1e1d]";
const card = "rounded-2xl border border-[#e3e0d5] bg-[#faf9f5]";

const pretty = (s) => (s ?? "").replace(/_/g, " ");

const badgeStyles = {
  done: "bg-[#e1ead8] text-[#3f6b2a]",
  needs_review: "bg-[#f3ebcf] text-[#7a6418]",
  failed: "bg-[#f3d9d2] text-[#9a3a22]",
};

function Badge({ value }) {
  return (
    <span
      className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${
        badgeStyles[value] ?? "bg-[#ebe9df] text-[#6b6a64]"
      }`}
    >
      {pretty(value) || "—"}
    </span>
  );
}

// finished tickets can be opened; others are plain rows
const linkFor = (id, status) => {
  if (status === "done") return `/record/${id}`;
  if (status === "needs_review" || status === "failed") return `/review/${id}`;
  return null;
};

export default function JobPage() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer;

    const poll = async () => {
      try {
        const res = await api.get(`/api/jobs/${id}/`);
        if (stopped) return;
        setJob(res.data);
        setError(false);
        if (res.data.state === "done") return; // finished, stop polling
      } catch {
        if (stopped) return;
        setError(true); // keep trying
      }
      timer = setTimeout(poll, POLL_MS);
    };

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id]);

  const items = Object.entries(job?.items ?? {});
  const percent = job?.total ? Math.round((job.completed / job.total) * 100) : 0;
  const finished = job?.state === "done";

  return (
    <div className="min-h-screen bg-[#f5f4ee] font-sans text-[#1f1e1d] antialiased">
      <header className="sticky top-0 border-b border-[#e3e0d5] bg-[#f5f4ee]">
        <nav className="flex items-center gap-2 overflow-x-auto p-2.5">
          <Link
            href="/"
            className="mr-2 shrink-0 rounded-lg bg-[#c96442] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b5573a]"
          >
            Create job
          </Link>
          <Link href="/" className={tab}>
            All tickets
          </Link>
          <Link href="/records" className={tab}>
            All processed records
          </Link>
          <span className="ml-auto shrink-0 rounded-lg bg-[#ebe9df] px-3 py-1.5 text-xs font-medium text-[#6b6a64]">
            Job <span className="text-[#1f1e1d]">{id}</span>
          </span>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-4 px-2.5 py-10">
        {error && !job && (
          <p className="text-center text-[#6b6a64]">
            Couldn&apos;t load this job. Retrying every 3 seconds…
          </p>
        )}
        {!error && !job && <p className="text-center text-[#6b6a64]">Loading job…</p>}

        {job && (
          <>
            <section className={`${card} p-6`}>
              <div className="flex items-center justify-between gap-3">
                <h1 className="font-serif text-2xl font-medium tracking-tight">Job progress</h1>
                <Badge value={job.state} />
              </div>

              <p className="mt-3 text-sm text-[#6b6a64]">
                {job.completed} of {job.total} tickets completed
              </p>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ebe9df]">
                <div
                  className="h-full rounded-full bg-[#c96442] transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <p className="mt-3 text-xs text-[#6b6a64]">
                {error
                  ? "Connection lost. Retrying every 3 seconds…"
                  : finished
                    ? "Finished."
                    : "Updating every 3 seconds…"}
              </p>

              {finished && (
                <Link
                  href="/records"
                  className="mt-4 inline-block text-sm font-medium text-[#c96442] hover:text-[#b5573a]"
                >
                  View processed records →
                </Link>
              )}
            </section>

            <section className={`${card} divide-y divide-[#e3e0d5] overflow-hidden`}>
              {items.map(([ticketId, item]) => {
                const href = linkFor(ticketId, item.status);
                const row = "flex items-center justify-between gap-3 px-4 py-3 text-sm";
                const content = (
                  <>
                    <span className="text-[#6b6a64]">{ticketId}</span>
                    <Badge value={item.status} />
                  </>
                );

                return href ? (
                  <Link
                    key={ticketId}
                    href={href}
                    className={`${row} transition-colors hover:bg-[#f5f4ee]`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={ticketId} className={row}>
                    {content}
                  </div>
                );
              })}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
