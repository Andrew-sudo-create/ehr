/**
 * Clear script: deletes all seeded data from the FHIR server (database).
 * Removes Appointments, Encounters, Observations, Conditions, MedicationRequests, then Patients.
 *
 * Prerequisites: FHIR server running (e.g. docker-compose up -d hapi-fhir fhir-db)
 * Run: npm run clear:fhir
 */

const FHIR_SERVER_URL = (process.env.FHIR_SERVER_URL || 'http://localhost:8080/fhir').replace(/\/$/, '');

const FHIR_HEADERS = { Accept: 'application/fhir+json' };

const RESOURCE_TYPES = [
  'Appointment',
  'Encounter',
  'Observation',
  'Condition',
  'MedicationRequest',
  'Patient',
];

async function getBundle(resourceType, count = 200) {
  const url = `${FHIR_SERVER_URL}/${resourceType}?_count=${count}`;
  const res = await fetch(url, { method: 'GET', headers: FHIR_HEADERS });
  if (!res.ok) {
    if (res.status === 404) return { entry: [] };
    throw new Error(`${resourceType} GET ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function deleteResource(resourceType, id) {
  const res = await fetch(`${FHIR_SERVER_URL}/${resourceType}/${id}`, {
    method: 'DELETE',
    headers: FHIR_HEADERS,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`${resourceType}/${id} DELETE ${res.status}: ${await res.text()}`);
  }
}

async function clearResourceType(resourceType) {
  let total = 0;
  let bundle = await getBundle(resourceType);
  let entries = bundle.entry || [];

  while (entries.length > 0) {
    for (const entry of entries) {
      const id = entry.resource?.id;
      if (id) {
        await deleteResource(resourceType, id);
        total++;
        process.stdout.write(`  Deleted ${resourceType}/${id} (${total})\r`);
      }
    }
    const nextLink = bundle.link?.find((l) => l.relation === 'next')?.url;
    if (nextLink) {
      const res = await fetch(nextLink, { method: 'GET', headers: FHIR_HEADERS });
      bundle = res.ok ? await res.json() : { entry: [] };
      entries = bundle.entry || [];
    } else {
      break;
    }
  }
  return total;
}

async function clear() {
  console.log(`FHIR server: ${FHIR_SERVER_URL}`);
  console.log('Clearing all data (Appointments → Encounters → Observations → Conditions → MedicationRequests → Patients)...\n');

  let totalDeleted = 0;
  for (const resourceType of RESOURCE_TYPES) {
    try {
      const n = await clearResourceType(resourceType);
      totalDeleted += n;
      console.log(`  ${resourceType}: ${n} deleted`);
    } catch (err) {
      console.error(`  ${resourceType}: ERROR - ${err.message}`);
    }
  }

  console.log(`\nDone. Total resources deleted: ${totalDeleted}`);
  console.log('You can re-seed with: npm run seed:fhir');
}

clear().catch((err) => {
  console.error(err);
  process.exit(1);
});
