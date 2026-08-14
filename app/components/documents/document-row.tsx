"use client";

import { memo, useCallback, useRef } from "react";
import { Eye, FolderOpen, GitCompare, Link2, Plus, Trash2 } from "lucide-react";
import { DocTitle } from "@/app/components/documents/doc-title";
import { IconBtn } from "@/app/components/documents/icon-btn";
import { SOURCE_TOTAL, isHashPending, statusMeta, uniquenessMeta, type SourceUniqueness, type StatusTone } from "@/app/lib/files";
import {
  inspectKey,
  useDocumentsStore,
  type DocumentItem,
  type DuplicateMatch,
  type SourceFile,
} from "@/app/store/documents-store";

export const COLS =
  "grid-cols-[minmax(10rem,1.45fr)_minmax(0,0.85fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_auto]";

const SOURCE_COLS =
  "grid-cols-[minmax(0,1.5fr)_minmax(0,0.95fr)_9.5rem_4.25rem_6.75rem_9.5rem]";

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

function sourceSlots(sources: SourceFile[]): Array<SourceFile | null> {
  const slots: Array<SourceFile | null> = [null, null, null, null];
  for (let i = 0; i < SOURCE_TOTAL; i += 1) {
    slots[i] = sources[i] ?? null;
  }
  return slots;
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
      className={`sticky top-[var(--toolbar-h)] z-[9] grid ${COLS} gap-x-4 border-b border-[var(--border)] bg-surface px-4`}
      role="row"
    >
      <div className={HEADER_CELL}>Name</div>
      <div className={HEADER_CELL}>ERP</div>
      <div className={HEADER_CELL}>Status</div>
      <div className={HEADER_CELL}>Source</div>
      <div className={HEADER_CELL}>Uploaded</div>
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
  inspecting,
  pendingHash,
  onInspect,
}: {
  source: SourceFile
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
  if (source.duplicates.length > 0) {
    return (
      <MatchCountButton
        uniqueness="duplicate"
        count={source.duplicates.length}
        open={inspecting}
        onToggle={onInspect}
      />
    );
  }
  return <UniquenessPill value="duplicate" />;
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
            <UniquenessPill value={match.uniqueness} />
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
  canAdd,
  pendingHash,
  onAdd,
  onCompare,
  onInspect,
}: {
  docId: string
  source: SourceFile | null
  client: string
  canAdd: boolean
  pendingHash: boolean
  onAdd: () => void
  onCompare: (sourceId: string) => void
  onInspect: (sourceId: string) => void
}) {
  const inspecting = useDocumentsStore((s) =>
    source ? s.inspect[inspectKey(docId, source.id)] === true : false,
  );
  const comparing = useDocumentsStore((s) =>
    Boolean(
      source &&
        s.pendingCompare?.docId === docId &&
        s.pendingCompare.sourceId === source.id,
    ),
  );
  return (
    <>
      <div
        className={`grid ${SOURCE_COLS} gap-x-4 border-t border-[var(--border)] px-4`}
        role="row"
      >
        <div className={SOURCE_BODY_CELL}>
          {source ? (
            <DocTitle
              value={source.title}
              className="w-full text-[13px] text-ink"
            />
          ) : (
            <span className="min-w-0 truncate text-[13px] text-muted-soft">
              Empty slot
            </span>
          )}
        </div>
        <div className={SOURCE_BODY_CELL}>
          {source ? <ClientCell value={client} /> : (
            <span className="w-full truncate text-[13px] text-muted-soft">—</span>
          )}
        </div>
        <div className={SOURCE_BODY_CELL}>
          <p className="w-full truncate text-[12px] tabular-nums text-muted">
            {source ? source.uploaded : "—"}
          </p>
        </div>
        <div className={SOURCE_BODY_CELL}>
          <p className="w-full text-[13px] tabular-nums text-ink">
            {source && source.score !== null ? source.score.toFixed(1) : "—"}
          </p>
        </div>
        <div className={SOURCE_BODY_CELL}>
          {source ? (
            <SourceStatus
              source={source}
              inspecting={inspecting}
              pendingHash={pendingHash}
              onInspect={() => onInspect(source.id)}
            />
          ) : null}
        </div>
        <div className={`${SOURCE_BODY_CELL} justify-end`}>
          <div className={ACTION_SLOT}>
            {source && source.duplicates.length > 0 ? (
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
                disabled={!source}
                pressed={comparing}
                onClick={() => {
                  if (source) onCompare(source.id);
                }}
              >
                <Eye className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
              </SourceAction>
            )}
            <SourceAction
              label="Add"
              widthClass="w-[3.5rem]"
              disabled={!canAdd}
              onClick={onAdd}
            >
              <Plus className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
            </SourceAction>
          </div>
        </div>
      </div>
      {source && source.duplicates.length > 0 ? (
        <div
          className="doc-accordion"
          data-open={inspecting ? "true" : "false"}
          aria-hidden={!inspecting}
        >
          <div className="doc-accordion-inner">
            <DuplicateDetails matches={source.duplicates} />
          </div>
        </div>
      ) : null}
    </>
  );
});

function DocumentSources({ item }: { item: DocumentItem }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addSources = useDocumentsStore((s) => s.beginAddSources);
  const adding = useDocumentsStore(
    (s) => s.addingToId !== null || s.pendingSourceAdd !== null,
  );
  const canAdd = item.sources.length < SOURCE_TOTAL && !adding;

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
      <SourceHeader />
      {sourceSlots(item.sources).map((source, index) => (
        <SourceRow
          key={source?.id ?? `empty-${item.id}-${index}`}
          docId={item.id}
          source={source}
          client={item.client}
          canAdd={canAdd}
          pendingHash={source ? isHashPending(item.status, source) : false}
          onAdd={onAdd}
          onCompare={onCompare}
          onInspect={onInspect}
        />
      ))}
    </div>
  );
}

function DocumentActions({ item }: { item: DocumentItem }) {
  const askRemove = useDocumentsStore((s) => s.askRemove);
  const openView = useDocumentsStore((s) => s.openView);
  const fileHref = item.fileUrl ?? item.url;

  return (
    <div
      className="flex items-center justify-end gap-0.5"
      onPointerDown={stopRow}
      onClick={stopRow}
    >
      <IconBtn label="View" onClick={() => openView(item.id)}>
        <Eye className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
      </IconBtn>
      <IconBtn label="Open URL" onClick={() => openExternal(item.url)}>
        <Link2 className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
      </IconBtn>
      <IconBtn label="Open file" onClick={() => openExternal(fileHref)}>
        <FolderOpen className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
      </IconBtn>
      <IconBtn label="Delete" onClick={() => askRemove(item.id)}>
        <Trash2 className="size-3.5" strokeWidth={1.75} absoluteStrokeWidth />
      </IconBtn>
    </div>
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
          <DocTitle
            value={item.uploader}
            className="w-full text-[13px] font-medium tracking-[-0.01em] text-ink"
          />
        </div>
        <div className={ROW_CELL}>
          <p className="min-w-0 truncate font-mono text-[12px] tabular-nums text-ink">{item.erp}</p>
        </div>
        <div className={ROW_CELL}>
          <StatusPill status={tone} />
        </div>
        <div className={ROW_CELL}>
          <p className="text-[13px] tabular-nums text-ink">
            {item.sources.length}
            <span className="text-muted-soft"> / {SOURCE_TOTAL}</span>
          </p>
        </div>
        <div className={ROW_CELL}>
          <p className="min-w-0 truncate text-[13px] tabular-nums text-muted">{item.uploaded}</p>
        </div>
        <div className={ROW_CELL}>
          <DocumentActions item={item} />
        </div>
      </div>
      <div
        className="doc-accordion"
        data-open={expanded ? "true" : "false"}
        aria-hidden={!expanded}
      >
        <div className="doc-accordion-inner" inert={!expanded || undefined}>
          <DocumentSources item={item} />
        </div>
      </div>
    </div>
  );
});
