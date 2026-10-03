import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  template: '<ion-app><ion-router-outlet></ion-router-outlet></ion-app>',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private readonly platform = inject(Platform);

  constructor() {
    // The app is a single page, so there is never anywhere to navigate back to.
    // Without an explicit handler Android's back button silently does nothing
    // and the app feels stuck — it should just close, which is what users
    // expect from a one-screen app.
    //
    // Priority -1 runs last, so Ionic's own handlers still get first refusal:
    // an open toast or alert consumes the press and closes itself instead of
    // quitting the app.
    if (Capacitor.isNativePlatform()) {
      this.platform.backButton.subscribeWithPriority(-1, () => {
        App.exitApp();
      });
    }
  }
}
