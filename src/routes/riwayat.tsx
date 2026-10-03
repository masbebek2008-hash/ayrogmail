import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/riwayat")({
  head: () => ({
    meta: [
      { title: "Riwayat — AyroGmail" },
      { name: "description", content: "Riwayat pengiriman Gmail dan penarikan dana Anda." },
    ],
  }),
  component: RiwayatPage,
});

type Submission = {
  id: string;
  gmail_address: string;
  status: "menunggu" | "disetujui" | "ditolak";
  rate: number;
  created_at: string;
  rejection_reason?: string | null;
  fix_guide?: string | null;
};
type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
};

const statusStyle: Record<string, string> = {
  menunggu: "bg-amber-100 text-amber-700",
  disetujui: "bg-emerald-100 text-emerald-700",
  ditolak: "bg-red-100 text-red-600",
  diproses: "bg-blue-100 text-blue-700",
  selesai: "bg-emerald-100 text-emerald-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RiwayatPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [tab, setTab] = useState<"gmail" | "dana">("gmail");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!session) return;
    const uid = session.user.id;
    supabase
      .from("gmail_submissions")
      .select("id, gmail_address, status, rate, created_at, rejection_reason, fix_guide")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .then(({ data }) => setSubmissions((data as unknown as Submission[]) ?? []));
    supabase
      .from("withdrawals")
      .select("id, amount, method, status, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .then(({ data }) => setWithdrawals((data as Withdrawal[]) ?? []));
  }, [session?.user.id]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)]">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="text-slate-800 antialiased flex justify-center min-h-screen bg-background">
      <div className="w-full max-w-md bg-[var(--app-bg)] min-h-screen shadow-2xl flex flex-col">
        <header className="bg-white flex items-center gap-3 px-5 py-4 sticky top-0 z-20 shadow-sm">
          <Link to="/" className="text-slate-600 hover:text-slate-900 p-1" aria-label="Kembali">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </Link>
          <h1 className="font-bold text-lg text-slate-900 tracking-tight">Riwayat</h1>
        </header>

        <div className="px-4 pt-4">
          <div className="bg-white rounded-full p-1 flex shadow-sm border border-gray-100">
            <button
              onClick={() => setTab("gmail")}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${tab === "gmail" ? "bg-[var(--ink)] text-white" : "text-gray-500"}`}
            >
              Gmail
            </button>
            <button
              onClick={() => setTab("dana")}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${tab === "dana" ? "bg-[var(--ink)] text-white" : "text-gray-500"}`}
            >
              Penarikan
            </button>
          </div>
        </div>

        <main className="flex-1 px-4 py-4 space-y-3 overflow-y-auto scrollbar-thin">
          {tab === "gmail" &&
            (submissions.length === 0 ? (
              <EmptyState text="Belum ada Gmail yang dikirim" />
            ) : (
              submissions.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm text-gray-800 truncate">{s.gmail_address}</p>
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full capitalize ${statusStyle[s.status]}`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Rp {s.rate.toLocaleString("id-ID")}</span>
                    <span>{formatDate(s.created_at)}</span>
                  </div>
                  {s.status === "ditolak" && (s.rejection_reason || s.fix_guide) && (
                    <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-gray-700 space-y-1">
                      {s.rejection_reason && <p className="font-semibold text-red-600">Alasan ditolak: {s.rejection_reason}</p>}
                      {s.fix_guide && <p className="whitespace-pre-line">{s.fix_guide}</p>}
                    </div>
                  )}
                </div>
              ))
            ))}

          {tab === "dana" &&
            (withdrawals.length === 0 ? (
              <EmptyState text="Belum ada penarikan dana" />
            ) : (
              withdrawals.map((w) => (
                <div key={w.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm text-gray-800">
                      Rp {w.amount.toLocaleString("id-ID")} · {w.method}
                    </p>
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full capitalize ${statusStyle[w.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {w.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 text-right">{formatDate(w.created_at)}</p>
                </div>
              ))
            ))}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center text-sm text-gray-400">
      {text}
    </div>
  );
}
