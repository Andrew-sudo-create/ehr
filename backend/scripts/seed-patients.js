/**
 * Seed script: imports 50 sample patients into the EHR backend via /api/drive/import.
 * Run with: node scripts/seed-patients.js
 * Ensure the backend is running on http://localhost:3001 first.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const SEED_FILE = join(__dirname, '..', 'seeds', 'patients.json');

async function seed() {
  let patients;
  try {
    const raw = readFileSync(SEED_FILE, 'utf8');
    patients = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read seed file:', SEED_FILE, err.message);
    process.exit(1);
  }

  if (!Array.isArray(patients)) {
    console.error('Seed file must contain a JSON array of patients.');
    process.exit(1);
  }

  console.log(`Importing ${patients.length} patients to ${BACKEND_URL}/api/drive/import ...`);

  try {
    const res = await fetch(`${BACKEND_URL}/api/drive/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patients,
        folderName: 'Seed Data',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    console.log('Done.', data);
    console.log(`\nYou can now see ${data.count} patients in the EHR (Patients list, Schedule, etc.).`);
  } catch (err) {
    console.error('Import failed:', err.message);
    console.error('Make sure the backend is running: npm run dev (or npm start) in the backend folder.');
    process.exit(1);
  }
}

seed();
