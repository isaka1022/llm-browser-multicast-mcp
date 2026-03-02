import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const LOG_DIR = resolve(process.cwd(), "logs");
const LOG_FILE = resolve(LOG_DIR, "council.log");

try {
  mkdirSync(LOG_DIR, { recursive: true });
} catch {
  // ignore
}

function timestamp(): string {
  return new Date().toISOString();
}

export const log = {
  info(msg: string): void {
    const line = `${timestamp()} [INFO] ${msg}\n`;
    console.error(line.trimEnd());
    appendFileSync(LOG_FILE, line);
  },
  error(msg: string): void {
    const line = `${timestamp()} [ERROR] ${msg}\n`;
    console.error(line.trimEnd());
    appendFileSync(LOG_FILE, line);
  },
  stage(stage: string, msg: string): void {
    const line = `${timestamp()} [${stage}] ${msg}\n`;
    console.error(line.trimEnd());
    appendFileSync(LOG_FILE, line);
  },
};
