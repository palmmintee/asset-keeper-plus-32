import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/master-data")({ component: MasterData });

const TABLES = [
  { key: "categories", label: "หมวดหมู่" },
  { key: "locations", label: "สถานที่" },
  { key: "asset_statuses", label: "สถานะ" },
] as const;

function MasterData() {
  const { role } = useAuth();
  if (role !== "admin") {
    return <Card className="p-8 text-center text-muted-foreground">ต้องเป็น Admin เท่านั้น</Card>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">ข้อมูลหลัก</h1>
        <p className="text-sm text-muted-foreground mt-1">จัดการหมวดหมู่ สถานที่ และสถานะอุปกรณ์</p>
      </div>
      <Tabs defaultValue="categories">
        <TabsList>
          {TABLES.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
        </TabsList>
        {TABLES.map(t => (
          <TabsContent key={t.key} value={t.key}>
            <MasterTable table={t.key} label={t.label} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function MasterTable({ table, label }: { table: string; label: string }) {
  const qc = useQueryClient();
  const hasColor = table === "asset_statuses";
  const { data = [] } = useQuery({
    queryKey: [table],
    queryFn: async () => (await supabase.from(table as any).select("*").order("name")).data ?? [],
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");

  const openNew = () => { setEditing(null); setName(""); setDescription(""); setColor("#3b82f6"); setOpen(true); };
  const openEdit = (row: any) => { setEditing(row); setName(row.name); setDescription(row.description ?? ""); setColor(row.color ?? "#3b82f6"); setOpen(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { name };
    if (hasColor) payload.color = color;
    else payload.description = description;

    const op = editing
      ? supabase.from(table as any).update(payload).eq("id", editing.id)
      : supabase.from(table as any).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("บันทึกสำเร็จ");
    setOpen(false);
    qc.invalidateQueries({ queryKey: [table] });
  };

  const remove = async (id: string) => {
    if (!confirm("ยืนยันการลบ?")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ลบสำเร็จ");
    qc.invalidateQueries({ queryKey: [table] });
  };

  return (
    <Card className="p-5 mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">{label} ({data.length})</h3>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />เพิ่ม</Button>
      </div>
      <div className="divide-y divide-border">
        {data.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              {hasColor && <div className="h-4 w-4 rounded-full" style={{ background: r.color }} />}
              <div>
                <div className="font-medium text-sm">{r.name}</div>
                {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "แก้ไข" : "เพิ่ม"} {label}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5"><Label>ชื่อ</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            {hasColor ? (
              <div className="space-y-1.5"><Label>สี</Label><Input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-20" /></div>
            ) : (
              <div className="space-y-1.5"><Label>คำอธิบาย</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button type="submit">บันทึก</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
