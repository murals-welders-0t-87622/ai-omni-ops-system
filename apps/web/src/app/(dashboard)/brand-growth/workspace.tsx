"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { getStoredCurrentBrandId } from "../../../services/auth-session";
import { getMe } from "../../../services/auth";
import { API_BASE_URL, requestBlobByUrl } from "../../../services/http";
import {
  formatCalendarDate,
  formatCalendarListValue,
  formatCalendarMonthDay,
  formatCalendarOptionalValue,
  getCalendarFestivalLabel,
} from "../xiaohongshu/calendar-helpers";
import {
  type DouyinCollectionCardKey,
  type XhsAccountBindingEntry,
  type XiaohongshuCollectionCardKey,
} from "./collection-workspace";
import {
  formatCount,
  formatDateLabel,
  formatDateTime,
  formatHotspotHeat,
  formatMetric,
  sortByCollectedAtDesc,
} from "./datetime-helpers";
import {
  type LibraryAssetModalDraft,
  type LibraryAssetTarget,
} from "./library-workspace";
import {
  buildVisualReportPreviewDocument,
  renderMarkdownToHtml,
} from "./markdown-render";
import { OpenClawLobsterDiaryWorkspace } from "./openclaw-lobster-diary-workspace";
import { OpenClawDailyPlanWorkspace } from "./openclaw-daily-plan-workspace";
import { OpenClawExplosiveAnalysisWorkspace } from "./openclaw-explosive-analysis-workspace";
import { OpportunityInsightStepInputModal } from "./opportunity-insight-step-input-modal";
import { ReportMaterialLibraryWorkspace } from "./report-material-library-workspace";
import { NoteCreateModalShell } from "../xiaohongshu/note-create-modal-shell";
import { type NoteCreateModalCopy } from "../xiaohongshu/note-create-modal-copy";
import type {
  BrandGrowthLibraryPageKey,
  MediaPreviewState,
} from "./shared-types";
import {
  getBrandArchiveStatusText,
  getReportTaskStatusText,
} from "./task-status-helpers";
import {
  addDouyinBenchmarkWorkToMaterialLibrary,
  addDouyinCreatorsToResultPool,
  addBenchmarkNoteToMaterialLibrary,
  addWechatMpBenchmarkArticleToMaterialLibrary,
  addWechatSearchItemToMaterialLibrary,
  buildUnifiedMaterialLibraryItems,
  createDouyinCreatorDeepFetchTasks,
  deleteDouyinBrandAccount,
  deleteDouyinCollectedWork,
  deleteDouyinCompetitorAccount,
  deleteXhsCollectedNote,
  extractDouyinWorkTranscript,
  getDouyinCollectionWorkspace,
  getXiaohongshuCommentReplies,
  getXiaohongshuCollectionWorkspace,
  type DouyinCollectedWorkRecord,
  type DouyinCommentPaginationState,
  type DouyinCommentRecord,
  type XhsCommentPaginationState,
  type XhsCommentRecord,
  type XhsSubCommentPaginationState,
  type XhsSubCommentRecord,
  removeDouyinKeywordRecommendation,
  searchDouyinCreators,
  removeDouyinBenchmarkWorkFromMaterialLibrary,
  syncDouyinCollectionWorkspace,
  syncDouyinTargetUsers,
  syncXiaohongshuCommentData,
  syncXiaohongshuFromFeishu,
  syncXiaohongshuBenchmarkNotes,
  syncXiaohongshuBrandAccounts,
  syncXiaohongshuBrandNotes,
  syncXiaohongshuCompetitorAccounts,
  syncXiaohongshuSearchNotes,
  syncXiaohongshuTargetUsers,
  type DouyinCollectedAccountRecord,
  type DouyinCreatorDeepFetchPayload,
  type DouyinCreatorDeepFetchTaskRecord,
  type DouyinCreatorIdentityType,
  type DouyinCreatorProfileRecord,
  type DouyinCreatorSearchPayload,
  type DouyinCreatorSearchRecord,
  type DouyinKeywordRecommendationRecord,
  type XhsAccountRole,
  type XhsSyncAccountEntry,
  type DouyinSyncPayload,
  type DouyinCollectionWorkspace,
  type XhsSyncPayload,
  type XhsCollectionWorkspace,
  type WechatMpCollectionWorkspace,
  type WechatMpBenchmarkWorkspace,
  type WechatSearchWorkspace,
  wechatMpCollectionSeed,
  wechatMpBenchmarkSeed,
  wechatSearchSeed,
  getWechatMpCollectionWorkspace,
  getWechatMpBenchmarkWorkspace,
  getWechatSearchWorkspace,
} from "../../../services/collectors";
import {
  brandArchiveSeed,
  createBrandProduct,
  getCurrentUserProfile,
  deleteBrandProduct,
  DEMO_BRAND_ID,
  getBrandArchive,
  getBrandPermissionSettings,
  getFeishuAppConfig,
  getBrandFeishuBinding,
  getFeishuAuthStatus,
  replaceBrandAssets,
  replaceBrandSurvey,
  startFeishuAuth,
  type BrandArchiveBundle,
  type BrandArchiveStepKey,
  type BrandAsset,
  type BrandBackground,
  type BrandIpProfile,
  type BrandPermissionKey,
  type BrandPermissionSettingsRecord,
  type CurrentUserProfile,
  type FeishuAppConfigRecord,
  type FeishuAuthStatusRecord,
  type FeishuBindingRecord,
  type BrandProduct,
  normalizeBrandArchiveBundle,
  upsertFeishuAppConfig,
  upsertBrandFeishuBinding,
  uploadBrandAssetFile,
  uploadBrandIpImage,
  uploadBrandIpVoice,
  uploadBrandProductImage,
  updateBrandBackground,
  updateBrandIpProfile,
  updateBrandProduct,
} from "../../../services/brand-growth";
import {
  generateAnnualMarketingPlan,
  generateDouyinHotTopicCandidates,
  generateGrowthReport,
  generateOpportunityInsightStepOne,
  generateOpportunityInsightStepThree,
  generateOpportunityInsightStepTwo,
  generateVisualGrowthReport,
  getAnnualMarketingPlanWorkspace,
  getDouyinHotTopicCandidatesWorkspace,
  getGrowthReportWorkspace,
  getOpportunityInsightWorkspace,
  getXiaohongshuMarketingCalendarWorkspace,
  getXiaohongshuMarketingPlanWorkspace,
  getVisualGrowthReportWorkspace,
  douyinHotTopicCandidatesSeed,
  generateXiaohongshuMarketingCalendar,
  opportunityInsightSeed,
  updateGrowthReport,
  updateDouyinTopicLibrary,
  type AnnualMarketingPlanWorkspace,
  type DouyinHotTopicCandidatesWorkspace,
  type DouyinTopicLibraryItem,
  type GrowthReportWorkspace,
  type OpportunityInsightWorkspace,
  type XiaohongshuMarketingCalendarItem,
  type XiaohongshuMarketingCalendarWorkspace,
  type XiaohongshuMarketingPlanWorkspace,
  type VisualGrowthReportWorkspace,
  updateXiaohongshuMarketingCalendar,
  upsertXiaohongshuMarketingCalendarItem,
  xiaohongshuMarketingPlanSeed,
} from "../../../services/reports";
import {
  deleteOpenClawExplosiveAnalysis,
  getOpenClawExplosiveAnalysisWorkspace,
  deleteOpenClawLobsterDiary,
  getOpenClawLobsterDiaryWorkspace,
  updateOpenClawLobsterDiary,
  type OpenClawExplosiveAnalysisWorkspace as OpenClawExplosiveAnalysisWorkspaceRecord,
  type OpenClawLobsterDiaryWorkspace as OpenClawLobsterDiaryWorkspaceRecord,
  deleteOpenClawDailyPlan,
  getOpenClawDailyPlanWorkspace,
  type OpenClawDailyPlanWorkspace as OpenClawDailyPlanWorkspaceRecord,
} from "../../../services/openclaw";
import {
  getDailyHotspotWorkspace,
  syncDailyHotspots,
  type DailyHotspotWorkspace,
} from "../../../services/daily-hotspots";
import { isAuthFailure } from "../personal-center/route-helpers";

const stepOrder: BrandArchiveStepKey[] = [
  "background",
  "ipLibrary",
  "products",
  "survey",
  "industryFeeds",
  "businessAssets",
];

type StrategySectionKey = "library" | "collection" | "report" | "openclaw";
type StrategyPageKey =
  | BrandArchiveStepKey
  | "feishuCollection"
  | "xiaohongshuCollection"
  | "douyinCollection"
  | "wechatMpCollection"
  | "dailyHotspot"
  | "opportunityInsight"
  | "growthReport"
  | "visualGrowthReport"
  | "annualMarketingPlan"
  | "xiaohongshuMarketingCalendar"
  | "openclawExplosiveAnalysis"
  | "reportTopicLibrary"
  | "reportMaterialLibrary"
  | "openclawDailyPlan"
  | "openclawLobsterDiary";
type BrandGrowthLoadScope = "library" | "collection" | "report";
type OpportunityInsightStep = 1 | 2 | 3;
type OpportunityInsightStepModalState = {
  step: OpportunityInsightStep;
  isRetry: boolean;
};
type ReportGenerationModalKind = "annualMarketingPlan" | "marketingCalendar";
const REPORT_SCOPE_SNAPSHOT_TTL_MS = 30_000;
const REPORT_GENERATION_MODAL_COPY: Record<ReportGenerationModalKind, NoteCreateModalCopy> = {
  annualMarketingPlan: {
    title: "生成半年营销规划",
    metaText: "可补充本次规划希望重点强调的业务目标、关键产品、节奏要求或资源限制，提交后开始生成。",
  },
  marketingCalendar: {
    title: "生成营销日历",
    metaText: "可补充本次排期希望重点强调的平台、节日打法、资源优先级或阶段目标，提交后开始生成。",
  },
};

const BrandGrowthLibraryWorkspace = dynamic(
  () => import("./library-workspace").then((module) => module.BrandGrowthLibraryWorkspace),
  { loading: () => <WorkspaceChunkFallback label="资料库" /> },
);

const BrandGrowthCollectionWorkspace = dynamic(
  () => import("./collection-workspace").then((module) => module.BrandGrowthCollectionWorkspace),
  { loading: () => <WorkspaceChunkFallback label="收集数据" /> },
);

const CalendarWorkspace = dynamic(
  () => import("../xiaohongshu/calendar-workspace").then((module) => module.CalendarWorkspace),
  { loading: () => <WorkspaceChunkFallback label="营销日历" /> },
);

const BrandGrowthReportWorkspace = dynamic(
  () => import("./report-workspace").then((module) => module.BrandGrowthReportWorkspace),
  { loading: () => <WorkspaceChunkFallback label="品牌增长报告" /> },
);

const DouyinTopicLibraryWorkspace = dynamic(
  () => import("../douyin/topic-library-workspace").then((module) => module.DouyinTopicLibraryWorkspace),
  { loading: () => <WorkspaceChunkFallback label="选题库" /> },
);

const WechatMpCollectionWorkspace = dynamic(
  () => import("./wechat-mp-collection-workspace").then((module) => module.WechatMpCollectionWorkspace),
  { loading: () => <WorkspaceChunkFallback label="公众号" /> },
);

function WorkspaceChunkFallback({ label }: { label: string }) {
  return (
    <section className="strategy-workspace-shell" aria-live="polite">
      <div className="strategy-workspace-surface brand-growth-shell">
        <div className="brand-growth-panel stack gap-12">
          <p className="section-eyebrow">模块加载中</p>
          <h3>{label}正在准备</h3>
          <p className="section-subtitle">按需加载对应工作区资源，避免首屏下载全部板块脚本。</p>
        </div>
      </div>
    </section>
  );
}

const strategySections: Array<{
  key: StrategySectionKey;
  label: string;
  pages: Array<{ key: StrategyPageKey; label: string; description: string }>;
}> = [
  {
    key: "library",
    label: "品牌资料库",
    pages: [
      { key: "background", label: "品牌背景资料", description: "维护品牌基础信息、企业介绍和建档底座。" },
      { key: "ipLibrary", label: "IP资料库", description: "维护品牌 IP 的名称、照片、定位、故事、价值观、风格和账号链接。" },
      { key: "products", label: "产品资料库", description: "沉淀品牌产品、价格与场景信息。" },
      { key: "survey", label: "品牌运营情况", description: "记录品牌人货场、运营诊断与核心问题。" },
      { key: "industryFeeds", label: "第三方数据", description: "归集行业报告、市场信息与评论洞察。" },
      { key: "businessAssets", label: "企业知识库", description: "归集经营报表、业务系统、门店资料与内部知识文档。" },
    ],
  },
  {
    key: "collection",
    label: "收集数据",
    pages: [
      { key: "xiaohongshuCollection", label: "小红书", description: "通过 Tikhub 直接采集品牌账号、竞品账号、品牌作品与对标作品数据。" },
      { key: "douyinCollection", label: "抖音", description: "查看抖音采集结果并执行 Tikhub 数据同步。" },
      { key: "wechatMpCollection", label: "公众号", description: "绑定公众号 gh_username，采集历史文章列表并更新阅读量、点赞数等互动数据。" },
      { key: "dailyHotspot", label: "每日热点", description: "查看热点主题、平台趋势和当天建议动作。" },
    ],
  },
  {
    key: "report",
    label: "品牌增长报告",
    pages: [
      { key: "opportunityInsight", label: "机会洞察", description: "先输出品牌/竞品账号分析，再逐步进入评论洞察与机会洞察总报告。" },
      { key: "growthReport", label: "生成品牌增长报告", description: "根据品牌资料与收集数据生成分析报告。" },
      { key: "visualGrowthReport", label: "品牌增长可视化报告", description: "输出图表化的品牌增长可视化结果。" },
      { key: "annualMarketingPlan", label: "半年营销规划", description: "形成未来半年节奏、战役安排与重点营销规划。" },
      { key: "xiaohongshuMarketingCalendar", label: "营销日历", description: "基于品牌背景资料、机会洞察总报告和品牌增长报告生成品牌全平台营销日历。" },
      { key: "openclawExplosiveAnalysis", label: "爆款拆解", description: "承接 OpenClaw 提交的爆款拆解 HTML、作者信息、作品链接和视频文案，并支持查看后留言。" },
      { key: "reportTopicLibrary", label: "选题库", description: "沉淀人工与 OpenClaw 共用的结构化选题，支持查看、编辑、删除与跨平台复用。" },
      { key: "reportMaterialLibrary", label: "素材库", description: "统一归集小红书与抖音素材，供所有平台创作作品共用。" },
    ],
  },
  {
    key: "openclaw",
    label: "OpenClaw专区",
    pages: [
      { key: "openclawDailyPlan", label: "每日计划", description: "展示由 OpenClaw Agent 创建的每日计划记录，页面只支持查看与删除。" },
      { key: "openclawLobsterDiary", label: "每周复盘", description: "展示由 OpenClaw Agent 创建的每周复盘记录，支持查看后直接编辑并在内容下留言。" },
    ],
  },
];

const FEISHU_XHS_TEMPLATE_URL = "https://acn8dzidreuv.feishu.cn/base/Q4UNbUmY1acU9rsiYaAcobZwnte?from=from_copylink";
const strategyPagePermissionMap: Record<StrategyPageKey, BrandPermissionKey> = {
  background: "brandGrowth.library.background",
  ipLibrary: "brandGrowth.library.ipLibrary",
  products: "brandGrowth.library.products",
  survey: "brandGrowth.library.survey",
  platformAccounts: "brandGrowth.collection.xiaohongshuCollection",
  competitorAccounts: "brandGrowth.collection.xiaohongshuCollection",
  industryFeeds: "brandGrowth.library.industryFeeds",
  businessAssets: "brandGrowth.library.businessAssets",
  feishuCollection: "brandGrowth.collection.xiaohongshuCollection",
  xiaohongshuCollection: "brandGrowth.collection.xiaohongshuCollection",
  douyinCollection: "brandGrowth.collection.douyinCollection",
  wechatMpCollection: "brandGrowth.collection.wechatMpCollection",
  dailyHotspot: "brandGrowth.collection.dailyHotspot",
  opportunityInsight: "brandGrowth.report.opportunityInsight",
  growthReport: "brandGrowth.report.growthReport",
  visualGrowthReport: "brandGrowth.report.visualGrowthReport",
  annualMarketingPlan: "brandGrowth.report.halfYearMarketingPlan",
  xiaohongshuMarketingCalendar: "xiaohongshu.calendar",
  openclawExplosiveAnalysis: "brandGrowth.report.topicLibrary",
  reportTopicLibrary: "brandGrowth.report.topicLibrary",
  reportMaterialLibrary: "brandGrowth.report.topicLibrary",
  openclawDailyPlan: "brandGrowth.report.topicLibrary",
  openclawLobsterDiary: "brandGrowth.report.topicLibrary",
};

function cloneSeed(): BrandArchiveBundle {
  return JSON.parse(JSON.stringify(brandArchiveSeed)) as BrandArchiveBundle;
}

function getDefaultHotspotDate() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyArchiveBundle(): BrandArchiveBundle {
  const seed = cloneSeed();
  return normalizeBrandArchiveBundle({
    ...seed,
    brand: {
      ...seed.brand,
      brandName: "",
      industry: "",
      storeCount: 0,
      foundedYear: new Date().getFullYear(),
      brandDescription: "",
      enterpriseIntro: "",
    },
    ipProfile: {
      ...seed.ipProfile,
      ipName: "",
      imageUrls: [],
      voiceUrl: "",
      voiceFileName: "",
      voiceDurationSec: 0,
      ipPositioning: "",
      ipStory: "",
      ipValues: "",
      ipStyle: "",
      douyinAccountLink: "",
      xiaohongshuAccountLink: "",
    },
    products: [],
    survey: seed.survey.map((item) => ({
      ...item,
      value: "",
    })),
    platformAccounts: [],
    competitorAccounts: [],
    industryFeeds: [],
    businessAssets: [],
    steps: seed.steps.map((step) => ({
      ...step,
      status: "pending",
    })),
  });
}

function createEmptyCollectionWorkspace(): XhsCollectionWorkspace {
  return {
    brandAccounts: [],
    competitorAccounts: [],
    brandNotes: [],
    benchmarkNotes: [],
    searchNotes: [],
    commentData: [],
    targetUsers: [],
  };
}

function createEmptyDouyinCollectionWorkspace(): DouyinCollectionWorkspace {
  return {
    brandAccounts: [],
    competitorAccounts: [],
    brandWorks: [],
    competitorWorks: [],
    benchmarkWorks: [],
    searchWorks: [],
    keywordRecommendations: [],
    commentData: [],
    targetUsers: [],
    lowFanExplosiveWorks: [],
    highCompletionRateWorks: [],
    highLikeRateWorks: [],
    cityHotspots: [],
    creatorSearchResults: [],
    creatorProfiles: [],
    creatorDeepFetchTasks: [],
    contentTags: [],
    cityOptions: [],
    creatorSearchFieldOptions: {
      searchTypes: [],
      timeRangeDays: [],
      sortFields: [],
      sortTypes: [],
      firstIndustries: [],
      marketingTargets: [],
      taskCategories: [],
      tags: [],
    },
  };
}

function createEmptyDailyHotspotWorkspace(): DailyHotspotWorkspace {
  const today = getDefaultHotspotDate();
  return {
    selectedDate: today,
    availableDates: [today],
    platforms: [],
  };
}

function createEmptyGrowthReportWorkspace(): GrowthReportWorkspace {
  return {
    latest: undefined,
    history: [],
    latestTask: undefined,
  };
}

function createEmptyVisualGrowthReportWorkspace(): VisualGrowthReportWorkspace {
  return {
    latest: undefined,
    history: [],
    latestTask: undefined,
  };
}

function createEmptyOpportunityInsightWorkspace(): OpportunityInsightWorkspace {
  return {
    ...opportunityInsightSeed,
    history: [],
  };
}

function createEmptyAnnualMarketingPlanWorkspace(): AnnualMarketingPlanWorkspace {
  return {
    latest: undefined,
    history: [],
  };
}

function createEmptyOpenClawLobsterDiaryWorkspace(): OpenClawLobsterDiaryWorkspaceRecord {
  return {
    items: [],
    total: 0,
  };
}

function createEmptyOpenClawExplosiveAnalysisWorkspace(): OpenClawExplosiveAnalysisWorkspaceRecord {
  return {
    items: [],
    total: 0,
  };
}

function createEmptyOpenClawDailyPlanWorkspace(): OpenClawDailyPlanWorkspaceRecord {
  return {
    items: [],
    total: 0,
  };
}

function emptyProduct(): BrandProduct {
  return {
    id: `prd_local_${Math.random().toString(36).slice(2, 9)}`,
    productName: "",
    productType: "",
    price: 0,
    productPositioning: "",
    targetAudience: "",
    painPoint: "",
    usageScenario: "",
    differentiators: "",
    marketPosition: "",
    detailDescription: "",
    imageUrl: "",
    imageUrls: [],
  };
}

function emptyAsset(overrides: Partial<BrandAsset> = {}): BrandAsset {
  return {
    id: `ast_local_${Math.random().toString(36).slice(2, 9)}`,
    title: "",
    description: "",
    sourceName: "",
    fileUrl: "",
    ...overrides,
  };
}

function inferAssetTitleFromFileUrl(fileUrl: string) {
  const normalized = String(fileUrl || "").trim();
  if (!normalized) {
    return "";
  }

  try {
    const fileName = decodeURIComponent(normalized.split("?")[0] || "")
      .split("/")
      .filter(Boolean)
      .pop();
    if (!fileName) {
      return normalized;
    }
    return fileName.replace(/\.[^.]+$/, "").trim() || fileName;
  } catch {
    return normalized;
  }
}

function parseOptionalNumericValue(value: string | number | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const normalized = String(value || "").trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildAssetFromDraft(draft: LibraryAssetModalDraft, fileUrl: string, current?: BrandAsset): BrandAsset {
  return {
    ...current,
    title: draft.title.trim() || inferAssetTitleFromFileUrl(fileUrl),
    description: draft.description.trim(),
    sourceName: draft.sourceName.trim() || (draft.file ? "本地文档" : current?.sourceName || ""),
    fileUrl,
    knowledgeBaseId: draft.knowledgeBaseId.trim() || undefined,
    knowledgeBaseName: draft.knowledgeBaseName.trim() || undefined,
    knowledgeBaseSlug: draft.knowledgeBaseSlug.trim() || undefined,
    bindingType: draft.targetId.trim() ? draft.bindingType : undefined,
    targetId: draft.targetId.trim() || undefined,
    targetKey: draft.targetKey.trim() || undefined,
    targetName: draft.targetName.trim() || undefined,
    priority: Number.isFinite(draft.priority) ? draft.priority : undefined,
    retrievalMode: draft.retrievalMode,
    isRequired: draft.isRequired,
    enabled: draft.enabled,
    defaultTopK: Number.isFinite(draft.defaultTopK) ? draft.defaultTopK : undefined,
    recallMode: draft.recallMode,
    rerankEnabled: draft.rerankEnabled,
    retrievalThreshold: parseOptionalNumericValue(draft.retrievalThreshold),
  };
}

function buildBrandAssetPayload(item: BrandAsset) {
  return {
    id: item.id?.includes("_local_") ? undefined : item.id,
    title: item.title,
    description: item.description,
    sourceName: item.sourceName,
    fileUrl: item.fileUrl,
    knowledgeBaseId: item.knowledgeBaseId,
    knowledgeBaseName: item.knowledgeBaseName,
    knowledgeBaseSlug: item.knowledgeBaseSlug,
    bindingType: item.bindingType,
    targetId: item.targetId,
    targetKey: item.targetKey,
    targetName: item.targetName,
    priority: item.priority,
    retrievalMode: item.retrievalMode,
    isRequired: item.isRequired,
    enabled: item.enabled,
    defaultTopK: item.defaultTopK,
    recallMode: item.recallMode,
    rerankEnabled: item.rerankEnabled,
    retrievalThreshold: item.retrievalThreshold,
  };
}

function createEmptyFeishuBindingForm() {
  return {
    wikiUrl: "",
  };
}

function createEmptyFeishuAppConfigForm() {
  return {
    appId: "",
    appSecret: "",
    redirectUri: "",
    scope: "",
  };
}

function createFeishuAppConfigFormFromRecord(config: FeishuAppConfigRecord | null) {
  if (!config) {
    return createEmptyFeishuAppConfigForm();
  }

  return {
    appId: config.appId,
    appSecret: "",
    redirectUri: config.redirectUri,
    scope: config.scope,
  };
}

function createFeishuBindingFormFromRecord(binding: FeishuBindingRecord | null) {
  if (!binding) {
    return createEmptyFeishuBindingForm();
  }

  return {
    wikiUrl: binding.wikiUrl,
  };
}

function getCompletion(bundle: BrandArchiveBundle) {
  const visibleSteps = bundle.steps.filter((step) => stepOrder.includes(step.key as BrandArchiveStepKey));
  const done = visibleSteps.filter((step) => step.status === "ready").length;
  return {
    done,
    total: visibleSteps.length,
    percentage: Math.round((done / Math.max(1, visibleSteps.length)) * 100),
  };
}

function isBrandArchiveStep(key: StrategyPageKey): key is BrandArchiveStepKey {
  return stepOrder.includes(key as BrandArchiveStepKey);
}

function isLibraryPageKey(key?: BrandArchiveStepKey): key is BrandGrowthLibraryPageKey {
  return key === "background" || key === "ipLibrary" || key === "products" || key === "survey" || key === "industryFeeds" || key === "businessAssets";
}

function getLoadScopeByPage(key: StrategyPageKey): BrandGrowthLoadScope {
  if (isBrandArchiveStep(key)) {
    return "library";
  }
  if (key === "feishuCollection" || key === "xiaohongshuCollection" || key === "douyinCollection" || key === "wechatMpCollection" || key === "dailyHotspot") {
    return "collection";
  }
  return "report";
}

type ReportScopeSnapshot = {
  expiresAt: number;
  collectionWorkspace: XhsCollectionWorkspace;
  reportWorkspace: GrowthReportWorkspace;
  opportunityInsightWorkspace: OpportunityInsightWorkspace;
  visualReportWorkspace: VisualGrowthReportWorkspace;
  annualMarketingPlanWorkspace: AnnualMarketingPlanWorkspace;
  xiaohongshuMarketingPlanWorkspace: XiaohongshuMarketingPlanWorkspace;
  marketingCalendarWorkspace: XiaohongshuMarketingCalendarWorkspace;
  douyinTopicLibraryWorkspace: DouyinHotTopicCandidatesWorkspace;
  openClawExplosiveAnalysisWorkspace: OpenClawExplosiveAnalysisWorkspaceRecord;
  openClawLobsterDiaryWorkspace: OpenClawLobsterDiaryWorkspaceRecord;
  openClawDailyPlanWorkspace: OpenClawDailyPlanWorkspaceRecord;
};

function buildReportScopeSnapshotKey(brandId: string) {
  return `brand-growth:report-scope:${brandId}`;
}

function readReportScopeSnapshot(brandId: string) {
  if (typeof window === "undefined") {
    return undefined;
  }

  const storageKey = buildReportScopeSnapshotKey(brandId);

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as ReportScopeSnapshot;
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(storageKey);
      return undefined;
    }

    return parsed;
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return undefined;
  }
}

function writeReportScopeSnapshot(brandId: string, snapshot: Omit<ReportScopeSnapshot, "expiresAt">) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      buildReportScopeSnapshotKey(brandId),
      JSON.stringify({
        ...snapshot,
        expiresAt: Date.now() + REPORT_SCOPE_SNAPSHOT_TTL_MS,
      } satisfies ReportScopeSnapshot),
    );
  } catch {
    // Ignore storage failures and keep runtime state only.
  }
}

type DouyinSyncForm = {
  brandAccountEntries: XhsAccountBindingEntry[];
  competitorAccountEntries: XhsAccountBindingEntry[];
  benchmarkAwemeIds: string;
  searchKeyword: string;
  searchSortType: string;
  searchPublishTime: string;
  searchFilterDuration: string;
  searchContentType: string;
  commentSourceUrls: string;
  targetUserMatchKeywords: string;
  keywordRecommendationEntries: Array<{
    id: string;
    keyword: string;
  }>;
  lowFanExplosiveWorks: {
    primaryTagId: string;
    secondaryTagId: string;
  };
  highCompletionRateWorks: {
    primaryTagId: string;
    secondaryTagId: string;
  };
  highLikeRateWorks: {
    primaryTagId: string;
    secondaryTagId: string;
  };
  cityHotspots: {
    cityCode: string;
  };
  creatorSearch: {
    keyword: string;
    seachType: string;
    timeRangeDays: string;
    sortField: string;
    sortType: string;
    firstIndustryId: string;
    marketingTarget: string;
    taskCategory: string;
    tag: string;
    fansMin: string;
    fansMax: string;
    expectedPlayMin: string;
    expectedPlayMax: string;
    interactRateMin: string;
    interactRateMax: string;
    priceMin: string;
    priceMax: string;
  };
  creatorDeepFetch: {
    identifiers: string;
    identityType: DouyinCreatorIdentityType;
    linkType: string;
    homepageVideoPageLimit: string;
  };
};

type XhsSyncForm = {
  brandAccountEntries: XhsAccountBindingEntry[];
  competitorAccountEntries: XhsAccountBindingEntry[];
  brandWorkLocators: string;
  benchmarkNoteLocators: string;
  searchKeyword: string;
  commentSourceUrls: string;
  targetUserMatchKeywords: string;
};

function createEmptyXhsSyncForm(): XhsSyncForm {
  return {
    brandAccountEntries: [],
    competitorAccountEntries: [],
    brandWorkLocators: "",
    benchmarkNoteLocators: "",
    searchKeyword: "",
    commentSourceUrls: "",
    targetUserMatchKeywords: "",
  };
}

function createEmptyDouyinSyncForm(): DouyinSyncForm {
  return {
    brandAccountEntries: [],
    competitorAccountEntries: [],
    benchmarkAwemeIds: "",
    searchKeyword: "",
    searchSortType: "0",
    searchPublishTime: "0",
    searchFilterDuration: "0",
    searchContentType: "0",
    commentSourceUrls: "",
    targetUserMatchKeywords: "",
    keywordRecommendationEntries: [],
    lowFanExplosiveWorks: {
      primaryTagId: "",
      secondaryTagId: "",
    },
    highCompletionRateWorks: {
      primaryTagId: "",
      secondaryTagId: "",
    },
    highLikeRateWorks: {
      primaryTagId: "",
      secondaryTagId: "",
    },
    cityHotspots: {
      cityCode: "",
    },
    creatorSearch: {
      keyword: "",
      seachType: "2",
      timeRangeDays: "180",
      sortField: "score",
      sortType: "2",
      firstIndustryId: "",
      marketingTarget: "",
      taskCategory: "",
      tag: "",
      fansMin: "",
      fansMax: "",
      expectedPlayMin: "",
      expectedPlayMax: "",
      interactRateMin: "",
      interactRateMax: "",
      priceMin: "",
      priceMax: "",
    },
    creatorDeepFetch: {
      identifiers: "",
      identityType: "AUTO",
      linkType: "",
      homepageVideoPageLimit: "1",
    },
  };
}

function parseDouyinSyncLines(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function parseOptionalNumericTagId(value: string) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined;
}

function normalizeXhsAccountEntryLocator(locator: string) {
  const trimmed = locator.trim();
  if (!trimmed) {
    return "";
  }
  const extractDouyinLocatorKey = (value: string) => {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return "";
    }
    if (/^MS4w/i.test(normalizedValue)) {
      return `douyin_user:${normalizedValue.toLowerCase()}`;
    }
    try {
      const parsed = new URL(normalizedValue);
      const pathMatch = parsed.pathname.match(/\/(?:share\/)?user\/([^/?#]+)/i);
      const identifier =
        pathMatch?.[1]
        || parsed.searchParams.get("sec_user_id")
        || parsed.searchParams.get("sec_uid")
        || parsed.searchParams.get("sec_id");
      return identifier ? `douyin_user:${decodeURIComponent(identifier).toLowerCase()}` : "";
    } catch {
      const rawMatch = normalizedValue.match(/\/(?:share\/)?user\/([^/?#]+)/i);
      return rawMatch?.[1] ? `douyin_user:${decodeURIComponent(rawMatch[1]).toLowerCase()}` : "";
    }
  };
  const douyinLocatorKey = extractDouyinLocatorKey(trimmed);
  if (douyinLocatorKey) {
    return douyinLocatorKey;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
      .replace(/[#?].*$/, "")
      .replace(/\/+$/, "")
      .toLowerCase();
  }
  return trimmed.toLowerCase();
}

function buildXhsAccountEntryId(locator: string, target: "brand" | "competitor") {
  const compact = normalizeXhsAccountEntryLocator(locator)
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `xhs_${target}_account_${compact || "entry"}`;
}

function normalizeXhsAccountRole(role?: XhsAccountRole): XhsAccountRole {
  if (role === "STAFF" || role === "TALENT") {
    return role;
  }
  return "BRAND";
}

function getXhsAccountRoleLabel(role?: XhsAccountRole) {
  if (role === "STAFF") {
    return "员工号";
  }
  if (role === "TALENT") {
    return "达人号";
  }
  return "品牌号";
}

function upsertXhsAccountEntries(
  entries: XhsAccountBindingEntry[],
  nextEntry: XhsAccountBindingEntry,
  target: "brand" | "competitor",
) {
  const normalizedLocator = normalizeXhsAccountEntryLocator(nextEntry.locator);
  if (!normalizedLocator) {
    return entries;
  }
  const preparedEntry: XhsAccountBindingEntry = {
    ...nextEntry,
    id: nextEntry.id || buildXhsAccountEntryId(normalizedLocator, target),
    locator: nextEntry.locator.trim(),
    accountRole: nextEntry.accountRole ? normalizeXhsAccountRole(nextEntry.accountRole) : undefined,
  };
  const matchedIndex = entries.findIndex((item) => normalizeXhsAccountEntryLocator(item.locator) === normalizedLocator);
  if (matchedIndex < 0) {
    return [...entries, preparedEntry];
  }
  return entries.map((item, index) => {
    if (index !== matchedIndex) {
      return item;
    }
    const mergedEntry: XhsAccountBindingEntry = {
      ...item,
      ...preparedEntry,
    };
    if (preparedEntry.accountRole === undefined && item.accountRole !== undefined) {
      mergedEntry.accountRole = item.accountRole;
    }
    return mergedEntry;
  });
}

function createXhsAccountEntryFromRecord(
  record:
    | XhsCollectionWorkspace["brandAccounts"][number]
    | XhsCollectionWorkspace["competitorAccounts"][number]
    | DouyinCollectedAccountRecord,
  target: "brand" | "competitor",
): XhsAccountBindingEntry {
  const locator =
    "accountLink" in record
      ? record.accountLink || record.sourceAccountLink || record.username || record.externalUserId || record.sourceAccountId
      : record.sourceAccountLink || record.externalUserId || record.sourceAccountId;
  const accountRole = "accountRole" in record ? record.accountRole : undefined;
  return {
    id: buildXhsAccountEntryId(locator, target),
    locator,
    accountRole: target === "brand" && accountRole ? normalizeXhsAccountRole(accountRole) : undefined,
  };
}

function mergeXhsAccountEntries(
  currentEntries: XhsAccountBindingEntry[],
  incomingEntries: XhsAccountBindingEntry[],
  target: "brand" | "competitor",
) {
  return incomingEntries.reduce((result, item) => {
    const normalizedLocator = normalizeXhsAccountEntryLocator(item.locator);
    if (!normalizedLocator) {
      return result;
    }
    const matchedIndex = result.findIndex((entry) => normalizeXhsAccountEntryLocator(entry.locator) === normalizedLocator);
    if (matchedIndex < 0) {
      return upsertXhsAccountEntries(result, item, target);
    }
    return result.map((entry, index) => {
      if (index !== matchedIndex) {
        return entry;
      }
      const incomingRole = item.accountRole ? normalizeXhsAccountRole(item.accountRole) : undefined;
      const currentRole = entry.accountRole ? normalizeXhsAccountRole(entry.accountRole) : undefined;
      const shouldKeepCurrentRole =
        target === "brand"
        && (currentRole === "STAFF" || currentRole === "TALENT")
        && incomingRole === "BRAND";
      return {
        ...entry,
        ...item,
        accountRole:
          shouldKeepCurrentRole
            ? currentRole
            : incomingRole ?? currentRole,
      };
    });
  }, [...currentEntries]);
}

function areXhsAccountEntriesEqual(left: XhsAccountBindingEntry[], right: XhsAccountBindingEntry[]) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) =>
    item.id === right[index]?.id
    && item.locator === right[index]?.locator
    && item.accountRole === right[index]?.accountRole,
  );
}

function buildXhsSyncAccountEntries(entries: XhsAccountBindingEntry[]): XhsSyncAccountEntry[] {
  return entries
    .map((entry) => {
      const normalizedRole = entry.accountRole ? normalizeXhsAccountRole(entry.accountRole) : undefined;
      return {
        locator: entry.locator.trim(),
        ...(normalizedRole ? { accountRole: normalizedRole } : {}),
      };
    })
    .filter((entry) => Boolean(entry.locator));
}

function buildDouyinAccountMatchTokens(locator: string) {
  const normalized = String(locator || "").trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const tokens = new Set<string>();
  const pushToken = (value?: string) => {
    const trimmed = String(value || "").trim().toLowerCase();
    if (trimmed) {
      tokens.add(trimmed);
    }
  };

  pushToken(normalized);
  pushToken(normalized.replace(/^@/, ""));

  try {
    const parsed = new URL(normalized.startsWith("http") ? normalized : `https://${normalized.replace(/^\/+/, "")}`);
    pushToken(parsed.pathname);
    pushToken(parsed.pathname.replace(/^\/+/, ""));
    pushToken(parsed.searchParams.get("sec_uid") || "");
    pushToken(parsed.searchParams.get("sec_user_id") || "");
    pushToken(parsed.searchParams.get("user_id") || "");
    pushToken(parsed.searchParams.get("uid") || "");
  } catch {
    // Ignore non-URL locators and keep the raw normalized token.
  }

  const pathUserMatch = normalized.match(/\/user\/([^/?#]+)/i);
  if (pathUserMatch) {
    pushToken(pathUserMatch[1]);
  }

  return [...tokens].filter(Boolean);
}

function doesDouyinAccountMatchEntryForWorkspace(account: DouyinCollectedAccountRecord, entry: XhsAccountBindingEntry) {
  const entryTokens = buildDouyinAccountMatchTokens(entry.locator);
  if (!entryTokens.length) {
    return false;
  }

  const accountTokens = new Set<string>();
  [
    account.sourceAccountLink,
    account.accountLink,
    account.externalUserId,
    account.username,
    account.sourceAccountId,
    account.shortId,
  ]
    .flatMap((value) => buildDouyinAccountMatchTokens(String(value || "")))
    .forEach((token) => accountTokens.add(token));

  return entryTokens.some((token) => accountTokens.has(token));
}

function dedupeXhsSubComments(items: XhsSubCommentRecord[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.commentId || item.id;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function BrandGrowthWorkspace() {
  const [archive, setArchive] = useState<BrandArchiveBundle>(createEmptyArchiveBundle);
  const [collectionWorkspace, setCollectionWorkspace] = useState<XhsCollectionWorkspace>(createEmptyCollectionWorkspace);
  const [douyinCollectionWorkspace, setDouyinCollectionWorkspace] = useState<DouyinCollectionWorkspace>(createEmptyDouyinCollectionWorkspace);
  const [wechatMpCollectionWorkspace, setWechatMpCollectionWorkspace] = useState<WechatMpCollectionWorkspace>(wechatMpCollectionSeed);
  const [wechatMpBenchmarkWorkspace, setWechatMpBenchmarkWorkspace] = useState<WechatMpBenchmarkWorkspace>(wechatMpBenchmarkSeed);
  const [wechatSearchWorkspace, setWechatSearchWorkspace] = useState<WechatSearchWorkspace>(wechatSearchSeed);
  const [dailyHotspotWorkspace, setDailyHotspotWorkspace] = useState<DailyHotspotWorkspace>(createEmptyDailyHotspotWorkspace);
  const [reportWorkspace, setReportWorkspace] = useState<GrowthReportWorkspace>(createEmptyGrowthReportWorkspace);
  const [opportunityInsightWorkspace, setOpportunityInsightWorkspace] = useState<OpportunityInsightWorkspace>(createEmptyOpportunityInsightWorkspace);
  const [visualReportWorkspace, setVisualReportWorkspace] = useState<VisualGrowthReportWorkspace>(createEmptyVisualGrowthReportWorkspace);
  const [annualMarketingPlanWorkspace, setAnnualMarketingPlanWorkspace] = useState<AnnualMarketingPlanWorkspace>(createEmptyAnnualMarketingPlanWorkspace);
  const [xiaohongshuMarketingPlanWorkspace, setXiaohongshuMarketingPlanWorkspace] =
    useState<XiaohongshuMarketingPlanWorkspace>(xiaohongshuMarketingPlanSeed);
  const [marketingCalendarWorkspace, setMarketingCalendarWorkspace] = useState<XiaohongshuMarketingCalendarWorkspace>({ history: [] });
  const [douyinTopicLibraryWorkspace, setDouyinTopicLibraryWorkspace] =
    useState<DouyinHotTopicCandidatesWorkspace>(douyinHotTopicCandidatesSeed);
  const [openClawExplosiveAnalysisWorkspace, setOpenClawExplosiveAnalysisWorkspace] =
    useState<OpenClawExplosiveAnalysisWorkspaceRecord>(createEmptyOpenClawExplosiveAnalysisWorkspace);
  const [openClawLobsterDiaryWorkspace, setOpenClawLobsterDiaryWorkspace] =
    useState<OpenClawLobsterDiaryWorkspaceRecord>(createEmptyOpenClawLobsterDiaryWorkspace);
  const [openClawDailyPlanWorkspace, setOpenClawDailyPlanWorkspace] =
    useState<OpenClawDailyPlanWorkspaceRecord>(createEmptyOpenClawDailyPlanWorkspace);
  const [feishuBinding, setFeishuBinding] = useState<FeishuBindingRecord | null>(null);
  const [feishuAppConfig, setFeishuAppConfig] = useState<FeishuAppConfigRecord | null>(null);
  const [feishuAuthStatus, setFeishuAuthStatus] = useState<FeishuAuthStatusRecord | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(null);
  const [activeBrandId, setActiveBrandId] = useState<string>(DEMO_BRAND_ID);
  const [currentBrandRole, setCurrentBrandRole] = useState("");
  const [brandPermissionSettings, setBrandPermissionSettings] = useState<BrandPermissionSettingsRecord | null>(null);
  const [hasOwnerAccess, setHasOwnerAccess] = useState(true);
  const [feishuBindingForm, setFeishuBindingForm] = useState(createEmptyFeishuBindingForm);
  const [feishuAppConfigForm, setFeishuAppConfigForm] = useState(createEmptyFeishuAppConfigForm);
  const [xhsSyncForm, setXhsSyncForm] = useState<XhsSyncForm>(createEmptyXhsSyncForm);
  const [douyinSyncForm, setDouyinSyncForm] = useState<DouyinSyncForm>(createEmptyDouyinSyncForm);
  const [xhsCommentPagination, setXhsCommentPagination] = useState<XhsCommentPaginationState[]>([]);
  const [douyinCommentPagination, setDouyinCommentPagination] = useState<DouyinCommentPaginationState[]>([]);
  const [brandNotesPage, setBrandNotesPage] = useState(1);
  const [brandNotesPageSize, setBrandNotesPageSize] = useState(10);
  const [hotspotPage, setHotspotPage] = useState(1);
  const [hotspotPageSize, setHotspotPageSize] = useState(10);
  const [activeSection, setActiveSection] = useState<StrategySectionKey>("library");
  const [activePage, setActivePage] = useState<StrategyPageKey>("background");
  const [expandedSections, setExpandedSections] = useState<Record<StrategySectionKey, boolean>>({
    library: true,
    collection: false,
    report: false,
    openclaw: false,
  });
  const [activeXhsCollectionCard, setActiveXhsCollectionCard] = useState<XiaohongshuCollectionCardKey>("brandAccount");
  const [activeDouyinCollectionCard, setActiveDouyinCollectionCard] = useState<DouyinCollectionCardKey>("brandAccount");
  const [selectedHotspotDate, setSelectedHotspotDate] = useState(getDefaultHotspotDate);
  const [selectedDouyinTopicDate, setSelectedDouyinTopicDate] = useState("");
  const [selectedDouyinTopicIds, setSelectedDouyinTopicIds] = useState<string[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingFeishuAppConfig, setIsSavingFeishuAppConfig] = useState(false);
  const [isSavingFeishuBinding, setIsSavingFeishuBinding] = useState(false);
  const [isSyncingFeishuWorkspace, setIsSyncingFeishuWorkspace] = useState(false);
  const [isSyncingXhsWorkspace, setIsSyncingXhsWorkspace] = useState(false);
  const [isSyncingDouyinWorkspace, setIsSyncingDouyinWorkspace] = useState(false);
  const [isLoadingMoreXhsComments, setIsLoadingMoreXhsComments] = useState(false);
  const [isLoadingMoreDouyinComments, setIsLoadingMoreDouyinComments] = useState(false);
  const [expandedXhsCommentIds, setExpandedXhsCommentIds] = useState<string[]>([]);
  const [loadingXhsSubCommentIds, setLoadingXhsSubCommentIds] = useState<string[]>([]);
  const [loadingMoreXhsSubCommentIds, setLoadingMoreXhsSubCommentIds] = useState<string[]>([]);
  const [xhsSubCommentsByParent, setXhsSubCommentsByParent] = useState<Record<string, XhsSubCommentRecord[]>>({});
  const [xhsSubCommentPaginationMap, setXhsSubCommentPaginationMap] = useState<Record<string, XhsSubCommentPaginationState>>({});
  const [isSyncingDailyHotspots, setIsSyncingDailyHotspots] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [deletingOpenClawLobsterDiaryId, setDeletingOpenClawLobsterDiaryId] = useState("");
  const [updatingOpenClawLobsterDiaryId, setUpdatingOpenClawLobsterDiaryId] = useState("");
  const [deletingOpenClawDailyPlanId, setDeletingOpenClawDailyPlanId] = useState("");
  const [isGeneratingOpportunityInsight, setIsGeneratingOpportunityInsight] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isGeneratingVisualReport, setIsGeneratingVisualReport] = useState(false);
  const [isGeneratingAnnualMarketingPlan, setIsGeneratingAnnualMarketingPlan] = useState(false);
  const [isGeneratingMarketingCalendar, setIsGeneratingMarketingCalendar] = useState(false);
  const [isGeneratingDouyinTopicCandidates, setIsGeneratingDouyinTopicCandidates] = useState(false);
  const [isSavingDouyinTopicLibrary, setIsSavingDouyinTopicLibrary] = useState(false);
  const [deletingOpenClawExplosiveAnalysisId, setDeletingOpenClawExplosiveAnalysisId] = useState("");
  const [selectedCalendarItemId, setSelectedCalendarItemId] = useState("");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [isCalendarDetailOpen, setIsCalendarDetailOpen] = useState(false);
  const [isEditingCalendarItem, setIsEditingCalendarItem] = useState(false);
  const [isSavingCalendarItem, setIsSavingCalendarItem] = useState(false);
  const [calendarItemDraft, setCalendarItemDraft] = useState<XiaohongshuMarketingCalendarItem | null>(null);
  const [uploadingProductId, setUploadingProductId] = useState("");
  const [uploadingIpImages, setUploadingIpImages] = useState(false);
  const [uploadingIpVoice, setUploadingIpVoice] = useState(false);
  const [addingMaterialAssetId, setAddingMaterialAssetId] = useState("");
  const [extractingDouyinTranscriptAssetId, setExtractingDouyinTranscriptAssetId] = useState("");
  const [deletingDouyinAccountId, setDeletingDouyinAccountId] = useState("");
  const [deletingDouyinKeywordRecommendationId, setDeletingDouyinKeywordRecommendationId] = useState("");
  const [notice, setNotice] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [reportMarkdownDraft, setReportMarkdownDraft] = useState("");
  const [opportunityInsightStepOneInput, setOpportunityInsightStepOneInput] = useState("");
  const [opportunityInsightStepTwoInput, setOpportunityInsightStepTwoInput] = useState("");
  const [opportunityInsightStepThreeInput, setOpportunityInsightStepThreeInput] = useState("");
  const [opportunityInsightStepModal, setOpportunityInsightStepModal] = useState<OpportunityInsightStepModalState | null>(null);
  const [reportGenerationModal, setReportGenerationModal] = useState<ReportGenerationModalKind | null>(null);
  const [annualMarketingPlanUserRequirement, setAnnualMarketingPlanUserRequirement] = useState("");
  const [marketingCalendarUserRequirement, setMarketingCalendarUserRequirement] = useState("");
  const [dataSource, setDataSource] = useState<"api" | "error" | "loading">("loading");
  const [removedProductIds, setRemovedProductIds] = useState<string[]>([]);
  const [mediaPreview, setMediaPreview] = useState<MediaPreviewState | null>(null);
  const previewUrls = mediaPreview?.galleryUrls?.filter(Boolean).length ? mediaPreview.galleryUrls.filter(Boolean) : mediaPreview ? [mediaPreview.url] : [];
  const previewIndex = mediaPreview ? Math.min(Math.max(mediaPreview.activeIndex ?? 0, 0), Math.max(previewUrls.length - 1, 0)) : 0;
  const previewUrl = previewUrls[previewIndex] || mediaPreview?.url || "";
  const previewType = mediaPreview?.type ?? "IMAGE";
  const previewTitle = mediaPreview
    ? previewUrls.length > 1
      ? `${mediaPreview.title} (${previewIndex + 1}/${previewUrls.length})`
      : mediaPreview.title
    : "";
  const previewDownloadUrl = mediaPreview?.downloadUrl || previewUrl;
  const previewProtectedUrl = isProtectedMediaSource(previewUrl) ? previewUrl : "";
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState("");
  const [resolvedPreviewFileName, setResolvedPreviewFileName] = useState("");
  const [previewLoadError, setPreviewLoadError] = useState("");
  useEffect(() => {
    if (!mediaPreview || !previewUrl) {
      setResolvedPreviewUrl("");
      setResolvedPreviewFileName("");
      setPreviewLoadError("");
      return;
    }
    if (!previewProtectedUrl) {
      setResolvedPreviewUrl(previewUrl);
      setResolvedPreviewFileName(mediaPreview.downloadName || buildMediaFileNameFromUrl(previewDownloadUrl));
      setPreviewLoadError("");
      return;
    }

    let active = true;
    let currentObjectUrl = "";
    setResolvedPreviewUrl("");
    setResolvedPreviewFileName("");
    setPreviewLoadError("");

    void requestBlobByUrl(previewProtectedUrl)
      .then(({ blob, fileName }) => {
        if (!active) {
          return;
        }
        currentObjectUrl = URL.createObjectURL(blob);
        setResolvedPreviewUrl(currentObjectUrl);
        setResolvedPreviewFileName(fileName);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setResolvedPreviewUrl("");
        setResolvedPreviewFileName("");
        setPreviewLoadError(error instanceof Error ? error.message : "附件加载失败");
      });

    return () => {
      active = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [mediaPreview, previewDownloadUrl, previewProtectedUrl, previewUrl]);
  const previewDisplayUrl = resolvedPreviewUrl || (!previewProtectedUrl ? previewUrl : "");
  const previewDisplayDownloadUrl = resolvedPreviewUrl || previewDownloadUrl;
  const [loadedScopes, setLoadedScopes] = useState<Record<BrandGrowthLoadScope, boolean>>({
    library: false,
    collection: false,
    report: false,
  });

  useEffect(() => {
    if (!mediaPreview) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMediaPreview(null);
        return;
      }
      if (previewUrls.length <= 1) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setMediaPreview((current) =>
          current
            ? {
                ...current,
                activeIndex: previewIndex > 0 ? previewIndex - 1 : previewUrls.length - 1,
              }
            : current,
        );
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setMediaPreview((current) =>
          current
            ? {
                ...current,
                activeIndex: previewIndex < previewUrls.length - 1 ? previewIndex + 1 : 0,
              }
            : current,
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mediaPreview, previewIndex, previewUrls]);
  const completion = useMemo(() => getCompletion(archive), [archive]);
  const visibleStrategySections = useMemo(() => {
    const permissionMap = brandPermissionSettings?.currentUserPermissions;
    if (!permissionMap) {
      return strategySections;
    }
    return strategySections
      .map((section) => ({
        ...section,
        pages: section.pages.filter((page) => permissionMap[strategyPagePermissionMap[page.key]]?.view),
      }))
      .filter((section) => section.pages.length > 0);
  }, [brandPermissionSettings]);
  const currentSection = visibleStrategySections.find((item) => item.key === activeSection) ?? visibleStrategySections[0] ?? strategySections[0];
  const currentPage = currentSection.pages.find((item) => item.key === activePage) ?? currentSection.pages[0];
  const activeBrandPage = isBrandArchiveStep(activePage) ? activePage : undefined;
  const activeStepMeta = activeBrandPage ? archive.steps.find((step) => step.key === activeBrandPage) : undefined;
  const hotspotBoards = dailyHotspotWorkspace.platforms;
  const hotspotAvailableDates = dailyHotspotWorkspace.availableDates;
  const activeHotspotRecord = hotspotBoards[0];
  const sortedHotspotItems = useMemo(
    () => [...(activeHotspotRecord?.items ?? [])].sort((left, right) => left.rank - right.rank),
    [activeHotspotRecord?.items],
  );
  const hotspotPageCount = Math.max(1, Math.ceil(sortedHotspotItems.length / hotspotPageSize));
  const paginatedHotspotItems = useMemo(() => {
    const startIndex = (hotspotPage - 1) * hotspotPageSize;
    return sortedHotspotItems.slice(startIndex, startIndex + hotspotPageSize);
  }, [hotspotPage, hotspotPageSize, sortedHotspotItems]);
  const sortedBrandAccounts = useMemo(
    () => sortByCollectedAtDesc(collectionWorkspace.brandAccounts),
    [collectionWorkspace.brandAccounts],
  );
  const sortedCompetitorAccounts = useMemo(
    () => sortByCollectedAtDesc(collectionWorkspace.competitorAccounts),
    [collectionWorkspace.competitorAccounts],
  );
  const sortedBrandNotes = useMemo(
    () => sortByCollectedAtDesc(collectionWorkspace.brandNotes),
    [collectionWorkspace.brandNotes],
  );
  const unifiedMaterialLibraryItems = useMemo(
    () => buildUnifiedMaterialLibraryItems(
      collectionWorkspace,
      douyinCollectionWorkspace,
      wechatMpBenchmarkWorkspace,
      wechatSearchWorkspace,
    ),
    [collectionWorkspace, douyinCollectionWorkspace, wechatMpBenchmarkWorkspace, wechatSearchWorkspace],
  );
  const sortedBenchmarkNotes = useMemo(
    () => sortByCollectedAtDesc(collectionWorkspace.benchmarkNotes),
    [collectionWorkspace.benchmarkNotes],
  );
  const sortedSearchNotes = useMemo(
    () => sortByCollectedAtDesc(collectionWorkspace.searchNotes),
    [collectionWorkspace.searchNotes],
  );
  const sortedXhsCommentData = useMemo(
    () => sortByCollectedAtDesc(collectionWorkspace.commentData as XhsCommentRecord[]),
    [collectionWorkspace.commentData],
  );
  const sortedXhsTargetUsers = useMemo(
    () => sortByCollectedAtDesc(collectionWorkspace.targetUsers),
    [collectionWorkspace.targetUsers],
  );
  const sortedDouyinBrandAccounts = useMemo(
    () => sortByCollectedAtDesc(douyinCollectionWorkspace.brandAccounts),
    [douyinCollectionWorkspace.brandAccounts],
  );
  const sortedDouyinCompetitorAccounts = useMemo(
    () => sortByCollectedAtDesc(douyinCollectionWorkspace.competitorAccounts),
    [douyinCollectionWorkspace.competitorAccounts],
  );
  const sortedDouyinBrandWorks = useMemo(
    () => sortByCollectedAtDesc(douyinCollectionWorkspace.brandWorks),
    [douyinCollectionWorkspace.brandWorks],
  );
  const sortedDouyinCompetitorWorks = useMemo(
    () => sortByCollectedAtDesc(douyinCollectionWorkspace.competitorWorks),
    [douyinCollectionWorkspace.competitorWorks],
  );
  const sortedDouyinBenchmarkWorks = useMemo(
    () => sortByCollectedAtDesc(douyinCollectionWorkspace.benchmarkWorks),
    [douyinCollectionWorkspace.benchmarkWorks],
  );
  const hasPendingDouyinTranscript = useMemo(
    () =>
      [
        ...douyinCollectionWorkspace.brandWorks,
        ...douyinCollectionWorkspace.competitorWorks,
        ...douyinCollectionWorkspace.benchmarkWorks,
        ...douyinCollectionWorkspace.searchWorks,
        ...douyinCollectionWorkspace.lowFanExplosiveWorks,
        ...douyinCollectionWorkspace.highCompletionRateWorks,
        ...douyinCollectionWorkspace.highLikeRateWorks,
      ].some((item) => item.transcriptStatus === "PENDING"),
    [
      douyinCollectionWorkspace.benchmarkWorks,
      douyinCollectionWorkspace.brandWorks,
      douyinCollectionWorkspace.competitorWorks,
      douyinCollectionWorkspace.highCompletionRateWorks,
      douyinCollectionWorkspace.highLikeRateWorks,
      douyinCollectionWorkspace.lowFanExplosiveWorks,
      douyinCollectionWorkspace.searchWorks,
    ],
  );
  const sortedDouyinSearchWorks = useMemo(
    () => sortByCollectedAtDesc(douyinCollectionWorkspace.searchWorks),
    [douyinCollectionWorkspace.searchWorks],
  );
  const sortedDouyinCommentData = useMemo(
    () => sortByCollectedAtDesc(douyinCollectionWorkspace.commentData as DouyinCommentRecord[]),
    [douyinCollectionWorkspace.commentData],
  );
  const sortedDouyinTargetUsers = useMemo(
    () => sortByCollectedAtDesc(douyinCollectionWorkspace.targetUsers),
    [douyinCollectionWorkspace.targetUsers],
  );
  const sortedDouyinKeywordRecommendations = useMemo(
    () => sortByCollectedAtDesc(douyinCollectionWorkspace.keywordRecommendations),
    [douyinCollectionWorkspace.keywordRecommendations],
  );
  const sortedDouyinLowFanExplosiveWorks = useMemo(
    () => sortByCollectedAtDesc(douyinCollectionWorkspace.lowFanExplosiveWorks),
    [douyinCollectionWorkspace.lowFanExplosiveWorks],
  );
  const sortedDouyinHighCompletionRateWorks = useMemo(
    () => sortByCollectedAtDesc(douyinCollectionWorkspace.highCompletionRateWorks),
    [douyinCollectionWorkspace.highCompletionRateWorks],
  );
  const sortedDouyinHighLikeRateWorks = useMemo(
    () => sortByCollectedAtDesc(douyinCollectionWorkspace.highLikeRateWorks),
    [douyinCollectionWorkspace.highLikeRateWorks],
  );
  const sortedDouyinCityHotspots = useMemo(
    () => [...douyinCollectionWorkspace.cityHotspots].sort(
      (left, right) => left.rank - right.rank || Date.parse(right.collectedAt) - Date.parse(left.collectedAt),
    ),
    [douyinCollectionWorkspace.cityHotspots],
  );
  const sortedDouyinCreatorSearchResults = useMemo(
    () => sortByCollectedAtDesc(douyinCollectionWorkspace.creatorSearchResults as DouyinCreatorSearchRecord[]),
    [douyinCollectionWorkspace.creatorSearchResults],
  );
  const sortedDouyinCreatorProfiles = useMemo(
    () => [...douyinCollectionWorkspace.creatorProfiles].sort(
      (left, right) => Date.parse(right.lastFetchedAt || "") - Date.parse(left.lastFetchedAt || ""),
    ),
    [douyinCollectionWorkspace.creatorProfiles],
  );
  const sortedDouyinCreatorDeepFetchTasks = useMemo(
    () => [...douyinCollectionWorkspace.creatorDeepFetchTasks].sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    ),
    [douyinCollectionWorkspace.creatorDeepFetchTasks],
  );
  const hasPendingDouyinCreatorDeepFetchTask = useMemo(
    () => douyinCollectionWorkspace.creatorDeepFetchTasks.some((item) => ["PENDING", "QUEUED", "RUNNING"].includes(item.taskStatus)),
    [douyinCollectionWorkspace.creatorDeepFetchTasks],
  );

  useEffect(() => {
    if (activePage !== "douyinCollection" || (!hasPendingDouyinTranscript && !hasPendingDouyinCreatorDeepFetchTask)) {
      return;
    }
    const brandId = activeBrandId || archive.brand.id;
    if (!brandId) {
      return;
    }

    let disposed = false;
    let timer: number | undefined;
    let polling = false;
    const scheduleNext = () => {
      if (disposed) {
        return;
      }
      timer = window.setTimeout(() => {
        void pollWorkspace();
      }, 5000);
    };
    const pollWorkspace = async () => {
      if (disposed || polling) {
        return;
      }
      if (typeof document !== "undefined" && document.hidden) {
        scheduleNext();
        return;
      }
      polling = true;
      try {
        const workspace = await getDouyinCollectionWorkspace(brandId);
        if (!disposed) {
          setDouyinCollectionWorkspace(workspace);
        }
      } catch {
        // Ignore transient polling failures and keep current data visible.
      } finally {
        polling = false;
        scheduleNext();
      }
    };
    scheduleNext();

    return () => {
      disposed = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [activeBrandId, activePage, archive.brand.id, hasPendingDouyinCreatorDeepFetchTask, hasPendingDouyinTranscript]);

  const brandNotesPageCount = Math.max(1, Math.ceil(sortedBrandNotes.length / brandNotesPageSize));
  const paginatedBrandNotes = useMemo(() => {
    const startIndex = (brandNotesPage - 1) * brandNotesPageSize;
    return sortedBrandNotes.slice(startIndex, startIndex + brandNotesPageSize);
  }, [brandNotesPage, brandNotesPageSize, sortedBrandNotes]);

  useEffect(() => {
    if (!sortedBrandAccounts.length) {
      return;
    }
    const seededEntries = sortedBrandAccounts.map((record) => createXhsAccountEntryFromRecord(record, "brand"));
    setXhsSyncForm((current) => {
      const mergedEntries = mergeXhsAccountEntries(current.brandAccountEntries, seededEntries, "brand");
      if (areXhsAccountEntriesEqual(current.brandAccountEntries, mergedEntries)) {
        return current;
      }
      return {
        ...current,
        brandAccountEntries: mergedEntries,
      };
    });
  }, [sortedBrandAccounts]);
  useEffect(() => {
    if (!sortedCompetitorAccounts.length) {
      return;
    }
    const seededEntries = sortedCompetitorAccounts.map((record) => createXhsAccountEntryFromRecord(record, "competitor"));
    setXhsSyncForm((current) => {
      const mergedEntries = mergeXhsAccountEntries(current.competitorAccountEntries, seededEntries, "competitor");
      if (areXhsAccountEntriesEqual(current.competitorAccountEntries, mergedEntries)) {
        return current;
      }
      return {
        ...current,
        competitorAccountEntries: mergedEntries,
      };
    });
  }, [sortedCompetitorAccounts]);
  useEffect(() => {
    if (!sortedDouyinBrandAccounts.length) {
      return;
    }
    const seededEntries = sortedDouyinBrandAccounts.map((record) => createXhsAccountEntryFromRecord(record, "brand"));
    setDouyinSyncForm((current) => {
      const mergedEntries = mergeXhsAccountEntries(current.brandAccountEntries, seededEntries, "brand");
      if (areXhsAccountEntriesEqual(current.brandAccountEntries, mergedEntries)) {
        return current;
      }
      return {
        ...current,
        brandAccountEntries: mergedEntries,
      };
    });
  }, [sortedDouyinBrandAccounts]);
  useEffect(() => {
    if (!sortedDouyinCompetitorAccounts.length) {
      return;
    }
    const seededEntries = sortedDouyinCompetitorAccounts.map((record) => createXhsAccountEntryFromRecord(record, "competitor"));
    setDouyinSyncForm((current) => {
      const mergedEntries = mergeXhsAccountEntries(current.competitorAccountEntries, seededEntries, "competitor");
      if (areXhsAccountEntriesEqual(current.competitorAccountEntries, mergedEntries)) {
        return current;
      }
      return {
        ...current,
        competitorAccountEntries: mergedEntries,
      };
    });
  }, [sortedDouyinCompetitorAccounts]);
  const hasBrandBackgroundForGrowthReport = Boolean(
    archive.brand.brandName?.trim()
    || archive.brand.brandDescription?.trim()
    || archive.brand.enterpriseIntro?.trim(),
  );
  const hasProductsForGrowthReport = archive.products.length > 0;
  const hasOpportunityInsightReportsForGrowthReport = Boolean(
    opportunityInsightWorkspace.brandAccountAnalysis?.htmlDocument?.trim()
    && opportunityInsightWorkspace.competitorAccountAnalysis?.htmlDocument?.trim()
    && opportunityInsightWorkspace.commentInsightAnalysis?.htmlDocument?.trim()
    && opportunityInsightWorkspace.finalOpportunityReport?.htmlDocument?.trim(),
  );
  const canGenerateGrowthReport =
    hasBrandBackgroundForGrowthReport
    && hasProductsForGrowthReport
    && hasOpportunityInsightReportsForGrowthReport;
  const canGenerateVisualGrowthReport = Boolean(reportWorkspace.latest?.reportMarkdown?.trim());
  const canGenerateAnnualMarketingPlan = Boolean(reportWorkspace.latest?.reportMarkdown?.trim());
  const latestMarketingPlan = xiaohongshuMarketingPlanWorkspace.latest;
  const latestCalendar = marketingCalendarWorkspace.latest;
  const latestGrowthTask = reportWorkspace.latestTask;
  const latestOpportunityTask = opportunityInsightWorkspace.latestTask;
  const latestVisualTask = visualReportWorkspace.latestTask;
  const latestAnnualMarketingTask = annualMarketingPlanWorkspace.latestTask;
  const latestCalendarTask = marketingCalendarWorkspace.latestTask;
  const latestDouyinTopicResult = douyinTopicLibraryWorkspace.latest;
  const latestDouyinTopicTask = douyinTopicLibraryWorkspace.latestTask;
  const isGrowthReportTaskActive = latestGrowthTask?.taskStatus === "QUEUED" || latestGrowthTask?.taskStatus === "RUNNING";
  const isOpportunityInsightTaskActive = latestOpportunityTask?.taskStatus === "QUEUED" || latestOpportunityTask?.taskStatus === "RUNNING";
  const isVisualReportTaskActive = latestVisualTask?.taskStatus === "QUEUED" || latestVisualTask?.taskStatus === "RUNNING";
  const isAnnualMarketingPlanTaskActive =
    latestAnnualMarketingTask?.taskStatus === "QUEUED" || latestAnnualMarketingTask?.taskStatus === "RUNNING";
  const isMarketingCalendarTaskActive = latestCalendarTask?.taskStatus === "QUEUED" || latestCalendarTask?.taskStatus === "RUNNING";
  const isDouyinTopicTaskActive =
    latestDouyinTopicTask?.taskStatus === "QUEUED"
    || latestDouyinTopicTask?.taskStatus === "PENDING"
    || latestDouyinTopicTask?.taskStatus === "RUNNING";
  const isOpportunityInsightPageActive = activePage === "opportunityInsight";
  const isGrowthReportPageActive = activePage === "growthReport";
  const isVisualGrowthReportPageActive = activePage === "visualGrowthReport";
  const isAnnualMarketingPlanPageActive = activePage === "annualMarketingPlan";
  const isMarketingCalendarPageActive = activePage === "xiaohongshuMarketingCalendar";
  const isReportTopicLibraryPageActive = activePage === "reportTopicLibrary";
  const hasBrandBackgroundForMarketingCalendar = Boolean(
    archive.brand.brandName?.trim()
    || archive.brand.brandDescription?.trim()
    || archive.brand.enterpriseIntro?.trim(),
  );
  const hasOpportunityFinalReportForMarketingCalendar = Boolean(
    opportunityInsightWorkspace.finalOpportunityReport?.htmlDocument?.trim(),
  );
  const canGenerateMarketingCalendar = Boolean(
    hasBrandBackgroundForMarketingCalendar
    && reportWorkspace.latest
    && hasOpportunityFinalReportForMarketingCalendar,
  );
  const calendarTaskStatusText = getReportTaskStatusText(latestCalendarTask?.taskStatus);
  const calendarInlineError =
    latestCalendarTask?.taskStatus === "FAILED" && latestCalendarTask.errorMessage ? latestCalendarTask.errorMessage : "";
  const calendarAllItems = useMemo(
    () =>
      latestCalendar
        ? [latestCalendar, ...marketingCalendarWorkspace.history.filter((item) => item.id !== latestCalendar.id)].flatMap((item) => item.items)
        : marketingCalendarWorkspace.history.flatMap((item) => item.items),
    [latestCalendar, marketingCalendarWorkspace.history],
  );
  const selectedCalendarItem = calendarAllItems.find((item) =>
    (selectedCalendarItemId && item.id === selectedCalendarItemId)
    || (selectedCalendarDate && item.date === selectedCalendarDate),
  );
  const canSyncFeishuWorkspace = Boolean(feishuBinding?.wikiUrl) && Boolean(feishuAuthStatus?.connected);
  const hasCurrentPageEditPermission = Boolean(brandPermissionSettings?.currentUserPermissions?.[strategyPagePermissionMap[currentPage.key]]?.edit);
  useEffect(() => {
    if (dailyHotspotWorkspace.selectedDate && dailyHotspotWorkspace.selectedDate !== selectedHotspotDate) {
      setSelectedHotspotDate(dailyHotspotWorkspace.selectedDate);
    }
  }, [dailyHotspotWorkspace.selectedDate, selectedHotspotDate]);

  useEffect(() => {
    if (!visibleStrategySections.length) {
      return;
    }
    if (!visibleStrategySections.some((section) => section.key === activeSection)) {
      setActiveSection(visibleStrategySections[0].key);
      setActivePage(visibleStrategySections[0].pages[0]?.key ?? "background");
      return;
    }
    const matchedSection = visibleStrategySections.find((section) => section.key === activeSection);
    if (matchedSection && !matchedSection.pages.some((page) => page.key === activePage)) {
      setActivePage(matchedSection.pages[0]?.key ?? "background");
    }
  }, [activePage, activeSection, visibleStrategySections]);

  useEffect(() => {
    setExpandedSections((current) => ({
      ...current,
      [activeSection]: true,
    }));
  }, [activeSection]);

  useEffect(() => {
    void loadArchive({ targetPage: "background" });
  }, []);

  useEffect(() => {
    const cachedBrandId = getStoredCurrentBrandId(DEMO_BRAND_ID) || DEMO_BRAND_ID;
    const cachedSnapshot = readReportScopeSnapshot(cachedBrandId);
    if (!cachedSnapshot) {
      return;
    }

    setCollectionWorkspace(cachedSnapshot.collectionWorkspace);
    setReportWorkspace(cachedSnapshot.reportWorkspace);
    setOpportunityInsightWorkspace(cachedSnapshot.opportunityInsightWorkspace);
    setVisualReportWorkspace(cachedSnapshot.visualReportWorkspace);
    setAnnualMarketingPlanWorkspace(cachedSnapshot.annualMarketingPlanWorkspace);
    setXiaohongshuMarketingPlanWorkspace(cachedSnapshot.xiaohongshuMarketingPlanWorkspace);
    setMarketingCalendarWorkspace(cachedSnapshot.marketingCalendarWorkspace);
    setDouyinTopicLibraryWorkspace(cachedSnapshot.douyinTopicLibraryWorkspace || douyinHotTopicCandidatesSeed);
    setOpenClawExplosiveAnalysisWorkspace(cachedSnapshot.openClawExplosiveAnalysisWorkspace || createEmptyOpenClawExplosiveAnalysisWorkspace());
    setOpenClawLobsterDiaryWorkspace(cachedSnapshot.openClawLobsterDiaryWorkspace || createEmptyOpenClawLobsterDiaryWorkspace());
    setOpenClawDailyPlanWorkspace(cachedSnapshot.openClawDailyPlanWorkspace || createEmptyOpenClawDailyPlanWorkspace());
    setLoadedScopes((current) => (current.report ? current : { ...current, report: true }));
  }, []);

  async function resolveActiveBrandId(fallbackBrandId: string, me?: Awaited<ReturnType<typeof getMe>> | null) {
    const resolvedMe = me ?? await getMe().catch(() => null);
    const storedBrandId = getStoredCurrentBrandId(fallbackBrandId) || "";
    const preferredNonDemoBrandId = resolvedMe?.brands?.find((item) => item.id && item.id !== DEMO_BRAND_ID)?.id || "";
    const directCandidate = resolvedMe?.currentBrandId || storedBrandId || fallbackBrandId;

    if (preferredNonDemoBrandId && directCandidate === DEMO_BRAND_ID) {
      return preferredNonDemoBrandId;
    }

    if (directCandidate && directCandidate !== DEMO_BRAND_ID) {
      return directCandidate;
    }

    return preferredNonDemoBrandId || directCandidate || fallbackBrandId;
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get("feishu_oauth");
    const oauthMessage = params.get("feishu_message");
    if (!oauthStatus) {
      return;
    }
    if (oauthStatus === "success") {
      setNotice(oauthMessage || "飞书账号连接成功。");
    } else {
      setErrorMessage(oauthMessage || "飞书账号连接失败。");
    }
    window.history.replaceState({}, "", window.location.pathname);
    void loadArchive({ targetPage: activePage, force: true });
  }, []);

  useEffect(() => {
    if (!brandPermissionSettings || !hasOwnerAccess || isHydrating) {
      return;
    }
    const targetScope = getLoadScopeByPage(activePage);
    if (loadedScopes[targetScope]) {
      return;
    }
    void loadArchive({ targetPage: activePage });
  }, [activePage, brandPermissionSettings, hasOwnerAccess, isHydrating, loadedScopes]);

  useEffect(() => {
    setBrandNotesPage(1);
  }, [brandNotesPageSize, collectionWorkspace.brandNotes.length]);

  useEffect(() => {
    setHotspotPage(1);
  }, [hotspotPageSize, selectedHotspotDate, activeHotspotRecord?.id, sortedHotspotItems.length]);

  useEffect(() => {
    if (brandNotesPage > brandNotesPageCount) {
      setBrandNotesPage(brandNotesPageCount);
    }
  }, [brandNotesPage, brandNotesPageCount]);

  useEffect(() => {
    if (hotspotPage > hotspotPageCount) {
      setHotspotPage(hotspotPageCount);
    }
  }, [hotspotPage, hotspotPageCount]);

  useEffect(() => {
    setReportMarkdownDraft(reportWorkspace.latest?.reportMarkdown || "");
  }, [reportWorkspace.latest?.id, reportWorkspace.latest?.reportMarkdown]);

  useEffect(() => {
    if (!isOpportunityInsightTaskActive || !isOpportunityInsightPageActive) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshOpportunityInsightWorkspace(true);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [isOpportunityInsightPageActive, isOpportunityInsightTaskActive, latestOpportunityTask?.updatedAt]);

  useEffect(() => {
    if (!isGrowthReportTaskActive || !isGrowthReportPageActive) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshGrowthReportWorkspace(true);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [isGrowthReportPageActive, isGrowthReportTaskActive, latestGrowthTask?.updatedAt]);

  useEffect(() => {
    if (!isVisualReportTaskActive || !isVisualGrowthReportPageActive) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshVisualReportWorkspace(true);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [isVisualGrowthReportPageActive, isVisualReportTaskActive, latestVisualTask?.updatedAt]);

  useEffect(() => {
    if (!isAnnualMarketingPlanTaskActive || !isAnnualMarketingPlanPageActive) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshAnnualMarketingPlanWorkspace(true);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [isAnnualMarketingPlanPageActive, isAnnualMarketingPlanTaskActive, latestAnnualMarketingTask?.updatedAt]);

  useEffect(() => {
    if (!isMarketingCalendarTaskActive || !isMarketingCalendarPageActive) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshMarketingCalendarWorkspace(true);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [isMarketingCalendarPageActive, isMarketingCalendarTaskActive, latestCalendarTask?.updatedAt]);

  useEffect(() => {
    if (douyinTopicLibraryWorkspace.selectedDate && douyinTopicLibraryWorkspace.selectedDate !== selectedDouyinTopicDate) {
      setSelectedDouyinTopicDate(douyinTopicLibraryWorkspace.selectedDate);
      return;
    }
    if (!selectedDouyinTopicDate && douyinTopicLibraryWorkspace.availableDates.length) {
      setSelectedDouyinTopicDate(douyinTopicLibraryWorkspace.availableDates[0]);
    }
  }, [douyinTopicLibraryWorkspace.availableDates, douyinTopicLibraryWorkspace.selectedDate, selectedDouyinTopicDate]);

  useEffect(() => {
    if (!isDouyinTopicTaskActive || !isReportTopicLibraryPageActive) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshDouyinTopicLibraryWorkspace(selectedDouyinTopicDate, true);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [isDouyinTopicTaskActive, isReportTopicLibraryPageActive, latestDouyinTopicTask?.updatedAt, selectedDouyinTopicDate]);

  useEffect(() => {
    if (!isCalendarDetailOpen || !selectedCalendarItem || isEditingCalendarItem) {
      return;
    }
    setCalendarItemDraft(cloneMarketingCalendarItem(selectedCalendarItem));
  }, [isCalendarDetailOpen, isEditingCalendarItem, selectedCalendarItem]);

  useEffect(() => {
    if (!loadedScopes.report || !activeBrandId) {
      return;
    }

    writeReportScopeSnapshot(activeBrandId, {
      collectionWorkspace,
      reportWorkspace,
      opportunityInsightWorkspace,
      visualReportWorkspace,
      annualMarketingPlanWorkspace,
      xiaohongshuMarketingPlanWorkspace,
      marketingCalendarWorkspace,
      douyinTopicLibraryWorkspace,
      openClawExplosiveAnalysisWorkspace,
      openClawLobsterDiaryWorkspace,
      openClawDailyPlanWorkspace,
    });
  }, [
    activeBrandId,
    annualMarketingPlanWorkspace,
    collectionWorkspace,
    loadedScopes.report,
    marketingCalendarWorkspace,
    opportunityInsightWorkspace,
    reportWorkspace,
    visualReportWorkspace,
    xiaohongshuMarketingPlanWorkspace,
    douyinTopicLibraryWorkspace,
    openClawExplosiveAnalysisWorkspace,
    openClawLobsterDiaryWorkspace,
    openClawDailyPlanWorkspace,
  ]);

  async function loadArchive(options?: { targetPage?: StrategyPageKey; force?: boolean }) {
    const targetPage = options?.targetPage ?? activePage;
    const targetScope = getLoadScopeByPage(targetPage);
    const force = options?.force === true;
    setIsHydrating(true);
    setErrorMessage("");
    setDataSource("loading");

    try {
      const me = await getMe().catch(() => null);
      const resolvedActiveBrandId = await resolveActiveBrandId(archive.brand.id, me);
      const permissionSettingsResult =
        !force && brandPermissionSettings && activeBrandId === resolvedActiveBrandId
          ? brandPermissionSettings
          : await getBrandPermissionSettings(resolvedActiveBrandId);
      const hasAnyBrandGrowthViewPermission = Object.entries(permissionSettingsResult.currentUserPermissions).some(
        ([key, flags]) => key.startsWith("brandGrowth.") && Boolean(flags.view),
      );
      setBrandPermissionSettings(permissionSettingsResult);
      setCurrentBrandRole(permissionSettingsResult.currentUserRole);
      if (!hasAnyBrandGrowthViewPermission) {
        setHasOwnerAccess(false);
        setDataSource("api");
        setNotice("");
        setErrorMessage("当前账号没有品牌增长策略的查看权限，请联系管理员开通对应板块后再进入。");
        return;
      }

      setHasOwnerAccess(true);
      setActiveBrandId(resolvedActiveBrandId);

      const partialFailures: string[] = [];
      if (targetScope === "library") {
        const archiveResult = await getBrandArchive(resolvedActiveBrandId, { force });
        setArchive(normalizeBrandArchiveBundle(archiveResult));
        setRemovedProductIds([]);
        setLoadedScopes((current) => ({ ...current, library: true }));
      }

      if (targetScope === "collection") {
        const currentProfile = currentUser ?? await getCurrentUserProfile().catch(() => null);
        setCurrentUser(currentProfile);
        const [
          collectionResult,
          douyinCollectionResult,
          wechatMpCollectionResult,
          wechatMpBenchmarkResult,
          wechatSearchResult,
          dailyHotspotResult,
          feishuBindingResult,
          feishuAppConfigResult,
          feishuAuthStatusResult,
        ] = await Promise.allSettled([
          getXiaohongshuCollectionWorkspace(resolvedActiveBrandId),
          getDouyinCollectionWorkspace(resolvedActiveBrandId),
          getWechatMpCollectionWorkspace(resolvedActiveBrandId),
          getWechatMpBenchmarkWorkspace(resolvedActiveBrandId),
          getWechatSearchWorkspace(resolvedActiveBrandId),
          getDailyHotspotWorkspace(resolvedActiveBrandId),
          getBrandFeishuBinding(resolvedActiveBrandId),
          getFeishuAppConfig(currentProfile?.id),
          getFeishuAuthStatus(currentProfile?.id),
        ]);

        if (collectionResult.status === "fulfilled") {
          setCollectionWorkspace(collectionResult.value);
          setXhsCommentPagination([]);
          setExpandedXhsCommentIds([]);
          setXhsSubCommentsByParent({});
          setXhsSubCommentPaginationMap({});
        } else {
          partialFailures.push("小红书收集数据");
        }

        if (douyinCollectionResult.status === "fulfilled") {
          setDouyinCollectionWorkspace(douyinCollectionResult.value);
          setDouyinCommentPagination([]);
        } else {
          partialFailures.push("抖音采集数据");
        }

        if (wechatMpCollectionResult.status === "fulfilled") {
          setWechatMpCollectionWorkspace(wechatMpCollectionResult.value);
        } else {
          partialFailures.push("公众号采集数据");
        }

        if (wechatMpBenchmarkResult.status === "fulfilled") {
          setWechatMpBenchmarkWorkspace(wechatMpBenchmarkResult.value);
        } else {
          partialFailures.push("公众号对标作品数据");
        }

        if (wechatSearchResult.status === "fulfilled") {
          setWechatSearchWorkspace(wechatSearchResult.value);
        } else {
          partialFailures.push("微信搜一搜数据");
        }

        if (dailyHotspotResult.status === "fulfilled") {
          setDailyHotspotWorkspace(dailyHotspotResult.value);
          setSelectedHotspotDate(dailyHotspotResult.value.selectedDate || getDefaultHotspotDate());
        } else {
          partialFailures.push("每日热点");
        }

        const shouldExposeFeishuCollectionFailures = targetPage !== "xiaohongshuCollection";

        if (feishuBindingResult.status === "fulfilled") {
          setFeishuBinding(feishuBindingResult.value);
          setFeishuBindingForm(createFeishuBindingFormFromRecord(feishuBindingResult.value));
        } else if (shouldExposeFeishuCollectionFailures) {
          partialFailures.push("飞书绑定");
        }

        if (feishuAppConfigResult.status === "fulfilled") {
          setFeishuAppConfig(feishuAppConfigResult.value);
          setFeishuAppConfigForm(createFeishuAppConfigFormFromRecord(feishuAppConfigResult.value));
        } else if (shouldExposeFeishuCollectionFailures) {
          partialFailures.push("飞书应用配置");
        }

        if (feishuAuthStatusResult.status === "fulfilled") {
          setFeishuAuthStatus(feishuAuthStatusResult.value);
        } else if (shouldExposeFeishuCollectionFailures) {
          partialFailures.push("飞书授权状态");
        }

        setLoadedScopes((current) => ({ ...current, collection: true }));
      }

      if (targetScope === "report") {
        const [
          collectionResult,
          reportResult,
          opportunityInsightResult,
          visualReportResult,
          annualMarketingPlanResult,
          xiaohongshuMarketingPlanResult,
          marketingCalendarResult,
          douyinTopicLibraryResult,
          openClawExplosiveAnalysisResult,
          openClawLobsterDiaryResult,
          openClawDailyPlanResult,
        ] = await Promise.allSettled([
          getXiaohongshuCollectionWorkspace(resolvedActiveBrandId),
          getGrowthReportWorkspace(resolvedActiveBrandId),
          getOpportunityInsightWorkspace(resolvedActiveBrandId),
          getVisualGrowthReportWorkspace(resolvedActiveBrandId),
          getAnnualMarketingPlanWorkspace(resolvedActiveBrandId),
          getXiaohongshuMarketingPlanWorkspace(resolvedActiveBrandId),
          getXiaohongshuMarketingCalendarWorkspace(resolvedActiveBrandId),
          getDouyinHotTopicCandidatesWorkspace(resolvedActiveBrandId),
          getOpenClawExplosiveAnalysisWorkspace(resolvedActiveBrandId, "brand_growth"),
          getOpenClawLobsterDiaryWorkspace(resolvedActiveBrandId, "brand_growth"),
          getOpenClawDailyPlanWorkspace(resolvedActiveBrandId, "brand_growth"),
        ]);

        if (collectionResult.status === "fulfilled") {
          setCollectionWorkspace(collectionResult.value);
        } else {
          partialFailures.push("小红书收集数据");
        }

        if (reportResult.status === "fulfilled") {
          setReportWorkspace(reportResult.value);
        } else {
          partialFailures.push("品牌增长报告");
        }

        if (opportunityInsightResult.status === "fulfilled") {
          setOpportunityInsightWorkspace(opportunityInsightResult.value);
        } else {
          partialFailures.push("机会洞察");
        }

        if (visualReportResult.status === "fulfilled") {
          setVisualReportWorkspace(visualReportResult.value);
        } else {
          partialFailures.push("可视化报告");
        }

        if (annualMarketingPlanResult.status === "fulfilled") {
          setAnnualMarketingPlanWorkspace(annualMarketingPlanResult.value);
        } else {
          partialFailures.push("半年营销规划");
        }

        if (xiaohongshuMarketingPlanResult.status === "fulfilled") {
          setXiaohongshuMarketingPlanWorkspace(xiaohongshuMarketingPlanResult.value);
        } else {
          partialFailures.push("小红书营销策划方案");
        }

        if (marketingCalendarResult.status === "fulfilled") {
          setMarketingCalendarWorkspace(marketingCalendarResult.value);
        } else {
          partialFailures.push("营销日历");
        }

        if (douyinTopicLibraryResult.status === "fulfilled") {
          setDouyinTopicLibraryWorkspace(douyinTopicLibraryResult.value);
        } else {
          partialFailures.push("选题库");
        }

        if (openClawExplosiveAnalysisResult.status === "fulfilled") {
          setOpenClawExplosiveAnalysisWorkspace(openClawExplosiveAnalysisResult.value);
        } else {
          partialFailures.push("爆款拆解");
        }

        if (openClawLobsterDiaryResult.status === "fulfilled") {
          setOpenClawLobsterDiaryWorkspace(openClawLobsterDiaryResult.value);
        } else {
          partialFailures.push("每周复盘");
        }

        if (openClawDailyPlanResult.status === "fulfilled") {
          setOpenClawDailyPlanWorkspace(openClawDailyPlanResult.value);
        } else {
          partialFailures.push("每日计划");
        }

        setLoadedScopes((current) => ({ ...current, report: true }));
      }

      setDataSource("api");
      if (partialFailures.length > 0) {
        setErrorMessage(`部分接口暂不可用：${partialFailures.join("、")}。页面保留已获取到的真实数据，不再回退到演示数据。`);
      }
    } catch (error) {
      setDataSource("error");
      const message = error instanceof Error ? error.message : "页面初始化失败";
      if (isAuthFailure(error)) {
        setErrorMessage("登录态已失效，请重新登录后再刷新当前页面。");
      } else if (message.includes("Failed to fetch") || message.includes("NetworkError") || message.includes("fetch failed")) {
        setErrorMessage("后端接口当前不可达，请检查站点 API 服务。页面不会再回退到演示数据。");
      } else {
        setErrorMessage(`页面初始化失败：${message}`);
      }
    } finally {
      setIsHydrating(false);
    }
  }

  async function refreshVisualReportWorkspace(silent = false) {
    try {
      const nextWorkspace = await getVisualGrowthReportWorkspace(archive.brand.id, { force: true });
      setVisualReportWorkspace(nextWorkspace);
      if (nextWorkspace.latestTask?.taskStatus === "FAILED" && nextWorkspace.latestTask.errorMessage) {
        setErrorMessage(`生成失败：${nextWorkspace.latestTask.errorMessage}`);
      }
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : "刷新失败";
        setErrorMessage(`刷新可视化报告失败：${message}`);
      }
    }
  }

  async function refreshOpportunityInsightWorkspace(silent = false) {
    try {
      const nextWorkspace = await getOpportunityInsightWorkspace(archive.brand.id, { force: true });
      setOpportunityInsightWorkspace(nextWorkspace);
      if (nextWorkspace.latestTask?.taskStatus === "FAILED" && nextWorkspace.latestTask.errorMessage) {
        setErrorMessage(`生成失败：${nextWorkspace.latestTask.errorMessage}`);
      }
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : "刷新失败";
        setErrorMessage(`刷新机会洞察失败：${message}`);
      }
    }
  }

  async function refreshGrowthReportWorkspace(silent = false) {
    try {
      const nextWorkspace = await getGrowthReportWorkspace(archive.brand.id, { force: true });
      setReportWorkspace(nextWorkspace);
      if (nextWorkspace.latestTask?.taskStatus === "FAILED" && nextWorkspace.latestTask.errorMessage) {
        setErrorMessage(`生成失败：${nextWorkspace.latestTask.errorMessage}`);
      }
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : "刷新失败";
        setErrorMessage(`刷新品牌增长报告失败：${message}`);
      }
    }
  }

  async function refreshAnnualMarketingPlanWorkspace(silent = false) {
    try {
      const nextWorkspace = await getAnnualMarketingPlanWorkspace(archive.brand.id, { force: true });
      setAnnualMarketingPlanWorkspace(nextWorkspace);
      if (nextWorkspace.latestTask?.taskStatus === "FAILED" && nextWorkspace.latestTask.errorMessage) {
        setErrorMessage(`生成失败：${nextWorkspace.latestTask.errorMessage}`);
      }
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : "刷新失败";
        setErrorMessage(`刷新半年营销规划失败：${message}`);
      }
    }
  }

  async function refreshMarketingCalendarWorkspace(silent = false) {
    try {
      const nextWorkspace = await getXiaohongshuMarketingCalendarWorkspace(archive.brand.id, { force: true });
      setMarketingCalendarWorkspace(nextWorkspace);
      if (nextWorkspace.latestTask?.taskStatus === "FAILED" && nextWorkspace.latestTask.errorMessage) {
        setErrorMessage(`生成失败：${nextWorkspace.latestTask.errorMessage}`);
      }
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : "刷新失败";
        setErrorMessage(`刷新营销日历失败：${message}`);
      }
    }
  }

  async function refreshDouyinTopicLibraryWorkspace(selectedDate?: string, silent = false) {
    try {
      const nextWorkspace = await getDouyinHotTopicCandidatesWorkspace(archive.brand.id, selectedDate || undefined);
      setDouyinTopicLibraryWorkspace(nextWorkspace);
      if (nextWorkspace.latestTask?.taskStatus === "FAILED" && nextWorkspace.latestTask.errorMessage) {
        setErrorMessage(`生成失败：${nextWorkspace.latestTask.errorMessage}`);
      }
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : "刷新失败";
        setErrorMessage(`刷新选题库失败：${message}`);
      }
    }
  }

  async function saveDouyinTopicLibrary(items: DouyinTopicLibraryItem[]) {
    setIsSavingDouyinTopicLibrary(true);
    try {
      const nextWorkspace = await updateDouyinTopicLibrary(items, archive.brand.id);
      setDouyinTopicLibraryWorkspace(nextWorkspace);
      return nextWorkspace;
    } finally {
      setIsSavingDouyinTopicLibrary(false);
    }
  }

function buildFeishuMediaProxyUrl(sourceUrl?: string, download = false, brandId?: string) {
  if (!sourceUrl) {
    return "";
  }

  try {
    const target = new URL(sourceUrl);
    const isFeishuHost = target.hostname === "open.feishu.cn"
      || target.hostname === "open.larkoffice.com"
      || target.hostname.endsWith(".feishu.cn")
      || target.hostname.endsWith(".larkoffice.com")
      || target.hostname.endsWith(".larksuite.com");
    if (isFeishuHost) {
      if (/\/open-apis\/drive\/v1\/medias\/batch_get_tmp_download_url/i.test(target.pathname)) {
        return "";
      }
      const params = new URLSearchParams({ sourceUrl });
      if (download) {
        params.set("download", "1");
      }
      const resolvedBrandId = brandId || getStoredCurrentBrandId(DEMO_BRAND_ID) || DEMO_BRAND_ID;
      return `${API_BASE_URL}/collectors/xiaohongshu/brands/${resolvedBrandId}/feishu-media?${params.toString()}`;
    }

    if (target.protocol === "http:" || target.protocol === "https:") {
      return sourceUrl;
    }
  } catch {
    return "";
  }

  return "";
}

  async function handleGenerateReport() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.growthReport"]?.edit) {
      setErrorMessage("当前账号没有生成品牌增长报告的编辑权限。");
      return;
    }
    if (!canGenerateGrowthReport) {
      setErrorMessage("请先补齐品牌背景资料、产品资料，以及机会洞察中的 4 份 HTML 报告后，再生成品牌增长报告。");
      return;
    }

    setIsGeneratingReport(true);
    clearMessages();

    try {
      const nextWorkspace = await generateGrowthReport(archive.brand.id);
      setReportWorkspace(nextWorkspace);
      setNotice("已提交品牌增长报告生成任务，正在后台生成。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败";
      setErrorMessage(`生成失败：${message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  }

  function buildOpportunityInsightPayload(supplementInput: string) {
    const normalized = supplementInput.trim();
    return normalized ? { supplementInput: normalized } : {};
  }

  function buildUserRequirementPayload(userRequirement: string) {
    const normalized = userRequirement.trim();
    return normalized ? { userRequirement: normalized } : {};
  }

  function getReportGenerationInputValue(kind: ReportGenerationModalKind) {
    return kind === "annualMarketingPlan" ? annualMarketingPlanUserRequirement : marketingCalendarUserRequirement;
  }

  function setReportGenerationInputValue(kind: ReportGenerationModalKind, value: string) {
    if (kind === "annualMarketingPlan") {
      setAnnualMarketingPlanUserRequirement(value);
      return;
    }
    setMarketingCalendarUserRequirement(value);
  }

  function closeReportGenerationModal() {
    if (isGeneratingAnnualMarketingPlan || isGeneratingMarketingCalendar) {
      return;
    }
    setReportGenerationModal(null);
  }

  function renderReportGenerationModal() {
    if (!reportGenerationModal) {
      return null;
    }
    return (
      <NoteCreateModalShell
        open
        copy={REPORT_GENERATION_MODAL_COPY[reportGenerationModal]}
        isPublishing={reportGenerationModal === "annualMarketingPlan" ? isGeneratingAnnualMarketingPlan : isGeneratingMarketingCalendar}
        createLabel={
          reportGenerationModal === "annualMarketingPlan"
            ? annualMarketingPlanWorkspace.latest
              ? "提交并重新生成规划"
              : "提交并生成规划"
            : marketingCalendarWorkspace.latest
              ? "提交并继续生成下一个7天"
              : "提交并生成营销日历"
        }
        onClose={closeReportGenerationModal}
        onCreate={reportGenerationModal === "annualMarketingPlan" ? handleSubmitAnnualMarketingPlan : handleSubmitMarketingCalendar}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span className="status-text">用户要求</span>
          <textarea
            value={getReportGenerationInputValue(reportGenerationModal)}
            onChange={(event) => setReportGenerationInputValue(reportGenerationModal, event.target.value)}
            disabled={reportGenerationModal === "annualMarketingPlan" ? isGeneratingAnnualMarketingPlan : isGeneratingMarketingCalendar}
            rows={6}
            placeholder="可留空；如有特别要求、补充背景、阶段目标、平台优先级、节奏偏好或资源限制，请在这里输入。"
          />
          <span className="panel-subtext" style={{ margin: 0 }}>
            {reportGenerationModal === "annualMarketingPlan"
              ? "点击提交后，会将这段用户要求一并带入半年营销规划生成任务。"
              : "点击提交后，会将这段用户要求一并带入营销日历生成任务。"}
          </span>
        </label>
      </NoteCreateModalShell>
    );
  }

  function getOpportunityInsightStepInput(step: OpportunityInsightStep) {
    if (step === 2) {
      return opportunityInsightStepTwoInput;
    }
    if (step === 3) {
      return opportunityInsightStepThreeInput;
    }
    return opportunityInsightStepOneInput;
  }

  function setOpportunityInsightStepInput(step: OpportunityInsightStep, value: string) {
    if (step === 2) {
      setOpportunityInsightStepTwoInput(value);
      return;
    }
    if (step === 3) {
      setOpportunityInsightStepThreeInput(value);
      return;
    }
    setOpportunityInsightStepOneInput(value);
  }

  function openOpportunityInsightStepModal(step: OpportunityInsightStep, isRetry: boolean) {
    setOpportunityInsightStepModal({ step, isRetry });
  }

  async function runOpportunityInsightStep(step: OpportunityInsightStep) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.opportunityInsight"]?.edit) {
      setErrorMessage("当前账号没有生成机会洞察的编辑权限。");
      return false;
    }

    setIsGeneratingOpportunityInsight(true);
    clearMessages();

    try {
      const nextWorkspace = step === 2
        ? await generateOpportunityInsightStepTwo(archive.brand.id, buildOpportunityInsightPayload(getOpportunityInsightStepInput(step)))
        : step === 3
          ? await generateOpportunityInsightStepThree(archive.brand.id, buildOpportunityInsightPayload(getOpportunityInsightStepInput(step)))
          : await generateOpportunityInsightStepOne(archive.brand.id, buildOpportunityInsightPayload(getOpportunityInsightStepInput(step)));
      setOpportunityInsightWorkspace(nextWorkspace);
      setNotice(
        step === 2
          ? "已提交机会洞察第 2 步任务，正在后台生成评论洞察分析。"
          : step === 3
            ? "已提交机会洞察第 3 步任务，正在后台生成机会洞察总报告。"
            : "已提交机会洞察第 1 步任务，正在后台生成品牌账号分析和竞品账号分析。",
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败";
      setErrorMessage(`生成失败：${message}`);
      return false;
    } finally {
      setIsGeneratingOpportunityInsight(false);
    }
  }

  async function handleGenerateOpportunityInsight() {
    const awaitingStep = opportunityInsightWorkspace.awaitingConfirmationStep;
    const step: OpportunityInsightStep = awaitingStep === 2
      ? 2
      : awaitingStep === 3 || opportunityInsightWorkspace.finalOpportunityReport
        ? 3
        : 1;
    openOpportunityInsightStepModal(
      step,
      step === 1
        ? Boolean(opportunityInsightWorkspace.brandAccountAnalysis || opportunityInsightWorkspace.competitorAccountAnalysis)
        : step === 2
          ? Boolean(opportunityInsightWorkspace.commentInsightAnalysis)
          : Boolean(opportunityInsightWorkspace.finalOpportunityReport),
    );
  }

  async function handleRetryOpportunityInsightStepOne() {
    openOpportunityInsightStepModal(1, Boolean(opportunityInsightWorkspace.brandAccountAnalysis || opportunityInsightWorkspace.competitorAccountAnalysis));
  }

  async function handleRetryOpportunityInsightStepTwo() {
    openOpportunityInsightStepModal(2, Boolean(opportunityInsightWorkspace.commentInsightAnalysis));
  }

  async function handleRetryOpportunityInsightStepThree() {
    openOpportunityInsightStepModal(3, Boolean(opportunityInsightWorkspace.finalOpportunityReport));
  }

  async function handleSubmitOpportunityInsightStepModal() {
    if (!opportunityInsightStepModal) {
      return;
    }
    const succeeded = await runOpportunityInsightStep(opportunityInsightStepModal.step);
    if (succeeded) {
      setOpportunityInsightStepModal(null);
    }
  }

  function getOpportunityInsightPrimaryActionLabel() {
    if (isOpportunityInsightTaskActive) {
      return "生成中...";
    }
    if (opportunityInsightWorkspace.awaitingConfirmationStep === 2) {
      return "开始第 2 步";
    }
    if (opportunityInsightWorkspace.awaitingConfirmationStep === 3) {
      return "开始第 3 步";
    }
    if (opportunityInsightWorkspace.finalOpportunityReport) {
      return "重新生成总报告";
    }
    return "立刻机会洞察";
  }

  async function handleSaveReport() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.growthReport"]?.edit) {
      setErrorMessage("当前账号没有编辑品牌增长报告的权限。");
      return;
    }
    if (!reportWorkspace.latest?.id) {
      setErrorMessage("请先生成品牌增长报告，再进行保存。");
      return;
    }

    if (!reportMarkdownDraft.trim()) {
      setErrorMessage("报告内容不能为空。");
      return;
    }

    setIsSavingReport(true);
    clearMessages();

    try {
      const nextWorkspace = await updateGrowthReport(reportWorkspace.latest.id, reportMarkdownDraft);
      setReportWorkspace(nextWorkspace);
      setNotice("品牌增长报告已保存。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      setErrorMessage(`保存失败：${message}`);
    } finally {
      setIsSavingReport(false);
    }
  }

  async function handleGenerateVisualReport() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.visualGrowthReport"]?.edit) {
      setErrorMessage("当前账号没有生成可视化报告的编辑权限。");
      return;
    }
    if (!canGenerateVisualGrowthReport) {
      setErrorMessage("请先生成品牌增长报告，再生成品牌增长可视化报告。");
      return;
    }

    setIsGeneratingVisualReport(true);
    clearMessages();

    try {
      const nextWorkspace = await generateVisualGrowthReport(archive.brand.id);
      setVisualReportWorkspace(nextWorkspace);
      setNotice("已提交可视化报告生成任务，正在后台生成。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败";
      setErrorMessage(`生成失败：${message}`);
    } finally {
      setIsGeneratingVisualReport(false);
    }
  }

  function handleOpenAnnualMarketingPlanGenerateDialog() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.halfYearMarketingPlan"]?.edit) {
      setErrorMessage("当前账号没有生成半年营销规划的编辑权限。");
      return false;
    }
    if (!canGenerateAnnualMarketingPlan) {
      setErrorMessage("请先生成品牌增长报告，再生成半年营销规划。");
      return false;
    }
    clearMessages();
    setReportGenerationModal("annualMarketingPlan");
    return true;
  }

  async function handleGenerateAnnualMarketingPlan() {
    if (!handleOpenAnnualMarketingPlanGenerateDialog()) {
      return;
    }
  }

  async function handleSubmitAnnualMarketingPlan() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.halfYearMarketingPlan"]?.edit) {
      setErrorMessage("当前账号没有生成半年营销规划的编辑权限。");
      return;
    }
    if (!canGenerateAnnualMarketingPlan) {
      setErrorMessage("请先生成品牌增长报告，再生成半年营销规划。");
      return;
    }

    setIsGeneratingAnnualMarketingPlan(true);
    clearMessages();

    try {
      const nextWorkspace = await generateAnnualMarketingPlan(
        buildUserRequirementPayload(annualMarketingPlanUserRequirement),
        archive.brand.id,
      );
      setAnnualMarketingPlanWorkspace(nextWorkspace);
      setReportGenerationModal(null);
      setAnnualMarketingPlanUserRequirement("");
      setNotice("已提交半年营销规划生成任务，正在后台生成。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败";
      setErrorMessage(`生成失败：${message}`);
    } finally {
      setIsGeneratingAnnualMarketingPlan(false);
    }
  }

  function handleOpenMarketingCalendarGenerateDialog() {
    if (!brandPermissionSettings?.currentUserPermissions["xiaohongshu.calendar"]?.edit) {
      setErrorMessage("当前账号没有营销日历板块的编辑权限。");
      return false;
    }
    if (!hasBrandBackgroundForMarketingCalendar) {
      setErrorMessage("请先补齐品牌背景资料。");
      return false;
    }
    if (!reportWorkspace.latest) {
      setErrorMessage("请先生成品牌增长报告。");
      return false;
    }
    if (!hasOpportunityFinalReportForMarketingCalendar) {
      setErrorMessage("请先生成机会洞察总报告。");
      return false;
    }
    clearMessages();
    setReportGenerationModal("marketingCalendar");
    return true;
  }

  async function handleGenerateMarketingCalendar() {
    if (!handleOpenMarketingCalendarGenerateDialog()) {
      return;
    }
  }

  async function handleSubmitMarketingCalendar() {
    if (!brandPermissionSettings?.currentUserPermissions["xiaohongshu.calendar"]?.edit) {
      setErrorMessage("当前账号没有营销日历板块的编辑权限。");
      return;
    }
    if (!hasBrandBackgroundForMarketingCalendar) {
      setErrorMessage("请先补齐品牌背景资料。");
      return;
    }
    if (!reportWorkspace.latest) {
      setErrorMessage("请先生成品牌增长报告。");
      return;
    }
    if (!hasOpportunityFinalReportForMarketingCalendar) {
      setErrorMessage("请先生成机会洞察总报告。");
      return;
    }

    setIsGeneratingMarketingCalendar(true);
    clearMessages();

    try {
      const nextWorkspace = await generateXiaohongshuMarketingCalendar(
        buildUserRequirementPayload(marketingCalendarUserRequirement),
        archive.brand.id,
      );
      setMarketingCalendarWorkspace(nextWorkspace);
      setReportGenerationModal(null);
      setMarketingCalendarUserRequirement("");
      setNotice("已提交后台生成任务，正在生成接下来 7 天营销日历。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败";
      setErrorMessage(`生成失败：${message}`);
    } finally {
      setIsGeneratingMarketingCalendar(false);
    }
  }

  function handleOpenCalendarDetail(date: string, itemId?: string) {
    const item = itemId ? calendarAllItems.find((entry) => entry.id === itemId) : calendarAllItems.find((entry) => entry.date === date);
    setSelectedCalendarItemId(item?.id || "");
    setSelectedCalendarDate(item?.date || date);
    setCalendarItemDraft(item ? cloneMarketingCalendarItem(item) : createEmptyMarketingCalendarItem(date));
    setIsEditingCalendarItem(!item);
    setIsCalendarDetailOpen(true);
  }

  function handleCloseCalendarDetail() {
    setIsCalendarDetailOpen(false);
    setSelectedCalendarItemId("");
    setSelectedCalendarDate("");
    setIsEditingCalendarItem(false);
    setCalendarItemDraft(null);
  }

  function handleStartEditCalendarItem() {
    if (!selectedCalendarItem && !calendarItemDraft) {
      return;
    }
    setCalendarItemDraft(cloneMarketingCalendarItem(selectedCalendarItem || calendarItemDraft!));
    setIsEditingCalendarItem(true);
  }

  function handleCancelEditCalendarItem() {
    if (selectedCalendarItem) {
      setCalendarItemDraft(cloneMarketingCalendarItem(selectedCalendarItem));
      setIsEditingCalendarItem(false);
      return;
    }
    if (selectedCalendarDate) {
      setCalendarItemDraft(createEmptyMarketingCalendarItem(selectedCalendarDate));
      setIsEditingCalendarItem(true);
    }
  }

  function handleCalendarItemFieldChange(path: string, value: string) {
    setCalendarItemDraft((current) => (current ? updateMarketingCalendarItemByPath(current, path, value) : current));
  }

  function handleCalendarItemListFieldChange(path: string, value: string) {
    setCalendarItemDraft((current) =>
      current
        ? updateMarketingCalendarItemByPath(
            current,
            path,
            value
              .split(/\n|,|，/)
              .map((item) => item.trim())
              .filter(Boolean),
          )
        : current,
    );
  }

  async function handleSaveCalendarItem() {
    if (!brandPermissionSettings?.currentUserPermissions["xiaohongshu.calendar"]?.edit) {
      setErrorMessage("当前账号没有营销日历板块的编辑权限。");
      return;
    }
    if (!latestCalendar || !calendarItemDraft) {
      setErrorMessage("当前还没有可保存的营销日历选题。");
      return;
    }
    const normalizedDraft = normalizeEditableMarketingCalendarItem(calendarItemDraft);
    if (!normalizedDraft.date.trim()) {
      setErrorMessage("请先填写日期。");
      return;
    }
    const hasPrimaryTopic = Boolean(
      normalizedDraft.brandMarketing.theme
      || normalizedDraft.xiaohongshu.brandAccount.topic
      || normalizedDraft.xiaohongshu.employeeAccount.topic
      || normalizedDraft.douyin.brandAccount.topic
      || normalizedDraft.douyin.ipAccount.topic
      || normalizedDraft.douyin.employeeAccount.topic
      || normalizedDraft.moments.topic,
    );
    if (!hasPrimaryTopic) {
      setErrorMessage("请至少填写一个当天营销主题或平台选题。");
      return;
    }

    setIsSavingCalendarItem(true);
    clearMessages();
    try {
      const nextWorkspace = await upsertXiaohongshuMarketingCalendarItem(
        latestCalendar.id,
        normalizedDraft.date,
        normalizedDraft,
        latestCalendar.title,
        archive.brand.id,
      );
      setMarketingCalendarWorkspace(nextWorkspace);
      const nextSelectedItem =
        nextWorkspace.latest?.items.find((item) => item.id === normalizedDraft.id || item.date === normalizedDraft.date)
        || normalizedDraft;
      setSelectedCalendarItemId(nextSelectedItem.id);
      setSelectedCalendarDate(nextSelectedItem.date);
      setCalendarItemDraft(cloneMarketingCalendarItem(nextSelectedItem));
      setIsEditingCalendarItem(false);
      setNotice("营销日历已保存。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      setErrorMessage(`保存失败：${message}`);
    } finally {
      setIsSavingCalendarItem(false);
    }
  }

  async function handleSyncDailyHotspotWorkspace(platformTitles?: string[]) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.dailyHotspot"]?.edit) {
      setErrorMessage("当前账号没有同步每日热点的编辑权限。");
      return;
    }
    setIsSyncingDailyHotspots(true);
    clearMessages();

    try {
      const response = await syncDailyHotspots(platformTitles, archive.brand.id);
      setDailyHotspotWorkspace(response.workspace);
      setSelectedHotspotDate(response.workspace.selectedDate || getDefaultHotspotDate());
      setNotice(
        response.syncedCount
          ? `每日热点搜索完成，已更新热搜榜结果。`
          : "每日热点搜索已执行，但当前接口返回失败，请检查 API Key 权限或稍后重试。",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "搜索失败";
      setErrorMessage(`每日热点搜索失败：${message}`);
    } finally {
      setIsSyncingDailyHotspots(false);
    }
  }

  async function handleDailyHotspotDateChange(date: string) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.dailyHotspot"]?.view) {
      setErrorMessage("当前账号没有查看每日热点的权限。");
      return;
    }
    setSelectedHotspotDate(date);
    setIsSyncingDailyHotspots(true);
    clearMessages();

    try {
      const workspace = await getDailyHotspotWorkspace(archive.brand.id, date);
      setDailyHotspotWorkspace(workspace);
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取失败";
      setErrorMessage(`热点日期切换失败：${message}`);
    } finally {
      setIsSyncingDailyHotspots(false);
    }
  }

  async function handleDouyinTopicDateChange(date: string) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.topicLibrary"]?.view) {
      setErrorMessage("当前账号没有查看选题库的权限。");
      return;
    }
    setSelectedDouyinTopicDate(date);
    clearMessages();
    await refreshDouyinTopicLibraryWorkspace(date);
  }

  async function handleGenerateDouyinTopicCandidates() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.topicLibrary"]?.edit) {
      setErrorMessage("当前账号没有编辑选题库的权限。");
      return;
    }
    if (!selectedDouyinTopicDate) {
      setErrorMessage("请先选择热点日期。");
      return;
    }
    setIsGeneratingDouyinTopicCandidates(true);
    clearMessages();

    try {
      const nextWorkspace = await generateDouyinHotTopicCandidates(selectedDouyinTopicDate, archive.brand.id);
      setDouyinTopicLibraryWorkspace(nextWorkspace);
      setSelectedDouyinTopicIds([]);
      setNotice("已提交热点选题生成任务，正在后台生成。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败";
      setErrorMessage(`热点选题生成失败：${message}`);
    } finally {
      setIsGeneratingDouyinTopicCandidates(false);
    }
  }

  function handleToggleDouyinTopic(topicId: string, checked: boolean) {
    setSelectedDouyinTopicIds((current) => (
      checked ? [...new Set([...current, topicId])] : current.filter((item) => item !== topicId)
    ));
  }

  async function handleAddSelectedDouyinTopics() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.topicLibrary"]?.edit) {
      setErrorMessage("当前账号没有编辑选题库的权限。");
      return;
    }
    if (!selectedDouyinTopicIds.length) {
      setErrorMessage("请先勾选要加入选题库的选题。");
      return;
    }
    if (!latestDouyinTopicResult?.items?.length) {
      setErrorMessage("当前没有可加入的热点选题，请先生成。");
      return;
    }

    clearMessages();
    try {
      const existing = douyinTopicLibraryWorkspace.topicLibrary || [];
      const selectedItems = latestDouyinTopicResult.items.filter((item) => selectedDouyinTopicIds.includes(item.id));
      const additions: DouyinTopicLibraryItem[] = selectedItems.map((item, index) => ({
        id: item.id,
        topicTitle: item.title.trim(),
        topicContent: item.title.trim(),
        topicPlatform: "抖音",
        contentFormat: "视频",
        presentationFormat: "结合热点切口包装为短视频选题",
        topicGoal: "提升内容曝光与互动效率",
        expertSkill: "",
        reusable: false,
        topicDescription: item.description?.trim() || latestDouyinTopicResult.summary || `来自 ${selectedDouyinTopicDate} 热点选题`,
        selectedAt: new Date().toISOString(),
        source: "GENERATED",
        sourceDate: selectedDouyinTopicDate || undefined,
      }));
      const deduped = [...existing];
      for (const addition of additions) {
        if (!deduped.some((item) => item.id === addition.id || item.topicContent === addition.topicContent)) {
          deduped.push(addition);
        }
      }
      await saveDouyinTopicLibrary(deduped);
      setSelectedDouyinTopicIds([]);
      setNotice("已加入选题库。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      setErrorMessage(`加入选题库失败：${message}`);
    }
  }

  async function handleSaveDouyinTopic(item: DouyinTopicLibraryItem) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.topicLibrary"]?.edit) {
      setErrorMessage("当前账号没有编辑选题库的权限。");
      return;
    }
    clearMessages();
    try {
      const existing = douyinTopicLibraryWorkspace.topicLibrary || [];
      const nextItems = existing.some((current) => current.id === item.id)
        ? existing.map((current) => (current.id === item.id ? item : current))
        : [item, ...existing];
      await saveDouyinTopicLibrary(nextItems);
      setNotice(existing.some((current) => current.id === item.id) ? "已更新选题。" : "已添加选题。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      setErrorMessage(`保存选题失败：${message}`);
    }
  }

  async function handleDeleteDouyinTopic(topicId: string) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.topicLibrary"]?.edit) {
      setErrorMessage("当前账号没有编辑选题库的权限。");
      return;
    }
    clearMessages();
    try {
      const nextItems = (douyinTopicLibraryWorkspace.topicLibrary || []).filter((item) => item.id !== topicId);
      await saveDouyinTopicLibrary(nextItems);
      setNotice("已删除选题。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      setErrorMessage(`删除选题失败：${message}`);
    }
  }

  async function handleSaveFeishuBinding() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有编辑小红书收集数据的权限。");
      return;
    }
    if (!feishuBindingForm.wikiUrl.trim()) {
      setErrorMessage("请先粘贴飞书副本链接。");
      return;
    }

    setIsSavingFeishuBinding(true);
    clearMessages();

    try {
      const nextBinding = await upsertBrandFeishuBinding(archive.brand.id, {
        wikiUrl: feishuBindingForm.wikiUrl.trim(),
        templateUrl: FEISHU_XHS_TEMPLATE_URL,
      });
      setFeishuBinding(nextBinding);
      setFeishuBindingForm(createFeishuBindingFormFromRecord(nextBinding));
      setNotice("飞书副本链接已保存，后续可直接从飞书同步。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "绑定失败";
      setErrorMessage(`飞书副本绑定失败：${message}`);
    } finally {
      setIsSavingFeishuBinding(false);
    }
  }

  async function handleSaveFeishuAppConfig() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有编辑小红书收集数据的权限。");
      return;
    }
    if (!feishuAppConfigForm.appId.trim() || !feishuAppConfigForm.appSecret.trim()) {
      setErrorMessage("请先填写当前用户自己的 App ID 和 App Secret。");
      return;
    }

    setIsSavingFeishuAppConfig(true);
    clearMessages();

    try {
      const nextConfig = await upsertFeishuAppConfig({
        appId: feishuAppConfigForm.appId.trim(),
        appSecret: feishuAppConfigForm.appSecret.trim(),
        redirectUri: feishuAppConfigForm.redirectUri.trim() || undefined,
        scope: feishuAppConfigForm.scope.trim() || undefined,
      }, currentUser?.id);
      setFeishuAppConfig(nextConfig);
      setFeishuAppConfigForm(createFeishuAppConfigFormFromRecord(nextConfig));
      const nextStatus = await getFeishuAuthStatus(currentUser?.id).catch(() => null);
      setFeishuAuthStatus(nextStatus);
      setNotice("已保存当前用户自己的飞书开放平台应用配置。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      setErrorMessage(`飞书应用配置保存失败：${message}`);
    } finally {
      setIsSavingFeishuAppConfig(false);
    }
  }

  async function handleSyncFeishuWorkspace() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有同步小红书收集数据的编辑权限。");
      return;
    }
    if (!feishuBinding?.wikiUrl) {
      setErrorMessage("请先绑定飞书多维表格链接。");
      return;
    }
    if (!feishuAuthStatus?.connected) {
      setErrorMessage("请先连接当前用户自己的飞书账号，再执行同步。");
      return;
    }

    setIsSyncingFeishuWorkspace(true);
    clearMessages();

    try {
      const response = await syncXiaohongshuFromFeishu(activeBrandId || archive.brand.id);
      setCollectionWorkspace(response.workspace);
      await loadArchive({ targetPage: activePage, force: true });
      setCollectionWorkspace((current) => {
        if (!current.benchmarkNotes.length && response.workspace.benchmarkNotes.length) {
          return response.workspace;
        }
        return current;
      });
      const benchmarkTableName = response.matchedTables.benchmarkNotes?.tableName || "未命中";
      const benchmarkSyncedCount = response.syncBreakdown.benchmarkNotes;
      const benchmarkWorkspaceCount = response.workspaceCounts.benchmarkNotes;
      setNotice(
        `飞书同步完成，已更新 ${response.syncedCount} 条结果，命中 ${response.tableCount} 张数据表。对标作品表：${benchmarkTableName}；本次同步 ${benchmarkSyncedCount} 条；当前工作区 ${benchmarkWorkspaceCount} 条。`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      setErrorMessage(`飞书同步失败：${message}`);
    } finally {
      setIsSyncingFeishuWorkspace(false);
    }
  }

  async function handleSyncXhsWorkspace() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有同步小红书收集数据的编辑权限。");
      return;
    }

    const payload: XhsSyncPayload = {};
    let requestLabel = "";
    if (activeXhsCollectionCard === "brandAccount") {
      payload.accountEntries = buildXhsSyncAccountEntries(xhsSyncForm.brandAccountEntries);
      requestLabel = "品牌账号";
    }
    if (activeXhsCollectionCard === "competitorAccount") {
      payload.accountEntries = buildXhsSyncAccountEntries(xhsSyncForm.competitorAccountEntries);
      requestLabel = "竞品账号";
    }
    if (activeXhsCollectionCard === "brandWorks") {
      payload.accountEntries = buildXhsSyncAccountEntries(xhsSyncForm.brandAccountEntries);
      requestLabel = "品牌作品";
    }
    if (activeXhsCollectionCard === "benchmarkWorks") {
      payload.sourceUrls = parseDouyinSyncLines(xhsSyncForm.benchmarkNoteLocators);
      requestLabel = "对标作品";
    }
    if (activeXhsCollectionCard === "searchNotes") {
      requestLabel = "搜索笔记";
    }

    if (activeXhsCollectionCard === "brandAccount" && !payload.accountEntries?.length) {
      setErrorMessage("请先添加至少一个品牌账号后再提交。");
      return;
    }
    if (activeXhsCollectionCard === "competitorAccount" && !payload.accountEntries?.length) {
      setErrorMessage("请先添加至少一个竞品账号后再提交。");
      return;
    }
    if (activeXhsCollectionCard === "brandWorks" && !payload.accountEntries?.length) {
      setErrorMessage("请先在品牌账号信息里添加至少一个品牌账号后再提交。");
      return;
    }
    if (activeXhsCollectionCard === "searchNotes") {
      return;
    }

    setIsSyncingXhsWorkspace(true);
    clearMessages();

    try {
      const response =
        activeXhsCollectionCard === "brandAccount"
          ? await syncXiaohongshuBrandAccounts(payload, activeBrandId || archive.brand.id)
          : activeXhsCollectionCard === "competitorAccount"
            ? await syncXiaohongshuCompetitorAccounts(payload, activeBrandId || archive.brand.id)
            : activeXhsCollectionCard === "brandWorks"
              ? await syncXiaohongshuBrandNotes(payload, activeBrandId || archive.brand.id)
              : await syncXiaohongshuBenchmarkNotes(payload.sourceUrls || [], activeBrandId || archive.brand.id);
      setCollectionWorkspace(response.workspace);
      setNotice(`${requestLabel}采集完成，已更新 ${response.syncedCount} 条结果。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "采集失败";
      setErrorMessage(`${requestLabel || "小红书"}采集失败：${message}`);
    } finally {
      setIsSyncingXhsWorkspace(false);
    }
  }

  async function handleSyncXhsSearchNotes() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有同步小红书收集数据的编辑权限。");
      return;
    }

    const keyword = xhsSyncForm.searchKeyword.trim();
    if (!keyword) {
      setErrorMessage("请先输入搜索关键词后再提交。");
      return;
    }

    setIsSyncingXhsWorkspace(true);
    clearMessages();

    try {
      const response = await syncXiaohongshuSearchNotes(keyword, activeBrandId || archive.brand.id);
      setCollectionWorkspace(response.workspace);
      setNotice(`搜索笔记采集完成，关键词“${keyword}”已更新 ${response.syncedCount} 条结果。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "采集失败";
      setErrorMessage(`搜索笔记采集失败：${message}`);
    } finally {
      setIsSyncingXhsWorkspace(false);
    }
  }

  async function handleSyncXhsCommentData() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有同步小红书收集数据的编辑权限。");
      return;
    }

    const sourceUrls = parseDouyinSyncLines(xhsSyncForm.commentSourceUrls);
    if (!sourceUrls.length) {
      setErrorMessage("请先输入至少一个小红书笔记链接或 note_id。");
      return;
    }

    setIsSyncingXhsWorkspace(true);
    clearMessages();

    try {
      const response = await syncXiaohongshuCommentData(
        { sourceUrls },
        activeBrandId || archive.brand.id,
      );
      setCollectionWorkspace(response.workspace);
      setXhsCommentPagination(response.commentPagination ?? []);
      setExpandedXhsCommentIds([]);
      setXhsSubCommentsByParent({});
      setXhsSubCommentPaginationMap({});
      const continueCount = (response.commentPagination ?? []).filter((item) => item.hasMore).length;
      const summary = `小红书评论数据采集完成，已更新 ${response.syncedCount} 条评论，可继续翻页的笔记 ${continueCount} 个。`;
      const warningText = response.warnings?.filter(Boolean).join("；");
      setNotice(warningText ? `${summary} 部分请求未完全成功：${warningText}` : summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "采集失败";
      setErrorMessage(`小红书评论数据采集失败：${message}`);
    } finally {
      setIsSyncingXhsWorkspace(false);
    }
  }

  async function handleLoadMoreXhsComments() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有同步小红书收集数据的编辑权限。");
      return;
    }

    const pageRequests = xhsCommentPagination
      .filter((item) => item.hasMore)
      .map((item) => ({
        sourceUrl: item.sourceUrl,
        cursor: item.nextCursor,
        index: item.nextIndex,
      }));

    if (!pageRequests.length) {
      setNotice("当前小红书评论已经没有更多可加载内容。");
      return;
    }

    setIsLoadingMoreXhsComments(true);
    clearMessages();

    try {
      const response = await syncXiaohongshuCommentData(
        { pageRequests },
        activeBrandId || archive.brand.id,
      );
      setCollectionWorkspace(response.workspace);
      setXhsCommentPagination(response.commentPagination ?? []);
      const continueCount = (response.commentPagination ?? []).filter((item) => item.hasMore).length;
      const summary = `小红书评论数据已继续加载 ${response.syncedCount} 条，仍可继续翻页的笔记 ${continueCount} 个。`;
      const warningText = response.warnings?.filter(Boolean).join("；");
      setNotice(warningText ? `${summary} 部分请求未完全成功：${warningText}` : summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载失败";
      setErrorMessage(`小红书评论加载更多失败：${message}`);
    } finally {
      setIsLoadingMoreXhsComments(false);
    }
  }

  async function handleSyncXhsTargetUsers() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有同步小红书收集数据的编辑权限。");
      return;
    }

    const sourceUrls = parseDouyinSyncLines(xhsSyncForm.commentSourceUrls);
    if (!sourceUrls.length) {
      setErrorMessage("请先输入至少一个小红书笔记链接或 note_id。");
      return;
    }

    const matchKeywords = parseDouyinSyncLines(xhsSyncForm.targetUserMatchKeywords);
    setIsSyncingXhsWorkspace(true);
    clearMessages();

    try {
      const response = await syncXiaohongshuTargetUsers(
        {
          sourceUrls,
          matchKeywords,
          syncCommentsFirst: true,
        },
        activeBrandId || archive.brand.id,
      );
      setCollectionWorkspace(response.workspace);
      const summary = `小红书评论用户账号提取完成，已更新 ${response.syncedCount} 条目标用户。`;
      const keywordText = matchKeywords.length ? ` 关键词：${matchKeywords.join("、")}。` : " 未设置关键词，已提取全部评论用户。";
      const warningText = response.warnings?.filter(Boolean).join("；");
      setNotice(warningText ? `${summary}${keywordText} 部分请求未完全成功：${warningText}` : `${summary}${keywordText}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "提取失败";
      setErrorMessage(`小红书评论用户账号提取失败：${message}`);
    } finally {
      setIsSyncingXhsWorkspace(false);
    }
  }

  function handleToggleXhsCommentReplies(commentId: string) {
    setExpandedXhsCommentIds((current) =>
      current.includes(commentId)
        ? current.filter((item) => item !== commentId)
        : [...current, commentId],
    );
  }

  async function handleLoadXhsCommentReplies(comment: XhsCommentRecord, loadMore = false) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有同步小红书收集数据的编辑权限。");
      return;
    }

    const commentId = comment.commentId;
    const currentPagination = xhsSubCommentPaginationMap[commentId];
    const isMore = loadMore === true;
    if (
      isMore
      && (!currentPagination || !currentPagination.hasMore)
    ) {
      setNotice("当前一级评论已经没有更多二级评论可加载。");
      return;
    }

    if (isMore) {
      setLoadingMoreXhsSubCommentIds((current) => [...current, commentId]);
    } else {
      setLoadingXhsSubCommentIds((current) => [...current, commentId]);
    }
    clearMessages();

    try {
      const response = await getXiaohongshuCommentReplies(
        {
          sourceUrl: comment.sourceUrl || comment.noteUrl,
          commentId,
          cursor: isMore ? currentPagination?.nextCursor : undefined,
          index: isMore ? currentPagination?.nextIndex : undefined,
        },
        activeBrandId || archive.brand.id,
      );
      setXhsSubCommentsByParent((current) => ({
        ...current,
        [commentId]: isMore
          ? dedupeXhsSubComments([...(current[commentId] ?? []), ...(response.items ?? [])])
          : (response.items ?? []),
      }));
      setXhsSubCommentPaginationMap((current) => ({
        ...current,
        [commentId]: response.pagination,
      }));
      setExpandedXhsCommentIds((current) => (current.includes(commentId) ? current : [...current, commentId]));
      setNotice(
        isMore
          ? `已继续加载一级评论 ${commentId} 的二级评论 ${response.items.length} 条。`
          : `已加载一级评论 ${commentId} 的二级评论 ${response.items.length} 条。`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载失败";
      setErrorMessage(`二级评论加载失败：${message}`);
    } finally {
      if (isMore) {
        setLoadingMoreXhsSubCommentIds((current) => current.filter((item) => item !== commentId));
      } else {
        setLoadingXhsSubCommentIds((current) => current.filter((item) => item !== commentId));
      }
    }
  }

  async function handleSyncSingleXhsBrandAccount(entry: XhsAccountBindingEntry) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有同步小红书收集数据的编辑权限。");
      return;
    }

    const normalizedLocator = entry.locator.trim();
    if (!normalizedLocator) {
      setErrorMessage("账号链接或 user_id 不能为空。");
      return;
    }

    setIsSyncingXhsWorkspace(true);
    clearMessages();

    try {
      const normalizedEntry: XhsAccountBindingEntry = {
        ...entry,
        locator: normalizedLocator,
        accountRole: normalizeXhsAccountRole(entry.accountRole),
        id: entry.id || buildXhsAccountEntryId(normalizedLocator, "brand"),
      };
      const response = await syncXiaohongshuBrandAccounts(
        {
          accountEntries: buildXhsSyncAccountEntries([normalizedEntry]),
        },
        activeBrandId || archive.brand.id,
      );
      setCollectionWorkspace(response.workspace);
      setXhsSyncForm((current) => ({
        ...current,
        brandAccountEntries: upsertXhsAccountEntries(current.brandAccountEntries, normalizedEntry, "brand"),
      }));
      setNotice(
        `${getXhsAccountRoleLabel(normalizedEntry.accountRole)}采集完成，已更新 ${response.syncedCount} 条结果。`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "采集失败";
      setErrorMessage(`品牌账号采集失败：${message}`);
    } finally {
      setIsSyncingXhsWorkspace(false);
    }
  }

  async function handleSyncAllXhsBrandAccounts() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有同步小红书收集数据的编辑权限。");
      return;
    }

    const accountEntries = buildXhsSyncAccountEntries(xhsSyncForm.brandAccountEntries);
    if (!accountEntries.length) {
      setErrorMessage("请先添加至少一个品牌账号后再同步。");
      return;
    }

    setIsSyncingXhsWorkspace(true);
    clearMessages();

    try {
      const response = await syncXiaohongshuBrandAccounts(
        { accountEntries },
        activeBrandId || archive.brand.id,
      );
      setCollectionWorkspace(response.workspace);
      setNotice(`品牌账号信息同步完成，已更新 ${response.syncedCount} 条结果。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      setErrorMessage(`品牌账号信息同步失败：${message}`);
    } finally {
      setIsSyncingXhsWorkspace(false);
    }
  }

  async function handleSyncSingleXhsCompetitorAccount(entry: XhsAccountBindingEntry) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有同步小红书收集数据的编辑权限。");
      return;
    }

    const normalizedLocator = entry.locator.trim();
    if (!normalizedLocator) {
      setErrorMessage("账号链接或 user_id 不能为空。");
      return;
    }

    setIsSyncingXhsWorkspace(true);
    clearMessages();

    try {
      const normalizedEntry: XhsAccountBindingEntry = {
        ...entry,
        locator: normalizedLocator,
        id: entry.id || buildXhsAccountEntryId(normalizedLocator, "competitor"),
      };
      const response = await syncXiaohongshuCompetitorAccounts(
        {
          accountEntries: buildXhsSyncAccountEntries([normalizedEntry]),
        },
        activeBrandId || archive.brand.id,
      );
      setCollectionWorkspace(response.workspace);
      setXhsSyncForm((current) => ({
        ...current,
        competitorAccountEntries: upsertXhsAccountEntries(current.competitorAccountEntries, normalizedEntry, "competitor"),
      }));
      setNotice(`竞品账号采集完成，已更新 ${response.syncedCount} 条结果。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "采集失败";
      setErrorMessage(`竞品账号采集失败：${message}`);
    } finally {
      setIsSyncingXhsWorkspace(false);
    }
  }

  async function handleAddBenchmarkNoteToMaterial(assetId: string) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有编辑小红书收集数据的权限。");
      return;
    }
    if (!assetId) {
      return;
    }

    setAddingMaterialAssetId(assetId);
    clearMessages();

    try {
      const response = await addBenchmarkNoteToMaterialLibrary(assetId, activeBrandId || archive.brand.id);
      setCollectionWorkspace(response.workspace);
      setNotice("已加入统一素材库。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "加入素材库失败";
      setErrorMessage(`加入素材库失败：${message}`);
    } finally {
      setAddingMaterialAssetId("");
    }
  }

  async function handleDeleteXhsCollectedNote(assetId: string) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.xiaohongshuCollection"]?.edit) {
      setErrorMessage("当前账号没有编辑小红书收集数据的权限。");
      return;
    }
    if (!assetId) {
      return;
    }

    clearMessages();
    try {
      const response = await deleteXhsCollectedNote(assetId, activeBrandId || archive.brand.id);
      setCollectionWorkspace(response.workspace);
      setNotice("已删除小红书作品。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      setErrorMessage(`删除小红书作品失败：${message}`);
    }
  }

  async function handleToggleDouyinBenchmarkWorkMaterial(item: DouyinCollectionWorkspace["benchmarkWorks"][number]) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有编辑抖音收集数据的权限。");
      return;
    }
    if (!item.id) {
      return;
    }

    setAddingMaterialAssetId(item.id);
    clearMessages();

    try {
      const response = item.isInMaterialLibrary
        ? await removeDouyinBenchmarkWorkFromMaterialLibrary(item.id, activeBrandId || archive.brand.id)
        : await addDouyinBenchmarkWorkToMaterialLibrary(item.id, activeBrandId || archive.brand.id);
      setDouyinCollectionWorkspace(response.workspace);
      setNotice(item.isInMaterialLibrary ? "已从统一素材库移除。" : "已加入统一素材库。");
    } catch (error) {
      const message = error instanceof Error ? error.message : item.isInMaterialLibrary ? "移出素材库失败" : "加入素材库失败";
      setErrorMessage(item.isInMaterialLibrary ? `移出统一素材库失败：${message}` : `加入统一素材库失败：${message}`);
    } finally {
      setAddingMaterialAssetId("");
    }
  }

  async function handleDeleteDouyinCollectedWork(assetId: string) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有编辑抖音收集数据的权限。");
      return;
    }
    if (!assetId) {
      return;
    }

    clearMessages();
    try {
      const response = await deleteDouyinCollectedWork(assetId, activeBrandId || archive.brand.id);
      setDouyinCollectionWorkspace(response.workspace);
      setNotice("已删除抖音作品。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      setErrorMessage(`删除抖音作品失败：${message}`);
    }
  }

  async function handleDeleteDouyinBrandAccount(account: DouyinCollectedAccountRecord) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有编辑抖音收集数据的权限。");
      return;
    }
    if (!account.id) {
      return;
    }

    setDeletingDouyinAccountId(account.id);
    clearMessages();
    try {
      const response = await deleteDouyinBrandAccount(account.id, activeBrandId || archive.brand.id);
      setDouyinCollectionWorkspace(response.workspace);
      setDouyinSyncForm((current) => ({
        ...current,
        brandAccountEntries: current.brandAccountEntries.filter((entry) => !doesDouyinAccountMatchEntryForWorkspace(account, entry)),
      }));
      setNotice("已删除品牌抖音账号。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      setErrorMessage(`删除品牌抖音账号失败：${message}`);
    } finally {
      setDeletingDouyinAccountId("");
    }
  }

  async function handleDeleteDouyinCompetitorAccount(account: DouyinCollectedAccountRecord) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有编辑抖音收集数据的权限。");
      return;
    }
    if (!account.id) {
      return;
    }

    setDeletingDouyinAccountId(account.id);
    clearMessages();
    try {
      const response = await deleteDouyinCompetitorAccount(account.id, activeBrandId || archive.brand.id);
      setDouyinCollectionWorkspace(response.workspace);
      setDouyinSyncForm((current) => ({
        ...current,
        competitorAccountEntries: current.competitorAccountEntries.filter((entry) => !doesDouyinAccountMatchEntryForWorkspace(account, entry)),
      }));
      setNotice("已删除竞品抖音账号。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      setErrorMessage(`删除竞品抖音账号失败：${message}`);
    } finally {
      setDeletingDouyinAccountId("");
    }
  }

  async function handleDeleteOpenClawDiary(diaryId: string) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.topicLibrary"]?.edit) {
      setErrorMessage("当前账号没有删除龙虾日记的权限。");
      return;
    }
    if (!diaryId) {
      return;
    }

    setDeletingOpenClawLobsterDiaryId(diaryId);
    clearMessages();
    try {
      const response = await deleteOpenClawLobsterDiary(diaryId, activeBrandId || archive.brand.id, "brand_growth");
      setOpenClawLobsterDiaryWorkspace(response.workspace);
      setNotice("已删除每周复盘。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      setErrorMessage(`删除每周复盘失败：${message}`);
    } finally {
      setDeletingOpenClawLobsterDiaryId("");
    }
  }

  async function handleUpdateOpenClawDiary(
    diaryId: string,
    payload: {
      diaryDate: string;
      title: string;
      content: string;
    },
  ) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.topicLibrary"]?.edit) {
      throw new Error("当前账号没有编辑每周复盘的权限。");
    }
    if (!diaryId) {
      throw new Error("缺少每周复盘 ID。");
    }

    setUpdatingOpenClawLobsterDiaryId(diaryId);
    clearMessages();
    try {
      const response = await updateOpenClawLobsterDiary(diaryId, activeBrandId || archive.brand.id, {
        workspaceScope: "brand_growth",
        ...payload,
      });
      setOpenClawLobsterDiaryWorkspace(response.workspace);
      setNotice("每周复盘已保存。");
      return response.item;
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      setErrorMessage(`保存每周复盘失败：${message}`);
      throw error;
    } finally {
      setUpdatingOpenClawLobsterDiaryId("");
    }
  }

  async function handleDeleteOpenClawDailyPlan(planId: string) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.topicLibrary"]?.edit) {
      setErrorMessage("当前账号没有删除每日计划的权限。");
      return;
    }
    if (!planId) {
      return;
    }

    setDeletingOpenClawDailyPlanId(planId);
    clearMessages();
    try {
      const response = await deleteOpenClawDailyPlan(planId, activeBrandId || archive.brand.id, "brand_growth");
      setOpenClawDailyPlanWorkspace(response.workspace);
      setNotice("已删除每日计划。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      setErrorMessage(`删除每日计划失败：${message}`);
    } finally {
      setDeletingOpenClawDailyPlanId("");
    }
  }

  async function handleDeleteOpenClawExplosiveAnalysis(recordId: string) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.report.topicLibrary"]?.edit) {
      setErrorMessage("当前账号没有删除爆款拆解的权限。");
      return;
    }
    if (!recordId) {
      return;
    }

    setDeletingOpenClawExplosiveAnalysisId(recordId);
    clearMessages();
    try {
      const response = await deleteOpenClawExplosiveAnalysis(recordId, activeBrandId || archive.brand.id, "brand_growth");
      setOpenClawExplosiveAnalysisWorkspace(response.workspace);
      setNotice("已删除爆款拆解。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      setErrorMessage(`删除爆款拆解失败：${message}`);
    } finally {
      setDeletingOpenClawExplosiveAnalysisId("");
    }
  }

  async function handleAddWechatBenchmarkArticleToMaterial(articleId: string) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.wechatMpCollection"]?.edit) {
      setErrorMessage("当前账号没有编辑公众号收集数据的权限。");
      return;
    }
    if (!articleId) {
      return;
    }

    setAddingMaterialAssetId(articleId);
    clearMessages();

    try {
      const response = await addWechatMpBenchmarkArticleToMaterialLibrary(articleId, activeBrandId || archive.brand.id);
      setWechatMpBenchmarkWorkspace(response.workspace);
      setNotice("已加入统一素材库。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "加入素材库失败";
      setErrorMessage(`加入素材库失败：${message}`);
    } finally {
      setAddingMaterialAssetId("");
    }
  }

  async function handleAddWechatSearchItemToMaterial(itemId: string) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.wechatMpCollection"]?.edit) {
      setErrorMessage("当前账号没有编辑公众号收集数据的权限。");
      return;
    }
    if (!itemId) {
      return;
    }

    setAddingMaterialAssetId(itemId);
    clearMessages();

    try {
      const response = await addWechatSearchItemToMaterialLibrary(itemId, activeBrandId || archive.brand.id);
      setWechatSearchWorkspace(response.workspace);
      setNotice("已加入统一素材库。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "加入素材库失败";
      setErrorMessage(`加入素材库失败：${message}`);
    } finally {
      setAddingMaterialAssetId("");
    }
  }

  async function handleExtractDouyinWorkTranscript(item: DouyinCollectedWorkRecord) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有编辑抖音收集数据的权限。");
      return;
    }
    if (!item.id) {
      return;
    }

    // #region debug-point B:ui-click-extract
    fetch("http://127.0.0.1:7777/event", { method: "POST", body: JSON.stringify({ sessionId: "douyin-transcript-queue", runId: "pre-fix", hypothesisId: "B", location: "brand-growth/workspace.tsx:handleExtractDouyinWorkTranscript:click", msg: "[DEBUG] UI clicked douyin transcript extract", data: { assetId: item.id, transcriptStatus: item.transcriptStatus || "", videoCacheStatus: item.videoCacheStatus || "", hasTranscript: Boolean(item.transcript), activeExtractingAssetId: extractingDouyinTranscriptAssetId || "" }, ts: Date.now() }) }).catch(() => undefined);
    // #endregion
    setExtractingDouyinTranscriptAssetId(item.id);
    clearMessages();

    try {
      const response = await extractDouyinWorkTranscript(item.id, activeBrandId || archive.brand.id);
      setDouyinCollectionWorkspace(response.workspace);
      setNotice("视频文案已开始提取，稍后将自动刷新结果。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "提取失败";
      setErrorMessage(`视频文案提取失败：${message}`);
    } finally {
      setExtractingDouyinTranscriptAssetId("");
    }
  }

  async function handleSyncDouyinWorkspace() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有同步收集数据板块的编辑权限。");
      return;
    }

    setIsSyncingDouyinWorkspace(true);
    clearMessages();

    try {
      if (["creatorSearch", "creatorDeepFetch", "creatorResultPool"].includes(activeDouyinCollectionCard)) {
        setErrorMessage("当前卡片请使用达人抓取专属入口提交。");
        setIsSyncingDouyinWorkspace(false);
        return;
      }
      const payload: DouyinSyncPayload = {
        scope: activeDouyinCollectionCard as DouyinSyncPayload["scope"],
      };
      if (activeDouyinCollectionCard === "brandAccount" || activeDouyinCollectionCard === "brandWorks") {
        payload.brandAccountLinks = douyinSyncForm.brandAccountEntries.map((entry) => entry.locator.trim()).filter(Boolean);
        payload.brandAccountEntries = buildXhsSyncAccountEntries(douyinSyncForm.brandAccountEntries);
      }
      if (activeDouyinCollectionCard === "competitorAccount" || activeDouyinCollectionCard === "competitorWorks") {
        payload.competitorAccountLinks = douyinSyncForm.competitorAccountEntries.map((entry) => entry.locator.trim()).filter(Boolean);
        payload.competitorAccountEntries = buildXhsSyncAccountEntries(douyinSyncForm.competitorAccountEntries);
      }
      if (activeDouyinCollectionCard === "benchmarkWorks") {
        payload.benchmarkAwemeIds = parseDouyinSyncLines(douyinSyncForm.benchmarkAwemeIds);
      }
      if (activeDouyinCollectionCard === "searchWorks") {
        const searchKeyword = douyinSyncForm.searchKeyword.trim();
        if (!searchKeyword) {
          setErrorMessage("请输入关键词后再提交。");
          setIsSyncingDouyinWorkspace(false);
          return;
        }
        payload.searchKeyword = searchKeyword;
        payload.searchSortType = douyinSyncForm.searchSortType;
        payload.searchPublishTime = douyinSyncForm.searchPublishTime;
        payload.searchFilterDuration = douyinSyncForm.searchFilterDuration;
        payload.searchContentType = douyinSyncForm.searchContentType;
      }
      if (activeDouyinCollectionCard === "commentData") {
        const commentSourceUrls = parseDouyinSyncLines(douyinSyncForm.commentSourceUrls);
        if (!commentSourceUrls.length) {
          setErrorMessage("请输入至少一个抖音作品链接后再提交。");
          setIsSyncingDouyinWorkspace(false);
          return;
        }
        payload.commentSourceUrls = commentSourceUrls;
      }
      if (activeDouyinCollectionCard === "brandWorks" && !payload.brandAccountLinks?.length) {
        setErrorMessage("请先在品牌账号信息里添加至少一个品牌抖音账号后再提交。");
        setIsSyncingDouyinWorkspace(false);
        return;
      }
      if (activeDouyinCollectionCard === "competitorWorks" && !payload.competitorAccountLinks?.length) {
        setErrorMessage("请先在竞品账号信息里添加至少一个竞品抖音账号后再提交。");
        setIsSyncingDouyinWorkspace(false);
        return;
      }
      if (
        activeDouyinCollectionCard === "lowFanExplosiveWorks"
        || activeDouyinCollectionCard === "highCompletionRateWorks"
        || activeDouyinCollectionCard === "highLikeRateWorks"
      ) {
        const selection = douyinSyncForm[activeDouyinCollectionCard];
        const primaryTagId = parseOptionalNumericTagId(selection.primaryTagId);
        const secondaryTagId = parseOptionalNumericTagId(selection.secondaryTagId);
        if (!primaryTagId || !secondaryTagId) {
          setErrorMessage("请先选择一级分类和二级分类后再提交。");
          setIsSyncingDouyinWorkspace(false);
          return;
        }
        payload.contentTagSelection = {
          primaryTagId,
          secondaryTagId,
        };
      }
      if (activeDouyinCollectionCard === "cityHotspots") {
        const cityCode = parseOptionalNumericTagId(douyinSyncForm.cityHotspots.cityCode);
        if (!cityCode) {
          setErrorMessage("请先选择城市后再提交。");
          setIsSyncingDouyinWorkspace(false);
          return;
        }
        payload.cityCode = cityCode;
      }
      const response = await syncDouyinCollectionWorkspace(payload, activeBrandId || archive.brand.id);
      setDouyinCollectionWorkspace(response.workspace);
      if (activeDouyinCollectionCard === "commentData") {
        setDouyinCommentPagination(response.commentPagination ?? []);
      }
      const summary =
        `抖音同步完成：品牌账号 ${response.breakdown.brandAccounts} 条，竞品账号 ${response.breakdown.competitorAccounts} 条，` +
        `品牌作品 ${response.breakdown.brandWorks} 条，竞品作品 ${response.breakdown.competitorWorks} 条，对标作品 ${response.breakdown.benchmarkWorks} 条，搜索关键词 ${response.breakdown.searchWorks} 条，评论数据 ${response.breakdown.commentData} 条，关键词推荐 ${response.breakdown.keywordRecommendations} 条，` +
        `低粉爆款榜 ${response.breakdown.lowFanExplosiveWorks} 条，高完播率榜 ${response.breakdown.highCompletionRateWorks} 条，` +
        `高点赞率榜 ${response.breakdown.highLikeRateWorks} 条，同城热点榜 ${response.breakdown.cityHotspots} 条。`;
      const warningText = response.warnings?.filter(Boolean).join("；");
      setNotice(warningText ? `${summary} 部分请求未完全成功：${warningText}` : summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      setErrorMessage(`抖音同步失败：${message}`);
    } finally {
      setIsSyncingDouyinWorkspace(false);
    }
  }

  async function handleSearchDouyinCreators() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有同步收集数据板块的编辑权限。");
      return;
    }

    const keyword = douyinSyncForm.creatorSearch.keyword.trim();
    if (!keyword) {
      setErrorMessage("请输入达人搜索关键词后再提交。");
      return;
    }

    setIsSyncingDouyinWorkspace(true);
    clearMessages();

    try {
      const payload: DouyinCreatorSearchPayload = {
        keyword,
        seachType: douyinSyncForm.creatorSearch.seachType || undefined,
        timeRangeDays:
          douyinSyncForm.creatorSearch.seachType === "3"
            ? (douyinSyncForm.creatorSearch.timeRangeDays || undefined)
            : undefined,
        sortField: douyinSyncForm.creatorSearch.sortField || undefined,
        sortType: douyinSyncForm.creatorSearch.sortType || undefined,
        firstIndustryId: douyinSyncForm.creatorSearch.firstIndustryId.trim() || undefined,
        marketingTarget: douyinSyncForm.creatorSearch.marketingTarget.trim() || undefined,
        taskCategory: douyinSyncForm.creatorSearch.taskCategory.trim() || undefined,
        tag: douyinSyncForm.creatorSearch.tag.trim() || undefined,
        fansMin: douyinSyncForm.creatorSearch.fansMin.trim() || undefined,
        fansMax: douyinSyncForm.creatorSearch.fansMax.trim() || undefined,
        expectedPlayMin: douyinSyncForm.creatorSearch.expectedPlayMin.trim() || undefined,
        expectedPlayMax: douyinSyncForm.creatorSearch.expectedPlayMax.trim() || undefined,
        interactRateMin: douyinSyncForm.creatorSearch.interactRateMin.trim() || undefined,
        interactRateMax: douyinSyncForm.creatorSearch.interactRateMax.trim() || undefined,
        priceMin: douyinSyncForm.creatorSearch.priceMin.trim() || undefined,
        priceMax: douyinSyncForm.creatorSearch.priceMax.trim() || undefined,
      };
      const response = await searchDouyinCreators(payload, activeBrandId || archive.brand.id);
      setDouyinCollectionWorkspace(response.workspace);
      setNotice(`达人搜索抓取完成，已更新 ${response.syncedCount} 条达人结果。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "达人搜索失败";
      setErrorMessage(`达人搜索抓取失败：${message}`);
    } finally {
      setIsSyncingDouyinWorkspace(false);
    }
  }

  async function handleCreateDouyinCreatorDeepFetchTasks() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有同步收集数据板块的编辑权限。");
      return;
    }

    const identifiers = parseDouyinSyncLines(douyinSyncForm.creatorDeepFetch.identifiers);
    if (!identifiers.length) {
      setErrorMessage("请至少输入一个达人标识后再创建深抓任务。");
      return;
    }

    setIsSyncingDouyinWorkspace(true);
    clearMessages();

    try {
      const payload: DouyinCreatorDeepFetchPayload = {
        identifiers,
        identityType: douyinSyncForm.creatorDeepFetch.identityType,
        linkType: parseOptionalNumericValue(douyinSyncForm.creatorDeepFetch.linkType),
        homepageVideoPageLimit: parseOptionalNumericValue(douyinSyncForm.creatorDeepFetch.homepageVideoPageLimit) || 1,
      };
      const response = await createDouyinCreatorDeepFetchTasks(payload, activeBrandId || archive.brand.id);
      setDouyinCollectionWorkspace(response.workspace);
      setNotice(`达人深度抓取任务已创建 ${response.createdCount} 个，工作台会自动刷新任务进度。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "达人深抓失败";
      setErrorMessage(`达人深度抓取失败：${message}`);
    } finally {
      setIsSyncingDouyinWorkspace(false);
    }
  }

  function resolveDouyinCreatorDeepFetchRequest(item: DouyinCreatorSearchRecord) {
    if (item.oAuthorId) {
      return { identifier: item.oAuthorId, identityType: "O_AUTHOR_ID" as DouyinCreatorIdentityType };
    }
    if (item.secUserId) {
      return { identifier: item.secUserId, identityType: "SEC_USER_ID" as DouyinCreatorIdentityType };
    }
    if (item.uniqueId) {
      return { identifier: item.uniqueId, identityType: "UNIQUE_ID" as DouyinCreatorIdentityType };
    }
    if (item.douyinUid) {
      return { identifier: item.douyinUid, identityType: "UID" as DouyinCreatorIdentityType };
    }
    if (item.creatorId) {
      return { identifier: item.creatorId, identityType: "AUTO" as DouyinCreatorIdentityType };
    }
    return null;
  }

  async function handleCreateDouyinCreatorDeepFetchTasksFromSearchResults(items: DouyinCreatorSearchRecord[]) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有同步收集数据板块的编辑权限。");
      return;
    }

    const groupedIdentifiers = new Map<DouyinCreatorIdentityType, Set<string>>();
    let skippedCount = 0;
    items.forEach((item) => {
      const resolved = resolveDouyinCreatorDeepFetchRequest(item);
      if (!resolved?.identifier) {
        skippedCount += 1;
        return;
      }
      if (!groupedIdentifiers.has(resolved.identityType)) {
        groupedIdentifiers.set(resolved.identityType, new Set<string>());
      }
      groupedIdentifiers.get(resolved.identityType)?.add(resolved.identifier);
    });

    if (!groupedIdentifiers.size) {
      setErrorMessage("当前搜索结果缺少可用于深抓的达人标识，暂时无法创建深抓任务。");
      return;
    }

    setIsSyncingDouyinWorkspace(true);
    clearMessages();

    try {
      const brandId = activeBrandId || archive.brand.id;
      const linkType = parseOptionalNumericValue(douyinSyncForm.creatorDeepFetch.linkType);
      const homepageVideoPageLimit = parseOptionalNumericValue(douyinSyncForm.creatorDeepFetch.homepageVideoPageLimit) || 1;
      let createdCount = 0;
      let latestWorkspace = douyinCollectionWorkspace;

      for (const [identityType, identifiers] of groupedIdentifiers.entries()) {
        const response = await createDouyinCreatorDeepFetchTasks(
          {
            identifiers: Array.from(identifiers),
            identityType,
            linkType,
            homepageVideoPageLimit,
          },
          brandId,
        );
        createdCount += response.createdCount;
        latestWorkspace = response.workspace;
      }

      setDouyinCollectionWorkspace(latestWorkspace);
      setActiveDouyinCollectionCard("creatorDeepFetch");
      setNotice(
        skippedCount
          ? `已从搜索结果创建 ${createdCount} 个达人深抓任务，已切换到达人深度抓取。另有 ${skippedCount} 条结果缺少可用标识，暂未创建任务。`
          : `已从搜索结果创建 ${createdCount} 个达人深抓任务，已切换到达人深度抓取。`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "达人深抓失败";
      setErrorMessage(`从搜索结果创建达人深抓任务失败：${message}`);
    } finally {
      setIsSyncingDouyinWorkspace(false);
    }
  }

  async function handleAddDouyinCreatorsToResultPoolFromSearchResults(items: DouyinCreatorSearchRecord[]) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有同步收集数据板块的编辑权限。");
      return;
    }

    const searchResultIds = Array.from(new Set(items.map((item) => item.id).filter(Boolean)));
    if (!searchResultIds.length) {
      setErrorMessage("请先勾选至少一个达人后再加入结果池。");
      return;
    }

    setIsSyncingDouyinWorkspace(true);
    clearMessages();

    try {
      const response = await addDouyinCreatorsToResultPool(
        {
          searchResultIds,
        },
        activeBrandId || archive.brand.id,
      );
      setDouyinCollectionWorkspace(response.workspace);
      setActiveDouyinCollectionCard("creatorResultPool");
      setNotice(`已将 ${response.importedCount} 个达人直接加入结果池。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加入结果池失败";
      setErrorMessage(`从搜索结果加入达人结果池失败：${message}`);
    } finally {
      setIsSyncingDouyinWorkspace(false);
    }
  }

  async function handleLoadMoreDouyinComments() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有同步收集数据板块的编辑权限。");
      return;
    }

    const pageRequests = douyinCommentPagination
      .filter((item) => item.hasMore && item.nextCursor)
      .map((item) => ({
        sourceUrl: item.sourceUrl,
        cursor: item.nextCursor,
      }));

    if (!pageRequests.length) {
      setNotice("当前评论数据已经没有更多可加载内容。");
      return;
    }

    setIsLoadingMoreDouyinComments(true);
    clearMessages();

    try {
      const response = await syncDouyinCollectionWorkspace(
        {
          scope: "commentData",
          commentPageRequests: pageRequests,
        },
        activeBrandId || archive.brand.id,
      );
      setDouyinCollectionWorkspace(response.workspace);
      setDouyinCommentPagination(response.commentPagination ?? []);
      const sourceCount = response.commentPagination.filter((item) => item.hasMore).length;
      const summary = `评论数据已继续加载 ${response.breakdown.commentData} 条，仍可继续翻页的作品 ${sourceCount} 个。`;
      const warningText = response.warnings?.filter(Boolean).join("；");
      setNotice(warningText ? `${summary} 部分请求未完全成功：${warningText}` : summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载失败";
      setErrorMessage(`评论数据加载更多失败：${message}`);
    } finally {
      setIsLoadingMoreDouyinComments(false);
    }
  }

  async function handleSyncDouyinTargetUsers() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有同步收集数据板块的编辑权限。");
      return;
    }

    const sourceUrls = parseDouyinSyncLines(douyinSyncForm.commentSourceUrls);
    if (!sourceUrls.length) {
      setErrorMessage("请输入至少一个抖音作品链接后再提取账号链接。");
      return;
    }

    const matchKeywords = parseDouyinSyncLines(douyinSyncForm.targetUserMatchKeywords);
    setIsSyncingDouyinWorkspace(true);
    clearMessages();

    try {
      const response = await syncDouyinTargetUsers(
        {
          sourceUrls,
          matchKeywords,
          syncCommentsFirst: true,
        },
        activeBrandId || archive.brand.id,
      );
      setDouyinCollectionWorkspace(response.workspace);
      const summary = `抖音评论用户账号提取完成，已更新 ${response.syncedCount} 条目标用户。`;
      const keywordText = matchKeywords.length ? ` 关键词：${matchKeywords.join("、")}。` : " 未设置关键词，已提取全部评论用户。";
      const warningText = response.warnings?.filter(Boolean).join("；");
      setNotice(warningText ? `${summary}${keywordText} 部分请求未完全成功：${warningText}` : `${summary}${keywordText}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "提取失败";
      setErrorMessage(`抖音评论用户账号提取失败：${message}`);
    } finally {
      setIsSyncingDouyinWorkspace(false);
    }
  }

  async function handleSyncSingleDouyinBrandAccount(entry: XhsAccountBindingEntry) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有同步收集数据板块的编辑权限。");
      return;
    }

    setIsSyncingDouyinWorkspace(true);
    clearMessages();

    try {
      const response = await syncDouyinCollectionWorkspace(
        {
          scope: "brandAccount",
          brandAccountLinks: [entry.locator.trim()].filter(Boolean),
          brandAccountEntries: buildXhsSyncAccountEntries([entry]),
        },
        activeBrandId || archive.brand.id,
      );
      setDouyinCollectionWorkspace(response.workspace);
      setNotice(`品牌抖音账号同步完成，已更新 ${response.breakdown.brandAccounts} 条结果。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      setErrorMessage(`品牌抖音账号同步失败：${message}`);
    } finally {
      setIsSyncingDouyinWorkspace(false);
    }
  }

  async function handleSyncAllDouyinBrandAccounts() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有同步收集数据板块的编辑权限。");
      return;
    }

    const brandAccountLinks = douyinSyncForm.brandAccountEntries.map((entry) => entry.locator.trim()).filter(Boolean);
    if (!brandAccountLinks.length) {
      setErrorMessage("请先添加至少一个品牌抖音账号后再同步。");
      return;
    }

    setIsSyncingDouyinWorkspace(true);
    clearMessages();

    try {
      const response = await syncDouyinCollectionWorkspace(
        {
          scope: "brandAccount",
          brandAccountLinks,
          brandAccountEntries: buildXhsSyncAccountEntries(douyinSyncForm.brandAccountEntries),
        },
        activeBrandId || archive.brand.id,
      );
      setDouyinCollectionWorkspace(response.workspace);
      setNotice(`品牌抖音账号同步完成，已更新 ${response.breakdown.brandAccounts} 条结果。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      setErrorMessage(`品牌抖音账号同步失败：${message}`);
    } finally {
      setIsSyncingDouyinWorkspace(false);
    }
  }

  async function handleSyncAllDouyinCompetitorAccounts() {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有同步收集数据板块的编辑权限。");
      return;
    }

    const competitorAccountLinks = douyinSyncForm.competitorAccountEntries.map((entry) => entry.locator.trim()).filter(Boolean);
    if (!competitorAccountLinks.length) {
      setErrorMessage("请先添加至少一个竞品抖音账号后再同步。");
      return;
    }

    setIsSyncingDouyinWorkspace(true);
    clearMessages();

    try {
      const response = await syncDouyinCollectionWorkspace(
        {
          scope: "competitorAccount",
          competitorAccountLinks,
          competitorAccountEntries: buildXhsSyncAccountEntries(douyinSyncForm.competitorAccountEntries),
        },
        activeBrandId || archive.brand.id,
      );
      setDouyinCollectionWorkspace(response.workspace);
      setNotice(`竞品抖音账号同步完成，已更新 ${response.breakdown.competitorAccounts} 条结果。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      setErrorMessage(`竞品抖音账号同步失败：${message}`);
    } finally {
      setIsSyncingDouyinWorkspace(false);
    }
  }

  async function handleSyncSingleDouyinCompetitorWork(entry: XhsAccountBindingEntry) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有同步收集数据板块的编辑权限。");
      return;
    }

    const locator = entry.locator.trim();
    if (!locator) {
      setErrorMessage("请先填写竞品抖音账号后再提交采集。");
      return;
    }

    setIsSyncingDouyinWorkspace(true);
    clearMessages();

    try {
      const response = await syncDouyinCollectionWorkspace(
        {
          scope: "competitorWorks",
          competitorAccountLinks: [locator],
          competitorAccountEntries: buildXhsSyncAccountEntries([entry]),
        },
        activeBrandId || archive.brand.id,
      );
      setDouyinCollectionWorkspace(response.workspace);
      setNotice(`竞品作品采集完成，已更新 ${response.breakdown.competitorWorks} 条作品。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      setErrorMessage(`竞品作品采集失败：${message}`);
    } finally {
      setIsSyncingDouyinWorkspace(false);
    }
  }

  async function handleSyncSingleDouyinCompetitorAccount(entry: XhsAccountBindingEntry) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有同步收集数据板块的编辑权限。");
      return;
    }

    setIsSyncingDouyinWorkspace(true);
    clearMessages();

    try {
      const response = await syncDouyinCollectionWorkspace(
        {
          scope: "competitorAccount",
          competitorAccountLinks: [entry.locator.trim()].filter(Boolean),
          competitorAccountEntries: buildXhsSyncAccountEntries([entry]),
        },
        activeBrandId || archive.brand.id,
      );
      setDouyinCollectionWorkspace(response.workspace);
      setNotice(`竞品抖音账号同步完成，已更新 ${response.breakdown.competitorAccounts} 条结果。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      setErrorMessage(`竞品抖音账号同步失败：${message}`);
    } finally {
      setIsSyncingDouyinWorkspace(false);
    }
  }

  async function handleSyncSingleDouyinKeywordRecommendation(keyword: string) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有同步收集数据板块的编辑权限。");
      return;
    }
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) {
      setErrorMessage("请输入关键词后再提交。");
      return;
    }

    setIsSyncingDouyinWorkspace(true);
    clearMessages();

    try {
      const response = await syncDouyinCollectionWorkspace(
        {
          scope: "keywordRecommendations",
          searchKeyword: normalizedKeyword,
        },
        activeBrandId || archive.brand.id,
      );
      setDouyinCollectionWorkspace(response.workspace);
      setNotice(`关键词推荐同步完成，已更新 ${response.breakdown.keywordRecommendations} 条结果。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      setErrorMessage(`关键词推荐同步失败：${message}`);
    } finally {
      setIsSyncingDouyinWorkspace(false);
    }
  }

  async function handleRemoveDouyinKeywordRecommendation(itemId: string) {
    if (!brandPermissionSettings?.currentUserPermissions["brandGrowth.collection.douyinCollection"]?.edit) {
      setErrorMessage("当前账号没有编辑抖音收集数据的权限。");
      return;
    }
    if (!itemId) {
      return;
    }

    setDeletingDouyinKeywordRecommendationId(itemId);
    clearMessages();

    try {
      const response = await removeDouyinKeywordRecommendation(itemId, activeBrandId || archive.brand.id);
      setDouyinCollectionWorkspace(response.workspace);
      setNotice("已删除关键词推荐结果。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      setErrorMessage(`删除关键词推荐结果失败：${message}`);
    } finally {
      setDeletingDouyinKeywordRecommendationId("");
    }
  }

  async function handleStartFeishuAuth() {
    clearMessages();

    try {
      const returnUrl = typeof window !== "undefined" ? `${window.location.origin}/brand-growth` : undefined;
      const response = await startFeishuAuth(currentUser?.id, returnUrl);
      if (!response.configured || !response.authorizeUrl) {
        setErrorMessage(response.message || "请先配置当前用户自己的飞书开放平台应用。");
        return;
      }
      if (typeof window !== "undefined") {
        window.location.href = response.authorizeUrl;
        return;
      }
      setNotice(response.message || "已生成飞书授权地址。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "发起授权失败";
      setErrorMessage(`连接飞书失败：${message}`);
    }
  }

  function updateBackground<K extends keyof BrandBackground>(key: K, value: BrandBackground[K]) {
    setArchive((current) => ({
      ...current,
      brand: { ...current.brand, [key]: value },
    }));
  }

  function updateIpProfile<K extends keyof BrandIpProfile>(key: K, value: BrandIpProfile[K]) {
    setArchive((current) => ({
      ...current,
      ipProfile: { ...current.ipProfile, [key]: value },
    }));
  }

  function updateProduct(index: number, key: keyof BrandProduct, value: string | number) {
    setArchive((current) => {
      const next = [...current.products];
      next[index] = { ...next[index], [key]: value };
      return { ...current, products: next };
    });
  }

  async function handleUploadProductImage(productId: string, files?: File[] | null) {
    if (!files?.length) {
      return;
    }

    const invalidFile = files.find((file) => !file.type.startsWith("image/"));
    if (invalidFile) {
      setErrorMessage("请上传图片格式文件。");
      return;
    }

    setUploadingProductId(productId);
    clearMessages();

    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const uploaded = await uploadBrandProductImage(archive.brand.id, file);
        uploadedUrls.push(uploaded.imageUrl);
      }
      setArchive((current) => ({
        ...current,
        products: current.products.map((item) => (
          item.id === productId
            ? {
                ...item,
                imageUrl: [...item.imageUrls, ...uploadedUrls][0] ?? item.imageUrl,
                imageUrls: Array.from(new Set([...item.imageUrls, ...uploadedUrls])),
              }
            : item
        )),
      }));
      setNotice(`产品图片上传成功，已追加 ${uploadedUrls.length} 张图片，请继续保存页面。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传失败";
      setErrorMessage(`产品图片上传失败：${message}`);
    } finally {
      setUploadingProductId("");
    }
  }

  async function handleUploadIpImage(files?: File[] | null) {
    if (!files?.length) {
      return;
    }

    const invalidFile = files.find((file) => !file.type.startsWith("image/"));
    if (invalidFile) {
      setErrorMessage("请上传图片格式文件。");
      return;
    }

    setUploadingIpImages(true);
    clearMessages();

    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const uploaded = await uploadBrandIpImage(archive.brand.id, file);
        uploadedUrls.push(uploaded.imageUrl);
      }
      setArchive((current) => ({
        ...current,
        ipProfile: {
          ...current.ipProfile,
          imageUrls: Array.from(new Set([...current.ipProfile.imageUrls, ...uploadedUrls])),
        },
      }));
      setNotice(`IP 图片上传成功，已追加 ${uploadedUrls.length} 张图片，请继续保存页面。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传失败";
      setErrorMessage(`IP 图片上传失败：${message}`);
    } finally {
      setUploadingIpImages(false);
    }
  }

  async function handleUploadIpVoice(file?: File | null) {
    if (!file) {
      return;
    }

    const fileName = String(file.name || "").toLowerCase();
    const fileType = String(file.type || "").toLowerCase();
    if (!fileName.endsWith(".mp3") && fileType !== "audio/mpeg" && fileType !== "audio/mp3") {
      setErrorMessage("IP 语音只支持 mp3 格式。");
      return;
    }

    setUploadingIpVoice(true);
    clearMessages();

    try {
      const uploaded = await uploadBrandIpVoice(archive.brand.id, file);
      setArchive((current) => ({
        ...current,
        ipProfile: {
          ...current.ipProfile,
          voiceUrl: uploaded.audioUrl,
          voiceFileName: uploaded.fileName,
          voiceDurationSec: uploaded.durationSec,
        },
      }));
      setNotice(`IP 语音上传成功，当前时长 ${uploaded.durationSec} 秒，请继续保存页面。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传失败";
      setErrorMessage(`IP 语音上传失败：${message}`);
    } finally {
      setUploadingIpVoice(false);
    }
  }

  function updateSurvey(key: string, value: string) {
    setArchive((current) => {
      const next = [...current.survey];
      const targetIndex = next.findIndex((item) => item.key === key);
      if (targetIndex < 0) {
        return current;
      }
      next[targetIndex] = { ...next[targetIndex], value };
      return { ...current, survey: next };
    });
  }

  function removeProduct(productId: string) {
    setArchive((current) => ({
      ...current,
      products: current.products.filter((item) => item.id !== productId),
    }));

    if (!productId.startsWith("prd_local_")) {
      setRemovedProductIds((current) => [...current, productId]);
    }
  }

  function clearMessages() {
    setNotice("");
    setErrorMessage("");
  }

  async function uploadAssetDraftFile(draft: LibraryAssetModalDraft) {
    if (!draft.file) {
      return draft.fileUrl.trim();
    }
    const uploaded = await uploadBrandAssetFile(archive.brand.id, draft.file);
    return uploaded.fileUrl;
  }

  async function persistBusinessAssets(nextItems: BrandAsset[], successMessage: string) {
    await replaceBrandAssets(
      archive.brand.id,
      "business-assets",
      nextItems.map((item) => buildBrandAssetPayload(item)),
    );
    await loadArchive({ targetPage: activePage, force: true });
    setNotice(successMessage);
  }

  async function handleCreateAssets(target: LibraryAssetTarget, drafts: LibraryAssetModalDraft[]) {
    clearMessages();

    try {
      const resolvedAssets = await Promise.all(
        drafts.map(async (draft) => {
          const fileUrl = await uploadAssetDraftFile(draft);
          return emptyAsset(buildAssetFromDraft(draft, fileUrl));
        }),
      );

      if (target === "businessAssets") {
        await persistBusinessAssets(
          [...archive.businessAssets, ...resolvedAssets],
          `已新增 ${resolvedAssets.length} 份资料，并开始同步知识库。`,
        );
        return;
      }

      setArchive((current) => ({
        ...current,
        [target]: [...current[target], ...resolvedAssets],
      }));
      setNotice(`已新增 ${resolvedAssets.length} 份资料，请继续保存页面。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "资料上传失败";
      setErrorMessage(`新增资料失败：${message}`);
      throw error;
    }
  }

  async function handleSaveAssetEdit(target: LibraryAssetTarget, index: number, draft: LibraryAssetModalDraft) {
    clearMessages();

    try {
      const fileUrl = draft.file ? await uploadAssetDraftFile(draft) : draft.fileUrl.trim();
      if (target === "businessAssets") {
        const nextItems = [...archive.businessAssets];
        nextItems[index] = buildAssetFromDraft(draft, fileUrl, nextItems[index]);
        await persistBusinessAssets(nextItems, "资料已更新，并重跑当前知识库容器同步。");
        return;
      }

      setArchive((current) => {
        const next = [...current[target]];
        next[index] = buildAssetFromDraft(draft, fileUrl, next[index]);
        return { ...current, [target]: next };
      });
      setNotice("资料已更新，请继续保存页面。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "资料更新失败";
      setErrorMessage(`资料更新失败：${message}`);
      throw error;
    }
  }

  function handleRemoveAsset(target: LibraryAssetTarget, index: number) {
    clearMessages();
    if (target === "businessAssets") {
      const nextItems = archive.businessAssets.filter((_, itemIndex) => itemIndex !== index);
      void persistBusinessAssets(nextItems, "资料已移除，并同步更新知识库容器。").catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "资料移除失败";
        setErrorMessage(`资料移除失败：${message}`);
      });
      return;
    }
    setArchive((current) => ({
      ...current,
      [target]: current[target].filter((_, itemIndex) => itemIndex !== index),
    }));
    setNotice("资料已移除，请继续保存页面。");
  }

  function switchSection(sectionKey: StrategySectionKey) {
    const targetSection = visibleStrategySections.find((item) => item.key === sectionKey) ?? visibleStrategySections[0] ?? strategySections[0];
    setActiveSection(targetSection.key);
    setExpandedSections((current) => ({
      ...current,
      [targetSection.key]: true,
    }));
    if (!targetSection.pages.some((page) => page.key === activePage)) {
      setActivePage(targetSection.pages[0]?.key ?? "background");
    }
    setActiveXhsCollectionCard("brandAccount");
    setActiveDouyinCollectionCard("brandAccount");
  }

  function toggleSection(sectionKey: StrategySectionKey) {
    if (expandedSections[sectionKey]) {
      setExpandedSections((current) => ({
        ...current,
        [sectionKey]: false,
      }));
      return;
    }
    switchSection(sectionKey);
  }

  function switchPage(pageKey: StrategyPageKey) {
    const parentSection = visibleStrategySections.find((section) => section.pages.some((page) => page.key === pageKey));
    if (parentSection) {
      setActiveSection(parentSection.key);
      setExpandedSections((current) => ({
        ...current,
        [parentSection.key]: true,
      }));
    }
    setActivePage(pageKey);
    if (pageKey !== "xiaohongshuCollection") {
      setActiveXhsCollectionCard("brandAccount");
    }
    if (pageKey !== "douyinCollection") {
      setActiveDouyinCollectionCard("brandAccount");
    }
  }

  async function saveActivePage() {
    if (!activeBrandPage) {
      return;
    }
    if (!brandPermissionSettings?.currentUserPermissions[strategyPagePermissionMap[activeBrandPage]]?.edit) {
      setErrorMessage("当前账号没有编辑当前页面的权限。");
      return;
    }

    setIsSaving(true);
    clearMessages();

    try {
      if (activeBrandPage === "background") {
        await updateBrandBackground(archive.brand.id, {
          brandName: archive.brand.brandName,
          industry: archive.brand.industry,
          storeCount: archive.brand.storeCount,
          foundedYear: archive.brand.foundedYear,
          brandDescription: archive.brand.brandDescription,
          enterpriseIntro: archive.brand.enterpriseIntro,
        });
      }

      if (activeBrandPage === "ipLibrary") {
        await updateBrandIpProfile(archive.brand.id, archive.ipProfile);
      }

      if (activeBrandPage === "products") {
        for (const productId of removedProductIds) {
          await deleteBrandProduct(archive.brand.id, productId);
        }

        for (const product of archive.products) {
          const payload = {
            productName: product.productName,
            productType: product.productType,
            price: Number(product.price || 0),
            productPositioning: product.productPositioning,
            targetAudience: product.targetAudience,
            painPoint: product.painPoint,
            usageScenario: product.usageScenario,
            differentiators: product.differentiators,
            marketPosition: product.marketPosition,
            detailDescription: product.detailDescription,
            imageUrl: product.imageUrl,
            imageUrls: product.imageUrls,
          };

          if (product.id.startsWith("prd_local_")) {
            await createBrandProduct(archive.brand.id, payload);
          } else {
            await updateBrandProduct(archive.brand.id, product.id, payload);
          }
        }
      }

      if (activeBrandPage === "survey") {
        await replaceBrandSurvey(archive.brand.id, archive.survey.map((item) => ({
          key: item.key,
          label: item.label,
          value: item.value,
        })));
      }

      if (activeBrandPage === "industryFeeds" || activeBrandPage === "businessAssets") {
        await replaceBrandAssets(
          archive.brand.id,
          activeBrandPage === "industryFeeds" ? "industry-feeds" : "business-assets",
          archive[activeBrandPage].map((item) => buildBrandAssetPayload(item)),
        );
      }

      await loadArchive({ targetPage: activePage, force: true });
      const currentStepName = archive.steps.find((step) => step.key === activeBrandPage)?.name ?? "当前页面";
      const currentIndex = stepOrder.indexOf(activeBrandPage);
      const nextStep = currentIndex >= 0 ? stepOrder[currentIndex + 1] : undefined;
      if ((activeBrandPage === "ipLibrary" || activeBrandPage === "products" || activeBrandPage === "survey") && nextStep) {
        switchPage(nextStep);
        setNotice(`已保存：${currentStepName}，已进入下一步`);
      } else {
        setNotice(`已保存：${currentStepName}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      setErrorMessage(`保存失败：${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function renderLibraryPage() {
    if (!isLibraryPageKey(activeBrandPage)) {
      return null;
    }

    return (
      <BrandGrowthLibraryWorkspace
        activeBrandPage={activeBrandPage}
        activeStepName={activeStepMeta?.name}
        activeStepStatus={activeStepMeta?.status ?? "pending"}
        archive={archive}
        statusText={getBrandArchiveStatusText}
        onUpdateBackground={updateBackground}
        onUpdateIpProfile={updateIpProfile}
        onUploadIpImage={handleUploadIpImage}
        uploadingIpImages={uploadingIpImages}
        onUploadIpVoice={handleUploadIpVoice}
        uploadingIpVoice={uploadingIpVoice}
        onAddProduct={() => setArchive((current) => ({ ...current, products: [...current.products, emptyProduct()] }))}
        onUpdateProduct={updateProduct}
        onRemoveProduct={removeProduct}
        onUploadProductImage={handleUploadProductImage}
        uploadingProductId={uploadingProductId}
        onUpdateSurvey={updateSurvey}
        onCreateAssets={handleCreateAssets}
        onSaveAssetEdit={handleSaveAssetEdit}
        onRemoveAsset={handleRemoveAsset}
      />
    );
  }

  function renderCollectionPage() {
    if (activePage === "wechatMpCollection") {
      const canEditWechatMp = brandPermissionSettings
        ? Boolean(brandPermissionSettings.currentUserPermissions["brandGrowth.collection.wechatMpCollection"]?.edit)
        : true;
      return (
        <WechatMpCollectionWorkspace
          pageTitle={currentPage.label}
          pageDescription={currentPage.description}
          isHydrating={isHydrating}
          canEdit={canEditWechatMp}
          workspace={wechatMpCollectionWorkspace}
          setWorkspace={setWechatMpCollectionWorkspace}
          benchmarkWorkspace={wechatMpBenchmarkWorkspace}
          setBenchmarkWorkspace={setWechatMpBenchmarkWorkspace}
          searchWorkspace={wechatSearchWorkspace}
          setSearchWorkspace={setWechatSearchWorkspace}
          activeBrandId={activeBrandId || archive.brand.id}
          addingMaterialAssetId={addingMaterialAssetId}
          onAddBenchmarkArticleToMaterial={handleAddWechatBenchmarkArticleToMaterial}
          onAddSearchItemToMaterial={handleAddWechatSearchItemToMaterial}
          formatDateTime={formatDateTime}
          formatCount={formatCount}
        />
      );
    }
    return (
      <BrandGrowthCollectionWorkspace
        activePage={
          activePage === "dailyHotspot"
            ? "dailyHotspot"
            : activePage === "douyinCollection"
              ? "douyinCollection"
              : "xiaohongshuCollection"
        }
        pageTitle={currentPage.label}
        pageDescription={currentPage.description}
        dataSource={dataSource}
        notice={notice}
        errorMessage={errorMessage}
        onRefreshData={() => void loadArchive({ targetPage: activePage, force: true })}
        templateUrl={FEISHU_XHS_TEMPLATE_URL}
        activeXhsCollectionCard={activeXhsCollectionCard}
        onXhsCollectionCardChange={setActiveXhsCollectionCard}
        xhsSyncForm={xhsSyncForm}
        setXhsSyncForm={setXhsSyncForm}
        activeDouyinCollectionCard={activeDouyinCollectionCard}
        onDouyinCollectionCardChange={setActiveDouyinCollectionCard}
        feishuBinding={feishuBinding}
        feishuAppConfig={feishuAppConfig}
        feishuAuthStatus={feishuAuthStatus}
        feishuBindingForm={feishuBindingForm}
        setFeishuBindingForm={setFeishuBindingForm}
        feishuAppConfigForm={feishuAppConfigForm}
        setFeishuAppConfigForm={setFeishuAppConfigForm}
        canSyncFeishuWorkspace={canSyncFeishuWorkspace}
        isHydrating={isHydrating}
        isSavingFeishuAppConfig={isSavingFeishuAppConfig}
        isSavingFeishuBinding={isSavingFeishuBinding}
        isSyncingFeishuWorkspace={isSyncingFeishuWorkspace}
        isSyncingXhsWorkspace={isSyncingXhsWorkspace}
        douyinWorkspace={douyinCollectionWorkspace}
        creatorSearchFieldOptions={douyinCollectionWorkspace.creatorSearchFieldOptions}
        isSyncingDouyinWorkspace={isSyncingDouyinWorkspace}
        douyinSyncForm={douyinSyncForm}
        setDouyinSyncForm={setDouyinSyncForm}
        onSaveFeishuAppConfig={handleSaveFeishuAppConfig}
        onStartFeishuAuth={handleStartFeishuAuth}
        onSaveFeishuBinding={handleSaveFeishuBinding}
        onSyncFeishuWorkspace={handleSyncFeishuWorkspace}
        onSyncXhsWorkspace={handleSyncXhsWorkspace}
        onSyncXhsSearchNotes={handleSyncXhsSearchNotes}
        onSyncXhsCommentData={handleSyncXhsCommentData}
        onSyncXhsTargetUsers={handleSyncXhsTargetUsers}
        onSyncAllXhsBrandAccounts={handleSyncAllXhsBrandAccounts}
        onSyncSingleXhsBrandAccount={handleSyncSingleXhsBrandAccount}
        onSyncSingleXhsCompetitorAccount={handleSyncSingleXhsCompetitorAccount}
        onLoadMoreXhsComments={handleLoadMoreXhsComments}
        onToggleXhsCommentReplies={handleToggleXhsCommentReplies}
        onLoadXhsCommentReplies={handleLoadXhsCommentReplies}
        onSyncDouyinWorkspace={handleSyncDouyinWorkspace}
        onSyncDouyinTargetUsers={handleSyncDouyinTargetUsers}
        onSyncAllDouyinBrandAccounts={handleSyncAllDouyinBrandAccounts}
        onSyncAllDouyinCompetitorAccounts={handleSyncAllDouyinCompetitorAccounts}
        onSyncSingleDouyinBrandAccount={handleSyncSingleDouyinBrandAccount}
        onSyncSingleDouyinCompetitorWork={handleSyncSingleDouyinCompetitorWork}
        onSyncSingleDouyinCompetitorAccount={handleSyncSingleDouyinCompetitorAccount}
        onDeleteDouyinBrandAccount={handleDeleteDouyinBrandAccount}
        onDeleteDouyinCompetitorAccount={handleDeleteDouyinCompetitorAccount}
        onSyncSingleDouyinKeywordRecommendation={handleSyncSingleDouyinKeywordRecommendation}
        onSearchDouyinCreators={handleSearchDouyinCreators}
        onCreateDouyinCreatorDeepFetchTasks={handleCreateDouyinCreatorDeepFetchTasks}
        onCreateDouyinCreatorDeepFetchTasksFromSearchResults={handleCreateDouyinCreatorDeepFetchTasksFromSearchResults}
        onAddDouyinCreatorsToResultPoolFromSearchResults={handleAddDouyinCreatorsToResultPoolFromSearchResults}
        onLoadMoreDouyinComments={handleLoadMoreDouyinComments}
        sortedBrandAccounts={sortedBrandAccounts}
        sortedCompetitorAccounts={sortedCompetitorAccounts}
        sortedBrandNotes={sortedBrandNotes}
        sortedBenchmarkNotes={sortedBenchmarkNotes}
        sortedSearchNotes={sortedSearchNotes}
        sortedXhsCommentData={sortedXhsCommentData}
        sortedXhsTargetUsers={sortedXhsTargetUsers}
        xhsCommentPagination={xhsCommentPagination}
        isLoadingMoreXhsComments={isLoadingMoreXhsComments}
        expandedXhsCommentIds={expandedXhsCommentIds}
        xhsSubCommentsByParent={xhsSubCommentsByParent}
        xhsSubCommentPaginationMap={xhsSubCommentPaginationMap}
        loadingXhsSubCommentIds={loadingXhsSubCommentIds}
        loadingMoreXhsSubCommentIds={loadingMoreXhsSubCommentIds}
        sortedDouyinBrandAccounts={sortedDouyinBrandAccounts}
        sortedDouyinCompetitorAccounts={sortedDouyinCompetitorAccounts}
        sortedDouyinBrandWorks={sortedDouyinBrandWorks}
        sortedDouyinCompetitorWorks={sortedDouyinCompetitorWorks}
        sortedDouyinBenchmarkWorks={sortedDouyinBenchmarkWorks}
        sortedDouyinSearchWorks={sortedDouyinSearchWorks}
        sortedDouyinCommentData={sortedDouyinCommentData}
        sortedDouyinTargetUsers={sortedDouyinTargetUsers}
        douyinCommentPagination={douyinCommentPagination}
        isLoadingMoreDouyinComments={isLoadingMoreDouyinComments}
        sortedDouyinKeywordRecommendations={sortedDouyinKeywordRecommendations}
        sortedDouyinLowFanExplosiveWorks={sortedDouyinLowFanExplosiveWorks}
        sortedDouyinHighCompletionRateWorks={sortedDouyinHighCompletionRateWorks}
        sortedDouyinHighLikeRateWorks={sortedDouyinHighLikeRateWorks}
        sortedDouyinCityHotspots={sortedDouyinCityHotspots}
        sortedDouyinCreatorSearchResults={sortedDouyinCreatorSearchResults}
        sortedDouyinCreatorProfiles={sortedDouyinCreatorProfiles}
        sortedDouyinCreatorDeepFetchTasks={sortedDouyinCreatorDeepFetchTasks}
        brandNotesPage={brandNotesPage}
        setBrandNotesPage={setBrandNotesPage}
        brandNotesPageCount={brandNotesPageCount}
        brandNotesPageSize={brandNotesPageSize}
        setBrandNotesPageSize={setBrandNotesPageSize}
        paginatedBrandNotes={paginatedBrandNotes}
        addingMaterialAssetId={addingMaterialAssetId}
        extractingDouyinTranscriptAssetId={extractingDouyinTranscriptAssetId}
        onAddBenchmarkNoteToMaterial={handleAddBenchmarkNoteToMaterial}
        onDeleteXhsCollectedNote={handleDeleteXhsCollectedNote}
        onAddDouyinBenchmarkWorkToMaterial={handleToggleDouyinBenchmarkWorkMaterial}
        onDeleteDouyinCollectedWork={handleDeleteDouyinCollectedWork}
        onExtractDouyinTranscript={handleExtractDouyinWorkTranscript}
        onRemoveDouyinKeywordRecommendation={handleRemoveDouyinKeywordRecommendation}
        onPreviewMedia={setMediaPreview}
        buildFeishuMediaProxyUrl={(sourceUrl, download) => buildFeishuMediaProxyUrl(sourceUrl, download, activeBrandId || archive.brand.id)}
        formatDateTime={formatDateTime}
        formatDateLabel={formatDateLabel}
        formatCount={formatCount}
        formatMetric={formatMetric}
        deletingDouyinAccountId={deletingDouyinAccountId}
        deletingDouyinKeywordRecommendationId={deletingDouyinKeywordRecommendationId}
        selectedHotspotDate={selectedHotspotDate}
        hotspotAvailableDates={hotspotAvailableDates}
        activeHotspotRecord={activeHotspotRecord}
        sortedHotspotItems={sortedHotspotItems}
        paginatedHotspotItems={paginatedHotspotItems}
        hotspotPage={hotspotPage}
        setHotspotPage={setHotspotPage}
        hotspotPageCount={hotspotPageCount}
        hotspotPageSize={hotspotPageSize}
        setHotspotPageSize={setHotspotPageSize}
        isSyncingDailyHotspots={isSyncingDailyHotspots}
        onDailyHotspotDateChange={handleDailyHotspotDateChange}
        onSyncDailyHotspots={handleSyncDailyHotspotWorkspace}
        formatHotspotHeat={formatHotspotHeat}
      />
    );
  }

  function renderReportPage() {
    if (activePage === "xiaohongshuMarketingCalendar") {
      return (
        <>
          <CalendarWorkspace
            sectionLabel={currentPage.label}
            sectionDescription={currentPage.description}
            isLoading={isHydrating}
            isPublishing={false}
            isGeneratingCalendar={isGeneratingMarketingCalendar}
            canGenerateCalendar={canGenerateMarketingCalendar}
            isCalendarTaskActive={isMarketingCalendarTaskActive}
            latestCalendar={latestCalendar}
            latestCalendarTask={latestCalendarTask}
            calendarTaskStatusText={calendarTaskStatusText}
            calendarInlineError={calendarInlineError}
            calendarAllItems={calendarAllItems}
            isCalendarDetailOpen={isCalendarDetailOpen}
            selectedCalendarDate={selectedCalendarDate}
            selectedCalendarItem={selectedCalendarItem}
            calendarItemDraft={calendarItemDraft}
            isEditingCalendarItem={isEditingCalendarItem}
            isSavingCalendarItem={isSavingCalendarItem}
            canEditCalendar={hasCurrentPageEditPermission}
            onRefresh={() => refreshMarketingCalendarWorkspace()}
            onGenerate={() => {
              handleOpenMarketingCalendarGenerateDialog();
            }}
            onOpenDetail={handleOpenCalendarDetail}
            onCloseDetail={handleCloseCalendarDetail}
            onStartEditDetail={handleStartEditCalendarItem}
            onCancelEditDetail={handleCancelEditCalendarItem}
            onSaveDetail={() => handleSaveCalendarItem()}
            onDetailFieldChange={handleCalendarItemFieldChange}
            onDetailListFieldChange={handleCalendarItemListFieldChange}
            formatCalendarDate={formatCalendarDate}
            formatCalendarListValue={formatCalendarListValue}
          />
          {renderReportGenerationModal()}
        </>
      );
    }

    if (activePage === "reportTopicLibrary") {
      return (
        <DouyinTopicLibraryWorkspace
          sectionLabel={currentPage.label}
          sectionDescription={currentPage.description}
          isLoading={isHydrating}
          canEdit={hasCurrentPageEditPermission}
          items={douyinTopicLibraryWorkspace.topicLibrary || []}
          isSaving={isSavingDouyinTopicLibrary}
          onRefresh={async () => {
            await refreshDouyinTopicLibraryWorkspace(selectedDouyinTopicDate);
          }}
          onSaveTopic={handleSaveDouyinTopic}
          onDeleteTopic={handleDeleteDouyinTopic}
          formatDateTime={formatDateTime}
        />
      );
    }

    if (activePage === "openclawExplosiveAnalysis") {
      return (
        <OpenClawExplosiveAnalysisWorkspace
          sectionLabel={currentPage.label}
          sectionDescription={currentPage.description}
          isLoading={isHydrating}
          canDelete={hasCurrentPageEditPermission}
          items={openClawExplosiveAnalysisWorkspace.items}
          deletingRecordId={deletingOpenClawExplosiveAnalysisId}
          onRefresh={async () => {
            await loadArchive({ targetPage: activePage, force: true });
          }}
          onDelete={handleDeleteOpenClawExplosiveAnalysis}
          formatDateTime={formatDateTime}
        />
      );
    }

    if (activePage === "reportMaterialLibrary") {
      return (
        <ReportMaterialLibraryWorkspace
          sectionLabel={currentPage.label}
          sectionDescription={currentPage.description}
          isLoading={isHydrating}
          items={unifiedMaterialLibraryItems}
          onRefresh={async () => {
            await loadArchive({ targetPage: activePage, force: true });
          }}
          formatDateTime={formatDateTime}
          formatCount={formatCount}
        />
      );
    }

    if (activePage === "openclawDailyPlan") {
      return (
        <OpenClawDailyPlanWorkspace
          sectionLabel={currentPage.label}
          sectionDescription={currentPage.description}
          isLoading={isHydrating}
          canDelete={hasCurrentPageEditPermission}
          items={openClawDailyPlanWorkspace.items}
          deletingPlanId={deletingOpenClawDailyPlanId}
          onRefresh={async () => {
            await loadArchive({ targetPage: activePage, force: true });
          }}
          onDelete={handleDeleteOpenClawDailyPlan}
          formatDateTime={formatDateTime}
        />
      );
    }

    if (activePage === "openclawLobsterDiary") {
      return (
        <OpenClawLobsterDiaryWorkspace
          sectionLabel={currentPage.label}
          sectionDescription={currentPage.description}
          isLoading={isHydrating}
          canEdit={hasCurrentPageEditPermission}
          canDelete={hasCurrentPageEditPermission}
          items={openClawLobsterDiaryWorkspace.items}
          deletingDiaryId={deletingOpenClawLobsterDiaryId}
          updatingDiaryId={updatingOpenClawLobsterDiaryId}
          onRefresh={async () => {
            await loadArchive({ targetPage: activePage, force: true });
          }}
          onUpdate={handleUpdateOpenClawDiary}
          onDelete={handleDeleteOpenClawDiary}
          formatDateTime={formatDateTime}
        />
      );
    }

    const latestReport = reportWorkspace.latest;
    const latestVisualReport = visualReportWorkspace.latest;
    const latestPlan = annualMarketingPlanWorkspace.latest;
    const previewHtml = renderMarkdownToHtml(reportMarkdownDraft || latestReport?.reportMarkdown || "");
    const previewDocument = buildVisualReportPreviewDocument(
      latestVisualReport?.title || "品牌增长可视化报告",
      latestVisualReport?.htmlBody || "",
    );
    const growthTaskStatusText = getReportTaskStatusText(latestGrowthTask?.taskStatus);
    const opportunityTaskStatusText = getReportTaskStatusText(latestOpportunityTask?.taskStatus);
    const visualTaskStatusText = getReportTaskStatusText(latestVisualTask?.taskStatus);
    const annualTaskStatusText = getReportTaskStatusText(latestAnnualMarketingTask?.taskStatus);

    return (
      <>
        <BrandGrowthReportWorkspace
          activePage={
            activePage === "opportunityInsight"
              ? "opportunityInsight"
              : activePage === "growthReport"
                ? "growthReport"
                : activePage === "visualGrowthReport"
                  ? "visualGrowthReport"
                  : "annualMarketingPlan"
          }
          reportWorkspace={reportWorkspace}
          opportunityInsightWorkspace={opportunityInsightWorkspace}
          visualReportWorkspace={visualReportWorkspace}
          annualMarketingPlanWorkspace={annualMarketingPlanWorkspace}
          reportMarkdownDraft={reportMarkdownDraft}
          onReportMarkdownDraftChange={setReportMarkdownDraft}
          previewHtml={previewHtml}
          previewDocument={previewDocument}
          growthTaskStatusText={growthTaskStatusText}
          opportunityTaskStatusText={opportunityTaskStatusText}
          visualTaskStatusText={visualTaskStatusText}
          annualTaskStatusText={annualTaskStatusText}
          previewRows={latestPlan?.items ?? []}
          isHydrating={isHydrating}
          isGeneratingReport={isGeneratingReport}
          isGeneratingOpportunityInsight={isGeneratingOpportunityInsight}
          isGeneratingVisualReport={isGeneratingVisualReport}
          isGrowthReportTaskActive={isGrowthReportTaskActive}
          isOpportunityInsightTaskActive={isOpportunityInsightTaskActive}
          isVisualReportTaskActive={isVisualReportTaskActive}
          isAnnualMarketingPlanTaskActive={isAnnualMarketingPlanTaskActive}
          onGenerateReport={handleGenerateReport}
          onGenerateOpportunityInsight={handleGenerateOpportunityInsight}
          onRetryOpportunityInsightStepOne={handleRetryOpportunityInsightStepOne}
          onRetryOpportunityInsightStepTwo={handleRetryOpportunityInsightStepTwo}
          onRetryOpportunityInsightStepThree={handleRetryOpportunityInsightStepThree}
          hasCurrentPageEditPermission={hasCurrentPageEditPermission}
          formatDateTime={formatDateTime}
        />
        {opportunityInsightStepModal ? (
          <OpportunityInsightStepInputModal
            open
            step={opportunityInsightStepModal.step}
            isRetry={opportunityInsightStepModal.isRetry}
            isSubmitting={isGeneratingOpportunityInsight}
            value={getOpportunityInsightStepInput(opportunityInsightStepModal.step)}
            onChange={(value) => setOpportunityInsightStepInput(opportunityInsightStepModal.step, value)}
            onClose={() => {
              if (!isGeneratingOpportunityInsight) {
                setOpportunityInsightStepModal(null);
              }
            }}
            onSubmit={handleSubmitOpportunityInsightStepModal}
          />
        ) : null}
        {renderReportGenerationModal()}
      </>
    );
  }

  function renderPrimaryAction() {
    if (activeBrandPage) {
      return (
        <button type="button" className="primary-button" onClick={() => void saveActivePage()} disabled={isSaving || isHydrating || !hasCurrentPageEditPermission}>
          {isSaving ? "保存中..." : activeBrandPage === "ipLibrary" || activeBrandPage === "products" || activeBrandPage === "survey" ? "保存并下一步" : "保存页面"}
        </button>
      );
    }

    if (activePage === "feishuCollection") {
      return (
        <a href={FEISHU_XHS_TEMPLATE_URL} target="_blank" rel="noreferrer" className="primary-button">
          打开模板
        </a>
      );
    }

    if (activePage === "dailyHotspot") {
      return null;
    }

    if (activePage === "reportTopicLibrary") {
      return null;
    }

    if (activeSection === "collection") {
      return null;
    }

    if (activePage === "opportunityInsight") {
      const opportunityAwaitingStep = opportunityInsightWorkspace.awaitingConfirmationStep ?? 1;
      const showRetryStepOneButton =
        (Boolean(opportunityInsightWorkspace.brandAccountAnalysis && opportunityInsightWorkspace.competitorAccountAnalysis)
          || opportunityAwaitingStep >= 2)
        && !isOpportunityInsightTaskActive;
      const showRetryStepTwoButton =
        Boolean(opportunityInsightWorkspace.commentInsightAnalysis || opportunityInsightWorkspace.finalOpportunityReport)
        && !isOpportunityInsightTaskActive;
      return (
        <div className="strategy-inline-actions">
          {showRetryStepOneButton ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleRetryOpportunityInsightStepOne()}
              disabled={isGeneratingOpportunityInsight || isHydrating || isOpportunityInsightTaskActive || !hasCurrentPageEditPermission}
            >
              {isGeneratingOpportunityInsight ? "提交中..." : "重试第 1 步"}
            </button>
          ) : null}
          {showRetryStepTwoButton ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleRetryOpportunityInsightStepTwo()}
              disabled={isGeneratingOpportunityInsight || isHydrating || isOpportunityInsightTaskActive || !hasCurrentPageEditPermission}
            >
              {isGeneratingOpportunityInsight ? "提交中..." : "重试第 2 步"}
            </button>
          ) : null}
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleGenerateOpportunityInsight()}
            disabled={isGeneratingOpportunityInsight || isHydrating || isOpportunityInsightTaskActive || !hasCurrentPageEditPermission}
          >
            {isGeneratingOpportunityInsight ? "提交中..." : getOpportunityInsightPrimaryActionLabel()}
          </button>
        </div>
      );
    }

    if (activePage === "growthReport") {
      if (isGrowthReportTaskActive) {
        return (
          <button type="button" className="primary-button" disabled>
            {latestGrowthTask?.taskStatus === "QUEUED" ? "排队中..." : "生成中..."}
          </button>
        );
      }
      if (reportWorkspace.latest) {
        return (
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleSaveReport()}
            disabled={isSavingReport || isHydrating || !hasCurrentPageEditPermission}
          >
            {isSavingReport ? "保存中..." : "保存报告"}
          </button>
        );
      }
      return (
        <button
          type="button"
          className="primary-button"
          onClick={() => void handleGenerateReport()}
          disabled={isGeneratingReport || isHydrating || !canGenerateGrowthReport || !hasCurrentPageEditPermission}
        >
          {isGeneratingReport ? "生成中..." : "生成报告"}
        </button>
      );
    }

    if (activePage === "visualGrowthReport") {
      if (!reportWorkspace.latest) {
        return (
          <button type="button" className="primary-button" disabled>
            请先生成品牌增长报告
          </button>
        );
      }
      return (
        <button
          type="button"
          className="primary-button"
          onClick={() => void handleGenerateVisualReport()}
          disabled={isGeneratingVisualReport || isHydrating || !canGenerateVisualGrowthReport || isVisualReportTaskActive || !hasCurrentPageEditPermission}
        >
          {isGeneratingVisualReport ? "提交中..." : isVisualReportTaskActive ? "生成中..." : "生成可视化报告"}
        </button>
      );
    }

    if (activePage === "xiaohongshuMarketingCalendar") {
      return null;
    }

    if (!reportWorkspace.latest) {
      return (
        <button type="button" className="primary-button" disabled>
          请先生成品牌增长报告
        </button>
      );
    }

    return (
      <button
        type="button"
        className="primary-button"
        onClick={() => void handleOpenAnnualMarketingPlanGenerateDialog()}
        disabled={isGeneratingAnnualMarketingPlan || isHydrating || !canGenerateAnnualMarketingPlan || isAnnualMarketingPlanTaskActive || !hasCurrentPageEditPermission}
      >
        {isGeneratingAnnualMarketingPlan ? "提交中..." : isAnnualMarketingPlanTaskActive ? "生成中..." : "生成规划"}
      </button>
    );
  }

  return (
    <main className="archive-shell strategy-shell">
      <section className="strategy-layout">
        <aside className="strategy-level-panel strategy-level-panel--directory strategy-level-panel--accordion">
          <div className="strategy-level-button-list strategy-level-button-list--accordion">
            {visibleStrategySections.map((section) => {
              const isExpanded = expandedSections[section.key];
              const isSectionActive = section.key === activeSection;
              return (
                <div
                  key={section.key}
                  className={`strategy-section-group ${isExpanded ? "is-expanded" : ""} ${isSectionActive ? "is-active" : ""}`}
                >
                  <button
                    type="button"
                    className={`strategy-level-button strategy-level-button--section ${isSectionActive ? "is-active" : ""}`}
                    onClick={() => toggleSection(section.key)}
                    aria-expanded={isExpanded}
                  >
                    <span>{section.label}</span>
                    <span className={`strategy-level-chevron ${isExpanded ? "is-expanded" : ""}`} aria-hidden="true">
                      ▾
                    </span>
                  </button>
                  <div className={`strategy-submenu ${isExpanded ? "is-expanded" : ""}`}>
                    <div className="strategy-level-button-list strategy-level-button-list--nested">
                      {section.pages.map((page) => (
                        <button
                          key={page.key}
                          type="button"
                          className={`strategy-level-button strategy-level-button--nested ${page.key === activePage ? "is-active" : ""}`}
                          onClick={() => switchPage(page.key)}
                        >
                          {page.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="strategy-content-panel">
        {!hasOwnerAccess ? (
          <article className="workspace-panel strategy-page-header">
            <div>
              <strong>当前无权限进入品牌增长策略</strong>
              <p>当前账号未获得品牌增长策略的查看权限；请联系管理员在团队权限设置中为对应板块勾选可见权限。</p>
            </div>
            <div className="strategy-page-header-actions">
              <div className="workspace-status">
                <span className="archive-pill status-pending">{currentBrandRole || "无团队角色"}</span>
                {!isHydrating && errorMessage ? <span className="status-text error-text">{errorMessage}</span> : null}
              </div>
              <div className="strategy-inline-actions">
                <a href="/xiaohongshu" className="primary-button">前往小红书</a>
                <a href="/personal-center" className="secondary-button">返回个人中心</a>
              </div>
            </div>
          </article>
        ) : activeSection === "collection" ? null : (
          <article className="workspace-panel strategy-page-header">
            <div>
              <strong>{currentPage.label}</strong>
              <p>{currentPage.description}</p>
            </div>
            <div className="strategy-page-header-actions">
              <div className="workspace-status">
                <span
                  className={`archive-pill ${
                    dataSource === "api" ? "status-ready" : dataSource === "loading" ? "status-in_progress" : "status-pending"
                  }`}
                >
                  {dataSource === "api" ? "接口数据" : dataSource === "loading" ? "加载中" : "接口异常"}
                </span>
                {isHydrating ? <span className="status-text">正在加载品牌增长策略数据...</span> : null}
                {!isHydrating && notice ? <span className="status-text success-text">{notice}</span> : null}
                {!isHydrating && errorMessage ? <span className="status-text error-text">{errorMessage}</span> : null}
              </div>
              <div className="strategy-inline-actions">
                <button type="button" className="secondary-button" onClick={() => void loadArchive({ targetPage: activePage, force: true })} disabled={isHydrating || isSaving}>
                  刷新数据
                </button>
                {renderPrimaryAction()}
              </div>
            </div>
          </article>
        )}

        {hasOwnerAccess ? (activeBrandPage ? renderLibraryPage() : activeSection === "collection" ? renderCollectionPage() : renderReportPage()) : null}
        </section>
      </section>
      {mediaPreview ? (
        <div className="media-preview-overlay" role="dialog" aria-modal="true" onClick={() => setMediaPreview(null)}>
          <div className="media-preview-dialog" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="media-preview-close" onClick={() => setMediaPreview(null)}>
              关闭
            </button>
            {previewUrls.length > 1 ? (
              <div className="media-preview-toolbar">
                <button
                  type="button"
                  className="note-inline-button"
                  onClick={() =>
                    setMediaPreview((current) =>
                      current
                        ? {
                            ...current,
                            activeIndex: previewIndex > 0 ? previewIndex - 1 : previewUrls.length - 1,
                          }
                        : current,
                    )}
                >
                  上一张
                </button>
                <span className="media-preview-count">
                  第 {previewIndex + 1} / {previewUrls.length} 张
                </span>
                <button
                  type="button"
                  className="note-inline-button"
                  onClick={() =>
                    setMediaPreview((current) =>
                      current
                        ? {
                            ...current,
                            activeIndex: previewIndex < previewUrls.length - 1 ? previewIndex + 1 : 0,
                          }
                        : current,
                    )}
                >
                  下一张
                </button>
              </div>
            ) : null}
            {previewLoadError ? (
              <div className="panel-subtext" style={{ padding: "32px 0" }}>{previewLoadError}</div>
            ) : previewType === "VIDEO" ? (
              <video controls preload="metadata" className="xhs-material-lightbox-video" src={previewDisplayUrl} />
            ) : (
              <img src={previewDisplayUrl} alt={previewTitle} className="media-preview-image" />
            )}
            <div className="media-preview-footer">
              <span>{previewTitle}</span>
              <div className="strategy-inline-actions">
                {previewDisplayDownloadUrl ? (
                  <a href={previewDisplayDownloadUrl} download={mediaPreview.downloadName || resolvedPreviewFileName || undefined} className="secondary-button">
                    下载
                  </a>
                ) : null}
                {previewDisplayUrl ? (
                  <a href={previewDisplayUrl} target="_blank" rel="noreferrer" className="note-data-link">
                    新窗口打开
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function isProtectedMediaSource(sourceUrl?: string) {
  if (!sourceUrl) {
    return false;
  }
  const normalized = sourceUrl.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return normalized.startsWith("/")
    || normalized.startsWith(API_BASE_URL.toLowerCase())
    || normalized.includes("/api/collectors/")
    || normalized.includes("/api/brand-growth/");
}

function buildMediaFileNameFromUrl(sourceUrl: string) {
  try {
    const resolved = new URL(sourceUrl, "https://local.invalid");
    const segment = resolved.pathname.split("/").filter(Boolean).pop();
    return segment || "asset";
  } catch {
    return "asset";
  }
}

function cloneMarketingCalendarItem(item: XiaohongshuMarketingCalendarItem): XiaohongshuMarketingCalendarItem {
  return {
    ...item,
    brandMarketing: { ...item.brandMarketing },
    xiaohongshu: {
      brandAccount: {
        ...item.xiaohongshu.brandAccount,
        noteKeywords: [...item.xiaohongshu.brandAccount.noteKeywords],
        coverKeywords: [...item.xiaohongshu.brandAccount.coverKeywords],
        titleSuggestions: [...item.xiaohongshu.brandAccount.titleSuggestions],
      },
      employeeAccount: {
        ...item.xiaohongshu.employeeAccount,
        noteKeywords: [...item.xiaohongshu.employeeAccount.noteKeywords],
        coverKeywords: [...item.xiaohongshu.employeeAccount.coverKeywords],
        titleSuggestions: [...item.xiaohongshu.employeeAccount.titleSuggestions],
      },
    },
    douyin: {
      brandAccount: {
        ...item.douyin.brandAccount,
        copyKeywords: [...item.douyin.brandAccount.copyKeywords],
        coverKeywords: [...item.douyin.brandAccount.coverKeywords],
        titleSuggestions: [...item.douyin.brandAccount.titleSuggestions],
      },
      ipAccount: {
        ...item.douyin.ipAccount,
        copyKeywords: [...item.douyin.ipAccount.copyKeywords],
        coverKeywords: [...item.douyin.ipAccount.coverKeywords],
        titleSuggestions: [...item.douyin.ipAccount.titleSuggestions],
      },
      employeeAccount: {
        ...item.douyin.employeeAccount,
        copyKeywords: [...item.douyin.employeeAccount.copyKeywords],
        coverKeywords: [...item.douyin.employeeAccount.coverKeywords],
        titleSuggestions: [...item.douyin.employeeAccount.titleSuggestions],
      },
    },
    moments: { ...item.moments },
  };
}

function createEmptyMarketingCalendarItem(date: string): XiaohongshuMarketingCalendarItem {
  const normalizedDate = date.trim();
  const id = normalizedDate ? `cal_manual_${normalizedDate.replace(/-/g, "")}` : `cal_manual_${Date.now()}`;
  return {
    id,
    date: normalizedDate,
    festivalOrSolarTerm: "",
    brandMarketing: {
      theme: "",
      description: "",
    },
    xiaohongshu: {
      brandAccount: {
        topic: "",
        description: "",
        contentType: "",
        noteKeywords: [],
        coverKeywords: [],
        titleSuggestions: [],
        expectedPerformance: "",
      },
      employeeAccount: {
        topic: "",
        description: "",
        contentType: "",
        noteKeywords: [],
        coverKeywords: [],
        titleSuggestions: [],
        expectedPerformance: "",
      },
    },
    douyin: {
      brandAccount: {
        topic: "",
        description: "",
        contentType: "",
        presentationFormat: "",
        copyKeywords: [],
        coverKeywords: [],
        titleSuggestions: [],
        expectedPerformance: "",
      },
      ipAccount: {
        topic: "",
        description: "",
        contentType: "",
        presentationFormat: "",
        copyKeywords: [],
        coverKeywords: [],
        titleSuggestions: [],
        expectedPerformance: "",
      },
      employeeAccount: {
        topic: "",
        description: "",
        contentType: "",
        presentationFormat: "",
        copyKeywords: [],
        coverKeywords: [],
        titleSuggestions: [],
        expectedPerformance: "",
      },
    },
    moments: {
      topic: "",
      description: "",
      presentationFormat: "",
    },
  };
}

function normalizeEditableMarketingCalendarItem(item: XiaohongshuMarketingCalendarItem): XiaohongshuMarketingCalendarItem {
  return {
    ...item,
    date: item.date.trim(),
    festivalOrSolarTerm: item.festivalOrSolarTerm?.trim() || "",
    brandMarketing: {
      theme: item.brandMarketing.theme.trim(),
      description: item.brandMarketing.description.trim(),
    },
    xiaohongshu: {
      brandAccount: {
        topic: item.xiaohongshu.brandAccount.topic.trim(),
        description: item.xiaohongshu.brandAccount.description.trim(),
        contentType: item.xiaohongshu.brandAccount.contentType.trim(),
        noteKeywords: normalizeCalendarItemList(item.xiaohongshu.brandAccount.noteKeywords),
        coverKeywords: normalizeCalendarItemList(item.xiaohongshu.brandAccount.coverKeywords),
        titleSuggestions: normalizeCalendarItemList(item.xiaohongshu.brandAccount.titleSuggestions),
        expectedPerformance: item.xiaohongshu.brandAccount.expectedPerformance.trim(),
      },
      employeeAccount: {
        topic: item.xiaohongshu.employeeAccount.topic.trim(),
        description: item.xiaohongshu.employeeAccount.description.trim(),
        contentType: item.xiaohongshu.employeeAccount.contentType.trim(),
        noteKeywords: normalizeCalendarItemList(item.xiaohongshu.employeeAccount.noteKeywords),
        coverKeywords: normalizeCalendarItemList(item.xiaohongshu.employeeAccount.coverKeywords),
        titleSuggestions: normalizeCalendarItemList(item.xiaohongshu.employeeAccount.titleSuggestions),
        expectedPerformance: item.xiaohongshu.employeeAccount.expectedPerformance.trim(),
      },
    },
    douyin: {
      brandAccount: {
        topic: item.douyin.brandAccount.topic.trim(),
        description: item.douyin.brandAccount.description.trim(),
        contentType: item.douyin.brandAccount.contentType.trim(),
        presentationFormat: item.douyin.brandAccount.presentationFormat.trim(),
        copyKeywords: normalizeCalendarItemList(item.douyin.brandAccount.copyKeywords),
        coverKeywords: normalizeCalendarItemList(item.douyin.brandAccount.coverKeywords),
        titleSuggestions: normalizeCalendarItemList(item.douyin.brandAccount.titleSuggestions),
        expectedPerformance: item.douyin.brandAccount.expectedPerformance.trim(),
      },
      ipAccount: {
        topic: item.douyin.ipAccount.topic.trim(),
        description: item.douyin.ipAccount.description.trim(),
        contentType: item.douyin.ipAccount.contentType.trim(),
        presentationFormat: item.douyin.ipAccount.presentationFormat.trim(),
        copyKeywords: normalizeCalendarItemList(item.douyin.ipAccount.copyKeywords),
        coverKeywords: normalizeCalendarItemList(item.douyin.ipAccount.coverKeywords),
        titleSuggestions: normalizeCalendarItemList(item.douyin.ipAccount.titleSuggestions),
        expectedPerformance: item.douyin.ipAccount.expectedPerformance.trim(),
      },
      employeeAccount: {
        topic: item.douyin.employeeAccount.topic.trim(),
        description: item.douyin.employeeAccount.description.trim(),
        contentType: item.douyin.employeeAccount.contentType.trim(),
        presentationFormat: item.douyin.employeeAccount.presentationFormat.trim(),
        copyKeywords: normalizeCalendarItemList(item.douyin.employeeAccount.copyKeywords),
        coverKeywords: normalizeCalendarItemList(item.douyin.employeeAccount.coverKeywords),
        titleSuggestions: normalizeCalendarItemList(item.douyin.employeeAccount.titleSuggestions),
        expectedPerformance: item.douyin.employeeAccount.expectedPerformance.trim(),
      },
    },
    moments: {
      topic: item.moments.topic.trim(),
      description: item.moments.description.trim(),
      presentationFormat: item.moments.presentationFormat.trim(),
    },
  };
}

function normalizeCalendarItemList(items?: string[]) {
  return (items || []).map((item) => item.trim()).filter(Boolean);
}

function updateMarketingCalendarItemByPath(
  item: XiaohongshuMarketingCalendarItem,
  path: string,
  value: string | string[],
): XiaohongshuMarketingCalendarItem {
  const nextItem = cloneMarketingCalendarItem(item);
  const segments = path.split(".").filter(Boolean);
  if (!segments.length) {
    return nextItem;
  }
  let current: Record<string, unknown> = nextItem as unknown as Record<string, unknown>;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    current[segment] = { ...(current[segment] as Record<string, unknown>) };
    current = current[segment] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
  return nextItem;
}

function getReportTaskStatusClass(status?: "PENDING" | "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED") {
  if (status === "SUCCESS") {
    return "status-ready";
  }
  if (status === "FAILED" || status === "CANCELLED") {
    return "status-pending";
  }
  if (status === "QUEUED" || status === "RUNNING" || status === "PENDING") {
    return "status-in_progress";
  }
  return "status-pending";
}
