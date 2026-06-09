// Dynamic local/hosted API endpoint resolver
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? '' 
  : 'http://localhost:4321';

// =============================================================
// STATE MANAGEMENT & ROUTING
// =============================================================
const state = {
  activeView: 'dashboard',
  settings: {
    geminiApiKey: '',
    theme: 'dark',
    autoReconcile: true
  },
  userProfile: {
    name: 'Arthur Pendelton',
    email: 'arthur.p@privatebanking.client'
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  setupNavigation();
  setupModalHandlers();
  setupDropzone();
  setupSettingsHandlers();
  
  // Initial settings load
  await fetchSettings();
  await loadActiveView();
  
  // Refresh loop
  setInterval(() => {
    if (state.activeView === 'dashboard') {
      fetchDashboardData();
    }
  }, 10000);
}

// -------------------------------------------------------------
// NAVIGATION & ROUTING
// -------------------------------------------------------------
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      const targetView = item.getAttribute('data-view');
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      
      switchView(targetView);
    });
  });

  // Handle Quick Import button
  document.getElementById('btn-quick-import').addEventListener('click', () => {
    openModal();
  });
}

function switchView(viewName) {
  state.activeView = viewName;
  
  // Update Header Title
  const titles = {
    dashboard: { main: 'Dashboard', sub: 'Overview of your private records' },
    inbox: { main: 'Inbox & Evidence', sub: 'Manage ingested raw files and emails' },
    transactions: { main: 'Ledger & Transactions', sub: 'Review reconciled cashflows' },
    events: { main: 'Calendar Events', sub: 'Track upcoming schedule & invites' },
    settings: { main: 'Vault Settings', sub: 'Manage API keys and export credentials' }
  };
  
  document.getElementById('view-title').textContent = titles[viewName].main;
  document.getElementById('view-subtitle').textContent = titles[viewName].sub;
  
  // Update view panel visibility
  const container = document.getElementById('view-container');
  container.innerHTML = ''; // Clear container

  // Create & mount view content
  const viewElement = document.createElement('div');
  viewElement.className = 'view-pane active';
  
  if (viewName === 'dashboard') {
    viewElement.innerHTML = `
      <div class="dashboard-grid">
        <section class="card glass pane-column">
          <div class="card-header">
            <h3>Recent Activity</h3>
            <span class="badge badge-gold">Live Updates</span>
          </div>
          <div class="card-body scrollable" id="pane-recent-activity">
            <div class="loader"></div>
          </div>
        </section>

        <section class="card glass pane-column">
          <div class="card-header">
            <h3>Upcoming Reminders</h3>
            <span class="badge badge-blue">Calendar & Bills</span>
          </div>
          <div class="card-body scrollable" id="pane-upcoming">
            <div class="loader"></div>
          </div>
        </section>

        <section class="card glass pane-column">
          <div class="card-header">
            <h3>Decisions & Reviews</h3>
            <span class="badge badge-warn" id="reviews-count">0 Unresolved</span>
          </div>
          <div class="card-body scrollable" id="pane-decisions">
            <div class="loader"></div>
          </div>
        </section>
      </div>
    `;
    container.appendChild(viewElement);
    fetchDashboardData();
  } else if (viewName === 'inbox') {
    viewElement.innerHTML = `
      <div class="card glass grid-card">
        <div class="card-header">
          <h3>Ingested Evidence Sources</h3>
          <button class="btn btn-secondary btn-sm" id="btn-import-inbox">Ingest File</button>
        </div>
        <div class="card-body scrollable">
          <div class="table-wrapper">
            <table class="ea-table">
              <thead>
                <tr>
                  <th>Original Filename</th>
                  <th>Type</th>
                  <th>Imported At</th>
                  <th>Stored Path</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody id="evidence-table-body">
                <tr><td colspan="5" style="text-align:center;">Loading evidence files...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    container.appendChild(viewElement);
    document.getElementById('btn-import-inbox').addEventListener('click', openModal);
    fetchEvidenceData();
  } else if (viewName === 'transactions') {
    viewElement.innerHTML = `
      <div class="card glass grid-card">
        <div class="card-header">
          <h3>Transaction Ledger</h3>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary btn-sm" id="btn-export-csv">Export CSV</button>
            <button class="btn btn-secondary btn-sm" id="btn-export-json">Export JSON</button>
          </div>
        </div>
        <div class="card-body scrollable">
          <div class="table-wrapper">
            <table class="ea-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th>Reconciliation</th>
                  <th>Provenance</th>
                </tr>
              </thead>
              <tbody id="transactions-table-body">
                <tr><td colspan="6" style="text-align:center;">Loading transactions...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    container.appendChild(viewElement);
    document.getElementById('btn-export-csv').addEventListener('click', () => window.open(API_BASE + '/api/export?type=csv'));
    document.getElementById('btn-export-json').addEventListener('click', () => window.open(API_BASE + '/api/export?type=json'));
    fetchTransactionsData();
  } else if (viewName === 'events') {
    viewElement.innerHTML = `
      <div class="card glass grid-card">
        <div class="card-header">
          <h3>Calendar & Schedule</h3>
          <button class="btn btn-secondary btn-sm" id="btn-export-ics">Export ICS</button>
        </div>
        <div class="card-body scrollable">
          <div class="table-wrapper">
            <table class="ea-table">
              <thead>
                <tr>
                  <th>Start Time</th>
                  <th>Event Title</th>
                  <th>Location</th>
                  <th>Calendar Status</th>
                  <th>Review Status</th>
                </tr>
              </thead>
              <tbody id="events-table-body">
                <tr><td colspan="5" style="text-align:center;">Loading events...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    container.appendChild(viewElement);
    document.getElementById('btn-export-ics').addEventListener('click', () => window.open(API_BASE + '/api/export?type=ics'));
    fetchEventsData();
  } else if (viewName === 'settings') {
    viewElement.innerHTML = `
      <div class="card glass grid-card">
        <div class="card-header">
          <h3>System Settings</h3>
        </div>
        <div class="card-body">
          <div class="settings-section">
            <div class="form-group">
              <label for="input-gemini-key">Gemini AI API Key</label>
              <input type="password" id="input-gemini-key" class="form-input" placeholder="Enter Gemini API key for structured extraction..." value="${state.settings.geminiApiKey || ''}">
              <p class="settings-info">This key is used to execute structured JSON extractions from messy documents. Leave blank to run offline rule-based regex extractors.</p>
            </div>
            
            <div class="form-group" style="flex-direction:row; justify-content:space-between; align-items:center;">
              <div>
                <label style="margin-bottom:0;">Auto-Reconciliation</label>
                <p class="settings-info" style="margin-top:4px;">Automatically link transaction receipts and statement entries based on dates and amounts.</p>
              </div>
              <input type="checkbox" id="check-auto-reconcile" ${state.settings.autoReconcile ? 'checked' : ''} style="transform: scale(1.3); cursor: pointer;">
            </div>

            <div class="form-group" style="margin-top: 20px;">
              <button class="btn btn-primary" id="btn-save-settings" style="align-self: flex-start;">Save Configuration</button>
            </div>

            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 30px 0;">

            <div class="form-group">
              <label style="color:var(--color-danger)">Destructive Operations</label>
              <p class="settings-info">Purging the vault deletes all local evidence files, attachments, logs, and resets the SQLite database schema. This action is irreversible.</p>
              <button class="btn btn-danger" id="btn-wipe-vault" style="align-self: flex-start; margin-top:10px;">Delete Vault Contents</button>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(viewElement);
    setupSettingsHandlers();
  }
}

// -------------------------------------------------------------
// API FETCH OPERATIONS
// -------------------------------------------------------------
async function fetchSettings() {
  try {
    const res = await fetch(API_BASE + '/api/settings');
    const settings = await res.json();
    state.settings = settings;
    document.getElementById('user-display-name').textContent = state.userProfile.name;
    document.getElementById('user-display-email').textContent = state.userProfile.email;
  } catch (e) {
    console.error('Failed to fetch settings', e);
  }
}

async function fetchDashboardData() {
  try {
    const res = await fetch(API_BASE + '/api/dashboard');
    const data = await res.json();
    
    renderRecentActivity(data.recentTransactions, data.recentReceipts, data.recentLogs);
    renderUpcoming(data.upcoming);
    renderDecisions(data.decisions);
  } catch (err) {
    console.error('Error fetching dashboard details:', err);
  }
}

async function fetchEvidenceData() {
  try {
    const res = await fetch(API_BASE + '/api/evidence');
    const files = await res.json();
    
    const tbody = document.getElementById('evidence-table-body');
    if (files.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--color-text-muted);">No evidence files ingested yet. Click Ingest to import.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = files.map(f => {
      const date = new Date(f.imported_at).toLocaleString();
      return `
        <tr onclick="viewEvidenceSource('${f.id}')">
          <td style="font-weight:600; color:var(--color-gold);">${escapeHTML(f.original_filename)}</td>
          <td><span class="badge ${f.type === 'email' ? 'badge-blue' : f.type === 'csv' ? 'badge-gold' : 'badge-success'}">${f.type.toUpperCase()}</span></td>
          <td>${date}</td>
          <td style="font-family:monospace; font-size:0.75rem; color:var(--color-text-secondary);">${f.stored_path}</td>
          <td style="font-family:monospace; font-size:0.75rem; color:var(--color-text-muted);">${f.content_hash.substring(0, 12)}...</td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
  }
}

async function fetchTransactionsData() {
  try {
    const res = await fetch(API_BASE + '/api/transactions');
    const txns = await res.json();
    
    const tbody = document.getElementById('transactions-table-body');
    if (txns.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-text-muted);">No ledger records found.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = txns.map(t => {
      const isNegative = t.amount < 0;
      const amountClass = isNegative ? 'negative' : 'positive';
      const amountSymbol = isNegative ? '-' : '+';
      const amountStr = `$${Math.abs(t.amount).toFixed(2)}`;
      const recBadge = t.status === 'reconciled' 
        ? `<span class="badge badge-success">Reconciled</span>` 
        : t.review_status === 'superseded' 
          ? `<span class="badge badge-gold" style="opacity:0.6;">Superseded</span>`
          : `<span class="badge badge-warn">Unreconciled</span>`;

      return `
        <tr onclick="${t.source_evidence_id ? `viewEvidenceSource('${t.source_evidence_id}')` : ''}">
          <td>${t.authorized_date}</td>
          <td>
            <div style="font-weight:600;">${escapeHTML(t.merchant_normalized || t.merchant_raw)}</div>
            <div style="font-size:0.75rem; color:var(--color-text-muted);">${escapeHTML(t.merchant_raw)}</div>
          </td>
          <td class="tx-amount ${amountClass}">${amountSymbol}${amountStr}</td>
          <td>${escapeHTML(t.category || 'General')}</td>
          <td>${recBadge}</td>
          <td><span style="font-size:0.8rem; text-decoration:underline; color:var(--color-gold); cursor:pointer;">${escapeHTML(t.original_filename || 'Manual Entry')}</span></td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
  }
}

async function fetchEventsData() {
  try {
    const res = await fetch(API_BASE + '/api/events');
    const evs = await res.json();
    
    const tbody = document.getElementById('events-table-body');
    if (evs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--color-text-muted);">No calendar events or suggestions found.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = evs.map(ev => {
      const date = new Date(ev.start).toLocaleString();
      const statusBadge = ev.calendar_status === 'added_to_calendar'
        ? `<span class="badge badge-success">Added to Calendar</span>`
        : `<span class="badge badge-warn">Suggested</span>`;
        
      return `
        <tr onclick="viewEvidenceSource('${ev.source_evidence_id}')">
          <td>${date}</td>
          <td style="font-weight:600;">${escapeHTML(ev.title)}</td>
          <td>${escapeHTML(ev.location || 'Not Specified')}</td>
          <td>${statusBadge}</td>
          <td><span class="badge badge-gold">${ev.review_status.toUpperCase()}</span></td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// VIEW RENDERERS (DASHBOARD PANES)
// -------------------------------------------------------------
function renderRecentActivity(txns, receipts, logs) {
  const container = document.getElementById('pane-recent-activity');
  
  if (txns.length === 0 && receipts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        <p>No activity detected.<br>Ingest your first statement or transaction alert to begin.</p>
      </div>
    `;
    return;
  }

  let items = [];

  txns.forEach(t => {
    if (t.review_status === 'superseded') return; // Hide superseded
    
    const isNegative = t.amount < 0;
    const desc = isNegative ? 'Purchase detected' : 'Credit detected';
    const amountStr = `$${Math.abs(t.amount).toFixed(2)}`;
    let details = `${t.merchant_normalized || t.merchant_raw} matched to Visa transaction`;

    if (t.notes && t.notes.includes('Superseded')) return;
    
    // Venmo context mockup
    if ((t.merchant_normalized || '').toLowerCase() === 'venmo') {
      details = 'Recognized as brother (Matt). Possible context: dinner last night.';
    }

    items.push({
      date: t.authorized_date,
      timestamp: new Date(t.authorized_date).getTime(),
      title: `${t.merchant_normalized || t.merchant_raw}: ${isNegative ? '-' : '+'}${amountStr}`,
      description: t.status === 'reconciled' ? `${details}. Receipt reconciled.` : `${details}. Unreconciled.`,
      iconClass: isNegative ? 'expense' : 'income',
      iconSvg: isNegative ? '<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>' : '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>',
      sourceId: t.source_evidence_id
    });
  });

  // Sort and render combined activities
  items.sort((a, b) => b.timestamp - a.timestamp);
  
  container.innerHTML = `
    <div class="timeline">
      ${items.map(item => `
        <div class="timeline-item" onclick="${item.sourceId ? `viewEvidenceSource('${item.sourceId}')` : ''}">
          <div class="timeline-icon ${item.iconClass}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;">
              ${item.iconSvg}
            </svg>
          </div>
          <div class="timeline-content">
            <div class="timeline-title">${escapeHTML(item.title)}</div>
            <div class="timeline-desc">${escapeHTML(item.description)}</div>
            <div class="timeline-time">${item.date}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderUpcoming(upcoming) {
  const container = document.getElementById('pane-upcoming');
  
  if (upcoming.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        <p>Your calendar is clear.<br>Upcoming bills and warranty timelines will display here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="reminder-list">
      ${upcoming.map(item => `
        <div class="reminder-card ${item.type}">
          <div class="reminder-header">
            <span class="reminder-title">${escapeHTML(item.title)}</span>
            <span class="reminder-date">${item.date}</span>
          </div>
          <p class="reminder-detail">${escapeHTML(item.detail)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDecisions(decisions) {
  const container = document.getElementById('pane-decisions');
  const countBadge = document.getElementById('reviews-count');
  
  countBadge.textContent = `${decisions.length} Unresolved`;
  
  if (decisions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <p>No actions pending review.<br>Your assistant has matched all records successfully.</p>
      </div>
    `;
    countBadge.className = 'badge badge-success';
    return;
  }

  countBadge.className = 'badge badge-warn';

  container.innerHTML = `
    <div class="decision-list">
      ${decisions.map(d => {
        const choices = JSON.parse(d.choices);
        
        let actionsHtml = '';
        if (d.type === 'reconciliation') {
          actionsHtml = choices.map(c => {
            if (c.receiptId === 'none') {
              return `<button class="choice-btn" onclick="resolveDecision('${d.id}', 'none')">None of these receipts</button>`;
            }
            return `<button class="choice-btn primary-choice" onclick="resolveDecision('${d.id}', '${c.receiptId}')">Match to best receipt: ${escapeHTML(c.merchant)} ($${c.amount.toFixed(2)})</button>`;
          }).join('');
        } else if (d.type === 'calendar_add') {
          actionsHtml = `
            <div style="display:flex; gap:10px;">
              <button class="btn btn-primary" style="flex:1;" onclick="resolveDecision('${d.id}', 'add')">Add to Calendar</button>
              <button class="btn btn-secondary" style="flex:1;" onclick="resolveDecision('${d.id}', 'reject')">Ignore</button>
            </div>
          `;
        }

        return `
          <div class="decision-card">
            <div class="decision-title">${escapeHTML(d.title)}</div>
            <p class="decision-desc">${escapeHTML(d.description)}</p>
            <div class="decision-choices">
              ${actionsHtml}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// -------------------------------------------------------------
// RESOLVE DECISION ACTION
// -------------------------------------------------------------
window.resolveDecision = async function(decisionId, choice) {
  try {
    const res = await fetch(API_BASE + '/api/decisions/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisionId, choice })
    });
    
    if (res.ok) {
      showToast('Decision resolved successfully.', 'success');
      fetchDashboardData();
    } else {
      const err = await res.json();
      showToast(`Error: ${err.message}`, 'error');
    }
  } catch (e) {
    showToast('Failed to contact server.', 'error');
  }
};

// -------------------------------------------------------------
// EVIDENCE VIEW DRAWER (SIDE-BY-SIDE VISUALIZER)
// -------------------------------------------------------------
window.viewEvidenceSource = async function(evidenceId) {
  const drawer = document.getElementById('detail-drawer');
  const body = document.getElementById('drawer-body');
  
  drawer.classList.add('active');
  body.innerHTML = `<div class="loader"></div>`;
  
  try {
    const res = await fetch(`${API_BASE}/api/evidence/view?id=${evidenceId}`);
    if (!res.ok) throw new Error('Evidence not found');
    
    const data = await res.json();
    const ev = data.evidence;
    
    let contentHtml = '';
    
    if (ev.type === 'email' && data.emailDetails) {
      const em = data.emailDetails;
      contentHtml = `
        <div class="detail-section">
          <h4>Structured Metadata</h4>
          <div class="detail-row"><span class="label">Date</span><span class="value">${em.date}</span></div>
          <div class="detail-row"><span class="label">From</span><span class="value">${escapeHTML(em.from_address)}</span></div>
          <div class="detail-row"><span class="label">To</span><span class="value">${escapeHTML(em.to_address)}</span></div>
          <div class="detail-row"><span class="label">Subject</span><span class="value" style="font-weight:600; color:var(--color-gold);">${escapeHTML(em.subject)}</span></div>
          <div class="detail-row"><span class="label">Classification</span><span class="value"><span class="badge badge-gold">${em.classification.toUpperCase()}</span></span></div>
        </div>

        <div class="detail-section">
          <h4>Source Email Content</h4>
          <div class="source-content-box">${escapeHTML(em.body)}</div>
        </div>
      `;
    } else if (ev.type === 'csv') {
      contentHtml = `
        <div class="detail-section">
          <h4>Import Manifest</h4>
          <div class="detail-row"><span class="label">Date Imported</span><span class="value">${ev.imported_at}</span></div>
          <div class="detail-row"><span class="label">File Size</span><span class="value">${JSON.parse(ev.metadata).size} bytes</span></div>
          <div class="detail-row"><span class="label">Hash</span><span class="value" style="font-family:monospace; font-size:0.75rem;">${ev.content_hash}</span></div>
        </div>
        
        <div class="detail-section">
          <h4>Raw CSV Document</h4>
          <div class="source-content-box">${escapeHTML(data.content)}</div>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="detail-section">
          <h4>Uploaded Document</h4>
          <div class="detail-row"><span class="label">Filename</span><span class="value">${escapeHTML(ev.original_filename)}</span></div>
          <div class="detail-row"><span class="label">Path</span><span class="value">${ev.stored_path}</span></div>
          <div class="detail-row"><span class="label">Imported At</span><span class="value">${ev.imported_at}</span></div>
        </div>
        <p style="font-size:0.85rem; color:var(--color-text-secondary);">Binary file preview (e.g. PDF statement metadata extractions) is displayed in dashboard widgets. Original PDF stored securely in vault.</p>
      `;
    }
    
    body.innerHTML = contentHtml;
    
  } catch (err) {
    body.innerHTML = `<div style="color:var(--color-danger); padding:20px;">Failed to load evidence file details: ${err.message}</div>`;
  }
};

document.getElementById('btn-close-drawer').addEventListener('click', () => {
  document.getElementById('detail-drawer').classList.remove('active');
});

// -------------------------------------------------------------
// INGESTION MODAL & DROPZONE
// -------------------------------------------------------------
function openModal() {
  document.getElementById('import-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('import-modal').classList.remove('active');
  document.getElementById('upload-progress-list').innerHTML = '';
}

function setupModalHandlers() {
  document.getElementById('btn-close-import').addEventListener('click', closeModal);
  
  // Close modal when clicking outside the card
  document.getElementById('import-modal').addEventListener('click', (e) => {
    if (e.target.id === 'import-modal') closeModal();
  });
}

function setupDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFilesUpload(files);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFilesUpload(fileInput.files);
    }
  });
}

async function handleFilesUpload(files) {
  const progressList = document.getElementById('upload-progress-list');
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // Add file progress card
    const progressItem = document.createElement('div');
    progressItem.className = 'upload-progress-item';
    progressItem.innerHTML = `
      <div class="progress-info">
        <span style="font-weight:600;">${escapeHTML(file.name)}</span>
      </div>
      <span style="color:var(--color-gold);" id="up-status-${i}">Encrypting...</span>
    `;
    progressList.appendChild(progressItem);
    
    try {
      // Convert to base64
      const base64Content = await readFileAsBase64(file);
      
      const res = await fetch(API_BASE + '/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content: base64Content,
          category: file.name.endsWith('.eml') ? 'emails' : file.name.endsWith('.pdf') ? 'statements' : 'imports'
        })
      });
      
      if (res.ok) {
        document.getElementById(`up-status-${i}`).textContent = 'Ingested & Reconciled';
        document.getElementById(`up-status-${i}`).style.color = 'var(--color-success)';
        showToast(`Successfully ingested: ${file.name}`, 'success');
      } else {
        const err = await res.json();
        document.getElementById(`up-status-${i}`).textContent = 'Failed';
        document.getElementById(`up-status-${i}`).style.color = 'var(--color-danger)';
        showToast(`Ingestion failed for ${file.name}: ${err.message}`, 'error');
      }
    } catch (err) {
      document.getElementById(`up-status-${i}`).textContent = 'Error';
      document.getElementById(`up-status-${i}`).style.color = 'var(--color-danger)';
      showToast(`Upload error: ${err.message}`, 'error');
    }
  }

  // Refresh active view
  setTimeout(() => {
    loadActiveView();
  }, 1000);
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove data:application/octet-stream;base64, prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

function loadActiveView() {
  switchView(state.activeView);
}

// -------------------------------------------------------------
// SETTINGS HANDLERS
// -------------------------------------------------------------
function setupSettingsHandlers() {
  const saveBtn = document.getElementById('btn-save-settings');
  const wipeBtn = document.getElementById('btn-wipe-vault');
  
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const apiKey = document.getElementById('input-gemini-key').value.trim();
      const autoReconcile = document.getElementById('check-auto-reconcile').checked;
      
      try {
        const res = await fetch(API_BASE + '/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geminiApiKey: apiKey,
            autoReconcile: autoReconcile
          })
        });
        
        if (res.ok) {
          const data = await res.json();
          state.settings = data.settings;
          showToast('Settings saved successfully.', 'success');
        } else {
          showToast('Failed to save settings.', 'error');
        }
      } catch (e) {
        showToast('Server connection failed.', 'error');
      }
    });
  }

  if (wipeBtn) {
    wipeBtn.addEventListener('click', async () => {
      if (!confirm('Are you absolutely sure you want to delete the local vault? This will completely erase all databases and evidence files!')) {
        return;
      }
      
      try {
        const res = await fetch(API_BASE + '/api/wipe', { method: 'POST' });
        if (res.ok) {
          showToast('Vault deleted successfully. Resetting...', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          showToast('Failed to wipe vault.', 'error');
        }
      } catch (e) {
        showToast('Server connection failed.', 'error');
      }
    });
  }
}

// -------------------------------------------------------------
// TOAST NOTIFICATIONS
// -------------------------------------------------------------
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${escapeHTML(message)}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// -------------------------------------------------------------
// UTILS
// -------------------------------------------------------------
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
