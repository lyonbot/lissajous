<template>
  <div>
    <div
      tabindex="0"
      role="button"
      class="selectMusic"
    >
      <div>{{ sysInfo.fileName }}</div>

      <input
        type="file"
        @change="handleFileSelect"
        accept="audio/*"
        class="actualFileInput"
      >
    </div>

    <div class="loadSampleMusicLine">
      <a
        href="#"
        @click.prevent="loadSampleMusic"
      >🎺 Load Sample Music</a>
    </div>

    <div class="options">
      <label><input
          type="checkbox"
          v-model="options.rotate45Deg"
        >Rotate Image 45°</label>

      <label>color shifting <input
          type="number"
          min="0"
          max="100"
          v-model.number.lazy="options.hueSpeed"
        >deg/sec</label>

      <label>frame persist <input
          type="number"
          min="0"
          max="5"
          step="0.05"
          v-model.number.lazy="options.fadeInterval"
        >sec</label>

      <label><select
          @change="e => (options.fftSize=+e.target.value)"
          :value="String(options.fftSize)"
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

      <label>sample from <select v-model="options.sampleSource">
          <option>wave</option>
          <option value="fft">fft (just for fun)</option>
        </select>
      </label>

      <div>
        <label>
          y =
          <input
            type="checkbox"
            v-model="options.enableLog2"
          >
          <span v-if="options.enableLog2">log<sub>2</sub>(1 + x)</span>
          <span v-else>x</span>
        </label>

        *

        <label>gain <input
            type="number"
            min="0"
            max="5"
            step="0.2"
            v-model.number.lazy="options.gain"
          ></label>
      </div>

      <label>paintMode <select v-model="options.paintMode">
          <option>lissajous</option>
          <option>wave-shape</option>
          <option>disc</option>
        </select>
      </label>

      <label> sampleRate: {{sysInfo.sampleRate}}</label>

    </div>

    <canvas
      ref="canvas"
      width="800"
      height="800"
    />
  </div>

</template>

<script lang="ts">
import { defineComponent, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { AudioContext } from "standardized-audio-context";
import { LissajousPainter } from './LissajousPainter'
import pick from 'lodash-es/pick'
import DemoMusic from './FluffingADuck.mp3?url'

export default defineComponent({
  name: 'App',
  setup() {
    const canvas = ref<HTMLCanvasElement>()
    const sysInfo = reactive({
      sampleRate: 0,
      fileName: 'Click to Open a Music',
      fileUrl: '',
    })

    const handleFileSelect = (ev: InputEvent) => {
      const target = ev.target as HTMLInputElement
      const file = target.files[0]
      target.value = ""

      if (file) startPlay(URL.createObjectURL(file), file.name)
      else startPlay('', '')
    }

    const loadSampleMusic = () => {
      startPlay(DemoMusic, 'Kevin MacLeod: Fluffing a Duck.mp3')
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
    audio.addEventListener('play', () => {
      sysInfo.sampleRate = ctx.sampleRate
    }, false)

    const startPlay = (url: string, fileName: string) => {
      try { URL.revokeObjectURL(sysInfo.fileUrl); } catch { }

      if (!url) {
        sysInfo.fileUrl = '';
        sysInfo.fileName = 'Click to Open a Music'
        return Promise.resolve(false)
      }

      sysInfo.fileUrl = url;
      sysInfo.fileName = fileName

      // for debug only
      if (import.meta.env.DEV) {
        window.sessionStorage?.setItem('lastMusicURL', url)
      }

      audio.src = url
      audio.load()
      return ctx.resume()
        .then(() => audio.play())
        .then(() => {
          return true
        })
        .catch((err) => {
          // failed to auto start
          console.error('Cannot auto start: ', err)
          return false
        });
    };

    // for debug only
    if (import.meta.env.DEV) {
      startPlay(window.sessionStorage?.getItem('lastMusicURL'), '[[ lastMusic ]]')
    }

    const painter = new LissajousPainter(analysisLeft, analysisRight,)
    onMounted(() => {
      painter.initCanvas(canvas.value)
      painter.drawFrame()
    })

    const options = reactive(pick(painter, [
      'rotate45Deg',
      'hueSpeed',
      'fadeInterval',
      'fftSize',
      'sampleSource',
      'enableLog2',
      'gain',
      'paintMode'
    ]))

    watch(options, (o) => {
      Object.assign(painter, o)
      history.replaceState({ ...o }, '', `#${encodeURIComponent(JSON.stringify(o))}`)
    }, { deep: true })

    try {
      // load config from url
      Object.assign(options, JSON.parse(decodeURIComponent(location.hash.slice(1))))
    } catch { }

    return {
      loadSampleMusic,
      handleFileSelect,
      canvas,
      painter,
      options,
      sysInfo,
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
  position: relative;

  .actualFileInput {
    appearance: none;
    -webkit-appearance: none;
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    opacity: 0.01;
    cursor: pointer;
  }
}

.loadSampleMusicLine {
  margin: 12px auto;
  text-align: center;
  a {
    color: #def;
  }
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