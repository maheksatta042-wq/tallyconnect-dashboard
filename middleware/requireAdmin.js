// middleware/requireAdmin.js

export default function requireAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: No user info" });
    }

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    // User is admin, proceed
    next();
  } catch (err) {
    console.error("Admin check failed:", err);
    return res.status(500).json({ message: "Server error during admin check" });
  }
}
