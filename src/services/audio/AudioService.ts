"use client";

type PlaybackSpeed = 0.75 | 1 | 1.25;

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  url: string;
}

/**
 * Central audio infrastructure for Reading, Vocabulary, Speaking, Listening, Role Play.
 */
export class AudioService {
  private utterance: SpeechSynthesisUtterance | null = null;
  private speed: PlaybackSpeed = 1;
  private lastText = "";
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  private startedAt = 0;
  private recordingState: RecordingState = "idle";
  private playbackAudio: HTMLAudioElement | null = null;

  setSpeed(speed: PlaybackSpeed) {
    this.speed = speed;
    if (this.playbackAudio) this.playbackAudio.playbackRate = speed;
  }

  getSpeed() {
    return this.speed;
  }

  getRecordingState() {
    return this.recordingState;
  }

  speak(text: string, lang = "en-GB") {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    this.stop();
    this.lastText = text;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = this.speed;
    this.utterance = u;
    window.speechSynthesis.speak(u);
  }

  pause() {
    if (typeof window === "undefined") return;
    window.speechSynthesis.pause();
    this.playbackAudio?.pause();
  }

  resume() {
    if (typeof window === "undefined") return;
    window.speechSynthesis.resume();
    void this.playbackAudio?.play();
  }

  stop() {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    this.utterance = null;
    if (this.playbackAudio) {
      this.playbackAudio.pause();
      this.playbackAudio.currentTime = 0;
    }
  }

  repeat() {
    if (this.lastText) this.speak(this.lastText);
  }

  async playBlob(blob: Blob) {
    this.stop();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.playbackRate = this.speed;
    this.playbackAudio = audio;
    await audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
  }

  async playUrl(url: string) {
    this.stop();
    const audio = new Audio(url);
    audio.playbackRate = this.speed;
    this.playbackAudio = audio;
    await audio.play();
  }

  private pickMimeType() {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg",
    ];
    for (const type of candidates) {
      if (
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported(type)
      ) {
        return type;
      }
    }
    return "audio/webm";
  }

  async startRecording(): Promise<void> {
    if (typeof window === "undefined") {
      throw new Error("Recording is only available in the browser / native app");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone not supported on this device");
    }
    if (this.recordingState === "recording") return;

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const mimeType = this.pickMimeType();
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.startedAt = Date.now();
    this.mediaRecorder.start(200);
    this.recordingState = "recording";
  }

  async stopRecording(): Promise<RecordingResult> {
    if (!this.mediaRecorder) {
      throw new Error("No active recording");
    }

    const recorder = this.mediaRecorder;
    const mimeType = recorder.mimeType || this.pickMimeType();

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Recording failed"));
      recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: mimeType }));
      };
      if (recorder.state !== "inactive") recorder.stop();
      else resolve(new Blob(this.chunks, { type: mimeType }));
    });

    this.cleanupStream();
    this.recordingState = "stopped";
    const durationMs = Math.max(300, Date.now() - this.startedAt);
    const url = URL.createObjectURL(blob);

    return { blob, mimeType, durationMs, url };
  }

  cancelRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.cleanupStream();
    this.chunks = [];
    this.recordingState = "idle";
  }

  private cleanupStream() {
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.mediaRecorder = null;
  }

  /**
   * Optional browser speech recognition (fallback when Whisper is unavailable).
   */
  listenOnce(lang = "en-GB", timeoutMs = 8000): Promise<string> {
    return new Promise((resolve, reject) => {
      const SpeechRecognition =
        typeof window !== "undefined"
          ? (
              window as unknown as {
                SpeechRecognition?: new () => SpeechRecognition;
                webkitSpeechRecognition?: new () => SpeechRecognition;
              }
            ).SpeechRecognition ||
            (
              window as unknown as {
                webkitSpeechRecognition?: new () => SpeechRecognition;
              }
            ).webkitSpeechRecognition
          : undefined;

      if (!SpeechRecognition) {
        reject(new Error("Speech recognition not supported"));
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      const timer = setTimeout(() => {
        recognition.stop();
        reject(new Error("Speech recognition timeout"));
      }, timeoutMs);

      recognition.onresult = (event) => {
        clearTimeout(timer);
        const text = event.results[0]?.[0]?.transcript || "";
        resolve(text);
      };
      recognition.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Speech recognition failed"));
      };
      recognition.start();
    });
  }
}

interface SpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
}

let singleton: AudioService | null = null;

export function getAudioService() {
  if (!singleton) singleton = new AudioService();
  return singleton;
}
