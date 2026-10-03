"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/api";

const PAGE_SIZE = 4;

const tab =
  "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium text-[#6b6a64] transition-colors hover:bg-[#ebe9df] hover:text-[#1f1e1d]";
const tabActive = "bg-[#ebe9df] text-[#1f1e1d]";
const pill =
  "rounded-lg bg-[#ebe9df] px-3 py-1.5 text-sm font-medium text-[#1f1e1d] transition-colors hover:bg-[#e3e0d5] disabled:cursor-not-allowed disabled:opacity-50";

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

function JobCard({ id, job }) {
  const items = Object.entries(job.items ?? {});
  const records = job.records ?? [];
  const percent = job.total ? Math.round((job.completed / job.total) * 100) : 0;

  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-[#e3e0d5] bg-[#faf9f5] p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-medium tracking-tight">Job {id}</h2>
        <Badge value={job.state} />
      </div>

      <div>
        <div className="flex items-baseline justify-between text-sm text-[#6b6a64]">
          <span>
            {job.completed} of {job.total} completed
          </span>
          <span>{percent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ebe9df]">
          <div className="h-full rounded-full bg-[#c96442]" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-[#6b6a64]">Tickets ({items.length})</h3>
        <div className="max-h-56 divide-y divide-[#e3e0d5] overflow-y-auto rounded-xl border border-[#e3e0d5]">
          {items.map(([ticketId, item]) => {
            const href = linkFor(ticketId, item.status);
            const row = "flex items-center justify-between gap-3 px-4 py-2.5 text-sm";
            const content = (
              <>
                <span className="text-[#6b6a64]">{ticketId}</span>
                <Badge value={item.status} />
              </>
            );

            return href ? (
              <Link key={ticketId} href={href} className={`${row} transition-colors hover:bg-[#f5f4ee]`}>
                {content}
              </Link>
            ) : (
              <div key={ticketId} className={row}>
                {content}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-[#6b6a64]">Processed records ({records.length})</h3>
        {records.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {records.map((rid) => (
              <Link
                key={rid}
                href={`/record/${rid}`}
                className="rounded-md bg-[#ebe9df] px-2 py-0.5 text-xs font-medium text-[#6b6a64] transition-colors hover:bg-[#e3e0d5] hover:text-[#1f1e1d]"
              >
                {rid}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#6b6a64]">None.</p>
        )}
      </div>

      <Link
        href={`/jobs/${id}`}
        className="mt-auto text-sm font-medium text-[#c96442] transition-colors hover:text-[#b5573a]"
      >
        Open job →
      </Link>
    </article>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await api.get("/api/jobs");
      // newest (highest id) first
      const list = Object.entries(res.data.jobs ?? {}).sort(([a], [b]) =>
        b.localeCompare(a, undefined, { numeric: true })
      );
      setJobs(list);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil((jobs?.length ?? 0) / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = (jobs ?? []).slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#f5f4ee] font-sans text-[#1f1e1d] antialiased">
      <header className="sticky top-0 z-10 border-b border-[#e3e0d5] bg-[#f5f4ee]">
        <nav className="flex items-center gap-2 overflow-x-auto p-2.5">

          <Link href="/" className={tab}>
            All tickets
          </Link>
          <Link href="/records" className={tab}>
            All processed records
          </Link>
          <Link href="/jobs" className={`${tab} ${tabActive}`}>
            All jobs
          </Link>
        </nav>
      </header>

      <main className="p-2.5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="font-serif text-3xl font-medium tracking-tight">All jobs</h1>
          <div className="flex items-center gap-3">
            {jobs && <p className="text-sm text-[#6b6a64]">{jobs.length} total</p>}
            <button type="button" onClick={load} className={pill}>
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <p className="text-[#6b6a64]">Couldn&apos;t load jobs. Check that the backend is running.</p>
        )}
        {!error && !jobs && <p className="text-[#6b6a64]">Loading jobs…</p>}
        {jobs?.length === 0 && <p className="text-[#6b6a64]">No jobs yet.</p>}

        {visible.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {visible.map(([id, job]) => (
                <JobCard key={id} id={id} job={job} />
              ))}
            </div>

            {pages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage(current - 1)}
                  disabled={current === 0}
                  className={pill}
                >
                  Previous
                </button>
                <span className="text-sm text-[#6b6a64]">
                  Page {current + 1} of {pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(current + 1)}
                  disabled={current >= pages - 1}
                  className={pill}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
