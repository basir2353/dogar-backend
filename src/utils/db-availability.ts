import type { Response } from "express";
import { fail } from "./response";

export const isDbUnavailable = (error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: string }).code) : "";
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === "P1000" ||
    code === "P1001" ||
    code === "P2021" ||
    message.includes("Authentication failed against database server") ||
    message.includes("does not exist in the current database")
  );
};

export const sendServiceUnavailable = (res: Response) =>
  res.status(503).json(fail("SERVICE_UNAVAILABLE", "The database is temporarily unavailable. Please try again later."));

/** Human-readable text when Prisma reports missing tables (P2021) or connect failures. */
export const serviceUnavailableMessage = (error: unknown): string => {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: string }).code) : "";
  if (code === "P1000" || (error instanceof Error && error.message.includes("credentials"))) {
    return [
      "Database login failed (P1000).",
      "1) Ensure DATABASE_URL is postgresql://DB_USER:DB_PASSWORD@host:port/dogar — special characters in the password must be URL-encoded (e.g. @ → %40).",
      "2) A Windows or user-level DATABASE_URL environment variable can override backend/.env; this app now forces .env to take priority — restart the API after changes.",
      "3) If npm run db:deploy works in a terminal but the API still errors, the running server was started with old env: stop the process and run npm run dev again.",
      "4) If the dogar database is empty, run: npm run db:deploy && npm run db:seed from the repo root."
    ].join(" ");
  }
  if (code === "P2021" || (error instanceof Error && error.message.includes("does not exist in the current database"))) {
    return "Database schema is not applied. With PostgreSQL running, from the repo root run: npm run db:deploy && npm run db:seed (or npm run db:migrate if you are evolving the schema).";
  }
  return "The database is temporarily unavailable. Check that PostgreSQL is running and DATABASE_URL is correct, then try again.";
};
