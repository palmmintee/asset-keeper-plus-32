import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Boxes, Activity, AlertTriangle, ShieldAlert, PackageCheck, ShieldCheck, Package, PackageX } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

const CHART_COLORS = ["hsl(217 91% 60%)", "hsl(160 84% 39%)", "hsl(38 92% 50%)", "hsl(0 84% 60%)", "hsl(280 78% 60%)", "hsl(199 89% 48%)", "hsl(340 82% 52%)"];

function StatCard({ icon: Icon, label, value, accent, sub }: any) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [assetsRes, statusesRes, categoriesRes, recentRes, consumablesRes] = await Promise.all([
        supabase.from("assets").select("id, status_id, category_id, warranty_expiry_date, name, updated_at, asset_code"),
        supabase.from("asset_statuses").select("id, name, color"),
        supabase.from("categories").select("id, name"),
        supabase.from("assets").select("id, name, asset_code, updated_at").order("updated_at", { ascending: false }).limit(6),
        supabase.from("consumables").select("id, equipment_type, equipment_name, quantity"),
      ]);
      const assets = assetsRes.data ?? [];
      const statuses = statusesRes.data ?? [];
      const categories = categoriesRes.data ?? [];
      const consumables = consumablesRes.data ?? [];

      const statusMap = new Map(statuses.map(s => [s.id, s]));
      const catMap = new Map(categories.map(c => [c.id, c.name]));

      const byStatus = statuses.map(s => ({
        name: s.name,
        value: assets.filter(a => a.status_id === s.id).length,
        color: s.color,
      })).filter(x => x.value > 0);

      const byCategory = categories.map(c => ({
        name: c.name,
        value: assets.filter(a => a.category_id === c.id).length,
      })).filter(x => x.value > 0);

      const today = new Date();
      const in60 = new Date(); in60.setDate(today.getDate() + 60);
      const expiringSoon = assets.filter(a => {
        if (!a.warranty_expiry_date) return false;
        const d = new Date(a.warranty_expiry_date);
        return d >= today && d <= in60;
      }).length;

      const broken = assets.filter(a => statusMap.get(a.status_id ?? "")?.name === "เสีย").length;
      const inUse = assets.filter(a => statusMap.get(a.status_id ?? "")?.name === "ใช้งาน").length;
      const borrowed = assets.filter(a => statusMap.get(a.status_id ?? "")?.name === "ถูกยืม").length;
      const disposed = assets.filter(a => statusMap.get(a.status_id ?? "")?.name === "จำหน่ายแล้ว").length;

      const consumableTotal = consumables.reduce((s, c) => s + (c.quantity ?? 0), 0);
      const consumableLow = consumables.filter(c => (c.quantity ?? 0) < 5);

      return {
        total: assets.length,
        inUse, borrowed, disposed, broken, expiringSoon,
        byStatus, byCategory,
        recent: recentRes.data ?? [],
        consumableTotal,
        consumableLow,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">แดชบอร์ด</h1>
        <p className="text-sm text-muted-foreground mt-1">ภาพรวมสต็อกอุปกรณ์ IT แบบเรียลไทม์</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={Boxes} label="ทั้งหมด" value={data!.total} accent="bg-primary-soft text-primary" />
          <StatCard icon={Activity} label="ใช้งาน" value={data!.inUse} accent="bg-success/10 text-success" />
          <StatCard icon={PackageCheck} label="ถูกยืม" value={data!.borrowed} accent="bg-warning/15 text-warning" />
          <StatCard icon={ShieldAlert} label="ใกล้หมดประกัน" value={data!.expiringSoon} accent="bg-orange-500/10 text-orange-500" sub="ภายใน 60 วัน" />
          <StatCard icon={AlertTriangle} label="เสีย" value={data!.broken} accent="bg-destructive/10 text-destructive" />
          <StatCard icon={ShieldCheck} label="จำหน่าย" value={data!.disposed} accent="bg-muted text-muted-foreground" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">สัดส่วนตามสถานะ</h3>
          <div className="h-64">
            {data?.byStatus.length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data.byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                    {data.byStatus.map((entry, i) => <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">จำนวนตามหมวดหมู่</h3>
          <div className="h-64">
            {data?.byCategory.length ? (
              <ResponsiveContainer>
                <BarChart data={data.byCategory}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">รายการที่แก้ไขล่าสุด</h3>
        {data?.recent.length ? (
          <div className="divide-y divide-border">
            {data.recent.map(r => (
              <div key={r.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{r.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.asset_code}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(r.updated_at), "d MMM yyyy HH:mm", { locale: th })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Package}
          label="อุปกรณ์สิ้นเปลือง (รวม)"
          value={data?.consumableTotal ?? 0}
          accent="bg-primary-soft text-primary"
          sub={`${(data?.consumableLow.length ?? 0)} รายการใกล้หมด`}
        />
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <PackageX className="h-4 w-4 text-warning" />
            <h3 className="font-semibold">สิ้นเปลืองใกล้หมด (น้อยกว่า 5)</h3>
          </div>
          {data?.consumableLow.length ? (
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {data.consumableLow.map(c => (
                <div key={c.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{c.equipment_name}</div>
                    <div className="text-xs text-muted-foreground">{c.equipment_type}</div>
                  </div>
                  <div className={`text-sm font-bold tabular-nums ${c.quantity === 0 ? "text-destructive" : "text-warning"}`}>
                    {c.quantity}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">ไม่มีรายการใกล้หมด</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function EmptyChart() {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</div>;
}
