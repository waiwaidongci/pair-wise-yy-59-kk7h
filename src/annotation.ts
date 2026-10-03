// 可迁移标注记录：文档页几何、去密区域、复核结论的导入导出与合并逻辑。
// 所有坐标均为归一化坐标（0..1），旋转角为顺时针 90° 的整数倍。

export type Norm = { x: number; y: number; width: number; height: number };
export type Rotation = 0 | 90 | 180 | 270;

export const FULL_CROP: Norm = { x: 0, y: 0, width: 1, height: 1 };

export type PageGeometry = {
  pageId: string;   // 稳定页标识：增删页时区域靠它锚定，而不是靠页号
  pdfPage: number;  // 对应 PDF 内的页序
  rotation: Rotation;
  crop: Norm;       // 显示空间（旋转后的页面）归一化裁边
};

export type RegionStatus = 'draft' | 'confirmed' | 'pending';

export type Redaction = {
  id: string;
  pageId: string;
  page: number;                 // 显示页号，增删页时顺延
  x: number; y: number; width: number; height: number;  // 归一化坐标（记录空间 = rotation + crop）
  rotation: Rotation;           // 记录坐标时的页面旋转角
  crop: Norm;                   // 记录坐标时的页面裁边
  sourceBatchId: string;        // 来源批次
  reason: string;
  privilege: string;
  status: RegionStatus;
  quarantined: boolean;
  updatedAt: string;
};

export type QuarantinedRegion = Redaction & {
  quarantined: true;
  quarantineReason: string;
  sourceBatchId: string;
  quarantinedAt: string;
};

export type Conclusion = {
  id: string;
  redactionId: string;
  pageId: string;
  page: number;
  result: 'confirmed' | 'rejected';
  reviewer: string;
  batchId: string;
  at: string;
  note?: string;
};

export type AnnotationPackage = {
  format: 'yy59-annotation-package';
  version: 1;
  packageId: string;
  documentId: string;
  documentTitle: string;
  exportedAt: string;
  pages: Array<{ pageId: string; pdfPage: number; rotation: Rotation; crop: Norm }>;
  regions: Array<{
    id: string;
    pageId: string;
    page: number;
    x: number; y: number; width: number; height: number;
    rotation: Rotation;
    crop: Norm;
    sourceBatchId: string;
    reason: string;
    privilege: string;
    status: 'draft' | 'confirmed';
    conclusions: Conclusion[];
  }>;
};

export type BatchStatus = 'applied' | 'partial' | 'conflict' | 'duplicate' | 'failed';

export type BatchRecord = {
  batchId: string;
  receivedAt: string;
  status: BatchStatus;
  pkg?: AnnotationPackage;
  appliedRegions: number;
  pendingRegions: number;
  quarantinedRegions: number;
  recoveredPages: number[];
  failedPages: number[];
  messages: string[];
};

export type DisclosureRecord = {
  id: string;
  title: string;
  bundle: string;
  pages: number;
  classification: '内部' | '机密' | '严格机密';
  owner: string;
  updatedAt: string;
  status: '去密中' | '待质检' | '可发布';
  issue: string;
  size: string;
  pageList: PageGeometry[];
  redactions: Redaction[];
  quarantine: QuarantinedRegion[];
  conclusionHistory: Conclusion[];
  batches: BatchRecord[];
};

export const rid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizeRotation = (value: number): Rotation => {
  const r = ((Math.round(value / 90) * 90) % 360 + 360) % 360;
  return r as Rotation;
};

const rectEq = (a: Norm, b: Norm) =>
  Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 &&
  Math.abs(a.width - b.width) < 1e-6 && Math.abs(a.height - b.height) < 1e-6;

// 归一化坐标变换：从来源空间（rotation + crop）变换到目标空间。
// 以未旋转的原生页面坐标为转轴：先把来源空间的点反旋转回原生空间，
// 再按目标旋转角正旋转、按目标裁边换算。
const rotatePoint = (p: { x: number; y: number }, r: Rotation) => {
  switch (r) {
    case 90: return { x: 1 - p.y, y: p.x };
    case 180: return { x: 1 - p.x, y: 1 - p.y };
    case 270: return { x: p.y, y: 1 - p.x };
    default: return p;
  }
};
const unrotatePoint = (p: { x: number; y: number }, r: Rotation) => {
  switch (r) {
    case 90: return { x: p.y, y: 1 - p.x };
    case 180: return { x: 1 - p.x, y: 1 - p.y };
    case 270: return { x: 1 - p.y, y: p.x };
    default: return p;
  }
};

export type TransformResult = { rect: Norm; inBounds: boolean };

export function transformRect(
  rect: Norm,
  from: { rotation: Rotation; crop: Norm },
  to: { rotation: Rotation; crop: Norm }
): TransformResult {
  const corners = [
    { u: rect.x, v: rect.y },
    { u: rect.x + rect.width, v: rect.y },
    { u: rect.x, v: rect.y + rect.height },
    { u: rect.x + rect.width, v: rect.y + rect.height }
  ];
  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of corners) {
    const displayed = { x: from.crop.x + c.u * from.crop.width, y: from.crop.y + c.v * from.crop.height };
    const native = unrotatePoint(displayed, from.rotation);
    const targetDisplayed = rotatePoint(native, to.rotation);
    xs.push((targetDisplayed.x - to.crop.x) / to.crop.width);
    ys.push((targetDisplayed.y - to.crop.y) / to.crop.height);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const out: Norm = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  const inBounds = minX >= -1e-6 && minY >= -1e-6 && maxX <= 1 + 1e-6 && maxY <= 1 + 1e-6;
  return { rect: out, inBounds };
}

// 几何变化后重算区域：落不下就隔离，绝不落到别的页。
export function recomputeRegion(
  region: Redaction,
  target: { rotation: Rotation; crop: Norm },
  at: string
): { region: Redaction; invalidated: boolean; quarantined: boolean } {
  const { rect, inBounds } = transformRect(
    { x: region.x, y: region.y, width: region.width, height: region.height },
    { rotation: region.rotation, crop: region.crop },
    target
  );
  if (!inBounds) {
    return {
      region: { ...region, updatedAt: at },
      invalidated: false,
      quarantined: true
    };
  }
  const changed = region.rotation !== target.rotation || !rectEq(region.crop, target.crop);
  return {
    region: {
      ...region,
      x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      rotation: target.rotation,
      crop: { ...target.crop },
      status: changed && region.status === 'confirmed' ? 'pending' : region.status,
      quarantined: false,
      updatedAt: at
    },
    invalidated: changed && region.status === 'confirmed',
    quarantined: false
  };
}

export function buildPackage(doc: DisclosureRecord, packageId: string, at: string): AnnotationPackage {
  return {
    format: 'yy59-annotation-package',
    version: 1,
    packageId,
    documentId: doc.id,
    documentTitle: doc.title,
    exportedAt: at,
    pages: doc.pageList.map((p) => ({ pageId: p.pageId, pdfPage: p.pdfPage, rotation: p.rotation, crop: { ...p.crop } })),
    regions: doc.redactions.filter((r) => !r.quarantined).map((r) => ({
      id: r.id,
      pageId: r.pageId,
      page: r.page,
      x: r.x, y: r.y, width: r.width, height: r.height,
      rotation: r.rotation,
      crop: { ...r.crop },
      sourceBatchId: r.sourceBatchId,
      reason: r.reason,
      privilege: r.privilege,
      status: r.status === 'confirmed' ? 'confirmed' : 'draft',
      conclusions: doc.conclusionHistory
        .filter((c) => c.redactionId === r.id)
        .map((c) => ({ ...c }))
    }))
  };
}

export class PackageError extends Error {}

export function validatePackage(pkg: unknown, documentId: string): AnnotationPackage {
  if (typeof pkg !== 'object' || pkg === null) throw new PackageError('标注包不是有效 JSON 对象');
  const p = pkg as Partial<AnnotationPackage>;
  if (p.format !== 'yy59-annotation-package') throw new PackageError('无法识别的标注包格式');
  if (p.version !== 1) throw new PackageError(`不支持的标注包版本：${String(p.version)}`);
  if (!p.packageId) throw new PackageError('标注包缺少批次号');
  if (p.documentId !== documentId) throw new PackageError(`标注包属于文档 ${String(p.documentId)}，与当前文档 ${documentId} 不符`);
  if (!Array.isArray(p.pages) || p.pages.length === 0) throw new PackageError('标注包缺少页面信息');
  if (!Array.isArray(p.regions)) throw new PackageError('标注包缺少区域信息');
  return p as AnnotationPackage;
}

// 外聘复核员回传包示例：第 1 页旋转 90° 并裁边，区域在该空间中给出；
// 第 2 页旋转 180°；另有一个区域超出裁边范围，用于演示隔离。
export function buildDemoPackage(doc: DisclosureRecord): AnnotationPackage {
  const pages = doc.pageList.map((p, index) => index === 0
    ? { pageId: p.pageId, pdfPage: p.pdfPage, rotation: 90 as Rotation, crop: { x: 0.06, y: 0.08, width: 0.88, height: 0.84 } }
    : index === 1
      ? { pageId: p.pageId, pdfPage: p.pdfPage, rotation: 180 as Rotation, crop: { ...FULL_CROP } }
      : { pageId: p.pageId, pdfPage: p.pdfPage, rotation: 0 as Rotation, crop: { ...FULL_CROP } });
  const regions: AnnotationPackage['regions'] = [
    {
      id: 'X-01', pageId: pages[0].pageId, page: 1,
      x: 0.12, y: 0.16, width: 0.42, height: 0.07,
      rotation: 90, crop: { ...pages[0].crop }, sourceBatchId: 'EXT-DEMO',
      reason: '商业秘密（外聘标注）', privilege: '合同保密', status: 'confirmed', conclusions: []
    },
    {
      id: 'X-02', pageId: pages[0].pageId, page: 1,
      x: 0.52, y: 0.55, width: 0.30, height: 0.10,
      rotation: 90, crop: { ...pages[0].crop }, sourceBatchId: 'EXT-DEMO',
      reason: '个人手机号（外聘标注）', privilege: '个人信息', status: 'confirmed', conclusions: []
    },
    {
      id: 'X-03', pageId: pages[0].pageId, page: 1,
      x: 0.88, y: 0.88, width: 0.25, height: 0.25,
      rotation: 90, crop: { ...pages[0].crop }, sourceBatchId: 'EXT-DEMO',
      reason: '第三方报价（外聘标注）', privilege: '商业敏感', status: 'confirmed', conclusions: []
    }
  ];
  if (pages[1]) {
    regions.push({
      id: 'X-04', pageId: pages[1].pageId, page: 2,
      x: 0.20, y: 0.30, width: 0.40, height: 0.06,
      rotation: 180, crop: { ...FULL_CROP }, sourceBatchId: 'EXT-DEMO',
      reason: '内部调查意见（外聘标注）', privilege: '工作成果', status: 'draft', conclusions: []
    });
  }
  return {
    format: 'yy59-annotation-package',
    version: 1,
    packageId: 'EXT-DEMO',
    documentId: doc.id,
    documentTitle: doc.title,
    exportedAt: new Date().toISOString(),
    pages,
    regions
  };
}
