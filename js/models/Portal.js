var Portal = Backbone.Model.extend({
    resonators: {},
    mods: {},
    level: {},
    defaults: {
        decayDays: 0,
        level: 1,
        rechargeXMused: -1,
        totalRechargeXMused: 0
    },
    initialize: function () {
        _.bindAll(this, "reposition", "applyPreset", "saveConfig", "reset", "recharge", "fill", "applyMods");
        this.set("resonators", new ResonatorCollection());
        this.set("mods", new ModCollection());
        this.resonators = this.get("resonators");
        this.mods = this.get("mods");
        //init 8 resos
        this.listenTo(this.resonators, "add change", this.reposition);
        this.saveConfig();
    },
    reposition: function () {
        var level = 0;
        _.each(this.resonators.pluck("level"), function (l) {
            level += l;
        });
        level = level / 8;
        this.set("exactlevel", level);
        this.set("level", level >= 1 ? Math.floor(level) : 1);
    },
    decay: function () {
        this.reset();
        var days = this.get("decayDays");
        var perc = DECAY_RATE * days;
        this.resonators.each(function (e) {
            e.set("energyTotal", e.get("energyTotal") - e.getMaxEnergy() * perc);
        });
    },
    applyPreset: function (presetId) {
        if (presetId in PRESETS) {
            var preset = PRESETS[presetId];
            var resoSettings = preset.resonators;
            this.resonators.each(function (e, i) {
                e.set(resoSettings[i]);
            });
        } else {
            alert("Could not find preset " + presetId);
        }
        this.commit();
    },
    loadFromConfigHash: function (confighash) {
        var parts = confighash.split("|");
        var resohash = parts[0];
        var modhash = parts[1];

        var oldTypes={
            "c":"cs10",
            "r":"rs20",
            "v":"vrs30"
        };
        var resoVals = resohash.split(";");
        _.each(resoVals, function (resoval, i) {
            var values = resoval.split(",");
            resonators.at(i).set({
                level: parseInt(values[0], 10),
                distanceToPortal: parseInt(values[1], 10),
                energyTotal: parseInt(values[2], 10)
            });
        });
        var modVals = modhash.split(",");
        _.each(modVals, function (shortType,i) {
            //convert 0 to -
            shortType = (shortType === "0") ? "-" : shortType;
            //BC break - convert c,r,v to new shields
            if (shortType in oldTypes) {
                shortType=oldTypes[shortType];
            }
            this.mods.at(i).setType(shortType);
        },this);
        this.saveConfig();
    },
    getConfigHash: function () {
        var hashparts = [];
        this.resonators.each(function (reso) {
            hashparts.push(reso.get("level") + "," + reso.get("distanceToPortal") + "," + reso.get("energyTotal"));
        });
        return hashparts.join(";") + "|" + this.get("mods").getHash();
    },
    saveConfig: function () {
        this.set("config", this.getConfigHash());
    },
    countResos: function () {
        return _.reduce(this.resonators.pluck("energyTotal"), function (c, e) {
            if (e > 0) {
                c++
            }
            return c
        }, 0);
    },
    fill: function () {
        this.resonators.each(function (e) {
            if (e.get("energyTotal") > 0) {
                e.set("energyTotal", e.getMaxEnergy());
            }
        });
    },
    commit: function () {
        this.fill();
        this.saveConfig();
        this.decay();
    },
    recharge: function () {
        var resosInNeed = [];
        this.resonators.each(function (reso, i) {
            if (reso.needsEnergy()) {
                resosInNeed.push(i);
            }
        });
        var unused = 0;
        if (resosInNeed.length > 0) {
            var charge = Math.round(1000 / resosInNeed.length);
            _.each(resosInNeed, function (i) {
                unused += this.resonators.at(i).charge(charge);
            })
        } else {
            unused = 1000;
        }
        var used = 1000 - unused;
        this.set("rechargeXMused", used);
        var t = this.get("totalRechargeXMused");
        t += used;
        var t = this.set("totalRechargeXMused", t);
    },
    deployCost: function() {
        var xm=0;
        this.resonators.each(function(reso,i) {
            var l=reso.get("level");
            if (l>=1) {
                xm+=reso_deploy_cost[l-1];
            }
        });

        this.mods.each(function(mod,i) {
            xm+=mod.getDeployCost();
        });
        return xm;
    },
    applyMods: function (damage) {
        //reduce damage due to mods
        return damage * (100 - this.mods.totalMitigation()) / 100;
    },
    reset: function () {
        this.set({"rechargeXMused": 0, "totalRechargeXMused": 0});
        this.loadFromConfigHash(this.get("config"));
    }
});
