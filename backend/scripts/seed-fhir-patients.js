/**
 * Seed script: creates 50 sample patients with full data in the FHIR server (database).
 * Creates: Patient (with contact/address), Encounters (visits), Observations (vitals + labs),
 * Conditions, MedicationRequests, Appointments. Data is stored in PostgreSQL via HAPI FHIR.
 *
 * Prerequisites: FHIR server running (e.g. docker-compose up -d hapi-fhir fhir-db)
 * Run: npm run seed:fhir
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FHIR_SERVER_URL = (process.env.FHIR_SERVER_URL || 'http://localhost:8080/fhir').replace(/\/$/, '');
const SEED_FILE = join(__dirname, '..', 'seeds', 'patients.json');

// Standard code systems for diagnoses and procedures
const ICD10_CM_SYSTEM = 'http://hl7.org/fhir/sid/icd-10-cm';
const CPT_SYSTEM = 'http://www.ama-assn.org/go/cpt';

const FHIR_HEADERS = {
  Accept: 'application/fhir+json',
  'Content-Type': 'application/fhir+json',
};

// Map common condition descriptions to ICD-10-CM codes (diagnoses)
const descriptionToIcd10 = (desc) => {
  if (!desc) return null;
  const d = (desc || '').toLowerCase();
  const map = {
    'type 2 diabetes': 'E11.9', 'diabetes': 'E11.9',
    'hypertension': 'I10', 'htn': 'I10',
    'osteoarthritis': 'M17.9', 'knee': 'M17.9',
    'pregnancy': 'Z33.1',
    'chronic migraine': 'G43.709', 'migraine': 'G43.909',
    'hypothyroidism': 'E03.9', 'thyroid': 'E03.9',
    'copd': 'J44.9',
    'generalized anxiety disorder': 'F41.1', 'anxiety': 'F41.9',
    'major depressive disorder': 'F33.1', 'depression': 'F32.9',
    'allergic rhinitis': 'J30.9',
    'rheumatoid arthritis': 'M06.9', 'ra': 'M06.9',
    'ckd': 'N18.9', 'chronic kidney': 'N18.9',
    'gerd': 'K21.9',
    'asthma': 'J45.90',
    'atopic dermatitis': 'L20.9', 'eczema': 'L20.9',
    'parkinson': 'G20', 'parkinson disease': 'G20',
    'obstructive sleep apnea': 'G47.33', 'sleep apnea': 'G47.33',
    'colon cancer': 'C18.9', 'basal cell': 'C44.91',
    'adhd': 'F90.9',
    'atrial fibrillation': 'I48.19', 'afib': 'I48.19',
    'heart failure': 'I50.9', 'chf': 'I50.9',
    'fibromyalgia': 'M79.7',
    'gout': 'M10.9',
    'irritable bowel': 'K58.9', 'ibs': 'K58.9',
    'lyme disease': 'A69.20',
    'lyme': 'A69.20',
    'cataract': 'H25.9',
    'hepatitis c': 'B18.2',
    'community-acquired pneumonia': 'J18.9', 'pneumonia': 'J18.9',
    'chronic migraine': 'G43.709',
  };
  for (const [key, code] of Object.entries(map)) {
    if (d.includes(key)) return code;
  }
  return null;
};

function toDateTime(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) return dateStr;
  return `${dateStr}T12:00:00`;
}

async function postResource(resourceType, resource) {
  const res = await fetch(`${FHIR_SERVER_URL}/${resourceType}`, {
    method: 'POST',
    headers: FHIR_HEADERS,
    body: JSON.stringify(resource),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${resourceType} ${res.status}: ${text.slice(0, 120)}`);
  }
  const created = await res.json();
  return created.id || created;
}

function buildPatient(p) {
  const firstName = p.firstName || (p.name && p.name.split(' ')[0]) || 'Unknown';
  const lastName = p.lastName || (p.name && p.name.split(' ').slice(1).join(' ')) || 'Patient';
  const patient = {
    resourceType: 'Patient',
    name: [{ use: 'official', family: lastName, given: [firstName] }],
    gender: (p.gender || 'unknown').toLowerCase(),
    birthDate: p.birthDate || undefined,
  };
  const telecom = [];
  if (p.phone) telecom.push({ system: 'phone', value: p.phone });
  if (p.email) telecom.push({ system: 'email', value: p.email });
  if (telecom.length) patient.telecom = telecom;
  if (p.address && (p.address.line || p.address.city || p.address.state || p.address.postalCode || p.address.country)) {
    patient.address = [{
      line: p.address.line ? [p.address.line] : [],
      city: p.address.city || '',
      state: p.address.state || '',
      postalCode: p.address.postalCode || '',
      country: p.address.country || '',
    }];
  }
  if (p.medicalAid) {
    patient.identifier = [{ system: 'http://example.org/medical-aid', value: p.medicalAid }];
  }
  return patient;
}

function buildEncounter(patientId, visit) {
  const date = toDateTime(visit.date) || new Date().toISOString();
  const cptCode = visit.cptCode || '99213'; // Office visit, established patient, level 3
  const reasonText = visit.reason || 'Visit';
  return {
    resourceType: 'Encounter',
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    type: [{
      coding: [{ system: CPT_SYSTEM, code: cptCode, display: reasonText }],
      text: reasonText,
    }],
    subject: { reference: `Patient/${patientId}` },
    period: { start: date, end: date },
    reasonCode: visit.reason ? [{ text: visit.reason }] : undefined,
    note: Array.isArray(visit.notes) && visit.notes.length
      ? visit.notes.map((t) => ({ text: t }))
      : undefined,
  };
}

function buildVitalObservation(patientId, vital) {
  const date = toDateTime(vital.date) || new Date().toISOString();
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }],
    code: { text: vital.type || 'Vital sign' },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: date,
    valueString: vital.value || undefined,
  };
}

function buildLabObservation(patientId, lab) {
  const date = toDateTime(lab.date) || new Date().toISOString();
  const obs = {
    resourceType: 'Observation',
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory', display: 'Laboratory' }] }],
    code: { text: lab.type || 'Lab' },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: date,
    valueString: lab.result || lab.value || undefined,
  };
  if (lab.interpretation) {
    obs.interpretation = [{ text: lab.interpretation }];
  }
  return obs;
}

function buildCondition(patientId, condition) {
  const onset = toDateTime(condition.onsetDate) || new Date().toISOString();
  const description = condition.description || 'Condition';
  const icd10Code = condition.icd10Code || descriptionToIcd10(description);
  const codePayload = icd10Code
    ? {
        coding: [{ system: ICD10_CM_SYSTEM, code: icd10Code, display: description }],
        text: description,
      }
    : { text: description };
  return {
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item' }] }],
    code: codePayload,
    subject: { reference: `Patient/${patientId}` },
    onsetDateTime: onset,
  };
}

function buildMedicationRequest(patientId, med) {
  const authoredOn = toDateTime(med.authoredOn) || new Date().toISOString().slice(0, 10) + 'T09:00:00';
  return {
    resourceType: 'MedicationRequest',
    status: (med.status || 'active').toLowerCase(),
    intent: 'order',
    medicationCodeableConcept: { text: med.medication || 'Medication' },
    subject: { reference: `Patient/${patientId}` },
    authoredOn,
  };
}

// Appointment: date YYYY-MM-DD, time HH:MM, durationMinutes, type (e.g. "Follow-up")
function buildAppointment(patientId, patientName, date, time, durationMinutes = 30, type = 'Check-up') {
  const start = new Date(`${date}T${time}:00`);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return {
    resourceType: 'Appointment',
    status: 'booked',
    start: start.toISOString(),
    end: end.toISOString(),
    serviceType: [{ text: type }],
    participant: [
      {
        actor: { reference: `Patient/${patientId}`, display: patientName },
        status: 'accepted',
      },
    ],
  };
}

// Generate 1–2 future appointments per patient, spread over the next 2 weeks
function getAppointmentsForPatient(index, patientCount) {
  const today = new Date();
  const slots = [
    { time: '09:00', duration: 30, type: 'Check-up' },
    { time: '09:30', duration: 15, type: 'Follow-up' },
    { time: '10:00', duration: 30, type: 'Annual physical' },
    { time: '10:30', duration: 30, type: 'Consultation' },
    { time: '11:00', duration: 15, type: 'Follow-up' },
    { time: '14:00', duration: 30, type: 'Check-up' },
    { time: '14:30', duration: 30, type: 'Follow-up' },
    { time: '15:00', duration: 45, type: 'Consultation' },
    { time: '15:30', duration: 30, type: 'Wellness visit' },
    { time: '16:00', duration: 30, type: 'Follow-up' },
  ];
  const out = [];
  const dayOffset1 = (index % 10) + 1;
  const dayOffset2 = (index % 7) + 8;
  const slot1 = slots[index % slots.length];
  const slot2 = slots[(index + 5) % slots.length];
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  const toDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const d1 = new Date(today);
  d1.setDate(today.getDate() + dayOffset1);
  out.push({ date: toDate(d1), ...slot1 });
  const d2 = new Date(today);
  d2.setDate(today.getDate() + dayOffset2);
  if (dayOffset2 !== dayOffset1) {
    out.push({ date: toDate(d2), ...slot2 });
  }
  return out;
}

async function seedOnePatient(p, index) {
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || `Patient ${index + 1}`;

  const patientResource = buildPatient(p);
  const patientId = await postResource('Patient', patientResource);

  const visits = Array.isArray(p.visits) ? p.visits : [];
  const vitals = Array.isArray(p.vitals) ? p.vitals : [];
  const labs = Array.isArray(p.labs) ? p.labs : [];
  const conditions = Array.isArray(p.conditions) ? p.conditions : [];
  const medications = Array.isArray(p.medications) ? p.medications : [];

  for (const visit of visits) {
    await postResource('Encounter', buildEncounter(patientId, visit));
  }
  for (const v of vitals) {
    await postResource('Observation', buildVitalObservation(patientId, v));
  }
  for (const lab of labs) {
    await postResource('Observation', buildLabObservation(patientId, lab));
  }
  for (const c of conditions) {
    await postResource('Condition', buildCondition(patientId, c));
  }
  for (const m of medications) {
    await postResource('MedicationRequest', buildMedicationRequest(patientId, m));
  }

  const appointmentSlots = getAppointmentsForPatient(index, 50);
  for (const slot of appointmentSlots) {
    await postResource('Appointment', buildAppointment(patientId, name, slot.date, slot.time, slot.duration || 30, slot.type || 'Check-up'));
  }

  const total = 1 + visits.length + vitals.length + labs.length + conditions.length + medications.length + appointmentSlots.length;
  return { name, patientId, total };
}

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

  console.log(`FHIR server: ${FHIR_SERVER_URL}`);
  console.log(`Seeding ${patients.length} patients with full data (visits, labs, vitals, conditions, medications, appointments)...\n`);

  let created = 0;
  let failed = 0;
  let totalResources = 0;

  for (let i = 0; i < patients.length; i++) {
    try {
      const result = await seedOnePatient(patients[i], i);
      created++;
      totalResources += result.total;
      process.stdout.write(`  ${created}/${patients.length} ${result.name} (${result.total} resources)\n`);
    } catch (err) {
      failed++;
      const name = [patients[i].firstName, patients[i].lastName].filter(Boolean).join(' ') || patients[i].name || `#${i + 1}`;
      console.error(`  Failed ${name}: ${err.message}`);
    }
  }

  console.log(`\nDone. Patients: ${created}, Failed: ${failed}, Total resources: ${totalResources}`);
  if (failed > 0) {
    console.log('Ensure the FHIR server is running: docker-compose up -d hapi-fhir fhir-db');
    process.exit(1);
  }
  console.log('All data is in the FHIR database and will persist. View patients and appointments (Schedule) in the app.');
}

seed();
