interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export const vscode: VsCodeApi =
  typeof acquireVsCodeApi === "function"
    ? acquireVsCodeApi()
    : {
        // Fallback for dev mode outside VSCode
        postMessage: (msg: unknown) => console.log("[vscode mock]", msg),
        getState: () => null,
        setState: () => {},
      };
