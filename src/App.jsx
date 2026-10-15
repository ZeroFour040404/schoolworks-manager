import React, { useState, useEffect, useCallback } from "react";
import Header from "./components/Header";
import DataFileBar from "./components/DataFileBar";
import TasksPanel from "./components/TasksPanel";
import ClassesPanel from "./components/ClassesPanel";
import FilesPanel from "./components/FilesPanel";
import LoginScreen from "./components/LoginScreen";
import { writeToOpenedFileHandle, createDataFileContent } from "./dataFile";
import {
  getCurrentUser,
  getUserData,
  logout,
  saveUserData,
} from "./auth";

const TABS = ["tasks", "classes", "calendar", "files"];

const INITIAL_STATE = {
  schoolClasses: [],
  tasks: [],
  completedReviewItemIndexes: [],
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [startupError, setStartupError] = useState("");
  const [accountSaveStatus, setAccountSaveStatus] = useState("Account data is stored on this server.");
  const [hasUnsavedAccountChanges, setHasUnsavedAccountChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("tasks");
  const [state, setState] = useState(INITIAL_STATE);
  const [fileHandle, setFileHandle] = useState(null);
  const [currentDataFileName, setCurrentDataFileName] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function initializeAccount() {
      try {
        const currentUser = await getCurrentUser();
        if (!isCurrent) return;
        if (currentUser) {
          const userData = await getUserData();
          if (isCurrent) {
            setState(userData);
            setAccountSaveStatus("Loaded from your account.");
            setUser(currentUser);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        if (isCurrent) setStartupError(error.message);
      } finally {
        if (isCurrent) setAuthReady(true);
      }
    }

    initializeAccount();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!fileHandle || !hasUnsavedChanges) return;
    writeToOpenedFileHandle(fileHandle, createDataFileContent(state));
  }, [state, fileHandle, hasUnsavedChanges]);

  useEffect(() => {
    if (!user || !hasUnsavedAccountChanges) return;

    const controller = new AbortController();
    setAccountSaveStatus("Saving to your account…");
    const timeoutId = setTimeout(async () => {
      try {
        await saveUserData(state, controller.signal);
        if (!controller.signal.aborted) {
          setHasUnsavedAccountChanges(false);
          setAccountSaveStatus("Saved to your account.");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setAccountSaveStatus(`Account save failed: ${error.message}`);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [user, state, hasUnsavedAccountChanges]);

  useEffect(() => {
    const handler = (e) => {
      if (
        hasUnsavedAccountChanges ||
        (currentDataFileName && hasUnsavedChanges)
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [currentDataFileName, hasUnsavedChanges, hasUnsavedAccountChanges]);

  const handleStateChange = useCallback((newState) => {
    setState(newState);
    setHasUnsavedChanges(true);
    setHasUnsavedAccountChanges(true);
  }, []);

  function handleStateLoaded(loaded) {
    setState(loaded);
    setHasUnsavedChanges(false);
    setHasUnsavedAccountChanges(true);
  }

  async function handleLogin(loggedInUser) {
    const userData = await getUserData();
    setState(userData);
    setHasUnsavedChanges(false);
    setHasUnsavedAccountChanges(false);
    setAccountSaveStatus("Loaded from your account.");
    setStartupError("");
    setUser(loggedInUser);
  }

  async function handleLogout() {
    if (hasUnsavedAccountChanges) {
      await saveUserData(state);
    }
    await logout();
    setUser(null);
    setState(INITIAL_STATE);
    setFileHandle(null);
    setCurrentDataFileName(null);
    setHasUnsavedChanges(false);
    setHasUnsavedAccountChanges(false);
  }

  if (!authReady) return null;

  if (!user) {
    return <LoginScreen onLogin={handleLogin} initialError={startupError} />;
  }

  return (
    <>
      <Header user={user} onLogout={handleLogout} />
      <DataFileBar
        state={state}
        fileHandle={fileHandle}
        setFileHandle={setFileHandle}
        currentDataFileName={currentDataFileName}
        setCurrentDataFileName={setCurrentDataFileName}
        hasUnsavedChanges={hasUnsavedChanges}
        setHasUnsavedChanges={setHasUnsavedChanges}
        onStateLoaded={handleStateLoaded}
        accountSaveStatus={accountSaveStatus}
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
