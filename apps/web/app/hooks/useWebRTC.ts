'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtimeEvents } from './useRealtimeEvents';

export interface CallUser {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

export interface ActiveCall {
  id: number;
  groupChatId: number;
  startedById: number;
  startedBy: CallUser;
  startedAt: string;
  status: string;
  participants: { user: CallUser; joinedAt: string }[];
}

interface UseWebRTCOptions {
  currentUserId: number;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [
        {
          urls: process.env.NEXT_PUBLIC_TURN_URL,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        },
      ]
    : []),
];

export function useWebRTC({ currentUserId }: UseWebRTCOptions) {
  const { on } = useRealtimeEvents();

  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [inCall, setInCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<number, MediaStream>>(new Map());
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peerConnections = useRef<Map<number, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const currentGroupChatId = useRef<number | null>(null);
  const pendingCandidates = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());

  // Keep localStreamRef in sync
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  const sendSignal = useCallback(
    async (targetUserId: number, type: string, payload: unknown) => {
      if (!currentGroupChatId.current) return;
      try {
        await fetch(
          `/api/groupchats/${currentGroupChatId.current}/call/signal`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId, type, payload }),
          }
        );
      } catch (err) {
        console.error('[useWebRTC] Failed to send signal:', err);
      }
    },
    []
  );

  const createPeerConnection = useCallback(
    (remoteUserId: number): RTCPeerConnection => {
      const existing = peerConnections.current.get(remoteUserId);
      if (existing && existing.connectionState !== 'closed') {
        return existing;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      // Add local tracks
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      // Add screen share track if active
      const sStream = screenStreamRef.current;
      if (sStream) {
        sStream.getTracks().forEach((track) => pc.addTrack(track, sStream));
      }

      // ICE candidate handler
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(remoteUserId, 'ice-candidate', event.candidate.toJSON());
        }
      };

      // Remote track handler
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteStream) {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.set(remoteUserId, remoteStream);
            return next;
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(remoteUserId);
            return next;
          });
          peerConnections.current.delete(remoteUserId);
        }
      };

      peerConnections.current.set(remoteUserId, pc);
      return pc;
    },
    [sendSignal]
  );

  const initiateOfferTo = useCallback(
    async (remoteUserId: number) => {
      const pc = createPeerConnection(remoteUserId);
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        await sendSignal(remoteUserId, 'offer', offer);
      } catch (err) {
        console.error('[useWebRTC] Failed to create offer:', err);
      }
    },
    [createPeerConnection, sendSignal]
  );

  const handleIncomingSignal = useCallback(
    async (event: any) => {
      const { fromUserId, type, payload } = event.data;
      if (!fromUserId || fromUserId === currentUserId) return;

      if (type === 'offer') {
        const pc = createPeerConnection(fromUserId);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          // Flush any buffered ICE candidates
          const buffered = pendingCandidates.current.get(fromUserId) || [];
          for (const c of buffered) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingCandidates.current.delete(fromUserId);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(fromUserId, 'answer', answer);
        } catch (err) {
          console.error('[useWebRTC] Error handling offer:', err);
        }
      } else if (type === 'answer') {
        const pc = peerConnections.current.get(fromUserId);
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
            // Flush any buffered ICE candidates
            const buffered = pendingCandidates.current.get(fromUserId) || [];
            for (const c of buffered) {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            }
            pendingCandidates.current.delete(fromUserId);
          } catch (err) {
            console.error('[useWebRTC] Error handling answer:', err);
          }
        }
      } else if (type === 'ice-candidate') {
        const pc = peerConnections.current.get(fromUserId);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload));
          } catch (err) {
            console.error('[useWebRTC] Error adding ICE candidate:', err);
          }
        } else {
          // Buffer candidate until remote description is set
          const existing = pendingCandidates.current.get(fromUserId) || [];
          pendingCandidates.current.set(fromUserId, [...existing, payload]);
        }
      }
    },
    [currentUserId, createPeerConnection, sendSignal]
  );

  // Subscribe to signaling events
  useEffect(() => {
    return on('call_signal', handleIncomingSignal);
  }, [on, handleIncomingSignal]);

  const cleanupPeerConnections = useCallback(() => {
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    pendingCandidates.current.clear();
    setRemoteStreams(new Map());
  }, []);

  const stopLocalStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    localStreamRef.current = null;
  }, []);

  const stopScreenStream = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
    screenStreamRef.current = null;
    setIsScreenSharing(false);
  }, []);

  const startCall = useCallback(async (groupChatId: number) => {
    try {
      const res = await fetch(`/api/groupchats/${groupChatId}/call`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start call');
      }
      const { call } = await res.json();
      setActiveCall(call);
      currentGroupChatId.current = groupChatId;

      // Acquire media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsAudioEnabled(true);
      setIsVideoEnabled(false);
      setInCall(true);
      // No existing participants to offer to yet
    } catch (err) {
      console.error('[useWebRTC] startCall error:', err);
      throw err;
    }
  }, []);

  const joinCall = useCallback(
    async (groupChatId: number) => {
      try {
        // Acquire media first
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        setLocalStream(stream);
        localStreamRef.current = stream;
        setIsAudioEnabled(true);
        setIsVideoEnabled(false);
        currentGroupChatId.current = groupChatId;

        const res = await fetch(`/api/groupchats/${groupChatId}/call/join`, {
          method: 'POST',
        });
        if (!res.ok) {
          stream.getTracks().forEach((t) => t.stop());
          const err = await res.json();
          throw new Error(err.error || 'Failed to join call');
        }
        const { call, existingParticipantIds } = await res.json();
        setActiveCall(call);
        setInCall(true);

        // Offer to all existing participants
        for (const peerId of existingParticipantIds as number[]) {
          if (peerId !== currentUserId) {
            await initiateOfferTo(peerId);
          }
        }
      } catch (err) {
        console.error('[useWebRTC] joinCall error:', err);
        throw err;
      }
    },
    [currentUserId, initiateOfferTo]
  );

  const leaveCall = useCallback(async () => {
    if (!currentGroupChatId.current) return;
    try {
      await fetch(
        `/api/groupchats/${currentGroupChatId.current}/call/leave`,
        { method: 'POST' }
      );
    } catch (err) {
      console.error('[useWebRTC] leaveCall error:', err);
    }
    cleanupPeerConnections();
    stopLocalStream();
    stopScreenStream();
    setActiveCall(null);
    setInCall(false);
    currentGroupChatId.current = null;
  }, [cleanupPeerConnections, stopLocalStream, stopScreenStream]);

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsAudioEnabled((prev) => !prev);
  }, []);

  const toggleVideo = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    if (isVideoEnabled) {
      stream.getVideoTracks().forEach((t) => {
        t.enabled = false;
        t.stop();
        stream.removeTrack(t);
      });
      // Remove video sender from all PCs
      peerConnections.current.forEach((pc) => {
        pc.getSenders()
          .filter((s) => s.track?.kind === 'video' && !isScreenSharing)
          .forEach((s) => pc.removeTrack(s));
      });
      setIsVideoEnabled(false);
    } else {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = videoStream.getVideoTracks()[0];
      stream.addTrack(videoTrack);
      // Add video track to all existing PCs
      peerConnections.current.forEach((pc) => {
        pc.addTrack(videoTrack, stream);
      });
      setIsVideoEnabled(true);
      videoTrack.onended = () => setIsVideoEnabled(false);
    }
  }, [isVideoEnabled, isScreenSharing]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenStream();
      // Remove screen track from all PCs
      peerConnections.current.forEach((pc) => {
        pc.getSenders()
          .filter((s) => s.track?.kind === 'video')
          .forEach((s) => pc.removeTrack(s));
      });
      // Re-add webcam video track if video was on
      const stream = localStreamRef.current;
      if (stream && isVideoEnabled) {
        stream.getVideoTracks().forEach((track) => {
          peerConnections.current.forEach((pc) => pc.addTrack(track, stream));
        });
      }
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        setScreenStream(displayStream);
        screenStreamRef.current = displayStream;
        setIsScreenSharing(true);

        // Add screen track to all existing PCs
        displayStream.getTracks().forEach((track) => {
          peerConnections.current.forEach((pc) => {
            pc.addTrack(track, displayStream);
          });
        });

        // Listen for user stopping share via browser UI
        displayStream.getVideoTracks()[0].onended = () => {
          stopScreenStream();
        };
      } catch (err) {
        console.error('[useWebRTC] Screen share error:', err);
      }
    }
  }, [isScreenSharing, isVideoEnabled, stopScreenStream]);

  // Handle incoming call_participant_joined - send offer to the new participant
  const handleParticipantJoined = useCallback(
    (event: any) => {
      if (!inCall) return;
      const { user } = event.data;
      if (user && user.id !== currentUserId) {
        // New participant will send us an offer; we don't need to do anything here
        // The joiner calls initiateOfferTo for all existing participants
      }
    },
    [inCall, currentUserId]
  );

  useEffect(() => {
    return on('call_participant_joined', handleParticipantJoined);
  }, [on, handleParticipantJoined]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPeerConnections();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [cleanupPeerConnections]);

  return {
    activeCall,
    inCall,
    localStream,
    remoteStreams,
    screenStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    startCall,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  };
}
