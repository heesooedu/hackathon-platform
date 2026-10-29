'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ParsedLessonMaterial } from '@/utils/materialPayload';
import {
  markdownToBlocks,
  blocksToMarkdown,
  getBlockImages,
  groupBlocksIntoRows,
  getNormalizedColumnWidths,
  getNormalizedStackHeights,
  extractYouTubeVideoId,
  normalizeExternalUrl,
  getBulletMarkerMeta,
  NotionBlock,
} from '@/utils/notionBlocks';
import NotionBlockEditor from '@/components/NotionBlockEditor';
import MermaidDiagram from '@/components/MermaidDiagram';
import SimulationBlockPreview from '@/components/SimulationBlockPreview';
import ColabRunnerBlock from '@/components/ColabRunnerBlock';
import VPythonRunnerBlock from '@/components/VPythonRunnerBlock';
import PhysicalComputingBlock from '@/components/PhysicalComputingBlock';
import DataAnalysisBlock from '@/components/DataAnalysisBlock';
import AiLabBlock from '@/components/AiLabBlock';
import InlineQuizBlockView from '@/components/InlineQuizBlockView';
import {
  updateLessonMaterialAction,
  clearLessonMaterialAction,
  removeMaterialPatchAction,
  parseMaterialFileAction,
} from '@/app/lessons/actions';
import { FormativeQuiz, MaterialType } from '@/types/database.types';

interface LessonMaterialViewerProps {
  lessonId: string;
  classId: string;
  isTeacher: boolean;
  material: ParsedLessonMaterial;
  currentUserId?: string;
  inlineQuizzesMap?: Record<string, FormativeQuiz>;
}

/**
 * 마크다운 인라인 문법(**굵게**, ==형광펜==, ++밑줄++, *기울임*, `코드`, [링크](URL), 순수 URL)을 안전하게 렌더링합니다.
 */
export function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokenRegex =
    /(\[[^\]]+\]\([^)\s]+\)|\*\*==[^=*]+==\*\*|==\*\*[^=*]+\*\*==|\*\*[^*]+\*\*|==[^=]+==|\+\+[^+]+\+\+|`[^`]+`|\*[^*\n]+\*|https?:\/\/[^\s<]+)/g;
  const parts = text.split(tokenRegex);
  return parts.map((part, idx) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (linkMatch) {
      const label = linkMatch[1];
      const href = normalizeExternalUrl(linkMatch[2]);
      return (
        <a
          key={idx}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 font-semibold text-blue-600 underline decoration-blue-400 underline-offset-4 hover:text-blue-800 break-all"
        >
          <span>{label}</span>
          <span className="text-[11px] opacity-80 select-none">↗</span>
        </a>
      );
    }
    if (/^https?:\/\/[^\s<]+$/i.test(part)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 font-semibold text-blue-600 underline decoration-blue-400 underline-offset-4 hover:text-blue-800 break-all"
        >
          <span>{part}</span>
          <span className="text-[11px] opacity-80 select-none">↗</span>
        </a>
      );
    }
    if (
      (part.startsWith('**==') && part.endsWith('==**')) ||
      (part.startsWith('==**') && part.endsWith('**=='))
    ) {
      return (
        <mark
          key={idx}
          className="rounded bg-amber-200/90 px-1 py-0.5 font-extrabold text-gray-950"
        >
          {part.slice(4, -4)}
        </mark>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-extrabold text-gray-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('==') && part.endsWith('==')) {
      return (
        <mark
          key={idx}
          className="rounded bg-amber-200/85 px-1 py-0.5 font-semibold text-gray-900"
        >
          {part.slice(2, -2)}
        </mark>
      );
    }
    if (part.startsWith('++') && part.endsWith('++')) {
      return (
        <span
          key={idx}
          className="underline decoration-indigo-500 decoration-2 underline-offset-4"
        >
          {part.slice(2, -2)}
        </span>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="rounded bg-gray-100 border border-gray-200/80 px-1.5 py-0.5 font-mono text-xs text-indigo-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic text-gray-800">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

/**
 * 노션 스타일 교안 블록 렌더러
 * (제목 H1~H3, 콜아웃 박스, 인용구/제시문, 드래그 앤 드롭 이미지 및 캡션, 글머리 기호, 구분선 지원)
 */
export function SimpleMarkdownRenderer({
  content,
  lessonId,
  classId,
  currentUserId,
  isTeacher = false,
  inlineQuizzesMap,
}: {
  content: string;
  lessonId?: string;
  classId?: string;
  currentUserId?: string;
  isTeacher?: boolean;
  inlineQuizzesMap?: Record<string, FormativeQuiz>;
}) {
  const blocks = markdownToBlocks(content);
  const rowGroups = groupBlocksIntoRows(blocks);

  const renderSingleBlock = (
    block: NotionBlock,
    isInMultiColumnRow: boolean
  ) => {
    if (block.type === 'divider') {
      return <hr key={block.id} className="my-5 border-gray-200" />;
    }

    if (block.type === 'h1') {
      return (
        <h3
          key={block.id}
          className="text-xl font-extrabold text-gray-900 pt-3 pb-1.5 border-b border-gray-100 tracking-tight leading-snug whitespace-pre-wrap"
        >
          {renderInlineMarkdown(block.content)}
        </h3>
      );
    }

    if (block.type === 'h2') {
      return (
        <h4
          key={block.id}
          className="text-base font-bold text-indigo-950 pt-2 flex items-start gap-2 leading-snug whitespace-pre-wrap"
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
          <span>{renderInlineMarkdown(block.content)}</span>
        </h4>
      );
    }

    if (block.type === 'h3') {
      return (
        <h5
          key={block.id}
          className="text-sm font-bold text-gray-900 pt-1 leading-snug whitespace-pre-wrap"
        >
          {renderInlineMarkdown(block.content)}
        </h5>
      );
    }

    if (block.type === 'bullet') {
      const bulletMeta = getBulletMarkerMeta(block.indentLevel || 0);
      return (
        <div
          key={block.id}
          className="flex items-start gap-2.5 transition-all"
          style={{ paddingLeft: `${bulletMeta.level * 24 + 8}px` }}
        >
          <span
            className={`${bulletMeta.colorClass} ${bulletMeta.fontSizeClass} font-bold select-none mt-0.5 w-4 text-center shrink-0`}
          >
            {bulletMeta.symbol}
          </span>
          <div className="flex-1 leading-snug whitespace-pre-wrap">
            {renderInlineMarkdown(block.content)}
          </div>
        </div>
      );
    }

    if (block.type === 'callout') {
      return (
        <div
          key={block.id}
          className="flex items-start gap-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 p-4 my-2 shadow-2xs"
        >
          <span className="text-xl select-none shrink-0 mt-0.5">
            {block.icon || '💡'}
          </span>
          <div className="flex-1 text-sm font-medium text-gray-900 leading-snug whitespace-pre-wrap">
            {renderInlineMarkdown(block.content)}
          </div>
        </div>
      );
    }

    if (block.type === 'quote') {
      return (
        <blockquote
          key={block.id}
          className="border-l-4 border-indigo-400 bg-slate-50/80 pl-4 pr-4 py-2.5 my-2 rounded-r-xl text-sm text-gray-700 italic leading-snug whitespace-pre-wrap"
        >
          {renderInlineMarkdown(block.content)}
        </blockquote>
      );
    }

    if (block.type === 'code') {
      const langLabel = (block.language || 'python').toUpperCase();
      return (
        <div
          key={block.id}
          className="my-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500/80" />
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 rounded-md bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-300">
                {langLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(block.content);
                }
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              📋 코드 복사
            </button>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 text-slate-100">
            <code>{block.content}</code>
          </pre>
        </div>
      );
    }

    if (block.type === 'mermaid') {
      return (
        <div
          key={block.id}
          className="my-2 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/30 to-white p-4 shadow-2xs"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
              <span>❖</span>
              <span>순서도 / 다이어그램</span>
            </span>
          </div>
          <MermaidDiagram chart={block.content} />
        </div>
      );
    }

    if (block.type === 'simulation') {
      return (
        <SimulationBlockPreview
          key={block.id}
          code={block.content}
          caption={block.caption}
        />
      );
    }

    if (block.type === 'colab') {
      return (
        <ColabRunnerBlock
          key={block.id}
          code={block.content}
          caption={block.caption}
          externalUrl={block.externalUrl}
        />
      );
    }

    if (block.type === 'vpython') {
      return (
        <VPythonRunnerBlock
          key={block.id}
          initialCode={block.content}
          title={block.caption}
          externalUrl={block.externalUrl}
        />
      );
    }

    if (block.type === 'physical') {
      return (
        <PhysicalComputingBlock
          key={block.id}
          rawContent={block.content}
          caption={block.caption}
          externalUrl={block.externalUrl}
        />
      );
    }

    if (block.type === 'data_analysis') {
      return (
        <DataAnalysisBlock
          key={block.id}
          rawContent={block.content}
          caption={block.caption}
        />
      );
    }

    if (block.type === 'ai_lab') {
      return (
        <AiLabBlock
          key={block.id}
          rawContent={block.content}
          caption={block.caption}
        />
      );
    }

    if (block.type === 'quiz') {
      const rawJson = block.quizData
        ? JSON.stringify(block.quizData)
        : block.content;
      return (
        <InlineQuizBlockView
          key={block.id}
          rawJson={rawJson}
          lessonId={lessonId}
          classId={classId}
          currentUserId={currentUserId}
          isTeacher={isTeacher}
          inlineQuizzesMap={inlineQuizzesMap}
        />
      );
    }

    if (block.type === 'table') {
      const rows = block.tableRows || [];
      if (rows.length === 0) return null;
      const hasHeader = block.hasTableHeader !== false;
      const colWidths = block.tableColWidths || [];
      const rowHeights = block.tableRowHeights || [];
      const hasCustomColWidths = colWidths.some((w) => typeof w === 'number' && w > 0);

      return (
        <div
          key={block.id}
          className="my-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-2xs"
        >
          <table
            className="w-full border-collapse text-left text-sm"
            style={hasCustomColWidths ? { tableLayout: 'fixed' } : undefined}
          >
            {hasHeader && rows.length > 0 && (
              <thead>
                <tr
                  className="border-b border-gray-200 bg-slate-50/90"
                  style={
                    rowHeights[0] && rowHeights[0] > 0
                      ? { height: `${rowHeights[0]}px` }
                      : undefined
                  }
                >
                  {rows[0].map((cell, cIdx) => {
                    const cw = colWidths[cIdx];
                    return (
                      <th
                        key={cIdx}
                        style={
                          cw && cw > 0
                            ? { width: `${cw}px`, minWidth: `${cw}px` }
                            : undefined
                        }
                        className="border-r border-gray-200 last:border-r-0 px-4 py-2.5 font-extrabold text-gray-900 leading-snug whitespace-pre-wrap break-words"
                      >
                        {renderInlineMarkdown(cell)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-gray-200">
              {(hasHeader ? rows.slice(1) : rows).map((row, rIdx) => {
                const actualRowIdx = hasHeader ? rIdx + 1 : rIdx;
                const rh = rowHeights[actualRowIdx];
                return (
                  <tr
                    key={rIdx}
                    style={
                      rh && rh > 0 ? { height: `${rh}px` } : undefined
                    }
                    className="hover:bg-slate-50/40 transition-colors"
                  >
                    {row.map((cell, cIdx) => {
                      const cw = colWidths[cIdx];
                      return (
                        <td
                          key={cIdx}
                          style={
                            cw && cw > 0
                              ? { width: `${cw}px`, minWidth: `${cw}px` }
                              : undefined
                          }
                          className="border-r border-gray-200 last:border-r-0 px-4 py-2.5 text-gray-700 leading-snug whitespace-pre-wrap align-top break-words"
                        >
                          {renderInlineMarkdown(cell)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (block.type === 'youtube') {
      const rawUrl = (block.externalUrl || block.content || '').trim();
      const videoId = extractYouTubeVideoId(rawUrl);
      if (!videoId) {
        return (
          <div
            key={block.id}
            className="my-2 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-xs text-rose-700 font-medium"
          >
            ▶️ 유튜브 영상 주소가 올바르지 않거나 비어 있습니다.
          </div>
        );
      }

      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      return (
        <div
          key={block.id}
          className="my-3 overflow-hidden rounded-2xl border border-rose-200/80 bg-slate-950 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold text-white shrink-0">
                ▶ YouTube
              </span>
              <span className="truncate text-xs font-bold text-slate-100">
                {block.caption?.trim() || '수업 참고 영상'}
              </span>
            </div>
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
            >
              YouTube에서 열기 ↗
            </a>
          </div>
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0`}
              title={block.caption?.trim() || 'YouTube video player'}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      );
    }

    if (block.type === 'link') {
      const rawUrl = (block.externalUrl || block.content || '').trim();
      if (!rawUrl) return null;
      const href = normalizeExternalUrl(rawUrl);
      let hostname = href;
      try {
        hostname = new URL(href).hostname;
      } catch {
        // URL 파싱 실패 시 원본 유지
      }

      return (
        <a
          key={block.id}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="group my-2 flex items-center justify-between gap-4 rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/40 via-white to-blue-50/30 p-4 shadow-2xs hover:border-indigo-400 hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100/80 text-indigo-700 font-bold text-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              🔗
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-extrabold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
                  {block.caption?.trim() || rawUrl}
                </span>
                <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                  {hostname}
                </span>
              </div>
              {block.content?.trim() && block.content.trim() !== rawUrl && (
                <p className="mt-1 text-xs text-gray-600 line-clamp-2 whitespace-pre-wrap">
                  {block.content}
                </p>
              )}
              <p className="mt-1 truncate font-mono text-[11px] text-gray-400">
                {href}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-xl bg-white border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-colors">
            열기 ↗
          </span>
        </a>
      );
    }

    if (block.type === 'image') {
      const imgs = getBlockImages(block);
      if (imgs.length === 0) return null;

      if (imgs.length > 1) {
        const gridColsClass =
          imgs.length === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : imgs.length === 3
            ? 'grid-cols-1 sm:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

        return (
          <div
            key={block.id}
            className={`my-2 grid gap-4 ${gridColsClass} ${
              !isInMultiColumnRow &&
              typeof block.widthPercent !== 'number' &&
              block.imageSize === 'md'
                ? 'max-w-4xl mx-auto'
                : 'w-full'
            }`}
          >
            {imgs.map((imgItem, iIdx) => (
              <figure
                key={iIdx}
                className="flex flex-col items-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/70 p-2 shadow-2xs"
              >
                <div className="flex w-full items-center justify-center overflow-hidden rounded-xl bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgItem.url}
                    alt={imgItem.caption || `수업 교안 이미지 ${iIdx + 1}`}
                    className="w-full h-auto object-contain max-h-[420px]"
                  />
                </div>
                {imgItem.caption && (
                  <figcaption className="mt-2 text-xs text-gray-600 font-medium text-center px-1">
                    ▲ {renderInlineMarkdown(imgItem.caption)}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        );
      }

      const singleImg = imgs[0];
      const hasCustomWidth =
        isInMultiColumnRow || typeof block.widthPercent === 'number';
      const widthClass =
        block.imageSize === 'sm'
          ? 'w-full max-w-[50%]'
          : hasCustomWidth || block.imageSize === 'full'
          ? 'w-full'
          : 'w-full max-w-[75%]';

      return (
        <figure key={block.id} className="my-2 flex flex-col items-center">
          <div
            className={`overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-xs ${widthClass}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={singleImg.url}
              alt={singleImg.caption || '수업 교안 이미지'}
              className="w-full h-auto object-contain max-h-[520px]"
            />
          </div>
          {singleImg.caption && (
            <figcaption className="mt-2 text-xs text-gray-500 font-medium text-center">
              ▲ {renderInlineMarkdown(singleImg.caption)}
            </figcaption>
          )}
        </figure>
      );
    }

    if (!block.content) {
      return (
        <div
          key={block.id}
          className="h-6 select-none"
          aria-hidden="true"
        >
          &nbsp;
        </div>
      );
    }

    return (
      <p key={block.id} className="text-gray-700 leading-snug whitespace-pre-wrap">
        {renderInlineMarkdown(block.content)}
      </p>
    );
  };

  return (
    <div className="space-y-3.5 text-sm text-gray-800">
      {rowGroups.map((rowGroup, gIdx) => {
        if (rowGroup.columns.length > 1) {
          const normalizedWidths = getNormalizedColumnWidths(rowGroup.columns);
          const hasStackedColumn = rowGroup.columns.some(
            (c) => c.items.length > 1
          );
          return (
            <div
              key={`${rowGroup.rowId || 'row'}_${gIdx}`}
              className={`my-3 flex flex-col md:flex-row ${
                hasStackedColumn ? 'md:items-stretch' : 'md:items-start'
              } gap-4 w-full`}
            >
              {rowGroup.columns.map((colGroup, colIdx) => {
                const wPct =
                  normalizedWidths[colIdx] ??
                  Math.round(100 / rowGroup.columns.length);
                const stackHeights = getNormalizedStackHeights(colGroup.items);
                return (
                  <div
                    key={`${colGroup.colId}_${colIdx}`}
                    style={{ flexGrow: wPct, flexShrink: 1 }}
                    className="w-full min-w-0 md:basis-0 flex flex-col gap-3"
                  >
                    {colGroup.items.map((item, stackIdx) => {
                      const stackPct =
                        stackHeights[stackIdx] ??
                        Math.round(100 / colGroup.items.length);
                      const isMultiStack = colGroup.items.length > 1;
                      return (
                        <div
                          key={item.block.id}
                          style={
                            isMultiStack
                              ? {
                                  flexGrow: stackPct,
                                  flexShrink: 1,
                                  flexBasis: `${stackPct}%`,
                                }
                              : undefined
                          }
                          className={`w-full min-w-0 flex flex-col ${
                            isMultiStack
                              ? 'rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-xs'
                              : ''
                          }`}
                        >
                          {renderSingleBlock(item.block, true)}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        }

        const { block } = rowGroup.items[0];
        const customWidth =
          typeof block.widthPercent === 'number' &&
          block.widthPercent >= 20 &&
          block.widthPercent < 100
            ? Math.round(block.widthPercent)
            : null;

        if (customWidth !== null) {
          return (
            <div
              key={block.id}
              style={{ '--block-w': `${customWidth}%` } as React.CSSProperties}
              className="w-full md:w-[var(--block-w)]"
            >
              {renderSingleBlock(block, false)}
            </div>
          );
        }

        return renderSingleBlock(block, false);
      })}
    </div>
  );
}

export default function LessonMaterialViewer({
  lessonId,
  classId,
  isTeacher,
  material,
  currentUserId,
  inlineQuizzesMap,
}: LessonMaterialViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftMaterialType, setDraftMaterialType] = useState<MaterialType>(
    material.materialType || 'markdown'
  );
  const [draftBlocks, setDraftBlocks] = useState<NotionBlock[]>(() =>
    markdownToBlocks(material.markdownContent)
  );
  const [draftHtml, setDraftHtml] = useState<string>(material.htmlContent || '');
  const [draftFileName, setDraftFileName] = useState<string | null>(material.fileName);
  const [saving, setSaving] = useState(false);
  const [clearingMaterial, setClearingMaterial] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [removingPatchId, setRemovingPatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasMainMaterial =
    material.markdownContent.trim().length > 0 ||
    material.htmlContent.trim().length > 0;
  const hasPatches = material.appliedPatches.length > 0;

  if (!hasMainMaterial && !hasPatches && !isTeacher) {
    return null;
  }

  async function handleFileReupload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileUploading(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await parseMaterialFileAction(fd);
      if (res.success && 'markdown' in res) {
        setDraftMaterialType('markdown');
        setDraftBlocks(markdownToBlocks(res.markdown || ''));
        setDraftFileName(res.fileName || file.name);
      } else {
        alert(res.error || '문서 텍스트 추출에 실패했습니다.');
      }
    } finally {
      setFileUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSaveMaterial() {
    setSaving(true);
    try {
      const serializedMd = blocksToMarkdown(draftBlocks);
      const res = await updateLessonMaterialAction(
        lessonId,
        classId,
        draftMaterialType,
        serializedMd,
        draftHtml,
        draftFileName
      );
      if (res.success) {
        setIsEditing(false);
      } else {
        alert(res.error || '교안 저장 중 오류가 발생했습니다.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleClearMaterial() {
    const confirmed = window.confirm(
      '현재 작성된 수업 교안 본문을 삭제(비우기)하시겠습니까?\n(학생들이 제출한 질문과 답변 데이터는 그대로 유지됩니다.)'
    );
    if (!confirmed) return;

    setClearingMaterial(true);
    try {
      const res = await clearLessonMaterialAction(lessonId, classId);
      if (res.success) {
        setIsEditing(false);
      } else {
        alert(res.error || '교안 삭제 중 오류가 발생했습니다.');
      }
    } finally {
      setClearingMaterial(false);
    }
  }

  async function handleRemovePatch(patchId: string) {
    setRemovingPatchId(patchId);
    try {
      await removeMaterialPatchAction(lessonId, classId, patchId);
    } finally {
      setRemovingPatchId(null);
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* 상단 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📖</span>
            <span>수업 교안 & 학습 자료</span>
          </h2>
          {material.fileName && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              <span>📄</span>
              <span>{material.fileName}</span>
            </span>
          )}
          {hasPatches && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              <span>✨ 질문 기반 보충 패치 {material.appliedPatches.length}건 반영됨</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isTeacher && (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraftMaterialType(material.materialType || 'markdown');
                  setDraftBlocks(markdownToBlocks(material.markdownContent));
                  setDraftHtml(material.htmlContent || '');
                  setDraftFileName(material.fileName);
                  setIsEditing(!isEditing);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-100 transition"
              >
                <span>{isEditing ? '✕' : '📝'}</span>
                <span>
                  {isEditing ? '빠른 편집 닫기' : '교안 바로 수정'}
                </span>
              </button>

              <Link
                href={`/classes/${classId}/lessons/${lessonId}/edit`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition"
              >
                <span>✏️</span>
                <span>스튜디오 전체 화면 수정</span>
              </Link>

              {(hasMainMaterial || hasPatches) && (
                <button
                  type="button"
                  disabled={clearingMaterial}
                  onClick={handleClearMaterial}
                  className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 transition"
                  title="학생 질문은 유지하고 교안 본문만 비웁니다"
                >
                  <span>🗑️</span>
                  <span>{clearingMaterial ? '비우는 중...' : '교안 본문 삭제'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 교사용 노션형 블록 에디터 패널 */}
      {isTeacher && isEditing && (
        <div className="rounded-3xl border-2 border-indigo-200 bg-white p-6 space-y-4 shadow-lg">
          <div className="sticky top-16 z-30 -mx-2 rounded-2xl bg-white/95 px-3 py-3 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
                  NOTION STUDIO
                </span>
                <h3 className="text-base font-extrabold text-gray-900">
                  수업 교안 빠른 수정
                </h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                블록을 클릭하거나 <code className="rounded bg-gray-100 px-1">/</code>를 입력해 코드·순서도·시뮬레이션 블록을 수정하고 즉시 저장하세요.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setDraftMaterialType('markdown')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    draftMaterialType === 'markdown'
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  📝 노션 블록 교안
                </button>
                <button
                  type="button"
                  onClick={() => setDraftMaterialType('html')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    draftMaterialType === 'html'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  ⚡ HTML 시뮬레이터
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.hwp,.hwpx,.md,.markdown,.txt"
                onChange={handleFileReupload}
                className="hidden"
                id="reupload-material-file"
              />
              <label
                htmlFor="reupload-material-file"
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                <span>
                  📂 {fileUploading ? '문서 변환 중...' : '워드(.docx)/한글(.hwp) 불러오기'}
                </span>
              </label>

              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveMaterial}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                {saving ? '저장 중...' : '💾 교안 변경사항 저장'}
              </button>
            </div>
          </div>

          {draftMaterialType === 'markdown' ? (
            <NotionBlockEditor
              blocks={draftBlocks}
              onChange={(newBlocks) => setDraftBlocks(newBlocks)}
            />
          ) : (
            <div className="space-y-3">
              <textarea
                rows={12}
                value={draftHtml}
                onChange={(e) => setDraftHtml(e.target.value)}
                placeholder="<!DOCTYPE html><html>...</html>"
                className="w-full rounded-2xl border border-gray-200 bg-slate-950 p-4 font-mono text-xs text-emerald-300 leading-relaxed focus:border-indigo-500 focus:outline-none"
              />
              {draftHtml.trim() && (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                  <iframe
                    srcDoc={draftHtml}
                    sandbox="allow-scripts"
                    className="h-[420px] w-full border-0"
                    title="Interactive Simulator Draft Preview"
                  />
                </div>
              )}
            </div>
          )}

          {/* 에디터 하단 저장 액션 바 */}
          <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-gray-500">
              💡 교안 편집이 끝났다면 우측의 저장 버튼을 눌러 반영해 주세요.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveMaterial}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                <span>💾</span>
                <span>{saving ? '저장 중...' : '교안 변경사항 저장하기'}</span>
              </button>
            </div>
          </div>

          {/* 화면 우측 하단 플로팅 저장 버튼 */}
          <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl border border-indigo-200 bg-white/95 p-2 shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-xl px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100"
            >
              취소
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveMaterial}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-extrabold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              <span>💾</span>
              <span>{saving ? '저장 중...' : '교안 저장'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. 노션 페이지 스타일 교안 뷰어 */}
      {!isEditing && material.markdownContent.trim() ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs">
          <SimpleMarkdownRenderer
            content={material.markdownContent}
            lessonId={lessonId}
            classId={classId}
            currentUserId={currentUserId}
            isTeacher={isTeacher}
            inlineQuizzesMap={inlineQuizzesMap}
          />
        </div>
      ) : !isEditing &&
        material.materialType === 'html' &&
        material.htmlContent.trim() ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <iframe
            srcDoc={material.htmlContent}
            sandbox="allow-scripts"
            className="h-[520px] w-full border-0"
            title="Interactive Lesson Material"
          />
        </div>
      ) : (
        isTeacher &&
        !isEditing && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-6 text-center">
            <p className="text-xs text-gray-500">
              아직 등록된 수업 교안 본문이 없습니다. 우측 상단{' '}
              <strong className="text-gray-700">
                [노션 스타일로 교안 편집 / 사진·문서 추가]
              </strong>{' '}
              버튼을 눌러 노션처럼 교안을 작성하거나 사진을 드래그해 넣어보세요.
            </p>
          </div>
        )
      )}

      {/* 2. 원클릭으로 패치된 '우리 반 질문 기반 교안 보충 노트' 영역 */}
      {hasPatches && (
        <div className="space-y-3">
          {material.appliedPatches.map((patch) => (
            <div
              key={patch.id}
              className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 p-5 shadow-xs space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2 border-b border-emerald-100 pb-2.5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
                      ✨ 우리 반 질문 기반 교안 패치
                    </span>
                    <h3 className="text-sm font-extrabold text-emerald-950">
                      {patch.title}
                    </h3>
                  </div>
                  {patch.source_questions_summary && (
                    <p className="text-xs text-emerald-700 mt-1 font-medium">
                      📌 반영 계기: {patch.source_questions_summary}
                    </p>
                  )}
                </div>

                {isTeacher && (
                  <button
                    type="button"
                    disabled={removingPatchId === patch.id}
                    onClick={() => handleRemovePatch(patch.id)}
                    className="shrink-0 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                  >
                    {removingPatchId === patch.id ? '삭제 중...' : '패치 제거'}
                  </button>
                )}
              </div>

              <div className="pt-1">
                <SimpleMarkdownRenderer
                  content={patch.content_markdown}
                  lessonId={lessonId}
                  classId={classId}
                  currentUserId={currentUserId}
                  isTeacher={isTeacher}
                  inlineQuizzesMap={inlineQuizzesMap}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
