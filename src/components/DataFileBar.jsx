import React, { useRef } from "react";
import { openDataFile, loadFromInputFile, saveDataFile } from "../dataFile";

export default function DataFileBar({
  state,
  fileHandle,
  setFileHandle,
  currentDataFileName,
  setCurrentDataFileName,
  hasUnsavedChanges,
  setHasUnsavedChanges,
  onStateLoaded,
  accountSaveStatus,
}) {
  const fileInputRef = useRef(null);

  // Status text
  let statusText;
  if (!currentDataFileName) {
    statusText = "No JSON data file open. Your account data is stored on the server.";
  } else {
    const saveNote = fileHandle
      ? "saves automatically"
      : hasUnsavedChanges
      ? "unsaved changes"
      : "saved";
    statusText = `${currentDataFileName} · ${saveNote}`;
  }

  async function handleOpen() {
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Open another file anyway?"))
      return;
    const result = await openDataFile();
    if (!result) return;
    if (result === "use-input") {
      fileInputRef.current.click();
      return;
    }
    onStateLoaded(result.loaded);
    setCurrentDataFileName(result.fileName);
    setFileHandle(result.fileHandle);
    setHasUnsavedChanges(false);
  }

  async function handleSave() {
    const result = await saveDataFile(state, fileHandle, currentDataFileName);
    if (result.saved) {
      setCurrentDataFileName(result.newFileName);
      setFileHandle(result.fileHandle);
      setHasUnsavedChanges(false);
    }
  }

  function handleNew() {
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Start a new file anyway?"))
      return;
    onStateLoaded({ schoolClasses: [], tasks: [], completedReviewItemIndexes: [] });
    setFileHandle(null);
    setCurrentDataFileName(null);
    setHasUnsavedChanges(false);
  }

  async function handleFileInputChange(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const result = await loadFromInputFile(file);
      onStateLoaded(result.loaded);
      setCurrentDataFileName(result.fileName);
      setFileHandle(null);
      setHasUnsavedChanges(false);
    } catch {
      // show error in status (simple approach: alert)
      alert("That file could not be opened. It isn't a valid data file from this app.");
    }
  }

  return (
    <section className="data-file-bar" aria-label="Data file">
      <p className="data-file-status">{statusText}</p>
      <p className="data-file-status" aria-live="polite">{accountSaveStatus}</p>
      <div className="data-file-buttons">
        <button className="secondary-button" id="open-data-file-button" onClick={handleOpen}>
          Open file
        </button>
        <button className="primary-button" id="save-data-file-button" onClick={handleSave}>
          Save file
        </button>
        <button className="secondary-button" id="new-data-file-button" onClick={handleNew}>
          New file
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        id="data-file-input"
        accept=".json,application/json"
        hidden
        onChange={handleFileInputChange}
      />
    </section>
  );
}
