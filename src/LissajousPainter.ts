import { IAnalyserNode, IAudioContext } from "standardized-audio-context";

const log2LUT = Array.from({ length: 256 }, (_, i) => Math.log2(1 + i / 255.0));
const log2 = (u8: number) => log2LUT[u8];

const log2forTime = (u8: number) => (u8 >= 128 ? log2LUT[(u8 - 128) << 1] : -log2LUT[(128 - u8) << 1]);

// make "pure blue" brighter
const getBrightness = (hue: number) => {
  if (hue <= 200) return 50;
  if (hue <= 240) return 50 + (hue - 200) * (20 / 40);
  if (hue <= 280) return 70;
  if (hue <= 350) return 70 - (hue - 280) * (20 / 70);
  return 50;
};

export class LissajousPainter {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;

  analyserLeft: IAnalyserNode<IAudioContext>;
  bufferLeft: Uint8Array;

  analyserRight: IAnalyserNode<IAudioContext>;
  bufferRight: Uint8Array;

  sampleRate: number;

  constructor(analyserLeft: IAnalyserNode<IAudioContext>, analyserRight: IAnalyserNode<IAudioContext>) {
    this.analyserLeft = analyserLeft;
    this.analyserRight = analyserRight;
    this.fftSize = 1024;
  }

  private _fftSize: number;

  get fftSize() {
    return this._fftSize;
  }

  set fftSize(fftSize: number) {
    if (fftSize === this._fftSize) return;

    const { analyserLeft, analyserRight } = this;
    analyserLeft.fftSize = analyserRight.fftSize = fftSize;
    analyserLeft.smoothingTimeConstant = analyserRight.smoothingTimeConstant = 0.9; // 0 - nothing

    var bufferLength = analyserLeft.frequencyBinCount;
    this._fftSize = fftSize;
    this.sampleRate = analyserLeft.context.sampleRate;

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

  paintMode = "lissajous" as "lissajous" | "wave-shape" | "disc";

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

    const canvasFadeFactor = Math.min(dt / this.fadeInterval, 1);
    ctx.fillStyle = `rgba(0, 0, 0, ${canvasFadeFactor})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.currentHue = (this.currentHue + dt * this.hueSpeed) % 360;
    const hue = Math.round(this.currentHue);
    const colorPrefix = `hsla(${hue}, 100%, ${getBrightness(hue)}%, `;

    ctx.lineWidth = 1 / this.graphSize;
    ctx.translate(this.graphCenterX, this.graphCenterY);
    ctx.scale(this.graphSize, this.graphSize);
    if (this.rotate45Deg) {
      ctx.rotate(-Math.PI / 4);
      ctx.scale(0.7071, 0.7071); // 1 / (2^(0.5))
    }

    // --------------------------
    // draw lissajous
    if (this.paintMode === "lissajous") {
      // if fftSize is large, a sample containing lots of values, will span several seconds.
      // in a frame painting, some values shall be rendered with dimmed colors
      //
      // we separate sample values into several partitions and assign various opacity value
      // the last partition's opacity is 100, and previous one is (100 - opacityDeltaBetweenPartitions) ...
      //
      // partitionLength depends on user-configured fadeInterval

      const opacityDeltaBetweenPartitions = 10;
      const partitionLength = Math.ceil(
        this.sampleRate * (Math.max(this.fadeInterval, 0.1) / (100 / opacityDeltaBetweenPartitions))
      );

      // last sample value is in first partition
      let currentPartitionIndex = 0;
      let currentPartitionPosition = 0;

      for (let i = valuesLength - 1; i >= 0; i--) {
        let xx = valuesLeft[i] / 2;
        let yy = valuesRight[i] / 2;

        if (currentPartitionPosition === 0) {
          const opacity = 100 - currentPartitionIndex * opacityDeltaBetweenPartitions;
          if (opacity <= 0) break;

          ctx.strokeStyle = `${colorPrefix}${opacity}%)`;
          ctx.beginPath();
          ctx.moveTo(xx, yy);
        } else {
          ctx.lineTo(xx, yy);
        }

        if (++currentPartitionPosition >= partitionLength) {
          ctx.stroke();
          i++; // go back to last point, make a extra "moveTo" action
          currentPartitionIndex++;
          currentPartitionPosition = 0;
        }
      }
      ctx.stroke();
    }
    // --------------------------
    // draw wave-shape
    if (this.paintMode === "wave-shape") {
      ctx.strokeStyle = `${colorPrefix}100%)`;

      ctx.beginPath();
      for (let i = 0; i <= valuesLength - 1; i++) {
        let x = i / valuesLength - 0.5;
        let y = -valuesLeft[i] / 4 - 0.25;
        ctx[i === 0 ? "moveTo" : "lineTo"](x, y);
      }
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i <= valuesLength - 1; i++) {
        let x = i / valuesLength - 0.5;
        let y = -valuesRight[i] / 4 + 0.25;
        ctx[i === 0 ? "moveTo" : "lineTo"](x, y);
      }
      ctx.stroke();
    }
    // --------------------------
    // draw disc
    if (this.paintMode === "disc") {
      const diskRadius = 0.25;
      const barMaxLength = 0.25;

      const drawBar = (posPercent: number, value: number) => {
        const rad = Math.PI * 2 * posPercent;
        const sin = -Math.sin(rad); // top is negative
        const cos = -Math.cos(rad); // left is negative

        const barEndPosRadius = diskRadius + value * barMaxLength;

        ctx.moveTo(diskRadius * cos, diskRadius * sin);
        ctx.lineTo(barEndPosRadius * cos, barEndPosRadius * sin);
      };

      ctx.strokeStyle = `${colorPrefix}100%)`;
      ctx.beginPath();
      for (let i = 0; i <= valuesLength - 1; i++) {
        drawBar(i / (valuesLength - 1) / 2, valuesLeft[i]);
        drawBar(1 - i / (valuesLength - 1) / 2, valuesRight[i]);
      }
      ctx.stroke();
    }
    // --------------------------

    ctx.resetTransform();
  };
}
