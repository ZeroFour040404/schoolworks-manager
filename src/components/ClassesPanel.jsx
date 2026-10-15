import React, { useState } from "react";
import { WEEKLY_REVIEW_ITEMS } from "../constants";
import { getColorForClass } from "../utils";

export default function ClassesPanel({ state, onChange }) {
  const [className, setClassName] = useState("");

  function handleAddClass() {
    const name = className.trim();
    if (!name || state.schoolClasses.includes(name)) return;
    onChange({ ...state, schoolClasses: [...state.schoolClasses, name] });
    setClassName("");
  }

  function handleRemoveClass(index) {
    const name = state.schoolClasses[index];
    const count = state.tasks.filter((t) => t.schoolClassName === name).length;
    const msg = count
      ? `Remove ${name} and its ${count} task${count === 1 ? "" : "s"}?`
      : `Remove ${name}?`;
    if (!confirm(msg)) return;
    onChange({
      ...state,
      schoolClasses: state.schoolClasses.filter((_, i) => i !== index),
      tasks: state.tasks.filter((t) => t.schoolClassName !== name),
    });
  }

  function handleReviewToggle(index, checked) {
    const updated = checked
      ? [...new Set([...state.completedReviewItemIndexes, index])]
      : state.completedReviewItemIndexes.filter((i) => i !== index);
    onChange({ ...state, completedReviewItemIndexes: updated });
  }

  return (
    <section id="classes-panel" className="tab-panel active">
      {/* Classes */}
      <div className="card">
        <h2>Classes</h2>
        <ul className="class-chip-list" id="class-chip-list">
          {state.schoolClasses.length ? (
            state.schoolClasses.map((name, index) => (
              <li
                key={name}
                className="class-chip"
                style={{ "--class-color": getColorForClass(state.schoolClasses, name) }}
              >
                <span className="color-dot" />
                {name}
                <button
                  className="remove-class-button"
                  aria-label={`Remove ${name}`}
                  onClick={() => handleRemoveClass(index)}
                >
                  ×
                </button>
              </li>
            ))
          ) : (
            <li className="empty-message">No classes yet. Add one below.</li>
          )}
        </ul>
        <div className="form-grid">
          <input
            id="class-name-input"
            placeholder="Add a class"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddClass()}
          />
          <button className="primary-button" id="add-class-button" onClick={handleAddClass}>
            Add class
          </button>
        </div>
      </div>

      {/* Weekly review */}
      <div className="card">
        <h2>Weekly review</h2>
        <ul className="review-list" id="weekly-review-list">
          {WEEKLY_REVIEW_ITEMS.map((text, index) => (
            <li key={index}>
              <label>
                <input
                  type="checkbox"
                  checked={state.completedReviewItemIndexes.includes(index)}
                  onChange={(e) => handleReviewToggle(index, e.target.checked)}
                />
                {text}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
