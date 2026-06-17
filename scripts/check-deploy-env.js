if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    [
      "[deploy] DATABASE_URL is missing or empty.",
      "",
      "On Railway (API service → Variables):",
      "  1. Open your PostgreSQL plugin service",
      "  2. On the API service, add a variable reference: DATABASE_URL → Postgres.DATABASE_URL",
      "     (Use \"Add Reference\" — do not paste ${{...}} syntax as plain text unless Railway resolves it.)",
      "  3. Redeploy the API service",
      "",
      "Required vars: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, FRONTEND_URL"
    ].join("\n")
  );
  process.exit(1);
}
