import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useParams
} from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Crop,
  Eye,
  FileCheck2,
  FileMinus2,
  FilePlus2,
  FileText,
  Highlighter,
  History,
  Layers3,
  Menu,
  PackageOpen,
  PackagePlus,
  PanelLeftClose,
  RotateCcw,
  RotateCw,
  ScanSearch,
  ShieldCheck,
  Stamp,
  Tags,
  UploadCloud
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Badge, Button, Card, Dialog, Tabs, X } from './components/ui';
import { FULL_CROP } from './annotation';
import { makePresetBatches } from './importPresets';
import { useDisclosureStore, type CropBox, type DisclosureRecord, type ImportOutcome, type Rotation } from './store';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const bundleQuery = async () => ({
  queue: [
    { id: 'Q-31', name: '第三批补充材料', count: 128, owner: '林清', progress: 68, due: '今日 16:00' },
    { id: 'Q-32', name: '证人材料图像件', count: 47, owner: '周叙', progress: 34, due: '明日 11:00' },
    { id: 'Q-33', name: '专家报告附件', count: 19, owner: '顾言', progress: 91, due: '09-30 18:00' }
  ]
});

function AppShell() {
  const [mobileNav, setMobileNav] = useState(false);
  const links = [
    { to: '/', label: '文档集', icon: Layers3 },
    { to: '/review/$documentId', label: '去密审阅', icon: Highlighter },
    { to: '/quality', label: '发布质检', icon: ScanSearch },
    { to: '/batches', label: '批次与标签', icon: Tags }
  ];
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-symbol"><Stamp size={18} /></div>
          <div><strong>披露质控台</strong><span>North Ridge / Litigation Support</span></div>
        </div>
        <div className="top-actions">
          <Badge tone="amber">2 项待质检</Badge>
          <div className="operator"><span>质控员</span><strong>林清 · 审核组</strong></div>
        </div>
        <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="菜单"><Menu /></button>
      </header>
      <div className="shell-body">
        <aside className={mobileNav ? 'sidebar open' : 'sidebar'}>
          <div className="workspace-title">
            <span>当前工作区</span>
            <strong>北岭项目 · 诉讼披露</strong>
          </div>
          <nav>
            {links.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to as '/'} activeProps={{ className: 'active' }} onClick={() => setMobileNav(false)}>
                <Icon size={17} /> <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div><ShieldCheck size={16} /><span>审计记录已开启</span></div>
            <small>草稿自动保存在本机</small>
          </div>
        </aside>
        <main className="main-content"><Outlet /></main>
      </div>
    </div>
  );
}

function DocumentsPage() {
  const documents = useDisclosureStore((state) => state.documents);
  const { data } = useQuery({ queryKey: ['document-queues'], queryFn: bundleQuery });
  const [filter, setFilter] = useState('全部');
  const visible = filter === '全部' ? documents : documents.filter((doc) => doc.status === filter);
  return (
    <div className="page">
      <header className="page-heading">
        <div><small>DISCLOSURE CONTROL / DOCUMENT SET</small><h1>披露文档集</h1><p>分批完成密级复核、敏感区域去密与发布版本比对。</p></div>
        <Button><UploadCloud size={16} /> 导入文档集</Button>
      </header>
      <section className="summary-strip">
        <div><span>文档总数</span><strong>194</strong><small>12.8 GB</small></div>
        <div><span>去密区域</span><strong>2,481</strong><small>较上版 +34</small></div>
        <div><span>待质检</span><strong className="warning-text">17</strong><small>4 项高风险</small></div>
        <div><span>已批准批次</span><strong>6</strong><small>本周 +2</small></div>
      </section>
      <div className="two-column">
        <Card className="document-table-card">
          <div className="card-heading">
            <div><Tabs.Root value={filter} onValueChange={setFilter}><Tabs.List className="segmented">
              {['全部', '去密中', '待质检', '可发布'].map((item) => <Tabs.Trigger key={item} value={item}>{item}</Tabs.Trigger>)}
            </Tabs.List></Tabs.Root></div>
            <span>{visible.length} 份文档</span>
          </div>
          <div className="document-table">
            {visible.map((doc) => (
              <div className="document-row" key={doc.id}>
                <div className="file-icon"><FileText size={19} /></div>
                <div className="doc-main">
                  <strong>{doc.title}</strong>
                  <span>{doc.id} · {doc.bundle} · {doc.size}</span>
                </div>
                <div className="doc-field"><span>密级</span><Badge tone={doc.classification === '严格机密' ? 'red' : doc.classification === '机密' ? 'amber' : 'neutral'}>{doc.classification}</Badge></div>
                <div className="doc-field"><span>负责人员</span><strong>{doc.owner}</strong></div>
                <div className="doc-field"><span>状态</span><Badge tone={doc.status === '可发布' ? 'green' : doc.status === '待质检' ? 'amber' : 'blue'}>{doc.status}</Badge></div>
                <div className="doc-actions">
                  <Link to="/review/$documentId" params={{ documentId: doc.id }}><Button variant="outline">审阅</Button></Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <aside className="side-stack">
          <Card className="queue-card">
            <div className="card-title"><ClipboardCheck size={17} /><strong>去密任务队列</strong></div>
            {(data?.queue ?? []).map((item) => (
              <div className="queue-item" key={item.id}>
                <div><strong>{item.name}</strong><span>{item.count} 份 · {item.owner}</span></div>
                <div className="progress"><i style={{ width: `${item.progress}%` }} /></div>
                <small>{item.progress}% · 截止 {item.due}</small>
              </div>
            ))}
          </Card>
          <Card className="audit-card">
            <div className="card-title"><ShieldCheck size={17} /><strong>最近操作</strong></div>
            <p><b>09:48</b> 林清确认 DOC-00418 的合同价款遮蔽区域。</p>
            <p><b>09:31</b> 周叙提交会议纪要待质检。</p>
            <p><b>08:54</b> 顾言导出 DOC-00435 发布清单。</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function useDemoPdf() {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  useEffect(() => {
    let alive = true;
    PDFDocument.create().then(async (pdf) => {
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      for (let pageNo = 1; pageNo <= 3; pageNo += 1) {
        const page = pdf.addPage([612, 792]);
        page.drawText(`NORTH RIDGE PROJECT - DISCLOSURE EXHIBIT`, { x: 54, y: 728, size: 14, font, color: rgb(0.12, 0.16, 0.2) });
        page.drawText(`Document page ${pageNo} / 3`, { x: 54, y: 704, size: 10, font, color: rgb(0.35, 0.39, 0.43) });
        page.drawLine({ start: { x: 54, y: 690 }, end: { x: 558, y: 690 }, thickness: 1, color: rgb(0.75, 0.78, 0.8) });
        const lines = [
          'Commercial terms and operational records',
          'Parties: North Ridge Equipment Co. and Haiyang Logistics',
          'Reference No. NR-2026-0819 / Confidentiality class: strictly confidential',
          '',
          'The supplier shall provide maintenance records, operating data and',
          'incident reports within ten business days after each quarterly review.',
          '',
          'Contact: [redacted personal information]',
          'Commercial consideration: [redacted third-party quotation]',
          '',
          'This copy is prepared solely for disclosure review. Every marked region',
          'must be confirmed against the original before approval and release.'
        ];
        lines.forEach((line, index) => page.drawText(line, { x: 54, y: 655 - index * 24, size: 10, font, color: rgb(0.1, 0.13, 0.16) }));
        page.drawText(`Control stamp: REVIEW-${String(pageNo).padStart(2, '0')}`, { x: 54, y: 72, size: 9, font, color: rgb(0.5, 0.53, 0.56) });
      }
      return pdf.save();
    }).then((data) => {
      if (alive) {
        const copy = new Uint8Array(data);
        setBytes(copy.buffer as ArrayBuffer);
      }
    });
    return () => { alive = false; };
  }, []);
  return bytes;
}

function PdfPage({
  pageNumber,
  rotation = 0,
  crop = FULL_CROP,
  redacted = false,
  onDraw,
  children
}: {
  pageNumber: number;
  rotation?: Rotation;
  crop?: CropBox;
  redacted?: boolean;
  onDraw?: (region: { x: number; y: number; width: number; height: number }) => void;
  children?: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bytes = useDemoPdf();
  const [drawing, setDrawing] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const start = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!bytes || !canvasRef.current) return;
    let task: ReturnType<typeof pdfjs.getDocument> | null = null;
    const render = async () => {
      task = pdfjs.getDocument({ data: bytes.slice(0) });
      const pdf = await task.promise;
      if (pageNumber > pdf.numPages) return; // 新插入的页没有源内容，留白
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.25, rotation });
      const canvas = canvasRef.current!;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * ratio;
      canvas.height = viewport.height * ratio;
      const context = canvas.getContext('2d')!;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
    };
    render().catch(console.error);
    return () => { task?.destroy(); };
  }, [bytes, pageNumber, rotation]);

  const pointerDown = (event: React.PointerEvent) => {
    if (!onDraw) return;
    const rect = event.currentTarget.getBoundingClientRect();
    start.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setDrawing({ x: start.current.x / rect.width, y: start.current.y / rect.height, width: 0, height: 0 });
  };
  const pointerMove = (event: React.PointerEvent) => {
    if (!drawing || !onDraw) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(start.current.x, event.clientX - rect.left) / rect.width;
    const y = Math.min(start.current.y, event.clientY - rect.top) / rect.height;
    const width = Math.abs(event.clientX - rect.left - start.current.x) / rect.width;
    const height = Math.abs(event.clientY - rect.top - start.current.y) / rect.height;
    setDrawing({ x, y, width, height });
  };
  const pointerUp = () => {
    if (drawing && onDraw && drawing.width > 0.015 && drawing.height > 0.01) onDraw(drawing);
    setDrawing(null);
  };
  // 示例页 612x792；旋转 90/270 时宽高互换，再按裁边比例得出可视窗口
  const base = rotation % 180 === 0 ? { w: 612, h: 792 } : { w: 792, h: 612 };
  const aspect = (base.w * crop.width) / (base.h * crop.height);
  return (
    <div
      className={`pdf-page ${onDraw ? 'drawable' : ''}`}
      style={{ aspectRatio: `${aspect}` }}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
    >
      <div
        className="crop-inner"
        style={{
          left: `${(-crop.x / crop.width) * 100}%`,
          top: `${(-crop.y / crop.height) * 100}%`,
          width: `${100 / crop.width}%`,
          height: `${100 / crop.height}%`
        }}
      >
        <canvas ref={canvasRef} />
      </div>
      {redacted && <div className="page-redaction-demo"><span>已发布区域掩码</span></div>}
      {children}
      {drawing && <i className="drawing-region" style={{ left: `${drawing.x * 100}%`, top: `${drawing.y * 100}%`, width: `${drawing.width * 100}%`, height: `${drawing.height * 100}%` }} />}
    </div>
  );
}

const CROP_PRESET: CropBox = { x: 0.06, y: 0.05, width: 0.88, height: 0.9 };

const redactionStatusLabel = { draft: '草稿', confirmed: '已确认', pending: '待复核' } as const;
const redactionStatusTone = { draft: 'amber', confirmed: 'green', pending: 'red' } as const;

function ReviewPage() {
  const { documentId } = useParams({ from: '/review/$documentId' });
  const navigate = useNavigate();
  const store = useDisclosureStore();
  const { documents, activePage, redactionMode, activeRedactionId } = store;
  const doc = documents.find((item) => item.id === documentId) ?? documents[0];
  const safePage = Math.min(activePage, doc.pageList.length);
  const page = doc.pageList[safePage - 1];
  const pageRegions = doc.redactions.filter((item) => item.pageId === page.id);
  const orphaned = doc.redactions.filter((item) => !doc.pageList.some((p) => p.id === item.pageId));
  const active = doc.redactions.find((item) => item.id === activeRedactionId);
  const activeOrphaned = active ? !doc.pageList.some((p) => p.id === active.pageId) : false;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('商业秘密');
  const [privilege, setPrivilege] = useState('合同保密');
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const presets = makePresetBatches(doc.id, doc.pageList.length);
  const crop = page.geometry.crop;
  const cropped = crop.x > 0 || crop.y > 0 || crop.width < 1 || crop.height < 1;
  const unconfirmed = doc.redactions.filter((item) => item.status !== 'confirmed').length;
  const effectiveCount = doc.conclusions.filter((c) => c.status === 'effective').length;
  const invalidatedCount = doc.conclusions.length - effectiveCount;
  return (
    <div className="page review-page">
      <header className="review-header">
        <div className="review-title">
          <Button variant="ghost" onClick={() => navigate({ to: '/' })}><ArrowLeft size={16} /></Button>
          <div><small>{doc.id} / 去密审阅</small><h1>{doc.title}</h1></div>
          <Badge tone={doc.classification === '严格机密' ? 'red' : 'amber'}>{doc.classification}</Badge>
        </div>
        <div className="review-actions">
          <Button variant="outline" onClick={() => store.toggleRedactionMode()} className={redactionMode ? 'active-button' : ''}><Highlighter size={16} /> {redactionMode ? '取消绘制' : '绘制去密区'}</Button>
          <Button variant="outline" onClick={() => setDialogOpen(true)}><FileCheck2 size={16} /> 发布前校验</Button>
          <Button><Check size={16} /> 提交质检</Button>
        </div>
      </header>
      <div className="review-layout">
        <aside className="page-thumbs">
          <div className="side-label">页级预览 <span>{doc.pageList.length} 页</span></div>
          {doc.pageList.map((p) => {
            const count = doc.redactions.filter((r) => r.pageId === p.id).length;
            return (
              <button key={p.id} className={safePage === p.pageNumber ? 'active' : ''} onClick={() => store.setPage(p.pageNumber)}>
                <div className="mini-page"><span>{p.pageNumber}</span><i style={{ width: `${45 + (p.pageNumber % 3) * 9}%` }} /><i style={{ width: `${70 - (p.pageNumber % 3) * 5}%` }} /><i style={{ width: `${55 + (p.pageNumber % 3) * 4}%` }} /></div>
                <small>
                  第 {p.pageNumber} 页
                  {p.geometry.rotation !== 0 ? ` · ${p.geometry.rotation}°` : ''}
                  {count > 0 ? ` · ${count} 区` : ''}
                </small>
              </button>
            );
          })}
        </aside>
        <section className="viewer-column">
          <div className="viewer-toolbar">
            <div><button onClick={() => store.setPage(Math.max(1, safePage - 1))} disabled={safePage === 1}><ChevronLeft size={16} /></button><strong>{safePage} / {doc.pageList.length}</strong><button onClick={() => store.setPage(Math.min(doc.pageList.length, safePage + 1))} disabled={safePage === doc.pageList.length}><ChevronRight size={16} /></button></div>
            <span>125%</span>
            <span>原页 · 掩码叠加</span>
          </div>
          <div className="geometry-bar">
            <span className="geom-info">几何 v{page.geometryVersion} · 旋转 {page.geometry.rotation}° · {cropped ? '已裁边' : '未裁边'}</span>
            <div className="geom-actions">
              <button onClick={() => store.rotatePage(page.id)} title="顺时针旋转 90°，原复核失效并重算坐标"><RotateCw size={14} /> 旋转90°</button>
              <button onClick={() => store.setPageCrop(page.id, cropped ? null : CROP_PRESET)} title="切换裁边，原复核失效并重算坐标"><Crop size={14} /> {cropped ? '清除裁边' : '裁边预设'}</button>
              <button onClick={() => store.insertPageAfter(safePage)} title="在本页后插入一页，后续页顺延"><FilePlus2 size={14} /> 在后插页</button>
              <button onClick={() => store.removePage(page.id)} disabled={doc.pageList.length <= 1} title="移除本页，区域保留待处理"><FileMinus2 size={14} /> 删除本页</button>
            </div>
          </div>
          <div className="pdf-stage">
            <PdfPage
              pageNumber={safePage}
              rotation={page.geometry.rotation}
              crop={crop}
              onDraw={redactionMode ? (region) => store.addRedaction({ ...region, page: safePage, reason, privilege }) : undefined}
            >
              {pageRegions.map((region) => (
                <button
                  key={region.id}
                  className={`redaction-region ${region.status} ${activeRedactionId === region.id ? 'selected' : ''}`}
                  style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => store.selectRedaction(region.id)}
                  title={`${region.reason} / ${region.privilege}`}
                />
              ))}
            </PdfPage>
          </div>
        </section>
        <aside className="inspector">
          <div className="side-label">区域属性</div>
          {active ? (
            <>
              <div className="inspector-title"><strong>{active.reason}</strong><Badge tone={redactionStatusTone[active.status]}>{redactionStatusLabel[active.status]}</Badge></div>
              <label>保密级别<select value={doc.classification} onChange={(event) => store.updateClassification(event.target.value as DisclosureRecord['classification'])}><option>内部</option><option>机密</option><option>严格机密</option></select></label>
              <label>去密原因<input value={active.reason} readOnly /></label>
              <label>特权标签<input value={active.privilege} readOnly /></label>
              <label>责任人员<input value={doc.owner} readOnly /></label>
              <div className="coordinate-grid"><div><span>X</span><b>{Math.round(active.x * 100)}%</b></div><div><span>Y</span><b>{Math.round(active.y * 100)}%</b></div><div><span>宽</span><b>{Math.round(active.width * 100)}%</b></div><div><span>高</span><b>{Math.round(active.height * 100)}%</b></div></div>
              <div className="region-meta">
                <div><span>页号</span><b>第 {active.page} 页{activeOrphaned ? '（已移除）' : ''}</b></div>
                <div><span>旋转角</span><b>{active.rotation}°</b></div>
                <div><span>来源批次</span><b>{active.sourceBatch}</b></div>
                <div><span>几何版本</span><b>{activeOrphaned ? '—' : `v${doc.pageList.find((p) => p.id === active.pageId)?.geometryVersion ?? 1}`}</b></div>
              </div>
              <Button onClick={() => store.confirmRedaction(active.id)} disabled={active.status === 'confirmed' || activeOrphaned}>
                <Check size={15} /> {active.status === 'pending' ? '重新确认（原复核已失效）' : active.status === 'confirmed' ? '已确认' : '确认此区域'}
              </Button>
              {activeOrphaned && <p className="muted">所在页已移除，区域保留待处理，不会落到其他页。</p>}
              <Button variant="outline"><Copy size={15} /> 批量复制到同类页</Button>
            </>
          ) : <p className="muted">在文档页面上选择一个去密区域查看属性。</p>}
          {orphaned.length > 0 && (
            <div className="orphan-note"><AlertTriangle size={16} /><span>{orphaned.length} 个区域所在页已移除，保留在原页记录待处理，未改挂到其他页。</span></div>
          )}
          <div className="rule-note"><AlertTriangle size={16} /><span>发布版本不得包含原始文本层或图片残片。</span></div>
        </aside>
      </div>
      <section className="records-row">
        <Card className="imports-card">
          <div className="card-title"><PackageOpen size={17} /><strong>导入批次</strong><span>先到批次生效 · 同批复传沿用首次结果</span></div>
          <div className="preset-row">
            {presets.map((batch) => (
              <Button key={batch.batchId} variant="outline" onClick={() => setOutcome(store.importBatch(batch))}><PackagePlus size={14} /> 提交 {batch.batchId}</Button>
            ))}
          </div>
          {outcome && <p className={`import-outcome ${outcome.kind}`}>{outcome.message}</p>}
          {doc.imports.order.length === 0 && doc.imports.conflicts.length === 0 && <p className="muted">尚未接收导入包。外聘复核员导出的区域包（含旋转角与裁边）在此提交合并。</p>}
          {doc.imports.order.map((id) => {
            const record = doc.imports.batches[id];
            return (
              <div className="ledger-row" key={id}>
                <div><strong>{record.batchId}</strong><span>{record.batch.submittedBy} · {record.receivedAt}</span></div>
                <Badge tone={record.status === 'merged' ? 'green' : 'red'}>{record.status === 'merged' ? '已合并' : '合并中断'}</Badge>
                <span className="ledger-detail">{record.summary} · 已完成页 [{record.completedPages.join(', ') || '无'}]</span>
                {record.status === 'failed' && <Button variant="outline" onClick={() => setOutcome(store.resumeImport(id))}><RotateCcw size={14} /> 从断点恢复</Button>}
              </div>
            );
          })}
          {doc.imports.conflicts.map((conflict) => (
            <div className="ledger-row conflict" key={conflict.batch.batchId}>
              <div><strong>{conflict.batch.batchId}</strong><span>{conflict.batch.submittedBy} · {conflict.receivedAt}</span></div>
              <Badge tone="amber">冲突待处理</Badge>
              <span className="ledger-detail">{conflict.reason}</span>
              <div className="ledger-actions">
                <Button variant="outline" onClick={() => setOutcome(store.applyConflict(conflict.batch.batchId))}>应用</Button>
                <Button variant="ghost" onClick={() => store.discardConflict(conflict.batch.batchId)}>放弃</Button>
              </div>
            </div>
          ))}
        </Card>
        <Card className="conclusions-card">
          <div className="card-title"><History size={17} /><strong>复核结论记录</strong><span>{effectiveCount} 有效 · {invalidatedCount} 已失效</span></div>
          {doc.conclusions.length === 0 && <p className="muted">尚无复核结论。</p>}
          {[...doc.conclusions].reverse().map((conclusion) => (
            <div className={`conclusion-row ${conclusion.status}`} key={conclusion.id}>
              <Badge tone={conclusion.status === 'effective' ? 'green' : 'neutral'}>{conclusion.status === 'effective' ? '有效' : '已失效'}</Badge>
              <div>
                <strong>{conclusion.redactionId} · 第 {conclusion.pageNumber} 页 · 几何 v{conclusion.geometryVersion}</strong>
                <span>{conclusion.reviewer} · {conclusion.decidedAt} · {conclusion.note}</span>
              </div>
            </div>
          ))}
        </Card>
      </section>
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <Dialog.Title>发布前校验</Dialog.Title>
            <Dialog.Description>系统将核对原始页与发布页的一致性，并检查元数据残留。</Dialog.Description>
            <div className="dialog-checks">
              <p><Check /> {doc.redactions.length} 个去密区域已定位（含页号 / 旋转角 / 来源批次）</p>
              <p><Check /> 文档版本与操作者记录完整</p>
              <p className={unconfirmed > 0 ? 'failed' : ''}><AlertTriangle /> {unconfirmed > 0 ? `仍有 ${unconfirmed} 个未确认或待复核区域` : '所有区域已确认'}</p>
            </div>
            <Dialog.Close asChild><Button>返回检查 <X size={15} /></Button></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function QualityPage() {
  const { documents } = useDisclosureStore();
  const store = useDisclosureStore();
  const doc = documents[1];
  const confirmedCount = doc.redactions.filter((item) => item.status === 'confirmed').length;
  const pendingCount = doc.redactions.filter((item) => item.status === 'pending').length;
  const draftCount = doc.redactions.filter((item) => item.status === 'draft').length;
  const checks = [
    { id: 'forbidden-terms', label: '全文禁词与姓名复核', detail: '扫描原始页和发布页文本层' },
    { id: 'page-number', label: '页序与页码连续性', detail: '检查拆页、合并及漏页情况' },
    { id: 'image-boundary', label: '图像边界残片', detail: '逐页比较遮蔽边界 2mm 区域' },
    { id: 'metadata', label: '文档元数据清理', detail: '作者、修订人、批注和隐藏字段' }
  ];
  return (
    <div className="page">
      <header className="page-heading"><div><small>QUALITY ASSURANCE / SIDE-BY-SIDE</small><h1>发布质控双人复核</h1><p>并排检查原始页与发布页，所有差异必须留下复核结论。</p></div><Button><FileCheck2 size={16} /> 导出发布清单</Button></header>
      <div className="comparison-banner">
        <div><Eye size={17} /><strong>{doc.title}</strong><span>版本 3.4 · 双人复核</span></div>
        <Badge tone="amber">等待复审员 2/2</Badge>
      </div>
      <div className="compare-grid">
        <Card className="compare-panel"><div className="compare-head"><span>原始页</span><Badge tone="neutral">源文件</Badge></div><div className="compare-page"><PdfPage pageNumber={1} /></div></Card>
        <Card className="compare-panel"><div className="compare-head"><span>发布页</span><Badge tone="green">已遮蔽</Badge></div><div className="compare-page redacted-preview"><PdfPage pageNumber={1} redacted /><div className="demo-mask mask-one" /><div className="demo-mask mask-two" /></div></Card>
      </div>
      <div className="quality-bottom">
        <Card className="checks-card"><div className="card-title"><ClipboardCheck size={17} /><strong>发布前校验项</strong></div>{checks.map((check) => <button className="check-row" key={check.id} onClick={() => store.toggleReviewCheck(check.id)}><span className={store.reviewChecks[check.id] ? 'checked' : ''}>{store.reviewChecks[check.id] && <Check size={13} />}</span><div><strong>{check.label}</strong><small>{check.detail}</small></div></button>)}</Card>
        <Card className="decision-card"><div className="card-title"><ShieldCheck size={17} /><strong>复核结论</strong></div><p>本批次共有 <b>{doc.redactions.length}</b> 个去密区域，已确认 <b>{confirmedCount}</b> 个{pendingCount > 0 ? <>，<b className="warning-text">{pendingCount}</b> 个待复核</> : ''}{draftCount > 0 ? `，${draftCount} 个草稿` : ''}。</p><label><input type="checkbox" checked={store.metadataCleaned} onChange={store.toggleMetadata} /> 已确认元数据清理</label><div className="decision-actions"><Button variant="outline"><ArrowLeft size={15} /> 退回补件</Button><Button disabled={!store.metadataCleaned || Object.values(store.reviewChecks).some((value) => !value) || pendingCount > 0 || draftCount > 0} onClick={store.markReady}><Check size={15} /> 通过并标记可发布</Button></div></Card>
      </div>
    </div>
  );
}

function BatchesPage() {
  const { documents } = useDisclosureStore();
  const [selected, setSelected] = useState<string[]>(['DOC-00418']);
  const activeDoc = documents.find((doc) => doc.id === selected[0]) ?? documents[0];
  return (
    <div className="page">
      <header className="page-heading"><div><small>RELEASE BATCH / TAXONOMY</small><h1>发布批次与标签</h1><p>按案件问题、辖区和披露对象组织文档，生成可追溯发布清单。</p></div><Button>生成发布包</Button></header>
      <div className="batch-layout">
        <Card className="batch-list"><div className="card-title"><Layers3 size={17} /><strong>发布批次</strong></div>{['第一批披露 · 审阅中', '第二批披露 · 编制中', '专家材料 · 待补充'].map((name, index) => <button key={name} className={index === 0 ? 'active' : ''}><span>BATCH-{String(index + 1).padStart(2, '0')}</span><strong>{name}</strong><small>{[48, 79, 19][index]} 份文档</small></button>)}</Card>
        <Card className="batch-content">
          <div className="card-title"><Tags size={17} /><strong>文档与案件问题映射</strong><span>{selected.length} 已选择</span></div>
          <div className="batch-table">
            {documents.map((doc) => <label key={doc.id} className="batch-row"><input type="checkbox" checked={selected.includes(doc.id)} onChange={() => setSelected((ids) => ids.includes(doc.id) ? ids.filter((id) => id !== doc.id) : [...ids, doc.id])} /><FileText size={17} /><div><strong>{doc.title}</strong><span>{doc.id} · {doc.issue}</span></div><Badge tone={doc.status === '可发布' ? 'green' : 'amber'}>{doc.status}</Badge></label>)}
          </div>
          <div className="tag-editor"><h3>标签与分发级</h3><div className="tag-options">{(['合同问题', '设备缺陷', '现场安全', '损害赔偿', '仅律师可见']).map((tag, index) => <span key={tag} className={index < 3 ? 'selected' : ''}>{tag}</span>)}</div><label>导出清单说明<textarea defaultValue="按案卷编号升序导出，保留去密版本、操作者与审批时间。" /></label><Button>保存批次设置</Button></div>
        </Card>
        <Card className="batch-summary"><div className="side-label">当前批次摘要</div><strong>{activeDoc.bundle}</strong><dl><div><dt>文档</dt><dd>{selected.length}</dd></div><div><dt>页数</dt><dd>{selected.reduce((sum, id) => sum + (documents.find((doc) => doc.id === id)?.pages ?? 0), 0)}</dd></div><div><dt>风险项</dt><dd>4</dd></div></dl><div className="summary-note"><AlertTriangle size={15} /><span>发布前仍需完成 4 项双人复核。</span></div></Card>
      </div>
    </div>
  );
}

const rootRoute = createRootRoute({ component: AppShell });
const documentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: DocumentsPage });
const reviewRoute = createRoute({ getParentRoute: () => rootRoute, path: '/review/$documentId', component: ReviewPage });
const qualityRoute = createRoute({ getParentRoute: () => rootRoute, path: '/quality', component: QualityPage });
const batchesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/batches', component: BatchesPage });
const routeTree = rootRoute.addChildren([documentsRoute, reviewRoute, qualityRoute, batchesRoute]);
const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

export default function App() {
  return <RouterProvider router={router} />;
}
