export type CatGender = "公猫" | "母猫" | "未知";
export type NeuteredStatus = "已绝育" | "未绝育" | "未知";
export type VaccineStatus = "未接种" | "一针" | "两针" | "已免疫" | "已完成" | "抗体高" | "终身免疫";
export type AdoptionStatus = "已领养" | "未领养";
export interface CatMember {
  id: string;
  serialNumber: string;
  photo: string;
  photoPositionX: number;
  photoPositionY: number;
  name: string;
  adoptionStatus: AdoptionStatus | "";
  gender: CatGender | "";
  coatColor: string;
  age: string;
  vaccineStatus: VaccineStatus | "";
  neutered: NeuteredStatus | "";
  lastVaccineDate: string;
  adoptionDate: string;
  adoptionAgreementText: string;
  adoptionAgreementImage: string;
  rehomingDate: string;
  adopter: string;
  contact: string;
  cageFee: number | null;
  feeDueDate: string;
  status: string;
  floor: string;
  area: string;
  cageNumber: string;
  notes: string;
  createdAt: string;
  deletedAt: string | null;
}

export type CatMemberFormValues = Omit<
  CatMember,
  "id" | "createdAt" | "deletedAt"
>;

export interface CatMemberDataFile {
  schemaVersion: number;
  records: CatMember[];
}
