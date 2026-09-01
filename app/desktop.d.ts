export {};

declare global {
  interface Window {
    schwankDesktop?: {
      isDesktop: true;
      platform: 'darwin' | 'linux' | 'win32';
      notify: (
        title: string,
        body: string,
        target?: string,
      ) => Promise<boolean>;
      onNotificationClick: (callback: (target: string) => void) => () => void;
      openSettings: () => Promise<boolean>;
    };
  }
}
