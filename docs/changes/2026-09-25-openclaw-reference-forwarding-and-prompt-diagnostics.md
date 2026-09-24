# 2026-09-25 OpenClaw 参考图默认转发恢复与 Prompt 诊断

## 背景与结论

WorkBuddy 对照测试显示，参考图被服务端接收但未发送时，中文和英文主体 prompt 仍未遵从。部署后运行日志进一步确认：MCP 入口 `additionalInstruction/styleHint` 指令长度为 0，最终 Provider prompt 也不含目标主体关键词。因此模型并非收到用户 prompt 后不遵从，而是这几次 MCP 调用没有将要求传入服务端识别的指令字段。

## 修改

- OpenClaw 图片任务提供参考图时默认将其作为图像输入发送给 Provider。
- 仅显式传入 `referenceImageMode: "prompt_only"` 时忽略参考图，完全按文字生成。
- `create_design_work` 增加常见参数名 `prompt`，并映射到现有 `additionalInstruction`；旧 `styleHint` 继续兼容。
- 保留自由生图的冲突处理规则：用户明确指定不同主体或场景时以文字要求为准，参考图继续参与构图、光线、材质和风格参考。
- 为确认 MCP 入参到 Provider 的传递链路，临时增加了脱敏诊断；post-fix 对照完成并经用户确认后，已移除本次临时插桩及调试环境文件。
- 同步修正 MCP 工具说明、WorkBuddy Skill 路由文档及设计工作台地图。
- 将先前的 `prompt_only` 默认策略记录标注为已纠正，避免其继续作为有效修复方案引用。

## 影响范围

- 只影响 OpenClaw `create_design_work` 图片任务的参考图默认转发与 prompt 字段兼容映射。
- 不改变 Provider/model 选择、数据库结构、其它设计模块或历史作品。
- 已确认的根因为 MCP 调用传入 `prompt`，而入口此前只识别 `additionalInstruction/styleHint`，导致用户要求未进入最终 prompt。兼容映射修复后，用户实测确认 prompt 生效。

## 验证

- pre-fix 诊断：MCP 指令长度为 0；Provider prompt 不含目标主体关键词，但仍发送 1 张参考图，`gpt-image-2` 返回 HTTP 200。这说明此前不能归因于模型收到 prompt 后不遵从，因为用户指令根本没有到达模型。
- post-fix 脱敏日志：MCP 选中 `prompt` 字段，指令长度 656；服务层、组装 prompt、Provider 请求和 `revised_prompt` 均包含猫、护士、医院及拟人化关键词。
- 同一 post-fix 请求使用 `provider_runtime_image_duoyuanx_unified` / `gpt-image-2`、`images-generations`，请求中 `referenceImageCount` 为 1，响应 HTTP 200，任务状态为 `SUCCESS`。
- 用户随后确认：“prompt生效了，全部都好了。”
- 诊断日志、环境文件和 `image-prompt-wire` 临时插桩已在确认后清理；本变更记录保留脱敏后的结论，不保留 prompt 原文或图片。
- `npm --workspace apps/server run build`：通过。
- `docker compose -f docker/docker-compose.local-postgres.yml build server` 与 server 重建：通过。
- `http://127.0.0.1:13011/api/health`：返回 `status: ok`，PostgreSQL `database-ready`。
- 临时插桩清理后的 `npm --workspace apps/server run build`：通过；本次相关代码 `git diff --check` 通过。
