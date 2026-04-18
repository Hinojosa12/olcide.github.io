/* ══════════════════════════════════════════════════════════════════════════
   CaribZoom Staff Dashboard — Application Logic
   Refactored: Centralized state, AbortController, toasts, event delegation
   ══════════════════════════════════════════════════════════════════════════ */

// ── CONSTANTS ─────────────────────────────────────────────────────────────
const TIMEZONE = 'America/Guyana';

const API = {
  LOGIN:           'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-login',
  ATTENDANCE:      'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-attendance',
  TEAM_STATUS:     'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-team-status',
  MESSAGES:        'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-messages',
  DELETE_MESSAGES: 'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-delete-messages',
  SEND_MESSAGE:    'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-send-message',
  FB_COMMENTS:     'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-fb-comments',
  AI_AGENT:        'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-agent',
};

const STATUS_MAP  = { clockIn:'online', lunchStart:'on-lunch', lunchEnd:'online', clockOut:'out' };
const LABEL_MAP   = { clockIn:'Clocked In', lunchStart:'Started Lunch', lunchEnd:'Ended Lunch', clockOut:'Clocked Out' };
const STATUS_LABELS = { idle:'Not Clocked In', online:'Online', 'on-lunch':'On Lunch', out:'Clocked Out' };
const STATUS_CLASSES = { idle:'idle', online:'online', 'on-lunch':'on-lunch', out:'offline' };
const SHORT_STATUS = { online:'Online', 'on-lunch':'On Lunch', idle:'Not Clocked In', out:'Clocked Out' };
const ATTACHMENT_PLACEHOLDERS = ['📎 Attachment','📷 Photo','🎵 Audio','🎬 Video','📄 File'];

const BRAND_TO_PAGE_ID = {
  'Party Hub':                    '507711665764249',
  'Hope Jewellery':               '1987162524911591',
  'Home Essentials':              '102054851586430',
  'The Office Depot':             '691632367849294',
  "D'Jango Gentleman's Apparel": '112987724626231',
  "Destiny's Clothing Store":     '108629230921476',
  'CaribZoom':                    '615378785649491',
  'Pieces Plus Sized - Reloaded': '105718055443236',
  'Medjay Inc':                   '207414482464381',
  'Region 3 Chamber of Commerce': '619624991551869',
  'Choose Health':                '102237415030792',
  "Zippy's Courier Services":    '103431468060033',
};

// ── CENTRALIZED STATE ─────────────────────────────────────────────────────
const State = {
  user: null,
  status: 'idle',
  activityLog: [],
  allowedBrands: [],
  messages: {
    all: [],
    conversations: {},
    brandFilter: 'all',
    searchQuery: '',
    activeConvoId: null,
  },
  comments: {
    all: [],
    filter: 'all',
    loaded: false,
  },
  agent: {
    messages: [],
    open: false,
  },
  ui: {
    teamPollInterval: null,
  },
};

// ── ABORT CONTROLLERS ─────────────────────────────────────────────────────
const controllers = {
  messages: null,
  team: null,
  comments: null,
  agent: null,
  attendance: null,
  send: null,
  deleteConvo: null,
};

function abortController(key) {
  if (controllers[key]) {
    controllers[key].abort();
  }
  controllers[key] = new AbortController();
  return controllers[key].signal;
}

// ── TOAST SYSTEM ──────────────────────────────────────────────────────────
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toastContainer');
  },

  show(type, title, msg, duration = 5000) {
    if (!this.container) return;

    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle',
    };

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <div class="toast-icon ${type}"><i class="fas ${icons[type] || icons.info}"></i></div>
      <div class="toast-body">
        <div class="toast-title">${escapeHtml(title)}</div>
        ${msg ? `<div class="toast-msg">${escapeHtml(msg)}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Close notification"><i class="fas fa-times"></i></button>
      <div class="toast-progress" style="animation-duration:${duration}ms"></div>
    `;

    const closeBtn = el.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.dismiss(el));

    this.container.appendChild(el);

    if (duration > 0) {
      setTimeout(() => this.dismiss(el), duration);
    }

    return el;
  },

  dismiss(el) {
    if (!el || el.classList.contains('removing')) return;
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  },

  success(title, msg, dur) { return this.show('success', title, msg, dur); },
  error(title, msg, dur)   { return this.show('error', title, msg, dur); },
  warning(title, msg, dur) { return this.show('warning', title, msg, dur); },
  info(title, msg, dur)    { return this.show('info', title, msg, dur); },
};

// ── HELPERS ───────────────────────────────────────────────────────────────
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(date, opts = {}) {
  return date.toLocaleTimeString('en-US', {
    hour12: true,
    hour: opts.hour || '2-digit',
    minute: opts.minute || '2-digit',
    timeZone: TIMEZONE,
  });
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: TIMEZONE,
  });
}

function formatFullDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: TIMEZONE,
  });
}

function getInitials(name) {
  if (!name || name === 'Unknown' || name === '') return '<i class="fas fa-user"></i>';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getSenderDisplay(senderId, senderName) {
  const short = senderId ? senderId.slice(-6) : '???';
  const name = (senderName && senderName !== 'Unknown' && senderName !== '') ? senderName : 'User …' + short;
  return { short, name };
}

// ── CLOCK ─────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const timeEl = document.getElementById('liveTime');
  const dateEl = document.getElementById('liveDate');
  if (timeEl) timeEl.textContent = formatTime(now, { hour: undefined, minute: undefined });
  if (dateEl) dateEl.textContent = formatFullDate(now);
}

// ── AUTH ──────────────────────────────────────────────────────────────────
async function doLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');

  if (!email || !password) {
    errEl.textContent = 'Please enter email and password.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  errEl.textContent = '';

  try {
    const signal = abortController('attendance');
    const res = await fetch(API.LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal,
    });
    const data = await res.json();

    if (data.success) {
      State.user = data.user;
      sessionStorage.setItem('caribzoom_user', JSON.stringify(State.user));
      Toast.success('Welcome back!', State.user.name);
      showDashboard();
    } else {
      errEl.textContent = data.message || 'Login failed.';
      Toast.error('Login failed', data.message);
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    errEl.textContent = 'Connection error. Please try again.';
    Toast.error('Connection Error', 'Could not reach the server.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

function doLogout() {
  State.user = null;
  State.status = 'idle';
  State.activityLog = [];
  State.allowedBrands = [];
  State.comments.loaded = false;
  State.messages.activeConvoId = null;
  State.messages.conversations = {};
  State.messages.all = [];
  State.agent.messages = [];

  if (State.ui.teamPollInterval) {
    clearInterval(State.ui.teamPollInterval);
    State.ui.teamPollInterval = null;
  }

  sessionStorage.removeItem('caribzoom_user');

  document.getElementById('loginScreen').style.display  = 'flex';
  document.getElementById('dashboard').style.display    = 'none';
  document.getElementById('adminSection').style.display = 'none';
  document.getElementById('commsSection').style.display = 'none';
  document.getElementById('agentFab').style.display     = 'none';
  document.getElementById('loginEmail').value           = '';
  document.getElementById('loginPassword').value        = '';
  closeAgentChat();
}

function checkSession() {
  const saved = sessionStorage.getItem('caribzoom_user');
  if (saved) {
    try {
      State.user = JSON.parse(saved);
      showDashboard();
    } catch (e) {
      sessionStorage.removeItem('caribzoom_user');
    }
  }
}

// ── PERMISSIONS ───────────────────────────────────────────────────────────
function getUserAllowedBrands() {
  if (!State.user) return [];
  const mb = (State.user.messageBrands || '').trim();
  if (!mb || mb.toLowerCase() === 'all') return [];
  return mb.split(',').map(b => b.trim()).filter(Boolean);
}

function canSeeMessages() {
  if (!State.user) return false;
  if (State.user.role === 'admin') return true;
  return (State.user.messageBrands || '').trim().length > 0;
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────
function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboard').style.display   = 'block';

  const user = State.user;
  document.getElementById('dashName').textContent  = user.name;
  document.getElementById('dashRole').textContent  = user.role.toUpperCase() + ' · ' + user.brand.toUpperCase();
  document.getElementById('dashAvatar').textContent = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  // Admin section
  if (user.role === 'admin') {
    document.getElementById('adminSection').style.display = 'block';
    fetchTeamStatus();
  } else {
    document.getElementById('adminSection').style.display = 'none';
  }

  // Comms section
  State.allowedBrands = getUserAllowedBrands();
  if (canSeeMessages()) {
    document.getElementById('commsSection').style.display = 'block';
    switchCommsTab('messages');
    fetchMessages();
  } else {
    document.getElementById('commsSection').style.display = 'none';
  }

  // Reset state
  State.status = 'idle';
  State.activityLog = [];
  State.comments.loaded = false;
  renderLog();
  updateButtons();
  updateStatusBadge();

  document.getElementById('agentFab').style.display = 'flex';
}

// ── COMMS TABS ────────────────────────────────────────────────────────────
function switchCommsTab(tab) {
  const tabMessages = document.getElementById('tabMessages');
  const tabComments = document.getElementById('tabComments');
  const panelMessages = document.getElementById('panelMessages');
  const panelComments = document.getElementById('panelComments');

  if (tab === 'messages') {
    tabMessages.classList.add('active');
    tabMessages.setAttribute('aria-selected', 'true');
    tabComments.classList.remove('active');
    tabComments.setAttribute('aria-selected', 'false');
    panelMessages.style.display = 'block';
    panelComments.style.display = 'none';
  } else {
    tabMessages.classList.remove('active');
    tabMessages.setAttribute('aria-selected', 'false');
    tabComments.classList.add('active');
    tabComments.setAttribute('aria-selected', 'true');
    panelMessages.style.display = 'none';
    panelComments.style.display = 'block';
    if (!State.comments.loaded) {
      fetchFbComments();
      State.comments.loaded = true;
    }
  }
}

// ── ATTENDANCE ACTIONS ────────────────────────────────────────────────────
async function doAction(action) {
  document.querySelectorAll('.clock-btn').forEach(b => b.disabled = true);

  try {
    const signal = abortController('attendance');
    const res = await fetch(API.ATTENDANCE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        employeeId: State.user.id,
        name: State.user.name,
        brand: State.user.brand,
      }),
      signal,
    });
    const data = await res.json();

    if (data.success) {
      State.status = STATUS_MAP[action];
      const timeStr = data.time || formatTime(new Date(), { hour: undefined, minute: false });
      addLogEntry(timeStr, LABEL_MAP[action], State.user.name);
      updateButtons();
      updateStatusBadge();
      Toast.success(LABEL_MAP[action]);
      if (State.user.role === 'admin') fetchTeamStatus();
    } else {
      Toast.error('Action failed', data.message || 'Unknown error');
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.error('Action error:', e);
    Toast.error('Connection Error', 'Could not record action.');
  }

  setTimeout(() => updateButtons(), 100);
}

function updateButtons() {
  const btns = {
    idle:     document.getElementById('btnClockIn'),
    online:   [document.getElementById('btnLunchStart'), document.getElementById('btnClockOut')],
    'on-lunch': document.getElementById('btnLunchEnd'),
  };
  Object.values(btns).flat().forEach(b => b.disabled = true);
  const active = btns[State.status];
  if (Array.isArray(active)) active.forEach(b => b.disabled = false);
  else if (active) active.disabled = false;
}

function updateStatusBadge() {
  const badge = document.getElementById('myStatusBadge');
  badge.className = 'status-badge ' + STATUS_CLASSES[State.status];
  badge.innerHTML = `<i class="fas fa-circle" style="font-size:.45rem" aria-hidden="true"></i> ${STATUS_LABELS[State.status]}`;
}

// ── ACTIVITY LOG ──────────────────────────────────────────────────────────
function addLogEntry(time, action, name) {
  State.activityLog.unshift({ time, action, name });
  renderLog();
}

function renderLog() {
  const list = document.getElementById('logList');
  if (!State.activityLog.length) {
    list.innerHTML = '<div class="log-item" style="justify-content:center;color:var(--gray)">No activity recorded yet</div>';
    return;
  }
  list.innerHTML = State.activityLog.slice(0, 20).map(l =>
    `<div class="log-item"><span class="log-time">${escapeHtml(l.time)}</span><span class="log-action">${escapeHtml(l.action)}</span><span class="log-name">— ${escapeHtml(l.name)}</span></div>`
  ).join('');
}

// ── TEAM STATUS (Admin) ───────────────────────────────────────────────────
async function fetchTeamStatus() {
  if (!State.user || State.user.role !== 'admin') return;

  const btn  = document.getElementById('btnRefreshTeam');
  const icon = btn ? btn.querySelector('.fa-sync-alt') : null;
  if (btn)  btn.disabled = true;
  if (icon) icon.classList.add('spinning');

  try {
    const signal = abortController('team');
    const res = await fetch(API.TEAM_STATUS, { signal });
    const data = await res.json();

    if (data.success) {
      renderTeamCounts(data.counts);
      renderTeamTable(data.team);
      renderTeamCards(data.team);
      const el = document.getElementById('teamLastUpdate');
      if (el) el.textContent = 'Last updated: ' + formatTime(new Date());
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.error('Team status error:', e);
    Toast.warning('Team Data', 'Could not refresh team status.');
  } finally {
    if (btn)  btn.disabled = false;
    if (icon) icon.classList.remove('spinning');
  }
}

function renderTeamCounts(c) {
  document.getElementById('countActive').textContent = c.active || 0;
  document.getElementById('countLunch').textContent  = c.lunch  || 0;
  document.getElementById('countIdle').textContent   = c.idle   || 0;
  document.getElementById('countOut').textContent    = c.out    || 0;
}

function renderTeamTable(team) {
  const tbody = document.getElementById('teamBody');
  if (!team || !team.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:2rem">No employee data yet</td></tr>';
    return;
  }
  tbody.innerHTML = team.map(e => {
    const lunch = e.lunchStart ? (e.lunchStart + (e.lunchEnd ? ' - ' + e.lunchEnd : ' (active)')) : '—';
    return `<tr>
      <td style="font-weight:600;color:var(--white)">${escapeHtml(e.name)}</td>
      <td><span class="brand-tag">${escapeHtml(e.brand)}</span></td>
      <td><span class="emp-status ${STATUS_CLASSES[e.status] || 'idle'}">${SHORT_STATUS[e.status] || 'Unknown'}</span></td>
      <td>${escapeHtml(e.clockIn) || '—'}</td>
      <td>${escapeHtml(lunch)}</td>
      <td>${escapeHtml(e.clockOut) || '—'}</td>
      <td style="font-weight:700;color:${e.totalHours ? 'var(--green)' : 'var(--gray)'}">${escapeHtml(e.totalHours) || '—'}</td>
    </tr>`;
  }).join('');
}

function renderTeamCards(team) {
  const c = document.getElementById('teamCards');
  if (!team || !team.length) {
    c.innerHTML = '<div style="text-align:center;color:var(--gray);padding:1.5rem;font-size:.85rem">No employee data yet</div>';
    return;
  }
  c.innerHTML = team.map(e => {
    const lunch = e.lunchStart ? (e.lunchStart + (e.lunchEnd ? ' - ' + e.lunchEnd : ' (active)')) : '—';
    return `<div class="team-card">
      <div class="team-card-header">
        <span class="team-card-name">${escapeHtml(e.name)}</span>
        <span class="emp-status ${STATUS_CLASSES[e.status] || 'idle'}">${SHORT_STATUS[e.status] || 'Unknown'}</span>
      </div>
      <div style="margin-bottom:.3rem"><span class="brand-tag">${escapeHtml(e.brand)}</span></div>
      <div class="team-card-grid">
        <div><span class="lbl">Clock In</span><br><span class="val">${escapeHtml(e.clockIn) || '—'}</span></div>
        <div><span class="lbl">Clock Out</span><br><span class="val">${escapeHtml(e.clockOut) || '—'}</span></div>
        <div><span class="lbl">Lunch</span><br><span class="val">${escapeHtml(lunch)}</span></div>
        <div><span class="lbl">Total</span><br><span class="val" style="font-weight:700;color:${e.totalHours ? 'var(--green)' : 'var(--gray)'}">${escapeHtml(e.totalHours) || '—'}</span></div>
      </div>
    </div>`;
  }).join('');
}

// ── MESSAGES ──────────────────────────────────────────────────────────────
async function fetchMessages() {
  const btn  = document.getElementById('btnRefreshMessages');
  const icon = btn ? btn.querySelector('.fa-sync-alt') : null;
  if (btn)  btn.disabled = true;
  if (icon) icon.classList.add('spinning');
  document.getElementById('inboxList').innerHTML = '<div class="msg-loading"><i class="fas fa-spinner"></i> Loading…</div>';

  try {
    const signal = abortController('messages');
    const res = await fetch(API.MESSAGES, { signal });
    const raw = await res.json();
    const data = Array.isArray(raw) ? raw[0] : raw;

    if (data.success) {
      if (data.conversations) {
        State.messages.conversations = {};
        const convoList = Array.isArray(data.conversations) ? data.conversations : Object.values(data.conversations);
        convoList.forEach(c => {
          if (State.allowedBrands.length > 0 && !State.allowedBrands.includes(c.brand)) return;
          const expanded = c.msgs.map(m => ({
            messageText: m[0],
            direction: m[1],
            timestamp: m[2],
            messageId: m[3],
            attachmentUrl: m[4],
            attachmentType: m[5],
            senderId: c.senderId,
            senderName: c.senderName,
            brand: c.brand,
            pageId: c.pageId,
            platform: c.platform,
          }));
          State.messages.conversations[c.id] = {
            id: c.id,
            senderId: c.senderId,
            senderName: c.senderName,
            brand: c.brand,
            messages: expanded,
            lastMessage: c.lm,
            lastTime: c.lt,
            unread: expanded.filter(m => m.direction === 'received').length,
          };
        });
        State.messages.all = [];
        Object.values(State.messages.conversations).forEach(c => {
          State.messages.all = State.messages.all.concat(c.messages);
        });
      } else {
        State.messages.all = data.messages || [];
        if (State.allowedBrands.length > 0) {
          State.messages.all = State.messages.all.filter(m => State.allowedBrands.includes(m.brand));
        }
        buildConversationsFromMessages();
      }
      buildBrandFilters();
      renderInbox();
      Toast.info('Messages loaded', `${Object.keys(State.messages.conversations).length} conversations`);
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.error('Messages error:', e);
    Toast.error('Messages Error', 'Could not load messages.');
    document.getElementById('inboxList').innerHTML = '<div class="msg-empty"><i class="fas fa-exclamation-circle" style="font-size:1.2rem;opacity:.4"></i><br>Connection error</div>';
  } finally {
    if (btn)  btn.disabled = false;
    if (icon) icon.classList.remove('spinning');
  }
}

function buildConversationsFromMessages() {
  State.messages.conversations = {};
  const seen = {};
  const filtered = [];

  State.messages.all.forEach(m => {
    if (m.direction === 'sent') {
      const key = m.messageText + '|' + m.brand;
      if (!seen[key]) seen[key] = { count: 0 };
      seen[key].count++;
      if (seen[key].count > 5) return;
    }
    filtered.push(m);
  });

  filtered.forEach(m => {
    const key = m.senderId + '|' + m.brand;
    if (!State.messages.conversations[key]) {
      State.messages.conversations[key] = {
        id: key, senderId: m.senderId, senderName: m.senderName,
        brand: m.brand, messages: [], lastMessage: null, lastTime: null, unread: 0,
      };
    }
    const convo = State.messages.conversations[key];
    convo.messages.push(m);
    if (!convo.lastTime || new Date(m.timestamp) > new Date(convo.lastTime)) {
      convo.lastTime = m.timestamp;
      convo.lastMessage = m.messageText;
    }
    if (m.senderName && m.senderName !== 'Unknown' && m.senderName !== '') convo.senderName = m.senderName;
    if (m.direction === 'received') convo.unread++;
  });
}

function buildBrandFilters() {
  const brandCounts = {};
  Object.values(State.messages.conversations).forEach(c => {
    if (!brandCounts[c.brand]) brandCounts[c.brand] = 0;
    brandCounts[c.brand] += c.messages.length;
  });

  const container = document.getElementById('msgFilters');
  const totalConvos = Object.keys(State.messages.conversations).length;
  container.innerHTML = `<button class="filter-btn ${State.messages.brandFilter === 'all' ? 'active' : ''}" data-brand="all">All <span class="badge">${totalConvos}</span></button>`;

  Object.keys(brandCounts).sort().forEach(brand => {
    const convoCount = Object.values(State.messages.conversations).filter(c => c.brand === brand).length;
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (State.messages.brandFilter === brand ? ' active' : '');
    btn.dataset.brand = brand;
    btn.innerHTML = escapeHtml(brand) + ` <span class="badge">${convoCount}</span>`;
    container.appendChild(btn);
  });
}

function filterMessages(brand, btnEl) {
  State.messages.brandFilter = brand;
  document.querySelectorAll('#msgFilters .filter-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  State.messages.activeConvoId = null;
  renderInbox();
  document.getElementById('chatBody').innerHTML = '<div class="chat-empty"><i class="fas fa-comments" style="font-size:2rem;opacity:.3" aria-hidden="true"></i><span>Select a conversation</span></div>';
  document.getElementById('chatHeader').style.display = 'none';
  document.getElementById('chatReply').classList.remove('active');
}

function searchConversations(query) {
  State.messages.searchQuery = query.trim();
  renderInbox();
}

function renderInbox() {
  const list    = document.getElementById('inboxList');
  const countEl = document.getElementById('msgCount');

  let convos = Object.values(State.messages.conversations);

  if (State.messages.brandFilter !== 'all') {
    convos = convos.filter(c => c.brand === State.messages.brandFilter);
  }

  if (State.messages.searchQuery) {
    const q = State.messages.searchQuery.toLowerCase();
    convos = convos.filter(c => {
      return (c.senderName || '').toLowerCase().includes(q) ||
             (c.lastMessage || '').toLowerCase().includes(q) ||
             (c.brand || '').toLowerCase().includes(q);
    });
  }

  convos.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

  const totalConvos = convos.length;
  const totalMsgs   = convos.reduce((s, c) => s + c.messages.length, 0);
  countEl.textContent = `${totalConvos} conversation${totalConvos !== 1 ? 's' : ''} · ${totalMsgs} messages${State.messages.brandFilter !== 'all' ? ' · ' + State.messages.brandFilter : ''}`;

  if (!convos.length) {
    list.innerHTML = '<div class="msg-empty" style="padding:2rem"><i class="fas fa-comments" style="font-size:1.2rem;opacity:.4;display:block;margin-bottom:.5rem" aria-hidden="true"></i>No conversations</div>';
    return;
  }

  list.innerHTML = convos.map(c => {
    const { name } = getSenderDisplay(c.senderId, c.senderName);
    const initials = getInitials(c.senderName);
    const timeStr  = formatTime(new Date(c.lastTime));
    const preview  = (c.lastMessage || '').length > 45 ? c.lastMessage.substring(0, 45) + '…' : (c.lastMessage || '');
    const isActive = State.messages.activeConvoId === c.id ? ' active' : '';
    return `<div class="inbox-item${isActive}" data-convo-id="${escapeHtml(c.id)}" role="listitem" tabindex="0">
      <div class="inbox-avatar">${initials}</div>
      <div class="inbox-info"><div class="inbox-name">${escapeHtml(name)}</div><div class="inbox-preview">${escapeHtml(preview)}</div></div>
      <div class="inbox-meta"><span class="inbox-time">${timeStr}</span><span class="inbox-brand-tag">${escapeHtml(c.brand)}</span><span class="inbox-msg-count">${c.messages.length}</span></div>
    </div>`;
  }).join('');
}

function openConversation(convoId) {
  State.messages.activeConvoId = convoId;
  const convo = State.messages.conversations[convoId];
  if (!convo) return;

  // Update active state in list
  document.querySelectorAll('.inbox-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.querySelector(`.inbox-item[data-convo-id="${CSS.escape(convoId)}"]`);
  if (activeEl) activeEl.classList.add('active');

  // Header
  const header = document.getElementById('chatHeader');
  header.style.display = 'flex';
  const { name } = getSenderDisplay(convo.senderId, convo.senderName);
  document.getElementById('chatAvatar').innerHTML = getInitials(convo.senderName);
  document.getElementById('chatName').textContent = name;
  document.getElementById('chatBrand').textContent = convo.brand + ' · ' + convo.messages.length + ' messages';
  document.getElementById('btnDeleteConvo').style.display = (State.user && State.user.role === 'admin') ? 'flex' : 'none';

  // Chat body
  const chatBody = document.getElementById('chatBody');
  const msgs = convo.messages.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  let html = '';
  let lastDate = '';

  msgs.forEach(m => {
    const date    = new Date(m.timestamp);
    const timeStr = formatTime(date);
    const dateStr = formatDate(date);
    const dir     = m.direction === 'sent' ? 'sent' : 'received';

    if (dateStr !== lastDate) {
      html += `<div class="msg-date-divider"><span>${dateStr}</span></div>`;
      lastDate = dateStr;
    }

    // Attachment
    let attachHtml = '';
    if (m.attachmentUrl) {
      const aType = m.attachmentType || 'image';
      if (aType === 'audio') {
        attachHtml = `<audio controls style="max-width:240px;margin-bottom:.3rem" preload="none"><source src="${escapeHtml(m.attachmentUrl)}">Audio not supported</audio><div class="msg-img-expired" style="display:none"><i class="fas fa-microphone" style="margin-right:4px" aria-hidden="true"></i>Audio expired</div>`;
      } else if (aType === 'video') {
        attachHtml = `<video controls style="max-width:260px;max-height:200px;border-radius:8px;margin-bottom:.3rem" preload="none"><source src="${escapeHtml(m.attachmentUrl)}">Video not supported</video><div class="msg-img-expired" style="display:none"><i class="fas fa-video" style="margin-right:4px" aria-hidden="true"></i>Video expired</div>`;
      } else if (aType === 'file') {
        attachHtml = `<a href="${escapeHtml(m.attachmentUrl)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:.4rem;padding:.4rem .7rem;background:var(--accent-glow);border:1px solid rgba(59,130,246,.3);border-radius:8px;color:var(--accent);font-size:.78rem;font-weight:600;text-decoration:none;margin-bottom:.3rem"><i class="fas fa-file-download" aria-hidden="true"></i> Download File</a>`;
      } else {
        attachHtml = `<img class="msg-bubble-img" src="${escapeHtml(m.attachmentUrl)}" alt="Photo" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="msg-img-expired" style="display:none"><i class="fas fa-image" style="margin-right:4px" aria-hidden="true"></i>Image expired</div>`;
      }
    }

    const msgText = m.messageText || '';
    const textHtml = (msgText && !(m.attachmentUrl && ATTACHMENT_PLACEHOLDERS.includes(msgText)))
      ? `<div class="msg-bubble-text">${escapeHtml(msgText)}</div>`
      : '';

    html += `<div class="msg-row ${dir}"><div class="msg-bubble">${attachHtml}${textHtml}<div class="msg-bubble-footer"><span class="msg-bubble-time">${dir === 'sent' ? '<i class="fas fa-reply" style="font-size:.45rem;margin-right:2px" aria-hidden="true"></i> ' : ''}${timeStr}</span></div></div></div>`;
  });

  chatBody.innerHTML = html;
  chatBody.scrollTop = chatBody.scrollHeight;

  document.getElementById('chatReply').classList.add('active');
  document.getElementById('replyInput').value = '';
}

async function deleteConversation() {
  if (!State.messages.activeConvoId || !State.user || State.user.role !== 'admin') return;

  const convo = State.messages.conversations[State.messages.activeConvoId];
  if (!convo) return;

  const { name } = getSenderDisplay(convo.senderId, convo.senderName);
  if (!confirm(`Delete conversation with ${name} (${convo.messages.length} messages)?\n\nThis will hide the conversation from the dashboard.`)) return;

  const btn = document.getElementById('btnDeleteConvo');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    const signal = abortController('deleteConvo');
    const messageIds = convo.messages.map(m => m.messageId);
    const res = await fetch(API.DELETE_MESSAGES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageIds, senderId: convo.senderId, brand: convo.brand }),
      signal,
    });
    const raw = await res.json();
    const data = Array.isArray(raw) ? raw[0] : raw;

    if (data.success) {
      delete State.messages.conversations[State.messages.activeConvoId];
      State.messages.activeConvoId = null;
      buildBrandFilters();
      renderInbox();
      document.getElementById('chatBody').innerHTML = '<div class="chat-empty"><i class="fas fa-trash-alt" style="font-size:2rem;opacity:.3" aria-hidden="true"></i><span>Conversation deleted</span></div>';
      document.getElementById('chatHeader').style.display = 'none';
      document.getElementById('chatReply').classList.remove('active');
      Toast.success('Deleted', `Conversation with ${name} removed.`);
    } else {
      Toast.error('Delete failed', 'Could not delete conversation.');
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.error('Delete error:', e);
    Toast.error('Connection Error', 'Could not delete. Try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-trash-alt"></i>';
  }
}

async function sendReply() {
  if (!State.messages.activeConvoId) return;
  const convo = State.messages.conversations[State.messages.activeConvoId];
  if (!convo) return;

  const input = document.getElementById('replyInput');
  const text  = input.value.trim();
  if (!text) return;

  const btn = document.getElementById('btnSend');
  btn.disabled = true;
  input.disabled = true;

  const pageId = convo.messages[0] ? convo.messages[0].pageId : BRAND_TO_PAGE_ID[convo.brand];

  try {
    const signal = abortController('send');
    const res = await fetch(API.SEND_MESSAGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId, senderId: convo.senderId, messageText: text }),
      signal,
    });
    const raw = await res.json();
    const data = Array.isArray(raw) ? raw[0] : raw;

    if (data.success) {
      const now = new Date().toISOString();
      convo.messages.push({
        timestamp: now, brand: convo.brand, pageId,
        senderId: convo.senderId, messageText: text,
        messageId: data.messageId || 'sent_' + Date.now(),
        platform: 'Messenger', direction: 'sent', senderName: convo.senderName,
      });
      convo.lastMessage = text;
      convo.lastTime = now;
      openConversation(State.messages.activeConvoId);
      renderInbox();
      input.value = '';
    } else {
      Toast.error('Send failed', data.error || 'Unknown error');
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.error('Send error:', e);
    Toast.error('Connection Error', 'Message not sent. Try again.');
  } finally {
    btn.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

// ── FACEBOOK COMMENTS ────────────────────────────────────────────────────
async function fetchFbComments() {
  const btn  = document.getElementById('btnRefreshComments');
  const icon = btn ? btn.querySelector('.fa-sync-alt') : null;
  if (btn)  btn.disabled = true;
  if (icon) icon.classList.add('spinning');
  document.getElementById('commentsList').innerHTML = '<div class="msg-loading"><i class="fas fa-spinner"></i> Loading comments…</div>';

  try {
    const signal = abortController('comments');
    const res = await fetch(API.FB_COMMENTS, { signal });
    const raw = await res.json();
    const data = Array.isArray(raw) ? raw[0] : raw;

    if (data.success) {
      State.comments.all = data.comments || [];
      if (State.allowedBrands.length > 0) {
        State.comments.all = State.comments.all.filter(c => State.allowedBrands.includes(c.brand));
      }
      buildCommentFilters();
      renderComments();
      Toast.info('Comments loaded', `${State.comments.all.length} comments`);
    } else {
      document.getElementById('commentsList').innerHTML = '<div class="msg-empty"><i class="fas fa-exclamation-circle" style="font-size:1rem;opacity:.4" aria-hidden="true"></i><br>Could not load comments</div>';
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.error('Comments error:', e);
    Toast.error('Comments Error', 'Could not load comments.');
    document.getElementById('commentsList').innerHTML = '<div class="msg-empty"><i class="fas fa-exclamation-circle" style="font-size:1rem;opacity:.4" aria-hidden="true"></i><br>Connection error</div>';
  } finally {
    if (btn)  btn.disabled = false;
    if (icon) icon.classList.remove('spinning');
  }
}

function buildCommentFilters() {
  const brandCounts = {};
  State.comments.all.forEach(c => {
    if (!brandCounts[c.brand]) brandCounts[c.brand] = 0;
    brandCounts[c.brand]++;
  });

  const container = document.getElementById('commentFilters');
  container.innerHTML = `<button class="filter-btn ${State.comments.filter === 'all' ? 'active' : ''}" data-comment-brand="all">All Pages <span class="badge">${State.comments.all.length}</span></button>`;

  Object.keys(brandCounts).sort().forEach(brand => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (State.comments.filter === brand ? ' active' : '');
    btn.dataset.commentBrand = brand;
    btn.innerHTML = escapeHtml(brand) + ` <span class="badge">${brandCounts[brand]}</span>`;
    container.appendChild(btn);
  });
}

function filterComments(brand, btnEl) {
  State.comments.filter = brand;
  document.querySelectorAll('#commentFilters .filter-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderComments();
}

function renderComments() {
  const list    = document.getElementById('commentsList');
  const countEl = document.getElementById('commentCount');

  let comments = State.comments.all;
  if (State.comments.filter !== 'all') {
    comments = comments.filter(c => c.brand === State.comments.filter);
  }
  comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  countEl.textContent = `${comments.length} comment${comments.length !== 1 ? 's' : ''}${State.comments.filter !== 'all' ? ' · ' + State.comments.filter : ''}`;

  if (!comments.length) {
    list.innerHTML = '<div class="msg-empty" style="padding:2rem"><i class="fas fa-comment-dots" style="font-size:1.2rem;opacity:.4;display:block;margin-bottom:.5rem" aria-hidden="true"></i>No comments found</div>';
    return;
  }

  list.innerHTML = comments.map(c => {
    const date    = new Date(c.timestamp);
    const timeStr = formatDate(date) + ' · ' + formatTime(date);
    const name    = (c.commenterName && c.commenterName !== 'Unknown') ? c.commenterName : 'Facebook User';
    const initials = name !== 'Facebook User' ? getInitials(name) : '<i class="fas fa-user"></i>';
    const postPreview = (c.postText || '').length > 100 ? c.postText.substring(0, 100) + '…' : (c.postText || '');

    return `<div class="comment-card">
      <div class="comment-card-header"><span class="comment-card-brand"><i class="fab fa-facebook" style="margin-right:3px" aria-hidden="true"></i> ${escapeHtml(c.brand)}</span><span class="comment-card-time">${timeStr}</span></div>
      ${postPreview ? `<div class="comment-card-post">${escapeHtml(postPreview)}</div>` : ''}
      <div class="comment-card-body">
        <div class="comment-card-avatar">${initials}</div>
        <div class="comment-card-content"><div class="comment-card-name">${escapeHtml(name)}</div><div class="comment-card-text">${escapeHtml(c.commentText)}</div></div>
      </div>
    </div>`;
  }).join('');
}

// ── AI AGENT ──────────────────────────────────────────────────────────────
function toggleAgentChat() {
  State.agent.open = !State.agent.open;
  const panel = document.getElementById('agentPanel');
  const fab   = document.getElementById('agentFab');

  if (State.agent.open) {
    panel.style.display = 'flex';
    setTimeout(() => panel.classList.add('open'), 10);
    fab.innerHTML = '<i class="fas fa-times"></i>';
    if (State.agent.messages.length === 0) {
      addAgentMessage('bot', "👋 Hi! I'm ZoomAI. Ask me anything about today's messages, unanswered clients, or page activity.\n\n💡 Try: *\"Who hasn't been answered today?\"*");
    }
    setTimeout(() => document.getElementById('agentInput').focus(), 300);
  } else {
    closeAgentChat();
  }
}

function closeAgentChat() {
  State.agent.open = false;
  const panel = document.getElementById('agentPanel');
  const fab   = document.getElementById('agentFab');
  if (panel) {
    panel.classList.remove('open');
    setTimeout(() => { panel.style.display = 'none'; }, 300);
  }
  if (fab) fab.innerHTML = '<i class="fas fa-robot"></i>';
}

function addAgentMessage(role, text) {
  State.agent.messages.push({ role, text });
  renderAgentMessages();
}

function renderAgentMessages() {
  const body = document.getElementById('agentBody');
  if (!body) return;

  body.innerHTML = State.agent.messages.map(m => {
    const isBot = m.role === 'bot';
    const escaped = m.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const formatted = escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    return `<div class="agent-msg ${isBot ? 'bot' : 'user'}">
      ${isBot ? '<div class="agent-msg-avatar" aria-hidden="true"><i class="fas fa-robot"></i></div>' : ''}
      <div class="agent-msg-bubble">${formatted}</div>
    </div>`;
  }).join('');

  body.scrollTop = body.scrollHeight;
}

async function sendAgentMessage() {
  const input        = document.getElementById('agentInput');
  const btn          = document.getElementById('agentSendBtn');
  const periodSelect = document.getElementById('agentPeriod');
  const text         = input.value.trim();
  const period       = periodSelect ? periodSelect.value : 'today';
  if (!text) return;

  addAgentMessage('user', text);
  input.value = '';
  btn.disabled = true;

  const body     = document.getElementById('agentBody');
  const typingId = 'agent-typing-' + Date.now();
  body.innerHTML += `<div class="agent-msg bot" id="${typingId}">
    <div class="agent-msg-avatar" aria-hidden="true"><i class="fas fa-robot"></i></div>
    <div class="agent-msg-bubble agent-typing"><span></span><span></span><span></span></div>
  </div>`;
  body.scrollTop = body.scrollHeight;

  try {
    const signal = abortController('agent');
    const res = await fetch(API.AI_AGENT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text, userBrands: State.allowedBrands, period }),
      signal,
    });
    const rawText = await res.text();
    const data    = JSON.parse(rawText);
    const el      = document.getElementById(typingId);
    if (el) el.remove();

    addAgentMessage('bot', data.answer || 'Sorry, I could not get a response.');
  } catch (e) {
    if (e.name === 'AbortError') return;
    const el = document.getElementById(typingId);
    if (el) el.remove();
    addAgentMessage('bot', 'Connection error. Please try again.');
    Toast.error('AI Agent', 'Could not reach the assistant.');
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

// ── EVENT DELEGATION ─────────────────────────────────────────────────────
function setupEventListeners() {
  // Login button
  document.getElementById('loginBtn').addEventListener('click', doLogin);

  // Logout button
  document.getElementById('btnLogout').addEventListener('click', doLogout);

  // Enter key on login
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none') {
      doLogin();
    }
  });

  // Clock action buttons (delegation)
  document.querySelector('.clock-grid').addEventListener('click', e => {
    const btn = e.target.closest('.clock-btn');
    if (btn && !btn.disabled) {
      doAction(btn.dataset.action);
    }
  });

  // Refresh team
  document.getElementById('btnRefreshTeam').addEventListener('click', fetchTeamStatus);

  // Comms tabs (delegation)
  document.querySelector('.comms-tabs').addEventListener('click', e => {
    const tab = e.target.closest('.comms-tab');
    if (tab) switchCommsTab(tab.dataset.tab);
  });

  // Refresh messages
  document.getElementById('btnRefreshMessages').addEventListener('click', fetchMessages);

  // Message search
  const searchInput = document.getElementById('msgSearch');
  const clearBtn    = document.getElementById('btnClearSearch');
  let searchTimeout = null;

  searchInput.addEventListener('input', () => {
    clearBtn.style.display = searchInput.value ? 'block' : 'none';
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchConversations(searchInput.value), 200);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    searchConversations('');
    searchInput.focus();
  });

  // Brand filters for messages (delegation)
  document.getElementById('msgFilters').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (btn) filterMessages(btn.dataset.brand, btn);
  });

  // Inbox list — EVENT DELEGATION (no more inline onclick)
  document.getElementById('inboxList').addEventListener('click', e => {
    const item = e.target.closest('.inbox-item');
    if (item && item.dataset.convoId) {
      openConversation(item.dataset.convoId);
    }
  });

  // Keyboard support for inbox items
  document.getElementById('inboxList').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const item = e.target.closest('.inbox-item');
      if (item && item.dataset.convoId) {
        e.preventDefault();
        openConversation(item.dataset.convoId);
      }
    }
  });

  // Delete conversation
  document.getElementById('btnDeleteConvo').addEventListener('click', deleteConversation);

  // Send reply
  document.getElementById('btnSend').addEventListener('click', sendReply);
  document.getElementById('replyInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendReply();
    }
  });

  // Facebook comments
  document.getElementById('btnRefreshComments').addEventListener('click', fetchFbComments);
  document.getElementById('commentFilters').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (btn) filterComments(btn.dataset.commentBrand, btn);
  });

  // AI Agent
  document.getElementById('agentFab').addEventListener('click', toggleAgentChat);
  document.getElementById('agentClose').addEventListener('click', closeAgentChat);
  document.getElementById('agentSendBtn').addEventListener('click', sendAgentMessage);
  document.getElementById('agentInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAgentMessage();
    }
  });
}

// ── INITIALIZATION ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Dynamic copyright year
  const yearEl = document.getElementById('copyrightYear');
  if (yearEl) yearEl.textContent = '© ' + new Date().getFullYear();

  // Initialize toast system
  Toast.init();

  // Start clock
  updateClock();
  setInterval(updateClock, 1000);

  // Setup all event listeners (event delegation)
  setupEventListeners();

  // Check for existing session
  checkSession();
});
