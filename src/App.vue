<template>
  <div>
    <label>
      <div
        tabindex="0"
        role="button"
        class="selectMusic"
      >
        <div v-if="file">{{ file.name }}</div>
        <div v-else>Select Music File</div>
      </div>

      <input
        type="file"
        @change="handleFileSelect"
        accept="audio/*"
        style="display: none"
      >
    </label>

    <div class="options">
      <label><input
          type="checkbox"
          v-model="painter.rotate45Deg"
        >Rotate Figure 45°</label>

      <label>color shifting <input
          type="number"
          min="0"
          max="100"
          v-model.number.lazy="painter.hueSpeed"
        >deg/sec</label>

      <label>frame persist <input
          type="number"
          min="0"
          max="5"
          step="0.05"
          v-model.number.lazy="painter.fadeInterval"
        >sec</label>

      <label><select
          @change="e => painter.setFFTSize(+e.target.value)"
          :value="String(painter.fftSize)"
        >
          <option>128</option>
          <option>256</option>
          <option>512</option>
          <option>1024</option>
          <option>2048</option>
          <option>4096</option>
          <option>8192</option>
        </select>
        samples per frame
      </label>

      <label>sample from <select v-model="painter.sampleSource">
          <option>wave</option>
          <option value="fft">fft (just for fun)</option>
        </select>
      </label>

      <div>
        <label>
          y =
          <input
            type="checkbox"
            v-model="painter.enableLog2"
            @change="$forceUpdate"
          >
          <span v-if="painter.enableLog2">log<sub>2</sub>(1 + x)</span>
          <span v-else>x</span>
        </label>

        *

        <label>gain <input
            type="number"
            min="0"
            max="5"
            step="0.2"
            v-model.number.lazy="painter.gain"
          ></label>
      </div>

    </div>

    <canvas
      ref="canvas"
      width="800"
      height="800"
    />
  </div>

</template>

<script lang="ts">
import { defineComponent, onMounted, onUnmounted, ref } from 'vue'
import { AudioContext } from "standardized-audio-context";
import { LissajousPainter } from './LissajousPainter'

declare var currentSoundURL: string;

export default defineComponent({
  name: 'App',
  setup() {
    const file = ref<File | null>(null)
    const canvas = ref<HTMLCanvasElement>()

    const handleFileSelect = (ev: InputEvent) => {
      const target = ev.target as HTMLInputElement
      const f = target.files[0]
      file.value = f
      target.value = ""

      if (currentSoundURL) {
        try { URL.revokeObjectURL(currentSoundURL) } catch { }
        currentSoundURL = ''
      }

      if (f) {
        currentSoundURL = URL.createObjectURL(f)
        audio.src = currentSoundURL
        audio.load()

        if (ctx.state === 'suspended') ctx.resume()
        audio.play()
      }
    }

    const ctx = new AudioContext()
    const audio = document.createElement('audio')
    const source = ctx.createMediaElementSource(audio)
    const destination = ctx.destination

    onUnmounted(() => {
      audio.pause()
      ctx.close()
    })

    source.connect(destination)

    const splitter = ctx.createChannelSplitter(2)
    const analysisLeft = ctx.createAnalyser()
    const analysisRight = ctx.createAnalyser()
    source.connect(splitter)
    splitter.connect(analysisLeft, 0)
    splitter.connect(analysisRight, 1)

    window.audio = audio

    // for debug only
    const autoPlay = () => {
      if (!currentSoundURL) return Promise.resolve(false)

      audio.src = currentSoundURL
      audio.load()
      audio.play();
      return ctx.resume()
        .then(() => audio.play())
        .then(() => true)
        .catch((err) => {
          // failed to auto start
          console.error('Cannot auto start: ', err);
          return false
        });
    };
    autoPlay()

    const painter = new LissajousPainter(analysisLeft, analysisRight,)
    onMounted(() => {
      painter.initCanvas(canvas.value)
      painter.drawFrame()
    })

    return {
      file,
      handleFileSelect,
      canvas,
      painter,
    }
  }
})
</script>

<style lang="scss">
html,
body {
  background: #000;
  color: #fff;
  margin: 0;
}

.selectMusic {
  padding: 16px 24px;
  background-color: #69f;
  cursor: pointer;
  border-radius: 16px;
  border: 2px solid #333;
  color: #fff;
  font-size: 16px;
  text-align: center;
  margin: 12px auto;
  width: 400px;
  max-width: calc(100vw - 100px);
}

.options {
  display: grid;
  grid-template-columns: repeat(auto-fit, 250px);
  justify-content: center;

  > * {
    padding: 6px;
  }
}

canvas {
  display: block;
  margin: auto;
  max-width: 100vw;
}
</style>