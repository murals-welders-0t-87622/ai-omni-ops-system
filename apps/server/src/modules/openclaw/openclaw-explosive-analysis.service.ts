import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  DEFAULT_OPENCLAW_WORKSPACE_SCOPE,
  type OpenClawWorkspaceScope,
  normalizeOpenClawWorkspaceScope,
} from "./openclaw-workspace-scope";

type OpenClawExplosiveAnalysisRow = {
  id: string;
  brandId: string;
  workspaceScope: string;
  createdByUserId: string;
  title: string;
  tagsText: string;
  htmlContent: string;
  authorName: string;
  workUrl: string;
  videoCopy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type OpenClawExplosiveAnalysisStoredRecord = {
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

export type OpenClawExplosiveAnalysisRecord = OpenClawExplosiveAnalysisStoredRecord;

export type OpenClawExplosiveAnalysisWorkspace = {
  items: OpenClawExplosiveAnalysisRecord[];
  total: number;
};

@Injectable()
export class OpenClawExplosiveAnalysisService {
  private bootstrapPromise: Promise<void> | null = null;

  private readonly fallbackItems: OpenClawExplosiveAnalysisStoredRecord[] = [];

  constructor(private readonly prismaService: PrismaService) {}

  async listWorkspace(brandId: string, workspaceScope?: string, limit?: number): Promise<OpenClawExplosiveAnalysisWorkspace> {
    const items = await this.listRecords(brandId, workspaceScope, limit);
    return {
      items,
      total: items.length,
    };
  }

  async createRecord(payload: {
    brandId: string;
    workspaceScope?: string;
    createdByUserId: string;
    title?: string;
    tags?: unknown;
    htmlContent?: string;
    authorName?: string;
    workUrl?: string;
    videoCopy?: string;
  }): Promise<OpenClawExplosiveAnalysisRecord> {
    const brandId = this.requireText(payload.brandId, "缺少品牌 ID");
    const workspaceScope = normalizeOpenClawWorkspaceScope(payload.workspaceScope);
    const createdByUserId = this.requireText(payload.createdByUserId, "缺少创建人 ID");
    const title = this.requireText(payload.title, "请填写标题", 200);
    const tags = this.normalizeTags(payload.tags);
    const tagsText = this.serializeTags(tags);
    const htmlContent = this.requireHtmlContent(payload.htmlContent);
    const authorName = this.normalizeOptionalText(payload.authorName, 120);
    const workUrl = this.normalizeOptionalText(payload.workUrl, 1000);
    const videoCopy = this.normalizeOptionalText(payload.videoCopy, 20000);
    const id = `openclaw_explosive_analysis_${randomUUID()}`;

    if (await this.prismaService.canUseDatabase()) {
      await this.ensureTableReady();
      await this.prismaService.$executeRaw`
        INSERT INTO "OpenClawExplosiveAnalysis" (
          "id",
          "brandId",
          "workspaceScope",
          "createdByUserId",
          "title",
          "tagsText",
          "htmlContent",
          "authorName",
          "workUrl",
          "videoCopy",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${id},
          ${brandId},
          ${workspaceScope},
          ${createdByUserId},
          ${title},
          ${tagsText},
          ${htmlContent},
          ${authorName},
          ${workUrl},
          ${videoCopy},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
      const stored = await this.findRecordById(brandId, workspaceScope, id);
      if (!stored) {
        throw new NotFoundException("爆款拆解创建后未找到记录");
      }
      return stored;
    }

    const now = new Date().toISOString();
    const stored: OpenClawExplosiveAnalysisStoredRecord = {
      id,
      brandId,
      workspaceScope,
      createdByUserId,
      title,
      tags,
      htmlContent,
      authorName,
      workUrl,
      videoCopy,
      createdAt: now,
      updatedAt: now,
    };
    this.fallbackItems.unshift(stored);
    return stored;
  }

  async deleteRecord(brandId: string, workspaceScope: string | undefined, recordId: string): Promise<OpenClawExplosiveAnalysisRecord> {
    const normalizedBrandId = this.requireText(brandId, "缺少品牌 ID");
    const normalizedWorkspaceScope = normalizeOpenClawWorkspaceScope(workspaceScope);
    const normalizedRecordId = this.requireText(recordId, "缺少爆款拆解 ID");
    const existing = await this.findRecordById(normalizedBrandId, normalizedWorkspaceScope, normalizedRecordId);
    if (!existing) {
      throw new NotFoundException("爆款拆解不存在或已删除");
    }

    if (await this.prismaService.canUseDatabase()) {
      await this.ensureTableReady();
      await this.prismaService.$executeRaw`
        DELETE FROM "OpenClawExplosiveAnalysis"
        WHERE "brandId" = ${normalizedBrandId}
          AND "workspaceScope" = ${normalizedWorkspaceScope}
          AND "id" = ${normalizedRecordId}
      `;
      return existing;
    }

    const nextItems = this.fallbackItems.filter(
      (item) => !(item.brandId === normalizedBrandId && item.workspaceScope === normalizedWorkspaceScope && item.id === normalizedRecordId),
    );
    this.fallbackItems.length = 0;
    this.fallbackItems.push(...nextItems);
    return existing;
  }

  private async listRecords(
    brandId: string,
    workspaceScope: string | undefined,
    limit?: number,
  ): Promise<OpenClawExplosiveAnalysisRecord[]> {
    const normalizedBrandId = this.requireText(brandId, "缺少品牌 ID");
    const normalizedWorkspaceScope = normalizeOpenClawWorkspaceScope(workspaceScope);
    const resolvedLimit = this.normalizeLimit(limit);

    if (await this.prismaService.canUseDatabase()) {
      await this.ensureTableReady();
      const rows = await this.prismaService.$queryRaw<OpenClawExplosiveAnalysisRow[]>`
        SELECT
          "id",
          "brandId",
          "workspaceScope",
          "createdByUserId",
          "title",
          "tagsText",
          "htmlContent",
          "authorName",
          "workUrl",
          "videoCopy",
          "createdAt",
          "updatedAt"
        FROM "OpenClawExplosiveAnalysis"
        WHERE "brandId" = ${normalizedBrandId}
          AND "workspaceScope" = ${normalizedWorkspaceScope}
        ORDER BY "createdAt" DESC, "updatedAt" DESC
        LIMIT ${resolvedLimit}
      `;
      return rows.map((item) => this.normalizeRow(item));
    }

    return this.fallbackItems
      .filter((item) => item.brandId === normalizedBrandId && item.workspaceScope === normalizedWorkspaceScope)
      .sort((left, right) => `${right.createdAt}${right.updatedAt}`.localeCompare(`${left.createdAt}${left.updatedAt}`))
      .slice(0, resolvedLimit);
  }

  private async findRecordById(
    brandId: string,
    workspaceScope: string | undefined,
    recordId: string,
  ): Promise<OpenClawExplosiveAnalysisRecord | undefined> {
    const normalizedWorkspaceScope = normalizeOpenClawWorkspaceScope(workspaceScope);
    if (await this.prismaService.canUseDatabase()) {
      await this.ensureTableReady();
      const rows = await this.prismaService.$queryRaw<OpenClawExplosiveAnalysisRow[]>`
        SELECT
          "id",
          "brandId",
          "workspaceScope",
          "createdByUserId",
          "title",
          "tagsText",
          "htmlContent",
          "authorName",
          "workUrl",
          "videoCopy",
          "createdAt",
          "updatedAt"
        FROM "OpenClawExplosiveAnalysis"
        WHERE "brandId" = ${brandId}
          AND "workspaceScope" = ${normalizedWorkspaceScope}
          AND "id" = ${recordId}
        LIMIT 1
      `;
      const matched = rows[0];
      return matched ? this.normalizeRow(matched) : undefined;
    }

    return this.fallbackItems.find(
      (item) => item.brandId === brandId && item.workspaceScope === normalizedWorkspaceScope && item.id === recordId,
    );
  }

  private normalizeRow(row: OpenClawExplosiveAnalysisRow): OpenClawExplosiveAnalysisStoredRecord {
    return {
      id: row.id,
      brandId: row.brandId,
      workspaceScope: normalizeOpenClawWorkspaceScope(row.workspaceScope),
      createdByUserId: row.createdByUserId,
      title: String(row.title || "").trim(),
      tags: this.parseTags(row.tagsText),
      htmlContent: String(row.htmlContent || "").trim(),
      authorName: String(row.authorName || "").trim(),
      workUrl: String(row.workUrl || "").trim(),
      videoCopy: String(row.videoCopy || "").trim(),
      createdAt: this.normalizeDate(row.createdAt),
      updatedAt: this.normalizeDate(row.updatedAt),
    };
  }

  private normalizeTags(raw: unknown) {
    if (Array.isArray(raw)) {
      return raw
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 20);
    }
    const normalized = String(raw || "").trim();
    if (!normalized) {
      return [];
    }
    return normalized
      .split(/[\r\n,，、|]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  private parseTags(value: unknown) {
    return this.normalizeTags(value);
  }

  private serializeTags(tags: string[]) {
    return tags.join(", ");
  }

  private normalizeDate(value: Date | string) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value || new Date().toISOString());
  }

  private requireText(value: string | undefined, message: string, maxLength = 200) {
    const normalized = String(value || "").trim();
    if (!normalized) {
      throw new BadRequestException(message);
    }
    return normalized.slice(0, maxLength);
  }

  private normalizeOptionalText(value: string | undefined, maxLength = 5000) {
    return String(value || "").trim().slice(0, maxLength);
  }

  private requireHtmlContent(value?: string) {
    const normalized = String(value || "").trim();
    if (!normalized) {
      throw new BadRequestException("请填写 HTML 内容");
    }
    return normalized.slice(0, 2_000_000);
  }

  private normalizeLimit(limit?: number) {
    if (!Number.isFinite(limit) || Number(limit) <= 0) {
      return 100;
    }
    return Math.min(200, Math.floor(Number(limit)));
  }

  private async ensureTableReady() {
    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.bootstrapTable();
    }
    await this.bootstrapPromise;
  }

  private async bootstrapTable() {
    if (!(await this.prismaService.canUseDatabase())) {
      return;
    }
    if (this.prismaService.isLocalSqliteMode()) {
      await this.prismaService.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "OpenClawExplosiveAnalysis" (
          "id" TEXT PRIMARY KEY,
          "brandId" TEXT NOT NULL,
          "workspaceScope" TEXT NOT NULL DEFAULT '${DEFAULT_OPENCLAW_WORKSPACE_SCOPE}',
          "createdByUserId" TEXT NOT NULL,
          "title" TEXT NOT NULL DEFAULT '',
          "tagsText" TEXT NOT NULL DEFAULT '',
          "htmlContent" TEXT NOT NULL DEFAULT '',
          "authorName" TEXT NOT NULL DEFAULT '',
          "workUrl" TEXT NOT NULL DEFAULT '',
          "videoCopy" TEXT NOT NULL DEFAULT '',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.prismaService.ensureTableColumns("OpenClawExplosiveAnalysis", [
        { name: "workspaceScope", definition: `TEXT NOT NULL DEFAULT '${DEFAULT_OPENCLAW_WORKSPACE_SCOPE}'` },
        { name: "title", definition: "TEXT NOT NULL DEFAULT ''" },
        { name: "tagsText", definition: "TEXT NOT NULL DEFAULT ''" },
        { name: "htmlContent", definition: "TEXT NOT NULL DEFAULT ''" },
        { name: "authorName", definition: "TEXT NOT NULL DEFAULT ''" },
        { name: "workUrl", definition: "TEXT NOT NULL DEFAULT ''" },
        { name: "videoCopy", definition: "TEXT NOT NULL DEFAULT ''" },
      ]);
    } else {
      await this.prismaService.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "OpenClawExplosiveAnalysis" (
          "id" TEXT PRIMARY KEY,
          "brandId" TEXT NOT NULL,
          "workspaceScope" TEXT NOT NULL DEFAULT '${DEFAULT_OPENCLAW_WORKSPACE_SCOPE}',
          "createdByUserId" TEXT NOT NULL,
          "title" TEXT NOT NULL DEFAULT '',
          "tagsText" TEXT NOT NULL DEFAULT '',
          "htmlContent" TEXT NOT NULL DEFAULT '',
          "authorName" TEXT NOT NULL DEFAULT '',
          "workUrl" TEXT NOT NULL DEFAULT '',
          "videoCopy" TEXT NOT NULL DEFAULT '',
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.prismaService.$executeRawUnsafe(`
        ALTER TABLE "OpenClawExplosiveAnalysis"
        ADD COLUMN IF NOT EXISTS "workspaceScope" TEXT NOT NULL DEFAULT '${DEFAULT_OPENCLAW_WORKSPACE_SCOPE}'
      `);
      await this.prismaService.$executeRawUnsafe(`
        ALTER TABLE "OpenClawExplosiveAnalysis"
        ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT ''
      `);
      await this.prismaService.$executeRawUnsafe(`
        ALTER TABLE "OpenClawExplosiveAnalysis"
        ADD COLUMN IF NOT EXISTS "tagsText" TEXT NOT NULL DEFAULT ''
      `);
      await this.prismaService.$executeRawUnsafe(`
        ALTER TABLE "OpenClawExplosiveAnalysis"
        ADD COLUMN IF NOT EXISTS "htmlContent" TEXT NOT NULL DEFAULT ''
      `);
      await this.prismaService.$executeRawUnsafe(`
        ALTER TABLE "OpenClawExplosiveAnalysis"
        ADD COLUMN IF NOT EXISTS "authorName" TEXT NOT NULL DEFAULT ''
      `);
      await this.prismaService.$executeRawUnsafe(`
        ALTER TABLE "OpenClawExplosiveAnalysis"
        ADD COLUMN IF NOT EXISTS "workUrl" TEXT NOT NULL DEFAULT ''
      `);
      await this.prismaService.$executeRawUnsafe(`
        ALTER TABLE "OpenClawExplosiveAnalysis"
        ADD COLUMN IF NOT EXISTS "videoCopy" TEXT NOT NULL DEFAULT ''
      `);
    }
    await this.prismaService.$executeRawUnsafe(`
      UPDATE "OpenClawExplosiveAnalysis"
      SET "workspaceScope" = '${DEFAULT_OPENCLAW_WORKSPACE_SCOPE}'
      WHERE "workspaceScope" IS NULL
         OR TRIM("workspaceScope") = ''
    `);
    await this.prismaService.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "OpenClawExplosiveAnalysis_brand_created_idx"
      ON "OpenClawExplosiveAnalysis" ("brandId", "createdAt" DESC, "updatedAt" DESC)
    `);
    await this.prismaService.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "OpenClawExplosiveAnalysis_brand_scope_created_idx"
      ON "OpenClawExplosiveAnalysis" ("brandId", "workspaceScope", "createdAt" DESC, "updatedAt" DESC)
    `);
  }
}
