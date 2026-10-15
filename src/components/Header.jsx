import React, { useState } from "react";

export default function Header({ user, onLogout }) {
  const [logoutError, setLogoutError] = useState("");
  const email = user?.email ?? "";

  async function handleLogout() {
    setLogoutError("");
    try {
      await onLogout();
    } catch (error) {
      setLogoutError(error.message);
    }
  }

  return (
    <header className="app-header">
      <h1>Schoolwork tracker</h1>
      {email && (
        <div className="header-user">
          <span className="header-email">{email}</span>
          <button className="header-logout-button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      )}
      {logoutError && <p className="header-error" role="alert">{logoutError}</p>}
    </header>
  );
}
