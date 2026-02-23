/**
 * Ambient Scribe Service - Modular Waypoint Architecture
 * 
 * Workflow: Capture → Extract → Validate → Map → Review → Commit
 */

import {
  createVitalObservation,
  createCondition,
  createMedicationRequest,
  createEncounter,
  createTransactionBundle,
  validateICD10Code,
  validateLOINCCode,
  validateSNOMEDCode,
  validateRxNormCode,
  VITAL_LOINC_CODES,
} from './fhir-utils.js';

/**
 * In-memory session store (use Redis or database in production)
 */
const sessions = new Map();

/**
 * WAYPOINT 1: Capture - Initialize a scribe session
 * @param {string} patientId - Patient resource ID
 * @param {string} encounterId - Optional encounter ID
 * @returns {Object} Session object with ID and metadata
 */
export function initializeSession(patientId, encounterId = null) {
  const sessionId = `scribe-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  const session = {
    id: sessionId,
    patientId,
    encounterId,
    status: 'capturing',
    createdAt: new Date().toISOString(),
    transcript: '',
    extractedData: null,
    validatedData: null,
    fhirResources: null,
    committed: false,
  };
  
  sessions.set(sessionId, session);
  return session;
}

/**
 * WAYPOINT 2: Extract - Parse transcript using clinical LLM patterns
 * 
 * In production, this would call an LLM API (OpenAI, Anthropic, etc.)
 * For now, we'll use pattern matching as a placeholder
 * 
 * @param {string} sessionId
 * @param {string} transcript - Raw audio transcript
 * @returns {Object} Extracted clinical data
 */
export function extractClinicalData(sessionId, transcript) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  session.transcript = transcript;
  session.status = 'extracting';
  
  // Pattern-based extraction (placeholder for LLM integration)
  const extracted = {
    chiefComplaint: extractChiefComplaint(transcript),
    vitals: extractVitals(transcript),
    diagnoses: extractDiagnoses(transcript),
    medications: extractMedications(transcript),
    orders: extractOrders(transcript),
  };
  
  session.extractedData = extracted;
  session.status = 'extracted';
  sessions.set(sessionId, session);
  
  return extracted;
}

/**
 * Helper: Extract chief complaint from transcript
 */
function extractChiefComplaint(transcript) {
  const patterns = [
    /(?:chief complaint|presenting with|complains? of|reason for visit)[:\s]+([^.]+)/i,
    /(?:patient|pt)[\s\w]*(?:reports?|states?|mentions?)[:\s]+([^.]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Helper: Extract vital signs from transcript
 */
function extractVitals(transcript) {
  const vitals = [];
  
  // Blood pressure (e.g., "BP 120/80", "blood pressure 120 over 80")
  const bpMatch = transcript.match(/(?:BP|blood pressure)[:\s]*(\d{2,3})[\s\/]?(?:over|\/)?[\s]?(\d{2,3})/i);
  if (bpMatch) {
    vitals.push({
      type: 'Blood Pressure',
      loincCode: VITAL_LOINC_CODES.BLOOD_PRESSURE,
      systolic: { value: bpMatch[1], unit: 'mmHg', loincCode: VITAL_LOINC_CODES.SYSTOLIC_BP },
      diastolic: { value: bpMatch[2], unit: 'mmHg', loincCode: VITAL_LOINC_CODES.DIASTOLIC_BP },
    });
  }
  
  // Heart rate (e.g., "heart rate 72", "HR 72 bpm")
  const hrMatch = transcript.match(/(?:HR|heart rate)[:\s]*(\d{2,3})(?:\s*bpm)?/i);
  if (hrMatch) {
    vitals.push({
      type: 'Heart Rate',
      loincCode: VITAL_LOINC_CODES.HEART_RATE,
      value: hrMatch[1],
      unit: 'bpm',
    });
  }
  
  // Temperature (e.g., "temp 98.6", "temperature 37 celsius")
  const tempMatch = transcript.match(/(?:temp|temperature)[:\s]*(\d{2,3}(?:\.\d{1,2})?)(?:\s*(F|C|fahrenheit|celsius))?/i);
  if (tempMatch) {
    const unit = tempMatch[2]?.toUpperCase().startsWith('C') ? 'Cel' : '[degF]';
    vitals.push({
      type: 'Body Temperature',
      loincCode: VITAL_LOINC_CODES.BODY_TEMP,
      value: tempMatch[1],
      unit,
    });
  }
  
  // Oxygen saturation (e.g., "O2 sat 98%", "oxygen 98 percent")
  const o2Match = transcript.match(/(?:O2|oxygen)(?:\s*sat(?:uration)?)?[:\s]*(\d{2,3})(?:\s*%|percent)?/i);
  if (o2Match) {
    vitals.push({
      type: 'Oxygen Saturation',
      loincCode: VITAL_LOINC_CODES.OXYGEN_SAT,
      value: o2Match[1],
      unit: '%',
    });
  }
  
  // Respiratory rate (e.g., "respiratory rate 16", "RR 16")
  const rrMatch = transcript.match(/(?:RR|respiratory rate)[:\s]*(\d{1,2})/i);
  if (rrMatch) {
    vitals.push({
      type: 'Respiratory Rate',
      loincCode: VITAL_LOINC_CODES.RESPIRATORY_RATE,
      value: rrMatch[1],
      unit: '/min',
    });
  }
  
  return vitals;
}

/**
 * Helper: Extract diagnoses from transcript
 */
function extractDiagnoses(transcript) {
  const diagnoses = [];
  
  // Pattern: "diagnosed with X", "diagnosis of X", "assessment: X"
  const patterns = [
    /(?:diagnos(?:ed|is) with|assessment)[:\s]+([^.]+)/gi,
    /(?:ICD(?:-10)?)[:\s]*([A-Z]\d{2}(?:\.\d{1,4})?)[:\s]*([^.]+)/gi,
  ];
  
  patterns.forEach((pattern) => {
    const matches = transcript.matchAll(pattern);
    for (const match of matches) {
      const icdMatch = match[0].match(/([A-Z]\d{2}(?:\.\d{1,4})?)/);
      if (icdMatch) {
        diagnoses.push({
          description: match[2] || match[1],
          code: icdMatch[1],
          system: 'http://hl7.org/fhir/sid/icd-10',
        });
      } else {
        diagnoses.push({
          description: match[1].trim(),
          code: null,
          system: 'http://snomed.info/sct',
        });
      }
    }
  });
  
  return diagnoses;
}

/**
 * Helper: Extract medications from transcript
 */
function extractMedications(transcript) {
  const medications = [];
  
  // Pattern: "prescribed X", "medication: X", "start X"
  const patterns = [
    /(?:prescrib(?:e|ed|ing)|start(?:ed|ing)?|medication)[:\s]+([A-Za-z]+(?:\s+\d+\s*mg)?)/gi,
    /(?:RxNorm)[:\s]*(\d+)[:\s]*([^.]+)/gi,
  ];
  
  patterns.forEach((pattern) => {
    const matches = transcript.matchAll(pattern);
    for (const match of matches) {
      const rxMatch = match[0].match(/RxNorm[:\s]*(\d+)/i);
      if (rxMatch) {
        medications.push({
          name: match[2] || match[1],
          code: rxMatch[1],
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        });
      } else {
        medications.push({
          name: match[1].trim(),
          code: null,
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        });
      }
    }
  });
  
  return medications;
}

/**
 * Helper: Extract orders/procedures from transcript
 */
function extractOrders(transcript) {
  const orders = [];
  
  // Pattern: "order X", "lab: X", "imaging: X"
  const patterns = [
    /(?:order(?:ed)?|lab|test|imaging)[:\s]+([^.]+)/gi,
  ];
  
  patterns.forEach((pattern) => {
    const matches = transcript.matchAll(pattern);
    for (const match of matches) {
      orders.push({
        description: match[1].trim(),
        type: 'order',
      });
    }
  });
  
  return orders;
}

/**
 * WAYPOINT 3: Validate - Cross-reference codes with validation patterns
 * @param {string} sessionId
 * @returns {Object} Validation results with warnings/errors
 */
export function validateExtractedData(sessionId) {
  const session = sessions.get(sessionId);
  if (!session || !session.extractedData) {
    throw new Error(`Session ${sessionId} not found or no extracted data`);
  }
  
  session.status = 'validating';
  
  const validation = {
    valid: true,
    warnings: [],
    errors: [],
    vitals: [],
    diagnoses: [],
    medications: [],
  };
  
  // Validate vitals
  session.extractedData.vitals.forEach((vital, index) => {
    const vitalValidation = { index, valid: true, warnings: [] };
    
    if (!validateLOINCCode(vital.loincCode)) {
      vitalValidation.valid = false;
      vitalValidation.warnings.push(`Invalid LOINC code: ${vital.loincCode}`);
      validation.valid = false;
    }
    
    // Value range checks (basic)
    if (vital.type === 'Heart Rate') {
      const hr = parseInt(vital.value);
      if (hr < 40 || hr > 200) {
        vitalValidation.warnings.push(`Heart rate ${hr} is outside normal range`);
      }
    }
    
    if (vital.type === 'Body Temperature' && vital.unit === '[degF]') {
      const temp = parseFloat(vital.value);
      if (temp < 95 || temp > 105) {
        vitalValidation.warnings.push(`Temperature ${temp}°F is outside normal range`);
      }
    }
    
    validation.vitals.push(vitalValidation);
  });
  
  // Validate diagnoses
  session.extractedData.diagnoses.forEach((diagnosis, index) => {
    const diagValidation = { index, valid: true, warnings: [] };
    
    if (diagnosis.code) {
      if (diagnosis.system.includes('icd-10') && !validateICD10Code(diagnosis.code)) {
        diagValidation.valid = false;
        diagValidation.warnings.push(`Invalid ICD-10 code: ${diagnosis.code}`);
        validation.valid = false;
      } else if (diagnosis.system.includes('snomed') && diagnosis.code && !validateSNOMEDCode(diagnosis.code)) {
        diagValidation.warnings.push(`SNOMED code format may be invalid: ${diagnosis.code}`);
      }
    } else {
      diagValidation.warnings.push('No code provided - will need manual coding');
    }
    
    validation.diagnoses.push(diagValidation);
  });
  
  // Validate medications
  session.extractedData.medications.forEach((medication, index) => {
    const medValidation = { index, valid: true, warnings: [] };
    
    if (medication.code && !validateRxNormCode(medication.code)) {
      medValidation.warnings.push(`RxNorm code format may be invalid: ${medication.code}`);
    } else if (!medication.code) {
      medValidation.warnings.push('No RxNorm code - will need manual coding');
    }
    
    validation.medications.push(medValidation);
  });
  
  session.validatedData = validation;
  session.status = 'validated';
  sessions.set(sessionId, session);
  
  return validation;
}

/**
 * WAYPOINT 4: Map - Convert findings to FHIR resources
 * @param {string} sessionId
 * @param {string} patientId - Patient resource ID
 * @returns {Array} Array of FHIR resources
 */
export function mapToFHIRResources(sessionId, patientId) {
  const session = sessions.get(sessionId);
  if (!session || !session.extractedData) {
    throw new Error(`Session ${sessionId} not found or no extracted data`);
  }
  
  session.status = 'mapping';
  const resources = [];
  
  // Create Encounter if chief complaint exists
  if (session.extractedData.chiefComplaint) {
    const encounter = createEncounter({
      patientId,
      status: 'finished',
      class: 'AMB',
      reasonDisplay: session.extractedData.chiefComplaint,
    });
    resources.push(encounter);
  }
  
  // Map vitals to Observations
  session.extractedData.vitals.forEach((vital) => {
    if (vital.systolic && vital.diastolic) {
      // Blood pressure has two components
      const systolic = createVitalObservation({
        patientId,
        loincCode: vital.systolic.loincCode,
        display: 'Systolic Blood Pressure',
        value: vital.systolic.value,
        unit: vital.systolic.unit,
      });
      const diastolic = createVitalObservation({
        patientId,
        loincCode: vital.diastolic.loincCode,
        display: 'Diastolic Blood Pressure',
        value: vital.diastolic.value,
        unit: vital.diastolic.unit,
      });
      resources.push(systolic, diastolic);
    } else {
      const observation = createVitalObservation({
        patientId,
        loincCode: vital.loincCode,
        display: vital.type,
        value: vital.value,
        unit: vital.unit,
      });
      resources.push(observation);
    }
  });
  
  // Map diagnoses to Conditions
  session.extractedData.diagnoses.forEach((diagnosis) => {
    if (diagnosis.code) {
      const condition = createCondition({
        patientId,
        code: diagnosis.code,
        display: diagnosis.description,
        system: diagnosis.system,
      });
      resources.push(condition);
    }
  });
  
  // Map medications to MedicationRequests
  session.extractedData.medications.forEach((medication) => {
    if (medication.code) {
      const medRequest = createMedicationRequest({
        patientId,
        medicationCode: medication.code,
        medicationDisplay: medication.name,
      });
      resources.push(medRequest);
    }
  });
  
  session.fhirResources = resources;
  session.status = 'mapped';
  sessions.set(sessionId, session);
  
  return resources;
}

/**
 * WAYPOINT 5: Review - Return session data for human-in-the-loop review
 * @param {string} sessionId
 * @returns {Object} Full session with extracted, validated, and mapped data
 */
export function getSessionForReview(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  return {
    ...session,
    resourceCount: session.fhirResources?.length || 0,
  };
}

/**
 * Update session with provider edits before commit
 * @param {string} sessionId
 * @param {Object} updates - Updated extractedData, fhirResources, etc.
 */
export function updateSessionData(sessionId, updates) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  if (updates.extractedData) {
    session.extractedData = updates.extractedData;
  }
  if (updates.fhirResources) {
    session.fhirResources = updates.fhirResources;
  }
  
  sessions.set(sessionId, session);
  return session;
}

/**
 * WAYPOINT 6: Commit - Send Transaction Bundle to FHIR server
 * @param {string} sessionId
 * @param {string} fhirServerUrl
 * @returns {Promise<Object>} FHIR server response
 */
export async function commitToFHIRServer(sessionId, fhirServerUrl) {
  const session = sessions.get(sessionId);
  if (!session || !session.fhirResources) {
    throw new Error(`Session ${sessionId} not found or no FHIR resources to commit`);
  }
  
  session.status = 'committing';
  
  const bundle = createTransactionBundle(session.fhirResources);
  
  try {
    const response = await fetch(fhirServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
      },
      body: JSON.stringify(bundle),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FHIR server error: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    session.committed = true;
    session.status = 'committed';
    session.committedAt = new Date().toISOString();
    session.fhirResponse = result;
    sessions.set(sessionId, session);
    
    return result;
  } catch (error) {
    session.status = 'commit-failed';
    session.commitError = error.message;
    sessions.set(sessionId, session);
    throw error;
  }
}

/**
 * Get session by ID
 * @param {string} sessionId
 * @returns {Object|null}
 */
export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

/**
 * Delete session
 * @param {string} sessionId
 */
export function deleteSession(sessionId) {
  sessions.delete(sessionId);
}
