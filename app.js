/* ===================== Habit Quest — app.js ===================== */

const PALETTE = ["#FF6B6B", "#4ECDC4", "#FFD93D", "#FF6FB5", "#6BCB77", "#4D96FF", "#B085F5", "#FF9F45", "#5CE1E6", "#F76E11"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const STORAGE_PREFIX = "habitquest:";
const HABITS_KEY = STORAGE_PREFIX + "habits";

const DEFAULT_HABITS = [
  { id: "h1", name: "Wake up early", emoji: "🌅", color: PALETTE[0] },
  { id: "h2", name: "Gym", emoji: "🏋️", color: PALETTE[1] },
  { id: "h3", name: "Reading", emoji: "📖", color: PALETTE[2] },
  { id: "h4", name: "Hydrate", emoji: "💧", color: PALETTE[3] },
  { id: "h5", name: "Healthy Meal", emoji: "🥗", color: PALETTE[4] },
  { id: "h6", name: "Journal", emoji: "📝", color: PALETTE[5] },
  { id: "h7", name: "No Social Media", emoji: "📵", color: PALETTE[6] },
];

/* ---------- state ---------- */
const today = new Date();
let state = {
  year: today.getFullYear(),
  monthIdx: today.getMonth(),
  habits: [],
  checks: {},     // { "1": { habitId: true } }
  dayTasks: {},   // { "1": [{id,name,emoji,completed}] } — each day has its OWN task list
};

let editingHabitId = null;
let dragHabitId = null;
let editingTaskId = null;
let dragTaskId = null;
let selectedDay = null;      // day number currently shown in the Tasks panel

/* ---------- storage helpers ---------- */
function monthKey(year, monthIdx) {
  return `${STORAGE_PREFIX}month:${year}-${String(monthIdx + 1).padStart(2, "0")}`;
}
function loadHabits() {
  try {
    const raw = localStorage.getItem(HABITS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_HABITS.slice();
  } catch (e) { return DEFAULT_HABITS.slice(); }
}
function saveHabits() {
  try { localStorage.setItem(HABITS_KEY, JSON.stringify(state.habits)); showStatus(""); }
  catch (e) { showStatus("Couldn't save habits — storage may be full.", true); }
}
function loadMonth() {
  try {
    const raw = localStorage.getItem(monthKey(state.year, state.monthIdx));
    const parsed = raw ? JSON.parse(raw) : {};
    state.checks = parsed.checks || {};
    state.dayTasks = parsed.dayTasks || {};
  } catch (e) {
    state.checks = {}; state.dayTasks = {};
  }
  selectedDay = null;
}
function saveMonth() {
  try {
    localStorage.setItem(monthKey(state.year, state.monthIdx), JSON.stringify({
      checks: state.checks, dayTasks: state.dayTasks
    }));
    showStatus("");
  } catch (e) { showStatus("Couldn't save last change — storage may be full.", true); }
}
function showStatus(msg, isError) {
  const el = document.getElementById("statusMsg");
  el.textContent = msg || "";
  el.className = "status-msg" + (isError ? " error" : "");
}

/* ---------- date helpers ---------- */
function daysInMonth(year, monthIdx) { return new Date(year, monthIdx + 1, 0).getDate(); }
function isPastOrToday(year, monthIdx, day) {
  const dt = new Date(year, monthIdx, day);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return dt <= t;
}

/* ---------- chart instances ---------- */
let dailyChart, weeklyChart, overallChart;

/* ===================== INIT ===================== */
function init() {
  state.habits = loadHabits();
  loadMonth();
  populateControlPanel();
  wireStaticEvents();
  renderAll();
}

function populateControlPanel() {
  const yearSelect = document.getElementById("yearSelect");
  const monthSelect = document.getElementById("monthSelect");
  yearSelect.innerHTML = "";
  for (let y = today.getFullYear() - 2; y <= today.getFullYear() + 3; y++) {
    const opt = document.createElement("option");
    opt.value = y; opt.textContent = y;
    if (y === state.year) opt.selected = true;
    yearSelect.appendChild(opt);
  }
  monthSelect.innerHTML = "";
  MONTH_NAMES.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = i; opt.textContent = m;
    if (i === state.monthIdx) opt.selected = true;
    monthSelect.appendChild(opt);
  });
  yearSelect.addEventListener("change", () => { state.year = Number(yearSelect.value); loadMonth(); renderAll(); });
  monthSelect.addEventListener("change", () => { state.monthIdx = Number(monthSelect.value); loadMonth(); renderAll(); });
}

function wireStaticEvents() {
  document.getElementById("addHabitBtn").addEventListener("click", () => {
    const form = document.getElementById("addHabitForm");
    form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) document.getElementById("newHabitInput").focus();
  });
  document.getElementById("confirmAddHabit").addEventListener("click", addHabit);
  document.getElementById("newHabitInput").addEventListener("keydown", e => { if (e.key === "Enter") addHabit(); });

  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", importData);

  document.getElementById("addTaskBtn").addEventListener("click", () => {
    const form = document.getElementById("addTaskForm");
    form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) document.getElementById("newTaskInput").focus();
  });
  document.getElementById("confirmAddTask").addEventListener("click", addTask);
  document.getElementById("newTaskInput").addEventListener("keydown", e => { if (e.key === "Enter") addTask(); });
}

/* ===================== HABIT CRUD ===================== */
function addHabit() {
  const input = document.getElementById("newHabitInput");
  const name = input.value.trim();
  if (!name) return;
  const color = PALETTE[state.habits.length % PALETTE.length];
  state.habits.push({ id: "h" + Date.now(), name, emoji: "⭐", color });
  saveHabits();
  input.value = "";
  document.getElementById("addHabitForm").classList.add("hidden");
  renderAll();
}

function removeHabit(id) {
  state.habits = state.habits.filter(h => h.id !== id);
  saveHabits();
  renderAll();
}

function startEditHabit(id) {
  editingHabitId = id;
  renderHabitTable();
}

function commitEditHabit(id, newName) {
  const trimmed = newName.trim();
  const h = state.habits.find(h => h.id === id);
  if (h && trimmed) h.name = trimmed;
  editingHabitId = null;
  saveHabits();
  renderAll();
}

function cancelEditHabit() {
  editingHabitId = null;
  renderHabitTable();
}

function reorderHabits(draggedId, targetId) {
  if (draggedId === targetId) return;
  const fromIdx = state.habits.findIndex(h => h.id === draggedId);
  const toIdx = state.habits.findIndex(h => h.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  const [moved] = state.habits.splice(fromIdx, 1);
  state.habits.splice(toIdx, 0, moved);
  saveHabits();
  renderAll();
}

/* ===================== TASK CRUD (each day has its OWN task list, auto-saved) ===================== */
function currentDayTaskList() {
  if (selectedDay === null) return [];
  const key = String(selectedDay);
  if (!state.dayTasks[key]) state.dayTasks[key] = [];
  return state.dayTasks[key];
}

function addTask() {
  if (selectedDay === null) return;
  const input = document.getElementById("newTaskInput");
  const name = input.value.trim();
  if (!name) return;
  currentDayTaskList().push({ id: "t" + Date.now(), name, emoji: "⭐", completed: false });
  saveMonth();
  input.value = "";
  document.getElementById("addTaskForm").classList.add("hidden");
  renderDayStrip();
  renderTaskPanel();
}

function removeTask(id) {
  if (selectedDay === null) return;
  state.dayTasks[String(selectedDay)] = currentDayTaskList().filter(t => t.id !== id);
  saveMonth();
  renderDayStrip();
  renderTaskPanel();
}

function startEditTask(id) {
  editingTaskId = id;
  renderTaskPanel();
}

function commitEditTask(id, newName) {
  const trimmed = newName.trim();
  const t = currentDayTaskList().find(t => t.id === id);
  if (t && trimmed) t.name = trimmed;
  editingTaskId = null;
  saveMonth();
  renderTaskPanel();
}

function cancelEditTask() {
  editingTaskId = null;
  renderTaskPanel();
}

function reorderTasks(draggedId, targetId) {
  if (draggedId === targetId) return;
  const list = currentDayTaskList();
  const fromIdx = list.findIndex(t => t.id === draggedId);
  const toIdx = list.findIndex(t => t.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  const [moved] = list.splice(fromIdx, 1);
  list.splice(toIdx, 0, moved);
  saveMonth();
  renderTaskPanel();
}

/* ---------- day selection + per-day task checklist ---------- */
function selectDay(day) {
  selectedDay = day;
  editingTaskId = null;
  renderDayStrip();
  renderTaskPanel();
}

function toggleTaskCheck(taskId) {
  const t = currentDayTaskList().find(t => t.id === taskId);
  if (t) t.completed = !t.completed;
  saveMonth();
  renderDayStrip();
  renderTaskPanel();
}

/* ===================== HABIT CHECK ===================== */
function toggleCheck(habitId, day) {
  const dayKey = String(day);
  if (!state.checks[dayKey]) state.checks[dayKey] = {};
  state.checks[dayKey][habitId] = !state.checks[dayKey][habitId];
  saveMonth();
  renderAll();
}

/* ===================== EXPORT / IMPORT ===================== */
function exportData() {
  const data = { habits: state.habits, months: {} };
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX + "month:")) {
      try { data.months[key] = JSON.parse(localStorage.getItem(key)); } catch (e) {}
    }
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `habit-quest-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showStatus("Backup downloaded.");
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (Array.isArray(data.habits)) {
        state.habits = data.habits;
        localStorage.setItem(HABITS_KEY, JSON.stringify(state.habits));
      }
      if (data.months && typeof data.months === "object") {
        Object.keys(data.months).forEach(key => {
          localStorage.setItem(key, JSON.stringify(data.months[key]));
        });
      }
      loadMonth();
      renderAll();
      showStatus("Data imported successfully.");
    } catch (err) {
      showStatus("Import failed — the file isn't a valid backup.", true);
    }
    e.target.value = "";
  };
  reader.readAsText(file);
}

/* ===================== DERIVED DATA ===================== */
function getDaysArr() {
  const n = daysInMonth(state.year, state.monthIdx);
  return Array.from({ length: n }, (_, i) => i + 1);
}
function getTrackedDays() {
  return getDaysArr().filter(d => isPastOrToday(state.year, state.monthIdx, d));
}
function computeStats() {
  const tracked = getTrackedDays();
  const totalGoal = state.habits.length * tracked.length;
  const totalCompleted = tracked.reduce((sum, d) => {
    const dayChecks = state.checks[String(d)] || {};
    return sum + state.habits.filter(h => dayChecks[h.id]).length;
  }, 0);
  const overallPct = totalGoal > 0 ? Math.round((totalCompleted / totalGoal) * 100) : 0;
  return { totalGoal, totalCompleted, overallPct, tracked };
}
function computeDailyProgress() {
  return getDaysArr().map(d => {
    const dayChecks = state.checks[String(d)] || {};
    const done = state.habits.filter(h => dayChecks[h.id]).length;
    const pct = state.habits.length > 0 ? Math.round((done / state.habits.length) * 100) : 0;
    return { day: d, pct };
  });
}
function computeWeeklyProgress() {
  const nDays = daysInMonth(state.year, state.monthIdx);
  const weeks = [];
  for (let start = 1; start <= nDays; start += 7) {
    const end = Math.min(start + 6, nDays);
    const weekDays = [];
    for (let d = start; d <= end; d++) weekDays.push(d);
    const relevant = weekDays.filter(d => isPastOrToday(state.year, state.monthIdx, d));
    const possible = state.habits.length * relevant.length;
    const done = relevant.reduce((sum, d) => {
      const dayChecks = state.checks[String(d)] || {};
      return sum + state.habits.filter(h => dayChecks[h.id]).length;
    }, 0);
    weeks.push({ week: `W${weeks.length + 1}`, pct: possible > 0 ? Math.round((done / possible) * 100) : 0 });
  }
  return weeks;
}
function computeHabitAnalysis() {
  const tracked = getTrackedDays();
  return state.habits.map(h => {
    const actual = tracked.filter(d => state.checks[String(d)]?.[h.id]).length;
    const goal = tracked.length;
    const pct = goal > 0 ? Math.round((actual / goal) * 100) : 0;
    return { ...h, goal, actual, left: Math.max(goal - actual, 0), pct };
  });
}
function computeStreak() {
  if (state.year !== today.getFullYear() || state.monthIdx !== today.getMonth()) return 0;
  let s = 0;
  const nDays = daysInMonth(state.year, state.monthIdx);
  for (let d = Math.min(today.getDate(), nDays); d >= 1; d--) {
    const dayChecks = state.checks[String(d)] || {};
    const done = state.habits.length > 0 && state.habits.every(h => dayChecks[h.id]);
    if (done) s++; else break;
  }
  return s;
}

/* ===================== RENDER ===================== */
function renderAll() {
  renderStreak();
  renderStats();
  renderDailyChart();
  renderWeeklyChart();
  renderHabitTable();
  renderAnalysis();
  renderDayStrip();
  renderTaskPanel();
  document.getElementById("dailyTitle").textContent = `Daily Progress (${MONTH_NAMES[state.monthIdx].slice(0,3)})`;
  document.getElementById("daysTitle").textContent = `Days (${MONTH_NAMES[state.monthIdx]} ${state.year})`;
}

function renderStreak() {
  document.getElementById("streakText").textContent = `${computeStreak()} day streak`;
}

function renderStats() {
  const { totalGoal, totalCompleted, overallPct } = computeStats();
  document.getElementById("goalNum").textContent = totalGoal;
  document.getElementById("doneNum").textContent = totalCompleted;
  document.getElementById("leftNum").textContent = totalGoal - totalCompleted;
  document.getElementById("overallPct").textContent = overallPct + "%";

  const ctx = document.getElementById("overallChart");
  const data = { datasets: [{ data: [overallPct, 100 - overallPct], backgroundColor: ["#FFD93D", "rgba(255,255,255,0.08)"], borderWidth: 0 }] };
  if (overallChart) { overallChart.data = data; overallChart.update(); }
  else {
    overallChart = new Chart(ctx, {
      type: "doughnut",
      data,
      options: { cutout: "72%", plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 300 } }
    });
  }
}

function renderDailyChart() {
  const data = computeDailyProgress();
  const ctx = document.getElementById("dailyChart");
  const chartData = {
    labels: data.map(d => d.day),
    datasets: [{ data: data.map(d => d.pct), backgroundColor: data.map((_, i) => PALETTE[i % PALETTE.length]), borderRadius: 4 }]
  };
  if (dailyChart) { dailyChart.data = chartData; dailyChart.update(); }
  else {
    dailyChart = new Chart(ctx, {
      type: "bar",
      data: chartData,
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + "%" } } },
        scales: {
          x: { ticks: { color: "#8577B3", font: { size: 8 }, maxTicksLimit: 10 }, grid: { display: false } },
          y: { display: false, min: 0, max: 100 }
        }
      }
    });
  }
}

function renderWeeklyChart() {
  const data = computeWeeklyProgress();
  const colors = ["#FF6B6B", "#4ECDC4", "#FFD93D", "#B085F5", "#6BCB77"];
  const ctx = document.getElementById("weeklyChart");
  const chartData = {
    labels: data.map(d => d.week),
    datasets: [{ data: data.map(d => d.pct), backgroundColor: data.map((_, i) => colors[i % colors.length]), borderRadius: 6 }]
  };
  if (weeklyChart) { weeklyChart.data = chartData; weeklyChart.update(); }
  else {
    weeklyChart = new Chart(ctx, {
      type: "bar",
      data: chartData,
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + "%" } } },
        scales: {
          x: { ticks: { color: "#8577B3", font: { size: 10 } }, grid: { display: false } },
          y: { display: false, min: 0, max: 100 }
        }
      }
    });
  }
}

function renderHabitTable() {
  const daysArr = getDaysArr();
  const isCurrentMonth = state.year === today.getFullYear() && state.monthIdx === today.getMonth();
  const head = document.getElementById("habitTableHead");
  head.innerHTML = `<th class="habit-col">Habit</th>` + daysArr.map(d =>
    `<th class="${isCurrentMonth && d === today.getDate() ? "day-head-today" : ""}">${d}</th>`
  ).join("");

  const body = document.getElementById("habitTableBody");
  body.innerHTML = "";

  state.habits.forEach(h => {
    const tr = document.createElement("tr");
    tr.className = "habit-row";
    tr.draggable = true;
    tr.dataset.habitId = h.id;

    const nameTd = document.createElement("td");
    const isEditing = editingHabitId === h.id;
    nameTd.innerHTML = `
      <div class="habit-name-cell">
        <span class="drag-handle" title="Drag to reorder">
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
        </span>
        <span class="color-dot" style="background:${h.color}"></span>
        ${isEditing
          ? `<input type="text" class="habit-name-input" id="editInput-${h.id}" value="${escapeHtml(h.name)}">`
          : `<span class="habit-name-text">${h.emoji} ${escapeHtml(h.name)}</span>`
        }
        <span class="habit-actions">
          ${isEditing
            ? `<button data-action="save" title="Save"><svg viewBox="0 0 24 24" fill="none" stroke="#6BCB77" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
               <button data-action="cancel" title="Cancel"><svg viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`
            : `<button data-action="edit" title="Edit habit"><svg viewBox="0 0 24 24" fill="none" stroke="#4D96FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
               <button data-action="delete" title="Delete habit"><svg viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`
          }
        </span>
      </div>`;
    tr.appendChild(nameTd);

    nameTd.querySelector('[data-action="edit"]')?.addEventListener("click", () => startEditHabit(h.id));
    nameTd.querySelector('[data-action="delete"]')?.addEventListener("click", () => removeHabit(h.id));
    nameTd.querySelector('[data-action="save"]')?.addEventListener("click", () => {
      const input = document.getElementById(`editInput-${h.id}`);
      commitEditHabit(h.id, input.value);
    });
    nameTd.querySelector('[data-action="cancel"]')?.addEventListener("click", cancelEditHabit);
    const editInput = document.getElementById(`editInput-${h.id}`);
    if (editInput) {
      editInput.addEventListener("keydown", e => {
        if (e.key === "Enter") commitEditHabit(h.id, editInput.value);
        if (e.key === "Escape") cancelEditHabit();
      });
      setTimeout(() => editInput.focus(), 0);
    }

    daysArr.forEach(d => {
      const td = document.createElement("td");
      const checked = !!state.checks[String(d)]?.[h.id];
      const box = document.createElement("div");
      box.className = "day-check" + (isCurrentMonth && d === today.getDate() ? " day-check-today" : "");
      box.style.background = checked ? h.color : "";
      box.style.borderColor = checked ? h.color : "";
      box.textContent = checked ? "✓" : "";
      box.addEventListener("click", () => toggleCheck(h.id, d));
      td.appendChild(box);
      tr.appendChild(td);
    });

    /* drag & drop reordering */
    tr.addEventListener("dragstart", e => {
      dragHabitId = h.id;
      tr.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    tr.addEventListener("dragend", () => {
      tr.classList.remove("dragging");
      document.querySelectorAll(".habit-row").forEach(r => r.classList.remove("drop-target"));
    });
    tr.addEventListener("dragover", e => {
      e.preventDefault();
      tr.classList.add("drop-target");
    });
    tr.addEventListener("dragleave", () => tr.classList.remove("drop-target"));
    tr.addEventListener("drop", e => {
      e.preventDefault();
      tr.classList.remove("drop-target");
      if (dragHabitId) reorderHabits(dragHabitId, h.id);
      dragHabitId = null;
    });

    body.appendChild(tr);
  });
}

function renderAnalysis() {
  const list = computeHabitAnalysis();
  const container = document.getElementById("analysisList");
  container.innerHTML = list.map(h => `
    <div>
      <div class="analysis-item-top">
        <span class="name">${h.emoji} ${escapeHtml(h.name)}</span>
        <span class="figs">${h.actual}/${h.goal} <b style="color:${h.color}">${h.pct}%</b></span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${h.pct}%;background:${h.color}"></div></div>
    </div>
  `).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ===================== DAY STRIP + TASK PANEL ===================== */
function dayTaskStatus(day) {
  const list = state.dayTasks[String(day)] || [];
  if (list.length === 0) return "pending";
  const done = list.filter(t => t.completed).length;
  if (done === 0) return "pending";
  if (done === list.length) return "completed";
  return "partial";
}

function renderDayStrip() {
  const strip = document.getElementById("dayStrip");
  const daysArr = getDaysArr();
  const isCurrentMonth = state.year === today.getFullYear() && state.monthIdx === today.getMonth();
  strip.innerHTML = "";
  daysArr.forEach(d => {
    const pill = document.createElement("div");
    const status = dayTaskStatus(d);
    let cls = "day-pill";
    if (status === "completed") cls += " completed";
    else if (status === "partial") cls += " partial";
    if (isCurrentMonth && d === today.getDate()) cls += " today";
    if (selectedDay === d) cls += " selected";
    pill.className = cls;
    pill.textContent = d;
    pill.title = `Day ${d}`;
    pill.addEventListener("click", () => selectDay(d));
    strip.appendChild(pill);
  });
}

function renderTaskPanel() {
  const titleEl = document.getElementById("taskPanelTitle");
  const addBtn = document.getElementById("addTaskBtn");
  const emptyState = document.getElementById("taskEmptyState");
  const listWrap = document.getElementById("taskListWrap");
  const listEl = document.getElementById("taskList");
  const countLabel = document.getElementById("taskCountLabel");

  if (selectedDay === null) {
    titleEl.textContent = "Tasks";
    addBtn.classList.add("hidden");
    emptyState.classList.remove("hidden");
    listWrap.classList.add("hidden");
    return;
  }

  titleEl.textContent = `${selectedDay} ${MONTH_NAMES[state.monthIdx]} ${state.year}`;
  addBtn.classList.remove("hidden");
  emptyState.classList.add("hidden");
  listWrap.classList.remove("hidden");

  listEl.innerHTML = "";
  const dayList = currentDayTaskList();
  dayList.forEach(t => {
    const row = document.createElement("div");
    row.className = "task-row";
    row.draggable = true;
    row.dataset.taskId = t.id;
    const checked = !!t.completed;
    const isEditing = editingTaskId === t.id;

    row.innerHTML = `
      <span class="task-drag-handle" title="Drag to reorder">
        <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
      </span>
      <span class="task-checkbox ${checked ? "checked" : ""}" data-role="checkbox">${checked ? "✓" : ""}</span>
      ${isEditing
        ? `<input type="text" class="task-name-input" id="taskEditInput-${t.id}" value="${escapeHtml(t.name)}">`
        : `<span class="task-name ${checked ? "checked-text" : ""}">${t.emoji} ${escapeHtml(t.name)}</span>`
      }
      <span class="task-actions">
        ${isEditing
          ? `<button data-action="save" title="Save"><svg viewBox="0 0 24 24" fill="none" stroke="#6BCB77" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
             <button data-action="cancel" title="Cancel"><svg viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`
          : `<button data-action="edit" title="Edit task"><svg viewBox="0 0 24 24" fill="none" stroke="#4D96FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
             <button data-action="delete" title="Delete task"><svg viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`
        }
      </span>`;

    row.querySelector('[data-role="checkbox"]').addEventListener("click", () => toggleTaskCheck(t.id));
    row.querySelector('[data-action="edit"]')?.addEventListener("click", () => startEditTask(t.id));
    row.querySelector('[data-action="delete"]')?.addEventListener("click", () => removeTask(t.id));
    row.querySelector('[data-action="save"]')?.addEventListener("click", () => {
      const inp = document.getElementById(`taskEditInput-${t.id}`);
      commitEditTask(t.id, inp.value);
    });
    row.querySelector('[data-action="cancel"]')?.addEventListener("click", cancelEditTask);
    const editInput = document.getElementById(`taskEditInput-${t.id}`);
    if (editInput) {
      editInput.addEventListener("keydown", e => {
        if (e.key === "Enter") commitEditTask(t.id, editInput.value);
        if (e.key === "Escape") cancelEditTask();
      });
      setTimeout(() => editInput.focus(), 0);
    }

    row.addEventListener("dragstart", () => { dragTaskId = t.id; row.classList.add("dragging"); });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      document.querySelectorAll(".task-row").forEach(r => r.classList.remove("drop-target"));
    });
    row.addEventListener("dragover", e => { e.preventDefault(); row.classList.add("drop-target"); });
    row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
    row.addEventListener("drop", e => {
      e.preventDefault();
      row.classList.remove("drop-target");
      if (dragTaskId) reorderTasks(dragTaskId, t.id);
      dragTaskId = null;
    });

    listEl.appendChild(row);
  });

  const doneCount = dayList.filter(t => t.completed).length;
  countLabel.textContent = `${doneCount} of ${dayList.length} tasks completed`;
}

/* ===================== GO ===================== */
document.addEventListener("DOMContentLoaded", init);
