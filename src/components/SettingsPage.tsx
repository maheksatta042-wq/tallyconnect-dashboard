import { useState, useEffect } from "react";
import { User, Bell, LogOut } from "lucide-react";

interface SettingsPageProps {
  user: { username: string; company: string };
  onLogout: () => void;
  onProfileUpdate: () => void; // ✅ Prop to trigger Sidebar refresh
}

export function SettingsPage({
  user,
  onLogout,
  onProfileUpdate,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "notifications">(
    "profile"
  );

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  /* ================= FETCH USER PROFILE ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch("http://localhost:4000/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        // Handle both avatar_url (backend) and avatarUrl (frontend)
        if (data.avatar_url || data.avatarUrl) {
          setAvatarUrl(data.avatar_url || data.avatarUrl);
        }
        if (data.role) {
          setRole(data.role);
        }
      });
  }, []);

  /* ================= AVATAR UPLOAD ================= */
  const uploadAvatar = async (file: File) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const formData = new FormData();
    formData.append("avatar", file);

    const res = await fetch("http://localhost:4000/users/me/avatar", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      alert("Avatar upload failed");
      return;
    }

    const data = await res.json();

    if (data.avatar_url || data.avatarUrl) {
      setAvatarUrl(data.avatar_url || data.avatarUrl);
      setAvatarPreview(null);
      // ✅ Refresh the Sidebar immediately after upload
      onProfileUpdate();
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be less than 2MB");
      return;
    }

    // Preview instantly for better UX
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to backend
    await uploadAvatar(file);
  };

  /* ================= SAVE PROFILE ================= */
  const handleSaveProfile = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("You must login first");
      return;
    }

    const inputs = document.querySelectorAll("input");
    const payload = {
      username: (inputs[0] as HTMLInputElement)?.value,
      email: (inputs[1] as HTMLInputElement)?.value,
      role: role || "USER",
    };

    try {
      const response = await fetch("http://localhost:4000/users/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        alert("Profile update failed: " + (data.message || "Unknown error"));
        return;
      }

      alert("Profile saved successfully");
      // ✅ Refresh the Sidebar immediately to update the username/role
      onProfileUpdate();
    } catch (err) {
      console.error("Network error:", err);
      alert("Network error while saving profile");
    }
  };

  /* ================= NOTIFICATIONS ================= */
  const handleSaveNotifications = async () => {
    const token = localStorage.getItem("token");
    const checkboxes = document.querySelectorAll(
      'input[type="checkbox"][data-key]'
    );
    const preferences: Record<string, boolean> = {};

    checkboxes.forEach((cb: any) => {
      preferences[cb.dataset.key] = cb.checked;
    });

    try {
      const response = await fetch(
        "http://localhost:4000/users/me/notifications",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(preferences),
        }
      );

      const result = await response.json();

      if (response.ok) {
        alert("Notification preferences saved successfully!");
      } else {
        // This will show exactly what the backend is complaining about
        console.error("Backend Error:", result);
        alert(`Error: ${result.message || "Failed to save"}`);
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      alert("Check if your Backend server is running.");
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6">
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                    Profile Information
                  </h2>
                  <p className="text-sm text-gray-500">
                    Update your account details
                  </p>
                </div>

                {/* AVATAR SECTION */}
                <div className="flex items-center gap-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
                  <div className="relative">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Preview"
                        className="w-20 h-20 rounded-full object-cover border-2 border-blue-500/20"
                      />
                    ) : avatarUrl ? (
                      <img
                        src={`http://localhost:4000${avatarUrl}`}
                        alt="Avatar"
                        className="w-20 h-20 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-700"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                        Change Avatar
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      JPG or PNG. Max 2MB
                    </p>
                  </div>
                </div>

                {/* FORM FIELDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                      Username
                    </label>
                    <input
                      type="text"
                      defaultValue={user.username}
                      className="w-full px-4 py-2 border dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                      Email Address
                    </label>
                    <input
                      type="email"
                      defaultValue={`${user.username.toLowerCase()}@example.com`}
                      className="w-full px-4 py-2 border dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                      Role
                    </label>
                    <input
                      value={role}
                      disabled
                      className="w-full px-4 py-2 border dark:border-zinc-800 rounded-lg bg-gray-50 dark:bg-zinc-900 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t dark:border-zinc-800">
                  <button
                    onClick={handleSaveProfile}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === "notifications" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold dark:text-white">
                  Notifications
                </h2>
                <div className="space-y-4">
                  {[
                    { label: "Payment Due Reminders", key: "payment_due" },
                    { label: "Low Stock Alerts", key: "low_stock" },
                    { label: "New Voucher Created", key: "new_voucher" },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex justify-between items-center p-4 bg-gray-50 dark:bg-zinc-950 rounded-lg border dark:border-zinc-800"
                    >
                      <p className="text-sm font-medium dark:text-gray-300">
                        {item.label}
                      </p>
                      <input
                        type="checkbox"
                        data-key={item.key}
                        className="w-4 h-4 text-blue-600"
                      />
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t dark:border-zinc-800">
                  <button
                    onClick={handleSaveNotifications}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
