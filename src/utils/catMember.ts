import type { CatMember } from "../types/catMember";

export function getNextCatMemberNumber(records: CatMember[]) {
  return (
    records.reduce((maximum, record) => {
      const numericId = Number.parseInt(record.id, 10);
      return Number.isNaN(numericId) ? maximum : Math.max(maximum, numericId);
    }, 0) + 1
  );
}

export function formatCatMemberId(idNumber: number) {
  return String(idNumber).padStart(4, "0");
}

export function createNextCatMemberId(records: CatMember[]) {
  return formatCatMemberId(getNextCatMemberNumber(records));
}
