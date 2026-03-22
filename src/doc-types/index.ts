/**
 * Document Type Registration — imports all doc type modules
 * and registers them into the default registry.
 *
 * This module is imported for its side effects by src/index.ts.
 */

import { defaultRegistry } from "../core/doc-type-registry.js";
import { budgetBookDocType } from "./budget-book/index.js";

defaultRegistry.register(budgetBookDocType);

export { defaultRegistry };
