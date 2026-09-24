# AI全域运营系统全站地图

## 1. 文档定位

本文件只记录当前系统的真实结构，不再混入历史规划稿、已放弃路线或展示镜像。

它需要回答四个问题：

1. 现在有哪些真实入口
2. 每条主链路由哪些前后端模块承接
3. 哪些能力已经正式落地
4. 哪些目录是当前真相，哪些目录只是历史参考

## 2. 顶层结构

### 2.1 代码目录

- `apps/web`
  - 官网首页、认证页、前台工作台、个人中心、后台管理台、帮助页、发布页
- `apps/server`
  - 认证、品牌、采集、报告、作品、任务、发布、系统升级、OpenClaw、后台治理等 API 模块
- `packages/config`
  - 配置相关共享包
- `packages/prompt-runtime`
  - 提示词与运行时能力
- `packages/shared`
  - 前后端共享类型与常量
- `packages/ui`
  - 共享 UI 预留层
- `docs`
  - 当前真相文档、专题方案、变更记录、历史规划

### 2.2 文档目录

- `docs/README.md`
  - 文档总入口
- `docs/changes/`
  - 真实变更记录
- `docs/project_planning/`
  - 历史规划与阶段草案，仅作参考
- `docs/openclaw/`
  - OpenClaw 相关专题文档

## 3. 前端路由地图

### 3.1 公共与认证入口

- `/`
  - 官网首页，当前是营销型首页
  - `local-single-user` 安装态下访问根路径时会直接跳到 `/brand-growth`，避免安装态去渲染仅面向官网的营销首页模板
- `/login`
  - 前台登录页
- `/register`
  - 前台注册页；当前网站版、源码运行态与 `local-single-user` 安装态统一都走邀请码注册，由 `GET /auth/register-config` 与 `POST /auth/register` 后端控制准入
- `/admin/login`
  - 后台管理员登录页
- `/help/xhs-draft-publisher`
  - 小红书扩展帮助页
- `/help/publisher`
  - 统一发布扩展帮助页
- `/help/douyin-publisher`
  - 抖音扩展帮助页
- `/help/wechat-channel-publisher`
  - 视频号扩展帮助页
- `/publish/mobile/[token]`
  - 移动发布接力页

### 3.2 受保护工作台入口

- `/brand-growth`
  - 品牌增长策略工作台
- `/xiaohongshu`
  - 内容获客工作台；当前用统一左侧导航收口某书 / 某音/某号 / 公众号三类内容运营板块
- `/douyin`
  - 抖音工作台兼容直达入口；顶栏已移除，主入口已并入 `/xiaohongshu`
- `/wechat`
  - 公众号工作台兼容直达入口；顶栏已移除，主入口已并入 `/xiaohongshu`
- `/geo`
  - GEO获客工作台；承接 OpenClaw 保存的 GEO 诊断、关键词挖掘、网站诊断、知识库搭建、优化方案与多次生成内容
- `/all-network-growth`
  - 全网获客工作台；承接 OpenClaw 从品牌增长评论用户结果生成的评论获客名单
- `/paid-acquisition`
  - 投流获客工作台；承接 OpenClaw 直接写入的腾讯投流获客列表
- `/creator-cooperation`
  - 达人合作工作台；承接 OpenClaw 从达人结果池筛选的达人匹配、达人跟踪与合作作品跟踪
- `/more-features`
  - 更多功能入口，当前重定向到 `/more-features/design`
- `/more-features/design`
  - 设计工作台
- `/personal-center`
  - 个人中心总入口
- `/admin`
  - 后台管理台
- `/membership-purchase`
  - 会员购买
- `/points-purchase`
  - 点数购买
- `/orders/[id]`
  - 订单详情

### 3.3 登录门卫规则

- `/brand-growth`、`/xiaohongshu`、`/douyin`、`/wechat`、`/geo`、`/all-network-growth`、`/paid-acquisition`、`/creator-cooperation`、`/more-features/design`、`/personal-center/*` 默认要求登录
- 未登录时统一跳转 `/login?next=...`
- `/admin` 额外要求管理员身份

## 4. 主要业务板块

### 4.1 品牌增长策略 `/brand-growth`

包含四类主工作区：

- 品牌资料库
  - 品牌背景、IP资料库、产品资料、品牌运营情况、第三方数据、企业知识库
- 收集数据
  - 小红书采集、抖音采集、公众号采集（品牌公众号数据 / 对标作品信息及数据 / 微信搜一搜）、每日热点、飞书绑定
  - 抖音采集当前已补齐达人抓取第一期：`达人搜索抓取`、`达人深度抓取`、`达人结果池`
- 品牌增长报告
  - 品牌增长报告、可视化报告、半年营销规划、营销日历、爆款拆解、选题库、素材库（统一素材库）
- OpenClaw专区
  - 龙虾日记 / 每周复盘（仅 OpenClaw Agent 创建，页面侧支持查看后直接编辑与留言）
  - 策略优化记录（由 OpenClaw 基于每周复盘生成，页面侧支持查看、编辑、留言与删除）

当前特点：

- 首次进入会通过 `/auth/me` 校正真实品牌上下文
- `品牌增长报告 -> 选题库` 当前已收口为人工与 OpenClaw 共用的结构化选题库；品牌增长页不再展示“热门找选题”板块，只保留选题沉淀、查看、编辑、删除
- `品牌增长报告 -> 爆款拆解` 当前为 OpenClaw 独立 HTML 真源板块，支持列表查看、HTML 详情预览、删除与留言协作
- `品牌增长报告 -> 选题库` 当前新增 `匹配爆款模板` 字段，可由 OpenClaw 写入多个爆款拆解 HTML
- 参考变更：`docs/changes/2026-08-27-brand-growth-topic-library-generalization.md`
- 参考变更：`docs/changes/2026-09-21-openclaw-explosive-analysis-and-topic-template-linking.md`
- 报告类任务走后台任务中心
- 知识绑定已进入部分报告运行时
- 营销日历真源已收口在品牌增长策略；内容获客三端当前新增的是同一份营销日历的按平台过滤视图，而不是第二套日历存储
- OpenClaw 专区与品牌增长共用左侧手风琴导航，龙虾日记和策略优化记录都由 `openclaw` 模块提供
- 品牌资料库已在“品牌背景资料”下方新增独立 `IP资料库` 子板块，沉淀 IP 名称、IP 照片、语音、定位、故事、价值观、风格和平台账号链接，并继续沿用品牌主档归档链统一读写
- `IP资料库` 当前新增品牌语音上传：
  - 仅支持 `mp3`
  - 服务端真实校验时长必须 `> 30 秒`
  - 语音文件走受控品牌存储接口读取，不直接暴露裸文件路径
- 抖音采集作品的视频预览缓存现在统一走受控副本链路：网页态继续可读 OSS，缺 OSS 的本地运行态则通过 `collectors/douyin` 受控媒体接口读取本地副本，不再因为没有 OSS 而丢失预览
- 抖音采集表格当前会直接回显视频存储位置；若视频缓存失败或过期，页面会同时保留原作品回看入口，方便判断问题到底出在站内副本还是源作品
- 抖音采集视频文案提取当前默认走本地 ASR 链路：Paraformer 主识别、Whisper 兜底；系统会记录状态更新时间，当本地 ASR 环境未就绪或任务长时间卡住时，会自动收口为可重试失败态
- 抖音视频文案提取当前已统一到同一条串行队列：
  - 手动点击“提取文案”不再直接并发拉起 ASR，而是先标记 `PENDING` 后入队
  - 采集完成后的自动提取与服务重启后的恢复也复用同一条队列
  - 同一条作品在队列内会做 in-flight 去重，降低连续点击和重启恢复叠加时的卡顿
- 本地标准 Docker 运行态默认会预装本地 ASR Python 重依赖；若旧环境曾关闭该能力，可再通过 `INSTALL_LOCAL_ASR_BUILD=1` 重建 `db-init/server` 恢复视频文案提取
- 小红书 / 抖音收集数据中的“评论数据”卡片现已补齐“从评论提取账号链接”动作，可直接把作品链接补拉为评论数据，再按关键词筛出评论用户并沉淀为目标用户账号链接结果，供 OpenClaw 与人工验证共用
- `品牌增长策略 -> 收集数据` 当前已把站内已落地的主要采集动作同步开放给 OpenClaw / MCP：
  - 小红书：评论数据同步、二级评论读取
  - 抖音：品牌作品、竞品作品、达人结果池沉淀、品牌/竞品账号删除、关键词推荐删除
  - 公众号：品牌账号删除、正文读取、对标统计刷新、搜一搜正文与统计刷新
  - 每日热点：指定日期工作区读取、按平台刷新
- 抖音收集数据当前新增达人抓取第一期：
  - `达人搜索抓取`：按关键词、行业和商业指标抓达人基础资料
  - `达人深度抓取`：按达人标识创建后台异步深抓任务
  - `达人结果池`：回显达人画像、热词、推荐视频和主页视频摘要
- 达人深抓结果当前继续复用 `collectors/douyin` workspace 聚合，不单开第二套数据页
- OpenClaw / MCP / Skill 当前已同步暴露：
  - `get_douyin_collection_workspace`
  - `search_douyin_creators`
  - `create_douyin_creator_deep_fetch_tasks`
- 参考变更：`docs/changes/2026-08-15-brand-growth-comment-target-user-openclaw-chain.md`
- 参考变更：`docs/changes/2026-08-25-brand-growth-ip-library.md`
- 参考变更：`docs/changes/2026-08-27-ip-voice-material-preview-openclaw-git-skill.md`
- 参考变更：`docs/changes/2026-08-27-douyin-collection-preview-and-transcript-retry-ux.md`
- 参考变更：`docs/changes/2026-09-21-douyin-transcript-queue-and-startup-resume-fix.md`
- 参考变更：`docs/changes/2026-09-09-douyin-creator-collection-workbench-phase-1.md`
- 参考变更：`docs/changes/2026-09-15-openclaw-brand-growth-collection-tooling-completion.md`

### 4.2 内容获客工作台 `/xiaohongshu`

包含：

- 某书
  - 营销策划方案
    - 当前已切到 OpenClaw HTML 营销策划方案列表，支持点击查看 HTML、打开 HTML 和详情留言
  - 营销日历
    - 复用品牌增长报告下的同一份营销日历真源，只展示小红书相关选题，并支持 OpenClaw 与用户共同创建、编辑
  - 创作素材
  - 每日计划
  - 每周复盘
  - 策略优化记录
  - 作品列表
- 某音/某号
  - 营销策划方案
    - 当前已切到 OpenClaw HTML 营销策划方案列表，支持点击查看 HTML、打开 HTML 和详情留言
  - 营销日历
    - 复用品牌增长报告下的同一份营销日历真源，只展示抖音相关选题，并支持 OpenClaw 与用户共同创建、编辑
  - 数字人
  - RunningHub应用
  - 创作素材
  - 每日计划
  - 每周复盘
  - 策略优化记录
  - 作品列表
- 公众号
  - 营销策划方案
    - 当前为独立左侧菜单，位于 `配置初始化` 上方，承接 OpenClaw 上传的 HTML 营销策划方案并支持留言协作
  - 营销日历
    - 当前为独立左侧菜单，位于 `营销策划方案` 下方，复用品牌增长报告下的同一份营销日历真源，只展示公众号相关选题，并支持 OpenClaw 与用户共同创建、编辑
  - 配置初始化
    - 当前支持同一品牌维护多个公众号账号；每个账号可独立配置账号名、AppID、AppSecret、IP 白名单，并可切换默认公众号
  - 创作工作流
    - 当前创建与编辑工作流时都可显式选择公众号账号；选中的账号会写入工作流主记录，并决定后续发布确认和正式发布所走的公众号凭证
  - 发布历史
    - 当前每条发布历史卡片都会标注所属公众号账号，方便区分同品牌下不同公众号的发稿记录
  - 创作素材
  - 每日计划
  - 每周复盘
  - 策略优化记录
  - 作品列表

当前特点：

- `/xiaohongshu` 已改为统一聚合壳层 `ContentAcquisitionWorkspace`
- 外层导航只负责一级 / 二级切换，内层继续复用 `XiaohongshuWorkspaceShell`、`DouyinWorkspaceShell`、`WechatWorkspaceShell`
- 某书和公众号已补齐 OpenClaw 的创作素材、作品列表板块
- OpenClaw 的创作素材、每日计划、每周复盘、策略优化记录、作品列表现在都支持在内容详情下留言；其中每周复盘和策略优化记录都支持在查看弹窗里直接编辑并保存
- 三个子板块下的 `营销策划方案` 当前已统一收口为 `OpenClawMarketingPlan` 真源：
  - 字段固定为 `标题 / HTML 内容 / 创建时间`
  - 页面支持 `查看 HTML / 打开 HTML / 留言 / 删除`
- 三个子板块下当前新增独立 `营销日历` 入口：
  - 某书只展示小红书字段
  - 某音/某号只展示抖音字段
  - 公众号只展示公众号字段
  - 三端都继续写回品牌增长报告下的同一份营销日历真源，不新增第二套日历存储
- 公众号 `配置初始化 / 创作工作流 / 发布历史` 当前已经打通多公众号闭环：
  - 配置初始化可新增、编辑、删除和切换默认公众号
  - 工作流会记录 `accountId / accountName`，发布确认和正式发布按所选公众号取凭证
  - 发布历史列表与详情都会回显公众号名称
- 所有 OpenClaw 列表与留言列表统一按每页 20 条自动分页
- 参考变更：`docs/changes/2026-08-30-openclaw-weekly-review-and-version-history-fix.md`
- 参考变更：`docs/changes/2026-08-30-openclaw-strategy-optimization-records.md`
- 参考变更：`docs/changes/2026-09-04-openclaw-marketing-plan-html-workspace.md`
- 参考变更：`docs/changes/2026-09-04-content-acquisition-marketing-calendar-platform-views.md`
- 参考变更：`docs/changes/2026-09-04-wechat-multi-official-account-workflow-routing.md`
- 三个子板块下的 `创作素材` 现已统一补齐：
  - 标题
  - 素材标签
  - 素材来源
  - 入库时间
  - 存储位置（本地文件夹地址）
- `创作素材` 当前统一按 `OpenClawCreativeMaterial` 真源回显，并由后端直接返回 `materialTags / materialCategory / sourceLabel / storageKey / localFilePath`
- 兼容直达入口 `/douyin`、`/wechat` 仍保留，但不再出现在顶栏主导航
- 参考变更：`docs/changes/2026-08-11-content-acquisition-workbench-and-local-storage.md`
- 参考变更：`docs/changes/2026-08-12-material-management-and-content-acquisition-materials.md`

### 4.3 抖音工作台 `/douyin`

包含：

- 营销策划方案
- 热点找选题
- 选题库
  - 新增 `匹配爆款模板` 字段，支持沉淀多个爆款拆解 HTML
  - 参考变更：`docs/changes/2026-09-21-openclaw-explosive-analysis-and-topic-template-linking.md`
- 爆款拆解
  - 位于 `营销日历` 下、`选题库` 上
  - 由 OpenClaw 创建独立 HTML 拆解记录，支持查看、删除、留言
  - 列表字段：标题、标签、作者、作品链接、视频文案、创建时间
  - 参考变更：`docs/changes/2026-09-21-openclaw-explosive-analysis-and-topic-template-linking.md`
- 原创文案
- 二创文案
- 复刻短视频
- AI 生视频（故事板）
- AI 生视频（直接视频）
- 数字人
- 广告预审
- 发布工作流

当前特点：

- 多板块已独立分区
- 采集结果统一沉淀到品牌增长策略 → 品牌增长报告 → 素材库
- 创作侧素材选择已统一切到品牌增长策略 → 品牌增长报告 → 素材库
- 视频与数字人能力已经接入
- RunningHub 工作区继续复用通用应用清单；当前已扩充 MiniMax H3、Seedance、Qwen 字体设计、数字人、电商设计，以及音频裁剪驱动数字人、2K 多图生视频等多类应用示例，并同步暴露给 OpenClaw / MCP 的 `runninghub:list_apps`
- RunningHub 应用详情表单当前会按模板自动识别枚举型字段：如果 `fieldData` 带选项列表，而 `fieldValue` 是数字索引（例如“设置比例”），页面会按真实选项标签渲染下拉选择，但提交时仍保留模板原始值，避免把索引误当成纯数字输入框
- RunningHub 上传节点当前新增对象型入参拦截：图片 / 音频 / 视频节点必须走顶层 `localFilePath` 或 `upload.*`，不能再把 `{ localFilePath: ... }`、`{ fileName, contentType, dataBase64 }` 这类对象直接塞进 `fieldValue / fieldData`，避免最终被串成 `[object Object]`
- 复刻短视频已拆成独立板块，创建后先按每 15 秒一段输出拉片分析、角色卡、分镜脚本、角色图、分镜图和一致性质检结果
- 复刻短视频支持第二阶段一键生成分段视频，并通过 `ffmpeg` 自动拼接完整视频
- 广告预审已接入火山引擎 VOD 广告预审链路，支持品牌级默认配置
- 广告预审可直接读取作品中心内的站内视频或带 `videoUrl` 的 HTML 作品，并通过 VOD `UploadMediaByUrl` 回填 `Vid / FileId`
- 发布与视频号桥接能力位于同一工作台体系
- 参考变更：`docs/changes/2026-08-07-douyin-runninghub-minimax-h3-fl2va-app-sync.md`
- 参考变更：`docs/changes/2026-08-17-content-acquisition-runninghub-app-expansion.md`
- 参考变更：`docs/changes/2026-08-31-douyin-runninghub-app-sync-2.md`
- 参考变更：`docs/changes/2026-08-28-runninghub-media-node-object-field-guard.md`
- 当前主入口已并入 `/xiaohongshu` 的内容获客壳层

### 4.4 公众号工作台 `/wechat`

包含：

- 账号配置
- 原创创作工作流（Step 2 文章 / Step 3 生图 / Step 4 HTML / Step 5 发布确认与正式发布）
- HTML 排版生成（4 种排版风格：通用排版 / 极简排版 / 空间艺术排版 / 通知类排版）
- 一键发布
- OpenClaw / WorkBuddy 可通过 `manage_wechat_workflow` 直接写入或推进同一条工作流
- `manage_wechat_workflow` 当前支持在创建或更新公众号工作流时传入目标公众号账号，发布历史也会回显对应账号名
- 当前底层已经按 3 层 service 收口：
  - `WechatWorkflowCanonicalService`
  - `WechatWorkflowHtmlRendererService`
  - `WechatWorkflowPublishService`
- 当前主入口已并入 `/xiaohongshu` 的内容获客壳层

### 4.5 设计工作台 `/more-features/design`

包含：

- OpenClaw 自由生图结果回看

当前特点：

- 用户侧当前不再提供手动创建设计任务入口，也不再暴露 `运营提示词中心`、`生图提示词中心`
- `/more-features/operations-prompt-center` 与 `/more-features/image-prompt-center` 当前都会重定向回 `/more-features/design`
- OpenClaw `create_design_work` 在图片模块下默认走自由生图：
  - 不自动套社媒配图模板
  - 不默认植入品牌资料
  - 不强制生成中文排版文案
- OpenClaw `create_design_work` 当前除 `referenceImageUrl` / 直接上传外，也支持 `referenceMaterialId`，可直接复用站内创作素材作为参考图
- 图片模块提供参考图时默认 `referenceImageMode=edit_reference`，参考图会发送给生图模型；明确要求忽略参考图、只按文字生成时可传 `prompt_only`
- 参考变更：`docs/changes/2026-08-21-openclaw-design-work-reference-material-id.md`
- 参考变更：`docs/changes/2026-09-04-openclaw-free-image-design-workspace.md`
- 参考变更：`docs/changes/2026-09-25-openclaw-reference-forwarding-and-prompt-diagnostics.md`

### 4.5A GEO获客工作台 `/geo`

包含：

- GEO可见度诊断
- 关键词挖掘
- 网站诊断
- 知识库搭建
- GEO优化方案
- 自媒体内容
- 第三方媒体
- 品牌网站

当前特点：

- `GEO可见度诊断` 继续复用既有 `OpenClawGeoVisibilityReport` 真源，只承接 HTML 报告查看与删除
- 其它 7 个 GEO 板块统一收口到 `OpenClawGeoContent` 真源
- 一次性内容板块：
  - 关键词挖掘
  - 网站诊断
  - 知识库搭建
  - GEO优化方案
- 多次生成内容板块：
  - 自媒体内容
  - 第三方媒体
  - 品牌网站
- 新板块统一支持：
  - HTML 站内预览
  - 非 HTML 附件受控副本
  - `存储地址` 展示
- `第三方媒体` 当前在原文章列表下方继续补了 `第三方媒体投放`：
  - 后端会把每次从软文街读取到的媒体列表按品牌持续缓存到站内资源库，不再每次重新从零刷新
  - 页面默认读取站内已缓存媒体，并固定按每页 20 条分页
  - `刷新媒体` 会继续同步软文街下一页到缓存库，而不是覆盖旧结果
  - 支持按媒体名称、平台、分类、地区搜索当前品牌已缓存媒体
  - 每行支持 `立即投放`
  - 投放时直接从当前品牌已保存的 `third_party_media` HTML 文章里选择并提交订单
- 非 HTML 附件当前通过受控副本落到 `reports/<brandId>/openclaw/geo/...`，在 `local-single-user` 安装态下会映射为本地文件夹地址
- OpenClaw / MCP / Skill 当前已同步暴露：
  - `get_openclaw_geo_contents`
  - `create_openclaw_geo_content`
  - `delete_openclaw_geo_content`
  - `get_openclaw_third_party_media_delivery_resources`
  - `sync_openclaw_third_party_media_delivery_resources`
- 参考变更：`docs/changes/2026-08-12-geo-openclaw-content-workspace-expansion.md`
- 参考变更：`docs/changes/2026-08-16-geo-third-party-media-delivery-and-ruanwenjie-integration.md`
- 参考变更：`docs/changes/2026-09-01-ruanwenjie-media-delivery-cache-and-search.md`

### 4.5B 全网获客工作台 `/all-network-growth`

包含：

- 评论获客
- 平台获客

当前特点：

- 左侧目录当前包含 `评论获客` 与 `平台获客` 两个子板块，继续共用同一工作台
- 评论获客列表统一由 `OpenClawCommentLead` 真源承接，字段固定为：
  - 用户名
  - 用户评论
  - 入选理由
  - 用户主页
  - 入选时间
  - 来源平台（小红书 / 抖音）
- 平台获客列表统一由 `OpenClawPlatformLead` 真源承接，字段固定为：
  - 名称
  - 业务范围
  - 入选理由
  - 联系方式
  - 地址
  - 入选时间
- 评论获客页面已去掉站内生成表单，只保留列表与分页查看；列表每页固定 20 条
- 页面支持由 OpenClaw 直接从品牌增长策略中“小红书 / 抖音评论用户结果”生成评论获客名单
- 页面支持由 OpenClaw 直接写入平台获客名单
- 支持：
  - 评论获客按平台筛选列表
  - 评论获客按每页 20 条分页查看
  - 删除单条评论获客记录
  - 平台获客按每页 20 条分页查看
  - 删除单条平台获客记录
- OpenClaw / MCP / Skill 当前已同步暴露：
  - `get_openclaw_comment_leads`
  - `create_openclaw_comment_leads`
  - `delete_openclaw_comment_lead`
  - `get_openclaw_platform_leads`
  - `create_openclaw_platform_leads`
  - `delete_openclaw_platform_lead`
- 评论获客与平台获客真源默认都写入 `all_network_growth` workspace scope，避免继续散落在其它工作台或采集结果里仅做临时验证
- 参考变更：`docs/changes/2026-08-15-all-network-growth-comment-leads.md`
- 参考变更：`docs/changes/2026-08-18-all-network-growth-platform-leads-and-comment-pagination.md`

### 4.5C 投流获客工作台 `/paid-acquisition`

包含：

- 腾讯投流获客

当前特点：

- 顶栏当前在 `全网获客` 后面新增独立一级入口 `投流获客`
- 左侧目录当前只收口 `腾讯投流获客`
- 腾讯投流获客列表统一由 `OpenClawTencentAdLead` 真源承接，字段固定为：
  - 标题
  - 内容
  - 创建时间
  - 留言
- 页面支持：
  - 按每页 20 条分页查看
  - 查看单条内容详情
  - 在详情下留言协作
  - 删除单条腾讯投流获客记录
- OpenClaw / MCP / Skill 当前已同步暴露：
  - `get_openclaw_tencent_ad_leads`
  - `create_openclaw_tencent_ad_lead`
  - `delete_openclaw_tencent_ad_lead`
- 腾讯投流获客真源默认写入 `paid_acquisition` workspace scope，避免混入品牌增长或全网获客的既有内容型记录
- 参考变更：`docs/changes/2026-09-04-paid-acquisition-tencent-ad-lead-workspace.md`

### 4.5D 达人合作工作台 `/creator-cooperation`

包含：

- 达人匹配
- 达人跟踪

当前特点：

- 顶栏当前在 `投流获客` 右侧新增独立一级入口 `达人合作`
- 左侧目录当前收口两个子板块：
  - `达人匹配`
  - `达人跟踪`
- 达人匹配列表统一由 `OpenClawCreatorCooperationMatch` 真源承接，数据来源是抖音达人结果池快照，除达人基础字段外补充：
  - 推荐理由
  - 是否加入合作清单
- 达人跟踪列表统一由 `OpenClawCreatorCooperationTracking` 真源承接，按达人维度建档，除达人基础字段外补充：
  - 合作作品数量
- 达人跟踪详情里的合作作品列表统一由 `OpenClawCreatorCooperationWork` 真源承接，字段固定为：
  - 标题
  - 链接
  - 播放数
  - 点赞数
  - 收藏数
  - 评论数
  - 转发数
  - 结果评估
  - 再次选择
  - X 天自动更新频率
- 页面支持：
  - 在达人匹配里批量勾选达人
  - 批量删除达人匹配记录
  - 批量把达人加入达人跟踪
  - 在达人跟踪里按达人查看合作作品详情
  - 在达人详情弹窗里新增合作作品、编辑结果评估 / 再次选择 / 更新周期、手动刷新或删除作品
- 合作作品数据按 `X` 天频率自动刷新；当前通过每日调度扫描到期作品并重新抓取抖音作品快照
- OpenClaw / MCP / Skill 当前已同步暴露：
  - `get_openclaw_creator_match_workspace`
  - `create_openclaw_creator_matches`
  - `delete_openclaw_creator_matches`
  - `move_openclaw_creator_matches_to_tracking`
  - `get_openclaw_creator_tracking_workspace`
  - `create_openclaw_creator_tracking_records`
  - `delete_openclaw_creator_tracking_record`
  - `get_openclaw_creator_tracking_works`
  - `create_openclaw_creator_tracking_work`
  - `update_openclaw_creator_tracking_work`
  - `delete_openclaw_creator_tracking_work`
- 达人合作三张真源表统一写入 `creator_cooperation` workspace scope，避免与投流获客或品牌增长抖音采集快照混用
- 参考变更：`docs/changes/2026-09-10-paid-acquisition-creator-cooperation-workspace.md`

### 4.6 个人中心 `/personal-center`

子页面包括：

- `/personal-center`
  - 概览
- `/personal-center/tasks`
  - 任务中心
- `/personal-center/orders`
  - 素材管理
- `/personal-center/works`
  - 作品中心
- `/personal-center/skills`
  - 技能中心
- `/personal-center/third-party-platforms`
  - 第三方接口配置
- `/personal-center/openclaw`
  - OpenClaw 安装中心
  - 当前提供品牌令牌、OpenClaw / WorkBuddy / Cursor / Claude Desktop / Codex 的 MCP 安装片段，以及 Skill ZIP / Git 安装说明与正式交付检查清单
  - 参考变更：`docs/changes/2026-09-07-openclaw-codex-mcp-installation.md`
  - 参考变更：`docs/changes/2026-09-07-openchatcut-removal.md`
- `/personal-center/version`
  - 版本与升级
- `/personal-center/security`
  - 安全设置；`local-single-user` 安装态还会在这里展示注册准入规则和本地资料目录设置
- `/personal-center/team`
  - 团队协作
- `/personal-center/invites`
  - 邀请通知

当前补充说明：

- 个人中心已新增独立“版本与升级”页，不再要求用户每次手工下载后再判断如何覆盖安装
- `local-single-user` 安装态下，`版本与升级` 继续承接 OSS `latest.json` 检查、安装包下载校验和一键升级
- Docker + PostgreSQL 标准运行态下，个人中心当前也会显示 `版本与升级`：
  - 未配置 `STANDARD_RUNTIME_UPDATE_MANIFEST_URL` 时，页面至少展示仓库内最近 `docs/changes/*.md` 版本记录、可自动识别当前部署分支的通用 Docker 更新命令，以及 Skill/MCP 同步提醒
  - 已配置 `STANDARD_RUNTIME_UPDATE_MANIFEST_URL` 时，再额外展示远端更新清单、是否有新版本、建议命令以及是否需重新导入 `skill-package.zip`
- 个人中心概览卡片与二级导航现在会根据 `system/update/status` 前置显示版本提醒，提示当前是“有新版本 / 升级中 / 需处理 / 已同步”，避免用户必须先点进版本页才知道是否需要更新
- 标准运行态没有远端清单时，页面会退回“仓库更新指引”模式，不再出现空白版本页
- 后端通过 `system/update/*` 统一检查 OSS `latest.json`、识别 `AiOmniOps-local-single-user-win-x64.zip` 与 `.sha256`
- 当前源码运行态允许查看最新发布信息，但会明确提示“不是安装态发布包，暂不支持一键升级”
- 当前安装态会把升级包先落到 `LOCAL_APP_DATA_ROOT/updates`，完成 SHA256 校验后再由独立 updater 停机、替换安装目录、重启本地工作台，并在 API / Web 都通过验活后才标记升级成功；apply-run 阶段执行的 updater 现在会优先从刚下载的目标发布包里提取，而不是继续复用当前安装版本自带脚本；若新版本起不来，updater 会自动回滚到安装前 backup 并恢复上一版本；为避免磁盘空间被历史垃圾目录耗尽，updater 会在安装前先预清理历史遗留的 `downloads/*`、`extract-*`、旧 `apply-runs/*` 临时目录，并在成功后再复清一次，同时回收安装目录旁遗留的 `AiOmniOps-backup-*` 备份目录；安装器日志已统一回到 `LOCAL_APP_DATA_ROOT/logs`，历史遗留的 `%LOCALAPPDATA%\AiOmniOps` 安装/升级痕迹也会一起回收，避免长期占满 C 盘
- Docker 标准运行态当前约定的更新闭环是：
  - 未配远端清单时：用户端仍可先在 `版本与升级` 页面查看最近版本记录，以及“自动识别部署分支 -> `git checkout` -> `git pull --ff-only` -> `docker compose up -d --build --force-recreate server web`，必要时再补 `db-init`”的通用 PowerShell 指令
  - 发布端如果同步更新远端 JSON 清单，用户端还会在 `版本与升级` 页面进一步看到“有新版本”提醒
  - 更新后按页面给出的 Skill / MCP 同步说明完成收口
- 标准运行态的 `版本与升级` 页面当前还会固定展示：
  - 安装前需要的软件与依赖（Git、WSL 2、Docker Desktop）
  - 下载项目代码、复制 `.env`、执行 `docker compose ... up -d --build --force-recreate db-init server web` 的完整安装命令
  - 标准运行态更新命令与 Skill / MCP 同步提醒
- 参考变更：`docs/changes/2026-08-30-openclaw-weekly-review-and-version-history-fix.md`
- 参考变更：`docs/changes/2026-08-22-docker-standard-version-update-guide-page.md`
- 参考变更：`docs/changes/2026-08-22-personal-center-version-update-reminder.md`
- 参考变更：`docs/changes/2026-08-28-version-workspace-install-guide-and-readme-refresh.md`
- 参考变更：`docs/changes/2026-09-04-version-workspace-upstream-branch-update-guide-fix.md`
- 参考变更：`docs/changes/2026-09-17-standard-runtime-install-guide-and-openclaw-install-sync.md`
- 安装、升级、自启与修复脚本当前统一以 `runtime/local-single-user-runtime.json` 里的 `browserUrl / previewUrl / apiHealthUrl` 作为页面入口与验活真值，不再把 `127.0.0.1:3001` 当成固定页面地址
- `local-single-user` 安装态访问 `/` 时，前端会直接重定向到 `/brand-growth`；安装态不再把官网营销首页作为默认落地页，避免独立发布包里根路由因为首页模板读取失败而直接掉进 `/error`
- `start-local-single-user.cmd` 现在按“健康实例复用 + 启动加锁”工作：如果当前本地工作台已经可用，重复双击只会复用现有实例；如果首次启动仍在拉起中，后续重复启动会等待当前启动完成，而不是并发重建运行时目录
- 当前网站版、源码运行态和 `local-single-user` 安装态统一都要求邀请码注册；注册规则由后端配置接口返回，前端只按接口展示
- 后台用户管理现在可直接维护账号使用期限与模块权限，后端鉴权层会统一拦截“账号到期”和“当前模块无权限”两类访问
- 原 `/personal-center/orders` 已改为 `素材管理`：左侧按 `文本 / 图片 / 语音 / 视频` 四类聚合展示网站上传素材与 OpenClaw 入库素材
- 素材管理页列表当前只保留紧凑字段：
  - 标题
  - 素材标签
  - 素材来源
  - 入库时间
  - 存储位置（本地文件夹地址）
- 素材管理页当前为 `文本 / 图片 / 语音 / 视频` 四类素材统一提供 `查看` 按钮：
  - 文本：站内文本预览
  - 图片：站内图片预览
  - 语音：站内音频播放器预览
  - 视频：站内视频播放器预览
- `/personal-center/skills` 当前收口为双栏工作台：
  - 左侧按技能 `category` 做可展开 / 收缩分组导航
  - 右侧技能详情与提示词编辑区限制在固定内容框内滚动，不再把整页持续向下撑长
- `/personal-center/third-party-platforms` 当前继续保留统一配置页，但支持平台专属字段：
  - 软文街平台会额外展示 `API Key / 登录账号 / 登录密码`
- 其它平台仍保持原来的品牌共享单字段配置
- 参考变更：`docs/changes/2026-08-16-personal-center-skill-center-grouped-nav-and-shell.md`
- 参考变更：`docs/changes/2026-08-16-geo-third-party-media-delivery-and-ruanwenjie-integration.md`
- 参考变更：`docs/changes/2026-09-03-ruanwenjie-credential-refresh-and-timestamp-fix.md`
  - 存储位置（本地文件夹地址）
- `local-single-user` 安装态下，素材管理页顶部新增“素材库存储设置”：
  - 用户选择的是【素材库】外层根目录
  - 页面顶部当前只保留目录输入框、`选择文件夹`、`恢复默认目录`、`保存本地存储设置`
  - 系统会自动创建 `素材库/文本`、`素材库/图片`、`素材库/语音`、`素材库/视频`
  - 同一目录下还会统一承接 `GEO`、报告、附件、作品副本等其它本地受控内容
  - 网站上传素材会按 `素材库/<分类>/<brandId>/<YYYY>/<YYYY-MM>/<timestamp>-<title>.<ext>` 规则落盘
  - 其它非素材库类受控副本会按 `站内存储/<storageKey>` 规则落盘
  - OpenClaw 上传到网站的素材不强制进入 `素材库`，但仍会统一进入素材管理四分类列表
- `local-single-user` 下如果品牌资料库 / 产品资料库对应的 SQLite 暂时不可用，后端不再回退到临时 mock 数据，避免出现“页面看起来保存成功、重启后消失”的假持久化
- `/personal-center/security` 现在会显示当前资料目录、下次启动将使用的资料目录、`launcher-settings.json` 路径，以及数据库 / 存储 / 日志等本地子目录；保存后需重启本地工作台生效
- 参考变更：`docs/changes/2026-07-28-personal-center-version-update.md`
- 参考变更：`docs/changes/2026-08-10-local-register-invite-and-user-access-control.md`
- 参考变更：`docs/changes/2026-08-12-material-management-and-content-acquisition-materials.md`
- 参考变更：`docs/changes/2026-08-15-local-material-library-and-openclaw-material-sync.md`
- 参考变更：`docs/changes/2026-08-04-local-single-user-update-health-check-and-auto-rollback.md`
- 参考变更：`docs/changes/2026-08-07-local-single-user-install-backup-auto-cleanup.md`
- 参考变更：`docs/changes/2026-08-07-local-single-user-update-artifact-auto-cleanup.md`
- 参考变更：`docs/changes/2026-08-07-local-single-user-dual-appdata-cleanup-fix.md`
- 参考变更：`docs/changes/2026-08-07-local-single-user-historical-update-artifacts-cleanup-fix.md`
- 参考变更：`docs/changes/2026-08-08-local-single-user-updater-preflight-cleanup-fix.md`
- 参考变更：`docs/changes/2026-08-08-local-single-user-apply-run-updater-source-fix.md`
- 参考变更：`docs/changes/2026-08-19-local-single-user-runtime-browser-url-port-fallback-fix.md`
- 参考变更：`docs/changes/2026-08-21-local-single-user-root-route-redirect-fix.md`
- 参考变更：`docs/changes/2026-08-04-local-single-user-repeated-start-reuse-and-lock.md`
- 参考变更：`docs/changes/2026-08-06-local-single-user-upgrade-runtime-verification-tightening.md`

### 4.7 后台管理台 `/admin`

当前后台已包含的主栏目：

- 用户管理
- 接口供应商
- 计费规则
- 技能中心
- 模块注册中心
- 能力包总览
- 能力包与模块绑定
- 能力包与知识库绑定
- 能力包与技能绑定
- 知识库管理
- 模型用量

当前补充说明：

- 用户管理已扩展账号使用期限与模块权限配置，支持直接在后台按用户收口到期时间和主模块可用范围
- 上述限制不只是前端隐藏，后端鉴权层会结合登录态、请求路径与账号配置做统一拦截

## 5. 前端服务层

主要 service 文件：

- `services/auth.ts`
- `services/auth-session.ts`
- `services/brand-growth.ts`
- `services/collectors.ts`
- `services/daily-hotspots.ts`
- `services/reports.ts`
- `services/works.ts`
- `services/publishing.ts`
- `services/design.ts`
- `services/personal-center.ts`
- `services/openclaw.ts`
- `services/admin.ts`

规则：

- service 只做请求层
- 页面或工作区壳层负责业务编排
- 当前品牌、权限和 Provider 选择必须由后端结果校正

## 6. 后端模块地图

### 6.1 核心业务模块

- `auth`
- `brands`
- `collectors`
- `reports`
- `works`
- `tasks`
- `publishing`
- `media`
- `orders`
- `local-runtime`
  - `local-single-user` 安装态资料目录设置、注册准入信息与 launcher 配置读写入口
- `system-update`
  - OSS `latest.json` 检查、本地升级包下载校验、独立 updater 启动入口
- `third-party-platforms`
- `user-skills`
- `openclaw`
  - 安装中心、MCP 目录、龙虾日记
- `feedback`
- `scheduler`

### 6.2 后台治理模块

- `admin/api-providers`
- `admin/billing-rules`
- `admin/knowledge-bases`
- `admin/model-usage`
- `admin/module-definitions`
- `admin/skill-packages`
- `admin/skill-package-modules`
- `admin/skill-package-knowledge-spaces`
- `admin/skill-package-skills`
- `admin/skills-prompts`
- `admin/users-admin`

## 7. 当前主链路

### 7.1 品牌增长主链路

1. 登录并进入品牌工作区
2. 维护品牌资料与企业知识库
3. 收集小红书 / 抖音 / 热点数据
4. 生成品牌增长报告 / 半年营销规划 / 营销日历
5. 将结果继续送往小红书、抖音、公众号、设计工作台
6. 在个人中心查看任务、素材管理、作品

### 7.2 OpenClaw 链路

1. 在个人中心 OpenClaw 页面生成正式安装令牌
2. 使用 MCP 地址完成客户端接入
3. Skill 安装支持两种方式二选一：
   - 复制 GitHub Skill 目录链接和一句安装指令，直接发给 OpenClaw 自行安装
   - 下载 Skill ZIP 后手动导入客户端
4. 通过受控 API / MCP 读取当前品牌上下文与能力
5. 在用户权限范围内触发查询、生成和执行动作

## 8. 当前关键技术边界

- 官网首页与登录页已分离
- 前后台技能、Provider、知识绑定逐步收口到治理后台
- 长耗时生成任务统一走任务中心
- 正式资源以 OSS 为真源，本地仅允许受控回退
- `docs/project_planning/` 不代表当前实现

## 9. 相关文档

- `docs/site-map-mermaid.md`
- `docs/engineering-standards.md`
- `docs/database-archive.md`
- `docs/generated-content-storage-standards.md`
- `docs/openclaw/README.md`
- `docs/changes/2026-06-13-docs-baseline-cleanup.md`
