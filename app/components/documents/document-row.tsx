"use client";

import { memo, useCallback, useRef } from "react";
import { Eye, FolderOpen, GitCompare, Link2, Plus, Trash2 } from "lucide-react";
import { DocTitle } from "@/app/components/documents/doc-title";
import { DuplicateNote, historyNote } from "@/app/components/documents/duplicate-note";
import { IconBtn } from "@/app/components/documents/icon-btn";
import { publicDocumentURL } from "@/app/lib/api";
import { findAnzsco } from "@/app/lib/anzsco";
import { SOURCE_TOTAL, isHashPending, statusMeta, uniquenessMeta, type SourceUniqueness, type StatusTone } from "@/app/lib/files";
import { useAccordionHold } from "@/app/hooks/use-accordion-hold";
import { isAdmin, useUserStore } from "@/app/store/user-store";
import {
  inspectKey,
  useDocumentsStore,
  type DocumentItem,
  type DuplicateMatch,
  type SourceFile,
} from "@/app/store/documents-store";

export const COLS =
  "grid-cols-[minmax(8.5rem,1.25fr)_minmax(6.75rem,0.7fr)_7.25rem_4.75rem_minmax(6.5rem,0.65fr)_3.75rem_8.75rem]";

const SOURCE_COLS =
  "grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_8.75rem_4.25rem_8.75rem_9.5rem]";

const ACTION_SLOT = "flex w-full min-w-0 items-center justify-end gap-1";

const HEADER_CELL =
  "flex h-9 min-w-0 items-center text-[11px] font-medium tracking-[0.05em] text-muted uppercase";

const SOURCE_HEADER_CELL =
  "flex h-9 min-w-0 items-center text-[11px] font-medium tracking-[0.05em] text-muted uppercase";

const SOURCE_BODY_CELL = "flex min-h-11 min-w-0 items-center py-2";

const ROW_CELL = "flex min-h-14 min-w-0 items-center py-2.5";

const PILL =
  "inline-flex h-[22px] w-[6.75rem] shrink-0 items-center justify-center gap-1 rounded-full px-2 text-[11px] font-medium transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)]";

function StatusPill({ status }: { status: StatusTone }) {
  const meta = statusMeta(status);
  return (
    <span className={`${PILL} ${meta.className}`}>
      <span className="leading-none">{meta.label}</span>
    </span>
  );
}

function UniquenessPill({ value }: { value: SourceUniqueness }) {
  const meta = uniquenessMeta(value);
  return <span className={`${PILL} ${meta.className}`}>{meta.label}</span>;
}

function rowTone(item: DocumentItem, expanded: boolean): StatusTone {
  if (
    expanded &&
    item.status === "duplicate" &&
    item.sources.some((source) => source.uniqueness === "original")
  ) {
    return "original";
  }
  return item.status;
}

function openExternal(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}

function stopRow(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function hasTextSelection() {
  const value = window.getSelection()?.toString();
  return Boolean(value && value.length > 0);
}

export function DocumentsTableHeader() {
  return (
    <div
        className={`sticky top-0 z-[9] grid ${COLS} gap-x-4 border-b border-[var(--border)] bg-surface px-4`}
      role="row"
    >
      <div className={HEADER_CELL}>User</div>
      <div className={HEADER_CELL}>ERP</div>
      <div className={HEADER_CELL}>Status</div>
      <div className={HEADER_CELL}>Source</div>
      <div className={HEADER_CELL}>Uploaded</div>
      <div className={HEADER_CELL}>Similar</div>
      <div className={`${HEADER_CELL} justify-end`}>Action</div>
    </div>
  );
}

function SourceHeader() {
  return (
    <div className={`grid ${SOURCE_COLS} gap-x-4 px-4`} role="row">
      <div className={SOURCE_HEADER_CELL}>Title</div>
      <div className={SOURCE_HEADER_CELL}>Client</div>
      <div className={SOURCE_HEADER_CELL}>Uploaded</div>
      <div className={SOURCE_HEADER_CELL}>Score</div>
      <div className={SOURCE_HEADER_CELL}>Status</div>
      <div className={`${SOURCE_HEADER_CELL} justify-end`}>Action</div>
    </div>
  );
}

function ClientCell({ value }: { value?: string }) {
  const name = value?.trim() ?? "";
  return (
    <p className="w-full truncate text-[13px] text-ink">
      {name.length > 0 ? name : "—"}
    </p>
  );
}

function SourceAction({
  label,
  disabled,
  pressed,
  widthClass,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  pressed?: boolean
  widthClass: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      aria-pressed={pressed}
      onPointerDown={stopRow}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`inline-flex h-7 ${widthClass} shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg text-[12px] font-medium outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-40 ${
        pressed
          ? "bg-ink text-white"
          : "text-muted hover:bg-surface hover:text-ink"
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function MatchCountButton({
  uniqueness,
  count,
  open,
  onToggle,
}: {
  uniqueness: Exclude<SourceUniqueness, "unique">
  count: number
  open: boolean
  onToggle: () => void
}) {
  const meta = uniquenessMeta(uniqueness);
  return (
    <button
      type="button"
      aria-expanded={open}
      onPointerDown={stopRow}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={`${PILL} outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${meta.className} ${meta.hoverClass}`}
    >
      <span>{meta.label}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

function SourceStatus({
  source,
  member,
  inspecting,
  pendingHash,
  onInspect,
}: {
  source: SourceFile
  member: string
  inspecting: boolean
  pendingHash: boolean
  onInspect: () => void
}) {
  if (pendingHash) {
    return (
      <span className={`${PILL} ${statusMeta("processing").className}`}>
        Checking
      </span>
    );
  }
  if (source.uniqueness === "unique") {
    return <UniquenessPill value="unique" />;
  }
  const pill =
    source.duplicates.length > 0 ? (
      <MatchCountButton
        uniqueness="duplicate"
        count={source.duplicates.length}
        open={inspecting}
        onToggle={onInspect}
      />
    ) : (
      <UniquenessPill value="duplicate" />
    );
  return (
    <span className="flex min-w-0 items-center gap-1">
      {pill}
      {source.uniqueness === "duplicate" ? (
        <DuplicateNote
          note={historyNote(source.note, source.noteLog)}
          who={member}
          compact
        />
      ) : null}
    </span>
  );
}

function DuplicateDetails({ matches }: { matches: DuplicateMatch[] }) {
  return (
    <ul className="border-t border-[var(--border)] bg-white/80">
      {matches.map((match) => (
        <li key={match.id} className={`grid ${SOURCE_COLS} gap-x-4 px-4`} role="row">
          <div className={SOURCE_BODY_CELL}>
            <div className="min-w-0">
              <DocTitle value={match.title} className="w-full text-[13px] text-ink" />
              <p className="mt-0.5 truncate font-mono text-[11px] leading-none tabular-nums text-muted-soft">
                {match.erp}
              </p>
            </div>
          </div>
          <div className={SOURCE_BODY_CELL}>
            <ClientCell value={match.client} />
          </div>
          <div className={SOURCE_BODY_CELL}>
            <p className="w-full truncate text-[12px] tabular-nums text-muted">
              {match.uploaded}
            </p>
          </div>
          <div className={SOURCE_BODY_CELL}>
            <p className="w-full text-[13px] tabular-nums text-ink">
              {match.score.toFixed(1)}
            </p>
          </div>
          <div className={SOURCE_BODY_CELL}>
            <span className="flex min-w-0 items-center gap-1">
              <UniquenessPill value={match.uniqueness} />
              {match.note?.trim() ? (
                <DuplicateNote
                  note={match.note}
                  who={match.member}
                  compact
                  heading="Existing file"
                />
              ) : null}
            </span>
          </div>
          <div className={`${SOURCE_BODY_CELL} justify-end`}>
            <div className={ACTION_SLOT} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const SourceRow = memo(function SourceRow({
  docId,
  source,
  client,
  member,
  pendingHash,
  onCompare,
  onInspect,
}: {
  docId: string
  source: SourceFile
  client: string
  member: string
  pendingHash: boolean
  onCompare: (sourceId: string) => void
  onInspect: (sourceId: string) => void
}) {
  const inspecting = useDocumentsStore(
    (s) => s.inspect[inspectKey(docId, source.id)] === true,
  );
  const comparing = useDocumentsStore((s) =>
    Boolean(
      s.pendingCompare?.docId === docId &&
        s.pendingCompare.sourceId === source.id,
    ),
  );
  const inspectOpen = useAccordionHold(inspecting);
  return (
    <>
      <div
        className={`grid ${SOURCE_COLS} gap-x-4 border-t border-[var(--border)] px-4`}
        role="row"
      >
        <div className={SOURCE_BODY_CELL}>
          <DocTitle
            value={source.title}
            extracting={Boolean(source.needsTitle)}
            className="w-full text-[13px] text-ink"
          />
        </div>
        <div className={SOURCE_BODY_CELL}>
          <ClientCell value={client} />
        </div>
        <div className={SOURCE_BODY_CELL}>
          <p className="w-full truncate text-[12px] tabular-nums text-muted">
            {source.uploaded}
          </p>
        </div>
        <div className={SOURCE_BODY_CELL}>
          <p className="w-full text-[13px] tabular-nums text-ink">
            {source.score !== null ? source.score.toFixed(1) : "—"}
          </p>
        </div>
        <div className={SOURCE_BODY_CELL}>
          <SourceStatus
            source={source}
            member={member}
            inspecting={inspecting}
            pendingHash={pendingHash}
            onInspect={() => onInspect(source.id)}
          />
        </div>
        <div className={`${SOURCE_BODY_CELL} justify-end`}>
          <div className={ACTION_SLOT}>
            {source.duplicates.length > 0 ? (
              <SourceAction
                label="Compare"
                widthClass="w-[5.75rem]"
                pressed={comparing}
                onClick={() => onCompare(source.id)}
              >
                <GitCompare className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
              </SourceAction>
            ) : (
              <SourceAction
                label="View"
                widthClass="w-[5.75rem]"
                pressed={comparing}
                onClick={() => onCompare(source.id)}
              >
                <Eye className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
              </SourceAction>
            )}
          </div>
        </div>
      </div>
      {source.duplicates.length > 0 ? (
        <div
          className="doc-accordion"
          data-open={inspecting ? "true" : "false"}
          aria-hidden={!inspecting}
        >
          <div className="doc-accordion-inner" inert={!inspectOpen || undefined}>
            <DuplicateDetails matches={source.duplicates} />
          </div>
        </div>
      ) : null}
    </>
  );
});

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-[0.04em] text-muted-soft uppercase">
        {label}
      </p>
      <p className="mt-0.5 truncate text-[13px] text-ink" title={value}>
        {value}
      </p>
    </div>
  );
}

function AnzscoFact({ value }: { value: string }) {
  const match = findAnzsco(value);
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-[0.04em] text-muted-soft uppercase">
        ANZSCO
      </p>
      {match ? (
        <p
          className="mt-0.5 flex min-w-0 items-baseline gap-2"
          title={`${match.title} · ${match.code}`}
        >
          <span className="min-w-0 truncate text-[13px] text-ink">{match.title}</span>
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-muted">
            {match.code}
          </span>
        </p>
      ) : (
        <p className="mt-0.5 truncate text-[13px] text-ink">{value.trim() || "—"}</p>
      )}
    </div>
  );
}

function DocumentSources({ item }: { item: DocumentItem }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addSources = useDocumentsStore((s) => s.beginAddSources);
  const adding = useDocumentsStore(
    (s) => s.addingToId !== null || s.pendingSourceAdd !== null,
  );
  const canAdd =
    item.status !== "pending_review" &&
    item.sources.length < SOURCE_TOTAL &&
    !adding;

  const onAdd = useCallback(() => {
    if (item.sources.length >= SOURCE_TOTAL) return;
    inputRef.current?.click();
  }, [item.sources.length]);

  const onCompare = useCallback((sourceId: string) => {
    useDocumentsStore.getState().openCompare(item.id, sourceId);
  }, [item.id]);

  const onInspect = useCallback((sourceId: string) => {
    useDocumentsStore.getState().toggleInspect(item.id, sourceId);
  }, [item.id]);

  return (
    <div className={statusMeta(item.status).surface}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        multiple
        hidden
        onChange={(event) => {
          const list = event.target.files;
          if (list && list.length > 0) addSources(item.id, Array.from(list));
          event.target.value = "";
        }}
      />
      <div className="grid grid-cols-3 gap-x-4 border-b border-[var(--border)] px-4 py-3">
        <DetailFact label="Client" value={item.client || "—"} />
        <DetailFact label="Team" value={item.team || "—"} />
        <AnzscoFact value={item.anzsco} />
      </div>
      <SourceHeader />
      {item.sources.length === 0 ? (
        <p className="border-t border-[var(--border)] px-4 py-3 text-[13px] text-muted">
          No files on this document.
        </p>
      ) : (
        item.sources.map((source) => (
          <SourceRow
            key={source.id}
            docId={item.id}
            source={source}
            client={item.client}
            member={item.member || item.uploader}
            pendingHash={isHashPending(item.status, source)}
            onCompare={onCompare}
            onInspect={onInspect}
          />
        ))
      )}
      {canAdd ? (
        <div className="border-t border-[var(--border)] px-4">
          <button
            type="button"
            onClick={onAdd}
            className="flex h-11 w-full items-center gap-2 text-left text-[13px] font-medium text-muted outline-none hover:text-ink focus-visible:text-ink"
          >
            <Plus className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
            Add source
            <span className="text-[12px] font-normal text-muted-soft">
              {item.sources.length} / {SOURCE_TOTAL}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DocumentActions({ item }: { item: DocumentItem }) {
  const askRemove = useDocumentsStore((s) => s.askRemove);
  const openView = useDocumentsStore((s) => s.openView);
  const admin = isAdmin(useUserStore((s) => s.role));
  const fileHref = item.fileUrl;

  return (
    <div
      className="flex items-center justify-end gap-0.5"
      onPointerDown={stopRow}
      onClick={stopRow}
    >
      <IconBtn label="View" onClick={() => openView(item.id)}>
        <Eye className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
      </IconBtn>
      <IconBtn label="Open URL" onClick={() => openExternal(publicDocumentURL(item.id))}>
        <Link2 className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
      </IconBtn>
      <IconBtn label="Open file" onClick={() => fileHref && openExternal(fileHref)}>
        <FolderOpen className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
      </IconBtn>
      {admin ? (
        <IconBtn label="Delete" onClick={() => askRemove(item.id)}>
          <Trash2 className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
        </IconBtn>
      ) : null}
    </div>
  );
}

function SimilarCount({ item }: { item: DocumentItem }) {
  const openSimilar = useDocumentsStore((s) => s.openSimilar);
  const open = useDocumentsStore((s) => s.pendingSimilarId === item.id);
  const count = item.titleSimilar.length;
  if (count === 0) {
    return <p className="w-full text-[13px] tabular-nums text-muted-soft">—</p>;
  }
  return (
    <button
      type="button"
      aria-label={`${count} similar titles`}
      aria-expanded={open}
      title="Similar titles"
      onPointerDown={stopRow}
      onClick={(event) => {
        event.stopPropagation();
        openSimilar(item.id);
      }}
      className={`inline-flex h-[22px] min-w-[2.5rem] w-full max-w-[3.25rem] shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-medium tabular-nums outline-none transition-[background-color,color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
        open
          ? "bg-[#d7ecf8] text-[#1d6fb8]"
          : "bg-[#e8f4fc] text-[#1d6fb8] hover:bg-[#d7ecf8]"
      }`}
    >
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

export const DocumentRow = memo(function DocumentRow({
  item,
}: {
  item: DocumentItem
}) {
  const expanded = useDocumentsStore((s) => s.expandedId === item.id);
  const toggleExpanded = useDocumentsStore((s) => s.toggleExpanded);
  const tone = rowTone(item, expanded);
  const hold = useAccordionHold(expanded);

  const onRowClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, label")) return;
    if (hasTextSelection()) return;
    toggleExpanded(item.id);
  };

  const onRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleExpanded(item.id);
  };

  return (
    <div className="doc-row border-b border-[var(--border)]">
      <div
        role="row"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onRowClick}
        onKeyDown={onRowKeyDown}
        className={`grid ${COLS} cursor-pointer gap-x-4 px-4 outline-none transition-[background-color] duration-[var(--shell-duration)] ease-[var(--shell-ease)] ${
          expanded
            ? statusMeta(item.status).openClass
            : "hover:bg-surface-muted focus-visible:bg-surface-muted"
        }`}
      >
        <div className={ROW_CELL}>
          <p className="min-w-0 w-full truncate text-[13px] font-medium tracking-[-0.01em] text-ink">
            {item.member || item.uploader || "—"}
          </p>
        </div>
        <div className={ROW_CELL}>
          <p className="min-w-0 truncate font-mono text-[12px] tabular-nums text-ink">{item.erp}</p>
        </div>
        <div className={ROW_CELL}>
          <StatusPill status={tone} />
        </div>
        <div className={ROW_CELL}>
          <p className="w-full text-[13px] tabular-nums text-ink">
            {item.sources.length}
            <span className="text-muted-soft"> / {SOURCE_TOTAL}</span>
          </p>
        </div>
        <div className={ROW_CELL}>
          <p className="min-w-0 w-full truncate text-[13px] tabular-nums text-muted">
            {item.uploaded}
          </p>
        </div>
        <div className={ROW_CELL}>
          <SimilarCount item={item} />
        </div>
        <div className={`${ROW_CELL} justify-end`}>
          <DocumentActions item={item} />
        </div>
      </div>
      <div
        className="doc-accordion"
        data-open={expanded ? "true" : "false"}
        aria-hidden={!expanded}
      >
        <div className="doc-accordion-inner" inert={!hold || undefined}>
          <DocumentSources item={item} />
        </div>
      </div>
    </div>
  );
});
