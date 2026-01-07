import { useEffect, useState } from "react";
import {
  Search,
  Trash2,
  UserPlus,
  BookOpen,
  BarChart3,
  ShoppingCart,
  Package,
  Ticket,
  Building2,
  Settings,
} from "lucide-react";

import { OrderBookPermissions } from "./permissions/OrderBookPermissions";
import { VoucherPermissions } from "./permissions/VoucherPermissions";
import { MonthlySummaryPermissions } from "./MonthlySummaryControls";
import { CreateUserModal } from "./CreateUserModal";
import { LedgerPermissions } from "./permissions/LedgerPermissions";
import { InventoryPermissions } from "./permissions/InventoryPermissions";
import { DashboardPermissions } from "./permissions/DashboardPermissions";
import { CompanySelectionPermissions } from "./permissions/CompanySelectionPermissions";
import { LedgerSelectionPermissions } from "./permissions/LedgerSelectionPermissions";

/* ================= TYPES ================= */
type PermissionKey =
  | "ledgers"
  | "monthlySummary"
  | "orders"
  | "vouchers"
  | "Company_Selection"
  | "inventory"
  | "ledgerSelection"
  | "voucherAmount";

interface User {
  id: string;
  name: string;
  email: string;
  company: string;
  role?: "ADMIN" | "USER";

  ledgerPermissions: { columns: Record<string, boolean> };
  ordersPermissions?: { columns: Record<string, boolean> };
  ledgerSelectionPermissions?: { columns: Record<string, boolean> };
  vouchersPermissions?: { columns: Record<string, boolean> };
  inventoryPermissions?: { columns: Record<string, boolean> };
  dashboardPermissions?: { widgets: Record<string, boolean> };
  companyPermissions?: any[];
  monthlySummaryPermissions?: {
    cards?: Record<string, boolean>;
    columns?: Record<string, boolean>;
    charts?: Record<string, boolean>;
  };
}

export function AdminDashboard({
  role,
  ledgerPermissions,
  onLedgerPermissionsChange,
  refreshCurrentUser,
}: {
  role: "ADMIN" | "USER";
  ledgerPermissions: any;
  onLedgerPermissionsChange: (p: any) => void;
  refreshCurrentUser: () => void;
}) {
  // 🔐 ADMIN GUARD
  if (role !== "ADMIN") {
    return (
      <div className="p-8 text-center text-slate-600">
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="mt-2">
          You do not have permission to access the Admin Panel.
        </p>
      </div>
    );
  }

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<"users" | "permissions" | "monthly">(
    "users"
  );
  const [activeModule, setActiveModule] = useState<
    | "dashboard"
    | "ledger"
    | "monthly"
    | "orders"
    | "vouchers"
    | "ledgerSelection"
    | "Company_Selection"
    | "inventory"
  >("dashboard");

  /* ================= LOAD USERS ================= */
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:4000/users", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json();

      setUsers(
        data.map((u: any) => ({
          id: u.id,
          name: u.username,
          email: u.email,
          company: u.company || "-",
          role: u.role || "USER",
ledgerPermissions: {
  columns: {
    partyName: true,
    type: true,
    opening: true,
    outstanding: true,
    dueDays: true,
    actions: true,
  },
},

    
          ordersPermissions: u.orders_permissions || { columns: {} },
          vouchersPermissions: u.vouchers_permissions || { columns: {} },
          inventoryPermissions: u.inventory_permissions || { columns: {} },
          dashboardPermissions: u.dashboard_permissions || { widgets: {} },
          ledgerSelectionPermissions: u.ledger_selection_permissions || {
            columns: {},
          },
          companyPermissions: u.company_permissions || [],
          monthlySummaryPermissions: u.monthly_summary_permissions || {
            cards: {},
            columns: {},
            charts: {},
          },
        }))
      );
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

  /* ================= DELETE USER ================= */
  const handleDeleteUser = async (userId: string) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this user?"
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`http://localhost:4000/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) throw new Error("Delete failed");

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (selectedUser?.id === userId) setSelectedUser(null);
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  /* ================= CREATE USER ================= */
  const handleCreateUser = async (data: {
    name: string;
    email: string;
    company: string;
    password: string;
  }) => {
    try {
      const res = await fetch("http://localhost:4000/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message);

      const newUser: User = {
        id: result.user.id,
        name: result.user.username,
        email: result.user.email,
        company: data.company,
        role: result.user.role || "USER",
        ledgerPermissions: { columns: {} },
        ordersPermissions: { columns: {} },
        vouchersPermissions: { columns: {} },
        inventoryPermissions: { columns: {} },
        dashboardPermissions: { widgets: {} },
        ledgerSelectionPermissions: { columns: {} },
        companyPermissions: [],
        monthlySummaryPermissions: { cards: {}, columns: {}, charts: {} },
      };

      setUsers((prev) => [...prev, newUser]);
      setShowCreate(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  /* ================= PERMISSIONS VIEW ================= */
  if (view === "permissions" && selectedUser) {
    return (
      <div className="flex gap-6">
        <div className="w-64 bg-white rounded-xl p-3 border border-slate-200 h-fit">
          {[
            { key: "dashboard", label: "Dashboard", icon: BarChart3 },
            { key: "ledger", label: "Ledger List", icon: BookOpen },
            { key: "orders", label: "Orders", icon: ShoppingCart },
            { key: "inventory", label: "Inventory", icon: Package },
            { key: "monthly", label: "Monthly Summary", icon: BarChart3 },
            {
              key: "ledgerSelection",
              label: "Ledger Selection",
              icon: BookOpen,
            },
            { key: "vouchers", label: "Vouchers", icon: Ticket },
            {
              key: "Company_Selection",
              label: "Company Selection",
              icon: Building2,
            },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveModule(key as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-colors ${
                activeModule === key
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 font-medium hover:bg-slate-50"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1">
          {activeModule === "ledger" && (
            <LedgerPermissions
              value={selectedUser.ledgerPermissions}
              user={selectedUser}
              onDone={() => setView("users")}
            />
          )}

          {activeModule === "dashboard" && (
            <DashboardPermissions
              value={selectedUser.dashboardPermissions || { widgets: {} }}
              user={selectedUser}
              onDone={async () => {
                await refreshCurrentUser();
                setView("users");
              }}
            />
          )}

          {activeModule === "monthly" && (
            <MonthlySummaryPermissions
              value={
                selectedUser.monthlySummaryPermissions || {
                  cards: {},
                  columns: {},
                  charts: {},
                }
              }
              user={selectedUser}
              onChange={(newPermissions) =>
                setUsers((prev) =>
                  prev.map((u) =>
                    u.id === selectedUser.id
                      ? { ...u, monthlySummaryPermissions: newPermissions }
                      : u
                  )
                )
              }
              onDone={() => setView("users")}
            />
          )}

          {activeModule === "inventory" && (
            <InventoryPermissions
              value={selectedUser.inventoryPermissions || { columns: {} }}
              user={selectedUser}
              onChange={(newPermissions) =>
                setUsers((prev) =>
                  prev.map((u) =>
                    u.id === selectedUser.id
                      ? { ...u, inventoryPermissions: newPermissions }
                      : u
                  )
                )
              }
              refreshCurrentUser={refreshCurrentUser}
              onDone={() => setView("users")}
            />
          )}

          {activeModule === "orders" && (
            <OrderBookPermissions
              value={selectedUser.ordersPermissions || { columns: {} }}
              user={selectedUser}
              onChange={(newPermissions) =>
                setUsers((prev) =>
                  prev.map((u) =>
                    u.id === selectedUser.id
                      ? { ...u, ordersPermissions: newPermissions }
                      : u
                  )
                )
              }
              refreshCurrentUser={refreshCurrentUser}
              onDone={() => setView("users")}
            />
          )}

          {activeModule === "Company_Selection" && (
            <CompanySelectionPermissions
              user={selectedUser}
              value={selectedUser.companyPermissions || []}
              onChange={(newPermissions) =>
                setUsers((prev) =>
                  prev.map((u) =>
                    u.id === selectedUser.id
                      ? { ...u, companyPermissions: newPermissions }
                      : u
                  )
                )
              }
              onDone={() => setView("users")}
            />
          )}

          {activeModule === "ledgerSelection" &&
            selectedUser.role !== "ADMIN" && (
              <LedgerSelectionPermissions
                user={selectedUser}
                onDone={() => setView("users")}
              />
            )}

          {activeModule === "vouchers" && (
            <VoucherPermissions
              value={selectedUser.vouchersPermissions || { columns: {} }}
              user={selectedUser}
              onChange={(newPermissions) =>
                setUsers((prev) =>
                  prev.map((u) =>
                    u.id === selectedUser.id
                      ? { ...u, vouchersPermissions: newPermissions }
                      : u
                  )
                )
              }
              refreshCurrentUser={fetchUsers}
              onDone={() => setView("users")}
            />
          )}
        </div>
      </div>
    );
  }

  /* ================= USERS LIST ================= */
  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.company?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <p className="text-sm text-slate-500">
            Manage company access and permissions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-white w-64 text-sm outline-none"
            />
          </div>

          {role === "ADMIN" && (
            <button
              onClick={() => setShowCreate(true)}
              style={{ backgroundColor: "#0f172a" }}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium"
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              Create User
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-sm font-medium text-slate-600">
                User
              </th>
              <th className="px-6 py-3 text-sm font-medium text-slate-600 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr
                key={user.id}
                className="border-t hover:bg-slate-50 transition"
              >
                <td className="px-6 py-4 flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold uppercase"
                    style={{
                      backgroundColor: [
                        "#f87171",
                        "#fbbf24",
                        "#34d399",
                        "#60a5fa",
                        "#a78bfa",
                        "#f472b6",
                        "#fb923c",
                      ][user.name.charCodeAt(0) % 7],
                    }}
                  >
                    {user.name[0]}
                  </div>
                  <span>{user.name}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end items-center gap-2">
                    {role === "ADMIN" && (
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setView("permissions");
                          setActiveModule("dashboard");
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreateUser}
        />
      )}
    </div>
  );
}
