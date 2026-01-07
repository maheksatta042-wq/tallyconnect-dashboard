import { useEffect, useState } from "react";
import axios from "axios";
import { Save, AlertTriangle } from "lucide-react";

export function LedgerSelectionPermissions({
  user,
  onDone,
}: {
  user: any;
  onDone: () => void;
}) {
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  /* 🔹 LOAD ALL LEDGERS */
  useEffect(() => {
    const fetchLedgers = async () => {
      const res = await axios.get("http://localhost:4000/ledger", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setLedgers(res.data.data || []);
    };
    fetchLedgers();
  }, []);

  /* 🔹 LOAD USER LEDGERS */
  useEffect(() => {
    const fetchUserLedgers = async () => {
      const res = await fetch(
        `http://localhost:4000/users/${user.id}/ledgers`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const data = await res.json();
      setSelected(new Set(data.map((l: any) => l.ledger_name)));
    };

    fetchUserLedgers();
  }, [user.id]);

  /* 🔹 TOGGLE SINGLE */
  const toggleLedger = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  /* 🔹 TOGGLE ALL */
  const toggleAll = () => {
    if (selected.size === ledgers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ledgers.map((l) => l.name)));
    }
  };

  /* 🔹 CLICK SAVE → CONFIRM */
  const save = () => {
    setShowConfirm(true);
  };

  /* 🔹 CONFIRM SAVE */
  const confirmSave = async () => {
    await fetch("http://localhost:4000/ledger/user-ledgers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        userId: user.id,
        ledgers: [...selected],
      }),
    });

    setShowConfirm(false);
    onDone();
  };

  const filteredLedgers = ledgers.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 w-full bg-white">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b pb-4">
        <h3 className="text-lg font-black uppercase text-slate-900">
          Ledger Access
        </h3>

        <div className="flex items-center gap-3">
          {/* SEARCH BAR WITH ICON */}
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search ledger..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35m1.7-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* SAVE BUTTON */}
          <button
            type="button"
            onClick={save}
            style={{ backgroundColor: "#059669", color: "#ffffff" }}
            className="flex items-center gap-2 px-6 py-2 rounded-lg
                       text-xs font-black uppercase shadow"
          >
            <Save size={16} color="#ffffff" />
            Save
          </button>

          <button
            onClick={toggleAll}
            className="text-sm underline"
          >
            Toggle All
          </button>
        </div>
      </div>

      {/* LEDGER LIST */}
      <div className="border rounded divide-y">
        {filteredLedgers.map((l) => (
          <div
            key={l.ledger_guid}
            className="flex items-center justify-between px-4 py-3"
          >
            <span>{l.name}</span>
         <input
  type="checkbox"
  checked={selected.has(l.name)}
  onChange={() => toggleLedger(l.name)}
  style={{ width: "20px", height: "20px" }}
/>
          </div>
        ))}
      </div>

      <div className="text-sm">
        Selected: {selected.size}
      </div>

      {/* CONFIRM MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <div className="text-center">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="mt-4 text-sm font-black uppercase">
                Confirm Changes?
              </h3>
              <p className="mt-2 text-xs text-slate-500">
                Are you sure you want to update ledger access for{" "}
                <b>{user?.name}</b>?
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                style={{
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                }}
                className="flex-1 py-2 rounded-lg
                           text-xs font-bold uppercase"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmSave}
                style={{ backgroundColor: "#059669", color: "#ffffff" }}
                className="flex-1 py-2 rounded-lg
                           text-xs font-bold uppercase"
              >
                Yes, Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
