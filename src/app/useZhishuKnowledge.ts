import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  MemoryItem,
  ZhishuMaintenanceFinding,
  ZhishuRelationRecord,
  ZhishuRepositoryBundle,
  ZhishuRepositoryImportReceipt,
  ZhishuSearchQuery,
  ZhishuSearchResponse,
} from "../types";

type UseZhishuKnowledgeOptions = {
  loadMemory: () => Promise<unknown>;
  loadSynthesisPreview: () => Promise<unknown>;
  refreshProductionOverview: () => Promise<unknown>;
  setActivity: (message: string) => void;
};

export function useZhishuKnowledge({
  loadMemory,
  loadSynthesisPreview,
  refreshProductionOverview,
  setActivity,
}: UseZhishuKnowledgeOptions) {
  const [isGeneratingZhishuRelations, setIsGeneratingZhishuRelations] = useState(false);
  const [isImportingZhishuRepository, setIsImportingZhishuRepository] = useState(false);
  const [isSavingZhishu, setIsSavingZhishu] = useState(false);
  const [isScanningZhishuMaintenance, setIsScanningZhishuMaintenance] = useState(false);
  const [isSearchingZhishu, setIsSearchingZhishu] = useState(false);
  const [reviewingMaintenanceFindingId, setReviewingMaintenanceFindingId] = useState<string | null>(null);
  const [reviewingRelationId, setReviewingRelationId] = useState<string | null>(null);
  const [zhishuDraft, setZhishuDraft] = useState("");
  const [zhishuKind, setZhishuKind] = useState("knowledge");
  const [zhishuMaintenanceFindings, setZhishuMaintenanceFindings] = useState<
    ZhishuMaintenanceFinding[]
  >([]);
  const [zhishuRelations, setZhishuRelations] = useState<ZhishuRelationRecord[]>([]);
  const [zhishuRepositoryBundle, setZhishuRepositoryBundle] = useState("");
  const [zhishuRepositoryImportReceipt, setZhishuRepositoryImportReceipt] =
    useState<ZhishuRepositoryImportReceipt | null>(null);
  const [zhishuSearchQuery, setZhishuSearchQuery] = useState<ZhishuSearchQuery>({
    text: "",
    minimum_confidence: 0,
    limit: 20,
  });
  const [zhishuSearchResponse, setZhishuSearchResponse] =
    useState<ZhishuSearchResponse | null>(null);
  const [zhishuTags, setZhishuTags] = useState("");

  async function loadZhishuRelations() {
    try {
      const records = await invoke<ZhishuRelationRecord[]>("get_zhishu_relations");
      setZhishuRelations(records);
      return records;
    } catch {
      setZhishuRelations([]);
      return [];
    }
  }

  async function loadZhishuMaintenanceFindings() {
    try {
      const records = await invoke<ZhishuMaintenanceFinding[]>(
        "get_zhishu_maintenance_findings",
      );
      setZhishuMaintenanceFindings(records);
      return records;
    } catch {
      setZhishuMaintenanceFindings([]);
      return [];
    }
  }

  async function searchZhishu() {
    setIsSearchingZhishu(true);
    try {
      const response = await invoke<ZhishuSearchResponse>("search_zhishu", {
        query: zhishuSearchQuery,
      });
      setZhishuSearchResponse(response);
      setActivity(`Zhishu search returned ${response.total_matches} explained matches.`);
    } catch {
      setActivity("Zhishu search could not be completed.");
    } finally {
      setIsSearchingZhishu(false);
    }
  }

  async function generateZhishuRelations() {
    setIsGeneratingZhishuRelations(true);
    try {
      const relations = await invoke<ZhishuRelationRecord[]>("generate_zhishu_relations", {
        query: zhishuSearchQuery,
      });
      await loadZhishuRelations();
      setActivity(`Generated or reused ${relations.length} Zhishu relation candidates.`);
    } catch {
      setActivity("Zhishu relation candidates could not be generated.");
    } finally {
      setIsGeneratingZhishuRelations(false);
    }
  }

  async function reviewZhishuRelation(
    relationId: string,
    decision: "accepted" | "rejected",
  ) {
    setReviewingRelationId(relationId);
    try {
      await invoke<ZhishuRelationRecord>("review_zhishu_relation", { relationId, decision });
      await loadZhishuRelations();
      setActivity(`Zhishu relation ${decision}.`);
    } catch {
      setActivity("Zhishu relation could not be reviewed.");
    } finally {
      setReviewingRelationId(null);
    }
  }

  async function scanZhishuMaintenance() {
    setIsScanningZhishuMaintenance(true);
    try {
      const findings = await invoke<ZhishuMaintenanceFinding[]>("scan_zhishu_maintenance", {
        staleDays: 90,
      });
      await loadZhishuMaintenanceFindings();
      setActivity(`Generated or reused ${findings.length} Zhishu maintenance findings.`);
    } catch {
      setActivity("Zhishu maintenance scan could not be completed.");
    } finally {
      setIsScanningZhishuMaintenance(false);
    }
  }

  async function reviewZhishuMaintenanceFinding(
    findingId: string,
    decision: "accepted" | "rejected",
  ) {
    setReviewingMaintenanceFindingId(findingId);
    try {
      await invoke<ZhishuMaintenanceFinding>("review_zhishu_maintenance_finding", {
        findingId,
        decision,
      });
      await loadZhishuMaintenanceFindings();
      setActivity(`Zhishu maintenance finding ${decision}.`);
    } catch {
      setActivity("Zhishu maintenance finding could not be reviewed.");
    } finally {
      setReviewingMaintenanceFindingId(null);
    }
  }

  async function exportZhishuRepository() {
    try {
      const bundle = await invoke<ZhishuRepositoryBundle>("export_zhishu_repository");
      setZhishuRepositoryBundle(JSON.stringify(bundle, null, 2));
      setActivity("Zhishu repository exported to a versioned JSON bundle.");
    } catch {
      setActivity("Zhishu repository could not be exported.");
    }
  }

  async function importZhishuRepository() {
    if (
      !window.confirm(
        "Replace the current Zhishu memory, relation, and maintenance collections?",
      )
    ) {
      return;
    }
    setIsImportingZhishuRepository(true);
    try {
      const receipt = await invoke<ZhishuRepositoryImportReceipt>(
        "import_zhishu_repository",
        { raw: zhishuRepositoryBundle },
      );
      setZhishuRepositoryImportReceipt(receipt);
      await Promise.all([
        loadMemory(),
        loadZhishuRelations(),
        loadZhishuMaintenanceFindings(),
        refreshProductionOverview(),
      ]);
      setActivity("Zhishu repository imported transactionally.");
    } catch {
      setActivity("Zhishu repository import was rejected or could not be completed.");
    } finally {
      setIsImportingZhishuRepository(false);
    }
  }

  async function captureZhishuItem() {
    const content = zhishuDraft.trim();

    if (!content) {
      setActivity("Capture a Zhishu knowledge, rule, or skill candidate first.");
      return;
    }

    const tags = zhishuTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setIsSavingZhishu(true);

    try {
      const item = await invoke<MemoryItem>("capture_zhishu_item", {
        content,
        tags,
        itemKind: zhishuKind,
      });
      await Promise.all([loadMemory(), loadSynthesisPreview(), refreshProductionOverview()]);
      setZhishuDraft("");
      setZhishuTags("");
      setZhishuKind("knowledge");
      setActivity(`Captured ${item.item_type} into ${item.scope} as a review candidate.`);
    } catch {
      setActivity("Zhishu item could not be captured.");
    } finally {
      setIsSavingZhishu(false);
    }
  }

  return {
    captureZhishuItem,
    exportZhishuRepository,
    generateZhishuRelations,
    importZhishuRepository,
    isGeneratingZhishuRelations,
    isImportingZhishuRepository,
    isSavingZhishu,
    isScanningZhishuMaintenance,
    isSearchingZhishu,
    loadZhishuMaintenanceFindings,
    loadZhishuRelations,
    reviewZhishuMaintenanceFinding,
    reviewZhishuRelation,
    reviewingMaintenanceFindingId,
    reviewingRelationId,
    scanZhishuMaintenance,
    searchZhishu,
    setZhishuDraft,
    setZhishuKind,
    setZhishuRepositoryBundle,
    setZhishuSearchQuery,
    setZhishuTags,
    zhishuDraft,
    zhishuKind,
    zhishuMaintenanceFindings,
    zhishuRelations,
    zhishuRepositoryBundle,
    zhishuRepositoryImportReceipt,
    zhishuSearchQuery,
    zhishuSearchResponse,
    zhishuTags,
  };
}
