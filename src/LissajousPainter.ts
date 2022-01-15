import { IAnalyserNode, IAudioContext } from "standardized-audio-context";

const log2LUT = Array.from({ length: 256 }, (_, i) => Math.log2(1 + i / 255.0));
const log2 = (u8: number) => log2LUT[u8];

const log2forTime = (u8: number) => (u8 >= 128 ? log2LUT[(u8 - 128) << 1] : -log2LUT[(128 - u8) << 1]);

export class LissajousPainter {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;

  analyserLeft: IAnalyserNode<IAudioContext>;
  bufferLeft: Uint8Array;

  analyserRight: IAnalyserNode<IAudioContext>;
  bufferRight: Uint8Array;

  constructor(analyserLeft: IAnalyserNode<IAudioContext>, analyserRight: IAnalyserNode<IAudioContext>) {
    this.analyserLeft = analyserLeft;
    this.analyserRight = analyserRight;
    this.setFFTSize(1024);
  }

  fftSize = 1024;
  setFFTSize(fftSize: number): void {
    const { analyserLeft, analyserRight } = this;
    analyserLeft.fftSize = analyserRight.fftSize = fftSize;
    analyserLeft.smoothingTimeConstant = analyserRight.smoothingTimeConstant = 0.9; // 0 - nothing

    var bufferLength = analyserLeft.frequencyBinCount;
    this.fftSize = fftSize;

    this.bufferLeft = new Uint8Array(bufferLength);
    this.bufferRight = new Uint8Array(bufferLength);
  }

  initCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;

    this.graphSize = Math.min(this.width, this.height);
    this.graphCenterX = this.width / 2;
    this.graphCenterY = this.height / 2;
  }

  lastDrawAt = 0;
  currentHue = 0;
  graphSize = 0;
  graphCenterX = 0;
  graphCenterY = 0;

  fadeInterval = 0.2; // in seconds
  hueSpeed = 40; // 10 deg per second

  rotate45Deg = true;
  sampleSource = "wave" as "wave" | "fft";
  enableLog2 = true;
  gain = 1;

  /** read data and return the processed vales (range -1 ~ +1) */
  prepareData(analyser: IAnalyserNode<IAudioContext>, buffer: Uint8Array): number[] {
    if (this.sampleSource === "wave") {
      analyser.getByteTimeDomainData(buffer);
      return Array.from(buffer, this.enableLog2 ? log2forTime : (val) => (val - 128) / 128.0);
    }

    analyser.getByteFrequencyData(buffer);
    return Array.from(buffer, this.enableLog2 ? (x) => x / 128 - 1 : (x) => log2(x) * 2 - 1);
  }

  drawFrame = () => {
    const now = Date.now();
    const dt = (now - this.lastDrawAt) / 1e3;
    this.lastDrawAt = now;
    requestAnimationFrame(this.drawFrame);

    const { ctx, canvas } = this;

    let valuesLeft = this.prepareData(this.analyserLeft, this.bufferLeft);
    let valuesRight = this.prepareData(this.analyserRight, this.bufferRight);
    let valuesLength = valuesLeft.length;

    if (this.gain !== 1) {
      valuesLeft = valuesLeft.map((x) => x * this.gain);
      valuesRight = valuesRight.map((x) => x * this.gain);
    }

    const fadeFactor = Math.min(dt / this.fadeInterval, 1);
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeFactor})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 1;

    this.currentHue = (this.currentHue + dt * this.hueSpeed) % 360;
    const hue = Math.round(this.currentHue);
    const size = this.rotate45Deg ? this.graphSize / 1.414 : this.graphSize;

    ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.translate(this.graphCenterX, this.graphCenterY);
    if (this.rotate45Deg) ctx.rotate(-45);
    ctx.beginPath();
    for (let i = 0; i < valuesLength; i++) {
      let xx = (valuesLeft[i] / 2) * size;
      let yy = (valuesRight[i] / 2) * size;

      const api = i == 0 ? "moveTo" : "lineTo";

      ctx[api](xx, yy);
    }
    ctx.stroke();
    ctx.resetTransform();

    for (const [buffer, color] of [] ||
      ([
        [valuesLeft, "#f00"],
        [valuesRight, "#00f"],
      ] as const)) {
      ctx.strokeStyle = color;
      ctx.beginPath();

      var sliceWidth = (canvas.width * 1.0) / valuesLength;
      var x = 0;

      for (var i = 0; i < valuesLength; i++) {
        var y = ((2 - buffer[i]) / 2) * canvas.height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      // ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }
  };
}
