// @ts-strict

import download from 'downloadjs'
import { nanoid } from 'nanoid'

import EncoderSocket from './encoders/EncoderSocket'
import EncoderWebM from './encoders/EncoderWebM'
import type { RaytrackOptions } from './types'
import { Format } from './types'
import { generateId, getArrAverage } from './utils'

// TODO: this does not make sense to me, originally this is called g_startTime
//  in my eyes, this looks buggy, because the start time is used to process requestAnimationFrames
//  see the function Capture.process
const GLOBAL_START_TIME = window.Date.now()

const defaultOptions: RaytrackOptions = {
  motionBlurFrames: 1,
  autoSaveTime: 0,
  onDone (): void {},
  onUpdateTime (): void {},
  display: false,
  frameLimit: 0,
  startTime: 0,
  timeLimit: 0,
  verbose: false,
  format: Format.WEBM,
  fps: 60,
  quality: 100,
  fileName: nanoid()
}

interface TimeoutOrInterval {
  id: number
  callback: TimerHandler
  time: number
  triggerTime: number
}

type MediaElement = HTMLAudioElement | HTMLVideoElement

type Encoder = EncoderWebM | EncoderSocket

export default class Raytrack {
  private readonly options: RaytrackOptions
  private startTime: number
  private time?: number
  private performanceTime?: number
  private performanceStartTime?: number
  private readonly encoder: Encoder
  private timeouts: TimeoutOrInterval[] = []
  private intervals: TimeoutOrInterval[] = []
  private frameCount: number = 0
  private intermediateFrameCount: number = 0
  private requestAnimationFrameCallbacks: FrameRequestCallback[] = []
  private capturing: boolean = false
  private readonly fps: number
  private readonly verbose: boolean
  private readonly timeLimit: number
  private frameLimit: number
  private media: MediaElement[] = []

  // TODO: this is an ever growing array, we should clear it or cap it
  private averageFrameRecordings: number[] = []
  private beforeFrameTime?: number

  // Motion blur setup
  private readonly motionBlurFrames: number
  private readonly canvasMotionBlur: HTMLCanvasElement
  private ctxMotionBlur: CanvasRenderingContext2D
  private bufferMotionBlur?: Uint16Array
  private imageData?: ImageData

  // The magic
  private oldSetTimeout = window.setTimeout
  private oldSetInterval = window.setInterval
  private oldClearInterval = window.clearInterval
  private oldClearTimeout = window.clearTimeout
  private oldRequestAnimationFrame = window.requestAnimationFrame
  private oldNow = window.Date.now
  private oldPerformanceNow = window.performance.now
  private oldGetTime = window.Date.prototype.getTime
  private oldCurrentTimeGet = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')?.get
  private oldCurrentTimeSet = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')?.set

  constructor (options: Partial<RaytrackOptions> = {}) {
    this.options = {
      ...defaultOptions,
      ...options
    }

    this.fps = this.options.fps
    this.verbose = this.options.verbose || false
    this.timeLimit = this.options.timeLimit
    this.frameLimit = this.options.frameLimit
    this.startTime = this.options.startTime
    this.motionBlurFrames = 2 * this.options.motionBlurFrames

    if (this.options.format === Format.WEBM) {
      this.encoder = new EncoderWebM(this.options, this.handleStep)
    } else if (this.options.format === Format.SOCKET) {
      this.encoder = new EncoderSocket(this.options, this.handleStep)
    } else {
      throw new Error('No supported encoder was initialized')
    }

    this.canvasMotionBlur = document.createElement('canvas')
    const ctxMotionBlur = this.canvasMotionBlur.getContext('2d')

    if (!ctxMotionBlur) {
      throw new Error('Could not initialize motion blur canvas')
    }

    this.ctxMotionBlur = ctxMotionBlur
  }

  private initialize = () => {
    this.log('Initialize')

    this.startTime = window.Date.now()
    this.time = this.startTime + this.options.startTime
    this.performanceStartTime = window.performance.now()
    this.performanceTime = this.performanceStartTime + this.options.startTime

    // @ts-ignore
    window.Date.prototype.getTime = () => {
      return this.time
    }

    // @ts-ignore
    window.Date.now = () => {
      return this.time
    }

    // TODO: fix typings
    // @ts-ignore
    window.setTimeout = (callback, time?: number = 0): number => {
      const t: TimeoutOrInterval = {
        id: generateId(),
        callback,
        time,
        triggerTime: this.time! + time
      }

      this.timeouts.push(t)
      this.log(`Timeout set to ${t.time}`)
      return t.id
    }

    // @ts-ignore
    window.clearTimeout = (id: number) => {
      for (let i = 0; i < this.timeouts.length; i++) {
        if (this.timeouts[i].id === id) {
          this.timeouts.splice(i, 1)
          this.log('Timeout cleared')
        }
      }
    }

    // TODO: fix typings
    // @ts-ignore
    window.setInterval = (callback, time?: number = 0) => {
      const t: TimeoutOrInterval = {
        id: generateId(),
        callback,
        time,
        triggerTime: this.time! + time
      }

      this.intervals.push(t)
      this.log(`Interval set to ${t.time}`)
      return t
    }

    // @ts-ignore
    window.clearInterval = (id: number) => {
      for (let i = 0; i < this.intervals.length; i++) {
        if (this.intervals[i].id === id) {
          this.intervals.splice(i, 1)
          this.log('Interval cleared')
        }
      }
    }

    // TODO: fix typings
    // @ts-ignore
    window.requestAnimationFrame = (callback) => {
      this.requestAnimationFrameCallbacks.push(callback)
    }

    window.performance.now = () => {
      return this.performanceTime as number
    }

    // const self = this
    //
    // Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    //   configurable: true,
    //   enumerable: true,
    //   get: function () {
    //     if (!this._hooked) {
    //       this._hooked = true
    //       this._hookedTime = this.currentTime || 0
    //       this.pause()
    //       self.media.push(this)
    //     }
    //
    //     return this._hookedTime + self.startTime
    //
    //     // return Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')?.get?.call(this)
    //   },
    //   set: function (currentTime: number) {
    //     return self.oldCurrentTimeSet?.call(this, currentTime)
    //   }
    // })
  }

  private checkFrame = (canvas: HTMLCanvasElement) => {
    if (this.canvasMotionBlur.width !== canvas.width || this.canvasMotionBlur.height !== canvas.height) {
      this.canvasMotionBlur.width = canvas.width
      this.canvasMotionBlur.height = canvas.height
      this.bufferMotionBlur = new Uint16Array(this.canvasMotionBlur.height * this.canvasMotionBlur.width * 4)
      this.ctxMotionBlur.fillStyle = '#0'
      this.ctxMotionBlur.fillRect(0, 0, this.canvasMotionBlur.width, this.canvasMotionBlur.height)
    }
  }

  private blendFrame = (canvas: HTMLCanvasElement) => {
    this.ctxMotionBlur.drawImage(canvas, 0, 0)
    this.imageData = this.ctxMotionBlur.getImageData(0, 0, this.canvasMotionBlur.width, this.canvasMotionBlur.height)

    for (let i = 0; i < this.bufferMotionBlur!.length; i += 4) {
      this.bufferMotionBlur![i] += this.imageData.data[i]
      this.bufferMotionBlur![i + 1] += this.imageData.data[i + 1]
      this.bufferMotionBlur![i + 2] += this.imageData.data[i + 2]
    }

    this.intermediateFrameCount++
  }

  private saveFrame = () => {
    const data = this.imageData!.data

    for( let i = 0; i < this.bufferMotionBlur!.length; i+= 4 ) {
      data[i] = this.bufferMotionBlur![i] * 2 / this.motionBlurFrames
      data[i + 1] = this.bufferMotionBlur![i + 1] * 2 / this.motionBlurFrames
      data[i + 2] = this.bufferMotionBlur![i + 2] * 2 / this.motionBlurFrames
    }

    this.ctxMotionBlur.putImageData(this.imageData!, 0, 0)
    this.encoder.add(this.canvasMotionBlur)
    this.frameCount++
    this.intermediateFrameCount = 0
    this.log(`Motion blur frame: ${this.frameCount} ${this.time}`)

    for( let i = 0; i < this.bufferMotionBlur!.length; i+= 4 ) {
      this.bufferMotionBlur![i] = 0
      this.bufferMotionBlur![i + 1] = 0
      this.bufferMotionBlur![i + 2] = 0
    }

    if (typeof window?.gc === 'function') {
      window.gc()
    }
  }

  public start = () => {
    this.initialize()
    this.encoder.start()
    this.capturing = true
  }

  public stop = () => {
    this.capturing = false
    this.encoder.stop()
    this.destroy()
  }

  private destroy = () => {
    this.log('Destroy')
    window.setTimeout = this.oldSetTimeout
    window.clearTimeout = this.oldClearTimeout
    window.setInterval = this.oldSetInterval
    window.clearInterval = this.oldClearInterval
    window.requestAnimationFrame = this.oldRequestAnimationFrame
    window.Date.prototype.getTime = this.oldGetTime
    window.Date.now = this.oldNow
    window.performance.now = this.oldPerformanceNow
  }

  private call = (fn: TimerHandler, p?: any) => {
    // @ts-ignore
    this.oldSetTimeout.call(window, fn, 0, p)
  }

  private handleStep = () => {
    this.call(this.process)
  }

  private process = async () => {
    const step = 1000 / this.fps
    const dt = (this.frameCount + this.intermediateFrameCount / this.motionBlurFrames) * step

    this.time = this.startTime + dt
    this.performanceTime = this.performanceStartTime! + dt

    for (let i = 0; i < this.media.length; i++) {
      const m = this.media[i]
      m.currentTime = dt / 1000
    }

    this.updateTime()
    this.log(`Frame: ${this.frameCount} ${this.intermediateFrameCount}`)

    for (let i = 0; i < this.timeouts.length; i++) {
      const t = this.timeouts[i]

      if (this.time! >= t.triggerTime) {
        this.call(t.callback)
        this.timeouts.splice(i, 1)
      }
    }

    for (let i = 0; i < this.intervals.length; i++) {
      const t = this.intervals[i]

      if (this.time! >= t.triggerTime) {
        this.call(t.callback)
        t.triggerTime += t.time
      }
    }

    for (let i = 0; i < this.requestAnimationFrameCallbacks.length; i++) {
      const t = this.requestAnimationFrameCallbacks[i]

      // TODO: this is strange to me, why are we using a global start time here?
      this.call(t, this.time - GLOBAL_START_TIME)
    }

    this.requestAnimationFrameCallbacks = []

    const n1 = this.oldPerformanceNow.call(window.performance)
    this.averageFrameRecordings.push(n1 - this.beforeFrameTime!)
  }

  private updateTime = () => {
    const seconds = this.frameCount / this.fps

    const {
      frameLimit,
      timeLimit,
      onDone,
      onUpdateTime
    } = this.options

    if (
      (frameLimit && this.frameCount >= frameLimit) ||
      (timeLimit && seconds >= timeLimit)
    ) {
      this.stop()
      this.save()

      if (typeof onDone === 'function') {
        onDone()
      }
    }

    // @ts-ignore
    const d = new Date(null)
    d.setSeconds(seconds)

    if (typeof onUpdateTime === 'function') {
      const { frameCount, intermediateFrameCount } = this

      const remainingFrameCount = (this.timeLimit * this.fps) - this.frameCount
      const avgMsPerFrame = getArrAverage(this.averageFrameRecordings)
      const msRemaining = remainingFrameCount * avgMsPerFrame
      const secondsRemaining = msRemaining / 1000

      onUpdateTime({
        frameCount,
        intermediateFrameCount,
        time: d.toISOString().substr(11, 8),
        secondsRemaining
      })
    }
  }

  public capture = (canvas: HTMLCanvasElement, mediaElements: MediaElement[]) => {
    if (!this.capturing) {
      return
    }

    this.beforeFrameTime = this.oldPerformanceNow.call(window.performance)

    if (this.motionBlurFrames > 2) {
      this.checkFrame(canvas)
      this.blendFrame(canvas)

      if (this.intermediateFrameCount >= .5 * this.motionBlurFrames) {
        this.saveFrame()
      } else {
        this.handleStep()
      }
    } else {
      this.media = mediaElements

      // TODO: video elements are still fucked up
      this.media.forEach(m => {
        if (m instanceof HTMLVideoElement && !m.paused) {
          m.pause()
        }
      })

      this.encoder.add(canvas)
      this.frameCount++
      this.log(`Full frame: ${this.frameCount}`)
    }
  }

  public save = async (): Promise<Blob | void> => {
    const blob = await this.encoder.save()

    if (!(blob instanceof Blob)) {
      return
    }

    const { fileName, extension, mimeType } = this.encoder
    download(blob, `${fileName}${extension}`, mimeType)

    return blob
  }

  private log = (message: string) => {
    if (!this.verbose) {
      return
    }

    // eslint-disable-next-line no-console
    console.log(`Capture: ${message}`)
  }
}
