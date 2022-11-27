import { MgT2Item } from "../documents/item.mjs";

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class MgT2Actor extends Actor {

  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

    /** @override */
    prepareBaseData() {
        // Data modifications in this step occur before processing embedded
        // documents or derived data.
        console.log(`prepareBaseData: [${this.name}]`);

        const actorData = this;

        for (const effect of this.effects) {
            const source = effect._source._id;
            const origin = effect.origin.replaceAll(/.*Item./g, "");
            const item = this.items.get(origin);
            if (item) {
                if (item.system.status === MgT2Item.EQUIPPED) {
                    effect.isSuppressed = false;
                } else {
                    effect.isSuppressed = true;
                }
            }
        }
    }

    modifyTokenAttribute(attribute, value, isDelta, isBar) {
        console.log(`modifyTokenAttribute: [${attribute}] [${value}] ${isDelta} ${isBar}`);

        console.log(this.system.hits);
        if (this.type === "traveller") {
            console.log("Traveller");
        } else {
            console.log("NPC or Creature");
            let hits = this.system.hits;
            if (isDelta) {
                hits.damage -= parseInt(value);
            } else {
                hits.damage = hits.max - parseInt(value);
            }
            hits.value = hits.max - hits.damage;
            console.log("Changed value to " + hits.value);
        }

        return this.update({"system.hits": this.system.hits });
    }

    /**
     * @override
     * Augment the basic actor data with additional dynamic data. Typically,
     * you'll want to handle most of your calculated/derived data in this step.
     * Data calculated in this step should generally not exist in template.json
     * (such as ability modifiers rather than ability scores) and should be
     * available both inside and outside of character sheets (such as if an actor
     * is queried and has a roll executed directly from it).
     */
    prepareDerivedData() {
        const actorData = this;
        const flags = actorData.flags.traveller || {};

        console.log("prepareDerivedData:");
        console.log(actorData);

        // Make separate methods for each Actor type (traveller, npc, etc.) to keep
        // things organized.
        this._prepareTravellerData(actorData);
        this._prepareNpcData(actorData);
        this._prepareCreatureData(actorData);
    }


  /**
   * Get the characteristic modifier for a given value.
   * Values are normally 0+, with 6-8 providing a +0 modifier.
   */
  getModifier(value) {
      if (value < 1) {
          return -3;
      } else if (value < 3) {
          return -2;
      } else {
          return parseInt(value / 3) - 2;
      }
  }



    applyActiveEffect(ob1, obj2) {
        console.log("applyActiveEffect:");
        console.log(obj1);
        console.log(obj2);
    }

    _prepareEncumbrance(actorData) {
        console.log("_prepareEncumbrance:");

        if (!actorData.system) {
            return;
        }
        let data = actorData.system;
        let heavyLoad = 0;

        if (data.characteristics) {
            const ch = data.characteristics;
            if (ch['STR']) {
                heavyLoad += parseInt(ch['STR'].current);
            }
            if (ch['END']) {
                heavyLoad += parseInt(ch['END'].current);
            }
        }
        if (data.skills) {
            if (data.skills['athletics'] && data.skills['athletics'].trained) {
                const ath = data.skills['athletics'];
                if (ath.specialities && ath.specialities.strength) {
                    heavyLoad += parseInt(ath.specialities.strength.value);
                }
                if (ath.specialities && ath.specialities.endurance) {
                    heavyLoad += parseInt(ath.specialities.endurance.value);
                }
            }
        }
        data.heavyLoad = heavyLoad;
        data.maxLoad = heavyLoad * 2;
    }

    _prepareInitiative(actorData) {
        if (!actorData.system) {
            return;
        }
        const dex = parseInt(actorData.system.characteristics["DEX"].dm);
        const int = parseInt(actorData.system.characteristics["INT"].dm);

        actorData.system.initiative = Math.max(int, dex);
    }

    /**
     * Prepare Character type specific data
     */
    _prepareTravellerData(actor) {
        if (actor.type !== 'traveller') return;

        // Make modifications to data here. For example:
        const data = actor.system;

        for (const char in data.characteristics) {
            let value = data.characteristics[char].value;
            if (data.characteristics[char].augment) {
                value += parseInt(data.characteristics[char].augment);
            }
            let dmg = 0;
            if (data.damage && data.damage[char]) {
                dmg = data.damage[char].value;
                if (dmg < 0) {
                    dmg = 0;
                    data.damage[char].value = dmg;
                }
                if (dmg > value) {
                    dmg = value;
                    data.damage[char].value = dmg;
                }
                value -= dmg;
            }
            data.characteristics[char].current = value;
            data.characteristics[char].dm = this.getModifier(value);
        }

        if (data.damage && data.hits) {
            let hits = data.characteristics.STR.current + data.characteristics.DEX.current +
                data.characteristics.END.current;
            let maxHits = data.characteristics.STR.value + data.characteristics.DEX.value +
                data.characteristics.END.value;

            data.hits.value = hits;
            data.hits.max = maxHits;
        }
        this._prepareEncumbrance(actor);
        this._prepareInitiative(actor);
    }

    _prepareNpcData(actor) {
        if (actor.type !== 'npc') return;
        const actorData = actor.system;

        for (const char in actorData.characteristics) {
            let value = actorData.characteristics[char].value;
            if (actorData.characteristics[char].augment) {
                value += parseInt(actorData.characteristics[char].augment);
                console.log("Augmented value is " + value);
            }
            actorData.characteristics[char].current = value;
            actorData.characteristics[char].dm = this.getModifier(value);;
        }

        if (actorData.hits) {
            let hits = 0;
            let maxHits = 0;
            let damage = actorData.hits.damage?parseInt(actorData.hits.damage):0;

            maxHits = actorData.characteristics.STR.value + actorData.characteristics.DEX.value +
                actorData.characteristics.END.value;

            actorData.hits.max = maxHits;
            actorData.hits.value = maxHits - actorData.hits.damage;
        }
        this._prepareEncumbrance(actor);
        this._prepareInitiative(actor);
    }

    _prepareCreatureData(actor) {
        if (actor.type !== 'creature') return;

        const actorData = actor.system;

        if (actorData.hits) {
            if (!actorData.hits.damage) {
                actorData.hits.damage = 0;
            }
            actorData.hits.value = parseInt(actorData.hits.max) - parseInt(actorData.hits.damage);
        }
    }


    /**
     * Override getRollData() that's supplied to rolls.
     */
    getRollData() {
        const data = super.getRollData();

        // Prepare traveller roll data.
        this._getTravellerRollData(data);

        return data;
    }

  /**
   * Prepare character roll data.
   */
  _getTravellerRollData(data) {
    if (this.type !== 'traveller' && this.type !== 'npc') return;

    if (!data.characteristics) {
        console.log("This Traveller has no characteristics");
        return;
    }

    for (let [k,v] of Object.entries(data.characteristics)) {
        data[k] = v.dm ?? -3;
    }

  }

}
