import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Search, Trash2, Loader2, Archive, Eye, Printer, Download, FileText, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/disposals")({ component: DisposalsPage });

type Disposal = {
  id: string;
  disposal_no: string;
  employee_code: string;
  employee_name: string;
  department: string;
  transfer_document_no: string;
  disposal_date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

type DisposalItem = {
  id: string;
  disposal_id: string;
  item_type: "asset" | "consumable";
  asset_id: string | null;
  consumable_id: string | null;
  asset_code: string | null;
  asset_name: string | null;
  consumable_name: string | null;
  consumable_type: string | null;
  quantity: number;
};

type AssetRow = {
  id: string;
  asset_code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status_id: string | null;
  asset_statuses?: { id: string; name: string } | null;
};

type ConsumableRow = {
  id: string;
  equipment_type: string;
  equipment_name: string;
  quantity: number;
};

type SelectedAsset = { kind: "asset"; asset: AssetRow };
type SelectedConsumable = { kind: "consumable"; consumable: ConsumableRow; qty: number };
type SelectedItem = SelectedAsset | SelectedConsumable;

function genDisposalNo() {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `DSP-${stamp}`;
}

function DisposalsPage() {
  const { role, user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = role === "admin";

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [openCreate, setOpenCreate] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: disposals = [], isLoading } = useQuery({
    queryKey: ["disposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disposals")
        .select("*")
        .order("disposal_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Disposal[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return disposals;
    return disposals.filter(d =>
      d.disposal_no.toLowerCase().includes(q) ||
      d.employee_name.toLowerCase().includes(q) ||
      d.employee_code.toLowerCase().includes(q) ||
      d.department.toLowerCase().includes(q) ||
      d.transfer_document_no.toLowerCase().includes(q) ||
      d.disposal_date.includes(q)
    );
  }, [disposals, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = async () => {
    if (!deleteId) return;
    // คืนสถานะ asset เป็น "ว่าง" ถ้ามี และคืน stock consumable
    const { data: items } = await supabase.from("disposal_items").select("*").eq("disposal_id", deleteId);
    if (items) {
      const { data: vacant } = await supabase.from("asset_statuses").select("id").eq("name", "ว่าง").maybeSingle();
      for (const it of items as DisposalItem[]) {
        if (it.item_type === "asset" && it.asset_id && vacant?.id) {
          await supabase.from("assets").update({ status_id: vacant.id }).eq("id", it.asset_id);
        }
        if (it.item_type === "consumable" && it.consumable_id) {
          const { data: c } = await supabase.from("consumables").select("quantity").eq("id", it.consumable_id).maybeSingle();
          if (c) await supabase.from("consumables").update({ quantity: c.quantity + it.quantity }).eq("id", it.consumable_id);
        }
      }
    }
    const { error } = await supabase.from("disposals").delete().eq("id", deleteId);
    if (error) return toast.error(error.message);
    await logAudit({ action: "delete", entityType: "disposal", entityId: deleteId });
    toast.success("ยกเลิกการจำหน่ายและคืนสถานะแล้ว");
    setDeleteId(null);
    qc.invalidateQueries({ queryKey: ["disposals"] });
    qc.invalidateQueries({ queryKey: ["assets"] });
    qc.invalidateQueries({ queryKey: ["consumables"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const exportCSV = () => {
    const rows = [
      ["เลขเอกสาร", "วันที่", "รหัสพนักงาน", "ชื่อพนักงาน", "แผนก", "เลขใบโอนย้าย", "หมายเหตุ"],
      ...filtered.map(d => [
        d.disposal_no, d.disposal_date, d.employee_code, d.employee_name,
        d.department, d.transfer_document_no, d.note ?? "",
      ]),
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `disposals_${format(new Date(), "yyyyMMdd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="h-6 w-6" /> จำหน่ายอุปกรณ์
          </h1>
          <p className="text-sm text-muted-foreground mt-1">บันทึกและจัดการการจำหน่าย/โอนย้ายอุปกรณ์ IT และอุปกรณ์สิ้นเปลือง</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          {isAdmin && (
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> บันทึกการจำหน่าย
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหา เลขเอกสาร / พนักงาน / แผนก / วันที่..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="text-left p-3">เลขเอกสาร</th>
                <th className="text-left p-3">วันที่</th>
                <th className="text-left p-3">พนักงาน</th>
                <th className="text-left p-3">แผนก</th>
                <th className="text-left p-3">ใบโอนย้าย</th>
                <th className="text-right p-3">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                  <Archive className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  ยังไม่มีรายการจำหน่าย
                </td></tr>
              ) : paged.map(d => (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="p-3 font-mono font-semibold">{d.disposal_no}</td>
                  <td className="p-3">{d.disposal_date}</td>
                  <td className="p-3">
                    <div className="font-medium">{d.employee_name}</div>
                    <div className="text-xs text-muted-foreground">{d.employee_code}</div>
                  </td>
                  <td className="p-3">{d.department}</td>
                  <td className="p-3">{d.transfer_document_no}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setViewId(d.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(d.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <div className="text-xs text-muted-foreground">
              {filtered.length} รายการ · หน้า {currentPage}/{totalPages}
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(p => p - 1)}>ก่อนหน้า</Button>
              <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(p => p + 1)}>ถัดไป</Button>
            </div>
          </div>
        )}
      </Card>

      {isAdmin && (
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>บันทึกการจำหน่ายอุปกรณ์</DialogTitle>
              <DialogDescription>เลือกอุปกรณ์ที่ต้องการจำหน่ายและกรอกข้อมูลผู้รับผิดชอบ</DialogDescription>
            </DialogHeader>
            <DisposalForm
              userId={user?.id ?? null}
              onClose={() => setOpenCreate(false)}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["disposals"] });
                qc.invalidateQueries({ queryKey: ["assets"] });
                qc.invalidateQueries({ queryKey: ["consumables"] });
                qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!viewId} onOpenChange={() => setViewId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewId && <DisposalDetail disposalId={viewId} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการยกเลิกการจำหน่าย</AlertDialogTitle>
            <AlertDialogDescription>
              ระบบจะลบเอกสารและคืนสถานะอุปกรณ์ IT เป็น "ว่าง" รวมทั้งคืนจำนวนสินสิ้นเปลืองกลับเข้าสต็อก
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- Form ---------- */

function DisposalForm({
  userId, onClose, onSaved,
}: { userId: string | null; onClose: () => void; onSaved: () => void }) {
  const [employeeCode, setEmployeeCode] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");
  const [transferDoc, setTransferDoc] = useState("");
  const [disposalDate, setDisposalDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [consSearch, setConsSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: assets = [] } = useQuery({
    queryKey: ["disposal-available-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id,asset_code,name,brand,model,serial_number,status_id,asset_statuses(id,name)")
        .order("asset_code");
      if (error) throw error;
      // เฉพาะสถานะ "ว่าง" หรือ "สต๊อก" (พร้อมใช้งาน)
      return (data as any[]).filter(a => {
        const s = a.asset_statuses?.name;
        return s === "ว่าง" || s === "สต๊อก";
      }) as AssetRow[];
    },
  });

  const { data: consumables = [] } = useQuery({
    queryKey: ["disposal-available-consumables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consumables")
        .select("id,equipment_type,equipment_name,quantity")
        .gt("quantity", 0)
        .order("equipment_name");
      if (error) throw error;
      return data as ConsumableRow[];
    },
  });

  const selectedAssetIds = new Set(
    selected.filter((s): s is SelectedAsset => s.kind === "asset").map(s => s.asset.id)
  );
  const selectedConsMap = new Map(
    selected.filter((s): s is SelectedConsumable => s.kind === "consumable").map(s => [s.consumable.id, s])
  );

  const filteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(a =>
      a.asset_code.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      (a.serial_number ?? "").toLowerCase().includes(q) ||
      (a.brand ?? "").toLowerCase().includes(q)
    );
  }, [assets, assetSearch]);

  const filteredCons = useMemo(() => {
    const q = consSearch.trim().toLowerCase();
    if (!q) return consumables;
    return consumables.filter(c =>
      c.equipment_name.toLowerCase().includes(q) ||
      c.equipment_type.toLowerCase().includes(q)
    );
  }, [consumables, consSearch]);

  const toggleAsset = (a: AssetRow) => {
    setSelected(prev => selectedAssetIds.has(a.id)
      ? prev.filter(p => !(p.kind === "asset" && p.asset.id === a.id))
      : [...prev, { kind: "asset", asset: a }]
    );
  };

  const toggleCons = (c: ConsumableRow) => {
    setSelected(prev => selectedConsMap.has(c.id)
      ? prev.filter(p => !(p.kind === "consumable" && p.consumable.id === c.id))
      : [...prev, { kind: "consumable", consumable: c, qty: 1 }]
    );
  };

  const updateConsQty = (id: string, qty: number) => {
    setSelected(prev => prev.map(p =>
      p.kind === "consumable" && p.consumable.id === id ? { ...p, qty } : p
    ));
  };

  const removeItem = (idx: number) => setSelected(prev => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!employeeCode.trim()) return toast.error("กรุณากรอกรหัสพนักงาน");
    if (!employeeName.trim()) return toast.error("กรุณากรอกชื่อ");
    if (!department.trim()) return toast.error("กรุณากรอกแผนก");
    if (!transferDoc.trim()) return toast.error("กรุณากรอกเลขที่ใบโอนย้าย");
    if (!disposalDate) return toast.error("กรุณาเลือกวันที่จำหน่าย");
    if (selected.length === 0) return toast.error("กรุณาเลือกอุปกรณ์อย่างน้อย 1 รายการ");

    // ตรวจจำนวนสินเปลือง
    for (const s of selected) {
      if (s.kind === "consumable") {
        if (!Number.isFinite(s.qty) || s.qty <= 0) return toast.error(`จำนวนของ ${s.consumable.equipment_name} ต้องมากกว่า 0`);
        if (s.qty > s.consumable.quantity) return toast.error(`${s.consumable.equipment_name} จำนวนเกินสต็อก (คงเหลือ ${s.consumable.quantity})`);
      }
    }

    setSaving(true);

    // ตรวจเลขใบโอนย้ายซ้ำ
    const { data: dup } = await supabase
      .from("disposals").select("id").eq("transfer_document_no", transferDoc.trim()).maybeSingle();
    if (dup) { setSaving(false); return toast.error("เลขที่ใบโอนย้ายนี้มีอยู่แล้ว"); }

    const disposalNo = genDisposalNo();
    const { data: created, error: e1 } = await supabase.from("disposals").insert({
      disposal_no: disposalNo,
      employee_code: employeeCode.trim(),
      employee_name: employeeName.trim(),
      department: department.trim(),
      transfer_document_no: transferDoc.trim(),
      disposal_date: disposalDate,
      note: note.trim() || null,
      created_by: userId,
    }).select("id").single();

    if (e1 || !created) { setSaving(false); return toast.error(e1?.message ?? "บันทึกไม่สำเร็จ"); }

    // สร้าง disposal_items
    const itemsPayload = selected.map(s => s.kind === "asset" ? {
      disposal_id: created.id,
      item_type: "asset" as const,
      asset_id: s.asset.id,
      asset_code: s.asset.asset_code,
      asset_name: s.asset.name,
      quantity: 1,
    } : {
      disposal_id: created.id,
      item_type: "consumable" as const,
      consumable_id: s.consumable.id,
      consumable_name: s.consumable.equipment_name,
      consumable_type: s.consumable.equipment_type,
      quantity: s.qty,
    });
    const { error: e2 } = await supabase.from("disposal_items").insert(itemsPayload);
    if (e2) {
      await supabase.from("disposals").delete().eq("id", created.id);
      setSaving(false);
      return toast.error(e2.message);
    }

    // เปลี่ยนสถานะ asset เป็น "จำหน่ายแล้ว"
    const { data: disposedStatus } = await supabase.from("asset_statuses").select("id").eq("name", "จำหน่ายแล้ว").maybeSingle();
    for (const s of selected) {
      if (s.kind === "asset" && disposedStatus?.id) {
        await supabase.from("assets").update({ status_id: disposedStatus.id }).eq("id", s.asset.id);
      }
      if (s.kind === "consumable") {
        await supabase.from("consumables")
          .update({ quantity: s.consumable.quantity - s.qty })
          .eq("id", s.consumable.id);
      }
    }

    await logAudit({
      action: "create", entityType: "disposal", entityId: created.id,
      details: { disposal_no: disposalNo, items: selected.length },
    });

    setSaving(false);
    toast.success(`บันทึกการจำหน่ายเรียบร้อย: ${disposalNo}`);
    onSaved();
    onClose();
  };

  return (
    <div className="space-y-6">
      {/* ผู้รับผิดชอบ */}
      <section className="space-y-3">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">ข้อมูลผู้รับผิดชอบ</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>รหัสพนักงาน *</Label>
            <Input value={employeeCode} onChange={e => setEmployeeCode(e.target.value)} maxLength={50} />
          </div>
          <div>
            <Label>ชื่อ *</Label>
            <Input value={employeeName} onChange={e => setEmployeeName(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label>แผนก *</Label>
            <Input value={department} onChange={e => setDepartment(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label>เลขที่ใบโอนย้าย *</Label>
            <Input value={transferDoc} onChange={e => setTransferDoc(e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label>วันที่จำหน่าย *</Label>
            <Input type="date" value={disposalDate} onChange={e => setDisposalDate(e.target.value)} />
          </div>
          <div>
            <Label>หมายเหตุ</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={1} maxLength={1000} />
          </div>
        </div>
      </section>

      {/* อุปกรณ์ IT */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">อุปกรณ์ IT (พร้อมใช้งาน)</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 h-8" placeholder="ค้นหา..." value={assetSearch} onChange={e => setAssetSearch(e.target.value)} />
          </div>
        </div>
        <div className="border rounded-md max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs sticky top-0">
              <tr>
                <th className="p-2 w-8"></th>
                <th className="text-left p-2">Asset Code</th>
                <th className="text-left p-2">ชื่อ</th>
                <th className="text-left p-2">Brand/Model</th>
                <th className="text-left p-2">Serial</th>
                <th className="text-left p-2">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAssets.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">ไม่มีอุปกรณ์พร้อมใช้งาน</td></tr>
              ) : filteredAssets.map(a => (
                <tr key={a.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => toggleAsset(a)}>
                  <td className="p-2"><Checkbox checked={selectedAssetIds.has(a.id)} /></td>
                  <td className="p-2 font-mono">{a.asset_code}</td>
                  <td className="p-2">{a.name}</td>
                  <td className="p-2 text-xs">{[a.brand, a.model].filter(Boolean).join(" / ")}</td>
                  <td className="p-2 text-xs">{a.serial_number ?? "-"}</td>
                  <td className="p-2"><Badge variant="secondary" className="text-xs">{a.asset_statuses?.name}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* อุปกรณ์สิ้นเปลือง */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase text-muted-foreground">อุปกรณ์สิ้นเปลือง</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 h-8" placeholder="ค้นหา..." value={consSearch} onChange={e => setConsSearch(e.target.value)} />
          </div>
        </div>
        <div className="border rounded-md max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs sticky top-0">
              <tr>
                <th className="p-2 w-8"></th>
                <th className="text-left p-2">ประเภท</th>
                <th className="text-left p-2">ชื่อ</th>
                <th className="text-right p-2">คงเหลือ</th>
                <th className="text-right p-2 w-32">จำนวนจำหน่าย</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCons.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground text-xs">ไม่มีอุปกรณ์ในสต็อก</td></tr>
              ) : filteredCons.map(c => {
                const sel = selectedConsMap.get(c.id);
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="p-2 cursor-pointer" onClick={() => toggleCons(c)}>
                      <Checkbox checked={!!sel} />
                    </td>
                    <td className="p-2 cursor-pointer" onClick={() => toggleCons(c)}>{c.equipment_type}</td>
                    <td className="p-2 cursor-pointer" onClick={() => toggleCons(c)}>{c.equipment_name}</td>
                    <td className="p-2 text-right tabular-nums">{c.quantity}</td>
                    <td className="p-2 text-right">
                      {sel ? (
                        <Input
                          type="number" min={1} max={c.quantity}
                          className="h-7 w-24 ml-auto text-right"
                          value={sel.qty}
                          onChange={e => updateConsQty(c.id, Math.max(1, Math.min(c.quantity, Number(e.target.value) || 1)))}
                        />
                      ) : <span className="text-xs text-muted-foreground">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* รายการที่เลือก */}
      <section className="space-y-2">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">รายการที่จะจำหน่าย ({selected.length})</h3>
        <div className="border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="text-left p-2">ประเภท</th>
                <th className="text-left p-2">ชื่อ</th>
                <th className="text-left p-2">Serial/Asset Code</th>
                <th className="text-right p-2">จำนวน</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {selected.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground text-xs">ยังไม่ได้เลือกรายการ</td></tr>
              ) : selected.map((s, i) => (
                <tr key={i}>
                  <td className="p-2">
                    <Badge variant={s.kind === "asset" ? "default" : "secondary"} className="text-xs">
                      {s.kind === "asset" ? "IT" : "สิ้นเปลือง"}
                    </Badge>
                  </td>
                  <td className="p-2">{s.kind === "asset" ? s.asset.name : `${s.consumable.equipment_type} - ${s.consumable.equipment_name}`}</td>
                  <td className="p-2 font-mono text-xs">{s.kind === "asset" ? (s.asset.asset_code + (s.asset.serial_number ? ` / ${s.asset.serial_number}` : "")) : "-"}</td>
                  <td className="p-2 text-right tabular-nums">{s.kind === "asset" ? 1 : s.qty}</td>
                  <td className="p-2">
                    <Button size="icon" variant="ghost" onClick={() => removeItem(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
        <Button type="button" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          บันทึกการจำหน่าย
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ---------- Detail ---------- */

function DisposalDetail({ disposalId }: { disposalId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["disposal-detail", disposalId],
    queryFn: async () => {
      const [{ data: disposal }, { data: items }] = await Promise.all([
        supabase.from("disposals").select("*").eq("id", disposalId).single(),
        supabase.from("disposal_items").select("*").eq("disposal_id", disposalId),
      ]);
      return { disposal: disposal as Disposal, items: (items ?? []) as DisposalItem[] };
    },
  });

  const exportItemsCSV = () => {
    if (!data) return;
    const rows = [
      ["ประเภท", "ชื่อ", "Asset Code", "จำนวน"],
      ...data.items.map(i => [
        i.item_type === "asset" ? "IT" : "สิ้นเปลือง",
        i.item_type === "asset" ? i.asset_name : `${i.consumable_type} - ${i.consumable_name}`,
        i.asset_code ?? "-",
        String(i.quantity),
      ]),
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${data.disposal.disposal_no}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !data) return <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  const { disposal, items } = data;

  return (
    <div className="space-y-4 print:space-y-2" id="disposal-print">
      <DialogHeader className="print:hidden">
        <DialogTitle>รายละเอียดการจำหน่าย</DialogTitle>
      </DialogHeader>

      <div className="hidden print:block text-center mb-4">
        <h1 className="text-2xl font-bold">ใบจำหน่ายอุปกรณ์</h1>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex justify-between items-start flex-wrap gap-2">
          <div>
            <div className="text-xs text-muted-foreground">เลขเอกสาร</div>
            <div className="font-mono font-bold text-lg">{disposal.disposal_no}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">วันที่จำหน่าย</div>
            <div className="font-medium">{disposal.disposal_date}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
          <div><span className="text-muted-foreground">รหัสพนักงาน:</span> <span className="font-medium">{disposal.employee_code}</span></div>
          <div><span className="text-muted-foreground">ชื่อ:</span> <span className="font-medium">{disposal.employee_name}</span></div>
          <div><span className="text-muted-foreground">แผนก:</span> <span className="font-medium">{disposal.department}</span></div>
          <div><span className="text-muted-foreground">เลขใบโอนย้าย:</span> <span className="font-medium">{disposal.transfer_document_no}</span></div>
          {disposal.note && (
            <div className="col-span-2"><span className="text-muted-foreground">หมายเหตุ:</span> {disposal.note}</div>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-3 border-b font-semibold text-sm">รายการอุปกรณ์ ({items.length})</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">ประเภท</th>
              <th className="text-left p-2">ชื่ออุปกรณ์</th>
              <th className="text-left p-2">Asset Code</th>
              <th className="text-right p-2">จำนวน</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((i, idx) => (
              <tr key={i.id}>
                <td className="p-2">{idx + 1}</td>
                <td className="p-2">
                  <Badge variant={i.item_type === "asset" ? "default" : "secondary"} className="text-xs">
                    {i.item_type === "asset" ? "IT" : "สิ้นเปลือง"}
                  </Badge>
                </td>
                <td className="p-2">
                  {i.item_type === "asset" ? i.asset_name : `${i.consumable_type} - ${i.consumable_name}`}
                </td>
                <td className="p-2 font-mono text-xs">{i.asset_code ?? "-"}</td>
                <td className="p-2 text-right tabular-nums">{i.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <DialogFooter className="print:hidden">
        <Button variant="outline" onClick={exportItemsCSV}>
          <FileText className="h-4 w-4 mr-2" /> Export CSV
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> Print / PDF
        </Button>
      </DialogFooter>
    </div>
  );
}
