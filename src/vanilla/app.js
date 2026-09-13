import { evaluateCompliance, RULES, LEGAL_VERSION } from './rule-engine.js';
import { DEMOS } from './demo-data.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const statusLabel = (status) => ({ PASS: 'Passed', FAIL: 'Non-compliant', REVIEW: 'Needs review', FUTURE: 'Future rule', NOT_APPLICABLE: 'Not applicable', NEEDS_REVIEW: 'Needs review', POTENTIAL_ISSUE: 'Potential issue' }[status] || status || 'Unknown');
const formatDate = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const makeId = () => `CS-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;

const API_BASE = '';

const state = {
  files: [],
  fileKeys: new Set(),
  previewSources: [],
  inspections: [],
  currentInspection: null,
  health: null,
  currentView: 'dashboard',
  user: null
};

const pageMeta = {
  dashboard: ['ENFORCEMENT WORKSPACE', 'Compliance overview'],
  scan: ['NEW INSPECTION', 'Capture package evidence'],
  review: ['EVIDENCE REVIEW', 'Inspection workspace'],
  history: ['LOCAL REPOSITORY', 'Inspection history'],
  rules: ['VERSIONED RULESET', 'MVP rule register'],
  admin: ['ADMINISTRATION', 'User & role management']
};

function toast(message, error = false) {
  const item = document.createElement('div');
  item.className = `toast${error ? ' is-error' : ''}`;
  item.textContent = message;
  $('#toastRegion').append(item);
  setTimeout(() => item.remove(), 4200);
}

function resetForNewInspection() {
  clearFiles();
  state.currentInspection = null;
  $('#reviewWorkspace').innerHTML = '';
  applyContext({ packageContext: 'RETAIL', commodityType: '', dateRequired: 'UNKNOWN', medicalDevice: 'UNKNOWN' });
  setWorkflowStep('capture');
}

function setView(view) {
  if (view === 'admin' && state.user?.role !== 'ADMIN') return toast('Admin access required.', true);
  const target = view === 'review' && !state.currentInspection ? 'scan' : view;
  if (target === 'scan' && state.currentView !== 'scan' && state.currentInspection) resetForNewInspection();
  state.currentView = target;
  $$('.view').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.viewPanel === target));
  $$('.nav-item').forEach((button) => button.classList.toggle('is-active', button.dataset.view === target || (target === 'review' && button.dataset.view === 'scan')));
  const meta = pageMeta[target] || pageMeta.dashboard;
  $('#pageEyebrow').textContent = meta[0];
  $('#pageTitle').textContent = meta[1];
  if (target === 'dashboard') renderDashboard();
  if (target === 'history') renderHistory();
  if (target === 'rules') renderRuleRegister();
  if (target === 'admin') renderUsers();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setWorkflowStep(step) {
  const order = ['capture', 'extract', 'check', 'review', 'report'];
  const index = order.indexOf(step);
  $$('[data-step-indicator]').forEach((item) => {
    const itemIndex = order.indexOf(item.dataset.stepIndicator);
    item.classList.toggle('is-current', itemIndex === index);
    item.classList.toggle('is-complete', itemIndex < index);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.code = data.code || 'REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  return data;
}

async function loadHealth() {
  try {
    state.health = await fetchJson('/api/health');
    $('#connectionStatus').innerHTML = `<i></i> Local service · ${state.health.geminiConfigured ? 'Vision ready' : 'demo ready'}`;
    $('#connectionStatus').classList.remove('is-offline');
    if (state.health.defaultModel) $('#modelName').value = state.health.defaultModel;
  } catch {
    $('#connectionStatus').innerHTML = '<i></i> Service offline';
    $('#connectionStatus').classList.add('is-offline');
  }
}

async function loadHistory() {
  try {
    const data = await fetchJson('/api/inspections');
    state.inspections = Array.isArray(data.inspections) ? data.inspections : [];
  } catch {
    state.inspections = JSON.parse(localStorage.getItem('complyscan-inspections') || '[]');
  }
  renderDashboard();
  renderHistory();
}

function renderDashboard() {
  const rows = state.inspections;
  const counts = rows.reduce((acc, row) => {
    const key = row.assessment?.overallStatus || 'NEEDS_REVIEW';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const metrics = [
    ['TOTAL INSPECTIONS', rows.length, 'Saved screening records', '#8ca2ff'],
    ['PASSED', counts.PASS || 0, 'All evaluated MVP checks passed', '#b8f35f'],
    ['NEEDS REVIEW', counts.REVIEW || counts.NEEDS_REVIEW || 0, 'Uncertain evidence or applicability', '#f8d775'],
    ['NON-COMPLIANT', counts.FAIL || counts.POTENTIAL_ISSUE || 0, 'One or more executable checks failed', '#ff806f']
  ];
  $('#metricGrid').innerHTML = metrics.map(([label, value, note, color]) => `<article class="metric" style="--accent:${color}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
  $('#recordCountTag').textContent = `${rows.length} record${rows.length === 1 ? '' : 's'}`;
  $('#recentInspections').innerHTML = inspectionTable(rows.slice(0, 5), true);
}

function inspectionTable(rows, compact = false) {
  if (!rows.length) return `<div class="empty-state"><strong>No inspections saved yet</strong>Run the complete dataset demo or scan a product to populate the repository.</div>`;
  return `<table><thead><tr><th>Product</th><th>Inspection</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody>${rows.map((row) => {
    const product = row.extraction?.product || {};
    const status = row.assessment?.overallStatus || 'REVIEW';
    return `<tr><td class="product-cell"><strong>${escapeHtml(product.name || 'Unknown product')}</strong><small>${escapeHtml(product.brand || product.commodity_type || 'Unclassified')}</small></td><td>${escapeHtml(row.id || '—')}</td><td><span class="tag tag-${status}">${statusLabel(status)}</span></td><td>${formatDate(row.savedAt || row.createdAt)}</td><td><button class="table-action" data-open-inspection="${escapeHtml(row.id)}">Open →</button></td></tr>`;
  }).join('')}</tbody></table>`;
}

function renderHistory() {
  if (!$('#historyTable')) return;
  const query = ($('#historySearch')?.value || '').toLowerCase();
  const filter = $('#historyFilter')?.value || 'ALL';
  const rows = state.inspections.filter((row) => {
    const haystack = `${row.id || ''} ${row.extraction?.product?.name || ''} ${row.extraction?.product?.brand || ''}`.toLowerCase();
    const status = row.assessment?.overallStatus || 'REVIEW';
    const normalizedFilter = filter === 'NEEDS_REVIEW' ? 'REVIEW' : filter === 'POTENTIAL_ISSUE' ? 'FAIL' : filter;
    return haystack.includes(query) && (normalizedFilter === 'ALL' || status === normalizedFilter);
  });
  $('#historyTable').innerHTML = inspectionTable(rows);
}

function renderRuleRegister() {
  $('#ruleRegister').innerHTML = RULES.map((rule, index) => `<article class="register-card"><header><span class="tag tag-neutral">${escapeHtml(rule.id)}</span><span class="step-number">0${index + 1}</span></header><h3>${escapeHtml(rule.title)}</h3><p>${escapeHtml(rule.purpose)}</p><dl><div><dt>Source</dt><dd>${escapeHtml(rule.source)}</dd></div><div><dt>Mode</dt><dd>${escapeHtml(rule.mode)}</dd></div><div><dt>Outputs</dt><dd>Passed · Potential issue · Needs review · Not applicable</dd></div><div><dt>Evidence</dt><dd>Image, exact excerpt, extracted value, confidence, method, rule source and review status</dd></div></dl></article>`).join('');
}

async function loadCurrentUser() {
  try {
    const data = await fetchJson('/api/me');
    state.user = data.user;
    return true;
  } catch {
    state.user = null;
    return false;
  }
}

function applyRoleUI() {
  if (!state.user) return;
  $('#userChip').textContent = `${state.user.name} · ${state.user.role}`;
  $$('.admin-only').forEach((el) => { el.hidden = state.user.role !== 'ADMIN'; });
  const reviewHint = state.user.role === 'INSPECTOR' ? 'Inspector: review and submit evidence; reviewer decisions require Reviewer/Admin.' : state.user.role === 'REVIEWER' ? 'Reviewer: review flagged inspections and record dispositions.' : 'Admin: full prototype access.';
  const note = $('.sidebar-foot p'); if (note) note.textContent = reviewHint;
}

async function login(email, password) {
  const data = await fetchJson('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  state.user = data.user;
  $('#authScreen').hidden = true;
  $('#appShell').hidden = false;
  applyRoleUI();
  await Promise.all([loadHealth(), loadHistory()]);
}

async function logout() {
  try { await fetchJson('/api/logout', { method: 'POST', body: '{}' }); } catch {}
  state.user = null;
  state.currentInspection = null;
  $('#appShell').hidden = true;
  $('#authScreen').hidden = false;
  $('#loginPassword').value = '';
}

async function renderUsers() {
  if (state.user?.role !== 'ADMIN' || !$('#userTable')) return;
  try {
    const data = await fetchJson('/api/users');
    $('#userTable').innerHTML = `<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Access</th></tr></thead><tbody>${data.users.map((u) => `<tr><td><strong>${escapeHtml(u.name)}</strong></td><td>${escapeHtml(u.email)}</td><td><select class="role-select" data-user-role="${escapeHtml(u.email)}" ${u.email === state.user.email ? 'disabled' : ''}><option value="INSPECTOR" ${u.role === 'INSPECTOR' ? 'selected' : ''}>INSPECTOR</option><option value="REVIEWER" ${u.role === 'REVIEWER' ? 'selected' : ''}>REVIEWER</option><option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option></select></td><td>${u.role === 'INSPECTOR' ? 'Create scans' : u.role === 'REVIEWER' ? 'Review + finalize' : 'Full administration'}</td></tr>`).join('')}</tbody></table>`;
  } catch (error) { toast(error.message, true); }
}

async function measureImage(file) {
  const bitmap = await createImageBitmap(file);
  const max = 420;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  let sum = 0, sumSq = 0, edge = 0, samples = 0;
  const lumas = new Float32Array(width * height);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const y = pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114;
    lumas[p] = y; sum += y; sumSq += y * y; samples++;
  }
  for (let y = 1; y < height; y += 2) for (let x = 1; x < width; x += 2) {
    const p = y * width + x;
    edge += Math.abs(lumas[p] - lumas[p - 1]) + Math.abs(lumas[p] - lumas[p - width]);
  }
  const mean = sum / samples;
  const contrast = Math.sqrt(Math.max(0, sumSq / samples - mean * mean));
  const detail = edge / Math.max(1, Math.floor((width - 1) / 2) * Math.floor((height - 1) / 2));
  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  const megapixels = originalWidth * originalHeight / 1_000_000;
  bitmap.close();
  let label = 'GOOD';
  const notes = [];
  if (mean < 38 || mean > 224) notes.push('lighting');
  if (contrast < 24) notes.push('low contrast');
  if (detail < 21) notes.push('possible blur');
  if (megapixels < .7) notes.push('low resolution');
  if (notes.length >= 2 || megapixels < .25) label = 'POOR';
  else if (notes.length === 1) label = 'FAIR';
  return { label, notes, width: originalWidth, height: originalHeight, megapixels };
}

async function handleFiles(fileList) {
  const incoming = [...fileList].filter((file) => file.type.startsWith('image/'));
  if (!incoming.length) return toast('Choose JPG, PNG or WebP product images.', true);
  const unique = [];
  for (const file of incoming) {
    const key = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
    if (state.fileKeys.has(key)) continue;
    state.fileKeys.add(key);
    unique.push({ file, key });
  }
  const remaining = Math.max(0, 6 - state.files.length);
  if (unique.length > remaining) toast(`Only the first ${remaining} additional image(s) were added.`);
  for (const entry of unique.slice(remaining)) state.fileKeys.delete(entry.key);
  for (const { file, key } of unique.slice(0, remaining)) {
    const url = URL.createObjectURL(file);
    let quality;
    try { quality = await measureImage(file); }
    catch { quality = { label: 'FAIR', notes: ['quality check unavailable'], megapixels: 0 }; }
    state.files.push({ file, key, url, quality });
  }
  state.previewSources = state.files.map((item) => item.url);
  renderImageQueue();
  updateAnalyzeState();
}

function clearFiles() {
  state.files.forEach((item) => URL.revokeObjectURL(item.url));
  state.files = [];
  state.fileKeys.clear();
  state.previewSources = [];
  $('#fileInput').value = '';
  renderImageQueue();
  updateAnalyzeState();
}

function renderImageQueue() {
  const root = $('#imageQueue');
  if (!state.files.length) { root.innerHTML = ''; return; }
  root.innerHTML = state.files.map((item, index) => `<article class="image-card"><img src="${item.url}" alt="Uploaded package view ${index + 1}"><span class="tag tag-${item.quality.label === 'GOOD' ? 'PASS' : item.quality.label === 'POOR' ? 'POTENTIAL_ISSUE' : 'NEEDS_REVIEW'} quality-badge">${item.quality.label}</span><button class="remove-image" data-remove-image="${index}" aria-label="Remove ${escapeHtml(item.file.name)}">×</button><footer><strong>${escapeHtml(item.file.name)}</strong><small>${item.quality.megapixels.toFixed(1)} MP${item.quality.notes.length ? ` · ${escapeHtml(item.quality.notes.join(', '))}` : ' · capture usable'}</small></footer></article>`).join('');
}

function updateAnalyzeState() {
  $('#analyzeBtn').disabled = state.files.length === 0;
}

async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const data = canvas.toDataURL('image/jpeg', .84).split(',')[1];
  return { name: file.name, mimeType: 'image/jpeg', data };
}

async function thumbnailFromFile(file) {
  const bitmap = await createImageBitmap(file);
  const max = 520;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', .7);
}

function getContext() {
  return {
    packageContext: $('#packageContext').value,
    commodityType: $('#commodityType').value.trim() || 'UNKNOWN',
    dateRequired: $('#dateRequired').value,
    medicalDevice: $('#medicalDevice').value
  };
}

function applyContext(context) {
  $('#packageContext').value = context.packageContext || 'RETAIL';
  $('#commodityType').value = context.commodityType || '';
  $('#dateRequired').value = context.dateRequired || 'UNKNOWN';
  $('#medicalDevice').value = context.medicalDevice || 'UNKNOWN';
}

function qualitySummary() {
  if (state.files.some((item) => item.quality.label === 'POOR')) return 'POOR';
  if (state.files.some((item) => item.quality.label === 'FAIR')) return 'FAIR';
  return 'GOOD';
}

function createInspection(extraction, context, source, model, previewSources, imageNames, quality) {
  const assessment = evaluateCompliance(extraction, context, imageNames, quality);
  return {
    id: makeId(),
    createdAt: new Date().toISOString(),
    source,
    model,
    legalVersion: LEGAL_VERSION,
    imageNames,
    imageCount: imageNames.length,
    quality,
    previewSources,
    extraction,
    assessment,
    reviewDecisions: {},
    reviewStatus: 'UNREVIEWED'
  };
}

async function analyzeCurrentFiles() {
  const apiKey = $('#apiKey').value.trim() || sessionStorage.getItem('complyscan-api-key') || '';
  if (apiKey) sessionStorage.setItem('complyscan-api-key', apiKey);
  if (!apiKey && !state.health?.geminiConfigured) {
    $('details.api-settings').open = true;
    $('#apiKey').focus();
    return toast('Add a Gemini API key, or load a dataset-backed demo.', true);
  }
  if (!state.files.length) return;
  setWorkflowStep('extract');
  const panel = $('#progressPanel');
  const messages = [
    ['Preparing package evidence', 'Compressing images locally; originals remain on this device.'],
    ['Reading visible declarations', 'Gemini Vision is extracting only evidence supported by the uploaded views.'],
    ['Applying deterministic checks', 'Running five versioned rules and routing uncertainty to review.']
  ];
  let messageIndex = 0;
  panel.hidden = false;
  const drawProgress = () => panel.innerHTML = `<div class="progress-inner"><span class="spinner"></span><div><h3>${messages[messageIndex][0]}</h3><p>${messages[messageIndex][1]}</p></div></div>`;
  drawProgress();
  const timer = setInterval(() => { messageIndex = Math.min(messages.length - 1, messageIndex + 1); drawProgress(); }, 2700);
  $('#analyzeBtn').disabled = true;
  try {
    const images = [];
    for (const item of state.files) images.push(await compressImage(item.file));
    const data = await fetchJson('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ images, apiKey, model: $('#modelName').value.trim() || 'gemini-2.5-flash' })
    });
    setWorkflowStep('check');
    const context = getContext();
    if (context.commodityType === 'UNKNOWN' && data.extraction?.product?.commodity_type) context.commodityType = data.extraction.product.commodity_type;
    if (context.medicalDevice === 'UNKNOWN' && data.extraction?.product?.medical_device) context.medicalDevice = data.extraction.product.medical_device;
    state.currentInspection = createInspection(data.extraction, context, 'GEMINI_VISION', data.model, state.files.map((item) => item.url), state.files.map((item) => item.file.name), qualitySummary());
    renderReview();
    setWorkflowStep('review');
    setView('review');
    toast('Extraction completed. Review evidence before saving.');
  } catch (error) {
    if (error.code === 'API_KEY_INVALID') {
      sessionStorage.removeItem('complyscan-api-key');
      $('#apiKey').value = '';
      $('details.api-settings').open = true;
      $('#apiKey').focus();
    }
    toast(error.message || 'Analysis failed.', true);
  } finally {
    clearInterval(timer);
    panel.hidden = true;
    updateAnalyzeState();
  }
}

function loadDemo(kind = 'complete') {
  clearFiles();
  const demo = DEMOS[kind];
  applyContext(demo.context);
  state.previewSources = demo.imagePaths;
  state.currentInspection = createInspection(demo.extraction, demo.context, 'DATASET_DEMO', 'Pre-extracted evidence sample', demo.imagePaths, demo.imageNames, demo.quality);
  renderReview();
  setWorkflowStep('review');
  setView('review');
  toast(`${demo.name} loaded.`);
}

function candidateLabel(candidate) {
  const qualifier = candidate?.qualifier ? `${candidate.qualifier}: ` : '';
  return `${qualifier}${candidate?.value || 'Not extracted'}`;
}

function renderFactRows(extraction) {
  const definitions = [
    ['MRP', 'mrp'], ['Net quantity', 'net_quantity'], ['Responsible entity', 'responsible_entity'], ['Address', 'address'], ['Date', 'date'], ['Consumer care', 'consumer_care']
  ];
  return definitions.map(([label, key]) => {
    const candidates = Array.isArray(extraction?.fields?.[key]) ? extraction.fields[key] : [];
    if (!candidates.length) return `<article class="fact-row"><header><strong>${label}</strong><span class="confidence">Not found</span></header><p>—</p></article>`;
    return candidates.map((candidate) => `<article class="fact-row"><header><strong>${label}</strong><span class="confidence">${Math.round(Number(candidate.confidence || 0) * 100)}% extraction confidence</span></header><p>${escapeHtml(candidateLabel(candidate))}</p></article>`).join('');
  }).join('');
}

function renderRuleResults(inspection) {
  const canReview = state.user?.role === 'REVIEWER' || state.user?.role === 'ADMIN';
  return inspection.assessment.results.map((item, index) => {
    const decision = inspection.reviewDecisions?.[item.ruleId] || '';
    const evidence = item.evidence.length ? item.evidence.map((entry) => `<div class="evidence-box"><small>${escapeHtml(entry.imageName || 'Image evidence')} · ${entry.confidence == null ? 'visual predicate' : `${Math.round(entry.confidence * 100)}% extraction confidence`} · ${escapeHtml(entry.method || 'AI_VISION')}</small><p>“${escapeHtml(entry.excerpt || entry.value || 'No exact excerpt')}”</p></div>`).join('') : `<div class="evidence-box"><p>No supporting excerpt was extracted.</p></div>`;
    const reviewerControls = canReview ? `<div class="review-decision" aria-label="Reviewer disposition"><button data-review-decision="CONFIRMED" data-rule-id="${item.ruleId}" class="${decision === 'CONFIRMED' ? 'is-selected' : ''}">Confirm screening result</button><button data-review-decision="MORE_EVIDENCE" data-rule-id="${item.ruleId}" class="${decision === 'MORE_EVIDENCE' ? 'is-selected' : ''}">Request evidence</button><button data-review-decision="ESCALATED" data-rule-id="${item.ruleId}" class="${decision === 'ESCALATED' ? 'is-selected' : ''}">Escalate</button></div>` : `<div class="review-readonly">Reviewer/Admin disposition controls are available only to authorized review roles.</div>`;
    return `<article class="rule-card" data-rule-card="${item.ruleId}"><button type="button" data-toggle-rule="${item.ruleId}" aria-expanded="false"><span class="rule-index">0${index + 1}</span><span><h4>${escapeHtml(item.title)}</h4><small>${escapeHtml(item.ruleId)} · ${escapeHtml(item.source)}</small></span><span class="tag tag-${item.status}">${escapeHtml(item.uiLabel)}</span></button><div class="rule-detail"><p>${escapeHtml(item.explanation)}</p><div class="rule-meta"><span>${escapeHtml(item.mode)}</span><span>${escapeHtml(inspection.legalVersion)}</span><span>Legal output: ${escapeHtml(item.legalOutput)}</span></div>${evidence}${item.nextAction ? `<div class="next-action"><strong>Next action:</strong> ${escapeHtml(item.nextAction)}</div>` : ''}${reviewerControls}</div></article>`;
  }).join('');
}

function renderReview() {
  const inspection = state.currentInspection;
  if (!inspection) return;
  const product = inspection.extraction?.product || {};
  const assessment = inspection.assessment;
  const previews = inspection.previewSources || [];
  const rawText = (inspection.extraction?.raw_text_by_image || []).map((item, index) => `IMAGE ${Number(item.image_index ?? index) + 1}\n${item.text || ''}`).join('\n\n');
  const imageStage = previews.length ? `<div class="preview-stage"><img id="mainEvidenceImage" src="${previews[0]}" alt="Primary package evidence"></div><div class="thumb-row">${previews.map((src, index) => `<button class="thumb-button ${index === 0 ? 'is-active' : ''}" data-preview-image="${index}" aria-label="Show image ${index + 1}"><img src="${src}" alt="Package view ${index + 1}"></button>`).join('')}</div>` : `<div class="empty-state"><strong>Image preview not persisted</strong>The saved record retains extracted evidence and image names. Reattach originals for visual re-review.</div>`;
  $('#reviewWorkspace').innerHTML = `
    <header class="review-header"><div><p class="eyebrow">${escapeHtml(inspection.id)} · ${escapeHtml(inspection.source.replaceAll('_',' '))}</p><h2>${escapeHtml(product.name || 'Unknown packaged commodity')}</h2><p>${escapeHtml(product.brand || 'Brand not extracted')} · ${escapeHtml(product.commodity_type || assessment.context.commodityType || 'Commodity unclassified')} · ${formatDate(inspection.createdAt)}</p></div><div class="review-actions"><button class="button button-ghost" id="saveInspectionBtn">Save inspection</button><button class="button button-ghost" id="exportJsonBtn">Editable JSON</button><button class="button button-dark" id="printReportBtn">Print / PDF</button></div></header>
    <section class="summary-band"><div><span>Overall screening status</span><strong><span class="tag tag-${assessment.overallStatus}">${escapeHtml(assessment.overallLabel)}</span></strong><small>Human review required before legal finalization</small></div><div><span>Passed</span><strong>${assessment.counts.PASS || 0}</strong></div><div><span>Review</span><strong>${assessment.counts.REVIEW || assessment.counts.NEEDS_REVIEW || 0}</strong></div><div><span>Potential issues</span><strong>${assessment.counts.FAIL || assessment.counts.POTENTIAL_ISSUE || 0}</strong></div><div><span>Evidence images</span><strong>${inspection.imageCount || inspection.imageNames?.length || 0}</strong></div></section>
    <div class="review-grid">
      <div class="workspace-column"><section class="card"><div class="card-heading"><div><p class="eyebrow">PACKAGE EVIDENCE</p><h3>Source images</h3></div><span class="tag tag-neutral">${escapeHtml(inspection.quality || 'UNCERTAIN')} QUALITY</span></div>${imageStage}</section><section class="card"><p class="eyebrow">APPLICABILITY ROUTE</p><div class="fact-list"><article class="fact-row"><header><strong>Package context</strong></header><p>${escapeHtml(assessment.context.packageContext)}</p></article><article class="fact-row"><header><strong>Medical device</strong></header><p>${escapeHtml(assessment.context.medicalDevice)}</p></article><article class="fact-row"><header><strong>Date requirement</strong></header><p>${escapeHtml(assessment.context.dateRequired)}</p></article></div></section></div>
      <div class="workspace-column"><section class="card"><div class="card-heading"><div><p class="eyebrow">INFORMATION FOUND</p><h3>Extracted declarations</h3></div><span class="tag tag-neutral">AI + EVIDENCE</span></div><div class="fact-list">${renderFactRows(inspection.extraction)}</div><details><summary class="text-button">Show raw extracted text</summary><textarea class="raw-text" readonly>${escapeHtml(rawText || 'No raw text returned.')}</textarea></details></section><section class="card"><p class="eyebrow">COVERAGE NOTES</p><ul class="guardrail-list">${(inspection.extraction?.coverage?.coverage_notes || ['No coverage note returned.']).map((note) => `<li><span>!</span>${escapeHtml(note)}</li>`).join('')}</ul></section></div>
      <div class="workspace-column"><section class="card"><div class="card-heading"><div><p class="eyebrow">APPLICABLE CHECKS</p><h3>Why this result?</h3><p>Open a check to inspect evidence, source, mode and reviewer action.</p></div><span class="tag tag-neutral">${assessment.results.length} RULES</span></div><div class="rule-results">${renderRuleResults(inspection)}</div></section><section class="card"><p class="eyebrow">GUARDRAILS</p><ul class="guardrail-list">${assessment.guardrails.map((note) => `<li><span>✓</span>${escapeHtml(note)}</li>`).join('')}</ul></section></div>
    </div>`;
}

async function saveInspection() {
  const inspection = state.currentInspection;
  if (!inspection) return;
  const record = JSON.parse(JSON.stringify(inspection, (key, value) => key === 'previewSources' ? undefined : value));
  if (state.files[0]?.file) {
    try { record.thumbnail = await thumbnailFromFile(state.files[0].file); } catch { /* evidence metadata still saves */ }
  } else if (inspection.previewSources?.[0] && !inspection.previewSources[0].startsWith('blob:')) {
    record.thumbnail = inspection.previewSources[0];
  }
  record.savedAt = new Date().toISOString();
  record.reviewStatus = Object.keys(record.reviewDecisions || {}).length === record.assessment.results.length ? 'REVIEWED' : 'UNREVIEWED';
  try {
    await fetchJson('/api/inspections', { method: 'POST', body: JSON.stringify({ inspection: record }) });
  } catch {
    const withoutExisting = state.inspections.filter((item) => item.id !== record.id);
    localStorage.setItem('complyscan-inspections', JSON.stringify([record, ...withoutExisting].slice(0, 250)));
  }
  state.currentInspection.savedAt = record.savedAt;
  state.currentInspection.reviewStatus = record.reviewStatus;
  await loadHistory();
  toast('Inspection saved to the local repository.');
}

function exportJson() {
  const inspection = state.currentInspection;
  if (!inspection) return;
  const exportable = JSON.parse(JSON.stringify(inspection, (key, value) => ['previewSources','thumbnail'].includes(key) ? undefined : value));
  const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${inspection.id}-editable-report.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  toast('Editable JSON report exported.');
}

function openInspection(id) {
  const record = state.inspections.find((row) => row.id === id);
  if (!record) return;
  state.currentInspection = JSON.parse(JSON.stringify(record));
  state.currentInspection.previewSources = record.thumbnail ? [record.thumbnail] : [];
  state.currentInspection.reviewDecisions ||= {};
  renderReview();
  setView('review');
}

function handleGlobalClick(event) {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) return setView(viewButton.dataset.view);
  const openButton = event.target.closest('[data-open-inspection]');
  if (openButton) return openInspection(openButton.dataset.openInspection);
  const removeButton = event.target.closest('[data-remove-image]');
  if (removeButton) {
    const index = Number(removeButton.dataset.removeImage);
    const removed = state.files[index];
    if (removed) {
      URL.revokeObjectURL(removed.url);
      state.fileKeys.delete(removed.key);
      state.files.splice(index, 1);
    }
    state.previewSources = state.files.map((item) => item.url);
    renderImageQueue(); updateAnalyzeState(); return;
  }
  const toggleRule = event.target.closest('[data-toggle-rule]');
  if (toggleRule) {
    const card = toggleRule.closest('.rule-card');
    card.classList.toggle('is-open');
    toggleRule.setAttribute('aria-expanded', String(card.classList.contains('is-open'))); return;
  }
  const decisionButton = event.target.closest('[data-review-decision]');
  if (decisionButton && state.currentInspection) {
    state.currentInspection.reviewDecisions ||= {};
    state.currentInspection.reviewDecisions[decisionButton.dataset.ruleId] = decisionButton.dataset.reviewDecision;
    renderReview();
    const card = $(`[data-rule-card="${decisionButton.dataset.ruleId}"]`);
    if (card) { card.classList.add('is-open'); $('button[data-toggle-rule]', card)?.setAttribute('aria-expanded', 'true'); }
    return;
  }
  const roleSelect = event.target.closest('[data-user-role]');
  if (roleSelect && state.user?.role === 'ADMIN') {
    const email = roleSelect.dataset.userRole;
    const role = roleSelect.value;
    fetchJson('/api/users/role', { method: 'POST', body: JSON.stringify({ email, role }) })
      .then(() => { toast(`Role updated: ${email} → ${role}`); renderUsers(); })
      .catch((error) => { toast(error.message, true); renderUsers(); });
    return;
  }
  const previewButton = event.target.closest('[data-preview-image]');
  if (previewButton && state.currentInspection) {
    const index = Number(previewButton.dataset.previewImage);
    $('#mainEvidenceImage').src = state.currentInspection.previewSources[index];
    $$('.thumb-button').forEach((button) => button.classList.toggle('is-active', button === previewButton));
  }
}

function bindEvents() {
  document.addEventListener('click', handleGlobalClick);
  $('#fileInput').addEventListener('change', (event) => handleFiles(event.target.files));
  const dropzone = $('#dropzone');
  ['dragenter','dragover'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); }));
  ['dragleave','drop'].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging'); }));
  dropzone.addEventListener('drop', (event) => handleFiles(event.dataTransfer.files));
  $('#analyzeBtn').addEventListener('click', analyzeCurrentFiles);
  $('#loadCompleteDemo').addEventListener('click', () => loadDemo('complete'));
  $('#loadCoverageDemo').addEventListener('click', () => loadDemo('coverage'));
  $('#heroDemoBtn').addEventListener('click', () => loadDemo('complete'));
  $('#historySearch').addEventListener('input', renderHistory);
  $('#historyFilter').addEventListener('change', renderHistory);
  $('#apiKey').value = sessionStorage.getItem('complyscan-api-key') || '';
  $('#apiKey').addEventListener('change', () => sessionStorage.setItem('complyscan-api-key', $('#apiKey').value.trim()));
  $('#reviewWorkspace').addEventListener('click', (event) => {
    if (event.target.closest('#saveInspectionBtn')) saveInspection();
    if (event.target.closest('#exportJsonBtn')) exportJson();
    if (event.target.closest('#printReportBtn')) { 
      setWorkflowStep('report'); 
      if (window.self !== window.top) {
        toast("Printing is blocked inside the preview pane. Please click the 'Open in new tab' arrow icon at the top right of this page to print or save the PDF.", true);
      } else {
        setTimeout(() => window.print(), 100); 
      }
    }
  });
}

async function init() {
  bindEvents();
  renderRuleRegister();
  renderImageQueue();
  updateAnalyzeState();
  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = $('#loginError');
    errorBox.hidden = true;
    try {
      await login($('#loginEmail').value.trim(), $('#loginPassword').value);
    } catch (error) {
      errorBox.textContent = error.message || 'Sign in failed';
      errorBox.hidden = false;
    }
  });
  $('#logoutBtn').addEventListener('click', logout);
  if (await loadCurrentUser()) {
    $('#authScreen').hidden = true;
    $('#appShell').hidden = false;
    applyRoleUI();
    await Promise.all([loadHealth(), loadHistory()]);
    const hash = location.hash.replace('#','');
    if (['dashboard','scan','history','rules','admin'].includes(hash)) setView(hash);
  } else {
    $('#authScreen').hidden = false;
    $('#appShell').hidden = true;
  }
}

init();
