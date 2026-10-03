import { useEffect, useRef, useState } from 'react';
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
  Eye,
  FileCheck2,
  FileText,
  Highlighter,
  History,
  Layers3,
  Menu,
  Plus,
  RotateCw,
  ScanSearch,
  Scissors,
  ShieldCheck,
  Stamp,
  Tags,
  Trash2,
  UploadCloud
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Badge, Button, Card, Dialog, Tabs, X } from './components/ui';
import { useDisclosureStore, type BatchRecord, type DisclosureRecord } from './store';
import { FULL_CROP } from './annotation';

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
      for (let pageNo = 1; pageNo <= 8; pageNo += 1) {
        const page = pdf.addPage([612, 792]);
        page.drawText(`NORTH RIDGE PROJECT - DISCLOSURE EXHIBIT`, { x: 54, y: 728, size: 14, font, color: rgb(0.12, 0.16, 0.2) });
        page.drawText(`Document page ${pageNo} / 8`, { x: 54, y: 704, size: 10, font, color: rgb(0.35, 0.39, 0.43) });
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

function PdfPage({ pageNumber, rotation = 0, crop = FULL_CROP, redacted = false, onDraw }: { pageNumber: number; rotation?: 0 | 90 | 180 | 270; crop?: { x: number; y: number; width: number; height: number }; redacted?: boolean; onDraw?: (region: { x: number; y: number; width: number; height: number }) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bytes = useDemoPdf();
  const [drawing, setDrawing] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const [aspect, setAspect] = useState(792 / 612);
  useEffect(() => {
    if (!bytes || !canvasRef.current) return;
    let task: ReturnType<typeof pdfjs.getDocument> | null = null;
    const render = async () => {
      task = pdfjs.getDocument({ data: bytes.slice(0) });
      const pdf = await task.promise;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.25, rotation });
      const canvas = canvasRef.current!;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * ratio;
      canvas.height = viewport.height * ratio;
      const context = canvas.getContext('2d')!;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      setAspect((viewport.width * crop.width) / (viewport.height * crop.height));
    };
    render().catch(console.error);
    return () => { task?.destroy(); };
  }, [bytes, pageNumber, rotation, crop.x, crop.y, crop.width, crop.height]);

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
  return (
    <div className={`pdf-page ${onDraw ? 'drawable' : ''}`} style={{ aspectRatio: `${aspect}` }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}>
      <div className="pdf-crop-window">
        <canvas ref={canvasRef} style={{
          left: `${(-crop.x / crop.width) * 100}%`,
          top: `${(-crop.y / crop.height) * 100}%`,
          width: `${(1 / crop.width) * 100}%`,
          height: `${(1 / crop.height) * 100}%`
        }} />
      </div>
      {redacted && <div className="page-redaction-demo"><span>已发布区域掩码</span></div>}
      {drawing && <i className="drawing-region" style={{ left: `${drawing.x * 100}%`, top: `${drawing.y * 100}%`, width: `${drawing.width * 100}%`, height: `${drawing.height * 100}%` }} />}
    </div>
  );
}

function ReviewPage() {
  const { documentId } = useParams({ from: '/review/$documentId' });
  const navigate = useNavigate();
  const { documents, activePage, redactionMode, activeRedactionId } = useDisclosureStore();
  const store = useDisclosureStore();
  const doc = documents.find((item) => item.id === documentId) ?? documents[0];
  const pageGeometry = doc.pageList[activePage - 1];
  const pageRegions = doc.redactions.filter((item) => item.page === activePage && !item.quarantined);
  const active = doc.redactions.find((item) => item.id === activeRedactionId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason] = useState('商业秘密');
  const [privilege] = useState('合同保密');
  const [importResult, setImportResult] = useState<BatchRecord | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [quarantineOpen, setQuarantineOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const result = store.importPackage(JSON.parse(text));
      setImportResult(result);
    } catch (error) {
      setImportResult({
        batchId: file.name,
        receivedAt: new Date().toISOString(),
        status: 'failed',
        appliedRegions: 0,
        pendingRegions: 0,
        quarantinedRegions: 0,
        recoveredPages: [],
        failedPages: [],
        messages: [`标注包解析失败：${(error as Error).message}`]
      });
    }
  };

  const pendingCount = doc.redactions.filter((r) => r.status === 'pending' && !r.quarantined).length;
  const confirmedCount = doc.redactions.filter((r) => r.status === 'confirmed' && !r.quarantined).length;
  const quarantinedCount = doc.quarantine.length;

  return (
    <div className="page review-page">
      <header className="review-header">
        <div className="review-title">
          <Button variant="ghost" onClick={() => navigate({ to: '/' })}><ArrowLeft size={16} /></Button>
          <div><small>{doc.id} / 去密审阅</small><h1>{doc.title}</h1></div>
          <Badge tone={doc.classification === '严格机密' ? 'red' : 'amber'}>{doc.classification}</Badge>
          {pendingCount > 0 && <Badge tone="amber">{pendingCount} 项待复核</Badge>}
          {quarantinedCount > 0 && <Badge tone="red">{quarantinedCount} 项已隔离</Badge>}
        </div>
        <div className="review-actions">
          <Button variant="outline" onClick={() => store.toggleRedactionMode()} className={redactionMode ? 'active-button' : ''}><Highlighter size={16} /> {redactionMode ? '取消绘制' : '绘制去密区'}</Button>
          <Button variant="outline" onClick={() => store.exportPackage()}><UploadCloud size={16} /> 导出标注包</Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()}><UploadCloud size={16} /> 导入标注包</Button>
          <Button variant="outline" onClick={() => setImportResult(store.importDemoPackage())}><Copy size={16} /> 模拟外聘回传</Button>
          <Button variant="outline" onClick={() => setHistoryOpen(true)}><History size={16} /> 复核记录</Button>
          <Button variant="outline" onClick={() => setQuarantineOpen(true)}>隔离区 {quarantinedCount > 0 && <Badge tone="red">{quarantinedCount}</Badge>}</Button>
          <Button variant="outline" onClick={() => setDialogOpen(true)}><FileCheck2 size={16} /> 发布前校验</Button>
          <Button><Check size={16} /> 提交质检</Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImportFile(file);
              event.target.value = '';
            }}
          />
        </div>
      </header>
      <div className="review-layout">
        <aside className="page-thumbs">
          <div className="side-label">页级预览 <span>{doc.pages} 页</span></div>
          {doc.pageList.map((page) => {
            const pageNo = doc.pageList.findIndex((p) => p.pageId === page.pageId) + 1;
            const pagePending = doc.redactions.filter((r) => r.pageId === page.pageId && r.status === 'pending' && !r.quarantined).length;
            return (
              <button key={page.pageId} className={activePage === pageNo ? 'active' : ''} onClick={() => store.setPage(pageNo)}>
                <div className="mini-page"><span>{page.rotation}°</span><i style={{ width: `${45 + pageNo * 9}%` }} /><i style={{ width: `${70 - pageNo * 5}%` }} /><i style={{ width: `${55 + pageNo * 4}%` }} /></div>
                <small>第 {pageNo} 页 {page.rotation !== 0 && `· 旋转 ${page.rotation}°`} {pagePending > 0 && <em className="thumb-pending">{pagePending} 待复核</em>}</small>
              </button>
            );
          })}
          <Button variant="outline" className="add-page-btn" onClick={() => store.addPage()}><Plus size={14} /> 增加页</Button>
        </aside>
        <section className="viewer-column">
          <div className="viewer-toolbar">
            <div><button onClick={() => store.setPage(Math.max(1, activePage - 1))} disabled={activePage === 1}><ChevronLeft size={16} /></button><strong>{activePage} / {doc.pages}</strong><button onClick={() => store.setPage(Math.min(doc.pages, activePage + 1))} disabled={activePage === doc.pages}><ChevronRight size={16} /></button></div>
            <div className="geometry-tools">
              <RotateCw size={14} />
              {([0, 90, 180, 270] as const).map((r) => (
                <button key={r} className={pageGeometry.rotation === r ? 'active' : ''} onClick={() => store.setPageGeometry(pageGeometry.pageId, { rotation: r })}>{r}°</button>
              ))}
              <Scissors size={14} />
              <select
                value={pageGeometry.crop.width === 1 ? 'full' : String(pageGeometry.crop.width)}
                onChange={(event) => {
                  const value = event.target.value;
                  const crop = value === 'full' ? { ...FULL_CROP } : { x: (1 - Number(value)) / 2, y: (1 - Number(value)) / 2, width: Number(value), height: Number(value) };
                  store.setPageGeometry(pageGeometry.pageId, { crop });
                }}
              >
                <option value="full">全页</option>
                <option value="0.9">裁边 5%</option>
                <option value="0.8">裁边 10%</option>
                <option value="0.7">裁边 15%</option>
              </select>
              <button className="remove-page-btn" onClick={() => store.removePage(pageGeometry.pageId)} disabled={doc.pageList.length <= 1}><Trash2 size={14} /> 移除本页</button>
            </div>
            <span>125% · 原页 · 掩码叠加</span>
          </div>
          <div className="pdf-stage">
            <PdfPage
              key={`${pageGeometry.pageId}-${pageGeometry.rotation}-${pageGeometry.crop.x}-${pageGeometry.crop.y}-${pageGeometry.crop.width}-${pageGeometry.crop.height}`}
              pageNumber={pageGeometry.pdfPage}
              rotation={pageGeometry.rotation}
              crop={pageGeometry.crop}
              onDraw={redactionMode ? (region) => store.addRedaction({ ...region, reason, privilege }) : undefined}
            />
            {pageRegions.map((region) => (
              <button
                key={region.id}
                className={`redaction-region ${region.status} ${activeRedactionId === region.id ? 'selected' : ''}`}
                style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }}
                onClick={() => store.selectRedaction(region.id)}
                title={`${region.reason} / ${region.privilege} / ${region.sourceBatchId}`}
              />
            ))}
          </div>
        </section>
        <aside className="inspector">
          <div className="side-label">区域属性（可迁移标注）</div>
          {active && !active.quarantined ? (
            <>
              <div className="inspector-title"><strong>{active.reason}</strong><Badge tone={active.status === 'confirmed' ? 'green' : active.status === 'pending' ? 'amber' : 'neutral'}>{active.status === 'confirmed' ? '已确认' : active.status === 'pending' ? '待复核' : '草稿'}</Badge></div>
              {active.status === 'pending' && <p className="pending-note"><AlertTriangle size={13} /> 页面几何已变化，原复核失效，请核对后重新确认。</p>}
              <label>保密级别<select value={doc.classification} onChange={(event) => store.updateClassification(event.target.value as DisclosureRecord['classification'])}><option>内部</option><option>机密</option><option>严格机密</option></select></label>
              <div className="annotation-meta">
                <div><span>页号</span><b>第 {active.page} 页</b></div>
                <div><span>旋转角</span><b>{active.rotation}°</b></div>
                <div><span>裁边</span><b>{active.crop.width === 1 ? '全页' : `${Math.round((1 - active.crop.width) * 100)}%`}</b></div>
                <div><span>来源批次</span><b>{active.sourceBatchId}</b></div>
              </div>
              <label>去密原因<input value={active.reason} readOnly /></label>
              <label>特权标签<input value={active.privilege} readOnly /></label>
              <label>责任人员<input value={doc.owner} readOnly /></label>
              <div className="coordinate-grid"><div><span>X</span><b>{Math.round(active.x * 100)}%</b></div><div><span>Y</span><b>{Math.round(active.y * 100)}%</b></div><div><span>宽</span><b>{Math.round(active.width * 100)}%</b></div><div><span>高</span><b>{Math.round(active.height * 100)}%</b></div></div>
              <Button onClick={() => store.confirmRedaction(active.id)} disabled={active.status === 'confirmed'}><Check size={15} /> {active.status === 'pending' ? '重新确认' : '确认此区域'}</Button>
              <Button variant="outline"><Copy size={15} /> 批量复制到同类页</Button>
            </>
          ) : <p className="muted">在文档页面上选择一个去密区域查看属性；区域记录页号、旋转角、归一化坐标与来源批次。</p>}
          <div className="rule-note"><AlertTriangle size={16} /><span>发布版本不得包含原始文本层或图片残片；旋转或裁边变化后原复核自动失效。</span></div>
        </aside>
      </div>
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <Dialog.Title>发布前校验</Dialog.Title>
            <Dialog.Description>系统将核对原始页与发布页的一致性，并检查元数据残留。</Dialog.Description>
            <div className="dialog-checks">
              <p><Check /> {doc.redactions.length} 个去密区域已定位</p>
              <p><Check /> 文档版本与操作者记录完整</p>
              <p className={pendingCount > 0 || quarantinedCount > 0 ? 'failed' : ''}><AlertTriangle /> {pendingCount > 0 ? `${pendingCount} 项待复核` : quarantinedCount > 0 ? `${quarantinedCount} 项已隔离` : '所有区域已确认'}</p>
            </div>
            <Dialog.Close asChild><Button>返回检查 <X size={15} /></Button></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={importResult !== null} onOpenChange={(open) => !open && setImportResult(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <Dialog.Title>标注包导入结果</Dialog.Title>
            <Dialog.Description>批次 {importResult?.batchId} · {importResult?.receivedAt ? new Date(importResult.receivedAt).toLocaleTimeString('zh-CN') : ''}</Dialog.Description>
            {importResult && (
              <div className="dialog-checks">
                <p className={importResult.status === 'conflict' || importResult.status === 'failed' ? 'failed' : ''}>
                  <AlertTriangle /> 状态：{importResult.status === 'applied' ? '已生效' : importResult.status === 'partial' ? '部分生效（已从完成页恢复）' : importResult.status === 'duplicate' ? '同批复传，沿用第一次结果' : importResult.status === 'conflict' ? '批次冲突，内容已留档' : '合并失败'}
                </p>
                <p><Check /> 生效区域 {importResult.appliedRegions} 个</p>
                <p className={importResult.pendingRegions > 0 ? 'failed' : ''}><AlertTriangle /> 转待复核 {importResult.pendingRegions} 个</p>
                <p className={importResult.quarantinedRegions > 0 ? 'failed' : ''}><AlertTriangle /> 隔离 {importResult.quarantinedRegions} 个</p>
                {importResult.recoveredPages.length > 0 && <p><Check /> 已恢复页：第 {importResult.recoveredPages.join('、')} 页</p>}
                {importResult.failedPages.length > 0 && <p className="failed"><AlertTriangle /> 失败页：第 {importResult.failedPages.join('、')} 页</p>}
                {importResult.messages.map((message, index) => <p key={index} className="failed">{message}</p>)}
              </div>
            )}
            <Dialog.Close asChild><Button>知道了 <X size={15} /></Button></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={historyOpen} onOpenChange={setHistoryOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content wide">
            <Dialog.Title>复核记录</Dialog.Title>
            <Dialog.Description>原确认记录长期可查；几何变化后原复核失效并保留在此。</Dialog.Description>
            <div className="history-list">
              {doc.conclusionHistory.length === 0 && <p className="muted">暂无复核记录。</p>}
              {doc.conclusionHistory.slice().reverse().map((c) => (
                <div className="history-row" key={c.id}>
                  <Badge tone="green">已确认</Badge>
                  <div><strong>{c.redactionId}</strong><span>第 {c.page} 页 · 批次 {c.batchId} · {c.reviewer}</span></div>
                  <small>{new Date(c.at).toLocaleString('zh-CN')}</small>
                  {c.note && <em>{c.note}</em>}
                </div>
              ))}
            </div>
            <Dialog.Close asChild><Button>关闭 <X size={15} /></Button></Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={quarantineOpen} onOpenChange={setQuarantineOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content wide">
            <Dialog.Title>隔离区</Dialog.Title>
            <Dialog.Description>落不到当前页面的区域单独留存，不会落到别的页。</Dialog.Description>
            <div className="history-list">
              {doc.quarantine.length === 0 && <p className="muted">隔离区为空。</p>}
              {doc.quarantine.map((q) => (
                <div className="history-row" key={q.id}>
                  <Badge tone="red">已隔离</Badge>
                  <div><strong>{q.quarantineReason}</strong><span>原第 {q.page} 页 · 批次 {q.sourceBatchId} · {q.reason} / {q.privilege}</span></div>
                  <small>{new Date(q.quarantinedAt).toLocaleString('zh-CN')}</small>
                </div>
              ))}
            </div>
            <Dialog.Close asChild><Button>关闭 <X size={15} /></Button></Dialog.Close>
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
        <Card className="decision-card"><div className="card-title"><ShieldCheck size={17} /><strong>复核结论</strong></div><p>本批次共有 <b>{doc.redactions.length}</b> 个去密区域，其中已确认 {doc.redactions.filter((item) => item.status === 'confirmed').length} 个。</p><label><input type="checkbox" checked={store.metadataCleaned} onChange={store.toggleMetadata} /> 已确认元数据清理</label><div className="decision-actions"><Button variant="outline"><ArrowLeft size={15} /> 退回补件</Button><Button disabled={!store.metadataCleaned || Object.values(store.reviewChecks).some((value) => !value)} onClick={store.markReady}><Check size={15} /> 通过并标记可发布</Button></div></Card>
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
