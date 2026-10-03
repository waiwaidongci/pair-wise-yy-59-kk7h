import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyConflict,
  confirmRedactionOn,
  discardConflict,
  emptyImports,
  FULL_CROP,
  insertPage,
  LOCAL_BATCH,
  makePages,
  migrateLegacyDocument,
  removePage,
  resumeBatch,
  submitBatch,
  timestamp,
  withGeometryChange,
  type CropBox,
  type DisclosureRecord,
  type ImportBatch,
  type ImportOutcome,
  type Redaction,
  type ReviewConclusion,
  type Rotation
} from './annotation';

export type {
  BatchRecord,
  CropBox,
  DisclosureRecord,
  DocumentImports,
  ImportBatch,
  ImportConflict,
  ImportOutcome,
  PageGeometry,
  PageInfo,
  Redaction,
  ReviewConclusion,
  Rotation
} from './annotation';

const SEED_BATCH = 'BASE 建档批次';

const seedConclusion = (id: string, redactionId: string, pageId: string, pageNumber: number, decidedAt: string): ReviewConclusion => ({
  id,
  redactionId,
  pageId,
  pageNumber,
  geometryVersion: 1,
  reviewer: '林清',
  decidedAt,
  status: 'effective',
  note: '建档确认'
});

const seedRedaction = (
  id: string,
  docId: string,
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
  reason: string,
  privilege: string,
  status: Redaction['status']
): Redaction => ({
  id,
  pageId: `P-${docId}-${page}`,
  page,
  rotation: 0,
  x,
  y,
  width,
  height,
  sourceBatch: SEED_BATCH,
  reason,
  privilege,
  status
});

const defaultDocuments: DisclosureRecord[] = [
  {
    id: 'DOC-00418',
    title: '设备采购补充协议（第三版）',
    bundle: '北岭项目 · 第一批披露',
    pages: 3,
    pageList: makePages('DOC-00418', 3),
    classification: '严格机密',
    owner: '林清',
    updatedAt: '09:48',
    status: '去密中',
    issue: '合同主体与商业条款',
    size: '8.4 MB',
    redactions: [
      seedRedaction('R-01', 'DOC-00418', 1, 0.12, 0.16, 0.3, 0.04, '商业秘密', '合同保密', 'confirmed'),
      seedRedaction('R-02', 'DOC-00418', 1, 0.5, 0.43, 0.34, 0.06, '个人手机号', '个人信息', 'draft'),
      seedRedaction('R-03', 'DOC-00418', 2, 0.11, 0.25, 0.68, 0.05, '第三方报价', '商业敏感', 'confirmed')
    ],
    conclusions: [
      seedConclusion('C-01', 'R-01', 'P-DOC-00418-1', 1, '09:12'),
      seedConclusion('C-02', 'R-03', 'P-DOC-00418-2', 2, '09:40')
    ],
    imports: emptyImports()
  },
  {
    id: 'DOC-00427',
    title: '现场会议纪要 2026-08-19',
    bundle: '北岭项目 · 第一批披露',
    pages: 3,
    pageList: makePages('DOC-00427', 3),
    classification: '机密',
    owner: '周叙',
    updatedAt: '09:31',
    status: '待质检',
    issue: '事故预防与整改安排',
    size: '3.1 MB',
    redactions: [seedRedaction('R-04', 'DOC-00427', 1, 0.08, 0.69, 0.74, 0.05, '内部调查意见', '工作成果', 'confirmed')],
    conclusions: [seedConclusion('C-03', 'R-04', 'P-DOC-00427-1', 1, '09:20')],
    imports: emptyImports()
  },
  {
    id: 'DOC-00435',
    title: '设备运行数据摘录',
    bundle: '北岭项目 · 第二批披露',
    pages: 3,
    pageList: makePages('DOC-00435', 3),
    classification: '内部',
    owner: '顾言',
    updatedAt: '08:56',
    status: '可发布',
    issue: '运行记录',
    size: '12.7 MB',
    redactions: [seedRedaction('R-05', 'DOC-00435', 2, 0.44, 0.56, 0.26, 0.04, '人员姓名', '个人信息', 'confirmed')],
    conclusions: [seedConclusion('C-04', 'R-05', 'P-DOC-00435-2', 2, '08:50')],
    imports: emptyImports()
  }
];

type NewRedactionDraft = { page: number; x: number; y: number; width: number; height: number; reason: string; privilege: string };

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
  addRedaction: (draft: NewRedactionDraft) => void;
  confirmRedaction: (id: string) => void;
  selectRedaction: (id: string) => void;
  updateClassification: (classification: DisclosureRecord['classification']) => void;
  toggleReviewCheck: (id: string) => void;
  toggleMetadata: () => void;
  markReady: () => void;
  rotatePage: (pageId: string) => void;
  setPageCrop: (pageId: string, crop: CropBox | null) => void;
  insertPageAfter: (pageNumber: number) => void;
  removePage: (pageId: string) => void;
  importBatch: (batch: ImportBatch) => ImportOutcome;
  resumeImport: (batchId: string) => ImportOutcome;
  applyConflict: (batchId: string) => ImportOutcome;
  discardConflict: (batchId: string) => void;
};

export const useDisclosureStore = create<State>()(
  persist(
    (set) => ({
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
      addRedaction: (draft) =>
        set((state) => ({
          documents: state.documents.map((doc) => {
            if (doc.id !== state.activeDocumentId) return doc;
            const page = doc.pageList[draft.page - 1];
            if (!page) return doc;
            const redaction: Redaction = {
              ...draft,
              id: `R-${Date.now()}`,
              pageId: page.id,
              rotation: page.geometry.rotation,
              sourceBatch: LOCAL_BATCH,
              status: 'draft'
            };
            return { ...doc, redactions: [...doc.redactions, redaction], updatedAt: timestamp() };
          })
        })),
      confirmRedaction: (id) =>
        set((state) => ({
          documents: state.documents.map((doc) => (doc.id === state.activeDocumentId ? confirmRedactionOn(doc, id, '林清') : doc))
        })),
      selectRedaction: (id) => set({ activeRedactionId: id }),
      updateClassification: (classification) =>
        set((state) => ({
          documents: state.documents.map((doc) => (doc.id === state.activeDocumentId ? { ...doc, classification } : doc))
        })),
      toggleReviewCheck: (id) => set((state) => ({ reviewChecks: { ...state.reviewChecks, [id]: !state.reviewChecks[id] } })),
      toggleMetadata: () => set((state) => ({ metadataCleaned: !state.metadataCleaned })),
      markReady: () =>
        set((state) => ({
          documents: state.documents.map((doc) => (doc.id === state.activeDocumentId ? { ...doc, status: '可发布' } : doc))
        })),
      rotatePage: (pageId) =>
        set((state) => ({
          documents: state.documents.map((doc) => {
            const page = doc.pageList.find((p) => p.id === pageId);
            if (!page) return doc;
            const rotation = ((page.geometry.rotation + 90) % 360) as Rotation;
            return withGeometryChange(doc, pageId, { ...page.geometry, rotation }, '页面旋转变更，原复核失效待重算');
          })
        })),
      setPageCrop: (pageId, crop) =>
        set((state) => ({
          documents: state.documents.map((doc) => {
            const page = doc.pageList.find((p) => p.id === pageId);
            if (!page) return doc;
            return withGeometryChange(doc, pageId, { rotation: page.geometry.rotation, crop: crop ?? FULL_CROP }, '裁边变更，原复核失效待重算');
          })
        })),
      insertPageAfter: (pageNumber) =>
        set((state) => ({
          documents: state.documents.map((doc) => (doc.id === state.activeDocumentId ? insertPage(doc, pageNumber) : doc))
        })),
      removePage: (pageId) =>
        set((state) => ({
          documents: state.documents.map((doc) => (doc.id === state.activeDocumentId ? removePage(doc, pageId) : doc))
        })),
      importBatch: (batch) => {
        let outcome: ImportOutcome = { kind: 'ignored', message: '文档不存在' };
        set((state) => ({
          documents: state.documents.map((doc) => {
            if (doc.id !== batch.documentId) return doc;
            const result = submitBatch(doc, batch);
            outcome = result.outcome;
            return result.doc;
          })
        }));
        return outcome;
      },
      resumeImport: (batchId) => {
        let outcome: ImportOutcome = { kind: 'ignored', message: '批次不存在' };
        set((state) => ({
          documents: state.documents.map((doc) => {
            if (!doc.imports.batches[batchId]) return doc;
            const result = resumeBatch(doc, batchId);
            outcome = result.outcome;
            return result.doc;
          })
        }));
        return outcome;
      },
      applyConflict: (batchId) => {
        let outcome: ImportOutcome = { kind: 'ignored', message: '冲突记录不存在' };
        set((state) => ({
          documents: state.documents.map((doc) => {
            if (!doc.imports.conflicts.some((c) => c.batch.batchId === batchId)) return doc;
            const result = applyConflict(doc, batchId);
            outcome = result.outcome;
            return result.doc;
          })
        }));
        return outcome;
      },
      discardConflict: (batchId) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.imports.conflicts.some((c) => c.batch.batchId === batchId) ? discardConflict(doc, batchId) : doc
          )
        }))
    }),
    {
      name: 'yy59-disclosure-draft',
      version: 1,
      migrate: (persistedState, version) => {
        const persisted = persistedState as { documents?: unknown[] } & Record<string, unknown>;
        if (version === 0 && Array.isArray(persisted?.documents)) {
          // 旧草稿迁移：补页表、旋转角(0)、来源批次，原确认记录迁移为可查结论
          return { ...persisted, documents: persisted.documents.map((doc) => migrateLegacyDocument(doc as never)) } as State;
        }
        return persisted as State;
      }
    }
  )
);
