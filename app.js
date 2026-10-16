const STORAGE_KEY = "daylight-plans-v1";
const COLORS = {
  "#a9c9bb": "Sage green",
  "#f2c3a7": "Peach",
  "#f0d58c": "Sunshine",
  "#b9c6ed": "Periwinkle",
  "#e5b8c7": "Rose",
  "#c9b9e8": "Lilac",
  "#a9d5dd": "Sky blue"
};

const dateInput = document.querySelector("#schedule-date");
const timeline = document.querySelector("#timeline");
const emptyState = document.querySelector("#empty-state");
const form = document.querySelector("#plan-form");
const formCard = document.querySelector("#plan-form-card");
const titleInput = document.querySelector("#task-title");
const notesInput = document.querySelector("#task-notes");
const startInput = document.querySelector("#task-start");
const endInput = document.querySelector("#task-end");
const colorInput = document.querySelector("#task-color");
const reminderInput = document.querySelector("#task-reminder");
const formError = document.querySelector("#form-error");
const toast = document.querySelector("#toast");
const notificationLabel = document.querySelector("#notification-label");

let plans = loadPlans();
let editingId = null;
let notificationTimers = new Map();
let toastTimer;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadPlans() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) throw new Error("Saved schedule has an invalid format.");
    return saved.filter((plan) =>
      plan && typeof plan.id === "string" && typeof plan.date === "string" &&
      typeof plan.title === "string" && typeof plan.start === "string" &&
      typeof plan.end === "string" && typeof plan.color === "string"
    );
  } catch (error) {
    console.error("Unable to load the saved schedule.", error);
    return [];
  }
}

function savePlans() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch (error) {
    console.error("Unable to save the schedule.", error);
    showToast("Couldn't save your plans. Check your browser storage settings.");
  }
}

function formatTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric"
  });
}

function render() {
  const selectedDate = dateInput.value;
  const todaysPlans = plans
    .filter((plan) => plan.date === selectedDate)
    .sort((a, b) => a.start.localeCompare(b.start));

  timeline.querySelectorAll(".plan-item").forEach((item) => item.remove());
  emptyState.hidden = todaysPlans.length > 0;
  document.querySelector("#task-count").textContent = `${todaysPlans.length} ${todaysPlans.length === 1 ? "plan" : "plans"}`;
  document.querySelector("#schedule-summary").textContent = todaysPlans.length
    ? `Here’s what ${selectedDate === localDateString() ? "you have planned today" : "you have planned"}`
    : "A little progress goes a long way.";
  document.querySelector("#date-eyebrow").textContent = formatDate(selectedDate).toUpperCase();

  todaysPlans.forEach((plan) => {
    const item = document.createElement("article");
    item.className = "plan-item";
    item.style.setProperty("--plan-color", plan.color);
    item.dataset.id = plan.id;

    const time = document.createElement("div");
    time.className = "plan-time";
    time.append(document.createTextNode(formatTime(plan.start)));
    const end = document.createElement("span");
    end.textContent = formatTime(plan.end);
    time.append(end);

    const copy = document.createElement("div");
    copy.className = "plan-copy";
    const title = document.createElement("h3");
    title.textContent = plan.title;
    copy.append(title);
    if (plan.notes) {
      const notes = document.createElement("p");
      notes.textContent = plan.notes;
      copy.append(notes);
    }
    if (plan.reminder) {
      const reminder = document.createElement("span");
      reminder.className = "plan-reminder";
      reminder.textContent = "◷ Reminder on";
      copy.append(reminder);
    }

    const actions = document.createElement("div");
    actions.className = "plan-actions";
    const editButton = document.createElement("button");
    editButton.className = "icon-button";
    editButton.type = "button";
    editButton.setAttribute("aria-label", `Edit ${plan.title}`);
    editButton.title = "Edit plan";
    editButton.textContent = "✎";
    editButton.addEventListener("click", () => editPlan(plan.id));
    const deleteButton = document.createElement("button");
    deleteButton.className = "icon-button delete";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `Delete ${plan.title}`);
    deleteButton.title = "Delete plan";
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", () => deletePlan(plan.id));
    actions.append(editButton, deleteButton);

    item.append(time, copy, actions);
    const startAt = new Date(`${plan.date}T${plan.start}`);
    const endAt = new Date(`${plan.date}T${plan.end}`);
    const now = new Date();
    if (startAt <= now && now < endAt) {
      item.classList.add("is-current");
      const nowLabel = document.createElement("span");
      nowLabel.className = "now-label";
      nowLabel.textContent = "IN PROGRESS";
      item.append(nowLabel);
    }
    timeline.append(item);
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3500);
}

function updateNotificationStatus() {
  if (!("Notification" in window)) {
    notificationLabel.textContent = "Notifications unavailable";
  } else if (Notification.permission === "granted") {
    notificationLabel.textContent = "Notifications on";
  } else if (Notification.permission === "denied") {
    notificationLabel.textContent = "Notifications blocked";
  } else {
    notificationLabel.textContent = "Notifications off";
  }
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    showToast("This browser doesn't support desktop notifications.");
    updateNotificationStatus();
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") {
    showToast("Notifications are blocked. Allow them in your browser settings to use reminders.");
    updateNotificationStatus();
    return false;
  }
  const permission = await Notification.requestPermission();
  updateNotificationStatus();
  if (permission !== "granted") showToast("Notifications weren't enabled. You can turn them on in browser settings.");
  return permission === "granted";
}

function scheduleNotifications() {
  notificationTimers.forEach((timer) => window.clearTimeout(timer));
  notificationTimers.clear();
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const now = Date.now();
  plans.filter((plan) => plan.reminder).forEach((plan) => {
    const startAt = new Date(`${plan.date}T${plan.start}`).getTime();
    const delay = startAt - now;
    if (delay <= 0 || delay > 2147483647) return;
    const timer = window.setTimeout(() => {
      try {
        new Notification("Time for your plan", {
          body: `${plan.title} starts now${plan.notes ? ` — ${plan.notes}` : ""}`,
          tag: `daylight-${plan.id}`
        });
      } catch (error) {
        console.error("Unable to show a schedule reminder.", error);
        showToast(`It's time for ${plan.title}.`);
      }
      notificationTimers.delete(plan.id);
    }, delay);
    notificationTimers.set(plan.id, timer);
  });
}

function resetForm() {
  editingId = null;
  form.reset();
  colorInput.value = "#a9c9bb";
  document.querySelector("#color-name").textContent = COLORS[colorInput.value];
  reminderInput.checked = false;
  document.querySelector("#form-title").textContent = "Add a plan";
  document.querySelector("#submit-button").innerHTML = "<span>＋</span> Add to my day";
  document.querySelector("#cancel-edit").hidden = true;
  formError.hidden = true;
}

function editPlan(id) {
  const plan = plans.find((item) => item.id === id);
  if (!plan) return;
  editingId = id;
  titleInput.value = plan.title;
  notesInput.value = plan.notes || "";
  startInput.value = plan.start;
  endInput.value = plan.end;
  colorInput.value = plan.color;
  document.querySelector("#color-name").textContent = COLORS[plan.color] || "Custom colour";
  reminderInput.checked = Boolean(plan.reminder);
  document.querySelector("#form-title").textContent = "Edit your plan";
  document.querySelector("#submit-button").innerHTML = "Save changes";
  document.querySelector("#cancel-edit").hidden = false;
  formError.hidden = true;
  formCard.scrollIntoView({ behavior: "smooth", block: "start" });
  titleInput.focus({ preventScroll: true });
}

function deletePlan(id) {
  plans = plans.filter((plan) => plan.id !== id);
  savePlans();
  render();
  scheduleNotifications();
  if (editingId === id) resetForm();
  showToast("Plan removed from your schedule.");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.hidden = true;
  if (endInput.value <= startInput.value) {
    formError.textContent = "Your end time needs to be later than your start time.";
    formError.hidden = false;
    endInput.focus();
    return;
  }

  const wantsReminder = reminderInput.checked;
  if (wantsReminder && !(await requestNotificationPermission())) return;

  const existing = editingId ? plans.find((plan) => plan.id === editingId) : null;
  const plan = {
    id: editingId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    date: dateInput.value,
    title: titleInput.value.trim(),
    notes: notesInput.value.trim(),
    start: startInput.value,
    end: endInput.value,
    color: colorInput.value,
    reminder: wantsReminder,
    createdAt: existing ? existing.createdAt : Date.now()
  };
  if (existing) plans = plans.map((item) => item.id === editingId ? plan : item);
  else plans.push(plan);

  savePlans();
  render();
  scheduleNotifications();
  resetForm();
  showToast(existing ? "Your plan has been updated." : "Plan added to your day.");
});

document.querySelector("#cancel-edit").addEventListener("click", resetForm);
document.querySelector("#empty-add-button").addEventListener("click", () => titleInput.focus());
document.querySelector("#previous-day").addEventListener("click", () => moveDate(-1));
document.querySelector("#next-day").addEventListener("click", () => moveDate(1));
dateInput.addEventListener("change", () => {
  resetForm();
  render();
});
document.querySelector("#notification-status").addEventListener("click", async () => {
  if (!("Notification" in window) || Notification.permission !== "granted") await requestNotificationPermission();
  else showToast("Reminders are ready for plans with notifications enabled.");
});
colorInput.addEventListener("input", () => {
  document.querySelector("#color-name").textContent = COLORS[colorInput.value] || "Custom colour";
});

function moveDate(amount) {
  const [year, month, day] = dateInput.value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  dateInput.value = localDateString(date);
  resetForm();
  render();
}

dateInput.value = localDateString();
updateNotificationStatus();
render();
scheduleNotifications();
window.addEventListener("focus", scheduleNotifications);
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    plans = loadPlans();
    render();
    scheduleNotifications();
  }
});
