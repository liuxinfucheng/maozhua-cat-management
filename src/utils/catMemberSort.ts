import type { CatMember, VaccineStatus } from "../types/catMember";

// Imports share a creation timestamp and receive IDs in spreadsheet row order.
export function compareDefaultMemberOrder(first: CatMember, second: CatMember) {
  return second.createdAt.localeCompare(first.createdAt) || Number(first.id) - Number(second.id);
}

const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

export function compareMemberText(first: string, second: string) {
  return collator.compare(first.trim(), second.trim());
}

const vaccineOrder: VaccineStatus[] = [
  "未接种", "一针", "两针", "已免疫", "已完成", "抗体高", "终身免疫",
];

export function compareVaccineStatus(first: string, second: string) {
  const firstIndex = vaccineOrder.indexOf(first as VaccineStatus);
  const secondIndex = vaccineOrder.indexOf(second as VaccineStatus);
  return firstIndex - secondIndex || compareMemberText(first, second);
}

export function dateValue(value: string): number | null {
  const match = value.trim().match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date.getTime();
}

export function matchesDateRange(value: string, range: string) {
  const [start, end] = range.split("~").map(dateValue);
  const date = dateValue(value);
  return date !== null && start != null && end != null && date >= start && date <= end;
}

export function compareRehomingDate(first: string, second: string) {
  const firstDate = dateValue(first);
  const secondDate = dateValue(second);
  if (firstDate !== null && secondDate !== null) return firstDate - secondDate;
  // Keep recognizable dates together so mixed date/text values sort consistently.
  if (firstDate !== null) return -1;
  if (secondDate !== null) return 1;
  return compareMemberText(first, second);
}

export function getFeeDueDateEnd(value: string, currentYear = new Date().getFullYear()) {
  const normalizedValue = value.trim();
  if (!normalizedValue.includes("-")) return null;

  // Prefer a suffix that is itself a complete date. This also supports ranges
  // whose start and end values use hyphens, such as 2026-01-01-2026-02-01.
  for (
    let index = normalizedValue.indexOf("-");
    index >= 0;
    index = normalizedValue.indexOf("-", index + 1)
  ) {
    const endValue = normalizedValue.slice(index + 1).trim();
    const endDate = dateValue(endValue);
    if (endDate !== null) {
      return {
        value: endValue,
        date: endDate,
        isCurrentYear: new Date(endDate).getUTCFullYear() === currentYear,
      };
    }
  }

  const endValue = normalizedValue.slice(normalizedValue.lastIndexOf("-") + 1).trim();
  const abbreviatedDate = endValue.match(/^(\d{1,2})[/.](\d{1,2})$/);
  const inferredDate = abbreviatedDate
    ? dateValue(`${currentYear}/${abbreviatedDate[1]}/${abbreviatedDate[2]}`)
    : null;
  return {
    value: endValue,
    date: inferredDate,
    isCurrentYear: inferredDate !== null,
  };
}

export function compareFeeDueDate(first: string, second: string) {
  const firstEnd = getFeeDueDateEnd(first);
  const secondEnd = getFeeDueDateEnd(second);
  if (firstEnd === null && secondEnd === null) return 0;
  if (firstEnd === null) return 1;
  if (secondEnd === null) return -1;

  // Current-year dates (including MM/DD and MM.DD with an inferred year) come
  // first. Non-date text follows, and explicitly non-current years stay last.
  const firstRank = firstEnd.isCurrentYear ? 0 : firstEnd.date === null ? 1 : 2;
  const secondRank = secondEnd.isCurrentYear ? 0 : secondEnd.date === null ? 1 : 2;
  if (firstRank !== secondRank) return firstRank - secondRank;
  if (firstEnd.date !== null && secondEnd.date !== null) {
    return firstEnd.date - secondEnd.date || compareMemberText(firstEnd.value, secondEnd.value);
  }
  return compareMemberText(firstEnd.value, secondEnd.value);
}
