import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { AssetCategory, MediaType, Prisma, TaskStatus } from "@prisma/client";
import { createId, database, type ApiProviderRecord, type AssetRecord } from "../../common/mock-data";
import { XHS_MARKETING_CALENDAR_PROMPT_FALLBACK } from "../../common/prompt-fallbacks";
import { applySkillProviderSelectionRule } from "../../common/skill-provider-selection";
import { AppConfigService } from "../../config/app-config.service";
import { OssStorageService } from "../../storage/oss-storage.service";
import { ApiProvidersService } from "../admin/api-providers.service";
import { KnowledgeBasesService, type KnowledgeBindingView } from "../admin/knowledge-bases.service";
import { CollectorsService } from "../collectors/collectors.service";
import { BrandsService } from "../brands/brands.service";
import { SkillsPromptsService } from "../admin/skills-prompts.service";
import { ThirdPartyPlatformsService } from "../third-party-platforms/third-party-platforms.service";
import { PrismaService } from "../../prisma/prisma.service";
const GROWTH_REPORT_TASK_TIMEOUT_MS = 15 * 60 * 1000;
const OPPORTUNITY_INSIGHT_TASK_TIMEOUT_MS = 20 * 60 * 1000;
const OPPORTUNITY_INSIGHT_TASK_TYPES = [
  "OPPORTUNITY_INSIGHT_STEP_ONE",
  "OPPORTUNITY_INSIGHT_STEP_TWO",
  "OPPORTUNITY_INSIGHT_STEP_THREE",
] as const;
const VISUAL_REPORT_TASK_TIMEOUT_MS = 10 * 60 * 1000;
const ANNUAL_MARKETING_PLAN_TASK_TIMEOUT_MS = 15 * 60 * 1000;
const XIAOHONGSHU_MARKETING_PLAN_TASK_TIMEOUT_MS = 60 * 60 * 1000;
const DOUYIN_MARKETING_PLAN_TASK_TIMEOUT_MS = 60 * 60 * 1000;
const DOUYIN_HOT_TOPIC_CANDIDATES_TASK_TIMEOUT_MS = 10 * 60 * 1000;
const DOUYIN_ORIGINAL_COPY_TASK_TIMEOUT_MS = 10 * 60 * 1000;
const DOUYIN_REMIX_COPY_TASK_TIMEOUT_MS = 12 * 60 * 1000;
const XIAOHONGSHU_MARKETING_CALENDAR_TASK_TIMEOUT_MS = 10 * 60 * 1000;
const TEXT_MODEL_ATTEMPT_TIMEOUT_MS = 120 * 1000;
const BRAND_GROWTH_KNOWLEDGE_TARGET_ID = "brand-growth-workbench";
const MODULE_KNOWLEDGE_BINDING_LIMIT = 3;
const MODULE_KNOWLEDGE_TOP_K = 4;
const CURRENT_HALF_YEAR_MARKETING_PLAN_ASSET_KIND = "BRAND_HALF_YEAR_MARKETING_PLAN";
const LEGACY_ANNUAL_MARKETING_PLAN_ASSET_KIND = "BRAND_ANNUAL_MARKETING_PLAN";
const CURRENT_HALF_YEAR_MARKETING_PLAN_TASK_TYPE = "BRAND_HALF_YEAR_MARKETING_PLAN";
const LEGACY_ANNUAL_MARKETING_PLAN_TASK_TYPE = "BRAND_ANNUAL_MARKETING_PLAN";
const HALF_YEAR_MARKETING_PLAN_TASK_TYPES = [
  CURRENT_HALF_YEAR_MARKETING_PLAN_TASK_TYPE,
  LEGACY_ANNUAL_MARKETING_PLAN_TASK_TYPE,
];
const HALF_YEAR_MARKETING_PLAN_ASSET_KINDS = [
  CURRENT_HALF_YEAR_MARKETING_PLAN_ASSET_KIND,
  LEGACY_ANNUAL_MARKETING_PLAN_ASSET_KIND,
] as const;

type DouyinOriginalCopyType =
  | "VIEWPOINT"
  | "STORY"
  | "PROCESS"
  | "KNOWLEDGE"
  | "PLOT_SALES"
  | "SEEDING"
  | "LOCAL_SALES";

const DOUYIN_ORIGINAL_COPY_TYPE_CONFIG: Record<DouyinOriginalCopyType, {
  label: string;
  skillSlug: string;
  promptId: string;
  fallbackPrompt: string;
}> = {
  VIEWPOINT: {
    label: "聊观点",
    skillSlug: "douyin-original-copy-viewpoint",
    promptId: "prompt_douyin_original_copy_viewpoint",
    fallbackPrompt: "根据品牌资料、营销日历、选题内容与抖音营销策划方案，生成聊观点类抖音原创文案。",
  },
  STORY: {
    label: "讲故事",
    skillSlug: "douyin-original-copy-story",
    promptId: "prompt_douyin_original_copy_story",
    fallbackPrompt: "根据品牌资料、营销日历、选题内容与抖音营销策划方案，生成讲故事类抖音原创文案。",
  },
  PROCESS: {
    label: "晒过程",
    skillSlug: "douyin-original-copy-process",
    promptId: "prompt_douyin_original_copy_process",
    fallbackPrompt: "根据品牌资料、营销日历、选题内容与抖音营销策划方案，生成晒过程类抖音原创文案。",
  },
  KNOWLEDGE: {
    label: "教知识",
    skillSlug: "douyin-original-copy-knowledge",
    promptId: "prompt_douyin_original_copy_knowledge",
    fallbackPrompt: "根据品牌资料、营销日历、选题内容与抖音营销策划方案，生成教知识类抖音原创文案。",
  },
  PLOT_SALES: {
    label: "剧情带货",
    skillSlug: "douyin-original-copy-plot-sales",
    promptId: "prompt_douyin_original_copy_plot_sales",
    fallbackPrompt: "根据品牌资料、营销日历、选题内容与抖音营销策划方案，生成剧情带货类抖音原创文案。",
  },
  SEEDING: {
    label: "种草类",
    skillSlug: "douyin-original-copy-seeding",
    promptId: "prompt_douyin_original_copy_seeding",
    fallbackPrompt: "根据品牌资料、营销日历、选题内容与抖音营销策划方案，生成种草类抖音原创文案。",
  },
  LOCAL_SALES: {
    label: "同城带货",
    skillSlug: "douyin-original-copy-local-sales",
    promptId: "prompt_douyin_original_copy_local_sales",
    fallbackPrompt: "根据品牌资料、营销日历、选题内容与抖音营销策划方案，生成同城带货类抖音原创文案。",
  },
};

type DouyinRemixCopyPromptStage = "INTRO" | "BODY" | "OUTRO" | "FINAL";

const DOUYIN_REMIX_COPY_PROMPT_CONFIG: Record<DouyinRemixCopyPromptStage, {
  label: string;
  skillSlug: string;
  promptId: string;
  fallbackPrompt: string;
  temperature: number;
  maxTokens: number;
}> = {
  INTRO: {
    label: "拆解开头",
    skillSlug: "douyin-remix-copy-intro",
    promptId: "prompt_douyin_remix_copy_intro",
    fallbackPrompt: "根据提取出来的视频文案，拆解出适合复用的开头结构、钩子和表达方式。",
    temperature: 0.3,
    maxTokens: 2400,
  },
  BODY: {
    label: "拆解正文",
    skillSlug: "douyin-remix-copy-body",
    promptId: "prompt_douyin_remix_copy_body",
    fallbackPrompt: "根据提取出来的视频文案，拆解出适合复用的正文结构、论证顺序和关键卖点。",
    temperature: 0.3,
    maxTokens: 3200,
  },
  OUTRO: {
    label: "拆解结尾",
    skillSlug: "douyin-remix-copy-outro",
    promptId: "prompt_douyin_remix_copy_outro",
    fallbackPrompt: "根据提取出来的视频文案，拆解出适合复用的结尾结构、行动引导和收束方式。",
    temperature: 0.3,
    maxTokens: 2400,
  },
  FINAL: {
    label: "生成二创文案",
    skillSlug: "douyin-remix-copy-final",
    promptId: "prompt_douyin_remix_copy_final",
    fallbackPrompt: "根据拆解后的开头、正文、结尾内容，以及品牌资料、产品资料、营销策划资料和用户要求，生成抖音二创文案。",
    temperature: 0.4,
    maxTokens: 4200,
  },
};

type GrowthReportAssetMeta = {
  kind: "BRAND_GROWTH_REPORT";
  generatedAt: string;
  taskId?: string;
  mediaId?: string;
  summary: string;
  reportMarkdown?: string;
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
  htmlContent: string;
};

type VisualGrowthReportAssetMeta = {
  kind: "BRAND_GROWTH_VISUAL_REPORT";
  generatedAt: string;
  taskId?: string;
  mediaId?: string;
  sourceReportId?: string;
  sourceReportTitle?: string;
  summary: string;
  htmlBody: string;
  htmlDocument: string;
};

type OpportunityInsightStepKey =
  | "brandAccountAnalysis"
  | "competitorAccountAnalysis"
  | "commentInsightAnalysis"
  | "finalOpportunityReport";

type OpportunityInsightAssetMeta = {
  kind: "OPPORTUNITY_INSIGHT_REPORT";
  stepKey: OpportunityInsightStepKey;
  generatedAt: string;
  taskId?: string;
  mediaId?: string;
  summary: string;
  htmlBody: string;
  htmlDocument: string;
  modelName?: string;
};

type AnnualMarketingPlanRow = {
  month: string;
  node: string;
  date: string;
  type: string;
  marketingTheme: string;
  platforms: string[];
  strategy: string;
  products: string[];
};

type AnnualMarketingPlanAssetMeta = {
  kind: typeof CURRENT_HALF_YEAR_MARKETING_PLAN_ASSET_KIND | typeof LEGACY_ANNUAL_MARKETING_PLAN_ASSET_KIND;
  generatedAt: string;
  taskId?: string;
  mediaId?: string;
  sourceReportId?: string;
  sourceReportTitle?: string;
  summary: string;
  planningYear: string;
  planningFocus: string[];
  items: AnnualMarketingPlanRow[];
  htmlBody: string;
  htmlDocument: string;
};

type XiaohongshuMarketingPlanAssetMeta = {
  kind: "XHS_MARKETING_PLAN";
  generatedAt: string;
  taskId?: string;
  mediaId?: string;
  sourceReportId?: string;
  sourceReportTitle?: string;
  sourceAnnualPlanId?: string;
  sourceAnnualPlanTitle?: string;
  summary: string;
  reportMarkdown: string;
  htmlContent: string;
  modelName?: string;
};

type DouyinMarketingPlanAssetMeta = {
  kind: "DOUYIN_MARKETING_PLAN";
  generatedAt: string;
  taskId?: string;
  mediaId?: string;
  sourceReportId?: string;
  sourceReportTitle?: string;
  sourceAnnualPlanId?: string;
  sourceAnnualPlanTitle?: string;
  summary: string;
  reportMarkdown: string;
  htmlContent: string;
  modelName?: string;
};

type DouyinHotTopicCandidateItem = {
  id: string;
  title: string;
  description?: string;
  checked?: boolean;
};

type DouyinHotTopicCandidatesAssetMeta = {
  kind: "DOUYIN_HOT_TOPIC_CANDIDATES";
  generatedAt: string;
  taskId?: string;
  summary: string;
  selectedDate: string;
  modelName?: string;
  items: DouyinHotTopicCandidateItem[];
  reportContent?: string;
};

type DouyinTopicLibraryItem = {
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

type DouyinTopicLibraryAssetMeta = {
  kind: "DOUYIN_TOPIC_LIBRARY";
  updatedAt: string;
  summary: string;
  items: DouyinTopicLibraryItem[];
};

type DouyinOriginalCopyCalendarOption = {
  id: string;
  label: string;
  date: string;
  topicName: string;
};

type DouyinOriginalCopyAssetMeta = {
  kind: "DOUYIN_ORIGINAL_COPY";
  generatedAt: string;
  taskId?: string;
  summary: string;
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
  modelName?: string;
};

type DouyinRemixCopyMaterialOption = {
  id: string;
  title: string;
  videoUrl: string;
  authorName?: string;
  workUrl?: string;
};

type DouyinRemixCopyProductOption = {
  id: string;
  productName: string;
};

type DouyinRemixCopyAssetMeta = {
  kind: "DOUYIN_REMIX_COPY";
  generatedAt: string;
  taskId?: string;
  summary: string;
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
  modelName?: string;
};

type MarketingCalendarThemeBlock = {
  theme: string;
  description: string;
};

type MarketingCalendarXhsAccountBlock = {
  topic: string;
  description: string;
  contentType: string;
  noteKeywords: string[];
  coverKeywords: string[];
  titleSuggestions: string[];
  expectedPerformance: string;
};

type MarketingCalendarDouyinAccountBlock = {
  topic: string;
  description: string;
  contentType: string;
  presentationFormat: string;
  copyKeywords: string[];
  coverKeywords: string[];
  titleSuggestions: string[];
  expectedPerformance: string;
};

type MarketingCalendarMomentsBlock = {
  topic: string;
  description: string;
  presentationFormat: string;
};

type MarketingCalendarCapabilityItem = {
  platform: string;
  featureName: string;
  outputType: string;
  description: string;
};

type MarketingCalendarCapabilityInventory = {
  generatedAt: string;
  items: MarketingCalendarCapabilityItem[];
};

type XiaohongshuMarketingCalendarItem = {
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

type XiaohongshuMarketingCalendarAssetMeta = {
  kind: "XHS_MARKETING_CALENDAR";
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
  summary: string;
  modelName?: string;
  executionCapabilityInventory?: MarketingCalendarCapabilityInventory;
  items: XiaohongshuMarketingCalendarItem[];
};

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
export type OpportunityInsightTaskRecord = VisualGrowthReportTaskRecord & {
  stepKey?: OpportunityInsightStepKey;
};
export type AnnualMarketingPlanTaskRecord = VisualGrowthReportTaskRecord;
export type XiaohongshuMarketingPlanTaskRecord = VisualGrowthReportTaskRecord;
export type DouyinMarketingPlanTaskRecord = VisualGrowthReportTaskRecord;
export type DouyinHotTopicCandidatesTaskRecord = VisualGrowthReportTaskRecord;
export type DouyinOriginalCopyTaskRecord = VisualGrowthReportTaskRecord;
export type DouyinRemixCopyTaskRecord = VisualGrowthReportTaskRecord;
export type XiaohongshuMarketingCalendarTaskRecord = VisualGrowthReportTaskRecord;

type ThirdPartyChatConfig = {
  baseUrls: string[];
  completionPath: string;
  apiKeys: string[];
  models: string[];
  temperature: number;
  maxTokens: number;
};

type VisualProviderType = "DEEPSEEK" | "KIMI" | "GLM" | "ARK";
type GrowthReportProviderType = "THIRD_PARTY" | VisualProviderType;

type DomesticVisualProviderConfig = ThirdPartyChatConfig & {
  provider: VisualProviderType;
  providerId: string;
  providerName: string;
  requestTimeoutMs?: number;
  payloadExtras?: Record<string, unknown>;
  temperatureOverride?: number;
  tokenLimitField?: "max_tokens" | "max_completion_tokens";
};

type GrowthReportProviderConfig = ThirdPartyChatConfig & {
  provider: GrowthReportProviderType;
  providerId: string;
  providerName: string;
  requestTimeoutMs?: number;
  payloadExtras?: Record<string, unknown>;
  temperatureOverride?: number;
  tokenLimitField?: "max_tokens" | "max_completion_tokens";
};

type AnnualMarketingProviderType = "THIRD_PARTY" | "DEEPSEEK" | "ARK";

type AnnualMarketingProviderConfig = ThirdPartyChatConfig & {
  provider: AnnualMarketingProviderType;
  providerId: string;
  providerName: string;
  requestTimeoutMs?: number;
  payloadExtras?: Record<string, unknown>;
  temperatureOverride?: number;
  tokenLimitField?: "max_tokens" | "max_completion_tokens";
};

type XiaohongshuMarketingProviderType = "THIRD_PARTY" | VisualProviderType;

type XiaohongshuMarketingProviderConfig = ThirdPartyChatConfig & {
  provider: XiaohongshuMarketingProviderType;
  providerId: string;
  providerName: string;
  requestTimeoutMs?: number;
  payloadExtras?: Record<string, unknown>;
  temperatureOverride?: number;
  tokenLimitField?: "max_tokens" | "max_completion_tokens";
};

type ModelGenerationSettings = {
  baseUrl: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  promptContent: string;
  preferredModelName?: string;
  brandId?: string;
  preferredProviderIds?: string[];
  debugProviderSummary?: string;
  knowledgeScope?: {
    moduleTargetId?: string;
    skillPackageKey?: string;
    skillSlug?: string;
    legacyPromptId?: string;
    workflowStepId?: string;
  };
};

type GrowthReportModelResult = {
  title: string;
  summary: string;
  diagnosis: string[];
  opportunities: string[];
  nextActions: string[];
  reportMarkdown: string;
};

type VisualReportModelResult = {
  title: string;
  summary: string;
  htmlBody: string;
};

type VisualReportMetricItem = {
  label: string;
  value: string;
  note: string;
};

type VisualReportSectionItem = {
  title: string;
  body: string;
  bullets: string[];
};

type VisualReportOutlineModelResult = {
  title: string;
  summary: string;
  eyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  metrics: VisualReportMetricItem[];
  sections: VisualReportSectionItem[];
  actionTitle: string;
  actionItems: string[];
};

type AnnualMarketingPlanModelResult = {
  title: string;
  summary: string;
  planningYear: string;
  planningFocus: string[];
  items: AnnualMarketingPlanRow[];
  modelName: string;
};

type XiaohongshuMarketingPlanModelResult = {
  title: string;
  summary: string;
  reportMarkdown: string;
  modelName: string;
};

type DouyinMarketingPlanModelResult = {
  title: string;
  summary: string;
  reportMarkdown: string;
  modelName: string;
};

type OpportunityInsightAccountModelResult = {
  title: string;
  summary: string;
  reportMarkdown: string;
  modelName: string;
  reportFormat?: "markdown" | "html";
};

type DouyinHotTopicCandidatesModelResult = {
  title: string;
  summary: string;
  selectedDate: string;
  items: DouyinHotTopicCandidateItem[];
  modelName: string;
  reportContent?: string;
};

type DouyinOriginalCopyModelResult = {
  title: string;
  summary: string;
  content: string;
  modelName: string;
  copyType: DouyinOriginalCopyType;
  copyTypeLabel: string;
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

type DouyinRemixCopyModelResult = {
  title: string;
  summary: string;
  content: string;
  modelName: string;
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

type XiaohongshuMarketingCalendarModelResult = {
  title: string;
  summary: string;
  items: XiaohongshuMarketingCalendarItem[];
  modelName: string;
};

type XiaohongshuMarketingPlanSectionResult = {
  markdown: string;
  modelName: string;
};

type XiaohongshuMarketingPlanPhase =
  | "PREPARING"
  | "PART_ONE"
  | "PART_TWO"
  | "PART_THREE"
  | "PART_FOUR"
  | "PART_FIVE"
  | "MERGING"
  | "PERSISTING"
  | "DONE";
type DouyinMarketingPlanPhase = "PREPARING" | "GENERATING" | "PERSISTING" | "DONE";
type DouyinHotTopicCandidatesPhase = "PREPARING" | "GENERATING" | "PERSISTING" | "DONE";
type DouyinOriginalCopyPhase = "PREPARING" | "GENERATING" | "PERSISTING" | "DONE";
type DouyinRemixCopyPhase = "PREPARING" | "EXTRACTING" | "ANALYZING" | "GENERATING" | "PERSISTING" | "DONE";
type XiaohongshuMarketingCalendarPhase = "PREPARING" | "GENERATING" | "PERSISTING" | "DONE";
type OpportunityInsightStepOnePhase = "PREPARING" | "BRAND_ACCOUNT_ANALYSIS" | "COMPETITOR_ACCOUNT_ANALYSIS" | "PERSISTING" | "DONE";

export type UpdateGrowthReportPayload = {
  title?: string;
  reportMarkdown: string;
};

export type UpdateVisualGrowthReportPayload = {
  title?: string;
  htmlBody: string;
};

export type UpdateXiaohongshuMarketingPlanPayload = {
  title?: string;
  reportMarkdown: string;
};

export type UpdateDouyinMarketingPlanPayload = {
  title?: string;
  reportMarkdown: string;
};

export type GenerateXiaohongshuMarketingPlanPayload = {
  userRequirement?: string;
};

export type GenerateDouyinMarketingPlanPayload = {
  userRequirement?: string;
};

export type GenerateAnnualMarketingPlanPayload = {
  userRequirement?: string;
};

export type GenerateXiaohongshuMarketingCalendarPayload = {
  userRequirement?: string;
  title?: string;
  items?: XiaohongshuMarketingCalendarItem[];
};

export type UpdateXiaohongshuMarketingCalendarPayload = {
  title?: string;
  items: XiaohongshuMarketingCalendarItem[];
};

export type UpsertXiaohongshuMarketingCalendarItemPayload = {
  title?: string;
  item: XiaohongshuMarketingCalendarItem;
};

export type OpenClawUpsertXiaohongshuMarketingCalendarItemParams = {
  reportId?: string;
  date?: string;
  payload: UpsertXiaohongshuMarketingCalendarItemPayload;
};

export type UpdateDouyinTopicLibraryPayload = {
  items: DouyinTopicLibraryItem[];
};

export type GenerateOpportunityInsightPayload = {
  supplementInput?: string;
};

export type GenerateDouyinOriginalCopyPayload = {
  calendarItemId?: string;
  topicId?: string;
  injectMarketingPlan?: boolean;
  copyType: DouyinOriginalCopyType;
  userRequirement?: string;
};

export type UpdateDouyinOriginalCopyPayload = {
  title?: string;
  content: string;
  userRequirement?: string;
};

export type GenerateDouyinRemixCopyPayload = {
  materialId: string;
  injectBrandProfile?: boolean;
  productId?: string;
  injectMarketingPlan?: boolean;
  userRequirement?: string;
};

export type UpdateDouyinRemixCopyPayload = {
  title?: string;
  content: string;
};

export type GrowthReportWorkspace = {
  latest?: GrowthReportRecord;
  history: GrowthReportRecord[];
  latestTask?: GrowthReportTaskRecord;
};

export type VisualGrowthReportWorkspace = {
  latest?: VisualGrowthReportRecord;
  history: VisualGrowthReportRecord[];
  latestTask?: VisualGrowthReportTaskRecord;
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

export type AnnualMarketingPlanWorkspace = {
  latest?: AnnualMarketingPlanRecord;
  history: AnnualMarketingPlanRecord[];
  latestTask?: AnnualMarketingPlanTaskRecord;
};

export type XiaohongshuMarketingPlanWorkspace = {
  latest?: XiaohongshuMarketingPlanRecord;
  history: XiaohongshuMarketingPlanRecord[];
  latestTask?: XiaohongshuMarketingPlanTaskRecord;
};

export type DouyinMarketingPlanWorkspace = {
  latest?: DouyinMarketingPlanRecord;
  history: DouyinMarketingPlanRecord[];
  latestTask?: DouyinMarketingPlanTaskRecord;
};

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

export type DouyinRemixCopyWorkspace = {
  latest?: DouyinRemixCopyRecord;
  history: DouyinRemixCopyRecord[];
  latestTask?: DouyinRemixCopyTaskRecord;
  materialOptions: DouyinRemixCopyMaterialOption[];
  productOptions: DouyinRemixCopyProductOption[];
  hasMarketingPlan: boolean;
  marketingPlanTitle?: string;
};

export type XiaohongshuMarketingCalendarWorkspace = {
  latest?: XiaohongshuMarketingCalendarRecord;
  history: XiaohongshuMarketingCalendarRecord[];
  latestTask?: XiaohongshuMarketingCalendarTaskRecord;
};

@Injectable()
export class ReportsService {
  private readonly appConfigService = new AppConfigService();
  private readonly ossStorageService = new OssStorageService(this.appConfigService);

  constructor(
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(BrandsService)
    private readonly brandsService: BrandsService,
    @Inject(CollectorsService)
    private readonly collectorsService: CollectorsService,
    @Inject(ApiProvidersService)
    private readonly apiProvidersService: ApiProvidersService,
    @Inject(SkillsPromptsService)
    private readonly skillsPromptsService: SkillsPromptsService,
    @Inject(ThirdPartyPlatformsService)
    private readonly thirdPartyPlatformsService: ThirdPartyPlatformsService,
    @Inject(KnowledgeBasesService)
    private readonly knowledgeBasesService: KnowledgeBasesService,
  ) {}

  private async resolveBrandAwareApiKeys(
    brandId: string | undefined,
    provider: ApiProviderRecord | undefined,
    options: { allowMissingBrandApiKey?: boolean } = {},
  ) {
    if (!provider) {
      return [];
    }
    const resolution = await this.thirdPartyPlatformsService.resolveBrandRuntimeApiKeys(
      brandId,
      this.apiProvidersService.getBaseUrls(provider),
    );
    if (resolution.status === "brand-api-key-missing") {
      if (options.allowMissingBrandApiKey) {
        return [];
      }
      throw new ServiceUnavailableException(
        `当前品牌尚未配置第三方平台「${resolution.platform.name}」API Key，请先前往个人中心-第三方接口配置完成品牌共享设置后再试。`,
      );
    }
    if (resolution.status === "resolved") {
      return resolution.apiKeys;
    }
    return this.apiProvidersService.getApiKeys(provider);
  }

  async getGrowthReportWorkspace(brandId: string): Promise<GrowthReportWorkspace> {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const assets = await this.prismaService.businessAsset.findMany({
        where: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
        orderBy: { createdAt: "desc" },
      });

      const reports = assets
        .map((item) => this.mapGrowthReportAsset({
          id: item.id,
          brandId: item.brandId,
          category: "GENERATED_REPORT",
          title: item.title,
          description: item.description ?? "",
          sourceName: "绯荤粺鐢熸垚",
          fileUrl: item.fileUrl ?? undefined,
          metadataJson: this.asMeta(item.metadataJson),
        }))
        .filter((item): item is GrowthReportRecord => Boolean(item));

      const latestTaskRow = await this.prismaService.task.findFirst({
        where: {
          brandId,
          taskType: "BRAND_GROWTH_REPORT",
        },
        orderBy: { createdAt: "desc" },
      });
      const normalizedTask = latestTaskRow
        ? await this.normalizeLatestGrowthReportTask(brandId, this.mapVisualGrowthReportTask(latestTaskRow))
        : undefined;

      return {
        latest: reports[0],
        history: reports,
        latestTask: normalizedTask,
      };
    }

    this.ensureBrandExistsInMock(brandId);
    const reports = database.assets
      .filter((item) => item.brandId === brandId && item.category === "GENERATED_REPORT")
      .map((item) => this.mapGrowthReportAsset(item))
      .filter((item): item is GrowthReportRecord => Boolean(item))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    const latestTask = [...database.tasks]
      .filter((item) => item.brandId === brandId && item.taskType === "BRAND_GROWTH_REPORT")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const normalizedTask = latestTask
      ? await this.normalizeLatestGrowthReportTask(brandId, this.mapVisualGrowthReportTask(latestTask))
      : undefined;

    return {
      latest: reports[0],
      history: reports,
      latestTask: normalizedTask,
    };
  }

  async generateGrowthReport(brandId: string) {
    const workspace = await this.getGrowthReportWorkspace(brandId);
    const runningTask = workspace.latestTask;
    if (runningTask && (runningTask.taskStatus === "QUEUED" || runningTask.taskStatus === "RUNNING")) {
      return workspace;
    }

    const task = await this.createGrowthReportTask(brandId);
    setTimeout(() => {
      void this.runGrowthReportTask(brandId, task.id);
    }, 0);
    return {
      ...workspace,
      latestTask: task,
    };
  }

  async getOpportunityInsightWorkspace(brandId: string): Promise<OpportunityInsightWorkspace> {
    const collectWorkspace = (assets: AssetRecord[]) =>
      assets
        .map((item) => this.mapOpportunityInsightAsset(item))
        .filter((item): item is OpportunityInsightReportRecord => Boolean(item))
        .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));

    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const assets = await this.prismaService.businessAsset.findMany({
        where: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
        orderBy: { createdAt: "desc" },
      });
      const reports = collectWorkspace(
        assets.map((item) => ({
          id: item.id,
          brandId: item.brandId,
          category: "GENERATED_REPORT",
          title: item.title,
          description: item.description ?? "",
          sourceName: "系统生成",
          fileUrl: item.fileUrl ?? undefined,
          metadataJson: this.asMeta(item.metadataJson),
        })),
      );
      const latestTaskRow = await this.prismaService.task.findFirst({
        where: {
          brandId,
          taskType: {
            in: [...OPPORTUNITY_INSIGHT_TASK_TYPES],
          },
        },
        orderBy: { createdAt: "desc" },
      });
      const latestTask = latestTaskRow
        ? await this.normalizeLatestOpportunityInsightTask(brandId, this.mapOpportunityInsightTask(latestTaskRow))
        : undefined;
      return this.buildOpportunityInsightWorkspace(reports, latestTask);
    }

    this.ensureBrandExistsInMock(brandId);
    const reports = collectWorkspace(
      database.assets.filter((item) => item.brandId === brandId && item.category === "GENERATED_REPORT"),
    );
    const latestTaskRow = [...database.tasks]
      .filter((item) => item.brandId === brandId && OPPORTUNITY_INSIGHT_TASK_TYPES.includes(item.taskType as typeof OPPORTUNITY_INSIGHT_TASK_TYPES[number]))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const latestTask = latestTaskRow
      ? await this.normalizeLatestOpportunityInsightTask(brandId, this.mapOpportunityInsightTask(latestTaskRow))
      : undefined;
    return this.buildOpportunityInsightWorkspace(reports, latestTask);
  }

  async generateOpportunityInsightStepOne(brandId: string, payload: GenerateOpportunityInsightPayload = {}) {
    const workspace = await this.getOpportunityInsightWorkspace(brandId);
    const runningTask = workspace.latestTask;
    if (runningTask && (runningTask.taskStatus === "QUEUED" || runningTask.taskStatus === "RUNNING")) {
      return workspace;
    }

    const task = await this.createOpportunityInsightStepOneTask(brandId, payload);
    setTimeout(() => {
      void this.runOpportunityInsightStepOneTask(brandId, task.id);
    }, 0);

    return {
      ...workspace,
      latestTask: task,
    };
  }

  async generateOpportunityInsightStepTwo(brandId: string, payload: GenerateOpportunityInsightPayload = {}) {
    const workspace = await this.getOpportunityInsightWorkspace(brandId);
    const runningTask = workspace.latestTask;
    if (runningTask && (runningTask.taskStatus === "QUEUED" || runningTask.taskStatus === "RUNNING")) {
      return workspace;
    }
    if (!workspace.brandAccountAnalysis || !workspace.competitorAccountAnalysis) {
      throw new ServiceUnavailableException("请先完成机会洞察第 1 步，并确认品牌账号分析与竞品账号分析后再继续。");
    }
    const task = await this.createOpportunityInsightStepTwoTask(brandId, payload);
    setTimeout(() => {
      void this.runOpportunityInsightStepTwoTask(brandId, task.id);
    }, 0);

    return {
      ...workspace,
      latestTask: task,
    };
  }

  async generateOpportunityInsightStepThree(brandId: string, payload: GenerateOpportunityInsightPayload = {}) {
    const workspace = await this.getOpportunityInsightWorkspace(brandId);
    const runningTask = workspace.latestTask;
    if (runningTask && (runningTask.taskStatus === "QUEUED" || runningTask.taskStatus === "RUNNING")) {
      return workspace;
    }
    if (!workspace.brandAccountAnalysis || !workspace.competitorAccountAnalysis) {
      throw new ServiceUnavailableException("请先完成机会洞察第 1 步，并确认品牌账号分析与竞品账号分析后再继续。");
    }
    if (!workspace.commentInsightAnalysis) {
      throw new ServiceUnavailableException("请先完成机会洞察第 2 步评论洞察分析后，再生成机会洞察总报告。");
    }

    const task = await this.createOpportunityInsightStepThreeTask(brandId, payload);
    setTimeout(() => {
      void this.runOpportunityInsightStepThreeTask(brandId, task.id);
    }, 0);

    return {
      ...workspace,
      latestTask: task,
    };
  }

  async getVisualGrowthReportWorkspace(brandId: string): Promise<VisualGrowthReportWorkspace> {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const assets = await this.prismaService.businessAsset.findMany({
        where: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
        orderBy: { createdAt: "desc" },
      });

      const reports = assets
        .map((item) => this.mapVisualGrowthReportAsset({
          id: item.id,
          brandId: item.brandId,
          category: "GENERATED_REPORT",
          title: item.title,
          description: item.description ?? "",
          sourceName: "绯荤粺鐢熸垚",
          fileUrl: item.fileUrl ?? undefined,
          metadataJson: this.asMeta(item.metadataJson),
        }))
        .filter((item): item is VisualGrowthReportRecord => Boolean(item));

      const latestTaskRow = await this.prismaService.task.findFirst({
        where: {
          brandId,
          taskType: "BRAND_GROWTH_VISUAL_REPORT",
        },
        orderBy: { createdAt: "desc" },
      });
      const normalizedTask = latestTaskRow
        ? await this.normalizeLatestVisualGrowthReportTask(brandId, this.mapVisualGrowthReportTask(latestTaskRow))
        : undefined;

      return {
        latest: reports[0],
        history: reports,
        latestTask: normalizedTask,
      };
    }

    this.ensureBrandExistsInMock(brandId);
    const reports = database.assets
      .filter((item) => item.brandId === brandId && item.category === "GENERATED_REPORT")
      .map((item) => this.mapVisualGrowthReportAsset(item))
      .filter((item): item is VisualGrowthReportRecord => Boolean(item))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    const latestTask = [...database.tasks]
      .filter((item) => item.brandId === brandId && item.taskType === "BRAND_GROWTH_VISUAL_REPORT")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const normalizedTask = latestTask
      ? await this.normalizeLatestVisualGrowthReportTask(brandId, this.mapVisualGrowthReportTask(latestTask))
      : undefined;

    return {
      latest: reports[0],
      history: reports,
      latestTask: normalizedTask,
    };
  }

  async generateVisualGrowthReport(brandId: string) {
    const sourceWorkspace = await this.getGrowthReportWorkspace(brandId);
    const sourceReport = sourceWorkspace.latest;
    if (!sourceReport) {
      throw new NotFoundException("璇峰厛鐢熸垚鍝佺墝澧為暱鎶ュ憡");
    }
    const workspace = await this.getVisualGrowthReportWorkspace(brandId);
    const runningTask = workspace.latestTask;
    if (runningTask && (runningTask.taskStatus === "QUEUED" || runningTask.taskStatus === "RUNNING")) {
      return workspace;
    }

    const task = await this.createVisualGrowthReportTask(brandId, sourceReport);
    setTimeout(() => {
      void this.runVisualGrowthReportTask(brandId, task.id);
    }, 0);
    return {
      ...workspace,
      latestTask: task,
    };
  }

  async getAnnualMarketingPlanWorkspace(brandId: string): Promise<AnnualMarketingPlanWorkspace> {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const assets = await this.prismaService.businessAsset.findMany({
        where: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
        orderBy: { createdAt: "desc" },
      });

      const plans = assets
        .map((item) => this.mapAnnualMarketingPlanAsset({
          id: item.id,
          brandId: item.brandId,
          category: "GENERATED_REPORT",
          title: item.title,
          description: item.description ?? "",
          sourceName: "绯荤粺鐢熸垚",
          fileUrl: item.fileUrl ?? undefined,
          metadataJson: this.asMeta(item.metadataJson),
        }))
        .filter((item): item is AnnualMarketingPlanRecord => Boolean(item));
      const latestTaskRow = await this.prismaService.task.findFirst({
        where: {
          brandId,
          taskType: {
            in: [...HALF_YEAR_MARKETING_PLAN_TASK_TYPES],
          },
        },
        orderBy: { createdAt: "desc" },
      });
      const normalizedTask = latestTaskRow
        ? await this.normalizeLatestAnnualMarketingPlanTask(brandId, this.mapVisualGrowthReportTask(latestTaskRow))
        : undefined;

      return {
        latest: plans[0],
        history: plans,
        latestTask: normalizedTask,
      };
    }

    this.ensureBrandExistsInMock(brandId);
    const plans = database.assets
      .filter((item) => item.brandId === brandId && item.category === "GENERATED_REPORT")
      .map((item) => this.mapAnnualMarketingPlanAsset(item))
      .filter((item): item is AnnualMarketingPlanRecord => Boolean(item))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    const latestTask = [...database.tasks]
      .filter((item) => item.brandId === brandId && HALF_YEAR_MARKETING_PLAN_TASK_TYPES.includes(item.taskType))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const normalizedTask = latestTask
      ? await this.normalizeLatestAnnualMarketingPlanTask(brandId, this.mapVisualGrowthReportTask(latestTask))
      : undefined;

    return {
      latest: plans[0],
      history: plans,
      latestTask: normalizedTask,
    };
  }

  async generateAnnualMarketingPlan(brandId: string, payload: GenerateAnnualMarketingPlanPayload = {}) {
    const sourceWorkspace = await this.getGrowthReportWorkspace(brandId);
    const sourceReport = sourceWorkspace.latest;
    if (!sourceReport) {
      throw new NotFoundException("璇峰厛鐢熸垚鍝佺墝澧為暱鎶ュ憡");
    }
    const workspace = await this.getAnnualMarketingPlanWorkspace(brandId);
    const runningTask = workspace.latestTask;
    if (runningTask && (runningTask.taskStatus === "QUEUED" || runningTask.taskStatus === "RUNNING")) {
      return workspace;
    }

    const task = await this.createAnnualMarketingPlanTask(
      brandId,
      sourceReport,
      this.normalizeMarketingPlanUserRequirement(payload.userRequirement),
    );
    setTimeout(() => {
      void this.runAnnualMarketingPlanTask(brandId, task.id);
    }, 0);
    return {
      ...workspace,
      latestTask: task,
    };
  }

  async getXiaohongshuMarketingPlanWorkspace(brandId: string): Promise<XiaohongshuMarketingPlanWorkspace> {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const assets = await this.prismaService.businessAsset.findMany({
        where: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
        orderBy: { createdAt: "desc" },
      });
      const reports = assets
        .map((item) => this.mapXiaohongshuMarketingPlanAsset({
          id: item.id,
          brandId: item.brandId,
          category: "GENERATED_REPORT",
          title: item.title,
          description: item.description ?? "",
          sourceName: "绯荤粺鐢熸垚",
          fileUrl: item.fileUrl ?? undefined,
          metadataJson: this.asMeta(item.metadataJson),
        }))
        .filter((item): item is XiaohongshuMarketingPlanRecord => Boolean(item));
      const validReports = reports.filter((item) => this.isUsableXiaohongshuMarketingPlanRecord(item));
      const latestTaskRow = await this.prismaService.task.findFirst({
        where: {
          brandId,
          taskType: "XHS_MARKETING_PLAN",
        },
        orderBy: { createdAt: "desc" },
      });
      const normalizedTask = latestTaskRow
        ? await this.normalizeLatestXiaohongshuMarketingPlanTask(brandId, this.mapVisualGrowthReportTask(latestTaskRow))
        : undefined;
      return {
        latest: validReports[0],
        history: validReports,
        latestTask: normalizedTask,
      };
    }

    this.ensureBrandExistsInMock(brandId);
    const reports = database.assets
      .filter((item) => item.brandId === brandId && item.category === "GENERATED_REPORT")
      .map((item) => this.mapXiaohongshuMarketingPlanAsset(item))
      .filter((item): item is XiaohongshuMarketingPlanRecord => Boolean(item))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    const validReports = reports.filter((item) => this.isUsableXiaohongshuMarketingPlanRecord(item));
    const latestTask = [...database.tasks]
      .filter((item) => item.brandId === brandId && item.taskType === "XHS_MARKETING_PLAN")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const normalizedTask = latestTask
      ? await this.normalizeLatestXiaohongshuMarketingPlanTask(brandId, this.mapVisualGrowthReportTask(latestTask))
      : undefined;
    return {
      latest: validReports[0],
      history: validReports,
      latestTask: normalizedTask,
    };
  }

  async generateXiaohongshuMarketingPlan(brandId: string, payload: GenerateXiaohongshuMarketingPlanPayload = {}) {
    const growthReportWorkspace = await this.getGrowthReportWorkspace(brandId);
    const opportunityInsightWorkspace = await this.getOpportunityInsightWorkspace(brandId);
    const sourceReport = growthReportWorkspace.latest;
    const opportunityReport = opportunityInsightWorkspace.finalOpportunityReport;
    if (!sourceReport) {
      throw new NotFoundException("璇峰厛鐢熸垚鍝佺墝澧為暱鎶ュ憡");
    }
    if (!opportunityReport?.htmlDocument?.trim()) {
      throw new NotFoundException("请先生成机会洞察总报告");
    }
    const archive = await this.brandsService.getArchive(brandId);
    if (!this.hasBrandBackgroundInput(archive)) {
      throw new NotFoundException("请先完善品牌背景资料");
    }
    if (!this.hasProductLibraryInput(archive)) {
      throw new NotFoundException("请先完善产品资料库");
    }
    const workspace = await this.getXiaohongshuMarketingPlanWorkspace(brandId);
    const runningTask = workspace.latestTask;
    if (runningTask && (runningTask.taskStatus === "QUEUED" || runningTask.taskStatus === "RUNNING")) {
      return workspace;
    }

    const task = await this.createXiaohongshuMarketingPlanTask(
      brandId,
      sourceReport,
      opportunityReport,
      this.normalizeMarketingPlanUserRequirement(payload.userRequirement),
    );
    setTimeout(() => {
      void this.runXiaohongshuMarketingPlanTask(brandId, task.id);
    }, 0);

    return {
      ...workspace,
      latestTask: task,
    };
  }

  async updateXiaohongshuMarketingPlan(brandId: string, reportId: string, payload: UpdateXiaohongshuMarketingPlanPayload) {
    const reportMarkdown = payload.reportMarkdown.trim();
    if (!reportMarkdown) {
      throw new ServiceUnavailableException("灏忕孩涔﹁惀閿€绛栧垝鏂规鍐呭涓嶈兘涓虹┖");
    }

    const normalized = this.buildManualXiaohongshuMarketingPlanResult(reportMarkdown, payload.title);
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const asset = await this.prismaService.businessAsset.findFirst({
        where: {
          id: reportId,
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
      });
      if (!asset) {
        throw new NotFoundException("灏忕孩涔﹁惀閿€绛栧垝鏂规涓嶅瓨鍦");
      }
      const currentMeta = this.asMeta(asset.metadataJson);
      const taskId = this.readMetaString(currentMeta, "taskId");
      const mediaId = this.readMetaString(currentMeta, "mediaId");
      const media = mediaId
        ? await this.prismaService.mediaAsset.findFirst({
            where: { id: mediaId, brandId },
            select: { id: true, storageKey: true, sourceUrl: true },
          })
        : null;
      const storageKey = media?.storageKey || this.buildReportAssetStorageKey(brandId, this.buildXiaohongshuMarketingPlanFileName(taskId || reportId));
      const sourceUrl = media?.sourceUrl || this.buildReportAssetUrl(brandId, this.extractFileNameFromStorageKey(storageKey));
      await this.persistReportHtml(storageKey, normalized.htmlContent);
      await this.prismaService.businessAsset.update({
        where: { id: asset.id },
        data: {
          title: normalized.title,
          description: normalized.summary,
          fileUrl: sourceUrl,
          metadataJson: {
            ...currentMeta,
            summary: normalized.summary,
            title: normalized.title,
            reportMarkdown: normalized.reportMarkdown,
            htmlContent: normalized.htmlContent,
          } as Prisma.InputJsonValue,
        },
      });
      if (media?.id) {
        await this.prismaService.mediaAsset.update({
          where: { id: media.id },
          data: {
            title: normalized.title,
            storageKey,
            sourceUrl,
            mimeType: "text/html",
          },
        });
      }
    } else {
      const asset = database.assets.find((item) => item.id === reportId && item.brandId === brandId && item.category === "GENERATED_REPORT");
      if (!asset) {
        throw new NotFoundException("灏忕孩涔﹁惀閿€绛栧垝鏂规涓嶅瓨鍦");
      }
      const currentMeta = this.asMeta(asset.metadataJson);
      const taskId = this.readMetaString(currentMeta, "taskId");
      const mediaId = this.readMetaString(currentMeta, "mediaId");
      const media = mediaId ? database.media.find((item) => item.id === mediaId && item.brandId === brandId) : undefined;
      const storageKey = media?.storageKey || this.buildReportAssetStorageKey(brandId, this.buildXiaohongshuMarketingPlanFileName(taskId || reportId));
      const sourceUrl = media?.sourceUrl || this.buildReportAssetUrl(brandId, this.extractFileNameFromStorageKey(storageKey));
      await this.persistReportHtml(storageKey, normalized.htmlContent);
      asset.title = normalized.title;
      asset.description = normalized.summary;
      asset.fileUrl = sourceUrl;
      asset.metadataJson = {
        ...currentMeta,
        summary: normalized.summary,
        title: normalized.title,
        reportMarkdown: normalized.reportMarkdown,
        htmlContent: normalized.htmlContent,
      };
      if (media) {
        media.title = normalized.title;
        media.storageKey = storageKey;
        media.sourceUrl = sourceUrl;
        media.mimeType = "text/html";
      }
    }

    return this.getXiaohongshuMarketingPlanWorkspace(brandId);
  }

  async deleteXiaohongshuMarketingPlan(brandId: string, reportId: string) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const asset = await this.prismaService.businessAsset.findFirst({
        where: {
          id: reportId,
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
      });
      if (!asset) {
        throw new NotFoundException("灏忕孩涔﹁惀閿€绛栧垝鏂规涓嶅瓨鍦");
      }
      const meta = this.asMeta(asset.metadataJson);
      const taskId = this.readMetaString(meta, "taskId");
      const mediaId = this.readMetaString(meta, "mediaId");
      const media = mediaId
        ? await this.prismaService.mediaAsset.findFirst({
            where: { id: mediaId, brandId },
            select: { id: true, storageKey: true },
          })
        : null;
      if (media?.storageKey) {
        await this.ossStorageService.deleteObject(media.storageKey);
      }
      await this.prismaService.businessAsset.delete({ where: { id: asset.id } });
      if (mediaId) {
        await this.prismaService.mediaAsset.deleteMany({ where: { id: mediaId, brandId } });
      }
      if (taskId) {
        await this.prismaService.task.deleteMany({ where: { id: taskId, brandId } });
      }
    } else {
      const index = database.assets.findIndex((item) => item.id === reportId && item.brandId === brandId && item.category === "GENERATED_REPORT");
      if (index < 0) {
        throw new NotFoundException("灏忕孩涔﹁惀閿€绛栧垝鏂规涓嶅瓨鍦");
      }
      const meta = this.asMeta(database.assets[index].metadataJson);
      const taskId = this.readMetaString(meta, "taskId");
      const mediaId = this.readMetaString(meta, "mediaId");
      const media = mediaId ? database.media.find((item) => item.id === mediaId && item.brandId === brandId) : undefined;
      if (media?.storageKey) {
        await this.ossStorageService.deleteObject(media.storageKey);
      }
      database.assets.splice(index, 1);
      if (mediaId) {
        database.media = database.media.filter((item) => item.id !== mediaId);
      }
      if (taskId) {
        database.tasks = database.tasks.filter((item) => item.id !== taskId);
      }
    }

    return this.getXiaohongshuMarketingPlanWorkspace(brandId);
  }

  async getDouyinMarketingPlanWorkspace(brandId: string): Promise<DouyinMarketingPlanWorkspace> {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const assets = await this.prismaService.businessAsset.findMany({
        where: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
        orderBy: { createdAt: "desc" },
      });
      const reports = assets
        .map((item) => this.mapDouyinMarketingPlanAsset({
          id: item.id,
          brandId: item.brandId,
          category: "GENERATED_REPORT",
          title: item.title,
          description: item.description ?? "",
          sourceName: "系统生成",
          fileUrl: item.fileUrl ?? undefined,
          metadataJson: this.asMeta(item.metadataJson),
        }))
        .filter((item): item is DouyinMarketingPlanRecord => Boolean(item));
      const validReports = reports.filter((item) => this.isUsableDouyinMarketingPlanRecord(item));
      const latestTaskRow = await this.prismaService.task.findFirst({
        where: {
          brandId,
          taskType: "DOUYIN_MARKETING_PLAN",
        },
        orderBy: { createdAt: "desc" },
      });
      const normalizedTask = latestTaskRow
        ? await this.normalizeLatestDouyinMarketingPlanTask(brandId, this.mapVisualGrowthReportTask(latestTaskRow))
        : undefined;
      return {
        latest: validReports[0],
        history: validReports,
        latestTask: normalizedTask,
      };
    }

    this.ensureBrandExistsInMock(brandId);
    const reports = database.assets
      .filter((item) => item.brandId === brandId && item.category === "GENERATED_REPORT")
      .map((item) => this.mapDouyinMarketingPlanAsset(item))
      .filter((item): item is DouyinMarketingPlanRecord => Boolean(item))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    const validReports = reports.filter((item) => this.isUsableDouyinMarketingPlanRecord(item));
    const latestTask = [...database.tasks]
      .filter((item) => item.brandId === brandId && item.taskType === "DOUYIN_MARKETING_PLAN")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const normalizedTask = latestTask
      ? await this.normalizeLatestDouyinMarketingPlanTask(brandId, this.mapVisualGrowthReportTask(latestTask))
      : undefined;
    return {
      latest: validReports[0],
      history: validReports,
      latestTask: normalizedTask,
    };
  }

  async generateDouyinMarketingPlan(brandId: string, payload: GenerateDouyinMarketingPlanPayload = {}) {
    const growthReportWorkspace = await this.getGrowthReportWorkspace(brandId);
    const opportunityInsightWorkspace = await this.getOpportunityInsightWorkspace(brandId);
    const sourceReport = growthReportWorkspace.latest;
    const opportunityReport = opportunityInsightWorkspace.finalOpportunityReport;
    if (!sourceReport) {
      throw new NotFoundException("请先生成品牌增长报告");
    }
    if (!opportunityReport?.htmlDocument?.trim()) {
      throw new NotFoundException("请先生成机会洞察总报告");
    }
    const archive = await this.brandsService.getArchive(brandId);
    if (!this.hasBrandBackgroundInput(archive)) {
      throw new NotFoundException("请先完善品牌背景资料");
    }
    if (!this.hasProductLibraryInput(archive)) {
      throw new NotFoundException("请先完善产品资料库");
    }
    const workspace = await this.getDouyinMarketingPlanWorkspace(brandId);
    const runningTask = workspace.latestTask;
    if (runningTask && (runningTask.taskStatus === "QUEUED" || runningTask.taskStatus === "RUNNING")) {
      return workspace;
    }

    const task = await this.createDouyinMarketingPlanTask(
      brandId,
      sourceReport,
      opportunityReport,
      this.normalizeMarketingPlanUserRequirement(payload.userRequirement),
    );
    setTimeout(() => {
      void this.runDouyinMarketingPlanTask(brandId, task.id);
    }, 0);

    return {
      ...workspace,
      latestTask: task,
    };
  }

  async updateDouyinMarketingPlan(brandId: string, reportId: string, payload: UpdateDouyinMarketingPlanPayload) {
    const reportMarkdown = payload.reportMarkdown.trim();
    if (!reportMarkdown) {
      throw new ServiceUnavailableException("抖音营销策划方案内容不能为空");
    }

    const normalized = this.buildManualDouyinMarketingPlanResult(reportMarkdown, payload.title);
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const asset = await this.prismaService.businessAsset.findFirst({
        where: {
          id: reportId,
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
      });
      if (!asset) {
        throw new NotFoundException("抖音营销策划方案不存在");
      }
      const currentMeta = this.asMeta(asset.metadataJson);
      const taskId = this.readMetaString(currentMeta, "taskId");
      const mediaId = this.readMetaString(currentMeta, "mediaId");
      const media = mediaId
        ? await this.prismaService.mediaAsset.findFirst({
            where: { id: mediaId, brandId },
            select: { id: true, storageKey: true, sourceUrl: true },
          })
        : null;
      const storageKey = media?.storageKey || this.buildReportAssetStorageKey(brandId, this.buildDouyinMarketingPlanFileName(taskId || reportId));
      const sourceUrl = media?.sourceUrl || this.buildReportAssetUrl(brandId, this.extractFileNameFromStorageKey(storageKey));
      await this.persistReportHtml(storageKey, normalized.htmlContent);
      await this.prismaService.businessAsset.update({
        where: { id: asset.id },
        data: {
          title: normalized.title,
          description: normalized.summary,
          fileUrl: sourceUrl,
          metadataJson: {
            ...currentMeta,
            kind: "DOUYIN_MARKETING_PLAN",
            summary: normalized.summary,
            title: normalized.title,
            reportMarkdown: normalized.reportMarkdown,
            htmlContent: normalized.htmlContent,
          } as Prisma.InputJsonValue,
        },
      });
      if (media?.id) {
        await this.prismaService.mediaAsset.update({
          where: { id: media.id },
          data: {
            title: normalized.title,
            storageKey,
            sourceUrl,
            mimeType: "text/html",
          },
        });
      }
    } else {
      const asset = database.assets.find((item) => item.id === reportId && item.brandId === brandId && item.category === "GENERATED_REPORT");
      if (!asset) {
        throw new NotFoundException("抖音营销策划方案不存在");
      }
      const currentMeta = this.asMeta(asset.metadataJson);
      const taskId = this.readMetaString(currentMeta, "taskId");
      const mediaId = this.readMetaString(currentMeta, "mediaId");
      const media = mediaId ? database.media.find((item) => item.id === mediaId && item.brandId === brandId) : undefined;
      const storageKey = media?.storageKey || this.buildReportAssetStorageKey(brandId, this.buildDouyinMarketingPlanFileName(taskId || reportId));
      const sourceUrl = media?.sourceUrl || this.buildReportAssetUrl(brandId, this.extractFileNameFromStorageKey(storageKey));
      await this.persistReportHtml(storageKey, normalized.htmlContent);
      asset.title = normalized.title;
      asset.description = normalized.summary;
      asset.fileUrl = sourceUrl;
      asset.metadataJson = {
        ...currentMeta,
        kind: "DOUYIN_MARKETING_PLAN",
        summary: normalized.summary,
        title: normalized.title,
        reportMarkdown: normalized.reportMarkdown,
        htmlContent: normalized.htmlContent,
      };
      if (media) {
        media.title = normalized.title;
        media.storageKey = storageKey;
        media.sourceUrl = sourceUrl;
        media.mimeType = "text/html";
      }
    }

    return this.getDouyinMarketingPlanWorkspace(brandId);
  }

  async deleteDouyinMarketingPlan(brandId: string, reportId: string) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const asset = await this.prismaService.businessAsset.findFirst({
        where: {
          id: reportId,
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
      });
      if (!asset) {
        throw new NotFoundException("抖音营销策划方案不存在");
      }
      const meta = this.asMeta(asset.metadataJson);
      const taskId = this.readMetaString(meta, "taskId");
      const mediaId = this.readMetaString(meta, "mediaId");
      const media = mediaId
        ? await this.prismaService.mediaAsset.findFirst({
            where: { id: mediaId, brandId },
            select: { id: true, storageKey: true },
          })
        : null;
      if (media?.storageKey) {
        await this.ossStorageService.deleteObject(media.storageKey);
      }
      await this.prismaService.businessAsset.delete({ where: { id: asset.id } });
      if (mediaId) {
        await this.prismaService.mediaAsset.deleteMany({ where: { id: mediaId, brandId } });
      }
      if (taskId) {
        await this.prismaService.task.deleteMany({ where: { id: taskId, brandId } });
      }
    } else {
      const index = database.assets.findIndex((item) => item.id === reportId && item.brandId === brandId && item.category === "GENERATED_REPORT");
      if (index < 0) {
        throw new NotFoundException("抖音营销策划方案不存在");
      }
      const meta = this.asMeta(database.assets[index].metadataJson);
      const taskId = this.readMetaString(meta, "taskId");
      const mediaId = this.readMetaString(meta, "mediaId");
      const media = mediaId ? database.media.find((item) => item.id === mediaId && item.brandId === brandId) : undefined;
      if (media?.storageKey) {
        await this.ossStorageService.deleteObject(media.storageKey);
      }
      database.assets.splice(index, 1);
      if (mediaId) {
        database.media = database.media.filter((item) => item.id !== mediaId);
      }
      if (taskId) {
        database.tasks = database.tasks.filter((item) => item.id !== taskId);
      }
    }

    return this.getDouyinMarketingPlanWorkspace(brandId);
  }

  async getDouyinHotTopicCandidatesWorkspace(
    brandId: string,
    selectedDate?: string,
  ): Promise<DouyinHotTopicCandidatesWorkspace> {
    const dailyHotspots = await this.collectorsService.getDailyHotspotWorkspace(brandId, selectedDate);
    const effectiveSelectedDate = dailyHotspots.selectedDate || selectedDate || "";
    const topicLibrary = await this.getDouyinTopicLibrary(brandId);
    const matchesSelectedDate = (record: DouyinHotTopicCandidatesRecord) => record.selectedDate === effectiveSelectedDate;
    const matchesTaskDate = (task: { inputJson?: unknown }) =>
      !effectiveSelectedDate || this.readMetaString(this.asMeta(task.inputJson), "selectedDate") === effectiveSelectedDate;

    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const assets = await this.prismaService.businessAsset.findMany({
        where: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
        orderBy: { createdAt: "desc" },
      });
      const reports = assets
        .map((item) => this.mapDouyinHotTopicCandidatesAsset({
          id: item.id,
          brandId: item.brandId,
          category: "GENERATED_REPORT",
          title: item.title,
          description: item.description ?? "",
          sourceName: "系统生成",
          fileUrl: item.fileUrl ?? undefined,
          metadataJson: this.asMeta(item.metadataJson),
        }))
        .filter((item): item is DouyinHotTopicCandidatesRecord => Boolean(item))
        .filter((item) => item.items.length > 0)
        .filter(matchesSelectedDate);
      const latestTaskRow = await this.prismaService.task.findFirst({
        where: {
          brandId,
          taskType: "DOUYIN_HOT_TOPIC_CANDIDATES",
        },
        orderBy: { createdAt: "desc" },
      });
      const normalizedTask = latestTaskRow && matchesTaskDate(latestTaskRow)
        ? await this.normalizeLatestDouyinHotTopicCandidatesTask(brandId, this.mapVisualGrowthReportTask(latestTaskRow))
        : undefined;
      return {
        selectedDate: effectiveSelectedDate,
        availableDates: dailyHotspots.availableDates,
        latest: reports[0],
        history: reports,
        latestTask: normalizedTask,
        topicLibrary: topicLibrary?.items || [],
      };
    }

    this.ensureBrandExistsInMock(brandId);
    const reports = database.assets
      .filter((item) => item.brandId === brandId && item.category === "GENERATED_REPORT")
      .map((item) => this.mapDouyinHotTopicCandidatesAsset(item))
      .filter((item): item is DouyinHotTopicCandidatesRecord => Boolean(item))
      .filter((item) => item.items.length > 0)
      .filter(matchesSelectedDate)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    const latestTask = [...database.tasks]
      .filter((item) => item.brandId === brandId && item.taskType === "DOUYIN_HOT_TOPIC_CANDIDATES")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .find((item) => matchesTaskDate(item));
    const normalizedTask = latestTask
      ? await this.normalizeLatestDouyinHotTopicCandidatesTask(brandId, this.mapVisualGrowthReportTask(latestTask))
      : undefined;
    return {
      selectedDate: effectiveSelectedDate,
      availableDates: dailyHotspots.availableDates,
      latest: reports[0],
      history: reports,
      latestTask: normalizedTask,
      topicLibrary: topicLibrary?.items || [],
    };
  }

  async generateDouyinHotTopicCandidates(brandId: string, selectedDate?: string) {
    const dailyHotspots = await this.collectorsService.getDailyHotspotWorkspace(brandId, selectedDate);
    const effectiveSelectedDate = dailyHotspots.selectedDate || selectedDate || "";
    if (!effectiveSelectedDate) {
      throw new NotFoundException("请先同步每日热点");
    }

    const workspace = await this.getDouyinHotTopicCandidatesWorkspace(brandId, effectiveSelectedDate);
    const runningTask = workspace.latestTask;
    if (runningTask && (runningTask.taskStatus === "QUEUED" || runningTask.taskStatus === "RUNNING")) {
      return workspace;
    }

    const task = await this.createDouyinHotTopicCandidatesTask(brandId, effectiveSelectedDate);
    setTimeout(() => {
      void this.runDouyinHotTopicCandidatesTask(brandId, task.id);
    }, 0);

    return {
      ...workspace,
      selectedDate: effectiveSelectedDate,
      latestTask: task,
    };
  }

  async updateDouyinTopicLibrary(brandId: string, payload: UpdateDouyinTopicLibraryPayload): Promise<DouyinHotTopicCandidatesWorkspace> {
    const items = this.normalizeDouyinTopicLibraryItems(payload.items);
    const summary = items.length ? `已收录 ${items.length} 条品牌选题。` : "当前还没有收录品牌选题。";
    const updatedAt = new Date().toISOString();

    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const current = await this.getDouyinTopicLibrary(brandId);
      if (current) {
        await this.prismaService.businessAsset.update({
          where: { id: current.id },
          data: {
            title: "选题库",
            description: summary,
            metadataJson: {
              kind: "DOUYIN_TOPIC_LIBRARY",
              updatedAt,
              summary,
              items,
            } satisfies DouyinTopicLibraryAssetMeta as Prisma.InputJsonValue,
          },
        });
      } else {
        await this.prismaService.businessAsset.create({
          data: {
            brandId,
            category: AssetCategory.GENERATED_CONTENT,
            title: "选题库",
            description: summary,
            metadataJson: {
              kind: "DOUYIN_TOPIC_LIBRARY",
              updatedAt,
              summary,
              items,
            } satisfies DouyinTopicLibraryAssetMeta as Prisma.InputJsonValue,
          },
        });
      }
      return this.getDouyinHotTopicCandidatesWorkspace(brandId);
    }

    const existingIndex = database.assets.findIndex(
      (item) => item.brandId === brandId && item.category === "GENERATED_CONTENT" && this.asMeta(item.metadataJson).kind === "DOUYIN_TOPIC_LIBRARY",
    );
    const metadataJson: DouyinTopicLibraryAssetMeta = {
      kind: "DOUYIN_TOPIC_LIBRARY",
      updatedAt,
      summary,
      items,
    };
    if (existingIndex >= 0) {
      database.assets[existingIndex] = {
        ...database.assets[existingIndex],
        title: "选题库",
        description: summary,
        metadataJson,
      };
    } else {
      database.assets.unshift({
        id: createId("ast"),
        brandId,
        category: "GENERATED_CONTENT",
        title: "选题库",
        description: summary,
        sourceName: "系统生成",
        metadataJson,
      });
    }
    return this.getDouyinHotTopicCandidatesWorkspace(brandId);
  }

  async getDouyinOriginalCopyWorkspace(brandId: string): Promise<DouyinOriginalCopyWorkspace> {
    const [marketingPlanWorkspace, calendarWorkspace, topicLibrary] = await Promise.all([
      this.getDouyinMarketingPlanWorkspace(brandId),
      this.getXiaohongshuMarketingCalendarWorkspace(brandId),
      this.getDouyinTopicLibrary(brandId),
    ]);
    const calendarOptions = this.buildDouyinOriginalCopyCalendarOptions(calendarWorkspace.history);
    const topicOptions = topicLibrary?.items || [];
    const hasMarketingPlan = Boolean(marketingPlanWorkspace.latest);
    const marketingPlanTitle = marketingPlanWorkspace.latest?.title;

    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const assets = await this.prismaService.businessAsset.findMany({
        where: {
          brandId,
          category: AssetCategory.GENERATED_CONTENT,
        },
        orderBy: { createdAt: "desc" },
      });
      const reports = assets
        .map((item) => this.mapDouyinOriginalCopyAsset({
          id: item.id,
          brandId: item.brandId,
          category: "GENERATED_CONTENT",
          title: item.title,
          description: item.description ?? "",
          sourceName: "系统生成",
          fileUrl: item.fileUrl ?? undefined,
          metadataJson: this.asMeta(item.metadataJson),
        }))
        .filter((item): item is DouyinOriginalCopyRecord => Boolean(item));
      const latestTaskRow = await this.prismaService.task.findFirst({
        where: {
          brandId,
          taskType: "DOUYIN_ORIGINAL_COPY",
        },
        orderBy: { createdAt: "desc" },
      });
      const normalizedTask = latestTaskRow
        ? await this.normalizeLatestDouyinOriginalCopyTask(brandId, this.mapVisualGrowthReportTask(latestTaskRow))
        : undefined;
      return {
        latest: reports[0],
        history: reports,
        latestTask: normalizedTask,
        calendarOptions,
        topicOptions,
        hasMarketingPlan,
        marketingPlanTitle,
      };
    }

    this.ensureBrandExistsInMock(brandId);
    const reports = database.assets
      .filter((item) => item.brandId === brandId && item.category === "GENERATED_CONTENT")
      .map((item) => this.mapDouyinOriginalCopyAsset(item))
      .filter((item): item is DouyinOriginalCopyRecord => Boolean(item))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    const latestTask = [...database.tasks]
      .filter((item) => item.brandId === brandId && item.taskType === "DOUYIN_ORIGINAL_COPY")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const normalizedTask = latestTask
      ? await this.normalizeLatestDouyinOriginalCopyTask(brandId, this.mapVisualGrowthReportTask(latestTask))
      : undefined;
    return {
      latest: reports[0],
      history: reports,
      latestTask: normalizedTask,
      calendarOptions,
      topicOptions,
      hasMarketingPlan,
      marketingPlanTitle,
    };
  }

  async generateDouyinOriginalCopy(brandId: string, payload: GenerateDouyinOriginalCopyPayload) {
    const copyType = String(payload.copyType ?? "").trim() as DouyinOriginalCopyType;
    const copyConfig = DOUYIN_ORIGINAL_COPY_TYPE_CONFIG[copyType];
    if (!copyConfig) {
      throw new NotFoundException("请选择有效的文案类型");
    }

    const workspace = await this.getDouyinOriginalCopyWorkspace(brandId);
    const runningTask = workspace.latestTask;
    if (runningTask && (runningTask.taskStatus === "QUEUED" || runningTask.taskStatus === "RUNNING")) {
      return workspace;
    }

    const topic = payload.topicId
      ? workspace.topicOptions.find((item) => item.id === payload.topicId)
      : undefined;
    if (payload.topicId && !topic) {
      throw new NotFoundException("请选择有效的选题");
    }

    const injectMarketingPlan = Boolean(payload.injectMarketingPlan);
    if (injectMarketingPlan && !workspace.hasMarketingPlan) {
      throw new NotFoundException("当前品牌还没有抖音营销策划方案，暂时不能植入");
    }

    let selectedCalendarItem: XiaohongshuMarketingCalendarItem | undefined;
    if (payload.calendarItemId) {
      const calendarWorkspace = await this.getXiaohongshuMarketingCalendarWorkspace(brandId);
      selectedCalendarItem = calendarWorkspace.history
        .flatMap((item) => item.items)
        .find((item) => item.id === payload.calendarItemId);
      if (!selectedCalendarItem) {
        throw new NotFoundException("请选择有效的营销日历");
      }
    }

    const task = await this.createDouyinOriginalCopyTask(brandId, {
      copyType,
      topic,
      calendarItem: selectedCalendarItem,
      injectMarketingPlan,
      marketingPlanTitle: workspace.marketingPlanTitle,
      userRequirement: payload.userRequirement?.trim() || undefined,
    });
    setTimeout(() => {
      void this.runDouyinOriginalCopyTask(brandId, task.id);
    }, 0);

    return {
      ...workspace,
      latestTask: task,
    };
  }

  async updateDouyinOriginalCopy(brandId: string, reportId: string, payload: UpdateDouyinOriginalCopyPayload) {
    const content = payload.content.trim();
    if (!content) {
      throw new ServiceUnavailableException("原创文案内容不能为空");
    }

    const workspace = await this.getDouyinOriginalCopyWorkspace(brandId);
    const current = workspace.history.find((item) => item.id === reportId);
    if (!current) {
      throw new NotFoundException("原创文案不存在");
    }

    const normalized = this.buildManualDouyinOriginalCopyResult(content, payload.title, current.title);
    const userRequirement = payload.userRequirement?.trim() || undefined;
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const asset = await this.prismaService.businessAsset.findFirst({
        where: {
          id: reportId,
          brandId,
          category: AssetCategory.GENERATED_CONTENT,
        },
      });
      if (!asset) {
        throw new NotFoundException("原创文案不存在");
      }
      const currentMeta = this.asMeta(asset.metadataJson);
      if (currentMeta.kind !== "DOUYIN_ORIGINAL_COPY") {
        throw new NotFoundException("原创文案不存在");
      }
      await this.prismaService.businessAsset.update({
        where: { id: asset.id },
        data: {
          title: normalized.title,
          description: normalized.summary,
          metadataJson: {
            ...currentMeta,
            summary: normalized.summary,
            content: normalized.content,
            title: normalized.title,
            userRequirement,
          } as Prisma.InputJsonValue,
        },
      });
    } else {
      const asset = database.assets.find((item) => item.id === reportId && item.brandId === brandId && item.category === "GENERATED_CONTENT");
      if (!asset) {
        throw new NotFoundException("原创文案不存在");
      }
      const currentMeta = this.asMeta(asset.metadataJson);
      if (currentMeta.kind !== "DOUYIN_ORIGINAL_COPY") {
        throw new NotFoundException("原创文案不存在");
      }
      asset.title = normalized.title;
      asset.description = normalized.summary;
      asset.metadataJson = {
        ...currentMeta,
        summary: normalized.summary,
        content: normalized.content,
        title: normalized.title,
        userRequirement,
      };
    }

    return this.getDouyinOriginalCopyWorkspace(brandId);
  }

  async deleteDouyinOriginalCopy(brandId: string, reportId: string) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const asset = await this.prismaService.businessAsset.findFirst({
        where: {
          id: reportId,
          brandId,
          category: AssetCategory.GENERATED_CONTENT,
        },
      });
      if (!asset) {
        throw new NotFoundException("原创文案不存在");
      }
      const meta = this.asMeta(asset.metadataJson);
      if (meta.kind !== "DOUYIN_ORIGINAL_COPY") {
        throw new NotFoundException("原创文案不存在");
      }
      const taskId = this.readMetaString(meta, "taskId");
      await this.prismaService.businessAsset.delete({ where: { id: asset.id } });
      if (taskId) {
        await this.prismaService.task.deleteMany({ where: { id: taskId, brandId } });
      }
    } else {
      const index = database.assets.findIndex((item) => item.id === reportId && item.brandId === brandId && item.category === "GENERATED_CONTENT");
      if (index < 0) {
        throw new NotFoundException("原创文案不存在");
      }
      const meta = this.asMeta(database.assets[index].metadataJson);
      if (meta.kind !== "DOUYIN_ORIGINAL_COPY") {
        throw new NotFoundException("原创文案不存在");
      }
      const taskId = this.readMetaString(meta, "taskId");
      database.assets.splice(index, 1);
      if (taskId) {
        database.tasks = database.tasks.filter((item) => item.id !== taskId);
      }
    }

    return this.getDouyinOriginalCopyWorkspace(brandId);
  }

  async getDouyinRemixCopyWorkspace(brandId: string): Promise<DouyinRemixCopyWorkspace> {
    const [marketingPlanWorkspace, unifiedMaterialLibraryItems, archive] = await Promise.all([
      this.getDouyinMarketingPlanWorkspace(brandId),
      this.collectorsService.listUnifiedMaterialLibraryItems(brandId),
      this.brandsService.getArchive(brandId),
    ]);
    const materialOptions = this.buildDouyinRemixMaterialOptions(unifiedMaterialLibraryItems);
    const productOptions = this.buildDouyinRemixProductOptions(archive.products);
    const hasMarketingPlan = Boolean(marketingPlanWorkspace.latest);
    const marketingPlanTitle = marketingPlanWorkspace.latest?.title;

    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const assets = await this.prismaService.businessAsset.findMany({
        where: {
          brandId,
          category: AssetCategory.GENERATED_CONTENT,
        },
        orderBy: { createdAt: "desc" },
      });
      const reports = assets
        .map((item) => this.mapDouyinRemixCopyAsset({
          id: item.id,
          brandId: item.brandId,
          category: "GENERATED_CONTENT",
          title: item.title,
          description: item.description ?? "",
          sourceName: "系统生成",
          fileUrl: item.fileUrl ?? undefined,
          metadataJson: this.asMeta(item.metadataJson),
        }))
        .filter((item): item is DouyinRemixCopyRecord => Boolean(item));
      const latestTaskRow = await this.prismaService.task.findFirst({
        where: {
          brandId,
          taskType: "DOUYIN_REMIX_COPY",
        },
        orderBy: { createdAt: "desc" },
      });
      const normalizedTask = latestTaskRow
        ? await this.normalizeLatestDouyinRemixCopyTask(brandId, this.mapVisualGrowthReportTask(latestTaskRow))
        : undefined;
      return {
        latest: reports[0],
        history: reports,
        latestTask: normalizedTask,
        materialOptions,
        productOptions,
        hasMarketingPlan,
        marketingPlanTitle,
      };
    }

    this.ensureBrandExistsInMock(brandId);
    const reports = database.assets
      .filter((item) => item.brandId === brandId && item.category === "GENERATED_CONTENT")
      .map((item) => this.mapDouyinRemixCopyAsset(item))
      .filter((item): item is DouyinRemixCopyRecord => Boolean(item))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    const latestTask = [...database.tasks]
      .filter((item) => item.brandId === brandId && item.taskType === "DOUYIN_REMIX_COPY")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const normalizedTask = latestTask
      ? await this.normalizeLatestDouyinRemixCopyTask(brandId, this.mapVisualGrowthReportTask(latestTask))
      : undefined;
    return {
      latest: reports[0],
      history: reports,
      latestTask: normalizedTask,
      materialOptions,
      productOptions,
      hasMarketingPlan,
      marketingPlanTitle,
    };
  }

  async generateDouyinRemixCopy(brandId: string, payload: GenerateDouyinRemixCopyPayload) {
    const materialId = String(payload.materialId ?? "").trim();
    if (!materialId) {
      throw new NotFoundException("请选择素材");
    }

    const workspace = await this.getDouyinRemixCopyWorkspace(brandId);
    const runningTask = workspace.latestTask;
    if (runningTask && (runningTask.taskStatus === "QUEUED" || runningTask.taskStatus === "RUNNING")) {
      return workspace;
    }

    const material = workspace.materialOptions.find((item) => item.id === materialId);
    if (!material) {
      throw new NotFoundException("请选择有效的素材");
    }
    if (!material.videoUrl) {
      throw new NotFoundException("当前素材缺少可用视频链接，暂时无法生成二创文案");
    }

    const injectMarketingPlan = Boolean(payload.injectMarketingPlan);
    if (injectMarketingPlan && !workspace.hasMarketingPlan) {
      throw new NotFoundException("当前品牌还没有抖音营销策划方案，暂时不能植入");
    }

    const productId = String(payload.productId ?? "").trim() || undefined;
    const product = productId ? workspace.productOptions.find((item) => item.id === productId) : undefined;
    if (productId && !product) {
      throw new NotFoundException("请选择有效的产品");
    }

    const task = await this.createDouyinRemixCopyTask(brandId, {
      material,
      injectBrandProfile: Boolean(payload.injectBrandProfile),
      product,
      injectMarketingPlan,
      marketingPlanTitle: workspace.marketingPlanTitle,
      userRequirement: payload.userRequirement?.trim() || undefined,
    });
    setTimeout(() => {
      void this.runDouyinRemixCopyTask(brandId, task.id);
    }, 0);

    return {
      ...workspace,
      latestTask: task,
    };
  }

  async updateDouyinRemixCopy(brandId: string, reportId: string, payload: UpdateDouyinRemixCopyPayload) {
    const content = payload.content.trim();
    if (!content) {
      throw new ServiceUnavailableException("二创文案内容不能为空");
    }

    const workspace = await this.getDouyinRemixCopyWorkspace(brandId);
    const current = workspace.history.find((item) => item.id === reportId);
    if (!current) {
      throw new NotFoundException("二创文案不存在");
    }

    const normalized = this.buildManualDouyinRemixCopyResult(content, payload.title, current.title);
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const asset = await this.prismaService.businessAsset.findFirst({
        where: {
          id: reportId,
          brandId,
          category: AssetCategory.GENERATED_CONTENT,
        },
      });
      if (!asset) {
        throw new NotFoundException("二创文案不存在");
      }
      const currentMeta = this.asMeta(asset.metadataJson);
      if (currentMeta.kind !== "DOUYIN_REMIX_COPY") {
        throw new NotFoundException("二创文案不存在");
      }
      await this.prismaService.businessAsset.update({
        where: { id: asset.id },
        data: {
          title: normalized.title,
          description: normalized.summary,
          metadataJson: {
            ...currentMeta,
            summary: normalized.summary,
            content: normalized.content,
            title: normalized.title,
          } as Prisma.InputJsonValue,
        },
      });
    } else {
      const asset = database.assets.find((item) => item.id === reportId && item.brandId === brandId && item.category === "GENERATED_CONTENT");
      if (!asset) {
        throw new NotFoundException("二创文案不存在");
      }
      const currentMeta = this.asMeta(asset.metadataJson);
      if (currentMeta.kind !== "DOUYIN_REMIX_COPY") {
        throw new NotFoundException("二创文案不存在");
      }
      asset.title = normalized.title;
      asset.description = normalized.summary;
      asset.metadataJson = {
        ...currentMeta,
        summary: normalized.summary,
        content: normalized.content,
        title: normalized.title,
      };
    }

    return this.getDouyinRemixCopyWorkspace(brandId);
  }

  async deleteDouyinRemixCopy(brandId: string, reportId: string) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const asset = await this.prismaService.businessAsset.findFirst({
        where: {
          id: reportId,
          brandId,
          category: AssetCategory.GENERATED_CONTENT,
        },
      });
      if (!asset) {
        throw new NotFoundException("二创文案不存在");
      }
      const meta = this.asMeta(asset.metadataJson);
      if (meta.kind !== "DOUYIN_REMIX_COPY") {
        throw new NotFoundException("二创文案不存在");
      }
      const taskId = this.readMetaString(meta, "taskId");
      await this.prismaService.businessAsset.delete({ where: { id: asset.id } });
      if (taskId) {
        await this.prismaService.task.deleteMany({ where: { id: taskId, brandId } });
      }
    } else {
      const index = database.assets.findIndex((item) => item.id === reportId && item.brandId === brandId && item.category === "GENERATED_CONTENT");
      if (index < 0) {
        throw new NotFoundException("二创文案不存在");
      }
      const meta = this.asMeta(database.assets[index].metadataJson);
      if (meta.kind !== "DOUYIN_REMIX_COPY") {
        throw new NotFoundException("二创文案不存在");
      }
      const taskId = this.readMetaString(meta, "taskId");
      database.assets.splice(index, 1);
      if (taskId) {
        database.tasks = database.tasks.filter((item) => item.id !== taskId);
      }
    }

    return this.getDouyinRemixCopyWorkspace(brandId);
  }

  async getXiaohongshuMarketingCalendarWorkspace(brandId: string): Promise<XiaohongshuMarketingCalendarWorkspace> {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const assets = await this.prismaService.businessAsset.findMany({
        where: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
        orderBy: { createdAt: "desc" },
      });
      const reports = assets
        .map((item) => this.mapXiaohongshuMarketingCalendarAsset({
          id: item.id,
          brandId: item.brandId,
          category: "GENERATED_REPORT",
          title: item.title,
          description: item.description ?? "",
          sourceName: "绯荤粺鐢熸垚",
          fileUrl: item.fileUrl ?? undefined,
          metadataJson: this.asMeta(item.metadataJson),
        }))
        .filter((item): item is XiaohongshuMarketingCalendarRecord => Boolean(item))
        .filter((item) => item.items.length);
      const latestTaskRow = await this.prismaService.task.findFirst({
        where: {
          brandId,
          taskType: "XHS_MARKETING_CALENDAR",
        },
        orderBy: { createdAt: "desc" },
      });
      const normalizedTask = latestTaskRow
        ? await this.normalizeLatestXiaohongshuMarketingCalendarTask(brandId, this.mapVisualGrowthReportTask(latestTaskRow))
        : undefined;
      return {
        latest: reports[0],
        history: reports,
        latestTask: normalizedTask,
      };
    }

    this.ensureBrandExistsInMock(brandId);
    const reports = database.assets
      .filter((item) => item.brandId === brandId && item.category === "GENERATED_REPORT")
      .map((item) => this.mapXiaohongshuMarketingCalendarAsset(item))
      .filter((item): item is XiaohongshuMarketingCalendarRecord => Boolean(item))
      .filter((item) => item.items.length)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    const latestTask = [...database.tasks]
      .filter((item) => item.brandId === brandId && item.taskType === "XHS_MARKETING_CALENDAR")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const normalizedTask = latestTask
      ? await this.normalizeLatestXiaohongshuMarketingCalendarTask(brandId, this.mapVisualGrowthReportTask(latestTask))
      : undefined;
    return {
      latest: reports[0],
      history: reports,
      latestTask: normalizedTask,
    };
  }

  async generateXiaohongshuMarketingCalendar(brandId: string, payload: GenerateXiaohongshuMarketingCalendarPayload = {}) {
    if (Array.isArray(payload.items) && payload.items.length > 0) {
      return this.createManualXiaohongshuMarketingCalendar(brandId, {
        title: payload.title,
        items: payload.items,
      });
    }
    const generatedAt = new Date().toISOString();
    const archive = await this.brandsService.getArchive(brandId);
    const growthReportWorkspace = await this.getGrowthReportWorkspace(brandId);
    const opportunityInsightWorkspace = await this.getOpportunityInsightWorkspace(brandId);
    const { sourceReport, opportunityReport } = this.resolveMarketingCalendarSourceReports(archive, {
      generatedAt,
      sourceReport: growthReportWorkspace.latest,
      opportunityReport: opportunityInsightWorkspace.finalOpportunityReport,
    });
    const workspace = await this.getXiaohongshuMarketingCalendarWorkspace(brandId);
    const runningTask = workspace.latestTask;
    if (runningTask && (runningTask.taskStatus === "QUEUED" || runningTask.taskStatus === "RUNNING")) {
      return workspace;
    }

    const task = await this.createXiaohongshuMarketingCalendarTask(
      brandId,
      sourceReport,
      opportunityReport,
      this.normalizeMarketingPlanUserRequirement(payload.userRequirement),
    );
    setTimeout(() => {
      void this.runXiaohongshuMarketingCalendarTask(brandId, task.id);
    }, 0);

    return {
      ...workspace,
      latestTask: task,
    };
  }

  async updateXiaohongshuMarketingCalendar(
    brandId: string,
    reportId: string,
    payload: UpdateXiaohongshuMarketingCalendarPayload,
  ) {
    const normalized = this.buildManualXiaohongshuMarketingCalendarResult(payload.items, payload.title);
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const asset = await this.prismaService.businessAsset.findFirst({
        where: {
          id: reportId,
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
      });
      if (!asset) {
        throw new NotFoundException("钀ラ攢鏃ュ巻涓嶅瓨鍦");
      }
      const currentMeta = this.asMeta(asset.metadataJson);
      await this.prismaService.businessAsset.update({
        where: { id: asset.id },
        data: {
          title: normalized.title,
          description: normalized.summary,
          metadataJson: {
            ...currentMeta,
            summary: normalized.summary,
            title: normalized.title,
            items: normalized.items,
          } as Prisma.InputJsonValue,
        },
      });
    } else {
      const asset = database.assets.find((item) => item.id === reportId && item.brandId === brandId && item.category === "GENERATED_REPORT");
      if (!asset) {
        throw new NotFoundException("钀ラ攢鏃ュ巻涓嶅瓨鍦");
      }
      asset.title = normalized.title;
      asset.description = normalized.summary;
      asset.metadataJson = {
        ...(asset.metadataJson || {}),
        summary: normalized.summary,
        title: normalized.title,
        items: normalized.items,
      };
    }

    return this.getXiaohongshuMarketingCalendarWorkspace(brandId);
  }

  async createManualXiaohongshuMarketingCalendar(
    brandId: string,
    payload: UpdateXiaohongshuMarketingCalendarPayload,
  ) {
    const normalized = this.buildManualXiaohongshuMarketingCalendarResult(payload.items, payload.title);
    const generatedAt = new Date().toISOString();
    const executionCapabilityInventory = this.buildMarketingCalendarExecutionCapabilityInventory(generatedAt);

    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      await this.prismaService.businessAsset.create({
        data: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
          title: normalized.title,
          description: normalized.summary,
          metadataJson: {
            kind: "XHS_MARKETING_CALENDAR",
            generatedAt,
            summary: normalized.summary,
            items: normalized.items,
            executionCapabilityInventory,
            sourceName: "OpenClaw直提",
          } as Prisma.InputJsonValue,
        },
      });
    } else {
      database.assets.unshift({
        id: createId("ast"),
        brandId,
        category: "GENERATED_REPORT",
        title: normalized.title,
        description: normalized.summary,
        sourceName: "OpenClaw直提",
        fileUrl: undefined,
        metadataJson: {
          kind: "XHS_MARKETING_CALENDAR",
          generatedAt,
          summary: normalized.summary,
          items: normalized.items,
          executionCapabilityInventory,
          sourceName: "OpenClaw直提",
        },
      });
    }

    return this.getXiaohongshuMarketingCalendarWorkspace(brandId);
  }

  async upsertXiaohongshuMarketingCalendarItem(
    brandId: string,
    reportId: string,
    date: string,
    payload: UpsertXiaohongshuMarketingCalendarItemPayload,
  ) {
    const targetDate = String(date || "").trim();
    if (!targetDate) {
      throw new BadRequestException("请先填写日期。");
    }

    const workspace = await this.getXiaohongshuMarketingCalendarWorkspace(brandId);
    const currentRecord =
      workspace.latest?.id === reportId ? workspace.latest : workspace.history.find((item) => item.id === reportId);
    if (!currentRecord) {
      throw new NotFoundException("营销日历不存在");
    }

    const currentItems = Array.isArray(currentRecord.items) ? [...currentRecord.items] : [];
    const existingIndex = currentItems.findIndex(
      (item) => item.date === targetDate || (payload.item.id && item.id === payload.item.id),
    );
    const nextItem = {
      ...(existingIndex >= 0 ? currentItems[existingIndex] : {}),
      ...payload.item,
      date: targetDate,
    };

    if (existingIndex >= 0) {
      currentItems[existingIndex] = nextItem;
    } else {
      currentItems.push(nextItem);
      currentItems.sort((left, right) => left.date.localeCompare(right.date));
    }

    return this.updateXiaohongshuMarketingCalendar(brandId, reportId, {
      title: payload.title ?? currentRecord.title,
      items: currentItems,
    });
  }

  async upsertXiaohongshuMarketingCalendarItemForOpenClaw(
    brandId: string,
    params: OpenClawUpsertXiaohongshuMarketingCalendarItemParams,
  ) {
    const targetDate = String(params.date || params.payload.item?.date || "").trim();
    if (!targetDate) {
      throw new BadRequestException("请提供 selectedDate 或 payload.item.date。");
    }

    const normalizedPayload: UpsertXiaohongshuMarketingCalendarItemPayload = {
      title: params.payload.title,
      item: {
        ...params.payload.item,
        date: targetDate,
      },
    };

    const explicitReportId = String(params.reportId || "").trim();
    if (explicitReportId) {
      return this.upsertXiaohongshuMarketingCalendarItem(brandId, explicitReportId, targetDate, normalizedPayload);
    }

    const workspace = await this.getXiaohongshuMarketingCalendarWorkspace(brandId);
    if (workspace.latest?.id) {
      return this.upsertXiaohongshuMarketingCalendarItem(brandId, workspace.latest.id, targetDate, normalizedPayload);
    }

    return this.createManualXiaohongshuMarketingCalendar(brandId, {
      title: normalizedPayload.title,
      items: [normalizedPayload.item],
    });
  }

  async updateGrowthReport(brandId: string, reportId: string, payload: UpdateGrowthReportPayload) {
    const reportMarkdown = payload.reportMarkdown.trim();
    if (!reportMarkdown) {
      throw new ServiceUnavailableException("鎶ュ憡鍐呭涓嶈兘涓虹┖");
    }

    const normalized = this.buildManualReportResult(reportMarkdown, payload.title);

    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const asset = await this.prismaService.businessAsset.findFirst({
        where: {
          id: reportId,
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
      });
      if (!asset) {
        throw new NotFoundException("鍝佺墝澧為暱鎶ュ憡涓嶅瓨鍦");
      }

      const currentMeta = this.asMeta(asset.metadataJson);
      const taskId = this.readMetaString(currentMeta, "taskId");
      const mediaId = this.readMetaString(currentMeta, "mediaId");
      const media = mediaId
        ? await this.prismaService.mediaAsset.findFirst({
            where: { id: mediaId, brandId },
            select: { id: true, storageKey: true, sourceUrl: true },
          })
        : null;
      const storageKey = media?.storageKey || this.buildReportAssetStorageKey(brandId, this.buildGrowthReportFileName(taskId || reportId));
      const sourceUrl = media?.sourceUrl || this.buildReportAssetUrl(brandId, this.extractFileNameFromStorageKey(storageKey));
      await this.persistReportHtml(storageKey, normalized.htmlContent);
      await this.prismaService.businessAsset.update({
        where: { id: asset.id },
        data: {
          title: normalized.title,
          description: normalized.summary,
          fileUrl: sourceUrl,
          metadataJson: {
            ...currentMeta,
            summary: normalized.summary,
            title: normalized.title,
            reportMarkdown: normalized.reportMarkdown,
            htmlContent: normalized.htmlContent,
          } as Prisma.InputJsonValue,
        },
      });
      if (media?.id) {
        await this.prismaService.mediaAsset.update({
          where: { id: media.id },
          data: {
            title: normalized.title,
            storageKey,
            sourceUrl,
            mimeType: "text/html",
          },
        });
      }
    } else {
      const asset = database.assets.find((item) => item.id === reportId && item.brandId === brandId && item.category === "GENERATED_REPORT");
      if (!asset) {
        throw new NotFoundException("鍝佺墝澧為暱鎶ュ憡涓嶅瓨鍦");
      }
      const currentMeta = this.asMeta(asset.metadataJson);
      const taskId = this.readMetaString(currentMeta, "taskId");
      const mediaId = this.readMetaString(currentMeta, "mediaId");
      const media = mediaId ? database.media.find((item) => item.id === mediaId && item.brandId === brandId) : undefined;
      const storageKey = media?.storageKey || this.buildReportAssetStorageKey(brandId, this.buildGrowthReportFileName(taskId || reportId));
      const sourceUrl = media?.sourceUrl || this.buildReportAssetUrl(brandId, this.extractFileNameFromStorageKey(storageKey));
      await this.persistReportHtml(storageKey, normalized.htmlContent);
      asset.title = normalized.title;
      asset.description = normalized.summary;
      asset.fileUrl = sourceUrl;
      asset.metadataJson = {
        ...currentMeta,
        summary: normalized.summary,
        title: normalized.title,
        reportMarkdown: normalized.reportMarkdown,
        htmlContent: normalized.htmlContent,
      };
      if (media) {
        media.title = normalized.title;
        media.storageKey = storageKey;
        media.sourceUrl = sourceUrl;
        media.mimeType = "text/html";
      }
    }

    return this.getGrowthReportWorkspace(brandId);
  }

  async updateVisualGrowthReport(brandId: string, reportId: string, payload: UpdateVisualGrowthReportPayload) {
    const htmlBody = payload.htmlBody.trim();
    if (!htmlBody) {
      throw new ServiceUnavailableException("鍙鍖栨姤鍛婂唴瀹逛笉鑳戒负绌");
    }

    const normalized = this.buildManualVisualReportResult(htmlBody, payload.title);

    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const asset = await this.prismaService.businessAsset.findFirst({
        where: {
          id: reportId,
          brandId,
          category: AssetCategory.GENERATED_REPORT,
        },
      });
      if (!asset) {
        throw new NotFoundException("鍝佺墝澧為暱鍙鍖栨姤鍛婁笉瀛樺湪");
      }

      const currentMeta = this.asMeta(asset.metadataJson);
      const taskId = this.readMetaString(currentMeta, "taskId");
      const mediaId = this.readMetaString(currentMeta, "mediaId");
      const media = mediaId
        ? await this.prismaService.mediaAsset.findFirst({
            where: { id: mediaId, brandId },
            select: { id: true, storageKey: true, sourceUrl: true },
          })
        : null;
      const storageKey = media?.storageKey || this.buildReportAssetStorageKey(brandId, this.buildVisualGrowthReportFileName(taskId || reportId));
      const sourceUrl = media?.sourceUrl || this.buildReportAssetUrl(brandId, this.extractFileNameFromStorageKey(storageKey));
      await this.persistReportHtml(storageKey, normalized.htmlDocument);
      await this.prismaService.businessAsset.update({
        where: { id: asset.id },
        data: {
          title: normalized.title,
          description: normalized.summary,
          fileUrl: sourceUrl,
          metadataJson: {
            ...currentMeta,
            summary: normalized.summary,
            title: normalized.title,
            htmlBody: normalized.htmlBody,
            htmlDocument: normalized.htmlDocument,
          } as Prisma.InputJsonValue,
        },
      });
      if (media?.id) {
        await this.prismaService.mediaAsset.update({
          where: { id: media.id },
          data: {
            title: normalized.title,
            storageKey,
            sourceUrl,
            mimeType: "text/html",
          },
        });
      }
    } else {
      const asset = database.assets.find((item) => item.id === reportId && item.brandId === brandId && item.category === "GENERATED_REPORT");
      if (!asset) {
        throw new NotFoundException("鍝佺墝澧為暱鍙鍖栨姤鍛婁笉瀛樺湪");
      }
      const currentMeta = this.asMeta(asset.metadataJson);
      const taskId = this.readMetaString(currentMeta, "taskId");
      const mediaId = this.readMetaString(currentMeta, "mediaId");
      const media = mediaId ? database.media.find((item) => item.id === mediaId && item.brandId === brandId) : undefined;
      const storageKey = media?.storageKey || this.buildReportAssetStorageKey(brandId, this.buildVisualGrowthReportFileName(taskId || reportId));
      const sourceUrl = media?.sourceUrl || this.buildReportAssetUrl(brandId, this.extractFileNameFromStorageKey(storageKey));
      await this.persistReportHtml(storageKey, normalized.htmlDocument);
      asset.title = normalized.title;
      asset.description = normalized.summary;
      asset.fileUrl = sourceUrl;
      asset.metadataJson = {
        ...currentMeta,
        summary: normalized.summary,
        title: normalized.title,
        htmlBody: normalized.htmlBody,
        htmlDocument: normalized.htmlDocument,
      };
      if (media) {
        media.title = normalized.title;
        media.storageKey = storageKey;
        media.sourceUrl = sourceUrl;
        media.mimeType = "text/html";
      }
    }

    return this.getVisualGrowthReportWorkspace(brandId);
  }

  private async getLatestVisualGrowthReportTask(brandId: string) {
    const workspace = await this.getVisualGrowthReportWorkspace(brandId);
    return workspace.latestTask;
  }

  private async getLatestGrowthReportTask(brandId: string) {
    const workspace = await this.getGrowthReportWorkspace(brandId);
    return workspace.latestTask;
  }

  private async getLatestAnnualMarketingPlanTask(brandId: string) {
    const workspace = await this.getAnnualMarketingPlanWorkspace(brandId);
    return workspace.latestTask;
  }

  private async getLatestXiaohongshuMarketingPlanTask(brandId: string) {
    const workspace = await this.getXiaohongshuMarketingPlanWorkspace(brandId);
    return workspace.latestTask;
  }

  private async getLatestXiaohongshuMarketingCalendarTask(brandId: string) {
    const workspace = await this.getXiaohongshuMarketingCalendarWorkspace(brandId);
    return workspace.latestTask;
  }

  private async normalizeLatestVisualGrowthReportTask(
    brandId: string,
    task: VisualGrowthReportTaskRecord,
  ): Promise<VisualGrowthReportTaskRecord> {
    if (task.taskStatus !== "QUEUED" && task.taskStatus !== "RUNNING") {
      return task;
    }

    const referenceTime = task.updatedAt || task.startedAt || task.createdAt;
    const referenceMs = Date.parse(referenceTime);
    if (!Number.isFinite(referenceMs)) {
      return task;
    }
    if (Date.now() - referenceMs <= VISUAL_REPORT_TASK_TIMEOUT_MS) {
      return task;
    }

    const finishedAt = new Date().toISOString();
    const errorMessage = "鍙鍖栨姤鍛婄敓鎴愯秴鏃讹紝浠诲姟宸茶嚜鍔ㄧ粨鏉燂紝璇烽噸鏂扮偣鍑荤敓鎴愬彲瑙嗗寲鎶ュ憡銆";
    await this.updateVisualGrowthReportTaskStatus(brandId, task.id, {
      taskStatus: "FAILED",
      startedAt: task.startedAt,
      finishedAt,
      errorMessage,
    });

    return {
      ...task,
      taskStatus: "FAILED",
      finishedAt,
      updatedAt: finishedAt,
      errorMessage,
    };
  }

  private async normalizeLatestGrowthReportTask(
    brandId: string,
    task: GrowthReportTaskRecord,
  ): Promise<GrowthReportTaskRecord> {
    if (task.taskStatus !== "QUEUED" && task.taskStatus !== "RUNNING") {
      return task;
    }

    const referenceTime = task.updatedAt || task.startedAt || task.createdAt;
    const referenceMs = Date.parse(referenceTime);
    if (!Number.isFinite(referenceMs)) {
      return task;
    }
    if (Date.now() - referenceMs <= GROWTH_REPORT_TASK_TIMEOUT_MS) {
      return task;
    }

    const finishedAt = new Date().toISOString();
    const errorMessage = "品牌增长报告生成超时，任务已自动结束，请重新点击生成报告。";
    await this.updateGrowthReportTaskStatus(brandId, task.id, {
      taskStatus: "FAILED",
      startedAt: task.startedAt,
      finishedAt,
      errorMessage,
    });

    return {
      ...task,
      taskStatus: "FAILED",
      finishedAt,
      updatedAt: finishedAt,
      errorMessage,
    };
  }

  private async normalizeLatestOpportunityInsightTask(
    brandId: string,
    task: OpportunityInsightTaskRecord,
  ): Promise<OpportunityInsightTaskRecord> {
    if (task.taskStatus !== "QUEUED" && task.taskStatus !== "RUNNING") {
      return task;
    }

    const referenceTime = task.updatedAt || task.startedAt || task.createdAt;
    const referenceMs = Date.parse(referenceTime);
    if (!Number.isFinite(referenceMs)) {
      return task;
    }
    if (Date.now() - referenceMs <= OPPORTUNITY_INSIGHT_TASK_TIMEOUT_MS) {
      return task;
    }

    const finishedAt = new Date().toISOString();
    const errorMessage = task.taskType === "OPPORTUNITY_INSIGHT_STEP_THREE"
      ? "机会洞察第 3 步生成超时，任务已自动结束，请重新点击生成总报告。"
      : task.taskType === "OPPORTUNITY_INSIGHT_STEP_TWO"
        ? "机会洞察第 2 步生成超时，任务已自动结束，请重新点击开始第 2 步。"
        : "机会洞察第 1 步生成超时，任务已自动结束，请重新点击立刻机会洞察。";
    await this.updateOpportunityInsightTaskStatus(brandId, task.id, {
      taskStatus: "FAILED",
      startedAt: task.startedAt,
      finishedAt,
      errorMessage,
    });

    return {
      ...task,
      taskStatus: "FAILED",
      finishedAt,
      updatedAt: finishedAt,
      errorMessage,
    };
  }

  private async normalizeLatestAnnualMarketingPlanTask(
    brandId: string,
    task: AnnualMarketingPlanTaskRecord,
  ): Promise<AnnualMarketingPlanTaskRecord> {
    if (task.taskStatus !== "QUEUED" && task.taskStatus !== "RUNNING") {
      return task;
    }

    const referenceTime = task.updatedAt || task.startedAt || task.createdAt;
    const referenceMs = Date.parse(referenceTime);
    if (!Number.isFinite(referenceMs)) {
      return task;
    }
    if (Date.now() - referenceMs <= ANNUAL_MARKETING_PLAN_TASK_TIMEOUT_MS) {
      return task;
    }

    const finishedAt = new Date().toISOString();
    const errorMessage = "半年营销规划生成超时，任务已自动结束，请重新点击生成规划。";
    await this.updateAnnualMarketingPlanTaskStatus(brandId, task.id, {
      taskStatus: "FAILED",
      startedAt: task.startedAt,
      finishedAt,
      errorMessage,
    });

    return {
      ...task,
      taskStatus: "FAILED",
      finishedAt,
      updatedAt: finishedAt,
      errorMessage,
    };
  }

  private async normalizeLatestXiaohongshuMarketingPlanTask(
    brandId: string,
    task: XiaohongshuMarketingPlanTaskRecord,
  ): Promise<XiaohongshuMarketingPlanTaskRecord> {
    if (task.taskStatus !== "QUEUED" && task.taskStatus !== "RUNNING") {
      return task;
    }

    const referenceTime = task.updatedAt || task.startedAt || task.createdAt;
    const referenceMs = Date.parse(referenceTime);
    if (!Number.isFinite(referenceMs)) {
      return task;
    }
    if (Date.now() - referenceMs <= XIAOHONGSHU_MARKETING_PLAN_TASK_TIMEOUT_MS) {
      return task;
    }

    const finishedAt = new Date().toISOString();
    const errorMessage = "灏忕孩涔﹁惀閿€绛栧垝鏂规鐢熸垚瓒呮椂锛屼换鍔″凡鑷姩缁撴潫锛岃閲嶆柊鐐瑰嚮涓€閿敓鎴愩€";
    await this.updateXiaohongshuMarketingPlanTaskStatus(brandId, task.id, {
      taskStatus: "FAILED",
      startedAt: task.startedAt,
      finishedAt,
      errorMessage,
    });

    return {
      ...task,
      taskStatus: "FAILED",
      finishedAt,
      updatedAt: finishedAt,
      errorMessage,
    };
  }

  private async normalizeLatestDouyinMarketingPlanTask(
    brandId: string,
    task: DouyinMarketingPlanTaskRecord,
  ): Promise<DouyinMarketingPlanTaskRecord> {
    if (task.taskStatus !== "QUEUED" && task.taskStatus !== "RUNNING") {
      return task;
    }

    const referenceTime = task.updatedAt || task.startedAt || task.createdAt;
    const referenceMs = Date.parse(referenceTime);
    if (!Number.isFinite(referenceMs)) {
      return task;
    }
    if (Date.now() - referenceMs <= DOUYIN_MARKETING_PLAN_TASK_TIMEOUT_MS) {
      return task;
    }

    const finishedAt = new Date().toISOString();
    const errorMessage = "抖音营销策划方案生成超时，任务已自动结束，请重新点击一键生成。";
    await this.updateDouyinMarketingPlanTaskStatus(brandId, task.id, {
      taskStatus: "FAILED",
      startedAt: task.startedAt,
      finishedAt,
      errorMessage,
    });

    return {
      ...task,
      taskStatus: "FAILED",
      finishedAt,
      updatedAt: finishedAt,
      errorMessage,
    };
  }

  private async normalizeLatestDouyinHotTopicCandidatesTask(
    brandId: string,
    task: DouyinHotTopicCandidatesTaskRecord,
  ): Promise<DouyinHotTopicCandidatesTaskRecord> {
    if (task.taskStatus !== "QUEUED" && task.taskStatus !== "RUNNING") {
      return task;
    }

    const referenceTime = task.updatedAt || task.startedAt || task.createdAt;
    const referenceMs = Date.parse(referenceTime);
    if (!Number.isFinite(referenceMs)) {
      return task;
    }
    if (Date.now() - referenceMs <= DOUYIN_HOT_TOPIC_CANDIDATES_TASK_TIMEOUT_MS) {
      return task;
    }

    const finishedAt = new Date().toISOString();
    const errorMessage = "抖音热点找选题生成超时，任务已自动结束，请重新点击生成。";
    await this.updateDouyinHotTopicCandidatesTaskStatus(brandId, task.id, {
      taskStatus: "FAILED",
      startedAt: task.startedAt,
      finishedAt,
      errorMessage,
    });

    return {
      ...task,
      taskStatus: "FAILED",
      finishedAt,
      updatedAt: finishedAt,
      errorMessage,
    };
  }

  private async normalizeLatestDouyinOriginalCopyTask(
    brandId: string,
    task: DouyinOriginalCopyTaskRecord,
  ): Promise<DouyinOriginalCopyTaskRecord> {
    if (task.taskStatus !== "QUEUED" && task.taskStatus !== "RUNNING") {
      return task;
    }

    const referenceTime = task.updatedAt || task.startedAt || task.createdAt;
    const referenceMs = Date.parse(referenceTime);
    if (!Number.isFinite(referenceMs)) {
      return task;
    }
    if (Date.now() - referenceMs <= DOUYIN_ORIGINAL_COPY_TASK_TIMEOUT_MS) {
      return task;
    }

    const finishedAt = new Date().toISOString();
    const errorMessage = "抖音原创文案生成超时，任务已自动结束，请重新点击生成。";
    await this.updateDouyinOriginalCopyTaskStatus(brandId, task.id, {
      taskStatus: "FAILED",
      startedAt: task.startedAt,
      finishedAt,
      errorMessage,
    });

    return {
      ...task,
      taskStatus: "FAILED",
      finishedAt,
      updatedAt: finishedAt,
      errorMessage,
    };
  }

  private async normalizeLatestDouyinRemixCopyTask(
    brandId: string,
    task: DouyinRemixCopyTaskRecord,
  ): Promise<DouyinRemixCopyTaskRecord> {
    if (task.taskStatus !== "QUEUED" && task.taskStatus !== "RUNNING") {
      return task;
    }

    const referenceTime = task.updatedAt || task.startedAt || task.createdAt;
    const referenceMs = Date.parse(referenceTime);
    if (!Number.isFinite(referenceMs)) {
      return task;
    }
    if (Date.now() - referenceMs <= DOUYIN_REMIX_COPY_TASK_TIMEOUT_MS) {
      return task;
    }

    const finishedAt = new Date().toISOString();
    const errorMessage = "抖音二创文案生成超时，任务已自动结束，请重新点击生成。";
    await this.updateDouyinRemixCopyTaskStatus(brandId, task.id, {
      taskStatus: "FAILED",
      startedAt: task.startedAt,
      finishedAt,
      errorMessage,
    });

    return {
      ...task,
      taskStatus: "FAILED",
      finishedAt,
      updatedAt: finishedAt,
      errorMessage,
    };
  }

  private async normalizeLatestXiaohongshuMarketingCalendarTask(
    brandId: string,
    task: XiaohongshuMarketingCalendarTaskRecord,
  ): Promise<XiaohongshuMarketingCalendarTaskRecord> {
    if (task.taskStatus !== "QUEUED" && task.taskStatus !== "RUNNING") {
      return task;
    }

    const referenceTime = task.updatedAt || task.startedAt || task.createdAt;
    const referenceMs = Date.parse(referenceTime);
    if (!Number.isFinite(referenceMs)) {
      return task;
    }

    if (Date.now() - referenceMs < XIAOHONGSHU_MARKETING_CALENDAR_TASK_TIMEOUT_MS) {
      return task;
    }

    const finishedAt = new Date().toISOString();
    const errorMessage = "钀ラ攢鏃ュ巻鐢熸垚浠诲姟宸茶秴鏃讹紝璇烽噸鏂板彂璧风敓鎴愩€";
    await this.updateXiaohongshuMarketingCalendarTaskStatus(brandId, task.id, {
      taskStatus: "FAILED",
      finishedAt,
      errorMessage,
    });

    return {
      ...task,
      taskStatus: "FAILED",
      finishedAt,
      updatedAt: finishedAt,
      errorMessage,
    };
  }

  private async createVisualGrowthReportTask(brandId: string, sourceReport: GrowthReportRecord) {
    const now = new Date().toISOString();
    const settings = await this.loadVisualReportGenerationSettings(brandId);
    const modelName =
      (await this.loadDomesticVisualProviderConfigs(settings))[0]?.models[0]
      || settings.preferredModelName
      || "deepseek-v4-flash";

    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerUserId: true, brandName: true },
      });
      if (!brand) {
        throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
      }

      const task = await this.prismaService.task.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskType: "BRAND_GROWTH_VISUAL_REPORT",
          taskTitle: `鐢熸垚鍝佺墝澧為暱鍙鍖栨姤鍛婏細${brand.brandName}`,
          taskStatus: TaskStatus.QUEUED,
          modelName,
          pointsCost: 220,
          inputJson: {
            sourceReportId: sourceReport.id,
            sourceReportTitle: sourceReport.title,
          } as Prisma.InputJsonValue,
        },
      });

      return this.mapVisualGrowthReportTask(task);
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
    }

    const task = {
      id: createId("tsk"),
      userId: brand.ownerUserId,
      brandId,
      taskType: "BRAND_GROWTH_VISUAL_REPORT",
      taskTitle: `鐢熸垚鍝佺墝澧為暱鍙鍖栨姤鍛婏細${brand.brandName}`,
      taskStatus: "QUEUED" as const,
      modelName,
      pointsCost: 220,
      inputJson: {
        sourceReportId: sourceReport.id,
        sourceReportTitle: sourceReport.title,
      },
      createdAt: now,
      updatedAt: now,
    };
    database.tasks.unshift(task);
    return this.mapVisualGrowthReportTask(task);
  }

  private async createGrowthReportTask(brandId: string) {
    const now = new Date().toISOString();
    const archive = await this.brandsService.getArchive(brandId);
    const collection = await this.collectorsService.getXiaohongshuWorkspace(brandId);
    const opportunityInsightWorkspace = await this.getOpportunityInsightWorkspace(brandId);
    const settings = await this.loadGrowthReportGenerationSettings(brandId);
    const providers = await this.loadGrowthReportProviderConfigs(settings);
    const modelName =
      providers[0]?.models[0]
      || settings.preferredModelName
      || "deepseek-v4-pro";

    const inputMeta = {
      productCount: archive.products.length,
      brandBackgroundReady: Boolean(
        archive.brand.brandName?.trim()
        || archive.brand.brandDescription?.trim()
        || archive.brand.enterpriseIntro?.trim(),
      ),
      opportunityInsightReportCount: [
        opportunityInsightWorkspace.brandAccountAnalysis,
        opportunityInsightWorkspace.competitorAccountAnalysis,
        opportunityInsightWorkspace.commentInsightAnalysis,
        opportunityInsightWorkspace.finalOpportunityReport,
      ].filter(Boolean).length,
      brandAccountHtmlReady: Boolean(opportunityInsightWorkspace.brandAccountAnalysis?.htmlDocument?.trim()),
      competitorAccountHtmlReady: Boolean(opportunityInsightWorkspace.competitorAccountAnalysis?.htmlDocument?.trim()),
      commentInsightHtmlReady: Boolean(opportunityInsightWorkspace.commentInsightAnalysis?.htmlDocument?.trim()),
      finalOpportunityHtmlReady: Boolean(opportunityInsightWorkspace.finalOpportunityReport?.htmlDocument?.trim()),
      platformAccountCount: collection.brandAccounts.length,
      competitorAccountCount: collection.competitorAccounts.length,
      brandNoteCount: collection.brandNotes.length,
      benchmarkNoteCount: collection.benchmarkNotes.length,
    };

    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerUserId: true, brandName: true },
      });
      if (!brand) {
        throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
      }

      const task = await this.prismaService.task.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskType: "BRAND_GROWTH_REPORT",
          taskTitle: `鐢熸垚鍝佺墝澧為暱鎶ュ憡锛${brand.brandName}`,
          taskStatus: TaskStatus.QUEUED,
          modelName,
          pointsCost: 320,
          inputJson: inputMeta as Prisma.InputJsonValue,
        },
      });

      return this.mapVisualGrowthReportTask(task);
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
    }

    const task = {
      id: createId("tsk"),
      userId: brand.ownerUserId,
      brandId,
      taskType: "BRAND_GROWTH_REPORT",
      taskTitle: `鐢熸垚鍝佺墝澧為暱鎶ュ憡锛${brand.brandName}`,
      taskStatus: "QUEUED" as const,
      modelName,
      pointsCost: 320,
      inputJson: inputMeta,
      createdAt: now,
      updatedAt: now,
    };
    database.tasks.unshift(task);
    return this.mapVisualGrowthReportTask(task);
  }

  private async createOpportunityInsightStepOneTask(brandId: string, payload: GenerateOpportunityInsightPayload = {}) {
    const now = new Date().toISOString();
    const archive = await this.brandsService.getArchive(brandId);
    const xiaohongshuWorkspace = await this.collectorsService.getXiaohongshuWorkspace(brandId);
    const douyinWorkspace = await this.collectorsService.getDouyinWorkspace(brandId);
    const brandSettings = await this.loadOpportunityInsightAccountGenerationSettings(
      brandId,
      "opportunity-insight-brand-account-analysis",
      "prompt_opportunity_insight_brand_account",
    );
    const competitorSettings = await this.loadOpportunityInsightAccountGenerationSettings(
      brandId,
      "opportunity-insight-competitor-account-analysis",
      "prompt_opportunity_insight_competitor_account",
    );
    const modelName =
      this.parseDelimitedModels(brandSettings.modelName)[0]
      || this.parseDelimitedModels(competitorSettings.modelName)[0]
      || brandSettings.preferredModelName
      || competitorSettings.preferredModelName
      || "kimi-k2.6";
    const supplementInput = this.normalizeOpportunityInsightSupplementInput(payload.supplementInput);
    const inputMeta = {
      step: 1,
      brandAccountCount: xiaohongshuWorkspace.brandAccounts.length + douyinWorkspace.brandAccounts.length,
      competitorAccountCount: xiaohongshuWorkspace.competitorAccounts.length + douyinWorkspace.competitorAccounts.length,
      brandNoteCount: xiaohongshuWorkspace.brandNotes.length,
      benchmarkNoteCount: xiaohongshuWorkspace.benchmarkNotes.length,
      douyinBrandWorkCount: douyinWorkspace.brandWorks.length,
      douyinCompetitorWorkCount: douyinWorkspace.competitorWorks.length,
      productCount: archive.products.length,
      supplementInput,
    };

    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerUserId: true, brandName: true },
      });
      if (!brand) {
        throw new NotFoundException("品牌不存在");
      }

      const task = await this.prismaService.task.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskType: "OPPORTUNITY_INSIGHT_STEP_ONE",
          taskTitle: `生成机会洞察第1步：${brand.brandName}`,
          taskStatus: TaskStatus.QUEUED,
          modelName,
          pointsCost: 520,
          inputJson: inputMeta as Prisma.InputJsonValue,
        },
      });

      return this.mapOpportunityInsightTask(task);
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("品牌不存在");
    }

    const task = {
      id: createId("tsk"),
      userId: brand.ownerUserId,
      brandId,
      taskType: "OPPORTUNITY_INSIGHT_STEP_ONE",
      taskTitle: `生成机会洞察第1步：${brand.brandName}`,
      taskStatus: "QUEUED" as const,
      modelName,
      pointsCost: 520,
      inputJson: inputMeta,
      createdAt: now,
      updatedAt: now,
    };
    database.tasks.unshift(task);
    return this.mapOpportunityInsightTask(task);
  }

  private async createOpportunityInsightStepTwoTask(brandId: string, payload: GenerateOpportunityInsightPayload = {}) {
    const now = new Date().toISOString();
    const archive = await this.brandsService.getArchive(brandId);
    const douyinWorkspace = await this.collectorsService.getDouyinWorkspace(brandId);
    const settings = await this.loadOpportunityInsightNarrativeGenerationSettings(
      brandId,
      "opportunity-insight-comment-analysis",
      "prompt_opportunity_insight_comment",
    );
    const modelName = this.parseDelimitedModels(settings.modelName)[0] || settings.preferredModelName || "gpt-5.4";
    const supplementInput = this.normalizeOpportunityInsightSupplementInput(payload.supplementInput);
    const inputMeta = {
      step: 2,
      stepKey: "commentInsightAnalysis",
      commentCount: douyinWorkspace.commentData.length,
      productCount: archive.products.length,
      supplementInput,
    };

    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerUserId: true, brandName: true },
      });
      if (!brand) {
        throw new NotFoundException("品牌不存在");
      }

      const task = await this.prismaService.task.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskType: "OPPORTUNITY_INSIGHT_STEP_TWO",
          taskTitle: `生成机会洞察第2步：${brand.brandName}`,
          taskStatus: TaskStatus.QUEUED,
          modelName,
          pointsCost: 360,
          inputJson: inputMeta as Prisma.InputJsonValue,
        },
      });

      return this.mapOpportunityInsightTask(task);
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("品牌不存在");
    }

    const task = {
      id: createId("tsk"),
      userId: brand.ownerUserId,
      brandId,
      taskType: "OPPORTUNITY_INSIGHT_STEP_TWO",
      taskTitle: `生成机会洞察第2步：${brand.brandName}`,
      taskStatus: "QUEUED" as const,
      modelName,
      pointsCost: 360,
      inputJson: inputMeta,
      createdAt: now,
      updatedAt: now,
    };
    database.tasks.unshift(task);
    return this.mapOpportunityInsightTask(task);
  }

  private async createOpportunityInsightStepThreeTask(brandId: string, payload: GenerateOpportunityInsightPayload = {}) {
    const now = new Date().toISOString();
    const archive = await this.brandsService.getArchive(brandId);
    const workspace = await this.getOpportunityInsightWorkspace(brandId);
    const settings = await this.loadOpportunityInsightNarrativeGenerationSettings(
      brandId,
      "opportunity-insight-final-report",
      "prompt_opportunity_insight_final_report",
    );
    const modelName = this.parseDelimitedModels(settings.modelName)[0] || settings.preferredModelName || "gpt-5.4";
    const supplementInput = this.normalizeOpportunityInsightSupplementInput(payload.supplementInput);
    const inputMeta = {
      step: 3,
      stepKey: "finalOpportunityReport",
      productCount: archive.products.length,
      sourceReportIds: [
        workspace.brandAccountAnalysis?.id,
        workspace.competitorAccountAnalysis?.id,
        workspace.commentInsightAnalysis?.id,
      ].filter((item): item is string => Boolean(item)),
      supplementInput,
    };

    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerUserId: true, brandName: true },
      });
      if (!brand) {
        throw new NotFoundException("品牌不存在");
      }

      const task = await this.prismaService.task.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskType: "OPPORTUNITY_INSIGHT_STEP_THREE",
          taskTitle: `生成机会洞察第3步：${brand.brandName}`,
          taskStatus: TaskStatus.QUEUED,
          modelName,
          pointsCost: 420,
          inputJson: inputMeta as Prisma.InputJsonValue,
        },
      });

      return this.mapOpportunityInsightTask(task);
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("品牌不存在");
    }

    const task = {
      id: createId("tsk"),
      userId: brand.ownerUserId,
      brandId,
      taskType: "OPPORTUNITY_INSIGHT_STEP_THREE",
      taskTitle: `生成机会洞察第3步：${brand.brandName}`,
      taskStatus: "QUEUED" as const,
      modelName,
      pointsCost: 420,
      inputJson: inputMeta,
      createdAt: now,
      updatedAt: now,
    };
    database.tasks.unshift(task);
    return this.mapOpportunityInsightTask(task);
  }

  private async createAnnualMarketingPlanTask(brandId: string, sourceReport: GrowthReportRecord, userRequirement?: string) {
    const now = new Date().toISOString();
    const settings = await this.loadAnnualMarketingPlanGenerationSettings(brandId);
    const modelName =
      (await this.loadAnnualMarketingProviderConfigs(settings))[0]?.models[0]
      || settings.preferredModelName
      || "gpt-5.4";

    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerUserId: true, brandName: true },
      });
      if (!brand) {
        throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
      }

      const task = await this.prismaService.task.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskType: CURRENT_HALF_YEAR_MARKETING_PLAN_TASK_TYPE,
          taskTitle: `生成半年营销规划：${brand.brandName}`,
          taskStatus: TaskStatus.QUEUED,
          modelName,
          pointsCost: 260,
          inputJson: {
            sourceReportId: sourceReport.id,
            sourceReportTitle: sourceReport.title,
            userRequirement: userRequirement || undefined,
          } as Prisma.InputJsonValue,
        },
      });

      return this.mapVisualGrowthReportTask(task);
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
    }

    const task = {
      id: createId("tsk"),
      userId: brand.ownerUserId,
      brandId,
      taskType: CURRENT_HALF_YEAR_MARKETING_PLAN_TASK_TYPE,
      taskTitle: `生成半年营销规划：${brand.brandName}`,
      taskStatus: "QUEUED" as const,
      modelName,
      pointsCost: 260,
      inputJson: {
        sourceReportId: sourceReport.id,
        sourceReportTitle: sourceReport.title,
        userRequirement: userRequirement || undefined,
      },
      createdAt: now,
      updatedAt: now,
    };
    database.tasks.unshift(task);
    return this.mapVisualGrowthReportTask(task);
  }

  private async createXiaohongshuMarketingPlanTask(
    brandId: string,
    sourceReport: GrowthReportRecord,
    opportunityReport: OpportunityInsightReportRecord,
    userRequirement?: string,
  ) {
    const now = new Date().toISOString();
    const settings = await this.loadXiaohongshuMarketingPlanGenerationSettings(brandId);
    const modelName =
      (await this.loadXiaohongshuMarketingProviderConfigs(settings))[0]?.models[0]
      || settings.preferredModelName
      || "gpt-5.4";

    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerUserId: true, brandName: true },
      });
      if (!brand) {
        throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
      }

      const task = await this.prismaService.task.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskType: "XHS_MARKETING_PLAN",
          taskTitle: `鐢熸垚灏忕孩涔﹁惀閿€绛栧垝鏂规锛${brand.brandName}`,
          taskStatus: TaskStatus.QUEUED,
          modelName,
          pointsCost: 260,
          inputJson: {
            sourceReportId: sourceReport.id,
            sourceReportTitle: sourceReport.title,
            sourceOpportunityReportId: opportunityReport.id,
            sourceOpportunityReportTitle: opportunityReport.title,
            userRequirement: userRequirement || undefined,
          } as Prisma.InputJsonValue,
        },
      });

      return this.mapVisualGrowthReportTask(task);
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
    }

    const task = {
      id: createId("tsk"),
      userId: brand.ownerUserId,
      brandId,
      taskType: "XHS_MARKETING_PLAN",
      taskTitle: `鐢熸垚灏忕孩涔﹁惀閿€绛栧垝鏂规锛${brand.brandName}`,
      taskStatus: "QUEUED" as const,
      modelName,
      pointsCost: 260,
      inputJson: {
        sourceReportId: sourceReport.id,
        sourceReportTitle: sourceReport.title,
        sourceOpportunityReportId: opportunityReport.id,
        sourceOpportunityReportTitle: opportunityReport.title,
        userRequirement: userRequirement || undefined,
      },
      createdAt: now,
      updatedAt: now,
    };
    database.tasks.unshift(task);
    return this.mapVisualGrowthReportTask(task);
  }

  private async createDouyinMarketingPlanTask(
    brandId: string,
    sourceReport: GrowthReportRecord,
    opportunityReport: OpportunityInsightReportRecord,
    userRequirement?: string,
  ) {
    const now = new Date().toISOString();
    const settings = await this.loadDouyinMarketingPlanGenerationSettings(brandId);
    const modelName =
      (await this.loadXiaohongshuMarketingProviderConfigs(settings))[0]?.models[0]
      || settings.preferredModelName
      || "deepseek-v4-pro";

    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerUserId: true, brandName: true },
      });
      if (!brand) {
        throw new NotFoundException("品牌不存在");
      }

      const task = await this.prismaService.task.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskType: "DOUYIN_MARKETING_PLAN",
          taskTitle: `生成抖音营销策划方案：${brand.brandName}`,
          taskStatus: TaskStatus.QUEUED,
          modelName,
          pointsCost: 260,
          inputJson: {
            sourceReportId: sourceReport.id,
            sourceReportTitle: sourceReport.title,
            sourceOpportunityReportId: opportunityReport.id,
            sourceOpportunityReportTitle: opportunityReport.title,
            userRequirement: userRequirement || undefined,
          } as Prisma.InputJsonValue,
        },
      });

      return this.mapVisualGrowthReportTask(task);
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("品牌不存在");
    }

    const task = {
      id: createId("tsk"),
      userId: brand.ownerUserId,
      brandId,
      taskType: "DOUYIN_MARKETING_PLAN",
      taskTitle: `生成抖音营销策划方案：${brand.brandName}`,
      taskStatus: "QUEUED" as const,
      modelName,
      pointsCost: 260,
      inputJson: {
        sourceReportId: sourceReport.id,
        sourceReportTitle: sourceReport.title,
        sourceOpportunityReportId: opportunityReport.id,
        sourceOpportunityReportTitle: opportunityReport.title,
        userRequirement: userRequirement || undefined,
      },
      createdAt: now,
      updatedAt: now,
    };
    database.tasks.unshift(task);
    return this.mapVisualGrowthReportTask(task);
  }

  private async createDouyinHotTopicCandidatesTask(brandId: string, selectedDate: string) {
    const now = new Date().toISOString();
    const settings = await this.loadDouyinHotTopicCandidatesGenerationSettings(brandId);
    const modelName =
      (await this.loadDouyinMarketingProviderConfigs(settings))[0]?.models[0]
      || settings.preferredModelName
      || "deepseek-v4-pro";

    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerUserId: true, brandName: true },
      });
      if (!brand) {
        throw new NotFoundException("品牌不存在");
      }

      const task = await this.prismaService.task.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskType: "DOUYIN_HOT_TOPIC_CANDIDATES",
          taskTitle: `生成抖音热点找选题：${brand.brandName}（${selectedDate}）`,
          taskStatus: TaskStatus.QUEUED,
          modelName,
          pointsCost: 120,
          inputJson: {
            selectedDate,
          } as Prisma.InputJsonValue,
        },
      });

      return this.mapVisualGrowthReportTask(task);
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("品牌不存在");
    }

    const task = {
      id: createId("tsk"),
      userId: brand.ownerUserId,
      brandId,
      taskType: "DOUYIN_HOT_TOPIC_CANDIDATES",
      taskTitle: `生成抖音热点找选题：${brand.brandName}（${selectedDate}）`,
      taskStatus: "QUEUED" as const,
      modelName,
      pointsCost: 120,
      inputJson: {
        selectedDate,
      },
      createdAt: now,
      updatedAt: now,
    };
    database.tasks.unshift(task);
    return this.mapVisualGrowthReportTask(task);
  }

  private async createDouyinOriginalCopyTask(
    brandId: string,
    params: {
      copyType: DouyinOriginalCopyType;
      topic?: DouyinTopicLibraryItem;
      calendarItem?: XiaohongshuMarketingCalendarItem;
      injectMarketingPlan: boolean;
      marketingPlanTitle?: string;
      userRequirement?: string;
    },
  ) {
    const now = new Date().toISOString();
    const settings = await this.loadDouyinOriginalCopyGenerationSettings(brandId, params.copyType);
    const modelName =
      (await this.loadDouyinMarketingProviderConfigs(settings))[0]?.models[0]
      || settings.preferredModelName
      || "deepseek-v4-pro";
    const copyTypeLabel = DOUYIN_ORIGINAL_COPY_TYPE_CONFIG[params.copyType].label;
    const taskInput = {
      copyType: params.copyType,
      copyTypeLabel,
      topic: params.topic
        ? {
            id: params.topic.id,
            topicContent: params.topic.topicContent,
            topicDescription: params.topic.topicDescription,
          }
        : undefined,
      calendarItem: params.calendarItem
        ? this.buildMarketingCalendarWorkflowSelection(params.calendarItem)
        : undefined,
      injectMarketingPlan: params.injectMarketingPlan,
      marketingPlanTitle: params.marketingPlanTitle || undefined,
      userRequirement: params.userRequirement || undefined,
    };

    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerUserId: true, brandName: true },
      });
      if (!brand) {
        throw new NotFoundException("品牌不存在");
      }

      const task = await this.prismaService.task.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskType: "DOUYIN_ORIGINAL_COPY",
          taskTitle: `生成抖音原创文案：${brand.brandName}｜${copyTypeLabel}`,
          taskStatus: TaskStatus.QUEUED,
          modelName,
          pointsCost: 140,
          inputJson: taskInput as Prisma.InputJsonValue,
        },
      });

      return this.mapVisualGrowthReportTask(task);
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("品牌不存在");
    }

    const task = {
      id: createId("tsk"),
      userId: brand.ownerUserId,
      brandId,
      taskType: "DOUYIN_ORIGINAL_COPY",
      taskTitle: `生成抖音原创文案：${brand.brandName}｜${copyTypeLabel}`,
      taskStatus: "QUEUED" as const,
      modelName,
      pointsCost: 140,
      inputJson: taskInput,
      createdAt: now,
      updatedAt: now,
    };
    database.tasks.unshift(task);
    return this.mapVisualGrowthReportTask(task);
  }

  private async createDouyinRemixCopyTask(
    brandId: string,
    params: {
      material: DouyinRemixCopyMaterialOption;
      injectBrandProfile: boolean;
      product?: DouyinRemixCopyProductOption;
      injectMarketingPlan: boolean;
      marketingPlanTitle?: string;
      userRequirement?: string;
    },
  ) {
    const now = new Date().toISOString();
    const settings = await this.loadDouyinRemixStageGenerationSettings(brandId, "FINAL");
    const modelName =
      (await this.loadDouyinMarketingProviderConfigs(settings))[0]?.models[0]
      || settings.preferredModelName
      || "deepseek-v4-pro";
    const taskInput = {
      material: params.material,
      injectBrandProfile: params.injectBrandProfile,
      product: params.product,
      injectMarketingPlan: params.injectMarketingPlan,
      marketingPlanTitle: params.marketingPlanTitle || undefined,
      userRequirement: params.userRequirement || undefined,
    };

    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerUserId: true, brandName: true },
      });
      if (!brand) {
        throw new NotFoundException("品牌不存在");
      }

      const task = await this.prismaService.task.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskType: "DOUYIN_REMIX_COPY",
          taskTitle: `生成抖音二创文案：${brand.brandName}｜${params.material.title}`,
          taskStatus: TaskStatus.QUEUED,
          modelName,
          pointsCost: 180,
          inputJson: taskInput as Prisma.InputJsonValue,
        },
      });

      return this.mapVisualGrowthReportTask(task);
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("品牌不存在");
    }

    const task = {
      id: createId("tsk"),
      userId: brand.ownerUserId,
      brandId,
      taskType: "DOUYIN_REMIX_COPY",
      taskTitle: `生成抖音二创文案：${brand.brandName}｜${params.material.title}`,
      taskStatus: "QUEUED" as const,
      modelName,
      pointsCost: 180,
      inputJson: taskInput,
      createdAt: now,
      updatedAt: now,
    };
    database.tasks.unshift(task);
    return this.mapVisualGrowthReportTask(task);
  }

  private async runGrowthReportTask(brandId: string, taskId: string) {
    const startedAt = new Date().toISOString();
    await this.updateGrowthReportTaskStatus(brandId, taskId, {
      taskStatus: "RUNNING",
      startedAt,
      errorMessage: "",
    });

    try {
      const archive = await this.brandsService.getArchive(brandId);
      const collection = await this.collectorsService.getXiaohongshuWorkspace(brandId);
      const opportunityInsightWorkspace = await this.getOpportunityInsightWorkspace(brandId);
      const report = await this.buildReport({
        brandId,
        archive,
        collection,
        opportunityInsightWorkspace,
        generatedAt: startedAt,
      });

      await this.persistGrowthReportResult(brandId, taskId, report, startedAt);
      await this.updateGrowthReportTaskStatus(brandId, taskId, {
        taskStatus: "SUCCESS",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: "",
        outputJson: {
          summary: report.summary,
          diagnosis: report.diagnosis,
          opportunities: report.opportunities,
          nextActions: report.nextActions,
          reportMarkdown: report.reportMarkdown,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "品牌增长报告生成失败";
      await this.updateGrowthReportTaskStatus(brandId, taskId, {
        taskStatus: "FAILED",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: message,
      });
    }
  }

  private async runOpportunityInsightStepOneTask(brandId: string, taskId: string) {
    const startedAt = new Date().toISOString();
    let currentPhaseStatus = this.buildOpportunityInsightPhaseStatus("PREPARING");
    const applyRunningStatus = async () => {
      await this.updateOpportunityInsightTaskStatus(brandId, taskId, {
        taskStatus: "RUNNING",
        startedAt,
        errorMessage: "",
        outputJson: { ...currentPhaseStatus },
      });
    };
    await applyRunningStatus();
    const heartbeat = setInterval(() => {
      void applyRunningStatus();
    }, 20000);

    try {
      const taskInputMeta = await this.findTaskInputMeta(brandId, taskId);
      const supplementInput = this.readMetaString(taskInputMeta, "supplementInput") || undefined;
      const archive = await this.brandsService.getArchive(brandId);
      const xiaohongshuWorkspace = await this.collectorsService.getXiaohongshuWorkspace(brandId);
      const douyinWorkspace = await this.collectorsService.getDouyinWorkspace(brandId);

      currentPhaseStatus = this.buildOpportunityInsightPhaseStatus("BRAND_ACCOUNT_ANALYSIS");
      await applyRunningStatus();
      const brandAccountAnalysis = await this.buildOpportunityInsightAccountReport({
        brandId,
        generatedAt: startedAt,
        archive,
        xiaohongshuWorkspace,
        douyinWorkspace,
        supplementInput,
        stepKey: "brandAccountAnalysis",
        onAttemptUpdate: async (detailText, modelName) => {
          currentPhaseStatus = this.buildOpportunityInsightPhaseStatus("BRAND_ACCOUNT_ANALYSIS", {
            detailText,
            modelName,
          });
          await applyRunningStatus();
        },
      });

      currentPhaseStatus = this.buildOpportunityInsightPhaseStatus("COMPETITOR_ACCOUNT_ANALYSIS");
      await applyRunningStatus();
      const competitorAccountAnalysis = await this.buildOpportunityInsightAccountReport({
        brandId,
        generatedAt: startedAt,
        archive,
        xiaohongshuWorkspace,
        douyinWorkspace,
        supplementInput,
        stepKey: "competitorAccountAnalysis",
        onAttemptUpdate: async (detailText, modelName) => {
          currentPhaseStatus = this.buildOpportunityInsightPhaseStatus("COMPETITOR_ACCOUNT_ANALYSIS", {
            detailText,
            modelName,
          });
          await applyRunningStatus();
        },
      });

      currentPhaseStatus = this.buildOpportunityInsightPhaseStatus("PERSISTING");
      await applyRunningStatus();
      clearInterval(heartbeat);
      const persistedIds = await Promise.all([
        this.persistOpportunityInsightResult(brandId, taskId, "brandAccountAnalysis", brandAccountAnalysis, startedAt),
        this.persistOpportunityInsightResult(brandId, taskId, "competitorAccountAnalysis", competitorAccountAnalysis, startedAt),
      ]);
      await this.updateOpportunityInsightTaskStatus(brandId, taskId, {
        taskStatus: "SUCCESS",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: "",
        outputJson: {
          ...this.buildOpportunityInsightPhaseStatus("DONE", {
            modelName: competitorAccountAnalysis.modelName || brandAccountAnalysis.modelName,
          }),
          generatedReportIds: persistedIds,
          generatedSteps: ["brandAccountAnalysis", "competitorAccountAnalysis"],
          brandAccountAnalysisTitle: brandAccountAnalysis.title,
          competitorAccountAnalysisTitle: competitorAccountAnalysis.title,
        },
      });
    } catch (error) {
      clearInterval(heartbeat);
      const message = error instanceof Error ? error.message : "机会洞察第1步生成失败";
      await this.updateOpportunityInsightTaskStatus(brandId, taskId, {
        taskStatus: "FAILED",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: message,
      });
    }
  }

  private async runOpportunityInsightStepTwoTask(brandId: string, taskId: string) {
    const startedAt = new Date().toISOString();
    let currentStatus: Record<string, unknown> = {
      phase: "COMMENT_INSIGHT_ANALYSIS",
      phaseText: "正在生成评论洞察分析",
      phaseIndex: 1,
      phaseTotal: 2,
      stepKey: "commentInsightAnalysis",
    };
    const applyRunningStatus = async () => {
      await this.updateOpportunityInsightTaskStatus(brandId, taskId, {
        taskStatus: "RUNNING",
        startedAt,
        errorMessage: "",
        outputJson: { ...currentStatus },
      });
    };
    await applyRunningStatus();
    const heartbeat = setInterval(() => {
      void applyRunningStatus();
    }, 20000);

    try {
      const taskInputMeta = await this.findTaskInputMeta(brandId, taskId);
      const supplementInput = this.readMetaString(taskInputMeta, "supplementInput") || undefined;
      const archive = await this.brandsService.getArchive(brandId);
      const douyinWorkspace = await this.collectorsService.getDouyinWorkspace(brandId);
      const report = await this.buildOpportunityInsightCommentReport({
        brandId,
        archive,
        douyinWorkspace,
        generatedAt: startedAt,
        supplementInput,
        onAttemptUpdate: async (detailText, modelName) => {
          currentStatus = {
            ...currentStatus,
            phaseText: "正在生成评论洞察分析",
            modelName,
            detailText,
          };
          await applyRunningStatus();
        },
      });

      currentStatus = {
        phase: "PERSISTING",
        phaseText: "正在保存评论洞察分析结果",
        phaseIndex: 2,
        phaseTotal: 2,
        stepKey: "commentInsightAnalysis",
      };
      await applyRunningStatus();
      clearInterval(heartbeat);
      const reportId = await this.persistOpportunityInsightResult(
        brandId,
        taskId,
        "commentInsightAnalysis",
        report,
        startedAt,
      );
      await this.updateOpportunityInsightTaskStatus(brandId, taskId, {
        taskStatus: "SUCCESS",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: "",
        outputJson: {
          phase: "DONE",
          phaseText: "评论洞察分析已生成完成",
          phaseIndex: 2,
          phaseTotal: 2,
          generatedReportIds: [reportId],
          generatedSteps: ["commentInsightAnalysis"],
          stepKey: "commentInsightAnalysis",
          modelName: report.modelName,
        },
      });
    } catch (error) {
      clearInterval(heartbeat);
      const message = error instanceof Error ? error.message : "机会洞察第2步生成失败";
      await this.updateOpportunityInsightTaskStatus(brandId, taskId, {
        taskStatus: "FAILED",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: message,
        outputJson: {
          ...currentStatus,
          errorMessage: message,
        },
      });
    }
  }

  private async runOpportunityInsightStepThreeTask(brandId: string, taskId: string) {
    const startedAt = new Date().toISOString();
    let currentStatus: Record<string, unknown> = {
      phase: "FINAL_OPPORTUNITY_REPORT",
      phaseText: "正在生成机会洞察总报告",
      phaseIndex: 1,
      phaseTotal: 2,
      stepKey: "finalOpportunityReport",
    };
    const applyRunningStatus = async () => {
      await this.updateOpportunityInsightTaskStatus(brandId, taskId, {
        taskStatus: "RUNNING",
        startedAt,
        errorMessage: "",
        outputJson: { ...currentStatus },
      });
    };
    await applyRunningStatus();
    const heartbeat = setInterval(() => {
      void applyRunningStatus();
    }, 20000);

    try {
      const taskInputMeta = await this.findTaskInputMeta(brandId, taskId);
      const supplementInput = this.readMetaString(taskInputMeta, "supplementInput") || undefined;
      const archive = await this.brandsService.getArchive(brandId);
      const workspace = await this.getOpportunityInsightWorkspace(brandId);
      if (!workspace.brandAccountAnalysis || !workspace.competitorAccountAnalysis || !workspace.commentInsightAnalysis) {
        throw new ServiceUnavailableException("机会洞察总报告生成失败：缺少前序分析结果。");
      }
      const report = await this.buildOpportunityInsightFinalReport({
        brandId,
        archive,
        workspace,
        generatedAt: startedAt,
        supplementInput,
        onAttemptUpdate: async (detailText, modelName) => {
          currentStatus = {
            ...currentStatus,
            phaseText: "正在生成机会洞察总报告",
            modelName,
            detailText,
          };
          await applyRunningStatus();
        },
      });

      currentStatus = {
        phase: "PERSISTING",
        phaseText: "正在保存机会洞察总报告",
        phaseIndex: 2,
        phaseTotal: 2,
        stepKey: "finalOpportunityReport",
      };
      await applyRunningStatus();
      clearInterval(heartbeat);
      const reportId = await this.persistOpportunityInsightResult(
        brandId,
        taskId,
        "finalOpportunityReport",
        report,
        startedAt,
      );
      await this.updateOpportunityInsightTaskStatus(brandId, taskId, {
        taskStatus: "SUCCESS",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: "",
        outputJson: {
          phase: "DONE",
          phaseText: "机会洞察总报告已生成完成",
          phaseIndex: 2,
          phaseTotal: 2,
          generatedReportIds: [reportId],
          generatedSteps: ["finalOpportunityReport"],
          stepKey: "finalOpportunityReport",
          modelName: report.modelName,
        },
      });
    } catch (error) {
      clearInterval(heartbeat);
      const message = error instanceof Error ? error.message : "机会洞察第3步生成失败";
      await this.updateOpportunityInsightTaskStatus(brandId, taskId, {
        taskStatus: "FAILED",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: message,
        outputJson: {
          ...currentStatus,
          errorMessage: message,
        },
      });
    }
  }

  private async createXiaohongshuMarketingCalendarTask(
    brandId: string,
    sourceReport: GrowthReportRecord,
    opportunityReport: OpportunityInsightReportRecord,
    userRequirement?: string,
  ) {
    const now = new Date().toISOString();
    const settings = await this.loadXiaohongshuMarketingCalendarGenerationSettings(brandId);
    const modelName =
      (await this.loadXiaohongshuMarketingCalendarProviderConfigs(settings))[0]?.models[0]
      || settings.preferredModelName
      || "gpt-5.4";

    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerUserId: true, brandName: true },
      });
      if (!brand) {
        throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
      }

      const task = await this.prismaService.task.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskType: "XHS_MARKETING_CALENDAR",
          taskTitle: `鐢熸垚钀ラ攢鏃ュ巻锛${brand.brandName}`,
          taskStatus: TaskStatus.QUEUED,
          modelName,
          pointsCost: 180,
          inputJson: {
            sourceReportId: sourceReport.id,
            sourceReportTitle: sourceReport.title,
            sourceOpportunityReportId: opportunityReport.id,
            sourceOpportunityReportTitle: opportunityReport.title,
            userRequirement: userRequirement || undefined,
          } as Prisma.InputJsonValue,
        },
      });

      return this.mapVisualGrowthReportTask(task);
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
    }

    const task = {
      id: createId("tsk"),
      userId: brand.ownerUserId,
      brandId,
      taskType: "XHS_MARKETING_CALENDAR",
      taskTitle: `鐢熸垚钀ラ攢鏃ュ巻锛${brand.brandName}`,
      taskStatus: "QUEUED" as const,
      modelName,
      pointsCost: 180,
      inputJson: {
        sourceReportId: sourceReport.id,
        sourceReportTitle: sourceReport.title,
        sourceOpportunityReportId: opportunityReport.id,
        sourceOpportunityReportTitle: opportunityReport.title,
        userRequirement: userRequirement || undefined,
      },
      createdAt: now,
      updatedAt: now,
    };
    database.tasks.unshift(task);
    return this.mapVisualGrowthReportTask(task);
  }

  private async runVisualGrowthReportTask(brandId: string, taskId: string) {
    const startedAt = new Date().toISOString();
    await this.updateVisualGrowthReportTaskStatus(brandId, taskId, {
      taskStatus: "RUNNING",
      startedAt,
      errorMessage: "",
    });

    try {
      const sourceWorkspace = await this.getGrowthReportWorkspace(brandId);
      const latestTask = await this.getLatestVisualGrowthReportTask(brandId);
      const sourceReportId = latestTask?.sourceReportId;
      const sourceReport = sourceWorkspace.history.find((item) => item.id === sourceReportId) || sourceWorkspace.latest;
      if (!sourceReport) {
        throw new NotFoundException("璇峰厛鐢熸垚鍝佺墝澧為暱鎶ュ憡");
      }

      const report = await this.buildVisualReport({
        brandId,
        sourceReport,
        generatedAt: startedAt,
      });

      await this.persistVisualGrowthReportResult(brandId, taskId, sourceReport, report, startedAt);
      await this.updateVisualGrowthReportTaskStatus(brandId, taskId, {
        taskStatus: "SUCCESS",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: "",
        outputJson: {
          summary: report.summary,
          htmlBody: report.htmlBody,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "鍝佺墝澧為暱鍙鍖栨姤鍛婄敓鎴愬け璐";
      await this.updateVisualGrowthReportTaskStatus(brandId, taskId, {
        taskStatus: "FAILED",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: message,
      });
    }
  }

  private async runAnnualMarketingPlanTask(brandId: string, taskId: string) {
    const startedAt = new Date().toISOString();
    await this.updateAnnualMarketingPlanTaskStatus(brandId, taskId, {
      taskStatus: "RUNNING",
      startedAt,
      errorMessage: "",
    });

    try {
      const archive = await this.brandsService.getArchive(brandId);
      const sourceWorkspace = await this.getGrowthReportWorkspace(brandId);
      const currentTaskRow = await this.findTaskInputMeta(brandId, taskId);
      const sourceReportId = this.readMetaString(currentTaskRow, "sourceReportId");
      const userRequirement = this.readMetaString(currentTaskRow, "userRequirement") || undefined;
      const sourceReport = sourceWorkspace.history.find((item) => item.id === sourceReportId) || sourceWorkspace.latest;
      if (!sourceReport) {
        throw new NotFoundException("璇峰厛鐢熸垚鍝佺墝澧為暱鎶ュ憡");
      }

      const plan = await this.buildAnnualMarketingPlan({
        brandId,
        archive,
        sourceReport,
        generatedAt: startedAt,
        userRequirement,
      });

      await this.persistAnnualMarketingPlanResult(brandId, taskId, sourceReport, plan, startedAt);
      await this.updateAnnualMarketingPlanTaskStatus(brandId, taskId, {
        taskStatus: "SUCCESS",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: "",
        outputJson: {
          summary: plan.summary,
          planningYear: plan.planningYear,
          planningFocus: plan.planningFocus,
          itemCount: plan.items.length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "半年营销规划生成失败";
      await this.updateAnnualMarketingPlanTaskStatus(brandId, taskId, {
        taskStatus: "FAILED",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: message,
      });
    }
  }

  private async runXiaohongshuMarketingPlanTask(brandId: string, taskId: string) {
    const startedAt = new Date().toISOString();
    let currentPhaseStatus = this.buildXiaohongshuPhaseStatus("PREPARING");
    const applyRunningStatus = async () => {
      await this.updateXiaohongshuMarketingPlanTaskStatus(brandId, taskId, {
        taskStatus: "RUNNING",
        startedAt,
        errorMessage: "",
        outputJson: { ...currentPhaseStatus },
      });
    };
    await applyRunningStatus();
    const heartbeat = setInterval(() => {
      void applyRunningStatus();
    }, 20000);

    try {
      const archive = await this.brandsService.getArchive(brandId);
      const collection = await this.collectorsService.getXiaohongshuWorkspace(brandId);
      const growthReportWorkspace = await this.getGrowthReportWorkspace(brandId);
      const opportunityInsightWorkspace = await this.getOpportunityInsightWorkspace(brandId);
      const currentTaskRow = await this.findTaskInputMeta(brandId, taskId);
      const sourceReportId = this.readMetaString(currentTaskRow, "sourceReportId");
      const sourceOpportunityReportId = this.readMetaString(currentTaskRow, "sourceOpportunityReportId");
      const userRequirement = this.readMetaString(currentTaskRow, "userRequirement") || undefined;
      const sourceReport = growthReportWorkspace.history.find((item) => item.id === sourceReportId) || growthReportWorkspace.latest;
      const opportunityReport =
        opportunityInsightWorkspace.history.find((item) => item.id === sourceOpportunityReportId)
        || opportunityInsightWorkspace.finalOpportunityReport;
      if (!sourceReport) {
        throw new NotFoundException("璇峰厛鐢熸垚鍝佺墝澧為暱鎶ュ憡");
      }
      if (!opportunityReport?.htmlDocument?.trim()) {
        throw new NotFoundException("请先生成机会洞察总报告");
      }

      const report = await this.buildXiaohongshuMarketingPlan({
        brandId,
        archive,
        collection,
        sourceReport,
        opportunityReport,
        generatedAt: startedAt,
        userRequirement,
        onPhaseUpdate: async (phase, extra) => {
          currentPhaseStatus = this.buildXiaohongshuPhaseStatus(phase, extra);
          await applyRunningStatus();
        },
      });

      currentPhaseStatus = this.buildXiaohongshuPhaseStatus("PERSISTING", {
        modelName: report.modelName,
      });
      await applyRunningStatus();
      clearInterval(heartbeat);
      await this.persistXiaohongshuMarketingPlanResult(brandId, taskId, sourceReport, opportunityReport, report, startedAt);
      await this.updateXiaohongshuMarketingPlanTaskStatus(brandId, taskId, {
        taskStatus: "SUCCESS",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: "",
        outputJson: {
          summary: report.summary,
          reportMarkdown: report.reportMarkdown,
          modelName: report.modelName,
          ...this.buildXiaohongshuPhaseStatus("DONE", {
            modelName: report.modelName,
          }),
        },
      });
    } catch (error) {
      clearInterval(heartbeat);
      const message = error instanceof Error ? error.message : "灏忕孩涔﹁惀閿€绛栧垝鏂规鐢熸垚澶辫触";
      await this.updateXiaohongshuMarketingPlanTaskStatus(brandId, taskId, {
        taskStatus: "FAILED",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: message,
      });
    }
  }

  private async runDouyinMarketingPlanTask(brandId: string, taskId: string) {
    const startedAt = new Date().toISOString();
    let currentPhaseStatus = this.buildDouyinMarketingPlanPhaseStatus("PREPARING");
    const applyRunningStatus = async () => {
      await this.updateDouyinMarketingPlanTaskStatus(brandId, taskId, {
        taskStatus: "RUNNING",
        startedAt,
        errorMessage: "",
        outputJson: { ...currentPhaseStatus },
      });
    };
    await applyRunningStatus();
    const heartbeat = setInterval(() => {
      void applyRunningStatus();
    }, 20000);

    try {
      const archive = await this.brandsService.getArchive(brandId);
      const collection = await this.collectorsService.getDouyinWorkspace(brandId);
      const growthReportWorkspace = await this.getGrowthReportWorkspace(brandId);
      const opportunityInsightWorkspace = await this.getOpportunityInsightWorkspace(brandId);
      const currentTaskRow = await this.findTaskInputMeta(brandId, taskId);
      const sourceReportId = this.readMetaString(currentTaskRow, "sourceReportId");
      const sourceOpportunityReportId = this.readMetaString(currentTaskRow, "sourceOpportunityReportId");
      const userRequirement = this.readMetaString(currentTaskRow, "userRequirement") || undefined;
      const sourceReport = growthReportWorkspace.history.find((item) => item.id === sourceReportId) || growthReportWorkspace.latest;
      const opportunityReport =
        opportunityInsightWorkspace.history.find((item) => item.id === sourceOpportunityReportId)
        || opportunityInsightWorkspace.finalOpportunityReport;
      if (!sourceReport) {
        throw new NotFoundException("请先生成品牌增长报告");
      }
      if (!opportunityReport?.htmlDocument?.trim()) {
        throw new NotFoundException("请先生成机会洞察总报告");
      }

      currentPhaseStatus = this.buildDouyinMarketingPlanPhaseStatus("GENERATING");
      await applyRunningStatus();
      const report = await this.buildDouyinMarketingPlan({
        brandId,
        archive,
        collection,
        sourceReport,
        opportunityReport,
        generatedAt: startedAt,
        userRequirement,
        onPhaseUpdate: async (phase, extra) => {
          currentPhaseStatus = this.buildDouyinMarketingPlanPhaseStatus(phase, extra);
          await applyRunningStatus();
        },
      });

      currentPhaseStatus = this.buildDouyinMarketingPlanPhaseStatus("PERSISTING", {
        modelName: report.modelName,
      });
      await applyRunningStatus();
      clearInterval(heartbeat);
      await this.persistDouyinMarketingPlanResult(brandId, taskId, sourceReport, opportunityReport, report, startedAt);
      await this.updateDouyinMarketingPlanTaskStatus(brandId, taskId, {
        taskStatus: "SUCCESS",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: "",
        outputJson: {
          summary: report.summary,
          reportMarkdown: report.reportMarkdown,
          modelName: report.modelName,
          ...this.buildDouyinMarketingPlanPhaseStatus("DONE", {
            modelName: report.modelName,
          }),
        },
      });
    } catch (error) {
      clearInterval(heartbeat);
      const message = error instanceof Error ? error.message : "抖音营销策划方案生成失败";
      await this.updateDouyinMarketingPlanTaskStatus(brandId, taskId, {
        taskStatus: "FAILED",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: message,
      });
    }
  }

  private async runDouyinHotTopicCandidatesTask(brandId: string, taskId: string) {
    const startedAt = new Date().toISOString();
    let currentPhaseStatus = this.buildDouyinHotTopicCandidatesPhaseStatus("PREPARING");
    const applyRunningStatus = async () => {
      await this.updateDouyinHotTopicCandidatesTaskStatus(brandId, taskId, {
        taskStatus: "RUNNING",
        startedAt,
        errorMessage: "",
        outputJson: { ...currentPhaseStatus },
      });
    };
    await applyRunningStatus();
    const heartbeat = setInterval(() => {
      void applyRunningStatus();
    }, 20000);

    try {
      const currentTaskRow = await this.findTaskInputMeta(brandId, taskId);
      const selectedDate = this.readMetaString(currentTaskRow, "selectedDate");
      const archive = await this.brandsService.getArchive(brandId);
      const dailyHotspots = await this.collectorsService.getDailyHotspotWorkspace(brandId, selectedDate || undefined);
      if (!dailyHotspots.selectedDate) {
        throw new NotFoundException("请先同步每日热点");
      }

      currentPhaseStatus = this.buildDouyinHotTopicCandidatesPhaseStatus("GENERATING");
      await applyRunningStatus();
      const report = await this.buildDouyinHotTopicCandidates({
        brandId,
        archive,
        dailyHotspots,
        generatedAt: startedAt,
        onPhaseUpdate: async (phase, extra) => {
          currentPhaseStatus = this.buildDouyinHotTopicCandidatesPhaseStatus(phase, extra);
          await applyRunningStatus();
        },
      });

      currentPhaseStatus = this.buildDouyinHotTopicCandidatesPhaseStatus("PERSISTING", {
        modelName: report.modelName,
      });
      await applyRunningStatus();
      clearInterval(heartbeat);
      await this.persistDouyinHotTopicCandidatesResult(brandId, taskId, report, startedAt);
      await this.updateDouyinHotTopicCandidatesTaskStatus(brandId, taskId, {
        taskStatus: "SUCCESS",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: "",
        outputJson: {
          summary: report.summary,
          itemCount: report.items.length,
          modelName: report.modelName,
          selectedDate: report.selectedDate,
          ...this.buildDouyinHotTopicCandidatesPhaseStatus("DONE", {
            modelName: report.modelName,
          }),
        },
      });
    } catch (error) {
      clearInterval(heartbeat);
      const message = error instanceof Error ? error.message : "抖音热点找选题生成失败";
      await this.updateDouyinHotTopicCandidatesTaskStatus(brandId, taskId, {
        taskStatus: "FAILED",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: message,
      });
    }
  }

  private async runDouyinOriginalCopyTask(brandId: string, taskId: string) {
    const startedAt = new Date().toISOString();
    let currentPhaseStatus = this.buildDouyinOriginalCopyPhaseStatus("PREPARING");
    const applyRunningStatus = async () => {
      await this.updateDouyinOriginalCopyTaskStatus(brandId, taskId, {
        taskStatus: "RUNNING",
        startedAt,
        errorMessage: "",
        outputJson: { ...currentPhaseStatus },
      });
    };
    await applyRunningStatus();
    const heartbeat = setInterval(() => {
      void applyRunningStatus();
    }, 20000);

    try {
      const currentTaskRow = await this.findTaskInputMeta(brandId, taskId);
      const copyType = this.readMetaString(currentTaskRow, "copyType") as DouyinOriginalCopyType;
      const topicRecord = this.readNestedRecord(currentTaskRow, ["topic"]);
      const calendarRecord = this.readNestedRecord(currentTaskRow, ["calendarItem"]);
      const injectMarketingPlan = Boolean(currentTaskRow.injectMarketingPlan);
      const userRequirement = this.readMetaString(currentTaskRow, "userRequirement") || undefined;
      const topicTitle = this.readRecordString(topicRecord, "topicTitle") || this.readRecordString(topicRecord, "title");
      const topicContent = this.readRecordString(topicRecord, "topicContent");
      const topicId = this.readRecordString(topicRecord, "id");
      if (!copyType || !DOUYIN_ORIGINAL_COPY_TYPE_CONFIG[copyType]) {
        throw new NotFoundException("文案类型不存在");
      }
      const archive = await this.brandsService.getArchive(brandId);
      const marketingPlanWorkspace = injectMarketingPlan ? await this.getDouyinMarketingPlanWorkspace(brandId) : undefined;
      const marketingPlan = injectMarketingPlan ? marketingPlanWorkspace?.latest : undefined;
      if (injectMarketingPlan && !marketingPlan) {
        throw new NotFoundException("当前品牌还没有抖音营销策划方案，无法植入");
      }

      currentPhaseStatus = this.buildDouyinOriginalCopyPhaseStatus("GENERATING");
      await applyRunningStatus();
      const report = await this.buildDouyinOriginalCopy({
        brandId,
        archive,
        topic: topicContent || topicId
          ? {
              id: topicId || `topic-${this.createSlug(topicContent || "none")}`,
              topicTitle: topicTitle || topicContent || "不选择选题",
              topicContent: topicContent || "不选择选题",
              topicDescription: this.readRecordString(topicRecord, "topicDescription") || undefined,
            }
          : undefined,
        selectedCalendarItem: calendarRecord
          ? this.normalizeXiaohongshuMarketingCalendarItems([calendarRecord])[0]
          : undefined,
        marketingPlan,
        copyType,
        injectMarketingPlan,
        userRequirement,
        generatedAt: startedAt,
        onPhaseUpdate: async (phase, extra) => {
          currentPhaseStatus = this.buildDouyinOriginalCopyPhaseStatus(phase, extra);
          await applyRunningStatus();
        },
      });

      currentPhaseStatus = this.buildDouyinOriginalCopyPhaseStatus("PERSISTING", {
        modelName: report.modelName,
      });
      await applyRunningStatus();
      clearInterval(heartbeat);
      await this.persistDouyinOriginalCopyResult(brandId, taskId, report, startedAt);
      await this.updateDouyinOriginalCopyTaskStatus(brandId, taskId, {
        taskStatus: "SUCCESS",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: "",
        outputJson: {
          title: report.title,
          summary: report.summary,
          modelName: report.modelName,
          copyType: report.copyType,
          topicId: report.topicId,
          ...this.buildDouyinOriginalCopyPhaseStatus("DONE", {
            modelName: report.modelName,
          }),
        },
      });
    } catch (error) {
      clearInterval(heartbeat);
      const message = error instanceof Error ? error.message : "抖音原创文案生成失败";
      await this.updateDouyinOriginalCopyTaskStatus(brandId, taskId, {
        taskStatus: "FAILED",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: message,
      });
    }
  }

  private async runDouyinRemixCopyTask(brandId: string, taskId: string) {
    const startedAt = new Date().toISOString();
    let currentPhaseStatus = this.buildDouyinRemixCopyPhaseStatus("PREPARING");
    const applyRunningStatus = async () => {
      await this.updateDouyinRemixCopyTaskStatus(brandId, taskId, {
        taskStatus: "RUNNING",
        startedAt,
        errorMessage: "",
        outputJson: { ...currentPhaseStatus },
      });
    };
    await applyRunningStatus();
    const heartbeat = setInterval(() => {
      void applyRunningStatus();
    }, 20000);

    try {
      const currentTaskRow = await this.findTaskInputMeta(brandId, taskId);
      const materialRecord = this.readNestedRecord(currentTaskRow, ["material"]);
      const materialId = this.readRecordString(materialRecord, "id");
      const materialTitle = this.readRecordString(materialRecord, "title");
      const materialVideoUrl = this.readRecordString(materialRecord, "videoUrl");
      if (!materialId || !materialVideoUrl) {
        throw new NotFoundException("当前任务缺少有效素材视频链接");
      }

      const archive = await this.brandsService.getArchive(brandId);
      const productRecord = this.readNestedRecord(currentTaskRow, ["product"]);
      const productId = this.readRecordString(productRecord, "id") || undefined;
      const product = productId ? archive.products.find((item) => item.id === productId) : undefined;
      const injectMarketingPlan = Boolean(currentTaskRow.injectMarketingPlan);
      const marketingPlanWorkspace = injectMarketingPlan ? await this.getDouyinMarketingPlanWorkspace(brandId) : undefined;
      const marketingPlan = injectMarketingPlan ? marketingPlanWorkspace?.latest : undefined;
      if (injectMarketingPlan && !marketingPlan) {
        throw new NotFoundException("当前品牌还没有抖音营销策划方案，无法植入");
      }

      currentPhaseStatus = this.buildDouyinRemixCopyPhaseStatus("EXTRACTING");
      await applyRunningStatus();
      const report = await this.buildDouyinRemixCopy({
        brandId,
        archive,
        material: {
          id: materialId,
          title: materialTitle || "素材视频",
          videoUrl: materialVideoUrl,
          authorName: this.readRecordString(materialRecord, "authorName") || undefined,
          workUrl: this.readRecordString(materialRecord, "workUrl") || undefined,
        },
        injectBrandProfile: Boolean(currentTaskRow.injectBrandProfile),
        product,
        marketingPlan,
        injectMarketingPlan,
        userRequirement: this.readMetaString(currentTaskRow, "userRequirement") || undefined,
        generatedAt: startedAt,
        onPhaseUpdate: async (phase, extra) => {
          currentPhaseStatus = this.buildDouyinRemixCopyPhaseStatus(phase, extra);
          await applyRunningStatus();
        },
      });

      currentPhaseStatus = this.buildDouyinRemixCopyPhaseStatus("PERSISTING", {
        modelName: report.modelName,
      });
      await applyRunningStatus();
      clearInterval(heartbeat);
      await this.persistDouyinRemixCopyResult(brandId, taskId, report, startedAt);
      await this.updateDouyinRemixCopyTaskStatus(brandId, taskId, {
        taskStatus: "SUCCESS",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: "",
        outputJson: {
          title: report.title,
          summary: report.summary,
          modelName: report.modelName,
          sourceMaterialId: report.sourceMaterialId,
          ...this.buildDouyinRemixCopyPhaseStatus("DONE", {
            modelName: report.modelName,
          }),
        },
      });
    } catch (error) {
      clearInterval(heartbeat);
      const message = error instanceof Error ? error.message : "抖音二创文案生成失败";
      await this.updateDouyinRemixCopyTaskStatus(brandId, taskId, {
        taskStatus: "FAILED",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: message,
      });
    }
  }

  private async runXiaohongshuMarketingCalendarTask(brandId: string, taskId: string) {
    const startedAt = new Date().toISOString();
    let currentPhaseStatus = this.buildXiaohongshuMarketingCalendarPhaseStatus("PREPARING");
    const applyRunningStatus = async () => {
      await this.updateXiaohongshuMarketingCalendarTaskStatus(brandId, taskId, {
        taskStatus: "RUNNING",
        startedAt,
        errorMessage: "",
        outputJson: { ...currentPhaseStatus },
      });
    };
    await applyRunningStatus();
    const heartbeat = setInterval(() => {
      void applyRunningStatus();
    }, 20000);

    try {
      const archive = await this.brandsService.getArchive(brandId);
      const growthReportWorkspace = await this.getGrowthReportWorkspace(brandId);
      const opportunityInsightWorkspace = await this.getOpportunityInsightWorkspace(brandId);
      const calendarWorkspace = await this.getXiaohongshuMarketingCalendarWorkspace(brandId);
      const currentTaskRow = await this.findTaskInputMeta(brandId, taskId);
      const sourceReportId = this.readMetaString(currentTaskRow, "sourceReportId");
      const sourceOpportunityReportId = this.readMetaString(currentTaskRow, "sourceOpportunityReportId");
      const userRequirement = this.readMetaString(currentTaskRow, "userRequirement") || undefined;
      const sourceReportCandidate = growthReportWorkspace.history.find((item) => item.id === sourceReportId) || growthReportWorkspace.latest;
      const opportunityReportCandidate =
        opportunityInsightWorkspace.history.find((item) => item.id === sourceOpportunityReportId)
        || opportunityInsightWorkspace.finalOpportunityReport;
      const { sourceReport, opportunityReport } = this.resolveMarketingCalendarSourceReports(archive, {
        generatedAt: startedAt,
        sourceReport: sourceReportCandidate,
        opportunityReport: opportunityReportCandidate,
      });

      currentPhaseStatus = this.buildXiaohongshuMarketingCalendarPhaseStatus("GENERATING");
      await applyRunningStatus();
      const report = await this.buildXiaohongshuMarketingCalendar({
        brandId,
        archive,
        sourceReport,
        opportunityReport,
        previousCalendars: calendarWorkspace.history,
        generatedAt: startedAt,
        userRequirement,
        onPhaseUpdate: async (phase, extra) => {
          currentPhaseStatus = this.buildXiaohongshuMarketingCalendarPhaseStatus(phase, extra);
          await applyRunningStatus();
        },
      });

      currentPhaseStatus = this.buildXiaohongshuMarketingCalendarPhaseStatus("PERSISTING", {
        modelName: report.modelName,
      });
      await applyRunningStatus();
      clearInterval(heartbeat);
      await this.persistXiaohongshuMarketingCalendarResult(
        brandId,
        taskId,
        sourceReport,
        opportunityReport,
        report,
        startedAt,
      );
      await this.updateXiaohongshuMarketingCalendarTaskStatus(brandId, taskId, {
        taskStatus: "SUCCESS",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: "",
        outputJson: {
          summary: report.summary,
          itemCount: report.items.length,
          modelName: report.modelName,
          ...this.buildXiaohongshuMarketingCalendarPhaseStatus("DONE", {
            modelName: report.modelName,
          }),
        },
      });
    } catch (error) {
      clearInterval(heartbeat);
      const message = error instanceof Error ? error.message : "营销日历生成失败";
      await this.updateXiaohongshuMarketingCalendarTaskStatus(brandId, taskId, {
        taskStatus: "FAILED",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: message,
      });
    }
  }

  private async persistGrowthReportResult(
    brandId: string,
    taskId: string,
    report: Awaited<ReturnType<ReportsService["buildReport"]>>,
    generatedAt: string,
  ) {
    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { ownerUserId: true },
      });
      if (!brand) {
        throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
      }

      const fileName = this.buildGrowthReportFileName(taskId);
      const storageKey = this.buildReportAssetStorageKey(brandId, fileName);
      const sourceUrl = this.buildReportAssetUrl(brandId, fileName);
      await this.persistReportHtml(storageKey, report.htmlContent);

      const media = await this.prismaService.mediaAsset.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskId,
          title: report.title,
          mediaType: MediaType.HTML,
          storageKey,
          sourceUrl,
          mimeType: "text/html",
          metadataJson: {
            kind: "BRAND_GROWTH_REPORT",
            generatedAt,
            summary: report.summary,
          } as Prisma.InputJsonValue,
        },
      });

      await this.prismaService.businessAsset.create({
        data: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
          title: report.title,
          description: report.summary,
          fileUrl: media.sourceUrl,
          metadataJson: {
            kind: "BRAND_GROWTH_REPORT",
            generatedAt,
            taskId,
            mediaId: media.id,
            summary: report.summary,
            diagnosis: report.diagnosis,
            opportunities: report.opportunities,
            nextActions: report.nextActions,
            reportMarkdown: report.reportMarkdown,
            htmlContent: report.htmlContent,
            metrics: report.metrics,
          } as Prisma.InputJsonValue,
        },
      });
      return;
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
    }

    const mediaId = createId("med");
    const fileName = this.buildGrowthReportFileName(taskId);
    const storageKey = this.buildReportAssetStorageKey(brandId, fileName);
    const sourceUrl = this.buildReportAssetUrl(brandId, fileName);
    await this.persistReportHtml(storageKey, report.htmlContent);

    database.media.unshift({
      id: mediaId,
      userId: brand.ownerUserId,
      brandId,
      taskId,
      title: report.title,
      mediaType: "HTML",
      sourceUrl,
      storageKey,
      mimeType: "text/html",
      createdAt: generatedAt,
      updatedAt: generatedAt,
    });

    database.assets.unshift({
      id: createId("ast"),
      brandId,
      category: "GENERATED_REPORT",
      title: report.title,
      description: report.summary,
      sourceName: "绯荤粺鐢熸垚",
      fileUrl: sourceUrl,
      metadataJson: {
        kind: "BRAND_GROWTH_REPORT",
        generatedAt,
        taskId,
        mediaId,
        summary: report.summary,
        diagnosis: report.diagnosis,
        opportunities: report.opportunities,
        nextActions: report.nextActions,
        reportMarkdown: report.reportMarkdown,
        htmlContent: report.htmlContent,
        metrics: report.metrics,
      },
    });
  }

  private async updateGrowthReportTaskStatus(
    brandId: string,
    taskId: string,
    patch: {
      taskStatus: GrowthReportTaskRecord["taskStatus"];
      startedAt?: string;
      finishedAt?: string;
      errorMessage?: string;
      outputJson?: Record<string, unknown>;
    },
  ) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          taskStatus: patch.taskStatus as TaskStatus,
          startedAt: patch.startedAt ? new Date(patch.startedAt) : undefined,
          finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : undefined,
          errorMessage: patch.errorMessage !== undefined ? patch.errorMessage || null : undefined,
          outputJson: patch.outputJson ? patch.outputJson as Prisma.InputJsonValue : undefined,
        },
      });
      return;
    }

    const task = database.tasks.find((item) => item.id === taskId && item.brandId === brandId);
    if (!task) {
      return;
    }

    task.taskStatus = patch.taskStatus;
    task.updatedAt = new Date().toISOString();
    if (patch.startedAt !== undefined) {
      task.startedAt = patch.startedAt;
    }
    if (patch.finishedAt !== undefined) {
      task.finishedAt = patch.finishedAt;
    }
    if (patch.errorMessage !== undefined) {
      task.errorMessage = patch.errorMessage || undefined;
    }
    if (patch.outputJson) {
      task.outputJson = patch.outputJson;
    }
  }

  private async updateOpportunityInsightTaskStatus(
    brandId: string,
    taskId: string,
    patch: {
      taskStatus: OpportunityInsightTaskRecord["taskStatus"];
      startedAt?: string;
      finishedAt?: string;
      errorMessage?: string;
      outputJson?: Record<string, unknown>;
    },
  ) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          taskStatus: patch.taskStatus as TaskStatus,
          startedAt: patch.startedAt ? new Date(patch.startedAt) : undefined,
          finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : undefined,
          errorMessage: patch.errorMessage !== undefined ? patch.errorMessage || null : undefined,
          outputJson: patch.outputJson ? patch.outputJson as Prisma.InputJsonValue : undefined,
        },
      });
      return;
    }

    const task = database.tasks.find((item) => item.id === taskId && item.brandId === brandId);
    if (!task) {
      return;
    }

    task.taskStatus = patch.taskStatus;
    task.updatedAt = new Date().toISOString();
    if (patch.startedAt !== undefined) {
      task.startedAt = patch.startedAt;
    }
    if (patch.finishedAt !== undefined) {
      task.finishedAt = patch.finishedAt;
    }
    if (patch.errorMessage !== undefined) {
      task.errorMessage = patch.errorMessage || undefined;
    }
    if (patch.outputJson) {
      task.outputJson = patch.outputJson;
    }
  }

  private async persistOpportunityInsightResult(
    brandId: string,
    taskId: string,
    stepKey: OpportunityInsightStepKey,
    report: OpportunityInsightAccountModelResult & { htmlBody: string; htmlDocument: string },
    generatedAt: string,
  ) {
    const fileName = this.buildOpportunityInsightFileName(taskId, stepKey);
    const titleMap: Record<OpportunityInsightStepKey, string> = {
      brandAccountAnalysis: "品牌账号分析",
      competitorAccountAnalysis: "竞品账号分析",
      commentInsightAnalysis: "评论洞察分析",
      finalOpportunityReport: "机会洞察总报告",
    };

    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { ownerUserId: true },
      });
      if (!brand) {
        throw new NotFoundException("品牌不存在");
      }

      const storageKey = this.buildReportAssetStorageKey(brandId, fileName);
      const sourceUrl = this.buildReportAssetUrl(brandId, fileName);
      await this.persistReportHtml(storageKey, report.htmlDocument);
      const media = await this.prismaService.mediaAsset.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskId,
          title: report.title,
          mediaType: MediaType.HTML,
          storageKey,
          sourceUrl,
          mimeType: "text/html",
          metadataJson: {
            kind: "OPPORTUNITY_INSIGHT_REPORT",
            generatedAt,
            summary: report.summary,
            stepKey,
          } as Prisma.InputJsonValue,
        },
      });
      const asset = await this.prismaService.businessAsset.create({
        data: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
          title: report.title,
          description: report.summary,
          fileUrl: media.sourceUrl,
          metadataJson: {
            kind: "OPPORTUNITY_INSIGHT_REPORT",
            generatedAt,
            taskId,
            mediaId: media.id,
            stepKey,
            summary: report.summary,
            htmlBody: report.htmlBody,
            htmlDocument: report.htmlDocument,
            modelName: report.modelName,
            stepLabel: titleMap[stepKey],
          } as Prisma.InputJsonValue,
        },
      });
      return asset.id;
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("品牌不存在");
    }

    const mediaId = createId("med");
    const storageKey = this.buildReportAssetStorageKey(brandId, fileName);
    const sourceUrl = this.buildReportAssetUrl(brandId, fileName);
    await this.persistReportHtml(storageKey, report.htmlDocument);
    database.media.unshift({
      id: mediaId,
      userId: brand.ownerUserId,
      brandId,
      taskId,
      title: report.title,
      mediaType: "HTML",
      sourceUrl,
      storageKey,
      mimeType: "text/html",
      createdAt: generatedAt,
      updatedAt: generatedAt,
    });

    const assetId = createId("ast");
    database.assets.unshift({
      id: assetId,
      brandId,
      category: "GENERATED_REPORT",
      title: report.title,
      description: report.summary,
      sourceName: "系统生成",
      fileUrl: sourceUrl,
      metadataJson: {
        kind: "OPPORTUNITY_INSIGHT_REPORT",
        generatedAt,
        taskId,
        mediaId,
        stepKey,
        summary: report.summary,
        htmlBody: report.htmlBody,
        htmlDocument: report.htmlDocument,
        modelName: report.modelName,
        stepLabel: titleMap[stepKey],
      },
    });
    return assetId;
  }

  private async persistXiaohongshuMarketingPlanResult(
    brandId: string,
    taskId: string,
    sourceReport: GrowthReportRecord,
    opportunityReport: OpportunityInsightReportRecord,
    report: Awaited<ReturnType<ReportsService["buildXiaohongshuMarketingPlan"]>>,
    generatedAt: string,
  ) {
    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { ownerUserId: true },
      });
      if (!brand) {
        throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
      }

      const fileName = this.buildXiaohongshuMarketingPlanFileName(taskId);
      const storageKey = this.buildReportAssetStorageKey(brandId, fileName);
      const sourceUrl = this.buildReportAssetUrl(brandId, fileName);
      await this.persistReportHtml(storageKey, report.htmlContent);

      const media = await this.prismaService.mediaAsset.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskId,
          title: report.title,
          mediaType: MediaType.HTML,
          storageKey,
          sourceUrl,
          mimeType: "text/html",
          metadataJson: {
            kind: "XHS_MARKETING_PLAN",
            generatedAt,
            summary: report.summary,
          } as Prisma.InputJsonValue,
        },
      });

      await this.prismaService.businessAsset.create({
        data: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
          title: report.title,
          description: report.summary,
          fileUrl: media.sourceUrl,
          metadataJson: {
            kind: "XHS_MARKETING_PLAN",
            generatedAt,
            taskId,
            mediaId: media.id,
            sourceReportId: sourceReport.id,
            sourceReportTitle: sourceReport.title,
            sourceOpportunityReportId: opportunityReport.id,
            sourceOpportunityReportTitle: opportunityReport.title,
            summary: report.summary,
            reportMarkdown: report.reportMarkdown,
            htmlContent: report.htmlContent,
            modelName: report.modelName,
          } as Prisma.InputJsonValue,
        },
      });
      return;
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
    }

    const mediaId = createId("med");
    const fileName = this.buildXiaohongshuMarketingPlanFileName(taskId);
    const storageKey = this.buildReportAssetStorageKey(brandId, fileName);
    const sourceUrl = this.buildReportAssetUrl(brandId, fileName);
    await this.persistReportHtml(storageKey, report.htmlContent);

    database.media.unshift({
      id: mediaId,
      userId: brand.ownerUserId,
      brandId,
      taskId,
      title: report.title,
      mediaType: "HTML",
      sourceUrl,
      storageKey,
      mimeType: "text/html",
      createdAt: generatedAt,
      updatedAt: generatedAt,
    });

    database.assets.unshift({
      id: createId("ast"),
      brandId,
      category: "GENERATED_REPORT",
      title: report.title,
      description: report.summary,
      sourceName: "绯荤粺鐢熸垚",
      fileUrl: sourceUrl,
      metadataJson: {
        kind: "XHS_MARKETING_PLAN",
        generatedAt,
        taskId,
        mediaId,
        sourceReportId: sourceReport.id,
        sourceReportTitle: sourceReport.title,
        sourceOpportunityReportId: opportunityReport.id,
        sourceOpportunityReportTitle: opportunityReport.title,
        summary: report.summary,
        reportMarkdown: report.reportMarkdown,
        htmlContent: report.htmlContent,
        modelName: report.modelName,
      },
    });
  }

  private async persistDouyinMarketingPlanResult(
    brandId: string,
    taskId: string,
    sourceReport: GrowthReportRecord,
    opportunityReport: OpportunityInsightReportRecord,
    report: Awaited<ReturnType<ReportsService["buildDouyinMarketingPlan"]>>,
    generatedAt: string,
  ) {
    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { ownerUserId: true },
      });
      if (!brand) {
        throw new NotFoundException("品牌不存在");
      }

      const fileName = this.buildDouyinMarketingPlanFileName(taskId);
      const storageKey = this.buildReportAssetStorageKey(brandId, fileName);
      const sourceUrl = this.buildReportAssetUrl(brandId, fileName);
      await this.persistReportHtml(storageKey, report.htmlContent);

      const media = await this.prismaService.mediaAsset.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskId,
          title: report.title,
          mediaType: MediaType.HTML,
          storageKey,
          sourceUrl,
          mimeType: "text/html",
          metadataJson: {
            kind: "DOUYIN_MARKETING_PLAN",
            generatedAt,
            summary: report.summary,
          } as Prisma.InputJsonValue,
        },
      });

      await this.prismaService.businessAsset.create({
        data: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
          title: report.title,
          description: report.summary,
          fileUrl: media.sourceUrl,
          metadataJson: {
            kind: "DOUYIN_MARKETING_PLAN",
            generatedAt,
            taskId,
            mediaId: media.id,
            sourceReportId: sourceReport.id,
            sourceReportTitle: sourceReport.title,
            sourceOpportunityReportId: opportunityReport.id,
            sourceOpportunityReportTitle: opportunityReport.title,
            summary: report.summary,
            reportMarkdown: report.reportMarkdown,
            htmlContent: report.htmlContent,
            modelName: report.modelName,
          } as Prisma.InputJsonValue,
        },
      });
      return;
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("品牌不存在");
    }

    const mediaId = createId("med");
    const fileName = this.buildDouyinMarketingPlanFileName(taskId);
    const storageKey = this.buildReportAssetStorageKey(brandId, fileName);
    const sourceUrl = this.buildReportAssetUrl(brandId, fileName);
    await this.persistReportHtml(storageKey, report.htmlContent);

    database.media.unshift({
      id: mediaId,
      userId: brand.ownerUserId,
      brandId,
      taskId,
      title: report.title,
      mediaType: "HTML",
      sourceUrl,
      storageKey,
      mimeType: "text/html",
      createdAt: generatedAt,
      updatedAt: generatedAt,
    });

    database.assets.unshift({
      id: createId("ast"),
      brandId,
      category: "GENERATED_REPORT",
      title: report.title,
      description: report.summary,
      sourceName: "系统生成",
      fileUrl: sourceUrl,
      metadataJson: {
        kind: "DOUYIN_MARKETING_PLAN",
        generatedAt,
        taskId,
        mediaId,
        sourceReportId: sourceReport.id,
        sourceReportTitle: sourceReport.title,
        sourceOpportunityReportId: opportunityReport.id,
        sourceOpportunityReportTitle: opportunityReport.title,
        summary: report.summary,
        reportMarkdown: report.reportMarkdown,
        htmlContent: report.htmlContent,
        modelName: report.modelName,
      },
    });
  }

  private async persistDouyinHotTopicCandidatesResult(
    brandId: string,
    taskId: string,
    report: Awaited<ReturnType<ReportsService["buildDouyinHotTopicCandidates"]>>,
    generatedAt: string,
  ) {
    if (await this.prismaService.canUseDatabase()) {
      await this.prismaService.businessAsset.create({
        data: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
          title: report.title,
          description: report.summary,
          metadataJson: {
            kind: "DOUYIN_HOT_TOPIC_CANDIDATES",
            generatedAt,
            taskId,
            summary: report.summary,
            selectedDate: report.selectedDate,
            items: report.items,
            modelName: report.modelName,
            reportContent: report.reportContent,
          } as Prisma.InputJsonValue,
        },
      });
      return;
    }

    database.assets.unshift({
      id: createId("ast"),
      brandId,
      category: "GENERATED_REPORT",
      title: report.title,
      description: report.summary,
      sourceName: "系统生成",
      fileUrl: undefined,
      metadataJson: {
        kind: "DOUYIN_HOT_TOPIC_CANDIDATES",
        generatedAt,
        taskId,
        summary: report.summary,
        selectedDate: report.selectedDate,
        items: report.items,
        modelName: report.modelName,
        reportContent: report.reportContent,
      },
    });
  }

  private async persistDouyinOriginalCopyResult(
    brandId: string,
    taskId: string,
    report: Awaited<ReturnType<ReportsService["buildDouyinOriginalCopy"]>>,
    generatedAt: string,
  ) {
    if (await this.prismaService.canUseDatabase()) {
      await this.prismaService.businessAsset.create({
        data: {
          brandId,
          category: AssetCategory.GENERATED_CONTENT,
          title: report.title,
          description: report.summary,
          metadataJson: {
            kind: "DOUYIN_ORIGINAL_COPY",
            generatedAt,
            taskId,
            summary: report.summary,
            copyType: report.copyType,
            copyTypeLabel: report.copyTypeLabel,
            content: report.content,
            topicId: report.topicId,
            topicTitle: report.topicTitle,
            topicContent: report.topicContent,
            topicDescription: report.topicDescription,
            calendarItemId: report.calendarItemId,
            calendarItemLabel: report.calendarItemLabel,
            injectMarketingPlan: report.injectMarketingPlan,
            marketingPlanTitle: report.marketingPlanTitle,
            userRequirement: report.userRequirement,
            modelName: report.modelName,
          } as Prisma.InputJsonValue,
        },
      });
      return;
    }

    database.assets.unshift({
      id: createId("ast"),
      brandId,
      category: "GENERATED_CONTENT",
      title: report.title,
      description: report.summary,
      sourceName: "系统生成",
      fileUrl: undefined,
      metadataJson: {
        kind: "DOUYIN_ORIGINAL_COPY",
        generatedAt,
        taskId,
        summary: report.summary,
        copyType: report.copyType,
        copyTypeLabel: report.copyTypeLabel,
        content: report.content,
        topicId: report.topicId,
        topicTitle: report.topicTitle,
        topicContent: report.topicContent,
        topicDescription: report.topicDescription,
        calendarItemId: report.calendarItemId,
        calendarItemLabel: report.calendarItemLabel,
        injectMarketingPlan: report.injectMarketingPlan,
        marketingPlanTitle: report.marketingPlanTitle,
        userRequirement: report.userRequirement,
        modelName: report.modelName,
      } satisfies DouyinOriginalCopyAssetMeta,
    });
  }

  private async persistDouyinRemixCopyResult(
    brandId: string,
    taskId: string,
    report: Awaited<ReturnType<ReportsService["buildDouyinRemixCopy"]>>,
    generatedAt: string,
  ) {
    if (await this.prismaService.canUseDatabase()) {
      await this.prismaService.businessAsset.create({
        data: {
          brandId,
          category: AssetCategory.GENERATED_CONTENT,
          title: report.title,
          description: report.summary,
          metadataJson: {
            kind: "DOUYIN_REMIX_COPY",
            generatedAt,
            taskId,
            summary: report.summary,
            content: report.content,
            sourceMaterialId: report.sourceMaterialId,
            sourceMaterialTitle: report.sourceMaterialTitle,
            sourceVideoUrl: report.sourceVideoUrl,
            sourceAuthorName: report.sourceAuthorName,
            sourceWorkUrl: report.sourceWorkUrl,
            injectBrandProfile: report.injectBrandProfile,
            injectMarketingPlan: report.injectMarketingPlan,
            marketingPlanTitle: report.marketingPlanTitle,
            productId: report.productId,
            productName: report.productName,
            userRequirement: report.userRequirement,
            extractedCopy: report.extractedCopy,
            introBreakdown: report.introBreakdown,
            bodyBreakdown: report.bodyBreakdown,
            outroBreakdown: report.outroBreakdown,
            modelName: report.modelName,
          } as Prisma.InputJsonValue,
        },
      });
      return;
    }

    database.assets.unshift({
      id: createId("ast"),
      brandId,
      category: "GENERATED_CONTENT",
      title: report.title,
      description: report.summary,
      sourceName: "系统生成",
      fileUrl: undefined,
      metadataJson: {
        kind: "DOUYIN_REMIX_COPY",
        generatedAt,
        taskId,
        summary: report.summary,
        content: report.content,
        sourceMaterialId: report.sourceMaterialId,
        sourceMaterialTitle: report.sourceMaterialTitle,
        sourceVideoUrl: report.sourceVideoUrl,
        sourceAuthorName: report.sourceAuthorName,
        sourceWorkUrl: report.sourceWorkUrl,
        injectBrandProfile: report.injectBrandProfile,
        injectMarketingPlan: report.injectMarketingPlan,
        marketingPlanTitle: report.marketingPlanTitle,
        productId: report.productId,
        productName: report.productName,
        userRequirement: report.userRequirement,
        extractedCopy: report.extractedCopy,
        introBreakdown: report.introBreakdown,
        bodyBreakdown: report.bodyBreakdown,
        outroBreakdown: report.outroBreakdown,
        modelName: report.modelName,
      } satisfies DouyinRemixCopyAssetMeta,
    });
  }

  private async persistXiaohongshuMarketingCalendarResult(
    brandId: string,
    taskId: string,
    sourceReport: GrowthReportRecord,
    opportunityReport: OpportunityInsightReportRecord,
    report: Awaited<ReturnType<ReportsService["buildXiaohongshuMarketingCalendar"]>>,
    generatedAt: string,
  ) {
    const executionCapabilityInventory = this.buildMarketingCalendarExecutionCapabilityInventory(generatedAt);
    if (await this.prismaService.canUseDatabase()) {
      await this.prismaService.businessAsset.create({
        data: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
          title: report.title,
          description: report.summary,
          metadataJson: {
            kind: "XHS_MARKETING_CALENDAR",
            generatedAt,
            taskId,
            sourceReportId: sourceReport.id,
            sourceReportTitle: sourceReport.title,
            sourceOpportunityReportId: opportunityReport.id,
            sourceOpportunityReportTitle: opportunityReport.title,
            summary: report.summary,
            items: report.items,
            modelName: report.modelName,
            executionCapabilityInventory,
          } as Prisma.InputJsonValue,
        },
      });
      return;
    }

    database.assets.unshift({
      id: createId("ast"),
      brandId,
      category: "GENERATED_REPORT",
      title: report.title,
      description: report.summary,
      sourceName: "绯荤粺鐢熸垚",
      fileUrl: undefined,
      metadataJson: {
        kind: "XHS_MARKETING_CALENDAR",
        generatedAt,
        taskId,
        sourceReportId: sourceReport.id,
        sourceReportTitle: sourceReport.title,
        sourceOpportunityReportId: opportunityReport.id,
        sourceOpportunityReportTitle: opportunityReport.title,
        summary: report.summary,
        items: report.items,
        modelName: report.modelName,
        executionCapabilityInventory,
      },
    });
  }

  private async persistVisualGrowthReportResult(
    brandId: string,
    taskId: string,
    sourceReport: GrowthReportRecord,
    report: Awaited<ReturnType<ReportsService["buildVisualReport"]>>,
    generatedAt: string,
  ) {
    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { ownerUserId: true },
      });
      if (!brand) {
        throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
      }

      const fileName = this.buildVisualGrowthReportFileName(taskId);
      const storageKey = this.buildReportAssetStorageKey(brandId, fileName);
      const sourceUrl = this.buildReportAssetUrl(brandId, fileName);
      await this.persistReportHtml(storageKey, report.htmlDocument);

      const media = await this.prismaService.mediaAsset.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskId,
          title: report.title,
          mediaType: MediaType.HTML,
          storageKey,
          sourceUrl,
          mimeType: "text/html",
          metadataJson: {
            kind: "BRAND_GROWTH_VISUAL_REPORT",
            generatedAt,
            summary: report.summary,
          } as Prisma.InputJsonValue,
        },
      });

      await this.prismaService.businessAsset.create({
        data: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
          title: report.title,
          description: report.summary,
          fileUrl: media.sourceUrl,
          metadataJson: {
            kind: "BRAND_GROWTH_VISUAL_REPORT",
            generatedAt,
            taskId,
            mediaId: media.id,
            sourceReportId: sourceReport.id,
            sourceReportTitle: sourceReport.title,
            summary: report.summary,
            htmlBody: report.htmlBody,
            htmlDocument: report.htmlDocument,
          } as Prisma.InputJsonValue,
        },
      });
      return;
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
    }

    const mediaId = createId("med");
    const fileName = this.buildVisualGrowthReportFileName(taskId);
    const storageKey = this.buildReportAssetStorageKey(brandId, fileName);
    const sourceUrl = this.buildReportAssetUrl(brandId, fileName);
    await this.persistReportHtml(storageKey, report.htmlDocument);

    database.media.unshift({
      id: mediaId,
      userId: brand.ownerUserId,
      brandId,
      taskId,
      title: report.title,
      mediaType: "HTML",
      sourceUrl,
      storageKey,
      mimeType: "text/html",
      createdAt: generatedAt,
      updatedAt: generatedAt,
    });

    database.assets.unshift({
      id: createId("ast"),
      brandId,
      category: "GENERATED_REPORT",
      title: report.title,
      description: report.summary,
      sourceName: "绯荤粺鐢熸垚",
      fileUrl: sourceUrl,
      metadataJson: {
        kind: "BRAND_GROWTH_VISUAL_REPORT",
        generatedAt,
        taskId,
        mediaId,
        sourceReportId: sourceReport.id,
        sourceReportTitle: sourceReport.title,
        summary: report.summary,
        htmlBody: report.htmlBody,
        htmlDocument: report.htmlDocument,
      },
    });
  }

  private async persistAnnualMarketingPlanResult(
    brandId: string,
    taskId: string,
    sourceReport: GrowthReportRecord,
    plan: Awaited<ReturnType<ReportsService["buildAnnualMarketingPlan"]>>,
    generatedAt: string,
  ) {
    if (await this.prismaService.canUseDatabase()) {
      const brand = await this.prismaService.brand.findUnique({
        where: { id: brandId },
        select: { ownerUserId: true },
      });
      if (!brand) {
        throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
      }

      const fileName = this.buildAnnualMarketingPlanFileName(taskId);
      const storageKey = this.buildReportAssetStorageKey(brandId, fileName);
      const sourceUrl = this.buildReportAssetUrl(brandId, fileName);
      await this.persistReportHtml(storageKey, plan.htmlDocument);

      const media = await this.prismaService.mediaAsset.create({
        data: {
          userId: brand.ownerUserId,
          brandId,
          taskId,
          title: plan.title,
          mediaType: MediaType.HTML,
          storageKey,
          sourceUrl,
          mimeType: "text/html",
          metadataJson: {
            kind: CURRENT_HALF_YEAR_MARKETING_PLAN_ASSET_KIND,
            generatedAt,
            summary: plan.summary,
          } as Prisma.InputJsonValue,
        },
      });

      await this.prismaService.businessAsset.create({
        data: {
          brandId,
          category: AssetCategory.GENERATED_REPORT,
          title: plan.title,
          description: plan.summary,
          fileUrl: media.sourceUrl,
          metadataJson: {
            kind: CURRENT_HALF_YEAR_MARKETING_PLAN_ASSET_KIND,
            generatedAt,
            taskId,
            mediaId: media.id,
            sourceReportId: sourceReport.id,
            sourceReportTitle: sourceReport.title,
            summary: plan.summary,
            planningYear: plan.planningYear,
            planningFocus: plan.planningFocus,
            items: plan.items,
            htmlBody: plan.htmlBody,
            htmlDocument: plan.htmlDocument,
          } as Prisma.InputJsonValue,
        },
      });
      return;
    }

    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
    }

    const mediaId = createId("med");
    const fileName = this.buildAnnualMarketingPlanFileName(taskId);
    const storageKey = this.buildReportAssetStorageKey(brandId, fileName);
    const sourceUrl = this.buildReportAssetUrl(brandId, fileName);
    await this.persistReportHtml(storageKey, plan.htmlDocument);

    database.media.unshift({
      id: mediaId,
      userId: brand.ownerUserId,
      brandId,
      taskId,
      title: plan.title,
      mediaType: "HTML",
      sourceUrl,
      storageKey,
      mimeType: "text/html",
      createdAt: generatedAt,
      updatedAt: generatedAt,
    });

    database.assets.unshift({
      id: createId("ast"),
      brandId,
      category: "GENERATED_REPORT",
      title: plan.title,
      description: plan.summary,
      sourceName: "绯荤粺鐢熸垚",
      fileUrl: sourceUrl,
      metadataJson: {
        kind: CURRENT_HALF_YEAR_MARKETING_PLAN_ASSET_KIND,
        generatedAt,
        taskId,
        mediaId,
        sourceReportId: sourceReport.id,
        sourceReportTitle: sourceReport.title,
        summary: plan.summary,
        planningYear: plan.planningYear,
        planningFocus: plan.planningFocus,
        items: plan.items,
        htmlBody: plan.htmlBody,
        htmlDocument: plan.htmlDocument,
      },
    });
  }

  private async updateVisualGrowthReportTaskStatus(
    brandId: string,
    taskId: string,
    patch: {
      taskStatus: VisualGrowthReportTaskRecord["taskStatus"];
      startedAt?: string;
      finishedAt?: string;
      errorMessage?: string;
      outputJson?: Record<string, unknown>;
    },
  ) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          taskStatus: patch.taskStatus as TaskStatus,
          startedAt: patch.startedAt ? new Date(patch.startedAt) : undefined,
          finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : undefined,
          errorMessage: patch.errorMessage !== undefined ? patch.errorMessage || null : undefined,
          outputJson: patch.outputJson ? patch.outputJson as Prisma.InputJsonValue : undefined,
        },
      });
      return;
    }

    const task = database.tasks.find((item) => item.id === taskId && item.brandId === brandId);
    if (!task) {
      return;
    }

    task.taskStatus = patch.taskStatus;
    task.updatedAt = new Date().toISOString();
    if (patch.startedAt !== undefined) {
      task.startedAt = patch.startedAt;
    }
    if (patch.finishedAt !== undefined) {
      task.finishedAt = patch.finishedAt;
    }
    if (patch.errorMessage !== undefined) {
      task.errorMessage = patch.errorMessage || undefined;
    }
    if (patch.outputJson) {
      task.outputJson = patch.outputJson;
    }
  }

  private async updateAnnualMarketingPlanTaskStatus(
    brandId: string,
    taskId: string,
    patch: {
      taskStatus: AnnualMarketingPlanTaskRecord["taskStatus"];
      startedAt?: string;
      finishedAt?: string;
      errorMessage?: string;
      outputJson?: Record<string, unknown>;
    },
  ) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          taskStatus: patch.taskStatus as TaskStatus,
          startedAt: patch.startedAt ? new Date(patch.startedAt) : undefined,
          finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : undefined,
          errorMessage: patch.errorMessage !== undefined ? patch.errorMessage || null : undefined,
          outputJson: patch.outputJson ? patch.outputJson as Prisma.InputJsonValue : undefined,
        },
      });
      return;
    }

    const task = database.tasks.find((item) => item.id === taskId && item.brandId === brandId);
    if (!task) {
      return;
    }

    task.taskStatus = patch.taskStatus;
    task.updatedAt = new Date().toISOString();
    if (patch.startedAt !== undefined) {
      task.startedAt = patch.startedAt;
    }
    if (patch.finishedAt !== undefined) {
      task.finishedAt = patch.finishedAt;
    }
    if (patch.errorMessage !== undefined) {
      task.errorMessage = patch.errorMessage || undefined;
    }
    if (patch.outputJson) {
      task.outputJson = patch.outputJson;
    }
  }

  private async updateXiaohongshuMarketingPlanTaskStatus(
    brandId: string,
    taskId: string,
    patch: {
      taskStatus: XiaohongshuMarketingPlanTaskRecord["taskStatus"];
      startedAt?: string;
      finishedAt?: string;
      errorMessage?: string;
      outputJson?: Record<string, unknown>;
    },
  ) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          taskStatus: patch.taskStatus as TaskStatus,
          startedAt: patch.startedAt ? new Date(patch.startedAt) : undefined,
          finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : undefined,
          errorMessage: patch.errorMessage !== undefined ? patch.errorMessage || null : undefined,
          outputJson: patch.outputJson ? patch.outputJson as Prisma.InputJsonValue : undefined,
        },
      });
      return;
    }

    const task = database.tasks.find((item) => item.id === taskId && item.brandId === brandId);
    if (!task) {
      return;
    }

    task.taskStatus = patch.taskStatus;
    task.updatedAt = new Date().toISOString();
    if (patch.startedAt !== undefined) {
      task.startedAt = patch.startedAt;
    }
    if (patch.finishedAt !== undefined) {
      task.finishedAt = patch.finishedAt;
    }
    if (patch.errorMessage !== undefined) {
      task.errorMessage = patch.errorMessage || undefined;
    }
    if (patch.outputJson) {
      task.outputJson = patch.outputJson;
    }
  }

  private async updateDouyinMarketingPlanTaskStatus(
    brandId: string,
    taskId: string,
    patch: {
      taskStatus: DouyinMarketingPlanTaskRecord["taskStatus"];
      startedAt?: string;
      finishedAt?: string;
      errorMessage?: string;
      outputJson?: Record<string, unknown>;
    },
  ) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          taskStatus: patch.taskStatus as TaskStatus,
          startedAt: patch.startedAt ? new Date(patch.startedAt) : undefined,
          finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : undefined,
          errorMessage: patch.errorMessage !== undefined ? patch.errorMessage || null : undefined,
          outputJson: patch.outputJson ? patch.outputJson as Prisma.InputJsonValue : undefined,
        },
      });
      return;
    }

    const task = database.tasks.find((item) => item.id === taskId && item.brandId === brandId);
    if (!task) {
      return;
    }

    task.taskStatus = patch.taskStatus;
    task.updatedAt = new Date().toISOString();
    if (patch.startedAt !== undefined) {
      task.startedAt = patch.startedAt;
    }
    if (patch.finishedAt !== undefined) {
      task.finishedAt = patch.finishedAt;
    }
    if (patch.errorMessage !== undefined) {
      task.errorMessage = patch.errorMessage || undefined;
    }
    if (patch.outputJson) {
      task.outputJson = patch.outputJson;
    }
  }

  private async updateDouyinHotTopicCandidatesTaskStatus(
    brandId: string,
    taskId: string,
    patch: {
      taskStatus: DouyinHotTopicCandidatesTaskRecord["taskStatus"];
      startedAt?: string;
      finishedAt?: string;
      errorMessage?: string;
      outputJson?: Record<string, unknown>;
    },
  ) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          taskStatus: patch.taskStatus as TaskStatus,
          startedAt: patch.startedAt ? new Date(patch.startedAt) : undefined,
          finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : undefined,
          errorMessage: patch.errorMessage !== undefined ? patch.errorMessage || null : undefined,
          outputJson: patch.outputJson ? patch.outputJson as Prisma.InputJsonValue : undefined,
        },
      });
      return;
    }

    const task = database.tasks.find((item) => item.id === taskId && item.brandId === brandId);
    if (!task) {
      return;
    }

    task.taskStatus = patch.taskStatus;
    task.updatedAt = new Date().toISOString();
    if (patch.startedAt !== undefined) {
      task.startedAt = patch.startedAt;
    }
    if (patch.finishedAt !== undefined) {
      task.finishedAt = patch.finishedAt;
    }
    if (patch.errorMessage !== undefined) {
      task.errorMessage = patch.errorMessage || undefined;
    }
    if (patch.outputJson) {
      task.outputJson = patch.outputJson;
    }
  }

  private async updateDouyinOriginalCopyTaskStatus(
    brandId: string,
    taskId: string,
    patch: {
      taskStatus: DouyinOriginalCopyTaskRecord["taskStatus"];
      startedAt?: string;
      finishedAt?: string;
      errorMessage?: string;
      outputJson?: Record<string, unknown>;
    },
  ) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          taskStatus: patch.taskStatus as TaskStatus,
          startedAt: patch.startedAt ? new Date(patch.startedAt) : undefined,
          finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : undefined,
          errorMessage: patch.errorMessage !== undefined ? patch.errorMessage || null : undefined,
          outputJson: patch.outputJson ? patch.outputJson as Prisma.InputJsonValue : undefined,
        },
      });
      return;
    }

    const task = database.tasks.find((item) => item.id === taskId && item.brandId === brandId);
    if (!task) {
      return;
    }

    task.taskStatus = patch.taskStatus;
    task.updatedAt = new Date().toISOString();
    if (patch.startedAt !== undefined) {
      task.startedAt = patch.startedAt;
    }
    if (patch.finishedAt !== undefined) {
      task.finishedAt = patch.finishedAt;
    }
    if (patch.errorMessage !== undefined) {
      task.errorMessage = patch.errorMessage || undefined;
    }
    if (patch.outputJson) {
      task.outputJson = patch.outputJson;
    }
  }

  private async updateDouyinRemixCopyTaskStatus(
    brandId: string,
    taskId: string,
    patch: {
      taskStatus: DouyinRemixCopyTaskRecord["taskStatus"];
      startedAt?: string;
      finishedAt?: string;
      errorMessage?: string;
      outputJson?: Record<string, unknown>;
    },
  ) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          taskStatus: patch.taskStatus as TaskStatus,
          startedAt: patch.startedAt ? new Date(patch.startedAt) : undefined,
          finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : undefined,
          errorMessage: patch.errorMessage !== undefined ? patch.errorMessage || null : undefined,
          outputJson: patch.outputJson ? patch.outputJson as Prisma.InputJsonValue : undefined,
        },
      });
      return;
    }

    const task = database.tasks.find((item) => item.id === taskId && item.brandId === brandId);
    if (!task) {
      return;
    }

    task.taskStatus = patch.taskStatus;
    task.updatedAt = new Date().toISOString();
    if (patch.startedAt !== undefined) {
      task.startedAt = patch.startedAt;
    }
    if (patch.finishedAt !== undefined) {
      task.finishedAt = patch.finishedAt;
    }
    if (patch.errorMessage !== undefined) {
      task.errorMessage = patch.errorMessage || undefined;
    }
    if (patch.outputJson) {
      task.outputJson = patch.outputJson;
    }
  }

  private async updateXiaohongshuMarketingCalendarTaskStatus(
    brandId: string,
    taskId: string,
    patch: {
      taskStatus: XiaohongshuMarketingCalendarTaskRecord["taskStatus"];
      startedAt?: string;
      finishedAt?: string;
      errorMessage?: string;
      outputJson?: Record<string, unknown>;
    },
  ) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      await this.prismaService.task.update({
        where: { id: taskId },
        data: {
          taskStatus: patch.taskStatus as TaskStatus,
          startedAt: patch.startedAt ? new Date(patch.startedAt) : undefined,
          finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : undefined,
          errorMessage: patch.errorMessage !== undefined ? patch.errorMessage || null : undefined,
          outputJson: patch.outputJson ? patch.outputJson as Prisma.InputJsonValue : undefined,
        },
      });
      return;
    }

    const task = database.tasks.find((item) => item.id === taskId && item.brandId === brandId);
    if (!task) {
      return;
    }

    task.taskStatus = patch.taskStatus;
    task.updatedAt = new Date().toISOString();
    if (patch.startedAt !== undefined) {
      task.startedAt = patch.startedAt;
    }
    if (patch.finishedAt !== undefined) {
      task.finishedAt = patch.finishedAt;
    }
    if (patch.errorMessage !== undefined) {
      task.errorMessage = patch.errorMessage || undefined;
    }
    if (patch.outputJson) {
      task.outputJson = patch.outputJson;
    }
  }

  private async findTaskInputMeta(brandId: string, taskId: string) {
    if (await this.prismaService.canUseDatabase()) {
      const task = await this.prismaService.task.findFirst({
        where: {
          id: taskId,
          brandId,
        },
        select: {
          inputJson: true,
        },
      });
      return this.asMeta(task?.inputJson);
    }

    const task = database.tasks.find((item) => item.id === taskId && item.brandId === brandId);
    return this.asMeta(task?.inputJson);
  }

  private normalizeOpportunityInsightSupplementInput(value?: string) {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized ? this.truncateText(normalized, 60000) : undefined;
  }

  private normalizeMarketingPlanUserRequirement(value?: string) {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized ? this.truncateText(normalized, 1200) : undefined;
  }

  private hasUsableMarketingCalendarGrowthReport(report?: GrowthReportRecord | null) {
    if (!report) {
      return false;
    }
    if (
      !report.reportMarkdown?.trim()
      && !report.htmlContent?.trim()
    ) {
      return false;
    }
    return Boolean(
      report.summary?.trim()
      || report.diagnosis.length
      || report.opportunities.length
      || report.nextActions.length,
    );
  }

  private hasUsableMarketingCalendarOpportunityReport(report?: OpportunityInsightReportRecord | null) {
    return Boolean(report?.htmlDocument?.trim());
  }

  private resolveMarketingCalendarSourceReports(
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>,
    options: {
      generatedAt: string;
      sourceReport?: GrowthReportRecord | null;
      opportunityReport?: OpportunityInsightReportRecord | null;
    },
  ) {
    const sourceReport = this.hasUsableMarketingCalendarGrowthReport(options.sourceReport)
      ? options.sourceReport!
      : this.buildMarketingCalendarFallbackGrowthReport(archive, options.generatedAt);
    const opportunityReport = this.hasUsableMarketingCalendarOpportunityReport(options.opportunityReport)
      ? options.opportunityReport!
      : this.buildMarketingCalendarFallbackOpportunityReport(archive, options.generatedAt);
    return {
      sourceReport,
      opportunityReport,
    };
  }

  private buildMarketingCalendarFallbackGrowthReport(
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>,
    generatedAt: string,
  ): GrowthReportRecord {
    const brandName = String(archive.brand.brandName || "").trim() || "当前品牌";
    const brandDescription = String(archive.brand.brandDescription || archive.brand.enterpriseIntro || "").trim();
    const productNames = archive.products
      .map((item) => String(item.productName || "").trim())
      .filter(Boolean)
      .slice(0, 5);
    const productLine = productNames.length ? productNames.join("、") : "待补充产品资料";
    const summary = productNames.length
      ? `当前先基于品牌背景与 ${productLine} 等产品资料直接生成首版每日营销选题，后续补齐增长报告后仍可继续迭代。`
      : "当前先基于已有品牌背景资料直接生成首版每日营销选题，后续补齐产品与增长报告后仍可继续迭代。";
    const diagnosis = [
      brandDescription ? "品牌背景资料已具备基础信息，可先围绕现有定位输出首版排期。" : "品牌背景资料仍偏少，首版日历会以已有品牌名和平台定位做保守生成。",
      productNames.length
        ? `当前已录入 ${productNames.length} 个产品，可优先围绕 ${productNames.slice(0, 3).join("、")} 安排 7 天营销主题。`
        : "当前产品资料仍较少，建议后续补齐核心产品卖点与使用场景。",
      "本次不再强依赖已完成的品牌增长报告，支持直接先生成可执行的每日营销选题。",
    ];
    const opportunities = [
      productNames.length
        ? `围绕 ${productNames[0]} 等核心产品，优先铺设种草、转化和节日节点的连续选题。`
        : "围绕品牌定位、门店场景或服务特色，先建立连续 7 天的主题内容节奏。",
      "优先沉淀各平台当天可直接执行的话题、标题建议和关键词，缩短人工排期时间。",
      "在首版日历跑通后，再结合后续增长报告与机会洞察继续细化内容表现预期。",
    ];
    const nextActions = [
      "先生成首版未来 7 天营销日历，快速进入执行节奏。",
      "补齐品牌增长报告与机会洞察总报告，供下一轮排期迭代使用。",
      productNames.length ? "继续补充产品卖点、使用场景和人群差异，提升各平台选题精准度。" : "继续补充产品资料与品牌背景，提升后续排期质量。",
    ];
    const reportMarkdown = [
      `# ${brandName} 首版营销日历前置摘要`,
      "",
      "## 摘要",
      summary,
      "",
      "## 当前已知品牌信息",
      brandDescription || "品牌背景资料待补充，当前仅基于已有品牌基础信息生成。",
      productNames.length ? `当前产品：${productLine}` : "当前产品：待补充",
      "",
      "## 当前诊断",
      ...diagnosis.map((item) => `- ${item}`),
      "",
      "## 当前机会",
      ...opportunities.map((item) => `- ${item}`),
      "",
      "## 下一步动作",
      ...nextActions.map((item) => `- ${item}`),
    ].join("\n");
    return {
      id: `fallback-growth-${createHash("sha1").update(`${brandName}:${generatedAt}:calendar`).digest("hex").slice(0, 12)}`,
      title: `${brandName} 首版营销日历前置摘要`,
      summary,
      generatedAt,
      reportMarkdown,
      htmlContent: this.renderMarkdownToHtml(reportMarkdown),
      diagnosis,
      opportunities,
      nextActions,
      metrics: {
        productCount: archive.products.length,
        platformAccountCount: 0,
        competitorAccountCount: 0,
        brandNoteCount: 0,
        benchmarkNoteCount: 0,
      },
    };
  }

  private buildMarketingCalendarFallbackOpportunityReport(
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>,
    generatedAt: string,
  ): OpportunityInsightReportRecord {
    const brandName = String(archive.brand.brandName || "").trim() || "当前品牌";
    const brandDescription = String(archive.brand.brandDescription || archive.brand.enterpriseIntro || "").trim();
    const productNames = archive.products
      .map((item) => String(item.productName || "").trim())
      .filter(Boolean)
      .slice(0, 5);
    const summary = productNames.length
      ? `当前基于品牌背景与 ${productNames.join("、")} 等产品资料，补出一份轻量机会洞察摘要，支撑首版营销日历直接生成。`
      : "当前基于已有品牌背景资料，补出一份轻量机会洞察摘要，支撑首版营销日历直接生成。";
    const markdown = [
      `# ${brandName} 首版机会洞察摘要`,
      "",
      "## 当前已知品牌信息",
      brandDescription || "品牌背景资料待补充，当前仅基于已有品牌基础信息推导。",
      productNames.length ? `当前产品：${productNames.join("、")}` : "当前产品：待补充",
      "",
      "## 轻量机会判断",
      "- 优先围绕品牌最容易成交或最容易引发讨论的核心产品安排连续 7 天主题。",
      "- 先把节日、场景、产品卖点和平台表现形式做成当天即可执行的选题清单。",
      "- 后续补齐更完整的机会洞察总报告后，再继续细化账号角色、预期数据和转化动作。",
    ].join("\n");
    const htmlDocument = this.renderMarkdownToHtml(markdown);
    return {
      id: `fallback-opportunity-${createHash("sha1").update(`${brandName}:${generatedAt}:opportunity`).digest("hex").slice(0, 12)}`,
      title: `${brandName} 首版机会洞察摘要`,
      summary,
      generatedAt,
      htmlBody: htmlDocument,
      htmlDocument,
      stepKey: "finalOpportunityReport",
    };
  }

  private hasBrandBackgroundInput(archive: Awaited<ReturnType<BrandsService["getArchive"]>>) {
    return Boolean(
      archive.brand.brandName?.trim()
      || archive.brand.brandDescription?.trim()
      || archive.brand.enterpriseIntro?.trim(),
    );
  }

  private hasProductLibraryInput(archive: Awaited<ReturnType<BrandsService["getArchive"]>>) {
    return archive.products.length > 0;
  }

  private readOpportunityInsightUserRequirement(inputPayload: Record<string, unknown>) {
    return this.truncateText(
      this.readRecordString(this.readNestedRecord(inputPayload, ["inputScope", "userRequirement"]), "text") || "",
      1200,
    );
  }

  private async buildReport(params: {
    brandId: string;
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>;
    collection: Awaited<ReturnType<CollectorsService["getXiaohongshuWorkspace"]>>;
    opportunityInsightWorkspace: OpportunityInsightWorkspace;
    generatedAt: string;
  }) {
    const prompt = await this.loadGrowthAnalysisSkillPrompt();
    const inputPayload = this.buildGrowthAnalysisInput(
      params.archive,
      params.collection,
      params.opportunityInsightWorkspace,
      params.generatedAt,
    );
    const modelResult = await this.generateReportByModel(params.brandId, prompt, inputPayload);
    const metrics = {
      productCount: params.archive.products.length,
      platformAccountCount: params.collection.brandAccounts.length,
      competitorAccountCount: params.collection.competitorAccounts.length,
      brandNoteCount: params.collection.brandNotes.length,
      benchmarkNoteCount: params.collection.benchmarkNotes.length,
    };
    const htmlContent = this.renderMarkdownToHtml(modelResult.reportMarkdown);

    return {
      title: modelResult.title || `${params.archive.brand.brandName}鍝佺墝澧為暱鎶ュ憡`,
      summary: modelResult.summary,
      diagnosis: modelResult.diagnosis,
      opportunities: modelResult.opportunities,
      nextActions: modelResult.nextActions,
      reportMarkdown: modelResult.reportMarkdown,
      metrics,
      htmlContent,
    };
  }

  private async buildVisualReport(params: {
    brandId: string;
    sourceReport: GrowthReportRecord;
    generatedAt: string;
  }) {
    const settings = await this.loadVisualReportGenerationSettings(params.brandId);
    const prompt = this.loadVisualReportSkillPrompt(settings);
    const inputPayload = this.buildVisualReportInput(params.sourceReport, params.generatedAt);
    const outline = await this.generateVisualReportByModel(prompt, inputPayload, settings);
    const modelResult = this.renderVisualOutlineToResult(outline);
    const htmlDocument = this.buildVisualReportDocument(modelResult.title, modelResult.htmlBody);

    return {
      title: modelResult.title || `${params.sourceReport.title}可视化报告`,
      summary: modelResult.summary,
      htmlBody: modelResult.htmlBody,
      htmlDocument,
    };
  }

  private async buildAnnualMarketingPlan(params: {
    brandId: string;
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>;
    sourceReport: GrowthReportRecord;
    generatedAt: string;
    userRequirement?: string;
  }) {
    const settings = await this.loadAnnualMarketingPlanGenerationSettings(params.brandId);
    const prompt = this.loadAnnualMarketingPlanPrompt(settings);
    const inputPayload = this.buildAnnualMarketingPlanInput(
      params.archive,
      params.sourceReport,
      params.generatedAt,
      params.userRequirement,
    );
    const modelResult = await this.generateAnnualMarketingPlanByModel(prompt, inputPayload, settings);
    const htmlBody = this.renderAnnualMarketingPlanToHtml(modelResult);
    const htmlDocument = this.buildVisualReportDocument(modelResult.title, htmlBody);

    return {
      ...modelResult,
      htmlBody,
      htmlDocument,
    };
  }

  private async buildXiaohongshuMarketingPlan(params: {
    brandId: string;
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>;
    collection: Awaited<ReturnType<CollectorsService["getXiaohongshuWorkspace"]>>;
    sourceReport: GrowthReportRecord;
    opportunityReport: OpportunityInsightReportRecord;
    generatedAt: string;
    userRequirement?: string;
    onPhaseUpdate?: (
      phase: XiaohongshuMarketingPlanPhase,
      extra?: {
        modelName?: string;
        detailText?: string;
      },
    ) => Promise<void>;
  }) {
    const settings = await this.loadXiaohongshuMarketingPlanGenerationSettings(params.brandId);
    const skillPrompt = await this.loadXiaohongshuMarketingSkillMarkdown();
    const inputPayload = this.buildXiaohongshuMarketingPlanInput(
      params.archive,
      params.collection,
      params.sourceReport,
      params.opportunityReport,
      params.generatedAt,
      params.userRequirement,
    );
    const knowledgeContext = await this.buildXiaohongshuMarketingPlanKnowledgeContext(settings, inputPayload);
    await params.onPhaseUpdate?.("PART_ONE");
    const firstPart = await this.generateXiaohongshuMarketingPlanSectionByModel(
      this.buildXiaohongshuMarketingPlanSystemPrompt(skillPrompt, settings, "PART_ONE"),
      this.buildXiaohongshuMarketingPlanUserPrompt(inputPayload, "PART_ONE", undefined, knowledgeContext),
      settings,
      {
        requiredHeadings: ["## 一、"],
        onAttemptUpdate: async (detailText) => {
          await params.onPhaseUpdate?.("PART_ONE", { detailText });
        },
      },
    );
    await params.onPhaseUpdate?.("PART_TWO");
    const secondPart = await this.generateXiaohongshuMarketingPlanSectionByModel(
      this.buildXiaohongshuMarketingPlanSystemPrompt(skillPrompt, settings, "PART_TWO"),
      this.buildXiaohongshuMarketingPlanUserPrompt(inputPayload, "PART_TWO", firstPart.markdown, knowledgeContext),
      settings,
      {
        requiredHeadings: ["## 二、"],
        onAttemptUpdate: async (detailText) => {
          await params.onPhaseUpdate?.("PART_TWO", { detailText });
        },
      },
    );
    await params.onPhaseUpdate?.("PART_THREE");
    const thirdPart = await this.generateXiaohongshuMarketingPlanSectionByModel(
      this.buildXiaohongshuMarketingPlanSystemPrompt(skillPrompt, settings, "PART_THREE"),
      this.buildXiaohongshuMarketingPlanUserPrompt(
        inputPayload,
        "PART_THREE",
        `${firstPart.markdown}\n\n${secondPart.markdown}`,
        knowledgeContext,
      ),
      settings,
      {
        requiredHeadings: ["## 三、"],
        onAttemptUpdate: async (detailText) => {
          await params.onPhaseUpdate?.("PART_THREE", { detailText });
        },
      },
    );
    await params.onPhaseUpdate?.("PART_FOUR");
    const fourthPart = await this.generateXiaohongshuMarketingPlanSectionByModel(
      this.buildXiaohongshuMarketingPlanSystemPrompt(skillPrompt, settings, "PART_FOUR"),
      this.buildXiaohongshuMarketingPlanUserPrompt(
        inputPayload,
        "PART_FOUR",
        `${firstPart.markdown}\n\n${secondPart.markdown}\n\n${thirdPart.markdown}`,
        knowledgeContext,
      ),
      settings,
      {
        requiredHeadings: ["## 四、"],
        onAttemptUpdate: async (detailText) => {
          await params.onPhaseUpdate?.("PART_FOUR", { detailText });
        },
      },
    );
    await params.onPhaseUpdate?.("PART_FIVE");
    const fifthPart = await this.generateXiaohongshuMarketingPlanSectionByModel(
      this.buildXiaohongshuMarketingPlanSystemPrompt(skillPrompt, settings, "PART_FIVE"),
      this.buildXiaohongshuMarketingPlanUserPrompt(
        inputPayload,
        "PART_FIVE",
        `${firstPart.markdown}\n\n${secondPart.markdown}\n\n${thirdPart.markdown}\n\n${fourthPart.markdown}`,
        knowledgeContext,
      ),
      settings,
      {
        requiredHeadings: ["## 五、"],
        onAttemptUpdate: async (detailText) => {
          await params.onPhaseUpdate?.("PART_FIVE", { detailText });
        },
      },
    );
    await params.onPhaseUpdate?.("MERGING");
    const modelResult = this.mergeXiaohongshuMarketingPlanSections(
      firstPart,
      secondPart,
      thirdPart,
      fourthPart,
      fifthPart,
      inputPayload,
    );
    return {
      ...modelResult,
      htmlContent: this.renderMarkdownToHtml(modelResult.reportMarkdown),
    };
  }

  private async buildDouyinMarketingPlan(params: {
    brandId: string;
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>;
    collection: Awaited<ReturnType<CollectorsService["getDouyinWorkspace"]>>;
    sourceReport: GrowthReportRecord;
    opportunityReport: OpportunityInsightReportRecord;
    generatedAt: string;
    userRequirement?: string;
    onPhaseUpdate?: (
      phase: DouyinMarketingPlanPhase,
      extra?: {
        modelName?: string;
        detailText?: string;
      },
    ) => Promise<void> | void;
  }) {
    const settings = await this.loadDouyinMarketingPlanGenerationSettings(params.brandId);
    const inputPayload = this.buildDouyinMarketingPlanInput(
      params.archive,
      params.collection,
      params.sourceReport,
      params.opportunityReport,
      params.generatedAt,
      params.userRequirement,
    );
    await params.onPhaseUpdate?.("GENERATING");
    const modelResult = await this.generateDouyinMarketingPlanByModel(settings.promptContent, inputPayload, settings, {
      onAttemptUpdate: async (detailText, modelName) => {
        await params.onPhaseUpdate?.("GENERATING", {
          detailText,
          modelName,
        });
      },
    });
    return {
      ...modelResult,
      htmlContent: this.renderMarkdownToHtml(modelResult.reportMarkdown),
    };
  }

  private async buildOpportunityInsightAccountReport(params: {
    brandId: string;
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>;
    xiaohongshuWorkspace: Awaited<ReturnType<CollectorsService["getXiaohongshuWorkspace"]>>;
    douyinWorkspace: Awaited<ReturnType<CollectorsService["getDouyinWorkspace"]>>;
    generatedAt: string;
    supplementInput?: string;
    stepKey: "brandAccountAnalysis" | "competitorAccountAnalysis";
    onAttemptUpdate?: (detailText: string, modelName: string) => Promise<void> | void;
  }) {
    const settings = await this.loadOpportunityInsightAccountGenerationSettings(
      params.brandId,
      params.stepKey === "brandAccountAnalysis"
        ? "opportunity-insight-brand-account-analysis"
        : "opportunity-insight-competitor-account-analysis",
      params.stepKey === "brandAccountAnalysis"
        ? "prompt_opportunity_insight_brand_account"
        : "prompt_opportunity_insight_competitor_account",
    );
    const inputPayload = this.buildOpportunityInsightStepOneInput(
      params.archive,
      params.xiaohongshuWorkspace,
      params.douyinWorkspace,
      params.generatedAt,
      params.stepKey,
      params.supplementInput,
    );
    const modelResult = await this.generateOpportunityInsightMarkdownByModel(
      settings.promptContent,
      inputPayload,
      settings,
      params.stepKey === "brandAccountAnalysis" ? "品牌账号分析" : "竞品账号分析",
      {
        onAttemptUpdate: params.onAttemptUpdate,
      },
    );
    const { htmlBody, htmlDocument } = this.buildOpportunityInsightHtmlResult(modelResult.title, modelResult.reportMarkdown);
    return {
      ...modelResult,
      htmlBody,
      htmlDocument,
    };
  }

  private async buildOpportunityInsightCommentReport(params: {
    brandId: string;
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>;
    douyinWorkspace: Awaited<ReturnType<CollectorsService["getDouyinWorkspace"]>>;
    generatedAt: string;
    supplementInput?: string;
    onAttemptUpdate?: (detailText: string, modelName: string) => Promise<void> | void;
  }) {
    const settings = await this.loadOpportunityInsightNarrativeGenerationSettings(
      params.brandId,
      "opportunity-insight-comment-analysis",
      "prompt_opportunity_insight_comment",
    );
    const inputPayload = this.buildOpportunityInsightStepTwoInput(
      params.archive,
      params.douyinWorkspace,
      params.generatedAt,
      params.supplementInput,
    );
    const knowledgeContext = await this.buildOpportunityInsightCommentKnowledgeContext(
      params.brandId,
      settings,
      inputPayload,
    );
    const effectiveCommentCount = this.readRecordNumber(
      this.readNestedRecord(inputPayload, ["inputScope", "douyinCommentData"]),
      "commentCount",
    ) || 0;
    if (!effectiveCommentCount && !knowledgeContext.trim()) {
      const brandName = params.archive.brand.brandName || "当前品牌";
      const reminderMarkdown = [
        `# ${brandName}评论洞察分析`,
        "",
        "## 当前资料状态",
        "",
        "需要在搜集数据-抖音-评论数据，采集评论数据；或在品牌资料库-企业知识库上传用户评论数据。",
        "",
        "## 当前结论",
        "",
        "- 当前抖音评论数据为空。",
        "- 企业知识库中也未召回到可用的评论相关内容。",
        "- 本次不报错中断，先返回提醒，等待补充资料后再重新生成评论洞察分析。",
      ].join("\n");
      const htmlBody = this.renderMarkdownToHtml(reminderMarkdown);
      return {
        title: `${brandName}评论洞察分析`,
        summary: "当前缺少评论数据，请先采集抖音评论或补充企业知识库中的评论资料。",
        reportMarkdown: reminderMarkdown,
        modelName: "NO_DATA_FALLBACK",
        htmlBody,
        htmlDocument: this.buildVisualReportDocument(`${brandName}评论洞察分析`, htmlBody),
      };
    }

    const modelResult = await this.generateOpportunityInsightNarrativeMarkdownByModel(
      settings.promptContent,
      inputPayload,
      settings,
      "评论洞察分析",
      {
        knowledgeContext,
        onAttemptUpdate: params.onAttemptUpdate,
        runtimeRequirements: [
          "报告必须重点提炼用户痛点、真实需求、购买障碍、使用场景、情绪倾向与高频原话。",
          "优先引用评论原文、评论互动、回复数和用户表达中的典型案例。",
          "如果评论样本偏少，必须明确标注样本不足，不得虚构评论。",
        ],
      },
    );
    const { htmlBody, htmlDocument } = this.buildOpportunityInsightHtmlResult(modelResult.title, modelResult.reportMarkdown);
    return {
      ...modelResult,
      htmlBody,
      htmlDocument,
    };
  }

  private async buildOpportunityInsightFinalReport(params: {
    brandId: string;
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>;
    workspace: OpportunityInsightWorkspace;
    generatedAt: string;
    supplementInput?: string;
    onAttemptUpdate?: (detailText: string, modelName: string) => Promise<void> | void;
  }) {
    const settings = await this.loadOpportunityInsightNarrativeGenerationSettings(
      params.brandId,
      "opportunity-insight-final-report",
      "prompt_opportunity_insight_final_report",
    );
    const inputPayload = this.buildOpportunityInsightStepThreeInput(
      params.archive,
      params.workspace,
      params.generatedAt,
      params.supplementInput,
    );
    const knowledgeContext = await this.buildOpportunityInsightFinalKnowledgeContext(
      params.brandId,
      settings,
      inputPayload,
    );
    const modelResult = await this.generateOpportunityInsightNarrativeMarkdownByModel(
      settings.promptContent,
      inputPayload,
      settings,
      "机会洞察总报告",
      {
        knowledgeContext,
        onAttemptUpdate: params.onAttemptUpdate,
        runtimeRequirements: [
          "报告必须围绕目标用户痛点及需求、品牌产品的差异化解法、典型使用场景、机会在哪里、如何用产品组合拳切入市场展开。",
          "所有关键判断必须有前序报告、评论样本、作品/笔记数据或品牌资料作为依据。",
          "必须给出品牌如何从接触、接受到离不开的典型场景演进。",
        ],
      },
    );
    const { htmlBody, htmlDocument } = this.buildOpportunityInsightHtmlResult(modelResult.title, modelResult.reportMarkdown);
    return {
      ...modelResult,
      htmlBody,
      htmlDocument,
    };
  }

  private async buildDouyinHotTopicCandidates(params: {
    brandId: string;
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>;
    dailyHotspots: Awaited<ReturnType<CollectorsService["getDailyHotspotWorkspace"]>>;
    generatedAt: string;
    onPhaseUpdate?: (
      phase: DouyinHotTopicCandidatesPhase,
      extra?: {
        modelName?: string;
        detailText?: string;
      },
    ) => Promise<void> | void;
  }) {
    const settings = await this.loadDouyinHotTopicCandidatesGenerationSettings(params.brandId);
    const inputPayload = this.buildDouyinHotTopicCandidatesInput(
      params.archive,
      params.dailyHotspots,
      params.generatedAt,
    );
    await params.onPhaseUpdate?.("GENERATING");
    return this.generateDouyinHotTopicCandidatesByModel(settings.promptContent, inputPayload, settings, {
      onAttemptUpdate: async (detailText, modelName) => {
        await params.onPhaseUpdate?.("GENERATING", {
          detailText,
          modelName,
        });
      },
    });
  }

  private async buildDouyinOriginalCopy(params: {
    brandId: string;
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>;
    topic?: {
      id: string;
      topicTitle?: string;
      topicContent: string;
      topicDescription?: string;
    };
    selectedCalendarItem?: XiaohongshuMarketingCalendarItem;
    marketingPlan?: DouyinMarketingPlanRecord;
    copyType: DouyinOriginalCopyType;
    injectMarketingPlan: boolean;
    userRequirement?: string;
    generatedAt: string;
    onPhaseUpdate?: (
      phase: DouyinOriginalCopyPhase,
      extra?: {
        modelName?: string;
        detailText?: string;
      },
    ) => Promise<void> | void;
  }) {
    const settings = await this.loadDouyinOriginalCopyGenerationSettings(params.brandId, params.copyType);
    const inputPayload = this.buildDouyinOriginalCopyInput(
      params.archive,
      params.topic,
      params.selectedCalendarItem,
      params.marketingPlan,
      params.copyType,
      params.injectMarketingPlan,
      params.userRequirement,
      params.generatedAt,
    );
    await params.onPhaseUpdate?.("GENERATING");
    return this.generateDouyinOriginalCopyByModel(settings.promptContent, inputPayload, settings, {
      onAttemptUpdate: async (detailText, modelName) => {
        await params.onPhaseUpdate?.("GENERATING", {
          detailText,
          modelName,
        });
      },
    });
  }

  private async buildDouyinRemixCopy(params: {
    brandId: string;
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>;
    material: DouyinRemixCopyMaterialOption;
    injectBrandProfile: boolean;
    product?: Awaited<ReturnType<BrandsService["getArchive"]>>["products"][number];
    marketingPlan?: DouyinMarketingPlanRecord;
    injectMarketingPlan: boolean;
    userRequirement?: string;
    generatedAt: string;
    onPhaseUpdate?: (
      phase: DouyinRemixCopyPhase,
      extra?: {
        modelName?: string;
        detailText?: string;
      },
    ) => Promise<void> | void;
  }) {
    await params.onPhaseUpdate?.("EXTRACTING");
    const extractedCopy = await this.extractDouyinMaterialCopyByMathMind(
      params.brandId,
      params.material.videoUrl,
      async (detailText) => {
        await params.onPhaseUpdate?.("EXTRACTING", { detailText });
      },
    );

    await params.onPhaseUpdate?.("ANALYZING");
    const breakdownSourcePayload = this.buildDouyinRemixBreakdownInput(params.material, extractedCopy, params.generatedAt);
    const introSettings = await this.loadDouyinRemixStageGenerationSettings(params.brandId, "INTRO");
    const introBreakdownResult = await this.generateDouyinRemixStageTextByModel(
      introSettings.promptContent,
      breakdownSourcePayload,
      introSettings,
      "抖音二创文案拆解开头",
      {
        stageLabel: "拆解开头",
        onAttemptUpdate: async (detailText, modelName) => {
          await params.onPhaseUpdate?.("ANALYZING", { detailText, modelName });
        },
      },
    );
    const bodySettings = await this.loadDouyinRemixStageGenerationSettings(params.brandId, "BODY");
    const bodyBreakdownResult = await this.generateDouyinRemixStageTextByModel(
      bodySettings.promptContent,
      breakdownSourcePayload,
      bodySettings,
      "抖音二创文案拆解正文",
      {
        stageLabel: "拆解正文",
        onAttemptUpdate: async (detailText, modelName) => {
          await params.onPhaseUpdate?.("ANALYZING", { detailText, modelName });
        },
      },
    );
    const outroSettings = await this.loadDouyinRemixStageGenerationSettings(params.brandId, "OUTRO");
    const outroBreakdownResult = await this.generateDouyinRemixStageTextByModel(
      outroSettings.promptContent,
      breakdownSourcePayload,
      outroSettings,
      "抖音二创文案拆解结尾",
      {
        stageLabel: "拆解结尾",
        onAttemptUpdate: async (detailText, modelName) => {
          await params.onPhaseUpdate?.("ANALYZING", { detailText, modelName });
        },
      },
    );

    const finalSettings = await this.loadDouyinRemixStageGenerationSettings(params.brandId, "FINAL");
    const finalInputPayload = this.buildDouyinRemixCopyInput({
      archive: params.archive,
      material: params.material,
      extractResult: extractedCopy,
      introBreakdown: introBreakdownResult.content,
      bodyBreakdown: bodyBreakdownResult.content,
      outroBreakdown: outroBreakdownResult.content,
      injectBrandProfile: params.injectBrandProfile,
      product: params.product,
      marketingPlan: params.marketingPlan,
      injectMarketingPlan: params.injectMarketingPlan,
      userRequirement: params.userRequirement,
      generatedAt: params.generatedAt,
    });
    await params.onPhaseUpdate?.("GENERATING");
    const finalResult = await this.generateDouyinRemixStageTextByModel(
      finalSettings.promptContent,
      finalInputPayload,
      finalSettings,
      "抖音二创文案生成",
      {
        stageLabel: "生成二创文案",
        onAttemptUpdate: async (detailText, modelName) => {
          await params.onPhaseUpdate?.("GENERATING", { detailText, modelName });
        },
      },
    );

    const normalized = this.buildManualDouyinRemixCopyResult(finalResult.content, undefined, "抖音二创文案");
    return {
      ...normalized,
      modelName: finalResult.modelName,
      sourceMaterialId: params.material.id,
      sourceMaterialTitle: params.material.title,
      sourceVideoUrl: params.material.videoUrl,
      sourceAuthorName: params.material.authorName,
      sourceWorkUrl: params.material.workUrl,
      injectBrandProfile: params.injectBrandProfile,
      injectMarketingPlan: params.injectMarketingPlan,
      marketingPlanTitle: params.marketingPlan?.title,
      productId: params.product?.id,
      productName: params.product?.productName,
      userRequirement: params.userRequirement,
      extractedCopy,
      introBreakdown: introBreakdownResult.content,
      bodyBreakdown: bodyBreakdownResult.content,
      outroBreakdown: outroBreakdownResult.content,
    } satisfies DouyinRemixCopyModelResult;
  }

  private async buildXiaohongshuMarketingCalendar(params: {
    brandId: string;
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>;
    sourceReport: GrowthReportRecord;
    opportunityReport: OpportunityInsightReportRecord;
    previousCalendars: XiaohongshuMarketingCalendarRecord[];
    generatedAt: string;
    userRequirement?: string;
    onPhaseUpdate?: (
      phase: XiaohongshuMarketingCalendarPhase,
      extra?: {
        modelName?: string;
        detailText?: string;
      },
    ) => Promise<void> | void;
  }) {
    const settings = await this.loadXiaohongshuMarketingCalendarGenerationSettings(params.brandId);
    const inputPayload = this.buildXiaohongshuMarketingCalendarInput(
      params.archive,
      params.sourceReport,
      params.opportunityReport,
      params.previousCalendars,
      params.generatedAt,
      params.userRequirement,
    );
    await params.onPhaseUpdate?.("GENERATING");
    return this.generateXiaohongshuMarketingCalendarByModel(settings.promptContent, inputPayload, settings, {
      onAttemptUpdate: async (detailText, modelName) => {
        await params.onPhaseUpdate?.("GENERATING", {
          detailText,
          modelName,
        });
      },
    });
  }

  private async generateReportByModel(
    brandId: string,
    skillPrompt: string,
    inputPayload: Record<string, unknown>,
  ): Promise<GrowthReportModelResult> {
    const settings = await this.loadGrowthReportGenerationSettings(brandId);
    const providers = await this.loadGrowthReportProviderConfigs(settings);
    const preferredModelName = settings.preferredModelName || this.parseDelimitedModels(settings.modelName)[0] || "";
    const systemPrompt = [
      skillPrompt,
      "",
      "你现在负责输出《品牌增长报告》。",
      "你必须严格基于输入资料生成，不得编造不存在的数据。",
      "如果经营数据不足，必须在报告中明确标注“待补充”或“待验证”。",
      "请仅输出一个 JSON 对象，不要输出 Markdown 代码块，也不要输出额外解释。",
      "JSON 结构固定为：",
      "{",
      '  "title": "品牌增长报告标题",',
      '  "summary": "150字以内摘要",',
      '  "diagnosis": ["3-6条核心诊断"],',
      '  "opportunities": ["3-6条增长机会"],',
      '  "nextActions": ["3-6条下一步动作"],',
      '  "reportMarkdown": "完整的品牌增长报告 Markdown 正文"',
      "}",
    ].join("\n");
    const knowledgeContext = await this.buildGrowthReportKnowledgeContext(settings, inputPayload);
    const userPrompt = [
      "以下是本次生成品牌增长报告的输入数据，请围绕这些数据输出完整报告。",
      "",
      JSON.stringify(inputPayload, null, 2),
      knowledgeContext,
    ].join("\n");

    let lastError = "";
    const attemptTrail: string[] = [];
    for (const provider of providers) {
      for (const baseUrl of provider.baseUrls.slice(0, 2)) {
        for (const apiKey of provider.apiKeys.slice(0, 2)) {
          for (const modelName of provider.models) {
            const attemptLabel = this.buildReportAttemptLabel(provider.provider, modelName, baseUrl);
            try {
              const response = await this.requestModelCompletion(
                baseUrl,
                provider.completionPath,
                apiKey,
                this.buildGrowthReportProviderPayload(provider, modelName, systemPrompt, userPrompt),
                this.resolveModelAttemptTimeoutMs(provider.requestTimeoutMs, TEXT_MODEL_ATTEMPT_TIMEOUT_MS),
              );

              if (!response.ok) {
                lastError = `${provider.provider}/${modelName} 接口请求失败: ${response.status}`;
                attemptTrail.push(`${attemptLabel} -> HTTP ${response.status}`);
                continue;
              }

              const payload = await response.json() as {
                choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
              };
              const content = this.extractVisualResponseContent(payload);
              if (!content) {
                lastError = `${provider.provider}/${modelName} 返回为空`;
                attemptTrail.push(`${attemptLabel} -> 返回为空`);
                continue;
              }

              return this.normalizeModelResult(content);
            } catch (error) {
              lastError = error instanceof Error ? `${provider.provider}/${modelName} 调用失败: ${error.message}` : `${provider.provider}/${modelName} 调用失败`;
              attemptTrail.push(`${attemptLabel} -> ${error instanceof Error ? error.message : "调用失败"}`);
            }
          }
        }
      }
    }

    const detail = attemptTrail.length
      ? `；实际尝试顺序：${this.formatReportAttemptTrail(attemptTrail)}`
      : "";
    const preferredDetail = preferredModelName ? `首选模型：${preferredModelName}；` : "";
    throw new ServiceUnavailableException(`品牌增长报告生成失败：${preferredDetail}最后失败：${lastError || "未获取到有效响应"}${detail}`);
  }

  private async buildGrowthReportKnowledgeContext(
    settings: ModelGenerationSettings,
    inputPayload: Record<string, unknown>,
  ) {
    return this.buildExecutionKnowledgeContext(
      settings.brandId || "",
      settings.knowledgeScope,
      this.buildGrowthReportKnowledgeQuery(inputPayload),
      "以下是系统按“接入对象 -> 品牌增长工作台”从企业知识库召回的补充上下文，请优先参考这些内容：",
      "品牌增长报告",
    );
  }

  private async buildAnnualMarketingPlanKnowledgeContext(
    settings: ModelGenerationSettings,
    inputPayload: Record<string, unknown>,
  ) {
    return this.buildExecutionKnowledgeContext(
      settings.brandId || "",
      settings.knowledgeScope,
      this.buildAnnualMarketingPlanKnowledgeQuery(inputPayload),
      "以下是系统按“接入对象 -> 品牌增长工作台”从企业知识库召回的补充上下文，请结合这些内容完善半年营销规划：",
      "半年营销规划",
    );
  }

  private async buildOpportunityInsightCommentKnowledgeContext(
    brandId: string,
    settings: ModelGenerationSettings,
    inputPayload: Record<string, unknown>,
  ) {
    return this.buildExecutionKnowledgeContext(
      brandId,
      settings.knowledgeScope,
      this.buildOpportunityInsightCommentKnowledgeQuery(inputPayload),
      "以下是系统从企业知识库召回的评论/用户反馈补充上下文，请一并作为评论洞察分析依据：",
      "机会洞察-评论洞察分析",
    );
  }

  private async buildOpportunityInsightFinalKnowledgeContext(
    brandId: string,
    settings: ModelGenerationSettings,
    inputPayload: Record<string, unknown>,
  ) {
    return this.buildExecutionKnowledgeContext(
      brandId,
      settings.knowledgeScope,
      this.buildOpportunityInsightFinalKnowledgeQuery(inputPayload),
      "以下是系统从企业知识库召回的补充上下文，请一并作为机会洞察总报告依据：",
      "机会洞察-总报告",
    );
  }

  private async buildXiaohongshuMarketingPlanKnowledgeContext(
    settings: ModelGenerationSettings,
    inputPayload: Record<string, unknown>,
  ) {
    return this.buildExecutionKnowledgeContext(
      settings.brandId || "",
      settings.knowledgeScope,
      this.buildPlatformMarketingKnowledgeQuery(inputPayload, "小红书营销策划"),
      "以下是系统按接入对象从企业知识库召回的补充上下文，请结合这些内容完善小红书营销策划方案：",
      "小红书营销策划方案",
    );
  }

  private async buildDouyinMarketingPlanKnowledgeContext(
    settings: ModelGenerationSettings,
    inputPayload: Record<string, unknown>,
  ) {
    return this.buildExecutionKnowledgeContext(
      settings.brandId || "",
      settings.knowledgeScope,
      this.buildPlatformMarketingKnowledgeQuery(inputPayload, "抖音营销策划"),
      "以下是系统按接入对象从企业知识库召回的补充上下文，请结合这些内容完善抖音营销策划方案：",
      "抖音营销策划方案",
    );
  }

  private async buildDouyinHotTopicKnowledgeContext(
    settings: ModelGenerationSettings,
    inputPayload: Record<string, unknown>,
  ) {
    return this.buildExecutionKnowledgeContext(
      settings.brandId || "",
      settings.knowledgeScope,
      this.buildPlatformMarketingKnowledgeQuery(inputPayload, "抖音热点找选题"),
      "以下是系统按接入对象从企业知识库召回的补充上下文，请把这些内容一起作为抖音热点选题判断依据：",
      "抖音热点找选题",
    );
  }

  private async buildExecutionKnowledgeContext(
    brandId: string,
    scope: ModelGenerationSettings["knowledgeScope"],
    retrievalQuery: string,
    leadText: string,
    sceneLabel: string,
  ) {
    if (!retrievalQuery) {
      return "";
    }

    let activeBindings: KnowledgeBindingView[] = [];
    try {
      activeBindings = await this.resolveExecutionKnowledgeBindings(scope);
      if (!activeBindings.length) {
        await this.knowledgeBasesService.recordKnowledgeInvocation({
          brandId,
          sourceModule: "REPORTS",
          sceneLabel,
          moduleTargetId: scope?.moduleTargetId,
          skillPackageKey: scope?.skillPackageKey,
          skillSlug: scope?.skillSlug,
          retrievalQuery,
          status: "UNBOUND",
          summary: "未找到启用中的知识库绑定，本次按原始提示词执行。",
        });
        return "";
      }

      const sections: string[] = [];
      const matchedKnowledgeBaseIds: string[] = [];
      const matchedKnowledgeBaseNames: string[] = [];
      let hitCount = 0;
      for (const binding of activeBindings) {
        const section = await this.buildGrowthReportKnowledgeSection(brandId, binding, retrievalQuery);
        if (section) {
          sections.push(section);
          matchedKnowledgeBaseIds.push(binding.knowledgeBaseId);
          matchedKnowledgeBaseNames.push(binding.knowledgeBaseName || binding.targetName || binding.knowledgeBaseId);
          hitCount += 1;
        }
      }

      if (!sections.length) {
        await this.knowledgeBasesService.recordKnowledgeInvocation({
          brandId,
          sourceModule: "REPORTS",
          sceneLabel,
          moduleTargetId: scope?.moduleTargetId,
          skillPackageKey: scope?.skillPackageKey,
          skillSlug: scope?.skillSlug,
          knowledgeBaseIds: activeBindings.map((item) => item.knowledgeBaseId),
          knowledgeBaseNames: activeBindings.map((item) => item.knowledgeBaseName || item.targetName || item.knowledgeBaseId),
          retrievalQuery,
          status: "NO_HIT",
          summary: `已检查 ${activeBindings.length} 个绑定知识库，但没有召回可用内容。`,
        });
        return "";
      }

      await this.knowledgeBasesService.recordKnowledgeInvocation({
        brandId,
        sourceModule: "REPORTS",
        sceneLabel,
        moduleTargetId: scope?.moduleTargetId,
        skillPackageKey: scope?.skillPackageKey,
        skillSlug: scope?.skillSlug,
        knowledgeBaseIds: activeBindings.map((item) => item.knowledgeBaseId),
        knowledgeBaseNames: activeBindings.map((item) => item.knowledgeBaseName || item.targetName || item.knowledgeBaseId),
        matchedKnowledgeBaseIds,
        matchedKnowledgeBaseNames,
        retrievalQuery,
        hitCount,
        status: "HIT",
        summary: `已命中 ${matchedKnowledgeBaseNames.length} 个知识库来源，汇总 ${sections.length} 组补充上下文。`,
      });

      return ["", leadText, "", sections.join("\n\n")].join("\n");
    } catch (error) {
      await this.knowledgeBasesService.recordKnowledgeInvocation({
        brandId,
        sourceModule: "REPORTS",
        sceneLabel,
        moduleTargetId: scope?.moduleTargetId,
        skillPackageKey: scope?.skillPackageKey,
        skillSlug: scope?.skillSlug,
        knowledgeBaseIds: activeBindings.map((item) => item.knowledgeBaseId),
        knowledgeBaseNames: activeBindings.map((item) => item.knowledgeBaseName || item.targetName || item.knowledgeBaseId),
        retrievalQuery,
        status: "FAILED",
        summary: `知识库调用失败，已自动降级为普通生成：${this.describeKnowledgeInvocationError(error)}`,
      });
      return "";
    }
  }

  private describeKnowledgeInvocationError(error: unknown) {
    if (error instanceof Error) {
      const message = String(error.message || "").trim();
      if (message) {
        return message;
      }
    }
    return "未知错误";
  }

  private async resolveExecutionKnowledgeBindings(scope: ModelGenerationSettings["knowledgeScope"] = {}) {
    const candidates = [
      {
        bindingType: "WORKFLOW_STEP" as const,
        targetId: scope.workflowStepId,
        specificity: 500,
      },
      {
        bindingType: "SKILL" as const,
        targetId: scope.skillSlug,
        specificity: 400,
      },
      {
        bindingType: "PROMPT" as const,
        targetId: scope.legacyPromptId,
        specificity: 300,
      },
      {
        bindingType: "SKILL_PACKAGE" as const,
        targetId: scope.skillPackageKey,
        specificity: 200,
      },
      {
        bindingType: "MODULE" as const,
        targetId: scope.moduleTargetId,
        specificity: 100,
      },
    ].filter((item) => item.targetId?.trim());

    if (!candidates.length) {
      return [];
    }

    const groups = await Promise.all(
      candidates.map(async (candidate) => {
        const items = await this.knowledgeBasesService.listKnowledgeBindingsByTarget(
          candidate.bindingType,
          candidate.targetId || "",
          true,
        );
        return items.map((item) => ({
          ...item,
          specificity: candidate.specificity,
        }));
      }),
    );

    const flattened = groups
      .flat()
      .filter((item) => item.enabled && item.retrievalMode !== "MANUAL")
      .sort((left, right) => {
        if (left.specificity !== right.specificity) {
          return right.specificity - left.specificity;
        }
        if (left.isRequired !== right.isRequired) {
          return Number(right.isRequired) - Number(left.isRequired);
        }
        return right.priority - left.priority;
      });

    const deduped = new Map<string, KnowledgeBindingView>();
    for (const item of flattened) {
      if (!deduped.has(item.knowledgeBaseId)) {
        deduped.set(item.knowledgeBaseId, item);
      }
    }

    return Array.from(deduped.values()).slice(0, MODULE_KNOWLEDGE_BINDING_LIMIT);
  }

  private async buildGrowthReportKnowledgeSection(
    brandId: string,
    binding: KnowledgeBindingView,
    retrievalQuery: string,
  ) {
    try {
      const retrieval = await this.knowledgeBasesService.runKnowledgeRetrievalTest(binding.knowledgeBaseId, {
        query: retrievalQuery,
        topK: MODULE_KNOWLEDGE_TOP_K,
      });
      if (!retrieval.hits.length) {
        return binding.isRequired
          ? `知识库《${binding.knowledgeBaseName || binding.knowledgeBaseId}》未召回到有效片段，请将其视为待补充资料。`
          : "";
      }

      const hitLines = retrieval.hits
        .slice(0, MODULE_KNOWLEDGE_TOP_K)
        .map((hit, index) => {
          const content = this.truncateText(String(hit.content || "").replace(/\s+/g, " ").trim(), 320);
          return [
            `片段${index + 1}｜文件：${hit.fileName}｜分片：${hit.chunkIndex}｜相似度：${hit.score.toFixed(3)}`,
            content,
          ].join("\n");
        })
        .join("\n\n");

      return [
        `知识库：${binding.knowledgeBaseName || binding.knowledgeBaseId}`,
        `绑定对象：${binding.targetName || BRAND_GROWTH_KNOWLEDGE_TARGET_ID}｜品牌：${brandId}`,
        hitLines,
      ].join("\n");
    } catch (error) {
      if (!binding.isRequired) {
        return "";
      }
      return `知识库《${binding.knowledgeBaseName || binding.knowledgeBaseId}》检索失败：${error instanceof Error ? error.message : "未知错误"}。`;
    }
  }

  private buildGrowthReportKnowledgeQuery(inputPayload: Record<string, unknown>) {
    const inputScope = this.asRecord(inputPayload.inputScope) || {};
    const brandArchive = this.asRecord(inputScope.brandArchive) || {};
    const brandBackground = this.asRecord(brandArchive.background) || {};
    const products = Array.isArray(brandArchive.products) ? brandArchive.products : [];
    const surveys = Array.isArray(brandArchive.survey) ? brandArchive.survey : [];

    const brandName = this.readFirstAvailableText(brandBackground, [
      "brandName",
      "name",
      "companyName",
      "enterpriseName",
    ]);
    const productNames = products
      .map((item) => this.readFirstAvailableText(this.asRecord(item), ["productName", "name", "title"]))
      .filter((item): item is string => Boolean(item))
      .slice(0, 5);
    const surveyKeywords = surveys
      .map((item) => this.readFirstAvailableText(this.asRecord(item), ["label", "value"]))
      .filter((item): item is string => Boolean(item))
      .slice(0, 4);

    return [
      "品牌增长报告",
      brandName ? `品牌：${brandName}` : "",
      productNames.length ? `产品：${productNames.join("、")}` : "",
      surveyKeywords.length ? `重点资料：${surveyKeywords.join("；")}` : "",
      "请召回企业知识库中与品牌背景、产品资料、经营现状、客户画像、渠道策略、销售话术相关的内容",
    ]
      .filter((item) => item.trim())
      .join("；");
  }

  private buildOpportunityInsightCommentKnowledgeQuery(inputPayload: Record<string, unknown>) {
    const brandArchive = this.readNestedRecord(inputPayload, ["inputScope", "brandArchive"]);
    const brandBackground = this.readNestedRecord(brandArchive, ["background"]);
    const products = Array.isArray(brandArchive?.products) ? brandArchive.products : [];
    const brandName = this.readFirstAvailableText(brandBackground, ["brandName", "name", "companyName"]);
    const productNames = products
      .map((item) => this.readFirstAvailableText(this.asRecord(item), ["productName", "name"]))
      .filter((item): item is string => Boolean(item))
      .slice(0, 5);
    return [
      "机会洞察-评论洞察分析",
      brandName ? `品牌：${brandName}` : "",
      productNames.length ? `产品：${productNames.join("、")}` : "",
      "请召回企业知识库中与用户评论、用户反馈、差评、好评、售后、痛点、需求、使用场景、复购、抱怨相关的内容",
    ].filter((item) => item.trim()).join("；");
  }

  private buildOpportunityInsightFinalKnowledgeQuery(inputPayload: Record<string, unknown>) {
    const brandArchive = this.readNestedRecord(inputPayload, ["inputScope", "brandArchive"]);
    const brandBackground = this.readNestedRecord(brandArchive, ["background"]);
    const products = Array.isArray(brandArchive?.products) ? brandArchive.products : [];
    const brandName = this.readFirstAvailableText(brandBackground, ["brandName", "name", "companyName"]);
    const productNames = products
      .map((item) => this.readFirstAvailableText(this.asRecord(item), ["productName", "name"]))
      .filter((item): item is string => Boolean(item))
      .slice(0, 5);
    return [
      "机会洞察-总报告",
      brandName ? `品牌：${brandName}` : "",
      productNames.length ? `产品：${productNames.join("、")}` : "",
      "请召回企业知识库中与用户需求、品牌差异化、产品卖点、典型场景、市场机会、竞品案例、消费者心智相关的内容",
    ].filter((item) => item.trim()).join("；");
  }

  private buildAnnualMarketingPlanKnowledgeQuery(inputPayload: Record<string, unknown>) {
    const inputScope = this.asRecord(inputPayload.inputScope) || {};
    const brandArchive = this.asRecord(inputScope.brandArchive) || {};
    const brandBackground = this.asRecord(brandArchive.background) || {};
    const growthReport = this.asRecord(inputScope.growthReport) || {};
    const planningWindow = this.asRecord(inputScope.planningWindow) || {};
    const products = Array.isArray(brandArchive.products) ? brandArchive.products : [];
    const businessAssets = Array.isArray(brandArchive.businessAssets) ? brandArchive.businessAssets : [];

    const brandName = this.readFirstAvailableText(brandBackground, [
      "brandName",
      "name",
      "companyName",
      "enterpriseName",
    ]);
    const planningLabel = this.readFirstAvailableText(planningWindow, ["label"]);
    const reportTitle = this.readFirstAvailableText(growthReport, ["title", "summary"]);
    const productNames = products
      .map((item) => this.readFirstAvailableText(this.asRecord(item), ["productName", "name", "title"]))
      .filter((item): item is string => Boolean(item))
      .slice(0, 5);
    const assetTitles = businessAssets
      .map((item) => this.readFirstAvailableText(this.asRecord(item), ["title", "description", "sourceName"]))
      .filter((item): item is string => Boolean(item))
      .slice(0, 4);

    return [
      "半年营销规划",
      brandName ? `品牌：${brandName}` : "",
      planningLabel ? `规划周期：${planningLabel}` : "",
      reportTitle ? `参考报告：${reportTitle}` : "",
      productNames.length ? `产品：${productNames.join("、")}` : "",
      assetTitles.length ? `企业知识库重点资料：${assetTitles.join("；")}` : "",
      "请召回企业知识库中与品牌定位、产品策略、经营现状、渠道节奏、销售话术、活动策划相关的内容",
    ]
      .filter((item) => item.trim())
      .join("；");
  }

  private buildPlatformMarketingKnowledgeQuery(inputPayload: Record<string, unknown>, scenarioLabel: string) {
    const inputScope = this.asRecord(inputPayload.inputScope) || {};
    const brandArchive = this.asRecord(inputScope.brandArchive) || {};
    const brandBackground = this.asRecord(brandArchive.background) || {};
    const growthReport = this.asRecord(inputScope.growthReport) || {};
    const annualPlan = this.asRecord(inputScope.annualPlan) || {};
    const xhsData = this.asRecord(inputScope.xiaohongshuData) || {};
    const douyinData = this.asRecord(inputScope.douyinData) || {};
    const products = Array.isArray(brandArchive.products) ? brandArchive.products : [];
    const businessAssets = Array.isArray(brandArchive.businessAssets) ? brandArchive.businessAssets : [];

    const brandName = this.readFirstAvailableText(brandBackground, [
      "brandName",
      "name",
      "companyName",
      "enterpriseName",
    ]);
    const reportTitle = this.readFirstAvailableText(growthReport, ["title", "summary"]);
    const annualPlanTitle = this.readFirstAvailableText(annualPlan, ["title", "summary"]);
    const platformSummary = this.readFirstAvailableText(xhsData, ["summary", "analysis", "overview"])
      || this.readFirstAvailableText(douyinData, ["summary", "analysis", "overview"]);
    const productNames = products
      .map((item) => this.readFirstAvailableText(this.asRecord(item), ["productName", "name", "title"]))
      .filter((item): item is string => Boolean(item))
      .slice(0, 5);
    const assetTitles = businessAssets
      .map((item) => this.readFirstAvailableText(this.asRecord(item), ["title", "description", "sourceName"]))
      .filter((item): item is string => Boolean(item))
      .slice(0, 4);

    return [
      scenarioLabel,
      brandName ? `品牌：${brandName}` : "",
      reportTitle ? `品牌增长报告：${reportTitle}` : "",
      annualPlanTitle ? `半年营销规划：${annualPlanTitle}` : "",
      platformSummary ? `平台现状：${this.truncateText(platformSummary, 120)}` : "",
      productNames.length ? `产品：${productNames.join("、")}` : "",
      assetTitles.length ? `企业知识库重点资料：${assetTitles.join("；")}` : "",
      "请召回企业知识库中与品牌定位、核心卖点、产品节奏、内容方向、用户洞察、销售话术、活动策划相关的内容",
    ]
      .filter((item) => item.trim())
      .join("；");
  }

  private readFirstAvailableText(record: Record<string, unknown> | undefined, keys: string[]) {
    for (const key of keys) {
      const value = String(record?.[key] || "").trim();
      if (value) {
        return value;
      }
    }
    return "";
  }

  private async generateVisualReportByModel(
    skillPrompt: string,
    inputPayload: Record<string, unknown>,
    settings: ModelGenerationSettings,
  ): Promise<VisualReportOutlineModelResult> {
    const providers = await this.loadDomesticVisualProviderConfigs(settings);
    const preferredModelName = settings.preferredModelName || this.parseDelimitedModels(settings.modelName)[0] || "";
    const systemPrompt = [
      skillPrompt,
      "",
      "你现在负责输出《品牌增长可视化报告》。",
      "输入是一份已经生成完成的《品牌增长报告》。",
      "请将其转为完整但精炼的《品牌增长可视化内容大纲》。",
      "不要直接输出 HTML，由系统根据你的结构化结果渲染成 HTML。",
      "必须保留核心信息结构，并完整覆盖核心结论、关键诊断、增长机会、行动建议与关键数据关系。",
      "请仅输出一个 JSON 对象，不要输出 Markdown 代码块，也不要输出额外解释。",
      "JSON 结构固定为：",
      "{",
      '  "title": "品牌增长可视化报告标题",',
      '  "summary": "150字以内摘要",',
      '  "eyebrow": "头部标签文案，建议 6-16 字",',
      '  "heroTitle": "头图主标题",',
      '  "heroSubtitle": "头图副标题，1-2句",',
      '  "metrics": [',
      '    { "label": "指标名称", "value": "指标值", "note": "一句解释" }',
      "  ],",
      '  "sections": [',
      '    { "title": "章节标题", "body": "1段正文概述", "bullets": ["2-4条要点"] }',
      "  ],",
      '  "actionTitle": "行动建议区标题",',
      '  "actionItems": ["3-6条行动建议"]',
      "}",
      "metrics 保留 3-4 项即可，sections 保留 4-6 个核心章节即可，避免冗长重复。",
    ].join("\n");
    const userPrompt = [
      "以下是本次生成品牌增长可视化报告的输入数据，请围绕这些数据输出完整结构。",
      "",
      JSON.stringify(inputPayload),
    ].join("\n");

    let lastError = "";
    const attemptTrail: string[] = [];
    for (const provider of providers) {
      for (const baseUrl of provider.baseUrls) {
        for (const apiKey of provider.apiKeys) {
          for (const modelName of provider.models) {
            const attemptLabel = this.buildReportAttemptLabel(provider.provider, modelName, baseUrl);
            try {
              const response = await this.requestModelCompletion(
                baseUrl,
                provider.completionPath,
                apiKey,
                this.buildVisualProviderPayload(provider, modelName, systemPrompt, userPrompt),
                this.resolveModelAttemptTimeoutMs(provider.requestTimeoutMs, TEXT_MODEL_ATTEMPT_TIMEOUT_MS),
              );

              if (!response.ok) {
                lastError = `${provider.provider}/${modelName} 接口请求失败: ${response.status}`;
                attemptTrail.push(`${attemptLabel} -> HTTP ${response.status}`);
                continue;
              }

              const payload = await response.json() as {
                choices?: Array<{
                  finish_reason?: string;
                  message?: { content?: string; reasoning_content?: string };
                }>;
              };
              const content = this.extractVisualResponseContent(payload);
              if (!content) {
                lastError = `${provider.provider}/${modelName} 返回为空`;
                attemptTrail.push(`${attemptLabel} -> 返回为空`);
                continue;
              }
              const finishReason = String(payload.choices?.[0]?.finish_reason ?? "").trim().toLowerCase();
              if (finishReason === "length") {
                lastError = `${provider.provider}/${modelName} 输出被截断`;
                attemptTrail.push(`${attemptLabel} -> 输出被截断`);
                continue;
              }

              return this.normalizeVisualOutlineModelResult(content, inputPayload);
            } catch (error) {
              lastError = error instanceof Error ? `${provider.provider}/${modelName} 调用失败: ${error.message}` : `${provider.provider}/${modelName} 调用失败`;
              attemptTrail.push(`${attemptLabel} -> ${error instanceof Error ? error.message : "调用失败"}`);
            }
          }
        }
      }
    }

    throw new ServiceUnavailableException(
      this.buildReportAttemptFailureMessage("品牌增长可视化报告生成", preferredModelName, lastError, attemptTrail, "未获取到有效响应"),
    );
  }

  private async generateAnnualMarketingPlanByModel(
    skillPrompt: string,
    inputPayload: Record<string, unknown>,
    settings: ModelGenerationSettings,
  ): Promise<AnnualMarketingPlanModelResult> {
    const providers = await this.loadAnnualMarketingProviderConfigs(settings);
    const preferredModelName = settings.preferredModelName || this.parseDelimitedModels(settings.modelName)[0] || "";
    const planningWindow = this.buildHalfYearPlanningWindow(String(inputPayload.generatedAt ?? ""));
    const systemPrompt = [
      skillPrompt,
      "",
      `请输出完整的半年营销规划，规划周期必须严格限定在 ${planningWindow.label}。`,
      "只输出一个 JSON 对象，不要输出代码块。",
      "JSON 必须包含：title、planningYear、planningFocus、summary、items。",
      `planningYear 字段填写 "${planningWindow.label}"，不要写全年。`,
      `items 至少 12 条，每条包含 month、node、date、type、marketingTheme、platforms、strategy、products，且月份只能来自：${planningWindow.monthLabels.join("、")}。`,
    ].join("\n");
    const knowledgeContext = await this.buildAnnualMarketingPlanKnowledgeContext(settings, inputPayload);
    const userPrompt = ["以下是输入数据：", "", JSON.stringify(inputPayload, null, 2), knowledgeContext].join("\n");

    let lastError = "";
    const attemptTrail: string[] = [];
    for (const provider of providers) {
      for (const baseUrl of provider.baseUrls) {
        for (const apiKey of provider.apiKeys) {
          for (const modelName of provider.models) {
            const attemptLabel = this.buildReportAttemptLabel(provider.provider, modelName, baseUrl);
            try {
              const response = await this.requestModelCompletion(
                baseUrl,
                provider.completionPath,
                apiKey,
                this.buildAnnualMarketingProviderPayload(provider, modelName, systemPrompt, userPrompt),
                this.resolveModelAttemptTimeoutMs(provider.requestTimeoutMs, TEXT_MODEL_ATTEMPT_TIMEOUT_MS),
              );
              if (!response.ok) {
                lastError = `${provider.provider}/${modelName} 接口请求失败: ${response.status}`;
                attemptTrail.push(`${attemptLabel} -> HTTP ${response.status}`);
                continue;
              }
              const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }>; };
              const content = this.extractVisualResponseContent(payload);
              if (!content) {
                lastError = `${provider.provider}/${modelName} 返回为空`;
                attemptTrail.push(`${attemptLabel} -> 返回为空`);
                continue;
              }
              const finishReason = String(payload.choices?.[0]?.finish_reason ?? "").trim().toLowerCase();
              if (finishReason === "length") {
                lastError = `${provider.provider}/${modelName} 输出被截断`;
                attemptTrail.push(`${attemptLabel} -> 输出被截断`);
                continue;
              }
              return this.normalizeAnnualMarketingPlanModelResult(content, inputPayload, modelName);
            } catch (error) {
              lastError = error instanceof Error ? `${provider.provider}/${modelName} 调用失败: ${error.message}` : `${provider.provider}/${modelName} 调用失败`;
              attemptTrail.push(`${attemptLabel} -> ${error instanceof Error ? error.message : "调用失败"}`);
            }
          }
        }
      }
    }
    throw new ServiceUnavailableException(
      this.buildReportAttemptFailureMessage("半年营销规划生成", preferredModelName, lastError, attemptTrail, "未获取到有效响应"),
    );
  }

  private async generateXiaohongshuMarketingPlanByModel(
    skillPrompt: string,
    inputPayload: Record<string, unknown>,
    settings: ModelGenerationSettings,
  ): Promise<XiaohongshuMarketingPlanModelResult> {
    const providers = await this.loadXiaohongshuMarketingProviderConfigs(settings);
    const preferredModelName = settings.preferredModelName || this.parseDelimitedModels(settings.modelName)[0] || "";
    const systemPrompt = [
      skillPrompt,
      "",
      "请输出完整的小红书营销策划方案。",
      "只输出 Markdown 正文，不要输出 JSON，不要输出代码块。",
      "内容需要覆盖策略判断、产品节奏、内容矩阵、资源组合、合规提醒和风险边界。",
    ].join("\n");
    const knowledgeContext = await this.buildXiaohongshuMarketingPlanKnowledgeContext(settings, inputPayload);
    const userPrompt = ["以下是输入数据：", "", JSON.stringify(inputPayload, null, 2), knowledgeContext].join("\n");

    let lastError = "";
    const attemptTrail: string[] = [];
    for (const provider of providers) {
      for (const baseUrl of provider.baseUrls) {
        for (const apiKey of provider.apiKeys.slice(0, 2)) {
          for (const modelName of provider.models) {
            const attemptLabel = this.buildReportAttemptLabel(provider.provider, modelName, baseUrl);
            try {
              const response = await this.requestModelCompletion(
                baseUrl,
                provider.completionPath,
                apiKey,
                this.buildXiaohongshuMarketingProviderPayload(provider, modelName, systemPrompt, userPrompt),
                this.resolveModelAttemptTimeoutMs(provider.requestTimeoutMs, TEXT_MODEL_ATTEMPT_TIMEOUT_MS),
              );
              if (!response.ok) {
                lastError = `${provider.provider}/${modelName} 接口请求失败: ${response.status}`;
                attemptTrail.push(`${attemptLabel} -> HTTP ${response.status}`);
                continue;
              }
              const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }>; };
              const content = this.extractVisualResponseContent(payload);
              if (!content) {
                lastError = `${provider.provider}/${modelName} 返回为空`;
                attemptTrail.push(`${attemptLabel} -> 返回为空`);
                continue;
              }
              const finishReason = String(payload.choices?.[0]?.finish_reason ?? "").trim().toLowerCase();
              if (finishReason === "length") {
                lastError = `${provider.provider}/${modelName} 输出被截断`;
                attemptTrail.push(`${attemptLabel} -> 输出被截断`);
                continue;
              }
              return this.normalizeXiaohongshuMarketingPlanModelResult(content, inputPayload, modelName);
            } catch (error) {
              lastError = error instanceof Error ? `${provider.provider}/${modelName} 调用失败: ${error.message}` : `${provider.provider}/${modelName} 调用失败`;
              attemptTrail.push(`${attemptLabel} -> ${error instanceof Error ? error.message : "调用失败"}`);
            }
          }
        }
      }
    }
    throw new ServiceUnavailableException(
      this.buildReportAttemptFailureMessage("小红书营销策划方案生成", preferredModelName, lastError, attemptTrail, "未获取到有效响应"),
    );
  }

  private async generateXiaohongshuMarketingPlanSectionByModel(
    systemPrompt: string,
    userPrompt: string,
    settings: ModelGenerationSettings,
    options: {
      requiredHeadings: string[];
      onAttemptUpdate?: (detailText: string) => Promise<void>;
    },
  ): Promise<XiaohongshuMarketingPlanSectionResult> {
    const providers = await this.loadXiaohongshuMarketingProviderConfigs(settings);
    const preferredModelName = settings.preferredModelName || this.parseDelimitedModels(settings.modelName)[0] || "";
    let lastError = "";
    const attemptTrail: string[] = [];
    for (const provider of providers) {
      for (const baseUrl of provider.baseUrls) {
        for (const apiKey of provider.apiKeys.slice(0, 2)) {
          for (const modelName of provider.models) {
            const attemptLabel = this.buildReportAttemptLabel(provider.provider, modelName, baseUrl);
            try {
              await options.onAttemptUpdate?.(`${provider.provider} / ${modelName}`);
              const response = await this.requestModelCompletion(
                baseUrl,
                provider.completionPath,
                apiKey,
                this.buildXiaohongshuMarketingProviderPayload(provider, modelName, systemPrompt, userPrompt),
                this.resolveModelAttemptTimeoutMs(provider.requestTimeoutMs, TEXT_MODEL_ATTEMPT_TIMEOUT_MS),
              );
              if (!response.ok) {
                lastError = `${provider.provider}/${modelName} 接口请求失败: ${response.status}`;
                attemptTrail.push(`${attemptLabel} -> HTTP ${response.status}`);
                continue;
              }
              const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }>; };
              const content = this.extractVisualResponseContent(payload);
              if (!content) {
                lastError = `${provider.provider}/${modelName} 返回为空`;
                attemptTrail.push(`${attemptLabel} -> 返回为空`);
                continue;
              }
              const finishReason = String(payload.choices?.[0]?.finish_reason ?? "").trim().toLowerCase();
              if (finishReason === "length") {
                lastError = `${provider.provider}/${modelName} 输出被截断`;
                attemptTrail.push(`${attemptLabel} -> 输出被截断`);
                continue;
              }
              return {
                markdown: this.normalizeXiaohongshuMarketingPlanSectionMarkdown(content, options.requiredHeadings),
                modelName,
              };
            } catch (error) {
              lastError = error instanceof Error ? `${provider.provider}/${modelName} 调用失败: ${error.message}` : `${provider.provider}/${modelName} 调用失败`;
              attemptTrail.push(`${attemptLabel} -> ${error instanceof Error ? error.message : "调用失败"}`);
            }
          }
        }
      }
    }
    throw new ServiceUnavailableException(
      this.buildReportAttemptFailureMessage("小红书营销策划方案分段生成", preferredModelName, lastError, attemptTrail, "未获取到有效响应"),
    );
  }

  private async generateXiaohongshuMarketingCalendarByModel(
    skillPrompt: string,
    inputPayload: Record<string, unknown>,
    settings: ModelGenerationSettings,
    options?: {
      onAttemptUpdate?: (detailText: string, modelName: string) => Promise<void> | void;
    },
  ): Promise<XiaohongshuMarketingCalendarModelResult> {
    const providers = await this.loadXiaohongshuMarketingCalendarProviderConfigs(settings);
    const preferredModelName = settings.preferredModelName || this.parseDelimitedModels(settings.modelName)[0] || "";
    const startDate = String(inputPayload.startDate ?? "").trim();
    const expectedDates = this.normalizeStringArray(
      inputPayload.expectedDates,
      this.buildExpectedCalendarDates(startDate, Number(inputPayload.days ?? 7)),
      7,
    ).filter(Boolean);
    const systemPrompt = [
      skillPrompt,
      "",
      "请输出未来 7 天的品牌全平台营销日历。",
      "输入优先包含品牌背景资料、机会洞察总报告、品牌增长报告、系统各板块生成内容功能清单和历史营销日历；如果前置报告暂未生成，系统会提供基于品牌资料自动补出的轻量摘要作为兜底参考。",
      "从 startDate 开始连续输出 7 天，不要遗漏日期，不要与历史日期重复。",
      expectedDates.length
        ? `必须严格覆盖这 7 个日期，且顺序保持一致：${expectedDates.join("、")}`
        : "必须严格覆盖从 startDate 开始的连续 7 个日期，且顺序保持一致。",
      "items 中每一项都必须输出以下结构：date、festivalOrSolarTerm、brandMarketing、xiaohongshu、douyin、moments。",
      "festivalOrSolarTerm 如果当天没有匹配节日或节气，必须明确填写“无”，不要留空。",
      "brandMarketing 必须包含 theme、description。",
      "xiaohongshu.brandAccount 与 xiaohongshu.employeeAccount 必须包含 topic、description、contentType、noteKeywords、coverKeywords、titleSuggestions、expectedPerformance。",
      "douyin.brandAccount、douyin.ipAccount、douyin.employeeAccount 必须包含 topic、description、contentType、presentationFormat、copyKeywords、coverKeywords、titleSuggestions、expectedPerformance。",
      "moments 必须包含 topic、description、presentationFormat。",
      "所有数组字段默认返回非空内容；noteKeywords/copyKeywords/coverKeywords 至少 3 个，titleSuggestions 建议 2-3 个。",
      "不允许合并日期、不允许跳过日期、不允许返回少于 7 条，也不允许输出历史日期。",
      "只输出 JSON 对象，不要输出 Markdown 或代码块。",
      "JSON 必须包含 title、summary、items；items 必须正好 7 条。",
      "items 的 date 必须只从 expectedDates 中选取，每个日期只能出现一次。",
      "请优先保证品牌营销主题与各平台选题之间逻辑一致，但账号角色要有明确区分，不允许不同账号完全重复。",
      "预期效果必须写成预估发布 7 天后的数据口径，例如曝光、互动、收藏、留资或私域转化等。",
    ].join("\n");
    const userPrompt = ["以下是输入数据：", "", JSON.stringify(inputPayload, null, 2)].join("\n");

    let lastError = "";
    const attemptTrail: string[] = [];
    for (const provider of providers) {
      for (const baseUrl of provider.baseUrls) {
        for (const apiKey of provider.apiKeys.slice(0, 2)) {
          for (const modelName of provider.models) {
            const attemptLabel = this.buildReportAttemptLabel(provider.provider, modelName, baseUrl);
            try {
              await options?.onAttemptUpdate?.(`${provider.provider} / ${modelName}`, modelName);
              const response = await this.requestModelCompletion(
                baseUrl,
                provider.completionPath,
                apiKey,
                this.buildXiaohongshuMarketingProviderPayload(provider, modelName, systemPrompt, userPrompt),
                this.resolveModelAttemptTimeoutMs(provider.requestTimeoutMs, TEXT_MODEL_ATTEMPT_TIMEOUT_MS),
              );
              if (!response.ok) {
                const responseText = this.truncateText(await response.text(), 240);
                const responseDetail = responseText ? ` ${responseText}` : "";
                lastError = `${provider.provider}/${modelName} 请求失败: ${response.status}${responseDetail}`;
                attemptTrail.push(`${attemptLabel} -> HTTP ${response.status}${responseText ? ` ${responseText}` : ""}`);
                continue;
              }
              const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }>; };
              const message = payload.choices?.[0]?.message;
              const content = message?.content?.trim() || message?.reasoning_content?.trim();
              if (!content) {
                lastError = `${provider.provider}/${modelName} 返回为空`;
                attemptTrail.push(`${attemptLabel} -> 返回为空`);
                continue;
              }
              const finishReason = String(payload.choices?.[0]?.finish_reason ?? "").trim().toLowerCase();
              if (finishReason === "length") {
                lastError = `${provider.provider}/${modelName} 输出被截断`;
                attemptTrail.push(`${attemptLabel} -> 输出被截断`);
                continue;
              }
              return this.normalizeXiaohongshuMarketingCalendarModelResult(content, inputPayload, modelName);
            } catch (error) {
              lastError = error instanceof Error ? `${provider.provider}/${modelName} 调用失败: ${error.message}` : `${provider.provider}/${modelName} 调用失败`;
              attemptTrail.push(`${attemptLabel} -> ${error instanceof Error ? error.message : "调用失败"}`);
            }
          }
        }
      }
    }
    throw new ServiceUnavailableException(
      this.buildReportAttemptFailureMessage("营销日历生成", preferredModelName, lastError, attemptTrail, "未获取到有效响应"),
    );
  }

  private async generateDouyinMarketingPlanByModel(
    skillPrompt: string,
    inputPayload: Record<string, unknown>,
    settings: ModelGenerationSettings,
    options?: {
      onAttemptUpdate?: (detailText: string, modelName: string) => Promise<void> | void;
    },
  ): Promise<DouyinMarketingPlanModelResult> {
    const providers = await this.loadDouyinMarketingProviderConfigs(settings);
    const preferredModelName = settings.preferredModelName || this.parseDelimitedModels(settings.modelName)[0] || "";
    const userRequirement = this.readOpportunityInsightUserRequirement(inputPayload);
    const systemPrompt = [
      skillPrompt,
      "",
      "请输出完整的《抖音营销策划方案》。",
      "输入的核心必备资料已限定为：品牌背景资料、产品资料库、机会洞察总报告、品牌增长报告。",
      "如果输入中还提供了抖音采集数据，它们只作为补充参考，不能覆盖上述四类核心输入。",
      "只输出 Markdown 正文，不要输出 JSON，不要输出代码块，不要输出执行说明。",
      "内容至少覆盖平台现状判断、账号矩阵策略、内容方向规划、作品打法拆解、投流与转化建议、组织协同与风险提醒。",
      "如果某些数据不足，必须明确写出“待补充/待验证”，不要编造。",
      userRequirement ? `如果输入中提供了“用户要求”，必须优先满足：${userRequirement}` : "",
    ].join("\n");
    const knowledgeContext = await this.buildDouyinMarketingPlanKnowledgeContext(settings, inputPayload);
    const userPrompt = ["以下是输入数据：", "", JSON.stringify(inputPayload, null, 2), knowledgeContext].join("\n");

    let lastError = "";
    const attemptTrail: string[] = [];
    for (const provider of providers) {
      for (const baseUrl of provider.baseUrls) {
        for (const apiKey of provider.apiKeys.slice(0, 2)) {
          for (const modelName of provider.models) {
            const attemptLabel = this.buildReportAttemptLabel(provider.provider, modelName, baseUrl);
            try {
              await options?.onAttemptUpdate?.(`${provider.provider} / ${modelName}`, modelName);
              const response = await this.requestModelCompletion(
                baseUrl,
                provider.completionPath,
                apiKey,
                this.buildXiaohongshuMarketingProviderPayload(provider, modelName, systemPrompt, userPrompt),
                this.resolveModelAttemptTimeoutMs(provider.requestTimeoutMs, TEXT_MODEL_ATTEMPT_TIMEOUT_MS),
              );
              if (!response.ok) {
                const responseText = this.truncateText(await response.text(), 240);
                const responseDetail = responseText ? ` ${responseText}` : "";
                lastError = `${provider.provider}/${modelName} 请求失败: ${response.status}${responseDetail}`;
                attemptTrail.push(`${attemptLabel} -> HTTP ${response.status}${responseText ? ` ${responseText}` : ""}`);
                continue;
              }
              const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }>; };
              const message = payload.choices?.[0]?.message;
              const content = message?.content?.trim() || message?.reasoning_content?.trim();
              if (!content) {
                lastError = `${provider.provider}/${modelName} 返回为空`;
                attemptTrail.push(`${attemptLabel} -> 返回为空`);
                continue;
              }
              const finishReason = String(payload.choices?.[0]?.finish_reason ?? "").trim().toLowerCase();
              if (finishReason === "length") {
                lastError = `${provider.provider}/${modelName} 输出被截断`;
                attemptTrail.push(`${attemptLabel} -> 输出被截断`);
                continue;
              }
              return this.normalizeDouyinMarketingPlanModelResult(content, inputPayload, modelName);
            } catch (error) {
              lastError = error instanceof Error ? `${provider.provider}/${modelName} 调用失败: ${error.message}` : `${provider.provider}/${modelName} 调用失败`;
              attemptTrail.push(`${attemptLabel} -> ${error instanceof Error ? error.message : "调用失败"}`);
            }
          }
        }
      }
    }
    throw new ServiceUnavailableException(
      this.buildReportAttemptFailureMessage("抖音营销策划方案生成", preferredModelName, lastError, attemptTrail, "未获取到有效响应"),
    );
  }

  private async generateOpportunityInsightMarkdownByModel(
    skillPrompt: string,
    inputPayload: Record<string, unknown>,
    settings: ModelGenerationSettings,
    taskLabel: string,
    options?: {
      onAttemptUpdate?: (detailText: string, modelName: string) => Promise<void> | void;
    },
  ): Promise<OpportunityInsightAccountModelResult> {
    const providers = await this.loadOpportunityInsightAccountProviderConfigs(settings);
    const preferredModelName = settings.preferredModelName || this.parseDelimitedModels(settings.modelName)[0] || "";
    const userRequirement = this.readOpportunityInsightUserRequirement(inputPayload);
    const systemPrompt = [
      skillPrompt,
      "",
      `请输出一份完整的《${taskLabel}》Markdown 报告。`,
      "只输出 Markdown 正文，不要输出 JSON、代码块、执行说明或额外解释。",
      "报告必须围绕账号定位、人群画像、内容结构、爆款特征、转化信号、可复制打法、风险问题和下一步建议展开。",
      "必须引用输入中的账号、作品、笔记、互动数据或品牌资料作为依据，不得无依据编造案例。",
      "如果某个平台或账号样本不足，明确写出“待补充/待验证”，不要伪造数据。",
      "正文必须足够详尽，按中文阅读习惯不少于 2000 字。",
      userRequirement ? `如果输入中提供了“用户补充要求”，必须优先满足：${userRequirement}` : "",
    ].join("\n");
    const userPrompt = ["以下是输入数据：", "", JSON.stringify(inputPayload, null, 2)].join("\n");

    let lastError = "";
    const attemptTrail: string[] = [];
    for (const provider of providers) {
      for (const baseUrl of provider.baseUrls) {
        for (const apiKey of provider.apiKeys.slice(0, 2)) {
          for (const modelName of provider.models) {
            const attemptLabel = this.buildReportAttemptLabel(provider.provider, modelName, baseUrl);
            try {
              await options?.onAttemptUpdate?.(`${provider.provider} / ${modelName}`, modelName);
              const response = await this.requestModelCompletion(
                baseUrl,
                provider.completionPath,
                apiKey,
                this.buildXiaohongshuMarketingProviderPayload(provider, modelName, systemPrompt, userPrompt),
                this.resolveModelAttemptTimeoutMs(provider.requestTimeoutMs, TEXT_MODEL_ATTEMPT_TIMEOUT_MS),
              );
              if (!response.ok) {
                const responseText = this.truncateText(await response.text(), 240);
                const responseDetail = responseText ? ` ${responseText}` : "";
                lastError = `${provider.provider}/${modelName} 请求失败: ${response.status}${responseDetail}`;
                attemptTrail.push(`${attemptLabel} -> HTTP ${response.status}${responseText ? ` ${responseText}` : ""}`);
                continue;
              }
              const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }>; };
              const message = payload.choices?.[0]?.message;
              const content = message?.content?.trim() || message?.reasoning_content?.trim();
              if (!content) {
                lastError = `${provider.provider}/${modelName} 返回为空`;
                attemptTrail.push(`${attemptLabel} -> 返回为空`);
                continue;
              }
              const finishReason = String(payload.choices?.[0]?.finish_reason ?? "").trim().toLowerCase();
              if (finishReason === "length") {
                lastError = `${provider.provider}/${modelName} 输出被截断`;
                attemptTrail.push(`${attemptLabel} -> 输出被截断`);
                continue;
              }
              return this.normalizeOpportunityInsightMarkdownModelResult(content, inputPayload, modelName, taskLabel);
            } catch (error) {
              lastError = error instanceof Error ? `${provider.provider}/${modelName} 调用失败: ${error.message}` : `${provider.provider}/${modelName} 调用失败`;
              attemptTrail.push(`${attemptLabel} -> ${error instanceof Error ? error.message : "调用失败"}`);
            }
          }
        }
      }
    }

    throw new ServiceUnavailableException(
      this.buildReportAttemptFailureMessage(`${taskLabel}生成`, preferredModelName, lastError, attemptTrail, "未获取到有效响应"),
    );
  }

  private async generateOpportunityInsightNarrativeMarkdownByModel(
    skillPrompt: string,
    inputPayload: Record<string, unknown>,
    settings: ModelGenerationSettings,
    taskLabel: string,
    options?: {
      knowledgeContext?: string;
      runtimeRequirements?: string[];
      onAttemptUpdate?: (detailText: string, modelName: string) => Promise<void> | void;
    },
  ): Promise<OpportunityInsightAccountModelResult> {
    const providers = await this.loadOpportunityInsightNarrativeProviderConfigs(settings);
    const preferredModelName = settings.preferredModelName || this.parseDelimitedModels(settings.modelName)[0] || "";
    const userRequirement = this.readOpportunityInsightUserRequirement(inputPayload);
    const systemPrompt = [
      skillPrompt,
      "",
      `请输出一份完整的《${taskLabel}》Markdown 报告。`,
      "只输出 Markdown 正文，不要输出 JSON、代码块、执行说明或额外解释。",
      "所有关键结论都要引用输入资料、前序报告、评论样本或知识库补充内容，不得无依据编造。",
      "如果某类资料缺失，请明确写出“待补充/待验证”，但不要中断生成。",
      "正文必须足够详尽，按中文阅读习惯不少于 2000 字。",
      userRequirement ? `如果输入中提供了“用户补充要求”，必须优先满足：${userRequirement}` : "",
      ...(options?.runtimeRequirements || []),
    ].join("\n");
    const userPrompt = [
      "以下是输入数据：",
      "",
      JSON.stringify(inputPayload, null, 2),
      options?.knowledgeContext || "",
    ].filter(Boolean).join("\n");

    let lastError = "";
    const attemptTrail: string[] = [];
    if (settings.debugProviderSummary) {
      attemptTrail.push(`[debug-provider-summary] ${settings.debugProviderSummary}`);
    }
    for (const provider of providers) {
      for (const baseUrl of provider.baseUrls.slice(0, 2)) {
        for (const apiKey of provider.apiKeys.slice(0, 2)) {
          for (const modelName of provider.models) {
            const attemptLabel = this.buildReportAttemptLabel(provider.provider, modelName, baseUrl);
            try {
              await options?.onAttemptUpdate?.(`${provider.provider} / ${modelName}`, modelName);
              const response = await this.requestModelCompletion(
                baseUrl,
                provider.completionPath,
                apiKey,
                this.buildXiaohongshuMarketingProviderPayload(provider, modelName, systemPrompt, userPrompt),
                this.resolveModelAttemptTimeoutMs(provider.requestTimeoutMs, TEXT_MODEL_ATTEMPT_TIMEOUT_MS),
              );
              if (!response.ok) {
                const responseText = this.truncateText(await response.text(), 240);
                const responseDetail = responseText ? ` ${responseText}` : "";
                lastError = `${provider.provider}/${modelName} 请求失败: ${response.status}${responseDetail}`;
                attemptTrail.push(`${attemptLabel} -> HTTP ${response.status}${responseText ? ` ${responseText}` : ""}`);
                continue;
              }
              const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }>; };
              const message = payload.choices?.[0]?.message;
              const content = message?.content?.trim() || message?.reasoning_content?.trim();
              if (!content) {
                lastError = `${provider.provider}/${modelName} 返回为空`;
                attemptTrail.push(`${attemptLabel} -> 返回为空`);
                continue;
              }
              const finishReason = String(payload.choices?.[0]?.finish_reason ?? "").trim().toLowerCase();
              if (finishReason === "length") {
                lastError = `${provider.provider}/${modelName} 输出被截断`;
                attemptTrail.push(`${attemptLabel} -> 输出被截断`);
                continue;
              }
              return this.normalizeOpportunityInsightMarkdownModelResult(content, inputPayload, modelName, taskLabel);
            } catch (error) {
              lastError = error instanceof Error ? `${provider.provider}/${modelName} 调用失败: ${error.message}` : `${provider.provider}/${modelName} 调用失败`;
              attemptTrail.push(`${attemptLabel} -> ${error instanceof Error ? error.message : "调用失败"}`);
            }
          }
        }
      }
    }

    throw new ServiceUnavailableException(
      this.buildReportAttemptFailureMessage(`${taskLabel}生成`, preferredModelName, lastError, attemptTrail, "未获取到有效响应"),
    );
  }

  private async generateDouyinHotTopicCandidatesByModel(
    skillPrompt: string,
    inputPayload: Record<string, unknown>,
    settings: ModelGenerationSettings,
    options?: {
      onAttemptUpdate?: (detailText: string, modelName: string) => Promise<void> | void;
    },
  ): Promise<DouyinHotTopicCandidatesModelResult> {
    const providers = await this.loadDouyinMarketingProviderConfigs(settings);
    const preferredModelName = settings.preferredModelName || this.parseDelimitedModels(settings.modelName)[0] || "";
    const selectedDate = this.readRecordString(this.readNestedRecord(inputPayload, ["inputScope", "dailyHotspots"]), "selectedDate") || "";
    const analysisSystemPrompt = skillPrompt;
    const knowledgeContext = await this.buildDouyinHotTopicKnowledgeContext(settings, inputPayload);
    const analysisUserPrompt = [
      "以下是本次输入数据，请严格基于这些数据完成分析：",
      "",
      JSON.stringify(inputPayload, null, 2),
      knowledgeContext,
    ].join("\n");

    let lastError = "";
    const attemptTrail: string[] = [];
    const runPrompt = async (systemPrompt: string, userPrompt: string, stageLabel: string) => {
      for (const provider of providers) {
        for (const baseUrl of provider.baseUrls) {
          for (const apiKey of provider.apiKeys.slice(0, 2)) {
            for (const modelName of provider.models) {
              const attemptLabel = this.buildReportAttemptLabel(provider.provider, modelName, baseUrl);
              try {
                await options?.onAttemptUpdate?.(`${stageLabel}: ${provider.provider} / ${modelName}`, modelName);
                const response = await this.requestModelCompletion(
                  baseUrl,
                  provider.completionPath,
                  apiKey,
                  this.buildXiaohongshuMarketingProviderPayload(provider, modelName, systemPrompt, userPrompt),
                  this.resolveModelAttemptTimeoutMs(provider.requestTimeoutMs, TEXT_MODEL_ATTEMPT_TIMEOUT_MS),
                );
                if (!response.ok) {
                  const responseText = this.truncateText(await response.text(), 240);
                  const responseDetail = responseText ? ` ${responseText}` : "";
                  lastError = `${provider.provider}/${modelName} 请求失败: ${response.status}${responseDetail}`;
                  attemptTrail.push(`${stageLabel} / ${attemptLabel} -> HTTP ${response.status}${responseText ? ` ${responseText}` : ""}`);
                  continue;
                }
                const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }>; };
                const message = payload.choices?.[0]?.message;
                const content = message?.content?.trim() || message?.reasoning_content?.trim();
                if (!content) {
                  lastError = `${provider.provider}/${modelName} 返回为空`;
                  attemptTrail.push(`${stageLabel} / ${attemptLabel} -> 返回为空`);
                  continue;
                }
                const finishReason = String(payload.choices?.[0]?.finish_reason ?? "").trim().toLowerCase();
                if (finishReason === "length") {
                  lastError = `${provider.provider}/${modelName} 输出被截断`;
                  attemptTrail.push(`${stageLabel} / ${attemptLabel} -> 输出被截断`);
                  continue;
                }
                return { content, modelName };
              } catch (error) {
                lastError = error instanceof Error ? `${provider.provider}/${modelName} 调用失败: ${error.message}` : `${provider.provider}/${modelName} 调用失败`;
                attemptTrail.push(`${stageLabel} / ${attemptLabel} -> ${error instanceof Error ? error.message : "调用失败"}`);
              }
            }
          }
        }
      }
      return undefined;
    };

    const analysisResult = await runPrompt(analysisSystemPrompt, analysisUserPrompt, "分析报告生成");
    if (!analysisResult) {
      throw new ServiceUnavailableException(
        this.buildReportAttemptFailureMessage("抖音热点找选题生成", preferredModelName, lastError, attemptTrail, "未获取到有效响应"),
      );
    }

    const extractionSystemPrompt = [
      "你将收到一份已经生成好的热点分析报告。",
      "你的任务不是重写报告，而是仅从报告中提取最终可展示的 3 个抖音内容选题。",
      "请只输出一个 JSON 对象，不要输出 Markdown、代码块或额外解释。",
      "JSON 结构固定为：",
      "{",
      '  "title": "标题",',
      '  "summary": "不超过80字的摘要",',
      '  "items": [',
      '    { "title": "选题1", "description": "选题1说明" },',
      '    { "title": "选题2", "description": "选题2说明" },',
      '    { "title": "选题3", "description": "选题3说明" }',
      "  ]",
      "}",
      "items 必须正好返回 3 条。",
      "items[].title 必须是适合直接展示和勾选的内容选题标题，不得直接照抄热点名称、人物名、事件名，也不要只输出一个热点词。",
      "items[].description 必须是该选题自己的说明，突出切入角度、内容亮点或适合怎么做，控制在 30-80 字，3 条说明不得写成同一句套话。",
      "如果报告里没有显式标题，请基于每个热点选题的分析结论提炼成最终内容选题标题。",
      selectedDate ? `这 3 个选题都必须围绕 ${selectedDate} 当天热点展开。` : "这 3 个选题都必须围绕所选日期当天热点展开。",
    ].join("\n");
    const extractionUserPrompt = [
      "以下是原始分析报告，请从中提取页面展示用的 3 个最终选题：",
      "",
      analysisResult.content,
    ].join("\n");
    const extractionResult = await runPrompt(extractionSystemPrompt, extractionUserPrompt, "页面选题提取");

    if (extractionResult) {
      return {
        ...this.normalizeDouyinHotTopicCandidatesModelResult(extractionResult.content, inputPayload, analysisResult.modelName),
        reportContent: analysisResult.content,
      };
    }

    const fallbackResult = this.normalizeDouyinHotTopicCandidatesModelResult(analysisResult.content, inputPayload, analysisResult.modelName);
    return {
      ...fallbackResult,
      reportContent: analysisResult.content,
    };
  }

  private async generateDouyinOriginalCopyByModel(
    skillPrompt: string,
    inputPayload: Record<string, unknown>,
    settings: ModelGenerationSettings,
    options?: {
      onAttemptUpdate?: (detailText: string, modelName: string) => Promise<void> | void;
    },
  ): Promise<DouyinOriginalCopyModelResult> {
    const providers = await this.loadDouyinMarketingProviderConfigs(settings);
    const preferredModelName = settings.preferredModelName || this.parseDelimitedModels(settings.modelName)[0] || "";
    const generationOptions = this.readNestedRecord(inputPayload, ["inputScope", "generationOptions"]);
    const copyTypeLabel = this.readRecordString(generationOptions, "copyTypeLabel") || "原创文案";
    const inputScope = this.readNestedRecord(inputPayload, ["inputScope"]);
    const userRequirement = inputScope ? this.readMetaString(inputScope, "userRequirement") || undefined : undefined;
    const systemPrompt = [
      skillPrompt,
      "",
      `请输出 1 篇${copyTypeLabel}风格的抖音原创文案。`,
      "只输出 Markdown 正文，不要输出 JSON、代码块、执行说明或额外解释。",
      "如果提供了 selectedTopic，文案优先围绕 selectedTopic 展开；如果未提供，则基于品牌资料与 selectedCalendarItem 自主确定内容切入角度。",
      "如果提供了 selectedCalendarItem，则结合日历节点；如果 injectMarketingPlan=true，则融合营销策划方案中的关键策略。",
      userRequirement ? `如果提供了 userRequirement，必须优先满足这条额外要求：${userRequirement}` : "如果提供了 userRequirement，必须优先满足这条额外要求。",
      "请输出可直接交给运营、拍摄或主播执行的内容，避免空话和模板化废话。",
    ].join("\n");
    const userPrompt = ["以下是输入数据：", "", JSON.stringify(inputPayload, null, 2)].join("\n");

    let lastError = "";
    const attemptTrail: string[] = [];
    for (const provider of providers) {
      for (const baseUrl of provider.baseUrls) {
        for (const apiKey of provider.apiKeys.slice(0, 2)) {
          for (const modelName of provider.models) {
            const attemptLabel = this.buildReportAttemptLabel(provider.provider, modelName, baseUrl);
            try {
              await options?.onAttemptUpdate?.(`${provider.provider} / ${modelName}`, modelName);
              const response = await this.requestModelCompletion(
                baseUrl,
                provider.completionPath,
                apiKey,
                this.buildXiaohongshuMarketingProviderPayload(provider, modelName, systemPrompt, userPrompt),
                this.resolveModelAttemptTimeoutMs(provider.requestTimeoutMs, TEXT_MODEL_ATTEMPT_TIMEOUT_MS),
              );
              if (!response.ok) {
                const responseText = this.truncateText(await response.text(), 240);
                const responseDetail = responseText ? ` ${responseText}` : "";
                lastError = `${provider.provider}/${modelName} 请求失败: ${response.status}${responseDetail}`;
                attemptTrail.push(`${attemptLabel} -> HTTP ${response.status}${responseText ? ` ${responseText}` : ""}`);
                continue;
              }
              const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }>; };
              const message = payload.choices?.[0]?.message;
              const content = message?.content?.trim() || message?.reasoning_content?.trim();
              if (!content) {
                lastError = `${provider.provider}/${modelName} 返回为空`;
                attemptTrail.push(`${attemptLabel} -> 返回为空`);
                continue;
              }
              const finishReason = String(payload.choices?.[0]?.finish_reason ?? "").trim().toLowerCase();
              if (finishReason === "length") {
                lastError = `${provider.provider}/${modelName} 输出被截断`;
                attemptTrail.push(`${attemptLabel} -> 输出被截断`);
                continue;
              }
              return this.normalizeDouyinOriginalCopyModelResult(content, inputPayload, modelName);
            } catch (error) {
              lastError = error instanceof Error ? `${provider.provider}/${modelName} 调用失败: ${error.message}` : `${provider.provider}/${modelName} 调用失败`;
              attemptTrail.push(`${attemptLabel} -> ${error instanceof Error ? error.message : "调用失败"}`);
            }
          }
        }
      }
    }

    throw new ServiceUnavailableException(
      this.buildReportAttemptFailureMessage("抖音原创文案生成", preferredModelName, lastError, attemptTrail, "未获取到有效响应"),
    );
  }

  private async generateDouyinRemixStageTextByModel(
    skillPrompt: string,
    inputPayload: Record<string, unknown>,
    settings: ModelGenerationSettings,
    taskLabel: string,
    options?: {
      stageLabel?: string;
      onAttemptUpdate?: (detailText: string, modelName: string) => Promise<void> | void;
    },
  ): Promise<{ content: string; modelName: string }> {
    const providers = await this.loadDouyinMarketingProviderConfigs(settings);
    const preferredModelName = settings.preferredModelName || this.parseDelimitedModels(settings.modelName)[0] || "";
    const systemPrompt = [
      skillPrompt,
      "",
      options?.stageLabel ? `当前阶段：${options.stageLabel}。` : "",
      "只输出 Markdown 正文，不要输出 JSON、代码块、执行说明或额外解释。",
      "如果输入里存在空字段或未提供字段，直接忽略，不要编造事实。",
    ].filter(Boolean).join("\n");
    const userPrompt = ["以下是输入数据：", "", JSON.stringify(inputPayload, null, 2)].join("\n");

    let lastError = "";
    const attemptTrail: string[] = [];
    for (const provider of providers) {
      for (const baseUrl of provider.baseUrls) {
        for (const apiKey of provider.apiKeys.slice(0, 2)) {
          for (const modelName of provider.models) {
            const attemptLabel = this.buildReportAttemptLabel(provider.provider, modelName, baseUrl);
            try {
              await options?.onAttemptUpdate?.(`${provider.provider} / ${modelName}`, modelName);
              const response = await this.requestModelCompletion(
                baseUrl,
                provider.completionPath,
                apiKey,
                this.buildXiaohongshuMarketingProviderPayload(provider, modelName, systemPrompt, userPrompt),
                this.resolveModelAttemptTimeoutMs(provider.requestTimeoutMs, TEXT_MODEL_ATTEMPT_TIMEOUT_MS),
              );
              if (!response.ok) {
                const responseText = this.truncateText(await response.text(), 240);
                lastError = `${provider.provider}/${modelName} 请求失败: ${response.status}${responseText ? ` ${responseText}` : ""}`;
                attemptTrail.push(`${attemptLabel} -> HTTP ${response.status}${responseText ? ` ${responseText}` : ""}`);
                continue;
              }
              const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }>; };
              const message = payload.choices?.[0]?.message;
              const content = message?.content?.trim() || message?.reasoning_content?.trim();
              if (!content) {
                lastError = `${provider.provider}/${modelName} 返回为空`;
                attemptTrail.push(`${attemptLabel} -> 返回为空`);
                continue;
              }
              const finishReason = String(payload.choices?.[0]?.finish_reason ?? "").trim().toLowerCase();
              if (finishReason === "length") {
                lastError = `${provider.provider}/${modelName} 输出被截断`;
                attemptTrail.push(`${attemptLabel} -> 输出被截断`);
                continue;
              }
              return {
                content: this.stripMarkdownCodeFence(content).trim(),
                modelName,
              };
            } catch (error) {
              lastError = error instanceof Error ? `${provider.provider}/${modelName} 调用失败: ${error.message}` : `${provider.provider}/${modelName} 调用失败`;
              attemptTrail.push(`${attemptLabel} -> ${error instanceof Error ? error.message : "调用失败"}`);
            }
          }
        }
      }
    }

    throw new ServiceUnavailableException(
      this.buildReportAttemptFailureMessage(taskLabel, preferredModelName, lastError, attemptTrail, "未获取到有效响应"),
    );
  }

  private buildDouyinHotTopicCandidatesPhaseStatus(
    phase: DouyinHotTopicCandidatesPhase,
    extra?: {
      modelName?: string;
      detailText?: string;
    },
  ) {
    const basePhaseTextMap: Record<DouyinHotTopicCandidatesPhase, string> = {
      PREPARING: "正在准备热点与品牌背景输入数据",
      GENERATING: "正在生成 3 个热点选题",
      PERSISTING: "正在保存热点找选题结果",
      DONE: "热点找选题已生成完成",
    };
    const phaseIndexMap: Record<DouyinHotTopicCandidatesPhase, number> = {
      PREPARING: 1,
      GENERATING: 2,
      PERSISTING: 3,
      DONE: 4,
    };

    return {
      phase,
      phaseText: extra?.detailText ? `${basePhaseTextMap[phase]}（当前尝试：${extra.detailText}）` : basePhaseTextMap[phase],
      phaseIndex: phaseIndexMap[phase],
      phaseTotal: 4,
      ...(extra?.modelName ? { modelName: extra.modelName } : {}),
    };
  }

  private buildOpportunityInsightPhaseStatus(
    phase: OpportunityInsightStepOnePhase,
    extra?: {
      modelName?: string;
      detailText?: string;
    },
  ) {
    const basePhaseTextMap: Record<OpportunityInsightStepOnePhase, string> = {
      PREPARING: "正在准备品牌资料与平台账号样本",
      BRAND_ACCOUNT_ANALYSIS: "正在生成品牌账号分析",
      COMPETITOR_ACCOUNT_ANALYSIS: "正在生成竞品账号分析",
      PERSISTING: "正在保存机会洞察第1步结果",
      DONE: "机会洞察第1步已生成完成",
    };
    const phaseIndexMap: Record<OpportunityInsightStepOnePhase, number> = {
      PREPARING: 1,
      BRAND_ACCOUNT_ANALYSIS: 2,
      COMPETITOR_ACCOUNT_ANALYSIS: 3,
      PERSISTING: 4,
      DONE: 5,
    };

    return {
      phase,
      phaseText: extra?.detailText ? `${basePhaseTextMap[phase]}（当前尝试：${extra.detailText}）` : basePhaseTextMap[phase],
      phaseIndex: phaseIndexMap[phase],
      phaseTotal: 5,
      ...(extra?.modelName ? { modelName: extra.modelName } : {}),
    };
  }

  private buildXiaohongshuMarketingCalendarPhaseStatus(
    phase: XiaohongshuMarketingCalendarPhase,
    extra?: {
      modelName?: string;
      detailText?: string;
    },
  ) {
    const basePhaseTextMap: Record<XiaohongshuMarketingCalendarPhase, string> = {
      PREPARING: "正在准备营销日历输入数据",
      GENERATING: "正在生成 7 天营销日历",
      PERSISTING: "正在保存营销日历结果",
      DONE: "营销日历已生成完成",
    };
    const phaseIndexMap: Record<XiaohongshuMarketingCalendarPhase, number> = {
      PREPARING: 1,
      GENERATING: 2,
      PERSISTING: 3,
      DONE: 4,
    };

    return {
      phase,
      phaseText: extra?.detailText ? `${basePhaseTextMap[phase]}（当前尝试：${extra.detailText}）` : basePhaseTextMap[phase],
      phaseIndex: phaseIndexMap[phase],
      phaseTotal: 4,
      ...(extra?.modelName ? { modelName: extra.modelName } : {}),
    };
  }

  private buildDouyinOriginalCopyPhaseStatus(
    phase: DouyinOriginalCopyPhase,
    extra?: {
      modelName?: string;
      detailText?: string;
    },
  ) {
    const basePhaseTextMap: Record<DouyinOriginalCopyPhase, string> = {
      PREPARING: "正在准备原创文案输入数据",
      GENERATING: "正在生成抖音原创文案",
      PERSISTING: "正在保存原创文案结果",
      DONE: "抖音原创文案已生成完成",
    };
    const phaseIndexMap: Record<DouyinOriginalCopyPhase, number> = {
      PREPARING: 1,
      GENERATING: 2,
      PERSISTING: 3,
      DONE: 4,
    };

    return {
      phase,
      phaseText: extra?.detailText ? `${basePhaseTextMap[phase]}（当前尝试：${extra.detailText}）` : basePhaseTextMap[phase],
      phaseIndex: phaseIndexMap[phase],
      phaseTotal: 4,
      ...(extra?.modelName ? { modelName: extra.modelName } : {}),
    };
  }

  private buildDouyinRemixCopyPhaseStatus(
    phase: DouyinRemixCopyPhase,
    extra?: {
      modelName?: string;
      detailText?: string;
    },
  ) {
    const basePhaseTextMap: Record<DouyinRemixCopyPhase, string> = {
      PREPARING: "正在准备二创文案输入数据",
      EXTRACTING: "正在通过 MathMind 提取素材视频文案",
      ANALYZING: "正在拆解素材视频的开头、正文和结尾",
      GENERATING: "正在生成抖音二创文案",
      PERSISTING: "正在保存二创文案结果",
      DONE: "抖音二创文案已生成完成",
    };
    const phaseIndexMap: Record<DouyinRemixCopyPhase, number> = {
      PREPARING: 1,
      EXTRACTING: 2,
      ANALYZING: 3,
      GENERATING: 4,
      PERSISTING: 5,
      DONE: 6,
    };

    return {
      phase,
      phaseText: extra?.detailText ? `${basePhaseTextMap[phase]}（当前尝试：${extra.detailText}）` : basePhaseTextMap[phase],
      phaseIndex: phaseIndexMap[phase],
      phaseTotal: 6,
      ...(extra?.modelName ? { modelName: extra.modelName } : {}),
    };
  }

  private buildXiaohongshuPhaseStatus(
    phase: XiaohongshuMarketingPlanPhase,
    extra?: {
      modelName?: string;
      detailText?: string;
    },
  ) {
    const basePhaseTextMap: Record<XiaohongshuMarketingPlanPhase, string> = {
      PREPARING: "正在准备输入数据",
      PART_ONE: "第 1 段生成中：基础诊断与定策略",
      PART_TWO: "第 2 段生成中：产品节奏",
      PART_THREE: "第 3 段生成中：内容矩阵",
      PART_FOUR: "第 4 段生成中：资源组合",
      PART_FIVE: "第 5 段生成中：风险边界",
      MERGING: "正在拼接完整 Markdown",
      PERSISTING: "正在保存生成结果",
      DONE: "已生成完成",
    };
    const phaseIndexMap: Record<XiaohongshuMarketingPlanPhase, number> = {
      PREPARING: 1,
      PART_ONE: 2,
      PART_TWO: 3,
      PART_THREE: 4,
      PART_FOUR: 5,
      PART_FIVE: 6,
      MERGING: 7,
      PERSISTING: 8,
      DONE: 9,
    };

    return {
      phase,
      phaseText: extra?.detailText ? `${basePhaseTextMap[phase]}（当前尝试：${extra.detailText}）` : basePhaseTextMap[phase],
      phaseIndex: phaseIndexMap[phase],
      phaseTotal: 9,
      ...(extra?.modelName ? { modelName: extra.modelName } : {}),
    };
  }

  private buildDouyinMarketingPlanPhaseStatus(
    phase: DouyinMarketingPlanPhase,
    extra?: {
      modelName?: string;
      detailText?: string;
    },
  ) {
    const basePhaseTextMap: Record<DouyinMarketingPlanPhase, string> = {
      PREPARING: "正在准备抖音营销策划输入数据",
      GENERATING: "正在生成抖音营销策划方案",
      PERSISTING: "正在保存抖音营销策划方案",
      DONE: "抖音营销策划方案已生成完成",
    };
    const phaseIndexMap: Record<DouyinMarketingPlanPhase, number> = {
      PREPARING: 1,
      GENERATING: 2,
      PERSISTING: 3,
      DONE: 4,
    };

    return {
      phase,
      phaseText: extra?.detailText ? `${basePhaseTextMap[phase]}（当前尝试：${extra.detailText}）` : basePhaseTextMap[phase],
      phaseIndex: phaseIndexMap[phase],
      phaseTotal: 4,
      ...(extra?.modelName ? { modelName: extra.modelName } : {}),
    };
  }

  private normalizeDouyinHotTopicCandidatesModelResult(
    content: string,
    inputPayload: Record<string, unknown>,
    modelName: string,
  ): DouyinHotTopicCandidatesModelResult {
    const archive = this.readNestedRecord(inputPayload, ["inputScope", "brandArchive"]);
    const brandBackground = this.readNestedRecord(archive, ["background"]);
    const dailyHotspots = this.readNestedRecord(inputPayload, ["inputScope", "dailyHotspots"]);
    const fallbackBrandName = this.readRecordString(brandBackground, "brandName") || "品牌";
    const selectedDate = this.readRecordString(dailyHotspots, "selectedDate") || "";

    let parsed: Record<string, unknown> | undefined;
    try {
      parsed = JSON.parse(this.extractJsonObject(content)) as Record<string, unknown>;
    } catch {
      parsed = undefined;
    }

    const rawItems = Array.isArray(parsed?.items) ? parsed?.items : undefined;
    const normalizedItems = rawItems?.length
      ? this.normalizeDouyinHotTopicCandidateItems(rawItems)
      : this.parseDouyinHotTopicCandidateItemsFromText(content);

    if (normalizedItems.length < 3) {
      throw new ServiceUnavailableException("抖音热点找选题解析失败：有效选题不足 3 条");
    }

    return {
      title: String(parsed?.title ?? "").trim() || `${fallbackBrandName}热点找选题`,
      summary: String(parsed?.summary ?? "").trim() || `${selectedDate || "所选日期"}已生成 3 个抖音热点选题。`,
      selectedDate,
      items: normalizedItems.slice(0, 3),
      modelName,
    };
  }

  private normalizeDouyinOriginalCopyModelResult(
    content: string,
    inputPayload: Record<string, unknown>,
    modelName: string,
  ): DouyinOriginalCopyModelResult {
    const topic = this.readNestedRecord(inputPayload, ["inputScope", "selectedTopic"]);
    const calendarItem = this.readNestedRecord(inputPayload, ["inputScope", "selectedCalendarItem"]);
    const generationOptions = this.readNestedRecord(inputPayload, ["inputScope", "generationOptions"]);
    const marketingPlan = this.readNestedRecord(inputPayload, ["inputScope", "douyinMarketingPlan"]);
    const inputScope = this.readNestedRecord(inputPayload, ["inputScope"]);
    const calendarDate = this.readRecordString(calendarItem, "date");
    const calendarTopicName = this.readRecordString(calendarItem, "topicName");
    const topicTitle = this.readRecordString(topic, "topicTitle")
      || this.readRecordString(topic, "title")
      || this.readRecordString(topic, "topicContent")
      || calendarTopicName
      || "不选择选题";
    const topicContent = this.readRecordString(topic, "topicContent") || calendarTopicName || "不选择选题";
    const topicId = this.readRecordString(topic, "id") || (calendarDate || calendarTopicName
      ? `calendar-${this.createSlug([calendarDate, calendarTopicName].filter(Boolean).join("-"))}`
      : `topic-${this.createSlug(topicContent)}`);
    const copyType = this.readRecordString(generationOptions, "copyType") as DouyinOriginalCopyType;
    const copyTypeLabel = this.readRecordString(generationOptions, "copyTypeLabel") || DOUYIN_ORIGINAL_COPY_TYPE_CONFIG[copyType]?.label || "原创文案";
    const normalizedMarkdown = this.stripMarkdownCodeFence(content).trim();

    if (!normalizedMarkdown) {
      throw new ServiceUnavailableException("抖音原创文案解析失败：模型未返回有效 Markdown");
    }
    if (this.containsXiaohongshuWorkflowArtifacts(normalizedMarkdown)) {
      throw new ServiceUnavailableException("抖音原创文案解析失败：模型输出了工作流/文件操作内容，而不是最终文案正文");
    }

    const fallbackTitle = `${topicTitle || topicContent || "抖音原创文案"}｜${copyTypeLabel}`;
    const reportMarkdown = normalizedMarkdown.startsWith("# ")
      ? normalizedMarkdown
      : `# ${fallbackTitle}\n\n${normalizedMarkdown}`;
    const title = this.extractMarkdownTitle(reportMarkdown) || fallbackTitle;
    const summary =
      this.extractMarkdownSummary(reportMarkdown)
      || this.readRecordString(topic, "topicDescription")
      || `${copyTypeLabel}抖音原创文案已生成。`;
    return {
      title,
      summary,
      content: reportMarkdown,
      modelName,
      copyType,
      copyTypeLabel,
      topicId,
      topicTitle,
      topicContent,
      topicDescription: this.readRecordString(topic, "topicDescription") || undefined,
      calendarItemId: this.readRecordString(calendarItem, "id") || undefined,
      calendarItemLabel: calendarDate || calendarTopicName
        ? [calendarDate, calendarTopicName].filter(Boolean).join(" | ")
        : undefined,
      injectMarketingPlan: Boolean(generationOptions?.injectMarketingPlan),
      marketingPlanTitle: this.readRecordString(marketingPlan, "title") || undefined,
      userRequirement: this.readRecordString(inputScope, "userRequirement") || undefined,
    };
  }

  private normalizeVisualOutlineModelResult(
    content: string,
    inputPayload: Record<string, unknown>,
  ): VisualReportOutlineModelResult {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(this.extractJsonObject(this.stripMarkdownCodeFence(content))) as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException("品牌增长可视化报告解析失败：模型未返回有效 JSON");
    }

    const report = this.readNestedRecord(inputPayload, ["inputScope", "growthReport"]);
    const fallbackTitle = this.readRecordString(report, "title") || "品牌增长可视化报告";
    const fallbackSummary = this.readRecordString(report, "summary") || "已生成品牌增长可视化报告。";
    const diagnosis = this.readRecordStringArray(report, "diagnosis");
    const opportunities = this.readRecordStringArray(report, "opportunities");
    const nextActions = this.readRecordStringArray(report, "nextActions");
    const metricRecord = this.readNestedRecord(report, ["metrics"]);
    const fallbackMetrics = [
      { label: "产品数量", value: this.readRecordNumber(metricRecord, "productCount"), note: "品牌资料库已沉淀的产品数" },
      { label: "品牌账号", value: this.readRecordNumber(metricRecord, "platformAccountCount"), note: "已同步的品牌账号数" },
      { label: "竞品账号", value: this.readRecordNumber(metricRecord, "competitorAccountCount"), note: "已同步的竞品账号数" },
      { label: "笔记样本", value: (this.readRecordNumber(metricRecord, "brandNoteCount") || 0) + (this.readRecordNumber(metricRecord, "benchmarkNoteCount") || 0), note: "品牌与对标作品样本总量" },
    ]
      .filter((item) => item.value !== undefined && item.value !== null)
      .map((item) => ({
        label: item.label,
        value: String(item.value),
        note: item.note,
      }));

    const metrics = this.normalizeVisualMetricItems(parsed.metrics, fallbackMetrics);
    const fallbackSections: VisualReportSectionItem[] = [
      {
        title: "核心诊断",
        body: fallbackSummary,
        bullets: diagnosis.slice(0, 4),
      },
      {
        title: "增长机会",
        body: "结合报告中的增长空间，提炼优先突破方向。",
        bullets: opportunities.slice(0, 4),
      },
    ].filter((item) => item.bullets.length || item.body);
    const sections = this.normalizeVisualSectionItems(parsed.sections, fallbackSections);
    const actionItems = this.normalizeStringArray(parsed.actionItems, nextActions.slice(0, 5), 6);

    return {
      title: String(parsed.title ?? "").trim() || fallbackTitle,
      summary: String(parsed.summary ?? "").trim() || fallbackSummary,
      eyebrow: String(parsed.eyebrow ?? "").trim() || "品牌增长可视化",
      heroTitle: String(parsed.heroTitle ?? "").trim() || fallbackTitle,
      heroSubtitle: String(parsed.heroSubtitle ?? "").trim() || fallbackSummary,
      metrics,
      sections,
      actionTitle: String(parsed.actionTitle ?? "").trim() || "下一步行动建议",
      actionItems: actionItems.length ? actionItems : ["结合本报告结论继续补齐数据并推进执行。"],
    };
  }

  private normalizeAnnualMarketingPlanModelResult(
    content: string,
    inputPayload: Record<string, unknown>,
    modelName: string,
  ): AnnualMarketingPlanModelResult {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(this.extractJsonObject(this.stripMarkdownCodeFence(content))) as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException("半年营销规划解析失败：模型未返回有效 JSON");
    }

    const archive = this.readNestedRecord(inputPayload, ["inputScope", "brandArchive"]);
    const brandBackground = this.readNestedRecord(archive, ["background"]);
    const sourceReport = this.readNestedRecord(inputPayload, ["inputScope", "growthReport"]);
    const fallbackBrandName = this.readRecordString(brandBackground, "brandName") || "品牌";
    const fallbackSummary = this.readRecordString(sourceReport, "summary") || "已生成未来半年营销规划。";
    const generatedAt = String(inputPayload.generatedAt ?? "").trim();
    const planningWindow = this.buildHalfYearPlanningWindow(generatedAt);
    const fallbackYear = planningWindow.label;
    const fallbackFocus = [
      "围绕未来半年重点节日与节气建立清晰营销节奏。",
      "打通小红书、抖音、视频号、私域与线下门店的联动动作。",
      "围绕核心产品形成未来半年主题活动与节点承接。",
    ];

    const items = this.normalizeAnnualMarketingPlanRows(parsed.items);
    if (items.length < 12) {
      throw new ServiceUnavailableException("半年营销规划解析失败：有效规划条目不足 12 条");
    }

    return {
      title: String(parsed.title ?? "").trim() || `${fallbackBrandName}${fallbackYear}营销规划`,
      summary: String(parsed.summary ?? "").trim() || fallbackSummary,
      planningYear: String(parsed.planningYear ?? "").trim() || fallbackYear,
      planningFocus: this.normalizeStringArray(parsed.planningFocus, fallbackFocus, 6),
      items,
      modelName,
    };
  }

  private normalizeXiaohongshuMarketingPlanModelResult(
    content: string,
    inputPayload: Record<string, unknown>,
    modelName: string,
  ): XiaohongshuMarketingPlanModelResult {
    const archive = this.readNestedRecord(inputPayload, ["inputScope", "brandArchive"]);
    const brandBackground = this.readNestedRecord(archive, ["background"]);
    const fallbackBrandName = this.readRecordString(brandBackground, "brandName") || "品牌";
    const normalizedMarkdown = this.stripMarkdownCodeFence(content).trim();

    if (!normalizedMarkdown) {
      throw new ServiceUnavailableException("小红书营销策划方案解析失败：模型未返回有效 Markdown");
    }

    if (this.containsXiaohongshuWorkflowArtifacts(normalizedMarkdown)) {
      throw new ServiceUnavailableException("小红书营销策划方案解析失败：模型输出了工作流/文件操作内容，而不是最终 Markdown 正文");
    }

    const reportMarkdown = normalizedMarkdown.startsWith("# ")
      ? normalizedMarkdown
      : `# 小红书品牌营销规划方案

${normalizedMarkdown}`;

    if (!this.isCompleteXiaohongshuMarketingMarkdown(reportMarkdown)) {
      throw new ServiceUnavailableException("小红书营销策划方案解析失败：正文结构不完整，疑似被截断");
    }
    const title = this.extractMarkdownTitle(reportMarkdown) || `${fallbackBrandName}小红书营销策划方案`;
    const summary = this.extractMarkdownSummary(reportMarkdown) || `${fallbackBrandName}的小红书营销策划方案已生成。`;

    return {
      title,
      summary,
      reportMarkdown,
      modelName,
    };
  }

  private normalizeDouyinMarketingPlanModelResult(
    content: string,
    inputPayload: Record<string, unknown>,
    modelName: string,
  ): DouyinMarketingPlanModelResult {
    const archive = this.readNestedRecord(inputPayload, ["inputScope", "brandArchive"]);
    const brandBackground = this.readNestedRecord(archive, ["background"]);
    const fallbackBrandName = this.readRecordString(brandBackground, "brandName") || "品牌";
    const normalizedMarkdown = this.normalizeDouyinMarketingPlanMarkdown(content);

    if (!normalizedMarkdown) {
      throw new ServiceUnavailableException("抖音营销策划方案解析失败：模型未返回有效 Markdown");
    }

    if (this.containsXiaohongshuWorkflowArtifacts(normalizedMarkdown)) {
      throw new ServiceUnavailableException("抖音营销策划方案解析失败：模型输出了工作流/文件操作内容，而不是最终 Markdown 正文");
    }

    const reportMarkdown = normalizedMarkdown.startsWith("# ")
      ? normalizedMarkdown
      : `# 抖音营销策划方案\n\n${normalizedMarkdown}`;

    if (!this.isCompleteDouyinMarketingMarkdown(reportMarkdown)) {
      throw new ServiceUnavailableException("抖音营销策划方案解析失败：正文结构不完整，疑似被截断");
    }
    const title = this.extractMarkdownTitle(reportMarkdown) || `${fallbackBrandName}抖音营销策划方案`;
    const summary = this.extractMarkdownSummary(reportMarkdown) || `${fallbackBrandName}的抖音营销策划方案已生成。`;

    return {
      title,
      summary,
      reportMarkdown,
      modelName,
    };
  }

  private normalizeOpportunityInsightMarkdownModelResult(
    content: string,
    inputPayload: Record<string, unknown>,
    modelName: string,
    taskLabel: string,
  ): OpportunityInsightAccountModelResult {
    const analysisScope = this.readNestedRecord(inputPayload, ["inputScope", "analysisScope"]);
    const brandArchive = this.readNestedRecord(inputPayload, ["inputScope", "brandArchive"]);
    const brandBackground = this.readNestedRecord(brandArchive, ["background"]);
    const brandName = this.readRecordString(brandBackground, "brandName") || "品牌";
    const stepKey = this.readRecordString(analysisScope, "stepKey");
    const stepLabel = this.readRecordString(analysisScope, "stepLabel")
      || (stepKey === "competitorAccountAnalysis"
        ? "竞品账号分析"
        : stepKey === "commentInsightAnalysis"
          ? "评论洞察分析"
          : stepKey === "finalOpportunityReport"
            ? "机会洞察总报告"
            : taskLabel || "品牌账号分析");
    const normalizedMarkdown = this.stripMarkdownCodeFence(content).trim();

    if (!normalizedMarkdown) {
      throw new ServiceUnavailableException(`${stepLabel}解析失败：模型未返回有效 Markdown`);
    }
    if (this.containsXiaohongshuWorkflowArtifacts(normalizedMarkdown)) {
      throw new ServiceUnavailableException(`${stepLabel}解析失败：模型输出了过程性内容，而不是最终正文`);
    }

    const fallbackTitle = `${brandName}${stepLabel}报告`;
    if (this.isLikelyHtmlContent(normalizedMarkdown)) {
      const readableLength = this.countReadableTextLength(normalizedMarkdown);
      if (readableLength < 1600) {
        throw new ServiceUnavailableException(`${stepLabel}解析失败：HTML 正文长度不足，疑似被截断`);
      }
      const htmlTitle = this.extractHtmlTitle(normalizedMarkdown) || fallbackTitle;
      const htmlSummary = this.extractHtmlSummary(normalizedMarkdown) || `${htmlTitle}已生成。`;
      return {
        title: htmlTitle,
        summary: htmlSummary,
        reportMarkdown: normalizedMarkdown,
        modelName,
        reportFormat: "html",
      };
    }

    const reportMarkdown = normalizedMarkdown.startsWith("# ")
      ? normalizedMarkdown
      : `# ${fallbackTitle}\n\n${normalizedMarkdown}`;
    const readableLength = this.countReadableTextLength(reportMarkdown);
    if (readableLength < 1600) {
      throw new ServiceUnavailableException(`${stepLabel}解析失败：正文长度不足，疑似被截断`);
    }

    return {
      title: this.extractMarkdownTitle(reportMarkdown) || fallbackTitle,
      summary: this.extractMarkdownSummary(reportMarkdown) || `${fallbackTitle}已生成。`,
      reportMarkdown,
      modelName,
      reportFormat: "markdown",
    };
  }

  private normalizeDouyinMarketingPlanMarkdown(content: string) {
    let normalizedMarkdown = this.stripMarkdownCodeFence(content).trim();
    if (!normalizedMarkdown) {
      return normalizedMarkdown;
    }

    const firstHeadingMatch = normalizedMarkdown.match(/^#\s+.+$/m);
    if (firstHeadingMatch?.index && firstHeadingMatch.index > 0) {
      const prefix = normalizedMarkdown.slice(0, firstHeadingMatch.index).trim();
      const prefixHasHeading = /^#{1,6}\s+/m.test(prefix);
      if (!prefixHasHeading && prefix.length <= 240) {
        normalizedMarkdown = normalizedMarkdown.slice(firstHeadingMatch.index).trim();
      }
    }

    return normalizedMarkdown;
  }

  private normalizeXiaohongshuMarketingPlanSectionMarkdown(content: string, requiredHeadings: string[]) {
    const normalizedMarkdown = this.stripMarkdownCodeFence(content).trim();
    if (!normalizedMarkdown) {
      throw new ServiceUnavailableException("灏忕孩涔﹁惀閿€绛栧垝鏂规瑙ｆ瀽澶辫触锛氭ā鍨嬫湭杩斿洖鏈夋晥 Markdown");
    }
    if (this.containsXiaohongshuWorkflowArtifacts(normalizedMarkdown)) {
      throw new ServiceUnavailableException("灏忕孩涔﹁惀閿€绛栧垝鏂规瑙ｆ瀽澶辫触锛氭ā鍨嬭緭鍑轰簡鏂囦欢鎿嶄綔/缁啓姝ラ锛岃€屼笉鏄渶缁?Markdown 姝ｆ枃");
    }
    const lines = normalizedMarkdown.split(/\r?\n/);
    const missingHeadings = requiredHeadings.filter((item) => !lines.some((line) => this.matchesXiaohongshuHeading(line, item)));
    if (missingHeadings.length) {
      throw new ServiceUnavailableException(`小红书营销策划方案解析失败：缺少必要章节 ${missingHeadings.join("、")}`);
    }
    return normalizedMarkdown;
  }

  private mergeXiaohongshuMarketingPlanSections(
    firstPart: XiaohongshuMarketingPlanSectionResult,
    secondPart: XiaohongshuMarketingPlanSectionResult,
    thirdPart: XiaohongshuMarketingPlanSectionResult,
    fourthPart: XiaohongshuMarketingPlanSectionResult,
    fifthPart: XiaohongshuMarketingPlanSectionResult,
    inputPayload: Record<string, unknown>,
  ): XiaohongshuMarketingPlanModelResult {
    const archive = this.readNestedRecord(inputPayload, ["inputScope", "brandArchive"]);
    const brandBackground = this.readNestedRecord(archive, ["background"]);
    const fallbackBrandName = this.readRecordString(brandBackground, "brandName") || "品牌";
    const fallbackTitle = `${fallbackBrandName}小红书营销策划方案`;
    const firstMarkdown = this.ensureXiaohongshuMarkdownTitle(firstPart.markdown, fallbackTitle);
    const secondMarkdown = this.ensureXiaohongshuMarkdownTitle(secondPart.markdown, fallbackTitle);
    const thirdMarkdown = this.ensureXiaohongshuMarkdownTitle(thirdPart.markdown, fallbackTitle);
    const fourthMarkdown = this.ensureXiaohongshuMarkdownTitle(fourthPart.markdown, fallbackTitle);
    const fifthMarkdown = this.ensureXiaohongshuMarkdownTitle(fifthPart.markdown, fallbackTitle);
    const title =
      this.extractMarkdownTitle(firstMarkdown) ||
      this.extractMarkdownTitle(secondMarkdown) ||
      this.extractMarkdownTitle(thirdMarkdown) ||
      this.extractMarkdownTitle(fourthMarkdown) ||
      this.extractMarkdownTitle(fifthMarkdown) ||
      fallbackTitle;
    const prefix = this.extractMarkdownPrefixBeforeHeading(firstMarkdown, "## 一、");
    const sectionOne = this.extractMarkdownSection(firstMarkdown, "## 一、", ["## 二、", "## 三、", "## 四、", "## 五、"]);
    const sectionTwo = this.extractMarkdownSection(secondMarkdown, "## 二、", ["## 三、", "## 四、", "## 五、"]);
    const sectionThree = this.extractMarkdownSection(thirdMarkdown, "## 三、", ["## 四、", "## 五、"]);
    const sectionFour = this.extractMarkdownSection(fourthMarkdown, "## 四、", ["## 五、"]);
    const sectionFive = this.extractMarkdownSection(fifthMarkdown, "## 五、", []);

    const missingSections = [
      !sectionOne ? "## 一、" : "",
      !sectionTwo ? "## 二、" : "",
      !sectionThree ? "## 三、" : "",
      !sectionFour ? "## 四、" : "",
      !sectionFive ? "## 五、" : "",
    ].filter(Boolean);
    if (missingSections.length) {
      throw new ServiceUnavailableException(`小红书营销策划方案拼接失败：分段结果缺少必要章节 ${missingSections.join("、")}`);
    }

    const reportMarkdown = [
      `# ${title}`,
      prefix,
      sectionOne,
      sectionTwo,
      sectionThree,
      sectionFour,
      sectionFive,
    ]
      .filter(Boolean)
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!this.isCompleteXiaohongshuMarketingMarkdown(reportMarkdown)) {
      throw new ServiceUnavailableException("小红书营销策划方案拼接失败：最终正文结构不完整");
    }

    return {
      title,
      summary: this.extractMarkdownSummary(reportMarkdown) || `${fallbackBrandName}的小红书营销策划方案已生成。`,
      reportMarkdown,
      modelName: Array.from(
        new Set([
          firstPart.modelName,
          secondPart.modelName,
          thirdPart.modelName,
          fourthPart.modelName,
          fifthPart.modelName,
        ].filter(Boolean)),
      ).join(" + "),
    };
  }

  private normalizeModelResult(content: string): GrowthReportModelResult {
    const raw = this.extractJsonObject(content);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException("品牌增长报告解析失败：模型未返回有效 JSON");
    }

    const diagnosis = Array.isArray(parsed.diagnosis) ? parsed.diagnosis.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
    const opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
    const nextActions = Array.isArray(parsed.nextActions) ? parsed.nextActions.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
    const reportMarkdown = String(parsed.reportMarkdown ?? "").trim();

    if (!reportMarkdown) {
      throw new ServiceUnavailableException("品牌增长报告解析失败：缺少完整报告正文");
    }

    return {
      title: String(parsed.title ?? "品牌增长报告").trim(),
      summary: String(parsed.summary ?? "").trim() || diagnosis[0] || "已生成品牌增长报告。",
      diagnosis: diagnosis.length ? diagnosis : ["已生成完整报告，请查看下方正文。"],
      opportunities: opportunities.length ? opportunities : ["已生成完整报告，请查看下方正文。"],
      nextActions: nextActions.length ? nextActions : ["继续查看完整报告并进入后续策略执行。"],
      reportMarkdown,
    };
  }

  private normalizeVisualModelResult(content: string): VisualReportModelResult {
    const normalizedContent = this.stripMarkdownCodeFence(content).trim();
    try {
      const raw = this.extractJsonObject(normalizedContent);
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      let htmlBody = String(parsed.htmlBody ?? "").trim();
      if (htmlBody.startsWith("{") && htmlBody.includes("\"htmlBody\"")) {
        try {
          const nested = JSON.parse(htmlBody) as Record<string, unknown>;
          htmlBody = String(nested.htmlBody ?? "").trim() || htmlBody;
          return {
            title: String(nested.title ?? parsed.title ?? "品牌增长可视化报告").trim(),
            summary: String(nested.summary ?? parsed.summary ?? "").trim() || "已生成品牌增长可视化报告。",
            htmlBody,
          };
        } catch {
          // Fall through and continue with current htmlBody.
        }
      }
      if (htmlBody) {
        this.assertCompleteVisualHtmlBody(htmlBody);
        return {
          title: String(parsed.title ?? "品牌增长可视化报告").trim(),
          summary: String(parsed.summary ?? "").trim() || "已生成品牌增长可视化报告。",
          htmlBody,
        };
      }
    } catch {
      const extractedHtmlBody = this.extractJsonStringField(normalizedContent, "htmlBody");
      if (extractedHtmlBody) {
        this.assertCompleteVisualHtmlBody(extractedHtmlBody);
        return {
          title: this.extractJsonStringField(normalizedContent, "title") || "品牌增长可视化报告",
          summary: this.extractJsonStringField(normalizedContent, "summary") || "已生成品牌增长可视化报告。",
          htmlBody: extractedHtmlBody,
        };
      }
    }

    const htmlBody = this.extractHtmlBodyContent(normalizedContent);
    if (!htmlBody) {
      throw new ServiceUnavailableException("品牌增长可视化报告解析失败：模型未返回有效 JSON 或 HTML");
    }
    this.assertCompleteVisualHtmlBody(htmlBody);

    return {
      title: "品牌增长可视化报告",
      summary: "已生成品牌增长可视化报告。",
      htmlBody,
    };
  }

  private renderVisualOutlineToResult(outline: VisualReportOutlineModelResult): VisualReportModelResult {
    const htmlBody = this.renderVisualOutlineToHtml(outline);
    this.assertCompleteVisualHtmlBody(htmlBody);
    return {
      title: outline.title,
      summary: outline.summary,
      htmlBody,
    };
  }

  private normalizeAnnualMarketingPlanRows(raw: unknown) {
    const items = Array.isArray(raw) ? raw : [];
    return items
      .map((item) => this.asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        month: String(item.month ?? "").trim(),
        node: String(item.node ?? "").trim(),
        date: String(item.date ?? "").trim(),
        type: String(item.type ?? "").trim(),
        marketingTheme: String(item.marketingTheme ?? "").trim(),
        platforms: this.normalizeStringArray(item.platforms, [], 6),
        strategy: String(item.strategy ?? "").trim(),
        products: this.normalizeStringArray(item.products, [], 6),
      }))
      .filter((item) =>
        item.month
        && item.node
        && item.date
        && item.type
        && item.marketingTheme
        && item.platforms.length
        && item.strategy,
      );
  }

  private buildGrowthAnalysisInput(
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>,
    collection: Awaited<ReturnType<CollectorsService["getXiaohongshuWorkspace"]>>,
    opportunityInsightWorkspace: OpportunityInsightWorkspace,
    generatedAt: string,
  ) {
    return {
      task: "输出《品牌增长报告》",
      generatedAt,
      inputScope: {
        brandArchive: {
          background: archive.brand,
          products: archive.products.map((item) => ({
            productName: item.productName,
            productType: item.productType,
            price: item.price,
            productPositioning: item.productPositioning,
            targetAudience: item.targetAudience,
            painPoint: item.painPoint,
            usageScenario: item.usageScenario,
            differentiators: item.differentiators,
            marketPosition: item.marketPosition,
            detailDescription: this.truncateText(item.detailDescription, 600),
          })),
          survey: archive.survey
            .filter((item) => item.value?.trim())
            .map((item) => ({
              label: item.label,
              value: this.truncateText(item.value, 1000),
            })),
        },
        requiredInputs: {
          brandBackgroundReady: Boolean(
            archive.brand.brandName?.trim()
            || archive.brand.brandDescription?.trim()
            || archive.brand.enterpriseIntro?.trim(),
          ),
          productCount: archive.products.length,
          opportunityInsightReportCount: [
            opportunityInsightWorkspace.brandAccountAnalysis,
            opportunityInsightWorkspace.competitorAccountAnalysis,
            opportunityInsightWorkspace.commentInsightAnalysis,
            opportunityInsightWorkspace.finalOpportunityReport,
          ].filter(Boolean).length,
        },
        opportunityInsightReports: {
          brandAccountAnalysis: opportunityInsightWorkspace.brandAccountAnalysis
            ? {
                title: opportunityInsightWorkspace.brandAccountAnalysis.title,
                summary: opportunityInsightWorkspace.brandAccountAnalysis.summary,
                htmlDocument: this.truncateText(opportunityInsightWorkspace.brandAccountAnalysis.htmlDocument, 16000),
              }
            : undefined,
          competitorAccountAnalysis: opportunityInsightWorkspace.competitorAccountAnalysis
            ? {
                title: opportunityInsightWorkspace.competitorAccountAnalysis.title,
                summary: opportunityInsightWorkspace.competitorAccountAnalysis.summary,
                htmlDocument: this.truncateText(opportunityInsightWorkspace.competitorAccountAnalysis.htmlDocument, 16000),
              }
            : undefined,
          commentInsightAnalysis: opportunityInsightWorkspace.commentInsightAnalysis
            ? {
                title: opportunityInsightWorkspace.commentInsightAnalysis.title,
                summary: opportunityInsightWorkspace.commentInsightAnalysis.summary,
                htmlDocument: this.truncateText(opportunityInsightWorkspace.commentInsightAnalysis.htmlDocument, 16000),
              }
            : undefined,
          finalOpportunityReport: opportunityInsightWorkspace.finalOpportunityReport
            ? {
                title: opportunityInsightWorkspace.finalOpportunityReport.title,
                summary: opportunityInsightWorkspace.finalOpportunityReport.summary,
                htmlDocument: this.truncateText(opportunityInsightWorkspace.finalOpportunityReport.htmlDocument, 16000),
              }
            : undefined,
        },
      },
      outputTarget: "品牌增长报告",
    };
  }

  private buildOpportunityInsightStepOneInput(
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>,
    xiaohongshuWorkspace: Awaited<ReturnType<CollectorsService["getXiaohongshuWorkspace"]>>,
    douyinWorkspace: Awaited<ReturnType<CollectorsService["getDouyinWorkspace"]>>,
    generatedAt: string,
    stepKey: "brandAccountAnalysis" | "competitorAccountAnalysis",
    supplementInput?: string,
  ) {
    const isBrand = stepKey === "brandAccountAnalysis";
    const xhsAccounts = isBrand ? xiaohongshuWorkspace.brandAccounts : xiaohongshuWorkspace.competitorAccounts;
    const xhsNotes = isBrand ? xiaohongshuWorkspace.brandNotes : xiaohongshuWorkspace.benchmarkNotes;
    const douyinAccounts = isBrand ? douyinWorkspace.brandAccounts : douyinWorkspace.competitorAccounts;
    const douyinWorks = isBrand
      ? douyinWorkspace.brandWorks
      : [...douyinWorkspace.competitorWorks, ...douyinWorkspace.benchmarkWorks];

    return {
      task: isBrand ? "输出《品牌账号分析》" : "输出《竞品账号分析》",
      generatedAt,
      inputScope: {
        analysisScope: {
          stepKey,
          stepLabel: isBrand ? "品牌账号分析" : "竞品账号分析",
          platforms: ["小红书", "抖音"],
        },
        userRequirement: supplementInput ? { text: supplementInput } : undefined,
        brandArchive: {
          background: archive.brand,
          products: archive.products.slice(0, 12).map((item) => ({
            productName: item.productName,
            productType: item.productType,
            price: item.price,
            productPositioning: item.productPositioning,
            targetAudience: item.targetAudience,
            painPoint: item.painPoint,
            usageScenario: item.usageScenario,
            differentiators: item.differentiators,
            marketPosition: item.marketPosition,
            detailDescription: this.truncateText(item.detailDescription, 240),
          })),
          survey: archive.survey
            .filter((item) => item.value?.trim())
            .slice(0, 18)
            .map((item) => ({
              label: item.label,
              value: this.truncateText(item.value, 360),
            })),
          businessAssets: archive.businessAssets.slice(0, 10).map((item) => ({
            title: item.title,
            description: this.truncateText(item.description, 220),
            sourceName: item.sourceName,
          })),
        },
        xiaohongshuData: {
          accountCount: xhsAccounts.length,
          noteCount: xhsNotes.length,
          accounts: xhsAccounts.slice(0, 20).map((item) => ({
            accountName: item.accountName,
            sourceAccountLink: item.sourceAccountLink,
            fanCount: item.fanCount,
            postedCount: item.postedCount,
            likedCount: item.likedCount,
            description: this.truncateText(item.description, 280),
          })),
          notes: xhsNotes.slice(0, 25).map((item) => ({
            title: item.title,
            noteType: item.noteType,
            nickname: item.nickname,
            noteUrl: item.noteUrl,
            likeCount: item.likeCount,
            commentCount: item.commentCount,
            collectCount: item.collectCount,
            shareCount: item.shareCount,
            description: this.truncateText(item.description, 320),
          })),
        },
        douyinData: {
          accountCount: douyinAccounts.length,
          workCount: douyinWorks.length,
          accounts: douyinAccounts.slice(0, 20).map((item) => ({
            accountName: item.accountName,
            accountLink: item.accountLink,
            followerCount: this.readRecordNumber(this.asRecord(item as unknown), "followerCount"),
            totalFavorited: this.readRecordNumber(this.asRecord(item as unknown), "totalFavorited"),
            description: this.truncateText(this.readRecordString(this.asRecord(item as unknown), "description"), 280),
          })),
          works: douyinWorks.slice(0, 25).map((item) => ({
            title: item.title,
            workUrl: item.workUrl,
            authorNickname: item.authorName,
            likeCount: item.likeCount,
            commentCount: item.commentCount,
            shareCount: item.shareCount,
            collectCount: item.collectCount,
            publishTime: item.publishTimeText,
            description: this.truncateText(item.description, 320),
          })),
        },
      },
      outputTarget: isBrand ? "品牌账号分析报告" : "竞品账号分析报告",
    };
  }

  private buildOpportunityInsightStepTwoInput(
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>,
    douyinWorkspace: Awaited<ReturnType<CollectorsService["getDouyinWorkspace"]>>,
    generatedAt: string,
    supplementInput?: string,
  ) {
    const manualSupplementComments = this.extractOpportunityInsightSupplementComments(supplementInput);
    const mergedComments = [
      ...douyinWorkspace.commentData.map((item) => ({
        source: "douyinWorkspace",
        sourceWorkId: item.sourceWorkId,
        sourceWorkUrl: item.sourceWorkUrl,
        commentId: item.commentId,
        commentText: this.truncateText(item.commentText, 220),
        commentTime: item.commentTime,
        commentUserName: item.commentUserName,
        likeCount: item.likeCount,
        replyCount: item.replyCount,
      })),
      ...manualSupplementComments.map((item, index) => ({
        source: "manualSupplement",
        sourceWorkId: item.sourceWorkId || "",
        sourceWorkUrl: item.sourceWorkUrl || "",
        commentId: item.commentId || `manual-supplement-${index + 1}`,
        commentText: this.truncateText(item.commentText, 220),
        commentTime: item.commentTime,
        commentUserName: item.commentUserName,
        likeCount: item.likeCount,
        replyCount: item.replyCount,
        productTitle: item.productTitle,
        ratingText: item.ratingText,
        orderId: item.orderId,
      })),
    ].slice(0, 120);
    const totalCommentCount = douyinWorkspace.commentData.length + manualSupplementComments.length;
    return {
      task: "输出《评论洞察分析》",
      generatedAt,
      inputScope: {
        analysisScope: {
          stepKey: "commentInsightAnalysis",
          stepLabel: "评论洞察分析",
          sourcePriority: ["抖音评论数据", "企业知识库评论资料"],
        },
        userRequirement: supplementInput ? { text: supplementInput } : undefined,
        brandArchive: {
          background: archive.brand,
          products: archive.products.slice(0, 12).map((item) => ({
            productName: item.productName,
            productType: item.productType,
            price: item.price,
            targetAudience: item.targetAudience,
            painPoint: item.painPoint,
            usageScenario: item.usageScenario,
            differentiators: item.differentiators,
            detailDescription: this.truncateText(item.detailDescription, 240),
          })),
          survey: archive.survey
            .filter((item) => item.value?.trim())
            .slice(0, 12)
            .map((item) => ({
              label: item.label,
              value: this.truncateText(item.value, 320),
            })),
        },
        douyinCommentData: {
          commentCount: totalCommentCount,
          platformCommentCount: douyinWorkspace.commentData.length,
          manualSupplementCommentCount: manualSupplementComments.length,
          comments: mergedComments,
          manualSupplementSummary: manualSupplementComments.length
            ? {
                rawTextLength: supplementInput?.length || 0,
                parsedCommentCount: manualSupplementComments.length,
                rawTextPreview: this.truncateText(supplementInput || "", 2000),
              }
            : undefined,
        },
      },
      outputTarget: "评论洞察分析报告",
    };
  }

  private extractOpportunityInsightSupplementComments(supplementInput?: string) {
    const normalized = typeof supplementInput === "string" ? supplementInput.replace(/\r/g, "").trim() : "";
    if (!normalized) {
      return [] as Array<{
        commentText: string;
        commentTime?: string;
        commentUserName?: string;
        likeCount?: number;
        replyCount?: number;
        productTitle?: string;
        ratingText?: string;
        orderId?: string;
        sourceWorkId?: string;
        sourceWorkUrl?: string;
        commentId?: string;
      }>;
    }

    const blocks = normalized
      .split(/\n\s*\n+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 20 && this.looksLikeOpportunityInsightCommentBlock(item));

    return blocks.slice(0, 240).map((block, index) => {
      const commentText =
        this.readOpportunityInsightSupplementField(block, ["用户评论", "评论内容", "评价内容", "评价详情"])
        || this.truncateText(block.replace(/\s+/g, " ").trim(), 220);
      return {
        commentId: `manual-${index + 1}`,
        commentText,
        commentTime: this.readOpportunityInsightSupplementField(block, ["评论时间", "下单时间", "时间"]) || undefined,
        commentUserName: this.readOpportunityInsightSupplementField(block, ["买家昵称", "用户昵称", "用户名称", "用户"]) || undefined,
        likeCount: this.readOpportunityInsightSupplementNumber(block, ["被点赞数", "点赞数", "点赞/互动"]),
        replyCount: this.readOpportunityInsightSupplementNumber(block, ["回复数", "互动数", "回复/互动"]),
        productTitle: this.readOpportunityInsightSupplementField(block, ["商品标题", "商品名称", "商品"]) || undefined,
        ratingText: this.readOpportunityInsightSupplementField(block, ["用户评价分", "评分", "评价分"]) || undefined,
        orderId: this.readOpportunityInsightSupplementField(block, ["订单编号", "订单号"]) || undefined,
        sourceWorkId: undefined,
        sourceWorkUrl: undefined,
      };
    }).filter((item) => item.commentText.trim());
  }

  private looksLikeOpportunityInsightCommentBlock(block: string) {
    const markers = [
      "用户评论",
      "评论内容",
      "评价内容",
      "用户评价分",
      "商品标题",
      "商品名称",
      "订单编号",
      "订单号",
      "被点赞数",
      "回复数",
      "买家昵称",
      "用户昵称",
    ];
    const matchedMarkerCount = markers.filter((marker) => block.includes(marker)).length;
    return matchedMarkerCount >= 2;
  }

  private readOpportunityInsightSupplementField(block: string, labels: string[]) {
    for (const label of labels) {
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`${escapedLabel}[：:]\\s*([\\s\\S]*?)(?=\\n\\S+[：:]|$)`, "i");
      const match = pattern.exec(block);
      const value = match?.[1]?.replace(/\s+/g, " ").trim();
      if (value) {
        return value;
      }
    }
    return "";
  }

  private readOpportunityInsightSupplementNumber(block: string, labels: string[]) {
    const rawValue = this.readOpportunityInsightSupplementField(block, labels);
    if (!rawValue) {
      return undefined;
    }
    const match = rawValue.match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return undefined;
    }
    const value = Number(match[0]);
    return Number.isFinite(value) ? value : undefined;
  }

  private buildOpportunityInsightStepThreeInput(
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>,
    workspace: OpportunityInsightWorkspace,
    generatedAt: string,
    supplementInput?: string,
  ) {
    return {
      task: "输出《机会洞察总报告》",
      generatedAt,
      inputScope: {
        analysisScope: {
          stepKey: "finalOpportunityReport",
          stepLabel: "机会洞察总报告",
          sourceSteps: ["品牌账号分析", "竞品账号分析", "评论洞察分析"],
        },
        userRequirement: supplementInput ? { text: supplementInput } : undefined,
        brandArchive: {
          background: archive.brand,
          products: archive.products.slice(0, 12).map((item) => ({
            productName: item.productName,
            productType: item.productType,
            price: item.price,
            targetAudience: item.targetAudience,
            painPoint: item.painPoint,
            usageScenario: item.usageScenario,
            differentiators: item.differentiators,
            marketPosition: item.marketPosition,
            detailDescription: this.truncateText(item.detailDescription, 240),
          })),
          survey: archive.survey
            .filter((item) => item.value?.trim())
            .slice(0, 16)
            .map((item) => ({
              label: item.label,
              value: this.truncateText(item.value, 360),
            })),
          businessAssets: archive.businessAssets.slice(0, 10).map((item) => ({
            title: item.title,
            description: this.truncateText(item.description, 220),
            sourceName: item.sourceName,
          })),
        },
        priorReports: {
          brandAccountAnalysis: workspace.brandAccountAnalysis
            ? {
                title: workspace.brandAccountAnalysis.title,
                summary: workspace.brandAccountAnalysis.summary,
                htmlDocument: this.truncateText(workspace.brandAccountAnalysis.htmlDocument, 12000),
              }
            : undefined,
          competitorAccountAnalysis: workspace.competitorAccountAnalysis
            ? {
                title: workspace.competitorAccountAnalysis.title,
                summary: workspace.competitorAccountAnalysis.summary,
                htmlDocument: this.truncateText(workspace.competitorAccountAnalysis.htmlDocument, 12000),
              }
            : undefined,
          commentInsightAnalysis: workspace.commentInsightAnalysis
            ? {
                title: workspace.commentInsightAnalysis.title,
                summary: workspace.commentInsightAnalysis.summary,
                htmlDocument: this.truncateText(workspace.commentInsightAnalysis.htmlDocument, 12000),
              }
            : undefined,
        },
      },
      outputTarget: "机会洞察总报告",
    };
  }

  private buildVisualReportInput(sourceReport: GrowthReportRecord, generatedAt: string) {
    return {
      task: "输出《品牌增长可视化报告》",
      generatedAt,
      inputScope: {
        growthReport: {
          id: sourceReport.id,
          title: sourceReport.title,
          summary: sourceReport.summary,
          generatedAt: sourceReport.generatedAt,
          reportMarkdown: this.truncateText(sourceReport.reportMarkdown, 3600),
          diagnosis: sourceReport.diagnosis,
          opportunities: sourceReport.opportunities,
          nextActions: sourceReport.nextActions,
          metrics: sourceReport.metrics,
        },
      },
      outputTarget: "品牌增长可视化报告",
    };
  }

  private buildHalfYearPlanningWindow(generatedAt: string) {
    const referenceDate = Number.isFinite(Date.parse(generatedAt)) ? new Date(generatedAt) : new Date();
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const monthLabels = Array.from({ length: 6 }, (_, index) => {
      const cursor = new Date(year, month + index, 1);
      return `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;
    });
    return {
      label: `${monthLabels[0]}-${monthLabels[5]}`,
      monthLabels,
    };
  }

  private buildAnnualMarketingPlanInput(
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>,
    sourceReport: GrowthReportRecord,
    generatedAt: string,
    userRequirement?: string,
  ) {
    const planningWindow = this.buildHalfYearPlanningWindow(generatedAt);
    return {
      task: "输出《半年营销规划》",
      generatedAt,
      inputScope: {
        brandArchive: {
          background: archive.brand,
          products: archive.products.map((item) => ({
            productName: item.productName,
            productType: item.productType,
            price: item.price,
            targetAudience: item.targetAudience,
            usageScenario: item.usageScenario,
            differentiators: item.differentiators,
            marketPosition: item.marketPosition,
            detailDescription: this.truncateText(item.detailDescription, 240),
          })),
          survey: archive.survey
            .filter((item) => item.value?.trim())
            .slice(0, 18)
            .map((item) => ({
              label: item.label,
              value: this.truncateText(item.value, 360),
            })),
          industryFeeds: archive.industryFeeds.slice(0, 8).map((item) => ({
            title: item.title,
            description: this.truncateText(item.description, 220),
            sourceName: item.sourceName,
          })),
          businessAssets: archive.businessAssets.slice(0, 8).map((item) => ({
            title: item.title,
            description: this.truncateText(item.description, 220),
            sourceName: item.sourceName,
          })),
        },
        growthReport: {
          id: sourceReport.id,
          title: sourceReport.title,
          summary: sourceReport.summary,
          generatedAt: sourceReport.generatedAt,
          diagnosis: sourceReport.diagnosis,
          opportunities: sourceReport.opportunities,
          nextActions: sourceReport.nextActions,
          reportMarkdown: this.truncateText(sourceReport.reportMarkdown, 3200),
        },
        planningWindow: {
          label: planningWindow.label,
          monthLabels: planningWindow.monthLabels,
        },
        userRequirement: userRequirement ? { text: userRequirement } : undefined,
      },
      outputTarget: "半年营销规划",
    };
  }

  private buildXiaohongshuMarketingPlanInput(
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>,
    collection: Awaited<ReturnType<CollectorsService["getXiaohongshuWorkspace"]>>,
    sourceReport: GrowthReportRecord,
    opportunityReport: OpportunityInsightReportRecord,
    generatedAt: string,
    userRequirement?: string,
  ) {
    return {
      task: "输出《小红书营销策划方案》",
      generatedAt,
      inputScope: {
        brandArchive: {
          background: archive.brand,
          products: archive.products.map((item) => {
            const record = this.asRecord(item as unknown);
            return {
              productName: item.productName,
              productType: item.productType,
              price: item.price,
              productPositioning: item.productPositioning,
              targetAudience: item.targetAudience,
              painPoint: item.painPoint,
              usageScenario: item.usageScenario,
              differentiators: item.differentiators,
              marketPosition: item.marketPosition,
              detailDescription: this.truncateText(item.detailDescription, 280),
              competitorName: this.readRecordString(record, "competitorName"),
              competitorPrice: this.readRecordString(record, "competitorPrice"),
              competitorPositioning: this.readRecordString(record, "competitorPositioning"),
              competitorPainPoint: this.readRecordString(record, "competitorPainPoint"),
              competitorScenario: this.readRecordString(record, "competitorScenario"),
              competitorMarketPosition: this.readRecordString(record, "competitorMarketPosition"),
              competitorDescription: this.truncateText(this.readRecordString(record, "competitorDescription"), 240),
            };
          }),
          survey: archive.survey
            .filter((item) => item.value?.trim())
            .slice(0, 20)
            .map((item) => ({
              label: item.label,
              value: this.truncateText(item.value, 360),
            })),
          industryFeeds: archive.industryFeeds.slice(0, 10).map((item) => ({
            title: item.title,
            description: this.truncateText(item.description, 240),
            sourceName: item.sourceName,
          })),
          businessAssets: archive.businessAssets.slice(0, 10).map((item) => ({
            title: item.title,
            description: this.truncateText(item.description, 240),
            sourceName: item.sourceName,
          })),
        },
        xiaohongshuCollectionSupplement: {
          brandAccounts: collection.brandAccounts.map((item) => ({
            accountName: item.accountName,
            sourceAccountLink: item.sourceAccountLink,
            fanCount: item.fanCount,
            postedCount: item.postedCount,
            likedCount: item.likedCount,
            description: this.truncateText(item.description, 280),
          })),
          competitorAccounts: collection.competitorAccounts.map((item) => ({
            accountName: item.accountName,
            sourceAccountLink: item.sourceAccountLink,
            fanCount: item.fanCount,
            postedCount: item.postedCount,
            likedCount: item.likedCount,
            description: this.truncateText(item.description, 280),
          })),
          brandNotes: collection.brandNotes.slice(0, 24).map((item) => ({
            title: item.title,
            noteType: item.noteType,
            nickname: item.nickname,
            noteUrl: item.noteUrl,
            likeCount: item.likeCount,
            commentCount: item.commentCount,
            collectCount: item.collectCount,
            shareCount: item.shareCount,
            isExplosive: item.isExplosive,
            description: this.truncateText(item.description, 320),
          })),
          benchmarkNotes: collection.benchmarkNotes.slice(0, 24).map((item) => ({
            title: item.title,
            noteType: item.noteType,
            nickname: item.nickname,
            noteUrl: item.noteUrl,
            likeCount: item.likeCount,
            commentCount: item.commentCount,
            collectCount: item.collectCount,
            shareCount: item.shareCount,
            likeCollectRatio: item.likeCollectRatio,
            likeCommentRatio: item.likeCommentRatio,
            shareRatio: item.shareRatio,
            isExplosive: item.isExplosive,
            isSelected: item.followUpDecision,
            description: this.truncateText(item.description, 320),
          })),
        },
        growthReport: {
          id: sourceReport.id,
          title: sourceReport.title,
          summary: sourceReport.summary,
          generatedAt: sourceReport.generatedAt,
          diagnosis: sourceReport.diagnosis,
          opportunities: sourceReport.opportunities,
          nextActions: sourceReport.nextActions,
          reportMarkdown: this.truncateText(sourceReport.reportMarkdown, 4200),
        },
        opportunityInsightReport: {
          id: opportunityReport.id,
          title: opportunityReport.title,
          summary: opportunityReport.summary,
          generatedAt: opportunityReport.generatedAt,
          htmlBody: this.truncateText(opportunityReport.htmlBody, 4200),
        },
        requiredInputs: {
          brandBackground: "品牌背景资料",
          productLibrary: "产品资料库",
          opportunityInsightReport: "机会洞察总报告",
          growthReport: "品牌增长报告",
        },
        userRequirement: userRequirement ? { text: userRequirement } : undefined,
      },
      outputTarget: "小红书营销策划方案",
    };
  }

  private buildDouyinMarketingPlanInput(
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>,
    collection: Awaited<ReturnType<CollectorsService["getDouyinWorkspace"]>>,
    sourceReport: GrowthReportRecord,
    opportunityReport: OpportunityInsightReportRecord,
    generatedAt: string,
    userRequirement?: string,
  ) {
    return {
      task: "输出《抖音营销策划方案》",
      generatedAt,
      inputScope: {
        brandArchive: {
          background: archive.brand,
          products: archive.products.map((item) => {
            const record = this.asRecord(item as unknown);
            return {
              productName: item.productName,
              productType: item.productType,
              price: item.price,
              productPositioning: item.productPositioning,
              targetAudience: item.targetAudience,
              painPoint: item.painPoint,
              usageScenario: item.usageScenario,
              differentiators: item.differentiators,
              marketPosition: item.marketPosition,
              detailDescription: this.truncateText(item.detailDescription, 280),
              competitorName: this.readRecordString(record, "competitorName"),
              competitorPrice: this.readRecordString(record, "competitorPrice"),
              competitorPositioning: this.readRecordString(record, "competitorPositioning"),
              competitorPainPoint: this.readRecordString(record, "competitorPainPoint"),
              competitorScenario: this.readRecordString(record, "competitorScenario"),
              competitorMarketPosition: this.readRecordString(record, "competitorMarketPosition"),
              competitorDescription: this.truncateText(this.readRecordString(record, "competitorDescription"), 240),
            };
          }),
          survey: archive.survey
            .filter((item) => item.value?.trim())
            .slice(0, 20)
            .map((item) => ({
              label: item.label,
              value: this.truncateText(item.value, 360),
            })),
          industryFeeds: archive.industryFeeds.slice(0, 10).map((item) => ({
            title: item.title,
            description: this.truncateText(item.description, 240),
            sourceName: item.sourceName,
          })),
          businessAssets: archive.businessAssets.slice(0, 10).map((item) => ({
            title: item.title,
            description: this.truncateText(item.description, 240),
            sourceName: item.sourceName,
          })),
        },
        douyinCollectionSupplement: {
          brandAccounts: collection.brandAccounts.map((item) => ({
            accountName: item.accountName,
            accountLink: item.accountLink,
            sourceAccountLink: item.sourceAccountLink,
            fanCount: item.fanCount,
            postedCount: item.postedCount,
            likedCount: item.likedCount,
            followCount: item.followCount,
            description: this.truncateText(item.description, 280),
            enterpriseVerifyReason: item.enterpriseVerifyReason,
            customVerify: item.customVerify,
          })),
          competitorAccounts: collection.competitorAccounts.map((item) => ({
            accountName: item.accountName,
            accountLink: item.accountLink,
            sourceAccountLink: item.sourceAccountLink,
            fanCount: item.fanCount,
            postedCount: item.postedCount,
            likedCount: item.likedCount,
            followCount: item.followCount,
            description: this.truncateText(item.description, 280),
            enterpriseVerifyReason: item.enterpriseVerifyReason,
            customVerify: item.customVerify,
          })),
          brandWorks: collection.brandWorks.slice(0, 30).map((item) => ({
            title: item.title,
            description: this.truncateText(item.description, 320),
            workUrl: item.workUrl,
            coverUrl: item.coverUrl,
            videoUrl: item.videoUrl,
            authorName: item.authorName,
            workType: item.workType,
            publishTimeText: item.publishTimeText,
            durationSeconds: item.durationMs ? Math.round(item.durationMs / 1000) : undefined,
            likeCount: item.likeCount,
            commentCount: item.commentCount,
            shareCount: item.shareCount,
            collectCount: item.collectCount,
            playCount: item.playCount,
            downloadCount: item.downloadCount,
            recommendCount: item.recommendCount,
            hashtags: item.hashtags,
            musicTitle: item.musicTitle,
            musicAuthor: item.musicAuthor,
            isExplosive: item.isExplosive,
          })),
          benchmarkWorks: collection.benchmarkWorks.slice(0, 30).map((item) => ({
            title: item.title,
            description: this.truncateText(item.description, 320),
            workUrl: item.workUrl,
            coverUrl: item.coverUrl,
            videoUrl: item.videoUrl,
            authorName: item.authorName,
            workType: item.workType,
            publishTimeText: item.publishTimeText,
            durationSeconds: item.durationMs ? Math.round(item.durationMs / 1000) : undefined,
            likeCount: item.likeCount,
            commentCount: item.commentCount,
            shareCount: item.shareCount,
            collectCount: item.collectCount,
            playCount: item.playCount,
            downloadCount: item.downloadCount,
            recommendCount: item.recommendCount,
            likeCollectRatio: item.likeCollectRatio,
            likeCommentRatio: item.likeCommentRatio,
            shareRatio: item.shareRatio,
            hashtags: item.hashtags,
            musicTitle: item.musicTitle,
            musicAuthor: item.musicAuthor,
            isExplosive: item.isExplosive,
            followUpDecision: item.followUpDecision,
          })),
          summary: {
            brandAccountCount: collection.brandAccounts.length,
            competitorAccountCount: collection.competitorAccounts.length,
            brandWorkCount: collection.brandWorks.length,
            benchmarkWorkCount: collection.benchmarkWorks.length,
          },
        },
        growthReport: {
          id: sourceReport.id,
          title: sourceReport.title,
          summary: sourceReport.summary,
          generatedAt: sourceReport.generatedAt,
          diagnosis: sourceReport.diagnosis,
          opportunities: sourceReport.opportunities,
          nextActions: sourceReport.nextActions,
          reportMarkdown: this.truncateText(sourceReport.reportMarkdown, 4200),
        },
        opportunityInsightReport: {
          id: opportunityReport.id,
          title: opportunityReport.title,
          summary: opportunityReport.summary,
          generatedAt: opportunityReport.generatedAt,
          htmlBody: this.truncateText(opportunityReport.htmlBody, 4200),
        },
        requiredInputs: {
          brandBackground: "品牌背景资料",
          productLibrary: "产品资料库",
          opportunityInsightReport: "机会洞察总报告",
          growthReport: "品牌增长报告",
        },
        userRequirement: userRequirement ? { text: userRequirement } : undefined,
      },
      outputTarget: "抖音营销策划方案",
    };
  }

  private buildDouyinHotTopicCandidatesInput(
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>,
    dailyHotspots: Awaited<ReturnType<CollectorsService["getDailyHotspotWorkspace"]>>,
    generatedAt: string,
  ) {
    return {
      task: "输出《抖音热点找选题》",
      generatedAt,
      inputScope: {
        brandArchive: {
          background: archive.brand,
          products: archive.products.map((item) => ({
            productName: item.productName,
            productType: item.productType,
            price: item.price,
            productPositioning: item.productPositioning,
            targetAudience: item.targetAudience,
            usageScenario: item.usageScenario,
            differentiators: item.differentiators,
            marketPosition: item.marketPosition,
            detailDescription: this.truncateText(item.detailDescription, 240),
          })),
          survey: archive.survey
            .filter((item) => item.value?.trim())
            .slice(0, 20)
            .map((item) => ({
              label: item.label,
              value: this.truncateText(item.value, 220),
            })),
          platformAccounts: archive.platformAccounts.slice(0, 20).map((item) => ({
            platform: item.platform,
            accountName: item.accountName,
            accountLink: item.accountLink,
          })),
          competitorAccounts: archive.competitorAccounts.slice(0, 20).map((item) => ({
            platform: item.platform,
            accountName: item.accountName,
            accountLink: item.accountLink,
          })),
        },
        dailyHotspots: {
          selectedDate: dailyHotspots.selectedDate,
          platforms: dailyHotspots.platforms.map((platform) => ({
            title: platform.title,
            platformKey: platform.platformKey,
            boardType: platform.boardType,
            snapshotDate: platform.snapshotDate,
            description: platform.description,
            sourceLink: platform.sourceLink,
            updateTime: platform.updateTime,
            total: platform.total,
            items: platform.items.map((item) => ({
              rank: item.rank,
              title: item.title,
              hot: item.hot,
              url: item.url || item.mobileUrl,
              timestamp: item.timestamp,
            })),
          })),
        },
      },
      outputRequirement: {
        itemCount: 3,
        displayMode: "one-topic-per-line",
        withCheckbox: true,
      },
      outputTarget: "抖音热点选题",
    };
  }

  private buildDouyinOriginalCopyInput(
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>,
    topic: {
      id: string;
      topicTitle?: string;
      topicContent: string;
      topicDescription?: string;
    } | undefined,
    selectedCalendarItem: XiaohongshuMarketingCalendarItem | undefined,
    marketingPlan: DouyinMarketingPlanRecord | undefined,
    copyType: DouyinOriginalCopyType,
    injectMarketingPlan: boolean,
    userRequirement: string | undefined,
    generatedAt: string,
  ) {
    const copyTypeConfig = DOUYIN_ORIGINAL_COPY_TYPE_CONFIG[copyType];
    return {
      task: "输出《抖音原创文案》",
      generatedAt,
      inputScope: {
        brandArchive: {
          background: archive.brand,
          products: archive.products.map((item) => ({
            productName: item.productName,
            productType: item.productType,
            price: item.price,
            productPositioning: item.productPositioning,
            targetAudience: item.targetAudience,
            usageScenario: item.usageScenario,
            differentiators: item.differentiators,
            marketPosition: item.marketPosition,
            detailDescription: this.truncateText(item.detailDescription, 240),
          })),
          survey: archive.survey
            .filter((item) => item.value?.trim())
            .slice(0, 20)
            .map((item) => ({
              label: item.label,
              value: this.truncateText(item.value, 220),
            })),
          platformAccounts: archive.platformAccounts.slice(0, 20).map((item) => ({
            platform: item.platform,
            accountName: item.accountName,
            accountLink: item.accountLink,
          })),
          competitorAccounts: archive.competitorAccounts.slice(0, 20).map((item) => ({
            platform: item.platform,
            accountName: item.accountName,
            accountLink: item.accountLink,
          })),
        },
        selectedTopic: topic
          ? {
              id: topic.id,
              topicTitle: topic.topicTitle || topic.topicContent,
              topicContent: topic.topicContent,
              topicDescription: topic.topicDescription || "",
            }
          : undefined,
        selectedCalendarItem: selectedCalendarItem
          ? this.buildMarketingCalendarWorkflowSelection(selectedCalendarItem)
          : undefined,
        douyinMarketingPlan: marketingPlan && injectMarketingPlan
          ? {
              id: marketingPlan.id,
              title: marketingPlan.title,
              summary: marketingPlan.summary,
              reportMarkdown: this.truncateText(marketingPlan.reportMarkdown, 6000),
            }
          : undefined,
        userRequirement: userRequirement || undefined,
        generationOptions: {
          copyType,
          copyTypeLabel: copyTypeConfig.label,
          injectMarketingPlan,
        },
      },
      outputRequirement: {
        format: "markdown",
        outputType: "可直接执行的抖音原创文案",
        copyTypeLabel: copyTypeConfig.label,
        injectMarketingPlan,
        userRequirement: userRequirement || undefined,
      },
      outputTarget: `抖音原创文案-${copyTypeConfig.label}`,
    };
  }

  private buildDouyinRemixBreakdownInput(
    material: DouyinRemixCopyMaterialOption,
    extractedCopy: string,
    generatedAt: string,
  ) {
    return {
      task: "拆解抖音素材视频文案",
      generatedAt,
      inputScope: {
        sourceMaterial: {
          id: material.id,
          title: material.title,
          videoUrl: material.videoUrl,
          authorName: material.authorName,
          workUrl: material.workUrl,
        },
        extractedCopy,
      },
      outputRequirement: {
        format: "markdown",
        outputType: "拆解结果",
      },
    };
  }

  private buildDouyinRemixCopyInput(params: {
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>;
    material: DouyinRemixCopyMaterialOption;
    extractResult: string;
    introBreakdown: string;
    bodyBreakdown: string;
    outroBreakdown: string;
    injectBrandProfile: boolean;
    product?: Awaited<ReturnType<BrandsService["getArchive"]>>["products"][number];
    marketingPlan?: DouyinMarketingPlanRecord;
    injectMarketingPlan: boolean;
    userRequirement?: string;
    generatedAt: string;
  }) {
    return {
      task: "输出《抖音二创文案》",
      generatedAt: params.generatedAt,
      inputScope: {
        sourceMaterial: {
          id: params.material.id,
          title: params.material.title,
          videoUrl: params.material.videoUrl,
          authorName: params.material.authorName,
          workUrl: params.material.workUrl,
        },
        extractedCopy: params.extractResult,
        breakdown: {
          intro: params.introBreakdown,
          body: params.bodyBreakdown,
          outro: params.outroBreakdown,
        },
        brandArchive: params.injectBrandProfile
          ? {
              background: params.archive.brand,
              survey: params.archive.survey
                .filter((item) => item.value?.trim())
                .slice(0, 20)
                .map((item) => ({
                  label: item.label,
                  value: this.truncateText(item.value, 220),
                })),
              platformAccounts: params.archive.platformAccounts.slice(0, 20).map((item) => ({
                platform: item.platform,
                accountName: item.accountName,
                accountLink: item.accountLink,
              })),
              competitorAccounts: params.archive.competitorAccounts.slice(0, 20).map((item) => ({
                platform: item.platform,
                accountName: item.accountName,
                accountLink: item.accountLink,
              })),
            }
          : undefined,
        selectedProduct: params.product
          ? {
              id: params.product.id,
              productName: params.product.productName,
              productType: params.product.productType,
              price: params.product.price,
              productPositioning: params.product.productPositioning,
              targetAudience: params.product.targetAudience,
              painPoint: params.product.painPoint,
              usageScenario: params.product.usageScenario,
              differentiators: params.product.differentiators,
              marketPosition: params.product.marketPosition,
              detailDescription: this.truncateText(params.product.detailDescription, 240),
            }
          : undefined,
        douyinMarketingPlan: params.marketingPlan && params.injectMarketingPlan
          ? {
              id: params.marketingPlan.id,
              title: params.marketingPlan.title,
              summary: params.marketingPlan.summary,
              reportMarkdown: this.truncateText(params.marketingPlan.reportMarkdown, 6000),
            }
          : undefined,
        userRequirement: params.userRequirement || undefined,
        generationOptions: {
          injectBrandProfile: params.injectBrandProfile,
          injectMarketingPlan: params.injectMarketingPlan,
          hasProduct: Boolean(params.product),
        },
      },
      outputRequirement: {
        format: "markdown",
        outputType: "可直接执行的抖音二创文案",
        injectBrandProfile: params.injectBrandProfile,
        injectMarketingPlan: params.injectMarketingPlan,
        hasProduct: Boolean(params.product),
        userRequirement: params.userRequirement || undefined,
      },
      outputTarget: "抖音二创文案",
    };
  }

  private buildDouyinRemixMaterialOptions(
    materialLibraryItems: Awaited<ReturnType<CollectorsService["listUnifiedMaterialLibraryItems"]>>,
  ): DouyinRemixCopyMaterialOption[] {
    const deduped = new Map<string, { option: DouyinRemixCopyMaterialOption; sortAt: string }>();
    for (const item of materialLibraryItems) {
      if (!item?.videoUrl) {
        continue;
      }
      const id = String(item.id || "").trim();
      if (!id) {
        continue;
      }
      deduped.set(id, {
        option: {
          id,
          title: `[${item.platformLabel}] ${item.title?.trim() || item.description?.trim() || "素材视频"}`,
          videoUrl: item.videoUrl,
          authorName: item.authorName?.trim() || undefined,
          workUrl: item.detailUrl?.trim() || undefined,
        },
        sortAt: item.materialAddedAt || item.collectedAt || "",
      });
    }
    return [...deduped.values()]
      .sort((a, b) => b.sortAt.localeCompare(a.sortAt))
      .map((item) => item.option);
  }

  private buildDouyinRemixProductOptions(
    products: Awaited<ReturnType<BrandsService["getArchive"]>>["products"],
  ): DouyinRemixCopyProductOption[] {
    return products
      .map((item) => ({
        id: item.id,
        productName: item.productName?.trim() || "未命名产品",
      }))
      .filter((item) => item.id && item.productName);
  }

  private buildXiaohongshuMarketingCalendarInput(
    archive: Awaited<ReturnType<BrandsService["getArchive"]>>,
    sourceReport: GrowthReportRecord,
    opportunityReport: OpportunityInsightReportRecord,
    previousCalendars: XiaohongshuMarketingCalendarRecord[],
    generatedAt: string,
    userRequirement?: string,
  ) {
    const historyDates = previousCalendars
      .flatMap((item) => item.items.map((entry) => entry.date))
      .filter(Boolean);
    const lastHistoryDate = historyDates.sort().at(-1) || "";
    const startDate = this.resolveCalendarStartDate(lastHistoryDate, generatedAt);
    const executionCapabilityInventory = this.buildMarketingCalendarExecutionCapabilityInventory(generatedAt);
    const brandBackgroundReady = Boolean(
      archive.brand.brandName?.trim()
      || archive.brand.brandDescription?.trim()
      || archive.brand.enterpriseIntro?.trim(),
    );

    return {
      task: "输出《品牌全平台营销日历》",
      generatedAt,
      startDate,
      days: 7,
      expectedDates: this.buildExpectedCalendarDates(startDate, 7),
      inputScope: {
        brandArchive: {
          background: archive.brand,
          products: archive.products.map((item) => ({
            productName: item.productName,
            productCategory: item.productType,
            coreSellingPoint: item.differentiators || item.productPositioning || "",
            usageScenario: item.usageScenario,
            priceRange: typeof item.price === "number" ? `${item.price}元` : "",
          })),
        },
        requiredInputs: {
          brandBackgroundReady,
          growthReportReady: Boolean(sourceReport.reportMarkdown?.trim()),
          opportunityInsightReady: Boolean(opportunityReport.htmlDocument?.trim()),
          systemFunctionCount: executionCapabilityInventory.items.length,
        },
        growthReport: {
          id: sourceReport.id,
          title: sourceReport.title,
          summary: sourceReport.summary,
          diagnosis: sourceReport.diagnosis,
          opportunities: sourceReport.opportunities,
          nextActions: sourceReport.nextActions,
        },
        opportunityInsightReport: {
          id: opportunityReport.id,
          title: opportunityReport.title,
          summary: opportunityReport.summary,
          htmlDocument: this.truncateText(opportunityReport.htmlDocument, 16000),
        },
        systemGeneratedContentFunctions: executionCapabilityInventory,
        previousCalendarHistory: previousCalendars.slice(0, 10).map((item) => ({
          id: item.id,
          title: item.title,
          generatedAt: item.generatedAt,
          dates: item.items.map((entry) => entry.date),
          themes: item.items.map((entry) => entry.brandMarketing.theme).filter(Boolean),
        })),
        userRequirement: userRequirement ? { text: userRequirement } : undefined,
      },
      outputTarget: "品牌全平台营销日历",
    };
  }

  private normalizeVisualMetricItems(raw: unknown, fallback: VisualReportMetricItem[]) {
    const items = Array.isArray(raw) ? raw : [];
    const normalized = items
      .map((item) => this.asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        label: String(item.label ?? "").trim(),
        value: String(item.value ?? "").trim(),
        note: String(item.note ?? "").trim(),
      }))
      .filter((item) => item.label && item.value)
      .slice(0, 4);
    return normalized.length ? normalized : fallback.slice(0, 4);
  }

  private normalizeVisualSectionItems(raw: unknown, fallback: VisualReportSectionItem[]) {
    const items = Array.isArray(raw) ? raw : [];
    const normalized = items
      .map((item) => this.asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        title: String(item.title ?? "").trim(),
        body: String(item.body ?? "").trim(),
        bullets: this.normalizeStringArray(item.bullets, [], 4),
      }))
      .filter((item) => item.title && (item.body || item.bullets.length))
      .slice(0, 6);
    return normalized.length ? normalized : fallback.slice(0, 6);
  }

  private normalizeStringArray(raw: unknown, fallback: string[] = [], limit = 6) {
    const values = Array.isArray(raw)
      ? raw.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];
    const target = values.length ? values : fallback;
    return target.slice(0, limit);
  }

  private async extractDouyinMaterialCopyByMathMind(
    brandId: string,
    videoUrl: string,
    onProgress?: (detailText: string) => Promise<void> | void,
  ) {
    const provider = await this.resolveRuntimeProviderByBaseUrl(
      "mathmind-video-tools",
      undefined,
      [],
      undefined,
      "MathMind 视频工具平台未配置，暂时无法提取素材视频文案。",
    );
    if (!provider) {
      throw new ServiceUnavailableException("MathMind 视频工具平台未配置，暂时无法提取素材视频文案。");
    }
    const apiKeys = await this.resolveBrandAwareApiKeys(brandId, provider);
    const apiBaseUrl = this.apiProvidersService.getBaseUrls(provider)[0] || provider.baseUrl;
    const apiKey = apiKeys[0];
    if (!apiBaseUrl || !apiKey) {
      throw new ServiceUnavailableException("MathMind 视频工具平台未配置可用 API Key，暂时无法提取素材视频文案。");
    }

    const requestJson = async (url: string, method: "GET" | "POST", body?: Record<string, unknown>) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      try {
        const response = await fetch(url, {
          method,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        const rawText = await response.text();
        let payload: Record<string, unknown> | undefined;
        try {
          payload = rawText ? this.asRecord(JSON.parse(rawText)) || undefined : undefined;
        } catch {
          payload = undefined;
        }
        if (!response.ok) {
          throw new ServiceUnavailableException(
            `MathMind 接口调用失败：${this.truncateText(
              this.readRecordString(payload, "message")
              || this.readRecordString(payload, "msg")
              || rawText
              || `${response.status} ${response.statusText}`,
              240,
            )}`,
          );
        }
        return payload || {};
      } finally {
        clearTimeout(timer);
      }
    };

    const extractResultText = (payload: Record<string, unknown>) => {
      const resultRecord = this.asRecord(payload.result) || this.asRecord(payload.data) || payload;
      const candidates = [
        this.readRecordString(resultRecord, "result"),
        this.readRecordString(resultRecord, "content"),
        this.readRecordString(resultRecord, "text"),
        this.readRecordString(resultRecord, "copy"),
        this.readRecordString(resultRecord, "transcript"),
        this.readRecordString(payload, "result"),
        this.readRecordString(payload, "content"),
        this.readRecordString(payload, "text"),
      ];
      return candidates.find((item) => item.trim())?.trim() || "";
    };

    const readTaskStatus = (payload: Record<string, unknown>) => {
      const resultRecord = this.asRecord(payload.data) || this.asRecord(payload.result) || payload;
      return (
        this.readRecordString(resultRecord, "status")
        || this.readRecordString(resultRecord, "state")
        || this.readRecordString(payload, "status")
        || this.readRecordString(payload, "state")
        || ""
      ).trim().toUpperCase();
    };

    await onProgress?.("正在向 MathMind 提交视频文案提取任务");
    const submitPayload = await requestJson(
      `${apiBaseUrl.replace(/\/+$/, "")}/minimalist/api/video-audio/video2txtAsync`,
      "POST",
      { videoUrl },
    );
    const submitData = this.asRecord(submitPayload.data) || submitPayload;
    const immediateResult = extractResultText(submitPayload);
    if (immediateResult) {
      return immediateResult;
    }

    const taskId = (
      this.readRecordString(submitData, "taskId")
      || this.readRecordString(submitPayload, "taskId")
    ).trim();
    const statusUrl = (
      this.readRecordString(submitData, "statusUrl")
      || this.readRecordString(submitPayload, "statusUrl")
    ).trim();
    if (!taskId && !statusUrl) {
      throw new ServiceUnavailableException("MathMind 未返回可查询的任务 ID，无法继续提取视频文案。");
    }

    const pollUrl = statusUrl
      ? (statusUrl.startsWith("http")
        ? statusUrl
        : `${apiBaseUrl.replace(/\/+$/, "")}/${statusUrl.replace(/^\/+/, "")}`)
      : `${apiBaseUrl.replace(/\/+$/, "")}/minimalist/api/task/${encodeURIComponent(taskId)}?timeout=50`;

    for (let attempt = 1; attempt <= 40; attempt += 1) {
      if (attempt > 1) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 3000));
      }
      await onProgress?.(`MathMind 正在提取视频文案，第 ${attempt} 次查询任务结果`);
      const pollPayload = await requestJson(pollUrl, "GET");
      const resultText = extractResultText(pollPayload);
      if (resultText) {
        return resultText;
      }

      const status = readTaskStatus(pollPayload);
      if (["FAILED", "ERROR", "CANCELLED", "TIMEOUT"].includes(status)) {
        throw new ServiceUnavailableException(
          this.readRecordString(this.asRecord(pollPayload.data), "message")
          || this.readRecordString(pollPayload, "message")
          || this.readRecordString(pollPayload, "msg")
          || "MathMind 提取视频文案失败，请稍后重试。",
        );
      }
      if (["SUCCESS", "SUCCEEDED", "DONE", "FINISHED", "COMPLETED"].includes(status)) {
        throw new ServiceUnavailableException("MathMind 已完成任务，但没有返回可用的视频文案结果。");
      }
    }

    throw new ServiceUnavailableException("MathMind 提取视频文案超时，请稍后重试。");
  }

  private async loadThirdPartyChatConfig(settings: ModelGenerationSettings): Promise<ThirdPartyChatConfig> {
    const provider = await this.resolveRuntimeProviderByBaseUrl(
      "text-global",
      settings.baseUrl,
      settings.preferredProviderIds,
      settings.preferredModelName,
      "第三方文生文接口配置读取失败",
    );
    if (!provider) {
      throw new ServiceUnavailableException("第三方文生文接口配置读取失败");
    }
    const requestedModels = this.parseDelimitedModels(settings.modelName);
    const models = this.pickProviderModels(
      provider.modelWhitelist,
      requestedModels,
      ["gpt-5.4-nano", "claude-sonnet-4-6", "gemini-3.1-pro-preview", "gpt-5.4"],
    );
    const configuredBaseUrls = this.apiProvidersService.getBaseUrls(provider);
    const prioritizedBaseUrls = settings.baseUrl
      ? [settings.baseUrl, ...configuredBaseUrls.filter((item) => item !== settings.baseUrl)]
      : configuredBaseUrls;
    const usableBaseUrls = [
      ...prioritizedBaseUrls.filter((item) => !this.isPlaceholderProxyBaseUrl(item)),
      ...prioritizedBaseUrls.filter((item) => this.isPlaceholderProxyBaseUrl(item)),
    ];
    const apiKeys = await this.resolveBrandAwareApiKeys(settings.brandId, provider);

    if (!usableBaseUrls.length || !apiKeys.length || !models.length) {
      throw new ServiceUnavailableException("第三方文生文接口配置读取失败");
    }

    return {
      baseUrls: usableBaseUrls,
      completionPath: this.apiProvidersService.getStringExtra(provider, "completionPath") || "/v1/chat/completions",
      apiKeys,
      models,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    };
  }

  private async loadGrowthReportProviderConfigs(settings: ModelGenerationSettings): Promise<GrowthReportProviderConfig[]> {
    const requestedModels = this.parseDelimitedModels(settings.modelName);
    const apiKeyFallbackOptions = { allowMissingBrandApiKey: true };
    const [thirdPartyProvider, deepseekProvider, kimiProvider, glmProvider, doubaoProvider] = await Promise.all([
      this.resolveRuntimeProviderByBaseUrl("text-global", settings.baseUrl, settings.preferredProviderIds, settings.preferredModelName),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-deepseek"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-kimi"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-glm"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-doubao"),
    ]);
    const [thirdPartyApiKeys, deepseekApiKeys, kimiApiKeys, glmApiKeys, doubaoApiKeys] = await Promise.all([
      this.resolveBrandAwareApiKeys(settings.brandId, thirdPartyProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, deepseekProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, kimiProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, glmProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, doubaoProvider, apiKeyFallbackOptions),
    ]);

    const providers: GrowthReportProviderConfig[] = [];
    if (deepseekProvider) {
      const models = this.pickProviderModels(deepseekProvider.modelWhitelist, requestedModels, ["deepseek-v4-pro", "deepseek-v4-flash"]);
      if (models.length && deepseekApiKeys.length) {
        providers.push({
          provider: "DEEPSEEK",
          providerId: deepseekProvider.id,
          providerName: deepseekProvider.name,
          baseUrls: this.apiProvidersService.getBaseUrls(deepseekProvider),
          completionPath: this.apiProvidersService.getStringExtra(deepseekProvider, "completionPath") || "/chat/completions",
          apiKeys: deepseekApiKeys.slice(0, 2),
          models,
          temperature: Math.min(settings.temperature || 0.3, 0.3),
          maxTokens: Math.min(settings.maxTokens || 6000, 6000),
          requestTimeoutMs: 120000,
          payloadExtras: {
            response_format: { type: "json_object" },
            thinking: { type: "disabled" },
          },
        });
      }
    }
    if (glmProvider) {
      const models = this.pickProviderModels(glmProvider.modelWhitelist, requestedModels, ["GLM-5.1"]);
      if (models.length && glmApiKeys.length) {
        providers.push({
          provider: "GLM",
          providerId: glmProvider.id,
          providerName: glmProvider.name,
          baseUrls: this.apiProvidersService.getBaseUrls(glmProvider),
          completionPath: this.apiProvidersService.getStringExtra(glmProvider, "completionPath") || "/chat/completions",
          apiKeys: glmApiKeys.slice(0, 2),
          models,
          temperature: Math.min(settings.temperature || 0.3, 0.3),
          maxTokens: Math.min(settings.maxTokens || 6000, 6000),
          requestTimeoutMs: 120000,
          payloadExtras: {
            response_format: { type: "json_object" },
          },
        });
      }
    }
    if (kimiProvider) {
      const models = this.pickProviderModels(kimiProvider.modelWhitelist, requestedModels, ["kimi-k2.6"]);
      if (models.length && kimiApiKeys.length) {
        providers.push({
          provider: "KIMI",
          providerId: kimiProvider.id,
          providerName: kimiProvider.name,
          baseUrls: this.apiProvidersService.getBaseUrls(kimiProvider),
          completionPath: this.apiProvidersService.getStringExtra(kimiProvider, "completionPath") || "/chat/completions",
          apiKeys: kimiApiKeys.slice(0, 2),
          models,
          temperature: 1,
          temperatureOverride: 1,
          maxTokens: Math.min(settings.maxTokens || 6000, 6000),
          requestTimeoutMs: 180000,
          tokenLimitField: "max_completion_tokens",
          payloadExtras: {
            response_format: { type: "json_object" },
          },
        });
      }
    }
    if (doubaoProvider) {
      const models = this.pickProviderModels(
        doubaoProvider.modelWhitelist,
        requestedModels,
        ["doubao-seed-2-0-pro-260215", "doubao-seed-2-0-mini-260215", "doubao-seed-1-8-251228"],
      );
      if (models.length && doubaoApiKeys.length) {
        providers.push({
          provider: "ARK",
          providerId: doubaoProvider.id,
          providerName: doubaoProvider.name,
          baseUrls: this.apiProvidersService.getBaseUrls(doubaoProvider),
          completionPath: this.apiProvidersService.getStringExtra(doubaoProvider, "completionPath") || "/chat/completions",
          apiKeys: doubaoApiKeys.slice(0, 1),
          models: models.slice(0, 1),
          temperature: Math.min(settings.temperature || 0.3, 0.3),
          maxTokens: Math.min(settings.maxTokens || 6000, 6000),
          requestTimeoutMs: 150000,
          payloadExtras: {
            response_format: { type: "json_object" },
          },
        });
      }
    }
    if (thirdPartyProvider) {
      const models = this.pickProviderModels(
        thirdPartyProvider.modelWhitelist,
        requestedModels,
        ["gpt-5.4", "gpt-5.4-nano", "claude-sonnet-4-6", "gemini-3.1-pro-preview"],
      );
      if (models.length && thirdPartyApiKeys.length) {
        const configuredBaseUrls = this.apiProvidersService.getBaseUrls(thirdPartyProvider);
        const prioritizedBaseUrls = settings.baseUrl
          ? [settings.baseUrl, ...configuredBaseUrls.filter((item) => item !== settings.baseUrl)]
          : configuredBaseUrls;
        const usableBaseUrls = [
          ...prioritizedBaseUrls.filter((item) => !this.isPlaceholderProxyBaseUrl(item)),
          ...prioritizedBaseUrls.filter((item) => this.isPlaceholderProxyBaseUrl(item)),
        ];
        if (usableBaseUrls.length) {
          providers.push({
            provider: "THIRD_PARTY",
            providerId: thirdPartyProvider.id,
            providerName: thirdPartyProvider.name,
            baseUrls: usableBaseUrls,
            completionPath: this.apiProvidersService.getStringExtra(thirdPartyProvider, "completionPath") || "/v1/chat/completions",
            apiKeys: thirdPartyApiKeys.slice(0, 4),
            models,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            requestTimeoutMs: 90000,
            payloadExtras: {
              response_format: { type: "json_object" },
            },
          });
        }
      }
    }

    if (!providers.length) {
      throw new ServiceUnavailableException("品牌增长报告模型配置读取失败");
    }

    return this.reorderReportProvidersByPrimaryModel(
      providers,
      settings.preferredModelName || requestedModels[0] || "",
    );
  }

  private async loadDomesticVisualProviderConfigs(settings: ModelGenerationSettings): Promise<DomesticVisualProviderConfig[]> {
    const requestedModels = this.parseDelimitedModels(settings.modelName);
    const apiKeyFallbackOptions = { allowMissingBrandApiKey: true };
    const [deepseekProvider, kimiProvider, glmProvider, doubaoProvider] = await Promise.all([
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-deepseek"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-kimi"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-glm"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-doubao"),
    ]);
    const [deepseekApiKeys, kimiApiKeys, glmApiKeys, doubaoApiKeys] = await Promise.all([
      this.resolveBrandAwareApiKeys(settings.brandId, deepseekProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, kimiProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, glmProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, doubaoProvider, apiKeyFallbackOptions),
    ]);

    const providers: DomesticVisualProviderConfig[] = [];
    if (deepseekProvider) {
      const models = this.pickProviderModels(deepseekProvider.modelWhitelist, requestedModels, ["deepseek-v4-flash", "deepseek-v4-pro"]);
      if (models.length && deepseekApiKeys.length) {
        providers.push({
          provider: "DEEPSEEK",
          providerId: deepseekProvider.id,
          providerName: deepseekProvider.name,
          baseUrls: this.apiProvidersService.getBaseUrls(deepseekProvider),
          completionPath: this.apiProvidersService.getStringExtra(deepseekProvider, "completionPath") || "/chat/completions",
          apiKeys: deepseekApiKeys.slice(0, 2),
          models,
          temperature: Math.min(settings.temperature || 0.2, 0.2),
          maxTokens: Math.min(settings.maxTokens || 2400, 2400),
          requestTimeoutMs: 90000,
          payloadExtras: {
            response_format: { type: "text" },
            thinking: { type: "disabled" },
          },
        });
      }
    }
    if (glmProvider) {
      const models = this.pickProviderModels(glmProvider.modelWhitelist, requestedModels, ["GLM-5.1"]);
      if (models.length && glmApiKeys.length) {
        providers.push({
          provider: "GLM",
          providerId: glmProvider.id,
          providerName: glmProvider.name,
          baseUrls: this.apiProvidersService.getBaseUrls(glmProvider),
          completionPath: this.apiProvidersService.getStringExtra(glmProvider, "completionPath") || "/chat/completions",
          apiKeys: glmApiKeys.slice(0, 2),
          models,
          temperature: Math.min(settings.temperature || 0.2, 0.2),
          maxTokens: Math.min(settings.maxTokens || 2400, 2400),
          requestTimeoutMs: 90000,
          payloadExtras: {
            thinking: { type: "disabled" },
          },
        });
      }
    }
    if (kimiProvider) {
      const models = this.pickProviderModels(kimiProvider.modelWhitelist, requestedModels, ["kimi-k2.6"]);
      if (models.length && kimiApiKeys.length) {
        providers.push({
          provider: "KIMI",
          providerId: kimiProvider.id,
          providerName: kimiProvider.name,
          baseUrls: this.apiProvidersService.getBaseUrls(kimiProvider),
          completionPath: this.apiProvidersService.getStringExtra(kimiProvider, "completionPath") || "/chat/completions",
          apiKeys: kimiApiKeys.slice(0, 2),
          models,
          temperature: 1,
          temperatureOverride: 1,
          maxTokens: Math.min(settings.maxTokens || 2400, 2400),
          requestTimeoutMs: 90000,
          tokenLimitField: "max_completion_tokens",
          payloadExtras: {
            response_format: { type: "text" },
            thinking: { type: "disabled" },
          },
        });
      }
    }
    if (doubaoProvider) {
      const models = this.pickProviderModels(
        doubaoProvider.modelWhitelist,
        requestedModels,
        ["doubao-seed-2-0-pro-260215", "doubao-seed-2-0-mini-260215", "doubao-seed-1-8-251228"],
      );
      if (models.length && doubaoApiKeys.length) {
        providers.push({
          provider: "ARK",
          providerId: doubaoProvider.id,
          providerName: doubaoProvider.name,
          baseUrls: this.apiProvidersService.getBaseUrls(doubaoProvider),
          completionPath: this.apiProvidersService.getStringExtra(doubaoProvider, "completionPath") || "/chat/completions",
          apiKeys: doubaoApiKeys.slice(0, 1),
          models: models.slice(0, 1),
          temperature: settings.temperature,
          maxTokens: Math.min(settings.maxTokens || 2600, 2600),
          requestTimeoutMs: 120000,
        });
      }
    }

    if (!providers.length) {
      throw new ServiceUnavailableException("国内文生文接口配置读取失败");
    }

    return this.reorderReportProvidersByPrimaryModel(
      this.applyReportProviderSelectionRule(providers, settings),
      settings.preferredModelName || requestedModels[0] || "",
    );
  }

  private buildVisualProviderPayload(
    provider: DomesticVisualProviderConfig,
    modelName: string,
    systemPrompt: string,
    userPrompt: string,
  ) {
    const payload: Record<string, unknown> = {
      model: modelName,
      stream: false,
      temperature: provider.temperatureOverride ?? provider.temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      ...(provider.payloadExtras ?? {}),
    };
    payload[provider.tokenLimitField === "max_completion_tokens" ? "max_completion_tokens" : "max_tokens"] = provider.maxTokens;
    return payload;
  }

  private buildGrowthReportProviderPayload(
    provider: GrowthReportProviderConfig,
    modelName: string,
    systemPrompt: string,
    userPrompt: string,
  ) {
    const payload: Record<string, unknown> = {
      model: modelName,
      stream: false,
      temperature: provider.temperatureOverride ?? provider.temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      ...(provider.payloadExtras ?? {}),
    };
    payload[provider.tokenLimitField === "max_completion_tokens" ? "max_completion_tokens" : "max_tokens"] = provider.maxTokens;
    return payload;
  }

  private extractVisualResponseContent(payload: {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  }) {
    const message = payload.choices?.[0]?.message;
    const content = String(message?.content ?? "").trim();
    const reasoningContent = String(message?.reasoning_content ?? "").trim();
    if (content) {
      return content;
    }
    if (reasoningContent.startsWith("{") || reasoningContent.startsWith("```") || reasoningContent.includes("\"htmlBody\"")) {
      return reasoningContent;
    }
    return "";
  }

  private readProviderInlineValue(content: string, label: string) {
    const matcher = new RegExp(`^\\s*${label}\\s*[:：]\\s*(.+)$`, "im");
    return content.match(matcher)?.[1]?.trim() || "";
  }

  private parseDelimitedModels(value: string) {
    return String(value || "")
      .split(/[、,，\s]+/)
      .map((item) => this.parseScopedModelSelection(item).modelName)
      .filter(Boolean);
  }

  private parseScopedModelSelection(value: string) {
    const normalized = String(value || "").trim();
    const separatorIndex = normalized.indexOf("::");
    if (separatorIndex <= 0) {
      return {
        providerId: "",
        modelName: normalized,
      };
    }
    return {
      providerId: normalized.slice(0, separatorIndex).trim(),
      modelName: normalized.slice(separatorIndex + 2).trim(),
    };
  }

  private mergeModelPreferenceOrder(...values: string[]) {
    const merged: string[] = [];
    for (const value of values) {
      for (const modelName of this.parseDelimitedModels(value)) {
        if (!merged.includes(modelName)) {
          merged.push(modelName);
        }
      }
    }
    return merged;
  }

  private resolveFallbackPreferredProviderIds(preferredSelections: string[], preferredModelNames: string[]) {
    return preferredModelNames.length > 1
      ? []
      : this.extractPreferredProviderIds(...preferredSelections);
  }

  private extractPreferredProviderIds(...values: string[]) {
    const preferredProviderIds: string[] = [];
    for (const value of values) {
      for (const token of String(value || "").split(/[、,，\s]+/)) {
        const providerId = this.parseScopedModelSelection(token).providerId;
        if (providerId && !preferredProviderIds.includes(providerId)) {
          preferredProviderIds.push(providerId);
        }
      }
    }
    return preferredProviderIds;
  }

  private resolveCompatibleModelNames(
    availableModels: string[] | undefined,
    configuredModels: string,
    preferredModels: string[],
    fallbackModelName: string,
  ) {
    const normalizedAvailable = Array.isArray(availableModels)
      ? availableModels.map((item) => item.trim()).filter(Boolean)
      : [];
    const requestedModels = this.parseDelimitedModels(configuredModels);
    if (!normalizedAvailable.length) {
      return configuredModels || fallbackModelName;
    }
    const models = this.pickProviderModels(normalizedAvailable, requestedModels, preferredModels);
    return models.length ? models.join(", ") : fallbackModelName;
  }

  private collectRegexMatches(content: string, pattern: RegExp) {
    return [...content.matchAll(pattern)]
      .map((item) => item[0]?.trim() || "")
      .filter(Boolean)
      .filter((item, index, array) => array.indexOf(item) === index);
  }

  private orderModels(models: string[], preferredModels: string[]) {
    const normalized = models
      .map((item) => item.trim())
      .filter(Boolean);
    return [
      ...preferredModels.filter((item) => normalized.includes(item)),
      ...normalized.filter((item) => !preferredModels.includes(item)),
    ];
  }

  private reorderReportProvidersByPrimaryModel<T extends { models: string[] }>(
    providers: T[],
    preferredModelName: string,
  ) {
    const normalizedPreferredModelName = preferredModelName.trim();
    if (!normalizedPreferredModelName) {
      return providers;
    }
    const normalizedProviders = providers.map((provider) => ({
      ...provider,
      models: provider.models.includes(normalizedPreferredModelName)
        ? this.orderModels(provider.models, [normalizedPreferredModelName])
        : provider.models,
    }));
    const matchingProviders = normalizedProviders.filter((provider) => provider.models.includes(normalizedPreferredModelName));
    if (!matchingProviders.length) {
      return normalizedProviders;
    }
    return [
      ...matchingProviders,
      ...normalizedProviders.filter((provider) => !provider.models.includes(normalizedPreferredModelName)),
    ];
  }

  private applyReportProviderSelectionRule<T extends { providerId: string; models: string[] }>(
    providers: T[],
    settings: Pick<ModelGenerationSettings, "preferredModelName" | "preferredProviderIds">,
  ) {
    return applySkillProviderSelectionRule(providers, {
      preferredModelName: settings.preferredModelName || "",
      preferredProviderIds: settings.preferredProviderIds || [],
    });
  }

  private buildReportAttemptLabel(provider: string, modelName: string, baseUrl: string) {
    return `${provider}/${modelName}@${this.describeProviderBaseUrl(baseUrl)}`;
  }

  private formatReportAttemptTrail(trail: string[]) {
    return trail
      .slice(0, 8)
      .map((item, index) => `${index + 1}. ${item}`)
      .join(" | ");
  }

  private buildReportAttemptFailureMessage(
    taskLabel: string,
    preferredModelName: string,
    lastError: string,
    attemptTrail: string[],
    fallbackMessage: string,
  ) {
    const preferredDetail = preferredModelName ? `首选模型：${preferredModelName}；` : "";
    const detail = attemptTrail.length ? `；实际尝试顺序：${this.formatReportAttemptTrail(attemptTrail)}` : "";
    return `${taskLabel}失败：${preferredDetail}最后失败：${lastError || fallbackMessage}${detail}`;
  }

  private describeProviderBaseUrl(baseUrl: string) {
    try {
      const target = new URL(baseUrl);
      return `${target.host}${target.pathname === "/" ? "" : target.pathname}`;
    } catch {
      return baseUrl;
    }
  }

  private extractProviderSection(content: string, startLabel: string, nextLabels: string[] = []) {
    const lines = content.split(/\r?\n/);
    const startRegex = new RegExp(`^\\s*${startLabel}\\s*[:：]`, "i");
    const nextRegex = nextLabels.length
      ? new RegExp(`^\\s*(?:${nextLabels.join("|")})\\s*[:：]`, "i")
      : null;
    let started = false;
    const section: string[] = [];
    for (const line of lines) {
      if (!started) {
        if (startRegex.test(line)) {
          started = true;
          section.push(line);
        }
        continue;
      }
      if (nextRegex?.test(line)) {
        break;
      }
      section.push(line);
    }
    return section.join("\n");
  }

  private async loadGrowthAnalysisSkillPrompt() {
    const backendSettings = await this.loadGrowthReportGenerationSettings();
    if (backendSettings.promptContent) {
      return backendSettings.promptContent;
    }
    const candidates = [
      resolve(this.resolveAiWorkspaceRoot(), ".runtime", "brand-omni-growth-analysis", "brand-omni-growth-analysis", "SKILL.md"),
      resolve(this.resolveOperationRoot(), ".trae", "skills", "brand-omni-growth-analysis", "SKILL.md"),
    ];
    for (const filePath of candidates) {
      if (existsSync(filePath)) {
        return readFileSync(filePath, "utf8");
      }
    }

    return [
      "# 品牌全域增长分析报告",
      "你要从品牌基础、产品、用户、公域、私域、预算、ROI 和营销策略几个维度生成《品牌增长报告》。",
      "必须围绕增长问题、增长机会、营收与 ROI 逻辑、营销策略和动作优先级输出。",
      "缺失数据必须明确标注待补充，不得编造。",
    ].join("\n");
  }

  private async loadOpportunityInsightAccountGenerationSettings(
    brandId: string | undefined,
    skillSlug: "opportunity-insight-brand-account-analysis" | "opportunity-insight-competitor-account-analysis",
    promptId: "prompt_opportunity_insight_brand_account" | "prompt_opportunity_insight_competitor_account",
  ): Promise<ModelGenerationSettings> {
    const skill = await this.skillsPromptsService.getActiveSkillBySlug(skillSlug);
    const prompt = await this.skillsPromptsService.getActivePromptById(promptId);
    const preferredSelections = [skill?.defaultModel || "", prompt?.modelName || "", "kimi-k2.6"];
    const provider = await this.resolvePreferredProvider(skill?.provider, "text-domestic-kimi", [
      "text-domestic-kimi",
      "text-domestic-deepseek",
      "text-domestic-doubao",
    ], preferredSelections);
    const preferredModelNames = this.mergeModelPreferenceOrder(
      skill?.defaultModel || "",
      prompt?.modelName || "",
      "kimi-k2.6, deepseek-v4-pro, deepseek-v4-flash, doubao-seed-2-0-pro-260215",
    );
    const preferredModelName = preferredModelNames[0] || skill?.defaultModel || prompt?.modelName || provider?.defaultModel || "kimi-k2.6";
    return {
      baseUrl: provider?.baseUrl || "",
      modelName: preferredModelNames.join(", "),
      temperature: prompt?.temperature ?? 0.4,
      maxTokens: prompt?.maxTokens ?? 12000,
      promptContent: prompt?.content || "",
      preferredModelName,
      brandId,
      preferredProviderIds: this.resolveFallbackPreferredProviderIds(preferredSelections, preferredModelNames),
    };
  }

  private async loadOpportunityInsightNarrativeGenerationSettings(
    brandId: string | undefined,
    skillSlug: "opportunity-insight-comment-analysis" | "opportunity-insight-final-report",
    promptId: "prompt_opportunity_insight_comment" | "prompt_opportunity_insight_final_report",
  ): Promise<ModelGenerationSettings> {
    const skill = await this.skillsPromptsService.getActiveSkillBySlug(skillSlug);
    const prompt = await this.skillsPromptsService.getActivePromptById(promptId);
    const preferredSelections = [skill?.defaultModel || "", prompt?.modelName || "", "gpt-5.4"];
    const provider = await this.resolvePreferredProvider(skill?.provider, "text-global", [
      "text-global",
      "text-domestic-kimi",
      "text-domestic-deepseek",
    ], preferredSelections);
    const preferredModelNames = this.mergeModelPreferenceOrder(
      skill?.defaultModel || "",
      prompt?.modelName || "",
      "gpt-5.4, kimi-k2.6, deepseek-v4-pro, deepseek-v4-flash",
    );
    const preferredModelName = preferredModelNames[0] || skill?.defaultModel || prompt?.modelName || provider?.defaultModel || "gpt-5.4";
    return {
      baseUrl: provider?.baseUrl || "",
      modelName: preferredModelNames.join(", "),
      temperature: prompt?.temperature ?? 0.5,
      maxTokens: prompt?.maxTokens ?? 12000,
      promptContent: prompt?.content || "",
      preferredModelName,
      brandId,
      preferredProviderIds: this.resolveFallbackPreferredProviderIds(preferredSelections, preferredModelNames),
      knowledgeScope: {
        moduleTargetId: BRAND_GROWTH_KNOWLEDGE_TARGET_ID,
        skillPackageKey: "opportunity-insight",
        skillSlug,
        legacyPromptId: promptId,
      },
    };
  }

  private loadVisualReportSkillPrompt(settings: ModelGenerationSettings) {
    const skillPrompt = this.loadArticleVisualDesignerSkillMarkdown();
    const businessRequirements = settings.promptContent?.trim();
    const runtimeRequirements = [
      "当前任务不是把普通文章可视化，而是把《品牌增长报告》转成《品牌增长可视化报告》。",
      "必须完整保留原报告中的核心结论、关键诊断、增长机会、行动建议与关键数据关系。",
      "允许生成更完整的多区域长内容，不要再压缩成过短的极简版。",
      "最终仍需返回一个 JSON 对象，且 htmlBody 只包含 body 内 HTML 片段。",
    ].join("\n");

    return [
      skillPrompt,
      businessRequirements ? `# 业务补充要求\n${businessRequirements}` : "",
      "# 运行时补充要求",
      runtimeRequirements,
    ].filter(Boolean).join("\n\n");
  }

  private loadAnnualMarketingPlanPrompt(settings: ModelGenerationSettings) {
    const businessRequirements = settings.promptContent?.trim();
    return [
      "# 半年营销规划生成器",
      "你需要根据品牌商家建档和品牌增长报告，输出未来半年的营销规划。",
      "规划必须覆盖未来半年关键节日与节气，体现营销主题、渠道协同、策略执行和产品承接。",
      "如果某个月适合围绕同一主题做多平台协同，可以在同一条记录里输出多个平台。",
      businessRequirements ? `# 业务补充要求\n${businessRequirements}` : "",
    ].filter(Boolean).join("\n\n");
  }

  private buildXiaohongshuMarketingPlanSystemPrompt(
    skillPrompt: string,
    settings: ModelGenerationSettings,
    phase: "PART_ONE" | "PART_TWO" | "PART_THREE" | "PART_FOUR" | "PART_FIVE",
  ) {
    const businessRequirements = settings.promptContent?.trim();
    return [
      "# 角色声明",
      [
        "以下内容是一份小红书营销规划技能参考文档，用于约束输出深度与结构。",
        "你当前只需要直接产出最终 Markdown 成品，不要把自己当成代码代理、文件编辑器或工作流执行器。",
        "严禁输出 create_file、edit_file、write_file_section、tool_call、tool_response、XML/JSON 工具调用、'Let me write'、'I will write in sections' 之类过程性文字。",
        "严禁把“分段写入”“先输出第一部分”“继续下一部分”这类续写说明写进正文。",
        "严禁使用 Markdown 代码块包裹最终正文。",
      ].join("\n"),
      skillPrompt,
      businessRequirements ? `# 业务补充要求\n${businessRequirements}` : "",
      "# 运行时补充要求",
      "本次生成小红书营销策划方案时，核心必备输入只能围绕：品牌背景资料、产品资料库、机会洞察总报告、品牌增长报告。",
      "如果输入中包含小红书采集数据，它们只作为补充判断依据，不能替代上述四类核心输入。",
      phase === "PART_ONE"
        ? [
            "当前是第 1 次生成，只允许输出第 1 段 Markdown 成品。",
            "必须输出：基础说明、账号与对标基础诊断、## 一、定策略（看+定）。",
            "严禁输出 ## 二、## 三、## 四、## 五，也严禁写“下一部分待续”。",
            "缺失数据必须明确标注，不得编造。",
          ].join("\n")
        : phase === "PART_TWO"
          ? [
              "当前是第 2 次生成，只允许输出第 2 段 Markdown 成品。",
              "必须输出：## 二、四大象限定产品节奏。",
              "严禁重复输出标题、基础说明、账号与对标诊断、## 一、## 三、## 四、## 五。",
              "请严格承接已给出的前文策略判断，保持口径一致。",
              "缺失数据必须明确标注，不得编造。",
            ].join("\n")
          : phase === "PART_THREE"
            ? [
                "当前是第 3 次生成，只允许输出第 3 段 Markdown 成品。",
                "必须输出：## 三、四大矩阵定内容。",
                "严禁重复输出标题、基础说明、账号与对标诊断、## 一、## 二、## 四、## 五。",
                "请严格承接已给出的策略判断和产品节奏，保持口径一致。",
                "缺失数据必须明确标注，不得编造。",
              ].join("\n")
            : phase === "PART_FOUR"
              ? [
                  "当前是第 4 次生成，只允许输出第 4 段 Markdown 成品。",
                  "必须输出：## 四、四大资源定组合。",
                  "严禁重复输出标题、基础说明、账号与对标诊断、## 一、## 二、## 三、## 五。",
                  "请严格承接已给出的策略判断、产品节奏和内容矩阵，保持口径一致。",
                  "缺失数据必须明确标注，不得编造。",
                ].join("\n")
              : [
                  "当前是第 5 次生成，只允许输出第 5 段 Markdown 成品。",
                  "必须输出：## 五、合规提醒与风险边界。",
                  "严禁重复输出标题、基础说明、账号与对标诊断、## 一、## 二、## 三、## 四。",
                  "请严格承接前文全部策略与资源组合判断，保持收尾口径一致。",
                  "缺失数据必须明确标注，不得编造。",
                ].join("\n"),
    ].filter(Boolean).join("\n\n");
  }

  private buildXiaohongshuMarketingPlanUserPrompt(
    inputPayload: Record<string, unknown>,
    phase: "PART_ONE" | "PART_TWO" | "PART_THREE" | "PART_FOUR" | "PART_FIVE",
    previousMarkdown?: string,
    knowledgeContext?: string,
  ) {
    const userRequirement = this.readOpportunityInsightUserRequirement(inputPayload);
    const sectionsText = phase === "PART_ONE"
      ? "请只生成第 1 段：基础说明、账号与对标基础诊断、## 一、定策略（看+定）。"
      : phase === "PART_TWO"
        ? "请只生成第 2 段：## 二、四大象限定产品节奏。"
        : phase === "PART_THREE"
          ? "请只生成第 3 段：## 三、四大矩阵定内容。"
          : phase === "PART_FOUR"
            ? "请只生成第 4 段：## 四、四大资源定组合。"
            : "请只生成第 5 段：## 五、合规提醒与风险边界。";

    return [
      sectionsText,
      phase !== "PART_ONE" && previousMarkdown
        ? [
            "以下是已经生成完成的前文内容，请严格承接其判断口径，不要重复输出已有章节：",
            "",
            previousMarkdown,
          ].join("\n")
        : "",
      "以下是本次生成小红书营销策划方案的输入数据，请围绕这些数据输出结果。",
      userRequirement ? `如果输入中提供了“用户要求”，必须优先满足：${userRequirement}` : "",
      "",
      JSON.stringify(inputPayload, null, 2),
      knowledgeContext || "",
    ].filter(Boolean).join("\n\n");
  }

  private loadArticleVisualDesignerSkillMarkdown() {
    const candidates = [
      resolve(this.resolveAiWorkspaceRoot(), "提示词", "article-visual-report-designer", "SKILL.md"),
      resolve(this.resolveOperationRoot(), "提示词", "article-visual-report-designer", "SKILL.md"),
    ];
    for (const filePath of candidates) {
      if (existsSync(filePath)) {
        return readFileSync(filePath, "utf8").trim();
      }
    }

    return [
      "你是 article-visual-report-designer。",
      "请把品牌增长报告转换成完整的 body 内 HTML 可视化报告。",
      "全部使用行内样式，不依赖外部 CSS、JS 或第三方库。",
      "优先保证信息完整、结构清晰、移动端可读和图文融合表达。",
    ].join("\n");
  }

  private async loadXiaohongshuMarketingSkillMarkdown() {
    const prompt = await this.skillsPromptsService.getActivePromptById("prompt_xhs_plan");
    if (prompt?.content?.trim()) {
      return prompt.content.trim();
    }
    const skillDir = resolve(this.resolveAiWorkspaceRoot(), "提示词", "_xhs-plan-skill", "xiaohongshu-brand-marketing-plan");
    const skillPath = resolve(skillDir, "SKILL.md");
    if (existsSync(skillPath)) {
      return readFileSync(skillPath, "utf8").trim();
    }
    const fallbackZipDir = resolve(this.resolveAiWorkspaceRoot(), "提示词", "xiaohongshu-brand-marketing-plan");
    const fallbackPath = resolve(fallbackZipDir, "SKILL.md");
    if (existsSync(fallbackPath)) {
      return readFileSync(fallbackPath, "utf8").trim();
    }

    return [
      "# 小红书品牌营销方案策划技能",
      "你需要基于品牌资料、产品资料、账号数据、对标数据、品牌增长报告和半年营销规划，输出完整的小红书营销策划方案。",
      "结果必须是可直接交付的 Markdown 长文，并明确引用依据、执行动作、验收口径与合规边界。",
    ].join("\n");
  }

  private resolveThirdPartyApiConfigPath() {
    const candidates = [
      resolve(this.resolveAiWorkspaceRoot(), "第三方api接口文生文.txt"),
      resolve(this.resolveOperationRoot(), "第三方api接口文生文.txt"),
    ];
    for (const filePath of candidates) {
      if (existsSync(filePath)) {
        return filePath;
      }
    }

    throw new ServiceUnavailableException("未找到第三方文生文接口配置文件");
  }

  private resolveDomesticThirdPartyApiConfigPath() {
    const candidates = [
      resolve(this.resolveAiWorkspaceRoot(), "第三方api接口文生文国内.txt"),
      resolve(this.resolveOperationRoot(), "第三方api接口文生文国内.txt"),
    ];
    for (const filePath of candidates) {
      if (existsSync(filePath)) {
        return filePath;
      }
    }

    throw new ServiceUnavailableException("未找到国内第三方文生文接口配置文件");
  }

  private resolveAiWorkspaceRoot() {
    const candidates = [
      process.cwd(),
      resolve(process.cwd(), ".."),
      resolve(process.cwd(), "..", ".."),
      resolve(process.cwd(), "..", "..", ".."),
      resolve(process.cwd(), "..", "..", "..", ".."),
    ];
    for (const candidate of candidates) {
      if (existsSync(join(candidate, "提示词")) || existsSync(join(candidate, "第三方api接口文生文.txt"))) {
        return candidate;
      }
    }

    return resolve(process.cwd(), "..");
  }

  private resolveOperationRoot() {
    return resolve(this.resolveAiWorkspaceRoot(), "..");
  }

  private async loadGrowthReportGenerationSettings(brandId?: string): Promise<ModelGenerationSettings> {
    const skill = await this.skillsPromptsService.getActiveSkillBySlug("brand-omni-growth-analysis");
    const prompt = await this.skillsPromptsService.getActivePromptById("prompt_growth_report");
    const preferredSelections = [skill?.defaultModel || "", prompt?.modelName || ""];
    const provider = await this.resolvePreferredProvider(skill?.provider, "text-domestic-deepseek", [
      "text-domestic-deepseek",
      "text-domestic-kimi",
      "text-domestic-glm",
      "text-domestic-doubao",
      "text-global",
    ], preferredSelections);
    const preferredModelNames = this.mergeModelPreferenceOrder(
      skill?.defaultModel || "",
      prompt?.modelName || "",
    );
    const preferredModelName = preferredModelNames[0] || skill?.defaultModel || prompt?.modelName || provider?.defaultModel || "deepseek-v4-pro";
    const modelName = this.resolveCompatibleModelNames(
      provider?.modelWhitelist,
      preferredModelNames.join(", "),
      ["deepseek-v4-pro", "deepseek-v4-flash", "kimi-k2.6", "GLM-5.1", "doubao-seed-2-0-pro-260215", "gpt-5.4"],
      provider?.defaultModel || "deepseek-v4-pro",
    );
    return {
      baseUrl: provider?.baseUrl || "",
      modelName,
      temperature: prompt?.temperature ?? 0.3,
      maxTokens: prompt?.maxTokens ?? 6000,
      promptContent: prompt?.content || "",
      preferredModelName,
      brandId,
      preferredProviderIds: this.extractPreferredProviderIds(...preferredSelections),
      knowledgeScope: {
        moduleTargetId: BRAND_GROWTH_KNOWLEDGE_TARGET_ID,
        skillPackageKey: "brand-growth-analysis",
        skillSlug: "brand-omni-growth-analysis",
        legacyPromptId: "prompt_growth_report",
      },
    };
  }

  private async loadVisualReportGenerationSettings(brandId?: string): Promise<ModelGenerationSettings> {
    const skill = await this.skillsPromptsService.getActiveSkillBySlug("article-visual-report-designer");
    const prompt = await this.skillsPromptsService.getActivePromptById("prompt_visual_report");
    const preferredSelections = [skill?.defaultModel || "", prompt?.modelName || ""];
    const provider = await this.resolvePreferredProvider(skill?.provider, "text-domestic-deepseek", [
      "text-domestic-deepseek",
      "text-domestic-glm",
      "text-domestic-kimi",
      "text-domestic-doubao",
    ], preferredSelections);
    const preferredModelNames = this.mergeModelPreferenceOrder(
      skill?.defaultModel || "",
      prompt?.modelName || "",
    );
    const preferredModelName = preferredModelNames[0] || skill?.defaultModel || prompt?.modelName || provider?.defaultModel || "deepseek-v4-flash";
    const modelName = this.resolveCompatibleModelNames(
      provider?.modelWhitelist,
      preferredModelNames.join(", "),
      ["deepseek-v4-flash", "deepseek-v4-pro", "GLM-5.1", "kimi-k2.6", "doubao-seed-2-0-pro-260215"],
      provider?.defaultModel || "deepseek-v4-flash",
    );
    return {
      baseUrl: provider?.baseUrl && !provider.baseUrl.includes(".local") ? provider.baseUrl : "",
      modelName,
      temperature: prompt?.temperature ?? 0.4,
      maxTokens: prompt?.maxTokens ?? 1800,
      promptContent: prompt?.content || "",
      preferredModelName,
      brandId,
      preferredProviderIds: this.extractPreferredProviderIds(...preferredSelections),
    };
  }

  private async loadAnnualMarketingPlanGenerationSettings(brandId?: string): Promise<ModelGenerationSettings> {
    const skill = await this.skillsPromptsService.getActiveSkillBySlug("enterprise-annual-plan");
    const prompt = await this.skillsPromptsService.getActivePromptById("prompt_annual_marketing_plan");
    const preferredSelections = [skill?.defaultModel || "", prompt?.modelName || ""];
    const provider = await this.resolvePreferredProvider(skill?.provider, "text-domestic-deepseek", [
      "text-domestic-deepseek",
      "text-domestic-doubao",
      "text-domestic-kimi",
      "text-global",
    ], preferredSelections);
    const preferredModelNames = this.mergeModelPreferenceOrder(
      skill?.defaultModel || "",
      prompt?.modelName || "",
    );
    const preferredModelName = preferredModelNames[0] || skill?.defaultModel || prompt?.modelName || provider?.defaultModel || "deepseek-v4-pro";
    const modelName = this.resolveCompatibleModelNames(
      provider?.modelWhitelist,
      preferredModelNames.join(", "),
      ["deepseek-v4-pro", "doubao-seed-2-0-pro-260215", "kimi-k2.6", "gpt-5.4", "claude-sonnet-4-6"],
      provider?.defaultModel || "deepseek-v4-pro",
    );
    return {
      baseUrl: provider?.baseUrl || "",
      modelName,
      temperature: prompt?.temperature ?? 0.5,
      maxTokens: prompt?.maxTokens ?? 4200,
      promptContent: prompt?.content || "",
      preferredModelName,
      brandId,
      preferredProviderIds: this.extractPreferredProviderIds(...preferredSelections),
      knowledgeScope: {
        moduleTargetId: BRAND_GROWTH_KNOWLEDGE_TARGET_ID,
        skillPackageKey: "enterprise-annual-plan",
        skillSlug: "enterprise-annual-plan",
        legacyPromptId: "prompt_annual_marketing_plan",
      },
    };
  }

  private async loadXiaohongshuMarketingPlanGenerationSettings(brandId?: string): Promise<ModelGenerationSettings> {
    const skill = await this.skillsPromptsService.getActiveSkillBySlug("xiaohongshu-brand-marketing-plan");
    const prompt = await this.skillsPromptsService.getActivePromptById("prompt_xhs_plan");
    const preferredSelections = [skill?.defaultModel || "", prompt?.modelName || ""];
    const provider = await this.resolvePreferredProvider(skill?.provider, "text-domestic-deepseek", [
      "text-global",
      "text-domestic-kimi",
      "text-domestic-deepseek",
      "text-domestic-doubao",
    ], preferredSelections);
    const preferredModelNames = this.mergeModelPreferenceOrder(
      skill?.defaultModel || "",
      prompt?.modelName || "",
      "gpt-5.4, claude-sonnet-4-6, kimi-k2.6, doubao-seed-2-0-pro-260215, doubao-seed-2-0-mini-260215, doubao-seed-1-8-251228, deepseek-v4-pro, deepseek-v4-flash",
    );
    const preferredModelName = preferredModelNames[0] || skill?.defaultModel || prompt?.modelName || provider?.defaultModel || "deepseek-v4-pro";
    return {
      baseUrl: provider?.baseUrl || "",
      modelName: preferredModelNames.join(", "),
      temperature: prompt?.temperature ?? 0.7,
      maxTokens: prompt?.maxTokens ?? 12000,
      promptContent: prompt?.content || "",
      preferredModelName,
      brandId,
      preferredProviderIds: this.extractPreferredProviderIds(...preferredSelections),
      knowledgeScope: {
        moduleTargetId: "xiaohongshu-workbench",
        skillPackageKey: "xiaohongshu-brand-marketing-plan",
        skillSlug: "xiaohongshu-brand-marketing-plan",
        legacyPromptId: "prompt_xhs_plan",
      },
    };
  }

  private async loadDouyinMarketingPlanGenerationSettings(brandId?: string): Promise<ModelGenerationSettings> {
    const skill = await this.skillsPromptsService.getActiveSkillBySlug("tongcheng-brand-douyin-planning");
    const prompt = await this.skillsPromptsService.getActivePromptById("prompt_douyin_plan");
    const preferredSelections = [skill?.defaultModel || "", prompt?.modelName || ""];
    const provider = await this.resolvePreferredProvider(skill?.provider, "text-domestic-deepseek", [
      "text-domestic-deepseek",
      "text-domestic-doubao",
      "text-domestic-kimi",
      "text-global",
    ], preferredSelections);
    const preferredModelNames = this.mergeModelPreferenceOrder(
      skill?.defaultModel || "",
      prompt?.modelName || "",
      "gpt-5.4, claude-sonnet-4-6, kimi-k2.6, doubao-seed-2-0-pro-260215, doubao-seed-2-0-mini-260215, doubao-seed-1-8-251228, deepseek-v4-pro, deepseek-v4-flash",
    );
    const preferredModelName = preferredModelNames[0] || skill?.defaultModel || prompt?.modelName || provider?.defaultModel || "deepseek-v4-pro";
    return {
      baseUrl: provider?.baseUrl || "",
      modelName: preferredModelNames.join(", "),
      temperature: prompt?.temperature ?? 0.7,
      maxTokens: prompt?.maxTokens ?? 12000,
      promptContent: prompt?.content || "",
      preferredModelName,
      brandId,
      preferredProviderIds: this.extractPreferredProviderIds(...preferredSelections),
      knowledgeScope: {
        moduleTargetId: "douyin-workbench",
        skillPackageKey: "tongcheng-brand-douyin-planning",
        skillSlug: "tongcheng-brand-douyin-planning",
        legacyPromptId: "prompt_douyin_plan",
      },
    };
  }

  private async loadDouyinHotTopicCandidatesGenerationSettings(brandId?: string): Promise<ModelGenerationSettings> {
    const skill = await this.skillsPromptsService.getActiveSkillBySlug("douyin-hot-topic-candidates");
    const prompt = await this.skillsPromptsService.getActivePromptById("prompt_douyin_hot_topic_candidates");
    const preferredSelections = [skill?.defaultModel || "", prompt?.modelName || ""];
    const provider = await this.resolvePreferredProvider(skill?.provider, "text-domestic-deepseek", [
      "text-domestic-deepseek",
      "text-domestic-doubao",
      "text-domestic-kimi",
      "text-global",
    ], preferredSelections);
    const preferredModelNames = this.mergeModelPreferenceOrder(
      skill?.defaultModel || "",
      prompt?.modelName || "",
      "deepseek-v4-pro, deepseek-v4-flash, doubao-seed-2-0-pro-260215, kimi-k2.6, gpt-5.4, claude-sonnet-4-6",
    );
    const preferredModelName = preferredModelNames[0] || skill?.defaultModel || prompt?.modelName || provider?.defaultModel || "deepseek-v4-pro";
    return {
      baseUrl: provider?.baseUrl || "",
      modelName: preferredModelNames.join(", "),
      temperature: prompt?.temperature ?? 0.5,
      maxTokens: prompt?.maxTokens ?? 3200,
      promptContent: prompt?.content || this.loadDouyinHotTopicCandidatesPrompt(),
      preferredModelName,
      brandId,
      preferredProviderIds: this.extractPreferredProviderIds(...preferredSelections),
      knowledgeScope: {
        moduleTargetId: "douyin-workbench",
        skillPackageKey: "tongcheng-brand-douyin-planning",
        skillSlug: "douyin-hot-topic-candidates",
        legacyPromptId: "prompt_douyin_hot_topic_candidates",
      },
    };
  }

  private async loadDouyinOriginalCopyGenerationSettings(
    brandId: string | undefined,
    copyType: DouyinOriginalCopyType,
  ): Promise<ModelGenerationSettings> {
    const config = DOUYIN_ORIGINAL_COPY_TYPE_CONFIG[copyType];
    const skill = await this.skillsPromptsService.getActiveSkillBySlug(config.skillSlug);
    const prompt = await this.skillsPromptsService.getActivePromptById(config.promptId);
    const preferredSelections = [skill?.defaultModel || "", prompt?.modelName || ""];
    const provider = await this.resolvePreferredProvider(skill?.provider, "text-domestic-deepseek", [
      "text-domestic-deepseek",
      "text-domestic-doubao",
      "text-domestic-kimi",
      "text-global",
    ], preferredSelections);
    const preferredModelNames = this.mergeModelPreferenceOrder(
      skill?.defaultModel || "",
      prompt?.modelName || "",
      "deepseek-v4-pro, deepseek-v4-flash, doubao-seed-2-0-pro-260215, kimi-k2.6, gpt-5.4, claude-sonnet-4-6",
    );
    const preferredModelName = preferredModelNames[0] || skill?.defaultModel || prompt?.modelName || provider?.defaultModel || "deepseek-v4-pro";
    return {
      baseUrl: provider?.baseUrl || "",
      modelName: preferredModelNames.join(", "),
      temperature: prompt?.temperature ?? 0.6,
      maxTokens: prompt?.maxTokens ?? 6000,
      promptContent: prompt?.content || this.loadDouyinOriginalCopyPrompt(copyType),
      preferredModelName,
      brandId,
      preferredProviderIds: this.extractPreferredProviderIds(...preferredSelections),
    };
  }

  private async loadDouyinRemixStageGenerationSettings(
    brandId: string | undefined,
    stage: DouyinRemixCopyPromptStage,
  ): Promise<ModelGenerationSettings> {
    const config = DOUYIN_REMIX_COPY_PROMPT_CONFIG[stage];
    const skill = await this.skillsPromptsService.getActiveSkillBySlug(config.skillSlug);
    const prompt = await this.skillsPromptsService.getActivePromptById(config.promptId);
    const preferredSelections = [skill?.defaultModel || "", prompt?.modelName || ""];
    const provider = await this.resolvePreferredProvider(skill?.provider, "text-domestic-deepseek", [
      "text-domestic-deepseek",
      "text-domestic-doubao",
      "text-domestic-kimi",
      "text-global",
    ], preferredSelections);
    const preferredModelNames = this.mergeModelPreferenceOrder(
      skill?.defaultModel || "",
      prompt?.modelName || "",
      "deepseek-v4-pro, deepseek-v4-flash, doubao-seed-2-0-pro-260215, kimi-k2.6, gpt-5.4, claude-sonnet-4-6",
    );
    const preferredModelName = preferredModelNames[0] || skill?.defaultModel || prompt?.modelName || provider?.defaultModel || "deepseek-v4-pro";
    return {
      baseUrl: provider?.baseUrl || "",
      modelName: preferredModelNames.join(", "),
      temperature: prompt?.temperature ?? config.temperature,
      maxTokens: prompt?.maxTokens ?? config.maxTokens,
      promptContent: prompt?.content || this.loadDouyinRemixPrompt(stage),
      preferredModelName,
      brandId,
      preferredProviderIds: this.extractPreferredProviderIds(...preferredSelections),
    };
  }

  private async loadXiaohongshuMarketingCalendarGenerationSettings(brandId?: string): Promise<ModelGenerationSettings> {
    const provider = await this.resolvePreferredProvider(undefined, "text-global", [
      "text-global",
      "text-domestic-deepseek",
      "text-domestic-kimi",
      "text-domestic-doubao",
    ]);
    const configuredModelNames = this.mergeModelPreferenceOrder(
      provider?.defaultModel || "",
    );
    const runtimeFallbackModels = this.getTextRuntimeFallbackModels(
      provider ? this.apiProvidersService.getRuntimeKey(provider) : "text-global",
    );
    const preferredModelNames = configuredModelNames.length ? configuredModelNames : runtimeFallbackModels;
    const preferredModelName =
      configuredModelNames[0]
      || provider?.defaultModel
      || runtimeFallbackModels[0]
      || "deepseek-v4-pro";
    return {
      baseUrl: provider?.baseUrl || "",
      modelName: preferredModelNames.join(", "),
      temperature: 0.6,
      maxTokens: 12000,
      promptContent: this.loadXiaohongshuMarketingCalendarPrompt(),
      preferredModelName,
      brandId,
      preferredProviderIds: [],
    };
  }

  private async loadOpportunityInsightAccountProviderConfigs(settings: ModelGenerationSettings): Promise<XiaohongshuMarketingProviderConfig[]> {
    const preferredModels = ["kimi-k2.6", "deepseek-v4-pro", "deepseek-v4-flash", "doubao-seed-2-0-pro-260215"];
    const apiKeyFallbackOptions = { allowMissingBrandApiKey: true };
    const requestedModels = this.orderModels(
      this.parseDelimitedModels(settings.modelName).filter((item) => preferredModels.includes(item)),
      preferredModels,
    );
    const effectiveRequestedModels = requestedModels.length ? requestedModels : preferredModels;

    const [deepseekProvider, kimiProvider, doubaoProvider] = await Promise.all([
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-deepseek"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-kimi"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-doubao"),
    ]);
    const [deepseekApiKeys, kimiApiKeys, doubaoApiKeys] = await Promise.all([
      this.resolveBrandAwareApiKeys(settings.brandId, deepseekProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, kimiProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, doubaoProvider, apiKeyFallbackOptions),
    ]);
    const deepseekModels = deepseekProvider
      ? this.pickProviderModels(deepseekProvider.modelWhitelist, effectiveRequestedModels, ["deepseek-v4-pro", "deepseek-v4-flash"])
      : [];
    const kimiModels = kimiProvider
      ? this.pickProviderModels(kimiProvider.modelWhitelist, effectiveRequestedModels, ["kimi-k2.6"])
      : [];
    const arkModels = doubaoProvider
      ? this.pickProviderModels(doubaoProvider.modelWhitelist, effectiveRequestedModels, ["doubao-seed-2-0-pro-260215"])
      : [];

    const providers: XiaohongshuMarketingProviderConfig[] = [];
    if (kimiProvider && kimiModels.length && kimiApiKeys.length) {
      providers.push({
        provider: "KIMI",
        providerId: kimiProvider.id,
        providerName: kimiProvider.name,
        baseUrls: this.apiProvidersService.getBaseUrls(kimiProvider),
        completionPath: this.apiProvidersService.getStringExtra(kimiProvider, "completionPath") || "/chat/completions",
        apiKeys: kimiApiKeys.slice(0, 2),
        models: kimiModels,
        temperature: 1,
        temperatureOverride: 1,
        maxTokens: Math.min(settings.maxTokens || 12000, 12000),
        requestTimeoutMs: 240000,
        tokenLimitField: "max_completion_tokens",
      });
    }
    if (deepseekProvider && deepseekModels.length && deepseekApiKeys.length) {
      providers.push({
        provider: "DEEPSEEK",
        providerId: deepseekProvider.id,
        providerName: deepseekProvider.name,
        baseUrls: this.apiProvidersService.getBaseUrls(deepseekProvider),
        completionPath: this.apiProvidersService.getStringExtra(deepseekProvider, "completionPath") || "/chat/completions",
        apiKeys: deepseekApiKeys.slice(0, 2),
        models: deepseekModels,
        temperature: Math.min(settings.temperature || 0.4, 0.4),
        maxTokens: Math.min(settings.maxTokens || 9000, 9000),
        requestTimeoutMs: 180000,
        payloadExtras: {
          response_format: { type: "text" },
          thinking: { type: "disabled" },
        },
      });
    }
    if (doubaoProvider && arkModels.length && doubaoApiKeys.length) {
      providers.push({
        provider: "ARK",
        providerId: doubaoProvider.id,
        providerName: doubaoProvider.name,
        baseUrls: this.apiProvidersService.getBaseUrls(doubaoProvider),
        completionPath: this.apiProvidersService.getStringExtra(doubaoProvider, "completionPath") || "/chat/completions",
        apiKeys: doubaoApiKeys.slice(0, 1),
        models: arkModels.slice(0, 1),
        temperature: Math.min(settings.temperature || 0.5, 0.5),
        maxTokens: Math.min(settings.maxTokens || 9000, 9000),
        requestTimeoutMs: 180000,
        payloadExtras: {
          response_format: { type: "text" },
        },
      });
    }
    if (!providers.length) {
      throw new ServiceUnavailableException("机会洞察账号分析模型配置读取失败");
    }
    return this.reorderReportProvidersByPrimaryModel(
      providers,
      settings.preferredModelName || effectiveRequestedModels[0] || "",
    );
  }

  private async loadOpportunityInsightNarrativeProviderConfigs(settings: ModelGenerationSettings): Promise<XiaohongshuMarketingProviderConfig[]> {
    const preferredModels = ["gpt-5.4", "kimi-k2.6", "deepseek-v4-pro", "deepseek-v4-flash"];
    const apiKeyFallbackOptions = { allowMissingBrandApiKey: true };
    const requestedModels = this.orderModels(
      this.parseDelimitedModels(settings.modelName).filter((item) => preferredModels.includes(item)),
      preferredModels,
    );
    const effectiveRequestedModels = requestedModels.length ? requestedModels : preferredModels;

    const [thirdPartyProvider, kimiProvider, deepseekProvider] = await Promise.all([
      this.resolveRuntimeProviderByBaseUrl("text-global", settings.baseUrl, settings.preferredProviderIds, settings.preferredModelName),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-kimi"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-deepseek"),
    ]);
    const [thirdPartyApiKeys, kimiApiKeys, deepseekApiKeys] = await Promise.all([
      this.resolveBrandAwareApiKeys(settings.brandId, thirdPartyProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, kimiProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, deepseekProvider, apiKeyFallbackOptions),
    ]);

    const thirdPartyModels = thirdPartyProvider
      ? this.pickProviderModels(thirdPartyProvider.modelWhitelist, effectiveRequestedModels, ["gpt-5.4"])
      : [];
    const kimiModels = kimiProvider
      ? this.pickProviderModels(kimiProvider.modelWhitelist, effectiveRequestedModels, ["kimi-k2.6"])
      : [];
    const deepseekModels = deepseekProvider
      ? this.pickProviderModels(deepseekProvider.modelWhitelist, effectiveRequestedModels, ["deepseek-v4-pro", "deepseek-v4-flash"])
      : [];

    const providers: XiaohongshuMarketingProviderConfig[] = [];
    if (thirdPartyProvider && thirdPartyModels.length && thirdPartyApiKeys.length) {
      const configuredBaseUrls = this.apiProvidersService.getBaseUrls(thirdPartyProvider);
      const prioritizedBaseUrls = settings.baseUrl
        ? [settings.baseUrl, ...configuredBaseUrls.filter((item) => item !== settings.baseUrl)]
        : configuredBaseUrls;
      const usableBaseUrls = [
        ...prioritizedBaseUrls.filter((item) => !this.isPlaceholderProxyBaseUrl(item)),
        ...prioritizedBaseUrls.filter((item) => this.isPlaceholderProxyBaseUrl(item)),
      ];
      if (usableBaseUrls.length) {
        providers.push({
          provider: "THIRD_PARTY",
          providerId: thirdPartyProvider.id,
          providerName: thirdPartyProvider.name,
          baseUrls: usableBaseUrls,
          completionPath: this.apiProvidersService.getStringExtra(thirdPartyProvider, "completionPath") || "/v1/chat/completions",
          apiKeys: thirdPartyApiKeys.slice(0, 4),
          models: thirdPartyModels,
          temperature: settings.temperature,
          maxTokens: Math.min(settings.maxTokens || 12000, 12000),
          requestTimeoutMs: 180000,
          payloadExtras: {
            response_format: { type: "text" },
          },
        });
      }
    }
    if (kimiProvider && kimiModels.length && kimiApiKeys.length) {
      providers.push({
        provider: "KIMI",
        providerId: kimiProvider.id,
        providerName: kimiProvider.name,
        baseUrls: this.apiProvidersService.getBaseUrls(kimiProvider),
        completionPath: this.apiProvidersService.getStringExtra(kimiProvider, "completionPath") || "/chat/completions",
        apiKeys: kimiApiKeys.slice(0, 2),
        models: kimiModels,
        temperature: 1,
        temperatureOverride: 1,
        maxTokens: Math.min(settings.maxTokens || 12000, 12000),
        requestTimeoutMs: 240000,
        tokenLimitField: "max_completion_tokens",
      });
    }
    if (deepseekProvider && deepseekModels.length && deepseekApiKeys.length) {
      providers.push({
        provider: "DEEPSEEK",
        providerId: deepseekProvider.id,
        providerName: deepseekProvider.name,
        baseUrls: this.apiProvidersService.getBaseUrls(deepseekProvider),
        completionPath: this.apiProvidersService.getStringExtra(deepseekProvider, "completionPath") || "/chat/completions",
        apiKeys: deepseekApiKeys.slice(0, 2),
        models: deepseekModels,
        temperature: Math.min(settings.temperature || 0.4, 0.4),
        maxTokens: Math.min(settings.maxTokens || 12000, 12000),
        requestTimeoutMs: 180000,
        payloadExtras: {
          response_format: { type: "text" },
          thinking: { type: "disabled" },
        },
      });
    }
    if (!providers.length) {
      throw new ServiceUnavailableException("机会洞察长文模型配置读取失败");
    }
    const providersSelectedByRule = this.applyReportProviderSelectionRule(providers, settings);
    const reorderedProviders = this.reorderReportProvidersByPrimaryModel(
      providers,
      settings.preferredModelName || effectiveRequestedModels[0] || "",
    );
    settings.debugProviderSummary = [
      `requested=${effectiveRequestedModels.join("/") || "none"}`,
      `before=${providers.map((item) => `${item.provider}[${item.models.join("/") || "none"}|k${item.apiKeys.length}|b${item.baseUrls.length}]`).join(",") || "none"}`,
      `ruleSelected=${providersSelectedByRule.map((item) => `${item.provider}[${item.models.join("/") || "none"}|k${item.apiKeys.length}|b${item.baseUrls.length}]`).join(",") || "none"}`,
      `actual=${reorderedProviders.map((item) => `${item.provider}[${item.models.join("/") || "none"}|k${item.apiKeys.length}|b${item.baseUrls.length}]`).join(",") || "none"}`,
    ].join("; ");
    return reorderedProviders;
  }

  private async loadAnnualMarketingProviderConfigs(settings: ModelGenerationSettings): Promise<AnnualMarketingProviderConfig[]> {
    const apiKeyFallbackOptions = { allowMissingBrandApiKey: true };
    const thirdPartyProvider = await this.resolveRuntimeProviderByBaseUrl(
      "text-global",
      settings.baseUrl,
      settings.preferredProviderIds,
      settings.preferredModelName,
    );
    const requestedModels = this.orderModels(
      this.parseDelimitedModels(settings.modelName),
      ["gpt-5.4", "claude-sonnet-4-6"],
    );

    const [deepseekProvider, doubaoProvider] = await Promise.all([
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-deepseek"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-doubao"),
    ]);
    const [thirdPartyApiKeys, deepseekApiKeys, doubaoApiKeys] = await Promise.all([
      this.resolveBrandAwareApiKeys(settings.brandId, thirdPartyProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, deepseekProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, doubaoProvider, apiKeyFallbackOptions),
    ]);
    const thirdPartyModels = thirdPartyProvider
      ? this.pickProviderModels(
          thirdPartyProvider.modelWhitelist,
          requestedModels,
          ["gpt-5.4", "claude-sonnet-4-6"],
        ).filter((item) => !item.toLowerCase().includes("doubao"))
      : [];
    const deepseekModels = deepseekProvider
      ? this.pickProviderModels(deepseekProvider.modelWhitelist, requestedModels, ["deepseek-v4-flash", "deepseek-v4-pro"])
      : [];
    const arkModels = doubaoProvider
      ? this.pickProviderModels(doubaoProvider.modelWhitelist, requestedModels, ["doubao-seed-2-0-mini-260215", "doubao-seed-1-8-251228"])
      : [];

    const providers: AnnualMarketingProviderConfig[] = [];
    if (thirdPartyProvider && thirdPartyModels.length && thirdPartyApiKeys.length) {
      const configuredBaseUrls = this.apiProvidersService.getBaseUrls(thirdPartyProvider);
      const prioritizedBaseUrls = settings.baseUrl
        ? [settings.baseUrl, ...configuredBaseUrls.filter((item) => item !== settings.baseUrl)]
        : configuredBaseUrls;
      const usableBaseUrls = [
        ...prioritizedBaseUrls.filter((item) => !this.isPlaceholderProxyBaseUrl(item)),
        ...prioritizedBaseUrls.filter((item) => this.isPlaceholderProxyBaseUrl(item)),
      ];
      if (usableBaseUrls.length) {
        providers.push({
          provider: "THIRD_PARTY",
          providerId: thirdPartyProvider.id,
          providerName: thirdPartyProvider.name,
          baseUrls: usableBaseUrls,
          completionPath: this.apiProvidersService.getStringExtra(thirdPartyProvider, "completionPath") || "/v1/chat/completions",
          apiKeys: thirdPartyApiKeys.slice(0, 4),
          models: thirdPartyModels,
          temperature: settings.temperature,
          maxTokens: Math.min(settings.maxTokens || 4200, 4200),
          requestTimeoutMs: 180000,
          payloadExtras: {
            response_format: { type: "json_object" },
          },
        });
      }
    }
    if (deepseekProvider && deepseekModels.length && deepseekApiKeys.length) {
      providers.push({
        provider: "DEEPSEEK",
        providerId: deepseekProvider.id,
        providerName: deepseekProvider.name,
        baseUrls: this.apiProvidersService.getBaseUrls(deepseekProvider),
        completionPath: this.apiProvidersService.getStringExtra(deepseekProvider, "completionPath") || "/chat/completions",
        apiKeys: deepseekApiKeys.slice(0, 2),
        models: deepseekModels,
        temperature: Math.min(settings.temperature || 0.2, 0.2),
        maxTokens: Math.min(settings.maxTokens || 3200, 3200),
        requestTimeoutMs: 120000,
        payloadExtras: {
          response_format: { type: "text" },
          thinking: { type: "disabled" },
        },
      });
    }
    if (doubaoProvider && arkModels.length && doubaoApiKeys.length) {
      providers.push({
        provider: "ARK",
        providerId: doubaoProvider.id,
        providerName: doubaoProvider.name,
        baseUrls: this.apiProvidersService.getBaseUrls(doubaoProvider),
        completionPath: this.apiProvidersService.getStringExtra(doubaoProvider, "completionPath") || "/chat/completions",
        apiKeys: doubaoApiKeys.slice(0, 1),
        models: arkModels.slice(0, 1),
        temperature: Math.min(settings.temperature || 0.4, 0.4),
        maxTokens: Math.min(settings.maxTokens || 3200, 3200),
        requestTimeoutMs: 150000,
        payloadExtras: {
          response_format: { type: "json_object" },
        },
      });
    }
    if (!providers.length) {
      throw new ServiceUnavailableException("半年营销规划模型配置读取失败");
    }
    return this.reorderReportProvidersByPrimaryModel(
      this.applyReportProviderSelectionRule(providers, settings),
      settings.preferredModelName || requestedModels[0] || "",
    );
  }

  private async loadXiaohongshuMarketingProviderConfigs(settings: ModelGenerationSettings): Promise<XiaohongshuMarketingProviderConfig[]> {
    const preferredModels = [
      "gpt-5.4",
      "claude-sonnet-4-6",
      "kimi-k2.6",
      "doubao-seed-2-0-pro-260215",
      "doubao-seed-2-0-mini-260215",
      "doubao-seed-1-8-251228",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
    ];
    const apiKeyFallbackOptions = { allowMissingBrandApiKey: true };
    const requestedModels = this.orderModels(
      this.parseDelimitedModels(settings.modelName).filter((item) => preferredModels.includes(item)),
      preferredModels,
    );
    const effectiveRequestedModels = requestedModels.length ? requestedModels : preferredModels;

    const [thirdPartyProvider, kimiProvider, deepseekProvider, doubaoProvider] = await Promise.all([
      this.resolveRuntimeProviderByBaseUrl("text-global", settings.baseUrl, settings.preferredProviderIds, settings.preferredModelName),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-kimi"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-deepseek"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-doubao"),
    ]);
    const [thirdPartyApiKeys, kimiApiKeys, deepseekApiKeys, doubaoApiKeys] = await Promise.all([
      this.resolveBrandAwareApiKeys(settings.brandId, thirdPartyProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, kimiProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, deepseekProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, doubaoProvider, apiKeyFallbackOptions),
    ]);
    const thirdPartyModels = thirdPartyProvider
      ? this.pickProviderModels(thirdPartyProvider.modelWhitelist, effectiveRequestedModels, ["gpt-5.4", "claude-sonnet-4-6"])
      : [];
    const kimiModels = kimiProvider
      ? this.pickProviderModels(kimiProvider.modelWhitelist, effectiveRequestedModels, ["kimi-k2.6"])
      : [];
    const deepseekModels = deepseekProvider
      ? this.pickProviderModels(deepseekProvider.modelWhitelist, effectiveRequestedModels, ["deepseek-v4-pro", "deepseek-v4-flash"])
      : [];
    const arkModels = doubaoProvider
      ? this.pickProviderModels(
          doubaoProvider.modelWhitelist,
          effectiveRequestedModels,
          ["doubao-seed-2-0-pro-260215", "doubao-seed-2-0-mini-260215", "doubao-seed-1-8-251228"],
        )
      : [];

    const providers: XiaohongshuMarketingProviderConfig[] = [];
    if (thirdPartyProvider && thirdPartyModels.length && thirdPartyApiKeys.length) {
      const configuredBaseUrls = this.apiProvidersService.getBaseUrls(thirdPartyProvider);
      const prioritizedBaseUrls = settings.baseUrl
        ? [settings.baseUrl, ...configuredBaseUrls.filter((item) => item !== settings.baseUrl)]
        : configuredBaseUrls;
      const usableBaseUrls = [
        ...prioritizedBaseUrls.filter((item) => !this.isPlaceholderProxyBaseUrl(item)),
        ...prioritizedBaseUrls.filter((item) => this.isPlaceholderProxyBaseUrl(item)),
      ];
      if (usableBaseUrls.length) {
        providers.push({
          provider: "THIRD_PARTY",
          providerId: thirdPartyProvider.id,
          providerName: thirdPartyProvider.name,
          baseUrls: usableBaseUrls,
          completionPath: this.apiProvidersService.getStringExtra(thirdPartyProvider, "completionPath") || "/v1/chat/completions",
          apiKeys: thirdPartyApiKeys.slice(0, 4),
          models: thirdPartyModels,
          temperature: settings.temperature,
          maxTokens: Math.min(settings.maxTokens || 12000, 12000),
          requestTimeoutMs: 240000,
          payloadExtras: {
            response_format: { type: "text" },
          },
        });
      }
    }
    if (kimiProvider && kimiModels.length && kimiApiKeys.length) {
      providers.push({
        provider: "KIMI",
        providerId: kimiProvider.id,
        providerName: kimiProvider.name,
        baseUrls: this.apiProvidersService.getBaseUrls(kimiProvider),
        completionPath: this.apiProvidersService.getStringExtra(kimiProvider, "completionPath") || "/chat/completions",
        apiKeys: kimiApiKeys.slice(0, 2),
        models: kimiModels,
        temperature: 1,
        temperatureOverride: 1,
        maxTokens: Math.min(settings.maxTokens || 12000, 12000),
        requestTimeoutMs: 300000,
        tokenLimitField: "max_completion_tokens",
      });
    }
    if (doubaoProvider && arkModels.length && doubaoApiKeys.length) {
      providers.push({
        provider: "ARK",
        providerId: doubaoProvider.id,
        providerName: doubaoProvider.name,
        baseUrls: this.apiProvidersService.getBaseUrls(doubaoProvider),
        completionPath: this.apiProvidersService.getStringExtra(doubaoProvider, "completionPath") || "/chat/completions",
        apiKeys: doubaoApiKeys.slice(0, 1),
        models: arkModels.slice(0, 1),
        temperature: Math.min(settings.temperature || 0.5, 0.5),
        maxTokens: Math.min(settings.maxTokens || 12000, 12000),
        requestTimeoutMs: 240000,
        payloadExtras: {
          response_format: { type: "text" },
        },
      });
    }
    if (deepseekProvider && deepseekModels.length && deepseekApiKeys.length) {
      providers.push({
        provider: "DEEPSEEK",
        providerId: deepseekProvider.id,
        providerName: deepseekProvider.name,
        baseUrls: this.apiProvidersService.getBaseUrls(deepseekProvider),
        completionPath: this.apiProvidersService.getStringExtra(deepseekProvider, "completionPath") || "/chat/completions",
        apiKeys: deepseekApiKeys.slice(0, 2),
        models: deepseekModels,
        temperature: Math.min(settings.temperature || 0.3, 0.3),
        maxTokens: Math.min(settings.maxTokens || 12000, 12000),
        requestTimeoutMs: 240000,
        payloadExtras: {
          response_format: { type: "text" },
          thinking: { type: "disabled" },
        },
      });
    }
    if (!providers.length) {
      throw new ServiceUnavailableException("小红书营销策划方案模型配置读取失败");
    }
    return this.reorderReportProvidersByPrimaryModel(
      providers,
      settings.preferredModelName || effectiveRequestedModels[0] || "",
    );
  }

  private async loadDouyinMarketingProviderConfigs(settings: ModelGenerationSettings): Promise<XiaohongshuMarketingProviderConfig[]> {
    return this.loadXiaohongshuMarketingProviderConfigs(settings);
  }

  private async loadXiaohongshuMarketingCalendarProviderConfigs(settings: ModelGenerationSettings): Promise<XiaohongshuMarketingProviderConfig[]> {
    const preferredModels = this.mergeModelPreferenceOrder(
      settings.preferredModelName || "",
      settings.modelName || "",
      "gpt-5.4, claude-sonnet-4-6, kimi-k2.6, doubao-seed-2-0-pro-260215, doubao-seed-2-0-mini-260215, doubao-seed-1-8-251228, deepseek-v4-pro, deepseek-v4-flash",
    );
    const apiKeyFallbackOptions = { allowMissingBrandApiKey: true };
    const requestedModels = this.orderModels(this.parseDelimitedModels(settings.modelName), preferredModels);
    const effectiveRequestedModels = requestedModels.length ? requestedModels : preferredModels;

    const [thirdPartyProvider, deepseekProvider, kimiProvider, doubaoProvider] = await Promise.all([
      this.resolveRuntimeProviderByBaseUrl("text-global", settings.baseUrl, settings.preferredProviderIds, settings.preferredModelName),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-deepseek"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-kimi"),
      this.apiProvidersService.findActiveProviderByRuntimeKey("text-domestic-doubao"),
    ]);
    const [thirdPartyApiKeys, deepseekApiKeys, kimiApiKeys, doubaoApiKeys] = await Promise.all([
      this.resolveBrandAwareApiKeys(settings.brandId, thirdPartyProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, deepseekProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, kimiProvider, apiKeyFallbackOptions),
      this.resolveBrandAwareApiKeys(settings.brandId, doubaoProvider, apiKeyFallbackOptions),
    ]);
    const thirdPartyModels = thirdPartyProvider
      ? this.pickProviderModels(
        this.collectProviderModelCandidates(thirdPartyProvider, this.getTextRuntimeFallbackModels("text-global")),
        effectiveRequestedModels,
        this.getTextRuntimeFallbackModels("text-global"),
      )
      : [];
    const deepseekModels = deepseekProvider
      ? this.pickProviderModels(
        this.collectProviderModelCandidates(deepseekProvider, this.getTextRuntimeFallbackModels("text-domestic-deepseek")),
        effectiveRequestedModels,
        this.getTextRuntimeFallbackModels("text-domestic-deepseek"),
      )
      : [];
    const kimiModels = kimiProvider
      ? this.pickProviderModels(
        this.collectProviderModelCandidates(kimiProvider, this.getTextRuntimeFallbackModels("text-domestic-kimi")),
        effectiveRequestedModels,
        this.getTextRuntimeFallbackModels("text-domestic-kimi"),
      )
      : [];
    const arkModels = doubaoProvider
      ? this.pickProviderModels(
        this.collectProviderModelCandidates(doubaoProvider, this.getTextRuntimeFallbackModels("text-domestic-doubao")),
        effectiveRequestedModels,
        this.getTextRuntimeFallbackModels("text-domestic-doubao"),
      )
      : [];

    const providers: XiaohongshuMarketingProviderConfig[] = [];
    if (thirdPartyProvider && thirdPartyModels.length && thirdPartyApiKeys.length) {
      const configuredBaseUrls = this.apiProvidersService.getBaseUrls(thirdPartyProvider);
      const prioritizedBaseUrls = settings.baseUrl
        ? [settings.baseUrl, ...configuredBaseUrls.filter((item) => item !== settings.baseUrl)]
        : configuredBaseUrls;
      const usableBaseUrls = [
        ...prioritizedBaseUrls.filter((item) => !this.isPlaceholderProxyBaseUrl(item)),
        ...prioritizedBaseUrls.filter((item) => this.isPlaceholderProxyBaseUrl(item)),
      ];
      if (usableBaseUrls.length) {
        providers.push({
          provider: "THIRD_PARTY",
          providerId: thirdPartyProvider.id,
          providerName: thirdPartyProvider.name,
          baseUrls: usableBaseUrls,
          completionPath: this.apiProvidersService.getStringExtra(thirdPartyProvider, "completionPath") || "/v1/chat/completions",
          apiKeys: thirdPartyApiKeys.slice(0, 4),
          models: thirdPartyModels,
          temperature: settings.temperature,
          maxTokens: Math.min(settings.maxTokens || 9000, 9000),
          requestTimeoutMs: 240000,
          payloadExtras: {
            response_format: { type: "json_object" },
          },
        });
      }
    }
    if (deepseekProvider && deepseekModels.length && deepseekApiKeys.length) {
      providers.push({
        provider: "DEEPSEEK",
        providerId: deepseekProvider.id,
        providerName: deepseekProvider.name,
        baseUrls: this.apiProvidersService.getBaseUrls(deepseekProvider),
        completionPath: this.apiProvidersService.getStringExtra(deepseekProvider, "completionPath") || "/chat/completions",
        apiKeys: deepseekApiKeys.slice(0, 2),
        models: deepseekModels,
        temperature: Math.min(settings.temperature || 0.3, 0.3),
        maxTokens: Math.min(settings.maxTokens || 9000, 9000),
        requestTimeoutMs: 240000,
        payloadExtras: {
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
        },
      });
    }
    if (kimiProvider && kimiModels.length && kimiApiKeys.length) {
      providers.push({
        provider: "KIMI",
        providerId: kimiProvider.id,
        providerName: kimiProvider.name,
        baseUrls: this.apiProvidersService.getBaseUrls(kimiProvider),
        completionPath: this.apiProvidersService.getStringExtra(kimiProvider, "completionPath") || "/chat/completions",
        apiKeys: kimiApiKeys.slice(0, 1),
        models: kimiModels,
        temperature: 1,
        maxTokens: Math.min(settings.maxTokens || 9000, 9000),
        requestTimeoutMs: 360000,
        tokenLimitField: "max_completion_tokens",
        payloadExtras: {
          response_format: { type: "json_object" },
        },
      });
    }
    if (doubaoProvider && arkModels.length && doubaoApiKeys.length) {
      providers.push({
        provider: "ARK",
        providerId: doubaoProvider.id,
        providerName: doubaoProvider.name,
        baseUrls: this.apiProvidersService.getBaseUrls(doubaoProvider),
        completionPath: this.apiProvidersService.getStringExtra(doubaoProvider, "completionPath") || "/chat/completions",
        apiKeys: doubaoApiKeys.slice(0, 1),
        models: arkModels.slice(0, 1),
        temperature: Math.min(settings.temperature || 0.5, 0.5),
        maxTokens: Math.min(settings.maxTokens || 9000, 9000),
        requestTimeoutMs: 240000,
        payloadExtras: {
          response_format: { type: "json_object" },
        },
      });
    }
    if (!providers.length) {
      throw new ServiceUnavailableException("营销日历模型配置读取失败");
    }
    return this.reorderReportProvidersByPrimaryModel(
      this.applyReportProviderSelectionRule(providers, settings),
      settings.preferredModelName || effectiveRequestedModels[0] || "",
    );
  }

  private buildAnnualMarketingProviderPayload(
    provider: AnnualMarketingProviderConfig,
    modelName: string,
    systemPrompt: string,
    userPrompt: string,
  ) {
    const payload: Record<string, unknown> = {
      model: modelName,
      stream: false,
      temperature: provider.temperatureOverride ?? provider.temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      ...(provider.payloadExtras ?? {}),
    };
    payload[provider.tokenLimitField === "max_completion_tokens" ? "max_completion_tokens" : "max_tokens"] = provider.maxTokens;
    return payload;
  }

  private buildXiaohongshuMarketingProviderPayload(
    provider: XiaohongshuMarketingProviderConfig,
    modelName: string,
    systemPrompt: string,
    userPrompt: string,
  ) {
    const payload: Record<string, unknown> = {
      model: modelName,
      stream: false,
      temperature: provider.temperatureOverride ?? provider.temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      ...(provider.payloadExtras ?? {}),
    };
    payload[provider.tokenLimitField === "max_completion_tokens" ? "max_completion_tokens" : "max_tokens"] = provider.maxTokens;
    return payload;
  }

  private async resolvePreferredProvider(
    providerName: string | undefined,
    runtimeKey: string,
    allowedRuntimeKeys: string[] = [runtimeKey],
    preferredValues: string[] = [],
  ) {
    const activeProviders = await this.apiProvidersService.listActiveProviders();
    const preferredProviderIds = this.extractPreferredProviderIds(...preferredValues);
    for (const providerId of preferredProviderIds) {
      const matched = activeProviders.find((item) => item.id === providerId);
      const matchedRuntimeKey = matched ? this.apiProvidersService.getRuntimeKey(matched) : "";
      if (matched && (!allowedRuntimeKeys.length || allowedRuntimeKeys.includes(matchedRuntimeKey))) {
        return matched;
      }
    }
    if (providerName?.trim()) {
      const matched = activeProviders.find((item) => item.name === providerName.trim());
      const matchedRuntimeKey = matched ? this.apiProvidersService.getRuntimeKey(matched) : "";
      if (matched && (!allowedRuntimeKeys.length || allowedRuntimeKeys.includes(matchedRuntimeKey))) {
        return matched;
      }
    }
    for (const allowedRuntimeKey of allowedRuntimeKeys) {
      const matched = activeProviders.find((item) => this.apiProvidersService.getRuntimeKey(item) === allowedRuntimeKey);
      if (matched) {
        return matched;
      }
    }
    return activeProviders.find((item) => this.apiProvidersService.getRuntimeKey(item) === runtimeKey);
  }

  private async resolveRuntimeProviderByBaseUrl(
    runtimeKey: string,
    baseUrl?: string,
    preferredProviderIds: string[] = [],
    preferredModelName?: string,
    errorMessage?: string,
  ) {
    const providers = await this.apiProvidersService.listActiveProvidersByRuntimeKey(runtimeKey);
    for (const providerId of preferredProviderIds) {
      const matched = providers.find((item) => item.id === providerId);
      if (matched) {
        return matched;
      }
    }
    const normalizedPreferredModelName = String(preferredModelName || "").trim();
    if (normalizedPreferredModelName) {
      const matched = providers.find((item) => item.modelWhitelist.includes(normalizedPreferredModelName));
      if (matched) {
        return matched;
      }
    }
    const normalizedBaseUrl = this.normalizeProviderBaseUrl(baseUrl);
    if (normalizedBaseUrl) {
      const matched = providers.find((item) =>
        this.apiProvidersService.getBaseUrls(item).some((providerBaseUrl) => this.normalizeProviderBaseUrl(providerBaseUrl) === normalizedBaseUrl),
      );
      if (matched) {
        return matched;
      }
    }
    if (providers[0]) {
      return providers[0];
    }
    if (errorMessage) {
      throw new ServiceUnavailableException(errorMessage);
    }
    return undefined;
  }

  private normalizeProviderBaseUrl(value?: string) {
    return String(value || "").trim().replace(/\/+$/, "").toLowerCase();
  }

  private async requireRuntimeProvider(runtimeKey: string, errorMessage: string) {
    const provider = await this.apiProvidersService.findActiveProviderByRuntimeKey(runtimeKey);
    if (!provider) {
      throw new ServiceUnavailableException(errorMessage);
    }
    return provider;
  }

  private pickProviderModels(availableModels: string[], requestedModels: string[], preferredModels: string[]) {
    const normalizedAvailable = availableModels.map((item) => item.trim()).filter(Boolean);
    const normalizedRequested = requestedModels.map((item) => item.trim()).filter(Boolean);
    const target = normalizedRequested.length
      ? normalizedAvailable.filter((item) => normalizedRequested.includes(item))
      : normalizedAvailable;
    return this.orderModels(target.length ? target : normalizedAvailable, preferredModels);
  }

  private collectProviderModelCandidates(provider?: ApiProviderRecord, fallbackModels: string[] = []) {
    if (!provider) {
      return [];
    }
    const configuredModels = [
      ...provider.modelWhitelist.map((item) => item.trim()).filter(Boolean),
      String(provider.defaultModel || "").trim(),
    ].filter(Boolean);
    return Array.from(new Set(configuredModels.length ? configuredModels : fallbackModels));
  }

  private getTextRuntimeFallbackModels(runtimeKey: string) {
    switch (runtimeKey) {
      case "text-global":
        return ["gpt-5.4", "claude-sonnet-4-6"];
      case "text-domestic-kimi":
        return ["kimi-k2.6"];
      case "text-domestic-doubao":
        return ["doubao-seed-2-0-pro-260215", "doubao-seed-2-0-mini-260215", "doubao-seed-1-8-251228"];
      case "text-domestic-deepseek":
      default:
        return ["deepseek-v4-pro", "deepseek-v4-flash"];
    }
  }

  async getReportAsset(brandId: string, fileName: string) {
    const safeFileName = this.sanitizeStoredFileName(fileName);
    const file = await this.ossStorageService.getObject(this.buildReportAssetStorageKey(brandId, safeFileName));
    if (!file) {
      throw new NotFoundException("报告附件不存在");
    }
    return file;
  }

  private async persistReportHtml(storageKey: string, htmlContent: string) {
    await this.ossStorageService.putObject(storageKey, Buffer.from(htmlContent, "utf8"), "text/html; charset=utf-8");
  }

  private buildReportAssetStorageKey(brandId: string, fileName: string) {
    return `reports/${brandId}/${fileName}`;
  }

  private buildReportAssetUrl(brandId: string, fileName: string) {
    return `${this.appConfigService.getServerBaseUrl()}/api/reports/brands/${brandId}/assets/${encodeURIComponent(fileName)}`;
  }

  private buildGrowthReportFileName(taskId: string) {
    return `growth-report-${taskId}.html`;
  }

  private buildVisualGrowthReportFileName(taskId: string) {
    return `visual-growth-report-${taskId}.html`;
  }

  private buildAnnualMarketingPlanFileName(taskId: string) {
    return `half-year-marketing-plan-${taskId}.html`;
  }

  private buildXiaohongshuMarketingPlanFileName(taskId: string) {
    return `xiaohongshu-marketing-plan-${taskId}.html`;
  }

  private buildDouyinMarketingPlanFileName(taskId: string) {
    return `douyin-marketing-plan-${taskId}.html`;
  }

  private buildOpportunityInsightFileName(taskId: string, stepKey: OpportunityInsightStepKey) {
    return `opportunity-insight-${stepKey}-${taskId}.html`;
  }

  private extractFileNameFromStorageKey(storageKey: string) {
    const normalized = storageKey.split("?")[0]?.split("#")[0] ?? "";
    const parts = normalized.split("/");
    return this.sanitizeStoredFileName(parts[parts.length - 1] ?? "");
  }

  private sanitizeStoredFileName(fileName: string) {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, "");
  }

  private buildManualReportResult(reportMarkdown: string, nextTitle?: string) {
    const title = nextTitle?.trim() || this.extractMarkdownTitle(reportMarkdown) || "品牌增长报告";
    const summary = this.extractMarkdownSummary(reportMarkdown) || "品牌增长报告已更新。";
    return {
      title,
      summary,
      reportMarkdown,
      htmlContent: this.renderMarkdownToHtml(reportMarkdown),
    };
  }

  private buildManualVisualReportResult(htmlBody: string, nextTitle?: string) {
    const title = nextTitle?.trim() || "品牌增长可视化报告";
    const summary = "品牌增长可视化报告已更新。";
    return {
      title,
      summary,
      htmlBody,
      htmlDocument: this.buildVisualReportDocument(title, htmlBody),
    };
  }

  private buildManualXiaohongshuMarketingPlanResult(reportMarkdown: string, nextTitle?: string) {
    const title = nextTitle?.trim() || this.extractMarkdownTitle(reportMarkdown) || "灏忕孩涔﹁惀閿€绛栧垝鏂规";
    const summary = this.extractMarkdownSummary(reportMarkdown) || "灏忕孩涔﹁惀閿€绛栧垝鏂规宸叉洿鏂般€";
    return {
      title,
      summary,
      reportMarkdown,
      htmlContent: this.renderMarkdownToHtml(reportMarkdown),
    };
  }

  private buildManualDouyinMarketingPlanResult(reportMarkdown: string, nextTitle?: string) {
    const title = nextTitle?.trim() || this.extractMarkdownTitle(reportMarkdown) || "抖音营销策划方案";
    const summary = this.extractMarkdownSummary(reportMarkdown) || "抖音营销策划方案已更新。";
    return {
      title,
      summary,
      reportMarkdown,
      htmlContent: this.renderMarkdownToHtml(reportMarkdown),
    };
  }

  private buildManualDouyinOriginalCopyResult(content: string, nextTitle?: string, fallbackTitle?: string) {
    const normalizedMarkdown = this.stripMarkdownCodeFence(content).trim();
    const title = nextTitle?.trim() || this.extractMarkdownTitle(normalizedMarkdown) || fallbackTitle || "抖音原创文案";
    const reportMarkdown = normalizedMarkdown.startsWith("# ")
      ? normalizedMarkdown
      : `# ${title}\n\n${normalizedMarkdown}`;
    const summary = this.extractMarkdownSummary(reportMarkdown) || `${title}已更新。`;
    return {
      title,
      summary,
      content: reportMarkdown,
    };
  }

  private buildManualDouyinRemixCopyResult(content: string, nextTitle?: string, fallbackTitle?: string) {
    const normalizedMarkdown = this.stripMarkdownCodeFence(content).trim();
    const title = nextTitle?.trim() || this.extractMarkdownTitle(normalizedMarkdown) || fallbackTitle || "抖音二创文案";
    const reportMarkdown = normalizedMarkdown.startsWith("# ")
      ? normalizedMarkdown
      : `# ${title}\n\n${normalizedMarkdown}`;
    const summary = this.extractMarkdownSummary(reportMarkdown) || `${title}已更新。`;
    return {
      title,
      summary,
      content: reportMarkdown,
    };
  }

  private buildManualXiaohongshuMarketingCalendarResult(items: XiaohongshuMarketingCalendarItem[], nextTitle?: string) {
    const normalizedItems = this.normalizeXiaohongshuMarketingCalendarItems(items);
    return {
      title: nextTitle?.trim() || "品牌全平台营销日历",
      summary: normalizedItems.length ? `已更新 ${normalizedItems.length} 天品牌全平台营销日历。` : "品牌全平台营销日历已更新。",
      items: normalizedItems,
    };
  }

  private buildVisualReportDocument(title: string, htmlBody: string) {
    return [
      "<!DOCTYPE html>",
      '<html lang="zh-CN">',
      "<head>",
      '  <meta charset="utf-8" />',
      '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
      `  <title>${this.escapeHtml(title)}</title>`,
      [
        "  <style>",
        '    :root{color-scheme:light;font-family:"PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif;}',
        '    *{box-sizing:border-box;}',
        "    html,body{margin:0;padding:0;background:#eef3f8;color:#0f172a;}",
        "    body{min-height:100vh;}",
        "    .generated-report-shell{max-width:1120px;margin:0 auto;padding:32px 20px 48px;}",
        "    .generated-report-hero{padding:28px 30px;border-radius:28px;background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 52%,#60a5fa 100%);color:#fff;box-shadow:0 24px 70px rgba(37,99,235,0.24);}",
        "    .generated-report-eyebrow{display:inline-flex;align-items:center;padding:7px 14px;border-radius:999px;background:rgba(255,255,255,0.16);font-size:12px;font-weight:700;letter-spacing:0.04em;}",
        "    .generated-report-hero h1{margin:18px 0 10px;font-size:40px;line-height:1.18;color:#fff;}",
        "    .generated-report-hero p{margin:0;max-width:840px;font-size:15px;line-height:1.85;color:rgba(255,255,255,0.92);}",
        "    .generated-report-surface{margin-top:22px;padding:26px 28px;border-radius:24px;background:#ffffff;border:1px solid #dbe4f0;box-shadow:0 12px 32px rgba(15,23,42,0.08);}",
        "    .generated-report-markdown{display:flex;flex-direction:column;gap:0;}",
        "    .generated-report-markdown > *:first-child{margin-top:0 !important;}",
        "    .generated-report-markdown h1,.generated-report-markdown h2,.generated-report-markdown h3,.generated-report-markdown h4,.generated-report-markdown h5,.generated-report-markdown h6{margin:24px 0 12px;color:#0f172a;line-height:1.35;}",
        "    .generated-report-markdown h1{font-size:32px;}",
        "    .generated-report-markdown h2{font-size:24px;padding-top:18px;border-top:1px solid #e2e8f0;}",
        "    .generated-report-markdown h3{font-size:19px;}",
        "    .generated-report-markdown h4{font-size:17px;}",
        "    .generated-report-markdown p{margin:0 0 14px;font-size:15px;line-height:1.95;color:#334155;}",
        "    .generated-report-markdown ul,.generated-report-markdown ol{margin:0 0 16px;padding-left:24px;color:#334155;}",
        "    .generated-report-markdown li{margin-bottom:10px;font-size:15px;line-height:1.9;}",
        "    .generated-report-markdown strong{color:#0f172a;font-weight:700;}",
        "    .generated-report-markdown em{color:#1d4ed8;font-style:normal;font-weight:600;}",
        "    .generated-report-markdown blockquote{margin:8px 0 18px;padding:16px 18px;border-left:4px solid #60a5fa;border-radius:16px;background:#eff6ff;color:#1e3a8a;}",
        "    .generated-report-markdown code{padding:2px 8px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:13px;}",
        "    .generated-report-markdown hr{margin:22px 0;border:none;border-top:1px solid #dbe4f0;}",
        "    .generated-report-markdown table{width:100%;border-collapse:collapse;margin:0 0 18px;background:#fff;border:1px solid #dbe4f0;border-radius:18px;overflow:hidden;}",
        "    .generated-report-markdown th,.generated-report-markdown td{padding:12px 14px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:14px;line-height:1.7;color:#334155;vertical-align:top;}",
        "    .generated-report-markdown th{background:#f8fafc;color:#0f172a;font-weight:700;}",
        "    .generated-report-markdown tr:last-child td{border-bottom:none;}",
        "    .generated-report-markdown a{color:#2563eb;text-decoration:none;}",
        "    @media (max-width: 768px){.generated-report-shell{padding:18px 12px 28px;}.generated-report-hero{padding:22px 18px;border-radius:22px;}.generated-report-hero h1{font-size:30px;}.generated-report-surface{padding:18px 16px;border-radius:18px;}}",
        "  </style>",
      ].join(""),
      "</head>",
      `<body><div class="generated-report-shell"><section class="generated-report-hero"><div class="generated-report-eyebrow">AI HTML REPORT</div><h1>${this.escapeHtml(title)}</h1><p>以下内容为本次机会洞察工作流生成的 HTML 报告，可直接预览、归档与继续复盘。</p></section><section class="generated-report-surface">${htmlBody}</section></div></body>`,
      "</html>",
    ].join("");
  }

  private buildOpportunityInsightHtmlResult(title: string, reportContent: string) {
    if (this.isLikelyHtmlContent(reportContent)) {
      const htmlDocument = this.ensureHtmlDocument(title, reportContent);
      const bodyMatch = htmlDocument.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      return {
        htmlBody: bodyMatch?.[1]?.trim() || reportContent,
        htmlDocument,
      };
    }

    const htmlBody = this.renderMarkdownToHtml(reportContent);
    return {
      htmlBody,
      htmlDocument: this.buildVisualReportDocument(title, htmlBody),
    };
  }

  private ensureHtmlDocument(title: string, htmlContent: string) {
    const trimmed = htmlContent.trim();
    if (/<html[\s>]/i.test(trimmed)) {
      return trimmed;
    }
    return this.buildVisualReportDocument(title, trimmed);
  }

  private isLikelyHtmlContent(content: string) {
    const trimmed = content.trim();
    if (!trimmed.startsWith("<")) {
      return false;
    }
    return /<(?:!doctype|html|body|main|section|article|div|header|h1|h2|h3|p|ul|ol|table)\b/i.test(trimmed);
  }

  private extractHtmlTitle(html: string) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch?.[1]) {
      return this.decodeHtmlEntities(this.stripHtmlTags(titleMatch[1])).trim();
    }
    const headingMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (headingMatch?.[1]) {
      return this.decodeHtmlEntities(this.stripHtmlTags(headingMatch[1])).trim();
    }
    return "";
  }

  private extractHtmlSummary(html: string) {
    const paragraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!paragraphMatch?.[1]) {
      return "";
    }
    return this.truncateText(this.decodeHtmlEntities(this.stripHtmlTags(paragraphMatch[1])), 120);
  }

  private isPlaceholderProxyBaseUrl(value: string) {
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      return hostname.endsWith(".local");
    } catch {
      return false;
    }
  }

  private containsXiaohongshuWorkflowArtifacts(content: string) {
    const normalized = content.toLowerCase();
    const patterns = [
      "create_file(",
      "edit_file(",
      "write_file_section",
      "<tool_call>",
      "<tool_response>",
      "\"name\": \"create_file\"",
      "\"name\": \"edit_file\"",
      "let me write this in sections",
      "i'll now write the full document",
      "i will write the full document",
      "鍒嗗涓枃浠跺潡鍐欏叆",
      "鍏堝垱寤烘柟妗堟枃浠剁殑绗竴閮ㄥ垎",
      "鍏堣緭鍑烘柟妗堟枃浠剁殑绗竴閮ㄥ垎",
      "缁啓涓嬩竴閮ㄥ垎",
      "section 1:",
    ];
    return patterns.some((item) => normalized.includes(item));
  }

  private isCompleteXiaohongshuMarketingMarkdown(markdown: string) {
    const hasTitle = /^#\s+.+/m.test(markdown);
    const requiredSections = ["## 一、", "## 二、", "## 三、", "## 四、", "## 五、"];
    const normalized = markdown.replace(/\s+/g, "");
    const hasRequiredSections = requiredSections.every((item) => normalized.includes(item.replace(/\s+/g, "")));
    if (!hasTitle || !hasRequiredSections) {
      return false;
    }

    if (/```markdown\s*$/i.test(markdown.trim())) {
      return false;
    }

    const tail = markdown.trim().slice(-240).toLowerCase();
    if (
      tail.includes("to be continued")
      || tail.includes("鏈畬寰呯画")
      || tail.includes("涓嬩竴閮ㄥ垎")
      || tail.includes("section ")
      || tail.includes("write_file_section")
      || tail.includes("<tool_call>")
    ) {
      return false;
    }

    return true;
  }

  private ensureXiaohongshuMarkdownTitle(markdown: string, fallbackTitle: string) {
    const normalized = markdown.trim();
    return normalized.startsWith("# ")
      ? normalized
      : `# ${fallbackTitle}\n\n${normalized}`;
  }

  private matchesXiaohongshuHeading(line: string, headingPrefix: string) {
    const trimmedLine = line.trim();
    const headingMatch = trimmedLine.match(/^(#{2,})\s*(.+)$/);
    if (!headingMatch) {
      return false;
    }
    const currentHeadingText = headingMatch[2].replace(/\s+/g, "");
    const targetHeadingText = headingPrefix.replace(/^#+\s*/, "").replace(/\s+/g, "");
    return currentHeadingText.startsWith(targetHeadingText);
  }

  private extractMarkdownPrefixBeforeHeading(markdown: string, firstHeadingPrefix: string) {
    const lines = markdown.split(/\r?\n/);
    const titleIndex = lines.findIndex((line) => line.trim().startsWith("# "));
    const headingIndex = lines.findIndex((line) => this.matchesXiaohongshuHeading(line, firstHeadingPrefix));
    if (headingIndex <= 0) {
      return "";
    }
    const startIndex = titleIndex >= 0 ? titleIndex + 1 : 0;
    return lines.slice(startIndex, headingIndex).join("\n").trim();
  }

  private extractMarkdownSection(markdown: string, headingPrefix: string, nextHeadingPrefixes: string[]) {
    const lines = markdown.split(/\r?\n/);
    const startIndex = lines.findIndex((line) => this.matchesXiaohongshuHeading(line, headingPrefix));
    if (startIndex < 0) {
      return "";
    }
    let endIndex = lines.length;
    for (let index = startIndex + 1; index < lines.length; index += 1) {
      const current = lines[index];
      if (nextHeadingPrefixes.some((item) => this.matchesXiaohongshuHeading(current, item))) {
        endIndex = index;
        break;
      }
    }
    return lines.slice(startIndex, endIndex).join("\n").trim();
  }

  private isUsableXiaohongshuMarketingPlanRecord(record: XiaohongshuMarketingPlanRecord) {
    const markdown = record.reportMarkdown?.trim();
    if (!markdown) {
      return false;
    }
    if (this.containsXiaohongshuWorkflowArtifacts(markdown)) {
      return false;
    }
    return this.isCompleteXiaohongshuMarketingMarkdown(markdown);
  }

  private isCompleteDouyinMarketingMarkdown(markdown: string) {
    const normalized = markdown.trim();
    if (!/^#\s+.+/m.test(normalized)) {
      return false;
    }
    if ((normalized.match(/^##\s+.+/gm) || []).length < 3) {
      return false;
    }
    if (/```markdown\s*$/i.test(normalized)) {
      return false;
    }
    const tail = normalized.slice(-240).toLowerCase();
    if (
      tail.includes("to be continued")
      || tail.includes("未完待续")
      || tail.includes("下一部分")
      || tail.includes("section ")
      || tail.includes("write_file_section")
      || tail.includes("<tool_call>")
    ) {
      return false;
    }
    return true;
  }

  private countReadableTextLength(markdown: string) {
    return markdown
      .replace(/<[^>]+>/g, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/[`>#*_~\[\]\(\)|]/g, "")
      .replace(/\s+/g, "")
      .length;
  }

  private isUsableDouyinMarketingPlanRecord(record: DouyinMarketingPlanRecord) {
    const markdown = record.reportMarkdown?.trim();
    if (!markdown) {
      return false;
    }
    if (this.containsXiaohongshuWorkflowArtifacts(markdown)) {
      return false;
    }
    return this.isCompleteDouyinMarketingMarkdown(markdown);
  }

  private renderVisualOutlineToHtml(outline: VisualReportOutlineModelResult) {
    const metricCards = outline.metrics
      .map((item) => [
        '<div style="flex:1 1 180px;min-width:180px;padding:20px 18px;border-radius:18px;background:rgba(255,255,255,0.14);backdrop-filter:blur(6px);">',
        `<div style="font-size:13px;opacity:0.82;margin-bottom:8px;">${this.escapeHtml(item.label)}</div>`,
        `<div style="font-size:34px;font-weight:700;line-height:1.1;margin-bottom:8px;">${this.escapeHtml(item.value)}</div>`,
        `<div style="font-size:13px;line-height:1.7;opacity:0.86;">${this.escapeHtml(item.note)}</div>`,
        "</div>",
      ].join(""))
      .join("");

    const sectionBlocks = outline.sections
      .map((section, index) => {
        const bullets = section.bullets.length
          ? `<ul style="margin:16px 0 0;padding-left:20px;color:#4b5563;font-size:15px;line-height:1.8;">${section.bullets.map((item) => `<li style="margin-bottom:8px;">${this.escapeHtml(item)}</li>`).join("")}</ul>`
          : "";
        return [
          '<section style="padding:28px;border-radius:24px;background:#ffffff;border:1px solid #ebe7df;box-shadow:0 12px 30px rgba(111,78,55,0.08);">',
          `<div style="display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;background:#f7efe4;color:#9a5317;font-size:12px;font-weight:600;margin-bottom:14px;">0${index + 1}</div>`,
          `<h2 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#2f241d;">${this.escapeHtml(section.title)}</h2>`,
          `<p style="margin:0;color:#5b534b;font-size:15px;line-height:1.9;">${this.escapeHtml(section.body)}</p>`,
          bullets,
          "</section>",
        ].join("");
      })
      .join("");

    const actionItems = outline.actionItems
      .map((item) => [
        '<div style="padding:18px 20px;border-radius:18px;background:#fff;border:1px solid #eadfce;">',
        `<div style="font-size:15px;line-height:1.8;color:#473b33;">${this.escapeHtml(item)}</div>`,
        "</div>",
      ].join(""))
      .join("");

    return [
      '<div style="min-height:100vh;background:linear-gradient(180deg,#f7f4ef 0%,#f3f5f9 100%);padding:32px 20px 48px;">',
      '<div style="max-width:1120px;margin:0 auto;">',
      '<section style="padding:36px;border-radius:32px;background:linear-gradient(135deg,#7a3b11 0%,#a45a1c 55%,#d9a15f 100%);color:#fff;box-shadow:0 20px 60px rgba(122,59,17,0.28);">',
      `<div style="display:inline-flex;align-items:center;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.14);font-size:12px;font-weight:600;letter-spacing:0.02em;">${this.escapeHtml(outline.eyebrow)}</div>`,
      `<h1 style="margin:18px 0 12px;font-size:46px;line-height:1.18;">${this.escapeHtml(outline.heroTitle)}</h1>`,
      `<p style="margin:0;max-width:760px;font-size:18px;line-height:1.85;color:rgba(255,255,255,0.92);">${this.escapeHtml(outline.heroSubtitle)}</p>`,
      `<div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:28px;">${metricCards}</div>`,
      "</section>",
      '<section style="margin-top:24px;padding:28px;border-radius:24px;background:#fff7ed;border:1px solid #f3dfc4;">',
      '<div style="font-size:13px;font-weight:700;color:#a16207;letter-spacing:0.04em;">鎽樿</div>',
      `<p style="margin:12px 0 0;font-size:16px;line-height:1.9;color:#4b5563;">${this.escapeHtml(outline.summary)}</p>`,
      "</section>",
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:24px;">${sectionBlocks}</div>`,
      '<section style="margin-top:24px;padding:28px;border-radius:28px;background:#2f241d;color:#fff;">',
      `<h2 style="margin:0 0 16px;font-size:26px;line-height:1.3;">${this.escapeHtml(outline.actionTitle)}</h2>`,
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;">${actionItems}</div>`,
      "</section>",
      "</div>",
      "</div>",
    ].join("");
  }

  private renderAnnualMarketingPlanToHtml(plan: AnnualMarketingPlanModelResult) {
    const focusTags = plan.planningFocus
      .map((item) => `<span style="display:inline-flex;align-items:center;padding:8px 12px;border-radius:999px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:13px;font-weight:600;">${this.escapeHtml(item)}</span>`)
      .join("");
    const rows = plan.items
      .map((item, index) => {
        const background = index % 2 === 0 ? "#f8fafc" : "#eef4fb";
        return [
          `<tr style="background:${background};">`,
          `<td style="padding:14px 12px;border-bottom:1px solid #d9e2ef;font-weight:700;color:#0f172a;">${this.escapeHtml(item.month)}</td>`,
          `<td style="padding:14px 12px;border-bottom:1px solid #d9e2ef;color:#0f172a;">${this.escapeHtml(item.node)}</td>`,
          `<td style="padding:14px 12px;border-bottom:1px solid #d9e2ef;color:#0f172a;">${this.escapeHtml(item.type)}</td>`,
          `<td style="padding:14px 12px;border-bottom:1px solid #d9e2ef;color:#0f172a;">${this.escapeHtml(item.date)}</td>`,
          `<td style="padding:14px 12px;border-bottom:1px solid #d9e2ef;color:#0f172a;line-height:1.7;">${this.escapeHtml(item.marketingTheme)}</td>`,
          `<td style="padding:14px 12px;border-bottom:1px solid #d9e2ef;color:#334155;line-height:1.7;">${this.escapeHtml(item.platforms.join("、"))}</td>`,
          `<td style="padding:14px 12px;border-bottom:1px solid #d9e2ef;color:#334155;line-height:1.7;">${this.escapeHtml(item.strategy)}</td>`,
          `<td style="padding:14px 12px;border-bottom:1px solid #d9e2ef;color:#334155;line-height:1.7;">${this.escapeHtml(item.products.join("、") || "-")}</td>`,
          "</tr>",
        ].join("");
      })
      .join("");

    return [
      '<div style="min-height:100vh;background:linear-gradient(180deg,#f4f8ff 0%,#eef3f8 100%);padding:28px 18px 44px;">',
      '<div style="max-width:1240px;margin:0 auto;">',
      '<section style="padding:28px 28px 26px;border-radius:28px;background:linear-gradient(135deg,#2b5fa9 0%,#4d83c7 55%,#86aee2 100%);color:#fff;box-shadow:0 20px 60px rgba(43,95,169,0.22);">',
      `<div style="display:inline-flex;align-items:center;padding:7px 14px;border-radius:999px;background:rgba(255,255,255,0.16);font-size:12px;font-weight:700;">${this.escapeHtml(plan.planningYear)} 半年营销节奏规划</div>`,
      `<h1 style="margin:18px 0 12px;font-size:40px;line-height:1.18;">${this.escapeHtml(plan.title)}</h1>`,
      `<p style="margin:0;max-width:900px;font-size:16px;line-height:1.9;color:rgba(255,255,255,0.92);">${this.escapeHtml(plan.summary)}</p>`,
      `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:20px;">${focusTags}</div>`,
      '</section>',
      '<section style="margin-top:22px;padding:22px;border-radius:24px;background:#ffffff;border:1px solid #dbe5f0;">',
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;">',
      '<div>',
      '<div style="font-size:14px;font-weight:700;color:#2b5fa9;">半年营销规划表</div>',
      '<div style="margin-top:6px;font-size:14px;line-height:1.8;color:#475569;">按未来半年月份、节点、日期、类型、营销主题、策略、平台和产品进行统一编排，便于后续执行与拆分。</div>',
      '</div>',
      `<div style="padding:12px 16px;border-radius:18px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:13px;font-weight:700;">规划条目 ${plan.items.length} 条</div>`,
      '</div>',
      '<div style="margin-top:18px;overflow:auto;border-radius:20px;border:1px solid #cbd5e1;">',
      '<table style="width:100%;border-collapse:collapse;min-width:1120px;background:#fff;">',
      '<thead>',
      '<tr style="background:#4d83c7;color:#fff;">',
      '<th style="padding:14px 12px;text-align:left;font-size:14px;">月份</th>',
      '<th style="padding:14px 12px;text-align:left;font-size:14px;">节点</th>',
      '<th style="padding:14px 12px;text-align:left;font-size:14px;">类型</th>',
      '<th style="padding:14px 12px;text-align:left;font-size:14px;">日期</th>',
      '<th style="padding:14px 12px;text-align:left;font-size:14px;">营销主题</th>',
      '<th style="padding:14px 12px;text-align:left;font-size:14px;">平台</th>',
      '<th style="padding:14px 12px;text-align:left;font-size:14px;">营销策略</th>',
      '<th style="padding:14px 12px;text-align:left;font-size:14px;">产品</th>',
      '</tr>',
      '</thead>',
      `<tbody>${rows}</tbody>`,
      '</table>',
      '</div>',
      '</section>',
      '</div>',
      '</div>',
    ].join("");
  }

  private extractHtmlBodyContent(content: string) {
    const trimmed = content.trim();
    const fencedMatch = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/i);
    const candidate = fencedMatch?.[1]?.trim() || trimmed;
    if (!candidate) {
      return "";
    }
    if (candidate.startsWith("{") && candidate.includes("\"htmlBody\"")) {
      return "";
    }
    if (candidate.includes("<body")) {
      const bodyMatch = candidate.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      return bodyMatch?.[1]?.trim() || "";
    }
    return candidate.includes("<") ? candidate : "";
  }

  private extractJsonStringField(content: string, fieldName: string) {
    const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`"${escapedFieldName}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "s");
    const match = content.match(pattern);
    if (!match?.[1]) {
      return "";
    }

    try {
      return JSON.parse(`"${match[1]}"`) as string;
    } catch {
      return match[1]
        .replace(/\\"/g, "\"")
        .replace(/\\\\/g, "\\")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t");
    }
  }

  private assertCompleteVisualHtmlBody(htmlBody: string) {
    const trimmed = htmlBody.trim();
    if (!trimmed) {
      throw new ServiceUnavailableException("鍝佺墝澧為暱鍙鍖栨姤鍛婅В鏋愬け璐ワ細htmlBody 涓虹┖");
    }
    if (!trimmed.endsWith(">")) {
      throw new ServiceUnavailableException("鍝佺墝澧為暱鍙鍖栨姤鍛婅В鏋愬け璐ワ細htmlBody 鐤戜技琚埅鏂");
    }
  }

  private async requestModelCompletion(
    baseUrl: string,
    completionPath: string,
    apiKey: string,
    payload: Record<string, unknown>,
    timeoutMs = 60000,
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(`${baseUrl}${completionPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveModelAttemptTimeoutMs(configuredTimeoutMs: number | undefined, defaultTimeoutMs: number) {
    if (configuredTimeoutMs && configuredTimeoutMs > 0) {
      return configuredTimeoutMs;
    }
    return defaultTimeoutMs;
  }

  private extractMarkdownTitle(markdown: string) {
    const heading = markdown.split(/\r?\n/).find((line) => line.trim().startsWith("# "));
    return heading ? heading.trim().slice(2).trim() : "";
  }

  private extractMarkdownSummary(markdown: string) {
    const lines = markdown.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const summaryLine = lines.find((line) => !line.startsWith("#") && !line.startsWith("- "));
    return summaryLine || "";
  }

  private resolveCalendarStartDate(lastHistoryDate: string | undefined, generatedAt: string) {
    const start = lastHistoryDate ? new Date(`${lastHistoryDate}T00:00:00+08:00`) : new Date(generatedAt);
    if (lastHistoryDate) {
      start.setDate(start.getDate() + 1);
    }
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  }

  private buildExpectedCalendarDates(startDate: string, days: number) {
    if (!startDate || !Number.isFinite(days) || days <= 0) {
      return [];
    }
    return Array.from({ length: days }, (_, index) => this.shiftDate(startDate, index)).filter(Boolean);
  }

  private buildMarketingCalendarExecutionCapabilityInventory(generatedAt: string): MarketingCalendarCapabilityInventory {
    return {
      generatedAt,
      items: [
        {
          platform: "小红书",
          featureName: "营销规划",
          outputType: "策略方案",
          description: "可输出小红书营销规划，用于沉淀内容支柱、种草节奏与账号打法。",
        },
        {
          platform: "小红书",
          featureName: "原创笔记",
          outputType: "图文/视频内容",
          description: "可生成通用、科普、测评、避坑等多类型原创笔记文案与标题标签。",
        },
        {
          platform: "小红书",
          featureName: "配图生成",
          outputType: "封面/内页提示词",
          description: "可生成原创配图与二创配图提示词，用于封面图和内容页视觉执行。",
        },
        {
          platform: "小红书",
          featureName: "视频笔记",
          outputType: "剧本/故事板",
          description: "可生成品牌宣传、口播带货、短剧带货等视频剧本与故事板提示词。",
        },
        {
          platform: "抖音",
          featureName: "营销策划与热点选题",
          outputType: "策略方案/选题清单",
          description: "可输出抖音营销策划方案，并结合热点生成可执行选题。",
        },
        {
          platform: "抖音",
          featureName: "原创文案",
          outputType: "短视频脚本",
          description: "可生成聊观点、讲故事、晒过程、教知识、剧情带货、种草、同城带货等原创文案。",
        },
        {
          platform: "抖音",
          featureName: "二创文案",
          outputType: "拆解与重写脚本",
          description: "可对素材视频进行开头、正文、结尾拆解，并生成最终二创文案。",
        },
        {
          platform: "抖音",
          featureName: "AI生视频/复刻短视频/数字人",
          outputType: "剧本/提示词/口播脚本",
          description: "可生成 AI 生视频剧本、故事板、复刻分析与数字人口播脚本。",
        },
        {
          platform: "公众号",
          featureName: "文章创作工作流",
          outputType: "文章/配图/HTML",
          description: "可生成公众号文章、封面图、正文配图、HTML 渲染与 API 发布配置。",
        },
        {
          platform: "朋友圈",
          featureName: "复用建议",
          outputType: "图文/短视频",
          description: "朋友圈内容可直接复用小红书图文思路与当日抖音短视频成片，形成轻量分发。",
        },
      ],
    };
  }

  private normalizeXiaohongshuMarketingCalendarModelResult(
    content: string,
    inputPayload: Record<string, unknown>,
    modelName: string,
  ): XiaohongshuMarketingCalendarModelResult {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(this.extractJsonObject(this.stripMarkdownCodeFence(content))) as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException("营销日历解析失败：模型未返回有效 JSON");
    }

    const startDate = String(inputPayload.startDate ?? "").trim();
    const title = String(parsed.title ?? "").trim() || "品牌全平台营销日历";
    const items = this.normalizeXiaohongshuMarketingCalendarItems(parsed.items, startDate);
    if (items.length < 7) {
      throw new ServiceUnavailableException(`营销日历解析失败：返回天数不足 7 天（实际 ${items.length} 天）`);
    }
    return {
      title,
      summary: String(parsed.summary ?? "").trim() || `已生成从 ${startDate} 开始的 7 天品牌全平台营销日历。`,
      items: items.slice(0, 7),
      modelName,
    };
  }

  private normalizeDouyinHotTopicCandidateItems(raw: unknown): DouyinHotTopicCandidateItem[] {
    const items = Array.isArray(raw) ? raw : [];
    return items
      .map((item) => this.asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map<DouyinHotTopicCandidateItem | undefined>((item, index) => {
        const title = String(item.title ?? item.topicTitle ?? item.topicName ?? item.name ?? "").trim();
        const description = String(
          item.description
          ?? item.topicDescription
          ?? item.reason
          ?? item.summary
          ?? item.highlight
          ?? "",
        ).trim();
        return title
          ? {
              id: String(item.id ?? "").trim() || `topic-${index + 1}-${this.createSlug(title)}`,
              title,
              description: description || undefined,
              checked: Boolean(item.checked),
            }
          : undefined;
      })
      .filter((item): item is DouyinHotTopicCandidateItem => Boolean(item));
  }

  private parseDouyinHotTopicCandidateItemsFromText(content: string) {
    const lines = this.stripMarkdownCodeFence(content)
      .split(/\r?\n/)
      .map((line) => line.trim());
    const structuredTitles = this.extractDouyinHotTopicTitlesFromStructuredText(lines);
    if (structuredTitles.length) {
      return structuredTitles.map((title, index) => ({
        id: `topic-${index + 1}-${this.createSlug(title)}`,
        title,
        description: undefined,
        checked: false,
      }));
    }
    const normalized = lines
      .map((line) => line.replace(/^[-*•\d.\s\[\]xX()（）]+/, "").trim())
      .filter(Boolean)
      .filter((line) => !/^(\[?热点借势策略分析报告\]?|一、基础信息|二、热点分析|三、行业匹配度分析|四、推荐策略|五、预期效果)$/.test(line));
    const uniqueTitles: string[] = [];
    for (const line of normalized) {
      if (!line || uniqueTitles.includes(line)) {
        continue;
      }
      uniqueTitles.push(line);
      if (uniqueTitles.length >= 3) {
        break;
      }
    }
    return uniqueTitles.map((title, index) => ({
      id: `topic-${index + 1}-${this.createSlug(title)}`,
      title,
      description: undefined,
      checked: false,
    }));
  }

  private extractDouyinHotTopicTitlesFromStructuredText(lines: string[]) {
    const titles: string[] = [];
    const headingPattern = /^热点选题([一二三四五六七八九十\d]+)\s*[:：]?\s*(.*)$/;
    const titleFieldPattern = /^(?:[-*•]\s*)?(?:选题标题|标题|热点名称)\s*[:：]\s*(.+)$/;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const headingMatch = line.match(headingPattern);
      if (!headingMatch) {
        continue;
      }

      const inlineTitle = String(headingMatch[2] || "").trim();
      if (inlineTitle) {
        if (!titles.includes(inlineTitle)) {
          titles.push(inlineTitle);
        }
        if (titles.length >= 3) {
          break;
        }
        continue;
      }

      for (let lookAhead = index + 1; lookAhead < lines.length; lookAhead += 1) {
        const nextLine = lines[lookAhead];
        if (headingPattern.test(nextLine)) {
          break;
        }
        const titleFieldMatch = nextLine.match(titleFieldPattern);
        if (!titleFieldMatch) {
          continue;
        }
        const resolvedTitle = String(titleFieldMatch[1] || "").trim();
        if (resolvedTitle && !titles.includes(resolvedTitle)) {
          titles.push(resolvedTitle);
        }
        break;
      }

      if (titles.length >= 3) {
        break;
      }
    }

    return titles.slice(0, 3);
  }

  private createSlug(value: string) {
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    return normalized || createId("topic");
  }

  private normalizeDouyinTopicLibraryItems(raw: unknown): DouyinTopicLibraryItem[] {
    const items = Array.isArray(raw) ? raw : [];
    const uniqueMap = new Map<string, DouyinTopicLibraryItem>();
    for (const [index, rawItem] of items.entries()) {
      const item = this.asRecord(rawItem);
      if (!item) {
        continue;
      }
      const topicTitle = String(item.topicTitle ?? item.title ?? item.topicName ?? item.topicContent ?? "").trim();
      const topicContent = String(item.topicContent ?? item.description ?? topicTitle).trim();
      if (!topicTitle && !topicContent) {
        continue;
      }
      const resolvedTopicTitle = topicTitle || topicContent;
      const resolvedTopicContent = topicContent || resolvedTopicTitle;
      const topicPlatform = this.normalizeDouyinTopicPlatform(item.topicPlatform);
      const dedupeKey = `${topicPlatform}|${resolvedTopicTitle}|${resolvedTopicContent}`.toLowerCase();
      if (uniqueMap.has(dedupeKey)) {
        continue;
      }
      const presentationFormat = String(item.presentationFormat ?? item.presentation ?? item.expressionFocus ?? "").trim();
      const topicGoal = String(item.topicGoal ?? item.goal ?? item.target ?? "").trim();
      const expertSkill = String(item.expertSkill ?? item.skill ?? item.expert ?? "").trim();
      const topicDescription = String(item.topicDescription ?? item.description ?? topicGoal ?? presentationFormat).trim() || undefined;
      const selectedAt = String(item.selectedAt ?? item.generatedAt ?? "").trim() || new Date().toISOString();
      const reusable = this.normalizeDouyinTopicReusable(item.reusable ?? item.isReusable ?? item.reuseable);
      const reuseCycle = String(item.reuseCycle ?? item.repeatCycle ?? "").trim() || undefined;
      const matchedExplosiveTemplateHtmls = this.normalizeDouyinTopicMatchedExplosiveTemplates(
        item.matchedExplosiveTemplateHtmls ?? item.matchExplosiveTemplateHtmls ?? item.explosiveTemplateHtmls ?? item.explosiveAnalysisHtmls,
      );
      uniqueMap.set(dedupeKey, {
        id: String(item.id ?? "").trim() || `topic-library-${index + 1}-${this.createSlug(`${topicPlatform}-${resolvedTopicTitle}`)}`,
        topicTitle: resolvedTopicTitle,
        topicContent: resolvedTopicContent,
        topicPlatform,
        contentFormat: this.normalizeDouyinTopicContentFormat(item.contentFormat ?? item.contentType ?? item.noteType),
        presentationFormat,
        topicGoal,
        expertSkill,
        reusable,
        reuseCycle: reusable ? reuseCycle : undefined,
        topicDescription,
        selectedAt,
        source: this.normalizeDouyinTopicLibrarySource(item.source),
        sourceDate: String(item.sourceDate ?? "").trim() || undefined,
        matchedExplosiveTemplateHtmls: matchedExplosiveTemplateHtmls.length ? matchedExplosiveTemplateHtmls : undefined,
      });
    }
    return [...uniqueMap.values()];
  }

  private normalizeDouyinTopicMatchedExplosiveTemplates(raw: unknown) {
    const values = Array.isArray(raw) ? raw : (typeof raw === "string" && raw.trim() ? [raw] : []);
    return values
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  private normalizeDouyinTopicPlatform(value: unknown): DouyinTopicLibraryItem["topicPlatform"] {
    const normalized = String(value ?? "").trim();
    if (normalized === "视频号" || normalized === "小红书" || normalized === "公众号") {
      return normalized;
    }
    return "抖音";
  }

  private normalizeDouyinTopicContentFormat(value: unknown): DouyinTopicLibraryItem["contentFormat"] {
    const normalized = String(value ?? "").trim();
    if (normalized === "图文" || normalized === "长文章") {
      return normalized;
    }
    return "视频";
  }

  private normalizeDouyinTopicReusable(value: unknown) {
    if (typeof value === "boolean") {
      return value;
    }
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y" || normalized === "是";
  }

  private normalizeDouyinTopicLibrarySource(value: unknown): DouyinTopicLibraryItem["source"] {
    const normalized = String(value ?? "").trim();
    if (normalized === "GENERATED" || normalized === "OPENCLAW") {
      return normalized;
    }
    return "MANUAL";
  }

  private buildDouyinOriginalCopyCalendarOptions(calendars: XiaohongshuMarketingCalendarRecord[]): DouyinOriginalCopyCalendarOption[] {
    const uniqueMap = new Map<string, DouyinOriginalCopyCalendarOption>();
    for (const calendar of calendars) {
      for (const item of calendar.items) {
        const topicName = this.getMarketingCalendarPrimaryTopic(item);
        const optionId = item.id || this.resolveCalendarItemId(item, {
          index: 0,
          date: item.date,
          topicName,
        });
        const label = [item.date, topicName].filter(Boolean).join(" | ");
        const uniqueKey = optionId || `${item.date}|${topicName}`;
        if (!label || uniqueMap.has(uniqueKey)) {
          continue;
        }
        uniqueMap.set(uniqueKey, {
          id: optionId || uniqueKey,
          label,
          date: item.date,
          topicName,
        });
      }
    }
    return [...uniqueMap.values()].slice(0, 200);
  }

  private async getDouyinTopicLibrary(brandId: string) {
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureBrandExistsInDatabase(brandId);
      const assets = await this.prismaService.businessAsset.findMany({
        where: {
          brandId,
          category: AssetCategory.GENERATED_CONTENT,
        },
        orderBy: { updatedAt: "desc" },
      });
      return assets
        .map((item) => this.mapDouyinTopicLibraryAsset({
          id: item.id,
          brandId: item.brandId,
          category: "GENERATED_CONTENT",
          title: item.title,
          description: item.description ?? "",
          sourceName: "系统生成",
          fileUrl: item.fileUrl ?? undefined,
          metadataJson: this.asMeta(item.metadataJson),
        }))
        .find((item): item is { id: string; items: DouyinTopicLibraryItem[] } => Boolean(item));
    }

    this.ensureBrandExistsInMock(brandId);
    return database.assets
      .filter((item) => item.brandId === brandId && item.category === "GENERATED_CONTENT")
      .map((item) => this.mapDouyinTopicLibraryAsset(item))
      .find((item): item is { id: string; items: DouyinTopicLibraryItem[] } => Boolean(item));
  }

  private normalizeMarketingCalendarThemeBlock(raw: unknown, fallbackTheme = "", fallbackDescription = ""): MarketingCalendarThemeBlock {
    const item = this.asRecord(raw) || {};
    return {
      theme: String(item.theme ?? item.topicName ?? fallbackTheme ?? "").trim(),
      description: String(item.description ?? item.topicDescription ?? item.topicContent ?? fallbackDescription ?? "").trim(),
    };
  }

  private normalizeMarketingCalendarXhsBlock(raw: unknown, fallbackTopic = "", fallbackDescription = ""): MarketingCalendarXhsAccountBlock {
    const item = this.asRecord(raw) || {};
    return {
      topic: String(item.topic ?? item.topicName ?? fallbackTopic ?? "").trim(),
      description: String(item.description ?? item.topicDescription ?? item.topicContent ?? fallbackDescription ?? "").trim(),
      contentType: String(item.contentType ?? item.noteType ?? "").trim(),
      noteKeywords: this.normalizeStringArray(item.noteKeywords, [], 8),
      coverKeywords: this.normalizeStringArray(item.coverKeywords, [], 8),
      titleSuggestions: this.normalizeStringArray(item.titleSuggestions ?? item.titleDirections, [], 5),
      expectedPerformance: String(item.expectedPerformance ?? "").trim(),
    };
  }

  private normalizeMarketingCalendarDouyinBlock(raw: unknown, fallbackTopic = "", fallbackDescription = ""): MarketingCalendarDouyinAccountBlock {
    const item = this.asRecord(raw) || {};
    return {
      topic: String(item.topic ?? item.topicName ?? fallbackTopic ?? "").trim(),
      description: String(item.description ?? item.topicDescription ?? item.topicContent ?? fallbackDescription ?? "").trim(),
      contentType: String(item.contentType ?? item.noteType ?? "").trim(),
      presentationFormat: String(item.presentationFormat ?? item.coverFormat ?? "").trim(),
      copyKeywords: this.normalizeStringArray(item.copyKeywords ?? item.noteKeywords, [], 8),
      coverKeywords: this.normalizeStringArray(item.coverKeywords, [], 8),
      titleSuggestions: this.normalizeStringArray(item.titleSuggestions ?? item.titleDirections, [], 5),
      expectedPerformance: String(item.expectedPerformance ?? "").trim(),
    };
  }

  private normalizeMarketingCalendarMomentsBlock(raw: unknown, fallbackTopic = "", fallbackDescription = ""): MarketingCalendarMomentsBlock {
    const item = this.asRecord(raw) || {};
    return {
      topic: String(item.topic ?? item.topicName ?? fallbackTopic ?? "").trim(),
      description: String(item.description ?? item.topicDescription ?? item.topicContent ?? fallbackDescription ?? "").trim(),
      presentationFormat: String(item.presentationFormat ?? item.contentType ?? item.noteType ?? "").trim(),
    };
  }

  private getMarketingCalendarPrimaryTopic(item: XiaohongshuMarketingCalendarItem) {
    return (
      item.brandMarketing.theme
      || item.xiaohongshu.brandAccount.topic
      || item.douyin.brandAccount.topic
      || item.moments.topic
      || "未命名主题"
    ).trim();
  }

  private buildMarketingCalendarWorkflowSelection(item: XiaohongshuMarketingCalendarItem) {
    return {
      id: item.id,
      date: item.date,
      topicName: this.getMarketingCalendarPrimaryTopic(item),
      productName: "",
      noteType: item.xiaohongshu.brandAccount.contentType,
      targetAudience: "",
      contentGoal: item.brandMarketing.description,
      expressionFocus: item.xiaohongshu.brandAccount.description,
      topicContent: [
        item.xiaohongshu.brandAccount.topic ? `小红书品牌号：${item.xiaohongshu.brandAccount.topic}` : "",
        item.xiaohongshu.employeeAccount.topic ? `小红书员工号：${item.xiaohongshu.employeeAccount.topic}` : "",
        item.douyin.brandAccount.topic ? `抖音品牌号：${item.douyin.brandAccount.topic}` : "",
      ].filter(Boolean).join("；"),
      noteKeywords: item.xiaohongshu.brandAccount.noteKeywords,
      titleDirections: item.xiaohongshu.brandAccount.titleSuggestions,
      bodyStructure: item.xiaohongshu.brandAccount.description,
      coverFormat: "",
      coverKeywords: item.xiaohongshu.brandAccount.coverKeywords,
      imageBrief: item.xiaohongshu.brandAccount.expectedPerformance,
    };
  }

  private normalizeXiaohongshuMarketingCalendarItems(raw: unknown, startDate?: string) {
    const items = Array.isArray(raw) ? raw : [];
    const normalized = items
      .map((item) => this.asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item, index) => {
        const date = String(item.date ?? "").trim() || this.shiftDate(startDate, index);
        const fallbackTheme = String(item.topicName ?? "").trim();
        const fallbackDescription = String(item.topicContent ?? "").trim();
        const normalizedItem = {
          id: this.resolveCalendarItemId(item, {
            index,
            date,
            topicName: fallbackTheme,
          }),
          date,
          festivalOrSolarTerm: String(item.festivalOrSolarTerm ?? item.festival ?? item.solarTerm ?? "").trim() || undefined,
          brandMarketing: this.normalizeMarketingCalendarThemeBlock(item.brandMarketing, fallbackTheme, fallbackDescription),
          xiaohongshu: {
            brandAccount: this.normalizeMarketingCalendarXhsBlock(
              this.readNestedRecord(item, ["xiaohongshu", "brandAccount"]),
              fallbackTheme,
              fallbackDescription,
            ),
            employeeAccount: this.normalizeMarketingCalendarXhsBlock(
              this.readNestedRecord(item, ["xiaohongshu", "employeeAccount"]),
              fallbackTheme,
              fallbackDescription,
            ),
          },
          douyin: {
            brandAccount: this.normalizeMarketingCalendarDouyinBlock(
              this.readNestedRecord(item, ["douyin", "brandAccount"]),
              fallbackTheme,
              fallbackDescription,
            ),
            ipAccount: this.normalizeMarketingCalendarDouyinBlock(
              this.readNestedRecord(item, ["douyin", "ipAccount"]),
              fallbackTheme,
              fallbackDescription,
            ),
            employeeAccount: this.normalizeMarketingCalendarDouyinBlock(
              this.readNestedRecord(item, ["douyin", "employeeAccount"]),
              fallbackTheme,
              fallbackDescription,
            ),
          },
          moments: this.normalizeMarketingCalendarMomentsBlock(
            item.moments,
            fallbackTheme,
            fallbackDescription,
          ),
        };
        return {
          ...normalizedItem,
          ...this.buildMarketingCalendarWorkflowSelection(normalizedItem),
        };
      })
      .filter((item) => item.date && this.getMarketingCalendarPrimaryTopic(item));
    return normalized;
  }

  private resolveCalendarItemId(
    item: Record<string, unknown>,
    params: {
      index: number;
      date: string;
      topicName: string;
    },
  ) {
    const rawId = String(item.id ?? "").trim();
    if (rawId) {
      return rawId;
    }

    const seed = `${params.date}|${params.topicName}|${params.index}`;
    const digest = createHash("sha1").update(seed).digest("hex").slice(0, 12);
    return `cal_${digest}`;
  }

  private shiftDate(startDate: string | undefined, offset: number) {
    if (!startDate) {
      return "";
    }
    const current = new Date(`${startDate}T00:00:00+08:00`);
    current.setDate(current.getDate() + offset);
    return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
  }

  private loadXiaohongshuMarketingCalendarPrompt() {
    const candidates = [
      resolve(this.resolveAiWorkspaceRoot(), "提示词", "营销日历提示词.txt"),
      resolve(this.resolveOperationRoot(), "提示词", "营销日历提示词.txt"),
    ];
    for (const filePath of candidates) {
      if (existsSync(filePath)) {
        return readFileSync(filePath, "utf8").trim();
      }
    }
    return XHS_MARKETING_CALENDAR_PROMPT_FALLBACK;
  }

  private loadDouyinHotTopicCandidatesPrompt() {
    const candidates = [
      resolve(this.resolveAiWorkspaceRoot(), "提示词", "抖音板块", "热点找选题.txt"),
      resolve(this.resolveOperationRoot(), "提示词", "抖音板块", "热点找选题.txt"),
    ];
    for (const filePath of candidates) {
      if (existsSync(filePath)) {
        return readFileSync(filePath, "utf8").trim();
      }
    }
    return "你是抖音热点选题策划助手，需要基于所选日期的热点榜单和品牌背景资料，输出 3 个可执行的抖音选题。";
  }

  private loadDouyinOriginalCopyPrompt(copyType: DouyinOriginalCopyType) {
    const fileNameMap: Record<DouyinOriginalCopyType, string> = {
      VIEWPOINT: "观点型.txt",
      STORY: "讲故事.txt",
      PROCESS: "晒过程.txt",
      KNOWLEDGE: "教知识.txt",
      PLOT_SALES: "剧情带货类.txt",
      SEEDING: "种草类.txt",
      LOCAL_SALES: "同城带货类.txt",
    };
    const fileName = fileNameMap[copyType];
    const candidates = [
      resolve(this.resolveAiWorkspaceRoot(), "提示词", "抖音板块", fileName),
      resolve(this.resolveOperationRoot(), "提示词", "抖音板块", fileName),
    ];
    for (const filePath of candidates) {
      if (existsSync(filePath)) {
        return readFileSync(filePath, "utf8").trim();
      }
    }
    return DOUYIN_ORIGINAL_COPY_TYPE_CONFIG[copyType].fallbackPrompt;
  }

  private loadDouyinRemixPrompt(stage: DouyinRemixCopyPromptStage) {
    const fileNameMap: Record<DouyinRemixCopyPromptStage, string> = {
      INTRO: "拆解开头.txt",
      BODY: "拆解正文.txt",
      OUTRO: "拆解结尾.txt",
      FINAL: "二创.txt",
    };
    const fileName = fileNameMap[stage];
    const candidates = [
      resolve(this.resolveAiWorkspaceRoot(), "提示词", "抖音板块", fileName),
      resolve(this.resolveOperationRoot(), "提示词", "抖音板块", fileName),
    ];
    for (const filePath of candidates) {
      if (existsSync(filePath)) {
        return readFileSync(filePath, "utf8").trim();
      }
    }
    return DOUYIN_REMIX_COPY_PROMPT_CONFIG[stage].fallbackPrompt;
  }

  private extractJsonObject(content: string) {
    const trimmed = this.stripMarkdownCodeFence(content).trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed;
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return trimmed.slice(start, end + 1);
    }

    return trimmed;
  }

  private stripMarkdownCodeFence(content: string) {
    return content
      .trim()
      .replace(/^```(?:json|html|markdown)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  private renderMarkdownToHtml(markdown: string) {
    const lines = markdown.split(/\r?\n/);
    const html: string[] = [];
    let listMode: "ul" | "ol" | null = null;

    const closeList = () => {
      if (listMode) {
        html.push(`</${listMode}>`);
        listMode = null;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        closeList();
        continue;
      }

      const unorderedMatch = line.match(/^[-*+]\s+(.+)$/);
      if (unorderedMatch?.[1]) {
        if (listMode !== "ul") {
          closeList();
          html.push("<ul>");
          listMode = "ul";
        }
        html.push(`<li>${this.renderInlineMarkdown(unorderedMatch[1])}</li>`);
        continue;
      }

      const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
      if (orderedMatch?.[1]) {
        if (listMode !== "ol") {
          closeList();
          html.push("<ol>");
          listMode = "ol";
        }
        html.push(`<li>${this.renderInlineMarkdown(orderedMatch[1])}</li>`);
        continue;
      }

      closeList();

      if (line.startsWith("### ")) {
        html.push(`<h3>${this.renderInlineMarkdown(line.slice(4))}</h3>`);
        continue;
      }
      if (line.startsWith("## ")) {
        html.push(`<h2>${this.renderInlineMarkdown(line.slice(3))}</h2>`);
        continue;
      }
      if (line.startsWith("# ")) {
        html.push(`<h1>${this.renderInlineMarkdown(line.slice(2))}</h1>`);
        continue;
      }
      if (line.startsWith("> ")) {
        html.push(`<blockquote><p>${this.renderInlineMarkdown(line.slice(2))}</p></blockquote>`);
        continue;
      }
      if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
        html.push("<hr />");
        continue;
      }

      html.push(`<p>${this.renderInlineMarkdown(line)}</p>`);
    }

    closeList();

    return `<section class="generated-report-markdown">${html.join("")}</section>`;
  }

  private renderInlineMarkdown(content: string) {
    const escaped = this.escapeHtml(content);
    return escaped
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  private truncateText(value?: string, maxLength = 300) {
    if (!value) {
      return "";
    }
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private stripHtmlTags(value: string) {
    return value.replace(/<[^>]+>/g, " ");
  }

  private decodeHtmlEntities(value: string) {
    return value
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private asRecord(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined;
  }

  private readNestedRecord(source: unknown, path: string[]) {
    let current = this.asRecord(source);
    for (const key of path) {
      current = this.asRecord(current?.[key]);
      if (!current) {
        return undefined;
      }
    }
    return current;
  }

  private readRecordString(record: Record<string, unknown> | undefined, key: string) {
    const value = record?.[key];
    return typeof value === "string" ? value.trim() : "";
  }

  private readRecordStringArray(record: Record<string, unknown> | undefined, key: string) {
    const value = record?.[key];
    return Array.isArray(value)
      ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];
  }

  private readRecordNumber(record: Record<string, unknown> | undefined, key: string) {
    const value = record?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private mapGrowthReportAsset(asset: AssetRecord): GrowthReportRecord | undefined {
    const meta = this.asMeta(asset.metadataJson);
    if (meta.kind !== "BRAND_GROWTH_REPORT") {
      return undefined;
    }

    return {
      id: asset.id,
      title: asset.title,
      summary: this.readMetaString(meta, "summary") || asset.description,
      generatedAt: this.readMetaString(meta, "generatedAt"),
      taskId: this.readMetaString(meta, "taskId") || undefined,
      mediaId: this.readMetaString(meta, "mediaId") || undefined,
      reportMarkdown: this.readMetaString(meta, "reportMarkdown"),
      htmlContent: this.readMetaString(meta, "htmlContent"),
      diagnosis: this.readMetaStringArray(meta, "diagnosis"),
      opportunities: this.readMetaStringArray(meta, "opportunities"),
      nextActions: this.readMetaStringArray(meta, "nextActions"),
      metrics: this.readMetaMetrics(meta),
    };
  }

  private mapVisualGrowthReportAsset(asset: AssetRecord): VisualGrowthReportRecord | undefined {
    const meta = this.asMeta(asset.metadataJson);
    if (meta.kind !== "BRAND_GROWTH_VISUAL_REPORT") {
      return undefined;
    }

    return {
      id: asset.id,
      title: asset.title,
      summary: this.readMetaString(meta, "summary") || asset.description,
      generatedAt: this.readMetaString(meta, "generatedAt"),
      taskId: this.readMetaString(meta, "taskId") || undefined,
      mediaId: this.readMetaString(meta, "mediaId") || undefined,
      sourceReportId: this.readMetaString(meta, "sourceReportId") || undefined,
      sourceReportTitle: this.readMetaString(meta, "sourceReportTitle") || undefined,
      htmlBody: this.readMetaString(meta, "htmlBody"),
      htmlDocument: this.readMetaString(meta, "htmlDocument"),
    };
  }

  private mapOpportunityInsightAsset(asset: AssetRecord): OpportunityInsightReportRecord | undefined {
    const meta = this.asMeta(asset.metadataJson);
    if (meta.kind !== "OPPORTUNITY_INSIGHT_REPORT") {
      return undefined;
    }

    return {
      id: asset.id,
      title: asset.title,
      summary: this.readMetaString(meta, "summary") || asset.description,
      generatedAt: this.readMetaString(meta, "generatedAt"),
      taskId: this.readMetaString(meta, "taskId") || undefined,
      mediaId: this.readMetaString(meta, "mediaId") || undefined,
      modelName: this.readMetaString(meta, "modelName") || undefined,
      htmlBody: this.readMetaString(meta, "htmlBody"),
      htmlDocument: this.readMetaString(meta, "htmlDocument"),
      stepKey: (this.readMetaString(meta, "stepKey") || "brandAccountAnalysis") as OpportunityInsightStepKey,
    };
  }

  private mapAnnualMarketingPlanAsset(asset: AssetRecord): AnnualMarketingPlanRecord | undefined {
    const meta = this.asMeta(asset.metadataJson);
    if (!HALF_YEAR_MARKETING_PLAN_ASSET_KINDS.includes(meta.kind as (typeof HALF_YEAR_MARKETING_PLAN_ASSET_KINDS)[number])) {
      return undefined;
    }

    return {
      id: asset.id,
      title: asset.title,
      summary: this.readMetaString(meta, "summary") || asset.description,
      generatedAt: this.readMetaString(meta, "generatedAt"),
      taskId: this.readMetaString(meta, "taskId") || undefined,
      mediaId: this.readMetaString(meta, "mediaId") || undefined,
      sourceReportId: this.readMetaString(meta, "sourceReportId") || undefined,
      sourceReportTitle: this.readMetaString(meta, "sourceReportTitle") || undefined,
      planningYear: this.readMetaString(meta, "planningYear"),
      planningFocus: this.readMetaStringArray(meta, "planningFocus"),
      items: this.readMetaAnnualMarketingRows(meta),
      htmlBody: this.readMetaString(meta, "htmlBody"),
      htmlDocument: this.readMetaString(meta, "htmlDocument"),
    };
  }

  private mapXiaohongshuMarketingPlanAsset(asset: AssetRecord): XiaohongshuMarketingPlanRecord | undefined {
    const meta = this.asMeta(asset.metadataJson);
    if (meta.kind !== "XHS_MARKETING_PLAN") {
      return undefined;
    }

    return {
      id: asset.id,
      title: asset.title,
      summary: this.readMetaString(meta, "summary") || asset.description,
      generatedAt: this.readMetaString(meta, "generatedAt"),
      taskId: this.readMetaString(meta, "taskId") || undefined,
      mediaId: this.readMetaString(meta, "mediaId") || undefined,
      sourceReportId: this.readMetaString(meta, "sourceReportId") || undefined,
      sourceReportTitle: this.readMetaString(meta, "sourceReportTitle") || undefined,
      sourceAnnualPlanId: this.readMetaString(meta, "sourceAnnualPlanId") || undefined,
      sourceAnnualPlanTitle: this.readMetaString(meta, "sourceAnnualPlanTitle") || undefined,
      reportMarkdown: this.readMetaString(meta, "reportMarkdown"),
      htmlContent: this.readMetaString(meta, "htmlContent"),
      modelName: this.readMetaString(meta, "modelName") || undefined,
    };
  }

  private mapDouyinMarketingPlanAsset(asset: AssetRecord): DouyinMarketingPlanRecord | undefined {
    const meta = this.asMeta(asset.metadataJson);
    if (meta.kind !== "DOUYIN_MARKETING_PLAN") {
      return undefined;
    }

    return {
      id: asset.id,
      title: asset.title,
      summary: this.readMetaString(meta, "summary") || asset.description,
      generatedAt: this.readMetaString(meta, "generatedAt"),
      taskId: this.readMetaString(meta, "taskId") || undefined,
      mediaId: this.readMetaString(meta, "mediaId") || undefined,
      sourceReportId: this.readMetaString(meta, "sourceReportId") || undefined,
      sourceReportTitle: this.readMetaString(meta, "sourceReportTitle") || undefined,
      sourceAnnualPlanId: this.readMetaString(meta, "sourceAnnualPlanId") || undefined,
      sourceAnnualPlanTitle: this.readMetaString(meta, "sourceAnnualPlanTitle") || undefined,
      reportMarkdown: this.readMetaString(meta, "reportMarkdown"),
      htmlContent: this.readMetaString(meta, "htmlContent"),
      modelName: this.readMetaString(meta, "modelName") || undefined,
    };
  }

  private mapDouyinHotTopicCandidatesAsset(asset: AssetRecord): DouyinHotTopicCandidatesRecord | undefined {
    const meta = this.asMeta(asset.metadataJson);
    if (meta.kind !== "DOUYIN_HOT_TOPIC_CANDIDATES") {
      return undefined;
    }

    return {
      id: asset.id,
      title: asset.title,
      summary: this.readMetaString(meta, "summary") || asset.description,
      generatedAt: this.readMetaString(meta, "generatedAt"),
      taskId: this.readMetaString(meta, "taskId") || undefined,
      selectedDate: this.readMetaString(meta, "selectedDate"),
      modelName: this.readMetaString(meta, "modelName") || undefined,
      items: this.normalizeDouyinHotTopicCandidateItems(meta.items),
      reportContent: this.readMetaString(meta, "reportContent") || undefined,
    };
  }

  private mapDouyinOriginalCopyAsset(asset: AssetRecord): DouyinOriginalCopyRecord | undefined {
    const meta = this.asMeta(asset.metadataJson);
    if (meta.kind !== "DOUYIN_ORIGINAL_COPY") {
      return undefined;
    }

    return {
      id: asset.id,
      title: asset.title,
      summary: this.readMetaString(meta, "summary") || asset.description,
      generatedAt: this.readMetaString(meta, "generatedAt"),
      taskId: this.readMetaString(meta, "taskId") || undefined,
      modelName: this.readMetaString(meta, "modelName") || undefined,
      copyType: this.readMetaString(meta, "copyType") as DouyinOriginalCopyType,
      copyTypeLabel: this.readMetaString(meta, "copyTypeLabel") || "原创文案",
      content: this.readMetaString(meta, "content"),
      topicId: this.readMetaString(meta, "topicId"),
      topicTitle: this.readMetaString(meta, "topicTitle") || undefined,
      topicContent: this.readMetaString(meta, "topicContent"),
      topicDescription: this.readMetaString(meta, "topicDescription") || undefined,
      calendarItemId: this.readMetaString(meta, "calendarItemId") || undefined,
      calendarItemLabel: this.readMetaString(meta, "calendarItemLabel") || undefined,
      injectMarketingPlan: Boolean(meta.injectMarketingPlan),
      marketingPlanTitle: this.readMetaString(meta, "marketingPlanTitle") || undefined,
      userRequirement: this.readMetaString(meta, "userRequirement") || undefined,
    };
  }

  private mapDouyinRemixCopyAsset(asset: AssetRecord): DouyinRemixCopyRecord | undefined {
    const meta = this.asMeta(asset.metadataJson);
    if (meta.kind !== "DOUYIN_REMIX_COPY") {
      return undefined;
    }

    return {
      id: asset.id,
      title: asset.title,
      summary: this.readMetaString(meta, "summary") || asset.description,
      generatedAt: this.readMetaString(meta, "generatedAt"),
      taskId: this.readMetaString(meta, "taskId") || undefined,
      modelName: this.readMetaString(meta, "modelName") || undefined,
      content: this.readMetaString(meta, "content"),
      sourceMaterialId: this.readMetaString(meta, "sourceMaterialId"),
      sourceMaterialTitle: this.readMetaString(meta, "sourceMaterialTitle"),
      sourceVideoUrl: this.readMetaString(meta, "sourceVideoUrl"),
      sourceAuthorName: this.readMetaString(meta, "sourceAuthorName") || undefined,
      sourceWorkUrl: this.readMetaString(meta, "sourceWorkUrl") || undefined,
      injectBrandProfile: Boolean(meta.injectBrandProfile),
      injectMarketingPlan: Boolean(meta.injectMarketingPlan),
      marketingPlanTitle: this.readMetaString(meta, "marketingPlanTitle") || undefined,
      productId: this.readMetaString(meta, "productId") || undefined,
      productName: this.readMetaString(meta, "productName") || undefined,
      userRequirement: this.readMetaString(meta, "userRequirement") || undefined,
      extractedCopy: this.readMetaString(meta, "extractedCopy") || undefined,
      introBreakdown: this.readMetaString(meta, "introBreakdown") || undefined,
      bodyBreakdown: this.readMetaString(meta, "bodyBreakdown") || undefined,
      outroBreakdown: this.readMetaString(meta, "outroBreakdown") || undefined,
    };
  }

  private mapDouyinTopicLibraryAsset(asset: AssetRecord) {
    const meta = this.asMeta(asset.metadataJson);
    if (meta.kind !== "DOUYIN_TOPIC_LIBRARY") {
      return undefined;
    }
    return {
      id: asset.id,
      items: this.normalizeDouyinTopicLibraryItems(meta.items),
    };
  }

  private mapXiaohongshuMarketingCalendarAsset(asset: AssetRecord): XiaohongshuMarketingCalendarRecord | undefined {
    const meta = this.asMeta(asset.metadataJson);
    if (meta.kind !== "XHS_MARKETING_CALENDAR") {
      return undefined;
    }

    const executionCapabilityInventory = this.asRecord(meta.executionCapabilityInventory);
    return {
      id: asset.id,
      title: asset.title,
      summary: this.readMetaString(meta, "summary") || asset.description,
      generatedAt: this.readMetaString(meta, "generatedAt"),
      taskId: this.readMetaString(meta, "taskId") || undefined,
      sourceReportId: this.readMetaString(meta, "sourceReportId") || undefined,
      sourceReportTitle: this.readMetaString(meta, "sourceReportTitle") || undefined,
      sourceAnnualPlanId: this.readMetaString(meta, "sourceAnnualPlanId") || undefined,
      sourceAnnualPlanTitle: this.readMetaString(meta, "sourceAnnualPlanTitle") || undefined,
      sourceMarketingPlanId: this.readMetaString(meta, "sourceMarketingPlanId") || undefined,
      sourceMarketingPlanTitle: this.readMetaString(meta, "sourceMarketingPlanTitle") || undefined,
      sourceOpportunityReportId: this.readMetaString(meta, "sourceOpportunityReportId") || undefined,
      sourceOpportunityReportTitle: this.readMetaString(meta, "sourceOpportunityReportTitle") || undefined,
      modelName: this.readMetaString(meta, "modelName") || undefined,
      executionCapabilityInventory: {
        generatedAt: this.readMetaString(executionCapabilityInventory || {}, "generatedAt") || this.readMetaString(meta, "generatedAt"),
        items: Array.isArray(executionCapabilityInventory?.items)
          ? (executionCapabilityInventory.items as MarketingCalendarCapabilityItem[])
          : [],
      },
      items: this.normalizeXiaohongshuMarketingCalendarItems(meta.items),
    };
  }

  private mapVisualGrowthReportTask(task: {
    id: string;
    taskType: string;
    taskTitle?: string | null;
    taskStatus: TaskStatus | VisualGrowthReportTaskRecord["taskStatus"];
    modelName?: string | null;
    pointsCost: number;
    createdAt: Date | string;
    updatedAt: Date | string;
    startedAt?: Date | string | null;
    finishedAt?: Date | string | null;
    errorMessage?: string | null;
    inputJson?: unknown;
    outputJson?: unknown;
  }): VisualGrowthReportTaskRecord {
    const inputMeta = this.asMeta(task.inputJson);
    const outputMeta = this.asMeta(task.outputJson);
    const toIsoString = (value?: Date | string | null) => {
      if (!value) {
        return undefined;
      }
      return typeof value === "string" ? value : value.toISOString();
    };

    return {
      id: task.id,
      taskType: task.taskType,
      taskTitle: task.taskTitle || "",
      taskStatus: task.taskStatus,
      modelName: task.modelName || "",
      pointsCost: task.pointsCost,
      createdAt: toIsoString(task.createdAt) || new Date().toISOString(),
      updatedAt: toIsoString(task.updatedAt) || new Date().toISOString(),
      startedAt: toIsoString(task.startedAt),
      finishedAt: toIsoString(task.finishedAt),
      errorMessage: task.errorMessage || undefined,
      sourceReportId: this.readMetaString(inputMeta, "sourceReportId") || undefined,
      sourceReportTitle: this.readMetaString(inputMeta, "sourceReportTitle") || undefined,
      phase: this.readMetaString(outputMeta, "phase") || undefined,
      phaseText: this.readMetaString(outputMeta, "phaseText") || undefined,
      phaseIndex: this.asNumber(outputMeta.phaseIndex) || undefined,
      phaseTotal: this.asNumber(outputMeta.phaseTotal) || undefined,
    };
  }

  private mapOpportunityInsightTask(task: {
    id: string;
    taskType: string;
    taskTitle?: string | null;
    taskStatus: TaskStatus | OpportunityInsightTaskRecord["taskStatus"];
    modelName?: string | null;
    pointsCost: number;
    createdAt: Date | string;
    updatedAt: Date | string;
    startedAt?: Date | string | null;
    finishedAt?: Date | string | null;
    errorMessage?: string | null;
    inputJson?: unknown;
    outputJson?: unknown;
  }): OpportunityInsightTaskRecord {
    const inputMeta = this.asMeta(task.inputJson);
    const outputMeta = this.asMeta(task.outputJson);
    const toIsoString = (value?: Date | string | null) => {
      if (!value) {
        return undefined;
      }
      return typeof value === "string" ? value : value.toISOString();
    };

    return {
      id: task.id,
      taskType: task.taskType,
      taskTitle: task.taskTitle || "",
      taskStatus: task.taskStatus,
      modelName: task.modelName || "",
      pointsCost: task.pointsCost,
      createdAt: toIsoString(task.createdAt) || new Date().toISOString(),
      updatedAt: toIsoString(task.updatedAt) || new Date().toISOString(),
      startedAt: toIsoString(task.startedAt),
      finishedAt: toIsoString(task.finishedAt),
      errorMessage: task.errorMessage || undefined,
      phase: this.readMetaString(outputMeta, "phase") || undefined,
      phaseText: this.readMetaString(outputMeta, "phaseText") || undefined,
      phaseIndex: this.asNumber(outputMeta.phaseIndex) || undefined,
      phaseTotal: this.asNumber(outputMeta.phaseTotal) || undefined,
      stepKey: (this.readMetaString(outputMeta, "stepKey") || this.readMetaString(inputMeta, "stepKey") || undefined) as OpportunityInsightStepKey | undefined,
    };
  }

  private buildOpportunityInsightWorkspace(
    reports: OpportunityInsightReportRecord[],
    latestTask?: OpportunityInsightTaskRecord,
  ): OpportunityInsightWorkspace {
    const brandAccountAnalysis = reports.find((item) => item.stepKey === "brandAccountAnalysis");
    const competitorAccountAnalysis = reports.find((item) => item.stepKey === "competitorAccountAnalysis");
    const commentInsightAnalysis = reports.find((item) => item.stepKey === "commentInsightAnalysis");
    const finalOpportunityReport = reports.find((item) => item.stepKey === "finalOpportunityReport");
    const awaitingConfirmationStep: OpportunityInsightWorkspace["awaitingConfirmationStep"] =
      !brandAccountAnalysis || !competitorAccountAnalysis
        ? 1
        : !commentInsightAnalysis
          ? 2
          : !finalOpportunityReport
            ? 3
            : undefined;

    return {
      brandAccountAnalysis,
      competitorAccountAnalysis,
      commentInsightAnalysis,
      finalOpportunityReport,
      history: reports,
      latestTask,
      awaitingConfirmationStep,
    };
  }

  private readMetaMetrics(meta: Record<string, unknown>) {
    const metrics = meta.metrics;
    if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
      return {
        productCount: 0,
        platformAccountCount: 0,
        competitorAccountCount: 0,
        brandNoteCount: 0,
        benchmarkNoteCount: 0,
      };
    }

    const record = metrics as Record<string, unknown>;
    return {
      productCount: this.asNumber(record.productCount),
      platformAccountCount: this.asNumber(record.platformAccountCount),
      competitorAccountCount: this.asNumber(record.competitorAccountCount),
      brandNoteCount: this.asNumber(record.brandNoteCount),
      benchmarkNoteCount: this.asNumber(record.benchmarkNoteCount),
    };
  }

  private readMetaStringArray(meta: Record<string, unknown>, key: string) {
    const value = meta[key];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  }

  private readMetaString(meta: Record<string, unknown>, key: string) {
    const value = meta[key];
    return typeof value === "string" ? value : "";
  }

  private readMetaAnnualMarketingRows(meta: Record<string, unknown>) {
    return this.normalizeAnnualMarketingPlanRows(meta.items);
  }

  private asMeta(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private asNumber(value: unknown) {
    return typeof value === "number" ? value : 0;
  }

  private async ensureBrandExistsInDatabase(brandId: string) {
    const brand = await this.prismaService.brand.findUnique({ where: { id: brandId }, select: { id: true } });
    if (!brand) {
      throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
    }
  }

  private ensureBrandExistsInMock(brandId: string) {
    const brand = database.brands.find((item) => item.id === brandId);
    if (!brand) {
      throw new NotFoundException("鍝佺墝涓嶅瓨鍦");
    }
  }
}
