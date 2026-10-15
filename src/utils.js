import { CLASS_COLORS, ISO_DATE_PATTERN, TASK_STATUSES } from "./constants";

let taskIdentifierCounter = 0;

export function createTaskIdentifier() {
  taskIdentifierCounter += 1;
  return Date.now() * 1000 + (taskIdentifierCounter % 1000);
}

export function padWithZero(number) {
  return String(number).padStart(2, "0");
}

export function formatDateAsIsoDate(date) {
  return `${date.getFullYear()}-${padWithZero(date.getMonth() + 1)}-${padWithZero(date.getDate())}`;
}

export function getTodayAsIsoDate() {
  return formatDateAsIsoDate(new Date());
}

export function subtractDaysFromIsoDate(isoDate, numberOfDays) {
  const date = new Date(isoDate + "T00:00:00");
  date.setDate(date.getDate() - numberOfDays);
  return formatDateAsIsoDate(date);
}

export function addDaysToIsoDate(isoDate, numberOfDays) {
  return subtractDaysFromIsoDate(isoDate, -numberOfDays);
}

export function getColorForClass(schoolClasses, schoolClassName) {
  const classIndex = Math.max(0, schoolClasses.indexOf(schoolClassName));
  return CLASS_COLORS[classIndex % CLASS_COLORS.length];
}

export function getStatusCssClass(status) {
  if (status === "Done") return "status-done";
  if (status === "In progress") return "status-in-progress";
  return "";
}

export function parseDataFileContent(fileText) {
  const parsedData = JSON.parse(fileText);

  const hasValidClasses =
    Array.isArray(parsedData.schoolClasses) &&
    parsedData.schoolClasses.every((c) => typeof c === "string");

  const hasValidTasks =
    Array.isArray(parsedData.tasks) &&
    parsedData.tasks.every(
      (task) =>
        task &&
        typeof task.title === "string" &&
        typeof task.schoolClassName === "string" &&
        ISO_DATE_PATTERN.test(task.dueDate) &&
        TASK_STATUSES.includes(task.status)
    );

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
      status: task.status,
    })),
    completedReviewItemIndexes: Array.isArray(parsedData.completedReviewItemIndexes)
      ? parsedData.completedReviewItemIndexes.filter((i) => Number.isInteger(i))
      : [],
  };
}
