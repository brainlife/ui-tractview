import '@vue/runtime-core';

declare module '@vue/runtime-core' {
    interface ComponentCustomProperties {
        $worker: { run<T>(fn: (...args: any[]) => T, args: any[]): Promise<T> };
    }
}
