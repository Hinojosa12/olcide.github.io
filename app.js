// ── API ENDPOINTS ─────────────────────────────────────────────────────────
const API = {
  LOGIN:           'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-login',
  ATTENDANCE:      'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-attendance',
  TEAM_STATUS:     'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-team-status',
  MESSAGES:        'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-messages',
  DELETE_MESSAGES: 'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-delete-messages',
  SEND_MESSAGE:    'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-send-message',
  FB_COMMENTS:     'https://n8n-n8n.7toway.easypanel.host/webhook/caribzoom-fb-comments',
};

// ── STATE ─────────────────────────────────────────────────────────────────
let currentUser       = null;
let myStatus          = 'idle';
let activityLog       = [];
let teamPollInterval  = null;
let userAllowedBrands = [];
let commentsLoaded    = false;

// ── CLOCK ─────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const el  = document.getElementById('liveTime');
  const dl  = document.getElementById('liveDate');
  if (el) el.textContent = now.toLocaleTimeString('en-US', { hour12: true,  timeZone: 'America/Guyana' });
  if (dl) dl.textContent = now.toLocaleDateString ('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'America/Guyana' });
}
setInterval(updateClock, 1000);
updateClock();

// ── AUTH ──────────────────────────────────────────────────────────────────
async function doLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');
  if (!email || !password) { errEl.textContent = 'Please enter email and password.'; return; }
  btn.disabled = true; btn.textContent = 'Signing in…'; errEl.textContent = '';
  try {
    const res  = await fetch(API.LOGIN, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email, password }) });
    const data = await res.json();
    if (data.success) { currentUser = data.user; sessionStorage.setItem('caribzoom_user', JSON.stringify(currentUser)); showDashboard(); }
    else { errEl.textContent = data.message || 'Login failed.'; }
  } catch (e) { errEl.textContent = 'Connection error. Please try again.'; }
  btn.disabled = false; btn.textContent = 'Sign In';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none') doLogin();
});

function doLogout() {
  currentUser = null; myStatus = 'idle'; activityLog = []; userAllowedBrands = []; commentsLoaded = false;
  if (teamPollInterval) { clearInterval(teamPollInterval); teamPollInterval = null; }
  sessionStorage.removeItem('caribzoom_user');
  document.getElementById('loginScreen').style.display  = 'flex';
  document.getElementById('dashboard').style.display    = 'none';
  document.getElementById('adminSection').style.display = 'none';
  document.getElementById('commsSection').style.display = 'none';
  document.getElementById('loginEmail').value    = '';
  document.getElementById('loginPassword').value = '';
}

// ── BRAND / PERMISSION HELPERS ────────────────────────────────────────────
function getUserAllowedBrands() {
  if (!currentUser) return [];
  const mb = (currentUser.messageBrands || '').trim();
  if (!mb || mb.toLowerCase() === 'all') return [];
  return mb.split(',').map(b => b.trim()).filter(Boolean);
}

function canSeeMessages() {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  return (currentUser.messageBrands || '').trim().length > 0;
}

// ── DASHBOARD INIT ────────────────────────────────────────────────────────
function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboard').style.display   = 'block';
  document.getElementById('dashName').textContent  = currentUser.name;
  document.getElementById('dashRole').textContent  = currentUser.role.toUpperCase() + ' · ' + currentUser.brand.toUpperCase();
  document.getElementById('dashAvatar').textContent = currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  if (currentUser.role === 'admin') {
    document.getElementById('adminSection').style.display = 'block';
    fetchTeamStatus();
  } else {
    document.getElementById('adminSection').style.display = 'none';
  }

  userAllowedBrands = getUserAllowedBrands();
  if (canSeeMessages()) {
    document.getElementById('commsSection').style.display = 'block';
    switchCommsTab('messages');
    fetchMessages();
  } else {
    document.getElementById('commsSection').style.display = 'none';
  }

  myStatus = 'idle'; activityLog = []; commentsLoaded = false;
  renderLog(); updateButtons(); updateStatusBadge();
}

// ── COMMS TAB SWITCHER ────────────────────────────────────────────────────
function switchCommsTab(tab) {
  const tabMessages = document.getElementById('tabMessages');
  const tabComments = document.getElementById('tabComments');
  const panelMessages = document.getElementById('panelMessages');
  const panelComments = document.getElementById('panelComments');

  if (tab === 'messages') {
    tabMessages.classList.add('active');
    tabComments.classList.remove('active');
    panelMessages.style.display = 'block';
    panelComments.style.display = 'none';
  } else {
    tabMessages.classList.remove('active');
    tabComments.classList.add('active');
    panelMessages.style.display = 'none';
    panelComments.style.display = 'block';
    if (!commentsLoaded) {
      fetchFbComments();
      commentsLoaded = true;
    }
  }
}

// ── CLOCK ACTIONS ─────────────────────────────────────────────────────────
async function doAction(action) {
  document.querySelectorAll('.clock-btn').forEach(b => b.disabled = true);
  try {
    const res  = await fetch(API.ATTENDANCE, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action, employeeId:currentUser.id, name:currentUser.name, brand:currentUser.brand }) });
    const data = await res.json();
    if (data.success) {
      const statusMap = { clockIn:'online', lunchStart:'on-lunch', lunchEnd:'online', clockOut:'out' };
      const labelMap  = { clockIn:'Clocked In', lunchStart:'Started Lunch', lunchEnd:'Ended Lunch', clockOut:'Clocked Out' };
      myStatus = statusMap[action];
      addLogEntry(data.time || new Date().toLocaleTimeString('en-US', { hour12:false, timeZone:'America/Guyana' }), labelMap[action], currentUser.name);
      updateButtons(); updateStatusBadge();
      if (currentUser.role === 'admin') fetchTeamStatus();
    }
  } catch (e) { console.error('Action error:', e); }
  setTimeout(() => updateButtons(), 100);
}

function updateButtons() {
  const ci = document.getElementById('btnClockIn');
  const ls = document.getElementById('btnLunchStart');
  const le = document.getElementById('btnLunchEnd');
  const co = document.getElementById('btnClockOut');
  [ci, ls, le, co].forEach(b => b.disabled = true);
  if      (myStatus === 'idle')     ci.disabled = false;
  else if (myStatus === 'online')  { ls.disabled = false; co.disabled = false; }
  else if (myStatus === 'on-lunch') le.disabled = false;
}

function updateStatusBadge() {
  const badge   = document.getElementById('myStatusBadge');
  const labels  = { idle:'Not Clocked In', online:'Online', 'on-lunch':'On Lunch', out:'Clocked Out' };
  const classes = { idle:'idle', online:'online', 'on-lunch':'on-lunch', out:'offline' };
  badge.className = 'status-badge ' + classes[myStatus];
  badge.innerHTML = '<i class="fas fa-circle" style="font-size:.45rem"></i> ' + labels[myStatus];
}

// ── ACTIVITY LOG ──────────────────────────────────────────────────────────
function addLogEntry(time, action, name) { activityLog.unshift({ time, action, name }); renderLog(); }

function renderLog() {
  const list = document.getElementById('logList');
  if (!activityLog.length) {
    list.innerHTML = '<div class="log-item" style="justify-content:center;color:var(--gray)">No activity recorded yet</div>';
    return;
  }
  list.innerHTML = activityLog.slice(0, 20).map(l =>
    `<div class="log-item"><span class="log-time">${l.time}</span><span class="log-action">${l.action}</span><span class="log-name">— ${l.name}</span></div>`
  ).join('');
}

// ── TEAM STATUS ───────────────────────────────────────────────────────────
async function fetchTeamStatus() {
  if (!currentUser || currentUser.role !== 'admin') return;
  const btn  = document.getElementById('btnRefreshTeam');
  const icon = btn ? btn.querySelector('.fa-sync-alt') : null;
  if (btn)  btn.disabled = true;
  if (icon) icon.classList.add('spinning');
  try {
    const res  = await fetch(API.TEAM_STATUS);
    const data = await res.json();
    if (data.success) {
      renderTeamCounts(data.counts);
      renderTeamTable(data.team);
      renderTeamCards(data.team);
      const now = new Date().toLocaleTimeString('en-US', { hour12:true, timeZone:'America/Guyana' });
      const el  = document.getElementById('teamLastUpdate');
      if (el) el.textContent = 'Last updated: ' + now;
    }
  } catch (e) { console.error('Team status error:', e); }
  if (btn)  btn.disabled = false;
  if (icon) icon.classList.remove('spinning');
}

function refreshTeam() { fetchTeamStatus(); }

function renderTeamCounts(c) {
  document.getElementById('countActive').textContent = c.active || 0;
  document.getElementById('countLunch').textContent  = c.lunch  || 0;
  document.getElementById('countIdle').textContent   = c.idle   || 0;
  document.getElementById('countOut').textContent    = c.out    || 0;
}

function renderTeamTable(team) {
  const tbody = document.getElementById('teamBody');
  if (!team || !team.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:2rem">No employee data yet</td></tr>'; return; }
  const sl = { online:'Online', 'on-lunch':'On Lunch', idle:'Not Clocked In', out:'Clocked Out' };
  const sc = { online:'online', 'on-lunch':'on-lunch', idle:'idle', out:'offline' };
  tbody.innerHTML = team.map(e => {
    const lunch = e.lunchStart ? (e.lunchStart + (e.lunchEnd ? ' - ' + e.lunchEnd : ' (active)')) : '—';
    return `<tr>
      <td style="font-weight:600;color:var(--white)">${e.name}</td>
      <td><span class="brand-tag">${e.brand}</span></td>
      <td><span class="emp-status ${sc[e.status]||'idle'}">${sl[e.status]||'Unknown'}</span></td>
      <td>${e.clockIn||'—'}</td>
      <td>${lunch}</td>
      <td>${e.clockOut||'—'}</td>
      <td style="font-weight:700;color:${e.totalHours?'var(--green)':'var(--gray)'}">${e.totalHours||'—'}</td>
    </tr>`;
  }).join('');
}

function renderTeamCards(team) {
  const c = document.getElementById('teamCards');
  if (!team || !team.length) { c.innerHTML = '<div style="text-align:center;color:var(--gray);padding:1.5rem;font-size:.85rem">No employee data yet</div>'; return; }
  const sl = { online:'Online', 'on-lunch':'On Lunch', idle:'Not Clocked In', out:'Clocked Out' };
  const sc = { online:'online', 'on-lunch':'on-lunch', idle:'idle', out:'offline' };
  c.innerHTML = team.map(e => {
    const lunch = e.lunchStart ? (e.lunchStart + (e.lunchEnd ? ' - ' + e.lunchEnd : ' (active)')) : '—';
    return `<div class="team-card">
      <div class="team-card-header">
        <span class="team-card-name">${e.name}</span>
        <span class="emp-status ${sc[e.status]||'idle'}">${sl[e.status]||'Unknown'}</span>
      </div>
      <div style="margin-bottom:.3rem"><span class="brand-tag">${e.brand}</span></div>
      <div class="team-card-grid">
        <div><span class="lbl">Clock In</span><br><span class="val">${e.clockIn||'—'}</span></div>
        <div><span class="lbl">Clock Out</span><br><span class="val">${e.clockOut||'—'}</span></div>
        <div><span class="lbl">Lunch</span><br><span class="val">${lunch}</span></div>
        <div><span class="lbl">Total</span><br><span class="val" style="font-weight:700;color:${e.totalHours?'var(--green)':'var(--gray)'}">${e.totalHours||'—'}</span></div>
      </div>
    </div>`;
  }).join('');
}

// ── MESSAGES ──────────────────────────────────────────────────────────────
let allMessages        = [];
let currentBrandFilter = 'all';
let conversations      = {};
let activeConvoId      = null;

const brandToPageId = {
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

async function fetchMessages() {
  const btn  = document.getElementById('btnRefreshMessages');
  const icon = btn ? btn.querySelector('.fa-sync-alt') : null;
  if (btn)  btn.disabled = true;
  if (icon) icon.classList.add('spinning');
  document.getElementById('inboxList').innerHTML = '<div class="msg-loading"><i class="fas fa-spinner"></i> Loading…</div>';
  try {
    const res  = await fetch(API.MESSAGES);
    const raw  = await res.json();
    const data = Array.isArray(raw) ? raw[0] : raw;
    if (data.success) {
      allMessages = data.messages || [];
      if (userAllowedBrands.length > 0) allMessages = allMessages.filter(m => userAllowedBrands.includes(m.brand));
      buildConversations();
      buildBrandFilters();
      renderInbox();
    }
  } catch (e) { console.error('Messages error:', e); }
  if (btn)  btn.disabled = false;
  if (icon) icon.classList.remove('spinning');
}

function buildConversations() {
  conversations = {};
  const seen = {}, filtered = [];
  allMessages.forEach(m => {
    if (m.direction === 'sent') {
      const key = m.messageText + '|' + m.brand;
      if (!seen[key]) seen[key] = { count:0 };
      seen[key].count++;
      if (seen[key].count > 5) return;
    }
    filtered.push(m);
  });
  filtered.forEach(m => {
    const key = m.senderId + '|' + m.brand;
    if (!conversations[key]) conversations[key] = { id:key, senderId:m.senderId, senderName:m.senderName, brand:m.brand, messages:[], lastMessage:null, lastTime:null, unread:0 };
    const convo = conversations[key];
    convo.messages.push(m);
    if (!convo.lastTime || new Date(m.timestamp) > new Date(convo.lastTime)) { convo.lastTime = m.timestamp; convo.lastMessage = m.messageText; }
    if (m.senderName && m.senderName !== 'Unknown' && m.senderName !== '') convo.senderName = m.senderName;
    if (m.direction === 'received') convo.unread++;
  });
}

function buildBrandFilters() {
  const brandCounts = {};
  Object.values(conversations).forEach(c => { if (!brandCounts[c.brand]) brandCounts[c.brand] = 0; brandCounts[c.brand] += c.messages.length; });
  const container = document.getElementById('msgFilters');
  container.innerHTML = `<button class="filter-btn active" data-brand="all" onclick="filterMessages('all',this)">All <span class="badge">${Object.keys(conversations).length}</span></button>`;
  Object.keys(brandCounts).sort().forEach(brand => {
    const convoCount = Object.values(conversations).filter(c => c.brand === brand).length;
    const btn = document.createElement('button');
    btn.className = 'filter-btn'; btn.dataset.brand = brand;
    btn.innerHTML = escapeHtml(brand) + ` <span class="badge">${convoCount}</span>`;
    btn.onclick = function() { filterMessages(brand, this); };
    container.appendChild(btn);
  });
}

function filterMessages(brand, btnEl) {
  currentBrandFilter = brand;
  document.querySelectorAll('#msgFilters .filter-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  activeConvoId = null; renderInbox();
  document.getElementById('chatBody').innerHTML = '<div class="chat-empty"><i class="fas fa-comments" style="font-size:2rem;opacity:.3"></i><span>Select a conversation</span></div>';
  document.getElementById('chatHeader').style.display = 'none';
  document.getElementById('chatReply').classList.remove('active');
}

function renderInbox() {
  const list = document.getElementById('inboxList'), countEl = document.getElementById('msgCount');
  let convos = Object.values(conversations);
  if (currentBrandFilter !== 'all') convos = convos.filter(c => c.brand === currentBrandFilter);
  convos.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
  const totalConvos = convos.length, totalMsgs = convos.reduce((s, c) => s + c.messages.length, 0);
  countEl.textContent = `${totalConvos} conversation${totalConvos !== 1 ? 's' : ''} · ${totalMsgs} messages${currentBrandFilter !== 'all' ? ' · ' + currentBrandFilter : ''}`;
  if (!convos.length) { list.innerHTML = '<div class="msg-empty" style="padding:2rem"><i class="fas fa-comments" style="font-size:1.2rem;opacity:.4;display:block;margin-bottom:.5rem"></i>No conversations</div>'; return; }
  list.innerHTML = convos.map(c => {
    const senderShort = c.senderId ? c.senderId.slice(-6) : '???';
    const name = (c.senderName && c.senderName !== 'Unknown' && c.senderName !== '') ? c.senderName : 'User …' + senderShort;
    const initials = (c.senderName && c.senderName !== 'Unknown' && c.senderName !== '') ? c.senderName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '<i class="fas fa-user"></i>';
    const date = new Date(c.lastTime);
    const timeStr = date.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'America/Guyana' });
    const preview = (c.lastMessage || '').length > 45 ? c.lastMessage.substring(0, 45) + '…' : (c.lastMessage || '');
    const isActive = activeConvoId === c.id ? ' active' : '';
    return `<div class="inbox-item${isActive}" onclick="openConversation('${c.id.replace(/'/g, "\\'")}')">
      <div class="inbox-avatar">${initials}</div>
      <div class="inbox-info"><div class="inbox-name">${escapeHtml(name)}</div><div class="inbox-preview">${escapeHtml(preview)}</div></div>
      <div class="inbox-meta"><span class="inbox-time">${timeStr}</span><span class="inbox-brand-tag">${escapeHtml(c.brand)}</span><span class="inbox-msg-count">${c.messages.length}</span></div>
    </div>`;
  }).join('');
}

function openConversation(convoId) {
  activeConvoId = convoId;
  const convo = conversations[convoId];
  if (!convo) return;
  document.querySelectorAll('.inbox-item').forEach(el => el.classList.remove('active'));
  let convos = Object.values(conversations);
  if (currentBrandFilter !== 'all') convos = convos.filter(c => c.brand === currentBrandFilter);
  convos.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
  const idx = convos.findIndex(c => c.id === convoId);
  const items = document.querySelectorAll('.inbox-item');
  if (idx >= 0 && items[idx]) items[idx].classList.add('active');
  const header = document.getElementById('chatHeader'); header.style.display = 'flex';
  const senderShort = convo.senderId ? convo.senderId.slice(-6) : '???';
  const name = (convo.senderName && convo.senderName !== 'Unknown' && convo.senderName !== '') ? convo.senderName : 'User …' + senderShort;
  const initials = (convo.senderName && convo.senderName !== 'Unknown' && convo.senderName !== '') ? convo.senderName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '<i class="fas fa-user"></i>';
  document.getElementById('chatAvatar').innerHTML = initials;
  document.getElementById('chatName').textContent = name;
  document.getElementById('chatBrand').textContent = convo.brand + ' · ' + convo.messages.length + ' messages';
  document.getElementById('btnDeleteConvo').style.display = (currentUser && currentUser.role === 'admin') ? 'flex' : 'none';
  const chatBody = document.getElementById('chatBody');
  const msgs = convo.messages.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let html = '', lastDate = '';
  const placeholders = ['📎 Attachment','📷 Photo','🎵 Audio','🎬 Video','📄 File'];
  msgs.forEach(m => {
    const date = new Date(m.timestamp);
    const timeStr = date.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'America/Guyana' });
    const dateStr = date.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', timeZone:'America/Guyana' });
    const dir = m.direction === 'sent' ? 'sent' : 'received';
    if (dateStr !== lastDate) { html += `<div class="msg-date-divider"><span>${dateStr}</span></div>`; lastDate = dateStr; }
    let attachHtml = '';
    if (m.attachmentUrl) {
      const aType = m.attachmentType || 'image';
      if (aType === 'audio') attachHtml = `<audio controls style="max-width:240px;margin-bottom:.3rem" preload="none"><source src="${escapeHtml(m.attachmentUrl)}">Audio not supported</audio><div class="msg-img-expired" style="display:none"><i class="fas fa-microphone" style="margin-right:4px"></i>Audio expired</div>`;
      else if (aType === 'video') attachHtml = `<video controls style="max-width:260px;max-height:200px;border-radius:8px;margin-bottom:.3rem" preload="none"><source src="${escapeHtml(m.attachmentUrl)}">Video not supported</video><div class="msg-img-expired" style="display:none"><i class="fas fa-video" style="margin-right:4px"></i>Video expired</div>`;
      else if (aType === 'file') attachHtml = `<a href="${escapeHtml(m.attachmentUrl)}" target="_blank" style="display:inline-flex;align-items:center;gap:.4rem;padding:.4rem .7rem;background:var(--accent-glow);border:1px solid rgba(59,130,246,.3);border-radius:8px;color:var(--accent);font-size:.78rem;font-weight:600;text-decoration:none;margin-bottom:.3rem"><i class="fas fa-file-download"></i> Download File</a>`;
      else attachHtml = `<img class="msg-bubble-img" src="${escapeHtml(m.attachmentUrl)}" alt="Photo" onclick="window.open(this.src,'_blank')" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="msg-img-expired" style="display:none"><i class="fas fa-image" style="margin-right:4px"></i>Image expired</div>`;
    }
    const msgText = m.messageText || '';
    const textHtml = (msgText && !(m.attachmentUrl && placeholders.includes(msgText))) ? `<div class="msg-bubble-text">${escapeHtml(msgText)}</div>` : '';
    html += `<div class="msg-row ${dir}"><div class="msg-bubble">${attachHtml}${textHtml}<div class="msg-bubble-footer"><span class="msg-bubble-time">${dir === 'sent' ? '<i class="fas fa-reply" style="font-size:.45rem;margin-right:2px"></i> ' : ''}${timeStr}</span></div></div></div>`;
  });
  chatBody.innerHTML = html; chatBody.scrollTop = chatBody.scrollHeight;
  document.getElementById('chatReply').classList.add('active');
  document.getElementById('replyInput').value = '';
}

async function deleteConversation() {
  if (!activeConvoId || !currentUser || currentUser.role !== 'admin') return;
  const convo = conversations[activeConvoId]; if (!convo) return;
  const senderShort = convo.senderId ? convo.senderId.slice(-6) : '???';
  const name = (convo.senderName && convo.senderName !== 'Unknown') ? convo.senderName : 'User …' + senderShort;
  if (!confirm(`Delete conversation with ${name} (${convo.messages.length} messages)?\n\nThis will hide the conversation from the dashboard.`)) return;
  const btn = document.getElementById('btnDeleteConvo'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    const messageIds = convo.messages.map(m => m.messageId);
    const res = await fetch(API.DELETE_MESSAGES, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ messageIds, senderId:convo.senderId, brand:convo.brand }) });
    const raw = await res.json(); const data = Array.isArray(raw) ? raw[0] : raw;
    if (data.success) {
      delete conversations[activeConvoId]; activeConvoId = null;
      buildBrandFilters(); renderInbox();
      document.getElementById('chatBody').innerHTML = '<div class="chat-empty"><i class="fas fa-trash-alt" style="font-size:2rem;opacity:.3"></i><span>Conversation deleted</span></div>';
      document.getElementById('chatHeader').style.display = 'none';
      document.getElementById('chatReply').classList.remove('active');
    } else alert('Error deleting conversation');
  } catch (e) { console.error('Delete error:', e); alert('Connection error. Try again.'); }
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash-alt"></i>';
}

async function sendReply() {
  if (!activeConvoId) return;
  const convo = conversations[activeConvoId]; if (!convo) return;
  const input = document.getElementById('replyInput'); const text = input.value.trim(); if (!text) return;
  const btn = document.getElementById('btnSend'); btn.disabled = true; input.disabled = true;
  const pageId = convo.messages[0] ? convo.messages[0].pageId : brandToPageId[convo.brand];
  try {
    const res = await fetch(API.SEND_MESSAGE, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ pageId, senderId:convo.senderId, messageText:text }) });
    const raw = await res.json(); const data = Array.isArray(raw) ? raw[0] : raw;
    if (data.success) {
      const now = new Date().toISOString();
      convo.messages.push({ timestamp:now, brand:convo.brand, pageId, senderId:convo.senderId, messageText:text, messageId:data.messageId||'sent_'+Date.now(), platform:'Messenger', direction:'sent', senderName:convo.senderName });
      convo.lastMessage = text; convo.lastTime = now;
      openConversation(activeConvoId); renderInbox(); input.value = '';
    } else alert('Error sending message: ' + (data.error || 'Unknown error'));
  } catch (e) { console.error('Send error:', e); alert('Connection error. Try again.'); }
  btn.disabled = false; input.disabled = false; input.focus();
}

// ── FACEBOOK COMMENTS ─────────────────────────────────────────────────────
let allFbComments = [];
let currentCommentFilter = 'all';

async function fetchFbComments() {
  const btn  = document.getElementById('btnRefreshComments');
  const icon = btn ? btn.querySelector('.fa-sync-alt') : null;
  if (btn)  btn.disabled = true;
  if (icon) icon.classList.add('spinning');
  document.getElementById('commentsList').innerHTML = '<div class="msg-loading"><i class="fas fa-spinner"></i> Loading comments…</div>';
  try {
    const res = await fetch(API.FB_COMMENTS);
    const raw = await res.json();
    const data = Array.isArray(raw) ? raw[0] : raw;
    if (data.success) {
      allFbComments = data.comments || [];
      if (userAllowedBrands.length > 0) allFbComments = allFbComments.filter(c => userAllowedBrands.includes(c.brand));
      buildCommentFilters();
      renderComments();
    } else {
      document.getElementById('commentsList').innerHTML = '<div class="msg-empty"><i class="fas fa-exclamation-circle" style="font-size:1rem;opacity:.4"></i><br>Could not load comments</div>';
    }
  } catch (e) {
    console.error('Comments error:', e);
    document.getElementById('commentsList').innerHTML = '<div class="msg-empty"><i class="fas fa-exclamation-circle" style="font-size:1rem;opacity:.4"></i><br>Connection error</div>';
  }
  if (btn)  btn.disabled = false;
  if (icon) icon.classList.remove('spinning');
}

function buildCommentFilters() {
  const brandCounts = {};
  allFbComments.forEach(c => { if (!brandCounts[c.brand]) brandCounts[c.brand] = 0; brandCounts[c.brand]++; });
  const container = document.getElementById('commentFilters');
  container.innerHTML = `<button class="filter-btn active" data-brand="all" onclick="filterComments('all',this)">All Pages <span class="badge">${allFbComments.length}</span></button>`;
  Object.keys(brandCounts).sort().forEach(brand => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn'; btn.dataset.brand = brand;
    btn.innerHTML = escapeHtml(brand) + ` <span class="badge">${brandCounts[brand]}</span>`;
    btn.onclick = function() { filterComments(brand, this); };
    container.appendChild(btn);
  });
}

function filterComments(brand, btnEl) {
  currentCommentFilter = brand;
  document.querySelectorAll('#commentFilters .filter-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderComments();
}

function renderComments() {
  const list = document.getElementById('commentsList');
  const countEl = document.getElementById('commentCount');
  let comments = allFbComments;
  if (currentCommentFilter !== 'all') comments = comments.filter(c => c.brand === currentCommentFilter);
  comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  countEl.textContent = `${comments.length} comment${comments.length !== 1 ? 's' : ''}${currentCommentFilter !== 'all' ? ' · ' + currentCommentFilter : ''}`;
  if (!comments.length) { list.innerHTML = '<div class="msg-empty" style="padding:2rem"><i class="fas fa-comment-dots" style="font-size:1.2rem;opacity:.4;display:block;margin-bottom:.5rem"></i>No comments found</div>'; return; }
  list.innerHTML = comments.map(c => {
    const date = new Date(c.timestamp);
    const timeStr = date.toLocaleDateString('en-US', { month:'short', day:'numeric', timeZone:'America/Guyana' }) + ' · ' + date.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'America/Guyana' });
    const name = (c.commenterName && c.commenterName !== 'Unknown') ? c.commenterName : 'Facebook User';
    const initials = name !== 'Facebook User' ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '<i class="fas fa-user"></i>';
    const postPreview = (c.postText || '').length > 100 ? c.postText.substring(0, 100) + '…' : (c.postText || '');
    const commentText = c.commentText || '';
    return `<div class="comment-card">
      <div class="comment-card-header"><span class="comment-card-brand"><i class="fab fa-facebook" style="margin-right:3px"></i> ${escapeHtml(c.brand)}</span><span class="comment-card-time">${timeStr}</span></div>
      ${postPreview ? `<div class="comment-card-post">${escapeHtml(postPreview)}</div>` : ''}
      <div class="comment-card-body">
        <div class="comment-card-avatar">${initials}</div>
        <div class="comment-card-content"><div class="comment-card-name">${escapeHtml(name)}</div><div class="comment-card-text">${escapeHtml(commentText)}</div></div>
      </div>
    </div>`;
  }).join('');
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

// ── SESSION CHECK ─────────────────────────────────────────────────────────
function checkSession() {
  const saved = sessionStorage.getItem('caribzoom_user');
  if (saved) { try { currentUser = JSON.parse(saved); showDashboard(); } catch (e) { sessionStorage.removeItem('caribzoom_user'); } }
}
document.addEventListener('DOMContentLoaded', checkSession);
