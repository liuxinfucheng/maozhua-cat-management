import { FileExcelOutlined, InboxOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, message, Space, Table, Tag, Upload } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { RcFile } from "antd/es/upload/interface";
import { useState } from "react";
import type { Key } from "react";
import * as XLSX from "xlsx";
import {
  importCatMembers,
  loadCatMemberData,
} from "../services/catMemberStorage";
import type {
  AdoptionStatus,
  CatGender,
  CatMember,
  CatMemberFormValues,
  NeuteredStatus,
  VaccineStatus,
} from "../types/catMember";
import {
  formatCatMemberId,
  getNextCatMemberNumber,
} from "../utils/catMember";

const { Dragger } = Upload;

interface ParsedRow {
  key: string;
  sheetName: string;
  rowNumber: number;
  data: CatMemberFormValues;
}

interface ParsedWorkbook {
  fileName: string;
  sheetCount: number;
  hiddenSheetCount: number;
  rows: ParsedRow[];
  incompleteRows: number;
}

const headerAliases: Record<keyof CatMemberFormValues, string[]> = {
  serialNumber: [],
  photo: ["照片", "猫咪照片", "图片"],
  photoPositionX: ["照片水平位置"],
  photoPositionY: ["照片垂直位置"],
  name: ["名字", "名称", "猫咪名字", "猫咪名称", "姓名"],
  adoptionStatus: ["是否领养", "领养情况", "领养状态"],
  gender: ["性别"],
  coatColor: ["花色", "毛色"],
  age: ["年龄"],
  vaccineStatus: ["疫苗情况", "疫苗", "免疫情况", "疫苗针数"],
  neutered: ["绝育情况", "是否绝育", "绝育"],
  lastVaccineDate: ["上一针疫苗时间", "上次疫苗时间"],
  adoptionDate: ["领养日期", "领养时间"],
  adoptionAgreementText: ["领养协议", "领养协议文字", "协议内容"],
  adoptionAgreementImage: ["领养协议图片"],
  rehomingDate: ["送养日期", "送养时间"],
  adopter: ["送养人"],
  contact: ["联系方式", "联系电话", "电话"],
  cageFee: ["笼位费用", "笼费", "费用"],
  feeDueDate: ["收费到期", "费用到期", "到期日期"],
  status: ["状态"],
  floor: ["楼层"],
  area: ["区域"],
  cageNumber: ["笼位号", "笼号"],
  notes: ["备注", "说明"],
};

const vaccineStatuses: VaccineStatus[] = ["未接种", "一针", "两针", "已免疫", "已完成", "抗体高", "终身免疫"];

function normalizeHeader(value: string) {
  return value.replace(/[\s*_]/g, "").toLocaleLowerCase();
}

function getCell(row: Record<string, unknown>, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  const matchedKey = Object.keys(row).find((key) =>
    normalizedAliases.includes(normalizeHeader(key)),
  );
  return matchedKey ? row[matchedKey] : "";
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatDate(value);
  return String(value).trim();
}

function toUnvalidatedText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function toDateText(value: unknown) {
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const text = toText(value);
  const dateMatch = text.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
  return dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
    : text;
}

function toNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number.parseFloat(String(value).replace(/[^\d.\-]/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
}

function toPhotoPosition(value: unknown) {
  const position = toNumber(value);
  return position === null ? 50 : Math.min(100, Math.max(0, position));
}

function toGender(value: unknown): CatGender | "" {
  const text = toText(value);
  if (["公猫", "公", "雄"].includes(text)) return "公猫";
  if (["母猫", "母", "雌"].includes(text)) return "母猫";
  if (text === "未知") return "未知";
  return "";
}

function toAdoptionStatus(value: unknown): AdoptionStatus | "" {
  const text = toText(value);
  if (["已领养", "是", "已领"].includes(text)) return "已领养";
  if (["未领养", "否", "待领养"].includes(text)) return "未领养";
  return "";
}

function toNeuteredStatus(value: unknown): NeuteredStatus | "" {
  const text = toText(value).replace(/\s+/g, "");
  if (/未绝育|未绝/.test(text)) return "未绝育";
  if (/已绝育|已绝/.test(text)) return "已绝育";
  if (/未知|不详/.test(text)) return "未知";
  if (/^否(?:[（(【\[]|$)/.test(text)) return "未绝育";
  if (/^是(?:[（(【\[]|$)/.test(text)) return "已绝育";
  return "";
}

function toVaccineStatus(value: unknown): VaccineStatus | "" {
  const text = toText(value).replace(/\s+/g, "");
  const matchers: Array<[RegExp, VaccineStatus]> = [
    [/终身免疫/, "终身免疫"],
    [/抗体高/, "抗体高"],
    [/已完成/, "已完成"],
    [/已免疫/, "已免疫"],
    [/未接种|未打|(?:^|\D)0针?/, "未接种"],
    [/(?:第)?两针|(?:^|\D)2针?/, "两针"],
    [/(?:第)?一针|(?:^|\D)1针?/, "一针"],
  ];
  return matchers.find(([pattern]) => pattern.test(text))?.[1] ?? "";
}

function parseRow(row: Record<string, unknown>): CatMemberFormValues {
  return {
    // “序号”是用户手动维护的自定义文本，导入时不自动填充。
    serialNumber: "",
    photo: toText(getCell(row, headerAliases.photo)),
    photoPositionX: toPhotoPosition(getCell(row, headerAliases.photoPositionX)),
    photoPositionY: toPhotoPosition(getCell(row, headerAliases.photoPositionY)),
    name: toText(getCell(row, headerAliases.name)),
    adoptionStatus: toAdoptionStatus(getCell(row, headerAliases.adoptionStatus)),
    gender: toGender(getCell(row, headerAliases.gender)),
    coatColor: toText(getCell(row, headerAliases.coatColor)),
    age: toUnvalidatedText(getCell(row, headerAliases.age)),
    vaccineStatus: toVaccineStatus(getCell(row, headerAliases.vaccineStatus)),
    neutered: toNeuteredStatus(getCell(row, headerAliases.neutered)),
    lastVaccineDate: toDateText(getCell(row, headerAliases.lastVaccineDate)),
    adoptionDate: toDateText(getCell(row, headerAliases.adoptionDate)),
    adoptionAgreementText: toText(getCell(row, headerAliases.adoptionAgreementText)),
    adoptionAgreementImage: "",
    rehomingDate: toDateText(getCell(row, headerAliases.rehomingDate)),
    adopter: toText(getCell(row, headerAliases.adopter)),
    contact: toText(getCell(row, headerAliases.contact)),
    cageFee: toNumber(getCell(row, headerAliases.cageFee)),
    feeDueDate: toDateText(getCell(row, headerAliases.feeDueDate)),
    status: toText(getCell(row, headerAliases.status)),
    floor: toText(getCell(row, headerAliases.floor)),
    area: toText(getCell(row, headerAliases.area)),
    cageNumber: toText(getCell(row, headerAliases.cageNumber)),
    notes: toText(getCell(row, headerAliases.notes)),
  };
}

function isIncomplete(row: CatMemberFormValues) {
  return !(
    row.name &&
    row.adoptionStatus &&
    row.gender &&
    row.vaccineStatus &&
    row.neutered &&
    row.rehomingDate
  );
}

export function ImportDataPage() {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [parsedWorkbook, setParsedWorkbook] = useState<ParsedWorkbook | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  async function parseExcel(file: RcFile) {
    setParsing(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: true,
      });
      const visibleSheetNames = workbook.SheetNames.filter((_, index) => {
        const sheetVisibility = workbook.Workbook?.Sheets?.[index]?.Hidden;
        return sheetVisibility === undefined || sheetVisibility === 0;
      });
      const rows: ParsedRow[] = visibleSheetNames.flatMap((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: "",
          raw: true,
        });
        return sheetRows.map((row, index) => ({
          key: `${sheetName}-${index + 2}`,
          sheetName,
          rowNumber: index + 2,
          data: parseRow(row),
        }));
      });

      setParsedWorkbook({
        fileName: file.name,
        sheetCount: visibleSheetNames.length,
        hiddenSheetCount: workbook.SheetNames.length - visibleSheetNames.length,
        rows,
        incompleteRows: rows.filter((row) => isIncomplete(row.data)).length,
      });
      // 导入文件后仅生成预览，默认不选中任何数据，避免用户误操作整批导入。
      setSelectedRowKeys([]);
      if (rows.length === 0) messageApi.warning("Excel 中没有可导入的数据行");
    } catch {
      setParsedWorkbook(null);
      setSelectedRowKeys([]);
      messageApi.error("文件解析失败，请确认选择的是有效 Excel 文件");
    } finally {
      setParsing(false);
    }
  }

  async function importRows(rowsToImport: ParsedRow[]) {
    if (!parsedWorkbook?.rows.length || rowsToImport.length === 0) return;
    const importedKeySet = new Set(rowsToImport.map((row) => row.key));
    setImporting(true);
    try {
      const currentData = await loadCatMemberData();
      const firstIdNumber = getNextCatMemberNumber(currentData.records);
      const importedAt = new Date().toISOString();
      const importedMembers: CatMember[] = rowsToImport.map((row, index) => ({
        ...row.data,
        photo: "",
        adoptionAgreementImage: "",
        id: formatCatMemberId(firstIdNumber + index),
        createdAt: importedAt,
        deletedAt: null,
      }));
      await importCatMembers(importedMembers);
      messageApi.success(`成功导入 ${importedMembers.length} 条猫咪数据`);
      const remainingRows = parsedWorkbook.rows.filter((row) => !importedKeySet.has(row.key));
      setSelectedRowKeys([]);
      setParsedWorkbook(
        remainingRows.length > 0
          ? {
              ...parsedWorkbook,
              rows: remainingRows,
              incompleteRows: remainingRows.filter((row) => isIncomplete(row.data)).length,
            }
          : null,
      );
    } catch {
      messageApi.error("导入数据写入失败，请稍后重试");
    } finally {
      setImporting(false);
    }
  }

  function confirmSelectedImport() {
    if (!parsedWorkbook?.rows.length || selectedRowKeys.length === 0) return;
    const selectedKeySet = new Set(selectedRowKeys);
    void importRows(parsedWorkbook.rows.filter((row) => selectedKeySet.has(row.key)));
  }

  function confirmAllImport() {
    if (!parsedWorkbook?.rows.length) return;
    void importRows(parsedWorkbook.rows);
  }

  const previewColumns: ColumnsType<ParsedRow> = [
    { title: "工作表", dataIndex: "sheetName", width: 120, ellipsis: true },
    { title: "行", dataIndex: "rowNumber", width: 60 },
    { title: "序号", dataIndex: ["data", "serialNumber"], width: 90, render: (value) => value || "-" },
    { title: "名字", dataIndex: ["data", "name"], width: 120, render: (value) => value || "-" },
    { title: "性别", dataIndex: ["data", "gender"], width: 90, render: (value) => value || "-" },
    {
      title: "是否领养",
      dataIndex: ["data", "adoptionStatus"],
      width: 110,
      render: (value) => value || "-",
    },
    { title: "疫苗情况", dataIndex: ["data", "vaccineStatus"], width: 110, render: (value) => value || "-" },
    { title: "送养日期", dataIndex: ["data", "rehomingDate"], width: 140, render: (value) => value || "-" },
    {
      title: "完整性",
      key: "complete",
      width: 90,
      render: (_, row) =>
        isIncomplete(row.data) ? <Tag color="orange">有空项</Tag> : <Tag color="green">完整</Tag>,
    },
  ];

  return (
    <div className="import-page">
      {messageContextHolder}
      <Dragger
        className="excel-dragger"
        accept=".xlsx,.xls"
        multiple={false}
        showUploadList={false}
        disabled={parsing || importing}
        beforeUpload={(file) => {
          void parseExcel(file);
          return false;
        }}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">点击或将 Excel 文件拖到这里</p>
        <p className="ant-upload-hint">支持 .xlsx 和 .xls，所有工作表将合并导入</p>
      </Dragger>

      {parsedWorkbook ? (
        <div className="import-result">
          <div className="import-summary">
            <div className="import-file-icon"><FileExcelOutlined /></div>
            <div className="import-file-meta">
              <strong>{parsedWorkbook.fileName}</strong>
              <span>
                {parsedWorkbook.sheetCount} 个可见工作表
                {parsedWorkbook.hiddenSheetCount > 0 &&
                  `·已忽略 ${parsedWorkbook.hiddenSheetCount} 个隐藏工作表`}
                ·{parsedWorkbook.rows.length} 条数据
              </span>
            </div>
            <Space>
              <Button
                disabled={importing}
                onClick={() => {
                  setParsedWorkbook(null);
                  setSelectedRowKeys([]);
                }}
              >
                取消预览
              </Button>
              <Button
                loading={importing}
                disabled={selectedRowKeys.length === 0}
                onClick={confirmSelectedImport}
              >
                确认导入（{selectedRowKeys.length}）
              </Button>
              <Button
                type="primary"
                loading={importing}
                onClick={confirmAllImport}
              >
                一键导入全部（{parsedWorkbook.rows.length}）
              </Button>
            </Space>
          </div>

          <Alert
            showIcon
            type="warning"
            message="当前仅为数据预览，尚未写入系统"
            description="“确认导入”只导入已勾选数据，“一键导入全部”会导入预览区内的全部数据。"
          />

          {parsedWorkbook.incompleteRows > 0 && (
            <Alert
              showIcon
              type="info"
              message={`${parsedWorkbook.incompleteRows} 条数据存在必填项缺失`}
              description="这些数据仍会正常导入，缺失字段将保存为空值。"
            />
          )}

          <div className="import-selection-bar">
            <span>
              已选择 <strong>{selectedRowKeys.length}</strong> / {parsedWorkbook.rows.length} 条
            </span>
          </div>

          <Table<ParsedRow>
            rowKey="key"
            columns={previewColumns}
            dataSource={parsedWorkbook.rows}
            rowSelection={{
              selectedRowKeys,
              preserveSelectedRowKeys: true,
              onChange: setSelectedRowKeys,
            }}
            size="middle"
            scroll={{ x: 840 }}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            locale={{ emptyText: <Empty description="没有可预览的数据" /> }}
          />
        </div>
      ) : (
        <div className="import-empty-hint">
          导入前会展示数据预览，不完整的数据也可以直接导入
        </div>
      )}
    </div>
  );
}
