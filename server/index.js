import crypto from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import express from "express";

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = "schoolwork_session";
const SESSION_LENGTH_MS = 7 * 24 * 60 * 60 * 1000;
const TASK_STATUSES = new Set(["To do", "In progress", "Done"]);
const EMPTY_DATA = {
  schoolClasses: [],
  tasks: [],
  completedReviewItemIndexes: [],
};

const databasePath =
  process.env.DATABASE_PATH ||
  fileURLToPath(new URL("./data/schoolwork.sqlite", import.meta.url));
mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });

const database = new Database(databasePath);
database.pragma("foreign_keys = ON");
database.pragma("journal_mode = WAL");
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_data (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

function readSessionToken(request) {
  const cookieHeader = request.headers.cookie || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie ? cookie.slice(SESSION_COOKIE.length + 1) : "";
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function getUserForRequest(request) {
  const token = readSessionToken(request);
  if (!token) return null;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const session = database
    .prepare(
      `SELECT users.id, users.email, sessions.expires_at
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ?`
    )
    .get(tokenHash);
  if (!session) return null;
  if (session.expires_at <= Date.now()) {
    database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  return { id: session.id, email: session.email };
}

function requireUser(request, response, next) {
  const user = getUserForRequest(request);
  if (!user) {
    response.status(401).json({ error: "Please sign in to access your account." });
    return;
  }
  request.user = user;
  next();
}

function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_LENGTH_MS / 1000}${secure}`
  );
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
  );
}

function startSession(userId, response) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = Date.now() + SESSION_LENGTH_MS;
  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  database
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(tokenHash, userId, expiresAt);
  setSessionCookie(response, token);
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateUserData(value) {
  if (
    !isRecord(value) ||
    !Array.isArray(value.schoolClasses) ||
    !value.schoolClasses.every((name) => typeof name === "string") ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.completedReviewItemIndexes)
  ) {
    return null;
  }

  const identifiers = new Set();
  const tasks = [];
  for (const task of value.tasks) {
    if (
      !isRecord(task) ||
      typeof task.title !== "string" ||
      typeof task.schoolClassName !== "string" ||
      typeof task.dueDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ||
      !TASK_STATUSES.has(task.status)
    ) {
      return null;
    }

    const parsedDate = new Date(`${task.dueDate}T00:00:00.000Z`);
    if (
      Number.isNaN(parsedDate.valueOf()) ||
      parsedDate.toISOString().slice(0, 10) !== task.dueDate
    ) {
      return null;
    }

    let identifier = Number(task.identifier);
    if (!Number.isSafeInteger(identifier) || identifier < 1 || identifiers.has(identifier)) {
      identifier = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      while (identifiers.has(identifier)) identifier += 1;
    }
    identifiers.add(identifier);
    tasks.push({
      identifier,
      title: task.title,
      schoolClassName: task.schoolClassName,
      dueDate: task.dueDate,
      status: task.status,
    });
  }

  return {
    schoolClasses: value.schoolClasses,
    tasks,
    completedReviewItemIndexes: value.completedReviewItemIndexes.filter(
      (index) => Number.isInteger(index) && index >= 0
    ),
  };
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/auth/me", (request, response) => {
  response.json({ user: getUserForRequest(request) });
});

app.post("/api/auth/register", async (request, response) => {
  const email = normalizeEmail(request.body?.email);
  const password = request.body?.password;
  if (!isValidEmail(email)) {
    response.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (typeof password !== "string" || password.length < 10 || password.length > 256) {
    response.status(400).json({ error: "Password must be between 10 and 256 characters." });
    return;
  }

  const userId = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = await scrypt(password, salt, 64);
  try {
    database
      .prepare(
        "INSERT INTO users (id, email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(userId, email, salt, passwordHash.toString("hex"), Date.now());
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      response.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    throw error;
  }

  startSession(userId, response);
  response.status(201).json({ user: { id: userId, email } });
});

app.post("/api/auth/login", async (request, response) => {
  const email = normalizeEmail(request.body?.email);
  const password = request.body?.password;
  if (typeof password !== "string" || password.length > 256) {
    response.status(400).json({ error: "Enter your email and password." });
    return;
  }

  const user = database
    .prepare("SELECT id, email, password_salt, password_hash FROM users WHERE email = ?")
    .get(email);
  if (!user) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  const passwordHash = await scrypt(password, user.password_salt, 64);
  const savedHash = Buffer.from(user.password_hash, "hex");
  if (
    savedHash.length !== passwordHash.length ||
    !crypto.timingSafeEqual(passwordHash, savedHash)
  ) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  startSession(user.id, response);
  response.json({ user: { id: user.id, email: user.email } });
});

app.post("/api/auth/logout", (request, response) => {
  const token = readSessionToken(request);
  if (token) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  }
  clearSessionCookie(response);
  response.status(204).end();
});

app.get("/api/data", requireUser, (request, response) => {
  const row = database
    .prepare("SELECT content FROM user_data WHERE user_id = ?")
    .get(request.user.id);
  response.json({ data: row ? JSON.parse(row.content) : EMPTY_DATA });
});

app.put("/api/data", requireUser, (request, response) => {
  const data = validateUserData(request.body);
  if (!data) {
    response.status(400).json({ error: "The submitted schoolwork data is invalid." });
    return;
  }

  database
    .prepare(
      `INSERT INTO user_data (user_id, content, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`
    )
    .run(request.user.id, JSON.stringify(data), Date.now());
  response.json({ saved: true });
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: "Request body must contain valid JSON." });
    return;
  }
  console.error(error);
  response.status(500).json({ error: "The server could not complete the request." });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`Schoolwork API listening on http://localhost:${port}`);
});
