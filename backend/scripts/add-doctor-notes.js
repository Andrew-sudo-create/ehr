/**
 * One-time script: adds doctor consultation notes in SOAP format to each visit in seeds/patients.json.
 * SOAP: Subjective, Objective, Assessment, Plan.
 * Run: node scripts/add-doctor-notes.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(__dirname, '..', 'seeds', 'patients.json');

const patients = JSON.parse(readFileSync(SEED_FILE, 'utf8'));

function objectiveForReason(reason) {
  const r = (reason || '').toLowerCase();
  if (r.includes('physical') || r.includes('annual') || r.includes('wellness')) {
    return 'Complete physical exam performed. Vital signs stable. No acute findings.';
  }
  if (r.includes('follow') || r.includes('check')) {
    return 'Vitals reviewed and within normal limits. Physical exam unchanged from baseline.';
  }
  if (r.includes('diabetes') || r.includes('blood sugar')) {
    return 'Fingerstick glucose reviewed. A1C trend discussed. Weight and vitals recorded.';
  }
  if (r.includes('cardiac') || r.includes('heart') || r.includes('stress')) {
    return 'EKG reviewed. Heart sounds regular. No edema. Vital signs stable.';
  }
  if (r.includes('prenatal') || r.includes('pregnancy')) {
    return 'Fetal heart tones present. Fundal height measured. Vital signs stable.';
  }
  if (r.includes('thyroid')) {
    return 'TSH/labs reviewed. No thyroid nodule on exam. Vital signs within normal limits.';
  }
  if (r.includes('copd') || r.includes('asthma') || r.includes('peak flow')) {
    return 'Peak flow and oxygen saturation recorded. Lung exam performed. No acute distress.';
  }
  if (r.includes('migraine') || r.includes('headache')) {
    return 'Neurologic exam non-focal. Headache severity and frequency reviewed.';
  }
  if (r.includes('back') || r.includes('knee') || r.includes('pain')) {
    return 'Musculoskeletal exam performed. Range of motion and strength assessed.';
  }
  return 'Vitals reviewed and within normal limits. Physical exam unremarkable.';
}

function soapNotes(reason, existingNote) {
  const subjective = existingNote
    ? `Patient presented for ${(reason || 'visit').toLowerCase()}. ${existingNote}`
    : `Patient presented for ${(reason || 'visit').toLowerCase()}. No acute complaints.`;
  const objective = objectiveForReason(reason);
  const assessment = `${reason || 'Visit'}. Stable.`;
  const plan = (reason || '').toLowerCase().includes('follow') || (reason || '').toLowerCase().includes('check')
    ? 'Continue current management. Follow up as scheduled.'
    : 'Discussed findings and options. Patient to return if symptoms change.';

  return [
    `Subjective: ${subjective}`,
    `Objective: ${objective}`,
    `Assessment: ${assessment}`,
    `Plan: ${plan}`,
  ];
}

for (const p of patients) {
  if (!Array.isArray(p.visits)) continue;
  for (const v of p.visits) {
    const existing = Array.isArray(v.notes) && v.notes.length
      ? v.notes.map((line) => line.replace(/^(Subjective|Objective|Assessment|Plan):\s*/i, '').trim()).join(' ')
      : '';
    v.notes = soapNotes(v.reason || 'Visit', existing);
  }
}

writeFileSync(SEED_FILE, JSON.stringify(patients, null, 2), 'utf8');
console.log('Updated doctor consultation notes to SOAP format for all visits in', SEED_FILE);
