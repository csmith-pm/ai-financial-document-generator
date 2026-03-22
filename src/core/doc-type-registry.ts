/**
 * DocumentTypeRegistry — a simple in-memory registry of document type
 * definitions. Document types register themselves at import time;
 * the orchestrator looks them up at runtime via the document's `docType` field.
 */

import type { DocumentTypeDefinition } from "./doc-type.js";

export class DocumentTypeRegistry {
  private types = new Map<string, DocumentTypeDefinition>();

  /** Register a document type. Throws if the ID is already taken. */
  register(docType: DocumentTypeDefinition): void {
    if (this.types.has(docType.id)) {
      throw new Error(`Document type "${docType.id}" is already registered`);
    }
    this.types.set(docType.id, docType);
  }

  /** Get a document type by ID. Throws if unknown. */
  get(id: string): DocumentTypeDefinition {
    const dt = this.types.get(id);
    if (!dt) {
      throw new Error(`Unknown document type: "${id}"`);
    }
    return dt;
  }

  /** Check if a document type is registered. */
  has(id: string): boolean {
    return this.types.has(id);
  }

  /** List all registered document types. */
  list(): DocumentTypeDefinition[] {
    return [...this.types.values()];
  }
}

/** Singleton registry used by the engine. */
export const defaultRegistry = new DocumentTypeRegistry();
