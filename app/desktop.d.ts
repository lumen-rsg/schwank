export {};

declare global {
  interface Window {
    schwankDesktop?: {
      isDesktop: true;
      platform: 'darwin' | 'linux' | 'win32';
      notify: (title: string, body: string) => Promise<boolean>;
      openSettings: () => Promise<boolean>;
    };
  }
}
