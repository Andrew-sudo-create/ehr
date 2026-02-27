// FHIR Patient interface (list view includes condition, lastVisit, nextVisit from backend)
export interface FHIRPatient {
  id: string;
  name: string;
  gender: string;
  phone?: string | null;
  email?: string | null;
  condition?: string | null;
  lastVisit?: string | null;
  nextVisit?: string | null;
}

export interface PatientVisit {
  id: string;
  date: string | null;
  status: string;
  reason: string;
  notes: string[];
  /** CPT code for the visit/procedure when available */
  cptCode?: string | null;
}

export interface PatientLab {
  id: string;
  date: string | null;
  type: string;
  result: string | null;
  interpretation: string | null;
}

export interface PatientVital {
  id: string;
  date: string | null;
  type: string;
  value: string | null;
  code: string | null;
  system: string | null;
}

export interface PatientCondition {
  id: string;
  code: string | null;
  system: string | null;
  description: string;
  clinicalStatus: string | null;
  verificationStatus: string | null;
  onsetDate: string | null;
}

export interface PatientMedication {
  id: string;
  medication: string;
  code: string | null;
  system: string | null;
  intent: string | null;
  status: string | null;
  authoredOn: string | null;
}

export interface PatientEvent {
  kind: "visit" | "lab";
  date: string;
  data: PatientVisit | PatientLab;
}

export interface PatientDetails {
  patient: {
    id: string;
    name: string;
    gender: string;
    birthDate: string | null;
    phone: string | null;
    email: string | null;
    address: {
      line: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    medicalAid: string | null;
  };
  visits: PatientVisit[];
  labs: PatientLab[];
  vitals: PatientVital[];
  conditions: PatientCondition[];
  medications: PatientMedication[];
  events: PatientEvent[];
}

export type PatientUpdatePayload = {
  firstName?: string;
  lastName?: string;
  gender?: string;
  birthDate?: string;
  phone?: string;
  email?: string;
  address?: {
    line?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  medicalAid?: string;
};

export interface AppointmentSummary {
  id: string;
  patientName: string;
  patientInitials: string;
  start: string | null;
  end: string | null;
  time: string;
  durationMinutes: number | null;
  type: string;
  fhirStatus: string;
}

export type DriveLinkStatus = {
  linked: boolean;
  folderName: string | null;
  updatedAt: string | null;
  count: number;
};

export type DriveImportResult = {
  count: number;
  folderName: string | null;
  updatedAt: string | null;
};

/**
 * Gets the backend API base URL from environment variables
 */
export function getBackendApiUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_BACKEND_API_URL ||
    "https://ehr-backend-5a5a04974788.herokuapp.com";
  // Remove trailing slash if present
  return url.replace(/\/$/, '');
}

/**
 * Fetches patients from the backend API server
 * @returns Promise<FHIRPatient[]> Array of patients with ID, name, and gender
 */
export async function getPatients(): Promise<FHIRPatient[]> {
  try {
    const apiUrl = getBackendApiUrl();
    const response = await fetch(`${apiUrl}/api/patients`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const patients: FHIRPatient[] = await response.json();
    return patients;
  } catch (error) {
    console.error('Error fetching patients:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Cannot connect to backend server at ${getBackendApiUrl()}. Make sure this URL is correct and the backend is reachable.`
      );
    }
    throw error;
  }
}

/**
 * Fetch detailed patient information (visits, notes, labs) from the backend API
 */
export async function getPatientDetails(patientId: string): Promise<PatientDetails> {
  if (!patientId) {
    throw new Error("Patient ID is required to fetch details");
  }

  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/patients/${patientId}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch patient details: ${errorText}`);
  }

  const details: PatientDetails = await response.json();

  // Ensure events are sorted by date (newest first) on the client as well
  details.events = details.events
    .filter((e) => e.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return details;
}

/**
 * Creates a new patient via the backend API server
 * @param patientData - Patient data (firstName, lastName, gender, birthDate)
 * @returns Promise<FHIRPatient> Created patient object
 */
export async function createPatient(patientData: {
  firstName: string;
  lastName: string;
  gender?: string;
  birthDate?: string;
}): Promise<FHIRPatient> {
  try {
    const apiUrl = getBackendApiUrl();
    const response = await fetch(`${apiUrl}/api/patients`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patientData),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const patient: FHIRPatient = await response.json();
    return patient;
  } catch (error) {
    console.error('Error creating patient:', error);
    throw error;
  }
}

/**
 * Deletes a patient via the backend API server
 * @param patientId - Patient resource ID
 */
export async function deletePatient(patientId: string): Promise<void> {
  if (!patientId) {
    throw new Error('Patient ID is required to delete a patient');
  }

  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/patients/${patientId}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok && response.status !== 404 && response.status !== 204) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to delete patient: ${errorText}`);
  }
}

/**
 * Updates patient demographic/contact info via backend
 */
export async function updatePatient(patientId: string, updates: PatientUpdatePayload): Promise<void> {
  if (!patientId) {
    throw new Error("Patient ID is required to update patient");
  }

  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/patients/${patientId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to update patient: ${errorText}`);
  }
}

/**
 * Fetch upcoming appointments for dashboard/schedule views
 */
export async function getUpcomingAppointments(): Promise<AppointmentSummary[]> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/appointments`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to fetch appointments: ${errorText}`);
  }

  const appts: AppointmentSummary[] = await response.json();
  return appts;
}

export interface DocumentSummary {
  id: string;
  created: string;
  type: string;
  subject: string;
}

/**
 * Fetch documents (notes) for dashboard recent notes
 */
export async function getDocuments(): Promise<DocumentSummary[]> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/documents`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to fetch documents: ${errorText}`);
  }

  const docs: DocumentSummary[] = await response.json();
  return docs;
}

/**
 * Creates a new appointment via the backend API
 */
export async function createAppointment(appointmentData: {
  patientName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMinutes?: number;
  type?: string;
}): Promise<AppointmentSummary> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/appointments`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(appointmentData),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to create appointment: ${errorText}`);
  }

  const appt: AppointmentSummary = await response.json();
  return appt;
}

/**
 * Deletes an appointment via the backend API
 */
export async function deleteAppointment(id: string): Promise<void> {
  if (!id) {
    throw new Error('Appointment ID is required to delete an appointment');
  }

  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/appointments/${id}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok && response.status !== 404 && response.status !== 204) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to delete appointment: ${errorText}`);
  }
}

/**
 * Import patients from a linked drive folder (client-side parsed JSON)
 */
export async function importDrivePatients(patients: unknown[], folderName?: string): Promise<DriveImportResult> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/drive/import`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ patients, folderName }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to import drive patients: ${errorText}`);
  }

  const result: DriveImportResult = await response.json();
  return result;
}

/**
 * Get current drive link status
 */
export async function getDriveStatus(): Promise<DriveLinkStatus> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/drive/status`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to load drive status: ${errorText}`);
  }

  const status: DriveLinkStatus = await response.json();
  return status;
}

/**
 * Clear drive link
 */
export async function clearDriveLink(): Promise<void> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/drive/clear`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to clear drive link: ${errorText}`);
  }
}

// ============================================================================
// SCRIBE WORKFLOW TYPES & API - Modular Waypoint Architecture
// ============================================================================

export type ScribeSession = {
  id: string;
  patientId: string;
  encounterId: string | null;
  status: 'capturing' | 'extracting' | 'extracted' | 'validating' | 'validated' | 'mapping' | 'mapped' | 'committing' | 'committed' | 'commit-failed';
  createdAt: string;
  transcript: string;
  extractedData: ExtractedClinicalData | null;
  validatedData: ValidationResult | null;
  fhirResources: FHIRResource[] | null;
  committed: boolean;
  committedAt?: string;
  commitError?: string;
  resourceCount?: number;
};

export type ExtractedClinicalData = {
  chiefComplaint: string | null;
  vitals: ExtractedVital[];
  diagnoses: ExtractedDiagnosis[];
  medications: ExtractedMedication[];
  orders: ExtractedOrder[];
};

export type ExtractedVital = {
  type: string;
  loincCode: string;
  value?: string;
  unit?: string;
  systolic?: { value: string; unit: string; loincCode: string };
  diastolic?: { value: string; unit: string; loincCode: string };
};

export type ExtractedDiagnosis = {
  description: string;
  code: string | null;
  system: string;
};

export type ExtractedMedication = {
  name: string;
  code: string | null;
  system: string;
};

export type ExtractedOrder = {
  description: string;
  type: string;
};

export type ValidationResult = {
  valid: boolean;
  warnings: string[];
  errors: string[];
  vitals: VitalValidation[];
  diagnoses: DiagnosisValidation[];
  medications: MedicationValidation[];
};

export type VitalValidation = {
  index: number;
  valid: boolean;
  warnings: string[];
};

export type DiagnosisValidation = {
  index: number;
  valid: boolean;
  warnings: string[];
};

export type MedicationValidation = {
  index: number;
  valid: boolean;
  warnings: string[];
};

export type FHIRResource = {
  resourceType: string;
  [key: string]: unknown;
};

/**
 * WAYPOINT 1: Capture - Initialize a scribe session
 */
export async function initializeScribeSession(patientId: string, encounterId?: string): Promise<ScribeSession> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/scribe/session`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ patientId, encounterId }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to initialize scribe session: ${errorText}`);
  }

  const session: ScribeSession = await response.json();
  return session;
}

/**
 * WAYPOINT 2: Extract - Parse transcript for clinical data
 */
export async function extractClinicalData(sessionId: string, transcript: string): Promise<ExtractedClinicalData> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/scribe/extract`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId, transcript }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to extract clinical data: ${errorText}`);
  }

  const extracted: ExtractedClinicalData = await response.json();
  return extracted;
}

/**
 * WAYPOINT 3: Validate - Validate extracted data with FHIR standards
 */
export async function validateClinicalData(sessionId: string): Promise<ValidationResult> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/scribe/validate`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to validate clinical data: ${errorText}`);
  }

  const validation: ValidationResult = await response.json();
  return validation;
}

/**
 * WAYPOINT 4: Map - Convert to FHIR resources
 */
export async function mapToFHIRResources(sessionId: string, patientId: string): Promise<{ resources: FHIRResource[]; count: number }> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/scribe/map`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId, patientId }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to map to FHIR resources: ${errorText}`);
  }

  const result: { resources: FHIRResource[]; count: number } = await response.json();
  return result;
}

/**
 * WAYPOINT 5: Review - Get session for provider review
 */
export async function getScribeSession(sessionId: string): Promise<ScribeSession> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/scribe/session/${sessionId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to get scribe session: ${errorText}`);
  }

  const session: ScribeSession = await response.json();
  return session;
}

/**
 * Update session with provider edits
 */
export async function updateScribeSession(sessionId: string, updates: Partial<Pick<ScribeSession, 'extractedData' | 'fhirResources'>>): Promise<ScribeSession> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/scribe/session/${sessionId}`, {
    method: 'PUT',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to update scribe session: ${errorText}`);
  }

  const session: ScribeSession = await response.json();
  return session;
}

/**
 * WAYPOINT 6: Commit - Submit to FHIR server
 */
export async function commitScribeSession(sessionId: string): Promise<{ success: boolean; result: unknown }> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/scribe/commit`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to commit scribe session: ${errorText}`);
  }

  const result: { success: boolean; result: unknown } = await response.json();
  return result;
}

/**
 * Delete scribe session
 */
export async function deleteScribeSession(sessionId: string): Promise<void> {
  const apiUrl = getBackendApiUrl();
  const response = await fetch(`${apiUrl}/api/scribe/session/${sessionId}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to delete scribe session: ${errorText}`);
  }
}
