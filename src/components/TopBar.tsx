import { useState, useEffect } from "react";
import api from "../api/api"; // your centralized axios instance
import {
  Search,
  Bell,
  Menu,
  Moon,
  Sun,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Building2,
  CheckCircle,
} from "lucide-react";

interface TopBarProps {
  user: {
    username: string;
    company: string;
    role: "ADMIN" | "USER";
  };
  onMenuClick: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onAdminClick: () => void;
  isAdminView?: boolean;
}

interface Company {
  company_guid: string;
  name: string;
}

export function TopBar({
  user,
  onMenuClick,
  darkMode,
  onToggleDarkMode,
  onAdminClick,
  isAdminView = false,
}: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const isAdmin = user.role === "ADMIN";

  const [companies, setCompanies] = useState<Company[]>([]);
  const [showCompanies, setShowCompanies] = useState(false);
  const [activeCompany, setActiveCompany] = useState<string>(user.company);

  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowBanner(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Helper to get token safely
  const getToken = () => {
    const token = localStorage.getItem("token");
    if (!token) console.warn("Token not found in localStorage");
    return token || "";
  };

  // Fetch companies if admin
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!isAdmin) return;
      try {
        const token = getToken();
        const res = await api.get("/company", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) {
          setCompanies(res.data.data);
        } else {
          console.warn("Failed to load companies:", res.data.message);
        }
      } catch (err: any) {
        console.error(
          "Failed to load companies:",
          err.response?.data || err.message
        );
      }
    };
    fetchCompanies();
  }, [isAdmin]);

  // Fetch active company
  useEffect(() => {
    const fetchActiveCompany = async () => {
      try {
        const token = getToken();
        const res = await api.get("/company/active", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success && res.data.company?.name) {
          setActiveCompany(res.data.company.name);
        } else {
          console.warn("No active company found:", res.data.message);
        }
      } catch (err: any) {
        console.error(
          "Failed to fetch active company:",
          err.response?.data || err.message
        );
      }
    };
    fetchActiveCompany();
  }, []);

  // Update active company if user prop changes
  useEffect(() => {
    setActiveCompany(user.company);
  }, [user.company]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest(".company-dropdown")) {
        setShowCompanies(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleSwitchCompany = async (company: Company) => {
    try {
      const token = getToken();
      const res = await api.post(
        "/company/set-active",
        { company_guid: company.company_guid },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setActiveCompany(company.name);
        setShowCompanies(false);
      } else {
        console.warn("Failed to switch company:", res.data.message);
      }
    } catch (err: any) {
      console.error(
        "Failed to switch company:",
        err.response?.data || err.message
      );
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* LEFT */}
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>

          {/* LOGIN BANNER */}
          {showBanner && (
            <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-2 rounded-xl shadow-md animate-fade-in-out max-w-md">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium truncate">
                Welcome back, {user.username}!
              </span>
            </div>
          )}

          {/* SEARCH BAR */}
          <div className="relative flex-1 max-w-md hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none"
            />
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3">
          {/* ADMIN BUTTON */}
          {isAdmin && (
            <button
              onClick={onAdminClick}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-md transition-all active:scale-95 ${
                isAdminView
                  ? "bg-gradient-to-r from-rose-500 to-red-600 ring-1 ring-rose-400"
                  : "bg-gradient-to-r from-emerald-500 to-green-600 ring-1 ring-emerald-400"
              }`}
            >
              {isAdminView ? (
                <>
                  <LogOut className="w-4 h-4" />
                  <span>Exit Admin</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>User Management</span>
                </>
              )}
            </button>
          )}

          {/* COMPANY DROPDOWN */}
          {isAdmin && (
            <div className="relative company-dropdown">
              <button
                onClick={() => setShowCompanies(!showCompanies)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                <Building2 className="w-4 h-4" />
                <span className="max-w-[140px] truncate">{activeCompany}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showCompanies && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                  {companies.length === 0 && (
                    <div className="px-4 py-2 text-sm text-gray-500">
                      No companies found
                    </div>
                  )}
                  {companies.map((c) => (
                    <button
                      key={c.company_guid}
                      onClick={() => handleSwitchCompany(c)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        activeCompany === c.name
                          ? "bg-gray-100 dark:bg-gray-700 font-semibold"
                          : ""
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DARK MODE */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {darkMode ? (
              <Sun className="w-5 h-5 text-yellow-500" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </button>

          {/* NOTIFICATIONS */}
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <Bell className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* ANIMATION */}
      <style>
        {`
          @keyframes fade-in-out {
            0% { opacity: 0; transform: translateY(-10px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-10px); }
          }
          .animate-fade-in-out {
            animation: fade-in-out 5s ease-in-out forwards;
          }
        `}
      </style>
    </header>
  );
}
