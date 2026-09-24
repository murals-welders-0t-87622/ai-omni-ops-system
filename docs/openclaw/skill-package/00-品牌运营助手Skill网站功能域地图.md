# 品牌运营助手 Skill 网站功能域地图

## 1. 这份文档怎么用

这份文档是给 `品牌运营助手` 主 Skill 配套使用的外部能力地图，用来回答 4 件事：

1. 网站现在有哪些真实业务域
2. 每个业务域对应哪个页面入口
3. 哪些能力可以直接通过 MCP 执行
4. 哪些能力当前仍以网站页面承接为主

当用户提到“网站里那个板块”“某个页面上的功能”“这个模块能不能直接做”时，优先配合：

- `get_website_function_catalog`
- `get_website_function_detail`
- `route_website_function_by_intent`
- `get_website_function_execution_plan`

## 2. 总体规则

- 当前品牌是默认上下文，除非用户明确切换品牌
- 能直接通过 MCP 执行的，优先在对话里完成
- 只有当前还没有直连 MCP 的页面功能，才引导用户回网页
- 即便当前要回网页，也要先告诉用户应去哪个页面、做什么动作、为什么不能直接在对话里完成

## 3. 网站功能域总览

### 3.1 品牌增长 `/brand-growth`

当前承载：

- 品牌资料库
- IP资料库
- 企业知识库
- 小红书 / 抖音 / 公众号采集
- 品牌增长报告
- 半年营销规划
- 营销日历
- 爆款拆解
- 选题库
- 统一素材库
- OpenClaw 的营销策划方案、每日计划、每周复盘、策略优化记录、爆款拆解、创作素材、视频作品

当前优先 MCP：

- `manage_brand_library`
- `manage_growth_reports`
- `get_unified_material_library_items`
- `get_brand_growth_visual_report_workspace`
- `generate_brand_growth_visual_report`
- `get_brand_growth_marketing_calendar_workspace`
- `generate_brand_growth_marketing_calendar`
- `update_brand_growth_marketing_calendar`
- `get_openclaw_explosive_analyses`
- `create_openclaw_explosive_analysis`
- `delete_openclaw_explosive_analysis`
- `get_brand_growth_topic_library_workspace`
- `generate_brand_growth_topic_candidates`
- `update_brand_growth_topic_library`
- `create_brand_growth_topic_library_item`
- `update_brand_growth_topic_library_item`
- `delete_brand_growth_topic_library_item`
- `get_brand_growth_material_library_items`
- `get_xiaohongshu_collection_workspace`
- `get_douyin_collection_workspace`
- `extract_douyin_work_transcript`
- `get_wechat_collection_workspace`
- `get_daily_hotspot_workspace`
- `sync_daily_hotspots`
- `get_openclaw_daily_plans`
- `get_openclaw_lobster_diaries`
- `update_openclaw_lobster_diary`
- `get_openclaw_strategy_optimizations`
- `update_openclaw_strategy_optimization`
- `get_openclaw_creative_materials`
- `get_openclaw_video_works`

`manage_brand_library` 在品牌资料库域下当前优先承接：

- 品牌背景读取与更新
- `IP资料库` 读取、更新与图片上传
- 产品资料、平台账号、竞品账号、行业资料、业务资产
- 品牌知识库创建与文件上传

其中 `manage_growth_reports` 当前已覆盖营销日历按日期补写能力：

- 优先直接使用 `upsert_xiaohongshu_marketing_calendar_item` / `upsert_douyin_marketing_calendar_item` / `upsert_wechat_marketing_calendar_item`
- 通过 `selectedDate=YYYY-MM-DD` 配合 `payload.item` 精确更新某一天，而不是整版手工覆盖
- 如果已经知道 `reportId` 可以一并传入；如果没有，后端会优先续写当前最新营销日历，没有再自动创建首条记录，因此不再要求 OpenClaw 先专门查询 `reportId`

为避免页面左侧“品牌增长报告”分栏和 OpenClaw 工具命名脱节，当前额外补了一层品牌增长语义别名：

- 可视化报告：`get_brand_growth_visual_report_workspace`、`generate_brand_growth_visual_report`
- 营销日历：`get_brand_growth_marketing_calendar_workspace`、`generate_brand_growth_marketing_calendar`、`update_brand_growth_marketing_calendar`
- 爆款拆解：`get_openclaw_explosive_analyses`、`create_openclaw_explosive_analysis`、`delete_openclaw_explosive_analysis`
- 选题库：`get_brand_growth_topic_library_workspace`、`generate_brand_growth_topic_candidates`、`update_brand_growth_topic_library`、`create_brand_growth_topic_library_item`、`update_brand_growth_topic_library_item`、`delete_brand_growth_topic_library_item`
- 素材库：`get_brand_growth_material_library_items`

补充约束：

- `爆款拆解` 位于品牌增长报告的 `营销日历` 下、`选题库` 上，属于 OpenClaw 独立 HTML 真源，不并入 `DOUYIN_TOPIC_LIBRARY`
- `选题库` 当前新增 `matchedExplosiveTemplateHtmls`，用于沉淀多个爆款拆解 HTML 模板；OpenClaw 做单条写入时应一并维护该字段

抖音采集补充：

- `get_douyin_collection_workspace` 当前会把抖音采集作品的：
  - 站内预览地址
  - 原始作品地址
  - 视频缓存状态
  - 本地或 OSS 存储位置
  - 视频文案提取状态
  一起返回给 Skill
- 在达人采集场景下，`get_douyin_collection_workspace` 还会一起返回：
  - 达人搜索结果
  - 达人结果池快照
  - 达人主页链接
  - 已抓到的联系电话 / 微信号 / 邮箱 / MCN
- `extract_douyin_work_transcript` 用于在本地 ASR 环境准备完成或异常收口后，重新触发某条抖音采集作品的视频文案提取
- 当用户反馈“预览打不开”时，Skill 应优先把它理解为受控预览链路问题，而不是简单外部链接失效

收集数据补充：

- 小红书采集已补齐评论链路直连工具：
  - `sync_xiaohongshu_comment_data`
  - `get_xiaohongshu_comment_replies`
- 抖音采集已补齐品牌作品、竞品作品、达人结果池和删除动作：
  - `sync_douyin_brand_works`
  - `sync_douyin_competitor_works`
  - `add_douyin_creators_to_result_pool`
  - `delete_douyin_brand_account`
  - `delete_douyin_competitor_account`
  - `delete_douyin_keyword_recommendation`
- 公众号采集已补齐品牌账号删除、正文读取、对标/搜一搜统计更新与搜一搜正文读取：
  - `delete_wechat_brand_account`
  - `read_wechat_article_content`
  - `update_wechat_benchmark_article_stats`
  - `read_wechat_search_item_content`
  - `update_wechat_search_item_stats`
- 每日热点已可直接在对话中查看指定日期工作区并按平台刷新：
  - `get_daily_hotspot_workspace`
  - `sync_daily_hotspots`

### 3.2 小红书 `/xiaohongshu`

当前承载：

- 内容获客三端聚合入口
  - 某书营销策划方案
  - 某书营销日历
  - 某音/某号营销策划方案
  - 某音/某号营销日历
  - 公众号营销策划方案
  - 公众号营销日历
- 原创图文
- 二创图文
- 视频笔记
- 草稿接力

当前优先 MCP：

- `create_xiaohongshu_original_note`
- `create_xiaohongshu_rewrite_note`
- `manage_xiaohongshu_video`
- `create_xiaohongshu_mobile_draft_session`
- `create_xiaohongshu_desktop_draft_session`
- `get_brand_growth_marketing_calendar_workspace`
- `generate_brand_growth_marketing_calendar`
- `update_brand_growth_marketing_calendar`

处理原则：

- 当用户明确提到“内容获客某书 / 某音/某号 / 公众号的营销日历”时，仍读取同一份品牌增长营销日历真源，只是在回复或补写时按目标平台收口字段：
  - 某书：只看/只补小红书块
  - 某音/某号：只看/只补抖音块
  - 公众号：只看/只补公众号块
- 当前营销日历已经去掉技能中心依赖：OpenClaw 直接提交即可，后端不再要求营销日历 skill / prompt 先存在或先配置
- 当 OpenClaw 已经自己产出每日营销选题时：
  - 如果是整版一次性提交，可以直接携带 `payload.items`
  - 如果是逐天补写，优先走 `upsert_*_marketing_calendar_item + selectedDate + payload.item`
- 内容获客页面已去掉“生成营销日历”按钮，当前默认入口就是 OpenClaw 直提营销日历
- 原创 / 二创图文优先走直连工具
- 视频笔记优先走 `manage_xiaohongshu_video`
- 草稿接力只有在用户明确要落到草稿箱时才继续发起

### 3.3 抖音 `/douyin`

当前承载：

- 原创文案
- 二创文案
- AI 生视频
- 数字人
- 口型驱动
- RunningHub
- 广告预审
- 发布工作流

当前优先 MCP：

- `create_douyin_original_copy`
- `create_douyin_remix_copy`
- `manage_douyin_video_production`
- `create_douyin_mobile_publish_session`
- `create_douyin_desktop_publish_session`

处理原则：

- 普通视频、直接视频、混剪短视频、数字人、口型驱动、RunningHub、广告预审都优先从 `manage_douyin_video_production` 进入
- 数字人语音试听属于 `section=digital_human`
- RunningHub 属于 `section=runninghub`
- RunningHub 模板里如果 `fieldData` 携带选项列表、而 `fieldValue` 返回的是数字索引（例如比例、模式、档位），应按选项标签理解字段含义，但提交时保留模板原始值
- 当前 RunningHub 已内置一组常见应用示例：
  - `minimax-h3-fl2va-text-to-video`：文生视频
  - `minimax-h3-fl2va-first-frame-video`：首帧参考生视频
  - `minimax-h3-fl2va-first-last-frame-video`：首尾帧参考生视频
  - `minimax-h3-fl2va-multi-image-video`：多图参考生视频
  - `minimax-h3-audio-clip-single-image-digital-human`：音频裁剪驱动 MiniMax H3 数字人单图版
  - `minimax-h3-multi-image-2k-upscale-v3`：4 步 Lora 超级加速多图生视频 + 2K 放大 V3
  - `minimax-h3-8step-image-to-video`：8 步加速图生视频
  - `minimax-h3-4step-first-last-frame-video`：4 步加速首尾帧生视频
  - `minimax-h3-accelerated-all-reference-video`：全能参考视频
  - `minimax-h3-digital-human-auto`：数字人口播 / 唱歌 / 电商讲解自动版
  - `seedance25-multimodal-video`：Seedance 2.5 多模态视频
  - `seedance20-viral-video-remix`：Seedance 2.0 复刻爆款视频
  - `seedance20-fast-all-reference-video`：Seedance 2.0 Fast 全能生视频
  - `seedance20-fast-rh`：Seedance 2.0 Fast RH 版
  - `qwen-image-chinese-font-design`：中文字体设计图生图
  - `qwen-font-design-8step`：Qwen 8 步加速字体设计
- 广告预审属于 `section=ad_preaudit`

### 3.4 公众号 `/wechat`

当前承载：

- 营销策划方案（OpenClaw HTML 上传与留言协作）
- 账号配置（支持多公众号账号）
- 正文工作流
- 配图生成
- HTML 排版
- 发布确认
- 正式发布
- 发布历史（标注公众号账号）

当前优先 MCP：

- `manage_wechat_workflow`
- `get_wechat_article_drafts`
- `get_wechat_official_accounts`
- `get_wechat_workflow_sessions`
- `get_wechat_workflow_preferences`
- `get_wechat_workflow_session_detail`
- `check_wechat_workflow_publish_readiness`
- `get_wechat_publish_history`
- `get_wechat_publish_history_detail`
- `publish_wechat_article`
- `publish_wechat_workflow`
- `retry_wechat_publish_history`

处理原则：

- 公众号工作流优先走统一工具 `manage_wechat_workflow`
- 若品牌下有多个公众号，先读 `get_wechat_official_accounts`，再在创建或更新工作流时带上目标 `accountId`
- `set_article / set_images / set_html` 表示外部已有结果，直接写入
- `generate_article / generate_images / generate_html` 表示继续走网站链路
- 发布前先 `rebuild_publish_config`
- 正式发稿再 `publish_workflow`

### 3.5 设计工作台 `/more-features/design`

当前承载：

- OpenClaw 自由生图结果回看

当前优先 MCP：

- `get_design_workspace_options`
- `get_recent_design_works`
- `create_design_work`

处理原则：

- 真正创建任务前先看 options
- 指定模型时必须使用返回的 `selectionKey`
- 有参考图时可带上 `referenceImageUrl` 或 `referenceImage`；图片模块默认 `referenceImageMode="edit_reference"`，参考图会作为图像输入发送给生图模型
- 只有用户明确要求完全忽略参考图、只按文字生成时，才传 `referenceImageMode="prompt_only"`
- 主体与场景要求传入 `additionalInstruction`；`prompt` 是兼容别名，`styleHint` 保持旧版兼容
- 图片模块默认就是给 OpenClaw 直接调用生图模型自由出图：
  - 不自动套社媒配图模板
  - 不默认植入品牌资料
  - 不强制补中文排版文案
- `/more-features/design` 当前只是站内结果面板，不再给用户暴露手动创建入口
- `/more-features/operations-prompt-center` 和 `/more-features/image-prompt-center` 当前都重定向回设计页

### 3.6 个人中心 `/personal-center`

当前承载：

- 概览
- 任务中心
- 素材管理
- 作品中心
- 技能中心
- 第三方接口配置
- OpenClaw 安装中心
- 安全设置
- 团队协作
- 邀请通知

当前优先 MCP：

- `get_personal_center_overview`
- `get_recent_tasks_summary`
- `get_failed_tasks_summary`
- `get_task_detail`
- `cancel_task`
- `retry_task`
- `list_personal_material_assets`
- `get_local_material_storage_settings`
- `update_local_material_storage_settings`
- `get_skill_config_summary`
- `get_skill_config_detail`
- `update_skill_config`
- `reset_skill_to_platform_baseline`
- `list_my_third_party_platforms`
- `check_my_third_party_platform_runtime_access`
- `update_my_third_party_platform_secret`
- `list_brand_members`
- `list_brand_invites`
- `create_brand_invite_link`
- `revoke_brand_invite`
- `get_brand_permission_settings`
- `list_my_brand_invites`
- `list_my_brand_invite_notifications`
- `accept_my_brand_invite`

页面承接为主：

- `作品中心`
- `安全设置`
- `OpenClaw 安装中心`

OpenClaw 安装中心补充说明：

- 当前页面内已经集中提供：
  - 品牌安装令牌
  - MCP 安装片段（OpenClaw / WorkBuddy / Cursor / Claude Desktop / Codex）
  - Skill ZIP / Git 安装说明
- 当前复制按钮、可视化安装和完整配置查看仍以页面承接为主，不要假装自己已经代用户点过网页按钮

素材管理补充说明：

- `素材管理` 当前统一聚合网站上传素材与 OpenClaw 入库素材
- 左侧固定四类：
  - 文本
  - 图片
  - 语音
  - 视频
- `local-single-user` 安装态下可直接查看和修改素材库存储目录：
  - `get_local_material_storage_settings`
  - `update_local_material_storage_settings`
- 用户选择的是【素材库】外层根目录，系统会自动创建：
  - `素材库/文本`
  - `素材库/图片`
  - `素材库/语音`
  - `素材库/视频`
- 网站上传素材会按 `素材库/<分类>/<brandId>/<YYYY>/<YYYY-MM>/<timestamp>-<title>.<ext>` 落盘
- OpenClaw 上传素材不强制写入 `素材库`，但同样会进入四分类列表
- 列表当前统一回显：
  - 标题
  - 素材标签
  - 素材来源
  - 入库时间
  - 存储位置（本地文件夹地址）

处理原则：

- 如果用户问的是“账号安全”“密码”“登录保护”“安装中心”，先判断当前是否已有 MCP 能力直连
- 没有直连时，不要假装能执行；应明确引导回对应页面
- 如果用户问的是“多元探索 / duoyuanx 平台现在接进来了没有”“这份品牌共享 Key 能不能给文本、图像、视频、音频、音乐一起用”，优先把它当成 `第三方接口配置` 域处理，而不是当成某个单独页面功能
- 多元探索当前在网站里属于统一网关型第三方平台：
  - 一份品牌共享 Key
  - 统一承接文本、图像、视频、音频、音乐五类运行时
  - 具体业务执行仍由网站已有工作台或运行时路由消费，而不是新增一个单独的“多元探索工作台”
- Skill 在涉及多元探索时，默认顺序应为：
  1. `list_my_third_party_platforms`
  2. `check_my_third_party_platform_runtime_access`
  3. 必要时再 `update_my_third_party_platform_secret`
- 如果用户提到 `Right Codes / right.codes / rightapi.ai`，也优先按 `第三方接口配置` 域处理：
  - Right Codes 服务域名已迁移到 `https://www.rightapi.ai`
  - 海外网络下旧域名 `right.codes` 仍可能可访问，但默认应以 `rightapi.ai` 为准
  - API 路径与业务逻辑不变，只需把 Base URL 从 `right.codes` 替换成 `rightapi.ai`

### 3.7 GEO获客 `/geo`

当前承载：

- GEO 可见度诊断 HTML 报告查看 / 保存 / 删除
- 关键词挖掘、网站诊断、知识库搭建、GEO优化方案的一次性内容查看
- 自媒体内容、第三方媒体、品牌网站的多次生成列表查看
- `第三方媒体投放` 的软文街媒体缓存库：
  - 每次同步都会继续沉淀新媒体，不覆盖历史缓存
  - 默认读取站内已缓存媒体
  - 固定按 20 条分页
  - 支持按媒体名称、平台、分类、地区搜索
  - 如果继续同步时报软文街鉴权失败，先回到个人中心核对当前品牌保存的软文街登录账号和登录密码
- 其它 GEO 工作流 HTML 预览与非 HTML `存储地址` 回显

当前优先 MCP：

- `get_openclaw_geo_visibility_reports`
- `create_openclaw_geo_visibility_report`
- `delete_openclaw_geo_visibility_report`
- `get_openclaw_geo_contents`
- `create_openclaw_geo_content`
- `delete_openclaw_geo_content`
- `get_openclaw_third_party_media_delivery_resources`
- `sync_openclaw_third_party_media_delivery_resources`

处理原则补充：

- GEO 关键词挖掘、网站诊断、知识库搭建、GEO优化方案统一走 `create_openclaw_geo_content`
- `create_openclaw_strategy_optimization` 不用于 GEO 板块

### 3.8 全网获客 `/all-network-growth`

当前承载：

- 评论获客统一名单
- 平台获客统一名单
- 按平台查看评论获客列表
- 由 OpenClaw 从品牌增长评论用户结果生成评论获客记录
- 由 OpenClaw 直接写入平台获客记录

当前优先 MCP：

- `get_openclaw_comment_leads`
- `create_openclaw_comment_leads`
- `delete_openclaw_comment_lead`
- `get_openclaw_platform_leads`
- `create_openclaw_platform_leads`
- `delete_openclaw_platform_lead`

### 3.9 投流获客 `/paid-acquisition`

当前承载：

- 腾讯投流获客列表
- 查看详情后的留言协作
- 由 OpenClaw 直接写入与删除单条投流获客记录

当前优先 MCP：

- `get_openclaw_tencent_ad_leads`
- `create_openclaw_tencent_ad_lead`
- `delete_openclaw_tencent_ad_lead`

### 3.10 达人合作 `/creator-cooperation`

当前承载：

- 达人匹配
- 达人跟踪

当前优先 MCP：

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

### 3.10 后台管理 `/admin`

当前原则：

- 这不是品牌员工默认应使用的域
- 如果当前会话身份不是管理员，不应把后台能力当成默认可执行任务
- 即便未来开放后台 MCP，也必须单独按管理员权限处理

## 4. Skill 的实际落地规则

### 4.1 能直接执行的域

以下域默认优先在对话里直接完成：

- 品牌增长
- 小红书
- 抖音
- 公众号
- 设计工作台
- 个人中心中的任务 / 订单 / 技能 / 第三方接口 / 团队协作
- OpenClaw 数据归档
- GEO获客
- 全网获客

### 4.2 先读后写的域

以下域默认必须先读上下文，再决定是否写入：

- 技能中心
- 团队协作
- 第三方接口配置
- 公众号正式发布
- 发布会话创建

### 4.3 页面承接优先的域

以下场景当前更适合网页承接：

- OpenClaw 安装中心里的可视化安装与复制动作
- 安全设置
- 后台管理台
- 作品中心的大范围人工浏览

### 4.4 当用户只说“网站那个功能”

统一顺序：

1. `route_website_function_by_intent`
2. `get_website_function_detail`
3. `get_website_function_execution_plan`
4. 再决定是直接执行，还是回网页承接

## 5. 一句话结论

品牌运营助手不应该只会几个孤立工具，而是要把整站功能理解为：

- 可直接对话执行的功能
- 需要确认后执行的功能
- 当前仍以页面承接为主的功能

三类统一路由。
