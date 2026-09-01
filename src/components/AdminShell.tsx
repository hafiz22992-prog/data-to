import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Bus, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

export interface AdminNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

/**
 * هيكل لوحات الإدارة (المالك / صاحب الشركة):
 * هيدر ثابت + قائمة جانبية على اليمين (RTL) على الشاشات الكبيرة،
 * وشريط تبويب أفقي قابل للتمرير على الجوال/التابلت.
 * الأقسام تُعرض من خلال روابط anchor (#id) مع حالة نشطة.
 */
export function AdminShell({
  appName,
  appSubtitle,
  navItems,
  children,
}: {
  appName: string;
  appSubtitle: string;
  navItems: AdminNavItem[];
  children: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(navItems[0]?.id ?? "");

  const displayName = user?.name || user?.email || "مستخدم";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const go = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Bus className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">{appName}</p>
              <p className="text-xs text-muted-foreground">{appSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">خطوط زحل — النقل البري السعودية ← اليمن</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleSignOut}>
              <LogOut className="size-4" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-20 hidden h-fit w-56 shrink-0 lg:block">
          <nav className="space-y-1 rounded-xl border bg-card p-2">
            {navItems.map((item) => {
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Mobile/tablet nav */}
          <div className="mb-5 lg:hidden">
            <nav className="flex gap-1.5 overflow-x-auto pb-1">
              {navItems.map((item) => {
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => go(item.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <item.icon className="size-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
          {children}
        </div>
      </div>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-muted-foreground">
        <p>خطوط زحل — ربط المسافرين بشركات النقل البري المعتمدة في السعودية © ٢٠٢٦</p>
      </footer>
    </div>
  );
}
