import { createMemoryContentRepository } from "./memory-repository";
import { createContentStudioService } from "./service";
import { templateGenerationProvider } from "./template-provider";

// Swap the provider here for a future server-backed adapter; UI components stay unchanged.
export function createDemoContentService() {
  return createContentStudioService(createMemoryContentRepository(), templateGenerationProvider);
}
