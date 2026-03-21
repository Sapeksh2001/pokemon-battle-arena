// ==========================================
// BATTLE ENGINE (Pure Math)
// ==========================================

export class BattleEngine {
    constructor(chart) {
        this._chart = chart; // typeChart mapping
    }

    /**
     * Calculate the combined type-effectiveness multiplier.
     * Handles dual-types by multiplying per defending type.
     * @param {string}   moveType
     * @param {string[]} defenderTypes
     * @returns {number}
     */
    getTypeEffectiveness(moveType, defenderTypes) {
        return defenderTypes.reduce((multiplier, defType) => {
            const chart = this._chart[moveType];
            return (chart && chart[defType] !== undefined)
                ? multiplier * chart[defType]
                : multiplier;
        }, 1);
    }

    /**
     * Calculate final damage dealt.
     * Uses the stat difference formula, clamped to [1, Infinity].
     */
    calculateDamage(attacker, defender, movePower, moveType, attackType) {
        const effectiveness = this.getTypeEffectiveness(moveType, defender.types);

        // Immune types always deal 0 damage.
        if (effectiveness === 0) return { damage: 0, effectiveness: 0 };

        const offStat = attackType === 'physical'
            ? attacker.getEffectiveStat('attack')
            : attacker.getEffectiveStat('specialAttack');
        const defStat = attackType === 'physical'
            ? defender.getEffectiveStat('defence')
            : defender.getEffectiveStat('specialDefence');

        const statDifference = offStat - defStat;

        // Only deal damage when the attacker has a stat advantage.
        const damage = statDifference > 0
            ? Math.max(1, Math.floor(movePower * effectiveness * statDifference / 100))
            : 0;

        return { damage, effectiveness };
    }
}
