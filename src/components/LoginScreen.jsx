import React, { useState } from "react";
import { login, register } from "../auth";

export default function LoginScreen({ onLogin, initialError = "" }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const authenticatedUser = isRegistering
        ? await register(email, password)
        : await login(email, password);
      await onLogin(authenticatedUser);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">Schoolwork tracker</h1>
        <p className="login-subtitle">
          {isRegistering ? "Create an account to save your schoolwork." : "Sign in to access your tasks and classes."}
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete={isRegistering ? "new-password" : "current-password"}
            minLength={isRegistering ? 10 : undefined}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-button login-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait…" : isRegistering ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          className="login-switch"
          type="button"
          onClick={() => {
            setIsRegistering(!isRegistering);
            setError("");
          }}
        >
          {isRegistering ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
