import download from 'downloadjs'
import WebMWriter from 'webm-writer'

import type { RaytrackOptions, OnStep } from '../types'
import { pad } from '../utils'
import Encoder from './Encoder'

export default class EncoderWebM extends Encoder {
  private readonly quality: number
  private readonly baseFileName: string
  private readonly fps: number
  private frames: number
  private part: number
  private videoWriter: WebMWriter

  constructor (options: RaytrackOptions, onStep: OnStep) {
    super(options, onStep)

    this.quality = options.quality
    this.extension = '.webm'
    this.mimeType = 'video/webm'
    this.baseFileName = this.fileName
    this.fps = options.fps
    this.frames = 0
    this.part = 1

    this.videoWriter = new WebMWriter({
      quality: this.quality,
      fileWriter: null,
      fd: null,
      frameRate: this.fps
    })
  }

  start = () => {
    this.dispose()
  }

  add = (canvas: HTMLCanvasElement) => {
    this.videoWriter.addFrame(canvas)

    const { fps, autoSaveTime } = this.options

    if (autoSaveTime > 0 && (this.frames / fps) >= autoSaveTime) {
      this.save().then(blob => {
        this.fileName = `${this.baseFileName}-part-${pad(this.part)}`
        download(blob, this.fileName + this.extension, this.mimeType)
        this.dispose()
        this.part++
        this.fileName = `${this.baseFileName}-part-${pad(this.part)}`
        this.onStep()
      })
    } else {
      this.frames++
      this.onStep()
    }
  }

  save = async (): Promise<Blob> => {
    return this.videoWriter.complete()
  }

  dispose = () => {
    this.frames = 0
    this.videoWriter = new WebMWriter({
      quality: this.quality,
      fileWriter: null,
      fd: null,
      frameRate: this.fps
    })
  }

  stop = () => {
    // Empty, we might want to double-check this tho.
  }
}
