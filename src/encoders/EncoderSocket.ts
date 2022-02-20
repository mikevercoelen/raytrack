import Encoder from './Encoder'
import { RaytrackOptions, OnStep } from '../types'

export default class EncoderSocket extends Encoder {
  private ws: WebSocket

  constructor (options: RaytrackOptions, onStep: OnStep) {
    super(options, onStep)

    this.extension = '.png'
    this.mimeType = 'image/png'
    this.ws = new WebSocket('ws://localhost:8999/')
  }

  // TODO: convert to promises
  public add = (canvas: HTMLCanvasElement) => {
    canvas.toBlob((blob: Blob | null) => {
      if (blob === null) {
        throw new Error('Could not call canvas.toBlob')
      }

      let fileReader: (FileReader | undefined) = new FileReader()

      fileReader.addEventListener('load', () => {
        const frame = new Uint8Array(fileReader!.result as ArrayBuffer)
        this.ws.send(frame)

        // TODO: double test me
        // Force GC
        fileReader = undefined
        // @ts-ignore
        blob = undefined

        this.onStep()
      })

      fileReader.readAsArrayBuffer(blob)
    })
  }

  public save = async (): Promise<void> => {
    this.ws.close()
  }

  start(): void {}
  stop(): void {}
  dispose(): void {}
}
