/**
 * Import MIRI applicants from miri-database.csv into the database.
 * Creates one User per row (program MIRI) with a default password and an Application record.
 *
 * Usage (from backend folder):
 *   npm run import-miri-csv
 *   npm run import-miri-csv -- path/to/other.csv
 *
 * Default password for all imported users: Miri2026!
 * Users should change it after first login (e.g. via Forgot password).
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from '../config/db.js';
import User from '../models/User.js';
import Application from '../models/Application.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const DEFAULT_PASSWORD = 'Miri2026!';
const CSV_PATH = process.argv[2] || path.resolve(__dirname, '..', '..', 'miri-database.csv');

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('❌ CSV not found:', CSV_PATH);
    console.error('   Usage: npm run import-miri-csv [path/to/file.csv]');
    process.exit(1);
  }

  await connectDB();

  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  let rows;
  try {
    rows = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      bom: true,
    });
  } catch (err) {
    console.error('❌ Error parsing CSV:', err.message);
    process.exit(1);
  }

  const firstKey = Object.keys(rows[0] || {})[0];
  const nameFirstKey = firstKey && firstKey.includes('First') ? firstKey : 'Full Name: First';
  const nameLastKey = Object.keys(rows[0] || {}).find((k) => k.includes('Last')) || 'Full Name: Last';
  const emailKey = Object.keys(rows[0] || {}).find((k) => k.toLowerCase().includes('email')) || 'Email Address';
  const registrationKey = Object.keys(rows[0] || {}).find((k) => k.includes('Registration') || k.includes('Code')) || 'Registration Code';

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const defaultDob = new Date('1990-01-01');
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const email = (row[emailKey] || row['Email Address'] || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      skipped++;
      continue;
    }

    const existing = await User.findOne({ email }).select('_id');
    if (existing) {
      skipped++;
      continue;
    }

    const firstName = (row[nameFirstKey] || row['Full Name: First'] || '').trim();
    const lastName = (row[nameLastKey] || row['Full Name: Last'] || '').trim();
    const name = [firstName, lastName].filter(Boolean).join(' ') || email;
    const registrationCode = (row[registrationKey] || row['Registration Code'] || '').trim() || undefined;

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      dob: defaultDob,
      gender: 'Other',
      academic_level: 'Other',
      program: 'MIRI',
      digitalId: registrationCode || undefined,
      role: 'user',
      isActive: true,
    });

    await Application.create({
      userId: user._id,
      email: user.email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      step1Completed: false,
      step2Completed: false,
      step3Completed: false,
      step4Completed: false,
      currentStep: 1,
      isDraft: true,
      acceptanceLetterProgramType: 'MIRI',
    });

    created++;
    console.log('  ✓', name, '<' + email + '>');
  }

  console.log('');
  console.log('✅ Import done.');
  console.log('   Created:', created, 'users');
  console.log('   Skipped (duplicate or invalid email):', skipped);
  console.log('   Default password for all:', DEFAULT_PASSWORD);
  console.log('   Tell users to log in with their email and this password; they can change it via Forgot password.');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
