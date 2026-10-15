import React, { useState, useEffect, useCallback } from "react";
import Header from "./components/Header";
import DataFileBar from "./components/DataFileBar";
import TasksPanel from "./components/TasksPanel";
import ClassesPanel from "./components/ClassesPanel";
import FilesPanel from "./components/FilesPanel";
import { writeToOpenedFileHandle, createDataFileContent } from "./dataFile";

const TABS = ["tasks", "classes", "files"];

const INITIAL_STATE = {
  schoolClasses: [],
  tasks: [],
  completedReviewItemIndexes: [],
};

export default function App() {
  const [activeTab, setActiveTab] = useState("tasks");
  const [state, setState] = useState(INITIAL_STATE);
  const [fileHandle, setFileHandle] = useState(null);
  const [currentDataFileName, setCurrentDataFileName] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Auto-save whenever state changes and we have a file handle
  useEffect(() => {
    if (!fileHandle || !hasUnsavedChanges) return;
    writeToOpenedFileHandle(fileHandle, createDataFileContent(state));
  }, [state, fileHandle, hasUnsavedChanges]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const handleStateChange = useCallback((newState) => {
    setState(newState);
    setHasUnsavedChanges(true);
  }, []);

  function handleStateLoaded(loaded) {
    setState(loaded);
    setHasUnsavedChanges(false);
  }

  return (
    <>
      <Header />
      <DataFileBar
        state={state}
        fileHandle={fileHandle}
        setFileHandle={setFileHandle}
        currentDataFileName={currentDataFileName}
        setCurrentDataFileName={setCurrentDataFileName}
        hasUnsavedChanges={hasUnsavedChanges}
        setHasUnsavedChanges={setHasUnsavedChanges}
        onStateLoaded={handleStateLoaded}
      />

      <main>
        {activeTab === "tasks" && (
          <TasksPanel state={state} onChange={handleStateChange} />
        )}
        {activeTab === "classes" && (
          <ClassesPanel state={state} onChange={handleStateChange} />
        )}
        {activeTab === "files" && (
          <FilesPanel state={state} />
        )}
      </main>

      <nav role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>
    </>
  );
}
