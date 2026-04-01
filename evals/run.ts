#!/usr/bin/env npx tsx
/**
 * Eval CLI — run evaluation tests against real fixture data.
 *
 * Usage:
 *   npx tsx evals/run.ts evals/fixtures/bristol-fy27
 *   npx tsx evals/run.ts --all
 *   npx tsx evals/run.ts evals/fixtures/bristol-fy27 --output report.md
 *   npx tsx evals/run.ts evals/fixtures/bristol-fy27 --json results.json
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { runEval } from "./budget-book-eval.js";
import { generateReport } from "./report-generator.js";

// Load .env if present
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const value = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
Document Engine Eval Runner

Usage:
  npx tsx evals/run.ts <fixture-dir>         Run eval for a specific fixture
  npx tsx evals/run.ts --all                 Run all evals in evals/fixtures/
  npx tsx evals/run.ts <fixture-dir> --output <file.md>   Save report to file
  npx tsx evals/run.ts <fixture-dir> --json <file.json>   Save raw JSON results

Requires:
  DATABASE_URL, ANTHROPIC_API_KEY, REDIS_URL environment variables (or .env file)
`);
    process.exit(0);
  }

  // Parse options
  let outputFile: string | null = null;
  let jsonFile: string | null = null;
  const fixtureDirs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) {
      outputFile = args[++i]!;
    } else if (args[i] === "--json" && args[i + 1]) {
      jsonFile = args[++i]!;
    } else if (args[i] === "--all") {
      const fixturesRoot = path.resolve("evals/fixtures");
      const dirs = fs.readdirSync(fixturesRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(fixturesRoot, d.name))
        .filter((d) => fs.existsSync(path.join(d, "manifest.json")));
      fixtureDirs.push(...dirs);
    } else {
      fixtureDirs.push(path.resolve(args[i]!));
    }
  }

  if (fixtureDirs.length === 0) {
    console.error("No fixture directories found.");
    process.exit(1);
  }

  for (const dir of fixtureDirs) {
    if (!fs.existsSync(path.join(dir, "manifest.json"))) {
      console.error(`No manifest.json found in ${dir}`);
      process.exit(1);
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`Running eval: ${path.basename(dir)}`);
    console.log("=".repeat(60));

    const result = await runEval(dir);
    const report = generateReport(result);

    // Always print to console
    console.log("\n" + report);

    // Save report to fixture output dir
    const outputDir = path.join(dir, "output");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "report.md"), report);
    console.log(`\nReport saved to: ${path.join(outputDir, "report.md")}`);

    // Optional outputs
    if (outputFile) {
      fs.writeFileSync(outputFile, report);
      console.log(`Report also saved to: ${outputFile}`);
    }
    if (jsonFile) {
      fs.writeFileSync(jsonFile, JSON.stringify(result, null, 2));
      console.log(`JSON results saved to: ${jsonFile}`);
    }

    // Summary
    console.log(`\n📊 Final Score: ${result.overallScore}/100 (Grade: ${result.grade})`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
