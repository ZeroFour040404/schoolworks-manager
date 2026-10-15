async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "The request could not be completed.");
  }
  return result;
}

export async function getCurrentUser() {
  const result = await request("/api/auth/me");
  return result.user;
}

export async function login(email, password) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return result.user;
}

export async function register(email, password) {
  const result = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return result.user;
}

export function logout() {
  return request("/api/auth/logout", { method: "POST" });
}

export async function getUserData() {
  const result = await request("/api/data");
  return result.data;
}

export function saveUserData(data, signal) {
  return request("/api/data", {
    method: "PUT",
    body: JSON.stringify(data),
    signal,
  });
}
