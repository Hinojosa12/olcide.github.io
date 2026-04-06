# 🚀 CaribZoom Inc. — Staff Dashboard

> Internal staff management dashboard with real-time attendance tracking, Facebook Messenger inbox, and team monitoring. Built with vanilla HTML, CSS and JavaScript — powered by n8n webhook automation.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![n8n](https://img.shields.io/badge/n8n_Webhooks-EA4B71?style=flat-square&logo=n8n&logoColor=white)
![Meta](https://img.shields.io/badge/Meta_Graph_API-0082FB?style=flat-square&logo=meta&logoColor=white)
![Status](https://img.shields.io/badge/Status-Live-brightgreen?style=flat-square)

---

## 📸 Preview

| Login | Dashboard | Messages Inbox |
|-------|-----------|----------------|
| Secure staff login via n8n auth | Clock in/out + team overview | Multi-brand Facebook Messenger |

---

## ✨ Features

### 🔐 Authentication
- Secure login via n8n webhook — credentials validated server-side
- Session persistence using `sessionStorage`
- Role-based access control: **Admin** vs **Employee**

### ⏱️ Attendance System
- One-click **Clock In / Start Lunch / End Lunch / Clock Out**
- Real-time status badge with Guyana timezone clock
- All actions sent to n8n → Google Sheets for record keeping
- Today's activity log displayed in session

### 👥 Team Overview (Admin only)
- Live counters: Active / On Lunch / Not Clocked In / Clocked Out
- Full employee table with clock-in times, lunch windows, total hours
- Responsive mobile cards for small screens
- Manual refresh with spinning indicator

### 💬 Facebook Messenger Inbox
- Unified inbox pulling conversations from **9 Facebook brand pages**
- Filter conversations by brand
- Full chat history with sent/received bubbles
- Reply directly from the dashboard (sends via Meta Graph API)
- Support for images, audio, video and file attachments
- Delete conversations (Admin only)
- Brand-level access control — employees only see their assigned brands

### 📊 Activity Log
- Real-time in-session log of all clock actions
- Timestamped entries with employee name and action

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Structure | HTML5 |
| Styling | CSS3 (custom properties, grid, flexbox, animations) |
| Logic | Vanilla JavaScript (ES6+, async/await) |
| Auth & Automation | n8n Webhooks |
| Messaging | Meta Graph API (Facebook Messenger) |
| Fonts | Google Fonts — DM Sans + Outfit |
| Icons | Font Awesome 6 |

---

## 📁 Project Structure

```
caribzoom-dashboard/
├── index.html    # Login screen + full dashboard layout
├── styles.css    # Complete CSS — dark theme, responsive design
├── app.js        # All JavaScript logic
└── privacy.html  # Privacy policy page
```

---

## ⚙️ Architecture

```
Staff Member (Browser)
       │
       ▼
  index.html + app.js
       │
       ├──▶ n8n /caribzoom-login          → Validates credentials (Google Sheets)
       ├──▶ n8n /caribzoom-attendance     → Logs clock actions (Google Sheets)
       ├──▶ n8n /caribzoom-team-status    → Reads all employee statuses
       ├──▶ n8n /caribzoom-messages       → Fetches Messenger conversations
       ├──▶ n8n /caribzoom-send-message   → Sends reply via Meta Graph API
       └──▶ n8n /caribzoom-delete-messages → Archives conversations
```

---

## 🔑 Role Permissions

| Feature | Employee | Admin |
|---------|----------|-------|
| Clock In / Out | ✅ | ✅ |
| View own status | ✅ | ✅ |
| View team overview | ❌ | ✅ |
| View all employees | ❌ | ✅ |
| View assigned brand messages | ✅ | ✅ |
| View all brand messages | ❌ | ✅ |
| Reply to messages | ✅ | ✅ |
| Delete conversations | ❌ | ✅ |

---

## 🌐 Connected Facebook Brand Pages

| Brand | Page ID |
|-------|---------|
| Party Hub | 507711665764249 |
| Hope Jewellery | 1987162524911591 |
| Home Essentials | 102054851586430 |
| The Office Depot | 69163236784929 |
| D'Jango Gentleman's Apparel | 112987724626231 |
| Destiny's Clothing Store | 108629230921476 |
| CaribZoom | 615378785649491 |
| Pieces Plus Sized - Toys | 154545817735317 |
| Pieces Plus Sized-Reloaded | 105718055443236 |

---

## 🚀 Getting Started

No build tools required — runs entirely in the browser.

```bash
# Clone the repository
git clone https://github.com/Hinojosa12/caribzoom-dashboard.git

# Open in browser
open index.html
```

To connect your own n8n instance, update the `API` object in `app.js`:

```javascript
const API = {
  LOGIN:           'https://your-n8n-instance.com/webhook/your-login',
  ATTENDANCE:      'https://your-n8n-instance.com/webhook/your-attendance',
  TEAM_STATUS:     'https://your-n8n-instance.com/webhook/your-team-status',
  MESSAGES:        'https://your-n8n-instance.com/webhook/your-messages',
  DELETE_MESSAGES: 'https://your-n8n-instance.com/webhook/your-delete-messages',
  SEND_MESSAGE:    'https://your-n8n-instance.com/webhook/your-send-message',
};
```

---

## 👨‍💻 Built By

**Alcide Hinojosa** — Computer Engineer  
📧 alcidehinojosa@gmail.com  
🌍 Georgetown, Guyana  
🔗 [github.com/Hinojosa12](https://github.com/Hinojosa12)

---

## 📄 License

Built for **CaribZoom Inc.** — All rights reserved.  
© 2026 CaribZoom Inc.
