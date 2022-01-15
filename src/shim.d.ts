declare module "*?url" {
  const url: string;
  export default url;
}

declare interface Window {
  audio: HTMLAudioElement;
}

declare interface ImportMeta {
  env: { PROD: boolean; DEV: boolean };
}

declare module "lodash-es/pick" {
  export default function pick<T, K extends (keyof T)[]>(obj: T, keys: K): Pick<T, K[number]>;
}
