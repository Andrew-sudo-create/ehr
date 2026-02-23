/**
 * FHIR Service - Handles all FHIR server interactions
 */

/**
 * Creates a new patient in the FHIR server
 * @param {string} fhirServerUrl - Base URL of the FHIR server
 * @param {Object} patientData - Patient data (firstName, lastName, gender, birthDate)
 * @returns {Promise<Object>} Created patient resource
 */
export async function createPatient(fhirServerUrl, patientData) {
  const { firstName, lastName, gender, birthDate } = patientData;

  // Build FHIR Patient resource
  const fhirPatient = {
    resourceType: 'Patient',
    name: [
      {
        use: 'official',
        family: lastName,
        given: [firstName],
      },
    ],
    gender: gender || 'unknown',
    birthDate: birthDate || undefined,
  };

  try {
    const response = await fetch(`${fhirServerUrl}/Patient`, {
      method: 'POST',
      headers: {
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
      },
      body: JSON.stringify(fhirPatient),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const createdPatient = await response.json();
    
    // Return simplified patient object
    return {
      id: createdPatient.id || '',
      name: `${firstName} ${lastName}`,
      gender: createdPatient.gender || 'unknown',
    };
  } catch (error) {
    console.error('Error creating patient in FHIR server:', error);
    throw error;
  }
}

/**
 * Maps a FHIR Patient resource to simplified list format
 */
function mapPatientResource(resource) {
  const id = resource.id || '';
  let name = 'Unknown';
  if (resource.name && resource.name.length > 0) {
    const nameObj = resource.name[0];
    if (nameObj.text) {
      name = nameObj.text;
    } else if (nameObj.given || nameObj.family) {
      const given = nameObj.given?.join(' ') || '';
      const family = nameObj.family || '';
      name = [given, family].filter(Boolean).join(' ').trim() || 'Unknown';
    }
  }
  const gender = resource.gender || 'unknown';
  const phoneTelecom = (resource.telecom || []).find((t) => t.system === 'phone');
  const emailTelecom = (resource.telecom || []).find((t) => t.system === 'email');
  return {
    id,
    name,
    gender,
    phone: phoneTelecom?.value || null,
    email: emailTelecom?.value || null,
  };
}

/**
 * Fetches all patients from the FHIR server (handles pagination).
 * Uses _count and follows bundle "next" links so more than the default 20 are returned.
 * @param {string} fhirServerUrl - Base URL of the FHIR server
 * @returns {Promise<Array>} Array of patients with ID, name, gender, and contact
 */
export async function getPatients(fhirServerUrl) {
  const headers = {
    Accept: 'application/fhir+json',
    'Content-Type': 'application/fhir+json',
  };
  const pageSize = 100;
  let allPatients = [];
  let nextUrl = `${fhirServerUrl}/Patient?_count=${pageSize}`;

  try {
    while (nextUrl) {
      const response = await fetch(nextUrl, { method: 'GET', headers });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const bundle = await response.json();
      const entries = bundle.entry || [];
      const patients = entries
        .filter((entry) => entry.resource)
        .map((entry) => mapPatientResource(entry.resource));
      allPatients = allPatients.concat(patients);

      const nextLink = bundle.link?.find((l) => l.relation === 'next');
      nextUrl = nextLink?.url ? nextLink.url : null;
    }

    return allPatients;
  } catch (error) {
    console.error('Error fetching patients from FHIR server:', error);
    throw error;
  }
}

/**
 * Fetches summary for one patient: primary condition and most recent encounter
 * @param {string} fhirServerUrl - Base URL of the FHIR server
 * @param {string} patientId - Patient resource ID
 * @returns {Promise<{ condition: string | null, lastVisit: string | null }>}
 */
export async function getPatientSummary(fhirServerUrl, patientId) {
  const result = { condition: null, lastVisit: null };
  try {
    const [condRes, encRes] = await Promise.all([
      fetch(
        `${fhirServerUrl}/Condition?patient=${encodeURIComponent(patientId)}&_count=1&_sort=-recorded-date`,
        { method: 'GET', headers: { Accept: 'application/fhir+json' } }
      ),
      fetch(
        `${fhirServerUrl}/Encounter?patient=${encodeURIComponent(patientId)}&_count=1&_sort=-date`,
        { method: 'GET', headers: { Accept: 'application/fhir+json' } }
      ),
    ]);
    if (condRes.ok) {
      const condBundle = await condRes.json();
      const cond = condBundle.entry?.[0]?.resource;
      if (cond?.code?.text) result.condition = cond.code.text;
      else if (cond?.code?.coding?.[0]?.display) result.condition = cond.code.coding[0].display;
    }
    if (encRes.ok) {
      const encBundle = await encRes.json();
      const enc = encBundle.entry?.[0]?.resource;
      if (enc) {
        const date = enc.period?.start || enc.period?.end || enc.meta?.lastUpdated || '';
        const reason = enc.reasonCode?.[0]?.text || enc.reasonCode?.[0]?.coding?.[0]?.display || enc.type?.[0]?.text || 'Visit';
        const dateStr = date ? new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
        result.lastVisit = dateStr ? `${dateStr} — ${reason}` : reason;
      }
    }
  } catch (err) {
    console.warn('getPatientSummary failed for', patientId, err.message);
  }
  return result;
}

/**
 * Deletes a patient from the FHIR server
 * @param {string} fhirServerUrl - Base URL of the FHIR server
 * @param {string} patientId - Patient resource ID
 * @returns {Promise<void>}
 */
export async function deletePatient(fhirServerUrl, patientId) {
  if (!patientId) {
    throw new Error('Patient ID is required to delete a patient');
  }

  try {
    const response = await fetch(`${fhirServerUrl}/Patient/${patientId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/fhir+json',
      },
    });

    if (!response.ok && response.status !== 404) {
      // Some FHIR servers return 204 on success; 404 means already gone
      const errorText = await response.text();
      throw new Error(`Failed to delete patient ${patientId}: ${response.status} ${errorText}`);
    }
  } catch (error) {
    console.error('Error deleting patient from FHIR server:', error);
    throw error;
  }
}

/**
 * Fetches detailed patient information including visits, notes, and labs
 * @param {string} fhirServerUrl - Base URL of the FHIR server
 * @param {string} patientId - Patient resource ID
 * @returns {Promise<Object>} Patient details with timeline grouped by date
 */
export async function getPatientDetails(fhirServerUrl, patientId) {
  if (!patientId) {
    throw new Error('Patient ID is required to fetch details');
  }

  try {
    // Fetch core Patient resource
    const patientRes = await fetch(`${fhirServerUrl}/Patient/${patientId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/fhir+json',
      },
    });

    if (!patientRes.ok) {
      const errorText = await patientRes.text();
      throw new Error(`Failed to fetch patient: ${patientRes.status} ${errorText}`);
    }

    const patient = await patientRes.json();

    // Helper to safely extract a display name
    const getPatientName = (p) => {
      if (p.name && p.name.length > 0) {
        const n = p.name[0];
        if (n.text) return n.text;
        const given = n.given?.join(' ') || '';
        const family = n.family || '';
        return [given, family].filter(Boolean).join(' ').trim() || 'Unknown';
      }
      return 'Unknown';
    };

    const corePatient = {
      id: patient.id || patientId,
      name: getPatientName(patient),
      gender: patient.gender || 'unknown',
      birthDate: patient.birthDate || null,
      phone:
        patient.telecom?.find((t) => t.system === 'phone')?.value ||
        null,
      email:
        patient.telecom?.find((t) => t.system === 'email')?.value ||
        null,
      address: {
        line: patient.address?.[0]?.line?.join(' ') || '',
        city: patient.address?.[0]?.city || '',
        state: patient.address?.[0]?.state || '',
        postalCode: patient.address?.[0]?.postalCode || '',
        country: patient.address?.[0]?.country || '',
      },
      medicalAid:
        patient.identifier?.[0]?.value || null,
    };

    // Fetch Encounters (visits)
    const encounterRes = await fetch(
      `${fhirServerUrl}/Encounter?patient=${encodeURIComponent(patientId)}&_sort=-date`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/fhir+json',
        },
      }
    );

    const encountersBundle = encounterRes.ok ? await encounterRes.json() : { entry: [] };

    const visits = (encountersBundle.entry || [])
      .filter((e) => e.resource)
      .map((e) => {
        const enc = e.resource;
        const date =
          enc.period?.start ||
          enc.period?.end ||
          enc.meta?.lastUpdated ||
          enc['date'] ||
          null;

        const reason =
          enc.reasonCode?.[0]?.text ||
          enc.reasonCode?.[0]?.coding?.[0]?.display ||
          enc.type?.[0]?.text ||
          'Visit';

        const typeCoding = enc.type?.[0]?.coding?.[0];
        const cptCode = typeCoding?.system?.includes('cpt') || typeCoding?.system?.includes('ama-assn')
          ? typeCoding.code
          : null;

        const notes = (enc.note || [])
          .map((n) => n.text)
          .filter(Boolean);

        return {
          id: enc.id,
          date,
          status: enc.status || 'unknown',
          reason,
          notes,
          cptCode: cptCode || null,
        };
      });

    // Fetch Observations (labs, vitals, etc.)
    const obsRes = await fetch(
      `${fhirServerUrl}/Observation?patient=${encodeURIComponent(patientId)}&_sort=-date`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/fhir+json',
        },
      }
    );

    const obsBundle = obsRes.ok ? await obsRes.json() : { entry: [] };

    const allObservations = (obsBundle.entry || []).filter((e) => e.resource);

    const isVitalObservation = (obs) => {
      // Vital signs typically have category 'vital-signs' or use standard LOINC vital codes
      const hasVitalCategory = (obs.category || []).some((cat) =>
        (cat.coding || []).some(
          (c) =>
            c.code === 'vital-signs' ||
            c.display?.toLowerCase().includes('vital') ||
            c.text?.toLowerCase().includes('vital')
        )
      );

      if (hasVitalCategory) return true;

      const vitalLoincCodes = new Set([
        '8867-4', // Heart rate
        '85354-9', // Blood pressure panel
        '8480-6', // Systolic BP
        '8462-4', // Diastolic BP
        '59408-5', // Oxygen saturation in Arterial blood by Pulse ox
        '9279-1', // Respiratory rate
        '8310-5', // Body temperature
        '8302-2', // Body height
        '29463-7', // Body weight
      ]);

      return (obs.code?.coding || []).some(
        (c) =>
          c.system === 'http://loinc.org' &&
          c.code &&
          vitalLoincCodes.has(String(c.code))
      );
    };

    const vitals = allObservations
      .filter((e) => isVitalObservation(e.resource))
      .map((e) => {
        const obs = e.resource;
        const date =
          obs.effectiveDateTime ||
          obs.issued ||
          obs.meta?.lastUpdated ||
          null;

        const primaryCoding = (obs.code?.coding || [])[0] || {};

        let value = null;
        if (obs.valueQuantity) {
          value = `${obs.valueQuantity.value ?? ''} ${obs.valueQuantity.unit ?? ''}`.trim();
        } else if (obs.valueString) {
          value = obs.valueString;
        } else if (obs.valueCodeableConcept) {
          value =
            obs.valueCodeableConcept.text ||
            obs.valueCodeableConcept.coding?.[0]?.display ||
            null;
        }

        return {
          id: obs.id,
          date,
          type:
            obs.code?.text ||
            primaryCoding.display ||
            'Vital sign',
          value,
          code: primaryCoding.code || null,
          system: primaryCoding.system || null,
        };
      });

    const labs = allObservations
      .filter((e) => !isVitalObservation(e.resource))
      .map((e) => {
        const obs = e.resource;
        const date =
          obs.effectiveDateTime ||
          obs.issued ||
          obs.meta?.lastUpdated ||
          null;

        const codeText =
          obs.code?.text ||
          obs.code?.coding?.[0]?.display ||
          'Lab / Observation';

        let value = null;
        if (obs.valueQuantity) {
          value = `${obs.valueQuantity.value ?? ''} ${obs.valueQuantity.unit ?? ''}`.trim();
        } else if (obs.valueString) {
          value = obs.valueString;
        } else if (obs.valueCodeableConcept) {
          value =
            obs.valueCodeableConcept.text ||
            obs.valueCodeableConcept.coding?.[0]?.display ||
            null;
        }

        const interpretation =
          obs.interpretation?.[0]?.text ||
          obs.interpretation?.[0]?.coding?.[0]?.display ||
          null;

        return {
          id: obs.id,
          date,
          type: codeText,
          result: value,
          interpretation,
        };
      });

    // Fetch Conditions (diagnoses/problems)
    const conditionRes = await fetch(
      `${fhirServerUrl}/Condition?patient=${encodeURIComponent(patientId)}&_sort=-onset-date`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/fhir+json',
        },
      }
    );

    const conditionBundle = conditionRes.ok ? await conditionRes.json() : { entry: [] };

    const conditions = (conditionBundle.entry || [])
      .filter((e) => e.resource)
      .map((e) => {
        const cond = e.resource;
        const codeCoding = (cond.code?.coding || [])[0] || {};
        const description =
          cond.code?.text ||
          codeCoding.display ||
          'Condition';

        const onset =
          cond.onsetDateTime ||
          cond.onsetPeriod?.start ||
          cond.recordedDate ||
          cond.meta?.lastUpdated ||
          null;

        return {
          id: cond.id,
          code: codeCoding.code || null,
          system: codeCoding.system || null,
          description,
          clinicalStatus:
            cond.clinicalStatus?.text ||
            cond.clinicalStatus?.coding?.[0]?.display ||
            null,
          verificationStatus:
            cond.verificationStatus?.text ||
            cond.verificationStatus?.coding?.[0]?.display ||
            null,
          onsetDate: onset,
        };
      });

    // Fetch MedicationRequests (medication management)
    const medRes = await fetch(
      `${fhirServerUrl}/MedicationRequest?patient=${encodeURIComponent(patientId)}&_sort=-authoredon`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/fhir+json',
        },
      }
    );

    const medBundle = medRes.ok ? await medRes.json() : { entry: [] };

    const medications = (medBundle.entry || [])
      .filter((e) => e.resource)
      .map((e) => {
        const mr = e.resource;
        const medCoding = (mr.medicationCodeableConcept?.coding || [])[0] || {};

        const medication =
          mr.medicationCodeableConcept?.text ||
          medCoding.display ||
          'Medication';

        const authoredOn = mr.authoredOn || mr.meta?.lastUpdated || null;

        return {
          id: mr.id,
          medication,
          code: medCoding.code || null,
          system: medCoding.system || null,
          intent: mr.intent || null,
          status: mr.status || null,
          authoredOn,
        };
      });

    // Build a simple date-ordered timeline combining visits and labs
    const events = [
      ...visits.map((v) => ({
        kind: 'visit',
        date: v.date,
        data: v,
      })),
      ...labs.map((l) => ({
        kind: 'lab',
        date: l.date,
        data: l,
      })),
    ]
      .filter((e) => e.date)
      .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

    return {
      patient: corePatient,
      visits,
      labs,
      vitals,
      conditions,
      medications,
      events,
    };
  } catch (error) {
    console.error('Error fetching detailed patient info from FHIR server:', error);
    throw error;
  }
}

/**
 * Updates a patient resource with provided demographic/contact info
 * @param {string} fhirServerUrl
 * @param {string} patientId
 * @param {Object} updates
 */
export async function updatePatientResource(fhirServerUrl, patientId, updates) {
  if (!patientId) {
    throw new Error('Patient ID is required to update a patient');
  }

  try {
    // Fetch current patient
    const currentRes = await fetch(`${fhirServerUrl}/Patient/${patientId}`, {
      method: 'GET',
      headers: { Accept: 'application/fhir+json' },
    });
    if (!currentRes.ok) {
      const txt = await currentRes.text();
      throw new Error(`Failed to load patient: ${txt}`);
    }
    const patient = await currentRes.json();

    // Apply updates
    if (updates.firstName || updates.lastName) {
      patient.name = [
        {
          use: 'official',
          family: updates.lastName ?? patient.name?.[0]?.family ?? '',
          given: [updates.firstName ?? patient.name?.[0]?.given?.[0] ?? ''].filter(Boolean),
        },
      ];
    }

    if (updates.gender) {
      patient.gender = updates.gender;
    }
    if (updates.birthDate) {
      patient.birthDate = updates.birthDate;
    }

    // Telecom
    patient.telecom = patient.telecom || [];
    const setTelecom = (system, value) => {
      if (!value) return;
      const existing = patient.telecom.find((t) => t.system === system);
      if (existing) {
        existing.value = value;
      } else {
        patient.telecom.push({ system, value });
      }
    };
    if (updates.phone) setTelecom('phone', updates.phone);
    if (updates.email) setTelecom('email', updates.email);

    // Address
    if (updates.address) {
      patient.address = [
        {
          line: updates.address.line ? [updates.address.line] : [],
          city: updates.address.city || '',
          state: updates.address.state || '',
          postalCode: updates.address.postalCode || '',
          country: updates.address.country || '',
        },
      ];
    }

    // Medical aid stored in identifier[0]
    if (updates.medicalAid) {
      patient.identifier = patient.identifier || [];
      if (patient.identifier.length === 0) {
        patient.identifier.push({
          system: 'http://example.org/medical-aid',
          value: updates.medicalAid,
        });
      } else {
        patient.identifier[0].value = updates.medicalAid;
      }
    }

    const updateRes = await fetch(`${fhirServerUrl}/Patient/${patientId}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
      },
      body: JSON.stringify(patient),
    });

    if (!updateRes.ok) {
      const txt = await updateRes.text();
      throw new Error(`Failed to update patient: ${updateRes.status} ${txt}`);
    }

    return patientId;
  } catch (error) {
    console.error('Error updating patient in FHIR server:', error);
    throw error;
  }
}

/**
 * Fetches upcoming appointments from the FHIR server (today and future)
 * @param {string} fhirServerUrl - Base URL of the FHIR server
 * @returns {Promise<Array>} Simplified appointment list for dashboard/schedule
 */
export async function getUpcomingAppointments(fhirServerUrl) {
  try {
    const today = new Date();
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
      today.getDate()
    )}`;

    // Appointments on or after today, sort by date (FHIR search param)
    const response = await fetch(
      `${fhirServerUrl}/Appointment?date=ge${dateStr}&_sort=date`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/fhir+json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error fetching appointments! status: ${response.status}, message: ${errorText}`
      );
    }

    const bundle = await response.json();
    if (!bundle.entry || bundle.entry.length === 0) {
      return [];
    }

    const simplifyTime = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
    };

    const simplified = bundle.entry
      .filter((e) => e.resource)
      .map((e) => {
        const appt = e.resource;
        const id = appt.id || '';
        const start = appt.start || appt.meta?.lastUpdated || null;
        const end = appt.end || null;

        let durationMinutes = null;
        if (start && end) {
          const s = new Date(start);
          const en = new Date(end);
          if (!Number.isNaN(s.getTime()) && !Number.isNaN(en.getTime())) {
            durationMinutes = Math.round((en.getTime() - s.getTime()) / 60000);
          }
        }

        const typeText =
          appt.serviceType?.[0]?.text ||
          appt.serviceType?.[0]?.coding?.[0]?.display ||
          appt.type?.text ||
          appt.type?.coding?.[0]?.display ||
          'Appointment';

        // Find patient participant. Prefer explicit Patient/ reference, but fall back to any display.
        let patientName = 'Unknown patient';
        let patientInitials = 'PT';
        const participants = appt.participant || [];
        const patientParticipantByRef = participants.find((p) =>
          (p.actor?.reference || '').startsWith('Patient/')
        );
        const participantWithDisplay =
          patientParticipantByRef ||
          participants.find((p) => typeof p.actor?.display === 'string' && p.actor.display.length);

        if (participantWithDisplay?.actor?.display) {
          patientName = participantWithDisplay.actor.display;
          const initials = patientName
            .split(' ')
            .filter(Boolean)
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          if (initials) patientInitials = initials;
        }

        return {
          id,
          patientName,
          patientInitials,
          start,
          end,
          time: simplifyTime(start),
          durationMinutes,
          type: typeText,
          fhirStatus: appt.status || 'booked',
        };
      })
      .sort((a, b) => {
        if (!a.start || !b.start) return 0;
        return a.start < b.start ? -1 : 1;
      });

    return simplified;
  } catch (error) {
    console.error('Error fetching appointments from FHIR server:', error);
    throw error;
  }
}

/**
 * Creates a new appointment in the FHIR server
 * @param {string} fhirServerUrl
 * @param {Object} appointmentData - { patientName, date (YYYY-MM-DD), time (HH:MM), durationMinutes?, type? }
 * @returns {Promise<Object>} Simplified appointment summary
 */
export async function createAppointmentResource(fhirServerUrl, appointmentData) {
  const { patientName, date, time, durationMinutes = 30, type } = appointmentData;

  if (!patientName || !date || !time) {
    throw new Error('patientName, date, and time are required to create an appointment');
  }

  const start = new Date(`${date}T${time}:00`);
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid date or time for appointment');
  }
  const end = new Date(start.getTime() + durationMinutes * 60000);

  const fhirAppointment = {
    resourceType: 'Appointment',
    status: 'booked',
    start: start.toISOString(),
    end: end.toISOString(),
    serviceType: type
      ? [
          {
            text: type,
          },
        ]
      : undefined,
    participant: [
      {
        actor: {
          // We store display only; not linking to a specific Patient resource yet
          display: patientName,
        },
        status: 'accepted',
      },
    ],
  };

  try {
    const response = await fetch(`${fhirServerUrl}/Appointment`, {
      method: 'POST',
      headers: {
        Accept: 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
      },
      body: JSON.stringify(fhirAppointment),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error creating appointment! status: ${response.status}, message: ${errorText}`
      );
    }

    const created = await response.json();

    const simplifyTime = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
    };

    let patientInitials = 'PT';
    if (patientName) {
      const initials = patientName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
      if (initials) patientInitials = initials;
    }

    return {
      id: created.id || '',
      patientName,
      patientInitials,
      start: created.start || start.toISOString(),
      end: created.end || end.toISOString(),
      time: simplifyTime(created.start || start.toISOString()),
      durationMinutes,
      type: type || 'Appointment',
      fhirStatus: created.status || 'booked',
    };
  } catch (error) {
    console.error('Error creating appointment in FHIR server:', error);
    throw error;
  }
}

/**
 * Deletes an appointment from the FHIR server
 * @param {string} fhirServerUrl
 * @param {string} appointmentId
 * @returns {Promise<void>}
 */
export async function deleteAppointmentResource(fhirServerUrl, appointmentId) {
  if (!appointmentId) {
    throw new Error('Appointment ID is required to delete an appointment');
  }

  try {
    const response = await fetch(`${fhirServerUrl}/Appointment/${appointmentId}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/fhir+json',
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(
        `Failed to delete appointment ${appointmentId}: ${response.status} ${errorText}`
      );
    }
  } catch (error) {
    console.error('Error deleting appointment from FHIR server:', error);
    throw error;
  }
}

/**
 * Gets documents (notes) from the FHIR server
 * @param {string} fhirServerUrl - Base URL of the FHIR server
 * @returns {Promise<Array>} Array of document references
 */
export async function getDocuments(fhirServerUrl) {
  try {
    const response = await fetch(`${fhirServerUrl}/DocumentReference`, {
      method: 'GET',
      headers: {
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const bundle = await response.json();

    if (!bundle.entry || bundle.entry.length === 0) {
      return [];
    }

    return bundle.entry
      .filter(entry => entry.resource)
      .map(entry => {
        const resource = entry.resource;
        return {
          id: resource.id || '',
          created: resource.date || resource.meta?.lastUpdated || '',
          type: resource.type?.coding?.[0]?.display || resource.type?.text || 'Document',
          subject: resource.subject?.display || 'Unknown',
        };
      });
  } catch (error) {
    console.error('Error fetching documents from FHIR server:', error);
    return [];
  }
}
