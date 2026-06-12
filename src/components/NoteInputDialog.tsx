// 笔记输入弹窗 - M2 完整实现
// 用于:
//   - 划线 + 笔记 一起保存
//   - 独立笔记(无选区)输入
import { Show, createSignal } from 'solid-js';

interface NoteInputDialogProps {
  open: boolean;
  /** 选中的原文(可能为空,独立笔记场景) */
  selectedText?: string;
  /** 默认颜色 */
  defaultColor?: string;
  onConfirm: (data: { noteText: string; color: string }) => void;
  onCancel: () => void;
}

const COLORS = [
  { key: 'yellow', label: '黄', hex: '#ffeb3b' },
  { key: 'green', label: '绿', hex: '#4caf50' },
  { key: 'blue', label: '蓝', hex: '#2196f3' },
  { key: 'pink', label: '粉', hex: '#e91e63' },
  { key: 'purple', label: '紫', hex: '#9c27b0' },
] as const;

export function NoteInputDialog(props: NoteInputDialogProps) {
  const [text, setText] = createSignal('');
  const [color, setColor] = createSignal(props.defaultColor ?? 'yellow');

  function handleSubmit(e: Event) {
    e.preventDefault();
    props.onConfirm({ noteText: text().trim(), color: color() });
    setText('');
  }

  return (
    <Show when={props.open}>
      <div class="modal-overlay" onClick={props.onCancel}>
        <form
          class="modal"
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
        >
          <h2>笔记</h2>

          <Show when={props.selectedText}>
            {(t) => (
              <blockquote class="modal__quote">
                「{t().slice(0, 200)}{t().length > 200 ? '…' : ''}」
              </blockquote>
            )}
          </Show>

          <textarea
            class="input"
            rows="5"
            placeholder="写下你的想法…"
            value={text()}
            onInput={(e) => setText(e.currentTarget.value)}
            autofocus
          />

          <div class="color-picker">
            {COLORS.map((c) => (
              <button
                type="button"
                class="color-chip"
                classList={{ 'color-chip--active': color() === c.key }}
                style={{ background: c.hex }}
                onClick={() => setColor(c.key)}
                aria-label={c.label}
              />
            ))}
          </div>

          <div class="row" style={{ 'justify-content': 'flex-end' }}>
            <button type="button" class="btn" onClick={props.onCancel}>
              取消
            </button>
            <button type="submit" class="btn btn-primary">
              保存
            </button>
          </div>
        </form>
      </div>
    </Show>
  );
}
