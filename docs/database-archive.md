# AI全域运营系统数据库存档

## 1. 文档目的

- 记录当前项目数据库的真实构建方式、表结构分层和业务映射
- 说明哪些数据已经正式落 PostgreSQL，哪些仍处于 `mock-data` / 本地文件过渡态
- 作为后续更新 `schema`、迁移、后台技能中心和业务模块时的数据库基线

## 2. 当前数据库构建方式

### 2.1 技术栈

- ORM：`Prisma`
- 主库：`PostgreSQL`
- 连接入口：`prisma/schema.prisma`
- 运行时客户端：`apps/server/src/prisma/prisma.service.ts`
- 环境变量：`.env` / `.env.example` 中的 `DATABASE_URL`
- Docker 标准运行态默认也继续使用 `PostgreSQL`，通过 `docker/docker-compose.local-postgres.yml` 单独拉起 `postgres` 服务，并把数据库目录挂载到宿主机

### 2.2 初始化路径

- 首次建库推荐走根脚本：`npm run db:init`
- 该脚本会依次执行：
  - `npm run prisma:generate`
  - `npm run prisma:db:push`
  - `npm run prisma:seed`
- 已存在的结构化迁移位于：`prisma/migrations/`
- Docker 本地部署时，应用容器默认连接 `postgres:5432`；若首次启动前数据库为空，仍需执行同一套 `Prisma generate / db push / seed` 初始化链

### 2.3 运行时可用性判断

- 后端统一通过 `PrismaService.canUseDatabase()` 判断当前是否可连数据库
- 若数据库不可用，部分板块仍会临时回退到 `apps/server/src/common/mock-data.ts`
- 因此当前系统是“PostgreSQL 主库优先，少量 mock 兜底”的过渡结构，不是纯数据库单轨

### 2.4 技能/提示词注册表

- 当前新增两张注册表：
  - `SkillConfig`
  - `PromptTemplate`
- 持久化真源已补入：
  - `prisma/schema.prisma`
  - `prisma/migrations/20260508_skill_prompt_registry/migration.sql`
- 后端服务入口：
  - `apps/server/src/modules/admin/skills-prompts.service.ts`
- 当前策略：
  - 数据库可用时，后台技能中心优先从注册表读写
  - 首次命中时会把 `mock-data` 与真实 `SKILL.md` 内容回填进库
  - 后台保存后的平台级提示词以 `PromptTemplate.content` 为唯一真源，不再让本地提示词文件反向覆盖数据库
  - 数据库不可用时，仍回退到 `mock-data + 文件`

### 2.5 知识库管理持久化

- 当前知识库后台管理已补入 4 张正式表：
  - `KnowledgeBase`
  - `KnowledgeBaseFile`
  - `KnowledgeBaseSyncRun`
  - `KnowledgeRetrievalConfig`
- 持久化结构位于：
  - `prisma/schema.prisma`
  - `prisma/migrations/20260607_knowledge_base_persistence_tables/migration.sql`
- 后端服务入口：
  - `apps/server/src/modules/admin/knowledge-bases.service.ts`
- 当前策略：
  - 数据库和知识库表都可用时，后台知识库页优先从 PostgreSQL 读写
  - 首次切到正式表且表为空时，会把现有 `mock-data` 中的知识库、文件、同步记录和检索配置回填进库
  - 数据库不可用，或知识库迁移尚未执行时，接口仍回退到 `mock-data`
  - 因此前台现有 `/admin` 知识库管理页在本次改造后不需要更换接口即可继续工作
  - 当前文件同步与全量同步已进入“最小 ingestion 骨架”阶段：触发同步后会自动补齐估算分片数、回写文件状态并生成执行摘要，但尚未接入真实解析器与向量索引
  - 当前后台页已可直接维护知识库默认检索配置，包括 `TopK / Recall Mode / Rerank / Chunk Size / Chunk Overlap / Threshold`
  - 当前后台页已改成“左侧知识库/板块菜单 + 右侧当前内容”的工作台式布局，隐藏了同步状态手改、文件状态手改和同步结果手工标记等非必要操作

### 2.6 知识绑定桥接层

- 在 `project_planning` 第一阶段规划中，知识空间并不是孤立对象，而是要逐步与模块、能力包、Prompt、工作流步骤建立关系。
- 当前已新增：
  - `KnowledgeBinding`
- 配套迁移：
  - `prisma/migrations/20260607_knowledge_bindings_first_pass/migration.sql`
- 当前接口：
  - `GET /admin/knowledge-bindings`
  - `GET /admin/knowledge-bindings/by-target`
  - `POST /admin/knowledge-bindings`
  - `PATCH /admin/knowledge-bindings/:id`
  - `DELETE /admin/knowledge-bindings/:id`
- 当前策略：
  - 数据库和知识绑定表可用时，接口优先读写 PostgreSQL
  - 若知识绑定迁移未执行，则回退到 `mock-data` 中的知识绑定演示数据
  - 这一层属于第一阶段的通用桥接底座，不直接改动现有前台业务链路
  - 后台 `/admin` 的知识库管理页现已直接接入这一层，可按知识库维度维护 `MODULE / SKILL_PACKAGE / PROMPT / WORKFLOW_STEP` 四类绑定关系

### 2.7 模块注册中心第一批落地

- 按 `docs/project_planning` 第一阶段规划，当前已补入模块注册正式表：
  - `ModuleDefinition`
- 配套迁移：
  - `prisma/migrations/20260607_module_definitions_first_pass/migration.sql`
- 当前接口：
  - `GET /admin/module-definitions`
  - `GET /admin/module-definitions/:id`
  - `POST /admin/module-definitions`
  - `PATCH /admin/module-definitions/:id`
  - `PATCH /admin/module-definitions/:id/archive`
  - `DELETE /admin/module-definitions/:id`
- 当前策略：
  - 数据库和模块注册表可用时，优先读写 PostgreSQL
  - 若迁移未执行，则回退到 `mock-data` 中的 5 个工作台模块样例
  - 本轮只补正式表和接口，不直接改现有顶部菜单和后台单页标签结构，因此不会影响现有页面运行

### 2.8 模块默认能力包关系第一批落地

- 当前已补入关系表：
  - `SkillPackageModule`
- 配套迁移：
  - `prisma/migrations/20260607_skill_package_modules_first_pass/migration.sql`
- 当前接口：
  - `GET /admin/skill-package-modules`
  - `GET /admin/skill-package-modules/:id`
  - `GET /admin/skill-package-modules/by-module/:moduleKey`
  - `GET /admin/skill-package-modules/by-package/:packageKey`
  - `POST /admin/skill-package-modules`
  - `PATCH /admin/skill-package-modules/:id`
  - `DELETE /admin/skill-package-modules/:id`
- 当前策略：
  - 数据库和关系表可用时，优先读写 PostgreSQL
  - 若迁移未执行，则回退到 `mock-data` 中的模块与能力包挂载演示数据
  - 这一层先解决模块反查能力包、能力包反查模块和默认挂载管理，不强制统一技能中心页面先完成改造

### 2.9 技能与提示词关系第一批真源化

- 当前已补入关系表：
  - `SkillPromptBinding`
- 配套迁移：
  - `prisma/migrations/20260607_skill_prompt_bindings_first_pass/migration.sql`
- 当前接口：
  - `GET /admin/skill-prompt-bindings`
  - `GET /admin/skill-prompt-bindings/by-skill/:skillSlug`
  - `POST /admin/skill-prompt-bindings`
  - `PATCH /admin/skill-prompt-bindings/:id`
- 当前策略：
  - 数据库和关系表可用时，后台技能中心、创建技能、创建提示词等操作优先读写 PostgreSQL
  - 首次命中时，会根据历史 `SKILL_PROMPT_BINDINGS` 自动回填关系数据，并建立运行时缓存
  - 若迁移未执行，则仍可回退到历史绑定映射与前端 seed 过渡层
  - 这一层的目标是让后台管理、运行时用户技能中心和后续版本管理共享同一套技能提示词关系基础

### 2.10 能力包与技能关系第一批真源化

- 当前已补入关系表：
  - `SkillPackageSkill`
- 配套迁移：
  - `prisma/migrations/20260607_skill_package_skills_first_pass/migration.sql`
- 当前接口：
  - `GET /admin/skill-package-skills`
  - `GET /admin/skill-package-skills/:id`
  - `GET /admin/skill-package-skills/by-skill/:skillSlug`
  - `GET /admin/skill-package-skills/by-package/:packageKey`
  - `POST /admin/skill-package-skills`
  - `PATCH /admin/skill-package-skills/:id`
  - `DELETE /admin/skill-package-skills/:id`
- 当前策略：
  - 数据库和关系表可用时，后台技能中心中的能力包归属优先读写 PostgreSQL
  - 首次命中且表为空时，会把 `mock-data` 中已有的技能能力包挂载关系自动回填进库
  - 若迁移未执行，则接口仍回退到 `mock-data` 演示数据，不影响当前后台页面继续使用
  - 这一层先解决技能反查能力包、能力包反查技能，以及后台创建技能时同步落库能力包归属

### 2.11 SkillPackage 主数据第一批真源化

- 当前已补入主表：
  - `SkillPackage`
- 配套迁移：
  - `prisma/migrations/20260607_skill_packages_first_pass/migration.sql`
- 当前接口：
  - `GET /admin/skill-packages`
  - `GET /admin/skill-packages/:id`
  - `POST /admin/skill-packages`
  - `PATCH /admin/skill-packages/:id`
  - `DELETE /admin/skill-packages/:id`
- 当前策略：
  - 先把 `SkillPackage` 主对象单独立起来，承接 `packageKey`、`packageName`、状态、作用域、默认知识空间、默认 Provider 策略等主数据
  - 首次命中且表为空时，会把 `mock-data` 中已整理的第一批能力包主数据自动回填到 PostgreSQL
  - 若迁移未执行，则接口仍回退到 `mock-data` 演示数据
  - 当前关系表 `SkillPackageModule`、`SkillPackageSkill` 仍保持独立可用，下一阶段再继续把列表页 / 详情页和版本域与主对象统一收口
  - 当前已继续补第一批列表摘要聚合，`GET /admin/skill-packages` 开始返回模块摘要、默认模型摘要、技能数、提示词数等列表字段，供统一技能中心列表视图直接使用
  - 当前已继续补第一批详情聚合，`GET /admin/skill-packages/:id` 开始返回主对象摘要、主技能、模块摘要、工作流步骤、Prompt 摘要、Provider 摘要和当前版本占位摘要，供统一技能中心详情面板 first pass 直接使用
  - 当前已继续补第一批版本域，新增 `SkillPackageVersion`，并接通 `GET /admin/skill-packages/:id/versions`、`POST /admin/skill-packages/:id/versions`、`POST /admin/skill-packages/:id/activate-version`，让统一技能中心具备版本列表、创建和激活的最小闭环
  - 当前已继续补第一批能力包维度 Prompt 管理，接通 `PATCH /admin/skill-packages/:packageId/prompts/:promptId`，后台能力包详情中的 Prompt 不再只是只读摘要，而是直接复用 `PromptTemplate` 真源完成内容与参数保存
  - 当前已继续补第一批能力包维度 Provider 管理，接通 `PATCH /admin/skill-packages/:packageId/providers/:bindingId`，先桥接更新对应 `SkillConfig` 的 `provider + defaultModel`，让能力包详情中的 Provider 卡片可以直接维护模型供应商与模型值
  - 当前已继续补第一批能力包基础信息管理，接通 `PATCH /admin/skill-packages/:packageId/basic`，后台能力包详情中的名称、标识、状态、作用域、说明、标签、备注已可直接保存，同时保留模块、知识空间等关系字段只读展示
  - 当前已继续补第一批能力包维度 References 管理，新增独立表 `ReferenceAsset`，并接通 `POST /admin/skill-packages/:packageId/references`、`PATCH /admin/skill-packages/:packageId/references/:referenceId`、`DELETE /admin/skill-packages/:packageId/references/:referenceId`
  - 当前统一技能中心详情中的 `references` 不再固定返回空数组；数据库和 `ReferenceAsset` 表可用时优先读取 PostgreSQL，迁移未执行时回退到 `mock-data.referenceAssets`
  - 当前版本快照 `snapshotSummary.referenceCount` 已按真实 `ReferenceAsset` 数量统计，后台能力包详情页也已可直接新增、编辑、删除参考资料
  - 当前已继续补第一批能力包维度 Scripts 管理，新增独立表 `ScriptAsset`，并接通 `POST /admin/skill-packages/:packageId/scripts`、`PATCH /admin/skill-packages/:packageId/scripts/:scriptId`、`DELETE /admin/skill-packages/:packageId/scripts/:scriptId`
  - 当前统一技能中心详情中的 `scripts` 不再固定返回空数组；数据库和 `ScriptAsset` 表可用时优先读取 PostgreSQL，迁移未执行时回退到 `mock-data.scriptAssets`
  - 当前版本快照 `snapshotSummary.scriptCount` 已按真实 `ScriptAsset` 数量统计，后台能力包详情页也已可直接新增、编辑、删除脚本资产

### 2.12 第二阶段能力包知识关系独立层启动

- 当前已补入关系表：
  - `SkillPackageKnowledgeSpace`
- 配套迁移：
  - `prisma/migrations/20260607_skill_package_knowledge_spaces_first_pass/migration.sql`
- 当前接口：
  - `GET /admin/skill-package-knowledge-spaces`
  - `GET /admin/skill-package-knowledge-spaces/by-package/:packageKey`
  - `GET /admin/skill-package-knowledge-spaces/by-knowledge-space/:knowledgeBaseId`
  - `GET /admin/skill-package-knowledge-spaces/:id`
  - `POST /admin/skill-package-knowledge-spaces`
  - `PATCH /admin/skill-package-knowledge-spaces/:id`
  - `DELETE /admin/skill-package-knowledge-spaces/:id`
- 当前策略：
  - 第二阶段先把能力包与知识空间的长期关系从第一阶段桥接层中拆出来，落成独立治理关系表
  - 数据库和关系表可用时，后台“知识关系”页优先读写 PostgreSQL
  - 若迁移未执行，则接口仍回退到 `mock-data.skillPackageKnowledgeSpaces`
  - 当前不替换第一阶段 `KnowledgeBinding`，两层并行存在：`KnowledgeBinding` 继续服务通用桥接，`SkillPackageKnowledgeSpace` 负责能力包知识治理

## 3. 正式数据表分层

### 3.1 用户与交易域

- `User`
  - 用途：账号、会员等级、点数余额、飞书绑定主实体
  - 关键字段：`mobile`、`email`、`emailVerifiedAt`、`nickname`、`status`、`membership`、`systemRole`、`accessExpiresAt`、`allowedFeatureKeysJson`、`pointsBalance`、`lastLoginAt`
- `EmailVerificationCode`
  - 用途：注册邮箱验证码持久化、过期控制与消费校验
  - 关键字段：`email`、`purpose`、`codeHash`、`expiresAt`、`consumedAt`
- `RegistrationInviteCode`
  - 用途：注册邀请码持久化、一次性消费与使用人追踪
  - 关键字段：`code`、`consumedByUserId`、`consumedAt`
- `UserSession`
  - 用途：登录态会话、refresh token、当前品牌工作区绑定
  - 关键字段：`userId`、`refreshTokenHash`、`currentBrandId`、`expiresAt`、`revokedAt`
- `MembershipOrder`
  - 用途：会员购买、点数充值订单
  - 关键字段：`orderNo`、`orderType`、`orderStatus`、`membership`、`pointsAmount`、`amountYuan`
- `PointLedger`
  - 用途：点数增减流水
  - 关键字段：`changeType`、`pointsDelta`、`balanceAfter`、`relatedTaskId`

### 3.2 品牌资料域

- `Brand`
  - 用途：品牌主档
  - 关键字段：`ownerUserId`、`brandName`、`industry`、`storeCount`、`foundedYear`、`brandDescription`、`enterpriseIntro`、`ipProfileJson`
  - 补充说明：`ipProfileJson` 用于承接品牌资料库下独立 `IP资料库` 子板块，统一存储 `IP名称 / 多图照片 / IP语音 URL / 语音文件名 / 语音时长 / 定位 / 故事 / 价值观 / 风格 / 抖音账号链接 / 小红书账号链接`，避免为单一归档对象额外拆出独立重表
- `BrandMember`
  - 用途：品牌主账号与子用户协作关系
  - 关键字段：`brandId`、`userId`、`role`、`status`、`joinedAt`、`invitedByUserId`
- `BrandInvite`
  - 用途：品牌成员邀请、邀请码、邀请链接与接受状态闭环
  - 关键字段：`brandId`、`inviteAccount`、`inviteCode`、`inviteeUserId`、`role`、`status`、`invitedByUserId`、`expiresAt`、`acceptedAt`
- `BrandInviteReadState`
  - 用途：邀请通知中心未读/已读状态的用户级持久化，支撑跨设备同步
  - 关键字段：`inviteId`、`userId`、`readAt`
- `BrandInviteNotification`
  - 用途：邀请站内消息表第一版，给邀请通知中心提供独立消息记录
  - 关键字段：`inviteId`、`userId`、`brandId`、`title`、`summary`、`actionUrl`、`readAt`
- `BrandRoleAuditLog`
  - 用途：品牌成员邀请、角色修改、状态修改、主账号转移等成员域审计
  - 关键字段：`brandId`、`operatorUserId`、`targetUserId`、`targetInviteId`、`action`、`summary`、`detailJson`
- `Product`
  - 用途：品牌产品资料库
  - 关键字段：`brandId`、`productName`、`productType`、`price`、`productPositioning`、`targetAudience`、`usageScenario`、`differentiators`
- `BrandSurvey`
  - 用途：品牌运营情况、问卷类建档结果
  - 关键字段：`brandId`、`surveyType`、`surveyJson`、`summary`

### 3.3 外部账号与经营资产域

- `PlatformAccount`
  - 用途：品牌官方平台账号
  - 关键字段：`brandId`、`platform`、`accountName`、`accountLink`、`username`、`isPrimary`
- `CompetitorAccount`
  - 用途：竞品平台账号
  - 关键字段：`brandId`、`platform`、`accountName`、`accountLink`、`username`
- `IndustryReport`
  - 用途：行业报告外链或附件索引
  - 关键字段：`brandId`、`title`、`summary`、`fileUrl`、`sourceName`
- `BusinessAsset`
  - 用途：品牌经营资产、收集结果、生成报告索引
  - 关键字段：`brandId`、`category`、`title`、`description`、`fileUrl`、`metadataJson`
  - 当前 `category = BUSINESS_DATA` 的企业知识库资料在保存后，会自动桥接到对应品牌的企业知识库，便于后台继续同步和治理
  - 当前报告 HTML 与品牌资料附件会把 `fileUrl` 指向站内可访问路径，并用 `metadataJson` / 关联记录保存 `storageKey`

### 3.4 任务与生成结果域

- `Task`
  - 用途：所有生成、同步、发布类任务主记录
  - 关键字段：`taskType`、`taskStatus`、`taskTitle`、`promptName`、`modelName`、`inputJson`、`outputJson`、`errorMessage`、`pointsCost`
- `MediaAsset`
  - 用途：图片、视频、HTML、文档等结果媒体
  - 关键字段：`mediaType`、`title`、`sourceUrl`、`storageKey`、`mimeType`、`durationSec`、`metadataJson`
  - 当前 `works` 主链路约定：`sourceUrl` 走站内 `/api/works/brands/:brandId/assets/:fileName`，`storageKey` 指向 OSS 中的 `works/<brandId>/<fileName>`
  - 当前 `reports` 主链路约定：`sourceUrl` 走站内 `/api/reports/brands/:brandId/assets/:fileName`，`storageKey` 指向 OSS 中的 `reports/<brandId>/<fileName>`
  - 当前图片加载优化第一版只收口读取层：不改 `MediaAsset` 结构，也不新增图片规格字段；浏览器缓存与懒加载策略先在前端组件与读取接口层落地
- `OpenClawCreativeMaterial`
  - 用途：内容获客与个人中心素材管理共用的创作素材真源
  - 关键字段：`workspaceScope`、`sourceKind`、`title`、`description`、`materialType`、`materialTags`、`fileUrl`、`mimeType`、`textContent`、`storageKey`
  - 当前约定：
    - `materialTags` 以 JSON 字符串形式持久化，前端读取后回显为标签列表
    - `sourceKind=material_library_upload` 表示网站上传素材；`sourceKind=openclaw_upload` 表示 OpenClaw 上传到网站或外部归档素材
    - 网站上传素材当前统一写入 `works/<brandId>/material-library/<category>/<YYYY>/<YYYY-MM>/<timestamp>-<title>.<ext>` 受控副本
    - `local-single-user` 安装态下，这类 `material-library/*` 存储键会进一步映射到用户自定义的 `素材库/<分类>/<brandId>/...` 本地目录；其它 OpenClaw 上传素材仍可继续走默认本地受控存储
    - 当前会额外在返回层派生 `materialCategory / sourceLabel / localFilePath`，供内容获客创作素材表与个人中心素材管理页直接展示
- `OpenClawComment`
  - 用途：OpenClaw 内容详情下的统一留言真源
  - 关键字段：`workspaceScope`、`resourceType`、`resourceId`、`content`、`createdAt`、`updatedAt`
  - 当前约定：
    - 当前承接 `creative_material / daily_plan / lobster_diary / strategy_optimization / marketing_plan / explosive_analysis / video_work` 七类资源留言
    - 页面端默认按内容详情弹窗读取，不单独暴露独立列表页
- `OpenClawMarketingPlan`
  - 用途：内容获客三板块共用的营销策划方案真源，承接 OpenClaw 上传的 HTML 方案
  - 关键字段：`workspaceScope`、`title`、`htmlContent`、`createdAt`、`updatedAt`
  - 当前约定：
    - 当前固定用于 `xiaohongshu / douyin / wechat` 三个板块
    - 页面端统一支持 HTML 预览、打开 HTML、新增留言和直接删除
    - 当前已纳入 `prisma/schema.prisma`，避免标准 Docker 运行态的 `db-init -> prisma db push` 把它误判成待删除表
- `OpenClawStrategyOptimization`
  - 用途：品牌增长与内容获客共用的策略优化记录真源
  - 关键字段：`workspaceScope`、`generatedAt`、`title`、`content`、`createdAt`、`updatedAt`
  - 当前约定：
    - 页面端支持查看、编辑、留言与删除
    - 当前已纳入 `prisma/schema.prisma`，避免标准 Docker 运行态的 `db-init -> prisma db push` 误判删表
- `OpenClawExplosiveAnalysis`
  - 用途：品牌增长报告下 `爆款拆解` 板块的独立 HTML 真源
  - 关键字段：`workspaceScope`、`title`、`tagsText`、`htmlContent`、`authorName`、`workUrl`、`videoCopy`、`createdAt`、`updatedAt`
  - 当前约定：
    - 默认固定用于 `brand_growth` 工作区
    - 页面端支持列表查看、HTML 详情预览、删除与留言
    - 选题库若要引用爆款模板，继续通过 `DOUYIN_TOPIC_LIBRARY.items[].matchedExplosiveTemplateHtmls` 关联，不做外键耦合
- `OpenClawCommentLead`
  - 用途：全网获客工作台中 `评论获客` 板块的持久化真源
  - 关键字段：`workspaceScope`、`sourcePlatform`、`sourceUrl`、`sourceCommentId`、`userName`、`userComment`、`selectedReason`、`userProfileUrl`
  - 当前约定：
    - 默认固定写入 `workspaceScope=all_network_growth`
    - 数据来源仍是品牌增长策略里既有的小红书 / 抖音评论用户结果；全网获客只负责收口展示与删除
    - 页面端已去掉站内生成表单，只保留按平台筛选、分页查看和删除操作
- `OpenClawPlatformLead`
  - 用途：全网获客工作台中 `平台获客` 板块的持久化真源
  - 关键字段：`workspaceScope`、`name`、`businessScope`、`selectedReason`、`contactInfo`、`address`、`selectedAt`
  - 当前约定：
    - 默认固定写入 `workspaceScope=all_network_growth`
    - 由 OpenClaw 直接写入平台名单，不复用评论获客的派生链路
    - `name + contactInfo + address` 可作为无显式 `id` 时的更新匹配键，避免重复落相同平台记录
- `OpenClawGeoVisibilityReport`
  - 用途：GEO 工作台中 `GEO可见度诊断` 板块的 HTML 报告真源
  - 关键字段：`workspaceScope`、`title`、`description`、`htmlContent`
  - 当前约定：
    - 继续只承接 HTML 报告，不扩展非 HTML 附件
    - 前端以 iframe 预览 `htmlContent`
- `OpenClawGeoContent`
  - 用途：GEO 工作台中除 `GEO可见度诊断` 以外的其它 OpenClaw 结果真源
  - 关键字段：`workspaceScope`、`contentType`、`title`、`description`、`htmlContent`、`attachmentFileUrl`、`attachmentFileName`、`attachmentMimeType`、`attachmentStorageKey`
  - 当前约定：
    - 一次性内容使用 `keyword_research / site_diagnosis / knowledge_base_setup / geo_optimization_plan`
    - 多次生成列表使用 `self_media_content / third_party_media / brand_website_content`
    - 非 HTML 附件统一落受控副本；当前存储键前缀为 `reports/<brandId>/openclaw/geo/...`
    - `local-single-user` 安装态下，返回层会把 `attachmentStorageKey` 进一步映射为本地 `storageAddress`

### 3.5 飞书集成域

- `UserFeishuIntegration`
  - 用途：用户自有飞书开放平台应用配置与 OAuth 授权结果
  - 关键字段：`userId`、`appId`、`appSecret`、`redirectUri`、`scope`、`providerUserOpenId`、`accessToken`、`refreshToken`

### 3.6 技能与提示词注册域

- `SkillConfig`
  - 用途：后台技能中心中的技能元信息
  - 关键字段：`name`、`slug`、`category`、`status`、`provider`、`defaultModel`、`pointsCost`、`description`
  - 当前约定：当多个 Provider 存在同名模型且后台明确指定平台时，`defaultModel` 允许保存为 `providerId::modelName`，用于运行时优先命中指定 Provider；旧数据仍兼容纯模型名
- `PromptTemplate`
  - 用途：后台技能中心中的提示词模板正文与参数
  - 关键字段：`name`、`scene`、`version`、`status`、`modelName`、`temperature`、`maxTokens`、`content`
  - 当前约定：`modelName` 同样兼容 `providerId::modelName` 作用域值；用户态覆盖层沿用相同格式
- `SkillPromptBinding`
  - 用途：技能与提示词的正式关系表，承接后台技能中心绑定、运行时解析和后续多版本扩展
  - 关键字段：`skillId`、`promptId`、`skillSlug`、`promptScene`、`bindingType`、`isPrimary`、`sortOrder`、`enabled`
  - 当前约定：支持一个技能挂多条提示词关系，但允许通过 `isPrimary` 指定主绑定；当前后台创建提示词并绑定技能时会优先写入这一层
- `SkillPackageSkill`
  - 用途：能力包与技能的正式关系表，承接技能中心能力包归属、模块推导与后续独立关系管理页
  - 关键字段：`packageId`、`packageKey`、`packageName`、`skillId`、`skillSlug`、`bindingType`、`isDefault`、`sortOrder`、`enabled`
  - 当前约定：同一技能可挂多个能力包，但默认归属通过 `isDefault` 收口为单技能唯一默认；后台创建技能时若选择能力包会优先写入这一层
- `SkillPackage`
  - 用途：统一技能中心与能力包注册中心的主对象，作为模块、技能、知识、Prompt、Provider 等资产的聚合根入口
  - 关键字段：`packageKey`、`packageName`、`status`、`scope`、`moduleKeysJson`、`workflowStepKeysJson`、`tagsJson`、`currentVersionId`
  - 当前约定：第一批先支持后台 CRUD 和主数据维护，不急着把 Prompt、Provider、版本快照一次性全部塞进主表
- `ReferenceAsset`
  - 用途：能力包级参考资料真源，承接统一技能中心详情里的 `references` 资产域
  - 关键字段：`packageId`、`referenceKey`、`title`、`sourceType`、`sourceUri`、`usageNote`、`applicableScopesJson`、`sortOrder`
  - 当前约定：同一能力包内 `referenceKey` 唯一；数据库可用时后台能力包详情页直接对这一表做增改删，数据库不可用时回退到 `mock-data.referenceAssets`
- `ScriptAsset`
  - 用途：能力包级脚本资产真源，承接统一技能中心详情里的 `scripts` 资产域
  - 关键字段：`packageId`、`scriptKey`、`scriptName`、`runtime`、`entry`、`argsSchemaJson`、`usageNote`、`sortOrder`
  - 当前约定：同一能力包内 `scriptKey` 唯一；数据库可用时后台能力包详情页直接对这一表做增改删，数据库不可用时回退到 `mock-data.scriptAssets`
- `SkillPackageKnowledgeSpace`
  - 用途：第二阶段能力包与知识空间的专用关系表，承接后台“知识关系”治理页
  - 关键字段：`packageId`、`packageKey`、`packageName`、`knowledgeBaseId`、`relationType`、`priority`、`retrievalMode`、`isRequired`、`enabled`、`remarks`
  - 当前约定：同一能力包下，同一知识库与同一关系类型只允许一条记录；数据库可用时后台独立关系页直接对这一表做增改删，数据库不可用时回退到 `mock-data.skillPackageKnowledgeSpaces`

### 3.7 接口供应商注册域

- `ApiProviderConfig`
  - 用途：后台接口供应商配置中心与运行时 Provider 真源
  - 关键字段：`name`、`providerType`、`status`、`baseUrl`、`tutorialUrl`、`apiKey`、`defaultModel`、`organization`、`project`、`timeoutMs`、`streamEnabled`
  - JSON 字段：`modelWhitelistJson`、`customHeadersJson`、`extraParamsJson`
  - 当前约定：`extraParamsJson.runtimeKey` 作为运行时分组键；`ReportsModule` 与 `WorksModule` 按 `runtimeKey` 查询激活中的 Provider。当前已补入 `Right Codes · 文生文（可带图）` 与 `Right Codes · 文生图/图生图` 两类 Provider，其中图像生成通过 `extraParamsJson.requestMode=images-generations` 切到 `/v1/images/generations`
  - 当前约定：若系统级旧 Provider 已对应到下线平台域名，服务启动时允许自动删除旧 `ApiProviderConfig` 残留，避免接口供应商页继续暴露不可用模型
- `ThirdPartyPlatformConfig`
  - 用途：后台平台级第三方接口配置基线，供后台“接口供应商”平台页与个人中心“第三方接口配置”同步读取
  - 关键字段：`name`、`providerType`、`status`、`baseUrl`、`tutorialUrl`、`defaultModel`、`remark`
  - JSON 字段：`modelIdsJson`
  - 当前约定：若平台 `baseUrl` 命中已下线平台域名，服务启动时允许自动清理旧 `ThirdPartyPlatformConfig` 与关联私钥记录
- `BrandThirdPartyPlatformSecret`
  - 用途：保存当前品牌下、针对某个平台配置的共享 API Key
  - 关键字段：`brandId`、`platformId`、`apiKey`
  - 当前约定：唯一键为 `brandId + platformId`；拥有 `personalCenter.thirdPartyPlatforms.edit` 权限的成员维护同一份品牌共享 Key；当 `ApiProviderConfig.baseUrl / extraParams.baseUrls` 命中平台 `baseUrl` 时，`ReportsModule` 与 `WorksModule` 会按 `brandId + platformId` 强制读取这里的共享 Key，若当前品牌未配置则直接返回提醒，不再回退公共 Key

### 3.8 知识库管理域

- `KnowledgeBase`
  - 用途：后台知识库主档
  - 关键字段：`name`、`slug`、`sourceType`、`status`、`syncStatus`、`documentCount`、`chunkCount`、`description`
- `KnowledgeBaseFile`
  - 用途：知识库文件索引与索引状态管理
  - 关键字段：`knowledgeBaseId`、`fileName`、`fileType`、`sourceName`、`chunkCount`、`status`、`uploadedAt`
- `KnowledgeBaseSyncRun`
  - 用途：知识库文件同步与全量同步记录
  - 关键字段：`knowledgeBaseId`、`fileId`、`scope`、`operator`、`result`、`summary`、`errorDetail`、`startedAt`、`completedAt`
- `KnowledgeRetrievalConfig`
  - 用途：知识库默认检索参数配置
  - 关键字段：`knowledgeBaseId`、`defaultTopK`、`recallMode`、`rerankEnabled`、`rerankModelName`、`chunkSize`、`chunkOverlap`、`retrievalThreshold`
- `KnowledgeBinding`
  - 用途：知识库与模块、能力包、Prompt、工作流步骤之间的桥接关系
  - 关键字段：`knowledgeBaseId`、`bindingType`、`targetId`、`targetKey`、`targetName`、`priority`、`retrievalMode`、`isRequired`、`enabled`
- `ModuleDefinition`
  - 用途：模块注册中心主表
  - 关键字段：`moduleKey`、`moduleName`、`moduleType`、`moduleStatus`、`entryRoute`、`requiredPermissionsJson`、`featureFlagsJson`、`requiredCapabilitiesJson`、`taskTypesJson`
- `SkillPackageModule`
  - 用途：模块与能力包关系表
  - 关键字段：`packageId`、`packageKey`、`packageName`、`moduleKey`、`bindingType`、`isDefault`、`sortOrder`、`enabled`
- `SkillPromptBinding`
  - 用途：统一技能中心与运行时之间的技能-提示词桥接关系
  - 关键字段：`skillId`、`promptId`、`skillSlug`、`promptScene`、`bindingType`、`isPrimary`、`sortOrder`、`enabled`
- `SkillPackageKnowledgeSpace`
  - 用途：能力包与知识空间的专用关系层
  - 关键字段：`packageId`、`packageKey`、`packageName`、`knowledgeBaseId`、`relationType`、`priority`、`retrievalMode`、`isRequired`、`enabled`

## 4. 业务板块与数据表映射

### 4.1 品牌增长策略 `/brand-growth`

- 品牌资料库
  - 主表：`Brand`、`Product`、`BrandSurvey`、`IndustryReport`、`BusinessAsset`
  - 产品图片与资料附件当前统一持久化到 OSS，分别使用 `brands/<brandId>/product-images/<fileName>`、`brands/<brandId>/asset-files/<fileName>` 作为对象真源，数据库只保存索引和站内访问地址
- 收集数据
  - 主表：`PlatformAccount`、`CompetitorAccount`、`BusinessAsset`
  - 飞书绑定：`UserFeishuIntegration`
- 品牌增长报告 / 可视化报告 / 半年营销规划
  - 任务：`Task`
  - 媒体结果：`MediaAsset`
  - 结果索引：`BusinessAsset`
  - 报告 HTML 当前统一持久化到 OSS，数据库中保存 `storageKey` 与站内 `sourceUrl`
- 访问边界
  - 当前品牌相关读取与写入已按 `BrandMember / ownerUserId` 校验当前登录用户访问权限，不再允许新账号通过旧 `brandId` 继续读取演示品牌数据

### 4.2 小红书 `/xiaohongshu`

- 营销策划方案
  - 上游读取：`Brand`、`Product`、`PlatformAccount`、`CompetitorAccount`、`BusinessAsset`
  - 生成结果：`Task`、`MediaAsset`、`BusinessAsset`
- 营销日历
  - 上游读取：品牌资料域 + 报告/策划结果 + 热点/素材结果
  - 生成结果：`Task`、`BusinessAsset`
- 原创笔记 / 二创笔记 / 视频笔记
  - 任务：`Task`
  - 成品 HTML / 图片 / 视频：`MediaAsset`
  - 作品工作区主记录：当前主要通过 `MediaAsset.metadataJson` 承载结构化作品元数据
  - 原创笔记主记录 `kind = XHS_ORIGINAL_NOTE`、二创笔记主记录 `kind = XHS_REWRITE_NOTE`、视频笔记主记录 `kind = XHS_VIDEO_NOTE` 当前都已额外持久化 `accountRole`，用于区分 `品牌号 / 员工号 / 达人号` 发布主体，并直接回传给前端作品卡片展示
  - 视频笔记主记录 `kind = XHS_VIDEO_NOTE` 当前继续复用 `MediaAsset.metadataJson` 承载三阶段状态，不新增独立视频流程表；中间字段包含 `videoKind`、`workflowStage`、`creativeScript`、`storyboardPrompt`、`storyboardImageUrl`、`progressSteps`、`storyboardRevisions`、`materialId/materialVideoUrl`
  - 历史未带 `accountRole` 的二创/视频旧数据，当前读取时统一回落为 `品牌号`，避免旧作品列表读取失败
- 访问边界
  - 小红书素材、营销方案、营销日历和飞书媒体代理等按 `brandId` 访问的接口，当前已统一校验当前登录用户是否属于该品牌

### 4.2A 抖音 `/douyin`

- 营销策划方案 / 热点找选题 / 选题库
  - 上游读取：`Brand`、`Product`、`PlatformAccount`、`CompetitorAccount`、`BusinessAsset`
  - 生成结果：`Task`、`BusinessAsset`
  - `DOUYIN_TOPIC_LIBRARY` 当前仍继续走 `BusinessAsset.metadataJson`，但单条选题已新增 `matchedExplosiveTemplateHtmls?: string[]` 用于沉淀多个爆款拆解 HTML 模板
- 素材库 / 数据采集联动
  - 采集主表：`BusinessAsset`
  - 当前抖音采集结果、素材库沉淀和视频缓存状态统一通过 `BusinessAsset.metadataJson` 承载结构化字段
  - 视频源地址会先从第三方采集结果中提取，再异步转存到 OSS，对前端返回短时签名读地址；缓存有效期默认为 7 天，过期后由定时任务删除 OSS 文件并把缓存状态改为 `EXPIRED`
- 原创文案 / 二创文案 / AI 生视频（故事板） / AI 生视频 / 数字人 / 广告预审 / 复刻短视频
  - 任务：`Task`
  - 成品 HTML / 图片 / 视频：`MediaAsset`
  - 当前抖音作品工作区主记录继续复用 `MediaAsset.metadataJson`，不新增独立业务表
  - `DOUYIN_VIDEO_NOTE`、`DOUYIN_DIRECT_VIDEO`、`DOUYIN_REMIX_SHORT_VIDEO` 当前都通过 `MediaAsset.metadataJson` 保存结构化工作区状态
  - `DOUYIN_REMIX_SHORT_VIDEO` 当前已拆成独立板块，不再挂在旧 `REMIX` 分支；创建后先执行 15 秒分段复刻分析，再执行逐段生视频与 `ffmpeg concat` 拼接成片
  - `DOUYIN_REMIX_SHORT_VIDEO` 关键字段包括 `workflowStage`、`sourceMaterialId`、`sourceMaterialUrl`、`sourceVideoUrl`、`sourceDurationSec`、`segmentDurationSec`、`injectBrandProfile`、`analysisModel`、`storyboardImageModelSelection`、`remixSegments`、`composeStatus`、`composeError`、`mergedVideoUrl`
  - `remixSegments[]` 当前承载单段工作区内容：`segmentLabel`、`startSec`、`endSec`、`analysisReport`、`roleCardText`、`storyboardScript`、`roleImageUrl`、`storyboardImageUrl`、`consistencyCheck`、`videoPrompt`、`videoUrl`
- 输入约束
  - 复刻短视频创建弹窗当前优先从抖音素材库选择带 `videoUrl` 的素材，前端传 `sourceMaterialId`
  - 若未选择素材库项，允许上传短视频文件兜底；不再要求手动填写素材视频链接
- 访问边界
  - 抖音工作台全部 `brandId` 级接口当前按 `BrandMember / ownerUserId` 统一校验品牌归属
  - 复刻短视频板块权限独立挂在 `douyin.remixShortVideo`

### 4.2B 公众号 `/wechat`

- 公众号配置与工作流主数据
  - 主表：`WechatAccountConfig`、`WechatWorkflowPreference`、`WechatOfficialAccount`
  - 用途：持久化 `AppID / AppSecret / IP 白名单 / 默认作者 / 默认主题色 / 默认账号 / 评论策略`
- 公众号创作过程数据
  - 主表：`WechatWorkflowSession`
  - 用途：持久化输入资料、文章阶段输出、`htmlContent`、图片 briefs、生图结果、发布确认状态，支持用户离开页面后继续编辑
  - 关键字段：`imageMode`、`bodyImageSize`、`imageBundleJson`、`publishConfigJson`
- 公众号文章草稿与发布历史
  - 主表：`WechatArticleDraft`、`WechatPublishHistory`
  - 用途：持久化草稿正文、HTML、图片任务、发布状态、重试记录与错误详情
- 任务与媒体协同
  - 任务表：`Task`
  - 当前公众号工作流仍会把执行过程同步写入 `Task`，但业务主数据不再只停留在内存 mock store
- 回退边界
  - 数据库不可用时，公众号模块仍保留内存 mock store 兜底；一旦数据库可用，接口默认优先读写上述公众号正式表
- 运行时说明
  - 生图链路在命中 `rate_limit_exceeded / 429 / quota` 时，会停止同模型下的 prompt 级重复尝试，转而继续切换下一候选模型或供应商，减少第三方平台中的重复失败任务

### 4.3 个人中心 `/personal-center`

- 用户资料：`User`
- 用户头像对象真源：OSS `users/<userId>/avatars/<fileName>`，`User.avatarUrl` 保存站内头像访问地址
- 注册邀请码：`RegistrationInviteCode`
- 登录态：`UserSession`
- 点数流水：`PointLedger`
- 会员订单 / 充值明细：`MembershipOrder`
- 任务记录：`Task`
- 我的作品：`MediaAsset`
- 素材管理：`OpenClawCreativeMaterial`
- 邀请通知已读状态：`BrandInviteReadState`
- 邀请站内消息：`BrandInviteNotification`
- 第三方接口配置：
  - 平台基线：`ThirdPartyPlatformConfig`
  - 当前品牌下平台共享 Key：`BrandThirdPartyPlatformSecret`
  - 若历史品牌下仍残留已下线平台的共享 Key，启动时会随平台基线一起清理

### 4.4A GEO `/geo`

- GEO可见度诊断：
  - 主表：`OpenClawGeoVisibilityReport`
  - 用途：保存和回显 HTML 诊断报告
- 其它 GEO 一次性 / 多次生成内容：
  - 主表：`OpenClawGeoContent`
  - 用途：保存关键词挖掘、网站诊断、知识库搭建、GEO优化方案、自媒体内容、第三方媒体、品牌网站等结果
- 第三方媒体投放缓存：
  - 主表：`OpenClawThirdPartyMediaResource`
  - 同步状态表：`OpenClawThirdPartyMediaSyncState`
  - 用途：按 `brandId + workspaceScope + providerType + remoteResourceId` 持续缓存软文街媒体资源，记录来源远端页码、最近同步时间、下一次待同步页码，并支撑站内 20 条分页与搜索
  - 当前说明：
    - 当前已纳入 `prisma/schema.prisma`
    - 服务启动后仍保留运行时 `CREATE TABLE IF NOT EXISTS / ALTER TABLE` 自举兜底，继续兼容 SQLite 与历史旧库补列
    - 标准 Docker 运行态的 `db-init -> prisma db push` 不再把这两张缓存表误判为待删除表
- 附件存储：
  - 非 HTML 附件统一走受控副本
  - 当前存储键前缀：`reports/<brandId>/openclaw/geo/...`
  - `local-single-user` 安装态下会映射为本地 `storageAddress`

### 4.5 后台管理 `/admin`

- 订单管理：`MembershipOrder`
- 会员/积分规则：当前仍主要来自 `mock-data`
- 用户管理：`User`、`UserSession`
- 当前后台用户管理已直接维护 `User.accessExpiresAt` 与 `User.allowedFeatureKeysJson`，用于账号到期与主模块权限控制
- 品牌成员与权限：`Brand`、`BrandMember`
- API Provider 管理：当前已升级为数据库优先、`mock-data` 兜底；数据库可用时通过运行时表 `ApiProviderConfig` 持久化第三方接口供应商配置，字段覆盖 `name`、`providerType`、`status`、`baseUrl`、`tutorialUrl`、`apiKey`、`defaultModel`、`organization`、`project`、`timeoutMs`、`streamEnabled`、`customHeadersJson`、`extraParamsJson`、`modelWhitelistJson`、`remark`
  - 当前视频模型下拉、报告生成和小红书创作生成链路已开始直接读取 `ApiProviderConfig`
- 第三方平台配置管理：当前后台“接口供应商”可见页已切到平台级配置视图；数据库可用时通过 `ThirdPartyPlatformConfig` 持久化平台基线，通过 `BrandThirdPartyPlatformSecret` 持久化个人中心品牌共享 API Key
  - 当前这层不替代 `ApiProviderConfig` 的运行时 `runtimeKey` 分组真源，但已作为运行时 API Key 强制隔离层参与 `ReportsModule` 与 `WorksModule`：命中平台后必须使用品牌共享密钥，缺失时直接报错提醒
- 技能中心
  - 正式注册表：`SkillConfig`、`PromptTemplate`
  - 文件镜像：真实 `SKILL.md` / `.txt`
- 知识库管理：
  - 正式表：`KnowledgeBase`、`KnowledgeBaseFile`、`KnowledgeBaseSyncRun`、`KnowledgeRetrievalConfig`
  - 桥接表：`KnowledgeBinding`
  - 当前策略：数据库优先、`mock-data` 兜底；知识库迁移未执行时仍保持现有页面和接口可用，后台页现可同时维护主档、文件、同步、检索配置和绑定关系
- 模块注册中心：
  - 正式表：`ModuleDefinition`
  - 当前策略：数据库优先、`mock-data` 兜底；当前先提供后台接口和前端服务层，不强推现有菜单改成注册表驱动
- 模块默认能力包关系：
  - 正式表：`SkillPackageModule`
  - 当前策略：数据库优先、`mock-data` 兜底；先提供双向查询和读写接口，后续再接统一技能中心与模块注册中心页面
- 统一技能中心能力包详情 References：
  - 正式表：`ReferenceAsset`
  - 当前策略：数据库优先、`mock-data` 兜底；这一层先解决能力包参考资料的独立真源化与后台可维护，不改现有业务模块运行链路
- 统一技能中心能力包详情 Scripts：
  - 正式表：`ScriptAsset`
  - 当前策略：数据库优先、`mock-data` 兜底；这一层先解决能力包脚本资产的独立真源化与后台可维护，不改现有业务模块运行链路
- 统一技能中心能力包详情 Knowledge：
  - 桥接表：`KnowledgeBinding`
  - 当前策略：复用现有 `GET /admin/knowledge-bindings/by-target` 与 `POST/PATCH/DELETE /admin/knowledge-bindings`，先把能力包详情中的知识绑定区补成后台可维护闭环，不改现有业务运行链路
- 第二阶段能力包知识关系治理：
  - 正式表：`SkillPackageKnowledgeSpace`
  - 当前策略：数据库优先、`mock-data` 兜底；后台模块中心新增 `知识关系` 子页，集中维护能力包与知识空间的长期关系，不替换第一阶段详情页桥接区块

### 4.6 认证 `/` + `/login` + `/register`

- 登录
  - 主表：`User`、`UserSession`
  - 当前沿用账号密码登录，允许手机号 / 邮箱 / 昵称作为账号
- 注册
  - 主表：`RegistrationInviteCode`、`User`、`Brand`、`BrandMember`
  - 当前网站版、源码运行态与 `local-single-user` 安装态统一都要求手机号和邀请码；邀请码验证通过且未消费时才创建用户与默认品牌，并回写消费人和消费时间
  - 线上部署若只执行 `prisma db push` 不会自动导入预置邀请码；生产环境需额外执行目标化的邀请码 seed，确保网站版 / 标准运行态的 `RegistrationInviteCode` 表具备初始化数据
  - 用户登录、续期和请求鉴权阶段都会校验 `User.status` 与 `User.accessExpiresAt`；账号停用或已到期会直接被后端拒绝
  - 用户模块权限通过 `User.allowedFeatureKeysJson` 存储，后端会结合请求路径统一拦截当前账号无权访问的主模块

## 5. 当前仍未完全入库的部分

- `apps/server/src/common/mock-data.ts`
  - 仍承载部分演示数据和兜底数据
  - 当前典型包括：`billingRules`、部分知识库配置，以及数据库不可用时的 `apiProviders` 兜底数据
  - 当前 mock 模式下的演示账号权限也必须沿用 `mock-data.users[].systemRole`，不能在认证链路中硬降级为普通用户，否则后台 Provider 配置中心无法联调
- 注册邀请码在数据库不可用时会临时从 `prisma/seed-data/registration-invite-codes.txt` 加载到内存兜底，不写入 `mock-data`
- `local-single-user` 的资料目录配置当前写在默认资料根下的 `launcher-settings.json`，不入数据库；当前用于承接 launcher 启动时的本地目录选择与待迁移来源路径
- `提示词/` 与 `.trae/skills/`
  - 当前作为提示词文件基线与首次种子导入来源之一
  - 不再作为数据库可用时的平台级提示词读取真源
- 历史演示数据和少量非主链路资源
  - `works`、`reports`、品牌产品图、品牌资料附件、用户头像这几条主链路已改为 OSS 对象持久化
  - 但 `mock-data` 与部分历史演示资源中仍可能保留第三方 URL 或 `oss.example.com` 占位链接

## 6. 当前关键参数约定

### 6.1 任务记录通用参数

- `taskType`：业务任务类型，如品牌增长报告、小红书营销日历、原创笔记、视频笔记
- `taskStatus`：`PENDING / QUEUED / RUNNING / SUCCESS / FAILED / CANCELLED`
- `modelName`：本次任务最终采用的文本模型或视频模型标识
- `inputJson`：输入快照
- `outputJson`：输出快照
- `pointsCost`：本次任务扣点成本

### 6.2 媒体记录通用参数

- `mediaType`：`IMAGE / VIDEO / DOCUMENT / HTML / ARCHIVE`
- `sourceUrl`：访问地址
- `storageKey`：本站存储定位键
- `mimeType`：文件类型
- `durationSec`：视频时长
- `metadataJson`：作品或报告的结构化扩展字段
- 主链路约定：
- `works/<brandId>/<fileName>`
- `reports/<brandId>/<fileName>`
- `brands/<brandId>/product-images/<fileName>`
- `brands/<brandId>/asset-files/<fileName>`
- `users/<userId>/avatars/<fileName>`

### 6.3 技能注册表参数

- `SkillConfig.provider`：后台配置的模型供应商名，需与后台 provider 配置保持一致
- `SkillConfig.defaultModel`：技能默认模型
- `PromptTemplate.scene`：提示词场景标识
- `PromptTemplate.content`：提示词正文
- `PromptTemplate.temperature` / `maxTokens`：运行时生成参数

## 7. 后续维护规则

- 只要 `prisma/schema.prisma` 有新增、删除或字段变更，必须同步更新本文件
- 只要某个业务板块从 `mock-data` 切到正式数据库，必须同步更新“业务板块与数据表映射”
- 只要后台技能中心新增数据库字段或改写读写链路，必须同步更新本文件与 `docs/site-map.md`

## 8. 下一阶段规划中的目标模型

> 本节是“规划目标”，不是当前已落地结构。后续真正进入开发并完成迁移后，再把对应内容合并进前文正式分层。

### 8.1 多用户与品牌协作域

- 当前已落地：
  - `BrandInvite`
  - `BrandInviteReadState`
  - `BrandInviteNotification`
  - `BrandRoleAuditLog`
- 已落地作用：
  - 支持一个品牌生成邀请码与邀请链接并完成接受闭环
  - 支持品牌成员邀请、角色调整和主账号转移的成员域审计
  - 支持同一品牌下多用户共享品牌数据空间并保留操作留痕

### 8.2 品牌技能覆盖域

- 目标新增表：
  - `BrandSkillProfile`
  - `BrandPromptOverride`
  - `BrandSkillResetLog`
- 目标作用：
  - 平台统一维护基线技能
  - 品牌基于平台技能创建自己的共享覆盖层
  - 品牌管理员不可删除平台技能，但可保存和重置当前品牌版本

### 8.3 会员与积分正式规则域

- 目标新增表：
  - `MembershipPlan`
  - `UserMembership`
  - `PointsPlan`
  - `PointsAccount`
- 目标作用：
  - 替换当前 `mock-data` 中的会员/积分规则
  - 支持普通用户、会员用户、企业会员等账号等级
  - 支持品牌公共点数池和操作用户留痕

### 8.4 会话与审计域

- 目标新增表：
  - `AdminOperationLog`
- 目标作用：
  - 在已落地 `UserSession` 基础上继续补足管理员审计
  - 记录后台管理员对用户、品牌、会员、积分、角色的操作审计
