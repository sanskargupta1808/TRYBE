import { useState, useRef } from "react";

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      setDuration(0);
      setBlob(null);

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        setBlob(audioBlob);
        streamRef.current?.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mr.start(250);
      setIsRecording(true);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      return true;
    } catch {
      return false;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setBlob(null);
      setDuration(0);
    }
  };

  const clearBlob = () => {
    setBlob(null);
    setDuration(0);
  };

  return { isRecording, duration, blob, startRecording, stopRecording, cancelRecording, clearBlob };
}
