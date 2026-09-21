# 2026-09-21 爆款拆解板块与选题库模板匹配字段

## 背景

- 品牌增长报告需要在 `营销日历` 与 `选题库` 之间新增独立 `爆款拆解` 板块。
- 选题库单条记录需要新增 `匹配爆款模板` 字段，用于沉淀多个爆款拆解 HTML 模板。
- OpenClaw 需要可直接通过 MCP 查看、创建、删除爆款拆解记录，并与网页端详情留言协作打通。

## 本次变更

### 1. 品牌增长报告新增 `爆款拆解` 板块

- 新增后端真源：
  - `OpenClawExplosiveAnalysis`（Prisma 模型 + OpenClaw service/controller）
- 新增前端工作区：
  - 列表页每页 20 条
  - 字段包含：标题、标签、HTML 内容、作者、作品链接、视频文案
  - 支持 `查看`（HTML 预览）与 `删除`
  - 详情页下方复用 `OpenClawCommentThread` 留言

### 2. 选题库新增 `匹配爆款模板` 字段

- `DouyinTopicLibraryItem` 新增：
  - `matchedExplosiveTemplateHtmls?: string[]`
- 选题库编辑器新增：
  - `匹配爆款模板（支持多个 HTML）` 文本域
  - 以空行分隔多个 HTML 片段
- 后端标准化：
  - 自动清洗空字符串
  - 最多保留 20 条模板

### 3. OpenClaw MCP 新增爆款拆解工具

- `get_openclaw_explosive_analyses`
- `create_openclaw_explosive_analysis`
- `delete_openclaw_explosive_analysis`

并完成：

- 网站功能域目录登记
- MCP 工具矩阵定义
- `executeToolCall` 分发接线

## 影响面与兼容性

- 选题库仍沿用 `DOUYIN_TOPIC_LIBRARY` 资产真源；本次仅做字段扩展，不改既有结构化字段语义。
- 爆款拆解使用 OpenClaw 独立真源，不影响既有营销策划方案、每日计划、每周复盘、策略优化记录链路。
- 留言复用既有 `OpenClawComment` 体系，仅新增资源类型 `explosive_analysis`。

## 参考文件

- `apps/server/src/modules/openclaw/openclaw-explosive-analysis.service.ts`
- `apps/server/src/modules/openclaw/openclaw-explosive-analysis.controller.ts`
- `apps/server/src/modules/openclaw/openclaw.service.ts`
- `apps/server/src/modules/reports/reports.service.ts`
- `apps/web/src/app/(dashboard)/brand-growth/openclaw-explosive-analysis-workspace.tsx`
- `apps/web/src/app/(dashboard)/brand-growth/workspace.tsx`
- `apps/web/src/app/(dashboard)/douyin/topic-library-workspace.tsx`
- `apps/web/src/services/openclaw.ts`
- `apps/web/src/services/reports.ts`
- `prisma/schema.prisma`
