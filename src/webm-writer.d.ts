interface WebMWriterOptions {
  quality: number
  fileWriter: any
  fd: any
  frameRate: number
}

declare module 'webm-writer' {
  class WebMWriter {
    constructor (options: WebMWriterOptions)
    addFrame: (canvas: HTMLCanvasElement) => void
    complete: () => Promise<Blob>
  }

  export = WebMWriter
}
