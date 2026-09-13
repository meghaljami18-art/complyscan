export const LEGAL_VERSION = 'LMPC_2026_08_26';

export const RULES = [
  {
    id: 'LMPC-MVP-001',
    title: 'MRP / Retail Sale Price',
    source: 'Rule 6 + applicable sticker provisions',
    mode: 'IMAGE_ONLY / IMAGE_ASSISTED',
    purpose: 'Verify required MRP presence and readable form.'
  },
  {
    id: 'LMPC-MVP-002',
    title: 'Net Quantity + Unit',
    source: 'Rules 11–13 + Fourth Schedule where applicable',
    mode: 'IMAGE_ONLY / IMAGE_ASSISTED',
    purpose: 'Verify declared quantity and unit/basis; not physical accuracy.'
  },
  {
    id: 'LMPC-MVP-003',
    title: 'Manufacturer / Packer / Importer',
    source: 'Rule 6 + Rule 10',
    mode: 'IMAGE_ONLY / IMAGE_ASSISTED / EXTERNAL_DATA',
    purpose: 'Verify responsible entity identity and readable address.'
  },
  {
    id: 'LMPC-MVP-004',
    title: 'Applicable Date Declaration',
    source: 'Rule 6 + commodity applicability',
    mode: 'IMAGE_ONLY / IMAGE_ASSISTED',
    purpose: 'Verify the selected date only when context establishes it is required.'
  },
  {
    id: 'LMPC-MVP-005',
    title: 'Placement / Legibility',
    source: 'Rules 7–9; MDR route where applicable',
    mode: 'IMAGE_ASSISTED',
    purpose: 'Screen selected observable readability predicates; exact font height is not claimed.'
  }
];

const statusMap = {
  PASS: { legal: 'COMPLIANT', label: 'Passed' },
  FAIL: { legal: 'NON_COMPLIANT', label: 'Non-compliant' },
  REVIEW: { legal: 'REVIEW', label: 'Needs review' },
  NOT_APPLICABLE: { legal: 'NOT_APPLICABLE', label: 'Not applicable' },
  FUTURE: { legal: 'FUTURE', label: 'Future rule' }
};

const array = (value) => Array.isArray(value) ? value : [];
const field = (extraction, key) => array(extraction?.fields?.[key]);
const text = (value) => String(value ?? '').trim();
const uniqueValues = (candidates) => [...new Set(candidates.map((x) => text(x.value).toLowerCase()).filter(Boolean))];
const best = (candidates) => [...candidates].sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0] || null;
const panelVisible = (extraction) => extraction?.coverage?.mandatory_declaration_panel_visible === 'YES';
const enough = (candidate, threshold = 0.65) => !!candidate && text(candidate.value) && Number(candidate.confidence || 0) >= threshold;

function result(ruleId, status, explanation, evidence = [], nextAction = '') {
  const rule = RULES.find((item) => item.id === ruleId);
  const mapped = statusMap[status];
  return {
    ruleId,
    title: rule.title,
    source: rule.source,
    mode: rule.mode,
    status,
    uiLabel: mapped.label,
    legalOutput: mapped.legal,
    explanation,
    evidence: evidence.filter(Boolean),
    nextAction
  };
}

function evidenceOf(candidate, imageNames = []) {
  if (!candidate) return null;
  const imageIndex = Number(candidate.image_index || 0);
  return {
    excerpt: text(candidate.evidence || candidate.value),
    value: text(candidate.value),
    confidence: Number(candidate.confidence || 0),
    imageIndex,
    imageName: imageNames[imageIndex] || `Image ${imageIndex + 1}`,
    method: candidate.method || 'AI_VISION'
  };
}

function evaluateMrp(extraction, context, imageNames) {
  const candidates = field(extraction, 'mrp');
  const distinct = uniqueValues(candidates);
  const evidences = candidates.map((item) => evidenceOf(item, imageNames));
  if (context.packageContext === 'EXPORT') {
    return result('LMPC-MVP-001', 'NOT_APPLICABLE', 'Export context selected; the prototype does not apply the retail MRP predicate.', evidences);
  }
  if (context.medicalDevice === 'TRUE') {
    return result('LMPC-MVP-001', 'REVIEW', 'Medical-device routing can change the applicable declaration regime.', evidences, 'Route to a reviewer with the applicable MDR evidence.');
  }
  if (distinct.length > 1) {
    return result('LMPC-MVP-001', 'REVIEW', 'Multiple distinct MRP candidates were extracted; the engine will not choose one automatically.', evidences, 'Confirm the operative MRP and any sticker scenario.');
  }
  const candidate = best(candidates);
  if (enough(candidate)) {
    return result('LMPC-MVP-001', 'PASS', `A readable MRP candidate was found: ${candidate.value}.`, evidences, 'Human reviewer should confirm the evidence before finalization.');
  }
  if (panelVisible(extraction)) {
    return result('LMPC-MVP-001', 'FAIL', 'The declaration panel appears visible, but no readable MRP was extracted.', evidences, 'Confirm absence on the original image or request another view.');
  }
  return result('LMPC-MVP-001', 'REVIEW', 'The available images do not reliably show the mandatory-declaration panel.', evidences, 'Capture the back/side panel containing statutory declarations.');
}

function evaluateQuantity(extraction, context, imageNames) {
  const candidates = field(extraction, 'net_quantity');
  const candidate = best(candidates);
  const evidence = [evidenceOf(candidate, imageNames)];
  if (context.packageContext === 'EXPORT') {
    return result('LMPC-MVP-002', 'NOT_APPLICABLE', 'Export context selected for this prototype route.', evidence);
  }
  if (enough(candidate)) {
    const hasUnit = /(?:\d|one|two)\s*(?:kg|g|gm|mg|l|ml|cl|m|cm|mm|sq\.?\s*(?:m|cm)|units?|pieces?|pcs?|nos?\.?|n)\b/i.test(text(candidate.value));
    if (hasUnit) {
      return result('LMPC-MVP-002', 'PASS', `A quantity with unit was found: ${candidate.value}. Physical quantity accuracy is not assessed from the image.`, evidence);
    }
    return result('LMPC-MVP-002', 'REVIEW', `A quantity candidate was found (${candidate.value}), but its permitted unit/basis is ambiguous.`, evidence, 'Confirm the unit and commodity-specific Schedule route.');
  }
  if (panelVisible(extraction)) {
    return result('LMPC-MVP-002', 'FAIL', 'The declaration panel appears visible, but no readable net quantity with unit was extracted.', evidence, 'Confirm on the original label; physical measurement remains a separate inspection.');
  }
  return result('LMPC-MVP-002', 'REVIEW', 'Image coverage is insufficient to determine whether the quantity declaration is present.', evidence, 'Capture the declaration panel.');
}

function evaluateIdentity(extraction, context, imageNames) {
  const entity = best(field(extraction, 'responsible_entity'));
  const address = best(field(extraction, 'address'));
  const evidence = [evidenceOf(entity, imageNames), evidenceOf(address, imageNames)];
  if (context.medicalDevice === 'TRUE') {
    return result('LMPC-MVP-003', 'REVIEW', 'Medical-device status requires a priority route before applying the general identity predicate.', evidence, 'Confirm the MDR declaration route.');
  }
  if (enough(entity) && enough(address)) {
    const role = text(entity.qualifier);
    return result('LMPC-MVP-003', 'PASS', `A responsible entity${role ? ` (${role})` : ''} and address were extracted.`, evidence, 'Confirm the declared legal role; brand ownership is not inferred.');
  }
  if (panelVisible(extraction)) {
    return result('LMPC-MVP-003', 'FAIL', `The declaration panel appears visible, but the ${!enough(entity) ? 'responsible entity' : 'complete address'} was not reliably extracted.`, evidence, 'Review the original label and any applicable exception.');
  }
  return result('LMPC-MVP-003', 'REVIEW', 'The available views do not establish the responsible entity and complete address.', evidence, 'Capture the manufacturer/packer/importer panel.');
}

function evaluateDate(extraction, context, imageNames) {
  const candidate = best(field(extraction, 'date'));
  const evidence = [evidenceOf(candidate, imageNames)];
  if (context.dateRequired === 'FALSE') {
    return result('LMPC-MVP-004', 'NOT_APPLICABLE', 'The user-selected commodity/context route does not require this date predicate.', evidence);
  }
  if (context.dateRequired !== 'TRUE') {
    return result('LMPC-MVP-004', 'REVIEW', 'Date applicability is unresolved for the selected commodity/context.', evidence, 'Confirm the commodity-specific or special-law route.');
  }
  if (enough(candidate)) {
    return result('LMPC-MVP-004', 'PASS', `An applicable date declaration was found: ${candidate.value}${candidate.qualifier ? ` (${candidate.qualifier})` : ''}.`, evidence);
  }
  if (panelVisible(extraction)) {
    return result('LMPC-MVP-004', 'FAIL', 'The selected context requires a date declaration, but none was reliably extracted from the visible panel.', evidence, 'Confirm the requirement and inspect the original label.');
  }
  return result('LMPC-MVP-004', 'REVIEW', 'The relevant date panel is not sufficiently visible.', evidence, 'Capture the batch/date panel.');
}

function evaluateVisual(extraction, context, imageNames, qualitySummary) {
  const visual = extraction?.visual || {};
  const imageEvidence = [{
    excerpt: array(visual.notes).join(' ') || `Legibility: ${visual.overall_legibility || 'UNCERTAIN'}`,
    value: visual.overall_legibility || 'UNCERTAIN',
    confidence: null,
    imageName: imageNames.join(', ') || 'Uploaded images',
    method: 'AI_VISION + CANVAS_QUALITY_GATE'
  }];
  if (context.medicalDevice === 'TRUE') {
    return result('LMPC-MVP-005', 'REVIEW', 'Medical-device status is explicitly true, so the MDR visual route must be checked.', imageEvidence, 'Confirm device status and route to the applicable visual requirements.');
  }
  if (qualitySummary === 'POOR') {
    return result('LMPC-MVP-005', 'REVIEW', 'The client-side quality gate found insufficient image quality for a reliable visual predicate.', imageEvidence, 'Retake the image in better light and focus.');
  }
  if (visual.overall_legibility === 'CLEAR' && visual.contrast === 'ADEQUATE' && visual.principal_display_panel_visible !== 'NO') {
    return result('LMPC-MVP-005', 'PASS', 'The selected observable legibility and contrast predicate is supported. Exact legal font height is not claimed from an uncalibrated photograph.', imageEvidence);
  }
  if (visual.overall_legibility === 'POOR' && panelVisible(extraction) && qualitySummary === 'GOOD') {
    return result('LMPC-MVP-005', 'FAIL', 'The image is usable, but declaration text appears poorly legible.', imageEvidence, 'Reviewer should inspect the original package and calibrated measurements if required.');
  }
  return result('LMPC-MVP-005', 'REVIEW', 'Legibility, contrast, placement, or panel geometry is uncertain. Exact font size cannot be confirmed from this image.', imageEvidence, 'Request a front-on, high-resolution image with scale reference if dimensions matter.');
}

export function evaluateCompliance(extraction, context = {}, imageNames = [], qualitySummary = 'GOOD') {
  const normalizedContext = {
    packageContext: context.packageContext || 'RETAIL',
    medicalDevice: context.medicalDevice || extraction?.product?.medical_device || 'UNKNOWN',
    dateRequired: context.dateRequired || 'UNKNOWN',
    commodityType: context.commodityType || extraction?.product?.commodity_type || 'UNKNOWN'
  };
  const results = [
    evaluateMrp(extraction, normalizedContext, imageNames),
    evaluateQuantity(extraction, normalizedContext, imageNames),
    evaluateIdentity(extraction, normalizedContext, imageNames),
    evaluateDate(extraction, normalizedContext, imageNames),
    evaluateVisual(extraction, normalizedContext, imageNames, qualitySummary)
  ];
  // Conservative precedence: FAIL > REVIEW > FUTURE > PASS > NOT_APPLICABLE.
  let overallStatus = 'NOT_APPLICABLE';
  if (results.some((item) => item.status === 'FAIL')) overallStatus = 'FAIL';
  else if (results.some((item) => item.status === 'REVIEW')) overallStatus = 'REVIEW';
  else if (results.some((item) => item.status === 'FUTURE')) overallStatus = 'FUTURE';
  else if (results.some((item) => item.status === 'PASS')) overallStatus = 'PASS';
  const counts = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  return {
    legalVersion: LEGAL_VERSION,
    overallStatus,
    overallLabel: statusMap[overallStatus].label,
    results,
    counts,
    context: normalizedContext,
    guardrails: [
      'Automated output is screening support, not a final legal or enforcement determination.',
      'Physical quantity accuracy is not inferred from a photograph.',
      'Exact legal font height is not claimed without calibrated measurement.',
      'Low-confidence or applicability-ambiguous inputs route to human review.'
    ]
  };
}

export function createBlankExtraction() {
  return {
    product: { name: null, brand: null, commodity_type: null, medical_device: 'UNKNOWN' },
    coverage: { package_sides_visible: [], mandatory_declaration_panel_visible: 'UNCERTAIN', coverage_notes: ['Manual review record; no AI extraction was run.'] },
    fields: { mrp: [], net_quantity: [], responsible_entity: [], address: [], date: [], consumer_care: [] },
    visual: { overall_legibility: 'UNCERTAIN', contrast: 'UNCERTAIN', principal_display_panel_visible: 'UNCERTAIN', exact_font_size_verifiable: false, notes: [] },
    raw_text_by_image: []
  };
}
