import {
  Gauge,
  BookText,
  Receipt,
  ClipboardList,
  BarChart3,
  Boxes,
  SlidersHorizontal,
  X,
  Landmark,
  Settings,
} from "lucide-react";
import { PageType } from "./DashboardLayout";
import { cn } from "@/lib/utils";

interface SidebarProps {
  user: {
    username: string;
    role: "ADMIN" | "USER";
    avatarUrl?: string;
  };
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  isOpen: boolean;
  onClose: () => void;
  permissions?: Record<string, boolean>;
}

const menuItems = [
  { id: "dashboard" as PageType, label: "Dashboard", icon: Gauge },
  { id: "ledgers" as PageType, label: "Ledger List", icon: BookText },
  { id: "vouchers" as PageType, label: "Voucher Explorer", icon: Receipt },
  { id: "orders" as PageType, label: "Order Book", icon: ClipboardList },
  {
    id: "monthly-summary" as PageType,
    label: "Monthly Summary",
    icon: BarChart3,
  },
  { id: "inventory" as PageType, label: "Inventory", icon: Boxes },
  { id: "settings" as PageType, label: "Settings", icon: SlidersHorizontal },
];

export function Sidebar({
  user,
  currentPage,
  onNavigate,
  isOpen,
  onClose,
  permissions,
}: SidebarProps) {
  if (!user) return null;

  // Logic to construct the full avatar URL
  // Handles both camelCase (avatarUrl) and snake_case (avatar_url) from backend
  const rawPath = user.avatarUrl || (user as any).avatar_url;
  const baseUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

  const avatarFullUrl = rawPath
    ? `${baseUrl}${rawPath.startsWith("/") ? "" : "/"}${rawPath}`
    : undefined;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 border-r transition-transform duration-300 ease-in-out",
          "bg-slate-50/80 backdrop-blur-xl dark:bg-zinc-950/80 dark:border-zinc-800",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg shadow-blue-500/20">
                  <Landmark className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-slate-900 dark:text-white tracking-tight">
                    Tally Connect
                  </h1>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                    Pro Edition
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="lg:hidden p-2 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-full"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Main Menu
            </p>
            <ul className="space-y-1">
              {menuItems
                .filter((item) => permissions?.[item.id] !== false)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;

                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          onNavigate(item.id);
                          onClose();
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group",
                          isActive
                            ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-zinc-800"
                            : "text-slate-500 dark:text-zinc-400 hover:bg-slate-200/50 dark:hover:bg-zinc-900/50 hover:text-slate-900 dark:hover:text-zinc-100"
                        )}
                      >
                        <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                        <span className="font-medium text-sm">
                          {item.label}
                        </span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
                        )}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </nav>

          {/* User Profile Section */}
          <div className="p-4 border-t border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl bg-slate-100/50 dark:bg-zinc-900/50 border border-transparent hover:border-slate-200 dark:hover:border-zinc-800 transition-all">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-inner">
                  {avatarFullUrl ? (
                    <img
                      key={avatarFullUrl} // Force re-render when URL changes
                      src={avatarFullUrl}
                      alt={user.username}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback if image fails to load
                        (
                          e.currentTarget as HTMLImageElement
                        ).src = `https://ui-avatars.com/api/?name=${user.username}&background=2563eb&color=fff`;
                      }}
                    />
                  ) : (
                    user.username[0]?.toUpperCase()
                  )}
                </div>
                {/* Active Status Indicator */}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-zinc-950 rounded-full shadow-sm" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
                  {user.username}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate uppercase tracking-tighter font-bold">
                  {user.role === "ADMIN" ? "Administrator" : "Staff Member"}
                </p>
              </div>

              <button
                onClick={() => onNavigate("settings")}
                className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-white dark:hover:bg-zinc-800"
                title="Account Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
