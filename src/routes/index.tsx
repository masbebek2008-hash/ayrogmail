import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AyroGmail — Dashboard" },
      { name: "description", content: "Dashboard AyroGmail: jual password Gmail, pantau status, dan tarik dana." },
      { property: "og:title", content: "AyroGmail — Dashboard" },
      { property: "og:description", content: "Dashboard AyroGmail: jual password Gmail, pantau status, dan tarik dana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type Submission = { id: string; status: "menunggu" | "disetujui" | "ditolak"; rate: number; created_at: string };
type Withdrawal = { id: string; amount: number; status: string };

type Settings = { rate: number; min_withdraw: number; admin_fee: number; daily_submission_limit: number; submissions_open: boolean };

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function Dashboard() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    rate: 4000,
    min_withdraw: 10000,
    admin_fee: 0,
    daily_submission_limit: 0,
    submissions_open: true,
  });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const load = async () => {
    if (!session) return;
    const uid = session.user.id;
    const [p, s, w, st] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle(),
      supabase.from("gmail_submissions").select("id, status, rate, created_at").eq("user_id", uid),
      supabase.from("withdrawals").select("id, amount, status").eq("user_id", uid),
      supabase
        .from("app_settings")
        .select("rate, min_withdraw, admin_fee, daily_submission_limit, submissions_open")
        .eq("id", "global")
        .maybeSingle(),
    ]);
    if (st.data) setSettings(st.data as Settings);
    setDisplayName(p.data?.display_name ?? session.user.email?.split("@")[0] ?? "");
    setSubmissions((s.data as Submission[]) ?? []);
    setWithdrawals((w.data as Withdrawal[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const stats = useMemo(() => {
    const menunggu = submissions.filter((s) => s.status === "menunggu").length;
    const disetujui = submissions.filter((s) => s.status === "disetujui").length;
    const ditolak = submissions.filter((s) => s.status === "ditolak").length;
    const earned = submissions
      .filter((s) => s.status === "disetujui")
      .reduce((sum, s) => sum + s.rate, 0);
    const withdrawn = withdrawals
      .filter((w) => w.status !== "ditolak")
      .reduce((sum, w) => sum + w.amount, 0);
    const today = new Date().toDateString();
    const hariIni = submissions.filter((s) => new Date(s.created_at).toDateString() === today).length;
    return { menunggu, disetujui, ditolak, hariIni, saldo: Math.max(0, earned - withdrawn) };
  }, [submissions, withdrawals]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)]">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="text-slate-800 antialiased flex justify-center min-h-screen bg-background">
      <div className="w-full max-w-md bg-[var(--app-bg)] min-h-screen shadow-2xl relative flex flex-col">
        {/* Header */}
        <header className="bg-white flex items-center justify-between px-5 py-4 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-[var(--ink)] text-white p-2 rounded-xl flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
              </svg>
            </div>
            <h1 className="font-bold text-lg text-slate-900 tracking-tight">AyroGmail</h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className={settings.submissions_open ? "text-blue-600" : "text-red-500"}>
              {settings.submissions_open ? "Setoran dibuka" : "Setoran ditutup"}
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Keluar
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 px-4 py-6 space-y-4 overflow-y-auto pb-24 scrollbar-thin">
          {/* Balance card */}
          <div className="bg-[var(--ink)] text-white rounded-[1.5rem] p-6 shadow-md relative overflow-hidden">
            <p className="text-sm text-gray-300 mb-1 truncate">Halo, {displayName}</p>
            <div className="flex items-center gap-2 mb-2 text-gray-400 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
              </svg>
              Saldo Anda
            </div>
            <h2 className="text-[2.5rem] font-bold leading-none mb-6">{formatRupiah(stats.saldo)}</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowWithdraw(true)}
                className="bg-white text-gray-900 px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 hover:bg-gray-100 transition-colors active:scale-95"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
                Tarik dana
              </button>
              <Link
                to="/riwayat"
                className="bg-transparent border border-gray-500 text-white px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 hover:bg-gray-700 transition-colors active:scale-95"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                  <path d="M12 7v5l4 2"></path>
                </svg>
                Riwayat
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-center">
              <p className="text-xs text-gray-500 mb-1">Menunggu</p>
              <p className="text-xl font-bold text-gray-800">{stats.menunggu}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-center">
              <p className="text-xs text-gray-500 mb-1">Disetujui</p>
              <p className="text-xl font-bold text-gray-800">{stats.disetujui}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-center">
              <p className="text-xs text-gray-500 mb-1">Ditolak</p>
              <p className="text-xl font-bold text-red-500">{stats.ditolak}</p>
            </div>
          </div>

          {/* Pilih password */}
          <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                </svg>
                Pilih password
              </h3>
              <span className="text-xs font-medium text-gray-500">Rate {settings.rate.toLocaleString("id-ID")}/Gmail</span>
            </div>
            <button
              onClick={() => setShowSubmit(true)}
              disabled={!settings.submissions_open}
              className="w-full bg-[#F3F4F6] text-gray-800 font-medium py-3 rounded-xl mb-3 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {settings.submissions_open ? "Pilih password" : "Setoran ditutup"}
            </button>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              {settings.submissions_open
                ? "Password wajib huruf kecil semua. Huruf besar otomatis ditolak."
                : "Setoran sedang ditutup admin. Coba lagi nanti."}
            </p>
          </div>

          {/* WhatsApp */}
          <a
            href="https://whatsapp.com/channel/0029Vb99e0GEquiX1HOVse3o"
            target="_blank"
            rel="noreferrer"
            className="block text-center w-full bg-transparent border border-gray-300 text-gray-700 font-medium py-3 rounded-full hover:bg-gray-100 transition-colors active:scale-[0.98]"
          >
            Saluran WhatsApp
          </a>
        </main>

        {/* Bottom nav */}
        <nav className="bg-[#F8F9FA] border-t border-gray-200 p-4 absolute bottom-0 w-full flex justify-center z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <Link
            to="/menu"
            className="flex items-center gap-2 text-gray-800 font-medium hover:text-gray-600 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="12" x2="20" y2="12"></line>
              <line x1="4" y1="6" x2="20" y2="6"></line>
              <line x1="4" y1="18" x2="20" y2="18"></line>
            </svg>
            Semua menu
          </Link>
        </nav>

        {showWithdraw && (
          <WithdrawModal
            saldo={stats.saldo}
            minWithdraw={settings.min_withdraw}
            adminFee={settings.admin_fee}
            onClose={() => setShowWithdraw(false)}
            onDone={() => {
              setShowWithdraw(false);
              load();
            }}
          />
        )}
        {showSubmit && (
          <SubmitModal
            rate={settings.rate}
            dailyLimit={settings.daily_submission_limit}
            todayCount={stats.hariIni}
            onClose={() => setShowSubmit(false)}
            onDone={() => {
              setShowSubmit(false);
              load();
            }}
          />
        )}
      </div>
    </div>
  );
}

function WithdrawModal({ saldo, minWithdraw, adminFee, onClose, onDone }: { saldo: number; minWithdraw: number; adminFee: number; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("DANA");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseInt(amount.replace(/\D/g, ""), 10);
    if (!value || value <= 0) { toast.error("Masukkan jumlah yang valid"); return; }
    if (value < minWithdraw) { toast.error(`Minimal penarikan ${formatRupiah(minWithdraw)}`); return; }
    if (value > saldo) { toast.error("Jumlah melebihi saldo Anda"); return; }
    if (adminFee > 0 && value <= adminFee) { toast.error(`Jumlah harus lebih besar dari biaya admin ${formatRupiah(adminFee)}`); return; }
    if (!account.trim()) { toast.error("Isi nomor tujuan"); return; }
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("withdrawals").insert({
      user_id: userData.user!.id,
      amount: value,
      method,
      account_info: account.trim(),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Permintaan penarikan dikirim");
    onDone();
  };

  return (
    <ModalShell title="Tarik dana" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-4">
        Saldo tersedia: <span className="font-semibold text-gray-800">{formatRupiah(saldo)}</span> · Minimal penarikan{" "}
        <span className="font-semibold text-gray-800">{formatRupiah(minWithdraw)}</span>
        {adminFee > 0 && (
          <>
            {" "}· Biaya admin <span className="font-semibold text-gray-800">{formatRupiah(adminFee)}</span>
          </>
        )}
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Jumlah (Rp)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-[#F3F4F6] text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-[#F3F4F6] text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option>DANA</option>
          <option>OVO</option>
          <option>GoPay</option>
          <option>ShopeePay</option>
          <option>Transfer Bank</option>
        </select>
        <input
          type="text"
          placeholder="Nomor / rekening tujuan"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-[#F3F4F6] text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-[var(--ink)] text-white font-medium py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {busy ? "Memproses..." : "Kirim permintaan"}
        </button>
      </form>
    </ModalShell>
  );
}

type Row = { gmail: string; password: string };

function parseGmailList(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

function SubmitModal({ rate, dailyLimit, todayCount, onClose, onDone }: { rate: number; dailyLimit: number; todayCount: number; onClose: () => void; onDone: () => void }) {
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const remaining = dailyLimit > 0 ? Math.max(0, dailyLimit - todayCount) : Infinity;

  const applyPaste = () => {
    const list = parseGmailList(pasteText);
    if (list.length === 0) {
      toast.error("Tidak ada alamat Gmail terdeteksi");
      return;
    }
    if (dailyLimit > 0 && list.length > remaining) {
      toast.error(`Melebihi sisa jatah hari ini (${remaining} Gmail)`);
      return;
    }
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const addr of list) {
      if (!seen.has(addr)) {
        seen.add(addr);
        unique.push(addr);
      }
    }
    setRows(unique.map((gmail) => ({ gmail, password: "" })));
    setPasteText("");
    toast.success(`${unique.length} Gmail dimuat, isi password di bawah`);
  };

  const updatePassword = (i: number, password: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, password } : r)));
  };
  const removeRow = (i: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.length === 0) {
      toast.error("Belum ada Gmail. Paste alamat dulu di kotak atas.");
      return;
    }
    if (dailyLimit > 0 && todayCount >= dailyLimit) {
      toast.error(`Batas setoran hari ini tercapai (${dailyLimit} Gmail)`);
      return;
    }
    if (dailyLimit > 0 && rows.length > remaining) {
      toast.error(`Melebihi sisa jatah hari ini (${remaining} Gmail)`);
      return;
    }
    const cleaned: { gmail: string; password: string }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const addr = row.gmail.trim().toLowerCase();
      const pwd = row.password;
      if (!/^[^\s@]+@gmail\.com$/.test(addr)) { toast.error(`Baris ${i + 1}: alamat Gmail tidak valid`); return; }
      if (!pwd) { toast.error(`Baris ${i + 1}: password kosong`); return; }
      if (pwd !== pwd.toLowerCase()) { toast.error(`Baris ${i + 1}: password wajib huruf kecil`); return; }
      if (seen.has(addr)) { toast.error(`Alamat ${addr} terisi lebih dari sekali`); return; }
      seen.add(addr);
      cleaned.push({ gmail: addr, password: pwd });
    }
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user!.id;
    const { error } = await supabase.from("gmail_submissions").insert(
      cleaned.map((c) => ({ user_id: uid, gmail_address: c.gmail, password: c.password, rate })),
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${cleaned.length} Gmail terkirim, menunggu persetujuan`);
    onDone();
  };

  const filledCount = rows.filter((r) => r.password.length > 0).length;

  return (
    <ModalShell title="Pilih password" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-4">
        Kirim akun Gmail Anda. Rate <span className="font-semibold text-gray-800">{formatRupiah(rate)}</span> per Gmail yang disetujui.
        {dailyLimit > 0 && (
          <> · Sisa hari ini <span className="font-semibold text-gray-800">{remaining}</span></>
        )}
      </p>
      <form onSubmit={submit} className="space-y-3">
        {/* Bulk paste area */}
        <div className="rounded-xl border border-gray-200 p-3 space-y-2">
          <label className="text-xs font-medium text-gray-500 block">
            Paste alamat Gmail di sini (boleh banyak baris / dipisah spasi/koma)
          </label>
          <textarea
            placeholder={"alamat1@gmail.com\nalamat2@gmail.com\nalamat3@gmail.com"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg bg-[#F3F4F6] text-sm outline-none focus:ring-2 focus:ring-slate-300 resize-y font-mono"
          />
          <button
            type="button"
            onClick={applyPaste}
            className="w-full bg-[var(--ink)] text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity text-sm"
          >
            Muat Gmail
          </button>
        </div>

        {/* Password rows */}
        {rows.length > 0 && (
          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-gray-500">
                {rows.length} Gmail · {filledCount} password terisi
              </span>
              <button
                type="button"
                onClick={() => setRows([])}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Hapus semua
              </button>
            </div>
            {rows.map((row, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-3 space-y-2 relative">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-500 shrink-0">#{i + 1}</span>
                  <p className="text-sm text-gray-800 font-medium truncate flex-1">{row.gmail}</p>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-xs text-red-500 hover:text-red-700 shrink-0"
                  >
                    Hapus
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="password (huruf kecil semua)"
                  value={row.password}
                  onChange={(e) => updatePassword(i, e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#F3F4F6] text-sm outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-400 leading-relaxed">
          Password wajib huruf kecil semua. Huruf besar otomatis ditolak.
        </p>
        <button
          type="submit"
          disabled={busy || rows.length === 0}
          className="w-full bg-[var(--ink)] text-white font-medium py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {busy ? "Mengirim..." : `Kirim ${rows.length} Gmail`}
        </button>
      </form>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-[1.5rem] p-6 pb-8 animate-in slide-in-from-bottom-8 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Tutup">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
