#!/usr/bin/env node

/**
 * Workbench CLI — run doc-type operations from the command line
 * without starting a full server.
 *
 * Usage:
 *   pnpm workbench:cli validate budget_book --data ./test.xlsx
 *   pnpm workbench:cli run budget_book --data ./test.xlsx
 *   pnpm workbench:cli doc-types
 */

import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { defaultRegistry } from "../core/doc-type-registry.js";

// Ensure doc types are registered
import "../doc-types/index.js";

interface ParsedArgs {
  command: string;
  positionals: string[];
  dataPath?: string;
}

function parseCliArgs(): ParsedArgs {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      data: { type: "string", short: "d" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(`
Budget Book Engine — Workbench CLI

Commands:
  doc-types                       List registered document types
  validate <docType> --data <path>  Parse + validate a data file
  sections <docType>              List section types for a doc type

Options:
  --data, -d <path>  Path to data file (Excel, CSV)
  --help, -h         Show this help
`);
    process.exit(0);
  }

  return {
    command: positionals[0]!,
    positionals: positionals.slice(1),
    dataPath: values.data,
  };
}

async function main(): Promise<void> {
  const args = parseCliArgs();

  switch (args.command) {
    case "doc-types": {
      const docTypes = defaultRegistry.list();
      for (const dt of docTypes) {
        console.log(`\n${dt.name} (${dt.id}) v${dt.version}`);
        console.log(`  Sections: ${dt.sectionTypes.map((s) => s.id).join(", ")}`);
        console.log(`  Agents: ${dt.agents.map((a) => a.type).join(", ")}`);
        console.log(`  Reviewers: ${dt.reviewers.map((r) => r.id).join(", ")}`);
        console.log(`  Seed skills: ${dt.seedSkills.length}`);
      }
      break;
    }

    case "validate": {
      const docTypeId = args.positionals[0];
      if (!docTypeId) {
        console.error("Usage: validate <docType> --data <path>");
        process.exit(1);
      }
      if (!args.dataPath) {
        console.error("Missing --data flag");
        process.exit(1);
      }
      if (!defaultRegistry.has(docTypeId)) {
        console.error(`Unknown document type: "${docTypeId}"`);
        process.exit(1);
      }

      const docType = defaultRegistry.get(docTypeId);
      if (!docType.parseUpload) {
        console.error(`Document type "${docTypeId}" does not support file parsing`);
        process.exit(1);
      }

      const buffer = await readFile(args.dataPath);

      // parseUpload requires an AiProvider — for validate-only, create a stub
      // that throws if actually called (parsing may or may not need AI)
      const stubAi = new Proxy({} as import("../core/providers.js").AiProvider, {
        get(_target, prop) {
          return () => {
            throw new Error(
              `CLI validate mode does not support AI calls (attempted: ${String(prop)})`
            );
          };
        },
      });

      try {
        const parsed = await docType.parseUpload(stubAi, buffer, {});
        const validation = docType.dataSchema.safeParse(parsed);

        if (validation.success) {
          console.log("✓ Data is valid");
          const gaps = docType.detectDataGaps(validation.data);
          if (gaps.length > 0) {
            console.log(`\nDetected ${gaps.length} data gap(s):`);
            for (const gap of gaps) {
              console.log(`  [${gap.priority}] ${gap.title}: ${gap.description}`);
            }
          }
        } else {
          console.error("✗ Validation failed:");
          for (const issue of validation.error.issues) {
            console.error(`  ${issue.path.join(".")}: ${issue.message}`);
          }
          process.exit(1);
        }
      } catch (err) {
        console.error("✗ Parse failed:", err instanceof Error ? err.message : err);
        process.exit(1);
      }
      break;
    }

    case "sections": {
      const docTypeId = args.positionals[0];
      if (!docTypeId) {
        console.error("Usage: sections <docType>");
        process.exit(1);
      }
      if (!defaultRegistry.has(docTypeId)) {
        console.error(`Unknown document type: "${docTypeId}"`);
        process.exit(1);
      }

      const docType = defaultRegistry.get(docTypeId);
      console.log(`\nSection types for ${docType.name}:\n`);
      for (const s of docType.sectionTypes) {
        const flags = [
          s.parallel ? "parallel" : "sequential",
          s.structural ? "structural" : "content",
        ].join(", ");
        console.log(`  ${s.order}. ${s.id} — ${s.name} (${flags})`);
      }
      break;
    }

    default:
      console.error(`Unknown command: "${args.command}". Run with --help for usage.`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
