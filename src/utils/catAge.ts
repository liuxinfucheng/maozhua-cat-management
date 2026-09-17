// Derived display data only: always recompute after an age edit or import.
export function getAgeInMonths(age: string): number | null {
  const parts = [...age.normalize("NFKC").matchAll(/(-?\d+(?:\.\d+)?)\s*(岁|个?月)/g)];
  if (parts.length === 0) return null;
  let months = 0;
  for (const part of parts) {
    const value = Number(part[1]);
    if (!Number.isFinite(value) || value < 0) return null;
    const normalizedValue = part[2] === "岁" && value > 1 && value % 1 !== 0.5
      ? Math.floor(value)
      : value;
    months += normalizedValue * (part[2] === "岁" ? 12 : 1);
  }
  return Number.isFinite(months) ? months : null;
}

export const ageRanges = [
  { label: "0-3个月", min: 0, max: 3, includeMin: true },
  { label: "3-7个月", min: 3, max: 7, includeMin: false },
  { label: "7-12个月", min: 7, max: 12, includeMin: false },
  { label: "1.5岁-5岁", min: 18, max: 60, includeMin: true },
  { label: "5.5-10岁", min: 66, max: 120, includeMin: true },
  { label: "10岁以上", min: 120, max: Infinity, includeMin: false },
];
export const unknownAgeLabel = "未填写/不识别";

export function matchesAgeRange(ageInMonths: number | null, label: string) {
  if (label === unknownAgeLabel) return ageInMonths === null;
  const range = ageRanges.find((item) => item.label === label);
  return ageInMonths !== null && !!range &&
    (range.includeMin ? ageInMonths >= range.min : ageInMonths > range.min) &&
    ageInMonths <= range.max;
}

export function compareAgeInMonths(first: number | null, second: number | null) {
  if (first === null) return second === null ? 0 : 1;
  if (second === null) return -1;
  return first - second;
}
