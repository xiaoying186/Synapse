import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  CodebaseMemoryPreview,
  PermissionMemoryPreview,
  WebAppShellPreview,
} from "../types";

type UsePreviewAdaptersOptions = {
  setActivity: (message: string) => void;
};

export function usePreviewAdapters({ setActivity }: UsePreviewAdaptersOptions) {
  const [webAppShellPreview, setWebAppShellPreview] = useState<WebAppShellPreview | null>(null);
  const [codebaseMemoryPreview, setCodebaseMemoryPreview] = useState<CodebaseMemoryPreview | null>(
    null,
  );
  const [permissionMemoryPreview, setPermissionMemoryPreview] =
    useState<PermissionMemoryPreview | null>(null);
  const [isPreviewingWebAppShell, setIsPreviewingWebAppShell] = useState(false);
  const [isPreviewingCodebaseMemory, setIsPreviewingCodebaseMemory] = useState(false);
  const [isPreviewingPermissionMemory, setIsPreviewingPermissionMemory] = useState(false);

  async function previewWebAppShell() {
    setIsPreviewingWebAppShell(true);
    try {
      const preview = await invoke<WebAppShellPreview>("preview_web_app_shell");
      setWebAppShellPreview(preview);
      setActivity(`Web App Shell preview: ${preview.state}.`);
    } catch {
      setActivity("Web App Shell preview could not be completed.");
    } finally {
      setIsPreviewingWebAppShell(false);
    }
  }

  async function previewCodebaseMemory() {
    setIsPreviewingCodebaseMemory(true);
    try {
      const preview = await invoke<CodebaseMemoryPreview>("preview_codebase_memory_adapter");
      setCodebaseMemoryPreview(preview);
      setActivity(`Codebase Memory preview: ${preview.state}.`);
    } catch {
      setActivity("Codebase Memory preview could not be completed.");
    } finally {
      setIsPreviewingCodebaseMemory(false);
    }
  }

  async function previewPermissionMemory() {
    setIsPreviewingPermissionMemory(true);
    try {
      const preview = await invoke<PermissionMemoryPreview>("preview_permission_memory");
      setPermissionMemoryPreview(preview);
      setActivity(`Permission Memory preview: ${preview.state}.`);
    } catch {
      setActivity("Permission Memory preview could not be completed.");
    } finally {
      setIsPreviewingPermissionMemory(false);
    }
  }

  return {
    codebaseMemoryPreview,
    isPreviewingCodebaseMemory,
    isPreviewingPermissionMemory,
    isPreviewingWebAppShell,
    permissionMemoryPreview,
    previewCodebaseMemory,
    previewPermissionMemory,
    previewWebAppShell,
    webAppShellPreview,
  };
}
