import { nanoid } from 'nanoid'

import type { RaytrackOptions, OnStep } from '../types'

export default abstract class Encoder {
  public fileName: string
  public extension: string
  public mimeType: string

  protected constructor (protected options: RaytrackOptions, protected onStep: OnStep) {
    this.fileName = options?.fileName || nanoid()
    this.extension = ''
    this.mimeType = ''
  }

  abstract start(): void
  abstract add(canvas: HTMLCanvasElement): void
  abstract stop(): void
  abstract save(): Promise<Blob | void>
  abstract dispose(): void
  // abstract safeToProceed(): void
  // abstract step(): void
}
