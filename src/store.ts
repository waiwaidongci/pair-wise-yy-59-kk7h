import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  buildPackage,
  buildDemoPackage,
  FULL_CROP,
  normalizeRotation,
  recomputeRegion,
  rid,
  transformRect,
  validatePackage,
  type AnnotationPackage,
  type BatchRecord,
  type BatchStatus,
  type Conclusion,
  type DisclosureRecord,
  type Norm,
  type PageGeometry,
  type QuarantinedRegion,
  type Redaction,
  type Rotation
} from './annotation';

export type {
  AnnotationPackage, BatchRecord, BatchStatus, Conclusion, DisclosureRecord,
  Norm, PageGeometry, QuarantinedRegion, Redaction, RegionStatus
} from './annotation';

const makePage = (docId: string, pdfPage: number): PageGeometry => ({
  pageId: `P-${docId}-${pdfPage}`,
  pdfPage,
  rotation: 0,
  crop: { ...FULL_CROP }
});

const defaultDocuments: DisclosureRecord[] = [
  {
    id: 'DOC-00418',
    title: '设备采购补充协议（第三版）',
    bundle: '北岭项目 · 第一批披露',
    pages: 3,
    classification: '严格机密',
    owner: '林清',
    updatedAt: '09:48',
    status: '去密中',
    issue: '合同主体与商业条款',
    size: '8.4 MB',
    pageList: [makePage('DOC-00418', 1), makePage('DOC-00418', 2), makePage('DOC-00418', 3)],
    redactions: [
      { id: 'R-01', pageId: 'P-DOC-00418-1', page: 1, x: 0.12, y: 0.16, width: 0.30, height: 0.04, rotation: 0, crop: { ...FULL_CROP }, sourceBatchId: 'LOCAL', reason: '商业秘密', privilege: '合同保密', status: 'confirmed', quarantined: false, updatedAt: '09:48' },
      { id: 'R-02', pageId: 'P-DOC-00418-1', page: 1, x: 0.50, y: 0.43, width: 0.34, height: 0.06, rotation: 0, crop: { ...FULL_CROP }, sourceBatchId: 'LOCAL', reason: '个人手机号', privilege: '个人信息', status: 'draft', quarantined: false, updatedAt: '09:48' },
      { id: 'R-03', pageId: 'P-DOC-00418-2', page: 2, x: 0.11, y: 0.25, width: 0.68, height: 0.05, rotation: 0, crop: { ...FULL_CROP }, sourceBatchId: 'LOCAL', reason: '第三方报价', privilege: '商业敏感', status: 'confirmed', quarantined: false, updatedAt: '09:48' }
    ],
    quarantine: [],
    conclusionHistory: [
      { id: 'C-01', redactionId: 'R-01', pageId: 'P-DOC-00418-1', page: 1, result: 'confirmed', reviewer: '林清', batchId: 'LOCAL', at: '09:48', note: '本机绘制并确认' },
      { id: 'C-03', redactionId: 'R-03', pageId: 'P-DOC-00418-2', page: 2, result: 'confirmed', reviewer: '林清', batchId: 'LOCAL', at: '09:48', note: '本机绘制并确认' }
    ],
    batches: []
  },
  {
    id: 'DOC-00427',
    title: '现场会议纪要 2026-08-19',
    bundle: '北岭项目 · 第一批披露',
    pages: 3,
    classification: '机密',
    owner: '周叙',
    updatedAt: '09:31',
    status: '待质检',
    issue: '事故预防与整改安排',
    size: '3.1 MB',
    pageList: [makePage('DOC-00427', 1), makePage('DOC-00427', 2), makePage('DOC-00427', 3)],
    redactions: [
      { id: 'R-04', pageId: 'P-DOC-00427-1', page: 1, x: 0.08, y: 0.69, width: 0.74, height: 0.05, rotation: 0, crop: { ...FULL_CROP }, sourceBatchId: 'LOCAL', reason: '内部调查意见', privilege: '工作成果', status: 'confirmed', quarantined: false, updatedAt: '09:31' }
    ],
    quarantine: [],
    conclusionHistory: [
      { id: 'C-04', redactionId: 'R-04', pageId: 'P-DOC-00427-1', page: 1, result: 'confirmed', reviewer: '周叙', batchId: 'LOCAL', at: '09:31', note: '本机绘制并确认' }
    ],
    batches: []
  },
  {
    id: 'DOC-00435',
    title: '设备运行数据摘录',
    bundle: '北岭项目 · 第二批披露',
    pages: 3,
    classification: '内部',
    owner: '顾言',
    updatedAt: '08:56',
    status: '可发布',
    issue: '运行记录',
    size: '12.7 MB',
    pageList: [makePage('DOC-00435', 1), makePage('DOC-00435', 2), makePage('DOC-00435', 3)],
    redactions: [
      { id: 'R-05', pageId: 'P-DOC-00435-2', page: 2, x: 0.44, y: 0.56, width: 0.26, height: 0.04, rotation: 0, crop: { ...FULL_CROP }, sourceBatchId: 'LOCAL', reason: '人员姓名', privilege: '个人信息', status: 'confirmed', quarantined: false, updatedAt: '08:56' }
    ],
    quarantine: [],
    conclusionHistory: [
      { id: 'C-05', redactionId: 'R-05', pageId: 'P-DOC-00435-2', page: 2, result: 'confirmed', reviewer: '顾言', batchId: 'LOCAL', at: '08:56', note: '本机绘制并确认' }
    ],
    batches: []
  }
];

// 旧数据兼容：缺少 pageList / rotation / crop 时按未旋转全页补齐。
export function normalizeDoc(raw: unknown): DisclosureRecord {
  const d = raw as Partial<DisclosureRecord> & { redactions?: Array<Partial<Redaction>> };
  const pageList: PageGeometry[] = Array.isArray(d.pageList) && d.pageList.length > 0
    ? d.pageList.map((p) => ({ ...p, rotation: normalizeRotation(p.rotation ?? 0), crop: p.crop ?? { ...FULL_CROP } }))
    : Array.from({ length: d.pages ?? 3 }, (_, i) => makePage(d.id ?? 'DOC', i + 1));
  return {
    ...(d as DisclosureRecord),
    pageList,
    redactions: (d.redactions ?? []).map((r) => {
      const pageId = r.pageId ?? pageList[(r.page ?? 1) - 1]?.pageId ?? pageList[0].pageId;
      return {
        ...r,
        pageId,
        page: r.page ?? pageList.findIndex((p) => p.pageId === pageId) + 1,
        rotation: normalizeRotation(r.rotation ?? 0),
        crop: r.crop ?? { ...FULL_CROP },
        sourceBatchId: r.sourceBatchId ?? 'LOCAL',
        quarantined: r.quarantined ?? false,
        updatedAt: r.updatedAt ?? ''
      } as Redaction;
    }),
    quarantine: d.quarantine ?? [],
    conclusionHistory: d.conclusionHistory ?? [],
    batches: d.batches ?? []
  };
}

type State = {
  documents: DisclosureRecord[];
  activeDocumentId: string;
  activePage: number;
  activeRedactionId: string | null;
  redactionMode: boolean;
  reviewChecks: Record<string, boolean>;
  metadataCleaned: boolean;
  selectDocument: (id: string) => void;
  setPage: (page: number) => void;
  toggleRedactionMode: () => void;
  addRedaction: (redaction: Omit<Redaction, 'id' | 'status' | 'page' | 'pageId' | 'rotation' | 'crop' | 'quarantined' | 'updatedAt' | 'sourceBatchId'> & { page?: number; pageId?: string; rotation?: Rotation; crop?: Norm; sourceBatchId?: string }) => void;
  confirmRedaction: (id: string) => void;
  selectRedaction: (id: string) => void;
  updateClassification: (classification: DisclosureRecord['classification']) => void;
  toggleReviewCheck: (id: string) => void;
  toggleMetadata: () => void;
  markReady: () => void;
  setPageGeometry: (pageId: string, patch: { rotation?: Rotation; crop?: Norm }) => number;
  addPage: () => void;
  removePage: (pageId: string) => void;
  importPackage: (pkg: unknown) => BatchRecord;
  retryBatch: (batchId: string) => BatchRecord;
  exportPackage: () => void;
  importDemoPackage: () => BatchRecord;
};

// 把标注包合并进文档：逐页提交，单页失败不影响已完成页。
function mergePackage(doc: DisclosureRecord, pkg: AnnotationPackage, receivedAt: string): { doc: DisclosureRecord; result: BatchRecord } {
  const messages: string[] = [];
  const recoveredPages: number[] = [];
  const failedPages: number[] = [];
  let appliedRegions = 0;
  let pendingRegions = 0;
  let quarantinedRegions = 0;

  let next: DisclosureRecord = {
    ...doc,
    pageList: doc.pageList.map((p) => ({ ...p, crop: { ...p.crop } })),
    redactions: doc.redactions.map((r) => ({ ...r, crop: { ...r.crop } })),
    quarantine: [...doc.quarantine],
    conclusionHistory: [...doc.conclusionHistory],
    batches: [...doc.batches]
  };

  const existingIds = new Set(next.redactions.map((r) => r.id));

  for (const [pkgIndex, pkgPage] of pkg.pages.entries()) {
    try {
      const targetIndex = next.pageList.findIndex((p) => p.pageId === pkgPage.pageId);
      if (targetIndex < 0) {
        // 该页在本文档已被移除：区域不能落到别的页，整页隔离。
        const orphanRegions = pkg.regions.filter((r) => r.pageId === pkgPage.pageId);
        for (const pr of orphanRegions) {
          next = quarantineRegion(next, pr, pkg.packageId, receivedAt, `标注包第 ${pkgIndex + 1} 页在本文档已移除`);
          quarantinedRegions += 1;
        }
        failedPages.push(pkgIndex + 1);
        messages.push(`第 ${pkgIndex + 1} 页已不存在，${orphanRegions.length} 个区域转入隔离区`);
        continue;
      }
      const target = next.pageList[targetIndex];
      recoveredPages.push(targetIndex + 1);

      for (const pr of pkg.regions.filter((r) => r.pageId === pkgPage.pageId)) {
        const { rect, inBounds } = transformRect(
          { x: pr.x, y: pr.y, width: pr.width, height: pr.height },
          { rotation: pr.rotation, crop: pr.crop },
          { rotation: target.rotation, crop: target.crop }
        );
        if (!inBounds) {
          next = quarantineRegion(next, pr, pkg.packageId, receivedAt, `变换后超出第 ${targetIndex + 1} 页范围`);
          quarantinedRegions += 1;
          continue;
        }
        const changed = pr.rotation !== target.rotation || !rectEq(pr.crop, target.crop);
        const idBase = existingIds.has(pr.id) ? `${pr.id}@${pkg.packageId}` : pr.id;
        existingIds.add(idBase);
        const region: Redaction = {
          id: idBase,
          pageId: target.pageId,
          page: targetIndex + 1,
          x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          rotation: target.rotation,
          crop: { ...target.crop },
          sourceBatchId: pr.sourceBatchId || pkg.packageId,
          reason: pr.reason,
          privilege: pr.privilege,
          status: changed ? 'pending' : pr.status === 'confirmed' ? 'confirmed' : 'draft',
          quarantined: false,
          updatedAt: receivedAt
        };
        // 同批复传幂等：替换同 id 旧值。
        next = { ...next, redactions: [...next.redactions.filter((r) => r.id !== region.id), region] };
        for (const c of pr.conclusions) {
          const conclusionId = doc.conclusionHistory.some((h) => h.id === c.id) ? `${c.id}@${pkg.packageId}` : c.id;
          next = { ...next, conclusionHistory: [...next.conclusionHistory.filter((h) => h.id !== conclusionId), { ...c, id: conclusionId, redactionId: region.id, pageId: target.pageId, page: targetIndex + 1 }] };
        }
        if (changed && pr.status === 'confirmed') {
          pendingRegions += 1;
          messages.push(`第 ${targetIndex + 1} 页几何变化，${region.id} 的原复核失效，转待复核`);
        }
        appliedRegions += 1;
      }
    } catch (error) {
      failedPages.push(pkgIndex + 1);
      messages.push(`第 ${pkgIndex + 1} 页合并失败（${(error as Error).message}），已从该页恢复`);
    }
  }

  const status: BatchStatus = failedPages.length === 0 ? 'applied' : recoveredPages.length > 0 ? 'partial' : 'failed';
  const result: BatchRecord = {
    batchId: pkg.packageId,
    receivedAt,
    status,
    pkg,
    appliedRegions,
    pendingRegions,
    quarantinedRegions,
    recoveredPages,
    failedPages,
    messages
  };
  next = { ...next, pages: next.pageList.length, batches: [...next.batches, result] };
  return { doc: next, result };
}

function rectEq(a: Norm, b: Norm) {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6 &&
    Math.abs(a.width - b.width) < 1e-6 && Math.abs(a.height - b.height) < 1e-6;
}

function quarantineRegion(
  doc: DisclosureRecord,
  pr: AnnotationPackage['regions'][number],
  batchId: string,
  at: string,
  detail: string
): DisclosureRecord {
  const item: QuarantinedRegion = {
    id: `${pr.id}@${batchId}`,
    pageId: pr.pageId,
    page: pr.page,
    x: pr.x, y: pr.y, width: pr.width, height: pr.height,
    rotation: pr.rotation,
    crop: { ...pr.crop },
    sourceBatchId: pr.sourceBatchId || batchId,
    reason: pr.reason,
    privilege: pr.privilege,
    status: pr.status === 'confirmed' ? 'confirmed' : 'draft',
    quarantined: true,
    quarantineReason: detail,
    updatedAt: at,
    quarantinedAt: at
  };
  return { ...doc, quarantine: [...doc.quarantine.filter((q) => q.id !== item.id), item] };
}

// 几何变化（旋转/裁边）后：同页区域重算坐标，已确认复核失效转待复核。
function applyGeometryChange(doc: DisclosureRecord, pageId: string, patch: { rotation?: Rotation; crop?: Norm }, at: string): { doc: DisclosureRecord; invalidated: number } {
  const target = doc.pageList.find((p) => p.pageId === pageId);
  if (!target) return { doc, invalidated: 0 };
  const nextPageList = doc.pageList.map((p) => p.pageId === pageId
    ? { ...p, rotation: patch.rotation ?? p.rotation, crop: patch.crop ?? { ...p.crop } }
    : p);
  const nextTarget = nextPageList.find((p) => p.pageId === pageId)!;
  let invalidated = 0;
  const quarantine: QuarantinedRegion[] = [...doc.quarantine];
  const redactions: Redaction[] = [];
  for (const r of doc.redactions) {
    if (r.pageId !== pageId || r.quarantined) { redactions.push(r); continue; }
    const { region, invalidated: wasInvalidated, quarantined } = recomputeRegion(r, nextTarget, at);
    if (quarantined) {
      quarantine.push({ ...region, quarantined: true, quarantineReason: '几何变化后超出页面范围', sourceBatchId: r.sourceBatchId, quarantinedAt: at });
      continue;
    }
    if (wasInvalidated) {
      invalidated += 1;
      redactions.push(region);
    } else {
      redactions.push(region);
    }
  }
  return { doc: { ...doc, pageList: nextPageList, redactions, quarantine }, invalidated };
}

// 增删页后顺延页号；受影响的已确认复核转待复核。
function renumber(doc: DisclosureRecord, at: string): { doc: DisclosureRecord; invalidated: number } {
  const pageList = doc.pageList.map((p, index) => ({ ...p, page: index + 1 }));
  let invalidated = 0;
  const redactions = doc.redactions.map((r) => {
    if (r.quarantined) return r;
    const pageIndex = pageList.findIndex((p) => p.pageId === r.pageId);
    if (pageIndex < 0) return r;
    const page = pageIndex + 1;
    const shifted = page !== r.page;
    if (shifted && r.status === 'confirmed') {
      invalidated += 1;
      return { ...r, page, status: 'pending' as const, updatedAt: at };
    }
    return { ...r, page, updatedAt: shifted ? at : r.updatedAt };
  });
  return { doc: { ...doc, pageList, redactions }, invalidated };
}

export const useDisclosureStore = create<State>()(
  persist(
    (set, get) => ({
      documents: defaultDocuments,
      activeDocumentId: defaultDocuments[0].id,
      activePage: 1,
      activeRedactionId: 'R-02',
      redactionMode: false,
      reviewChecks: {
        'forbidden-terms': true,
        'page-number': true,
        'image-boundary': false,
        'metadata': false
      },
      metadataCleaned: false,
      selectDocument: (id) => set({ activeDocumentId: id, activePage: 1, activeRedactionId: null, redactionMode: false }),
      setPage: (page) => set({ activePage: page }),
      toggleRedactionMode: () => set((state) => ({ redactionMode: !state.redactionMode })),
      addRedaction: (redaction) => set((state) => {
        const doc = state.documents.find((d) => d.id === state.activeDocumentId);
        if (!doc) return state;
        const pageId = redaction.pageId ?? doc.pageList[state.activePage - 1]?.pageId;
        const page = doc.pageList.findIndex((p) => p.pageId === pageId) + 1;
        const geometry = doc.pageList.find((p) => p.pageId === pageId);
        const item: Redaction = {
          id: `R-${rid()}`,
          pageId,
          page,
          x: redaction.x, y: redaction.y, width: redaction.width, height: redaction.height,
          rotation: redaction.rotation ?? geometry?.rotation ?? 0,
          crop: redaction.crop ?? geometry?.crop ?? { ...FULL_CROP },
          sourceBatchId: redaction.sourceBatchId || 'LOCAL',
          reason: redaction.reason,
          privilege: redaction.privilege,
          status: 'draft',
          quarantined: false,
          updatedAt: new Date().toISOString()
        };
        return {
          documents: state.documents.map((d) => d.id === state.activeDocumentId ? { ...d, redactions: [...d.redactions, item] } : d),
          activeRedactionId: item.id
        };
      }),
      confirmRedaction: (id) => set((state) => {
        const at = new Date().toISOString();
        const reviewer = '林清';
        const documents = state.documents.map((doc) => {
          const target = doc.redactions.find((r) => r.id === id);
          if (!target || target.quarantined) return doc;
          const conclusion: Conclusion = {
            id: `C-${rid()}`,
            redactionId: id,
            pageId: target.pageId,
            page: target.page,
            result: 'confirmed',
            reviewer,
            batchId: target.sourceBatchId,
            at,
            note: target.status === 'pending' ? '几何变化后重新确认' : '复核确认'
          };
          return {
            ...doc,
            redactions: doc.redactions.map((r) => r.id === id ? { ...r, status: 'confirmed' as const, updatedAt: at } : r),
            conclusionHistory: [...doc.conclusionHistory, conclusion]
          };
        });
        return { documents };
      }),
      selectRedaction: (id) => set({ activeRedactionId: id }),
      updateClassification: (classification) => set((state) => ({
        documents: state.documents.map((doc) => doc.id === state.activeDocumentId ? { ...doc, classification } : doc)
      })),
      toggleReviewCheck: (id) => set((state) => ({ reviewChecks: { ...state.reviewChecks, [id]: !state.reviewChecks[id] } })),
      toggleMetadata: () => set((state) => ({ metadataCleaned: !state.metadataCleaned })),
      markReady: () => set((state) => ({
        documents: state.documents.map((doc) => doc.id === state.activeDocumentId ? { ...doc, status: '可发布' } : doc)
      })),
      setPageGeometry: (pageId, patch) => {
        const at = new Date().toISOString();
        let invalidated = 0;
        set((state) => ({
          documents: state.documents.map((doc) => {
            if (doc.id !== state.activeDocumentId) return doc;
            const result = applyGeometryChange(doc, pageId, patch, at);
            invalidated = result.invalidated;
            return { ...result.doc, updatedAt: at.slice(11, 16) };
          })
        }));
        return invalidated;
      },
      addPage: () => set((state) => {
        const at = new Date().toISOString();
        return {
          documents: state.documents.map((doc) => {
            if (doc.id !== state.activeDocumentId) return doc;
            const nextPdfPage = Math.max(...doc.pageList.map((p) => p.pdfPage), doc.pages) + 1;
            const pageId = `P-${doc.id}-${nextPdfPage}-${rid().slice(0, 6)}`;
            const pageList = [...doc.pageList, { pageId, pdfPage: nextPdfPage, rotation: 0 as Rotation, crop: { ...FULL_CROP } }];
            const renumbered = renumber({ ...doc, pageList }, at);
            return { ...renumbered.doc, pages: pageList.length, updatedAt: at.slice(11, 16) };
          }),
          activePage: state.documents.find((d) => d.id === state.activeDocumentId)!.pages + 1
        };
      }),
      removePage: (pageId) => set((state) => {
        const at = new Date().toISOString();
        return {
          documents: state.documents.map((doc) => {
            if (doc.id !== state.activeDocumentId) return doc;
            const removed = doc.pageList.find((p) => p.pageId === pageId);
            if (!removed) return doc;
            // 该页区域不能落到别的页：整页转入隔离区，redactions 中同步移除。
            const pageNo = doc.pageList.findIndex((p) => p.pageId === pageId) + 1;
            const quarantined: QuarantinedRegion[] = doc.redactions
              .filter((r) => r.pageId === pageId && !r.quarantined)
              .map((r) => ({
                ...r,
                quarantined: true as const,
                quarantineReason: `第 ${pageNo} 页已移除`,
                quarantinedAt: at
              }));
            const pageList = doc.pageList.filter((p) => p.pageId !== pageId);
            const after = renumber({
              ...doc,
              pageList,
              redactions: doc.redactions.filter((r) => r.pageId !== pageId),
              quarantine: [...doc.quarantine, ...quarantined]
            }, at);
            return { ...after.doc, pages: pageList.length, updatedAt: at.slice(11, 16) };
          }),
          activePage: Math.max(1, state.activePage - 1)
        };
      }),
      importPackage: (raw) => {
        const state = get();
        const doc = state.documents.find((d) => d.id === state.activeDocumentId);
        if (!doc) return { batchId: '', receivedAt: new Date().toISOString(), status: 'failed' as BatchStatus, appliedRegions: 0, pendingRegions: 0, quarantinedRegions: 0, recoveredPages: [], failedPages: [], messages: ['未找到当前文档'] };
        const receivedAt = new Date().toISOString();
        let pkg: AnnotationPackage;
        try {
          pkg = validatePackage(raw, doc.id);
        } catch (error) {
          const failed: BatchRecord = {
            batchId: (raw as { packageId?: string })?.packageId ?? 'UNKNOWN',
            receivedAt,
            status: 'failed',
            appliedRegions: 0,
            pendingRegions: 0,
            quarantinedRegions: 0,
            recoveredPages: [],
            failedPages: [],
            messages: [(error as Error).message]
          };
          set((s) => ({ documents: s.documents.map((d) => d.id === doc.id ? { ...d, batches: [...d.batches, failed] } : d) }));
          return failed;
        }
        // 同批复传：沿用第一次结果，不重复合并，原生效记录保留。
        const duplicate = doc.batches.find((b) => b.batchId === pkg.packageId);
        if (duplicate) {
          const record: BatchRecord = { ...duplicate, status: 'duplicate', receivedAt, messages: [...duplicate.messages, '同批复传，沿用第一次结果'] };
          set((s) => ({ documents: s.documents.map((d) => d.id === doc.id ? { ...d, batches: [...d.batches, record] } : d) }));
          return record;
        }
        // 先到批次生效；后到内容留作冲突，不覆盖已生效标注。
        const hasApplied = doc.batches.some((b) => b.status === 'applied' || b.status === 'partial');
        if (hasApplied) {
          const conflict: BatchRecord = {
            batchId: pkg.packageId,
            receivedAt,
            status: 'conflict',
            pkg,
            appliedRegions: 0,
            pendingRegions: 0,
            quarantinedRegions: 0,
            recoveredPages: [],
            failedPages: [],
            messages: [`批次 ${doc.batches.find((b) => b.status === 'applied' || b.status === 'partial')?.batchId} 已生效，本批内容留作冲突，不参与合并`]
          };
          set((s) => ({ documents: s.documents.map((d) => d.id === doc.id ? { ...d, batches: [...d.batches, conflict] } : d) }));
          return conflict;
        }
        const { doc: merged, result } = mergePackage(doc, pkg, receivedAt);
        set((s) => ({ documents: s.documents.map((d) => d.id === doc.id ? merged : d) }));
        return result;
      },
      retryBatch: (batchId) => {
        const state = get();
        const doc = state.documents.find((d) => d.id === state.activeDocumentId);
        const batch = doc?.batches.find((b) => b.batchId === batchId);
        if (!doc || !batch?.pkg) {
          return { batchId, receivedAt: new Date().toISOString(), status: 'failed' as BatchStatus, appliedRegions: 0, pendingRegions: 0, quarantinedRegions: 0, recoveredPages: [], failedPages: [], messages: ['没有可重试的批次'] };
        }
        const receivedAt = new Date().toISOString();
        const { doc: merged, result } = mergePackage(
          { ...doc, batches: doc.batches.filter((b) => b.batchId !== batchId) },
          batch.pkg,
          receivedAt
        );
        set((s) => ({ documents: s.documents.map((d) => d.id === doc.id ? merged : d) }));
        return result;
      },
      exportPackage: () => {
        const doc = get().documents.find((d) => d.id === get().activeDocumentId);
        if (!doc) return;
        const at = new Date().toISOString();
        const pkg = buildPackage(doc, `LOCAL-${doc.id}-${at.slice(0, 10).replace(/-/g, '')}`, at);
        const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `annotation-package-${doc.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      importDemoPackage: () => {
        const doc = get().documents.find((d) => d.id === get().activeDocumentId);
        if (!doc) return { batchId: '', receivedAt: new Date().toISOString(), status: 'failed' as BatchStatus, appliedRegions: 0, pendingRegions: 0, quarantinedRegions: 0, recoveredPages: [], failedPages: [], messages: ['未找到当前文档'] };
        return get().importPackage(buildDemoPackage(doc));
      }
    }),
    {
      name: 'yy59-disclosure-draft',
      version: 2,
      migrate: (persisted) => normalizeDoc(persisted),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const documents = Array.isArray(p.documents) ? p.documents.map(normalizeDoc) : current.documents;
        return { ...current, ...p, documents };
      }
    }
  )
);
