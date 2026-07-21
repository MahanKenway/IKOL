import { Composer, type Context } from 'grammy';
import type { Env } from '../types/env.js';
import type { FeatureFlags } from '../services/feature-flags/index.js';
import { getLogger } from '../services/logger/index.js';

const logger = getLogger({ module: 'plugin-system' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComposer = Composer<any>;

export interface IkolModule {
  /** Unique module name */
  name: string;
  /** Feature flag key that controls this module */
  featureFlag: keyof FeatureFlags;
  /** Module version */
  version: string;
  /** Register commands, callbacks, and middleware */
  register(composer: AnyComposer, env: Env, flags: FeatureFlags): void;
}

// Registry of all modules
const moduleRegistry: IkolModule[] = [];

export function registerModule(module: IkolModule) {
  moduleRegistry.push(module);
}

export function getRegisteredModules(): ReadonlyArray<IkolModule> {
  return moduleRegistry;
}

export function loadModules(composer: AnyComposer, env: Env, flags: FeatureFlags) {
  for (const mod of moduleRegistry) {
    if (!flags[mod.featureFlag]) {
      logger.info(`Module ${mod.name} disabled by feature flag ${mod.featureFlag}`);
      continue;
    }
    try {
      mod.register(composer, env, flags);
      logger.info(`Loaded module: ${mod.name} v${mod.version}`);
    } catch (error) {
      logger.error(`Failed to load module ${mod.name}`, {
        module: mod.name,
        error: (error as Error).message,
      });
    }
  }
}
