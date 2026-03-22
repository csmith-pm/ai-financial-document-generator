/**
 * Workbench route: compare document iterations side-by-side.
 *
 * GET /workbench/iterations/:docId
 */

import type { FastifyInstance } from "fastify";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { documentSections, documentReviews } from "../../db/schema.js";
import type { DrizzleInstance } from "../../db/connection.js";

const paramsSchema = z.object({ docId: z.string().uuid() });

export interface IterationsDeps {
  db: DrizzleInstance;
}

export async function iterationsRoutes(
  app: FastifyInstance,
  deps: IterationsDeps
): Promise<void> {
  const { db } = deps;

  app.get("/workbench/iterations/:docId", async (request, _reply) => {
    const { docId } = paramsSchema.parse(request.params);

    const sections = await db
      .select()
      .from(documentSections)
      .where(eq(documentSections.documentId, docId))
      .orderBy(asc(documentSections.sectionOrder));

    const reviews = await db
      .select()
      .from(documentReviews)
      .where(eq(documentReviews.documentId, docId))
      .orderBy(asc(documentReviews.iteration), asc(documentReviews.createdAt));

    // Group reviews by iteration
    const iterationMap = new Map<
      number,
      {
        iteration: number;
        reviews: typeof reviews;
        scores: Record<string, string | null>;
      }
    >();

    for (const review of reviews) {
      let entry = iterationMap.get(review.iteration);
      if (!entry) {
        entry = { iteration: review.iteration, reviews: [], scores: {} };
        iterationMap.set(review.iteration, entry);
      }
      entry.reviews.push(review);
      entry.scores[review.reviewerType] = review.overallScore;
    }

    return {
      documentId: docId,
      sections,
      iterations: [...iterationMap.values()].sort(
        (a, b) => a.iteration - b.iteration
      ),
    };
  });
}
