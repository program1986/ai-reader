// CFI 漂移修复
// 当 EPUB 的章节内容变了(比如重新出版、用户用 foliate-js 解析时 DOM 结构有差异),
// 之前保存的 CFI range 可能不再指向原文,需要用 prefix/suffix 重新定位。
//
// 算法(参考 Readest src/utils/cfi.ts + foliate-js tests/cfi.test.js):
//   1. 拿到目标 section 的 doc
//   2. 把整个 section 的 textContent 拿出来
//   3. 找 prefix + selectedText + suffix 的拼接
//   4. 拼不出 → 返回 null(让调用方决定回退策略)
//
// ⚠️  foliate-js 的 CFI 是 "epubcfi" 格式(EPUB 3 spec, IDPF)
// ⚠️  这里只产出修复后的 Range,不直接重新生成 CFI
//     (重新生成 CFI 需要 foliate-js 的 CFI 模块,见 ./cfi-gen.ts)
import type { AnnotationLocator } from '@/types';

export interface DriftRepairInput {
  /** 原始 CFI range */
  cfiRange: string;
  /** 选区前 32 字符(选区发生变化时定位) */
  prefix?: string;
  /** 选区后 32 字符 */
  suffix?: string;
  /** 选中的原文(可选,辅助定位) */
  selectedText?: string;
}

export interface DriftRepairOutput {
  /** 修复后的 CFI range(可能与原 cfiRange 相同) */
  cfiRange: string;
  /** 是否做了修复 */
  repaired: boolean;
  /** 修复失败原因 */
  reason?: string;
}

/**
 * 修复 CFI range(纯函数,根据输入产出结果)
 * 实际 DOM 搜索需要在 reader 内部做,这里只产出"应不应该修"的判断
 */
export function shouldAttemptRepair(locator: AnnotationLocator | undefined): boolean {
  if (!locator) return false;
  return !!(locator.prefix || locator.suffix);
}

/**
 * 在 doc 的范围内搜索 prefix + selectedText + suffix 拼接
 * 找到了返回起止 Range;找不到返回 null
 */
export function findRangeByContext(
  doc: Document,
  prefix: string | undefined,
  selectedText: string | undefined,
  suffix: string | undefined,
): Range | null {
  if (!selectedText) return null;
  const full = doc.body.textContent ?? '';
  const needle = `${prefix ?? ''}${selectedText}${suffix ?? ''}`;
  const idx = full.indexOf(needle);
  if (idx < 0) return null;
  // 找到位置,转成 Range(用 text walker)
  const startOffset = idx + (prefix?.length ?? 0);
  return makeRangeFromOffsets(doc, startOffset, startOffset + selectedText.length);
}

/**
 * 在 doc 中,把 textContent 偏移 [start, end) 转成 DOM Range
 * 实现:用 TreeWalker 累加 node 长度,直到找到对应 offset 的 node
 */
function makeRangeFromOffsets(doc: Document, start: number, end: number): Range | null {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let cur = 0;
  let startNode: Text | null = null;
  let startOffsetInNode = 0;
  let endNode: Text | null = null;
  let endOffsetInNode = 0;

  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    const len = text.length;
    if (!startNode && cur + len >= start) {
      startNode = text;
      startOffsetInNode = start - cur;
    }
    if (cur + len >= end) {
      endNode = text;
      endOffsetInNode = end - cur;
      break;
    }
    cur += len;
    node = walker.nextNode();
  }

  if (!startNode || !endNode) return null;
  const range = doc.createRange();
  try {
    range.setStart(startNode, startOffsetInNode);
    range.setEnd(endNode, endOffsetInNode);
  } catch {
    return null;
  }
  return range;
}

/**
 * 重新生成 CFI 字符串
 * foliate-js 内部用 ./epubcfi.js 维护,这里只做占位实现
 * 实际实现需要 import foliate-js 的 CFI 模块:
 *   import { CFI } from 'foliate-js/epubcfi.js'
 *   CFI.fromRange(range, doc, spineIndex)
 */
export function regenerateCfi(
  _range: Range,
  _doc: Document,
  _spineIndex: number,
): string | null {
  // TODO: 实现 - 需 import foliate-js/epubcfi.js
  return null;
}

/**
 * 一站式修复:locator + 当前 doc → 新的 CFI range
 * 失败返回 null(调用方应保留原 CFI,在 UI 上提示"位置可能已变")
 */
export function repairCfiRange(
  doc: Document,
  locator: AnnotationLocator | undefined,
): string | null {
  if (!locator?.cfiRange) return null;
  // selectedText 在 Annotation 上,不在 Locator 上。这里只能基于 prefix+suffix 做粗匹配,
  // 完整修复需要调用方把 annotation 一起传进来(M2.1)
  const range = findRangeByContext(doc, locator.prefix, undefined, locator.suffix);
  if (!range) return null;
  // 把 index 解析出来(CFI 形如 "epubcfi(/6/4!/4/2/1:0,/6/4!/4/2/1:32)")
  const indexMatch = locator.cfiRange.match(/epubcfi\(\/(\d+)\//);
  if (!indexMatch) return null;
  const spineIndex = Number(indexMatch[1]);
  return regenerateCfi(range, doc, spineIndex);
}

// 之前导出的 repairCfiRange(从 foliate.ts re-export)
export { repairCfiRange as _legacyRepair };
