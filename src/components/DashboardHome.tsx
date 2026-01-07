import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import {
  Activity,
  CreditCard,
  Receipt,
  CheckCircle2,
  Calendar,
  Users,         // Enhanced Ledger Icon
  ArrowLeftRight, // Enhanced Voucher Icon
  ShoppingBag,    // Enhanced Order Icon
  Box,            // Enhanced Inventory Icon
  Download,
  FileSpreadsheet,
  FileText as PdfIcon,
  ChevronRight,
  Search,
  ArrowLeft,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { PageType } from "./DashboardLayout";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DashboardHomeProps {
  onNavigate: (page: PageType) => void;
  user: any;
}

export function DashboardHome({ onNavigate, user }: DashboardHomeProps) {
  const [showExport, setShowExport] = useState(false);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompanyGuid, setActiveCompanyGuid] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"dashboard" | "full-report">("dashboard");
  const [searchTerm, setSearchTerm] = useState("");

  const dashboardPerms = user?.dashboardPermissions?.widgets || {};
  const isAdmin = user?.role === "ADMIN";
  const canShow = (key: string) => isAdmin || dashboardPerms[key] !== false;

  /* ================= YOUR LOGIC (UNCHANGED) ================= */
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const companyRes = await axios.get("http://localhost:4000/company/active");
        if (!companyRes.data?.company_guid) { setLedgers([]); return; }
        const companyGuid = companyRes.data.company_guid;
        setActiveCompanyGuid(companyGuid);
        const ledgerRes = await axios.get("http://localhost:4000/ledger", {
          params: { company_guid: companyGuid },
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setLedgers(ledgerRes.data.data || []);
      } catch (err) { setLedgers([]); } finally { setLoading(false); }
    };
    fetchDashboardData();
  }, []);

  const getLedgerNature = (ledger: any): "Dr" | "Cr" => {
    const group = (ledger.parent_group || "").toLowerCase();
    if (group.includes("sundry creditor") || group.includes("creditor") || group.includes("liability") || group.includes("loan") || group.includes("capital")) return "Cr";
    if (group.includes("sundry debtor") || group.includes("debtor") || group.includes("asset") || group.includes("expense")) return "Dr";
    return "Dr";
  };

  const normalizedLedgers = useMemo(() => {
    return ledgers.map((l) => {
      const nature = getLedgerNature(l);
      const rawBalance = Number(l.closing_balance || 0);
      let outstanding = 0;
      if (nature === "Dr") outstanding = rawBalance > 0 ? rawBalance : 0;
      if (nature === "Cr") outstanding = rawBalance < 0 ? Math.abs(rawBalance) : 0;
      return { ...l, type: nature, outstanding, dueDays: 0 };
    });
  }, [ledgers]);

  const stats = useMemo(() => {
    const receivables = normalizedLedgers.filter(l => l.type === "Dr" && l.outstanding > 0).reduce((sum, l) => sum + l.outstanding, 0);
    const payables = normalizedLedgers.filter(l => l.type === "Cr" && l.outstanding > 0).reduce((sum, l) => sum + l.outstanding, 0);
    return [
      { label: "Total Receivables", value: `₹${receivables.toLocaleString()}`, icon: Activity, color: "emerald" },
      { label: "Total Payables", value: `₹${payables.toLocaleString()}`, icon: CreditCard, color: "rose" },
      { label: "Pending Bills", value: normalizedLedgers.filter(l => l.outstanding > 0).length.toString(), icon: Receipt, color: "amber" },
      { label: "Cleared Bills", value: normalizedLedgers.filter(l => l.outstanding <= 0).length.toString(), icon: CheckCircle2, color: "blue" },
    ];
  }, [normalizedLedgers]);

  const overviewData = useMemo(() => {
    const income = normalizedLedgers.filter(l => l.type === "Cr").reduce((sum, l) => sum + l.outstanding, 0);
    const expense = normalizedLedgers.filter(l => l.type === "Dr").reduce((sum, l) => sum + l.outstanding, 0);
    return [{ name: "Current Period", income, expense }];
  }, [normalizedLedgers]);

  const outstandingData = useMemo(() => {
    return normalizedLedgers.map(l => ({ 
      month: l.name.length > 12 ? l.name.substring(0, 10) + '...' : l.name, 
      outstanding: l.outstanding 
    }));
  }, [normalizedLedgers]);

  const upcomingDues = useMemo(() => {
    return normalizedLedgers.filter(l => l.outstanding > 0 && l.dueDays >= 0).sort((a, b) => a.dueDays - b.dueDays).slice(0, 5).map(l => ({ 
      party: l.name, amount: l.outstanding, dueDate: l.date, days: l.dueDays 
    }));
  }, [normalizedLedgers]);

  const filteredFullList = useMemo(() => {
    return normalizedLedgers
      .filter(l => l.outstanding > 0)
      .filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [normalizedLedgers, searchTerm]);

  /* ================= FIXED EXPORT LOGIC ================= */

  const exportExcel = () => {
    const data = normalizedLedgers
      .filter(l => l.outstanding > 0)
      .map(l => ({
        "Party Name": l.name,
        "Nature": l.type === 'Dr' ? 'Receivable' : 'Payable',
        "Group": l.parent_group,
        "Outstanding Amount": l.outstanding,
      }));

    if (data.length === 0) {
      alert("No data available to export.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pending Settlements");
    
    XLSX.writeFile(workbook, `Settlements_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExport(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Pending Settlements Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    const tableRows = normalizedLedgers
      .filter(l => l.outstanding > 0)
      .map(l => [
        l.name,
        l.type === 'Dr' ? 'Receivable' : 'Payable',
        `INR ${l.outstanding.toLocaleString()}`
      ]);

    if (tableRows.length === 0) {
      alert("No data available to export.");
      return;
    }

    autoTable(doc, {
      startY: 40,
      head: [['Party Name', 'Type', 'Amount']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 10 }
    });

    doc.save(`Financial_Summary_${new Date().getTime()}.pdf`);
    setShowExport(false);
  };

  /* ================= UI RENDERING ================= */

  if (loading) return <div className="p-8 text-blue-600 font-medium text-center">Loading dashboard...</div>;

  if (viewMode === "full-report") {
    return (
      <div className="p-6 space-y-6 bg-[#f8fafc] min-h-screen">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setViewMode("dashboard")} className="p-2 bg-white border rounded-lg hover:bg-slate-50 shadow-sm"><ArrowLeft className="w-5 h-5 text-slate-600"/></button>
            <h1 className="text-xl font-bold text-slate-900">All Pending Settlements</h1>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" placeholder="Search party..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Party Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredFullList.map((l, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-700">{l.name}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${l.type === 'Dr' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {l.type === 'Dr' ? 'RECEIVABLE' : 'PAYABLE'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">₹{l.outstanding.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="p-1 space-y-4 bg-[#f8fafc] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm">Financial performance overview for your active company.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 shadow-sm">
            <Calendar className="w-4 h-4 text-blue-600" />
            {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowExport(!showExport)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shadow-md shadow-blue-100"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            {showExport && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <button onClick={exportExcel} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel Spreadsheet
                </button>
                <button onClick={exportPDF} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                  <PdfIcon className="w-4 h-4 text-rose-600" /> PDF Document
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
        {stats.filter(stat => {
          const map: any = { "Total Receivables": "totalReceivables", "Total Payables": "totalPayables", "Pending Bills": "pendingBills", "Cleared Bills": "clearedBills" };
          return canShow(map[stat.label]);
        }).map((stat, index) => (
          <div key={index} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{stat.value}</h3>
              </div>
              <div className={`p-2.5 rounded-xl transition-all shadow-sm
                ${stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white' : ''}
                ${stat.color === 'rose' ? 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white' : ''}
                ${stat.color === 'amber' ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white' : ''}
                ${stat.color === 'blue' ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' : ''}
              `}>
                <stat.icon className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-2">
        {canShow("incomeExpenseChart") && (
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span> Income vs Expense
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overviewData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                  <YAxis width={60} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}} />
                  <Bar dataKey="income" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={45} name="Income" />
                  <Bar dataKey="expense" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={45} name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {canShow("outstandingTrends") && (
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span> Outstanding Exposure
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={outstandingData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chartBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8'}} />
                  <YAxis width={60} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                  <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}} />
                  <Area type="monotone" dataKey="outstanding" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#chartBlue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Quick Navigation and Settlement Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-2 pb-6">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Quick Navigation</h3>
          <div className="space-y-2">
            {[
              { label: "Ledger List", icon: Users, page: "ledgers" },
              { label: "Voucher Explorer", icon: ArrowLeftRight, page: "vouchers" },
              { label: "Order Book", icon: ShoppingBag, page: "orders" },
              { label: "Inventory", icon: Box, page: "inventory" },
            ].filter(link => canShow(user?.role === "ADMIN" ? "ADMIN" : link.page)).map((link, i) => (
              <button
                key={i}
                onClick={() => onNavigate(link.page as any)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all">
                    <link.icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">{link.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>

        {canShow("upcomingDueDates") && (
          <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-slate-800">Settlement Timeline</h3>
              <button onClick={() => setViewMode("full-report")} className="text-[11px] font-bold text-blue-600 hover:text-blue-700 tracking-tighter uppercase">View Full Report</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcomingDues.map((due, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black">
                      {due.party.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 truncate max-w-[130px]">{due.party}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Due: {due.dueDate || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">₹{due.amount.toLocaleString()}</p>
                    <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md font-bold uppercase">{due.days} left</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}