# 品牌运营助手 Skill MCP 工具矩阵

## 1. 使用规则

这份矩阵不是给用户看的，而是给 Skill 自己做路由时查的。

优先原则：

1. 先用网站功能路由工具判断归属域
2. 再从本矩阵里选对应工具
3. 尽量优先统一管理工具，不要把一条完整业务链拆成一堆零散动作

补充原则：

- 先看有没有统一管理工具，再决定是否拆成专用工具
- 先看有没有摘要型工具，再决定是否直接写入
- 对密钥、邀请、发布、删除类动作，默认先读后写

## 2. 功能路由与总入口

- `get_website_function_catalog`
- `get_website_function_detail`
- `route_website_function_by_intent`
- `get_website_function_execution_plan`

用途：

- 看网站有哪些功能
- 看某个功能归哪个业务域
- 根据一句自然语言判断应走哪个模块
- 在执行前拿到输入缺口、风险级别、工具顺序

## 3. 品牌与档案

- `manage_brand_library`
- `get_current_brand_context`
- `get_brand_products`
- `get_platform_accounts`
- `get_brand_archive_summary`
- `get_brand_archive_survey`
- `get_brand_competitor_accounts`
- `get_brand_industry_feeds`
- `get_brand_business_assets`

适用场景：

- 统一读取或维护品牌资料库
- 读取或更新 `IP资料库`
- 上传 IP 图片到品牌资料库
- 上传 IP 语音到品牌资料库（仅 mp3，且时长需大于 30 秒）
- 看当前品牌是谁
- 看品牌产品、平台账号、竞品、行业资料
- 提取品牌档案摘要

`manage_brand_library` 常用 action：

- `get_archive_summary`
- `get_ip_library`
- `update_background`
- `update_ip_library`
- `upload_ip_image`
- `upload_ip_voice`
- `create_product`
- `replace_platform_accounts`
- `create_knowledge_base_files`

## 4. 品牌资料库与采集

### 4.1 小红书采集

- `get_xiaohongshu_collection_workspace`
- `sync_xiaohongshu_brand_accounts`
- `sync_xiaohongshu_competitor_accounts`
- `sync_xiaohongshu_brand_notes`
- `sync_xiaohongshu_benchmark_notes`
- `sync_xiaohongshu_search_notes`
- `sync_xiaohongshu_comment_data`
- `get_xiaohongshu_comment_replies`
- `sync_xiaohongshu_target_users`
- `sync_xiaohongshu_feishu_workspace`
- `add_xiaohongshu_note_to_material_library`

### 4.2 抖音采集

- `get_douyin_collection_workspace`
- `extract_douyin_work_transcript`
- `sync_douyin_brand_accounts`
- `sync_douyin_competitor_accounts`
- `sync_douyin_brand_works`
- `sync_douyin_competitor_works`
- `sync_douyin_benchmark_works`
- `sync_douyin_search_works`
- `sync_douyin_comment_data`
- `add_douyin_creators_to_result_pool`
- `sync_douyin_keyword_recommendations`
- `sync_douyin_low_fan_explosive_works`
- `sync_douyin_high_completion_rate_works`
- `sync_douyin_high_like_rate_works`
- `sync_douyin_city_hotspots`
- `delete_douyin_brand_account`
- `delete_douyin_competitor_account`
- `delete_douyin_keyword_recommendation`

补充说明：

- `get_douyin_collection_workspace`
  - 读取抖音采集工作区聚合结果
  - 当前会同时返回：
    - 视频受控预览地址
    - 原始作品地址
    - 本地或 OSS 存储位置
    - 视频文案提取状态与最近错误
    - 达人搜索结果与达人结果池
    - 达人主页链接
    - 已抓到的联系电话 / 微信号 / 邮箱 / MCN
  - 当网页里看到“打开预览”时，真正的预览优先走站内受控副本，不再要求外部裸链长期可用
- `extract_douyin_work_transcript`
  - 为指定抖音采集作品重新提取视频文案
  - 适用于：
    - 上次因本地 ASR 运行时未就绪而失败
    - 上次长时间停在“提取中”，现在想重新提取
    - 已补齐 Paraformer / Whisper 运行时，想直接重试
  - 调用前优先先读 `get_douyin_collection_workspace` 确认：
    - `assetId`
    - 当前视频是否已有可用预览或原作品地址
    - `transcriptStatus` / `transcriptLastError`

### 4.3 公众号采集

- `get_wechat_collection_workspace`
- `sync_wechat_brand_accounts`
- `delete_wechat_brand_account`
- `fetch_wechat_brand_articles`
- `read_wechat_article_content`
- `sync_wechat_benchmark_articles`
- `update_wechat_benchmark_article_stats`
- `sync_wechat_search_articles`
- `read_wechat_search_item_content`
- `update_wechat_search_item_stats`
- `add_wechat_article_to_material_library`
- `update_wechat_article_stats`
- `delete_wechat_collected_article`

### 4.4 每日热点

- `get_daily_hotspot_workspace`
- `sync_daily_hotspots`

### 4.5 采集删除

- `delete_xhs_collected_note`
- `delete_douyin_collected_work`
- `delete_wechat_collected_article`

## 5. 机会洞察与品牌增长

- `get_opportunity_insight_workspace`
- `generate_opportunity_insight_step_one`
- `generate_opportunity_insight_step_two`
- `generate_opportunity_insight_step_three`
- `get_latest_brand_growth_report_summary`
- `create_brand_growth_report`
- `create_half_year_marketing_plan`
- `manage_growth_reports`
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

适用场景：

- 看当前机会洞察做到哪一步
- 继续推进 step1 / step2 / step3
- 生成增长报告、半年营销规划、营销策划方案
- 读取营销日历、选题库、统一素材库相关能力
- 查看、创建、删除品牌增长报告下的 `爆款拆解` HTML 记录
- 直接补某一天的营销日历内容，例如把 2026-07-15 的当天主题、各平台选题和朋友圈内容补进去
- 处理内容获客下某书 / 某音/某号 / 公众号的 `营销日历` 入口；这三个入口当前不新增第二套工具，继续复用品牌增长营销日历语义工具
- 当前营销日历已经去掉技能中心依赖：OpenClaw 直接走 `manage_growth_reports` 即可，后端不再先读取营销日历 skill / prompt 配置
- 当 OpenClaw 已经自己生成好每日营销选题时：
  - 整版一次性提交：继续用 `generate_xiaohongshu_marketing_calendar` / `generate_douyin_marketing_calendar` / `generate_wechat_marketing_calendar` 携带 `payload.items`
  - 逐天补写：优先用 `upsert_xiaohongshu_marketing_calendar_item` / `upsert_douyin_marketing_calendar_item` / `upsert_wechat_marketing_calendar_item`
- 逐天补写推荐入参：
  - `selectedDate=YYYY-MM-DD`
  - `payload.item`
  - 可选 `payload.title`
  - `reportId` 可选；不传时后端会自动续写最新营销日历
- 最小提交示例：

```json
{
  "action": "upsert_xiaohongshu_marketing_calendar_item",
  "selectedDate": "2026-09-15",
  "payload": {
    "title": "品牌全平台营销日历",
    "item": {
      "date": "2026-09-15",
      "brandMarketing": { "theme": "中秋送礼预热", "description": "围绕节前送礼场景预热" },
      "xiaohongshu": {
        "brandAccount": { "topic": "中秋礼盒怎么选", "description": "主推送礼决策内容", "contentType": "图文", "noteKeywords": ["中秋礼盒"], "coverKeywords": ["礼盒"], "titleSuggestions": ["中秋礼盒怎么选"], "expectedPerformance": "提升收藏与咨询" },
        "employeeAccount": { "topic": "", "description": "", "contentType": "", "noteKeywords": [], "coverKeywords": [], "titleSuggestions": [], "expectedPerformance": "" }
      },
      "douyin": {
        "brandAccount": { "topic": "", "description": "", "contentType": "", "presentationFormat": "", "copyKeywords": [], "coverKeywords": [], "titleSuggestions": [], "expectedPerformance": "" },
        "ipAccount": { "topic": "", "description": "", "contentType": "", "presentationFormat": "", "copyKeywords": [], "coverKeywords": [], "titleSuggestions": [], "expectedPerformance": "" },
        "employeeAccount": { "topic": "", "description": "", "contentType": "", "presentationFormat": "", "copyKeywords": [], "coverKeywords": [], "titleSuggestions": [], "expectedPerformance": "" }
      },
      "moments": { "topic": "", "description": "", "presentationFormat": "" }
    }
  }
}
```
- 内容获客页面已去掉“生成营销日历”按钮；营销日历当前默认走 OpenClaw 直提，不再建议从页面触发后端生成

品牌增长报告分栏的推荐直连口径：

- 可视化报告：`get_brand_growth_visual_report_workspace`、`generate_brand_growth_visual_report`
- 营销日历：`get_brand_growth_marketing_calendar_workspace`、`generate_brand_growth_marketing_calendar`、`update_brand_growth_marketing_calendar`
- 爆款拆解：`get_openclaw_explosive_analyses`、`create_openclaw_explosive_analysis`、`delete_openclaw_explosive_analysis`
- 选题库：`get_brand_growth_topic_library_workspace`、`generate_brand_growth_topic_candidates`、`update_brand_growth_topic_library`、`create_brand_growth_topic_library_item`、`update_brand_growth_topic_library_item`、`delete_brand_growth_topic_library_item`
- 素材库：`get_brand_growth_material_library_items`

兼容说明：

- 以上新口径当前都只是对既有 `manage_growth_reports` / `get_unified_material_library_items` 的品牌增长语义别名
- 旧工具仍保留，避免已有 Skill 与 MCP 调用中断
- `manage_growth_reports` 当前兼容内容获客营销日历别名 action，例如 `get_douyin_marketing_calendar_workspace`、`generate_douyin_marketing_calendar`、`update_douyin_marketing_calendar`、`upsert_douyin_marketing_calendar_item`，以及公众号同类 action
- 当目标入口是内容获客三端营销日历时，Skill 需要自己控制字段边界：
  - 某书：只写 `xiaohongshu.*`
  - 某音/某号：只写 `douyin.*`
  - 公众号：只写 `moments.*`
- `爆款拆解` 走 OpenClaw 独立真源；如果用户还要求把某条爆款拆解 HTML 关联回选题库，需要额外调用 `create_brand_growth_topic_library_item` 或 `update_brand_growth_topic_library_item` 写入 `matchedExplosiveTemplateHtmls`

## 6. 任务与反馈

- `get_task_detail`
- `cancel_task`
- `retry_task`
- `get_recent_tasks_summary`
- `get_failed_tasks_summary`
- `submit_task_result_feedback`
- `get_feedback_summary`
- `get_feedback_analysis`
- `get_prompt_optimization_suggestions`

适用场景：

- 看任务详情
- 取消或重试任务
- 记录生成结果反馈
- 做反馈汇总与提示词优化分析

## 7. 个人中心与团队

### 7.1 个人中心

- `get_personal_center_overview`
- `get_recent_tasks_summary`
- `get_failed_tasks_summary`
- `get_task_detail`
- `cancel_task`
- `retry_task`
- `list_personal_material_assets`
- `get_local_material_storage_settings`
- `update_local_material_storage_settings`
- `list_my_third_party_platforms`
- `check_my_third_party_platform_runtime_access`
- `update_my_third_party_platform_secret`

素材管理补充：

- `list_personal_material_assets`
  - 读取个人中心素材管理聚合列表
  - 可按：
    - `text`
    - `image`
    - `audio`
    - `video`
    四类筛选
  - 数据来源统一覆盖网站上传素材与 OpenClaw 入库素材
- `get_local_material_storage_settings`
  - 读取 `local-single-user` 安装态当前素材库存储目录
  - 回显 `素材库` 根目录、四类子目录和命名规则
- `update_local_material_storage_settings`
  - 更新 `local-single-user` 安装态素材库存储根目录
  - 保存后自动创建 `素材库/文本`、`素材库/图片`、`素材库/语音`、`素材库/视频`
  - 该工具传入的是【素材库】外层根目录，不是最终子目录

第三方平台重点说明：

- `多元探索 / duoyuanx` 当前不是单独的一组专用 MCP tools，而是复用第三方接口配置域的通用工具：
  - `list_my_third_party_platforms`
  - `check_my_third_party_platform_runtime_access`
  - `update_my_third_party_platform_secret`
- Skill 在遇到“多元探索有没有接进来”“这份 Key 能不能给文本、图像、视频、音频、音乐一起用”“现在网站哪些功能能直用多元探索”这类问题时，优先先查平台列表和运行时可用性，不要直接猜测
- 当前多元探索统一网关已预装五类运行时：
  - 文本
  - 图像
  - 视频
  - 音频
  - 音乐
- 这些运行时是否被当前品牌可用，应以 `check_my_third_party_platform_runtime_access` 返回结果为准，而不是靠模型名硬猜
- 当用户明确指定“使用多元探索”时，后续如果继续走设计工作台、视频或其他生成链路，必须继续保留这个平台约束：
  - 先确认 `check_my_third_party_platform_runtime_access` 返回的匹配平台确实是 `多元探索平台`
  - 再从工作台模型列表里选择 `providerName` 明确属于多元探索的 `selectionKey`
  - 不要因为 APIZ / XSkill 也提供 Veo、Seedance、Kling 等同家族模型，就把 APIZ 当成多元探索的替代来源
- 如果用户提到 `Right Codes / right.codes / rightapi.ai`，也不要手写旧域名：
  - 当前默认 Base URL 应为 `https://www.rightapi.ai`
  - 旧域名 `right.codes` 仅作为兼容历史配置与海外网络访问口径保留
  - 查询接入状态时，仍然优先用 `list_my_third_party_platforms` 与 `check_my_third_party_platform_runtime_access`

### 7.2 团队协作

- `list_brand_members`
- `list_brand_invites`
- `create_brand_invite_link`
- `revoke_brand_invite`
- `get_brand_permission_settings`
- `list_my_brand_invites`
- `list_my_brand_invite_notifications`
- `accept_my_brand_invite`

### 7.3 OpenClaw 安装中心

当前 `OpenClaw 安装中心` 仍然主要是页面承接域，不新增一套专用写入型 MCP tools。

Skill 在这个域里的职责是：

- 识别用户是在问：
  - OpenClaw MCP 怎么安装
  - Skill ZIP / Git 怎么安装
- 然后把用户明确引导到 `个人中心 -> OpenClaw 安装中心`

当前页面里已经集中提供：

- 品牌安装令牌
- MCP 安装片段
- Skill ZIP / Git 安装说明

注意：

- 第三方接口配置页负责的是“多元探索共享 Key 有没有配好、运行时是否可用”

### 7.3 技能中心

- `get_skill_config_summary`
- `get_skill_config_detail`
- `update_skill_config`
- `reset_skill_to_platform_baseline`

## 8. 知识库

- `get_recent_knowledge_files`
- `create_knowledge_base`
- `upload_knowledge_base_files`
- `manage_brand_library`

适用场景：

- 创建品牌知识库
- 上传品牌资料
- 读取最近新增资料
- 统一管理品牌资料库中的知识相关对象
- 在同一入口下继续维护 `IP资料库` 等品牌归档对象

## 9. 小红书内容与发布

### 9.1 图文内容

- `create_xiaohongshu_original_note`
- `create_xiaohongshu_rewrite_note`
- `get_xiaohongshu_material_library_items`
- `get_xiaohongshu_marketing_calendar_options`
- `get_xiaohongshu_original_reference_templates`
- `get_recent_xiaohongshu_original_works`

### 9.2 视频笔记与发布

- `manage_xiaohongshu_video`
- `create_xiaohongshu_mobile_draft_session`
- `get_xiaohongshu_mobile_draft_session`
- `create_xiaohongshu_desktop_draft_session`
- `get_xiaohongshu_desktop_draft_session`

## 10. 抖音内容、视频与发布

### 10.1 文案

- `get_douyin_original_copy_options`
- `get_recent_douyin_original_copies`
- `create_douyin_original_copy`
- `get_douyin_remix_copy_options`
- `get_recent_douyin_remix_copies`
- `create_douyin_remix_copy`

### 10.2 视频生产统一入口

- `manage_douyin_video_production`

该统一入口覆盖：

- `video`
- `direct_video`
- `remix_short_video`
- `digital_human`
- `lip_sync`
- `runninghub`
- `ad_preaudit`

RunningHub 当前常见 appKey 示例：

- `minimax-h3-fl2va-text-to-video`
- `minimax-h3-fl2va-first-frame-video`
- `minimax-h3-fl2va-first-last-frame-video`
- `minimax-h3-fl2va-multi-image-video`
- `minimax-h3-audio-clip-single-image-digital-human`
- `minimax-h3-multi-image-2k-upscale-v3`
- `minimax-h3-8step-image-to-video`
- `minimax-h3-4step-first-last-frame-video`
- `minimax-h3-accelerated-all-reference-video`
- `minimax-h3-digital-human-auto`
- `seedance25-multimodal-video`
- `seedance20-viral-video-remix`
- `seedance20-fast-all-reference-video`
- `seedance20-fast-rh`
- `qwen-image-chinese-font-design`
- `qwen-font-design-8step`

RunningHub 上传节点补充规则：

- 如果模板 `fieldData` 里带选项列表，而当前 `fieldValue` 是数字索引（例如比例、模式、档位），要按选项标签理解，但提交时仍保留模板要求的原始索引或原始值
- 图片、音频、视频上传节点要么在节点对象顶层传 `localFilePath`，要么传 `upload.fileName / upload.contentType / upload.dataBase64`
- 普通文本 / 数值节点才只改 `fieldValue`；媒体节点不能只剩 `nodeId + fieldName` 空壳
- 如果 RunningHub 返回 `errorCode=803 / JsonNull`，优先排查必填图片 / 音频 / 视频节点是否仍为空
- 不要把 `{ localFilePath: ... }`、`{ fileName, contentType, dataBase64 }` 这类对象直接塞进 `fieldValue` 或 `fieldData`
- 如果把对象误塞进 `fieldValue / fieldData`，服务端现在会直接拦截，并提示这会被错误串成 `[object Object]`

### 10.3 发布会话

- `create_douyin_mobile_publish_session`
- `get_douyin_mobile_publish_session`
- `create_douyin_desktop_publish_session`
- `get_douyin_desktop_publish_session`

## 11. 公众号

### 11.1 读取与发布历史

- `get_wechat_article_drafts`
- `get_wechat_official_accounts`
- `get_wechat_workflow_sessions`
- `get_wechat_publish_history`
- `get_wechat_workflow_preferences`
- `get_wechat_workflow_session_detail`
- `check_wechat_workflow_publish_readiness`
- `get_wechat_publish_history_detail`
- `publish_wechat_article`
- `publish_wechat_workflow`
- `retry_wechat_publish_history`

补充说明：

- `get_wechat_official_accounts`
  - 返回当前品牌已登记的全部公众号账号
  - 可用于让 Skill 在创建工作流或发布前明确选择目标公众号
- `get_wechat_publish_history`
  - 当前每条记录都会带 `accountName`
  - 适合在多公众号并行运营时区分具体发稿账号

### 11.2 工作流统一入口

- `manage_wechat_workflow`

该统一入口覆盖：

- 偏好读取与保存
- 工作流创建与删除
- `set_article`
- `set_images`
- `set_html`
- `generate_article`
- `generate_images`
- `generate_html`
- `rebuild_publish_config`
- `publish_workflow`

补充说明：

- `create_workflow` / `update_input`
  - `payload.accountId` 可显式指定工作流绑定的公众号账号
  - 不传时按默认公众号处理
- `rebuild_publish_config` / `publish_workflow`
  - 会按工作流绑定账号读取 AppID、AppSecret 和 IP 白名单
  - 不再只按单套全局公众号配置执行

## 12. 设计工作台

- `get_design_workspace_options`
- `get_recent_design_works`
- `create_design_work`

适用场景：

- OpenClaw 自由生图
- 查看最近生图结果

补充说明：

- 图片模块默认走自由生图，不自动套社媒配图模板、不默认植入品牌资料，也不强制追加中文排版文案
- 图片设计支持显式 `imageSize`，格式固定为 `宽x高`，例如 `1200x628`、`1080x1920`
- 兼容旧链路的 `spec: "宽x高"` 仍可继续使用
- 如果用户要用多元探索 `gpt-image-2.5-sunburst` 或 `gpt-image-2.5-flare`，不要手写 providerId，直接使用模型列表里返回的 `selectionKey`
- `get_recent_design_works` 对应的站内页面当前只是结果回看面板，不再给用户手动创建任务

## 13. 统一素材库

- `get_unified_material_library_items`
- `get_douyin_material_library_items`
- `add_xiaohongshu_note_to_material_library`
- `add_douyin_work_to_material_library`
- `add_wechat_article_to_material_library`
- `remove_xiaohongshu_note_from_material_library`
- `remove_douyin_work_from_material_library`

## 14. OpenClaw 专区

### 14.1 每周复盘

- `get_openclaw_lobster_diaries`
- `create_openclaw_lobster_diary`
- `update_openclaw_lobster_diary`
- `delete_openclaw_lobster_diary`

### 14.2 每日计划

- `get_openclaw_daily_plans`
- `create_openclaw_daily_plan`
- `delete_openclaw_daily_plan`

### 14.3 营销策划方案

- `get_openclaw_marketing_plans`
- `create_openclaw_marketing_plan`
- `delete_openclaw_marketing_plan`

营销策划方案当前统一字段：

- `title`
- `htmlContent`
- `createdAt`

营销策划方案补充：

- `create_openclaw_marketing_plan`
  - 用于把 OpenClaw 生成完成的 HTML 营销策划方案写入某书 / 某音 / 公众号板块
  - 详情页默认支持 HTML 预览、打开 HTML 和留言协作

### 14.4 腾讯投流获客

- `get_openclaw_tencent_ad_leads`
- `create_openclaw_tencent_ad_lead`
- `delete_openclaw_tencent_ad_lead`

腾讯投流获客当前统一字段：

- `title`
- `content`
- `createdAt`

腾讯投流获客补充：

- `create_openclaw_tencent_ad_lead`
  - 用于把 OpenClaw 生成完成的腾讯投流获客内容写入 `投流获客 -> 腾讯投流获客`
  - 详情页默认支持正文查看、留言协作和删除

### 14.4A 爆款拆解

- `get_openclaw_explosive_analyses`
- `create_openclaw_explosive_analysis`
- `delete_openclaw_explosive_analysis`

爆款拆解当前统一字段：

- `title`
- `tags`
- `htmlContent`
- `authorName`
- `workUrl`
- `videoCopy`
- `createdAt`

爆款拆解补充：

- `create_openclaw_explosive_analysis`
  - 用于把 OpenClaw 生成完成的爆款拆解 HTML 写入 `品牌增长报告 -> 爆款拆解`
  - 详情页默认支持 HTML 预览、留言协作和删除

### 14.5 达人合作

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

达人合作当前统一字段：

- 达人匹配
  - 延续达人结果池的达人基础字段
  - `recommendedReason`
  - `isInTrackingList`
- 达人跟踪
  - 延续达人结果池的达人基础字段
  - `cooperationWorkCount`
- 合作作品
  - `title`
  - `douyinWorkUrl`
  - `playCount`
  - `likeCount`
  - `collectCount`
  - `commentCount`
  - `shareCount`
  - `resultEvaluation`
  - `nextAction`
  - `refreshIntervalDays`
  - `lastSyncedAt`
  - `nextRefreshAt`

达人合作补充：

- `create_openclaw_creator_matches`
  - 用于把达人结果池中的达人写入 `达人合作 -> 达人匹配`
- `move_openclaw_creator_matches_to_tracking`
  - 用于把达人匹配中的达人加入 `达人跟踪`
- `create_openclaw_creator_tracking_work`
  - 用于给某位达人新增合作作品，并同步写入首轮作品数据与自动更新频率
- `update_openclaw_creator_tracking_work`
  - 用于更新结果评估 / 再次选择 / 自动更新周期，或手动刷新一次作品数据

### 14.6 策略优化记录

- `get_openclaw_strategy_optimizations`
- `create_openclaw_strategy_optimization`
- `update_openclaw_strategy_optimization`
- `delete_openclaw_strategy_optimization`

补充说明：

- 仅用于 `brand_growth / xiaohongshu / douyin / wechat`
- 不用于 GEO 关键词挖掘、网站诊断、知识库搭建、GEO优化方案

### 14.7 音乐生成

- `create_volcengine_music_task`
- `get_volcengine_music_task`

### 14.7 创作素材

- `get_openclaw_creative_materials`
- `create_openclaw_creative_material`
- `delete_openclaw_creative_material`

创作素材当前统一字段：

- `title`
- `sourceKind`
- `materialTags`
- `sourceLabel`
- `createdAt`
- `storageKey`
- `localFilePath`

创作素材补充：

- `create_openclaw_creative_material`
  - 支持 `sourceKind`
    - `material_library_upload`：网站上传并写入本地素材库
    - `openclaw_upload`：OpenClaw 上传到网站或外部归档素材
  - 当 `sourceKind=material_library_upload` 且当前环境为 `local-single-user` 时，文件会按四分类写入用户配置的 `素材库`

### 14.8 视频作品

- `get_openclaw_video_works`
- `create_openclaw_video_work`
- `delete_openclaw_video_work`
- `create_openclaw_video_work_douyin_desktop_publish_session`

## 15. GEO获客

- `get_openclaw_geo_visibility_reports`
- `create_openclaw_geo_visibility_report`
- `delete_openclaw_geo_visibility_report`
- `get_openclaw_geo_contents`
- `create_openclaw_geo_content`
- `delete_openclaw_geo_content`
- `get_openclaw_third_party_media_delivery_resources`
- `sync_openclaw_third_party_media_delivery_resources`

补充说明：

- GEO 关键词挖掘、网站诊断、知识库搭建、GEO优化方案统一通过 `create_openclaw_geo_content` 保存

第三方媒体投放缓存补充：

- `get_openclaw_third_party_media_delivery_resources`
  - 读取 GEO `第三方媒体投放` 当前已缓存的软文街媒体库
  - 支持：
    - `page`
    - `searchKeyword`
  - 页面语义固定为站内每页 20 条，而不是远端接口原始分页
- `sync_openclaw_third_party_media_delivery_resources`
  - 继续同步软文街下一页媒体到当前品牌缓存库
  - 不覆盖历史缓存
  - 返回同步后的站内分页结果
  - 若同步返回软文街鉴权失败，优先提醒用户到个人中心核对当前品牌保存的 `登录账号 / 登录密码` 是否还是最新可用值

## 16. 全网获客

- `get_openclaw_comment_leads`
- `create_openclaw_comment_leads`
- `delete_openclaw_comment_lead`
- `get_openclaw_platform_leads`
- `create_openclaw_platform_leads`
- `delete_openclaw_platform_lead`

## 17. 统一优先级

### 17.1 优先使用的统一管理工具

优先顺序：

1. `manage_brand_library`
2. `manage_growth_reports`
3. `manage_wechat_workflow`
4. `manage_xiaohongshu_video`
5. `manage_douyin_video_production`

### 17.2 什么时候用直连工具

- 用户目标非常明确
- 不需要先走复杂工作流
- 统一工具之外有更短的专用链路
- 用户已经给出了完整输入，不必再经过多步工作流
- 如果用户显式指定“用多元探索跑”，也不要先假设存在单独的 `duoyuanx_generate_*` 工具；应先在第三方接口配置域确认品牌共享 Key 和对应 runtime 是否可用，再路由到网站已有工作台或统一工具

### 17.3 什么时候先做页面承接

- 当前没有直连 MCP
- 风险很高，且需要用户在网页里做最终人工确认
- 结果更适合网页可视化查看，而不是对话里展开
- 当前属于 OpenClaw 安装、账号安全或后台管理等纯页面承接场景
