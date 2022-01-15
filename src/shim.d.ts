declare module "*?url" {
  const url: string;
  export default url;
}

declare interface Window {
  currentSoundURL: string;
  audio: HTMLAudioElement;
}

declare module "lodash-es/pick" {
  export default function pick<T, K extends (keyof T)[]>(obj: T, keys: K): Pick<T, K[number]>;
}
