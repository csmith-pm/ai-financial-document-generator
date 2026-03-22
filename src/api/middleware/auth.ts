import type { FastifyRequest, FastifyReply } from "fastify";

export interface AuthInfo {
  tenantId: string;
  userId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthInfo;
  }
}

/**
 * Extracts tenantId and userId from request headers.
 * In production, this would validate a JWT or session token.
 * For now it reads x-tenant-id and x-user-id headers.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantId = request.headers["x-tenant-id"];
  const userId = request.headers["x-user-id"];

  if (!tenantId || typeof tenantId !== "string") {
    reply.status(401).send({ error: "Missing x-tenant-id header" });
    return;
  }

  request.auth = {
    tenantId,
    userId: typeof userId === "string" ? userId : "unknown",
  };
}
