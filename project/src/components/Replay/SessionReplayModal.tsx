import React, { useState, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import {
  Play,
  Pause,
  RotateCcw,
  X,
  Video,
  Save,
  FileCode,
} from "lucide-react";
import toast from "react-hot-toast";
import ACTIONS from "../Actions";
import type { SessionRecording, SessionRecordingEvent } from "../../types";

interface SessionReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  socketRef: React.RefObject<Socket | null>;
  roomId: string;
  recordings: SessionRecording[];
  activeRecordingEvents: SessionRecordingEvent[];
  isRecording: boolean;
  onToggleRecording: () => void;
}

export const SessionReplayModal: React.FC<SessionReplayModalProps> = ({
  isOpen,
  onClose,
  socketRef,
  roomId,
  recordings,
  activeRecordingEvents,
  isRecording,
  onToggleRecording,
}) => {
  const [selectedRecording, setSelectedRecording] = useState<SessionRecording | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const timerRef = useRef<any>(null);

  // Default to active recording events if none chosen
  const activeEvents = selectedRecording ? selectedRecording.events : activeRecordingEvents;
  const currentEvent = activeEvents[currentEventIndex] || null;

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (activeEvents.length === 0 || currentEventIndex >= activeEvents.length - 1) {
      setIsPlaying(false);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentEventIndex((prev) => {
        if (prev >= activeEvents.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playbackSpeed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentEventIndex, activeEvents.length, playbackSpeed]);

  const handlePlayPause = () => {
    if (activeEvents.length === 0) {
      toast.error("No recorded events to replay yet");
      return;
    }
    if (currentEventIndex >= activeEvents.length - 1) {
      setCurrentEventIndex(0);
    }
    setIsPlaying((prev) => !prev);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentEventIndex(0);
  };

  const handleSaveActiveRecording = () => {
    if (activeRecordingEvents.length === 0) {
      toast.error("No recorded events to save");
      return;
    }

    const newRec: SessionRecording = {
      id: `rec_${Date.now()}`,
      title: `Recording on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
      startedAt: new Date().toISOString(),
      durationMs: activeRecordingEvents.length * 1000,
      events: activeRecordingEvents,
    };

    socketRef.current?.emit(ACTIONS.RECORDING_SAVE, {
      roomId,
      recording: newRec,
    });

    toast.success("Session recording saved successfully!");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
            <Video className="w-5 h-5" />
            <span>Session Recording & Replay</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleRecording}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${
                isRecording
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isRecording ? "bg-rose-500 animate-pulse" : "bg-slate-500"}`} />
              <span>{isRecording ? "Stop Recording" : "Record Session"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Saved Recordings Sidebar */}
          <div className="w-64 border-r border-slate-800 bg-slate-950/40 p-3 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Saved Replays ({recordings.length})
              </span>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedRecording(null);
                    setCurrentEventIndex(0);
                    setIsPlaying(false);
                  }}
                  className={`w-full text-left p-2 rounded text-xs transition border ${
                    !selectedRecording
                      ? "bg-sky-500/10 border-sky-500/30 text-sky-300 font-semibold"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Live Active Session</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {activeRecordingEvents.length} evts
                    </span>
                  </div>
                </button>

                {recordings.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => {
                      setSelectedRecording(rec);
                      setCurrentEventIndex(0);
                      setIsPlaying(false);
                    }}
                    className={`w-full text-left p-2 rounded text-xs transition border ${
                      selectedRecording?.id === rec.id
                        ? "bg-sky-500/10 border-sky-500/30 text-sky-300 font-semibold"
                        : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850"
                    }`}
                  >
                    <div className="font-medium truncate">{rec.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {rec.events.length} events
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Save Active Button */}
            {!selectedRecording && activeRecordingEvents.length > 0 && (
              <button
                onClick={handleSaveActiveRecording}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Current Recording</span>
              </button>
            )}
          </div>

          {/* Replay Player Viewer */}
          <div className="flex-1 flex flex-col bg-slate-950 p-4">
            {/* Event Display */}
            <div className="flex-1 rounded-lg bg-slate-900 border border-slate-800 p-4 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 text-xs">
                  <FileCode className="w-4 h-4 text-sky-400" />
                  <span className="font-semibold text-slate-200">
                    {currentEvent ? `Event #${currentEventIndex + 1}: ${currentEvent.type}` : "No events recorded"}
                  </span>
                </div>
                {currentEvent && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    By: <strong className="text-sky-300">{currentEvent.username}</strong>
                  </span>
                )}
              </div>

              {/* Code state / event data snippet */}
              <div className="flex-1 my-3 bg-slate-950 rounded border border-slate-800/80 p-3 overflow-auto font-mono text-xs text-slate-300">
                {currentEvent ? (
                  <pre className="whitespace-pre-wrap">
                    {currentEvent.data?.code || JSON.stringify(currentEvent.data, null, 2)}
                  </pre>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 italic">
                    Start recording session to capture keystrokes and changes.
                  </div>
                )}
              </div>

              {/* Progress info */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800">
                <span>
                  Step {activeEvents.length > 0 ? currentEventIndex + 1 : 0} of {activeEvents.length}
                </span>
                <span>
                  {activeEvents.length > 0
                    ? `${Math.round(((currentEventIndex + 1) / activeEvents.length) * 100)}%`
                    : "0%"}
                </span>
              </div>
            </div>

            {/* Playback Controls & Scrubber */}
            <div className="pt-4 space-y-3">
              {/* Scrubber slider */}
              <input
                type="range"
                min={0}
                max={Math.max(0, activeEvents.length - 1)}
                value={currentEventIndex}
                onChange={(e) => {
                  setCurrentEventIndex(Number(e.target.value));
                  setIsPlaying(false);
                }}
                disabled={activeEvents.length === 0}
                className="w-full accent-sky-500 cursor-pointer"
              />

              {/* Buttons Toolbar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePlayPause}
                    className="p-2 rounded-full bg-sky-600 hover:bg-sky-500 text-white transition shadow"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleReset}
                    className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition"
                    title="Reset to beginning"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Speed Controls */}
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-1">
                  {[0.5, 1, 2, 4].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                        playbackSpeed === spd
                          ? "bg-sky-600 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
