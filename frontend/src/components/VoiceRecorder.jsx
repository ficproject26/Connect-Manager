import React, { useState, useRef } from 'react';
import { uploadService } from '../services/api';
import { Mic, Square, Play, Pause, Trash2, Upload, AlertCircle, CheckCircle2, Volume2 } from 'lucide-react';

const VoiceRecorder = ({ onVoiceNoteUploaded, onAudioRecorded }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const fileInputRef = useRef(null);

  const notifyParent = (url) => {
    if (onVoiceNoteUploaded) onVoiceNoteUploaded(url);
    if (onAudioRecorded) onAudioRecorded(url);
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    setError('');
    audioChunksRef.current = [];
    setRecordingTime(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const localUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(localUrl);
        // Immediately notify parent so state is populated
        notifyParent(localUrl);

        // Upload to server
        const audioFile = new File([audioBlob], `voicenote_${Date.now()}.webm`, { type: 'audio/webm' });
        await handleUpload(audioFile, localUrl);
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      setError('Microphone access denied or unavailable. You can upload an audio file below.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleUpload = async (file, fallbackUrl = '') => {
    setUploading(true);
    setError('');
    try {
      const res = await uploadService.uploadDocument(file);
      if (res && res.success && res.file) {
        const fullUrl = res.file.url;
        setAudioUrl(fullUrl);
        notifyParent(fullUrl);
      } else if (fallbackUrl) {
        notifyParent(fallbackUrl);
      }
    } catch (err) {
      console.warn('Voice note server upload warning (using audio stream):', err);
      // Still allow submission with local audio url
      if (fallbackUrl) notifyParent(fallbackUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const localUrl = URL.createObjectURL(file);
      setAudioUrl(localUrl);
      notifyParent(localUrl);
      handleUpload(file, localUrl);
    }
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const clearAudio = () => {
    setAudioUrl('');
    setRecordingTime(0);
    notifyParent('');
  };

  return (
    <div style={{
      border: '1.5px dashed var(--border-strong, #cbd5e1)',
      borderRadius: '12px',
      padding: '16px',
      background: '#f8fafc',
      textAlign: 'center'
    }}>
      {error && (
        <div style={{
          padding: '8px 12px',
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 8,
          color: '#ef4444',
          fontSize: 12,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {!audioUrl && !isRecording && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={startRecording}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 30,
              border: 'none',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)'
            }}
          >
            <Mic size={18} /> Tap to Record Voice Note
          </button>

          <span style={{ fontSize: 11, color: '#94a3b8' }}>or upload an audio file</span>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Upload size={14} /> Upload Audio File (.mp3, .m4a, .webm)
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {isRecording && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontWeight: 800, fontSize: '1.1rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
            Recording: {formatTimer(recordingTime)}
          </div>
          <button
            type="button"
            onClick={stopRecording}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              borderRadius: 20,
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Square size={16} fill="#ffffff" /> Stop Recording
          </button>
        </div>
      )}

      {audioUrl && !isRecording && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 16px',
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            width: '100%',
            maxWidth: 360,
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
          }}>
            <button
              type="button"
              onClick={togglePlayback}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: 'none',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {isPlaying ? <Pause size={16} fill="#ffffff" /> : <Play size={16} fill="#ffffff" style={{ marginLeft: 2 }} />}
            </button>

            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Volume2 size={14} color="#f59e0b" /> Voice Note Captured
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Ready for submission</div>
            </div>

            <button
              type="button"
              onClick={clearAudio}
              style={{
                border: 'none',
                background: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                padding: 4
              }}
              title="Delete audio note"
            >
              <Trash2 size={16} />
            </button>

            <audio
              ref={audioPlayerRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              style={{ display: 'none' }}
            />
          </div>

          {uploading ? (
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Uploading voice note...</span>
          ) : (
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={13} /> Voice Note Saved
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
