# AI全域运营系统 Mermaid 结构图

## 1. 文档定位

本文件是 `docs/site-map.md` 的可视化补充，只保留当前系统真实在用的结构关系。

## 2. 全站总图

```mermaid
flowchart TD
    A["AI全域运营系统"]

    A --> B["apps/web 前端站点"]
    A --> C["apps/server 后端 API"]
    A --> D["packages/* 共享能力"]
    A --> E["docs 当前文档体系"]
    A --> F["local-single-user 交付链"]

    B --> B1["官网首页 /"]
    B --> B2["认证页 /login /register /admin/login"]
    B --> B3["品牌增长 /brand-growth"]
    B --> B4["内容获客 /xiaohongshu"]
    B --> B5["抖音兼容直达 /douyin"]
    B --> B6["公众号兼容直达 /wechat"]
    B --> B7["GEO获客 /geo"]
    B --> B8["全网获客 /all-network-growth"]
    B --> B9["投流获客 /paid-acquisition"]
    B --> B9A["达人合作 /creator-cooperation"]
    B --> B10["设计工作台 /more-features/design"]
    B --> B11["个人中心 /personal-center"]
    B --> B12["后台 /admin"]
    B --> B13["帮助页 /help/*"]

    C --> C1["Auth"]
    C --> C2["Brands"]
    C --> C3["Collectors"]
    C --> C4["Reports"]
    C --> C5["Works"]
    C --> C6["Tasks"]
    C --> C7["Publishing"]
    C --> C8["Media"]
    C --> C9["Orders"]
    C --> C10["ThirdPartyPlatforms"]
    C --> C11["UserSkills"]
    C --> C12["OpenClaw"]
    C --> C13["Feedback"]
    C --> C14["Scheduler"]
    C --> C15["Admin 模块组"]

    D --> D1["packages/config"]
    D --> D2["packages/prompt-runtime"]
    D --> D3["packages/shared"]
    D --> D4["packages/ui"]

    E --> E1["site-map.md"]
    E --> E2["site-map-mermaid.md"]
    E --> E3["engineering-standards.md"]
    E --> E4["changes/*.md"]
    E --> E5["project_planning/ 历史草案"]

    F --> F1["runtime env"]
    F --> F2["schema.local.prisma generate"]
    F --> F3["sqlite db init"]
    F --> F4["launcher"]
    F4 --> F47["健康实例复用 + 启动锁"]
    F --> F5["Windows autostart helper"]
    F --> F6["release bundle builder"]
    F --> F7["release package builder"]
    F --> F8["independent updater"]
    F4 --> F41["server build"]
    F4 --> F42["web standalone build"]
    F4 --> F43["runtime-isolated web bundle staging"]
    F43 --> F431["static/public sync in runtime bundle"]
    F4 --> F44["runtime metadata"]
    F4 --> F45["api + worker + web 进程拆分"]
    F45 --> F46["worker 独占后台守护/重任务提交"]
    F5 --> F51["install/remove/status scheduled task"]
    F6 --> F61[".release/local-single-user-win-x64"]
    F6 --> F62["bundled node.exe + npm + start/install cmd"]
    F7 --> F71["AiOmniOps-local-single-user-win-x64.zip"]
    F7 --> F72["zip sha256 checksum"]
```

## 3. 前端路由图

```mermaid
flowchart LR
    Root["apps/web/src/app"]

    Root --> Home["/"]
    Root --> Auth["(auth)"]
    Root --> Dash["(dashboard)"]
    Root --> Help["/help/*"]
    Root --> Publish["/publish/mobile/[token]"]

    Auth --> Login["/login"]
    Auth --> Register["/register"]
    Auth --> AdminLogin["/admin/login"]

    Dash --> BrandGrowth["/brand-growth"]
    Dash --> Xiaohongshu["/xiaohongshu"]
    Dash --> Douyin["/douyin"]
    Dash --> Wechat["/wechat"]
    Dash --> Geo["/geo"]
    Dash --> AllNetworkGrowth["/all-network-growth"]
    Dash --> PaidAcquisition["/paid-acquisition"]
    Dash --> CreatorCooperation["/creator-cooperation"]
    Dash --> Design["/more-features/design"]
    Dash --> Personal["/personal-center"]
    Personal --> PersonalVersion["/personal-center/version"]
    Personal --> PersonalSecurity["/personal-center/security"]
    Dash --> Admin["/admin"]
    Dash --> Membership["/membership-purchase"]
    Dash --> Points["/points-purchase"]
    Dash --> OrderDetail["/orders/[id]"]
```

## 4. 业务工作台关系图

```mermaid
flowchart TD
    A["品牌增长策略"]
    B["内容获客工作台"]
    C["抖音工作台兼容直达"]
    D["公众号工作台兼容直达"]
    E["GEO获客工作台"]
    F["全网获客工作台"]
    G["设计工作台"]
    H["个人中心"]
    H --> H1["版本与升级（local-single-user 自动升级 / standard 更新引导）"]
    H --> H19["概览卡片 + 二级导航前置显示版本提醒（有新版本 / 升级中 / 需处理 / 已同步）"]
    H1 --> H11["检查 OSS latest.json 最新发布"]
    H1 --> H12["预下载 zip + sha256 校验"]
    H1 --> H13["触发独立 updater 替换安装目录"]
    H1 --> H14["新版本重启后继续等待 API / Web 验活"]
    H1 --> H15["验活失败自动回滚安装前 backup"]
    H1 --> H16["apply-run 从目标发布包提取最新 updater；updater 安装前预清理并在成功后复清历史 downloads/* / extract-* / 旧 apply-runs/* / AiOmniOps-backup-* / 历史 %LOCALAPPDATA%\\AiOmniOps 痕迹"]
    H1 --> H17["安装 / 升级 / 自启 / 修复脚本统一读取 runtime metadata 的 browserUrl / previewUrl 做入口与验活"]
    H1 --> H18["standard 运行态默认展示仓库版本记录 + 安装前软件依赖 + `db-init server web` 首装命令 + 自动识别部署分支的 Docker 更新命令与 Skill/MCP 同步提醒；配置 STANDARD_RUNTIME_UPDATE_MANIFEST_URL 后再叠加远端更新清单与新版本提醒"]
    H --> H3["重复双击 start-local-single-user.cmd"]
    H3 --> H31["已健康运行时直接复用现有实例"]
    H3 --> H32["首次启动未完成时等待当前启动锁释放"]
    H --> H2["安全设置"]
    H2 --> H21["全运行态统一邀请码注册"]
    H2 --> H22["本地资料目录设置 / launcher-settings.json"]
    H2 --> H23["重启后迁移并切换 localAppRoot"]
    I["后台管理台"]
    J["OpenClaw 安装中心\n品牌令牌 / OpenClaw·WorkBuddy·Cursor·Claude Desktop·Codex MCP / Skill / 正式交付检查清单"]

    A --> A1["品牌资料库"]
    A1 --> A11["品牌背景资料"]
    A1 --> A12["IP资料库"]
    A12 --> A121["IP照片多图 + IP语音(mp3 且 >30秒)"]
    A1 --> A13["产品资料库"]
    A1 --> A14["品牌运营情况"]
    A1 --> A15["第三方数据"]
    A1 --> A16["企业知识库"]
    A --> A2["采集数据"]
    A --> A3["增长报告"]
    A --> A4["半年营销规划"]
    A --> A5["营销日历"]
    A --> A6["爆款拆解"]
    A --> A7["选题库"]
    A2 --> A21["抖音采集视频预览：OSS 或本地副本，经 collectors/douyin 受控媒体接口读取"]
    A2 --> A22["抖音采集表格回显视频存储位置；缓存失败/过期时保留原作品入口"]
    A2 --> A23["抖音视频文案提取：Paraformer 主识别 + Whisper 兜底；记录状态时间，超时自动收口为可重试失败态"]
    A2 --> A24["抖音达人搜索抓取：按关键词 / 行业 / 粉丝 / 播放 / 互动 / 报价等维度沉淀达人基础资料"]
    A2 --> A25["抖音达人深度抓取：按达人标识创建后台轻任务，异步补拉画像 / 热词 / 推荐视频 / 主页视频摘要"]
    A2 --> A26["抖音达人结果池：随 collectors/douyin workspace 一起回显搜索结果、深抓快照与任务状态"]
    A6 --> A61["OpenClaw 独立 HTML 真源；支持查看 / 删除 / 留言协作"]
    A7 --> A71["品牌增长页仅保留结构化选题库；支持人工与 OpenClaw 共用的查看 / 编辑 / 删除"]
    A7 --> A72["选题库新增匹配爆款模板字段；支持沉淀多个爆款拆解 HTML"]

    A --> B
    A --> C
    A --> D
    A --> E
    A --> F
    A --> G

    C --> C1["AI 生视频"]
    C --> C2["复刻短视频"]
    C --> C3["数字人"]
    C --> C4["广告预审"]
    C --> C5["RunningHub"]
    C2 --> C21["从抖音素材库选视频 / 上传短视频"]
    C2 --> C22["第一阶段：15 秒分段复刻分析"]
    C2 --> C23["产出：角色卡 / 分镜脚本 / 角色图 / 分镜图 / 质检结果"]
    C2 --> C24["第二阶段：逐段生成视频"]
    C2 --> C25["ffmpeg 拼接完整视频"]
    C5 --> C51["MiniMax H3 / Seedance / Qwen 字体设计 / 数字人 / 电商设计等 RunningHub 应用清单"]
    C5 --> C52["上传节点强校验：localFilePath / upload.*；对象型 fieldValue 直接拦截"]

    B --> B1["某书：营销策划方案（OpenClaw HTML）/ 营销日历（仅小红书字段）/ 创作素材 / 每日计划 / 每周复盘 / 策略优化记录 / 作品列表"]
    B --> B2["某音/某号：营销策划方案（OpenClaw HTML）/ 营销日历（仅抖音字段）/ 数字人 / RunningHub应用 / 创作素材 / 每日计划 / 每周复盘 / 策略优化记录 / 作品列表"]
    B --> B3["公众号：营销策划方案（位于配置初始化上方）/ 营销日历（位于营销策划方案下方，仅公众号字段）/ 配置初始化（多公众号）/ 创作工作流（绑定公众号账号）/ 发布历史（标注公众号）/ 创作素材 / 每日计划 / 每周复盘 / 策略优化记录 / 作品列表"]
    B --> B4["三端营销日历继续共用品牌增长报告真源；OpenClaw 与用户都可创建、编辑"]
    B --> B5["内层复用 Xiaohongshu / Douyin / Wechat workspace shell"]
    B --> B6["创作素材统一返回标题 / 素材标签 / 素材来源 / 入库时间 / 本地文件夹地址"]
    E --> E1["GEO可见度诊断：HTML 预览 + 删除"]
    E --> E2["关键词挖掘：HTML + XLSX 存储地址"]
    E --> E3["网站诊断：HTML + DOCX 存储地址"]
    E --> E4["知识库搭建：HTML + Markdown 存储地址"]
    E --> E5["GEO优化方案：HTML + DOCX 存储地址"]
    E --> E6["自媒体内容 / 第三方媒体 / 品牌网站：多次生成列表 + HTML + DOCX 存储地址"]
    E6 --> E61["第三方媒体投放：软文街媒体缓存库 + 搜索 + 20条分页 + 继续同步下一页 + 选择 third_party_media 文章后提交订单"]

    F --> F1["评论获客：统一查看用户名 / 用户评论 / 入选理由 / 用户主页 / 入选时间 / 来源平台"]
    F --> F2["平台获客：统一查看名称 / 业务范围 / 入选理由 / 联系方式 / 地址 / 入选时间"]
    F --> F3["评论获客由 OpenClaw 从品牌增长评论用户结果生成；平台获客由 OpenClaw 直接写入"]
    F --> F4["两块列表都按每页 20 条分页，并支持单条删除"]

    I --> I1["投流获客：腾讯投流获客列表"]
    I --> I2["字段固定为 标题 / 内容 / 创建时间 / 留言"]
    I --> I3["支持查看详情、详情留言、删除单条记录"]
    I --> I4["由 OpenClaw 直接写入 OpenClawTencentAdLead，固定 workspaceScope=paid_acquisition"]

    J --> J1["达人合作：达人匹配 + 达人跟踪"]
    J --> J2["达人匹配：沿用达人结果池快照，并补 推荐理由 / 是否加入合作清单"]
    J --> J3["达人跟踪：按达人建档，补 合作作品数量"]
    J --> J4["作品详情：标题 / 链接 / 播放 / 点赞 / 收藏 / 评论 / 转发 / 结果评估 / 再次选择 / X天更新"]
    J --> J5["OpenClaw 真源：OpenClawCreatorCooperationMatch + OpenClawCreatorCooperationTracking + OpenClawCreatorCooperationWork"]
    J --> J6["合作作品按每日调度扫描到期记录，再按 X 天周期自动刷新抖音作品数据"]

    B --> G
    C --> G
    D --> G
    B --> I
    B --> J
    G --> G1["当前仅承接 OpenClaw 自由生图结果回看"]
    G --> G2["用户侧不再暴露手动创建入口、运营提示词中心、生图提示词中心"]
    G --> G3["OpenClaw create_design_work 图片模块默认自由生图，不自动套社媒模板或品牌资料"]
    G --> G4["referenceMaterialId 可复用站内素材；提供参考图时默认 edit_reference 并向模型传图，prompt_only 用于明确忽略参考图"]
    E --> H
    F --> H
    G --> H

    H --> H4["素材管理"]
    H4 --> H41["左侧四类：文本 / 图片 / 语音 / 视频"]
    H4 --> H42["聚合网站上传素材与 OpenClaw 入库素材"]
    H4 --> H44["四类素材统一提供查看按钮与站内预览"]
    H4 --> H43["local-single-user 可设置素材库存储目录"]
    H43 --> H430["顶部仅保留目录输入与三个按钮"]
    H43 --> H431["自动创建 素材库/文本 图片 语音 视频"]
    H43 --> H432["网站上传素材按分类写入本地素材库"]
    H43 --> H433["GEO/报告/附件等其它本地受控副本统一写入站内存储"]
    H43 --> H434["OpenClaw 上传素材可不在素材库内，但仍统一入列表"]
    H --> H5["技能中心"]
    H5 --> H51["左侧按技能分类分组，可展开 / 收缩"]
    H5 --> H52["右侧技能详情限制在固定内容框内滚动"]
    H --> H6["第三方接口配置"]
    H6 --> H61["软文街平台：API Key + 登录账号 + 登录密码"]
    H6 --> H62["其它平台继续复用品牌共享单字段配置"]

    I --> I1["Provider 治理"]
    I --> I2["技能中心"]
    I --> I3["模块注册中心"]
    I --> I4["能力包治理"]
    I --> I5["知识库治理"]
    I --> I6["用户管理（有效期 / 模块权限）"]

    I --> A
    I --> B
    I --> C
    I --> D
    I --> E
    I --> F
    I --> G
    I --> H

    H --> J
    J --> J1["安装令牌"]
    J --> J2["MCP 地址"]
    J --> J3["Skill Git 安装"]
    J --> J4["Skill ZIP 下载"]
```

## 5. 后端模块图

```mermaid
flowchart TD
    App["apps/server/src/app.module.ts"]

    App --> Auth["auth"]
    App --> Brands["brands"]
    App --> Collectors["collectors"]
    App --> Reports["reports"]
    App --> Works["works"]
    App --> Tasks["tasks"]
    App --> Publishing["publishing"]
    App --> Media["media"]
    App --> Orders["orders"]
    App --> LocalRuntime["local-runtime"]
    App --> SystemUpdate["system-update"]
    App --> Platforms["third-party-platforms"]
    App --> Skills["user-skills"]
    App --> OpenClaw["openclaw"]
    App --> Feedback["feedback"]
    App --> Scheduler["scheduler"]
    App --> Admin["admin/*"]

    Admin --> A1["api-providers"]
    Admin --> A2["billing-rules"]
    Admin --> A3["knowledge-bases"]
    Admin --> A4["model-usage"]
    Admin --> A5["module-definitions"]
    Admin --> A6["skill-packages"]
    Admin --> A7["skill-package-modules"]
    Admin --> A8["skill-package-knowledge-spaces"]
    Admin --> A9["skill-package-skills"]
    Admin --> A10["skills-prompts"]
    Admin --> A11["users-admin"]
```

## 6. 当前真相与历史参考的边界

```mermaid
flowchart LR
    A["当前真相"]
    B["专题方案"]
    C["变更记录"]
    D["历史规划"]

    A --> A1["README"]
    A --> A2["site-map"]
    A --> A3["site-map-mermaid"]
    A --> A4["engineering-standards"]
    A --> A5["git-workflow"]

    B --> B1["personal-center-multi-user-system-plan"]
    B --> B2["system-refactor-roadmap"]
    B --> B3["openclaw/*.md"]

    C --> C1["docs/changes/*.md"]

    D --> D1["docs/project_planning/*.md"]
    D1 --> D2["仅作历史参考"]
```
