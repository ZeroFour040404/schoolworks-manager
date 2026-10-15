import {
  DATA_FILE_FORMAT_NAME,
  DATA_FILE_FORMAT_VERSION,
  DATA_FILE_NAME,
} from "./constants";
import { addDaysToIsoDate, parseDataFileContent } from "./utils";

// ── Serialise ──────────────────────────────────────────────────────────────

export function createDataFileContent(state) {
  return JSON.stringify(
    {
      format: DATA_FILE_FORMAT_NAME,
      version: DATA_FILE_FORMAT_VERSION,
      savedAt: new Date().toISOString(),
      schoolClasses: state.schoolClasses,
      tasks: state.tasks,
      completedReviewItemIndexes: state.completedReviewItemIndexes,
    },
    null,
    2
  );
}

// ── Deliver (share sheet → download fallback) ──────────────────────────────

export async function deliverFile(file, shareTitle) {
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: shareTitle });
      return true;
    }
  } catch (error) {
    if (error && error.name === "AbortError") return false;
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  return true;
}

// ── File-handle auto-save ──────────────────────────────────────────────────

let isSavingToFileHandle = false;
let hasPendingSaveRequest = false;

export async function writeToOpenedFileHandle(fileHandle, content) {
  if (isSavingToFileHandle) {
    hasPendingSaveRequest = true;
    return true;
  }
  isSavingToFileHandle = true;
  try {
    do {
      hasPendingSaveRequest = false;
      const stream = await fileHandle.createWritable();
      await stream.write(content);
      await stream.close();
    } while (hasPendingSaveRequest);
    return true;
  } catch {
    return false;
  } finally {
    isSavingToFileHandle = false;
  }
}

// ── Open ───────────────────────────────────────────────────────────────────

export async function openDataFile() {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: "Schoolwork data",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const file = await handle.getFile();
      const loaded = parseDataFileContent(await file.text());
      return { loaded, fileName: file.name, fileHandle: handle };
    } catch (error) {
      if (error && error.name === "AbortError") return null;
      // fall through to <input> approach
    }
  }
  // Trigger the hidden file input — caller must wire this up
  return "use-input";
}

export async function loadFromInputFile(file) {
  const loaded = parseDataFileContent(await file.text());
  return { loaded, fileName: file.name, fileHandle: null };
}

// ── Save ───────────────────────────────────────────────────────────────────

export async function saveDataFile(state, fileHandle, currentDataFileName) {
  const content = createDataFileContent(state);

  if (fileHandle) {
    const ok = await writeToOpenedFileHandle(fileHandle, content);
    if (ok) return { saved: true, newFileName: currentDataFileName, fileHandle };
  }

  const fileName = currentDataFileName || DATA_FILE_NAME;
  const dataFile = new File([content], fileName, { type: "application/json" });
  const delivered = await deliverFile(dataFile, "Schoolwork data");
  if (delivered) {
    return { saved: true, newFileName: dataFile.name, fileHandle: null };
  }
  return { saved: false };
}

// ── Calendar export ────────────────────────────────────────────────────────

function escapeCalendarText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function alarmLines(triggerOffset, description) {
  return [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:" + escapeCalendarText(description),
    "TRIGGER:" + triggerOffset,
    "END:VALARM",
  ];
}

export async function exportTasksToCalendar(tasks) {
  const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Schoolwork tracker//EN",
    "CALSCALE:GREGORIAN",
  ];

  tasks.forEach((task) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:task-${task.identifier}@schoolwork-tracker`,
      "DTSTAMP:" + ts,
      "DTSTART;VALUE=DATE:" + task.dueDate.replace(/-/g, ""),
      "DTEND;VALUE=DATE:" + addDaysToIsoDate(task.dueDate, 1).replace(/-/g, ""),
      "SUMMARY:" + escapeCalendarText(`${task.title} (${task.schoolClassName})`),
      "DESCRIPTION:" + escapeCalendarText(`Class: ${task.schoolClassName}`),
      ...alarmLines("-P6DT15H", `Due in 1 week: ${task.title}`),
      ...alarmLines("-PT15H", `Due tomorrow: ${task.title}`),
      "END:VEVENT"
    );
  });

  lines.push("END:VCALENDAR");
  const content = lines.join("\r\n") + "\r\n";
  const file = new File([content], "schoolwork-tasks.ics", { type: "text/calendar" });
  return await deliverFile(file, "Schoolwork tasks");
}
