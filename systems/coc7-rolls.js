import { BaseRolls } from "./base-rolls.js"
import { i18n, log, setting } from "../monks-tokenbar.js"

export class CoC7Rolls extends BaseRolls {
    constructor() {
        super();

        const characteristics = {};
        for (let [k, v] of Object.entries(game.system.model.Actor.character.characteristics)){
            characteristics[k] = v.label;
        }

        const attributes = {};
        for (let [k, v] of Object.entries(game.system.model.Actor.character.attribs)) {
            if (['lck', 'san'].includes(k)) {
                attributes[k] = v.label;
            }
        }
    
        this._requestoptions = [
            { id: "characteristics", text: "MonksTokenBar.Characteristics", groups: characteristics },
            { id: "attributes", text: "MonksTokenBar.Attribute", groups: attributes }
        ].concat(this._requestoptions);

        if (game.settings.get('CoC7', 'initiativeRule') === 'optional') {
            this._requestoptions = [
                { id: "misc", text: '', groups: { init: "MonksTokenBar.Initiative" } }
            ].concat(this._requestoptions);
        }
    }

    get _supportedSystem() {
        return true;
    }

    namedDCs() {
        return [
            { dc: '', name: '' },
            { dc: 1, name: game.i18n.localize('CoC7.RollDifficultyRegular') },
            { dc: 2, name: game.i18n.localize('CoC7.RollDifficultyHard') },
            { dc: 3, name: game.i18n.localize('CoC7.RollDifficultyExtreme') },
        ];
    }

    defaultRollDiceText(roll) {
        if (roll.options?.CoC7?.isFumble) {
            return game.i18n.localize('CoC7.Fumble');
        }
        if (roll.options?.CoC7?.isCritical) {
            return game.i18n.localize('CoC7.CriticalSuccess');
        }
        let result = 0;
        for (const dc in roll.options?.CoC7?.successLevels) {
            if (roll.total <= roll.options.CoC7.successLevels[dc]) {
                result = dc
            }
        }
        if (result === 0) {
            return game.i18n.localize('CoC7.Failure')
        }
        const name = this.namedDCs().filter(dc => dc.dc.toString() === result.toString()).map(dc => dc.name)
        if (name.length) {
            return name[0]
        }
        return ''
    }

    rollSuccess(roll, dc) {
        if (roll.options?.CoC7?.isCritical) {
            return 'success'
        }
        if (roll.options?.CoC7?.isFumble) {
            return 'failed'
        }

        if (typeof roll.options?.CoC7?.successLevel !== undefined) {
            return roll.options?.CoC7?.successLevel >= dc;
        }
        return false
    }

    /*
    static activateHooks() {
        Hooks.on("preCreateChatMessage", (message, option, userid) => {
            if (message.getFlag('monks-tokenbar', 'ignore') === true)
                return false;
            else
                return true;
        });
    }*/

    get defaultStats() {
        return [{ stat: "attribs.san.value", icon: "fa-head-side-virus" }, { stat: "attribs.mp.value", icon: "fa-hat-wizard" }];
    }

    getLevel(actor) {
        return 0;
    }

    get showXP() {
        return false;
    }

    /*
    defaultRequest(app) {
        let allPlayers = (app.tokens.filter(t => t.actor?.hasPlayerOwner).length == app.tokens.length);
        //if all the tokens have zero hp, then default to death saving throw
        let allZeroHP = app.tokens.filter(t => getProperty(t.actor, "data.data.attributes.hp.value") == 0).length;
        return (allZeroHP == app.tokens.length && allZeroHP != 0 ? 'misc:death' : null) || (allPlayers ? 'skill:prc' : null);
    }*/

    defaultContested() {
        return 'characteristics:str';
    }

    dynamicRequest(entries) {
        let skills = {};
        //get the first token's skills
        for (let item of entries[0].token.actor.items) {
            if (item.type == 'skill') {
                let sourceID = item.getFlag("core", "sourceId") || item.id;
                skills[sourceID] = item.data.name;
            }
        }
        //see if the other tokens have these skills
        if (Object.keys(skills).length > 0) {
            for (let i = 1; i < entries.length; i++) {
                for (let [k, v] of Object.entries(skills)) {
                    let tool = entries[i].token.actor.items.find(t => {
                        return t.type == 'skill' && (t.getFlag("core", "sourceId") || t.id) == k;
                    });
                    if (tool == undefined)
                        delete skills[k];
                }
            }
        }

        if (Object.keys(skills).length == 0)
            return;

        return [{ id: 'skill', text: 'Skills', groups: skills }];
    }

    roll({ id, actor, request, rollMode, requesttype, fastForward = false }, callback, e) {
        let rollfn = null;
        let options = { fastForward: fastForward, chatMessage: false, forcedCardType: true, hideDifficulty: true, difficulty: -1 };

        if (requesttype == 'characteristics') {
            options.characteristic = request;
            rollfn = actor.runRoll;
        } else if (requesttype == 'attributes') {
            options.attribute = request;
            rollfn = actor.runRoll;
        } else if (requesttype == 'skill') {
            let item = actor.items.find(i => { return i.getFlag("core", "sourceId") == request || i.id == request; });
            if (typeof item !== 'undefined') {
                options.skillId = item.id;
                rollfn = actor.runRoll;
            } else {
                return { id: id, error: true, msg: i18n("MonksTokenBar.ActorNoTool") };
            }
            console.log(item, item.id, options)
        } else if (requesttype == 'misc' && request == 'init') {
            options.characteristic = 'dex';
            options.fastForward = true
            rollfn = actor.runRoll;
        }
        if (rollfn && typeof rollfn !== 'undefined') {
            try {
                return rollfn.call(actor, options).then((result) => {
                    const roll = Roll.fromData({
                        class: 'Roll',
                        options: {
                            CoC7: {
                                isCritical: result.isCritical,
                                isFumble: result.isFumble,
                                successLevels: result.successLevels,
                                successLevel: result.successLevel
                            }
                        },
                        dice: [],
                        formula: '1d100',
                        terms: [
                            {
                                class: 'Die',
                                options: {},
                                evaluated: true,
                                number: 1,
                                faces: 100,
                                modifiers: [],
                                results: [
                                    {
                                        result: result.result,
                                        active: true
                                    }
                                ]
                            }
                        ],
                        total: result.result,
                        evaluated: true
                    })
                    return callback(roll)
                }).catch(() => { return { id: id, error: true, msg: i18n("MonksTokenBar.UnknownError") } });
            } catch {
                return { id: id, error: true, msg: i18n("MonksTokenBar.UnknownError") }
            }
        } else {
            return { id: id, error: true, msg: i18n("MonksTokenBar.ActorNoRollFunction") };
        }
    }
}