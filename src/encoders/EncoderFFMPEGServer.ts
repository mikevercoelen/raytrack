// import Encoder from './Encoder'
//
// import type { CaptureOptions, OnStep } from '@triptcip/capture'
//
// export default class EncoderFFMPEGServer extends Encoder {
//   constructor (options: CaptureOptions, onStep: OnStep) {
//     super(options, onStep)
//   }
// }

// TODO: make me

// function CCFFMpegServerEncoder( settings ) {
//
//   CCFrameEncoder.call( this, settings );
//
//   settings.quality = ( settings.quality / 100 ) || .8;
//
//   this.encoder = new FFMpegServer.Video( settings );
//   this.encoder.on( 'process', function() {
//     this.emit( 'process' )
//   }.bind( this ) );
//   this.encoder.on('finished', function( url, size ) {
//     var cb = this.callback;
//     if ( cb ) {
//       this.callback = undefined;
//       cb( url, size );
//     }
//   }.bind( this ) );
//   this.encoder.on( 'progress', function( progress ) {
//     if ( this.settings.onProgress ) {
//       this.settings.onProgress( progress )
//     }
//   }.bind( this ) );
//   this.encoder.on( 'error', function( data ) {
//     alert(JSON.stringify(data, null, 2));
//   }.bind( this ) );
//
// }
//
// CCFFMpegServerEncoder.prototype = Object.create( CCFrameEncoder.prototype );
//
// CCFFMpegServerEncoder.prototype.start = function() {
//
//   this.encoder.start( this.settings );
//
// };
//
// CCFFMpegServerEncoder.prototype.add = function( canvas ) {
//
//   this.encoder.add( canvas );
//
// }
//
// CCFFMpegServerEncoder.prototype.save = function( callback ) {
//
//   this.callback = callback;
//   this.encoder.end();
//
// }
//
// CCFFMpegServerEncoder.prototype.safeToProceed = function() {
//   return this.encoder.safeToProceed();
// };
