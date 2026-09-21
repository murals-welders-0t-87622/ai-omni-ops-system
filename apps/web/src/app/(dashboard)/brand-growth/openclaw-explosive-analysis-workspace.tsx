"use client";

import { useEffect, useMemo, useState } from "react";
import { OpenClawCommentThread } from "./openclaw-comment-thread";
import { type OpenClawExplosiveAnalysisRecord } from "../../../services/openclaw";

const PAGE_SIZE = 20;

type OptionalDateFormatter = (value?: string) => string;

export interface OpenClawExplosiveAnalysisWorkspaceProps {
  sectionLabel: string;
  sectionDescription: string;
  isLoading: boolean;
  canDelete: boolean;
  items: OpenClawExplosiveAnalysisRecord[];
  deletingRecordId?: string;
  onRefresh: () => void | Promise<void>;
  onDelete: (recordId: string) => void | Promise<void>;
  formatDateTime: OptionalDateFormatter;
}

function buildHtmlPreview(record?: OpenClawExplosiveAnalysisRecord) {
  if (!record?.htmlContent) {
    return "";
  }
  return URL.createObjectURL(new Blob([record.htmlContent], { type: "text/html;charset=utf-8" }));
}

export function OpenClawExplosiveAnalysisWorkspace(props: OpenClawExplosiveAnalysisWorkspaceProps) {
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<OpenClawExplosiveAnalysisRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const pageCount = Math.max(1, Math.ceil(props.items.length / PAGE_SIZE));
  const pagedItems = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return props.items.slice(startIndex, startIndex + PAGE_SIZE);
  }, [page, props.items]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    setPage(1);
  }, [props.items.length]);

  useEffect(() => {
    if (!selectedRecord) {
      setPreviewUrl("");
      return;
    }
    const nextUrl = buildHtmlPreview(selectedRecord);
    setPreviewUrl(nextUrl);
    return () => {
      if (nextUrl) {
        URL.revokeObjectURL(nextUrl);
      }
    };
  }, [selectedRecord]);

  function openHtmlInNewWindow() {
    if (!previewUrl) {
      return;
    }
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(recordId: string) {
    if (!props.canDelete) {
      return;
    }
    const confirmed = window.confirm("确定删除这条爆款拆解吗？删除后将无法恢复。");
    if (!confirmed) {
      return;
    }
    if (selectedRecord?.id === recordId) {
      setSelectedRecord(null);
    }
    await props.onDelete(recordId);
  }

  return (
    <>
      <article className="workspace-panel strategy-page-card">
        <div className="strategy-card-toolbar">
          <div>
            <strong>{props.sectionLabel}</strong>
            <p className="panel-subtext">{props.sectionDescription}</p>
          </div>
          <div className="strategy-inline-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void props.onRefresh()}
              disabled={props.isLoading}
            >
              刷新数据
            </button>
          </div>
        </div>

        <article className="light-data-panel report-editor-panel report-editor-panel--compact">
          <div className="report-editor-head">
            <div>
              <strong>爆款拆解列表</strong>
              <p className="panel-subtext" style={{ margin: 0 }}>
                当前板块只承接 OpenClaw 提交的爆款拆解 HTML，支持列表查看、打开 HTML 和详情留言。
              </p>
            </div>
            <div className="report-editor-actions">
              <span className={`archive-pill ${props.items.length ? "status-ready" : "status-pending"}`}>共 {props.items.length} 条</span>
              <span className="archive-pill status-pending">每页 20 条</span>
              <span className={`archive-pill ${props.canDelete ? "status-ready" : "status-pending"}`}>
                {props.canDelete ? "支持删除" : "当前只读"}
              </span>
            </div>
          </div>

          {!props.items.length ? (
            <div className="note-empty-state">当前还没有爆款拆解，等待 OpenClaw 提交首条记录。</div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table className="soft-table openclaw-record-table">
                  <thead>
                    <tr>
                      <th>标题</th>
                      <th>标签</th>
                      <th>内容</th>
                      <th>作者</th>
                      <th>作品链接</th>
                      <th>视频文案</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedItems.map((item) => (
                      <tr key={item.id}>
                        <td className="openclaw-record-table__text-cell">
                          <div className="openclaw-record-table__text" title={item.title}>{item.title || "-"}</div>
                        </td>
                        <td className="table-cell-wide">
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {item.tags.length ? item.tags.map((tag) => (
                              <span key={`${item.id}-${tag}`} className="archive-pill status-pending">{tag}</span>
                            )) : <span>-</span>}
                          </div>
                        </td>
                        <td className="table-cell-wide">
                          {item.htmlContent ? (
                            <div
                              style={{ maxWidth: 280, maxHeight: 88, overflow: "hidden" }}
                              dangerouslySetInnerHTML={{ __html: item.htmlContent }}
                            />
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="openclaw-record-table__text-cell">
                          <span className="openclaw-record-table__text" title={item.authorName}>{item.authorName || "-"}</span>
                        </td>
                        <td className="openclaw-record-table__text-cell">
                          {item.workUrl ? (
                            <a href={item.workUrl} target="_blank" rel="noreferrer" className="note-inline-button">
                              打开作品
                            </a>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td className="table-cell-wide">
                          <span className="openclaw-record-table__text" title={item.videoCopy}>{item.videoCopy || "-"}</span>
                        </td>
                        <td className="openclaw-record-table__action-cell">
                          <div className="openclaw-record-table__actions">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => setSelectedRecord(item)}
                            >
                              查看
                            </button>
                            <button
                              type="button"
                              className="note-inline-button"
                              onClick={() => void handleDelete(item.id)}
                              disabled={!props.canDelete || props.deletingRecordId === item.id}
                            >
                              {props.deletingRecordId === item.id ? "删除中..." : "删除"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {props.items.length > PAGE_SIZE ? (
                <div className="note-pagination-bar hotspot-pagination-bar">
                  <div className="note-pagination-summary">
                    <span>第 {page} / {pageCount} 页</span>
                    <span>当前显示 {pagedItems.length} 条</span>
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
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                      <button
                        key={`explosive-analysis-page-${pageNumber}`}
                        type="button"
                        className={`note-page-button ${pageNumber === page ? "is-active" : ""}`}
                        onClick={() => setPage(pageNumber)}
                      >
                        {pageNumber}
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

      {selectedRecord ? (
        <div className="openclaw-diary-dialog-backdrop" onClick={() => setSelectedRecord(null)}>
          <div className="openclaw-diary-dialog" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 1160 }}>
            <div className="openclaw-diary-dialog__head">
              <div>
                <strong>{selectedRecord.title || "爆款拆解"}</strong>
                <p>HTML 页面预览 · 创建于 {props.formatDateTime(selectedRecord.createdAt)}</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="primary-button" onClick={openHtmlInNewWindow} disabled={!previewUrl}>
                  打开 HTML
                </button>
                <button type="button" className="secondary-button" onClick={() => setSelectedRecord(null)}>
                  关闭
                </button>
              </div>
            </div>
            <div className="openclaw-diary-dialog__meta">
              <span>作者：{selectedRecord.authorName || "-"}</span>
              <span>作品链接：{selectedRecord.workUrl || "-"}</span>
              <span>更新时间：{props.formatDateTime(selectedRecord.updatedAt)}</span>
            </div>
            {selectedRecord.tags.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {selectedRecord.tags.map((tag) => (
                  <span key={`${selectedRecord.id}-${tag}-detail`} className="archive-pill status-pending">{tag}</span>
                ))}
              </div>
            ) : null}
            <div className="openclaw-diary-dialog__content" style={{ display: "grid", gap: 12 }}>
              <div className="panel-subtext">HTML 预览</div>
              {previewUrl ? (
                <iframe
                  title={`${selectedRecord.title || "爆款拆解"} HTML 预览`}
                  src={previewUrl}
                  style={{ width: "100%", minHeight: 520, border: "1px solid rgba(148, 163, 184, 0.28)", borderRadius: 16, background: "#fff" }}
                />
              ) : (
                <div className="note-empty-state">当前 HTML 内容为空，暂时无法预览。</div>
              )}
              <div className="panel-subtext">视频文案</div>
              <div className="openclaw-diary-dialog__content" style={{ minHeight: 0 }}>{selectedRecord.videoCopy || "暂无视频文案"}</div>
            </div>
            <OpenClawCommentThread
              brandId={selectedRecord.brandId}
              workspaceScope={selectedRecord.workspaceScope}
              resourceType="explosive_analysis"
              resourceId={selectedRecord.id}
              formatDateTime={props.formatDateTime}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
