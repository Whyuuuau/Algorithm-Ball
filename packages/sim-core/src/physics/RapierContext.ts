import RAPIER from "@dimforge/rapier2d-deterministic-compat";

let initialized = false;

export async function initRapier(): Promise<typeof RAPIER> {
  if (!initialized) {
    if (typeof RAPIER.init === "function") {
      await RAPIER.init();
    }
    initialized = true;
  }
  return RAPIER;
}

export { RAPIER };
