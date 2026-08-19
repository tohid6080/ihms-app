import React, { useState, useEffect } from "react";
import { List, LayoutGrid, ArrowUpDown, Search } from "lucide-react";
import { styles, THEME } from "../shared.js";

const VIEW_MODE_KEY = "ihms_view_mode";

/**
 * Shared list/grid renderer used across every module (Personnel, Anomaly,
 * Machinery, Scaffold, BowTie, ...) so the whole app shares one visual
 * language instead of each module inventing its own list UI.
 *
 * This component owns: view-mode toggle (persisted globally in
 * localStorage — a real browser app, not a Claude.ai artifact, so this is
 * the correct, standard way to remember a UI preference), search input,
 * sort dropdown, bulk-select + bulk action bar, row numbering, and the
 * actual List/Grid rendering shell.
 *
 * Each module supplies its OWN field definitions and business logic —
 * this component never knows what "status" or "approve" means for any
 * given module. That keeps every module's real logic exactly where it
 * already lives, instead of centralizing business rules into a shared
 * component where they don't belong.
 *
 * Props:
 *   items            — already filtered+sorted array from the parent
 *   getId(item)       — unique id extractor
 *   columns           — [{ key, label, render(item), width? }] for List view
 *   renderCard(item, {selected, onToggleSelect}) — Grid view card renderer
 *   renderRowActions(item) — action buttons, List view (row-end) + Grid (card footer)
 *   searchQuery / onSearchChange / searchPlaceholder
 *   sortOptions       — [{ value, label }] (omit to hide the sort control)
 *   sortValue / onSortChange
 *   filterSlot        — arbitrary JSX the parent wants next to search/sort
 *   bulkActions       — [{ label, onClick(selectedIds), danger? }] (omit to hide bulk select)
 *   emptyMessage
 */
export default function DataView({
  items,
  getId,
  columns,
  renderCard,
  renderRowActions,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "جستجو...",
  sortOptions,
  sortValue,
  onSortChange,
  filterSlot,
  bulkActions,
  emptyMessage = "موردی یافت نشد",
}) {
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem(VIEW_MODE_KEY) || "list";
    } catch {
      return "list";
    }
  });
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch { /* بی‌اهمیت اگر ذخیره نشد */ }
  }, [viewMode]);

  // با عوض‌شدن لیست (فیلتر/جستجوی جدید)، انتخاب‌های قبلی که دیگر توی نتیجه نیستند پاک شوند
  useEffect(() => {
    const idSet = new Set(items.map(getId));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => idSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map(getId))));
  };
  const clearSelection = () => setSelected(new Set());

  const hasBulk = !!bulkActions && bulkActions.length > 0;

  return (
    <div>
      {/* نوار ابزار: جستجو، فیلتر، مرتب‌سازی، تاگل نما */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        {onSearchChange && (
          <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
            <Search size={14} color={THEME.text3} style={{ position: "absolute", insetInlineStart: 10, top: 11 }} />
            <input
              style={{ ...styles.input, paddingInlineStart: 30 }}
              value={searchQuery || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              dir="rtl"
            />
          </div>
        )}
        {filterSlot}
        {sortOptions && sortOptions.length > 0 && (
          <div style={{ position: "relative" }}>
            <select
              style={{ ...styles.filterSelect, paddingInlineStart: 26 }}
              value={sortValue}
              onChange={(e) => onSortChange(e.target.value)}
              dir="rtl"
            >
              {sortOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <ArrowUpDown size={13} color={THEME.text3} style={{ position: "absolute", insetInlineStart: 8, top: 10, pointerEvents: "none" }} />
          </div>
        )}
        <div style={{ display: "flex", background: "#fff", border: `1.5px solid ${THEME.border}`, borderRadius: 9, overflow: "hidden" }}>
          <ViewToggleButton active={viewMode === "list"} onClick={() => setViewMode("list")} icon={List} title="نمایش ردیفی" />
          <ViewToggleButton active={viewMode === "grid"} onClick={() => setViewMode("grid")} icon={LayoutGrid} title="نمایش کارتی" />
        </div>
      </div>

      {/* نوار عملیات گروهی */}
      {hasBulk && selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: THEME.tealSoft, border: `1px solid ${THEME.teal}`, borderRadius: 9, padding: "8px 12px", marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: THEME.tealDeep }}>{selected.size} مورد انتخاب شده</span>
          {bulkActions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => a.onClick([...selected])}
              style={{ ...styles.smallButton, background: a.danger ? THEME.danger : THEME.teal }}
            >
              {a.label}
            </button>
          ))}
          <button type="button" onClick={clearSelection} style={{ ...styles.smallButton, background: THEME.text3, marginInlineStart: "auto" }}>
            لغو انتخاب
          </button>
        </div>
      )}

      {items.length === 0 && <p style={{ color: THEME.text3, textAlign: "center", padding: "24px 0" }}>{emptyMessage}</p>}

      {items.length > 0 && viewMode === "list" && (
        <ListTable
          items={items}
          getId={getId}
          columns={columns}
          renderRowActions={renderRowActions}
          hasBulk={hasBulk}
          selected={selected}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
        />
      )}

      {items.length > 0 && viewMode === "grid" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {items.map((item) => {
            const id = getId(item);
            return (
              <div key={id} style={{ position: "relative" }}>
                {hasBulk && (
                  <input
                    type="checkbox"
                    checked={selected.has(id)}
                    onChange={() => toggleSelect(id)}
                    style={{ position: "absolute", top: 10, insetInlineStart: 10, zIndex: 2, width: 16, height: 16 }}
                  />
                )}
                {renderCard(item, { selected: selected.has(id) })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ViewToggleButton({ active, onClick, icon: Icon, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36,
        background: active ? THEME.teal : "#fff", border: "none", cursor: "pointer",
      }}
    >
      <Icon size={15} color={active ? "#fff" : THEME.text3} />
    </button>
  );
}

function ListTable({ items, getId, columns, renderRowActions, hasBulk, selected, toggleSelect, toggleSelectAll }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${THEME.border}`, borderRadius: 10, overflow: "hidden" }}>
      {/* دسکتاپ: جدول واقعی. موبایل: همون ساختار با اسکرول افقی برای اطلاعات کم‌اهمیت */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 480 }}>
          <thead>
            <tr style={{ background: THEME.bg, borderBottom: `1px solid ${THEME.border}` }}>
              {hasBulk && (
                <th style={{ width: 34, padding: "9px 8px" }}>
                  <input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleSelectAll} />
                </th>
              )}
              <th style={{ width: 40, padding: "9px 8px", textAlign: "center", color: THEME.text3, fontWeight: 600 }}>#</th>
              {columns.map((col) => (
                <th key={col.key} style={{ padding: "9px 10px", textAlign: "right", color: THEME.text2, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {col.label}
                </th>
              ))}
              {renderRowActions && <th style={{ padding: "9px 10px" }} />}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const id = getId(item);
              return (
                <tr key={id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                  {hasBulk && (
                    <td style={{ padding: "8px", textAlign: "center" }}>
                      <input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)} />
                    </td>
                  )}
                  <td style={{ padding: "8px", textAlign: "center", color: THEME.text3 }}>{idx + 1}</td>
                  {columns.map((col) => (
                    <td key={col.key} style={{ padding: "8px 10px", color: THEME.text, verticalAlign: "middle" }}>
                      {col.render(item)}
                    </td>
                  ))}
                  {renderRowActions && (
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {renderRowActions(item)}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// نشان وضعیت — برای هماهنگی رنگ‌بندی در هر دو نما، در همه‌ی ماژول‌ها یکسان استفاده شود
export function StatusPill({ label, color, bg }) {
  return (
    <span style={{ ...styles.badge, color, background: bg, whiteSpace: "nowrap" }}>{label}</span>
  );
}
