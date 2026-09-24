import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { OpenClawService } from "./openclaw.service";

type HeadersMap = Record<string, string | string[] | undefined>;

@Controller("openclaw/mcp")
export class OpenClawController {
  constructor(private readonly openClawService: OpenClawService) {}

  private async reportOpenClaw502DebugEvent(payload: Record<string, unknown>) {
    let debugServerUrl = "http://127.0.0.1:7777/event";
    let sessionId = "openclaw-502";
    try {
      const envContent = await readFile(join(process.cwd(), ".dbg", "openclaw-502.env"), "utf8");
      debugServerUrl = envContent.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
      sessionId = envContent.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || sessionId;
    } catch {}
    try {
      await fetch(debugServerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          runId: "pre-fix",
          ts: Date.now(),
          ...payload,
        }),
      });
    } catch {}
  }

  private isOpenClawMcpLoadDebugEnabled() {
    const normalized = String(process.env.ENABLE_OPENCLAW_MCP_LOAD_DEBUG || "").trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
      return false;
    }
    return process.env.NODE_ENV !== "production";
  }

  private getOpenClawMcpLoadDebugLogPath() {
    return join(process.cwd(), ".dbg", "trae-debug-log-openclaw-mcp-load.ndjson");
  }

  private getRunningHubWrongImageDebugLogPath() {
    return join(process.cwd(), ".dbg", "trae-debug-log-runninghub-wrong-image.ndjson");
  }

  private getRunningHubStatusStuckDebugLogPath() {
    return join(process.cwd(), ".dbg", "trae-debug-log-runninghub-status-stuck.ndjson");
  }

  private readHeaderValue(headers: HeadersMap, key: string) {
    const direct = headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()];
    if (Array.isArray(direct)) {
      return typeof direct[0] === "string" ? direct[0] : "";
    }
    return typeof direct === "string" ? direct : "";
  }

  private readToolName(payload?: Record<string, unknown>) {
    const params = payload?.params;
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      return undefined;
    }
    const name = (params as Record<string, unknown>).name;
    return typeof name === "string" && name.trim() ? name.trim() : undefined;
  }

  private async appendOpenClawMcpLoadDebugEvent(payload: Record<string, unknown>) {
    if (!this.isOpenClawMcpLoadDebugEnabled()) {
      return;
    }
    const filePath = this.getOpenClawMcpLoadDebugLogPath();
    await mkdir(join(process.cwd(), ".dbg"), { recursive: true });
    await appendFile(
      filePath,
      `${JSON.stringify({
        ...payload,
        ts: typeof payload.ts === "number" ? payload.ts : Date.now(),
      })}\n`,
      "utf8",
    );
  }

  private async appendRunningHubStatusStuckDebugEvent(payload: Record<string, unknown>) {
    const filePath = this.getRunningHubStatusStuckDebugLogPath();
    await mkdir(join(process.cwd(), ".dbg"), { recursive: true });
    await appendFile(
      filePath,
      `${JSON.stringify({
        ...(payload || {}),
        ts: typeof payload.ts === "number" ? payload.ts : Date.now(),
      })}\n`,
      "utf8",
    );
  }

  @Post()
  async handleMcpRequest(
    @Headers() headers: HeadersMap,
    @Body() payload?: Record<string, unknown>,
  ) {
    const startedAt = Date.now();
    const debugTraceId = `openclaw-502-${startedAt}-${Math.random().toString(36).slice(2, 8)}`;
    const method = typeof payload?.method === "string" ? payload.method.trim() : "";
    const toolName = this.readToolName(payload);
    const authorization = this.readHeaderValue(headers, "authorization");
    const brandId = this.readHeaderValue(headers, "x-brand-id");
    const userAgent = this.readHeaderValue(headers, "user-agent");
    const forwardedFor = this.readHeaderValue(headers, "x-forwarded-for");
    const realIp = this.readHeaderValue(headers, "x-real-ip");
    const authSource = authorization.startsWith("Bearer ocp_")
      ? "install_token"
      : authorization
        ? "bearer"
        : "session_or_anonymous";
    const tracedHeaders: HeadersMap = {
      ...headers,
      "x-openclaw-debug-trace-id": debugTraceId,
    };

    // #region debug-point A:mcp-entry
    void this.reportOpenClaw502DebugEvent({
      hypothesisId: "A",
      location: "openclaw.controller.ts:handleMcpRequest:entry",
      msg: "[DEBUG] OpenClaw MCP request entered controller",
      traceId: debugTraceId,
      data: {
        method,
        toolName,
        authSource,
        brandId,
        forwardedFor,
        realIp,
        userAgent,
      },
    });
    // #endregion

    try {
      const result = await this.openClawService.handleMcpRpcRequest(tracedHeaders, payload);
      const rpcError = Boolean(result && typeof result === "object" && !Array.isArray(result) && "error" in result);
      const toolIsError = Boolean(
        result
        && typeof result === "object"
        && !Array.isArray(result)
        && "result" in result
        && (result as { result?: { isError?: boolean } }).result?.isError,
      );
      // #region debug-point B:mcp-exit
      void this.reportOpenClaw502DebugEvent({
        hypothesisId: toolIsError || rpcError ? "B" : "A",
        location: "openclaw.controller.ts:handleMcpRequest:exit",
        msg: "[DEBUG] OpenClaw MCP request completed in controller",
        traceId: debugTraceId,
        data: {
          method,
          toolName,
          brandId,
          durationMs: Date.now() - startedAt,
          rpcError,
          toolIsError,
        },
      });
      // #endregion
      await this.appendOpenClawMcpLoadDebugEvent({
        phase: "pre-fix",
        method,
        toolName,
        authSource,
        brandId,
        forwardedFor,
        realIp,
        userAgent,
        durationMs: Date.now() - startedAt,
        isError: Boolean(result && typeof result === "object" && "error" in result),
      });
      return result;
    } catch (error) {
      // #region debug-point C:mcp-unexpected-throw
      void this.reportOpenClaw502DebugEvent({
        hypothesisId: "C",
        location: "openclaw.controller.ts:handleMcpRequest:catch",
        msg: "[DEBUG] OpenClaw MCP controller caught unexpected throw",
        traceId: debugTraceId,
        data: {
          method,
          toolName,
          brandId,
          durationMs: Date.now() - startedAt,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      // #endregion
      await this.appendOpenClawMcpLoadDebugEvent({
        phase: "pre-fix",
        method,
        toolName,
        authSource,
        brandId,
        forwardedFor,
        realIp,
        userAgent,
        durationMs: Date.now() - startedAt,
        isError: true,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  @Post("debug/runninghub-wrong-image/event")
  async collectRunningHubWrongImageDebugEvent(@Body() payload?: Record<string, unknown>) {
    const filePath = this.getRunningHubWrongImageDebugLogPath();
    await mkdir(join(process.cwd(), ".dbg"), { recursive: true });
    await appendFile(
      filePath,
      `${JSON.stringify({
        ...(payload || {}),
        ts: typeof payload?.ts === "number" ? payload.ts : Date.now(),
      })}\n`,
      "utf8",
    );
    return { success: true };
  }

  @Get("debug/runninghub-wrong-image/logs")
  async getRunningHubWrongImageDebugLogs() {
    const filePath = this.getRunningHubWrongImageDebugLogPath();
    try {
      const content = await readFile(filePath, "utf8");
      return {
        items: content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Record<string, unknown>),
      };
    } catch {
      return { items: [] as Array<Record<string, unknown>> };
    }
  }

  @Post("debug/runninghub-status-stuck/event")
  async collectRunningHubStatusStuckDebugEvent(@Body() payload?: Record<string, unknown>) {
    await this.appendRunningHubStatusStuckDebugEvent(payload || {});
    return { success: true };
  }

  @Get("debug/runninghub-status-stuck/logs")
  async getRunningHubStatusStuckDebugLogs() {
    const filePath = this.getRunningHubStatusStuckDebugLogPath();
    try {
      const content = await readFile(filePath, "utf8");
      return {
        items: content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Record<string, unknown>),
      };
    } catch {
      return { items: [] as Array<Record<string, unknown>> };
    }
  }

  @Get("website-functions")
  async getWebsiteFunctionCatalog(
    @Headers() headers: HeadersMap,
    @Query("domainKey") domainKey?: string,
    @Query("riskLevel") riskLevel?: string,
  ) {
    return this.openClawService.getWebsiteFunctionCatalog(headers, {
      domainKey,
      riskLevel,
    });
  }

  @Get("website-functions/:functionKey")
  async getWebsiteFunctionDetail(
    @Headers() headers: HeadersMap,
    @Param("functionKey") functionKey: string,
  ) {
    return this.openClawService.getWebsiteFunctionDetail(headers, { functionKey });
  }

  @Post("website-functions/route")
  async routeWebsiteFunctionByIntent(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      intent?: string;
      preferredDomain?: string;
    },
  ) {
    return this.openClawService.routeWebsiteFunctionByIntent(headers, {
      intent: payload?.intent,
      preferredDomain: payload?.preferredDomain,
    });
  }

  @Post("website-functions/:functionKey/execution-plan")
  async getWebsiteFunctionExecutionPlan(
    @Headers() headers: HeadersMap,
    @Param("functionKey") functionKey: string,
    @Body() payload?: {
      providedInputs?: Record<string, unknown>;
      confirmed?: boolean;
    },
  ) {
    return this.openClawService.getWebsiteFunctionExecutionPlan(headers, {
      functionKey,
      providedInputs: payload?.providedInputs,
      confirmed: payload?.confirmed,
    });
  }

  @Get("context/current-brand")
  async getCurrentBrandContext(@Headers() headers: HeadersMap) {
    return this.openClawService.getCurrentBrandContext(headers);
  }

  @Get("tasks/:taskId")
  async getTaskDetail(
    @Headers() headers: HeadersMap,
    @Param("taskId") taskId: string,
  ) {
    return this.openClawService.getTaskDetail(headers, { taskId });
  }

  @Get("brands/products")
  async getBrandProducts(
    @Headers() headers: HeadersMap,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getBrandProducts(headers, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("brands/platform-accounts")
  async getPlatformAccounts(
    @Headers() headers: HeadersMap,
    @Query("platform") platform?: string,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getPlatformAccounts(headers, {
      platform,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("tasks/recent-summary")
  async getRecentTasksSummary(
    @Headers() headers: HeadersMap,
    @Query("timeRange") timeRange?: string,
    @Query("taskTypes") taskTypes?: string,
  ) {
    return this.openClawService.getRecentTasksSummary(headers, {
      timeRange,
      taskTypes: this.parseCsvQuery(taskTypes),
    });
  }

  @Get("tasks/failed-summary")
  async getFailedTasksSummary(
    @Headers() headers: HeadersMap,
    @Query("timeRange") timeRange?: string,
    @Query("taskTypes") taskTypes?: string,
  ) {
    return this.openClawService.getFailedTasksSummary(headers, {
      timeRange,
      taskTypes: this.parseCsvQuery(taskTypes),
    });
  }

  @Patch("tasks/:taskId/cancel")
  async cancelTask(
    @Headers() headers: HeadersMap,
    @Param("taskId") taskId: string,
  ) {
    return this.openClawService.cancelTask(headers, { taskId });
  }

  @Patch("tasks/:taskId/retry")
  async retryTask(
    @Headers() headers: HeadersMap,
    @Param("taskId") taskId: string,
  ) {
    return this.openClawService.retryTask(headers, { taskId });
  }

  @Post("tasks/:taskId/feedback")
  async submitTaskResultFeedback(
    @Headers() headers: HeadersMap,
    @Param("taskId") taskId: string,
    @Body() payload?: {
      rating?: string;
      adopted?: boolean;
      comment?: string;
      feedbackTags?: string[];
      skillId?: string;
      promptId?: string;
      promptVersion?: string;
      workId?: string;
      editedOutput?: Record<string, unknown>;
    },
  ) {
    return this.openClawService.submitTaskResultFeedback(headers, {
      taskId,
      rating: payload?.rating,
      adopted: payload?.adopted,
      comment: payload?.comment,
      feedbackTags: payload?.feedbackTags,
      skillId: payload?.skillId,
      promptId: payload?.promptId,
      promptVersion: payload?.promptVersion,
      workId: payload?.workId,
      editedOutput: payload?.editedOutput,
    });
  }

  @Get("feedback/summary")
  async getFeedbackSummary(
    @Headers() headers: HeadersMap,
    @Query("timeRange") timeRange?: string,
    @Query("skillId") skillId?: string,
    @Query("promptId") promptId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getFeedbackSummary(headers, {
      timeRange,
      skillId,
      promptId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("feedback/analysis")
  async getFeedbackAnalysis(
    @Headers() headers: HeadersMap,
    @Query("timeRange") timeRange?: string,
    @Query("skillId") skillId?: string,
    @Query("promptId") promptId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getFeedbackAnalysis(headers, {
      timeRange,
      skillId,
      promptId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("feedback/optimization-suggestions")
  async getPromptOptimizationSuggestions(
    @Headers() headers: HeadersMap,
    @Query("timeRange") timeRange?: string,
    @Query("skillId") skillId?: string,
    @Query("promptId") promptId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getPromptOptimizationSuggestions(headers, {
      timeRange,
      skillId,
      promptId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("knowledge-bases/recent-files")
  async getRecentKnowledgeFiles(
    @Headers() headers: HeadersMap,
    @Query("timeRange") timeRange?: string,
    @Query("knowledgeBaseId") knowledgeBaseId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getRecentKnowledgeFiles(headers, {
      timeRange,
      knowledgeBaseId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("skills/config-summary")
  async getSkillConfigSummary(
    @Headers() headers: HeadersMap,
    @Query("skillKey") skillKey?: string,
  ) {
    return this.openClawService.getSkillConfigSummary(headers, { skillKey });
  }

  @Get("skills/:skillId")
  async getSkillConfigDetail(
    @Headers() headers: HeadersMap,
    @Param("skillId") skillId: string,
  ) {
    return this.openClawService.getSkillConfigDetail(headers, { skillId });
  }

  @Patch("skills/:skillId")
  async updateSkillConfig(
    @Headers() headers: HeadersMap,
    @Param("skillId") skillId: string,
    @Body() payload?: {
      displayName?: string;
      defaultModel?: string;
      description?: string;
      promptOverrides?: Array<{
        promptId: string;
        content?: string;
        modelName?: string;
        temperature?: number;
        maxTokens?: number;
      }>;
    },
  ) {
    return this.openClawService.updateSkillConfig(headers, {
      skillId,
      displayName: payload?.displayName,
      defaultModel: payload?.defaultModel,
      description: payload?.description,
      promptOverrides: payload?.promptOverrides,
    });
  }

  @Get("brand-growth/douyin-collection/workspace")
  async getDouyinCollectionWorkspace(
    @Headers() headers: HeadersMap,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getDouyinCollectionWorkspace(headers, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post("brand-growth/douyin-collection/brand-accounts/sync")
  async syncDouyinBrandAccounts(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      accountLocators?: string[];
      accountEntries?: Array<{ locator?: string; accountRole?: string }>;
    },
  ) {
    return this.openClawService.syncDouyinBrandAccounts(headers, payload);
  }

  @Post("brand-growth/douyin-collection/competitor-accounts/sync")
  async syncDouyinCompetitorAccounts(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      accountLocators?: string[];
      accountEntries?: Array<{ locator?: string; accountRole?: string }>;
    },
  ) {
    return this.openClawService.syncDouyinCompetitorAccounts(headers, payload);
  }

  @Post("brand-growth/douyin-collection/benchmark-works/sync")
  async syncDouyinBenchmarkWorks(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      benchmarkAwemeIds?: string[];
    },
  ) {
    return this.openClawService.syncDouyinBenchmarkWorks(headers, payload);
  }

  @Post("brand-growth/douyin-collection/search-works/sync")
  async syncDouyinSearchWorks(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      searchKeyword?: string;
      searchSortType?: string;
      searchPublishTime?: string;
      searchFilterDuration?: string;
      searchContentType?: string;
    },
  ) {
    return this.openClawService.syncDouyinSearchWorks(headers, payload);
  }

  @Post("brand-growth/douyin-collection/comment-data/sync")
  async syncDouyinCommentData(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      commentSourceUrls?: string[];
      commentPageRequests?: Array<{ sourceUrl?: string; cursor?: string }>;
    },
  ) {
    return this.openClawService.syncDouyinCommentData(headers, payload);
  }

  @Post("brand-growth/douyin-collection/keyword-recommendations/sync")
  async syncDouyinKeywordRecommendations(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      searchKeyword?: string;
    },
  ) {
    return this.openClawService.syncDouyinKeywordRecommendations(headers, payload);
  }

  @Post("brand-growth/douyin-collection/low-fan-explosive-works/sync")
  async syncDouyinLowFanExplosiveWorks(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      primaryTagId?: number;
      secondaryTagId?: number;
    },
  ) {
    return this.openClawService.syncDouyinLowFanExplosiveWorks(headers, payload);
  }

  @Post("brand-growth/douyin-collection/high-completion-rate-works/sync")
  async syncDouyinHighCompletionRateWorks(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      primaryTagId?: number;
      secondaryTagId?: number;
    },
  ) {
    return this.openClawService.syncDouyinHighCompletionRateWorks(headers, payload);
  }

  @Post("brand-growth/douyin-collection/high-like-rate-works/sync")
  async syncDouyinHighLikeRateWorks(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      primaryTagId?: number;
      secondaryTagId?: number;
    },
  ) {
    return this.openClawService.syncDouyinHighLikeRateWorks(headers, payload);
  }

  @Post("brand-growth/douyin-collection/city-hotspots/sync")
  async syncDouyinCityHotspots(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      cityCode?: number;
    },
  ) {
    return this.openClawService.syncDouyinCityHotspots(headers, payload);
  }

  @Post("brand-growth/douyin-collection/transcripts/extract")
  async extractDouyinWorkTranscript(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      assetId?: string;
    },
  ) {
    return this.openClawService.extractDouyinWorkTranscript(headers, payload);
  }

  @Post("skills/:skillId/reset")
  async resetSkillToPlatformBaseline(
    @Headers() headers: HeadersMap,
    @Param("skillId") skillId: string,
  ) {
    return this.openClawService.resetSkillToPlatformBaseline(headers, { skillId });
  }

  @Get("wechat/drafts")
  async getWechatArticleDrafts(
    @Headers() headers: HeadersMap,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getWechatArticleDrafts(headers, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("wechat/accounts")
  async getWechatOfficialAccounts(@Headers() headers: HeadersMap) {
    return this.openClawService.getWechatOfficialAccounts(headers);
  }

  @Get("wechat/workflows")
  async getWechatWorkflowSessions(
    @Headers() headers: HeadersMap,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getWechatWorkflowSessions(headers, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("wechat/publish-history")
  async getWechatPublishHistory(
    @Headers() headers: HeadersMap,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getWechatPublishHistory(headers, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("wechat/preferences")
  async getWechatWorkflowPreferences(@Headers() headers: HeadersMap) {
    return this.openClawService.getWechatWorkflowPreferences(headers);
  }

  @Get("wechat/workflows/:workflowId")
  async getWechatWorkflowSessionDetail(
    @Headers() headers: HeadersMap,
    @Param("workflowId") workflowId: string,
  ) {
    return this.openClawService.getWechatWorkflowSessionDetail(headers, { workflowId });
  }

  @Post("wechat/workflows/:workflowId/check-publish")
  async checkWechatWorkflowPublishReadiness(
    @Headers() headers: HeadersMap,
    @Param("workflowId") workflowId: string,
  ) {
    return this.openClawService.checkWechatWorkflowPublishReadiness(headers, { workflowId });
  }

  @Get("wechat/publish-history/:historyId")
  async getWechatPublishHistoryDetail(
    @Headers() headers: HeadersMap,
    @Param("historyId") historyId: string,
  ) {
    return this.openClawService.getWechatPublishHistoryDetail(headers, { historyId });
  }

  @Post("wechat/articles/:draftId/publish")
  async publishWechatArticle(
    @Headers() headers: HeadersMap,
    @Param("draftId") draftId: string,
  ) {
    return this.openClawService.publishWechatArticle(headers, { draftId });
  }

  @Post("works/xiaohongshu/mobile-draft-session")
  async createXiaohongshuMobileDraftSession(
    @Headers() headers: HeadersMap,
    @Body() payload?: { workId?: string; accountId?: string },
  ) {
    return this.openClawService.createXiaohongshuMobileDraftSession(headers, payload);
  }

  @Get("works/xiaohongshu/mobile-draft-session/:token")
  async getXiaohongshuMobileDraftSession(
    @Headers() headers: HeadersMap,
    @Param("token") token: string,
  ) {
    return this.openClawService.getXiaohongshuMobileDraftSession(headers, { token });
  }

  @Post("works/xiaohongshu/desktop-draft-session")
  async createXiaohongshuDesktopDraftSession(
    @Headers() headers: HeadersMap,
    @Body() payload?: { workId?: string; accountId?: string },
  ) {
    return this.openClawService.createXiaohongshuDesktopDraftSession(headers, payload);
  }

  @Get("works/xiaohongshu/desktop-draft-session/:token")
  async getXiaohongshuDesktopDraftSession(
    @Headers() headers: HeadersMap,
    @Param("token") token: string,
  ) {
    return this.openClawService.getXiaohongshuDesktopDraftSession(headers, { token });
  }

  @Post("works/douyin/mobile-publish-session")
  async createDouyinMobilePublishSession(
    @Headers() headers: HeadersMap,
    @Body() payload?: { workId?: string; accountId?: string },
  ) {
    return this.openClawService.createDouyinMobilePublishSession(headers, payload);
  }

  @Get("works/douyin/mobile-publish-session/:token")
  async getDouyinMobilePublishSession(
    @Headers() headers: HeadersMap,
    @Param("token") token: string,
  ) {
    return this.openClawService.getDouyinMobilePublishSession(headers, { token });
  }

  @Post("works/douyin/desktop-publish-session")
  async createDouyinDesktopPublishSession(
    @Headers() headers: HeadersMap,
    @Body() payload?: { workId?: string; accountId?: string },
  ) {
    return this.openClawService.createDouyinDesktopPublishSession(headers, payload);
  }

  @Get("works/douyin/desktop-publish-session/:token")
  async getDouyinDesktopPublishSession(
    @Headers() headers: HeadersMap,
    @Param("token") token: string,
  ) {
    return this.openClawService.getDouyinDesktopPublishSession(headers, { token });
  }

  @Post("wechat/workflows/:workflowId/publish")
  async publishWechatWorkflow(
    @Headers() headers: HeadersMap,
    @Param("workflowId") workflowId: string,
  ) {
    return this.openClawService.publishWechatWorkflow(headers, { workflowId });
  }

  @Post("wechat/publish-history/:historyId/retry")
  async retryWechatPublishHistory(
    @Headers() headers: HeadersMap,
    @Param("historyId") historyId: string,
  ) {
    return this.openClawService.retryWechatPublishHistory(headers, { historyId });
  }

  @Get("works/design/options")
  async getDesignWorkspaceOptions(@Headers() headers: HeadersMap) {
    return this.openClawService.getDesignWorkspaceOptions(headers);
  }

  @Get("works/design/recent")
  async getRecentDesignWorks(
    @Headers() headers: HeadersMap,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getRecentDesignWorks(headers, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post("works/design/generate")
  async createDesignWork(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      module?: string;
      designType?: string;
      title?: string;
      calendarItemId?: string;
      productId?: string;
      injectBrandProfile?: boolean;
      referenceImageMode?: "prompt_only" | "edit_reference";
      referenceImage?: {
        fileName?: string;
        contentType?: string;
        dataBase64?: string;
      };
      referenceImageUrl?: string;
      referenceMaterialId?: string;
      modelSelection?: string;
      imageSize?: string;
      spec?: string;
      additionalInstruction?: string;
      styleHint?: string;
    },
  ) {
    return this.openClawService.createDesignWork(headers, payload);
  }

  @Get("reports/douyin-original/options")
  async getDouyinOriginalCopyOptions(@Headers() headers: HeadersMap) {
    return this.openClawService.getDouyinOriginalCopyOptions(headers);
  }

  @Get("reports/douyin-original/recent")
  async getRecentDouyinOriginalCopies(
    @Headers() headers: HeadersMap,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getRecentDouyinOriginalCopies(headers, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post("reports/douyin-original/generate")
  async createDouyinOriginalCopy(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      copyType?: string;
      topicId?: string;
      calendarItemId?: string;
      injectMarketingPlan?: boolean;
      userRequirement?: string;
    },
  ) {
    return this.openClawService.createDouyinOriginalCopy(headers, payload);
  }

  @Get("reports/douyin-remix/options")
  async getDouyinRemixCopyOptions(@Headers() headers: HeadersMap) {
    return this.openClawService.getDouyinRemixCopyOptions(headers);
  }

  @Get("reports/douyin-remix/recent")
  async getRecentDouyinRemixCopies(
    @Headers() headers: HeadersMap,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getRecentDouyinRemixCopies(headers, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post("reports/douyin-remix/generate")
  async createDouyinRemixCopy(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      materialId?: string;
      injectBrandProfile?: boolean;
      productId?: string;
      injectMarketingPlan?: boolean;
      userRequirement?: string;
    },
  ) {
    return this.openClawService.createDouyinRemixCopy(headers, payload);
  }

  @Get("works/xiaohongshu/calendar-options")
  async getXiaohongshuMarketingCalendarOptions(
    @Headers() headers: HeadersMap,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getXiaohongshuMarketingCalendarOptions(headers, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("works/xiaohongshu/material-library")
  async getXiaohongshuMaterialLibraryItems(
    @Headers() headers: HeadersMap,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getXiaohongshuMaterialLibraryItems(headers, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("works/xiaohongshu/reference-templates")
  async getXiaohongshuOriginalReferenceTemplates(
    @Headers() headers: HeadersMap,
    @Query("categoryId") categoryId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getXiaohongshuOriginalReferenceTemplates(headers, {
      categoryId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("works/xiaohongshu/original/recent")
  async getRecentXiaohongshuOriginalWorks(
    @Headers() headers: HeadersMap,
    @Query("limit") limit?: string,
  ) {
    return this.openClawService.getRecentXiaohongshuOriginalWorks(headers, {
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post("reports/brand-growth/generate")
  async createBrandGrowthReport(
    @Headers() headers: HeadersMap,
    @Body() payload?: { goal?: string; timeRange?: string },
  ) {
    return this.openClawService.createBrandGrowthReport(headers, payload);
  }

  @Get("reports/brand-growth/latest-summary")
  async getLatestBrandGrowthReportSummary(@Headers() headers: HeadersMap) {
    return this.openClawService.getLatestBrandGrowthReportSummary(headers);
  }

  @Post("reports/half-year-marketing-plan/generate")
  async createHalfYearMarketingPlan(
    @Headers() headers: HeadersMap,
    @Body() payload?: { planningYear?: string; focus?: string },
  ) {
    return this.openClawService.createHalfYearMarketingPlan(headers, payload);
  }

  @Post("knowledge-bases/create")
  async createKnowledgeBase(
    @Headers() headers: HeadersMap,
    @Body() payload?: { name?: string; description?: string },
  ) {
    return this.openClawService.createKnowledgeBase(headers, payload);
  }

  @Post("knowledge-bases/upload-files")
  async uploadKnowledgeBaseFiles(
    @Headers() headers: HeadersMap,
    @Body()
    payload?: {
      knowledgeBaseId?: string;
      knowledgeBaseName?: string;
      items?: Array<{
        title?: string;
        description?: string;
        sourceName?: string;
        fileUrl?: string;
        priority?: number;
      }>;
    },
  ) {
    return this.openClawService.uploadKnowledgeBaseFiles(headers, payload);
  }

  @Post("works/xiaohongshu/original/generate")
  async createXiaohongshuOriginalNote(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      calendarItemId?: string;
      customTopicName?: string;
      topic?: string;
      productId?: string;
      accountRole?: string;
      imageCount?: number;
      includeMarketingPlan?: boolean;
      additionalInstruction?: string;
      noteTitle?: string;
      noteContent?: string;
      styleHint?: string;
    },
  ) {
    return this.openClawService.createXiaohongshuOriginalNote(headers, payload);
  }

  @Post("works/xiaohongshu/rewrite/generate")
  async createXiaohongshuRewriteNote(
    @Headers() headers: HeadersMap,
    @Body() payload?: {
      sourceMaterialId?: string;
      productId?: string;
      accountRole?: string;
      includeMarketingPlan?: boolean;
      additionalInstruction?: string;
    },
  ) {
    return this.openClawService.createXiaohongshuRewriteNote(headers, payload);
  }

  @Post("works/wechat/articles/generate")
  async createWechatArticle(
    @Headers() headers: HeadersMap,
    @Body() payload?: { title?: string; summary?: string; content?: string; author?: string; styleHint?: string },
  ) {
    return this.openClawService.createWechatArticle(headers, payload);
  }

  private parseCsvQuery(value?: string) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
