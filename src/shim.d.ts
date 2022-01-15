declare module "*?url" {
  const url: string;
  export default url;
}

declare interface Window {
  currentSoundURL: string;
  audio: HTMLAudioElement;
}
