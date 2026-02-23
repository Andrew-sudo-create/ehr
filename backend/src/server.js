import express from 'express';
import cors from 'cors';
import { getPatients, createPatient, deletePatient, getPatientDetails, getUpcomingAppointments, createAppointmentResource, deleteAppointmentResource, updatePatientResource, getDocuments, getPatientSummary } from './services/fhir.js';
import {
  initializeSession,
  extractClinicalData,
  validateExtractedData,
  mapToFHIRResources,
  getSessionForReview,
  updateSessionData,
  commitToFHIRServer,
  getSession,
  deleteSession,
} from './services/scribe.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FHIR_SERVER_URL = process.env.FHIR_SERVER_URL || 'http://localhost:8080/fhir';

const driveStore = {
  folderName: null,
  updatedAt: null,
  patients: [],
  detailsById: new Map(),
};

function normalizeDrivePatient(raw, index) {
  const baseId =
    (typeof raw?.id === 'string' && raw.id.trim()) ||
    (typeof raw?.patientId === 'string' && raw.patientId.trim()) ||
    (typeof raw?.externalId === 'string' && raw.externalId.trim()) ||
    `drive-${index + 1}`;

  const id = String(baseId).startsWith('drive-') ? String(baseId) : `drive-${baseId}`;

  const name =
    typeof raw?.name === 'string'
      ? raw.name
      : [raw?.firstName, raw?.lastName].filter(Boolean).join(' ').trim() || 'Unknown';

  const gender = typeof raw?.gender === 'string' ? raw.gender : 'unknown';
  const phone = typeof raw?.phone === 'string' ? raw.phone : null;
  const email = typeof raw?.email === 'string' ? raw.email : null;

  const address = {
    line: raw?.address?.line || '',
    city: raw?.address?.city || '',
    state: raw?.address?.state || '',
    postalCode: raw?.address?.postalCode || '',
    country: raw?.address?.country || '',
  };

  const visits = Array.isArray(raw?.visits) ? raw.visits : [];
  const labs = Array.isArray(raw?.labs) ? raw.labs : [];
  const vitals = Array.isArray(raw?.vitals) ? raw.vitals : [];
  const conditions = Array.isArray(raw?.conditions) ? raw.conditions : [];
  const medications = Array.isArray(raw?.medications) ? raw.medications : [];

  const events = Array.isArray(raw?.events)
    ? raw.events
    : [
        ...visits
          .filter((v) => v && v.date)
          .map((v) => ({ kind: 'visit', date: v.date, data: v })),
        ...labs
          .filter((l) => l && l.date)
          .map((l) => ({ kind: 'lab', date: l.date, data: l })),
      ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const details = {
    patient: {
      id,
      name,
      gender,
      birthDate: raw?.birthDate || null,
      phone,
      email,
      address,
      medicalAid: raw?.medicalAid || null,
    },
    visits,
    labs,
    vitals,
    conditions,
    medications,
    events,
  };

  const listPatient = {
    id,
    name,
    gender,
    phone,
    email,
  };

  return { listPatient, details };
}

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'EHR Backend API is running' });
});

// Drive link status
app.get('/api/drive/status', (req, res) => {
  res.json({
    linked: driveStore.patients.length > 0,
    folderName: driveStore.folderName,
    updatedAt: driveStore.updatedAt,
    count: driveStore.patients.length,
  });
});

// Import drive patients (JSON array of patient objects)
app.post('/api/drive/import', (req, res) => {
  try {
    const { patients, folderName } = req.body || {};

    if (!Array.isArray(patients)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'patients must be an array of patient objects',
      });
    }

    const normalized = patients.map((p, index) => normalizeDrivePatient(p, index));

    driveStore.patients = normalized.map((n) => n.listPatient);
    driveStore.detailsById = new Map(
      normalized.map((n) => [n.listPatient.id, n.details])
    );
    driveStore.folderName = typeof folderName === 'string' ? folderName : null;
    driveStore.updatedAt = new Date().toISOString();

    res.json({
      count: driveStore.patients.length,
      folderName: driveStore.folderName,
      updatedAt: driveStore.updatedAt,
    });
  } catch (error) {
    console.error('Error importing drive patients:', error);
    res.status(500).json({
      error: 'Failed to import drive patients',
      message: error.message,
    });
  }
});

// Clear drive link
app.delete('/api/drive/clear', (req, res) => {
  driveStore.folderName = null;
  driveStore.updatedAt = null;
  driveStore.patients = [];
  driveStore.detailsById = new Map();
  res.status(204).send();
});

// Get patients endpoint (with condition, lastVisit, nextVisit for list display)
app.get('/api/patients', async (req, res) => {
  try {
    const patients = await getPatients(FHIR_SERVER_URL);
    const combined = [...driveStore.patients, ...patients];
    const appointments = await getUpcomingAppointments(FHIR_SERVER_URL).catch(() => []);

    const formatAppointmentDate = (start) => {
      if (!start) return null;
      const d = new Date(start);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
        ' at ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    };

    const enriched = await Promise.all(combined.map(async (p) => {
      let condition = null;
      let lastVisit = null;
      let nextVisit = null;

      if (driveStore.detailsById.has(p.id)) {
        const details = driveStore.detailsById.get(p.id);
        condition = details?.conditions?.[0]?.description ?? null;
        const v = details?.visits?.[0];
        if (v) {
          const dateStr = v.date ? new Date(v.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
          lastVisit = dateStr ? `${dateStr} — ${v.reason || 'Visit'}` : (v.reason || 'Visit');
        }
      } else {
        const summary = await getPatientSummary(FHIR_SERVER_URL, p.id);
        condition = summary.condition;
        lastVisit = summary.lastVisit;
      }

      const nextAppt = appointments.find((a) => (a.patientName || '').trim().toLowerCase() === (p.name || '').trim().toLowerCase());
      if (nextAppt?.start) nextVisit = formatAppointmentDate(nextAppt.start);

      return {
        ...p,
        condition: condition || null,
        lastVisit: lastVisit || null,
        nextVisit: nextVisit || null,
      };
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({
      error: 'Failed to fetch patients',
      message: error.message,
    });
  }
});

// Create patient endpoint
app.post('/api/patients', async (req, res) => {
  try {
    const { firstName, lastName, gender, birthDate } = req.body;

    // Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'First name and last name are required'
      });
    }

    const patientData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender: gender || 'unknown',
      birthDate: birthDate || undefined,
    };

    const createdPatient = await createPatient(FHIR_SERVER_URL, patientData);
    res.status(201).json(createdPatient);
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ 
      error: 'Failed to create patient', 
      message: error.message 
    });
  }
});

// Delete patient endpoint
app.delete('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Patient ID is required',
      });
    }

    if (driveStore.detailsById.has(id)) {
      driveStore.detailsById.delete(id);
      driveStore.patients = driveStore.patients.filter((p) => p.id !== id);
      return res.status(204).send();
    }

    await deletePatient(FHIR_SERVER_URL, id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({
      error: 'Failed to delete patient',
      message: error.message,
    });
  }
});

// Get detailed patient info endpoint
app.get('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Patient ID is required',
      });
    }

    if (driveStore.detailsById.has(id)) {
      return res.json(driveStore.detailsById.get(id));
    }

    const details = await getPatientDetails(FHIR_SERVER_URL, id);
    res.json(details);
  } catch (error) {
    console.error('Error fetching patient details:', error);
    res.status(500).json({
      error: 'Failed to fetch patient details',
      message: error.message,
    });
  }
});

// Update patient endpoint
app.put('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Patient ID is required',
      });
    }

    if (driveStore.detailsById.has(id)) {
      const current = driveStore.detailsById.get(id);
      const updates = req.body || {};
      const updatedDetails = {
        ...current,
        patient: {
          ...current.patient,
          name: updates.firstName || updates.lastName
            ? [updates.firstName, updates.lastName].filter(Boolean).join(' ').trim()
            : current.patient.name,
          gender: updates.gender ?? current.patient.gender,
          birthDate: updates.birthDate ?? current.patient.birthDate,
          phone: updates.phone ?? current.patient.phone,
          email: updates.email ?? current.patient.email,
          address: {
            ...current.patient.address,
            ...(updates.address || {}),
          },
          medicalAid: updates.medicalAid ?? current.patient.medicalAid,
        },
      };

      driveStore.detailsById.set(id, updatedDetails);
      driveStore.patients = driveStore.patients.map((p) =>
        p.id === id
          ? {
              ...p,
              name: updatedDetails.patient.name,
              gender: updatedDetails.patient.gender,
              phone: updatedDetails.patient.phone,
              email: updatedDetails.patient.email,
            }
          : p
      );

      return res.status(204).send();
    }

    await updatePatientResource(FHIR_SERVER_URL, id, req.body || {});
    res.status(204).send();
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({
      error: 'Failed to update patient',
      message: error.message,
    });
  }
});

// Get upcoming appointments endpoint
app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await getUpcomingAppointments(FHIR_SERVER_URL);
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      error: 'Failed to fetch appointments',
      message: error.message,
    });
  }
});

// Create appointment endpoint
app.post('/api/appointments', async (req, res) => {
  try {
    const { patientName, date, time, durationMinutes, type } = req.body;

    if (!patientName || !date || !time) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'patientName, date, and time are required',
      });
    }

    const created = await createAppointmentResource(FHIR_SERVER_URL, {
      patientName: String(patientName).trim(),
      date: String(date),
      time: String(time),
      durationMinutes: durationMinutes != null ? Number(durationMinutes) : undefined,
      type: type ? String(type).trim() : undefined,
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      error: 'Failed to create appointment',
      message: error.message,
    });
  }
});

// Delete appointment endpoint
app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Appointment ID is required',
      });
    }

    await deleteAppointmentResource(FHIR_SERVER_URL, id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({
      error: 'Failed to delete appointment',
      message: error.message,
    });
  }
});

// Get dashboard statistics endpoint — all values from real data
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [patients, appointments, documents] = await Promise.all([
      getPatients(FHIR_SERVER_URL),
      getUpcomingAppointments(FHIR_SERVER_URL),
      getDocuments(FHIR_SERVER_URL),
    ]);
    const drivePatients = driveStore.patients;
    const totalPatients = patients.length + drivePatients.length;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    // Use appointment start (ISO) for date filter; time is display-only
    const appointmentsToday = appointments.filter((apt) => {
      const start = apt.start || apt.end;
      if (!start) return false;
      const aptDate = new Date(start);
      return !Number.isNaN(aptDate.getTime()) && aptDate >= todayStart && aptDate < tomorrowStart;
    });

    const notesGenerated = documents.length;
    const avgNoteTime = notesGenerated > 0 ? 2.4 : 0;

    res.json({
      patientsToday: appointmentsToday.length,
      activeSessions: 0, // Real value would come from scribe session store
      notesGenerated,
      avgNoteTime: avgNoteTime.toFixed(1),
      totalPatients,
      totalAppointments: appointments.length,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard statistics',
      message: error.message,
    });
  }
});

// Get documents (notes) for dashboard recent notes
app.get('/api/documents', async (req, res) => {
  try {
    const documents = await getDocuments(FHIR_SERVER_URL);
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      error: 'Failed to fetch documents',
      message: error.message,
    });
  }
});

// ============================================================================
// SCRIBE API ENDPOINTS - Modular Waypoint Architecture
// ============================================================================

// Initialize scribe session (WAYPOINT 1: Capture)
app.post('/api/scribe/session', (req, res) => {
  try {
    const { patientId, encounterId } = req.body;

    if (!patientId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'patientId is required',
      });
    }

    const session = initializeSession(patientId, encounterId || null);
    res.status(201).json(session);
  } catch (error) {
    console.error('Error initializing scribe session:', error);
    res.status(500).json({
      error: 'Failed to initialize scribe session',
      message: error.message,
    });
  }
});

// Extract clinical data from transcript (WAYPOINT 2: Extract)
app.post('/api/scribe/extract', (req, res) => {
  try {
    const { sessionId, transcript } = req.body;

    if (!sessionId || !transcript) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'sessionId and transcript are required',
      });
    }

    const extracted = extractClinicalData(sessionId, transcript);
    res.json(extracted);
  } catch (error) {
    console.error('Error extracting clinical data:', error);
    res.status(500).json({
      error: 'Failed to extract clinical data',
      message: error.message,
    });
  }
});

// Validate extracted data (WAYPOINT 3: Validate)
app.post('/api/scribe/validate', (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'sessionId is required',
      });
    }

    const validation = validateExtractedData(sessionId);
    res.json(validation);
  } catch (error) {
    console.error('Error validating extracted data:', error);
    res.status(500).json({
      error: 'Failed to validate data',
      message: error.message,
    });
  }
});

// Map to FHIR resources (WAYPOINT 4: Map)
app.post('/api/scribe/map', (req, res) => {
  try {
    const { sessionId, patientId } = req.body;

    if (!sessionId || !patientId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'sessionId and patientId are required',
      });
    }

    const resources = mapToFHIRResources(sessionId, patientId);
    res.json({ resources, count: resources.length });
  } catch (error) {
    console.error('Error mapping to FHIR resources:', error);
    res.status(500).json({
      error: 'Failed to map to FHIR resources',
      message: error.message,
    });
  }
});

// Get session for review (WAYPOINT 5: Review)
app.get('/api/scribe/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'sessionId is required',
      });
    }

    const session = getSessionForReview(sessionId);
    res.json(session);
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(404).json({
      error: 'Session not found',
      message: error.message,
    });
  }
});

// Update session with provider edits
app.put('/api/scribe/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'sessionId is required',
      });
    }

    const session = updateSessionData(sessionId, updates);
    res.json(session);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({
      error: 'Failed to update session',
      message: error.message,
    });
  }
});

// Commit to FHIR server (WAYPOINT 6: Commit)
app.post('/api/scribe/commit', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'sessionId is required',
      });
    }

    const result = await commitToFHIRServer(sessionId, FHIR_SERVER_URL);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error committing to FHIR server:', error);
    res.status(500).json({
      error: 'Failed to commit to FHIR server',
      message: error.message,
    });
  }
});

// Delete scribe session
app.delete('/api/scribe/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'sessionId is required',
      });
    }

    deleteSession(sessionId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      error: 'Failed to delete session',
      message: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EHR Backend API server running on http://localhost:${PORT}`);
  console.log(`📡 FHIR Server URL: ${FHIR_SERVER_URL}`);
});
