import {
  DeleteOutlined,
  DownOutlined,
  FilterOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileImageOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  AutoComplete,
  Button,
  DatePicker,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Image as AntImage,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ComponentProps, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { PawIcon } from "../components/PawIcon";
import {
  deleteCatPhoto,
  deleteAdoptionAgreementImage,
  loadCatMemberData,
  loadCatPhoto,
  loadAdoptionAgreementImage,
  saveAdoptionAgreementImage,
  saveCatPhoto,
  softDeleteCatMember,
  upsertCatMember,
} from "../services/catMemberStorage";
import type {
  CatMember,
  CatMemberDataFile,
  CatMemberFormValues,
} from "../types/catMember";
import { createNextCatMemberId } from "../utils/catMember";
import { ageRanges, compareAgeInMonths, getAgeInMonths, matchesAgeRange, unknownAgeLabel } from "../utils/catAge";
import { compareDefaultMemberOrder, compareMemberText, compareRehomingDate, compareVaccineStatus, matchesDateRange } from "../utils/catMemberSort";

const initialData: CatMemberDataFile = { schemaVersion: 4, records: [] };
const memberFilterFields = [
  { key: "adoptionStatus", label: "是否领养" },
  { key: "gender", label: "性别" },
  { key: "age", label: "年龄" },
  { key: "vaccineStatus", label: "疫苗情况" },
  { key: "neutered", label: "绝育情况" },
  { key: "lastVaccineDate", label: "上一针疫苗时间" },
  { key: "adoptionDate", label: "领养日期" },
  { key: "adopter", label: "送养人" },
] as const;
type MemberFilterKey = typeof memberFilterFields[number]["key"];
type MemberFilters = Partial<Record<MemberFilterKey, string>>;
type CatMemberRow = CatMember & { ageInMonths: number | null };
type DateFilterKey = "lastVaccineDate" | "adoptionDate";
type DateRangeValue = ComponentProps<typeof DatePicker.RangePicker>["value"];
const defaultMemberFormValues: Partial<CatMemberFormValues> = {
  serialNumber: "",
  photo: "",
  photoPositionX: 50,
  photoPositionY: 50,
  gender: "未知",
  age: "",
  vaccineStatus: "未接种",
  neutered: "未知",
  cageFee: null,
  adoptionAgreementText: "",
  adoptionAgreementImage: "",
};

function loadPhotoImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败"));
    image.src = source;
  });
}

function readPhotoFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

async function compressPhoto(file: File) {
  const source = await readPhotoFile(file);
  const image = await loadPhotoImage(source);
  const maxSize = 960;
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("图片处理失败");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

async function prepareAgreementImage(file: File) {
  const source = await readPhotoFile(file);
  const image = await loadPhotoImage(source);
  const maxDimension = Math.max(image.naturalWidth, image.naturalHeight);
  if (file.size <= 5 * 1024 * 1024 && maxDimension <= 3000) return source;

  const scale = Math.min(1, 3000 / maxDimension);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("领养协议图片处理失败");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.96);
}

function PositionedPhoto({
  source,
  alt,
  positionX,
  positionY,
  frameSize,
  onError,
}: {
  source: string;
  alt: string;
  positionX: number;
  positionY: number;
  frameSize: number;
  onError?: () => void;
}) {
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const aspectRatio = imageSize.width / imageSize.height;
  const renderedWidth = aspectRatio >= 1 ? frameSize * aspectRatio : frameSize;
  const renderedHeight = aspectRatio >= 1 ? frameSize : frameSize / aspectRatio;
  const offsetX = -(renderedWidth - frameSize) * (positionX / 100);
  const offsetY = -(renderedHeight - frameSize) * (positionY / 100);

  return (
    <img
      src={source}
      alt={alt}
      draggable={false}
      onError={onError}
      onLoad={(event) => {
        setImageSize({
          width: event.currentTarget.naturalWidth,
          height: event.currentTarget.naturalHeight,
        });
      }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${renderedWidth}px`,
        height: `${renderedHeight}px`,
        maxWidth: "none",
        transform: `translate(${offsetX}px, ${offsetY}px)`,
      }}
    />
  );
}

function DraggablePhoto({
  source,
  positionX,
  positionY,
  onPositionChange,
  onImageError,
}: {
  source: string;
  positionX: number;
  positionY: number;
  onPositionChange: (positionX: number, positionY: number) => void;
  onImageError?: () => void;
}) {
  const [draftPosition, setDraftPosition] = useState({ x: positionX, y: positionY });
  const draftPositionRef = useRef(draftPosition);
  const dragStart = useRef<{
    clientX: number;
    clientY: number;
    positionX: number;
    positionY: number;
  } | null>(null);

  useEffect(() => {
    if (!dragStart.current) {
      const nextPosition = { x: positionX, y: positionY };
      draftPositionRef.current = nextPosition;
      setDraftPosition(nextPosition);
    }
  }, [positionX, positionY]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      positionX: draftPositionRef.current.x,
      positionY: draftPositionRef.current.y,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextX = dragStart.current.positionX
      - ((event.clientX - dragStart.current.clientX) / bounds.width) * 100;
    const nextY = dragStart.current.positionY
      - ((event.clientY - dragStart.current.clientY) / bounds.height) * 100;
    const nextPosition = {
      x: Math.round(Math.min(100, Math.max(0, nextX))),
      y: Math.round(Math.min(100, Math.max(0, nextY))),
    };
    draftPositionRef.current = nextPosition;
    setDraftPosition(nextPosition);
  }

  function stopDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStart.current = null;
    onPositionChange(draftPositionRef.current.x, draftPositionRef.current.y);
  }

  return (
    <div
      className="member-photo-preview member-photo-preview-draggable"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
    >
      <PositionedPhoto
        source={source}
        alt="猫咪照片裁剪预览"
        positionX={draftPosition.x}
        positionY={draftPosition.y}
        frameSize={128}
        onError={onImageError}
      />
    </div>
  );
}

function displayValue(value: string | number | null | undefined) {
  return value === "" || value === null || value === undefined ? "-" : value;
}

function downloadAgreementImage(dataUrl: string, member: CatMember) {
  const mimeMatch = dataUrl.match(/^data:image\/(jpeg|png|webp);/);
  const extension = mimeMatch?.[1] === "jpeg" ? "jpg" : mimeMatch?.[1] ?? "jpg";
  const fileLabel = (member.serialNumber || member.name || member.id)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .trim();
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `领养协议-${fileLabel || member.id}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function getMissingRequiredFields(member: CatMember) {
  const missingFields: string[] = [];
  if (!member.name?.trim()) missingFields.push("名字");
  if (!member.adoptionStatus) missingFields.push("是否领养");
  if (!member.gender) missingFields.push("性别");
  if (!member.vaccineStatus) missingFields.push("疫苗情况");
  if (!member.neutered) missingFields.push("绝育情况");
  if (!member.rehomingDate?.trim()) missingFields.push("送养日期");
  if (member.adoptionStatus === "已领养" && !member.adoptionDate?.trim()) {
    missingFields.push("领养日期");
  }
  return missingFields;
}

function DetailField({
  label,
  value,
  emphasis = false,
  wide = false,
  missing = false,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
  wide?: boolean;
  missing?: boolean;
}) {
  return (
    <div className={`member-detail-field${wide ? " member-detail-field-wide" : ""}${missing ? " member-detail-field-missing" : ""}`}>
      <span className="member-detail-label">{label}</span>
      <span className={emphasis ? "member-detail-value member-detail-emphasis" : "member-detail-value"}>
        {value}
      </span>
    </div>
  );
}

function FlexibleDateInput({
  value = "",
  onChange,
}: {
  value?: string;
  onChange?: (value: string) => void;
}) {
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";

  return (
    <Space.Compact className="flexible-date-input">
      <Input
        value={value}
        maxLength={100}
        placeholder="选择日期或输入自定义文案"
        onChange={(event) => onChange?.(event.target.value)}
      />
      <Input
        aria-label="选择送养日期"
        className="flexible-date-picker"
        type="date"
        value={dateValue}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </Space.Compact>
  );
}

export function CatMembersPage() {
  const navigate = useNavigate();
  const [exportSort, setExportSort] = useState<{ field: string; order: "ascend" | "descend" } | null>(null);
  const [form] = Form.useForm<CatMemberFormValues>();
  const memberFormScrollRef = useRef<HTMLDivElement>(null);
  const adoptionStatus = Form.useWatch("adoptionStatus", form);
  const memberPhotoPositionX = Form.useWatch("photoPositionX", form) ?? 50;
  const memberPhotoPositionY = Form.useWatch("photoPositionY", form) ?? 50;
  const [messageApi, messageContextHolder] = message.useMessage();
  const [dataFile, setDataFile] = useState<CatMemberDataFile>(initialData);
  const [query, setQuery] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [memberFilters, setMemberFilters] = useState<MemberFilters>({});
  const [dateRanges, setDateRanges] = useState<Partial<Record<DateFilterKey, DateRangeValue>>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const activeFilterCount = Object.keys(memberFilters).length;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<CatMember | null>(null);
  const [selectedMember, setSelectedMember] = useState<CatMember | null>(null);
  const [memberPhotoPreview, setMemberPhotoPreview] = useState("");
  const [photoChanged, setPhotoChanged] = useState(false);
  const [agreementImagePreview, setAgreementImagePreview] = useState("");
  const [agreementImageChanged, setAgreementImageChanged] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState("");
  const [selectedAgreementImage, setSelectedAgreementImage] = useState("");
  const [tablePageSize, setTablePageSize] = useState(() => {
    if (window.innerHeight <= 680) return 6;
    if (window.innerHeight <= 820) return 8;
    return 10;
  });
  const selectedMissingFields = selectedMember
    ? getMissingRequiredFields(selectedMember)
    : [];

  useEffect(() => {
    loadCatMemberData()
      .then(setDataFile)
      .catch(() => messageApi.error("猫咪成员数据加载失败"))
      .finally(() => setLoading(false));
  }, [messageApi]);

  useEffect(() => {
    function updateTablePageSize() {
      const nextPageSize = window.innerHeight <= 680
        ? 6
        : window.innerHeight <= 820
          ? 8
          : 10;
      setTablePageSize(nextPageSize);
    }
    window.addEventListener("resize", updateTablePageSize);
    return () => window.removeEventListener("resize", updateTablePageSize);
  }, []);

  useEffect(() => {
    if (editorOpen && adoptionStatus === "未领养") {
      form.setFieldValue("adoptionDate", "");
    }
  }, [adoptionStatus, editorOpen, form]);

  const filterOptions = useMemo(() => memberFilterFields.map((field) => ({
    ...field,
    values: field.key === "age"
      ? [...ageRanges.map((range) => range.label), unknownAgeLabel]
      : field.key === "adopter" || field.key === "lastVaccineDate" || field.key === "adoptionDate"
        ? []
      : [...new Set(dataFile.records
      .filter((member) => member.deletedAt === null)
      .map((member) => member[field.key].trim()))]
      .sort(field.key === "vaccineStatus" ? compareVaccineStatus : compareMemberText),
  })), [dataFile.records]);

  function changeMemberFilter(key: MemberFilterKey, value: string | undefined) {
    setMemberFilters((current) => {
      const next = { ...current };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
    setCurrentPage(1);
  }

  function searchMembers() {
    setSearchKeyword(query);
    setCurrentPage(1);
  }

  const visibleMembers = useMemo(() => {
    const keyword = searchKeyword.trim().toLocaleLowerCase();
    return dataFile.records
      .filter((member) => member.deletedAt === null)
      .map((member): CatMemberRow => ({ ...member, ageInMonths: getAgeInMonths(member.age) }))
      .filter((member) => memberFilterFields.every(({ key }) =>
        memberFilters[key] === undefined || (key === "age"
          ? matchesAgeRange(member.ageInMonths, memberFilters[key])
          : key === "lastVaccineDate" || key === "adoptionDate"
            ? matchesDateRange(member[key], memberFilters[key])
          : key === "adopter"
            ? member.adopter.toLocaleLowerCase().includes(memberFilters[key].trim().toLocaleLowerCase())
          : member[key].trim() === memberFilters[key]),
      ))
      .filter((member) =>
        keyword ? member.name.toLocaleLowerCase().includes(keyword) : true,
      )
      .sort(compareDefaultMemberOrder);
  }, [dataFile.records, searchKeyword, memberFilters]);

  function exportFilteredMembers() {
    const records = [...visibleMembers];
    if (exportSort) {
      const { field, order } = exportSort;
      records.sort((first, second) => {
        const result = field === "age"
          ? compareAgeInMonths(first.ageInMonths, second.ageInMonths)
          : field === "vaccineStatus"
            ? compareVaccineStatus(first.vaccineStatus, second.vaccineStatus)
            : compareRehomingDate(first.rehomingDate, second.rehomingDate);
        return order === "ascend" ? result : -result;
      });
    }
    navigate("/export", { state: { filteredMemberIds: records.map((member) => member.id) } });
  }

  async function handleSave() {
    let values: CatMemberFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setSaving(true);
    const memberId = editingMember?.id ?? createNextCatMemberId(dataFile.records);
    const previousPhoto = editingMember?.photo ?? "";
    const previousAgreementImage = editingMember?.adoptionAgreementImage ?? "";
    let savedPhoto = previousPhoto;
    let savedAgreementImage = previousAgreementImage;
    let newlyCreatedPhoto = "";
    let newlyCreatedAgreementImage = "";
    try {
      if (photoChanged) {
        savedPhoto = memberPhotoPreview
          ? await saveCatPhoto(memberId, memberPhotoPreview)
          : "";
        newlyCreatedPhoto = savedPhoto;
      }
      if (agreementImageChanged) {
        savedAgreementImage = agreementImagePreview
          ? await saveAdoptionAgreementImage(memberId, agreementImagePreview)
          : "";
        newlyCreatedAgreementImage = savedAgreementImage;
      }
      const memberValues: CatMemberFormValues = {
        serialNumber: values.serialNumber?.trim() ?? "",
        photo: savedPhoto,
        photoPositionX: values.photoPositionX ?? 50,
        photoPositionY: values.photoPositionY ?? 50,
        name: values.name.trim(),
        adoptionStatus: values.adoptionStatus,
        gender: values.gender,
        coatColor: values.coatColor?.trim() ?? "",
        age: values.age ?? "",
        vaccineStatus: values.vaccineStatus,
        neutered: values.neutered,
        lastVaccineDate: values.lastVaccineDate ?? "",
        adoptionDate: values.adoptionDate ?? "",
        adoptionAgreementText: values.adoptionAgreementText?.trim() ?? "",
        adoptionAgreementImage: savedAgreementImage,
        rehomingDate: values.rehomingDate.trim(),
        adopter: values.adopter?.trim() ?? "",
        contact: values.contact?.trim() ?? "",
        cageFee: values.cageFee ?? null,
        feeDueDate: values.feeDueDate ?? "",
        status: values.status?.trim() ?? "",
        floor: values.floor?.trim() ?? "",
        area: values.area ?? "",
        cageNumber: values.cageNumber?.trim() ?? "",
        notes: values.notes?.trim() ?? "",
      };
      const savedMember: CatMember = editingMember
        ? { ...editingMember, ...memberValues }
        : {
            ...memberValues,
            id: memberId,
            createdAt: new Date().toISOString(),
            deletedAt: null,
          };
      await upsertCatMember(savedMember);
      if (photoChanged && previousPhoto && previousPhoto !== savedPhoto) {
        await deleteCatPhoto(previousPhoto).catch(() => undefined);
      }
      if (
        agreementImageChanged &&
        previousAgreementImage &&
        previousAgreementImage !== savedAgreementImage
      ) {
        await deleteAdoptionAgreementImage(previousAgreementImage).catch(() => undefined);
      }
      setDataFile((current) => ({
        schemaVersion: 4,
        records: editingMember
          ? current.records.map((record) => record.id === savedMember.id ? savedMember : record)
          : [...current.records, savedMember],
      }));
      form.resetFields();
      setEditorOpen(false);
      messageApi.success(
        editingMember
          ? `已更新猫咪成员 ${savedMember.name}`
          : `已新增猫咪成员 ${savedMember.name}`,
      );
    } catch {
      if (newlyCreatedPhoto && newlyCreatedPhoto !== previousPhoto) {
        await deleteCatPhoto(newlyCreatedPhoto).catch(() => undefined);
      }
      if (
        newlyCreatedAgreementImage &&
        newlyCreatedAgreementImage !== previousAgreementImage
      ) {
        await deleteAdoptionAgreementImage(newlyCreatedAgreementImage).catch(() => undefined);
      }
      messageApi.error("数据保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  function openCreateEditor() {
    setEditingMember(null);
    setMemberPhotoPreview("");
    setPhotoChanged(false);
    setAgreementImagePreview("");
    setAgreementImageChanged(false);
    form.resetFields();
    setEditorOpen(true);
  }

  function openEditEditor(member: CatMember) {
    setEditingMember(member);
    setMemberPhotoPreview("");
    setPhotoChanged(false);
    setAgreementImagePreview("");
    setAgreementImageChanged(false);
    form.resetFields();
    form.setFieldsValue(member);
    setEditorOpen(true);
    if (member.photo) {
      void loadCatPhoto(member.photo)
        .then(setMemberPhotoPreview)
        .catch(() => messageApi.warning("猫咪照片读取失败，可重新选择照片"));
    }
    if (member.adoptionAgreementImage) {
      void loadAdoptionAgreementImage(member.adoptionAgreementImage)
        .then(setAgreementImagePreview)
        .catch(() => messageApi.warning("领养协议图片读取失败，可重新选择图片"));
    }
  }

  function openMemberDetails(member: CatMember) {
    setSelectedMember(member);
    setSelectedPhoto("");
    setSelectedAgreementImage("");
    if (member.photo) {
      void loadCatPhoto(member.photo)
        .then(setSelectedPhoto)
        .catch(() => messageApi.warning("猫咪照片读取失败"));
    }
    if (member.adoptionAgreementImage) {
      void loadAdoptionAgreementImage(member.adoptionAgreementImage)
        .then(setSelectedAgreementImage)
        .catch(() => messageApi.warning("领养协议图片读取失败"));
    }
  }

  async function handleDelete(member: CatMember) {
    const deletedAt = new Date().toISOString();
    try {
      await softDeleteCatMember(member.id, deletedAt);
      setDataFile((current) => ({
        ...current,
        records: current.records.map((record) =>
          record.id === member.id ? { ...record, deletedAt } : record,
        ),
      }));
      messageApi.success(`已删除猫咪成员 ${member.name}`);
    } catch {
      messageApi.error("删除失败，数据未变更");
    }
  }

  const columns: ColumnsType<CatMemberRow> = [
    {
      title: "名字",
      dataIndex: "name",
      width: 100,
      fixed: "left",
      ellipsis: true,
      render: (name: string, member) => {
        const missingFields = getMissingRequiredFields(member);
        return (
          <span className="member-name-cell">
            {missingFields.length > 0 && (
              <WarningOutlined
                className="member-incomplete-icon"
                title={`缺少必填项：${missingFields.join("、")}`}
              />
            )}
            <span className="member-name">{displayValue(name)}</span>
          </span>
        );
      },
    },
    {
      title: "性别",
      dataIndex: "gender",
      width: 90,
    },
    {
      title: "年龄",
      dataIndex: "age",
      width: 90,
      sorter: (first, second) => compareAgeInMonths(first.ageInMonths, second.ageInMonths),
      render: (age: string) => displayValue(age),
    },
    {
      title: "疫苗情况",
      dataIndex: "vaccineStatus",
      width: 110,
      sorter: (first, second) => compareVaccineStatus(first.vaccineStatus, second.vaccineStatus),
    },
    {
      title: "绝育情况",
      dataIndex: "neutered",
      width: 110,
      render: (status: string) => (
        <Tag color={status === "已绝育" ? "green" : "default"}>{displayValue(status)}</Tag>
      ),
    },
    {
      title: "送养日期",
      dataIndex: "rehomingDate",
      width: 130,
      sorter: (first, second) => compareRehomingDate(first.rehomingDate, second.rehomingDate),
      render: displayValue,
    },
    {
      title: "送养人",
      dataIndex: "adopter",
      width: 130,
      render: displayValue,
    },
    {
      title: "操作",
      key: "actions",
      width: 260,
      fixed: "right",
      render: (_, member) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openMemberDetails(member)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditEditor(member)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除这条数据？"
            description={`删除后将不再显示“${member.name}”，但原始数据会保留。`}
            okText="确认删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(member)}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="members-page">
      {messageContextHolder}
      <div className="members-toolbar">
        <Input
          className="member-search-input"
          value={query}
          allowClear
          prefix={<SearchOutlined />}
          placeholder="输入猫咪名称"
          onChange={(event) => setQuery(event.target.value)}
          onPressEnter={searchMembers}
        />
        <Button type="primary" onClick={searchMembers}>
          查询
        </Button>
        <Button
          icon={<FilterOutlined />}
          type={filtersOpen || activeFilterCount > 0 ? "primary" : "default"}
          aria-expanded={filtersOpen}
          aria-controls="member-filter-bar"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          筛选{activeFilterCount > 0 ? `（${activeFilterCount}）` : ""}
        </Button>
        <span className="members-incomplete-legend">
          <WarningOutlined className="member-incomplete-icon" />
          红色感叹号表示必填项待补充
        </span>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateEditor}
        >
          新增成员
        </Button>
      </div>

      {filtersOpen && (
        <div className="member-filter-bar" id="member-filter-bar" aria-label="猫咪筛选条件">
          {filterOptions.map(({ key, label, values }) => (
            key === "adopter" ? (
              <Popover
                key={key}
                trigger="click"
                placement="bottomLeft"
                title="送养人"
                content={
                  <Input
                    size="small"
                    allowClear
                    aria-label="筛选送养人名字"
                    placeholder="输入名字，支持单字匹配"
                    value={memberFilters.adopter ?? ""}
                    onChange={(event) => changeMemberFilter("adopter", event.target.value.trim() ? event.target.value : undefined)}
                    style={{ width: 220, fontSize: 12 }}
                  />
                }
              >
                <Button size="small" type={memberFilters.adopter ? "primary" : "default"}
                  title={`送养人：${memberFilters.adopter ?? "全部"}`}>
                  <span className="member-filter-label">
                    送养人{memberFilters.adopter ? `：${memberFilters.adopter}` : ""}
                  </span>
                  <DownOutlined />
                </Button>
              </Popover>
            ) : key === "lastVaccineDate" || key === "adoptionDate" ? (
              <Popover
                key={key}
                trigger="click"
                placement="bottomLeft"
                title={label}
                content={
                  <DatePicker.RangePicker
                    size="small"
                    value={dateRanges[key] ?? null}
                    format="YYYY-MM-DD"
                    placeholder={["开始日期", "结束日期"]}
                    onChange={(dates, dateStrings) => {
                      setDateRanges((current) => ({ ...current, [key]: dates }));
                      changeMemberFilter(key, dates ? dateStrings.join("~") : undefined);
                    }}
                  />
                }
              >
                <Button size="small" type={memberFilters[key] !== undefined ? "primary" : "default"}
                  title={`${label}：${memberFilters[key]?.replace("~", " 至 ") ?? "全部"}`}>
                  <span className="member-filter-label">
                    {label}{memberFilters[key] ? `：${memberFilters[key].replace("~", " 至 ")}` : ""}
                  </span>
                  <DownOutlined />
                </Button>
              </Popover>
            ) :
            <Dropdown
              key={key}
              trigger={["click"]}
              menu={{
                selectable: true,
                selectedKeys: [memberFilters[key] === undefined ? "all" : `value:${memberFilters[key]}`],
                items: [
                  { key: "all", label: "全部" },
                  ...values.map((value) => ({ key: `value:${value}`, label: value || "未填写" })),
                ],
                onClick: ({ key: optionKey }) => changeMemberFilter(key, optionKey === "all" ? undefined : optionKey.slice(6)),
                className: "member-filter-menu",
              }}
            >
              <Button
                size="small"
                type={memberFilters[key] !== undefined ? "primary" : "default"}
                title={`${label}：${memberFilters[key] === undefined ? "全部" : memberFilters[key] || "未填写"}`}
              >
                <span className="member-filter-label">
                  {label}{memberFilters[key] !== undefined ? `：${memberFilters[key] || "未填写"}` : ""}
                </span>
                <DownOutlined />
              </Button>
            </Dropdown>
          ))}
          <Button size="small" type="link" disabled={activeFilterCount === 0} onClick={() => {
            setMemberFilters({});
            setDateRanges({});
            setCurrentPage(1);
          }}>清空筛选</Button>
          <Button size="small" type="primary" icon={<DownloadOutlined />}
            disabled={loading || visibleMembers.length === 0} onClick={exportFilteredMembers}>
            导出当前结果（{visibleMembers.length}）
          </Button>
        </div>
      )}

      <Table<CatMemberRow>
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={visibleMembers}
        sortDirections={["ascend", "descend", "ascend"]}
        onChange={(pagination, _filters, sorter) => {
          setCurrentPage(pagination.current ?? 1);
          const current = Array.isArray(sorter) ? sorter[0] : sorter;
          setExportSort(current?.order ? { field: String(current.field), order: current.order } : null);
        }}
        onRow={(member) => {
          const missingFields = getMissingRequiredFields(member);
          return {
            title: missingFields.length > 0
              ? `缺少必填项：${missingFields.join("、")}`
              : undefined,
          };
        }}
        scroll={{ x: 1120 }}
        pagination={{
          current: currentPage,
          pageSize: tablePageSize,
          showSizeChanger: false,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条数据`,
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={searchKeyword || activeFilterCount > 0 ? "未找到匹配的猫咪" : "暂无猫咪成员"}
            />
          ),
        }}
      />

      <Modal
        title={editingMember ? `编辑猫咪成员·${editingMember.name}` : "新增猫咪成员"}
        open={editorOpen}
        width={860}
        centered
        okText={editingMember ? "保存修改" : "保存"}
        cancelText="取消"
        confirmLoading={saving}
        forceRender
        onOk={handleSave}
        onCancel={() => setEditorOpen(false)}
        afterOpenChange={(open) => {
          if (open) memberFormScrollRef.current?.scrollTo({ top: 0, left: 0 });
        }}
        afterClose={() => {
          form.resetFields();
          setEditingMember(null);
          setMemberPhotoPreview("");
          setPhotoChanged(false);
          setAgreementImagePreview("");
          setAgreementImageChanged(false);
        }}
      >
        <div ref={memberFormScrollRef} className="member-form">
          <Form<CatMemberFormValues>
            form={form}
            layout="vertical"
            initialValues={defaultMemberFormValues}
          >
            <div className="member-form-grid">
            <Form.Item name="photo" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="photoPositionX" hidden>
              <InputNumber />
            </Form.Item>
            <Form.Item name="photoPositionY" hidden>
              <InputNumber />
            </Form.Item>
            <Form.Item name="adoptionAgreementImage" hidden>
              <Input />
            </Form.Item>
            <div className="member-photo-editor member-form-full-width">
              {memberPhotoPreview ? (
                <DraggablePhoto
                  source={memberPhotoPreview}
                  positionX={memberPhotoPositionX}
                  positionY={memberPhotoPositionY}
                  onPositionChange={(positionX, positionY) => {
                    form.setFieldsValue({ photoPositionX: positionX, photoPositionY: positionY });
                  }}
                  onImageError={() => {
                    setMemberPhotoPreview("");
                    messageApi.warning("头像文件无法显示，已使用默认图标");
                  }}
                />
              ) : (
                <div className="member-photo-preview">
                  <PawIcon />
                </div>
              )}
              <div className="member-photo-actions">
                <strong>猫咪照片</strong>
                <span>支持 JPG、PNG、WebP，照片使用本地内存路径，如果原路径下图片不存在了将无法展示，请重新上传</span>
                <Space>
                  <Upload
                    accept="image/jpeg,image/png,image/webp"
                    maxCount={1}
                    showUploadList={false}
                    beforeUpload={async (file) => {
                      if (!file.type.startsWith("image/")) {
                        messageApi.error("请选择有效的图片文件");
                        return Upload.LIST_IGNORE;
                      }
                      if (file.size > 10 * 1024 * 1024) {
                        messageApi.error("照片大小不能超过 10MB");
                        return Upload.LIST_IGNORE;
                      }
                      try {
                        setMemberPhotoPreview(await compressPhoto(file));
                        setPhotoChanged(true);
                        form.setFieldsValue({ photoPositionX: 50, photoPositionY: 50 });
                      } catch {
                        messageApi.error("照片读取失败，请重新选择");
                      }
                      return Upload.LIST_IGNORE;
                    }}
                  >
                    <Button icon={<UploadOutlined />}>
                      {memberPhotoPreview ? "更换照片" : "选择照片"}
                    </Button>
                  </Upload>
                  {memberPhotoPreview && (
                    <Button
                      danger
                      onClick={() => {
                        setMemberPhotoPreview("");
                        setPhotoChanged(true);
                        form.setFieldsValue({ photoPositionX: 50, photoPositionY: 50 });
                      }}
                    >
                      移除照片
                    </Button>
                  )}
                </Space>
              </div>
            </div>
            <Form.Item label="序号" name="serialNumber">
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item
              label="名字"
              name="name"
              rules={[{ required: true, whitespace: true, message: "请输入猫咪名字" }]}
            >
              <Input maxLength={50} placeholder="请输入" />
            </Form.Item>
            <Form.Item
              label="是否领养"
              name="adoptionStatus"
              rules={[{ required: true, message: "请选择是否领养" }]}
            >
              <Select
                placeholder="请选择"
                options={["已领养", "未领养"].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </Form.Item>
            <Form.Item label="性别" name="gender" rules={[{ required: true }]}>
              <Select
                options={["公猫", "母猫", "未知"].map((value) => ({ value, label: value }))}
              />
            </Form.Item>
            <Form.Item label="花色" name="coatColor">
              <Input maxLength={50} placeholder="请输入猫咪花色" />
            </Form.Item>
            <Form.Item label="年龄" name="age">
              <Input placeholder="请输入" />
            </Form.Item>
            <Form.Item label="疫苗情况" name="vaccineStatus" rules={[{ required: true }]}>
              <Select
                options={["未接种", "一针", "两针", "已免疫", "已完成", "抗体高", "终身免疫"].map(
                  (value) => ({ value, label: value }),
                )}
              />
            </Form.Item>
            <Form.Item label="绝育情况" name="neutered" rules={[{ required: true }]}>
              <Select
                options={["已绝育", "未绝育", "未知"].map((value) => ({ value, label: value }))}
              />
            </Form.Item>
            <Form.Item label="上一针疫苗时间" name="lastVaccineDate">
              <Input type="date" />
            </Form.Item>
            {adoptionStatus === "已领养" && (
              <Form.Item
                label="领养日期"
                name="adoptionDate"
                rules={[{ required: true, message: "请选择领养日期" }]}
              >
                <Input type="date" />
              </Form.Item>
            )}
            <Form.Item
              label="送养日期"
              name="rehomingDate"
              rules={[
                { required: true, message: "请选择或输入送养日期" },
                { whitespace: true, message: "送养日期不能为空" },
              ]}
            >
              <FlexibleDateInput />
            </Form.Item>
            <Form.Item label="送养人" name="adopter">
              <Input maxLength={50} placeholder="请输入" />
            </Form.Item>
            <Form.Item label="联系方式" name="contact">
              <Input maxLength={100} placeholder="电话、微信或其他联系方式" />
            </Form.Item>
            <Form.Item label="笼位费用" name="cageFee">
              <InputNumber min={0} precision={2} addonAfter="元" />
            </Form.Item>
            <Form.Item label="收费到期" name="feeDueDate">
              <Input type="date" />
            </Form.Item>
            <Form.Item label="状态" name="status">
              <Input maxLength={50} placeholder="请输入" />
            </Form.Item>
            <Form.Item label="楼层" name="floor">
              <Input maxLength={30} placeholder="请输入" />
            </Form.Item>
            <Form.Item label="区域" name="area">
              <AutoComplete
                allowClear
                placeholder="请选择或输入自定义区域"
                options={[
                  "爱丽丝笼",
                  "病房区",
                  "二组铁笼",
                  "观察区",
                  "柜笼",
                  "木别墅",
                  "散养区",
                  "一组铁笼",
                ].map((value) => ({ value, label: value }))}
              />
            </Form.Item>
            <Form.Item label="笼位号" name="cageNumber">
              <Input maxLength={50} placeholder="请输入" />
            </Form.Item>
            <div className="member-agreement-editor member-form-full-width">
              <div className="member-agreement-heading">
                <strong>领养协议</strong>
                <span>可以填写文字、上传协议图片，也可以同时保存</span>
              </div>
              <Form.Item label="协议文字" name="adoptionAgreementText">
                <Input.TextArea
                  rows={3}
                  maxLength={2000}
                  showCount
                  placeholder="请输入领养协议内容"
                />
              </Form.Item>
              <div className="member-agreement-image-row">
                <div className="member-agreement-image-preview">
                  {agreementImagePreview ? (
                    <AntImage
                      src={agreementImagePreview}
                      alt="领养协议预览"
                      preview={{ mask: "查看大图" }}
                      onError={() => {
                        setAgreementImagePreview("");
                        messageApi.warning("领养协议图片无法显示，请重新选择");
                      }}
                    />
                  ) : (
                    <FileImageOutlined />
                  )}
                </div>
                <div className="member-photo-actions">
                  <strong>协议图片</strong>
                  <span>支持 JPG、PNG、WebP；小图保留原文件，大图采用高质量轻度压缩</span>
                  <Space>
                    <Upload
                      accept="image/jpeg,image/png,image/webp"
                      maxCount={1}
                      showUploadList={false}
                      beforeUpload={async (file) => {
                        if (!file.type.startsWith("image/")) {
                          messageApi.error("请选择有效的图片文件");
                          return Upload.LIST_IGNORE;
                        }
                        if (file.size > 25 * 1024 * 1024) {
                          messageApi.error("领养协议图片不能超过 25MB");
                          return Upload.LIST_IGNORE;
                        }
                        try {
                          setAgreementImagePreview(await prepareAgreementImage(file));
                          setAgreementImageChanged(true);
                        } catch {
                          messageApi.error("领养协议图片读取失败，请重新选择");
                        }
                        return Upload.LIST_IGNORE;
                      }}
                    >
                      <Button icon={<UploadOutlined />}>
                        {agreementImagePreview ? "更换图片" : "选择图片"}
                      </Button>
                    </Upload>
                    {agreementImagePreview && (
                      <Button
                        danger
                        onClick={() => {
                          setAgreementImagePreview("");
                          setAgreementImageChanged(true);
                        }}
                      >
                        移除图片
                      </Button>
                    )}
                  </Space>
                </div>
              </div>
            </div>
            <Form.Item label="备注" name="notes" className="member-form-full-width">
              <Input.TextArea rows={3} maxLength={500} showCount placeholder="请输入备注" />
            </Form.Item>
            </div>
          </Form>
        </div>
      </Modal>

      <Drawer
        className="member-detail-drawer"
        title="成员详情"
        width={680}
        open={selectedMember !== null}
        onClose={() => {
          setSelectedMember(null);
          setSelectedPhoto("");
          setSelectedAgreementImage("");
        }}
      >
        {selectedMember && (
          <div className="member-detail-content">
            <div
              className={`member-detail-hero${
                selectedMissingFields.includes("名字") || selectedMissingFields.includes("是否领养")
                  ? " member-detail-hero-missing"
                  : ""
              }`}
            >
              <span className="member-detail-avatar">
                {selectedPhoto ? (
                  <PositionedPhoto
                    source={selectedPhoto}
                    alt={`${selectedMember.name || "猫咪"}的照片`}
                    positionX={selectedMember.photoPositionX ?? 50}
                    positionY={selectedMember.photoPositionY ?? 50}
                    frameSize={52}
                    onError={() => {
                      setSelectedPhoto("");
                      messageApi.warning("头像文件无法显示，已使用默认图标");
                    }}
                  />
                ) : (
                  <PawIcon />
                )}
              </span>
              <div className="member-detail-identity">
                <strong>{displayValue(selectedMember.name)}</strong>
                <span>ID {selectedMember.id}</span>
              </div>
              <Tag
                className="member-detail-adoption-tag"
                color={selectedMember.adoptionStatus === "已领养" ? "green" : "orange"}
              >
                {displayValue(selectedMember.adoptionStatus)}
              </Tag>
            </div>

            {selectedMissingFields.length > 0 && (
              <div className="member-detail-incomplete-alert">
                <WarningOutlined />
                <div>
                  <strong>资料待补充</strong>
                  <span>缺少必填项：{selectedMissingFields.join("、")}</span>
                </div>
              </div>
            )}

            <section className="member-detail-section">
              <h3>基础信息</h3>
              <div className="member-detail-grid">
                <DetailField label="序号" value={displayValue(selectedMember.serialNumber)} />
                <DetailField
                  label="性别"
                  value={displayValue(selectedMember.gender)}
                  missing={selectedMissingFields.includes("性别")}
                />
                <DetailField
                  label="年龄"
                  value={displayValue(selectedMember.age)}
                />
                <DetailField label="花色" value={displayValue(selectedMember.coatColor)} />
                <DetailField
                  label="是否领养"
                  value={displayValue(selectedMember.adoptionStatus)}
                  emphasis
                  missing={selectedMissingFields.includes("是否领养")}
                />
                <DetailField
                  label="疫苗情况"
                  value={displayValue(selectedMember.vaccineStatus)}
                  missing={selectedMissingFields.includes("疫苗情况")}
                />
                <DetailField
                  label="绝育情况"
                  value={displayValue(selectedMember.neutered)}
                  missing={selectedMissingFields.includes("绝育情况")}
                />
                <DetailField label="状态" value={displayValue(selectedMember.status)} />
                <DetailField
                  label="上一针疫苗时间"
                  value={displayValue(selectedMember.lastVaccineDate)}
                />
              </div>
            </section>

            <section className="member-detail-section">
              <h3>领养信息</h3>
              <div className="member-detail-grid">
                <DetailField
                  label="领养日期"
                  value={displayValue(selectedMember.adoptionDate)}
                  missing={selectedMissingFields.includes("领养日期")}
                />
                <DetailField
                  label="送养日期"
                  value={displayValue(selectedMember.rehomingDate)}
                  missing={selectedMissingFields.includes("送养日期")}
                />
                <DetailField label="送养人" value={displayValue(selectedMember.adopter)} />
                <DetailField label="联系方式" value={displayValue(selectedMember.contact)} />
              </div>
            </section>

            <section className="member-detail-section member-detail-agreement-section">
              <h3>领养协议</h3>
              <div className="member-detail-note">
                {displayValue(selectedMember.adoptionAgreementText)}
              </div>
              {selectedAgreementImage && (
                <div className="member-detail-agreement-media">
                  <AntImage
                    className="member-detail-agreement-image"
                    src={selectedAgreementImage}
                    alt={`${selectedMember.name || "猫咪"}的领养协议`}
                    preview={{ mask: "查看大图" }}
                    onError={() => {
                      setSelectedAgreementImage("");
                      messageApi.warning("领养协议图片无法显示");
                    }}
                  />
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={() => downloadAgreementImage(selectedAgreementImage, selectedMember)}
                  >
                    下载协议图片
                  </Button>
                </div>
              )}
            </section>

            <section className="member-detail-section">
              <h3>笼位与费用</h3>
              <div className="member-detail-grid">
                <DetailField label="区域" value={displayValue(selectedMember.area)} />
                <DetailField label="楼层" value={displayValue(selectedMember.floor)} />
                <DetailField label="笼位号" value={displayValue(selectedMember.cageNumber)} />
                <DetailField
                  label="笼位费用"
                  value={selectedMember.cageFee === null ? "-" : `${selectedMember.cageFee} 元`}
                />
                <DetailField
                  label="收费到期"
                  value={displayValue(selectedMember.feeDueDate)}
                  wide
                />
              </div>
            </section>

            <section className="member-detail-section member-detail-note-section">
              <h3>备注</h3>
              <div className="member-detail-note">
                {displayValue(selectedMember.notes)}
              </div>
            </section>
          </div>
        )}
      </Drawer>
    </div>
  );
}
