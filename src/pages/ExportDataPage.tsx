import {
  CheckCircleOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  message,
  Row,
  Segmented,
  Spin,
  Statistic,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { loadCatMemberData } from "../services/catMemberStorage";
import type { AdoptionStatus, CatMember } from "../types/catMember";

type ExportCategory = "全部" | AdoptionStatus;

const exportHeaders = [
  "ID", "序号", "名字", "是否领养", "性别", "花色", "年龄", "疫苗情况", "绝育情况",
  "上一针疫苗时间", "领养日期", "送养日期", "送养人", "联系方式", "笼位费用",
  "收费到期", "状态", "楼层", "区域", "笼位号", "领养协议", "备注",
] as const;

function toExportRow(member: CatMember) {
  return [
    member.id,
    member.serialNumber,
    member.name,
    member.adoptionStatus,
    member.gender,
    member.coatColor,
    member.age,
    member.vaccineStatus,
    member.neutered,
    member.lastVaccineDate,
    member.adoptionDate,
    member.rehomingDate,
    member.adopter,
    member.contact,
    member.cageFee,
    member.feeDueDate,
    member.status,
    member.floor,
    member.area,
    member.cageNumber,
    member.adoptionAgreementText,
    member.notes,
  ];
}

function createExportFileName(category: ExportCategory) {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const time = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `猫爪猫咪成员_${category}_${date}_${time}.xlsx`;
}

const previewColumns: ColumnsType<CatMember> = [
  { title: "ID", dataIndex: "id", width: 82, fixed: "left" },
  { title: "序号", dataIndex: "serialNumber", width: 90, fixed: "left", ellipsis: true, render: (value) => value || "-" },
  { title: "名字", dataIndex: "name", width: 120, fixed: "left", render: (value) => value || "-" },
  {
    title: "是否领养",
    dataIndex: "adoptionStatus",
    width: 105,
    render: (value: AdoptionStatus | "") =>
      value ? <Tag color={value === "已领养" ? "green" : "orange"}>{value}</Tag> : "-",
  },
  { title: "性别", dataIndex: "gender", width: 82, render: (value) => value || "-" },
  { title: "花色", dataIndex: "coatColor", width: 110, ellipsis: true, render: (value) => value || "-" },
  { title: "年龄", dataIndex: "age", width: 78, render: (value) => value ?? "-" },
  { title: "疫苗情况", dataIndex: "vaccineStatus", width: 105, render: (value) => value || "-" },
  { title: "绝育情况", dataIndex: "neutered", width: 105, render: (value) => value || "-" },
  { title: "上一针疫苗时间", dataIndex: "lastVaccineDate", width: 145, render: (value) => value || "-" },
  { title: "领养日期", dataIndex: "adoptionDate", width: 120, render: (value) => value || "-" },
  { title: "送养日期", dataIndex: "rehomingDate", width: 140, ellipsis: true, render: (value) => value || "-" },
  { title: "送养人", dataIndex: "adopter", width: 110, ellipsis: true, render: (value) => value || "-" },
  { title: "联系方式", dataIndex: "contact", width: 130, ellipsis: true, render: (value) => value || "-" },
  { title: "笼位费用", dataIndex: "cageFee", width: 105, render: (value) => value ?? "-" },
  { title: "收费到期", dataIndex: "feeDueDate", width: 120, render: (value) => value || "-" },
  { title: "状态", dataIndex: "status", width: 100, ellipsis: true, render: (value) => value || "-" },
  { title: "楼层", dataIndex: "floor", width: 85, render: (value) => value || "-" },
  { title: "区域", dataIndex: "area", width: 110, render: (value) => value || "-" },
  { title: "笼位号", dataIndex: "cageNumber", width: 100, ellipsis: true, render: (value) => value || "-" },
  { title: "领养协议", dataIndex: "adoptionAgreementText", width: 200, ellipsis: true, render: (value) => value || "-" },
  { title: "备注", dataIndex: "notes", width: 200, ellipsis: true, render: (value) => value || "-" },
];

export function ExportDataPage() {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [members, setMembers] = useState<CatMember[]>([]);
  const [category, setCategory] = useState<ExportCategory>("全部");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    loadCatMemberData()
      .then((data) => {
        if (active) setMembers(data.records.filter((member) => member.deletedAt === null));
      })
      .catch(() => {
        if (active) messageApi.error("猫咪数据读取失败，请稍后重试");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [messageApi]);

  const adoptedCount = useMemo(
    () => members.filter((member) => member.adoptionStatus === "已领养").length,
    [members],
  );
  const notAdoptedCount = useMemo(
    () => members.filter((member) => member.adoptionStatus === "未领养").length,
    [members],
  );
  const previewMembers = useMemo(
    () => category === "全部"
      ? members
      : members.filter((member) => member.adoptionStatus === category),
    [category, members],
  );

  function exportExcel() {
    if (previewMembers.length === 0) {
      messageApi.warning("当前分类没有可导出的数据");
      return;
    }

    setExporting(true);
    try {
      const worksheet = XLSX.utils.aoa_to_sheet([
        [...exportHeaders],
        ...previewMembers.map(toExportRow),
      ]);
      worksheet["!cols"] = [
        { wch: 9 }, { wch: 12 }, { wch: 14 }, { wch: 11 }, { wch: 9 },
        { wch: 12 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 16 },
        { wch: 14 }, { wch: 18 }, { wch: 13 }, { wch: 17 }, { wch: 12 },
        { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 13 }, { wch: 12 },
        { wch: 30 }, { wch: 30 },
      ];
      worksheet["!autofilter"] = { ref: `A1:V${previewMembers.length + 1}` };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "猫咪成员总表");
      XLSX.writeFile(workbook, createExportFileName(category), { compression: true });
      messageApi.success(`已导出 ${previewMembers.length} 条猫咪数据`);
    } catch {
      messageApi.error("Excel 导出失败，请稍后重试");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="export-loading">
        {messageContextHolder}
        <Spin tip="正在读取猫咪数据" />
      </div>
    );
  }

  return (
    <div className="export-page">
      {messageContextHolder}

      <Row gutter={[14, 14]} className="export-stats">
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="有效数据" value={members.length} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="已领养" value={adoptedCount} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="未领养" value={notAdoptedCount} prefix={<FileExcelOutlined />} /></Card>
        </Col>
      </Row>

      <div className="export-control-card">
        <div className="export-control-copy">
          <strong>选择导出分类</strong>
          <span>预览内容与最终导出的数据保持一致</span>
        </div>
        <Segmented<ExportCategory>
          value={category}
          onChange={setCategory}
          options={[
            { label: `全部（${members.length}）`, value: "全部" },
            { label: `已领养（${adoptedCount}）`, value: "已领养" },
            { label: `未领养（${notAdoptedCount}）`, value: "未领养" },
          ]}
        />
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={exporting}
          disabled={previewMembers.length === 0}
          onClick={exportExcel}
        >
          一键导出（{previewMembers.length}）
        </Button>
      </div>

      <Alert
        className="export-note"
        type="info"
        showIcon
        message="导出为一张猫咪成员总表"
        description="头像、领养协议图片、本地文件路径、裁剪位置及已删除数据不会写入 Excel；数据缺失时对应单元格保持为空。"
      />

      <div className="export-preview">
        <div className="export-preview-heading">
          <div>
            <strong>数据预览</strong>
            <span>当前分类共 {previewMembers.length} 条数据</span>
          </div>
        </div>
        <Table<CatMember>
          rowKey="id"
          columns={previewColumns}
          dataSource={previewMembers}
          size="middle"
          scroll={{ x: 2340 }}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="当前分类没有可导出的数据" /> }}
        />
      </div>
    </div>
  );
}
