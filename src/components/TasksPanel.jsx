import React, { useState } from "react";
import { TASK_STATUSES } from "../constants";
import {
  getTodayAsIsoDate,
  subtractDaysFromIsoDate,
  getColorForClass,
  getStatusCssClass,
  createTaskIdentifier,
} from "../utils";
import { exportTasksToCalendar } from "../dataFile";

// ── Single task row ──────────────────────────────────────────────────────────

function TaskItem({ task, schoolClasses, isCompleted, onStatusChange, onDelete }) {
  const isOverdue = !isCompleted && task.dueDate < getTodayAsIsoDate();
  const dueLabel = (isOverdue ? "Overdue · " : "Due ") + task.dueDate;
  const color = getColorForClass(schoolClasses, task.schoolClassName);

  return (
    <li className={`task-item${isCompleted ? " task-completed" : ""}`}>
      <div className="task-heading">
        <span className="task-title">{task.title}</span>
        <span className="task-class-label" style={{ "--class-color": color }}>
          <span className="color-dot" />
          {task.schoolClassName}
        </span>
        <span className={`task-due-date${isOverdue ? " overdue" : ""}`}>{dueLabel}</span>
      </div>
      <p className="task-reminders">
        Reminders: {subtractDaysFromIsoDate(task.dueDate, 7)} (1 week before),{" "}
        {subtractDaysFromIsoDate(task.dueDate, 1)} (day before)
      </p>
      <div className="task-actions">
        <select
          className={getStatusCssClass(task.status)}
          value={task.status}
          aria-label={`Status for ${task.title}`}
          onChange={(e) => onStatusChange(task.identifier, e.target.value)}
        >
          {TASK_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          className="secondary-button"
          onClick={() => onDelete(task.identifier)}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

// ── Tasks panel ──────────────────────────────────────────────────────────────

export default function TasksPanel({ state, onChange }) {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskClass, setTaskClass] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [calendarMessage, setCalendarMessage] = useState(
    "Adds your upcoming tasks with alerts at 9 AM, one week and one day before."
  );
  const [detailsOpen, setDetailsOpen] = useState(false);

  const compareByDueDate = (a, b) => a.dueDate.localeCompare(b.dueDate);
  const upcomingTasks = state.tasks.filter((t) => t.status !== "Done").sort(compareByDueDate);
  const completedTasks = state.tasks.filter((t) => t.status === "Done").sort(compareByDueDate);

  function handleAddTask() {
    const title = taskTitle.trim();
    const schoolClassName = taskClass;
    const dueDate = taskDueDate;
    if (!title || !schoolClassName || !dueDate) return;
    onChange({
      ...state,
      tasks: [
        ...state.tasks,
        { identifier: createTaskIdentifier(), title, schoolClassName, dueDate, status: "To do" },
      ],
    });
    setTaskTitle("");
    setTaskDueDate("");
    setDetailsOpen(false);
  }

  function handleStatusChange(identifier, newStatus) {
    onChange({
      ...state,
      tasks: state.tasks.map((t) =>
        t.identifier === identifier ? { ...t, status: newStatus } : t
      ),
    });
  }

  function handleDelete(identifier) {
    onChange({
      ...state,
      tasks: state.tasks.filter((t) => t.identifier !== identifier),
    });
  }

  async function handleExportCalendar() {
    const toExport = state.tasks.filter((t) => t.status !== "Done");
    if (toExport.length === 0) {
      setCalendarMessage("Nothing to export. Add a task first.");
      return;
    }
    const ok = await exportTasksToCalendar(toExport);
    if (ok) setCalendarMessage("Exported. Open the file to add the tasks to your calendar.");
  }

  return (
    <section id="tasks-panel" className="tab-panel active">
      {/* Add task */}
      <div className="card">
        <details open={detailsOpen} onToggle={(e) => setDetailsOpen(e.target.open)} id="add-task-details">
          <summary>Add a task</summary>
          <div className="form-grid">
            <input
              id="task-title-input"
              placeholder="Task"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <select
              id="task-class-select"
              aria-label="Class"
              value={taskClass}
              onChange={(e) => setTaskClass(e.target.value)}
            >
              <option value="">Choose a class</option>
              {state.schoolClasses.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              id="task-due-date-input"
              type="date"
              aria-label="Due date"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
            />
            <button className="primary-button" id="add-task-button" onClick={handleAddTask}>
              Add task
            </button>
          </div>
        </details>
      </div>

      {/* Upcoming */}
      <div className="card ruled-sheet">
        <h2>Upcoming</h2>
        <div id="upcoming-tasks-container">
          {upcomingTasks.length ? (
            <ul className="task-list">
              {upcomingTasks.map((task) => (
                <TaskItem
                  key={task.identifier}
                  task={task}
                  schoolClasses={state.schoolClasses}
                  isCompleted={false}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          ) : (
            <p className="empty-message">Nothing due. Add a task to get started.</p>
          )}
        </div>
      </div>

      {/* Calendar export */}
      <div className="card">
        <button
          className="primary-button"
          id="export-calendar-button"
          style={{ width: "100%" }}
          onClick={handleExportCalendar}
        >
          Export to calendar
        </button>
        <p className="hint-text" id="export-calendar-message">
          {calendarMessage}
        </p>
      </div>

      {/* Done */}
      <div className="card ruled-sheet">
        <h2>Done</h2>
        <div id="completed-tasks-container">
          {completedTasks.length ? (
            <ul className="task-list">
              {completedTasks.map((task) => (
                <TaskItem
                  key={task.identifier}
                  task={task}
                  schoolClasses={state.schoolClasses}
                  isCompleted={true}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          ) : (
            <p className="empty-message">No finished tasks yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
