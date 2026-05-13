import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, QrCode, FileDown, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { QRCodeSVG } from "qrcode.react";
import * as XLSX from "xlsx";
import { format, differenceInDays } from "date-fns";

export const Route = createFileRoute("/_app/assets")({ component: AssetsPage });

type Asset = {
  id: string; asset_code: string; name: string; brand: string | null; model: string | null;
  serial_number: string | null; category_id: string | null; location_id: string | null; status_id: string | null;
  purchase_date: string | null; warranty_expiry_date: string | null; image_url: string | null; notes: string | null;
};

function AssetsPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const isAdmin = role === "admin";

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [editing, setEditing] = useState<Asset | null>(null);
  const [open, setOpen] = useState(false);
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Asset[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => (await supabase.from("locations").select("*").order("name")).data ?? [],
  });
  const { data: statuses = [] } = useQuery({
    queryKey: ["asset_statuses"],
    queryFn: async () => (await supabase.from("asset_statuses").select("*").order("name")).data ?? [],
  });

  const catMap = useMemo(() => new Map(categories.map((c: any) => [c.id, c.name])), [categories]);
  const locMap = useMemo(() => new Map(locations.map((l: any) => [l.id, l.name])), [locations]);
  const statusMap = useMemo(() => new Map(statuses.map((s: any) => [s.id, s])), [statuses]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return assets.filter(a => {
      if (filterStatus !== "all" && a.status_id !== filterStatus) return false;
      if (filterCategory !== "all" && a.category_id !== filterCategory) return false;
      if (!s) return true;
      return [a.asset_code, a.name, a.brand, a.model, a.serial_number].some(v => v?.toLowerCase().includes(s));
    });
  }, [assets, search, filterStatus, filterCategory]);

  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const exportExcel = () => {
    const rows = filtered.map(a => ({
      "รหัสทรัพย์สิน": a.asset_code,
      "ชื่อ": a.name,
      "Brand": a.brand,
      "Model": a.model,
      "Serial": a.serial_number,
      "หมวดหมู่": catMap.get(a.category_id ?? "") ?? "",
      "สถานที่": locMap.get(a.location_id ?? "") ?? "",
      "สถานะ": (statusMap.get(a.status_id ?? "") as any)?.name ?? "",
      "วันที่ซื้อ": a.purchase_date,
      "วันหมดประกัน": a.warranty_expiry_date,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Assets");
    XLSX.writeFile(wb, `assets_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
    toast.success("Export สำเร็จ");
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const target = assets.find(a => a.id === deleteId);
    const { error } = await supabase.from("assets").delete().eq("id", deleteId);
    if (error) return toast.error(error.message);
    await logAudit({ action: "delete", entityType: "asset", entityId: deleteId, details: { code: target?.asset_code } });
    toast.success("ลบสำเร็จ");
    setDeleteId(null);
    qc.invalidateQueries({ queryKey: ["assets"] });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">อุปกรณ์ IT</h1>
          <p className="text-sm text-muted-foreground mt-1">จัดการทรัพย์สิน IT ทั้งหมด ({filtered.length} รายการ)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportExcel}><FileDown className="h-4 w-4 mr-2" />Export Excel</Button>
          {isAdmin && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />เพิ่มอุปกรณ์</Button>
              </DialogTrigger>
              <AssetForm
                editing={editing}
                categories={categories} locations={locations} statuses={statuses}
                onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["assets"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); }}
              />
            </Dialog>
          )}
        </div>
      </div>

      <Card className="p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="ค้นหา รหัส / ชื่อ / Brand / Serial..." className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="หมวดหมู่" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
            {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="สถานะ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            {statuses.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">รหัส</th>
                <th className="text-left px-4 py-3 font-medium">ชื่ออุปกรณ์</th>
                <th className="text-left px-4 py-3 font-medium">หมวดหมู่</th>
                <th className="text-left px-4 py-3 font-medium">สถานที่</th>
                <th className="text-left px-4 py-3 font-medium">สถานะ</th>
                <th className="text-left px-4 py-3 font-medium">ประกันคงเหลือ</th>
                <th className="text-right px-4 py-3 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">ไม่พบข้อมูล</td></tr>
              ) : paged.map(a => {
                const status = statusMap.get(a.status_id ?? "") as any;
                const warrantyLeft = a.warranty_expiry_date ? differenceInDays(new Date(a.warranty_expiry_date), new Date()) : null;
                return (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{a.asset_code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{[a.brand, a.model].filter(Boolean).join(" ")}</div>
                    </td>
                    <td className="px-4 py-3">{catMap.get(a.category_id ?? "") ?? "-"}</td>
                    <td className="px-4 py-3">{locMap.get(a.location_id ?? "") ?? "-"}</td>
                    <td className="px-4 py-3">
                      {status ? <Badge style={{ backgroundColor: status.color + "20", color: status.color, borderColor: status.color + "40" }} variant="outline">{status.name}</Badge> : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {warrantyLeft === null ? <span className="text-muted-foreground">-</span> :
                        warrantyLeft < 0 ? <span className="text-destructive">หมดแล้ว</span> :
                        warrantyLeft < 60 ? <span className="text-warning">{warrantyLeft} วัน</span> :
                        <span>{warrantyLeft} วัน</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setQrAsset(a)}><QrCode className="h-4 w-4" /></Button>
                        {isAdmin && <>
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-3 border-t border-border text-sm">
          <span className="text-muted-foreground">หน้า {page} / {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>ก่อนหน้า</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>ถัดไป</Button>
          </div>
        </div>
      </Card>

      <Dialog open={!!qrAsset} onOpenChange={() => setQrAsset(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>QR Code ทรัพย์สิน</DialogTitle></DialogHeader>
          {qrAsset && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG value={JSON.stringify({ code: qrAsset.asset_code, name: qrAsset.name })} size={200} />
              </div>
              <div className="text-center">
                <div className="font-mono text-sm">{qrAsset.asset_code}</div>
                <div className="font-medium">{qrAsset.name}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>การลบอุปกรณ์จะไม่สามารถย้อนกลับได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AssetForm({ editing, categories, locations, statuses, onClose }: any) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    asset_code: editing?.asset_code ?? "",
    name: editing?.name ?? "",
    brand: editing?.brand ?? "",
    model: editing?.model ?? "",
    serial_number: editing?.serial_number ?? "",
    category_id: editing?.category_id ?? "",
    location_id: editing?.location_id ?? "",
    status_id: editing?.status_id ?? "",
    purchase_date: editing?.purchase_date ?? "",
    warranty_expiry_date: editing?.warranty_expiry_date ?? "",
    notes: editing?.notes ?? "",
  });

  const update = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.asset_code || !form.name) return toast.error("กรอกรหัสและชื่อ");
    setBusy(true);
    const payload: any = { ...form };
    Object.keys(payload).forEach(k => { if (payload[k] === "") payload[k] = null; });

    if (editing) {
      const { error } = await supabase.from("assets").update(payload).eq("id", editing.id);
      if (error) { setBusy(false); return toast.error(error.message); }
      await logAudit({ action: "update", entityType: "asset", entityId: editing.id, details: { code: payload.asset_code } });
      toast.success("บันทึกสำเร็จ");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.created_by = user?.id;
      const { data, error } = await supabase.from("assets").insert(payload).select().single();
      if (error) { setBusy(false); return toast.error(error.message); }
      await logAudit({ action: "create", entityType: "asset", entityId: data.id, details: { code: payload.asset_code } });
      toast.success("เพิ่มสำเร็จ");
    }
    setBusy(false);
    onClose();
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{editing ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์ใหม่"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="รหัสทรัพย์สิน *"><Input value={form.asset_code} onChange={e => update("asset_code", e.target.value)} required /></Field>
          <Field label="ชื่ออุปกรณ์ *"><Input value={form.name} onChange={e => update("name", e.target.value)} required /></Field>
          <Field label="Brand"><Input value={form.brand} onChange={e => update("brand", e.target.value)} /></Field>
          <Field label="Model"><Input value={form.model} onChange={e => update("model", e.target.value)} /></Field>
          <Field label="Serial Number"><Input value={form.serial_number} onChange={e => update("serial_number", e.target.value)} /></Field>
          <Field label="หมวดหมู่">
            <Select value={form.category_id} onValueChange={v => update("category_id", v)}>
              <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
              <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="สถานที่">
            <Select value={form.location_id} onValueChange={v => update("location_id", v)}>
              <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
              <SelectContent>{locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="สถานะ">
            <Select value={form.status_id} onValueChange={v => update("status_id", v)}>
              <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
              <SelectContent>{statuses.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="วันที่ซื้อ"><Input type="date" value={form.purchase_date} onChange={e => update("purchase_date", e.target.value)} /></Field>
          <Field label="วันหมดประกัน"><Input type="date" value={form.warranty_expiry_date} onChange={e => update("warranty_expiry_date", e.target.value)} /></Field>
        </div>
        <Field label="หมายเหตุ"><Textarea rows={3} value={form.notes} onChange={e => update("notes", e.target.value)} /></Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}บันทึก</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
