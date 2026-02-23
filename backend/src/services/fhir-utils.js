/**
 * FHIR R4 Utilities - Validation and mapping helpers for FHIR resources
 */

/**
 * Creates a FHIR HumanName resource
 * @param {string} firstName 
 * @param {string} lastName 
 * @param {string} [use='official'] - 'official' | 'usual' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden'
 * @returns {Object} FHIR HumanName
 */
export function createHumanName(firstName, lastName, use = 'official') {
  const given = firstName ? [firstName] : [];
  const family = lastName || '';
  
  return {
    use,
    family,
    given,
    text: [firstName, lastName].filter(Boolean).join(' ').trim() || 'Unknown',
  };
}

/**
 * Creates a FHIR CodeableConcept
 * @param {string} code - The code value
 * @param {string} display - Display text
 * @param {string} system - Code system URI (e.g., 'http://loinc.org', 'http://snomed.info/sct')
 * @returns {Object} FHIR CodeableConcept
 */
export function createCodeableConcept(code, display, system) {
  return {
    coding: [
      {
        system: system || 'http://terminology.hl7.org/CodeSystem/data-absent-reason',
        code,
        display,
      },
    ],
    text: display,
  };
}

/**
 * Creates a FHIR Address
 * @param {Object} address - { line, city, state, postalCode, country }
 * @returns {Object} FHIR Address
 */
export function createAddress(address = {}) {
  return {
    use: 'home',
    line: address.line ? [address.line] : [],
    city: address.city || '',
    state: address.state || '',
    postalCode: address.postalCode || '',
    country: address.country || '',
  };
}

/**
 * Creates a FHIR ContactPoint (telecom)
 * @param {string} value - Phone number or email
 * @param {string} system - 'phone' | 'email' | 'fax' | 'pager' | 'url' | 'sms' | 'other'
 * @returns {Object} FHIR ContactPoint
 */
export function createContactPoint(value, system = 'phone') {
  return {
    system,
    value,
    use: 'home',
  };
}

/**
 * Validates a FHIR gender code
 * @param {string} gender
 * @returns {string} Valid FHIR gender: 'male' | 'female' | 'other' | 'unknown'
 */
export function validateGender(gender) {
  const validGenders = ['male', 'female', 'other', 'unknown'];
  const normalized = String(gender || '').toLowerCase();
  return validGenders.includes(normalized) ? normalized : 'unknown';
}

/**
 * Validates ISO 8601 date format (YYYY-MM-DD)
 * @param {string} dateStr
 * @returns {string|null} Valid date string or null
 */
export function validateDate(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : dateStr;
}

/**
 * Creates a FHIR Observation resource for vitals
 * @param {Object} params
 * @param {string} params.patientId - Patient resource ID
 * @param {string} params.loincCode - LOINC code (e.g., '8867-4' for heart rate)
 * @param {string} params.display - Display text
 * @param {string} params.value - Observed value
 * @param {string} params.unit - Unit of measure
 * @param {string} [params.date] - Observation date (ISO 8601)
 * @returns {Object} FHIR Observation resource
 */
export function createVitalObservation({ patientId, loincCode, display, value, unit, date }) {
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: loincCode,
          display,
        },
      ],
      text: display,
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    effectiveDateTime: date || new Date().toISOString(),
    valueQuantity: {
      value: parseFloat(value) || 0,
      unit,
      system: 'http://unitsofmeasure.org',
    },
  };
}

/**
 * Creates a FHIR Condition resource
 * @param {Object} params
 * @param {string} params.patientId - Patient resource ID
 * @param {string} params.code - ICD-10 or SNOMED code
 * @param {string} params.display - Condition description
 * @param {string} params.system - Code system ('http://snomed.info/sct' or 'http://hl7.org/fhir/sid/icd-10')
 * @param {string} [params.clinicalStatus='active'] - 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved'
 * @param {string} [params.onsetDate] - Date condition started
 * @returns {Object} FHIR Condition resource
 */
export function createCondition({ patientId, code, display, system, clinicalStatus = 'active', onsetDate }) {
  return {
    resourceType: 'Condition',
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: clinicalStatus,
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
        },
      ],
    },
    code: {
      coding: [
        {
          system: system || 'http://snomed.info/sct',
          code,
          display,
        },
      ],
      text: display,
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    onsetDateTime: onsetDate || undefined,
  };
}

/**
 * Creates a FHIR MedicationRequest resource
 * @param {Object} params
 * @param {string} params.patientId - Patient resource ID
 * @param {string} params.medicationCode - RxNorm code
 * @param {string} params.medicationDisplay - Medication name
 * @param {string} [params.intent='order'] - 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order'
 * @param {string} [params.status='active'] - 'active' | 'on-hold' | 'cancelled' | 'completed'
 * @returns {Object} FHIR MedicationRequest resource
 */
export function createMedicationRequest({ patientId, medicationCode, medicationDisplay, intent = 'order', status = 'active' }) {
  return {
    resourceType: 'MedicationRequest',
    status,
    intent,
    medicationCodeableConcept: {
      coding: [
        {
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: medicationCode,
          display: medicationDisplay,
        },
      ],
      text: medicationDisplay,
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    authoredOn: new Date().toISOString(),
  };
}

/**
 * Creates a FHIR Encounter resource (visit)
 * @param {Object} params
 * @param {string} params.patientId - Patient resource ID
 * @param {string} params.status - 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled'
 * @param {string} params.class - Visit type (e.g., 'AMB' for ambulatory)
 * @param {string} [params.reasonCode] - Reason for visit code
 * @param {string} [params.reasonDisplay] - Reason for visit description
 * @param {string} [params.startDate] - Encounter start date
 * @returns {Object} FHIR Encounter resource
 */
export function createEncounter({ patientId, status, class: encounterClass = 'AMB', reasonCode, reasonDisplay, startDate }) {
  const encounter = {
    resourceType: 'Encounter',
    status,
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: encounterClass,
      display: encounterClass === 'AMB' ? 'ambulatory' : encounterClass,
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    period: {
      start: startDate || new Date().toISOString(),
    },
  };

  if (reasonCode && reasonDisplay) {
    encounter.reasonCode = [
      {
        coding: [
          {
            code: reasonCode,
            display: reasonDisplay,
          },
        ],
        text: reasonDisplay,
      },
    ];
  }

  return encounter;
}

/**
 * Validates ICD-10 code format (basic pattern check)
 * @param {string} code
 * @returns {boolean}
 */
export function validateICD10Code(code) {
  if (!code) return false;
  // ICD-10: Letter followed by 2 digits, optional decimal and more digits (e.g., A00, J45.9)
  return /^[A-Z]\d{2}(\.\d{1,4})?$/.test(String(code).toUpperCase());
}

/**
 * Validates LOINC code format (basic pattern check)
 * @param {string} code
 * @returns {boolean}
 */
export function validateLOINCCode(code) {
  if (!code) return false;
  // LOINC: numeric code with optional dash (e.g., 8867-4)
  return /^\d{1,5}-\d{1,2}$/.test(String(code));
}

/**
 * Validates SNOMED CT code format (basic pattern check)
 * @param {string} code
 * @returns {boolean}
 */
export function validateSNOMEDCode(code) {
  if (!code) return false;
  // SNOMED: 6-18 digit number
  return /^\d{6,18}$/.test(String(code));
}

/**
 * Validates RxNorm code format (basic pattern check)
 * @param {string} code
 * @returns {boolean}
 */
export function validateRxNormCode(code) {
  if (!code) return false;
  // RxNorm: numeric code
  return /^\d{1,10}$/.test(String(code));
}

/**
 * Creates a FHIR Transaction Bundle for atomic submission
 * @param {Array<Object>} resources - Array of FHIR resources to include
 * @returns {Object} FHIR Bundle with type 'transaction'
 */
export function createTransactionBundle(resources) {
  return {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: resources.map((resource) => ({
      resource,
      request: {
        method: 'POST',
        url: resource.resourceType,
      },
    })),
  };
}

/**
 * Common LOINC codes for vital signs
 */
export const VITAL_LOINC_CODES = {
  HEART_RATE: '8867-4',
  BLOOD_PRESSURE: '85354-9',
  SYSTOLIC_BP: '8480-6',
  DIASTOLIC_BP: '8462-4',
  OXYGEN_SAT: '59408-5',
  RESPIRATORY_RATE: '9279-1',
  BODY_TEMP: '8310-5',
  BODY_HEIGHT: '8302-2',
  BODY_WEIGHT: '29463-7',
};

/**
 * Extract patient name from FHIR HumanName array
 * @param {Array} names - FHIR HumanName array
 * @returns {string}
 */
export function extractPatientName(names) {
  if (!Array.isArray(names) || names.length === 0) return 'Unknown';
  const name = names[0];
  if (name.text) return name.text;
  const given = Array.isArray(name.given) ? name.given.join(' ') : '';
  const family = name.family || '';
  return [given, family].filter(Boolean).join(' ').trim() || 'Unknown';
}
