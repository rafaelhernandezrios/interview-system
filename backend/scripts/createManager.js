/**
 * Creates a manager account with a random temporary password, or makes an existing account a manager.
 *
 * Usage (from the backend folder, with MONGO_URI in .env):
 *   node scripts/createManager.js <email> ["Full name"]
 *
 * The temporary password is printed once in this terminal and is not stored anywhere else.
 * The manager can change it with "Forgot password" on the login page.
 * If the email already has an account, only its role changes; its password is left as it is.
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import User from "../models/User.js";

const email = process.argv[2]?.trim()?.toLowerCase();
const nameArg = process.argv[3]?.trim();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: node scripts/createManager.js <email> ["Full name"]');
  process.exit(1);
}

// Readable temporary password: no characters that are easy to confuse (0/O, 1/l/I)
const generateTempPassword = (length = 14) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
};

// digitalId is unique, so managers get their own MANAGER-<year>-<n> code
const nextManagerDigitalId = async () => {
  const year = new Date().getFullYear();
  for (let n = (await User.countDocuments({ role: "manager" })) + 1; ; n++) {
    const candidate = `MANAGER-${year}-${n}`;
    if (!(await User.exists({ digitalId: candidate }))) return candidate;
  }
};

async function run() {
  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === "admin") {
      console.error(`${email} is an admin. Change their role from the admin panel if you really want that.`);
      process.exit(1);
    }
    existing.role = "manager";
    existing.isActive = true;
    await existing.save();
    console.log(`\n${existing.name} (${email}) is now a manager. Their password was not changed.\n`);
    process.exit(0);
  }

  const tempPassword = generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, await bcrypt.genSalt(10));

  const user = await User.create({
    name: nameArg || email.split("@")[0],
    email,
    password: hashedPassword,
    role: "manager",
    digitalId: await nextManagerDigitalId(),
    isActive: true,
  });

  console.log("\nManager account created");
  console.log(`  Name:               ${user.name}`);
  console.log(`  Email:              ${user.email}`);
  console.log(`  Temporary password: ${tempPassword}`);
  console.log("\nShare the password privately. The manager can set their own with \"Forgot password\" on the login page.\n");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
