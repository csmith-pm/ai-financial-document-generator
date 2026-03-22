/**
 * Workbench route: parse + validate data file without generating.
 *
 * POST /workbench/upload-test-data
 */

import type { FastifyInstance } from "fastify";
import type { AiProvider } from "../../core/providers.js";
import { defaultRegistry } from "../../core/doc-type-registry.js";

export interface UploadTestDataDeps {
  ai: AiProvider;
}

export async function uploadTestDataRoutes(
  app: FastifyInstance,
  deps: UploadTestDataDeps
): Promise<void> {
  const { ai } = deps;

  app.post("/workbench/upload-test-data", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.status(400).send({ error: "No file uploaded" });
      return;
    }

    // Doc type from query parameter (required)
    const docTypeId = (request.query as Record<string, string>).docType;
    if (!docTypeId) {
      reply.status(400).send({ error: "Missing required query parameter: docType" });
      return;
    }

    if (!defaultRegistry.has(docTypeId)) {
      reply.status(400).send({ error: `Unknown document type: "${docTypeId}"` });
      return;
    }

    const docType = defaultRegistry.get(docTypeId);

    if (!docType.parseUpload) {
      reply.status(400).send({
        error: `Document type "${docTypeId}" does not support file upload parsing`,
      });
      return;
    }

    const buffer = await data.toBuffer();

    // Parse the file
    let parsedData: unknown;
    let parseError: string | null = null;
    try {
      parsedData = await docType.parseUpload(ai, buffer, {});
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
      return reply.status(422).send({
        error: "Failed to parse uploaded file",
        details: parseError,
      });
    }

    // Validate against schema
    const validation = docType.dataSchema.safeParse(parsedData);
    const validationErrors = validation.success
      ? []
      : validation.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        }));

    // Detect data gaps
    const gaps = validation.success
      ? docType.detectDataGaps(validation.data)
      : [];

    return {
      filename: data.filename,
      docType: docTypeId,
      valid: validation.success,
      validationErrors,
      gaps,
      data: parsedData,
    };
  });
}
