// ==========================================
// DATA LOADER — Async dynamic script injection
// ==========================================
// Each data file sets a global variable when it runs.
// We inject <script> tags on demand and wait for onload,
// then verify the global exists before resolving.

const DATA_FILES = [
    { src: 'Pokemon_NewDataset.js', global: 'MergedPokemonData',    label: 'Pokémon data'   },
    { src: 'ability.js',            global: 'AbilitiesData',         label: 'Abilities'      },
    { src: 'abilities_map.js',      global: 'PokemonAbilitiesMap',   label: 'Abilities map'  },
    { src: 'moves_data.js',         global: 'MovesData',             label: 'Move data'      },
    { src: 'movesets.js',           global: 'MovesetsData',          label: 'Move sets'      },
];

/**
 * Dynamically inject a classic (non-module) script tag and wait for it to load.
 * @param {string} src  - URL/path relative to the document
 * @returns {Promise<void>}
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.onload = resolve;
        el.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(el);
    });
}

/**
 * Load all game data files sequentially, calling onProgress after each one.
 *
 * @param {function(loaded: number, total: number, label: string): void} onProgress
 *   Called after each file finishes. `loaded` is the count done so far.
 * @returns {Promise<void>} Resolves when every global is available.
 */
export async function loadGameData(onProgress) {
    const total = DATA_FILES.length;

    for (let i = 0; i < total; i++) {
        const { src, global: globalName, label } = DATA_FILES[i];

        // Skip if already present (e.g. hot-reload scenarios)
        if (window[globalName]) {
            onProgress?.(i + 1, total, label);
            continue;
        }

        await loadScript(src);

        // Sanity check — the script should have set the global
        if (!window[globalName]) {
            throw new Error(`Script loaded but global "window.${globalName}" is still undefined. Check ${src}.`);
        }

        onProgress?.(i + 1, total, label);
    }
}
