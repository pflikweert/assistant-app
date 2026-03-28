import { ScrollViewStyleReset } from "expo-router/html";
import React from "react";

const APP_VERSION_FALLBACK = (() => {
  try {
    const appJson = require("../app.json");
    return String(appJson?.expo?.version || "1.0.0");
  } catch {
    return "1.0.0";
  }
})();

const WEB_BUILD_ID = (() => {
  const vercelCommit = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
  if (vercelCommit) return vercelCommit;
  return APP_VERSION_FALLBACK;
})();

const DEVTOOLS_PATCH_SCRIPT = `
(function () {
  try {
    if (typeof window === 'undefined') return;

    var SAFE_VERSION = '19.1.0';

    function patchRenderer(renderer) {
      if (
        renderer &&
        typeof renderer.version === 'string' &&
        !renderer.version.trim()
      ) {
        renderer.version = SAFE_VERSION;
      }
      return renderer;
    }

    function patchHook(hook) {
      if (!hook || hook.__budioDevtoolsPatched) return;

      if (typeof hook.inject === 'function') {
        var originalInject = hook.inject.bind(hook);
        hook.inject = function (renderer) {
          return originalInject(patchRenderer(renderer));
        };
      }

      if (typeof hook.registerRendererInterface === 'function') {
        var originalRegister = hook.registerRendererInterface.bind(hook);
        hook.registerRendererInterface = function (rendererInterface) {
          return originalRegister(patchRenderer(rendererInterface));
        };
      }

      hook.__budioDevtoolsPatched = true;
    }

    var currentHook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (currentHook) {
      patchHook(currentHook);
    }

    var storedHook = currentHook;
    try {
      Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
        configurable: true,
        enumerable: false,
        get: function () {
          return storedHook;
        },
        set: function (nextHook) {
          storedHook = nextHook;
          patchHook(nextHook);
        },
      });
    } catch (error) {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = storedHook;
    }
  } catch (error) {
    // DevTools patch is best-effort only.
  }
})();`;

export default function Html({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="budio-build-id" content={WEB_BUILD_ID} />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__BUDIO_BUILD_ID__ = "${WEB_BUILD_ID}";`,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: DEVTOOLS_PATCH_SCRIPT }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
