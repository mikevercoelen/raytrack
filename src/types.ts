export enum Format {
  WEBM = 'webm',
  SOCKET = 'socket',
  JPG = 'jpg',
  PNG = 'png'
}

export interface OnUpdateTimeOptions {
  frameCount: number
  intermediateFrameCount: number
  time: string
  secondsRemaining: number
}

export type OnStep = () => void

export interface RaytrackOptions {
  verbose: boolean
  display: boolean
  format: Format
  fps: number
  fileName: string
  quality: number
  timeLimit: number
  frameLimit: number
  startTime: number
  onDone: () => void
  autoSaveTime: number
  motionBlurFrames: number
  onUpdateTime: (onUpdateTimeOptions: OnUpdateTimeOptions) => void
  audio?: HTMLAudioElement
  video?: HTMLVideoElement
}

declare global {
  interface Window {
    gc: () => void
  }
}
