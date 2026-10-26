import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type FeatureFlags = {
  employee_team_chat: boolean;
  employee_pharmacy_topics: boolean;
};

const DEFAULT_FLAGS: FeatureFlags = {
  employee_team_chat: false,
  employee_pharmacy_topics: false,
};

/**
 * Resolves the feature flags that are meaningful to this app.
 *
 * Resolution order for each key:
 *   1. an explicit tenant_features row for the organization
 *   2. features.default_enabled
 *   3. false (fail closed)
 *
 * If the flag tables don't exist yet, every feature is OFF.
 *
 * Cached per request (React `cache`): the layout, the page and any route handler
 * in the same request share one lookup instead of repeating it. Outside a render
 * it simply runs normally.
 */
export const getFeatureFlags = cache(
  async (organization: string): Promise<FeatureFlags> => {
    try {
      const supabase = createClient();

      const [{ data: defs }, { data: overrides }] = await Promise.all([
        supabase.from("features").select("key, default_enabled"),
        supabase
          .from("tenant_features")
          .select("feature_key, enabled")
          .eq("organization", organization),
      ]);

      const resolved: FeatureFlags = { ...DEFAULT_FLAGS };

      for (const row of defs ?? []) {
        if (row.key in resolved) {
          resolved[row.key as keyof FeatureFlags] = Boolean(row.default_enabled);
        }
      }

      for (const row of overrides ?? []) {
        if (row.feature_key in resolved) {
          resolved[row.feature_key as keyof FeatureFlags] = Boolean(row.enabled);
        }
      }

      return resolved;
    } catch {
      return { ...DEFAULT_FLAGS };
    }
  },
);
