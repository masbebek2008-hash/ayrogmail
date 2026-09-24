import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { addAdminByEmail, listAdmins, removeAdmin } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Check,
  Clipboard,
  Copy,
  Mail,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserCog,
  WalletCards,
  X,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "AyroGmail — Panel Admin" },
      { name: "description", content: "Panel admin AyroGmail: atur tarif per Gmail, saldo minimal penarikan, dan status pengiriman pengguna." },
      { property: "og:title", content: "AyroGmail — Panel Admin" },
      { property: "og:description", content: "Panel admin AyroGmail: atur tarif per Gmail, saldo minimal penarikan, dan status pengiriman pengguna." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Submission = {
  id: string;
  gmail_address: string;
  password: string;
  status: string;
  rate: number;
  created_at: string;
};
type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  account_info: string;
  status: string;
  created_at: string;
};

const STATUSES = ["menunggu", "disetujui", "ditolak"];
const W_STATUSES = ["menunggu", "selesai", "ditolak"];

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function AdminPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rate, setRate] = useState("");
  const [minWithdraw, setMinWithdraw] = useState("");
  const [adminFee, setAdminFee] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [submissionsOpen, setSubmissionsOpen] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [admins, setAdmins] = useState<{ user_id: string; email: string }[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [wds, setWds] = useState<Withdrawal[]>([]);
  const [tab, setTab] = useState<"setoran" | "penarikan">("setoran");
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<"transaksi" | "pengaturan" | "admin">("transaksi");

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const load = useCallback(async () => {
    if (!session) return;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin");
    const admin = !!roles && roles.length > 0;
    setIsAdmin(admin);
    if (!admin) return;
    const [s, w, st] = await Promise.all([
      supabase
        .from("gmail_submissions")
        .select("id, gmail_address, password, status, rate, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("withdrawals")
        .select("id, amount, method, account_info, status, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("app_settings")
        .select("rate, min_withdraw, admin_fee, daily_submission_limit, submissions_open")
        .eq("id", "global")
        .maybeSingle(),
    ]);
    setSubs((s.data as Submission[]) ?? []);
    setWds((w.data as Withdrawal[]) ?? []);
    if (st.data) {
      setRate(String(st.data.rate));
      setMinWithdraw(String(st.data.min_withdraw));
      setAdminFee(String(st.data.admin_fee));
      setDailyLimit(String(st.data.daily_submission_limit));
      setSubmissionsOpen(st.data.submissions_open);
    }
    try {
      setAdmins(await listAdmins());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat daftar admin");
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = parseInt(rate.replace(/\D/g, ""), 10);
    const m = parseInt(minWithdraw.replace(/\D/g, ""), 10);
    if (!r || r <= 0) { toast.error("Tarif harus lebih dari 0"); return; }
    if (Number.isNaN(m) || m < 0) { toast.error("Saldo minimal tidak valid"); return; }
    const fee = parseInt(adminFee.replace(/\D/g, ""), 10);
    const limit = parseInt(dailyLimit.replace(/\D/g, ""), 10);
    if (Number.isNaN(fee) || fee < 0) { toast.error("Biaya admin tidak valid"); return; }
    if (Number.isNaN(limit) || limit < 0) { toast.error("Batas setoran harian tidak valid"); return; }
    setSavingSettings(true);
    const { error } = await supabase
      .from("app_settings")
      .update({
        rate: r,
        min_withdraw: m,
        admin_fee: fee,
        daily_submission_limit: limit,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "global");
    setSavingSettings(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pengaturan disimpan");
  };

  const toggleOpen = async () => {
    const next = !submissionsOpen;
    setSubmissionsOpen(next);
    const { error } = await supabase
      .from("app_settings")
      .update({ submissions_open: next, updated_at: new Date().toISOString() })
      .eq("id", "global");
    if (error) {
      setSubmissionsOpen(!next);
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Setoran dibuka" : "Setoran ditutup");
  };


  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) { toast.error("Masukkan email"); return; }
    setSavingAdmin(true);
    try {
      setAdmins(await addAdminByEmail({ data: { email: newAdminEmail } }));
      setNewAdminEmail("");
      toast.success("Admin ditambahkan");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah admin");
    }
    setSavingAdmin(false);
  };

  const deleteAdmin = async (userId: string) => {
    if (!window.confirm("Cabut akses admin untuk akun ini?")) return;
    try {
      setAdmins(await removeAdmin({ data: { userId } }));
      toast.success("Akses admin dicabut");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mencabut akses admin");
    }
  };

  const setSubStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("gmail_submissions").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    toast.success("Status diperbarui");
  };

  const deleteSub = async (id: string) => {
    if (!window.confirm("Hapus Gmail ini secara permanen?")) return;
    const { error } = await supabase.from("gmail_submissions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSubs((prev) => prev.filter((s) => s.id !== id));
    toast.success("Gmail dihapus");
  };

  const deleteWd = async (id: string) => {
    if (!window.confirm("Hapus riwayat penarikan ini secara permanen?")) return;
    const { error } = await supabase.from("withdrawals").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setWds((prev) => prev.filter((w) => w.id !== id));
    toast.success("Riwayat penarikan dihapus");
  };

  const setWdStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("withdrawals").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setWds((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
    toast.success("Status diperbarui");
  };

  if (loading || !session || isAdmin === null) return <div className="min-h-screen grid place-items-center bg-muted"><div className="size-9 animate-spin rounded-full border-2 border-border border-t-admin-primary" /></div>;

  if (!isAdmin) return (
    <div className="min-h-screen grid place-items-center bg-muted px-6 text-center font-admin-body">
      <div><ShieldCheck className="mx-auto size-10 text-muted-foreground" /><h1 className="mt-4 font-admin-heading text-xl text-foreground">Halaman khusus admin</h1><p className="mt-2 text-sm text-muted-foreground">Akun Anda tidak punya akses ke panel admin.</p><Button asChild className="mt-5 bg-admin-primary text-primary-foreground hover:bg-admin-primary/90"><Link to="/">Kembali ke dashboard</Link></Button></div>
    </div>
  );

  const query = search.trim().toLowerCase();
  const filteredSubs = query ? subs.filter((s) => s.gmail_address.toLowerCase().includes(query)) : subs;
  const filteredWds = query ? wds.filter((w) => w.account_info.toLowerCase().includes(query) || w.method.toLowerCase().includes(query)) : wds;
  const pendingSubs = subs.filter((item) => item.status === "menunggu").length;
  const pendingWds = wds.filter((item) => item.status === "menunggu" || item.status === "diproses").length;
  const navItems = [
    { id: "transaksi" as const, label: "Transaksi", icon: WalletCards },
    { id: "pengaturan" as const, label: "Pengaturan", icon: Settings },
    { id: "admin" as const, label: "Admin", icon: UserCog },
  ];
  const inputClass = "mt-2 h-12 w-full rounded-2xl border border-border bg-muted px-4 text-sm text-foreground outline-none transition focus:border-admin-primary focus:ring-2 focus:ring-admin-primary-soft";

  return (
    <div className="min-h-screen bg-muted px-0 py-0 text-foreground antialiased sm:px-4 sm:py-8 font-admin-body">
      <div className="mx-auto min-h-screen w-full max-w-md overflow-hidden bg-background shadow-xl sm:min-h-0 sm:rounded-[2rem] sm:border sm:border-border">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-5 py-5 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-admin-primary text-primary-foreground shadow-sm"><Mail className="size-5" /></div><div><p className="font-admin-heading text-lg">AyroGmail</p><p className="text-xs text-muted-foreground">Panel Admin</p></div></div>
          <Button asChild variant="ghost" size="icon" className="rounded-full" title="Kembali ke dashboard"><Link to="/"><ArrowLeft /></Link></Button>
        </header>

        <main className="space-y-6 px-5 py-6 sm:px-6">
          <section className="grid grid-cols-2 gap-3" aria-label="Ringkasan">
            <button type="button" onClick={() => { setSection("transaksi"); setTab("setoran"); }} className="rounded-3xl border border-border bg-card p-5 text-left shadow-sm transition active:scale-[.98]"><p className="font-admin-heading text-3xl">{pendingSubs}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">Setoran menunggu</p></button>
            <button type="button" onClick={() => { setSection("transaksi"); setTab("penarikan"); }} className="rounded-3xl border border-border bg-card p-5 text-left shadow-sm transition active:scale-[.98]"><p className="font-admin-heading text-3xl">{pendingWds}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">Penarikan aktif</p></button>
          </section>

          <nav className="grid grid-cols-3 gap-2" aria-label="Menu admin">
            {navItems.map(({ id, label, icon: Icon }) => <Button key={id} type="button" variant="ghost" onClick={() => setSection(id)} className={`h-auto min-w-0 flex-col gap-2 rounded-2xl px-2 py-3 ${section === id ? "bg-admin-primary-soft text-admin-primary" : "text-muted-foreground hover:bg-muted"}`}><Icon className="size-5" /><span className="text-[11px] font-bold">{label}</span></Button>)}
          </nav>

          {section === "transaksi" && <section className="space-y-4">
            <div className="grid grid-cols-2 rounded-2xl bg-muted p-1"><Button type="button" variant="ghost" onClick={() => setTab("setoran")} className={`rounded-xl ${tab === "setoran" ? "bg-background text-admin-primary shadow-sm" : "text-muted-foreground"}`}><Clipboard />Setoran</Button><Button type="button" variant="ghost" onClick={() => setTab("penarikan")} className={`rounded-xl ${tab === "penarikan" ? "bg-background text-admin-primary shadow-sm" : "text-muted-foreground"}`}><WalletCards />Penarikan</Button></div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari Gmail / nomor tujuan..."
                className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-11 text-sm text-foreground outline-none transition focus:border-admin-primary focus:ring-2 focus:ring-admin-primary-soft"
              />
              {search && <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground" aria-label="Bersihkan pencarian"><X className="size-4" /></button>}
            </div>
            {tab === "setoran" && (filteredSubs.length === 0 ? <EmptyState text={search ? "Tidak ada Gmail yang cocok dengan pencarian." : "Belum ada setoran."} /> : filteredSubs.map((s) => <article key={s.id} className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-admin-heading text-base">{s.gmail_address}</h2><p className="mt-1 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("id-ID")} · {formatRupiah(s.rate)}</p></div><StatusBadge status={s.status} /></div><div className="flex items-center justify-between gap-3 rounded-2xl bg-muted p-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase text-muted-foreground">Password</p><p className="break-all font-mono text-sm">{s.password}</p></div><Button type="button" size="icon" variant="outline" className="shrink-0 rounded-xl" title="Salin password" onClick={() => { navigator.clipboard.writeText(s.password); toast.success("Password disalin"); }}><Copy /></Button></div><div className="grid grid-cols-3 gap-2">{STATUSES.map((st) => <StatusButton key={st} status={st} current={s.status} onClick={() => setSubStatus(s.id, st)} />)}</div><Button type="button" variant="ghost" onClick={() => deleteSub(s.id)} className="w-full rounded-xl text-admin-danger hover:bg-admin-danger-soft hover:text-admin-danger"><Trash2 />Hapus Gmail</Button></article>))}
            {tab === "penarikan" && (filteredWds.length === 0 ? <EmptyState text={search ? "Tidak ada penarikan yang cocok dengan pencarian." : "Belum ada penarikan."} /> : filteredWds.map((w) => <article key={w.id} className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-admin-heading text-xl">{formatRupiah(w.amount)}</h2><p className="mt-1 truncate text-sm font-medium text-muted-foreground">{w.method} · {w.account_info}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString("id-ID")}</p></div><StatusBadge status={w.status} /></div><div className="grid grid-cols-3 gap-2">{W_STATUSES.map((st) => <StatusButton key={st} status={st} current={w.status} onClick={() => setWdStatus(w.id, st)} />)}</div><Button type="button" variant="ghost" onClick={() => deleteWd(w.id)} className="w-full rounded-xl text-admin-danger hover:bg-admin-danger-soft hover:text-admin-danger"><Trash2 />Hapus riwayat</Button></article>))}
          </section>}

          {section === "pengaturan" && <section className="space-y-4"><div className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm"><div><h2 className="font-admin-heading text-base">Status setoran</h2><p className="mt-1 text-xs text-muted-foreground">{submissionsOpen ? "Member bisa mengirim Gmail." : "Pengiriman Gmail sedang ditutup."}</p></div><Button type="button" onClick={toggleOpen} className={`shrink-0 rounded-xl ${submissionsOpen ? "bg-admin-danger text-primary-foreground hover:bg-admin-danger/90" : "bg-admin-success text-primary-foreground hover:bg-admin-success/90"}`}>{submissionsOpen ? "Tutup" : "Buka"}</Button></div><form onSubmit={saveSettings} className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm"><div><h2 className="font-admin-heading text-base">Pengaturan transaksi</h2><p className="mt-1 text-xs text-muted-foreground">Atur tarif dan batas transaksi member.</p></div>{[["Tarif per Gmail (Rp)",rate,setRate],["Saldo minimal penarikan (Rp)",minWithdraw,setMinWithdraw],["Biaya admin per penarikan (Rp)",adminFee,setAdminFee],["Batas setoran Gmail per hari (0 = tanpa batas)",dailyLimit,setDailyLimit]] .map(([label,value,setter]) => <label key={label as string} className="block text-xs font-semibold text-muted-foreground">{label as string}<input type="text" inputMode="numeric" value={value as string} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} className={inputClass} /></label>)}<Button type="submit" disabled={savingSettings} className="h-12 w-full rounded-2xl bg-admin-primary text-primary-foreground hover:bg-admin-primary/90">{savingSettings ? "Menyimpan..." : "Simpan pengaturan"}</Button></form></section>}

          {section === "admin" && <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm"><div><h2 className="font-admin-heading text-base">Daftar admin</h2><p className="mt-1 text-xs text-muted-foreground">Kelola siapa yang dapat membuka panel ini.</p></div><form onSubmit={addAdmin} className="space-y-3"><input type="email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="email akun terdaftar" className={inputClass} /><Button type="submit" disabled={savingAdmin} className="h-11 w-full rounded-2xl bg-admin-primary text-primary-foreground hover:bg-admin-primary/90">{savingAdmin ? "Menambahkan..." : "Tambah admin"}</Button></form>{admins.length === 0 ? <EmptyState text="Belum ada admin terdaftar." /> : <ul className="space-y-2">{admins.map((a) => <li key={a.user_id} className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{a.email}</p>{a.user_id === session.user.id && <p className="text-xs text-admin-primary">Akun Anda</p>}</div>{a.user_id !== session.user.id && <Button type="button" size="sm" variant="ghost" onClick={() => deleteAdmin(a.user_id)} className="rounded-xl text-admin-danger hover:bg-admin-danger-soft hover:text-admin-danger">Cabut</Button>}</li>)}</ul>}</section>}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) { return <div className="rounded-3xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">{text}</div>; }

function StatusButton({ status, current, onClick }: { status: string; current: string; onClick: () => void }) {
  const icon = status === "ditolak" ? <X /> : status === "menunggu" ? <Clipboard /> : <Check />;
  const tone = status === "ditolak" ? "text-admin-danger hover:bg-admin-danger-soft" : status === "menunggu" ? "text-admin-warning hover:bg-admin-warning-soft" : "text-admin-success hover:bg-admin-success-soft";
  return <Button type="button" variant="outline" onClick={onClick} disabled={current === status} className={`h-auto min-w-0 flex-col gap-1 rounded-2xl px-1 py-3 text-[11px] capitalize ${tone}`}>{icon}{status}</Button>;
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "disetujui" || status === "selesai" ? "bg-admin-success-soft text-admin-success" : status === "ditolak" ? "bg-admin-danger-soft text-admin-danger" : "bg-admin-warning-soft text-admin-warning";
  return <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold capitalize ${tone}`}>{status}</span>;
}
