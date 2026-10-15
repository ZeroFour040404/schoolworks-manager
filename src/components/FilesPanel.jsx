import React, { useState } from "react";
import { FOLDER_NAMES } from "../constants";

function buildFolderTreeText(schoolClasses) {
  const lastIndex = schoolClasses.length - 1;
  const classLines = schoolClasses.map((name, i) => {
    const isLast = i === lastIndex;
    const branch = isLast ? "└──" : "├──";
    const prefix = isLast ? "   " : "│  ";
    const folderLines = FOLDER_NAMES.map((folder, fi) => {
      const isLastFolder = fi === FOLDER_NAMES.length - 1;
      return `    ${prefix} ${isLastFolder ? "└──" : "├──"} ${folder}`;
    });
    return `    ${branch} ${name}\n` + folderLines.join("\n");
  });
  return "School\n├── Inbox\n├── Archive\n└── 2026-Fall\n" + classLines.join("\n");
}

export default function FilesPanel({ state }) {
  const [fileClass, setFileClass] = useState("");
  const [assignment, setAssignment] = useState("");
  const [fileDate, setFileDate] = useState("");
  const [version, setVersion] = useState(1);
  const [outputName, setOutputName] = useState(null);

  function handleBuildFileName() {
    const name = assignment.trim().replace(/\s+/g, "");
    if (!fileClass || !name || !fileDate) return;
    setOutputName(`${fileClass}_${name}_${fileDate}_v${version}`);
  }

  return (
    <section id="files-panel" className="tab-panel active">
      {/* File name builder */}
      <div className="card">
        <h2>File name builder</h2>
        <div className="form-grid">
          <select
            id="file-class-select"
            aria-label="Class"
            value={fileClass}
            onChange={(e) => setFileClass(e.target.value)}
          >
            <option value="">Choose a class</option>
            {state.schoolClasses.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            id="file-assignment-input"
            placeholder="Assignment"
            value={assignment}
            onChange={(e) => setAssignment(e.target.value)}
          />
          <div className="two-column-row">
            <input
              id="file-date-input"
              type="date"
              aria-label="Date"
              value={fileDate}
              onChange={(e) => setFileDate(e.target.value)}
            />
            <input
              id="file-version-input"
              type="number"
              min="1"
              aria-label="Version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </div>
          <button className="primary-button" id="build-file-name-button" onClick={handleBuildFileName}>
            Build file name
          </button>
          {outputName && (
            <code className="output-box" id="file-name-output">
              {outputName}
            </code>
          )}
        </div>
      </div>

      {/* Folder structure */}
      <div className="card">
        <h2>Folder structure</h2>
        <pre className="folder-tree-text" id="folder-tree">
          {buildFolderTreeText(state.schoolClasses)}
        </pre>
      </div>
    </section>
  );
}
