import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  CodebaseMemoryAdmissionPreflight,
  CodebaseMemoryPreview,
  PermissionMemoryPreview,
  PermissionReusePreflight,
  SkillLibraryPreview,
  SkillScriptExecutionPreflight,
  SkillScriptExecutionReceipt,
  SkillScriptExecutionRequest,
  WebAppShellPreview,
} from "../types";

type UsePreviewAdaptersOptions = {
  setActivity: (message: string) => void;
  text: (value: string | null | undefined) => string;
};

export function usePreviewAdapters({ setActivity, text }: UsePreviewAdaptersOptions) {
  const [webAppShellPreview, setWebAppShellPreview] = useState<WebAppShellPreview | null>(null);
  const [codebaseMemoryAdmissionPreflight, setCodebaseMemoryAdmissionPreflight] =
    useState<CodebaseMemoryAdmissionPreflight | null>(null);
  const [codebaseMemoryPreview, setCodebaseMemoryPreview] = useState<CodebaseMemoryPreview | null>(
    null,
  );
  const [permissionMemoryPreview, setPermissionMemoryPreview] =
    useState<PermissionMemoryPreview | null>(null);
  const [permissionReusePreflight, setPermissionReusePreflight] =
    useState<PermissionReusePreflight | null>(null);
  const [skillLibraryPreview, setSkillLibraryPreview] = useState<SkillLibraryPreview | null>(null);
  const [skillScriptExecutionPreflight, setSkillScriptExecutionPreflight] =
    useState<SkillScriptExecutionPreflight | null>(null);
  const [skillScriptExecutionReceipt, setSkillScriptExecutionReceipt] =
    useState<SkillScriptExecutionReceipt | null>(null);
  const [isPreviewingWebAppShell, setIsPreviewingWebAppShell] = useState(false);
  const [isPreflightingCodebaseMemoryAdmission, setIsPreflightingCodebaseMemoryAdmission] =
    useState(false);
  const [isPreviewingCodebaseMemory, setIsPreviewingCodebaseMemory] = useState(false);
  const [isPreflightingPermissionReuse, setIsPreflightingPermissionReuse] = useState(false);
  const [isPreviewingPermissionMemory, setIsPreviewingPermissionMemory] = useState(false);
  const [isPreflightingSkillScript, setIsPreflightingSkillScript] = useState(false);
  const [isExecutingSkillScript, setIsExecutingSkillScript] = useState(false);
  const [isPreviewingSkillLibrary, setIsPreviewingSkillLibrary] = useState(false);

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

  async function preflightCodebaseMemoryAdmission(sourceId: string) {
    setIsPreflightingCodebaseMemoryAdmission(true);
    try {
      const preflight = await invoke<CodebaseMemoryAdmissionPreflight>(
        "preflight_codebase_memory_admission",
        { sourceId },
      );
      setCodebaseMemoryAdmissionPreflight(preflight);
      setActivity(
        `Codebase Memory admission preflight: ${preflight.state}, ${preflight.blockers.length} blockers.`,
      );
    } catch {
      setActivity("Codebase Memory admission preflight could not be completed.");
    } finally {
      setIsPreflightingCodebaseMemoryAdmission(false);
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

  async function preflightPermissionReuse(candidateId: string, requestedAction: string) {
    setIsPreflightingPermissionReuse(true);
    try {
      const preflight = await invoke<PermissionReusePreflight>("preflight_permission_reuse", {
        candidateId,
        requestedAction,
      });
      setPermissionReusePreflight(preflight);
      setActivity(
        `Permission reuse preflight: ${preflight.state}, ${preflight.blockers.length} blockers.`,
      );
    } catch {
      setActivity("Permission reuse preflight could not be completed.");
    } finally {
      setIsPreflightingPermissionReuse(false);
    }
  }

  async function previewSkillLibrary() {
    setIsPreviewingSkillLibrary(true);
    try {
      const preview = await invoke<SkillLibraryPreview>("preview_skill_library");
      setSkillLibraryPreview(preview);
      setActivity(`Skill library preview: ${preview.state}.`);
    } catch {
      setActivity("Skill library preview could not be completed.");
    } finally {
      setIsPreviewingSkillLibrary(false);
    }
  }

  async function preflightSkillScriptExecution(request: SkillScriptExecutionRequest) {
    setIsPreflightingSkillScript(true);
    try {
      const preflight = await invoke<SkillScriptExecutionPreflight>(
        "preflight_skill_script_execution",
        { request },
      );
      setSkillScriptExecutionPreflight(preflight);
      setActivity(
        `Skill script execution preflight: ${preflight.state}, ${preflight.blockers.length} blockers.`,
      );
    } catch {
      setActivity("Skill script execution preflight could not be completed.");
    } finally {
      setIsPreflightingSkillScript(false);
    }
  }

  async function executeSkillScript(request: SkillScriptExecutionRequest) {
    if (!window.confirm(text("Execute this hash-locked read-only script and quarantine its output?"))) return;
    setIsExecutingSkillScript(true);
    try {
      const receipt = await invoke<SkillScriptExecutionReceipt>("execute_skill_script", { request, approved: true });
      setSkillScriptExecutionReceipt(receipt);
      setActivity(`Skill script output quarantined as ${receipt.artifact.id}.`);
    } catch {
      setActivity("Skill script execution was blocked or failed.");
    } finally {
      setIsExecutingSkillScript(false);
    }
  }

  return {
    codebaseMemoryPreview,
    codebaseMemoryAdmissionPreflight,
    isPreflightingCodebaseMemoryAdmission,
    isPreviewingCodebaseMemory,
    isPreflightingPermissionReuse,
    isPreflightingSkillScript,
    isExecutingSkillScript,
    isPreviewingPermissionMemory,
    isPreviewingSkillLibrary,
    isPreviewingWebAppShell,
    permissionMemoryPreview,
    permissionReusePreflight,
    preflightPermissionReuse,
    preflightCodebaseMemoryAdmission,
    previewCodebaseMemory,
    previewPermissionMemory,
    previewSkillLibrary,
    previewWebAppShell,
    preflightSkillScriptExecution,
    executeSkillScript,
    skillLibraryPreview,
    skillScriptExecutionPreflight,
    skillScriptExecutionReceipt,
    webAppShellPreview,
  };
}
