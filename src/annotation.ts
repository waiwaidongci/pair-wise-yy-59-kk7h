// 披露审阅可迁移标注记录：文档页、去密区域、复核结论的领域逻辑。
// 区域记录页号、旋转角、归一化坐标与来源批次；页面旋转/裁边变化后原复核失效并重算坐标；
// 页序变化时区域锚定稳定页 ID 顺延，绝不漂移到其他页；导入批次支持并发冲突与断点恢复。

export type Rotation = 0 | 90 | 180 | 270;

export type CropBox = { x: number; y: number; width: number; height: number };

export type PageGeometry = { rotation: Rotation; crop: CropBox };

export type PageInfo = {
  id: string; // 稳定页 ID：区域锚定在页 ID 上，页号顺延时不漂移
  pageNumber: number;
  geometry: PageGeometry;
  geometryVersion: number; // 旋转/裁边每次变更 +1，复核结论按版本判定有效性
};

export type RedactionStatus = 'draft' | 'confirmed' | 'pending';

export type Redaction = {
  id: string;
  pageId: string;
  page: number; // 冗余页号，随页序顺延更新
  rotation: Rotation; // 标注所依据的页面旋转角
  x: number;
  y: number;
  width: number;
  height: number; // 归一化坐标（相对当前页面几何：先旋转后裁边）
  sourceBatch: string; // 来源批次（本机绘制 / 导入批次号）
  reason: string;
  privilege: string;
  status: RedactionStatus; // pending = 待复核
};

export type ReviewConclusion = {
  id: string;
  redactionId: string;
  pageId: string;
  pageNumber: number; // 作出结论时的页号
  geometryVersion: number; // 作出结论时的几何版本
  reviewer: string;
  decidedAt: string;
  status: 'effective' | 'invalidated';
  note: string; // 失效原因等；原确认记录始终保留可查
};

export type ImportedRegion = {
  key: string;
  pageNumber: number;
  rotation?: Rotation; // 旧包缺少旋转角时按未旋转(0)处理
  x: number;
  y: number;
  width: number;
  height: number;
  reason: string;
  privilege: string;
};

export type ImportPageGeometry = { pageNumber: number; rotation?: Rotation; crop?: CropBox };

export type ImportBatch = {
  batchId: string;
  documentId: string;
  submittedBy: string;
  pages?: ImportPageGeometry[];
  regions: ImportedRegion[];
};

export type BatchRecord = {
  batchId: string;
  batch: ImportBatch; // 保留原始载荷供断点恢复
  status: 'merged' | 'failed';
  completedPages: number[];
  appliedRegionIds: string[];
  error: string | null;
  receivedAt: string;
  summary: string;
};

export type ImportConflict = { batch: ImportBatch; receivedAt: string; reason: string };

export type DocumentImports = {
  batches: Record<string, BatchRecord>;
  order: string[]; // 到达顺序
  conflicts: ImportConflict[];
};

export type Classification = '内部' | '机密' | '严格机密';

export type DisclosureRecord = {
  id: string;
  title: string;
  bundle: string;
  pages: number; // 与 pageList.length 保持同步
  pageList: PageInfo[];
  classification: Classification;
  owner: string;
  updatedAt: string;
  status: '去密中' | '待质检' | '可发布';
  issue: string;
  size: string;
  redactions: Redaction[];
  conclusions: ReviewConclusion[];
  imports: DocumentImports;
};

export type ImportOutcome = {
  kind: 'applied' | 'duplicate' | 'conflict' | 'failed' | 'ignored';
  message: string;
};

export const FULL_CROP: CropBox = { x: 0, y: 0, width: 1, height: 1 };
export const LOCAL_BATCH = 'LOCAL 本机绘制';
export const LEGACY_BATCH = 'LOCAL-DRAFT 本机草稿';

export const timestamp = () => new Date().toTimeString().slice(0, 5);

export function geometryEquals(a: PageGeometry, b: PageGeometry): boolean {
  const eps = 1e-6;
  return (
    a.rotation === b.rotation &&
    Math.abs(a.crop.x - b.crop.x) < eps &&
    Math.abs(a.crop.y - b.crop.y) < eps &&
    Math.abs(a.crop.width - b.crop.width) < eps &&
    Math.abs(a.crop.height - b.crop.height) < eps
  );
}

type Rect = { x: number; y: number; width: number; height: number };

// 把矩形从“未旋转坐标系”表达到“顺时针旋转 turns*90° 后的坐标系”
function rotateRectCW(rect: Rect, turns: number): Rect {
  let { x, y, width, height } = rect;
  const n = ((turns % 4) + 4) % 4;
  for (let i = 0; i < n; i += 1) {
    const nx = 1 - y - height;
    const ny = x;
    const nw = height;
    const nh = width;
    x = nx;
    y = ny;
    width = nw;
    height = nh;
  }
  return { x, y, width, height };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// 归一化坐标系变换：先按来源裁边还原到整页，再旋转到目标角度，最后按目标裁边归一化
export function transformRect(rect: Rect, from: PageGeometry, to: PageGeometry): Rect {
  const abs: Rect = {
    x: from.crop.x + rect.x * from.crop.width,
    y: from.crop.y + rect.y * from.crop.height,
    width: rect.width * from.crop.width,
    height: rect.height * from.crop.height
  };
  const turns = Math.round((to.rotation - from.rotation) / 90);
  const rotated = rotateRectCW(abs, turns);
  const x = clamp01((rotated.x - to.crop.x) / to.crop.width);
  const y = clamp01((rotated.y - to.crop.y) / to.crop.height);
  const right = clamp01((rotated.x + rotated.width - to.crop.x) / to.crop.width);
  const bottom = clamp01((rotated.y + rotated.height - to.crop.y) / to.crop.height);
  return { x, y, width: Math.max(0.002, right - x), height: Math.max(0.002, bottom - y) };
}

export function makePages(docId: string, count: number): PageInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `P-${docId}-${i + 1}`,
    pageNumber: i + 1,
    geometry: { rotation: 0 as Rotation, crop: FULL_CROP },
    geometryVersion: 1
  }));
}

export const emptyImports = (): DocumentImports => ({ batches: {}, order: [], conflicts: [] });

// 页面旋转或裁边改变：几何版本 +1，页上区域坐标重算，确认态区域转待复核，原复核结论失效但保留
export function withGeometryChange(doc: DisclosureRecord, pageId: string, geometry: PageGeometry, reason: string): DisclosureRecord {
  const page = doc.pageList.find((p) => p.id === pageId);
  if (!page || geometryEquals(page.geometry, geometry)) return doc;
  const from = page.geometry;
  const pageList = doc.pageList.map((p) => (p.id === pageId ? { ...p, geometry, geometryVersion: p.geometryVersion + 1 } : p));
  const redactions = doc.redactions.map((r) => {
    if (r.pageId !== pageId) return r;
    const rect = transformRect(r, from, geometry);
    return { ...r, ...rect, rotation: geometry.rotation, status: r.status === 'confirmed' ? ('pending' as const) : r.status };
  });
  const conclusions = doc.conclusions.map((c) =>
    c.pageId === pageId && c.status === 'effective' ? { ...c, status: 'invalidated' as const, note: reason } : c
  );
  return { ...doc, pageList, redactions, conclusions, updatedAt: timestamp() };
}

// 在指定页之后插入一页：后续页顺延，受影响的原复核转待复核
export function insertPage(doc: DisclosureRecord, afterPageNumber: number): DisclosureRecord {
  const at = Math.min(Math.max(0, afterPageNumber), doc.pageList.length);
  const newPage: PageInfo = {
    id: `P-${doc.id}-N${Date.now().toString(36)}`,
    pageNumber: at + 1,
    geometry: { rotation: 0, crop: FULL_CROP },
    geometryVersion: 1
  };
  const shifted = new Set(doc.pageList.filter((p) => p.pageNumber > at).map((p) => p.id));
  const pageList = [...doc.pageList.slice(0, at), newPage, ...doc.pageList.slice(at)].map((p, i) => ({ ...p, pageNumber: i + 1 }));
  const redactions = doc.redactions.map((r) => {
    if (!shifted.has(r.pageId)) return r;
    // 区域锚定页 ID 顺延页号；确认态转为待复核
    return { ...r, page: r.page + 1, status: r.status === 'confirmed' ? ('pending' as const) : r.status };
  });
  const conclusions = doc.conclusions.map((c) =>
    shifted.has(c.pageId) && c.status === 'effective'
      ? { ...c, status: 'invalidated' as const, note: '页序调整：后续页顺延，需重新复核' }
      : c
  );
  return { ...doc, pageList, pages: pageList.length, redactions, conclusions, updatedAt: timestamp() };
}

// 移除一页：后续页顺延；被移除页的区域保留在原页 ID 上待处理，绝不改挂到其他页
export function removePage(doc: DisclosureRecord, pageId: string): DisclosureRecord {
  const target = doc.pageList.find((p) => p.id === pageId);
  if (!target || doc.pageList.length <= 1) return doc;
  const shifted = new Set(doc.pageList.filter((p) => p.pageNumber > target.pageNumber).map((p) => p.id));
  const pageList = doc.pageList.filter((p) => p.id !== pageId).map((p, i) => ({ ...p, pageNumber: i + 1 }));
  const redactions = doc.redactions.map((r) => {
    if (shifted.has(r.pageId)) {
      return { ...r, page: r.page - 1, status: r.status === 'confirmed' ? ('pending' as const) : r.status };
    }
    if (r.pageId === pageId) {
      return { ...r, status: r.status === 'confirmed' ? ('pending' as const) : r.status };
    }
    return r;
  });
  const conclusions = doc.conclusions.map((c) => {
    if (c.status !== 'effective') return c;
    if (c.pageId === pageId) return { ...c, status: 'invalidated' as const, note: '所在页已移除，区域保留待处理' };
    if (shifted.has(c.pageId)) return { ...c, status: 'invalidated' as const, note: '页序调整：后续页顺延，需重新复核' };
    return c;
  });
  return { ...doc, pageList, pages: pageList.length, redactions, conclusions, updatedAt: timestamp() };
}

// 确认区域：生成一条有效复核结论；同区域旧结论先行作废，历史均可查
export function confirmRedactionOn(doc: DisclosureRecord, redactionId: string, reviewer: string): DisclosureRecord {
  const redaction = doc.redactions.find((r) => r.id === redactionId);
  if (!redaction) return doc;
  const page = doc.pageList.find((p) => p.id === redaction.pageId);
  if (!page) return doc; // 已移除页的区域不能确认
  const conclusions = doc.conclusions.map((c) =>
    c.redactionId === redactionId && c.status === 'effective' ? { ...c, status: 'invalidated' as const, note: '被新的复核结论取代' } : c
  );
  const conclusion: ReviewConclusion = {
    id: `C-${Date.now().toString(36)}-${conclusions.length}`,
    redactionId,
    pageId: page.id,
    pageNumber: page.pageNumber,
    geometryVersion: page.geometryVersion,
    reviewer,
    decidedAt: timestamp(),
    status: 'effective',
    note: redaction.status === 'pending' ? '变更后重新确认' : '人工确认'
  };
  const redactions = doc.redactions.map((r) => (r.id === redactionId ? { ...r, status: 'confirmed' as const } : r));
  return { ...doc, redactions, conclusions: [...conclusions, conclusion], updatedAt: timestamp() };
}

type MergeResult = {
  pageList: PageInfo[];
  redactions: Redaction[];
  conclusions: ReviewConclusion[];
  completedPages: number[];
  appliedRegionIds: string[];
  error: string | null;
};

// 逐页合并导入包；skipPages 为断点恢复时已完成、直接跳过的页
function mergeBatch(doc: DisclosureRecord, batch: ImportBatch, skipPages: Set<number>): MergeResult {
  let current = doc;
  const completedPages: number[] = [];
  const appliedRegionIds: string[] = [];
  const pageNumbers = Array.from(
    new Set([...(batch.pages ?? []).map((p) => p.pageNumber), ...batch.regions.map((r) => r.pageNumber)])
  ).sort((a, b) => a - b);

  for (const pageNumber of pageNumbers) {
    if (skipPages.has(pageNumber)) {
      completedPages.push(pageNumber);
      continue;
    }
    const page = current.pageList.find((p) => p.pageNumber === pageNumber);
    if (!page) {
      return {
        pageList: current.pageList,
        redactions: current.redactions,
        conclusions: current.conclusions,
        completedPages,
        appliedRegionIds,
        error: `第 ${pageNumber} 页不存在（文档共 ${current.pageList.length} 页）`
      };
    }
    const declared = batch.pages?.find((p) => p.pageNumber === pageNumber);
    if (declared) {
      const geometry: PageGeometry = { rotation: declared.rotation ?? 0, crop: declared.crop ?? FULL_CROP };
      current = withGeometryChange(current, page.id, geometry, `批次 ${batch.batchId} 几何变更，原复核失效`);
    }
    const targetPage = current.pageList.find((p) => p.pageNumber === pageNumber)!;
    const additions: Redaction[] = [];
    for (const region of batch.regions.filter((r) => r.pageNumber === pageNumber)) {
      const id = `R-${batch.batchId}-${region.key}`;
      if (current.redactions.some((r) => r.id === id)) continue; // 幂等：同批复传不重复落区
      const regionFrame: PageGeometry = { rotation: region.rotation ?? declared?.rotation ?? 0, crop: declared?.crop ?? FULL_CROP };
      const rect = transformRect(region, regionFrame, targetPage.geometry);
      additions.push({
        id,
        pageId: targetPage.id,
        page: pageNumber,
        rotation: targetPage.geometry.rotation,
        ...rect,
        sourceBatch: batch.batchId,
        reason: region.reason,
        privilege: region.privilege,
        status: 'draft'
      });
      appliedRegionIds.push(id);
    }
    if (additions.length > 0) current = { ...current, redactions: [...current.redactions, ...additions] };
    completedPages.push(pageNumber);
  }
  return {
    pageList: current.pageList,
    redactions: current.redactions,
    conclusions: current.conclusions,
    completedPages,
    appliedRegionIds,
    error: null
  };
}

function runMerge(doc: DisclosureRecord, batch: ImportBatch, prior?: BatchRecord): { doc: DisclosureRecord; outcome: ImportOutcome } {
  const result = mergeBatch(doc, batch, new Set(prior?.completedPages ?? []));
  const completedPages = [...(prior?.completedPages ?? []), ...result.completedPages];
  const appliedRegionIds = [...(prior?.appliedRegionIds ?? []), ...result.appliedRegionIds];
  const record: BatchRecord = {
    batchId: batch.batchId,
    batch,
    status: result.error ? 'failed' : 'merged',
    completedPages,
    appliedRegionIds,
    error: result.error,
    receivedAt: prior?.receivedAt ?? timestamp(),
    summary: result.error ? `中断：${result.error}；已完成 ${completedPages.length} 页，可从断点恢复` : `合并 ${completedPages.length} 页 / ${appliedRegionIds.length} 个区域`
  };
  const next: DisclosureRecord = {
    ...doc,
    pageList: result.pageList,
    pages: result.pageList.length,
    redactions: result.redactions,
    conclusions: result.conclusions,
    imports: {
      ...doc.imports,
      batches: { ...doc.imports.batches, [batch.batchId]: record },
      order: prior ? doc.imports.order : [...doc.imports.order, batch.batchId]
    },
    updatedAt: timestamp()
  };
  return {
    doc: next,
    outcome: result.error
      ? { kind: 'failed', message: `批次 ${batch.batchId} 合并中断：${result.error}。已完成 ${completedPages.length} 页，可从断点恢复` }
      : { kind: 'applied', message: `批次 ${batch.batchId} 合并完成：${record.summary}` }
  };
}

// 提交导入包：同批复传沿用第一次结果；前一批次未完成时后到内容留作冲突；否则先到批次生效
export function submitBatch(doc: DisclosureRecord, batch: ImportBatch): { doc: DisclosureRecord; outcome: ImportOutcome } {
  const existing = doc.imports.batches[batch.batchId];
  if (existing) {
    return {
      doc,
      outcome: { kind: 'duplicate', message: `批次 ${batch.batchId} 已接收（${existing.status === 'merged' ? '合并完成' : '合并中断'}），同批复传沿用第一次结果` }
    };
  }
  if (doc.imports.conflicts.some((c) => c.batch.batchId === batch.batchId)) {
    return { doc, outcome: { kind: 'duplicate', message: `批次 ${batch.batchId} 已留作冲突，沿用第一次处理` } };
  }
  const active = doc.imports.order.map((id) => doc.imports.batches[id]).find((r) => r.status !== 'merged');
  if (active) {
    const conflict: ImportConflict = { batch, receivedAt: timestamp(), reason: `批次 ${active.batchId} 合并中断待恢复，后到内容留作冲突` };
    return {
      doc: { ...doc, imports: { ...doc.imports, conflicts: [...doc.imports.conflicts, conflict] } },
      outcome: { kind: 'conflict', message: `批次 ${active.batchId} 尚未完成，${batch.batchId} 已留作冲突` }
    };
  }
  return runMerge(doc, batch);
}

// 合并失败后从已完成页恢复
export function resumeBatch(doc: DisclosureRecord, batchId: string): { doc: DisclosureRecord; outcome: ImportOutcome } {
  const record = doc.imports.batches[batchId];
  if (!record || record.status !== 'failed') {
    return { doc, outcome: { kind: 'ignored', message: '该批次不在中断状态，无需恢复' } };
  }
  return runMerge(doc, record.batch, record);
}

export function applyConflict(doc: DisclosureRecord, batchId: string): { doc: DisclosureRecord; outcome: ImportOutcome } {
  const conflict = doc.imports.conflicts.find((c) => c.batch.batchId === batchId);
  if (!conflict) return { doc, outcome: { kind: 'ignored', message: '冲突记录不存在' } };
  const active = doc.imports.order.map((id) => doc.imports.batches[id]).find((r) => r.status !== 'merged');
  if (active) {
    return { doc, outcome: { kind: 'ignored', message: `批次 ${active.batchId} 尚未完成，冲突批次暂不能应用` } };
  }
  const cleared: DisclosureRecord = { ...doc, imports: { ...doc.imports, conflicts: doc.imports.conflicts.filter((c) => c.batch.batchId !== batchId) } };
  return runMerge(cleared, conflict.batch);
}

export function discardConflict(doc: DisclosureRecord, batchId: string): DisclosureRecord {
  return { ...doc, imports: { ...doc.imports, conflicts: doc.imports.conflicts.filter((c) => c.batch.batchId !== batchId) } };
}

type LegacyRedaction = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  reason: string;
  privilege: string;
  status: 'draft' | 'confirmed';
};

type LegacyDocument = Omit<DisclosureRecord, 'pageList' | 'redactions' | 'conclusions' | 'imports'> & { redactions?: LegacyRedaction[] };

// 旧数据迁移：缺少旋转角按未旋转(0)兼容；原确认记录迁移为可查的复核结论
export function migrateLegacyDocument(old: LegacyDocument): DisclosureRecord {
  const pageCount = Math.max(1, old.pages || 1);
  const pageList = makePages(old.id, pageCount);
  const redactions: Redaction[] = (old.redactions ?? []).map((r) => {
    const page = Math.min(Math.max(1, r.page || 1), pageCount);
    return {
      ...r,
      page,
      pageId: pageList[page - 1].id,
      rotation: 0,
      sourceBatch: LEGACY_BATCH,
      status: r.status === 'confirmed' ? 'confirmed' : 'draft'
    };
  });
  const conclusions: ReviewConclusion[] = redactions
    .filter((r) => r.status === 'confirmed')
    .map((r) => ({
      id: `C-MIG-${r.id}`,
      redactionId: r.id,
      pageId: r.pageId,
      pageNumber: r.page,
      geometryVersion: 1,
      reviewer: '历史复核',
      decidedAt: old.updatedAt ?? '--',
      status: 'effective' as const,
      note: '旧数据迁移：原确认记录'
    }));
  return { ...old, pages: pageCount, pageList, redactions, conclusions, imports: emptyImports() };
}
