"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api from "@/api";

const tab =
  "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium text-[#6b6a64] transition-colors hover:bg-[#ebe9df] hover:text-[#1f1e1d]";
const tabActive = "bg-[#ebe9df] text-[#1f1e1d]";
const input =
  "w-full rounded-lg border border-[#e3e0d5] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[#c96442] focus:ring-2 focus:ring-[#c96442]/20";
const card = "rounded-2xl border border-[#e3e0d5] bg-[#faf9f5] p-6";

const kinds = { human_check: "Needs human check", failed: "Failed" };

const products = ["Zen Orchestrator", "Zen Studio", "Zen Connect", "Zen Insights", "Zen Vault"];
const categories = ["outage", "billing", "bug", "feature_request", "how_to", "churn_risk"];
const severities = ["low", "medium", "high", "critical"];
const actions = ["refund", "credit", "fix", "callback", "information", "none"];

const fields = [
  { key: "company", label: "Company", type: "text" },
  { key: "product", label: "Product", type: "select", options: products },
  { key: "category", label: "Category", type: "select", options: categories },
  { key: "severity", label: "Severity", type: "select", options: severities },
  { key: "requested_action", label: "Requested action", type: "select", options: actions },
  { key: "refund_amount", label: "Refund amount", type: "number" },
  { key: "deadline", label: "Deadline", type: "date" },
  { key: "escalated", label: "Escalated", type: "checkbox" },
];

const emptyForm = Object.fromEntries(
  fields.map((f) => [f.key, f.type === "checkbox" ? false : ""])
);

// form value -> value sent to backend (empty becomes null)
const toValue = (f, v) => {
  if (f.type === "checkbox") return v;
  const s = String(v ?? "").trim();
  if (s === "") return null;
  if (f.type === "number") {
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  }
  return s;
};

const pretty = (s) => (s ?? "").replace(/_/g, " ");

export default function ReviewPage() {
  const { id } = useParams();
  const [kind, setKind] = useState(null);
  const [rec, setRec] = useState(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error

  useEffect(() => {
    api
      .get("/api/records")
      .then((res) => {
        const found = Object.keys(kinds).find((name) => res.data[name]?.[id]);
        if (found) {
          setKind(found);
          setRec(res.data[found][id]);
        } else {
          setMissing(true);
        }
      })
      .catch(() => setLoadError(true));
  }, [id]);

  const update = (key, value) => {
    setForm({ ...form, [key]: value });
    if (status !== "saving") setStatus("idle");
  };

  const hasInput = fields.some(
    (f) => toValue(f, form[f.key]) !== (f.type === "checkbox" ? false : null)
  );

  const submit = async (e) => {
    e.preventDefault();
    setStatus("saving");
    try {
      const payload = Object.fromEntries(fields.map((f) => [f.key, toValue(f, form[f.key])]));
      await api.patch(`/api/records/${id}`, { records: payload });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const t = rec?.ticket ?? {};
  const reason = rec?.reason ?? rec?.error;
  const meta = [
    ["From", t.from_email],
    ["Channel", pretty(t.channel)],
    ["Received", t.received_at ? new Date(t.received_at).toLocaleString() : ""],
    ["Attachments", t.attachments],
  ];

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
              record <span className="text-[#1f1e1d]">{id}</span>
            </span>
          </nav>
        </header>

      <main className="mx-auto w-full max-w-2xl px-2.5 py-10">
        <Link href="/records" className="text-sm text-[#6b6a64] transition-colors hover:text-[#1f1e1d]">
          ← All processed records
        </Link>

        <h1 className="mb-2 mt-4 text-center font-serif text-3xl font-medium tracking-tight">{id}</h1>

        {loadError && (
          <p className="text-center text-[#6b6a64]">
            Couldn&apos;t load this record. Check that the backend is running.
          </p>
        )}
        {missing && (
          <p className="text-center text-[#6b6a64]">No failed or human-check record with this ID.</p>
        )}
        {!loadError && !missing && !rec && (
          <p className="text-center text-[#6b6a64]">Loading record…</p>
        )}

        {rec && (
          <div className="space-y-4">
            <p className="text-center text-sm text-[#6b6a64]">{kinds[kind]}</p>

            {reason && (
              <p className="rounded-lg bg-[#f3ebcf] px-3 py-2 text-sm text-[#7a6418]">{reason}</p>
            )}

            <section className={card}>
              <h2 className="font-serif text-xl font-medium">{t.subject || "No subject"}</h2>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm">{t.body || "—"}</p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#e3e0d5] pt-4 text-sm">
                {meta.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[#6b6a64]">{label}</dt>
                    <dd className="break-words">{String(value ?? "") || "—"}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <form onSubmit={submit} className={`${card} space-y-4`}>
              <div>
                <h2 className="font-serif text-xl font-medium">Fill in the details</h2>
                <p className="mt-1 text-sm text-[#6b6a64]">
                  Leave a field empty to store it as null.
                </p>
              </div>

              {fields.map((f) => (
                <div key={f.key}>
                  {f.type === "checkbox" ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-[#c96442]"
                        checked={form[f.key]}
                        onChange={(e) => update(f.key, e.target.checked)}
                      />
                      {f.label}
                    </label>
                  ) : (
                    <>
                      <label htmlFor={f.key} className="mb-1.5 block text-sm text-[#6b6a64]">
                        {f.label}
                      </label>
                      {f.type === "select" ? (
                        <select
                          id={f.key}
                          className={input}
                          value={form[f.key]}
                          onChange={(e) => update(f.key, e.target.value)}
                        >
                          <option value="">—</option>
                          {f.options.map((o) => (
                            <option key={o} value={o}>
                              {o.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={f.key}
                          type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                          step={f.type === "number" ? "any" : undefined}
                          className={input}
                          value={form[f.key]}
                          onChange={(e) => update(f.key, e.target.value)}
                        />
                      )}
                    </>
                  )}
                </div>
              ))}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!hasInput || status === "saving"}
                  className="rounded-lg bg-[#c96442] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b5573a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status === "saving" ? "Saving…" : "Submit"}
                </button>

                {status === "saved" && (
                  <span className="text-sm text-[#6b6a64]">
                    Saved.{" "}
                    <Link href="/records" className="underline hover:text-[#1f1e1d]">
                      Back to records
                    </Link>
                  </span>
                )}
                {status === "error" && (
                  <span className="text-sm text-[#9a3a22]">Couldn&apos;t save. Try again.</span>
                )}
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
