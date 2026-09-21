import {
  getDouyinCollectionWorkspace,
  getWechatMpBenchmarkWorkspace,
  getWechatMpCollectionWorkspace,
  getWechatSearchWorkspace,
  getXiaohongshuCollectionWorkspace,
  type DouyinCollectedWorkRecord,
  type WechatMpArticleRecord,
  type WechatMpBenchmarkArticleRecord,
  type WechatSearchItemRecord,
  type XhsCollectedNoteRecord,
} from "./collectors";
import { jsonRequest, request, requestBlobByUrl } from "./http";
import { type DouyinDesktopPublishSession } from "./publishing";

export type OpenClawInstallTokenRecord = {
  id: string;
  brandId: string;
  createdByUserId: string;
  tokenName: string;
  tokenPreview: string;
  status: "ACTIVE" | "REVOKED";
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawInstallWorkspace = {
  brandId: string;
  brandName: string;
  role: string;
  canManage: boolean;
  mcpServerName: string;
  mcpUrl: string;
  activeToken?: OpenClawInstallTokenRecord;
  snippetTemplates: {
    openclaw: string;
    workbuddy: string;
    cursor: string;
    claudeDesktop: string;
    codex: string;
    mcpEndpoint: string;
  };
  skillGuide: {
    title: string;
    summary: string;
    examples: string[];
  };
  skillInstall: {
    title: string;
    summary: string;
    status: "ready" | "beta";
    statusLabel: string;
    installTarget: string;
    steps: string[];
    fileName: string;
    downloadPath: string;
    githubTreeUrl: string;
    githubRef: string;
    githubPrompt: string;
    notes: string[];
  };
  relationshipGuide: {
    title: string;
    items: Array<{
      label: string;
      summary: string;
    }>;
  };
  deliveryChecklist: {
    title: string;
    summary: string;
    items: string[];
  };
  docs: Array<{
    label: string;
    url: string;
  }>;
};

export type RotateOpenClawInstallTokenResult = {
  token: string;
  record: OpenClawInstallTokenRecord;
  workspace: OpenClawInstallWorkspace;
};

export type RevealOpenClawInstallTokenResult = {
  tokenId: string;
  token: string;
};

export async function getOpenClawInstallationWorkspace() {
  return request<OpenClawInstallWorkspace>("/openclaw/installation-hub");
}

export async function rotateOpenClawInstallToken(payload?: {
  tokenName?: string;
  expiresInDays?: number;
}) {
  return jsonRequest<RotateOpenClawInstallTokenResult>("/openclaw/installation-hub/tokens/rotate", "POST", payload || {});
}

export async function revokeOpenClawInstallToken(tokenId: string) {
  return request<{ success: boolean; tokenId: string; workspace: OpenClawInstallWorkspace }>(`/openclaw/installation-hub/tokens/${tokenId}`, {
    method: "DELETE",
  });
}

export async function revealOpenClawInstallToken(tokenId: string) {
  return request<RevealOpenClawInstallTokenResult>(`/openclaw/installation-hub/tokens/${tokenId}/reveal`);
}

export async function downloadOpenClawSkillPackage(downloadPath: string) {
  return requestBlobByUrl(downloadPath);
}

export type OpenClawWorkspaceScope =
  | "brand_growth"
  | "xiaohongshu"
  | "douyin"
  | "wechat"
  | "geo"
  | "all_network_growth"
  | "paid_acquisition"
  | "creator_cooperation";
export type OpenClawCommentResourceType =
  | "creative_material"
  | "daily_plan"
  | "explosive_analysis"
  | "lobster_diary"
  | "strategy_optimization"
  | "marketing_plan"
  | "video_work"
  | "tencent_ad_lead";
export type OpenClawCreativeMaterialCategory = "text" | "image" | "audio" | "video";
export type OpenClawCreativeMaterialSourceKind = "material_library_upload" | "openclaw_upload";
export const CONTENT_ACQUISITION_OPENCLAW_WORKSPACE_SCOPES = ["xiaohongshu", "douyin", "wechat"] as const;
export const PERSONAL_CENTER_OPENCLAW_WORKSPACE_SCOPES = [
  "brand_growth",
  "xiaohongshu",
  "douyin",
  "wechat",
  "geo",
  "all_network_growth",
  "paid_acquisition",
  "creator_cooperation",
] as const;

export type OpenClawCommentRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  resourceType: OpenClawCommentResourceType;
  resourceId: string;
  createdByUserId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawCommentWorkspace = {
  items: OpenClawCommentRecord[];
  total: number;
};

export async function getOpenClawCommentWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  resourceType: OpenClawCommentResourceType,
  resourceId: string,
  limit?: number,
) {
  const query = new URLSearchParams({
    workspaceScope,
    resourceType,
    resourceId,
  });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawCommentWorkspace>(`/openclaw/brands/${brandId}/comments?${query.toString()}`);
}

export async function createOpenClawComment(
  brandId: string,
  payload: {
    workspaceScope: OpenClawWorkspaceScope;
    resourceType: OpenClawCommentResourceType;
    resourceId: string;
    content: string;
  },
) {
  return jsonRequest<{ item: OpenClawCommentRecord; workspace: OpenClawCommentWorkspace }>(
    `/openclaw/brands/${brandId}/comments`,
    "POST",
    payload,
  );
}

export type OpenClawExplosiveAnalysisRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  title: string;
  tags: string[];
  htmlContent: string;
  authorName: string;
  workUrl: string;
  videoCopy: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawExplosiveAnalysisWorkspace = {
  items: OpenClawExplosiveAnalysisRecord[];
  total: number;
};

export async function getOpenClawExplosiveAnalysisWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawExplosiveAnalysisWorkspace>(`/openclaw/brands/${brandId}/explosive-analyses?${query.toString()}`);
}

export async function deleteOpenClawExplosiveAnalysis(
  recordId: string,
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
) {
  const query = new URLSearchParams({ workspaceScope });
  return request<{ item: OpenClawExplosiveAnalysisRecord; workspace: OpenClawExplosiveAnalysisWorkspace }>(
    `/openclaw/brands/${brandId}/explosive-analyses/${recordId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export type OpenClawLobsterDiaryRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  diaryDate: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawLobsterDiaryWorkspace = {
  items: OpenClawLobsterDiaryRecord[];
  total: number;
};

export async function getOpenClawLobsterDiaryWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawLobsterDiaryWorkspace>(`/openclaw/brands/${brandId}/lobster-diaries?${query.toString()}`);
}

export async function deleteOpenClawLobsterDiary(diaryId: string, brandId: string, workspaceScope: OpenClawWorkspaceScope) {
  const query = new URLSearchParams({ workspaceScope });
  return request<{ item: OpenClawLobsterDiaryRecord; workspace: OpenClawLobsterDiaryWorkspace }>(
    `/openclaw/brands/${brandId}/lobster-diaries/${diaryId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export async function updateOpenClawLobsterDiary(
  diaryId: string,
  brandId: string,
  payload: {
    workspaceScope: OpenClawWorkspaceScope;
    diaryDate?: string;
    title?: string;
    content?: string;
  },
) {
  return jsonRequest<{ item: OpenClawLobsterDiaryRecord; workspace: OpenClawLobsterDiaryWorkspace }>(
    `/openclaw/brands/${brandId}/lobster-diaries/${diaryId}`,
    "PATCH",
    payload,
  );
}

export type OpenClawStrategyOptimizationRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  generatedAt: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawStrategyOptimizationWorkspace = {
  items: OpenClawStrategyOptimizationRecord[];
  total: number;
};

export async function getOpenClawStrategyOptimizationWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawStrategyOptimizationWorkspace>(`/openclaw/brands/${brandId}/strategy-optimizations?${query.toString()}`);
}

export async function deleteOpenClawStrategyOptimization(
  recordId: string,
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
) {
  const query = new URLSearchParams({ workspaceScope });
  return request<{ item: OpenClawStrategyOptimizationRecord; workspace: OpenClawStrategyOptimizationWorkspace }>(
    `/openclaw/brands/${brandId}/strategy-optimizations/${recordId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export async function updateOpenClawStrategyOptimization(
  recordId: string,
  brandId: string,
  payload: {
    workspaceScope: OpenClawWorkspaceScope;
    title?: string;
    content?: string;
  },
) {
  return jsonRequest<{ item: OpenClawStrategyOptimizationRecord; workspace: OpenClawStrategyOptimizationWorkspace }>(
    `/openclaw/brands/${brandId}/strategy-optimizations/${recordId}`,
    "PATCH",
    payload,
  );
}

export type OpenClawMarketingPlanRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  title: string;
  htmlContent: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawMarketingPlanWorkspace = {
  items: OpenClawMarketingPlanRecord[];
  total: number;
};

export async function getOpenClawMarketingPlanWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawMarketingPlanWorkspace>(`/openclaw/brands/${brandId}/marketing-plans?${query.toString()}`);
}

export async function deleteOpenClawMarketingPlan(
  recordId: string,
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
) {
  const query = new URLSearchParams({ workspaceScope });
  return request<{ item: OpenClawMarketingPlanRecord; workspace: OpenClawMarketingPlanWorkspace }>(
    `/openclaw/brands/${brandId}/marketing-plans/${recordId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export type OpenClawTencentAdLeadRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawTencentAdLeadWorkspace = {
  items: OpenClawTencentAdLeadRecord[];
  total: number;
};

export async function getOpenClawTencentAdLeadWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawTencentAdLeadWorkspace>(`/openclaw/brands/${brandId}/tencent-ad-leads?${query.toString()}`);
}

export async function deleteOpenClawTencentAdLead(
  recordId: string,
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
) {
  const query = new URLSearchParams({ workspaceScope });
  return request<{ item: OpenClawTencentAdLeadRecord; workspace: OpenClawTencentAdLeadWorkspace }>(
    `/openclaw/brands/${brandId}/tencent-ad-leads/${recordId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export type OpenClawCreatorWorkNextAction = "复投" | "调整" | "暂停";

export type OpenClawCreatorMatchRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  sourceProfileId: string;
  creatorId: string;
  oAuthorId: string;
  secUserId?: string;
  uniqueId?: string;
  douyinUid?: string;
  nickname: string;
  avatar?: string;
  signature?: string;
  region?: string;
  categoryLabels?: string[];
  contentThemeLabels?: string[];
  fansCount?: number;
  expectedPlayCount?: number;
  interactRate?: number;
  playOverRate?: number;
  spreadIndex?: number;
  price?: number;
  priceType?: string;
  cpm?: number;
  cpe?: number;
  profileUrl?: string;
  contactPhone?: string;
  contactWechat?: string;
  contactEmail?: string;
  mcnName?: string;
  marketingLabel?: string;
  taskCategoryLabel?: string;
  recommendedReason: string;
  isInTrackingList: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawCreatorMatchWorkspace = {
  items: OpenClawCreatorMatchRecord[];
  total: number;
};

export type OpenClawCreatorTrackingRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  sourceProfileId: string;
  creatorId: string;
  oAuthorId: string;
  secUserId?: string;
  uniqueId?: string;
  douyinUid?: string;
  nickname: string;
  avatar?: string;
  signature?: string;
  region?: string;
  categoryLabels?: string[];
  contentThemeLabels?: string[];
  fansCount?: number;
  expectedPlayCount?: number;
  interactRate?: number;
  playOverRate?: number;
  spreadIndex?: number;
  price?: number;
  priceType?: string;
  cpm?: number;
  cpe?: number;
  profileUrl?: string;
  contactPhone?: string;
  contactWechat?: string;
  contactEmail?: string;
  mcnName?: string;
  marketingLabel?: string;
  taskCategoryLabel?: string;
  cooperationWorkCount: number;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawCreatorTrackingWorkspace = {
  items: OpenClawCreatorTrackingRecord[];
  total: number;
};

export type OpenClawCreatorTrackingWorkRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  trackingId: string;
  createdByUserId: string;
  douyinWorkUrl: string;
  awemeId: string;
  title: string;
  coverUrl?: string;
  playCount?: number;
  likeCount?: number;
  collectCount?: number;
  commentCount?: number;
  shareCount?: number;
  resultEvaluation: string;
  nextAction?: OpenClawCreatorWorkNextAction;
  refreshIntervalDays: number;
  lastSyncedAt: string;
  nextRefreshAt: string;
  lastSyncError?: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawCreatorTrackingWorkWorkspace = {
  trackingId: string;
  items: OpenClawCreatorTrackingWorkRecord[];
  total: number;
};

export async function getOpenClawCreatorMatchWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawCreatorMatchWorkspace>(`/openclaw/brands/${brandId}/creator-cooperations/matching?${query.toString()}`);
}

export async function deleteOpenClawCreatorMatches(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  recordIds: string[],
) {
  return jsonRequest<{ deletedCount: number; workspace: OpenClawCreatorMatchWorkspace }>(
    `/openclaw/brands/${brandId}/creator-cooperations/matching/delete-batch`,
    "POST",
    {
      workspaceScope,
      recordIds,
    },
  );
}

export async function addOpenClawCreatorMatchesToTracking(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  recordIds: string[],
) {
  return jsonRequest<{
    items: OpenClawCreatorTrackingRecord[];
    matchingWorkspace: OpenClawCreatorMatchWorkspace;
    trackingWorkspace: OpenClawCreatorTrackingWorkspace;
  }>(`/openclaw/brands/${brandId}/creator-cooperations/matching/add-to-tracking`, "POST", {
    workspaceScope,
    recordIds,
  });
}

export async function getOpenClawCreatorTrackingWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawCreatorTrackingWorkspace>(`/openclaw/brands/${brandId}/creator-cooperations/tracking?${query.toString()}`);
}

export async function deleteOpenClawCreatorTrackingRecord(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  trackingId: string,
) {
  const query = new URLSearchParams({ workspaceScope });
  return request<{ item: OpenClawCreatorTrackingRecord; workspace: OpenClawCreatorTrackingWorkspace }>(
    `/openclaw/brands/${brandId}/creator-cooperations/tracking/${trackingId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export async function getOpenClawCreatorTrackingWorkWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  trackingId: string,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawCreatorTrackingWorkWorkspace>(
    `/openclaw/brands/${brandId}/creator-cooperations/tracking/${trackingId}/works?${query.toString()}`,
  );
}

export async function createOpenClawCreatorTrackingWork(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  trackingId: string,
  payload: {
    douyinWorkUrl: string;
    refreshIntervalDays?: number;
    resultEvaluation?: string;
    nextAction?: OpenClawCreatorWorkNextAction | "";
  },
) {
  return jsonRequest<{ item: OpenClawCreatorTrackingWorkRecord; workspace: OpenClawCreatorTrackingWorkWorkspace }>(
    `/openclaw/brands/${brandId}/creator-cooperations/tracking/${trackingId}/works`,
    "POST",
    {
      workspaceScope,
      ...payload,
    },
  );
}

export async function updateOpenClawCreatorTrackingWork(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  trackingId: string,
  workId: string,
  payload: {
    douyinWorkUrl?: string;
    refreshIntervalDays?: number;
    resultEvaluation?: string;
    nextAction?: OpenClawCreatorWorkNextAction | "";
    refreshNow?: boolean;
  },
) {
  return jsonRequest<{ item: OpenClawCreatorTrackingWorkRecord; workspace: OpenClawCreatorTrackingWorkWorkspace }>(
    `/openclaw/brands/${brandId}/creator-cooperations/tracking/${trackingId}/works/${workId}`,
    "PATCH",
    {
      workspaceScope,
      ...payload,
    },
  );
}

export async function deleteOpenClawCreatorTrackingWork(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  trackingId: string,
  workId: string,
) {
  const query = new URLSearchParams({ workspaceScope });
  return request<{ item: OpenClawCreatorTrackingWorkRecord; workspace: OpenClawCreatorTrackingWorkWorkspace }>(
    `/openclaw/brands/${brandId}/creator-cooperations/tracking/${trackingId}/works/${workId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export type OpenClawDailyPlanRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  planDate: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawDailyPlanWorkspace = {
  items: OpenClawDailyPlanRecord[];
  total: number;
};

export async function getOpenClawDailyPlanWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawDailyPlanWorkspace>(`/openclaw/brands/${brandId}/daily-plans?${query.toString()}`);
}

export async function deleteOpenClawDailyPlan(planId: string, brandId: string, workspaceScope: OpenClawWorkspaceScope) {
  const query = new URLSearchParams({ workspaceScope });
  return request<{ item: OpenClawDailyPlanRecord; workspace: OpenClawDailyPlanWorkspace }>(
    `/openclaw/brands/${brandId}/daily-plans/${planId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export type OpenClawCreativeMaterialRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  sourceKind: OpenClawCreativeMaterialSourceKind;
  title: string;
  description: string;
  materialType: string;
  materialCategory: OpenClawCreativeMaterialCategory;
  materialTags: string[];
  sourceLabel: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  textContent?: string;
  storageKey?: string;
  localFilePath?: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawCreativeMaterialWorkspace = {
  items: OpenClawCreativeMaterialRecord[];
  total: number;
};

const PERSONAL_CENTER_COLLECTED_MATERIAL_USER_ID = "system:collector-sync";

function dedupeStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function pickFileNameFromUrl(url?: string) {
  if (!url) {
    return undefined;
  }
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return decodeURIComponent(segments[segments.length - 1] || "");
  } catch {
    return undefined;
  }
}

function buildCollectedMaterialRecord(payload: {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  title: string;
  description?: string;
  materialType: string;
  materialCategory: OpenClawCreativeMaterialCategory;
  materialTags?: string[];
  sourceLabel: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  textContent?: string;
  localFilePath?: string;
  createdAt: string;
  updatedAt?: string;
}) {
  return {
    id: payload.id,
    brandId: payload.brandId,
    workspaceScope: payload.workspaceScope,
    createdByUserId: PERSONAL_CENTER_COLLECTED_MATERIAL_USER_ID,
    sourceKind: "openclaw_upload" as const,
    title: payload.title,
    description: payload.description || "",
    materialType: payload.materialType,
    materialCategory: payload.materialCategory,
    materialTags: dedupeStrings(["系统自动同步", "采集数据", ...(payload.materialTags || [])]),
    sourceLabel: payload.sourceLabel,
    fileUrl: payload.fileUrl,
    fileName: payload.fileName || pickFileNameFromUrl(payload.fileUrl),
    mimeType: payload.mimeType,
    textContent: payload.textContent,
    storageKey: undefined,
    localFilePath: payload.localFilePath,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt || payload.createdAt,
  } satisfies OpenClawCreativeMaterialRecord;
}

function mapXiaohongshuCollectedNoteToMaterial(brandId: string, item: XhsCollectedNoteRecord) {
  const materialCategory: OpenClawCreativeMaterialCategory = item.videoUrl
    ? "video"
    : item.imageList?.length
      ? "image"
      : "text";
  const fileUrl = materialCategory === "video" ? item.videoUrl : item.imageList?.[0];
  return buildCollectedMaterialRecord({
    id: `collector-xhs-${item.id}`,
    brandId,
    workspaceScope: "xiaohongshu",
    title: item.title || "未命名小红书素材",
    description: item.description || "",
    materialType:
      materialCategory === "video"
        ? "xhs_collected_video"
        : materialCategory === "image"
          ? "xhs_collected_image"
          : "xhs_collected_text",
    materialCategory,
    materialTags: dedupeStrings([
      "小红书",
      item.noteType || undefined,
      materialCategory === "video" ? "视频" : materialCategory === "image" ? "图文" : "文本",
      item.nickname || undefined,
    ]),
    sourceLabel: "小红书采集 / 自动同步",
    fileUrl,
    mimeType: materialCategory === "video" ? "video/mp4" : materialCategory === "image" ? "image/jpeg" : undefined,
    textContent: item.description || item.title,
    createdAt: item.collectedAt,
    updatedAt: item.materialAddedAt || item.collectedAt,
  });
}

function mapDouyinCollectedWorkToMaterial(brandId: string, item: DouyinCollectedWorkRecord) {
  const hasVideo = Boolean(item.videoUrl || item.videoSourceUrl || item.videoStoragePath);
  const hasImage = Boolean(item.coverUrl || item.imageList?.length);
  const materialCategory: OpenClawCreativeMaterialCategory = hasVideo ? "video" : hasImage ? "image" : "text";
  const fileUrl = hasVideo ? item.videoUrl || item.videoSourceUrl : item.coverUrl || item.imageList?.[0];
  return buildCollectedMaterialRecord({
    id: `collector-douyin-${item.id}`,
    brandId,
    workspaceScope: "douyin",
    title: item.title || "未命名抖音素材",
    description: item.transcript || item.description || "",
    materialType:
      materialCategory === "video"
        ? "douyin_collected_video"
        : materialCategory === "image"
          ? "douyin_collected_image"
          : "douyin_collected_text",
    materialCategory,
    materialTags: dedupeStrings([
      "抖音",
      item.workType || undefined,
      item.authorName || undefined,
      item.videoCacheStatus ? `缓存-${item.videoCacheStatus}` : undefined,
      item.transcript ? "已提取视频文案" : item.transcriptStatus ? `文案-${item.transcriptStatus}` : undefined,
    ]),
    sourceLabel: "抖音采集 / 自动同步",
    fileUrl,
    mimeType: materialCategory === "video" ? "video/mp4" : materialCategory === "image" ? "image/jpeg" : undefined,
    textContent: item.transcript || item.description || item.title,
    localFilePath: item.videoStoragePath,
    createdAt: item.collectedAt,
    updatedAt: item.transcribedAt || item.transcriptStatusUpdatedAt || item.materialAddedAt || item.collectedAt,
  });
}

function mapWechatArticleToMaterial(
  brandId: string,
  item: WechatMpArticleRecord | WechatMpBenchmarkArticleRecord | WechatSearchItemRecord,
  sourceLabel: string,
) {
  const imageUrls = "images" in item ? item.images || [] : [];
  const coverUrl = "cover" in item ? item.cover : undefined;
  const hasImage = Boolean(coverUrl || imageUrls.length);
  const materialCategory: OpenClawCreativeMaterialCategory = hasImage ? "image" : "text";
  const fileUrl = coverUrl || imageUrls[0];
  const textContent = item.articleContent || ("desc" in item ? item.desc : undefined) || item.title;
  return buildCollectedMaterialRecord({
    id: `collector-wechat-${item.id}`,
    brandId,
    workspaceScope: "wechat",
    title: item.title || "未命名公众号素材",
    description: textContent,
    materialType: materialCategory === "image" ? "wechat_collected_image" : "wechat_collected_text",
    materialCategory,
    materialTags: dedupeStrings([
      "公众号",
      "公众号文章",
      "jumpInfoNickName" in item ? item.jumpInfoNickName : undefined,
      "ghUsername" in item ? item.ghUsername : undefined,
    ]),
    sourceLabel,
    fileUrl,
    mimeType: materialCategory === "image" ? "image/jpeg" : undefined,
    textContent,
    createdAt: item.collectedAt,
    updatedAt:
      ("contentReadAt" in item ? item.contentReadAt : undefined)
      || ("statsUpdatedAt" in item ? item.statsUpdatedAt : undefined)
      || ("materialAddedAt" in item ? item.materialAddedAt : undefined)
      || item.collectedAt,
  });
}

async function getPersonalCenterCollectedMaterialWorkspace(brandId: string) {
  const [xhsWorkspace, douyinWorkspace, wechatWorkspace, wechatBenchmarkWorkspace, wechatSearchWorkspace] = await Promise.all([
    getXiaohongshuCollectionWorkspace(brandId),
    getDouyinCollectionWorkspace(brandId),
    getWechatMpCollectionWorkspace(brandId),
    getWechatMpBenchmarkWorkspace(brandId),
    getWechatSearchWorkspace(brandId),
  ]);

  const xhsItems = [...xhsWorkspace.brandNotes, ...xhsWorkspace.benchmarkNotes, ...xhsWorkspace.searchNotes]
    .map((item) => mapXiaohongshuCollectedNoteToMaterial(brandId, item));
  const douyinItems = [
    ...douyinWorkspace.brandWorks,
    ...douyinWorkspace.competitorWorks,
    ...douyinWorkspace.benchmarkWorks,
    ...douyinWorkspace.searchWorks,
    ...douyinWorkspace.lowFanExplosiveWorks,
    ...douyinWorkspace.highCompletionRateWorks,
    ...douyinWorkspace.highLikeRateWorks,
  ].map((item) => mapDouyinCollectedWorkToMaterial(brandId, item));
  const wechatItems = [
    ...wechatWorkspace.articles.map((item) => mapWechatArticleToMaterial(brandId, item, "公众号采集 / 自动同步")),
    ...wechatBenchmarkWorkspace.benchmarkArticles.map((item) =>
      mapWechatArticleToMaterial(brandId, item, "公众号对标采集 / 自动同步"),
    ),
    ...wechatSearchWorkspace.items.map((item) => mapWechatArticleToMaterial(brandId, item, "微信搜一搜采集 / 自动同步")),
  ];

  const deduped = new Map<string, OpenClawCreativeMaterialRecord>();
  [...xhsItems, ...douyinItems, ...wechatItems].forEach((item) => {
    deduped.set(item.id, item);
  });
  return [...deduped.values()];
}

export async function getOpenClawCreativeMaterialWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawCreativeMaterialWorkspace>(`/openclaw/brands/${brandId}/creative-materials?${query.toString()}`);
}

export async function getContentAcquisitionCreativeMaterialWorkspace(brandId: string, limit?: number) {
  const scopes = [...CONTENT_ACQUISITION_OPENCLAW_WORKSPACE_SCOPES] as OpenClawWorkspaceScope[];
  const workspaces = await Promise.all(scopes.map((scope) => getOpenClawCreativeMaterialWorkspace(brandId, scope, limit)));
  const items = workspaces.flatMap((workspace) => workspace.items);
  return {
    items,
    total: items.length,
  } satisfies OpenClawCreativeMaterialWorkspace;
}

export async function getPersonalCenterCreativeMaterialWorkspace(brandId: string, limit?: number) {
  const scopes = [...PERSONAL_CENTER_OPENCLAW_WORKSPACE_SCOPES] as OpenClawWorkspaceScope[];
  const [workspaces, collectedItems] = await Promise.all([
    Promise.all(scopes.map((scope) => getOpenClawCreativeMaterialWorkspace(brandId, scope, limit))),
    getPersonalCenterCollectedMaterialWorkspace(brandId),
  ]);
  const deduped = new Map<string, OpenClawCreativeMaterialRecord>();
  for (const workspace of workspaces) {
    for (const item of workspace.items) {
      deduped.set(item.id, item);
    }
  }
  for (const item of collectedItems) {
    deduped.set(item.id, item);
  }
  const items = [...deduped.values()]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, typeof limit === "number" ? limit : deduped.size);
  // #region debug-point A:personal-center-material-aggregation
  fetch("http://127.0.0.1:7777/event", {
    method: "POST",
    body: JSON.stringify({
      sessionId: "material-sync-cache-fail",
      runId: "pre-fix",
      hypothesisId: "A",
      location: "apps/web/src/services/openclaw.ts:getPersonalCenterCreativeMaterialWorkspace",
      msg: "[DEBUG] Personal center material aggregation completed",
      data: {
        brandId,
        openclawWorkspaceCount: workspaces.length,
        openclawItemCount: workspaces.reduce((sum, workspace) => sum + workspace.items.length, 0),
        collectedItemCount: collectedItems.length,
        mergedItemCount: deduped.size,
        limit: typeof limit === "number" ? limit : null,
      },
      ts: Date.now(),
    }),
  }).catch(() => undefined);
  // #endregion
  return {
    items,
    total: deduped.size,
  } satisfies OpenClawCreativeMaterialWorkspace;
}

export async function createOpenClawCreativeMaterial(
  brandId: string,
  payload: {
    workspaceScope?: OpenClawWorkspaceScope;
    sourceKind?: OpenClawCreativeMaterialSourceKind;
    title: string;
    description?: string;
    materialType: string;
    materialTags?: string[];
    fileUrl?: string;
    fileName?: string;
    mimeType?: string;
    textContent?: string;
    upload?: {
      fileName?: string;
      contentType?: string;
      dataBase64?: string;
    };
  },
) {
  return jsonRequest<{ item: OpenClawCreativeMaterialRecord; workspace: OpenClawCreativeMaterialWorkspace }>(
    `/openclaw/brands/${brandId}/creative-materials`,
    "POST",
    payload,
  );
}

export async function deleteOpenClawCreativeMaterial(
  materialId: string,
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
) {
  const query = new URLSearchParams({ workspaceScope });
  return request<{ item: OpenClawCreativeMaterialRecord; workspace: OpenClawCreativeMaterialWorkspace }>(
    `/openclaw/brands/${brandId}/creative-materials/${materialId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export type OpenClawVideoWorkRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  title: string;
  description: string;
  scriptContent: string;
  coverImageUrl?: string;
  videoUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawVideoWorkWorkspace = {
  items: OpenClawVideoWorkRecord[];
  total: number;
};

export async function getOpenClawVideoWorkWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawVideoWorkWorkspace>(`/openclaw/brands/${brandId}/video-works?${query.toString()}`);
}

export async function deleteOpenClawVideoWork(
  workId: string,
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
) {
  const query = new URLSearchParams({ workspaceScope });
  return request<{ item: OpenClawVideoWorkRecord; workspace: OpenClawVideoWorkWorkspace }>(
    `/openclaw/brands/${brandId}/video-works/${workId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export async function createOpenClawVideoWorkDouyinDesktopPublishSession(
  brandId: string,
  workId: string,
  workspaceScope: OpenClawWorkspaceScope,
  payload: { accountId?: string } = {},
) {
  const query = new URLSearchParams({ workspaceScope });
  return jsonRequest<{ task: { id: string; taskStatus: string; taskTitle: string }; session: DouyinDesktopPublishSession }>(
    `/openclaw/brands/${brandId}/video-works/${workId}/douyin-desktop-publish-session?${query.toString()}`,
    "POST",
    payload,
  );
}

export type OpenClawGeoVisibilityReportRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  title: string;
  description: string;
  htmlContent: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawGeoVisibilityReportWorkspace = {
  items: OpenClawGeoVisibilityReportRecord[];
  total: number;
};

export type OpenClawGeoContentType =
  | "keyword_research"
  | "site_diagnosis"
  | "knowledge_base_setup"
  | "geo_optimization_plan"
  | "self_media_content"
  | "third_party_media"
  | "brand_website_content";

export type OpenClawGeoContentGenerationMode = "single" | "multiple";

export type OpenClawGeoContentRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  contentType: OpenClawGeoContentType;
  sectionLabel: string;
  generationMode: OpenClawGeoContentGenerationMode;
  title: string;
  description: string;
  htmlContent: string;
  attachmentLabel: string;
  attachmentFileUrl?: string;
  attachmentFileName?: string;
  attachmentMimeType?: string;
  attachmentStorageKey?: string;
  storageAddress?: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawGeoContentWorkspace = {
  items: OpenClawGeoContentRecord[];
  total: number;
};

export type ThirdPartyMediaDeliveryResourceRecord = {
  id: string;
  sortType: string;
  platform: string;
  taxonomy: string;
  area: string;
  name: string;
  caseUrl?: string;
  price: string;
  publishTime: string;
  successRate: string;
  includeRate: string;
  isSelfMedia: boolean;
  raw: Record<string, unknown>;
  sourceRemotePage: number;
  syncedAt: string;
  updatedAt: string;
};

export type ThirdPartyMediaDeliveryResourceWorkspace = {
  items: ThirdPartyMediaDeliveryResourceRecord[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  cachedTotal: number;
  searchKeyword: string;
  syncedAt: string;
  nextRemotePage: number;
  remoteLastPage: number;
  hasRemoteMore: boolean;
};

export type ThirdPartyMediaDeliveryResourceSyncResult = {
  workspace: ThirdPartyMediaDeliveryResourceWorkspace;
  remotePage: number;
  fetchedCount: number;
  createdCount: number;
  updatedCount: number;
  skipped: boolean;
  hasRemoteMore: boolean;
  nextRemotePage: number;
  syncedAt: string;
};

export type ThirdPartyMediaDeliveryRecord = {
  orderId: string;
  resourceId: string;
  resourceName: string;
  articleId: string;
  articleTitle: string;
  createdAt: string;
  raw: Record<string, unknown>;
};

export type OpenClawCommentLeadPlatform = "xiaohongshu" | "douyin";

export type OpenClawCommentLeadRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  sourcePlatform: OpenClawCommentLeadPlatform;
  sourcePlatformLabel: "小红书" | "抖音";
  sourceUrl: string;
  sourceCommentId?: string;
  userName: string;
  userComment: string;
  selectedReason: string;
  userProfileUrl: string;
  selectedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawCommentLeadWorkspace = {
  items: OpenClawCommentLeadRecord[];
  total: number;
};

export type OpenClawPlatformLeadRecord = {
  id: string;
  brandId: string;
  workspaceScope: OpenClawWorkspaceScope;
  createdByUserId: string;
  name: string;
  businessScope: string;
  selectedReason: string;
  contactInfo: string;
  address: string;
  selectedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type OpenClawPlatformLeadWorkspace = {
  items: OpenClawPlatformLeadRecord[];
  total: number;
};

export type CreateOpenClawPlatformLeadsResult = {
  items: OpenClawPlatformLeadRecord[];
  createdCount: number;
  updatedCount: number;
};

export type CreateOpenClawCommentLeadsResult = {
  items: OpenClawCommentLeadRecord[];
  createdCount: number;
  updatedCount: number;
  platformCounts: {
    xiaohongshu: number;
    douyin: number;
  };
};

export async function getOpenClawGeoVisibilityReportWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawGeoVisibilityReportWorkspace>(`/openclaw/brands/${brandId}/geo-visibility-reports?${query.toString()}`);
}

export async function deleteOpenClawGeoVisibilityReport(
  reportId: string,
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
) {
  const query = new URLSearchParams({ workspaceScope });
  return request<{ item: OpenClawGeoVisibilityReportRecord; workspace: OpenClawGeoVisibilityReportWorkspace }>(
    `/openclaw/brands/${brandId}/geo-visibility-reports/${reportId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export async function getOpenClawGeoContentWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  contentType?: OpenClawGeoContentType,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (contentType) {
    query.set("contentType", contentType);
  }
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawGeoContentWorkspace>(`/openclaw/brands/${brandId}/geo-contents?${query.toString()}`);
}

export async function deleteOpenClawGeoContent(
  contentId: string,
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  contentType?: OpenClawGeoContentType,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (contentType) {
    query.set("contentType", contentType);
  }
  return request<{ item: OpenClawGeoContentRecord; workspace: OpenClawGeoContentWorkspace }>(
    `/openclaw/brands/${brandId}/geo-contents/${contentId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export async function getThirdPartyMediaDeliveryResources(
  brandId: string,
  options?: {
    page?: number;
    searchKeyword?: string;
  },
) {
  const query = new URLSearchParams();
  if (typeof options?.page === "number") {
    query.set("page", String(options.page));
  }
  if (options?.searchKeyword?.trim()) {
    query.set("searchKeyword", options.searchKeyword.trim());
  }
  return request<ThirdPartyMediaDeliveryResourceWorkspace>(
    `/openclaw/brands/${brandId}/third-party-media-delivery/resources${query.size ? `?${query.toString()}` : ""}`,
  );
}

export async function syncThirdPartyMediaDeliveryResources(
  brandId: string,
  payload?: {
    page?: number;
    searchKeyword?: string;
  },
) {
  return jsonRequest<ThirdPartyMediaDeliveryResourceSyncResult>(
    `/openclaw/brands/${brandId}/third-party-media-delivery/resources/sync`,
    "POST",
    payload || {},
  );
}

export async function createThirdPartyMediaDelivery(
  brandId: string,
  payload: {
    articleId: string;
    resourceId: string;
  },
) {
  return jsonRequest<{ delivery: ThirdPartyMediaDeliveryRecord }>(
    `/openclaw/brands/${brandId}/third-party-media-delivery/deliveries`,
    "POST",
    payload,
  );
}

export async function getOpenClawCommentLeadWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  sourcePlatform?: OpenClawCommentLeadPlatform,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (sourcePlatform) {
    query.set("sourcePlatform", sourcePlatform);
  }
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawCommentLeadWorkspace>(`/openclaw/brands/${brandId}/comment-leads?${query.toString()}`);
}

export async function createOpenClawCommentLeads(
  brandId: string,
  payload: {
    workspaceScope?: OpenClawWorkspaceScope;
    sourcePlatforms?: OpenClawCommentLeadPlatform[];
    xiaohongshuSourceUrls?: string[];
    douyinSourceUrls?: string[];
    matchKeywords?: string[];
    syncCommentsFirst?: boolean;
  } = {},
) {
  return jsonRequest<{ result: CreateOpenClawCommentLeadsResult; workspace: OpenClawCommentLeadWorkspace }>(
    `/openclaw/brands/${brandId}/comment-leads`,
    "POST",
    payload,
  );
}

export async function deleteOpenClawCommentLead(
  leadId: string,
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  sourcePlatform?: OpenClawCommentLeadPlatform,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (sourcePlatform) {
    query.set("sourcePlatform", sourcePlatform);
  }
  return request<{ item: OpenClawCommentLeadRecord; workspace: OpenClawCommentLeadWorkspace }>(
    `/openclaw/brands/${brandId}/comment-leads/${leadId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}

export async function getOpenClawPlatformLeadWorkspace(
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
  limit?: number,
) {
  const query = new URLSearchParams({ workspaceScope });
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  return request<OpenClawPlatformLeadWorkspace>(`/openclaw/brands/${brandId}/platform-leads?${query.toString()}`);
}

export async function createOpenClawPlatformLeads(
  brandId: string,
  payload: {
    workspaceScope?: OpenClawWorkspaceScope;
    items: Array<{
      id?: string;
      name: string;
      businessScope: string;
      selectedReason: string;
      contactInfo: string;
      address: string;
      selectedAt?: string;
    }>;
  },
) {
  return jsonRequest<{ result: CreateOpenClawPlatformLeadsResult; workspace: OpenClawPlatformLeadWorkspace }>(
    `/openclaw/brands/${brandId}/platform-leads`,
    "POST",
    payload,
  );
}

export async function deleteOpenClawPlatformLead(
  leadId: string,
  brandId: string,
  workspaceScope: OpenClawWorkspaceScope,
) {
  const query = new URLSearchParams({ workspaceScope });
  return request<{ item: OpenClawPlatformLeadRecord; workspace: OpenClawPlatformLeadWorkspace }>(
    `/openclaw/brands/${brandId}/platform-leads/${leadId}?${query.toString()}`,
    {
      method: "DELETE",
    },
  );
}
