import React, { useRef, useState, useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import {
  X,
  Pencil,
  Square,
  Circle as CircleIcon,
  Minus,
  MoveRight,
  Type,
  Eraser,
  RotateCcw,
  Trash2,
  Download,
  Palette,
} from "lucide-react";
import toast from "react-hot-toast";
import ACTIONS from "../Actions";

export interface WhiteboardElement {
  id: string;
  type: "pencil" | "rect" | "circle" | "line" | "arrow" | "text";
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  text?: string;
  color: string;
  strokeWidth: number;
}

interface WhiteboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  socketRef: React.RefObject<Socket | null>;
  roomId: string;
  initialElements?: any[];
}

const COLORS = [
  "#38bdf8", // Sky
  "#ffffff", // White
  "#f43f5e", // Rose
  "#10b981", // Emerald
  "#fbbf24", // Amber
  "#a855f7", // Purple
  "#fb923c", // Orange
];

const STROKE_WIDTHS = [2, 4, 8];

export const WhiteboardModal: React.FC<WhiteboardModalProps> = ({
  isOpen,
  onClose,
  socketRef,
  roomId,
  initialElements = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<"pencil" | "rect" | "circle" | "line" | "arrow" | "text" | "eraser">("pencil");
  const [color, setColor] = useState("#38bdf8");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [elements, setElements] = useState<WhiteboardElement[]>(initialElements);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<WhiteboardElement | null>(null);

  // Sync initial elements when prop changes
  useEffect(() => {
    if (initialElements && initialElements.length > 0) {
      setElements(initialElements);
    }
  }, [initialElements]);

  // Socket sync listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleDraw = ({ elements: remoteElements }: { elements: WhiteboardElement[] }) => {
      setElements(remoteElements);
    };

    const handleClear = () => {
      setElements([]);
    };

    socket.on(ACTIONS.WHITEBOARD_DRAW, handleDraw);
    socket.on(ACTIONS.WHITEBOARD_CLEAR, handleClear);

    return () => {
      socket.off(ACTIONS.WHITEBOARD_DRAW, handleDraw);
      socket.off(ACTIONS.WHITEBOARD_CLEAR, handleClear);
    };
  }, [socketRef]);

  // Redraw canvas whenever elements change
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background grid
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.5;
    const gridSize = 25;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const allElements = currentElement ? [...elements, currentElement] : elements;

    allElements.forEach((el) => {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (el.type === "pencil" && el.points && el.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.type === "rect" && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
        ctx.beginPath();
        ctx.strokeRect(el.x, el.y, el.width, el.height);
      } else if (el.type === "circle" && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
        ctx.beginPath();
        const radiusX = Math.abs(el.width) / 2;
        const radiusY = Math.abs(el.height) / 2;
        const centerX = el.x + el.width / 2;
        const centerY = el.y + el.height / 2;
        ctx.ellipse(centerX, centerY, Math.max(1, radiusX), Math.max(1, radiusY), 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (el.type === "line" && el.x !== undefined && el.y !== undefined && el.x2 !== undefined && el.y2 !== undefined) {
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
      } else if (el.type === "arrow" && el.x !== undefined && el.y !== undefined && el.x2 !== undefined && el.y2 !== undefined) {
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(el.y2 - el.y, el.x2 - el.x);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(el.x2, el.y2);
        ctx.lineTo(
          el.x2 - headLen * Math.cos(angle - Math.PI / 6),
          el.y2 - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(el.x2, el.y2);
        ctx.lineTo(
          el.x2 - headLen * Math.cos(angle + Math.PI / 6),
          el.y2 - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      } else if (el.type === "text" && el.x !== undefined && el.y !== undefined && el.text) {
        ctx.font = `${Math.max(14, el.strokeWidth * 6)}px sans-serif`;
        ctx.fillText(el.text, el.x, el.y);
      }
    });
  }, [elements, currentElement]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Canvas size setup
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.parentElement?.clientWidth || 1000;
      canvas.height = canvas.parentElement?.clientHeight || 650;
      redraw();
    }
  }, [isOpen, redraw]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getPos(e);
    setIsDrawing(true);

    if (tool === "text") {
      const text = prompt("Enter text for whiteboard:");
      if (text) {
        const newEl: WhiteboardElement = {
          id: `text_${Date.now()}`,
          type: "text",
          x,
          y,
          text,
          color,
          strokeWidth,
        };
        const updated = [...elements, newEl];
        setElements(updated);
        socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, elements: updated });
      }
      setIsDrawing(false);
      return;
    }

    if (tool === "eraser") {
      // Find nearest element and remove
      const updated = elements.filter((el) => {
        if (el.points) {
          return !el.points.some((p) => Math.hypot(p.x - x, p.y - y) < 15);
        }
        if (el.x !== undefined && el.y !== undefined) {
          return Math.hypot(el.x - x, el.y - y) > 20;
        }
        return true;
      });
      setElements(updated);
      socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, elements: updated });
      return;
    }

    if (tool === "pencil") {
      setCurrentElement({
        id: `pencil_${Date.now()}`,
        type: "pencil",
        points: [{ x, y }],
        color,
        strokeWidth,
      });
    } else if (tool === "rect" || tool === "circle") {
      setCurrentElement({
        id: `${tool}_${Date.now()}`,
        type: tool,
        x,
        y,
        width: 0,
        height: 0,
        color,
        strokeWidth,
      });
    } else if (tool === "line" || tool === "arrow") {
      setCurrentElement({
        id: `${tool}_${Date.now()}`,
        type: tool,
        x,
        y,
        x2: x,
        y2: y,
        color,
        strokeWidth,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentElement) return;
    const { x, y } = getPos(e);

    if (currentElement.type === "pencil") {
      setCurrentElement((prev) =>
        prev
          ? {
              ...prev,
              points: [...(prev.points || []), { x, y }],
            }
          : null
      );
    } else if (currentElement.type === "rect" || currentElement.type === "circle") {
      setCurrentElement((prev) =>
        prev
          ? {
              ...prev,
              width: x - (prev.x ?? 0),
              height: y - (prev.y ?? 0),
            }
          : null
      );
    } else if (currentElement.type === "line" || currentElement.type === "arrow") {
      setCurrentElement((prev) =>
        prev
          ? {
              ...prev,
              x2: x,
              y2: y,
            }
          : null
      );
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentElement) {
      const updated = [...elements, currentElement];
      setElements(updated);
      setCurrentElement(null);
      socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, elements: updated });
    }
  };

  const handleUndo = () => {
    if (elements.length === 0) return;
    const updated = elements.slice(0, -1);
    setElements(updated);
    socketRef.current?.emit(ACTIONS.WHITEBOARD_DRAW, { roomId, elements: updated });
  };

  const handleClear = () => {
    if (window.confirm("Clear the entire shared whiteboard?")) {
      setElements([]);
      socketRef.current?.emit(ACTIONS.WHITEBOARD_CLEAR, { roomId });
      toast.success("Whiteboard cleared");
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `whiteboard_${roomId}_${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Whiteboard downloaded as PNG");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
              <Palette className="w-5 h-5" />
              <span>Collaborative Whiteboard</span>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              (Real-time Canvas)
            </span>
          </div>

          {/* Tools Bar */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setTool("pencil")}
              className={`p-1.5 rounded transition ${
                tool === "pencil" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="Pencil / Freehand"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool("rect")}
              className={`p-1.5 rounded transition ${
                tool === "rect" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="Rectangle"
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool("circle")}
              className={`p-1.5 rounded transition ${
                tool === "circle" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="Circle"
            >
              <CircleIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool("line")}
              className={`p-1.5 rounded transition ${
                tool === "line" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="Straight Line"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool("arrow")}
              className={`p-1.5 rounded transition ${
                tool === "arrow" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="Arrow"
            >
              <MoveRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool("text")}
              className={`p-1.5 rounded transition ${
                tool === "text" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="Text Note"
            >
              <Type className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool("eraser")}
              className={`p-1.5 rounded transition ${
                tool === "eraser" ? "bg-rose-600 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="Eraser"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>

          {/* Color & Size Picker */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full border transition ${
                    color === c ? "scale-125 border-white ring-2 ring-sky-400/40" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="h-4 w-px bg-slate-800" />

            <div className="flex items-center gap-1">
              {STROKE_WIDTHS.map((sw) => (
                <button
                  key={sw}
                  onClick={() => setStrokeWidth(sw)}
                  className={`w-6 h-6 rounded flex items-center justify-center text-xs font-mono transition ${
                    strokeWidth === sw ? "bg-slate-800 text-sky-400 font-bold" : "text-slate-500"
                  }`}
                >
                  {sw}px
                </button>
              ))}
            </div>
          </div>

          {/* Actions & Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              title="Undo last stroke"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              className="p-1.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
              title="Clear Whiteboard"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              title="Export as PNG"
            >
              <Download className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-slate-800" />
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-slate-950 overflow-hidden cursor-crosshair">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full h-full block"
          />
        </div>
      </div>
    </div>
  );
};

