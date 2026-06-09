// Polyfill Promise.withResolvers for older browser engines and node environments
if (typeof Promise.withResolvers === "undefined") {
  (Promise as any).withResolvers = function () {
    let resolve: any, reject: any;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Polyfill URL.parse for older Node.js versions and older browser engines
if (typeof URL.parse === "undefined") {
  (URL as any).parse = function (url: string, base?: string | URL) {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}

