/* ============================================================
   Personal To-Do List & Dashboard - Application Logic
   High Performance, Ultra-Lightweight & Modular
   Firebase Auth, Firestore Realtime Sync, TradingView,
   Chart.js, Full CRUD, Calendar, Wishlist & Gemini AI
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  serverTimestamp, 
  query 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCiIZRywKs7nF92z6_FWMzhOAaRe9SOOJE",
  authDomain: "personal-to-do-list-5d959.firebaseapp.com",
  projectId: "personal-to-do-list-5d959",
  storageBucket: "personal-to-do-list-5d959.firebasestorage.app",
  messagingSenderId: "713295970134",
  appId: "1:713295970134:web:6650db1a681742dc30a0f7",
  measurementId: "G-QG3GEXP3HC"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// State variables
let app, auth, db, userId;
let tasksCollection, wishlistCollection, eventsCollection;
let tasksUnsubscribe = null, wishlistUnsubscribe = null, eventsUnsubscribe = null;
let taskStatusChart = null;
let allTasks = [], allEvents = [], allWishlist = [];
let currentFilter = 'all';
let currentCalendarDate = new Date();

// DOM Element cache
const els = {};

function cacheElements() {
  els.loading = document.getElementById('loadingOverlay');
  els.loginScreen = document.getElementById('loginScreen');
  els.mainApp = document.getElementById('mainApp');
  els.loginBtn = document.getElementById('loginWithGoogleBtn');
  els.loginError = document.getElementById('loginError');

  els.themeToggle = document.getElementById('themeToggleBtn');
  els.clockTime = document.getElementById('clockTimeDisplay');
  els.clockDate = document.getElementById('clockDateDisplay');

  els.userAvatar = document.getElementById('userAvatar');
  els.userName = document.getElementById('userName');
  els.logoutBtn = document.getElementById('logoutBtn');

  // Sidebar Tabs
  els.tabBtns = document.querySelectorAll('.sidebar-tab-btn');
  els.tabContents = document.querySelectorAll('.tab-content-panel');

  // Overview / Tasks
  els.totalTasks = document.getElementById('totalTasksCount');
  els.pendingTasks = document.getElementById('pendingTasksCount');
  els.inProgressTasks = document.getElementById('inProgressTasksCount');
  els.deadlineWarning = document.getElementById('deadlineTasksCount');
  els.completedTasks = document.getElementById('completedTasksCount');
  els.filterChips = document.querySelectorAll('.stat-chip-card');

  els.taskList = document.getElementById('taskListContainer');
  els.showTaskModalBtn = document.getElementById('showTaskModalBtn');
  els.taskModal = document.getElementById('taskModal');
  els.taskForm = document.getElementById('taskForm');
  els.closeTaskModalBtn = document.getElementById('closeTaskModalBtn');
  els.deleteTaskBtn = document.getElementById('deleteTaskBtn');

  // Agenda
  els.upcomingList = document.getElementById('upcomingAgendaList');

  // Calendar
  els.calendarGrid = document.getElementById('calendarDaysGrid');
  els.calendarMonth = document.getElementById('calendarMonthDisplay');
  els.prevMonthBtn = document.getElementById('prevMonthBtn');
  els.nextMonthBtn = document.getElementById('nextMonthBtn');
  els.calendarDetail = document.getElementById('calendarDetailPanel');
  els.detailTitle = document.getElementById('calendarDetailDateTitle');
  els.detailTaskList = document.getElementById('detailTasksList');
  els.detailEventList = document.getElementById('detailEventsList');
  els.closeDetailBtn = document.getElementById('closeDetailViewBtn');
  els.detailAddTaskBtn = document.getElementById('detailAddTaskBtn');
  els.detailAddEventBtn = document.getElementById('detailAddEventBtn');

  // Event Modal
  els.eventModal = document.getElementById('eventModal');
  els.eventForm = document.getElementById('eventForm');
  els.closeEventModalBtn = document.getElementById('closeEventModalBtn');
  els.deleteEventBtn = document.getElementById('deleteEventBtn');

  // Wishlist
  els.wishlistTotal = document.getElementById('wishlistTotalAmount');
  els.wishlistGrid = document.getElementById('wishlistItemsGrid');
  els.showWishlistModalBtn = document.getElementById('showWishlistModalBtn');
  els.wishlistModal = document.getElementById('wishlistModal');
  els.wishlistForm = document.getElementById('wishlistForm');
  els.closeWishlistModalBtn = document.getElementById('closeWishlistModalBtn');

  // Gemini AI
  els.geminiForm = document.getElementById('geminiPromptForm');
  els.geminiInput = document.getElementById('geminiPromptInput');
  els.chatContainer = document.getElementById('geminiChatScroll');
  els.geminiLoading = document.getElementById('geminiLoadingIndicator');
}

// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem('leonard-portfolio-theme') || 'dark';
  applyTheme(savedTheme, false);

  if (els.themeToggle) {
    els.themeToggle.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      applyTheme(isLight ? 'dark' : 'light', true);
    });
  }
}

function applyTheme(theme, save = true) {
  const isLight = theme === 'light';
  if (isLight) {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  if (save) {
    localStorage.setItem('leonard-portfolio-theme', isLight ? 'light' : 'dark');
  }

  if (window.updateCanvasTheme) {
    window.updateCanvasTheme();
  }

  // Update chart colors if chart exists
  if (taskStatusChart) {
    updateChartTheme();
  }
}

// --- Digital Clock & Indonesian Date ---
function initClock() {
  const updateClock = () => {
    const now = new Date();
    if (els.clockTime) {
      els.clockTime.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
    }
    if (els.clockDate) {
      els.clockDate.textContent = now.toLocaleDateString('id-ID', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });
    }
  };

  setInterval(updateClock, 1000);
  updateClock();
}

function getLocalTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- TradingView Init ---
function initTradingView() {
  const container = document.getElementById('tradingview_chart');
  if (!container || typeof TradingView === 'undefined') return;

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  new TradingView.widget({
    "width": "100%",
    "height": "100%",
    "symbol": "IDX:COMPOSITE",
    "interval": "D",
    "timezone": "Asia/Jakarta",
    "theme": isLight ? "light" : "dark",
    "style": "1",
    "locale": "id",
    "enable_publishing": false,
    "allow_symbol_change": true,
    "container_id": "tradingview_chart",
    "backgroundColor": isLight ? "rgba(255, 255, 255, 0)" : "rgba(14, 15, 20, 0)"
  });
}

// --- Firebase Init & Auth ---
async function initApp() {
  cacheElements();
  initTheme();
  initClock();

  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);

  // Setup modals
  setupModal(els.taskModal, els.showTaskModalBtn, els.closeTaskModalBtn);
  setupModal(els.wishlistModal, els.showWishlistModalBtn, els.closeWishlistModalBtn);
  setupModal(els.eventModal, null, els.closeEventModalBtn);

  // Setup Tab Navigation
  els.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      els.tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === targetTab));
      els.tabContents.forEach(c => c.classList.toggle('hidden', c.id !== targetTab));
    });
  });

  // Google Login
  if (els.loginBtn) {
    els.loginBtn.addEventListener('click', async () => {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (e) {
        if (els.loginError) {
          els.loginError.textContent = e.message;
          els.loginError.classList.remove('hidden');
        }
      }
    });
  }

  // Auth State Listener
  onAuthStateChanged(auth, (user) => {
    if (user) {
      userId = user.uid;
      els.loginScreen.classList.add('hidden');
      els.mainApp.classList.remove('hidden');
      els.loading.style.display = 'none';

      if (els.userAvatar) els.userAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
      if (els.userName) els.userName.textContent = user.displayName || 'User';

      startDataListeners();
      initTradingView();
    } else {
      userId = null;
      unsubscribeAll();
      els.loginScreen.classList.remove('hidden');
      els.mainApp.classList.add('hidden');
      els.loading.style.display = 'none';
    }
  });

  // Sign Out
  if (els.logoutBtn) {
    els.logoutBtn.addEventListener('click', () => signOut(auth));
  }

  // Calendar Navigation
  if (els.prevMonthBtn) {
    els.prevMonthBtn.addEventListener('click', () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      renderCalendar();
    });
  }
  if (els.nextMonthBtn) {
    els.nextMonthBtn.addEventListener('click', () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
      renderCalendar();
    });
  }

  // Calendar Detail Actions
  if (els.closeDetailBtn) {
    els.closeDetailBtn.addEventListener('click', () => els.calendarDetail.classList.add('hidden'));
  }
  if (els.detailAddTaskBtn) {
    els.detailAddTaskBtn.addEventListener('click', () => openTaskModal(null, els.detailTitle.dataset.date));
  }
  if (els.detailAddEventBtn) {
    els.detailAddEventBtn.addEventListener('click', () => openEventModal(els.detailTitle.dataset.date));
  }

  // Forms Submit Listeners
  if (els.taskForm) els.taskForm.addEventListener('submit', handleTaskSubmit);
  if (els.wishlistForm) els.wishlistForm.addEventListener('submit', handleWishlistSubmit);
  if (els.eventForm) els.eventForm.addEventListener('submit', handleEventSubmit);
  if (els.geminiForm) els.geminiForm.addEventListener('submit', handleGeminiSubmit);

  // Delete Listeners
  if (els.deleteTaskBtn) els.deleteTaskBtn.addEventListener('click', handleDeleteTask);
  if (els.deleteEventBtn) els.deleteEventBtn.addEventListener('click', handleDeleteEvent);

  // Filter Listeners
  setupFilterListeners();

  // Custom Event Dispatch Listeners (for inline button triggers)
  document.addEventListener('edit-task', e => openTaskModal(e.detail));
  document.addEventListener('change-task-status', e => updateDoc(doc(tasksCollection, e.detail.id), { status: e.detail.status }));
  document.addEventListener('delete-task', async e => {
    if (confirm("Hapus tugas ini?")) await deleteDoc(doc(tasksCollection, e.detail));
  });

  document.addEventListener('edit-event', e => openEventModal(null, e.detail));
  document.addEventListener('delete-wishlist', async e => {
    if (confirm("Hapus item dari wishlist?")) await deleteDoc(doc(wishlistCollection, e.detail));
  });
}

function unsubscribeAll() {
  if (tasksUnsubscribe) { tasksUnsubscribe(); tasksUnsubscribe = null; }
  if (wishlistUnsubscribe) { wishlistUnsubscribe(); wishlistUnsubscribe = null; }
  if (eventsUnsubscribe) { eventsUnsubscribe(); eventsUnsubscribe = null; }
}

function startDataListeners() {
  unsubscribeAll();
  const basePath = `/artifacts/${appId}/users/${userId}`;
  tasksCollection = collection(db, `${basePath}/tasks`);
  wishlistCollection = collection(db, `${basePath}/wishlist`);
  eventsCollection = collection(db, `${basePath}/events`);

  tasksUnsubscribe = onSnapshot(query(tasksCollection), snap => {
    allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTasks();
    renderCalendar();
    renderUpcoming();
    updateStats();
  });

  wishlistUnsubscribe = onSnapshot(query(wishlistCollection), snap => {
    allWishlist = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderWishlist();
  });

  eventsUnsubscribe = onSnapshot(query(eventsCollection), snap => {
    allEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCalendar();
    renderUpcoming();
  });
}

// --- Modal Helper ---
function setupModal(modal, openBtn, closeBtn) {
  if (!modal) return;
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (modal.id === 'taskModal') openTaskModal();
      else modal.showModal();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.close());
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });
}

// --- Filter Chips Setup ---
function setupFilterListeners() {
  els.filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const filter = chip.dataset.filter;
      currentFilter = filter;
      els.filterChips.forEach(c => c.classList.toggle('active-filter', c.dataset.filter === filter));
      renderTasks();
    });
  });
}

// --- Stats & Doughnut Chart ---
function updateStats() {
  const total = allTasks.length;
  const pending = allTasks.filter(t => t.status === 'pending').length;
  const progress = allTasks.filter(t => t.status === 'in-progress').length;
  const completed = allTasks.filter(t => t.status === 'completed').length;

  const now = new Date().getTime();
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  const deadlineCount = allTasks.filter(t => {
    if (t.deadline && t.status !== 'completed') {
      return new Date(t.deadline + 'T00:00:00').getTime() <= (now + twoDaysMs);
    }
    return false;
  }).length;

  if (els.totalTasks) els.totalTasks.textContent = total;
  if (els.pendingTasks) els.pendingTasks.textContent = pending;
  if (els.inProgressTasks) els.inProgressTasks.textContent = progress;
  if (els.deadlineWarning) els.deadlineWarning.textContent = deadlineCount;
  if (els.completedTasks) els.completedTasks.textContent = completed;

  renderChart(pending, progress, completed);
}

function renderChart(pending, progress, completed) {
  const canvas = document.getElementById('taskStatusChart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (taskStatusChart) {
    taskStatusChart.data.datasets[0].data = [pending, progress, completed];
    taskStatusChart.update();
    return;
  }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const textColor = isLight ? '#1d1d1f' : '#f5f5f7';

  taskStatusChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'Proses', 'Selesai'],
      datasets: [{
        data: [pending, progress, completed],
        backgroundColor: ['#ffd60a', '#2997ff', '#30d158'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: textColor,
            font: { family: 'Google Sans', size: 11 },
            boxWidth: 10,
            padding: 10
          }
        }
      },
      cutout: '74%'
    }
  });
}

function updateChartTheme() {
  if (!taskStatusChart) return;
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const textColor = isLight ? '#1d1d1f' : '#f5f5f7';
  taskStatusChart.options.plugins.legend.labels.color = textColor;
  taskStatusChart.update();
}

// --- Tasks CRUD & Render ---
function renderTasks() {
  if (!els.taskList) return;
  els.taskList.innerHTML = '';

  const now = new Date().getTime();
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

  const filtered = allTasks.filter(t => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'pending') return t.status === 'pending';
    if (currentFilter === 'in-progress') return t.status === 'in-progress';
    if (currentFilter === 'completed') return t.status === 'completed';
    if (currentFilter === 'deadline') {
      if (t.deadline && t.status !== 'completed') {
        const d = new Date(t.deadline + 'T00:00:00').getTime();
        return d <= (now + twoDaysMs);
      }
      return false;
    }
    return true;
  }).sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));

  if (filtered.length === 0) {
    let msg = "Belum ada tugas di kategori ini.";
    if (currentFilter === 'all') msg = "Belum ada tugas. Buat tugas baru untuk mulai!";
    else if (currentFilter === 'completed') msg = "Belum ada tugas yang selesai.";
    else if (currentFilter === 'deadline') msg = "Tidak ada tugas urgent saat ini. Kerja bagus!";
    els.taskList.innerHTML = `<div class="agenda-empty-card">${msg}</div>`;
    return;
  }

  filtered.forEach(t => {
    const isUrgent = t.deadline && t.status !== 'completed' && (new Date(t.deadline + 'T00:00:00').getTime() <= (now + twoDaysMs));
    const card = document.createElement('div');
    card.className = `task-item-card ${t.status} ${isUrgent ? 'deadline-urgent' : ''}`;

    card.innerHTML = `
      <div class="task-item-header">
        <div style="flex: 1; min-width: 0;">
          <h4 class="task-item-name">${escapeHtml(t.name)}</h4>
          <div class="task-item-date">
            <i class="fa-regular fa-calendar" style="opacity: 0.7;"></i>
            <span>${t.deadline || 'Tanpa Tanggal'}</span>
            <span style="opacity: 0.4;">•</span>
            <i class="fa-regular fa-clock" style="opacity: 0.7;"></i>
            <span>${t.time || '--:--'}</span>
          </div>
        </div>
        <div class="task-item-controls">
          <select class="task-status-select" onchange="document.dispatchEvent(new CustomEvent('change-task-status', {detail: {id: '${t.id}', status: this.value}}))">
            <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="in-progress" ${t.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
            <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>Completed</option>
          </select>
          <button class="btn-icon-action" title="Edit Tugas" onclick="document.dispatchEvent(new CustomEvent('edit-task', {detail: '${t.id}'}))">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-icon-action delete" title="Hapus Tugas" onclick="document.dispatchEvent(new CustomEvent('delete-task', {detail: '${t.id}'}))">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
      ${t.notes ? `<div class="task-item-notes">${escapeHtml(t.notes)}</div>` : ''}
      ${t.driveLink ? `<a href="${escapeHtml(t.driveLink)}" target="_blank" class="task-item-link"><i class="fa-brands fa-google-drive"></i> Buka Link Drive</a>` : ''}
    `;

    els.taskList.appendChild(card);
  });
}

function openTaskModal(id = null, date = null) {
  els.taskForm.reset();
  els.taskForm.dataset.taskId = id || '';
  const titleEl = document.getElementById('taskModalTitle');
  if (titleEl) titleEl.textContent = id ? 'Edit Tugas' : 'Tugas Baru';

  if (els.deleteTaskBtn) {
    els.deleteTaskBtn.classList.toggle('hidden', !id);
  }

  if (date) {
    document.getElementById('taskDeadline').value = date;
  }

  if (id) {
    const task = allTasks.find(t => t.id === id);
    if (task) {
      document.getElementById('taskName').value = task.name || '';
      document.getElementById('taskDeadline').value = task.deadline || '';
      document.getElementById('taskTime').value = task.time || '';
      document.getElementById('taskStatus').value = task.status || 'pending';
      document.getElementById('taskNotes').value = task.notes || '';
      document.getElementById('taskDriveLink').value = task.driveLink || '';
    }
  }

  els.taskModal.showModal();
}

async function handleTaskSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = e.target.dataset.taskId;

  const data = {
    name: fd.get('taskName') || 'Tugas Baru',
    notes: fd.get('taskNotes') || '',
    driveLink: fd.get('taskDriveLink') || '',
    status: fd.get('taskStatus') || 'pending',
    deadline: fd.get('taskDeadline') || null,
    time: fd.get('taskTime') || '00:00',
    createdAt: serverTimestamp()
  };

  if (id) {
    await updateDoc(doc(tasksCollection, id), data);
  } else {
    await addDoc(tasksCollection, data);
  }
  els.taskModal.close();
}

async function handleDeleteTask() {
  const id = els.taskForm.dataset.taskId;
  if (id && confirm("Hapus tugas ini secara permanen?")) {
    await deleteDoc(doc(tasksCollection, id));
    els.taskModal.close();
  }
}

// --- Agenda Hari Ini ---
function renderUpcoming() {
  if (!els.upcomingList) return;
  const today = getLocalTodayDate();

  const combined = [
    ...allTasks.filter(t => t.deadline === today && t.status !== 'completed').map(t => ({ ...t, itemType: 'task' })),
    ...allEvents.filter(e => {
      if (e.lastActionDate === today) return false;
      return checkEventDate(e, today);
    }).map(e => ({ ...e, itemType: 'event' }))
  ].sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));

  els.upcomingList.innerHTML = '';
  if (combined.length === 0) {
    els.upcomingList.innerHTML = `
      <div class="agenda-empty-card">
        <i class="fa-solid fa-mug-hot" style="margin-right: 6px; color: var(--apple-blue);"></i>
        Tidak ada agenda untuk hari ini. Waktunya santai atau fokus berkarya!
      </div>`;
    return;
  }

  combined.forEach(item => {
    const row = document.createElement('div');
    row.className = `agenda-item-row ${item.itemType}-type`;

    row.innerHTML = `
      <div style="flex: 1; min-width: 0;">
        <h4 class="agenda-item-title">${escapeHtml(item.name)}</h4>
        <div class="agenda-item-meta">
          <i class="fa-regular fa-clock" style="opacity: 0.7;"></i>
          <span>${item.time || '--:--'}</span>
          <span class="agenda-badge-tag ${item.itemType}">${item.itemType}</span>
        </div>
      </div>
      <div class="agenda-actions-group">
        <button class="btn-action-round complete" title="${item.itemType === 'task' ? 'Tandai Selesai' : 'Event Selesai'}">
          <i class="fa-solid fa-check"></i>
        </button>
        ${item.itemType === 'event' ? `
          <button class="btn-action-round skip" title="Lewati Event">
            <i class="fa-solid fa-xmark"></i>
          </button>
        ` : ''}
      </div>
    `;

    // Complete action
    row.querySelector('.complete').addEventListener('click', async () => {
      if (item.itemType === 'task') {
        if (confirm("Tandai tugas ini selesai?")) {
          await updateDoc(doc(tasksCollection, item.id), { status: 'completed' });
        }
      } else {
        await updateDoc(doc(eventsCollection, item.id), { lastActionDate: today });
      }
    });

    // Skip action for event
    const skipBtn = row.querySelector('.skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', async () => {
        await updateDoc(doc(eventsCollection, item.id), { lastActionDate: today });
      });
    }

    els.upcomingList.appendChild(row);
  });
}

// --- Calendar System ---
function renderCalendar() {
  if (!els.calendarGrid) return;
  els.calendarGrid.innerHTML = '';

  const y = currentCalendarDate.getFullYear();
  const m = currentCalendarDate.getMonth();
  if (els.calendarMonth) {
    els.calendarMonth.textContent = currentCalendarDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = getLocalTodayDate();

  // Leading empty cells
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day-cell other-month';
    empty.style.opacity = '0.15';
    els.calendarGrid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = `calendar-day-cell ${dateStr === todayStr ? 'today' : ''}`;

    cell.innerHTML = `
      <div class="calendar-day-number">${d}</div>
      <div class="calendar-day-dots-wrap"></div>
    `;

    const dotsWrap = cell.querySelector('.calendar-day-dots-wrap');

    // Matching events
    allEvents.filter(e => checkEventDate(e, dateStr)).forEach(() => {
      const dot = document.createElement('div');
      dot.className = 'calendar-dot event';
      dotsWrap.appendChild(dot);
    });

    // Matching tasks
    allTasks.filter(t => t.deadline === dateStr && t.status !== 'completed').forEach(() => {
      const dot = document.createElement('div');
      dot.className = 'calendar-dot task';
      dotsWrap.appendChild(dot);
    });

    cell.addEventListener('click', () => showCalendarDetail(dateStr));
    els.calendarGrid.appendChild(cell);
  }
}

function checkEventDate(event, dateStr) {
  if (!event.date) return false;
  if (event.repeatType === 'once' && event.date === dateStr) return true;
  if (event.repeatType === 'daily') return true;
  if (event.repeatType === 'weekly' && new Date(event.date).getDay() === new Date(dateStr).getDay()) {
    return new Date(event.date) <= new Date(dateStr);
  }
  return false;
}

function showCalendarDetail(dateStr) {
  if (!els.calendarDetail) return;
  els.calendarDetail.classList.remove('hidden');

  const dateObj = new Date(dateStr);
  const formatted = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (els.detailTitle) {
    els.detailTitle.textContent = formatted;
    els.detailTitle.dataset.date = dateStr;
  }

  // Render Tasks on date
  const tasksOnDate = allTasks.filter(t => t.deadline === dateStr);
  els.detailTaskList.innerHTML = tasksOnDate.length ? '' : '<p style="font-size: 0.8rem; color: var(--text-tertiary);">Tidak ada tugas</p>';
  tasksOnDate.forEach(t => {
    const item = document.createElement('div');
    item.className = 'detail-item-bubble';
    item.innerHTML = `
      <span style="font-weight: 500;">${escapeHtml(t.name)}</span>
      <button class="btn-pill-secondary" style="padding: 3px 10px; font-size: 0.74rem;" onclick="document.dispatchEvent(new CustomEvent('edit-task', {detail: '${t.id}'}))">
        Edit
      </button>
    `;
    els.detailTaskList.appendChild(item);
  });

  // Render Events on date
  const eventsOnDate = allEvents.filter(e => checkEventDate(e, dateStr));
  els.detailEventList.innerHTML = eventsOnDate.length ? '' : '<p style="font-size: 0.8rem; color: var(--text-tertiary);">Tidak ada event</p>';
  eventsOnDate.forEach(e => {
    const item = document.createElement('div');
    item.className = 'detail-item-bubble';
    item.innerHTML = `
      <div>
        <span style="font-weight: 600;">${escapeHtml(e.name)}</span>
        <span style="font-size: 0.76rem; color: var(--text-secondary); margin-left: 6px;">${e.time || ''}</span>
      </div>
      <button class="btn-pill-secondary" style="padding: 3px 10px; font-size: 0.74rem;" onclick="document.dispatchEvent(new CustomEvent('edit-event', {detail: '${e.id}'}))">
        Edit
      </button>
    `;
    els.detailEventList.appendChild(item);
  });
}

// --- Events CRUD ---
function openEventModal(date = null, id = null) {
  els.eventForm.reset();
  els.eventForm.dataset.eventId = id || '';
  const titleEl = document.getElementById('eventModalTitle');
  if (titleEl) titleEl.textContent = id ? 'Edit Event' : 'Event Baru';

  if (els.deleteEventBtn) {
    els.deleteEventBtn.classList.toggle('hidden', !id);
  }

  if (date) {
    document.getElementById('eventDate').value = date;
  }

  if (id) {
    const ev = allEvents.find(e => e.id === id);
    if (ev) {
      document.getElementById('eventName').value = ev.name || '';
      document.getElementById('eventDate').value = ev.date || '';
      document.getElementById('eventTime').value = ev.time || '';
      document.getElementById('eventRepeat').value = ev.repeatType || 'once';
    }
  }

  els.eventModal.showModal();
}

async function handleEventSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = e.target.dataset.eventId;

  const data = {
    name: fd.get('eventName') || 'Event Baru',
    date: fd.get('eventDate') || getLocalTodayDate(),
    time: fd.get('eventTime') || '00:00',
    repeatType: fd.get('eventRepeat') || 'once',
    lastActionDate: null,
    createdAt: serverTimestamp()
  };

  if (id) {
    await updateDoc(doc(eventsCollection, id), data);
  } else {
    await addDoc(eventsCollection, data);
  }
  els.eventModal.close();
}

async function handleDeleteEvent() {
  const id = els.eventForm.dataset.eventId;
  if (id && confirm("Hapus event ini?")) {
    await deleteDoc(doc(eventsCollection, id));
    els.eventModal.close();
  }
}

// --- Wishlist Management ---
function renderWishlist() {
  if (!els.wishlistGrid) return;
  els.wishlistGrid.innerHTML = '';

  let total = 0;
  allWishlist.forEach(item => {
    total += Number(item.price) || 0;
    const card = document.createElement('div');
    card.className = 'wishlist-card';

    const formattedPrice = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(item.price || 0);

    card.innerHTML = `
      <div>
        <h3 class="wishlist-card-title">${escapeHtml(item.name)}</h3>
        <div class="wishlist-card-price">${formattedPrice}</div>
      </div>
      <div class="wishlist-card-actions">
        ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" class="btn-buy-link"><i class="fa-solid fa-arrow-up-right-from-square" style="margin-right: 5px;"></i> Beli</a>` : ''}
        <button class="btn-icon-action delete" title="Hapus Item" onclick="document.dispatchEvent(new CustomEvent('delete-wishlist', {detail: '${item.id}'}))">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    `;

    els.wishlistGrid.appendChild(card);
  });

  if (els.wishlistTotal) {
    els.wishlistTotal.textContent = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(total);
  }

  if (allWishlist.length === 0) {
    els.wishlistGrid.innerHTML = `
      <div class="agenda-empty-card" style="grid-column: 1 / -1; padding: 48px;">
        <i class="fa-regular fa-bookmark" style="font-size: 1.6rem; margin-bottom: 8px; display: block; color: var(--text-tertiary);"></i>
        Wishlist Anda masih kosong. Tambahkan barang impian Anda!
      </div>`;
  }
}

async function handleWishlistSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);

  await addDoc(wishlistCollection, {
    name: fd.get('productName') || 'Item',
    link: fd.get('productLink') || '',
    price: Number(fd.get('productPrice')) || 0,
    createdAt: serverTimestamp()
  });

  els.wishlistModal.close();
  els.wishlistForm.reset();
}

// --- Gemini AI Assistant ---
async function handleGeminiSubmit(e) {
  e.preventDefault();
  const text = els.geminiInput.value.trim();
  if (!text) return;

  appendChat('user', text);
  els.geminiInput.value = '';
  if (els.geminiLoading) els.geminiLoading.classList.remove('hidden');

  try {
    const apiKey = "AIzaSyBdvL65RALEcZ1vxHsQb8d1A3GJnJc_QlI";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text }] }] })
    });

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, saya tidak dapat memahami permintaan Anda saat ini.";
    appendChat('model', reply);
  } catch (err) {
    appendChat('model', "Terjadi kesalahan: " + err.message, true);
  } finally {
    if (els.geminiLoading) els.geminiLoading.classList.add('hidden');
  }
}

function appendChat(role, text, isError = false) {
  if (!els.chatContainer) return;
  const div = document.createElement('div');
  div.className = `chat-bubble ${role} ${isError ? 'error' : ''}`;
  div.innerHTML = role === 'user' ? escapeHtml(text) : formatMarkdown(text);
  els.chatContainer.appendChild(div);
  els.chatContainer.scrollTop = els.chatContainer.scrollHeight;
}

function formatMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
