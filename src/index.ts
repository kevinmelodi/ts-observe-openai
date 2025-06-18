import { MelodiConfig, MelodiExtension } from './types';
import { MelodiSingleton } from './core/MelodiSingleton';
import { withTracing } from './core/traceMethod';
import { MelodiClient } from './core/MelodiClient';

export { MelodiClient } from './core/MelodiClient';
export { MelodiSingleton } from './core/MelodiSingleton';
export * from './types';

export const observeOpenAI = <SDKType extends object>(
  sdk: SDKType,
  melodiConfig?: MelodiConfig
): SDKType & MelodiExtension => {
  return new Proxy(sdk, {
    get(wrappedSdk, propKey, proxy) {
      const originalProperty = wrappedSdk[propKey as keyof SDKType];

      const defaultGenerationName = `${sdk.constructor?.name}.${propKey.toString()}`;
      const generationName = melodiConfig?.traceName ?? defaultGenerationName;
      const config = { 
        ...melodiConfig, 
        traceName: generationName,
        apiContext: propKey === 'responses' ? 'responses' : melodiConfig?.apiContext 
      } as MelodiConfig & { apiContext?: string };

      if (propKey === 'flushAsync') {
        let melodiClient: MelodiClient;

        if (melodiConfig && 'parent' in melodiConfig && melodiConfig.parent) {
          melodiClient = melodiConfig.parent.client as MelodiClient;
        } else {
          melodiClient = MelodiSingleton.getInstance();
        }

        return melodiClient.flushAsync.bind(melodiClient);
      }

      if (propKey === 'shutdownAsync') {
        let melodiClient: MelodiClient;

        if (melodiConfig && 'parent' in melodiConfig && melodiConfig.parent) {
          melodiClient = melodiConfig.parent.client as MelodiClient;
        } else {
          melodiClient = MelodiSingleton.getInstance();
        }

        return melodiClient.shutdownAsync.bind(melodiClient);
      }

      if (typeof originalProperty === 'function') {
        return withTracing(originalProperty.bind(wrappedSdk), config);
      }

      const isNestedOpenAIObject =
        originalProperty &&
        !Array.isArray(originalProperty) &&
        !(originalProperty instanceof Date) &&
        typeof originalProperty === 'object';

      if (isNestedOpenAIObject) {
        return observeOpenAI(originalProperty, config);
      }

      return Reflect.get(wrappedSdk, propKey, proxy);
    },
  }) as SDKType & MelodiExtension;
}; 