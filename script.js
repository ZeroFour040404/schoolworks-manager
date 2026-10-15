// Schoolwork tracker
// Your data lives in a JSON file that you open and save yourself.
// Nothing is kept in the browser's own storage.

const CLASS_COLORS = ["#2F6FDE", "#D64550", "#1F9D74", "#C77A00", "#7A4FD1", "#0E8FA8"];
const FOLDER_NAMES = ["Notes", "Assignments", "Readings", "Exams"];
const TASK_STATUSES = ["To do", "In progress", "Done"];
const WEEKLY_REVIEW_ITEMS = [
  "Check what's due in the next 7 days",
  "Break big tasks into mini-deadlines",
  "Sort the Inbox folder into class folders",
  "Back up to cloud storage"
];
const DATA_FILE_NAME = "schoolwork-data.json";
const DATA_FILE_FORMAT_NAME = "schoolwork-tracker";
const DATA_FILE_FORMAT_VERSION = 1;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Application state (held in memory only, saved to the JSON data file)
// ---------------------------------------------------------------------------

const applicationState = {
  schoolClasses: [],
  tasks: [],
  completedReviewItemIndexes: []
};

let openedFileHandle = null;       // set when the browser lets us write back to the file directly
let currentDataFileName = null;    // name shown in the status line
let hasUnsavedChanges = false;
let isSavingToFileHandle = false;
let hasPendingSaveRequest = false;
let taskIdentifierCounter = 0;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function findElement(elementIdentifier){
  return document.getElementById(elementIdentifier);
}

function escapeHtml(text){
  const replacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, (character) => replacements[character]);
}

function padWithZero(number){
  return String(number).padStart(2, "0");
}

function formatDateAsIsoDate(date){
  return `${date.getFullYear()}-${padWithZero(date.getMonth() + 1)}-${padWithZero(date.getDate())}`;
}

function getTodayAsIsoDate(){
  return formatDateAsIsoDate(new Date());
}

function subtractDaysFromIsoDate(isoDate, numberOfDays){
  const date = new Date(isoDate + "T00:00:00");
  date.setDate(date.getDate() - numberOfDays);
  return formatDateAsIsoDate(date);
}

function addDaysToIsoDate(isoDate, numberOfDays){
  return subtractDaysFromIsoDate(isoDate, -numberOfDays);
}

function getColorForClass(schoolClassName){
  const classIndex = Math.max(0, applicationState.schoolClasses.indexOf(schoolClassName));
  return CLASS_COLORS[classIndex % CLASS_COLORS.length];
}

function getStatusCssClass(status){
  if (status === "Done") return "status-done";
  if (status === "In progress") return "status-in-progress";
  return "";
}

function createTaskIdentifier(){
  taskIdentifierCounter += 1;
  return Date.now() * 1000 + (taskIdentifierCounter % 1000);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function buildTaskHtml(task, isCompleted) {
  const isOverdue = !isCompleted && task.dueDate < getTodayAsIsoDate();
  const dueLabel = (isOverdue ? "Overdue · " : "Due ") + task.dueDate;
  const statusOptionsHtml = TASK_STATUSES
    .map((status) => `<option ${status === task.status ? "selected" : ""}>${status}</option>`)
    .join("");

  return `<li class="task-item ${isCompleted ? "task-completed" : ""}">
    <div class="task-heading">
      <span class="task-title">${escapeHtml(task.title)}</span>
      <span class="task-class-label" style="--class-color:${getColorForClass(task.schoolClassName)}">
        <span class="color-dot"></span>${escapeHtml(task.schoolClassName)}
      </span>
      <span class="task-due-date ${isOverdue ? "overdue" : ""}">${dueLabel}</span>
    </div>
    <p class="task-reminders">Reminders: ${subtractDaysFromIsoDate(task.dueDate, 7)} (1 week before), ${subtractDaysFromIsoDate(task.dueDate, 1)} (day before)</p>
    <div class="task-actions">
      <select class="${getStatusCssClass(task.status)}" data-status-task-identifier="${task.identifier}" aria-label="Status for ${escapeHtml(task.title)}">
        ${statusOptionsHtml}
      </select>
      <button class="secondary-button" data-delete-task-identifier="${task.identifier}">Delete</button>
    </div>
  </li>`;
}

function buildClassOptionsHtml(selectedClassName) {
  const optionsHtml = applicationState.schoolClasses
    .map((schoolClassName) => `<option ${schoolClassName === selectedClassName ? "selected" : ""}>${escapeHtml(schoolClassName)}</option>`)
    .join("");
  return `<option value="">Choose a class</option>` + optionsHtml;
}

function buildFolderTreeText() {
  const lastClassIndex = applicationState.schoolClasses.length - 1;
  const classLines = applicationState.schoolClasses.map((schoolClassName, classIndex) => {
    const isLastClass = classIndex === lastClassIndex;
    const classBranch = isLastClass ? "└──" : "├──";
    const folderPrefix = isLastClass ? "   " : "│  ";
    const folderLines = FOLDER_NAMES.map((folderName, folderIndex) => {
      const isLastFolder = folderIndex === FOLDER_NAMES.length - 1;
      return `    ${folderPrefix} ${isLastFolder ? "└──" : "├──"} ${folderName}`;
    });
    return `    ${classBranch} ${schoolClassName}\n` + folderLines.join("\n");
  });
  return "School\n├── Inbox\n├── Archive\n└── 2026-Fall\n" + classLines.join("\n");
}

function renderDataFileStatus(temporaryMessage) {
  const statusElement = findElement("data-file-status");
  if (temporaryMessage) {
    statusElement.textContent = temporaryMessage;
    return;
  }
  if (!currentDataFileName) {
    statusElement.textContent = hasUnsavedChanges
      ? "No data file yet. Tap Save file so your changes aren't lost."
      : "No data file open. Open one to load your tasks, or start fresh and save a new file.";
    return;
  }
  const saveNote = openedFileHandle ? "saves automatically" : hasUnsavedChanges ? "unsaved changes" : "saved";
  statusElement.textContent = `${currentDataFileName} · ${saveNote}`;
}

function renderApplication() {
  const compareByDueDate = (firstTask, secondTask) => firstTask.dueDate.localeCompare(secondTask.dueDate);
  const upcomingTasks = applicationState.tasks.filter((task) => task.status !== "Done").sort(compareByDueDate);
  const completedTasks = applicationState.tasks.filter((task) => task.status === "Done").sort(compareByDueDate);

  findElement("upcoming-tasks-container").innerHTML = upcomingTasks.length
    ? `<ul class="task-list">${upcomingTasks.map((task) => buildTaskHtml(task, false)).join("")}</ul>`
    : `<p class="empty-message">Nothing due. Add a task to get started.</p>`;

  findElement("completed-tasks-container").innerHTML = completedTasks.length
    ? `<ul class="task-list">${completedTasks.map((task) => buildTaskHtml(task, true)).join("")}</ul>`
    : `<p class="empty-message">No finished tasks yet.</p>`;

  findElement("class-chip-list").innerHTML = applicationState.schoolClasses.length
    ? applicationState.schoolClasses.map((schoolClassName, classIndex) =>
        `<li class="class-chip" style="--class-color:${getColorForClass(schoolClassName)}">
          <span class="color-dot"></span>${escapeHtml(schoolClassName)}
          <button class="remove-class-button" data-delete-class-index="${classIndex}" aria-label="Remove ${escapeHtml(schoolClassName)}">×</button>
        </li>`).join("")
    : `<li class="empty-message">No classes yet. Add one below.</li>`;

  const taskClassSelect = findElement("task-class-select");
  const fileClassSelect = findElement("file-class-select");
  taskClassSelect.innerHTML = buildClassOptionsHtml(taskClassSelect.value);
  fileClassSelect.innerHTML = buildClassOptionsHtml(fileClassSelect.value);

  findElement("weekly-review-list").innerHTML = WEEKLY_REVIEW_ITEMS
    .map((reviewItemText, reviewItemIndex) => {
      const isChecked = applicationState.completedReviewItemIndexes.includes(reviewItemIndex);
      return `<li><label><input type="checkbox" data-review-item-index="${reviewItemIndex}" ${isChecked ? "checked" : ""}> ${escapeHtml(reviewItemText)}</label></li>`;
    }).join("");

  findElement("folder-tree").textContent = buildFolderTreeText();
  renderDataFileStatus();
}

// ---------------------------------------------------------------------------
// Data file: create, validate, open, save
// ---------------------------------------------------------------------------

function createDataFileContent() {
  return JSON.stringify({
    format: DATA_FILE_FORMAT_NAME,
    version: DATA_FILE_FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    schoolClasses: applicationState.schoolClasses,
    tasks: applicationState.tasks,
    completedReviewItemIndexes: applicationState.completedReviewItemIndexes
  }, null, 2);
}

function parseDataFileContent(fileText) {
  const parsedData = JSON.parse(fileText);

  const hasValidClasses = Array.isArray(parsedData.schoolClasses)
    && parsedData.schoolClasses.every((schoolClassName) => typeof schoolClassName === "string");

  const hasValidTasks = Array.isArray(parsedData.tasks) && parsedData.tasks.every((task) =>
    task
    && typeof task.title === "string"
    && typeof task.schoolClassName === "string"
    && ISO_DATE_PATTERN.test(task.dueDate)
    && TASK_STATUSES.includes(task.status));

  if (!hasValidClasses || !hasValidTasks) {
    throw new Error("This file is not a valid Schoolwork tracker data file.");
  }

  return {
    schoolClasses: parsedData.schoolClasses,
    tasks: parsedData.tasks.map((task) => ({
      identifier: Number(task.identifier) || createTaskIdentifier(),
      title: task.title,
      schoolClassName: task.schoolClassName,
      dueDate: task.dueDate,
      status: task.status
    })),
    completedReviewItemIndexes: Array.isArray(parsedData.completedReviewItemIndexes)
      ? parsedData.completedReviewItemIndexes.filter((itemIndex) => Number.isInteger(itemIndex))
      : []
  };
}

async function loadDataFromFile(file) {
  try {
    const loadedData = parseDataFileContent(await file.text());
    applicationState.schoolClasses = loadedData.schoolClasses;
    applicationState.tasks = loadedData.tasks;
    applicationState.completedReviewItemIndexes = loadedData.completedReviewItemIndexes;
    currentDataFileName = file.name;
    hasUnsavedChanges = false;
    renderApplication();
    return true;
  } catch (error) {
    renderDataFileStatus("That file could not be opened. It isn't a valid data file from this app.");
    return false;
  }
}

async function openDataFile() {
  if (hasUnsavedChanges && !confirm("You have unsaved changes. Open another file anyway?")) return;

  if (window.showOpenFilePicker) {
    try {
      const [chosenFileHandle] = await window.showOpenFilePicker({
        types: [{ description: "Schoolwork data", accept: { "application/json": [".json"] } }]
      });
      const chosenFile = await chosenFileHandle.getFile();
      if (await loadDataFromFile(chosenFile)) {
        openedFileHandle = chosenFileHandle;
        renderDataFileStatus();
      }
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
      // Any other problem: fall back to the standard file chooser below.
    }
  }
  findElement("data-file-input").click();
}

async function deliverFile(file, shareTitle) {
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: shareTitle });
      return true;
    }
  } catch (error) {
    if (error && error.name === "AbortError") return false;
  }
  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(file);
  downloadLink.download = file.name;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  setTimeout(() => URL.revokeObjectURL(downloadLink.href), 1000);
  return true;
}

async function writeToOpenedFileHandle() {
  if (isSavingToFileHandle) {
    hasPendingSaveRequest = true;
    return true;
  }
  isSavingToFileHandle = true;
  try {
    do {
      hasPendingSaveRequest = false;
      const writableStream = await openedFileHandle.createWritable();
      await writableStream.write(createDataFileContent());
      await writableStream.close();
    } while (hasPendingSaveRequest);
    hasUnsavedChanges = false;
    renderDataFileStatus();
    return true;
  } catch (error) {
    openedFileHandle = null; // lost permission: fall back to saving a copy
    return false;
  } finally {
    isSavingToFileHandle = false;
  }
}

async function saveDataFile() {
  if (openedFileHandle && await writeToOpenedFileHandle()) return;

  const dataFile = new File([createDataFileContent()], currentDataFileName || DATA_FILE_NAME, { type: "application/json" });
  if (await deliverFile(dataFile, "Schoolwork data")) {
    currentDataFileName = dataFile.name;
    hasUnsavedChanges = false;
    renderDataFileStatus();
  }
}

function startNewDataFile() {
  if (hasUnsavedChanges && !confirm("You have unsaved changes. Start a new file anyway?")) return;
  applicationState.schoolClasses = [];
  applicationState.tasks = [];
  applicationState.completedReviewItemIndexes = [];
  openedFileHandle = null;
  currentDataFileName = null;
  hasUnsavedChanges = false;
  renderApplication();
}

function markDataChanged() {
  hasUnsavedChanges = true;
  renderApplication();
  if (openedFileHandle) writeToOpenedFileHandle();
}

// ---------------------------------------------------------------------------
// Calendar export (.ics): the calendar app sends the alerts, even when this app is closed
// ---------------------------------------------------------------------------

function escapeCalendarText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function buildCalendarAlarmLines(triggerOffset, alarmText) {
  return ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + escapeCalendarText(alarmText), "TRIGGER:" + triggerOffset, "END:VALARM"];
}

function buildCalendarFileContent(tasksToExport) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const calendarLines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Schoolwork tracker//EN", "CALSCALE:GREGORIAN"];

  tasksToExport.forEach((task) => {
    calendarLines.push(
      "BEGIN:VEVENT",
      `UID:task-${task.identifier}@schoolwork-tracker`,
      "DTSTAMP:" + timestamp,
      "DTSTART;VALUE=DATE:" + task.dueDate.replace(/-/g, ""),
      "DTEND;VALUE=DATE:" + addDaysToIsoDate(task.dueDate, 1).replace(/-/g, ""),
      "SUMMARY:" + escapeCalendarText(`${task.title} (${task.schoolClassName})`),
      "DESCRIPTION:" + escapeCalendarText(`Class: ${task.schoolClassName}`),
      ...buildCalendarAlarmLines("-P6DT15H", `Due in 1 week: ${task.title}`), // 9 AM, 7 days before
      ...buildCalendarAlarmLines("-PT15H", `Due tomorrow: ${task.title}`),     // 9 AM, the day before
      "END:VEVENT"
    );
  });

  calendarLines.push("END:VCALENDAR");
  return calendarLines.join("\r\n") + "\r\n";
}

async function exportTasksToCalendar() {
  const messageElement = findElement("export-calendar-message");
  const tasksToExport = applicationState.tasks.filter((task) => task.status !== "Done");
  if (tasksToExport.length === 0) {
    messageElement.textContent = "Nothing to export. Add a task first.";
    return;
  }
  const calendarFile = new File([buildCalendarFileContent(tasksToExport)], "schoolwork-tasks.ics", { type: "text/calendar" });
  if (await deliverFile(calendarFile, "Schoolwork tasks")) {
    messageElement.textContent = "Exported. Open the file to add the tasks to your calendar.";
  }
}

// ---------------------------------------------------------------------------
// Adding and changing things
// ---------------------------------------------------------------------------

function addSchoolClass() {
  const classNameInput = findElement("class-name-input");
  const schoolClassName = classNameInput.value.trim();
  if (!schoolClassName || applicationState.schoolClasses.includes(schoolClassName)) return;
  applicationState.schoolClasses.push(schoolClassName);
  classNameInput.value = "";
  markDataChanged();
}

function addTask() {
  const taskTitleInput = findElement("task-title-input");
  const taskDueDateInput = findElement("task-due-date-input");
  const title = taskTitleInput.value.trim();
  const schoolClassName = findElement("task-class-select").value;
  const dueDate = taskDueDateInput.value;
  if (!title || !schoolClassName || !dueDate) return;

  applicationState.tasks.push({ identifier: createTaskIdentifier(), title, schoolClassName, dueDate, status: "To do" });
  taskTitleInput.value = "";
  taskDueDateInput.value = "";
  findElement("add-task-details").open = false;
  markDataChanged();
}

function removeSchoolClass(classIndex) {
  const schoolClassName = applicationState.schoolClasses[classIndex];
  if (schoolClassName === undefined) return;

  const numberOfTasksInClass = applicationState.tasks.filter((task) => task.schoolClassName === schoolClassName).length;
  const confirmationMessage = numberOfTasksInClass
    ? `Remove ${schoolClassName} and its ${numberOfTasksInClass} task${numberOfTasksInClass === 1 ? "" : "s"}?`
    : `Remove ${schoolClassName}?`;
  if (!confirm(confirmationMessage)) return;

  applicationState.schoolClasses.splice(classIndex, 1);
  applicationState.tasks = applicationState.tasks.filter((task) => task.schoolClassName !== schoolClassName);
  markDataChanged();
}

function buildFileName() {
  const schoolClassName = findElement("file-class-select").value;
  const assignmentName = findElement("file-assignment-input").value.trim().replace(/\s+/g, "");
  const fileDate = findElement("file-date-input").value;
  const versionNumber = findElement("file-version-input").value || 1;
  if (!schoolClassName || !assignmentName || !fileDate) return;

  const outputElement = findElement("file-name-output");
  outputElement.textContent = `${schoolClassName}_${assignmentName}_${fileDate}_v${versionNumber}`;
  outputElement.hidden = false;
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

document.querySelector("nav").addEventListener("click", (clickEvent) => {
  const tabButton = clickEvent.target.closest("button[data-tab-name]");
  if (!tabButton) return;
  document.querySelectorAll("nav button").forEach((otherButton) => {
    otherButton.setAttribute("aria-selected", otherButton === tabButton);
  });
  document.querySelectorAll(".tab-panel").forEach((tabPanel) => {
    tabPanel.classList.toggle("active", tabPanel.id === tabButton.dataset.tabName + "-panel");
  });
  document.querySelector("main").scrollTop = 0;
});

document.addEventListener("click", (clickEvent) => {
  const { deleteClassIndex, deleteTaskIdentifier } = clickEvent.target.dataset || {};

  if (deleteClassIndex !== undefined) {
    removeSchoolClass(Number(deleteClassIndex));
  } else if (deleteTaskIdentifier !== undefined) {
    applicationState.tasks = applicationState.tasks.filter((task) => task.identifier !== Number(deleteTaskIdentifier));
    markDataChanged();
  }
});

document.addEventListener("change", (changeEvent) => {
  const { statusTaskIdentifier, reviewItemIndex } = changeEvent.target.dataset || {};

  if (statusTaskIdentifier !== undefined) {
    const matchingTask = applicationState.tasks.find((task) => task.identifier === Number(statusTaskIdentifier));
    if (matchingTask) {
      matchingTask.status = changeEvent.target.value;
      markDataChanged();
    }
  } else if (reviewItemIndex !== undefined) {
    const itemIndex = Number(reviewItemIndex);
    applicationState.completedReviewItemIndexes = changeEvent.target.checked
      ? [...new Set([...applicationState.completedReviewItemIndexes, itemIndex])]
      : applicationState.completedReviewItemIndexes.filter((existingIndex) => existingIndex !== itemIndex);
    hasUnsavedChanges = true;
    renderDataFileStatus();
    if (openedFileHandle) writeToOpenedFileHandle();
  }
});

findElement("open-data-file-button").addEventListener("click", openDataFile);
findElement("save-data-file-button").addEventListener("click", saveDataFile);
findElement("new-data-file-button").addEventListener("click", startNewDataFile);
findElement("add-class-button").addEventListener("click", addSchoolClass);
findElement("add-task-button").addEventListener("click", addTask);
findElement("export-calendar-button").addEventListener("click", exportTasksToCalendar);
findElement("build-file-name-button").addEventListener("click", buildFileName);

findElement("data-file-input").addEventListener("change", async (changeEvent) => {
  const chosenFile = changeEvent.target.files[0];
  changeEvent.target.value = "";
  if (!chosenFile) return;
  openedFileHandle = null;
  await loadDataFromFile(chosenFile);
});

window.addEventListener("beforeunload", (unloadEvent) => {
  if (hasUnsavedChanges) {
    unloadEvent.preventDefault();
    unloadEvent.returnValue = "";
  }
});

renderApplication();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
