import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { ApplicationRef, isDevMode, inject, provideAppInitializer } from '@angular/core';
import { provideServiceWorker, SwUpdate } from '@angular/service-worker';
import { first } from 'rxjs/operators';

/**
 * Without this the service worker keeps serving the cached build until every
 * tab is closed, so a fresh deploy looks like "nothing changed". Once the app
 * is stable, take the new version and reload onto it.
 */
function applyServiceWorkerUpdates() {
  const updates = inject(SwUpdate);
  const appRef = inject(ApplicationRef);
  if (!updates.isEnabled) {
    return;
  }
  appRef.isStable.pipe(first((stable) => stable)).subscribe(() => {
    updates.checkForUpdate().catch(() => undefined);
  });
  updates.versionUpdates.subscribe((event) => {
    if (event.type === 'VERSION_READY') {
      updates.activateUpdate().then(() => document.location.reload());
    }
  });
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
    provideAppInitializer(applyServiceWorkerUpdates),
  ],
});
