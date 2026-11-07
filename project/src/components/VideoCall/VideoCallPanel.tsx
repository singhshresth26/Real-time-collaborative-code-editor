import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneCall,
  PhoneOff,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import ACTIONS from "../Actions";

interface PeerStream {
  socketId: string;
  username: string;
  stream: MediaStream;
  isAudioMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
}

interface VideoCallPanelProps {
  socketRef: React.RefObject<Socket | null>;
  roomId: string;
  username: string;
  isOpen: boolean;
  onClose: () => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export const VideoCallPanel: React.FC<VideoCallPanelProps> = ({
  socketRef,
  roomId,
  username,
  isOpen,
  onClose,
}) => {
  const [isInCall, setIsInCall] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peers, setPeers] = useState<PeerStream[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  // Stop all media tracks helper
  const stopAllTracks = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setPeers([]);
    setIsInCall(false);
    setIsScreenSharing(false);
  }, []);

  // Join Call handler
  const handleJoinCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setIsInCall(true);
      toast.success("Joined voice & video call");

      // Notify others in room
      socketRef.current?.emit(ACTIONS.WEBRTC_USER_JOINED, {
        roomId,
        username,
      });
    } catch (err: any) {
      console.error("Failed to access camera/mic:", err);
      toast.error(`Media access error: ${err.message || "Permission denied"}`);
    }
  };

  // Leave Call handler
  const handleLeaveCall = () => {
    socketRef.current?.emit(ACTIONS.WEBRTC_USER_LEFT, { roomId });
    stopAllTracks();
    toast("Left voice & video call", { icon: "👋" });
  };

  // Toggle Mic
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
        socketRef.current?.emit(ACTIONS.WEBRTC_MEDIA_STATE, {
          roomId,
          isAudioMuted: !audioTrack.enabled,
          isVideoOff,
          isScreenSharing,
        });
      }
    }
  };

  // Toggle Camera
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        socketRef.current?.emit(ACTIONS.WEBRTC_MEDIA_STATE, {
          roomId,
          isAudioMuted,
          isVideoOff: !videoTrack.enabled,
          isScreenSharing,
        });
      }
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert to camera
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const camVideoTrack = camStream.getVideoTracks()[0];
        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) {
            localStreamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStreamRef.current.addTrack(camVideoTrack);
        }
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(camVideoTrack);
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        setIsScreenSharing(false);
      } catch (err) {
        console.error("Revert camera error:", err);
      }
    } else {
      // Start screen sharing
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = displayStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) {
            localStreamRef.current.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStreamRef.current.addTrack(screenTrack);
        }

        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setIsScreenSharing(true);
        toast.success("Sharing your screen");
      } catch (err: any) {
        console.error("Screen share error:", err);
      }
    }
  };

  // WebRTC Signal Listener & Connection creation
  const createPeerConnection = useCallback(
    (targetSocketId: string, remoteUsername: string, isInitiator: boolean) => {
      if (peerConnectionsRef.current.has(targetSocketId)) {
        return peerConnectionsRef.current.get(targetSocketId)!;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current.set(targetSocketId, pc);

      // Add local tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit(ACTIONS.WEBRTC_SIGNAL, {
            targetSocketId,
            signal: { candidate: event.candidate },
            username,
          });
        }
      };

      // Handle remote streams
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (remoteStream) {
          setPeers((prev) => {
            const exists = prev.find((p) => p.socketId === targetSocketId);
            if (exists) {
              return prev.map((p) =>
                p.socketId === targetSocketId ? { ...p, stream: remoteStream } : p
              );
            }
            return [
              ...prev,
              {
                socketId: targetSocketId,
                username: remoteUsername,
                stream: remoteStream,
              },
            ];
          });
        }
      };

      // If initiator, create offer
      if (isInitiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socketRef.current?.emit(ACTIONS.WEBRTC_SIGNAL, {
              targetSocketId,
              signal: { sdp: pc.localDescription },
              username,
            });
          })
          .catch((err) => console.error("Error creating offer:", err));
      }

      return pc;
    },
    [socketRef, username]
  );

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // A peer joined call -> create offer to them
    const handlePeerJoined = ({
      socketId,
      username: remoteUser,
    }: {
      socketId: string;
      username: string;
    }) => {
      if (isInCall && socketId !== socket.id) {
        createPeerConnection(socketId, remoteUser, true);
      }
    };

    // Received WebRTC Signal (SDP / ICE)
    const handleSignal = async ({
      fromSocketId,
      username: remoteUser,
      signal,
    }: {
      fromSocketId: string;
      username: string;
      signal: any;
    }) => {
      let pc = peerConnectionsRef.current.get(fromSocketId);
      if (!pc) {
        pc = createPeerConnection(fromSocketId, remoteUser, false);
      }

      if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit(ACTIONS.WEBRTC_SIGNAL, {
            targetSocketId: fromSocketId,
            signal: { sdp: pc.localDescription },
            username,
          });
        }
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (err) {
          console.error("Error adding ice candidate:", err);
        }
      }
    };

    // Peer left call
    const handlePeerLeft = ({ socketId }: { socketId: string }) => {
      const pc = peerConnectionsRef.current.get(socketId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(socketId);
      }
      setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
    };

    // Peer media state changed
    const handleMediaState = ({
      socketId,
      isAudioMuted: remoteAudio,
      isVideoOff: remoteVideo,
      isScreenSharing: remoteScreen,
    }: {
      socketId: string;
      isAudioMuted: boolean;
      isVideoOff: boolean;
      isScreenSharing: boolean;
    }) => {
      setPeers((prev) =>
        prev.map((p) =>
          p.socketId === socketId
            ? {
                ...p,
                isAudioMuted: remoteAudio,
                isVideoOff: remoteVideo,
                isScreenSharing: remoteScreen,
              }
            : p
        )
      );
    };

    socket.on(ACTIONS.WEBRTC_USER_JOINED, handlePeerJoined);
    socket.on(ACTIONS.WEBRTC_SIGNAL, handleSignal);
    socket.on(ACTIONS.WEBRTC_USER_LEFT, handlePeerLeft);
    socket.on(ACTIONS.WEBRTC_MEDIA_STATE, handleMediaState);

    return () => {
      socket.off(ACTIONS.WEBRTC_USER_JOINED, handlePeerJoined);
      socket.off(ACTIONS.WEBRTC_SIGNAL, handleSignal);
      socket.off(ACTIONS.WEBRTC_USER_LEFT, handlePeerLeft);
      socket.off(ACTIONS.WEBRTC_MEDIA_STATE, handleMediaState);
    };
  }, [socketRef, isInCall, createPeerConnection, username]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAllTracks();
    };
  }, [stopAllTracks]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-sky-400 uppercase">
          <PhoneCall className="w-4 h-4 text-sky-400" />
          <span>Voice & Video Call</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isInCall && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live ({peers.length + 1})
            </span>
          )}
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-1.5 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Video Grid */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!isInCall ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Video className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Start or Join Call
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Real-time WebRTC audio, video, and screen sharing with all room members.
              </p>
            </div>
            <button
              onClick={handleJoinCall}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-lg"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Join Video Call</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {/* Local Video Stream */}
            <div className="relative rounded-lg overflow-hidden bg-slate-950 border border-slate-800 aspect-video shadow-md">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVideoOff ? "hidden" : ""}`}
              />
              {isVideoOff && (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900">
                  <VideoOff className="w-8 h-8 mb-1 text-slate-600" />
                  <span className="text-xs font-medium">Camera is off</span>
                </div>
              )}
              {/* Badge & Name */}
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur px-2 py-0.5 rounded text-[11px] font-medium text-slate-200 border border-slate-800">
                <span>{username} (You)</span>
                {isAudioMuted && <MicOff className="w-3 h-3 text-rose-400" />}
                {isScreenSharing && (
                  <span className="text-[10px] text-sky-400 bg-sky-500/20 px-1 rounded">
                    Screen
                  </span>
                )}
              </div>
            </div>

            {/* Remote Peers Streams */}
            {peers.map((peer) => (
              <RemoteVideoCard key={peer.socketId} peer={peer} />
            ))}

            {peers.length === 0 && (
              <div className="p-3 text-center rounded bg-slate-950/40 border border-slate-800/60 text-xs text-slate-400">
                <Users className="w-4 h-4 mx-auto mb-1 text-slate-500" />
                Waiting for other members to join the call...
              </div>
            )}
          </div>
        )}
      </div>

      {/* In-Call Controls Toolbar */}
      {isInCall && (
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-center gap-2">
          {/* Mute Mic */}
          <button
            onClick={toggleAudio}
            className={`p-2.5 rounded-full transition ${
              isAudioMuted
                ? "bg-rose-600/20 text-rose-400 border border-rose-500/30"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200"
            }`}
            title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Video Toggle */}
          <button
            onClick={toggleVideo}
            className={`p-2.5 rounded-full transition ${
              isVideoOff
                ? "bg-rose-600/20 text-rose-400 border border-rose-500/30"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200"
            }`}
            title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-2.5 rounded-full transition ${
              isScreenSharing
                ? "bg-sky-600/20 text-sky-400 border border-sky-500/30"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200"
            }`}
            title={isScreenSharing ? "Stop Screen Sharing" : "Share Screen"}
          >
            <Monitor className="w-4 h-4" />
          </button>

          {/* Leave Call */}
          <button
            onClick={handleLeaveCall}
            className="p-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition shadow"
            title="Leave Call"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// Subcomponent to render remote peer's stream
const RemoteVideoCard: React.FC<{ peer: PeerStream }> = ({ peer }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div className="relative rounded-lg overflow-hidden bg-slate-950 border border-slate-800 aspect-video shadow-md">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${peer.isVideoOff ? "hidden" : ""}`}
      />
      {peer.isVideoOff && (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900">
          <VideoOff className="w-8 h-8 mb-1 text-slate-600" />
          <span className="text-xs font-medium">{peer.username}'s camera is off</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur px-2 py-0.5 rounded text-[11px] font-medium text-slate-200 border border-slate-800">
        <span>{peer.username}</span>
        {peer.isAudioMuted && <MicOff className="w-3 h-3 text-rose-400" />}
        {peer.isScreenSharing && (
          <span className="text-[10px] text-sky-400 bg-sky-500/20 px-1 rounded">
            Screen
          </span>
        )}
      </div>
    </div>
  );
};

