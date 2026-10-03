import type { ImportBatch } from './annotation';

// 演示用外聘复核导入包：
// - EXT-2609-A 携带第 1 页旋转 90° + 裁边的几何声明，区域带旋转角；
// - EXT-2610-X 引用超出文档的页码，用于演示合并中断与断点恢复；
// - EXT-2611-B 用于演示前批未完成时后到内容留作冲突。
export function makePresetBatches(documentId: string, pageCount: number): ImportBatch[] {
  const missingPage = pageCount + 2;
  return [
    {
      batchId: 'EXT-2609-A',
      documentId,
      submittedBy: '外聘一组 · 陈述',
      pages: [{ pageNumber: 1, rotation: 90, crop: { x: 0.05, y: 0.04, width: 0.9, height: 0.9 } }],
      regions: [
        { key: 'a1', pageNumber: 1, rotation: 90, x: 0.1, y: 0.12, width: 0.42, height: 0.05, reason: '合同金额', privilege: '商业秘密' },
        { key: 'a2', pageNumber: 1, rotation: 90, x: 0.12, y: 0.3, width: 0.36, height: 0.05, reason: '银行账号', privilege: '个人信息' },
        { key: 'a3', pageNumber: 2, x: 0.2, y: 0.4, width: 0.5, height: 0.05, reason: '第三方报价', privilege: '商业敏感' }
      ]
    },
    {
      batchId: 'EXT-2610-X',
      documentId,
      submittedBy: '外聘二组 · 何畏',
      regions: [
        { key: 'x1', pageNumber: 2, x: 0.15, y: 0.55, width: 0.4, height: 0.05, reason: '证人姓名', privilege: '个人信息' },
        { key: 'x2', pageNumber: 3, x: 0.15, y: 0.2, width: 0.4, height: 0.05, reason: '内部意见', privilege: '工作成果' },
        { key: 'x3', pageNumber: missingPage, x: 0.2, y: 0.3, width: 0.4, height: 0.05, reason: '附件报价', privilege: '商业敏感' }
      ]
    },
    {
      batchId: 'EXT-2611-B',
      documentId,
      submittedBy: '外聘三组 · 祁同',
      regions: [{ key: 'b1', pageNumber: 1, x: 0.3, y: 0.6, width: 0.35, height: 0.05, reason: '签署日期', privilege: '商业敏感' }]
    }
  ];
}
