import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

@Component({
  selector: 'app-root',
  template: '<ion-app><ion-router-outlet></ion-router-outlet></ion-app>',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private readonly platform = inject(Platform);

  constructor() {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // The app is a single page, so there is never anywhere to navigate back to.
    // Without an explicit handler Android's back button silently does nothing
    // and the app feels stuck — it should just close, which is what users
    // expect from a one-screen app.
    //
    // Priority -1 runs last, so Ionic's own handlers still get first refusal:
    // an open toast or alert consumes the press and closes itself instead of
    // quitting the app.
    this.platform.backButton.subscribeWithPriority(-1, () => {
      App.exitApp();
    });

    // Targeting API 36 means Android 16 forces edge-to-edge, so the gold header
    // already paints behind the status bar (it pads by safe-area-inset-top).
    // All that is left is the icon colour: Style.Dark means light icons, which
    // is what reads on the gold. Setting a status bar background is pointless
    // under edge-to-edge, so we don't.
    StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
  }
}
