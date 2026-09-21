"use client";

import { useEffect, useMemo, useState } from "react";
import { type DouyinHotTopicCandidatesRecord, type DouyinHotTopicCandidatesTaskRecord, type DouyinTopicLibraryItem } from "../../../services/reports";
import { type OptionalDateFormatter } from "../xiaohongshu/shared-types";

const TOPIC_LIBRARY_PAGE_SIZE = 20;

export interface DouyinTopicLibraryWorkspaceProps {
  sectionLabel: string;
  sectionDescription: string;
  isLoading: boolean;
  canEdit: boolean;
  items: DouyinTopicLibraryItem[];
  isSaving: boolean;
  onRefresh: () => void | Promise<void>;
  onSaveTopic: (item: DouyinTopicLibraryItem) => void | Promise<void>;
  onDeleteTopic: (topicId: string) => void | Promise<void>;
  formatDateTime: OptionalDateFormatter;
  hotTopicProps?: {
    canEdit: boolean;
    availableDates: string[];
    selectedDate: string;
    latest?: DouyinHotTopicCandidatesRecord;
    latestTask?: DouyinHotTopicCandidatesTaskRecord;
    selectedTopicIds: string[];
    isSavingTopicLibrary: boolean;
    onRefresh: () => void | Promise<void>;
    onDateChange: (date: string) => void | Promise<void>;
    onGenerate: () => void | Promise<void>;
    onToggleTopic: (topicId: string, checked: boolean) => void;
    onAddSelectedTopics: () => void | Promise<void>;
  };
}

type TopicEditorMode = "create" | "edit" | "view";

type TopicFormDraft = {
  id: string;
  topicTitle: string;
  topicContent: string;
  topicPlatform: DouyinTopicLibraryItem["topicPlatform"];
  contentFormat: DouyinTopicLibraryItem["contentFormat"];
  presentationFormat: string;
  topicGoal: string;
  expertSkill: string;
  reusable: boolean;
  reuseCycle: string;
  topicDescription: string;
  selectedAt: string;
  source?: DouyinTopicLibraryItem["source"];
  sourceDate?: string;
  matchedExplosiveTemplateHtmlsText: string;
};

const TOPIC_PLATFORM_OPTIONS: Array<DouyinTopicLibraryItem["topicPlatform"]> = ["抖音", "视频号", "小红书", "公众号"];
const CONTENT_FORMAT_OPTIONS: Array<DouyinTopicLibraryItem["contentFormat"]> = ["图文", "视频", "长文章"];

function getHotTopicTaskStatusClass(status?: DouyinHotTopicCandidatesTaskRecord["taskStatus"]) {
  if (status === "SUCCESS") {
    return "status-ready";
  }
  if (status === "RUNNING" || status === "QUEUED" || status === "PENDING") {
    return "status-in_progress";
  }
  return "status-pending";
}

function getHotTopicTaskStatusText(task?: DouyinHotTopicCandidatesTaskRecord) {
  if (!task) {
    return "暂无任务";
  }
  if (task.taskStatus === "SUCCESS") {
    return "已完成";
  }
  if (task.taskStatus === "RUNNING") {
    return "生成中";
  }
  if (task.taskStatus === "QUEUED" || task.taskStatus === "PENDING") {
    return "排队中";
  }
  if (task.taskStatus === "FAILED") {
    return "失败";
  }
  if (task.taskStatus === "CANCELLED") {
    return "已取消";
  }
  return task.taskStatus;
}

function getTopicSourceLabel(source?: DouyinTopicLibraryItem["source"]) {
  if (source === "GENERATED") {
    return "热点生成";
  }
  if (source === "OPENCLAW") {
    return "OpenClaw";
  }
  return "人工创建";
}

function createTopicFormDraft(item?: DouyinTopicLibraryItem): TopicFormDraft {
  return {
    id: item?.id || `topic-library-${Date.now()}`,
    topicTitle: item?.topicTitle || item?.topicContent || "",
    topicContent: item?.topicContent || "",
    topicPlatform: item?.topicPlatform || "抖音",
    contentFormat: item?.contentFormat || "视频",
    presentationFormat: item?.presentationFormat || "",
    topicGoal: item?.topicGoal || "",
    expertSkill: item?.expertSkill || "",
    reusable: Boolean(item?.reusable),
    reuseCycle: item?.reuseCycle || "",
    topicDescription: item?.topicDescription || "",
    selectedAt: item?.selectedAt || new Date().toISOString(),
    source: item?.source,
    sourceDate: item?.sourceDate,
    matchedExplosiveTemplateHtmlsText: Array.isArray(item?.matchedExplosiveTemplateHtmls)
      ? item?.matchedExplosiveTemplateHtmls.join("\n\n")
      : "",
  };
}

export function DouyinTopicLibraryWorkspace(props: DouyinTopicLibraryWorkspaceProps) {
  const [page, setPage] = useState(1);
  const [isHotTopicExpanded, setIsHotTopicExpanded] = useState(true);
  const [editorMode, setEditorMode] = useState<TopicEditorMode | null>(null);
  const [draft, setDraft] = useState<TopicFormDraft>(() => createTopicFormDraft());

  const hotProps = props.hotTopicProps;
  const isHotTopicTaskActive =
    hotProps?.latestTask?.taskStatus === "RUNNING"
    || hotProps?.latestTask?.taskStatus === "QUEUED"
    || hotProps?.latestTask?.taskStatus === "PENDING";
  const canAddSelectedTopics = useMemo(
    () => Boolean(hotProps?.selectedTopicIds.length && hotProps?.latest?.items?.length),
    [hotProps?.selectedTopicIds.length, hotProps?.latest?.items?.length],
  );

  const pageCount = Math.max(1, Math.ceil(props.items.length / TOPIC_LIBRARY_PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const startIndex = (page - 1) * TOPIC_LIBRARY_PAGE_SIZE;
    return props.items.slice(startIndex, startIndex + TOPIC_LIBRARY_PAGE_SIZE);
  }, [page, props.items]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    setPage(1);
  }, [props.items.length]);

  function openCreateEditor() {
    setDraft(createTopicFormDraft());
    setEditorMode("create");
  }

  function openTopicViewer(item: DouyinTopicLibraryItem, mode: Exclude<TopicEditorMode, "create">) {
    setDraft(createTopicFormDraft(item));
    setEditorMode(mode);
  }

  function closeEditor() {
    setEditorMode(null);
    setDraft(createTopicFormDraft());
  }

  function updateDraft<K extends keyof TopicFormDraft>(key: K, value: TopicFormDraft[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === "reusable" && !value ? { reuseCycle: "" } : {}),
    }));
  }

  async function handleSaveTopic() {
    const topicTitle = draft.topicTitle.trim();
    const topicContent = draft.topicContent.trim();
    if (!topicTitle) {
      window.alert("请先填写选题标题。");
      return;
    }
    if (!topicContent) {
      window.alert("请先填写选题内容。");
      return;
    }
    if (draft.reusable && !draft.reuseCycle.trim()) {
      window.alert("已开启复用时，请填写复用周期。");
      return;
    }
    const matchedExplosiveTemplateHtmls = draft.matchedExplosiveTemplateHtmlsText
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20);
    await props.onSaveTopic({
      id: draft.id,
      topicTitle,
      topicContent,
      topicPlatform: draft.topicPlatform,
      contentFormat: draft.contentFormat,
      presentationFormat: draft.presentationFormat.trim(),
      topicGoal: draft.topicGoal.trim(),
      expertSkill: draft.expertSkill.trim(),
      reusable: draft.reusable,
      reuseCycle: draft.reusable ? draft.reuseCycle.trim() : undefined,
      selectedAt: draft.selectedAt || new Date().toISOString(),
      topicDescription: draft.topicDescription.trim()
        || draft.topicGoal.trim()
        || draft.presentationFormat.trim()
        || undefined,
      source: editorMode === "create" ? "MANUAL" : draft.source || "MANUAL",
      sourceDate: draft.sourceDate,
      matchedExplosiveTemplateHtmls: matchedExplosiveTemplateHtmls.length ? matchedExplosiveTemplateHtmls : undefined,
    });
    closeEditor();
  }

  async function handleDeleteTopic(topicId: string) {
    if (!props.canEdit) {
      return;
    }
    const confirmed = window.confirm("确定删除这条选题吗？删除后会从当前品牌选题库移除。");
    if (!confirmed) {
      return;
    }
    await props.onDeleteTopic(topicId);
  }

  return (
    <article className="workspace-panel strategy-page-card">
      <div className="strategy-card-toolbar">
        <div>
          <strong>{props.sectionLabel}</strong>
          <p className="panel-subtext">{props.sectionDescription}</p>
        </div>
        <div className="strategy-inline-actions">
          <button type="button" className="secondary-button" onClick={() => void props.onRefresh()} disabled={props.isLoading || props.isSaving}>
            刷新数据
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={openCreateEditor}
            disabled={!props.canEdit || props.isSaving}
          >
            添加选题
          </button>
        </div>
      </div>

      {hotProps ? (
        <article className="light-data-panel report-editor-panel report-editor-panel--compact">
          <div className="report-editor-head">
            <div>
              <strong>热点找选题</strong>
              <p className="panel-subtext" style={{ margin: 0 }}>
                按所选日期读取每日热点全部榜单和品牌背景资料，生成 3 个可勾选的抖音热点选题，勾选后可加入下方选题库。
              </p>
            </div>
            <div className="report-editor-actions">
              {hotProps.latestTask ? (
                <span className={`archive-pill ${getHotTopicTaskStatusClass(hotProps.latestTask.taskStatus)}`}>{getHotTopicTaskStatusText(hotProps.latestTask)}</span>
              ) : null}
              {hotProps.latest?.generatedAt ? (
                <span className="archive-pill status-ready">{props.formatDateTime(hotProps.latest.generatedAt)}</span>
              ) : null}
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsHotTopicExpanded((current) => !current)}
              >
                {isHotTopicExpanded ? "收起" : "展开"}
              </button>
            </div>
          </div>

          {isHotTopicExpanded ? (
            <>
              <div className="workspace-toolbar top-toolbar">
                <label className="workspace-status" style={{ gap: 8, alignItems: "center" }}>
                  <span className="status-text">热点日期</span>
                  <select
                    value={hotProps.selectedDate}
                    onChange={(event) => void hotProps.onDateChange(event.target.value)}
                    disabled={props.isLoading || !hotProps.availableDates.length}
                  >
                    {hotProps.availableDates.length ? null : <option value="">暂无可选日期</option>}
                    {hotProps.availableDates.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="strategy-inline-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void hotProps.onGenerate()}
                    disabled={!hotProps.canEdit || props.isLoading || !hotProps.selectedDate || !hotProps.availableDates.length || isHotTopicTaskActive}
                  >
                    {isHotTopicTaskActive ? "后台生成中..." : hotProps.latest ? "重新生成" : "一键生成"}
                  </button>
                </div>
              </div>

              {!hotProps.availableDates.length ? (
                <div className="note-empty-state">当前还没有可用热点日期。请先到品牌增长策略里的"每日热点"同步当天榜单。</div>
              ) : null}
              {isHotTopicTaskActive ? (
                <div className="report-inline-tip">
                  {hotProps.latestTask?.phaseText
                    ? `${hotProps.latestTask.phaseText}${hotProps.latestTask.phaseIndex && hotProps.latestTask.phaseTotal ? `（${hotProps.latestTask.phaseIndex}/${hotProps.latestTask.phaseTotal}）` : ""}`
                    : "正在后台生成热点选题，完成后会自动刷新结果。"}
                </div>
              ) : null}

              {hotProps.latest?.items?.length ? (
                <div className="xhs-material-library" style={{ display: "grid", gap: 12 }}>
                  <div className="xhs-material-card-grid">
                    {hotProps.latest.items.map((item, index) => {
                      const checked = hotProps.selectedTopicIds.includes(item.id);
                      return (
                        <label key={item.id} className="light-data-panel" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => hotProps.onToggleTopic(item.id, event.target.checked)}
                          />
                          <div style={{ display: "grid", gap: 8 }}>
                            <strong>{`选题 ${index + 1}`}</strong>
                            <div>{item.title}</div>
                            <p className="panel-subtext" style={{ margin: 0 }}>
                              {item.description || hotProps.latest?.summary || "该选题说明将在生成后展示。"}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div className="strategy-inline-actions" style={{ justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void hotProps.onAddSelectedTopics()}
                      disabled={!props.canEdit || hotProps.isSavingTopicLibrary || !canAddSelectedTopics}
                    >
                      加入选题库
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </article>
      ) : null}

      <article className="light-data-panel report-editor-panel report-editor-panel--compact">
        <div className="report-editor-head">
          <div>
            <strong>选题库</strong>
            <p className="panel-subtext" style={{ margin: 0 }}>
              当前品牌独立存储的人机共创选题库，人工创建与 OpenClaw 写入的选题都会沉淀到同一份结构化记录里。
            </p>
          </div>
          <div className="report-editor-actions">
            <span className={`archive-pill ${props.items.length ? "status-ready" : "status-pending"}`}>共 {props.items.length} 条</span>
            <span className="archive-pill status-pending">每页 20 条</span>
            <span className={`archive-pill ${props.canEdit ? "status-ready" : "status-pending"}`}>
              {props.canEdit ? "当前板块可编辑" : "当前板块只读"}
            </span>
          </div>
        </div>

        {!props.canEdit ? <div className="report-inline-tip">当前账号只有查看权限，不能新增品牌选题。</div> : null}

        {editorMode ? (
          <section className="light-data-panel" style={{ display: "grid", gap: 12 }}>
            <div className="report-editor-head">
              <strong>
                {editorMode === "create" ? "新增选题" : editorMode === "edit" ? "编辑选题" : "查看选题"}
              </strong>
              <span className={`archive-pill ${editorMode === "view" ? "status-pending" : "status-ready"}`}>
                {editorMode === "view" ? "只读" : "可编辑"}
              </span>
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="status-text">选题标题</span>
              <input
                value={draft.topicTitle}
                onChange={(event) => updateDraft("topicTitle", event.target.value)}
                placeholder="例如：秋季新品如何用短剧情境带货"
                disabled={props.isSaving || editorMode === "view"}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="status-text">选题内容</span>
              <textarea
                value={draft.topicContent}
                onChange={(event) => updateDraft("topicContent", event.target.value)}
                placeholder="请输入选题要点、脚本方向或核心表达"
                rows={3}
                disabled={props.isSaving || editorMode === "view"}
              />
            </label>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="status-text">选题平台</span>
                <select
                  value={draft.topicPlatform}
                  onChange={(event) => updateDraft("topicPlatform", event.target.value as TopicFormDraft["topicPlatform"])}
                  disabled={props.isSaving || editorMode === "view"}
                >
                  {TOPIC_PLATFORM_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="status-text">内容形式</span>
                <select
                  value={draft.contentFormat}
                  onChange={(event) => updateDraft("contentFormat", event.target.value as TopicFormDraft["contentFormat"])}
                  disabled={props.isSaving || editorMode === "view"}
                >
                  {CONTENT_FORMAT_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="status-text">是否可复用</span>
                <select
                  value={draft.reusable ? "yes" : "no"}
                  onChange={(event) => updateDraft("reusable", event.target.value === "yes")}
                  disabled={props.isSaving || editorMode === "view"}
                >
                  <option value="no">否</option>
                  <option value="yes">是</option>
                </select>
              </label>
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="status-text">呈现形式</span>
              <textarea
                value={draft.presentationFormat}
                onChange={(event) => updateDraft("presentationFormat", event.target.value)}
                placeholder="例如：通过剧情短片带出产品卖点，再引导门店转化"
                rows={2}
                disabled={props.isSaving || editorMode === "view"}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="status-text">选题目的</span>
              <textarea
                value={draft.topicGoal}
                onChange={(event) => updateDraft("topicGoal", event.target.value)}
                placeholder="例如：提升产品销量及品牌曝光"
                rows={2}
                disabled={props.isSaving || editorMode === "view"}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="status-text">调用专家/技能</span>
              <input
                value={draft.expertSkill}
                onChange={(event) => updateDraft("expertSkill", event.target.value)}
                placeholder="例如：本地商家抖音增长专家 / 爆款脚本技能"
                disabled={props.isSaving || editorMode === "view"}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="status-text">匹配爆款模板（支持多个 HTML）</span>
              <textarea
                value={draft.matchedExplosiveTemplateHtmlsText}
                onChange={(event) => updateDraft("matchedExplosiveTemplateHtmlsText", event.target.value)}
                placeholder={"每段 HTML 之间请空一行分隔\n例如：<article>...</article>\n\n<section>...</section>"}
                rows={6}
                disabled={props.isSaving || editorMode === "view"}
              />
              <span className="panel-subtext">当前解析数量：{
                draft.matchedExplosiveTemplateHtmlsText
                  .split(/\n{2,}/)
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .length
              }（最多 20 条）</span>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="status-text">复用周期</span>
              <input
                value={draft.reuseCycle}
                onChange={(event) => updateDraft("reuseCycle", event.target.value)}
                placeholder={draft.reusable ? "例如：每周一次 / 每月一次" : "未开启复用时可留空"}
                disabled={props.isSaving || editorMode === "view" || !draft.reusable}
              />
            </label>
            {editorMode !== "create" ? (
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div className="report-inline-tip">来源：{getTopicSourceLabel(draft.source)}</div>
                <div className="report-inline-tip">入库时间：{props.formatDateTime(draft.selectedAt)}</div>
              </div>
            ) : null}
            <div className="strategy-inline-actions" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="secondary-button" onClick={closeEditor} disabled={props.isSaving}>
                {editorMode === "view" ? "关闭" : "取消"}
              </button>
              {editorMode === "view" ? null : (
                <button type="button" className="primary-button" onClick={() => void handleSaveTopic()} disabled={!props.canEdit || props.isSaving}>
                  保存选题
                </button>
              )}
            </div>
          </section>
        ) : null}

        {!props.items.length ? (
          <div className="note-empty-state">
            {hotProps
              ? '当前品牌选题库还没有内容。请先从上方"热点找选题"勾选加入，或点击右上角"添加选题"手动补充，也可以由 OpenClaw 直接写入。'
              : '当前品牌选题库还没有内容。请点击右上角"添加选题"手动补充，或由 OpenClaw 直接写入。'}
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="soft-table douyin-data-table douyin-topic-library-table">
                <thead>
                  <tr>
                    <th>选题</th>
                    <th>平台 / 形式</th>
                    <th>目的 / 复用</th>
                    <th>来源</th>
                    <th>入库时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item) => (
                    <tr key={item.id}>
                      <td className="table-cell-wide">
                        <div style={{ display: "grid", gap: 6 }}>
                          <strong>{item.topicTitle || item.topicContent || "-"}</strong>
                          <div>{item.topicContent || "-"}</div>
                          {item.presentationFormat ? (
                            <p className="panel-subtext" style={{ margin: 0 }}>
                              {item.presentationFormat}
                            </p>
                          ) : null}
                          {item.matchedExplosiveTemplateHtmls?.length ? (
                            <p className="panel-subtext" style={{ margin: 0 }}>
                              已匹配爆款模板：{item.matchedExplosiveTemplateHtmls.length} 条
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "grid", gap: 6 }}>
                          <span>{item.topicPlatform}</span>
                          <span className="panel-subtext">{item.contentFormat}</span>
                          {item.expertSkill ? <span className="panel-subtext">{item.expertSkill}</span> : null}
                        </div>
                      </td>
                      <td className="table-cell-wide">
                        <div style={{ display: "grid", gap: 6 }}>
                          <span>{item.topicGoal || "-"}</span>
                          <span className="panel-subtext">
                            {item.reusable ? `可复用${item.reuseCycle ? ` · ${item.reuseCycle}` : ""}` : "不复用"}
                          </span>
                        </div>
                      </td>
                      <td>{getTopicSourceLabel(item.source)}</td>
                      <td>{props.formatDateTime(item.selectedAt)}</td>
                      <td>
                        <div className="strategy-inline-actions" style={{ justifyContent: "flex-start" }}>
                          <button
                            type="button"
                            className="note-inline-button"
                            onClick={() => openTopicViewer(item, "view")}
                          >
                            查看
                          </button>
                          <button
                            type="button"
                            className="note-inline-button"
                            onClick={() => openTopicViewer(item, "edit")}
                            disabled={!props.canEdit || props.isSaving}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="note-inline-button"
                            onClick={() => void handleDeleteTopic(item.id)}
                            disabled={!props.canEdit || props.isSaving}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {props.items.length > TOPIC_LIBRARY_PAGE_SIZE ? (
              <div className="note-pagination-bar hotspot-pagination-bar">
                <div className="note-pagination-summary">
                  <span>第 {page} / {pageCount} 页</span>
                  <span>当前显示 {paginatedItems.length} 条</span>
                </div>
                <div className="note-pagination-actions">
                  <button
                    type="button"
                    className="note-inline-button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                  >
                    上一页
                  </button>
                  {Array.from({ length: pageCount }, (_, index) => index + 1).map((currentPage) => (
                    <button
                      key={`topic-library-page-${currentPage}`}
                      type="button"
                      className={`note-page-button ${currentPage === page ? "is-active" : ""}`}
                      onClick={() => setPage(currentPage)}
                    >
                      {currentPage}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="note-inline-button"
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    disabled={page === pageCount}
                  >
                    下一页
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </article>
    </article>
  );
}
