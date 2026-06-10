// Polyfill Promise.withResolvers for older browser engines and node environments
interface PromiseWithResolvers<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject: (reason?: any) => void;
}

if (typeof Promise.withResolvers === "undefined") {
  (Promise as unknown as { withResolvers: <T>() => PromiseWithResolvers<T> }).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Polyfill URL.parse for older Node.js versions and older browser engines
if (typeof URL.parse === "undefined") {
  (URL as unknown as { parse: (url: string, base?: string | URL) => URL | null }).parse = function (url: string, base?: string | URL) {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}

