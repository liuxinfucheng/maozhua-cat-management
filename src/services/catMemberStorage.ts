import { invoke } from "@tauri-apps/api/core";
import type { CatMember, CatMemberDataFile } from "../types/catMember";

const browserStorageKey = "cat-paw-cat-members";
const emptyData: CatMemberDataFile = { schemaVersion: 4, records: [] };

export function isDesktopRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export async function loadCatMemberData(): Promise<CatMemberDataFile> {
  if (isDesktopRuntime()) {
    return invoke<CatMemberDataFile>("load_cat_members");
  }

  const savedData = window.localStorage.getItem(browserStorageKey);
  if (!savedData) return emptyData;
  try {
    return JSON.parse(savedData) as CatMemberDataFile;
  } catch {
    return emptyData;
  }
}

async function saveBrowserData(data: CatMemberDataFile) {
  window.localStorage.setItem(browserStorageKey, JSON.stringify(data));
}

export async function upsertCatMember(member: CatMember): Promise<void> {
  if (isDesktopRuntime()) {
    await invoke("upsert_cat_member", { member });
    return;
  }
  const data = await loadCatMemberData();
  const exists = data.records.some((record) => record.id === member.id);
  await saveBrowserData({
    schemaVersion: 4,
    records: exists
      ? data.records.map((record) => record.id === member.id ? member : record)
      : [...data.records, member],
  });
}

export async function importCatMembers(members: CatMember[]): Promise<void> {
  if (isDesktopRuntime()) {
    await invoke("import_cat_members", { members });
    return;
  }
  const data = await loadCatMemberData();
  await saveBrowserData({ schemaVersion: 4, records: [...data.records, ...members] });
}

export async function softDeleteCatMember(id: string, deletedAt: string): Promise<void> {
  if (isDesktopRuntime()) {
    await invoke("soft_delete_cat_member", { id, deletedAt });
    return;
  }
  const data = await loadCatMemberData();
  await saveBrowserData({
    schemaVersion: 4,
    records: data.records.map((record) =>
      record.id === id ? { ...record, deletedAt } : record,
    ),
  });
}

export async function saveCatPhoto(memberId: string, dataUrl: string): Promise<string> {
  if (isDesktopRuntime()) {
    return invoke<string>("save_cat_photo", { memberId, dataUrl });
  }
  return dataUrl;
}

export async function loadCatPhoto(photoPath: string): Promise<string> {
  if (!photoPath || photoPath.startsWith("data:image/")) return photoPath;
  if (isDesktopRuntime()) {
    return invoke<string>("load_cat_photo", { photoPath });
  }
  return photoPath;
}

export async function deleteCatPhoto(photoPath: string): Promise<void> {
  if (!photoPath || photoPath.startsWith("data:image/")) return;
  if (isDesktopRuntime()) {
    await invoke("delete_cat_photo", { photoPath });
  }
}

export async function saveAdoptionAgreementImage(memberId: string, dataUrl: string): Promise<string> {
  if (isDesktopRuntime()) {
    return invoke<string>("save_adoption_agreement_image", { memberId, dataUrl });
  }
  return dataUrl;
}

export async function loadAdoptionAgreementImage(imagePath: string): Promise<string> {
  if (!imagePath || imagePath.startsWith("data:image/")) return imagePath;
  if (isDesktopRuntime()) {
    return invoke<string>("load_adoption_agreement_image", { imagePath });
  }
  return imagePath;
}

export async function deleteAdoptionAgreementImage(imagePath: string): Promise<void> {
  if (!imagePath || imagePath.startsWith("data:image/")) return;
  if (isDesktopRuntime()) {
    await invoke("delete_adoption_agreement_image", { imagePath });
  }
}
