import { Decoration, WidgetType, EditorView } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";

export interface PeerCursorData {
  socketId: string;
  username: string;
  color: string;
  from: number;
  to: number;
}

const PEER_COLORS = [
  "#38bdf8", // Sky blue
  "#f43f5e", // Rose
  "#10b981", // Emerald
  "#a855f7", // Purple
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#eab308", // Yellow
  "#6366f1", // Indigo
];

export const getPeerColor = (identifier: string): string => {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PEER_COLORS.length;
  return PEER_COLORS[index]!;
};

class CursorWidget extends WidgetType {
  username: string;
  color: string;

  constructor(username: string, color: string) {
    super();
    this.username = username;
    this.color = color;
  }

  toDOM() {
    const container = document.createElement("span");
    container.className = "cm-peer-cursor-container";
    container.style.position = "relative";
    container.style.display = "inline";
    container.style.pointerEvents = "none";
    container.style.userSelect = "none";

    // Caret vertical line
    const caret = document.createElement("span");
    caret.className = "cm-peer-cursor-caret";
    caret.style.position = "absolute";
    caret.style.top = "-0.15em";
    caret.style.bottom = "-0.15em";
    caret.style.left = "-1px";
    caret.style.width = "2px";
    caret.style.backgroundColor = this.color;
    caret.style.zIndex = "10";
    caret.style.borderRadius = "1px";

    // Floating username badge
    const tag = document.createElement("span");
    tag.className = "cm-peer-cursor-tag";
    tag.textContent = this.username;
    tag.style.position = "absolute";
    tag.style.top = "-1.55em";
    tag.style.left = "-2px";
    tag.style.backgroundColor = this.color;
    tag.style.color = "#ffffff";
    tag.style.fontSize = "10px";
    tag.style.fontWeight = "600";
    tag.style.fontFamily = "system-ui, -apple-system, sans-serif";
    tag.style.lineHeight = "1";
    tag.style.padding = "2px 5px";
    tag.style.borderRadius = "3px 3px 3px 0";
    tag.style.whiteSpace = "nowrap";
    tag.style.zIndex = "20";
    tag.style.boxShadow = "0 2px 5px rgba(0,0,0,0.4)";
    tag.style.pointerEvents = "none";

    container.appendChild(caret);
    container.appendChild(tag);
    return container;
  }

  eq(other: CursorWidget) {
    return other.username === this.username && other.color === this.color;
  }
}

export const setPeerCursorsEffect = StateEffect.define<PeerCursorData[]>();

export const peerCursorsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    // Map existing decorations through local document changes
    decorations = decorations.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(setPeerCursorsEffect)) {
        const docLength = tr.newDoc.length;
        const widgets = [];

        for (const peer of effect.value) {
          const safeFrom = Math.min(Math.max(0, peer.from), docLength);
          const safeTo = Math.min(Math.max(0, peer.to), docLength);

          if (safeFrom === safeTo) {
            widgets.push(
              Decoration.widget({
                widget: new CursorWidget(peer.username, peer.color),
                side: 1,
              }).range(safeFrom)
            );
          } else {
            const start = Math.min(safeFrom, safeTo);
            const end = Math.max(safeFrom, safeTo);

            widgets.push(
              Decoration.mark({
                attributes: {
                  style: `background-color: ${peer.color}40;`,
                },
                class: "cm-peer-selection",
              }).range(start, end)
            );

            widgets.push(
              Decoration.widget({
                widget: new CursorWidget(peer.username, peer.color),
                side: 1,
              }).range(end)
            );
          }
        }

        return Decoration.set(widgets, true);
      }
    }

    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});
