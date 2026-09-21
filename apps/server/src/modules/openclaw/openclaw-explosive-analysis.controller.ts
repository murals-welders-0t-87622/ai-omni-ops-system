import { Body, Controller, Delete, Get, Headers, Param, Post, Query, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { OpenClawExplosiveAnalysisService } from "./openclaw-explosive-analysis.service";

type HeadersMap = Record<string, string | string[] | undefined>;

@Controller("openclaw/brands/:brandId/explosive-analyses")
export class OpenClawExplosiveAnalysisController {
  constructor(
    private readonly authService: AuthService,
    private readonly openClawExplosiveAnalysisService: OpenClawExplosiveAnalysisService,
  ) {}

  @Get()
  async listRecords(
    @Headers() headers: HeadersMap,
    @Param("brandId") brandId: string,
    @Query("workspaceScope") workspaceScope?: string,
    @Query("limit") limit?: string,
  ) {
    const auth = await this.authService.resolveRequestAuthContext(headers);
    if (!auth) {
      throw new UnauthorizedException("登录态已失效");
    }
    await this.authService.assertBrandPermission(brandId, "brandGrowth.report.topicLibrary", "view", auth);
    return this.openClawExplosiveAnalysisService.listWorkspace(brandId, workspaceScope, limit ? Number(limit) : undefined);
  }

  @Post()
  async createRecord(
    @Headers() headers: HeadersMap,
    @Param("brandId") brandId: string,
    @Body() payload?: {
      workspaceScope?: string;
      title?: string;
      tags?: string[] | string;
      htmlContent?: string;
      authorName?: string;
      workUrl?: string;
      videoCopy?: string;
    },
  ) {
    const auth = await this.authService.resolveRequestAuthContext(headers);
    if (!auth) {
      throw new UnauthorizedException("登录态已失效");
    }
    await this.authService.assertBrandPermission(brandId, "brandGrowth.report.topicLibrary", "edit", auth);
    const item = await this.openClawExplosiveAnalysisService.createRecord({
      brandId,
      workspaceScope: payload?.workspaceScope,
      createdByUserId: auth.userId,
      title: payload?.title,
      tags: payload?.tags,
      htmlContent: payload?.htmlContent,
      authorName: payload?.authorName,
      workUrl: payload?.workUrl,
      videoCopy: payload?.videoCopy,
    });
    const workspace = await this.openClawExplosiveAnalysisService.listWorkspace(brandId, payload?.workspaceScope);
    return {
      item,
      workspace,
    };
  }

  @Delete(":recordId")
  async deleteRecord(
    @Headers() headers: HeadersMap,
    @Param("brandId") brandId: string,
    @Param("recordId") recordId: string,
    @Query("workspaceScope") workspaceScope?: string,
  ) {
    const auth = await this.authService.resolveRequestAuthContext(headers);
    if (!auth) {
      throw new UnauthorizedException("登录态已失效");
    }
    await this.authService.assertBrandPermission(brandId, "brandGrowth.report.topicLibrary", "edit", auth);
    const item = await this.openClawExplosiveAnalysisService.deleteRecord(brandId, workspaceScope, recordId);
    const workspace = await this.openClawExplosiveAnalysisService.listWorkspace(brandId, workspaceScope);
    return {
      item,
      workspace,
    };
  }
}
