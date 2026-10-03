"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/api";

const tab =
  "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium text-[#6b6a64] transition-colors hover:bg-[#ebe9df] hover:text-[#1f1e1d]";
const tabActive = "bg-[#ebe9df] text-[#1f1e1d]";

const pretty = (s) => (s ?? "").replace(/_/g, " ");

const severityStyles = {
  critical: "bg-[#f3d9d2] text-[#9a3a22]",
  high: "bg-[#f6e3d3] text-[#9a5222]",
  medium: "bg-[#f3ebcf] text-[#7a6418]",
  low: "bg-[#ebe9df] text-[#6b6a64]",
};

const successCols =
  "grid grid-cols-[110px_1.2fr_1.2fr_1fr_100px_1fr_80px] items-center gap-3 px-4 py-3 text-sm";
const failedCols = "grid grid-cols-[110px_1fr] items-center gap-3 px-4 py-3 text-sm";
const reviewCols =
  "grid grid-cols-[110px_1.2fr_2fr_130px] items-center gap-3 px-4 py-3 text-sm";
const rowHover = "transition-colors hover:bg-[#f5f4ee]";

function List({ cols, head, children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#e3e0d5] bg-[#faf9f5]">
      <div className="min-w-[800px]">
        <div className={`${cols} border-b border-[#e3e0d5] font-medium text-[#6b6a64]`}>
          {head.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <div className="divide-y divide-[#e3e0d5]">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-serif text-xl font-medium">
        {title} <span className="text-[#6b6a64]">({count})</span>
      </h2>
      {count === 0 ? <p className="text-sm text-[#6b6a64]">None.</p> : children}
    </section>
  );
}

export default function RecordsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get("/api/records")
      .then((res) => setData(res.data))
      .catch(() => setError(true));
  }, []);

  const successful = Object.entries(data?.successful ?? {});
  const failed = Object.entries(data?.failed ?? {});
  const review = Object.entries(data?.human_check ?? {});

  return (
    <div className="min-h-screen bg-[#f5f4ee] font-sans text-[#1f1e1d] antialiased">
      <header className="sticky top-0 border-b border-[#e3e0d5] bg-[#f5f4ee]">
        <nav className="flex items-center gap-2 overflow-x-auto p-2.5">
          <Link
            href="/create"
            className="mr-2 shrink-0 rounded-lg bg-[#c96442] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b5573a]"
          >
            Create job
          </Link>
          <Link href="/" className={tab}>
            All tickets
          </Link>
          <Link href="/records" className={`${tab} ${tabActive}`}>
            All processed records
          </Link>
        </nav>
      </header>

      <main className="p-2.5">
        <h1 className="mb-3 font-serif text-3xl font-medium tracking-tight">
          All processed records
        </h1>

        {error && (
          <p className="text-[#6b6a64]">Couldn&apos;t load records. Check that the backend is running.</p>
        )}
        {!error && !data && <p className="text-[#6b6a64]">Loading records…</p>}

        {data && (
          <>
            <Section title="Successful" count={successful.length}>
              <List
                cols={successCols}
                head={["ID", "Company", "Product", "Category", "Severity", "Action", "Escalated"]}
              >
                {successful.map(([id, r]) => (
                  <Link key={id} href={`/record/${id}`} className={`${successCols} ${rowHover}`}>
                    <span className="text-[#6b6a64]">{id}</span>
                    <span className="font-medium">{r.company}</span>
                    <span>{r.product}</span>
                    <span>{pretty(r.category)}</span>
                    <span
                      className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${
                        severityStyles[r.severity] ?? severityStyles.low
                      }`}
                    >
                      {r.severity}
                    </span>
                    <span>{pretty(r.requested_action)}</span>
                    <span className={r.escalated ? "font-medium text-[#c96442]" : "text-[#6b6a64]"}>
                      {r.escalated ? "Yes" : "—"}
                    </span>
                  </Link>
                ))}
              </List>
            </Section>

            <Section title="Failed" count={failed.length}>
              <List cols={failedCols} head={["ID", "Reason"]}>
                {failed.map(([id, r]) => (
                  <Link key={id} href={`/review/${id}`} className={`${failedCols} ${rowHover}`}>
                    <span className="text-[#6b6a64]">{id}</span>
                    <span>{r?.error ?? r?.reason ?? "—"}</span>
                  </Link>
                ))}
              </List>
            </Section>

            <Section title="Needs human check" count={review.length}>
              <List cols={reviewCols} head={["ID", "From", "Reason", "Status"]}>
                {review.map(([id, r]) => (
                  <Link key={id} href={`/review/${id}`} className={`${reviewCols} ${rowHover}`}>
                    <span className="text-[#6b6a64]">{id}</span>
                    <span>{r.ticket?.from_email}</span>
                    <span>{r.reason}</span>
                    <span className="w-fit rounded-md bg-[#f3ebcf] px-2 py-0.5 text-xs font-medium text-[#7a6418]">
                      {pretty(r.status)}
                    </span>
                  </Link>
                ))}
              </List>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
