import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  const contents = fs.readFileSync(envPath, "utf-8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

if (process.env.ALLOW_SELF_SIGNED_TLS === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn("[env] ALLOW_SELF_SIGNED_TLS enabled. TLS certificate verification is disabled.");
}
