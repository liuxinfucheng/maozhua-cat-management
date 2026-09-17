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
