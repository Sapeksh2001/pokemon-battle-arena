import { Trie } from '../utils/Trie.js';

// ==========================================
// POKÉMON DATABASE SERVICE (O(1) / O(k) lookups)
// ==========================================

export class PokemonDatabase {
    /**
     * @param {object} rawData - window.MergedPokemonData
     */
    constructor(rawData) {
        this._raw = rawData || {};
        this._index = new Map();   // name.toLowerCase() → { foundNode, baseNode }
        this._trie = new Trie();
        
        // Tier-filtered names are cached for quick team generation.
        this.allNames = [];
        this.filteredNames = [];
    }

    /** Build all lookup structures. Call once at startup. O(n). */
    buildIndex() {
        if (!this._raw || Object.keys(this._raw).length === 0) return;

        const traverse = (node, baseNode) => {
            if (!node || typeof node !== 'object' || !node.Name) return;
            const key = node.Name.toLowerCase();
            if (!this._index.has(key)) {
                this._index.set(key, { foundNode: node, baseNode });
                this._trie.insert(node.Name);
            }
            // Recurse into forms that have a Name.
            if (node.forms) {
                for (const f of Object.values(node.forms)) {
                    if (f && f.Name) traverse(f, node);
                }
            }
            // Recurse into evolutions.
            if (node.evolutions) {
                for (const evo of node.evolutions) traverse(evo, evo);
            }
        };

        for (const pokemon of Object.values(this._raw)) traverse(pokemon, pokemon);

        this.allNames = [...this._index.values()].map(v => v.foundNode.Name);
        this.filteredNames = this._buildFiltered(['Basic', 'Ultra Beast', 'Legendary', 'Mythical']);
    }

    /**
     * O(1) lookup by exact name.
     * @param {string} name
     * @returns {{ foundNode: object, baseNode: object } | null}
     */
    find(name) {
        return this._index.get(name?.toLowerCase()) ?? null;
    }

    /**
     * O(k + m) prefix search using the Trie.
     * @param {string} prefix
     * @param {number} limit
     * @returns {string[]}
     */
    search(prefix, limit = 5) {
        return this._trie.search(prefix, limit);
    }

    /** Build the tier-filtered name list used for team generation. */
    _buildFiltered(allowedTiers) {
        const names = [];
        for (const { foundNode } of this._index.values()) {
            if (foundNode.tier && allowedTiers.includes(foundNode.tier)) {
                names.push(foundNode.Name);
            }
        }
        return names;
    }
}
