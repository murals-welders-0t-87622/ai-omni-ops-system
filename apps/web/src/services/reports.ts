import { getStoredCurrentBrandId } from "./auth-session";
import { DEMO_BRAND_ID } from "./brand-growth";
import { jsonRequest, request } from "./http";

const REPORT_WORKSPACE_CACHE_TTL_MS = 30_000;
const REPORT_WORKSPACE_STORAGE_PREFIX = "brand-growth:report-workspace:";

type ReportWorkspaceCacheEntry = {
  data?: unknown;
  expiresAt: number;
  promise?: Promise<unknown>;
};

function getReportWorkspaceCacheStore() {
  const scope = globalThis as typeof globalThis & {
    __brandGrowthReportWorkspaceCache?: Map<string, ReportWorkspaceCacheEntry>;
  };
  if (!scope.__brandGrowthReportWorkspaceCache) {
    scope.__brandGrowthReportWorkspaceCache = new Map<string, ReportWorkspaceCacheEntry>();
  }
  return scope.__brandGrowthReportWorkspaceCache;
}

const reportWorkspaceCache = getReportWorkspaceCacheStore();

export type GrowthReportRecord = {
  id: string;
  title: string;
  summary: string;
  generatedAt: string;
  taskId?: string;
  mediaId?: string;
  reportMarkdown: string;
  htmlContent: string;
  diagnosis: string[];
  opportunities: string[];
  nextActions: string[];
  metrics: {
    productCount: number;
    platformAccountCount: number;
    competitorAccountCount: number;
    brandNoteCount: number;
    benchmarkNoteCount: number;
  };
};

export type GrowthReportWorkspace = {
  latest?: GrowthReportRecord;
  history: GrowthReportRecord[];
  latestTask?: GrowthReportTaskRecord;
};

export type OpportunityInsightStepKey =
  | "brandAccountAnalysis"
  | "competitorAccountAnalysis"
  | "commentInsightAnalysis"
  | "finalOpportunityReport";

export type OpportunityInsightReportRecord = {
  id: string;
  title: string;
  summary: string;
  generatedAt: string;
  taskId?: string;
  mediaId?: string;
  modelName?: string;
  htmlBody: string;
  htmlDocument: string;
  stepKey: OpportunityInsightStepKey;
};

export type OpportunityInsightTaskRecord = {
  id: string;
  taskType: string;
  taskTitle: string;
  taskStatus: "PENDING" | "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  modelName: string;
  pointsCost: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  phase?: string;
  phaseText?: string;
  phaseIndex?: number;
  phaseTotal?: number;
  stepKey?: OpportunityInsightStepKey;
};

export type OpportunityInsightWorkspace = {
  brandAccountAnalysis?: OpportunityInsightReportRecord;
  competitorAccountAnalysis?: OpportunityInsightReportRecord;
  commentInsightAnalysis?: OpportunityInsightReportRecord;
  finalOpportunityReport?: OpportunityInsightReportRecord;
  history: OpportunityInsightReportRecord[];
  latestTask?: OpportunityInsightTaskRecord;
  awaitingConfirmationStep?: 1 | 2 | 3;
};

export type GenerateOpportunityInsightPayload = {
  supplementInput?: string;
};

export type GenerateMarketingPlanPayload = {
  userRequirement?: string;
};

export type VisualGrowthReportRecord = {
  id: string;
  title: string;
  summary: string;
  generatedAt: string;
  taskId?: string;
  mediaId?: string;
  sourceReportId?: string;
  sourceReportTitle?: string;
  htmlBody: string;
  htmlDocument: string;
};

export type VisualGrowthReportTaskRecord = {
  id: string;
  taskType: string;
  taskTitle: string;
  taskStatus: "PENDING" | "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  modelName: string;
  pointsCost: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  sourceReportId?: string;
  sourceReportTitle?: string;
  phase?: string;
  phaseText?: string;
  phaseIndex?: number;
  phaseTotal?: number;
};

export type GrowthReportTaskRecord = VisualGrowthReportTaskRecord;

export type VisualGrowthReportWorkspace = {
  latest?: VisualGrowthReportRecord;
  history: VisualGrowthReportRecord[];
  latestTask?: VisualGrowthReportTaskRecord;
};

export type AnnualMarketingPlanRow = {
  month: string;
  node: string;
  date: string;
  type: string;
  marketingTheme: string;
  platforms: string[];
  strategy: string;
  products: string[];
};

export type AnnualMarketingPlanRecord = {
  id: string;
  title: string;
  summary: string;
  generatedAt: string;
  taskId?: string;
  mediaId?: string;
  sourceReportId?: string;
  sourceReportTitle?: string;
  planningYear: string;
  planningFocus: string[];
  items: AnnualMarketingPlanRow[];
  htmlBody: string;
  htmlDocument: string;
};

export type AnnualMarketingPlanTaskRecord = {
  id: string;
  taskType: string;
  taskTitle: string;
  taskStatus: "PENDING" | "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  modelName: string;
  pointsCost: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  sourceReportId?: string;
  sourceReportTitle?: string;
};

export type XiaohongshuMarketingPlanTaskRecord = {
  id: string;
  taskType: string;
  taskTitle: string;
  taskStatus: "PENDING" | "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  modelName: string;
  pointsCost: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  sourceReportId?: string;
  sourceReportTitle?: string;
  phase?: string;
  phaseText?: string;
  phaseIndex?: number;
  phaseTotal?: number;
};

export type AnnualMarketingPlanWorkspace = {
  latest?: AnnualMarketingPlanRecord;
  history: AnnualMarketingPlanRecord[];
  latestTask?: AnnualMarketingPlanTaskRecord;
};

export type HalfYearMarketingPlanRow = AnnualMarketingPlanRow;
export type HalfYearMarketingPlanRecord = AnnualMarketingPlanRecord;
export type HalfYearMarketingPlanTaskRecord = AnnualMarketingPlanTaskRecord;
export type HalfYearMarketingPlanWorkspace = AnnualMarketingPlanWorkspace;

export type XiaohongshuMarketingPlanRecord = {
  id: string;
  title: string;
  summary: string;
  generatedAt: string;
  taskId?: string;
  mediaId?: string;
  sourceReportId?: string;
  sourceReportTitle?: string;
  sourceAnnualPlanId?: string;
  sourceAnnualPlanTitle?: string;
  reportMarkdown: string;
  htmlContent: string;
  modelName?: string;
};

export type XiaohongshuMarketingPlanWorkspace = {
  latest?: XiaohongshuMarketingPlanRecord;
  history: XiaohongshuMarketingPlanRecord[];
  latestTask?: XiaohongshuMarketingPlanTaskRecord;
};

export type DouyinMarketingPlanRecord = {
  id: string;
  title: string;
  summary: string;
  generatedAt: string;
  taskId?: string;
  mediaId?: string;
  sourceReportId?: string;
  sourceReportTitle?: string;
  sourceAnnualPlanId?: string;
  sourceAnnualPlanTitle?: string;
  reportMarkdown: string;
  htmlContent: string;
  modelName?: string;
};

export type DouyinMarketingPlanTaskRecord = XiaohongshuMarketingPlanTaskRecord;

export type DouyinMarketingPlanWorkspace = {
  latest?: DouyinMarketingPlanRecord;
  history: DouyinMarketingPlanRecord[];
  latestTask?: DouyinMarketingPlanTaskRecord;
};

export type DouyinHotTopicCandidateItem = {
  id: string;
  title: string;
  description?: string;
  checked?: boolean;
};

export type DouyinTopicLibraryItem = {
  id: string;
  topicTitle: string;
  topicContent: string;
  topicPlatform: "抖音" | "视频号" | "小红书" | "公众号";
  contentFormat: "图文" | "视频" | "长文章";
  presentationFormat: string;
  topicGoal: string;
  expertSkill: string;
  reusable: boolean;
  reuseCycle?: string;
  selectedAt: string;
  topicDescription?: string;
  source?: "GENERATED" | "MANUAL" | "OPENCLAW";
  sourceDate?: string;
  matchedExplosiveTemplateHtmls?: string[];
};

export type DouyinOriginalCopyType =
  | "VIEWPOINT"
  | "STORY"
  | "PROCESS"
  | "KNOWLEDGE"
  | "PLOT_SALES"
  | "SEEDING"
  | "LOCAL_SALES";

export type DouyinOriginalCopyCalendarOption = {
  id: string;
  label: string;
  date: string;
  topicName: string;
};

export type DouyinOriginalCopyRecord = {
  id: string;
  title: string;
  summary: string;
  generatedAt: string;
  taskId?: string;
  modelName?: string;
  copyType: DouyinOriginalCopyType;
  copyTypeLabel: string;
  content: string;
  topicId: string;
  topicTitle?: string;
  topicContent: string;
  topicDescription?: string;
  calendarItemId?: string;
  calendarItemLabel?: string;
  injectMarketingPlan: boolean;
  marketingPlanTitle?: string;
  userRequirement?: string;
};

export type DouyinRemixCopyRecord = {
  id: string;
  title: string;
  summary: string;
  generatedAt: string;
  taskId?: string;
  modelName?: string;
  content: string;
  sourceMaterialId: string;
  sourceMaterialTitle: string;
  sourceVideoUrl: string;
  sourceAuthorName?: string;
  sourceWorkUrl?: string;
  injectBrandProfile: boolean;
  injectMarketingPlan: boolean;
  marketingPlanTitle?: string;
  productId?: string;
  productName?: string;
  userRequirement?: string;
  extractedCopy?: string;
  introBreakdown?: string;
  bodyBreakdown?: string;
  outroBreakdown?: string;
};

export type DouyinHotTopicCandidatesRecord = {
  id: string;
  title: string;
  summary: string;
  generatedAt: string;
  taskId?: string;
  selectedDate: string;
  modelName?: string;
  items: DouyinHotTopicCandidateItem[];
  reportContent?: string;
};

export type DouyinHotTopicCandidatesTaskRecord = XiaohongshuMarketingPlanTaskRecord;
export type DouyinOriginalCopyTaskRecord = XiaohongshuMarketingPlanTaskRecord;

export type DouyinHotTopicCandidatesWorkspace = {
  selectedDate: string;
  availableDates: string[];
  latest?: DouyinHotTopicCandidatesRecord;
  history: DouyinHotTopicCandidatesRecord[];
  latestTask?: DouyinHotTopicCandidatesTaskRecord;
  topicLibrary: DouyinTopicLibraryItem[];
};

export type DouyinOriginalCopyWorkspace = {
  latest?: DouyinOriginalCopyRecord;
  history: DouyinOriginalCopyRecord[];
  latestTask?: DouyinOriginalCopyTaskRecord;
  calendarOptions: DouyinOriginalCopyCalendarOption[];
  topicOptions: DouyinTopicLibraryItem[];
  hasMarketingPlan: boolean;
  marketingPlanTitle?: string;
};

export type DouyinRemixCopyMaterialOption = {
  id: string;
  title: string;
  videoUrl: string;
  authorName?: string;
  workUrl?: string;
};

export type DouyinRemixCopyProductOption = {
  id: string;
  productName: string;
};

export type DouyinRemixCopyTaskRecord = DouyinOriginalCopyTaskRecord;

export type DouyinRemixCopyWorkspace = {
  latest?: DouyinRemixCopyRecord;
  history: DouyinRemixCopyRecord[];
  latestTask?: DouyinRemixCopyTaskRecord;
  materialOptions: DouyinRemixCopyMaterialOption[];
  productOptions: DouyinRemixCopyProductOption[];
  hasMarketingPlan: boolean;
  marketingPlanTitle?: string;
};

export type MarketingCalendarThemeBlock = {
  theme: string;
  description: string;
};

export type MarketingCalendarXhsAccountBlock = {
  topic: string;
  description: string;
  contentType: string;
  noteKeywords: string[];
  coverKeywords: string[];
  titleSuggestions: string[];
  expectedPerformance: string;
};

export type MarketingCalendarDouyinAccountBlock = {
  topic: string;
  description: string;
  contentType: string;
  presentationFormat: string;
  copyKeywords: string[];
  coverKeywords: string[];
  titleSuggestions: string[];
  expectedPerformance: string;
};

export type MarketingCalendarMomentsBlock = {
  topic: string;
  description: string;
  presentationFormat: string;
};

export type MarketingCalendarCapabilityItem = {
  platform: string;
  featureName: string;
  outputType: string;
  description: string;
};

export type MarketingCalendarCapabilityInventory = {
  generatedAt: string;
  items: MarketingCalendarCapabilityItem[];
};

export type XiaohongshuMarketingCalendarItem = {
  id: string;
  date: string;
  festivalOrSolarTerm?: string;
  brandMarketing: MarketingCalendarThemeBlock;
  xiaohongshu: {
    brandAccount: MarketingCalendarXhsAccountBlock;
    employeeAccount: MarketingCalendarXhsAccountBlock;
  };
  douyin: {
    brandAccount: MarketingCalendarDouyinAccountBlock;
    ipAccount: MarketingCalendarDouyinAccountBlock;
    employeeAccount: MarketingCalendarDouyinAccountBlock;
  };
  moments: MarketingCalendarMomentsBlock;
  topicName?: string;
  productName?: string;
  noteType?: string;
  targetAudience?: string;
  contentGoal?: string;
  expressionFocus?: string;
  topicContent?: string;
  noteKeywords?: string[];
  titleDirections?: string[];
  bodyStructure?: string;
  coverFormat?: string;
  coverKeywords?: string[];
  imageBrief?: string;
};

export type XiaohongshuMarketingCalendarRecord = {
  id: string;
  title: string;
  summary: string;
  generatedAt: string;
  taskId?: string;
  sourceReportId?: string;
  sourceReportTitle?: string;
  sourceAnnualPlanId?: string;
  sourceAnnualPlanTitle?: string;
  sourceMarketingPlanId?: string;
  sourceMarketingPlanTitle?: string;
  sourceOpportunityReportId?: string;
  sourceOpportunityReportTitle?: string;
  modelName?: string;
  executionCapabilityInventory?: MarketingCalendarCapabilityInventory;
  items: XiaohongshuMarketingCalendarItem[];
};

export type XiaohongshuMarketingCalendarTaskRecord = XiaohongshuMarketingPlanTaskRecord;

export type XiaohongshuMarketingCalendarWorkspace = {
  latest?: XiaohongshuMarketingCalendarRecord;
  history: XiaohongshuMarketingCalendarRecord[];
  latestTask?: XiaohongshuMarketingCalendarTaskRecord;
};

export const growthReportSeed: GrowthReportWorkspace = {
  latest: {
    id: "ast_demo_growth_report_001",
    title: "武汉仟吉品牌增长报告",
    summary: "品牌线下基础较强，但公域内容供给和会员转化链路仍有明显提升空间。",
    generatedAt: "2026-05-01T10:00:00.000Z",
    taskId: "tsk_demo_001",
    mediaId: "med_demo_001",
    reportMarkdown: "# 武汉仟吉品牌增长报告\n\n品牌线下基础较强，但公域内容供给和会员转化链路仍有明显提升空间。",
    htmlContent:
      "<section><h1>武汉仟吉品牌增长报告</h1><p>品牌线下基础较强，但公域内容供给和会员转化链路仍有明显提升空间。</p></section>",
    diagnosis: [
      "品牌产品力和门店覆盖具备基础优势，但线上内容资产积累不足。",
      "小红书账号与竞品差距主要体现在持续更新频率和互动运营。",
      "经营数据与行业报告说明节日礼赠和门店转化是近期增长重点。",
    ],
    opportunities: [
      "围绕节日礼赠场景做爆款产品种草内容矩阵。",
      "用门店日常与新品体验提升用户评论互动率。",
      "把品牌报告、营销日历和原创笔记串成标准内容生产链路。",
    ],
    nextActions: [
      "完成小红书账号和品牌作品的固定周期采集。",
      "生成首版小红书营销策划方案并同步到营销日历。",
      "围绕核心产品完成原创笔记首轮投放测试。",
    ],
    metrics: {
      productCount: 2,
      platformAccountCount: 2,
      competitorAccountCount: 1,
      brandNoteCount: 1,
      benchmarkNoteCount: 1,
    },
  },
  history: [],
};

growthReportSeed.history = growthReportSeed.latest ? [growthReportSeed.latest] : [];

export const visualGrowthReportSeed: VisualGrowthReportWorkspace = {
  latest: undefined,
  history: [],
};

export const opportunityInsightSeed: OpportunityInsightWorkspace = {
  brandAccountAnalysis: undefined,
  competitorAccountAnalysis: undefined,
  commentInsightAnalysis: undefined,
  finalOpportunityReport: undefined,
  history: [],
  latestTask: undefined,
  awaitingConfirmationStep: 1,
};

export const annualMarketingPlanSeed: AnnualMarketingPlanWorkspace = {
  latest: undefined,
  history: [],
};

export const halfYearMarketingPlanSeed = annualMarketingPlanSeed;

export const xiaohongshuMarketingPlanSeed: XiaohongshuMarketingPlanWorkspace = {
  latest: undefined,
  history: [],
};

export const douyinMarketingPlanSeed: DouyinMarketingPlanWorkspace = {
  latest: undefined,
  history: [],
};

export const douyinHotTopicCandidatesSeed: DouyinHotTopicCandidatesWorkspace = {
  selectedDate: "",
  availableDates: [],
  latest: undefined,
  history: [],
  topicLibrary: [],
};

export const douyinOriginalCopySeed: DouyinOriginalCopyWorkspace = {
  latest: undefined,
  history: [],
  calendarOptions: [],
  topicOptions: [],
  hasMarketingPlan: false,
};

export const douyinRemixCopySeed: DouyinRemixCopyWorkspace = {
  latest: undefined,
  history: [],
  materialOptions: [],
  productOptions: [],
  hasMarketingPlan: false,
};

function resolveBrandId(brandId?: string) {
  return getStoredCurrentBrandId(brandId || DEMO_BRAND_ID) || DEMO_BRAND_ID;
}

export async function getGrowthReportWorkspace(brandId?: string, options?: { force?: boolean }) {
  const resolvedBrandId = resolveBrandId(brandId);
  return getCachedReportWorkspace<GrowthReportWorkspace>(
    buildReportWorkspaceCacheKey("growth-report", resolvedBrandId),
    () => request<GrowthReportWorkspace>(`/reports/brands/${resolvedBrandId}/growth-report`),
    options,
  );
}

export async function generateGrowthReport(brandId?: string) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return jsonRequest<GrowthReportWorkspace>(`/reports/brands/${resolvedBrandId}/growth-report/generate`, "POST", {});
}

export async function getOpportunityInsightWorkspace(brandId?: string, options?: { force?: boolean }) {
  const resolvedBrandId = resolveBrandId(brandId);
  return getCachedReportWorkspace<OpportunityInsightWorkspace>(
    buildReportWorkspaceCacheKey("opportunity-insight", resolvedBrandId),
    () => request<OpportunityInsightWorkspace>(`/reports/brands/${resolvedBrandId}/opportunity-insight`),
    options,
  );
}

export async function generateOpportunityInsightStepOne(brandId?: string, payload: GenerateOpportunityInsightPayload = {}) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return jsonRequest<OpportunityInsightWorkspace>(
    `/reports/brands/${resolvedBrandId}/opportunity-insight/step-one/generate`,
    "POST",
    payload,
  );
}

export async function generateOpportunityInsightStepTwo(brandId?: string, payload: GenerateOpportunityInsightPayload = {}) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return jsonRequest<OpportunityInsightWorkspace>(
    `/reports/brands/${resolvedBrandId}/opportunity-insight/step-two/generate`,
    "POST",
    payload,
  );
}

export async function generateOpportunityInsightStepThree(brandId?: string, payload: GenerateOpportunityInsightPayload = {}) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return jsonRequest<OpportunityInsightWorkspace>(
    `/reports/brands/${resolvedBrandId}/opportunity-insight/step-three/generate`,
    "POST",
    payload,
  );
}

export async function updateGrowthReport(reportId: string, reportMarkdown: string, title?: string, brandId?: string) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return jsonRequest<GrowthReportWorkspace>(`/reports/brands/${resolvedBrandId}/growth-report/${reportId}`, "PATCH", {
    title,
    reportMarkdown,
  });
}

export async function getVisualGrowthReportWorkspace(brandId?: string, options?: { force?: boolean }) {
  const resolvedBrandId = resolveBrandId(brandId);
  return getCachedReportWorkspace<VisualGrowthReportWorkspace>(
    buildReportWorkspaceCacheKey("visual-growth-report", resolvedBrandId),
    () => request<VisualGrowthReportWorkspace>(`/reports/brands/${resolvedBrandId}/visual-growth-report`),
    options,
  );
}

export async function generateVisualGrowthReport(brandId?: string) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return jsonRequest<VisualGrowthReportWorkspace>(`/reports/brands/${resolvedBrandId}/visual-growth-report/generate`, "POST", {});
}

export async function updateVisualGrowthReport(reportId: string, htmlBody: string, title?: string, brandId?: string) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return jsonRequest<VisualGrowthReportWorkspace>(`/reports/brands/${resolvedBrandId}/visual-growth-report/${reportId}`, "PATCH", {
    title,
    htmlBody,
  });
}

export async function getHalfYearMarketingPlanWorkspace(brandId?: string, options?: { force?: boolean }) {
  const resolvedBrandId = resolveBrandId(brandId);
  return getCachedReportWorkspace<HalfYearMarketingPlanWorkspace>(
    buildReportWorkspaceCacheKey("half-year-marketing-plan", resolvedBrandId),
    () => request<HalfYearMarketingPlanWorkspace>(`/reports/brands/${resolvedBrandId}/half-year-marketing-plan`),
    options,
  );
}

export async function generateHalfYearMarketingPlan(payload?: GenerateMarketingPlanPayload, brandId?: string) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return jsonRequest<HalfYearMarketingPlanWorkspace>(`/reports/brands/${resolvedBrandId}/half-year-marketing-plan/generate`, "POST", {
    userRequirement: payload?.userRequirement?.trim() || undefined,
  });
}

export const getAnnualMarketingPlanWorkspace = getHalfYearMarketingPlanWorkspace;
export const generateAnnualMarketingPlan = generateHalfYearMarketingPlan;

export async function getXiaohongshuMarketingPlanWorkspace(brandId?: string, options?: { force?: boolean }) {
  const resolvedBrandId = resolveBrandId(brandId);
  return getCachedReportWorkspace<XiaohongshuMarketingPlanWorkspace>(
    buildReportWorkspaceCacheKey("xiaohongshu-marketing-plan", resolvedBrandId),
    () => request<XiaohongshuMarketingPlanWorkspace>(`/reports/brands/${resolvedBrandId}/xiaohongshu-marketing-plan`),
    options,
  );
}

export async function generateXiaohongshuMarketingPlan(payload?: GenerateMarketingPlanPayload, brandId?: string) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return jsonRequest<XiaohongshuMarketingPlanWorkspace>(
    `/reports/brands/${resolvedBrandId}/xiaohongshu-marketing-plan/generate`,
    "POST",
    {
      userRequirement: payload?.userRequirement?.trim() || undefined,
    },
  );
}

export async function updateXiaohongshuMarketingPlan(
  reportId: string,
  reportMarkdown: string,
  title?: string,
  brandId?: string,
) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return jsonRequest<XiaohongshuMarketingPlanWorkspace>(`/reports/brands/${resolvedBrandId}/xiaohongshu-marketing-plan/${reportId}`, "PATCH", {
    title,
    reportMarkdown,
  });
}

export async function deleteXiaohongshuMarketingPlan(reportId: string, brandId?: string) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return request<XiaohongshuMarketingPlanWorkspace>(`/reports/brands/${resolvedBrandId}/xiaohongshu-marketing-plan/${reportId}`, {
    method: "DELETE",
  });
}

export async function getDouyinMarketingPlanWorkspace(brandId?: string) {
  return request<DouyinMarketingPlanWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-marketing-plan`);
}

export async function generateDouyinMarketingPlan(payload?: GenerateMarketingPlanPayload, brandId?: string) {
  return jsonRequest<DouyinMarketingPlanWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-marketing-plan/generate`, "POST", {
    userRequirement: payload?.userRequirement?.trim() || undefined,
  });
}

export async function updateDouyinMarketingPlan(
  reportId: string,
  reportMarkdown: string,
  title?: string,
  brandId?: string,
) {
  return jsonRequest<DouyinMarketingPlanWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-marketing-plan/${reportId}`, "PATCH", {
    title,
    reportMarkdown,
  });
}

export async function deleteDouyinMarketingPlan(reportId: string, brandId?: string) {
  return request<DouyinMarketingPlanWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-marketing-plan/${reportId}`, {
    method: "DELETE",
  });
}

export async function getDouyinHotTopicCandidatesWorkspace(brandId?: string, selectedDate?: string) {
  const suffix = selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : "";
  return request<DouyinHotTopicCandidatesWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-hot-topic-candidates${suffix}`);
}

export async function generateDouyinHotTopicCandidates(selectedDate?: string, brandId?: string) {
  return jsonRequest<DouyinHotTopicCandidatesWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-hot-topic-candidates/generate`, "POST", {
    selectedDate,
  });
}

export async function updateDouyinTopicLibrary(items: DouyinTopicLibraryItem[], brandId?: string) {
  return jsonRequest<DouyinHotTopicCandidatesWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-topic-library`, "PATCH", {
    items,
  });
}

export async function getDouyinOriginalCopyWorkspace(brandId?: string) {
  return request<DouyinOriginalCopyWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-original-copy`);
}

export async function generateDouyinOriginalCopy(
  payload: {
    calendarItemId?: string;
    topicId?: string;
    injectMarketingPlan: boolean;
    copyType: DouyinOriginalCopyType;
    userRequirement?: string;
  },
  brandId?: string,
) {
  return jsonRequest<DouyinOriginalCopyWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-original-copy/generate`, "POST", payload);
}

export async function updateDouyinOriginalCopy(
  reportId: string,
  payload: {
    title?: string;
    content: string;
    userRequirement?: string;
  },
  brandId?: string,
) {
  return jsonRequest<DouyinOriginalCopyWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-original-copy/${reportId}`, "PATCH", payload);
}

export async function deleteDouyinOriginalCopy(reportId: string, brandId?: string) {
  return request<DouyinOriginalCopyWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-original-copy/${reportId}`, {
    method: "DELETE",
  });
}

export async function getDouyinRemixCopyWorkspace(brandId?: string) {
  return request<DouyinRemixCopyWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-remix-copy`);
}

export async function generateDouyinRemixCopy(
  payload: {
    materialId: string;
    injectBrandProfile?: boolean;
    productId?: string;
    injectMarketingPlan?: boolean;
    userRequirement?: string;
  },
  brandId?: string,
) {
  return jsonRequest<DouyinRemixCopyWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-remix-copy/generate`, "POST", payload);
}

export async function updateDouyinRemixCopy(
  reportId: string,
  payload: {
    title?: string;
    content: string;
  },
  brandId?: string,
) {
  return jsonRequest<DouyinRemixCopyWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-remix-copy/${reportId}`, "PATCH", payload);
}

export async function deleteDouyinRemixCopy(reportId: string, brandId?: string) {
  return request<DouyinRemixCopyWorkspace>(`/reports/brands/${resolveBrandId(brandId)}/douyin-remix-copy/${reportId}`, {
    method: "DELETE",
  });
}

export async function getXiaohongshuMarketingCalendarWorkspace(brandId?: string, options?: { force?: boolean }) {
  const resolvedBrandId = resolveBrandId(brandId);
  return getCachedReportWorkspace<XiaohongshuMarketingCalendarWorkspace>(
    buildReportWorkspaceCacheKey("xiaohongshu-marketing-calendar", resolvedBrandId),
    () => request<XiaohongshuMarketingCalendarWorkspace>(`/reports/brands/${resolvedBrandId}/xiaohongshu-marketing-calendar`),
    options,
  );
}

export async function generateXiaohongshuMarketingCalendar(payload?: GenerateMarketingPlanPayload, brandId?: string) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return jsonRequest<XiaohongshuMarketingCalendarWorkspace>(`/reports/brands/${resolvedBrandId}/xiaohongshu-marketing-calendar/generate`, "POST", {
    userRequirement: payload?.userRequirement?.trim() || undefined,
  });
}

export async function updateXiaohongshuMarketingCalendar(
  reportId: string,
  items: XiaohongshuMarketingCalendarItem[],
  title?: string,
  brandId?: string,
) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return jsonRequest<XiaohongshuMarketingCalendarWorkspace>(`/reports/brands/${resolvedBrandId}/xiaohongshu-marketing-calendar/${reportId}`, "PATCH", {
    title,
    items,
  });
}

export async function upsertXiaohongshuMarketingCalendarItem(
  reportId: string,
  date: string,
  item: XiaohongshuMarketingCalendarItem,
  title?: string,
  brandId?: string,
) {
  const resolvedBrandId = resolveBrandId(brandId);
  clearReportWorkspaceCacheByBrand(resolvedBrandId);
  return jsonRequest<XiaohongshuMarketingCalendarWorkspace>(
    `/reports/brands/${resolvedBrandId}/xiaohongshu-marketing-calendar/${reportId}/items/${encodeURIComponent(date)}`,
    "PATCH",
    {
      title,
      item,
    },
  );
}

function buildReportWorkspaceCacheKey(scope: string, brandId: string) {
  return `${scope}:${brandId}`;
}

async function getCachedReportWorkspace<T>(cacheKey: string, loader: () => Promise<T>, options?: { force?: boolean }) {
  let cached = reportWorkspaceCache.get(cacheKey) as
    | {
        data?: T;
        expiresAt: number;
        promise?: Promise<T>;
      }
    | undefined;

  if (!options?.force && (!cached?.data || cached.expiresAt <= Date.now())) {
    const stored = readReportWorkspaceCache<T>(cacheKey);
    if (stored) {
      cached = stored;
      reportWorkspaceCache.set(cacheKey, stored);
    }
  }

  if (!options?.force && cached?.data && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (!options?.force && cached?.promise) {
    return cached.promise;
  }

  const pending = loader()
    .then((response) => {
      const nextEntry = {
        data: response,
        expiresAt: Date.now() + REPORT_WORKSPACE_CACHE_TTL_MS,
      };
      reportWorkspaceCache.set(cacheKey, nextEntry);
      writeReportWorkspaceCache(cacheKey, nextEntry);
      return response;
    })
    .finally(() => {
      const latest = reportWorkspaceCache.get(cacheKey);
      if (latest?.promise === pending) {
        if (latest.data !== undefined) {
          reportWorkspaceCache.set(cacheKey, {
            data: latest.data,
            expiresAt: latest.expiresAt,
          });
        } else {
          reportWorkspaceCache.delete(cacheKey);
        }
      }
    });

  reportWorkspaceCache.set(cacheKey, {
    data: cached?.data,
    expiresAt: cached?.expiresAt || 0,
    promise: pending,
  });

  return pending;
}

function clearReportWorkspaceCacheByBrand(brandId: string) {
  for (const key of reportWorkspaceCache.keys()) {
    if (key.endsWith(`:${brandId}`)) {
      reportWorkspaceCache.delete(key);
    }
  }
  clearStoredReportWorkspaceCacheByBrand(brandId);
}

function readReportWorkspaceCache<T>(cacheKey: string) {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const raw = window.sessionStorage.getItem(`${REPORT_WORKSPACE_STORAGE_PREFIX}${cacheKey}`);
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as {
      data?: T;
      expiresAt: number;
    };

    if (!parsed || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(`${REPORT_WORKSPACE_STORAGE_PREFIX}${cacheKey}`);
      return undefined;
    }

    return parsed;
  } catch {
    window.sessionStorage.removeItem(`${REPORT_WORKSPACE_STORAGE_PREFIX}${cacheKey}`);
    return undefined;
  }
}

function writeReportWorkspaceCache(cacheKey: string, entry: { data?: unknown; expiresAt: number }) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(`${REPORT_WORKSPACE_STORAGE_PREFIX}${cacheKey}`, JSON.stringify(entry));
  } catch {
    // Ignore storage quota or serialization failures and keep in-memory cache only.
  }
}

function clearStoredReportWorkspaceCacheByBrand(brandId: string) {
  if (typeof window === "undefined") {
    return;
  }

  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(REPORT_WORKSPACE_STORAGE_PREFIX) && key.endsWith(`:${brandId}`)) {
      window.sessionStorage.removeItem(key);
    }
  }
}
