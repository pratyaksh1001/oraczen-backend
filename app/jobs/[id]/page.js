"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api from "@/api";

const POLL_MS = 3000;

const tab =
  "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium text-[#6b6a64] transition-colors hover:bg-[#ebe9df] hover:text-[#1f1e1d]";
const card = "rounded-2xl border border-[#e3e0d5] bg-[#faf9f5]";

const pretty = (s) => (s ?? "").replace(/_/g, " ");
const show = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

const badgeStyles = {
  done: "bg-[#e1ead8] text-[#3f6b2a]",
  needs_review: "bg-[#f3ebcf] text-[#7a6418]",
  failed: "bg-[#f3d9d2] text-[#9a3a22]",
};

const severityStyles = {
  critical: "bg-[#f3d9d2] text-[#9a3a22]",
  high: "bg-[#f6e3d3] text-[#9a5222]",
  medium: "bg-[#f3ebcf] text-[#7a6418]",
  low: "bg-[#ebe9df] text-[#6b6a64]",
};

// ticket status in a job -> group in the /api/records response
const groupOf = { done: "successful", failed: "failed", needs_review: "human_check" };

// find a record in any group, so it shows whichever kind it currently is
const findRecord = (records, id) => {
  for (const kind of ["successful", "failed", "human_check"]) {
    if (records?.[kind]?.[id]) return { kind, rec: records[kind][id] };
  }
  return null;
};

function Badge({ value, styles = badgeStyles }) {
  return (
    <span
      className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${
        styles[value] ?? "bg-[#ebe9df] text-[#6b6a64]"
      }`}
    >
      {pretty(value) || "—"}
    </span>
  );
}

// finished tickets can be opened; others are plain rows
const linkFor = (id, kind, status) => {
  const k = kind ?? groupOf[status];
  if (k === "successful") return `/record/${id}`;
  if (k === "failed" || k === "human_check") return `/review/${id}`;
  return null;
};

// file name from the Content-Disposition header, if the backend exposes it
const fileNameFrom = (header) => /filename="?([^";]+)"?/i.exec(header ?? "")?.[1];

function Field({ label, wide, children }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-xs text-[#6b6a64]">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  );
}

// record data, shaped by which kind of record it is
function Details({ kind, rec }) {
  if (kind === "successful") {
    return (
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        <Field label="Company">{show(rec.company)}</Field>
        <Field label="Product">{show(rec.product)}</Field>
        <Field label="Category">{show(pretty(rec.category))}</Field>
        <Field label="Severity">
          {rec.severity ? <Badge value={rec.severity} styles={severityStyles} /> : "—"}
        </Field>
        <Field label="Requested action">{show(pretty(rec.requested_action))}</Field>
        <Field label="Refund amount">{show(rec.refund_amount)}</Field>
        <Field label="Deadline">{show(rec.deadline)}</Field>
        <Field label="Escalated">{rec.escalated ? "Yes" : "No"}</Field>
      </dl>
    );
  }

  // failed and needs review share nearly the same shape
  const t = rec.ticket ?? {};
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
      <Field label="Reason" wide>
        {show(rec.reason ?? rec.error)}
      </Field>
      <Field label="Subject">{show(t.subject)}</Field>
      <Field label="From">{show(t.from_email)}</Field>
      <Field label="Channel">{show(pretty(t.channel))}</Field>
      <Field label="Received">
        {t.received_at ? new Date(t.received_at).toLocaleString() : "—"}
      </Field>
      <Field label="Status">{show(pretty(rec.status))}</Field>
      <Field label="Attachments">{show(t.attachments)}</Field>
      <Field label="Body" wide>
        <span className="line-clamp-3 whitespace-pre-wrap">{show(t.body)}</span>
      </Field>
    </dl>
  );
}

export default function JobPage() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer;

    const poll = async () => {
      // record data is optional: the job still shows if that call fails
      const [jobRes, recordsRes] = await Promise.allSettled([
        api.get(`/api/jobs/${id}/`),
        api.get("/api/records"),
      ]);
      if (stopped) return;

      if (jobRes.status === "fulfilled") {
        setJob(jobRes.value.data);
        setError(false);
        if (recordsRes.status === "fulfilled") setRecords(recordsRes.value.data);
        if (jobRes.value.data.state === "done") return; // finished, stop polling
      } else {
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

  const exportCsv = async () => {
    setExporting(true);
    setExportError(false);
    try {
      const res = await api.get(`/api/jobs/${id}/export.csv`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameFrom(res.headers["content-disposition"]) ?? `job_${id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    }
    setExporting(false);
  };

  const items = Object.entries(job?.items ?? {});
  const processed = job?.records ?? [];
  const percent = job?.total ? Math.round((job.completed / job.total) * 100) : 0;
  const finished = job?.state === "done";

  return (
    <div className="min-h-screen bg-[#f5f4ee] font-sans text-[#1f1e1d] antialiased">
      <header className="sticky top-0 border-b border-[#e3e0d5] bg-[#f5f4ee]">
        <nav className="flex items-center gap-2 overflow-x-auto p-2.5">
          <Link href="/" className={tab}>
            All tickets
          </Link>
          <Link href="/records" className={tab}>
            All processed records
          </Link>
          <Link href="/jobs" className={tab}>
            All jobs
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

              <button
                type="button"
                onClick={exportCsv}
                disabled={exporting}
                className="mt-5 w-full rounded-xl bg-[#c96442] px-5 py-3.5 text-base font-medium text-white transition-colors hover:bg-[#b5573a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting ? "Exporting…" : "Export as CSV"}
              </button>

              {exportError && (
                <p className="mt-2 text-sm text-[#9a3a22]">Couldn&apos;t export this job. Try again.</p>
              )}

              {finished && (
                <Link
                  href="/records"
                  className="mt-4 inline-block text-sm font-medium text-[#c96442] transition-colors hover:text-[#b5573a]"
                >
                  View processed records →
                </Link>
              )}
            </section>

            <section className="space-y-2.5">
              {items.map(([ticketId, item]) => {
                const found = findRecord(records, ticketId);
                const href = linkFor(ticketId, found?.kind, item.status);
                const header = (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{ticketId}</span>
                    <Badge value={item.status} />
                  </div>
                );

                return (
                  <div key={ticketId} className={`${card} px-4 py-3`}>
                    {href ? (
                      <Link href={href} className="block transition-opacity hover:opacity-70">
                        {header}
                      </Link>
                    ) : (
                      header
                    )}
                    {found ? (
                      <Details kind={found.kind} rec={found.rec} />
                    ) : (
                      records &&
                      groupOf[item.status] && (
                        <p className="mt-2 text-xs text-[#6b6a64]">No record data found.</p>
                      )
                    )}
                  </div>
                );
              })}
            </section>

            <section className={`${card} p-6`}>
              <h2 className="mb-3 text-sm font-medium text-[#6b6a64]">
                Processed records ({processed.length})
              </h2>
              {processed.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {processed.map((rid) => (
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
                <p className="text-sm text-[#6b6a64]">None yet.</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
