import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Boxes, Database, Users, ScrollText, LogOut, Moon, Sun, Settings, Package,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-provider";
import { Button } from "@/components/ui/button";

const mainItems = [
  { title: "แดชบอร์ด", url: "/dashboard", icon: LayoutDashboard },
  { title: "อุปกรณ์ IT", url: "/assets", icon: Boxes },
  { title: "อุปกรณ์สิ้นเปลือง", url: "/consumables", icon: Package },
];

const adminItems = [
  { title: "ข้อมูลหลัก", url: "/master-data", icon: Database },
  { title: "ผู้ใช้งาน", url: "/users", icon: Users },
  { title: "Audit Log", url: "/audit", icon: ScrollText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: r => r.location.pathname });
  const { signOut, user, role } = useAuth();
  const { theme, toggle } = useTheme();

  const isActive = (url: string) => path === url || path.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Boxes className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold">IT Stock</span>
              <span className="text-xs text-muted-foreground">Management</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>เมนูหลัก</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>การจัดการ</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map(item => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="px-2 py-2 text-xs">
            <div className="font-medium truncate">{user.email}</div>
            <div className="text-muted-foreground capitalize">สิทธิ์: {role ?? "-"}</div>
          </div>
        )}
        <div className="flex gap-1 px-2 pb-2">
          <Button variant="ghost" size="sm" onClick={toggle} className="flex-1">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!collapsed && <span className="ml-2">ธีม</span>}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="flex-1">
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">ออก</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
