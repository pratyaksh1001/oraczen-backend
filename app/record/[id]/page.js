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

// record value -> form value
const toForm = (f, v) => {
  if (f.type === "checkbox") return !!v;
  if (f.type === "date") return v ? String(v).slice(0, 10) : ""; // YYYY-MM-DD
  return String(v ?? "");
};
const toFormState = (r) => Object.fromEntries(fields.map((f) => [f.key, toForm(f, r[f.key])]));

// form value -> value sent to backend
const fromForm = (f, v) => {
  if (f.type === "checkbox") return v;
  const s = String(v ?? "").trim();
  if (s === "") return null;
  if (f.type === "number") {
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  }
  return s;
};

export default function RecordPage() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({});
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api
      .get(`/api/records/read/${id}`)
      .then((res) => {
        setRecord(res.data);
        setForm(toFormState(res.data));
      })
      .catch(() => setLoadError(true));
  }, [id]);

  // only the fields that differ from what the backend returned
  const changes = {};
  if (record) {
    for (const f of fields) {
      // compare what the user sees, so untouched fields are never sent
      if (form[f.key] !== toForm(f, record[f.key])) {
        changes[f.key] = fromForm(f, form[f.key]);
      }
    }
  }
  const dirty = Object.keys(changes).length > 0;

  const update = (key, value) => {
    setForm({ ...form, [key]: value });
    if (status !== "saving") setStatus("idle");
  };

  const reset = () => {
    setForm(toFormState(record));
    setStatus("idle");
  };

  const save = async (e) => {
    e.preventDefault();
    setStatus("saving");
    try {
      // columns edited now that aren't already tracked in `modified`
      const existing = record.modified ?? [];
      const added = Object.keys(changes).filter((k) => !existing.includes(k));
      const payload = added.length ? { ...changes, modified: [...existing, ...added] } : changes;

      await api.patch(`/api/records/${id}`, { records: payload });
      setRecord({ ...record, ...payload });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

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
          <Link href="/records" className={`${tab} ${tabActive}`}>
            All processed records
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-xl px-2.5 py-10">
        <Link href="/records" className="text-sm text-[#6b6a64] transition-colors hover:text-[#1f1e1d]">
          ← All processed records
        </Link>

        <h1 className="mb-6 mt-4 text-center font-serif text-3xl font-medium tracking-tight">{id}</h1>

        {loadError && (
          <p className="text-center text-[#6b6a64]">
            Couldn&apos;t load this record. Check that the backend is running and the ID exists.
          </p>
        )}
        {!loadError && !record && <p className="text-center text-[#6b6a64]">Loading record…</p>}

        {record && (
          <form
            onSubmit={save}
            className="space-y-4 rounded-2xl border border-[#e3e0d5] bg-[#faf9f5] p-6"
          >
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

            <div className="border-t border-[#e3e0d5] pt-4">
              <p className="mb-2 text-sm text-[#6b6a64]">Modified fields</p>
              {(record.modified ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {record.modified.map((k) => (
                    <span
                      key={k}
                      className="rounded-md bg-[#ebe9df] px-2 py-0.5 text-xs font-medium text-[#6b6a64]"
                    >
                      {fields.find((f) => f.key === k)?.label ?? k.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#6b6a64]">None</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={!dirty || status === "saving"}
                className="rounded-lg bg-[#c96442] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b5573a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "saving" ? "Saving…" : "Save changes"}
              </button>

              {dirty && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-[#6b6a64] transition-colors hover:bg-[#ebe9df] hover:text-[#1f1e1d]"
                >
                  Reset
                </button>
              )}

              {status === "saved" && <span className="text-sm text-[#6b6a64]">Saved</span>}
              {status === "error" && (
                <span className="text-sm text-[#9a3a22]">Couldn&apos;t save. Try again.</span>
              )}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
