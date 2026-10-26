import User from "../models/User.js";

// Lets managers and admins through. Use after authMiddleware.
export const managerMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("name role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!["manager", "admin"].includes(user.role)) {
      return res.status(403).json({ message: "Access denied. Manager permissions are required." });
    }
    req.currentUser = user;
    next();
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
