import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Loader2, PackageOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_app/consumables")({ component: ConsumablesPage });

type Consumable = {
  id: string;
  equipment_type: string;
  equipment_name: string;
  quantity: number;
  created_at: string;
  updated_at: string;
};

function ConsumablesPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const isAdmin = role === "admin";

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [editing, setEditing] = useState<Consumable | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["consumables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consumables").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Consumable[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.equipment_name.toLowerCase().includes(q) ||
      i.equipment_type.toLowerCase().includes(q)
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("consumables").delete().eq("id", deleteId);
    if (error) return toast.error(error.message);
    await logAudit({ action: "delete", entityType: "consumable", entityId: deleteId });
    toast.success("ลบเรียบร้อย");
    setDeleteId(null);
    qc.invalidateQueries({ queryKey: ["consumables"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">อุปกรณ์สิ้นเปลือง</h1>
          <p className="text-sm text-muted-foreground mt-1">จัดการสต็อกอุปกรณ์สิ้นเปลือง เช่น หมึก, เมาส์, สาย LAN</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> เพิ่มอุปกรณ์
          </Button>
        )}
      </div>

      <Card className="p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่อหรือประเภท..."
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
                <th className="text-left p-3">ประเภท</th>
                <th className="text-left p-3">ชื่ออุปกรณ์</th>
                <th className="text-right p-3">จำนวน</th>
                <th className="text-center p-3">สถานะ</th>
                {isAdmin && <th className="text-right p-3">การจัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={isAdmin ? 5 : 4} className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={isAdmin ? 5 : 4} className="p-8 text-center text-muted-foreground">
                  <PackageOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  ยังไม่มีข้อมูล
                </td></tr>
              ) : paged.map(i => (
                <tr key={i.id} className="hover:bg-muted/30">
                  <td className="p-3">{i.equipment_type}</td>
                  <td className="p-3 font-medium">{i.equipment_name}</td>
                  <td className="p-3 text-right tabular-nums font-semibold">{i.quantity}</td>
                  <td className="p-3 text-center">
                    {i.quantity === 0 ? (
                      <Badge variant="destructive">หมด</Badge>
                    ) : i.quantity < 5 ? (
                      <Badge className="bg-warning text-warning-foreground hover:bg-warning">ใกล้หมด</Badge>
                    ) : (
                      <Badge variant="secondary">ปกติ</Badge>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(i.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  )}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์สิ้นเปลือง"}</DialogTitle>
          </DialogHeader>
          <ConsumableForm
            key={editing?.id ?? "new"}
            editing={editing}
            onClose={() => { setOpen(false); setEditing(null); }}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["consumables"] });
              qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>คุณต้องการลบรายการนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้</AlertDialogDescription>
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

function ConsumableForm({ editing, onClose, onSaved }: { editing: Consumable | null; onClose: () => void; onSaved: () => void }) {
  const [equipmentType, setEquipmentType] = useState(editing?.equipment_type ?? "");
  const [equipmentName, setEquipmentName] = useState(editing?.equipment_name ?? "");
  const [quantity, setQuantity] = useState<string>(editing ? String(editing.quantity) : "1");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentType.trim()) return toast.error("กรุณากรอกประเภทอุปกรณ์");
    if (!equipmentName.trim()) return toast.error("กรุณากรอกชื่ออุปกรณ์");
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("จำนวนต้องมากกว่า 0");

    setSaving(true);
    const payload = {
      equipment_type: equipmentType.trim(),
      equipment_name: equipmentName.trim(),
      quantity: Math.floor(qty),
    };

    const { error } = editing
      ? await supabase.from("consumables").update(payload).eq("id", editing.id)
      : await supabase.from("consumables").insert(payload);

    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit({ action: editing ? "update" : "create", entityType: "consumable", entityId: editing?.id });
    toast.success(editing ? "บันทึกการแก้ไขเรียบร้อย" : "เพิ่มเรียบร้อย");
    onSaved();
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>ประเภทอุปกรณ์ *</Label>
        <Input value={equipmentType} onChange={e => setEquipmentType(e.target.value)} placeholder="เช่น หมึกปริ้นเตอร์, สาย LAN" maxLength={100} />
      </div>
      <div>
        <Label>ชื่ออุปกรณ์ *</Label>
        <Input value={equipmentName} onChange={e => setEquipmentName(e.target.value)} placeholder="เช่น HP 85A Black" maxLength={200} />
      </div>
      <div>
        <Label>จำนวน *</Label>
        <Input type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          บันทึก
        </Button>
      </DialogFooter>
    </form>
  );
}
