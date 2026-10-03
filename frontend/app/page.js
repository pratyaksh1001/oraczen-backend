"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/api";

const tab =
  "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium text-[#6b6a64] transition-colors hover:bg-[#ebe9df] hover:text-[#1f1e1d]";
const tabActive = "bg-[#ebe9df] text-[#1f1e1d]";
const checkbox = "size-4 cursor-pointer accent-[#c96442]";

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);

  useEffect(() => {
    api
      .get("/tickets")
      .then((res) => setTickets(Object.values(res.data.tickets ?? {})))
      .catch(() => setError(true));
  }, []);

  // selected ids in table order
  const selectedIds = tickets ? tickets.filter((t) => selected.has(t.id)).map((t) => t.id) : [];
  const allSelected = !!tickets?.length && selectedIds.length === tickets.length;

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(tickets.map((t) => t.id)));
  };

  const startJob = async () => {
    setStarting(true);
    setStartError(false);
    try {
      const res = await api.post("/api/jobs", { tickets: selectedIds });
      router.push(`/jobs/${res.data.job_id}`);
    } catch {
      setStartError(true);
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f4ee] font-sans text-[#1f1e1d] antialiased">
      <header className="sticky top-0 z-10 border-b border-[#e3e0d5] bg-[#f5f4ee]">
        <nav className="flex items-center gap-2 overflow-x-auto p-2.5">

          <Link href="/" className={`${tab} ${tabActive}`}>
            All tickets
          </Link>
          <Link href="/records" className={tab}>
            All processed records
          </Link>
          <Link href="/jobs" className={tab}>
            All jobs
                  </Link>
                  <button
                    type="button"
                    onClick={startJob}
                    disabled={selectedIds.length === 0 || starting}
                    className="mr-2 shrink-0 rounded-lg bg-[#c96442] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b5573a] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {starting
                      ? "Starting…"
                      : selectedIds.length > 0
                        ? `Create job (${selectedIds.length})`
                        : "Create job"}
                  </button>
        </nav>
      </header>

      <main className="p-2.5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h1 className="font-serif text-3xl font-medium tracking-tight">All tickets</h1>
          {tickets?.length > 0 && (
            <p className="text-sm text-[#6b6a64]">
              {selectedIds.length} of {tickets.length} selected
            </p>
          )}
        </div>

        {startError && (
          <p className="mb-3 rounded-lg bg-[#f3d9d2] px-3 py-2 text-sm text-[#9a3a22]">
            Couldn&apos;t start the job. Try again.
          </p>
        )}
        {error && (
          <p className="text-[#6b6a64]">Couldn&apos;t load tickets. Check that the backend is running.</p>
        )}
        {!error && !tickets && <p className="text-[#6b6a64]">Loading tickets…</p>}
        {tickets?.length === 0 && <p className="text-[#6b6a64]">No tickets yet.</p>}

        {tickets?.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-[#e3e0d5] bg-[#faf9f5]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#e3e0d5] text-[#6b6a64]">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all tickets"
                      className={checkbox}
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">From</th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Received</th>
                  <th className="px-4 py-3 text-right font-medium">Attachments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e0d5]">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => toggle(t.id)}
                    className={`cursor-pointer transition-colors ${
                      selected.has(t.id) ? "bg-[#f6ebe3]" : "hover:bg-[#f5f4ee]"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${t.id}`}
                        className={checkbox}
                        checked={selected.has(t.id)}
                        onChange={() => toggle(t.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#6b6a64]">{t.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.subject}</div>
                      <div className="max-w-md truncate text-[#6b6a64]" title={t.body}>
                        {t.body}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{t.from_email}</td>
                    <td className="whitespace-nowrap px-4 py-3">{(t.channel ?? "").replace(/_/g, " ")}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {new Date(t.received_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">{t.attachments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
