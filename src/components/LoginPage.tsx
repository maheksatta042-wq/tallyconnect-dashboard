import { useState, useEffect } from "react";
import {
  Building2,
  Lock,
  User,
  Mail,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import loginImage from "../assets/login-illustration.png";

interface LoginPageProps {
  onLogin: (data: { user: any; token: string }) => void;
}

interface LoginAlertProps {
  message: string;
  type?: "success" | "error" | "warning";
  duration?: number;
  onClose: () => void;
}

// ----------------------
// SHADECN-STYLE ALERT
// ----------------------
function LoginAlert({
  message,
  type = "success",
  duration = 3000,
  onClose,
}: LoginAlertProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  let bgColor = "bg-green-500";
  if (type === "error") bgColor = "bg-red-500";
  if (type === "warning") bgColor = "bg-yellow-500";

  let Icon = CheckCircle;
  if (type === "error") Icon = XCircle;
  if (type === "warning") Icon = AlertTriangle;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div
        className={`flex items-center gap-3 px-6 py-3 rounded-2xl shadow-xl text-white ${bgColor} animate-fade-in-out pointer-events-auto`}
      >
        <Icon className="w-6 h-6" />
        <span className="font-semibold">{message}</span>
      </div>

      <style>
        {`
          @keyframes fade-in-out {
            0% { opacity: 0; transform: translateY(-20px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
          }
          .animate-fade-in-out {
            animation: fade-in-out ${duration}ms ease-in-out forwards;
          }
        `}
      </style>
    </div>
  );
}

// ----------------------
// LOGIN PAGE COMPONENT
// ----------------------
export function LoginPage({ onLogin }: LoginPageProps) {
  // ----------------------
  // STATES
  // ----------------------
  const [isRegister, setIsRegister] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // FORGOT PASSWORD
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCompanyName, setForgotCompanyName] = useState("");

  // SHADECN ALERT STATE
  const [loginAlert, setLoginAlert] = useState<{
    message: string;
    type?: "success" | "error" | "warning";
  } | null>(null);

  // ----------------------
  // FORGOT PASSWORD HANDLER
  // ----------------------
  const handleForgotPassword = async () => {
    const trimmedEmail = forgotEmail.trim();
    const trimmedCompany = forgotCompanyName.trim();

    if (!trimmedEmail || !trimmedCompany) {
      setLoginAlert({
        message: "Please enter both email and company name",
        type: "warning",
      });
      return;
    }

    try {
      const res = await fetch("http://localhost:4000/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          companyName: trimmedCompany,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setLoginAlert({ message: data.message });
      setShowForgotPassword(false);
      setForgotEmail("");
      setForgotCompanyName("");
    } catch (err: any) {
      setLoginAlert({ message: err.message, type: "error" });
    }
  };

  // ----------------------
  // REGISTER ADMIN
  // ----------------------
  const registerAdmin = async () => {
    try {
      const res = await fetch("http://localhost:4000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
          isAdmin: true,
          companyName: companyName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setLoginAlert({
        message: `Admin ${username.trim()} from ${companyName.trim()} successfully registered!`,
      });

      // reset form
      setIsRegister(false);
      setIsAdmin(true);
      setUsername("");
      setEmail("");
      setPassword("");
      setCompanyName("");
    } catch (err: any) {
      setLoginAlert({ message: err.message, type: "error" });
    }
  };

  // ----------------------
  // LOGIN (USER or ADMIN)
  // ----------------------
  const loginUser = async () => {
    try {
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          loginType: isAdmin ? "ADMIN" : "USER",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      localStorage.setItem("token", data.token);
      onLogin({ user: data.user, token: data.token });

      if (isAdmin) {
        setLoginAlert({
          message: `Welcome Admin ${data.user.username} from ${data.user.company}!`,
        });
      } else {
        setLoginAlert({
          message: `Welcome ${data.user.username} from ${
            data.user.company || "your company"
          }!`,
        });
      }
    } catch (err: any) {
      setLoginAlert({ message: err.message, type: "error" });
    }
  };

  // ----------------------
  // FORM SUBMIT
  // ----------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      await registerAdmin();
    } else {
      await loginUser();
    }
  };

  // ----------------------
  // JSX
  // ----------------------
  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      {/* SHADECN ALERT */}
      {loginAlert && (
        <LoginAlert
          message={loginAlert.message}
          type={loginAlert.type}
          duration={3000}
          onClose={() => setLoginAlert(null)}
        />
      )}

      <div className="w-full max-w-6xl bg-white rounded-[2rem] shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 min-h-[700px]">
        {/* LEFT – FORM */}
        <div className="flex items-center justify-center px-6 sm:px-10 bg-white">
          <div className="w-full max-w-md bg-white p-8">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-10">
              <div
                className="p-2.5 rounded-xl shadow-lg flex items-center justify-center transform rotate-12"
                style={{
                  backgroundColor: "#1e5adb",
                  boxShadow: "0 8px 20px -6px rgba(30, 90, 219, 0.4)",
                }}
              >
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-black text-slate-800 leading-none tracking-tight italic">
                  Tally<span style={{ color: "#1e5adb" }}>Connect</span>
                </h1>
                <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-[0.3em] mt-1 text-center lg:text-left">
                  Data Synchronization
                </p>
              </div>
            </div>

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-800">
                {isRegister
                  ? "Create Admin Account"
                  : isAdmin
                  ? "Admin Login"
                  : "User Login"}
              </h2>
              <p className="text-gray-500 text-sm">
                Please enter your details to continue
              </p>
            </div>

            {/* Admin/User toggle */}
            {!isRegister && (
              <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
                <button
                  type="button"
                  onClick={() => setIsAdmin(false)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    !isAdmin ? "bg-white shadow-sm" : "text-slate-500"
                  }`}
                  style={{ color: !isAdmin ? "#1e5adb" : "" }}
                >
                  User
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdmin(true)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isAdmin ? "bg-white shadow-sm" : "text-slate-500"
                  }`}
                  style={{ color: isAdmin ? "#1e5adb" : "" }}
                >
                  Admin
                </button>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700">
                  Username
                </label>
                <div className="relative group">
                  <User
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                    size={18}
                  />
                  <input
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Email & Company (Admin Registration Only) */}
              {isRegister && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700">
                      Email
                    </label>
                    <div className="relative group">
                      <Mail
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                        size={18}
                      />
                      <input
                        type="email"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="Enter email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700">
                      Company
                    </label>
                    <div className="relative group">
                      <Building2
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                        size={18}
                      />
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="Enter company"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-slate-700">
                  Password
                </label>
                <div className="relative group">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                    size={18}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-blue-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full text-white py-4 rounded-xl font-bold shadow-lg transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: "#1e5adb",
                  boxShadow: "0 10px 15px -3px rgba(30, 90, 219, 0.3)",
                }}
              >
                {isRegister
                  ? "Register Admin"
                  : isAdmin
                  ? "Admin Login"
                  : "User Login"}
              </button>

              {/* Forgot Password */}
              {!isRegister && !isAdmin && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </form>

            {/* Toggle register/login */}
            <div className="mt-6 text-center text-sm">
              {!isRegister && isAdmin && (
                <button
                  onClick={() => setIsRegister(true)}
                  className="font-medium"
                  style={{ color: "#1e5adb" }}
                >
                  Register Admin
                </button>
              )}
              {isRegister && (
                <button
                  onClick={() => setIsRegister(false)}
                  className="font-medium"
                  style={{ color: "#1e5adb" }}
                >
                  Already have an account? Sign in
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT – IMAGE */}
        <div
          className="hidden lg:flex flex-col items-center justify-center p-12 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #06142e 0%, #1b3a8a 50%, #06142e 100%)",
          }}
        >
          <div className="relative z-10 flex flex-col items-center w-full">
            <img
              src={loginImage}
              alt="Login illustration"
              className="w-full max-w-lg object-contain drop-shadow-2xl animate-pulse-slow mb-12"
            />
            <div className="text-center max-w-md">
              <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
                Connect your Tally data seamlessly.
              </h2>
              <p className="text-blue-200 text-lg font-light">
                Real-time insights, secure sync.
              </p>
            </div>
          </div>
          <div
            className="absolute top-0 right-0 w-96 h-96 opacity-20 blur-[100px] rounded-full"
            style={{ backgroundColor: "#60a5fa" }}
          ></div>
          <div
            className="absolute bottom-0 left-0 w-96 h-96 opacity-10 blur-[100px] rounded-full"
            style={{ backgroundColor: "#22d3ee" }}
          ></div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <h3 className="text-xl mb-2">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-4">
              Enter your email and company name to request a password reset.
            </p>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full p-3 border rounded-lg mb-4"
            />
            <input
              type="text"
              value={forgotCompanyName}
              onChange={(e) => setForgotCompanyName(e.target.value)}
              placeholder="Enter your company name"
              className="w-full p-3 border rounded-lg mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowForgotPassword(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleForgotPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
