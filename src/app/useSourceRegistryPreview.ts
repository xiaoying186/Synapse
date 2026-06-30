import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SourceRegistryPreview } from "../types";

export function useSourceRegistryPreview() {
  const [sourceRegistryPreview, setSourceRegistryPreview] =
    useState<SourceRegistryPreview | null>(null);
  const [isLoadingSourceRegistry, setIsLoadingSourceRegistry] = useState(false);

  async function loadSourceRegistryPreview() {
    setIsLoadingSourceRegistry(true);

    try {
      const preview = await invoke<SourceRegistryPreview>("preview_source_registry");
      setSourceRegistryPreview(preview);
      return preview;
    } catch {
      setSourceRegistryPreview(null);
      return null;
    } finally {
      setIsLoadingSourceRegistry(false);
    }
  }

  return {
    isLoadingSourceRegistry,
    loadSourceRegistryPreview,
    sourceRegistryPreview,
  };
}
