/*
 * Cookie Clicker Touch Device Fix
 *
 * Touch-device fixes only. No automation, no cookie generation, no game-speed changes.
 * Designed for the browser version of Cookie Clicker.
 *
 * Included:
 *  1. Touch dragging of prestige upgrades on the Ascension screen.
 *  2. Tap-based Pantheon operation.
 *  3. Keep Switches / Upgrades / Vault sections open.
 *  4. One-second long press to put a store upgrade into the Vault.
 *     This is available only when Inspired checklist is owned.
 *  5. Tap Santa's helper Grandma to trigger the vanilla achievement check.
 *
 * Deliberately NOT included:
 *  - Game display-area resizing.
 *  - Garden / Grimoire / Stock Market touch changes.
 */
(function () {
    'use strict';

    const MOD_NAME = 'Cookie Clicker Touch Device Fix';
    const MOD_VERSION = '1.0.0';

    const state = {
        initialized: false,
        styleAdded: false,
        longPressTimer: 0,
        longPressTarget: null,
        longPressStartX: 0,
        longPressStartY: 0,
        suppressNextUpgradeClick: false
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function addEvent(target, type, handler, options) {
        if (!target) return;
        target.addEventListener(type, handler, options);
    }

    function playTick() {
        try {
            if (typeof PlaySound === 'function') PlaySound('snd/tick.mp3');
        } catch (e) {}
    }

    /* ------------------------------------------------------------
     * 1. Prestige upgrades: touch drag on the Ascension screen.
     * This follows the touch-to-Game.mouse conversion used by the
     * Japanese Cookie Clicker Wiki bookmarklet.
     * ------------------------------------------------------------ */
    function installAscensionTouch() {
        addEvent(document, 'touchstart', function (e) {
            if (!Game.OnAscend || !e.touches || !e.touches[0]) return;

            const t = e.touches[0];
            Game.mouseX = t.pageX / Game.scale;
            Game.mouseY = (t.pageY - TopBarOffset) / Game.scale;
            Game.lastActivity = Game.time;
            Game.mouseDown = 1;
            Game.clickFrom = e.target;
        }, { passive: true });

        addEvent(document, 'touchmove', function (e) {
            if (!Game.OnAscend || !e.changedTouches || !e.changedTouches[0]) return;

            const t = e.changedTouches[0];
            Game.mouseX = t.pageX / Game.scale;
            Game.mouseY = (t.pageY - TopBarOffset) / Game.scale;
            Game.mouseMoved = 1;
            Game.lastActivity = Game.time;
        }, { passive: true });

        addEvent(document, 'touchend', function () {
            if (!Game.OnAscend) return;

            Game.lastActivity = Game.time;
            Game.mouseDown = 0;
            Game.clickFrom = 0;
        }, { passive: true });

        addEvent(document, 'touchcancel', function () {
            if (!Game.OnAscend) return;

            Game.lastActivity = Game.time;
            Game.mouseDown = 0;
            Game.clickFrom = 0;
        }, { passive: true });
    }

    /* ------------------------------------------------------------
     * 2. Pantheon: tap-to-select, tap-to-place/remove.
     * ------------------------------------------------------------ */
    function installPantheonTouch() {
        function installWhenReady() {
            if (!Game.Objects || !Game.Objects['Temple'] || !Game.Objects['Temple'].minigame) {
                return false;
            }

            const M = Game.Objects['Temple'].minigame;
            const templeContent = byId('templeContent');
            const templeGods = byId('templeGods');
            if (!templeContent || !templeGods || !M.gods || !M.slot) return false;

            if (M.__touchDeviceFixInstalled) return true;
            M.__touchDeviceFixInstalled = true;

            M.godSelected = -1;
            M.slotSelected = -1;

            const id = function () {
                return M.gods[M.godSelected].id;
            };

            const name = function (n) {
                for (let i in M.gods) {
                    if (M.gods[i].id === n) return i;
                }
                return -1;
            };

            const on = function (g, s) {
                if (s === undefined) s = -1;

                M.godSelected = g;
                M.slotSelected = s;

                if (s === -1) {
                    const el = byId('templeGod' + id());
                    if (el) el.classList.add('godSelected');
                } else {
                    const el = byId('templeSlot' + s);
                    if (el) el.classList.add('godSelected');
                }

                try {
                    PlaySound('snd/toneTick.mp3');
                } catch (e) {}
            };

            const off = function () {
                if (M.godSelected === -1) return;

                const s = M.slotSelected;
                if (s === -1) {
                    const el = byId('templeGod' + id());
                    if (el) el.classList.remove('godSelected');
                } else {
                    const el = byId('templeSlot' + s);
                    if (el) el.classList.remove('godSelected');
                }

                M.godSelected = -1;
                M.slotSelected = -1;
            };

            const set = function (slot) {
                const selectedGodId = id();
                M.dragGod({ id: selectedGodId });
                M.dragging = M.gods[M.godSelected];
                M.slotHovered = slot;
                M.dropGod();

                if (selectedGodId !== -1) {
                    const placeholder = byId('templeGodPlaceholder' + selectedGodId);
                    if (placeholder) placeholder.style.display = 'none';
                }

                off();
            };

            if (!state.styleAdded) {
                const style = document.createElement('style');
                style.id = 'cookieClickerTouchDeviceFixStyle';
                style.textContent = `
                    .templeGod.godSelected {
                        box-shadow: 6px 6px 6px 2px #000;
                        background-position: 0px 74px;
                        z-index: 1000000001;
                        transform: scale(1.2) !important;
                    }
                    .templeGod.ready.godSelected .templeIcon {
                        animation-name: bounce;
                        animation-iteration-count: infinite;
                        animation-duration: 0.8s;
                    }
                `;
                templeContent.appendChild(style);
                state.styleAdded = true;
            }

            for (let i in M.gods) {
                const me = M.gods[i];
                const godEl = byId('templeGod' + me.id);
                if (!godEl || godEl.__touchDeviceFixBound) continue;
                godEl.__touchDeviceFixBound = true;

                godEl.addEventListener('click', (function (g) {
                    return function (e) {
                        e.stopPropagation();

                        if (M.gods[g].slot !== -1 || M.slotSelected !== -1) return;

                        if (M.godSelected === g) {
                            off();
                        } else {
                            if (M.godSelected !== -1) off();
                            on(g);
                        }
                    };
                })(i));

                godEl.addEventListener('mousedown', function (e) {
                    e.stopPropagation();
                }, true);

                godEl.addEventListener('mouseup', function (e) {
                    e.stopPropagation();
                }, true);
            }

            for (let i in M.slot) {
                const slotEl = byId('templeSlot' + i);
                if (!slotEl || slotEl.__touchDeviceFixBound) continue;
                slotEl.__touchDeviceFixBound = true;

                slotEl.addEventListener('click', (function (slot) {
                    return function (e) {
                        e.stopPropagation();

                        if (M.godSelected === -1) {
                            const n = M.slot[slot];
                            if (n === -1) return;
                            on(name(n), slot);
                        } else {
                            if (M.slot[slot] === id()) {
                                off();
                                return;
                            }
                            set(slot);
                        }
                    };
                })(i));
            }

            if (!templeGods.__touchDeviceFixBound) {
                templeGods.__touchDeviceFixBound = true;
                templeGods.addEventListener('click', function () {
                    if (M.godSelected === -1 || M.slotSelected === -1) return;
                    set(-1);
                });
            }

            return true;
        }

        installWhenReady();

        // Temple elements can be rebuilt when the minigame opens/closes.
        // Retry only while the Pantheon DOM is not yet installed.
        const timer = setInterval(function () {
            if (installWhenReady()) clearInterval(timer);
        }, 250);
        setTimeout(function () { clearInterval(timer); }, 15000);
    }

    /* ------------------------------------------------------------
     * 3. Keep switches / upgrades / vault open.
     * ------------------------------------------------------------ */
    function installOpenStoreSections() {
        const apply = function () {
            for (const id of ['toggleUpgrades', 'upgrades', 'vaultUpgrades']) {
                const el = byId(id);
                if (el) el.style.height = 'auto';
            }
        };

        apply();

        // Store rebuilding can replace inline styles, so re-apply after rebuilds.
        const original = Game.RefreshStore;
        if (typeof original === 'function' && !Game.__touchDeviceFixRefreshStore) {
            Game.__touchDeviceFixRefreshStore = true;
            Game.RefreshStore = function () {
                const result = original.apply(this, arguments);
                apply();
                return result;
            };
        }

        const originalUpdate = Game.UpdateStore;
        if (typeof originalUpdate === 'function' && !Game.__touchDeviceFixUpdateStore) {
            Game.__touchDeviceFixUpdateStore = true;
            Game.UpdateStore = function () {
                const result = originalUpdate.apply(this, arguments);
                apply();
                return result;
            };
        }

        const timer = setInterval(apply, 1000);
        setTimeout(function () { clearInterval(timer); }, 60000);
    }

    /* ------------------------------------------------------------
     * 4. One-second long press -> put the touched store upgrade in
     *    the Vault. Normal tap still buys the upgrade.
     * ------------------------------------------------------------ */
    function installVaultLongPress() {
        const upgradesRoot = byId('upgrades');
        if (!upgradesRoot || upgradesRoot.__touchDeviceFixVaultBound) return;
        upgradesRoot.__touchDeviceFixVaultBound = true;

        function clearLongPress() {
            if (state.longPressTimer) {
                clearTimeout(state.longPressTimer);
                state.longPressTimer = 0;
            }
            state.longPressTarget = null;
        }

        function getUpgradeFromElement(el) {
            if (!el || !el.id || el.id.indexOf('upgrade') !== 0) return null;

            const index = Number(el.id.slice(7));
            if (!Number.isInteger(index) || index < 0) return null;

            const me = Game.UpgradesInStore[index];
            return me || null;
        }

        addEvent(upgradesRoot, 'touchstart', function (e) {
            if (!Game.Has('Inspired checklist')) return;
            if (!e.touches || e.touches.length !== 1) return;

            const touch = e.touches[0];
            const target = e.target && e.target.closest ? e.target.closest('.crate.upgrade') : null;
            const upgrade = getUpgradeFromElement(target);
            if (!upgrade) return;

            // Vault is for normal store upgrades, not switches/research.
            if (upgrade.pool === 'toggle' || upgrade.pool === 'tech') return;
            if (upgrade.isVaulted()) return;

            clearLongPress();
            state.longPressTarget = upgrade;
            state.longPressStartX = touch.clientX;
            state.longPressStartY = touch.clientY;

            state.longPressTimer = setTimeout(function () {
                const me = state.longPressTarget;
                state.longPressTimer = 0;

                if (!me || !Game.Has('Inspired checklist')) {
                    state.longPressTarget = null;
                    return;
                }

                if (me.pool === 'toggle' || me.pool === 'tech' || me.isVaulted()) {
                    state.longPressTarget = null;
                    return;
                }

                me.vault();
                Game.upgradesToRebuild = 1;
                state.suppressNextUpgradeClick = true;
                state.longPressTarget = null;
                playTick();
            }, 1000);
        }, { passive: true });

        addEvent(upgradesRoot, 'touchmove', function (e) {
            if (!state.longPressTimer || !e.touches || !e.touches[0]) return;

            const touch = e.touches[0];
            const dx = touch.clientX - state.longPressStartX;
            const dy = touch.clientY - state.longPressStartY;

            // Moving is treated as scrolling, not a long press.
            if (dx * dx + dy * dy > 100) clearLongPress();
        }, { passive: true });

        addEvent(upgradesRoot, 'touchend', function () {
            if (state.longPressTimer) clearLongPress();

            if (state.suppressNextUpgradeClick) {
                state.suppressNextUpgradeClick = false;
                // The browser will still emit click after touchend. Suppression
                // is handled by the capturing click listener below.
            }
        }, { passive: true });

        addEvent(upgradesRoot, 'touchcancel', function () {
            clearLongPress();
            state.suppressNextUpgradeClick = false;
        }, { passive: true });

        // A long press normally generates a click after touchend. Stop that
        // click so the upgrade is not accidentally purchased.
        addEvent(upgradesRoot, 'click', function (e) {
            if (!state.suppressNextUpgradeClick) return;
            state.suppressNextUpgradeClick = false;
            e.preventDefault();
            e.stopImmediatePropagation();
        }, true);
    }

    /* ------------------------------------------------------------
     * 5. Santa's helper Grandma achievement on touch.
     * The vanilla achievement check is tied to the mouse-down path.
     * A tap on rowCanvas1 is therefore converted into mouseDown=1,
     * matching the established touch-device bookmarklet behavior.
     * ------------------------------------------------------------ */
    function installSantaGrandmaTouch() {
        const rowCanvas = byId('rowCanvas1');
        if (!rowCanvas || rowCanvas.__touchDeviceFixBound) return;
        rowCanvas.__touchDeviceFixBound = true;

        addEvent(rowCanvas, 'touchstart', function () {
            Game.mouseDown = 1;
        }, { passive: true });
    }

    function init() {
        if (state.initialized) return;
        if (typeof Game === 'undefined') return;

        state.initialized = true;

        installAscensionTouch();
        installPantheonTouch();
        installOpenStoreSections();
        installVaultLongPress();
        installSantaGrandmaTouch();

        if (Game.Notify) {
            Game.Notify(MOD_NAME, 'v' + MOD_VERSION + ' を読み込みました。', '', 3);
        }
    }

    const mod = {
        init: init,
        save: function () {},
        load: function () {}
    };

    if (typeof Game !== 'undefined' && typeof Game.registerMod === 'function') {
        Game.registerMod(MOD_NAME, mod);
    } else {
        // Fallback for direct console/script execution.
        init();
    }
})();
