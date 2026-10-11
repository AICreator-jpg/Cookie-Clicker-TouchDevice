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
 *  4. Two-second long press to move a store upgrade into/out of the Vault.
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
    const MOD_VERSION = '1.1.2';

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
        // Do not force the switch header (toggleUpgrades) to height:auto:
        // it is a compact control row and expanding it can overlap the vault.
        const sectionIds = ['upgrades', 'vaultUpgrades'];

        const apply = function () {
            for (const id of sectionIds) {
                const el = byId(id);
                if (!el) continue;

                // Keep each section in normal document flow. Avoid forcing
                // overflow:visible, which can make the next section overlap.
                el.style.setProperty('height', 'auto', 'important');
                el.style.setProperty('max-height', 'none', 'important');
                el.style.setProperty('overflow', 'hidden', 'important');
                el.style.setProperty('display', 'block', 'important');
            }
        };

        apply();

        for (const methodName of ['RefreshStore', 'UpdateStore']) {
            const original = Game[methodName];
            const marker = '__touchDeviceFix_' + methodName;
            if (typeof original === 'function' && !Game[marker]) {
                Game[marker] = true;
                Game[methodName] = function () {
                    const result = original.apply(this, arguments);
                    apply();
                    return result;
                };
            }
        }

        if (typeof MutationObserver !== 'undefined' && !state.storeObserver) {
            state.storeObserver = new MutationObserver(function () {
                // Defer one frame so Cookie Clicker's store rebuild completes
                // before applying dimensions; observer ignores attributes.
                if (state.storeApplyQueued) return;
                state.storeApplyQueued = true;
                requestAnimationFrame(function () {
                    state.storeApplyQueued = false;
                    apply();
                });
            });
            const store = byId('store');
            if (store) state.storeObserver.observe(store, {
                childList: true,
                subtree: true
            });
        }

        if (!state.storeOpenTimer) state.storeOpenTimer = setInterval(apply, 1000);
    }

    /* ------------------------------------------------------------
     * 4. Two-second long press -> move the touched store upgrade in/out of
     *    the Vault. Normal tap still buys the upgrade.
     * ------------------------------------------------------------ */
    function installVaultLongPress() {
        const store = byId('store');
        if (!store || store.__touchDeviceFixVaultBound) return;

        function clearLongPress() {
            if (state.longPressTimer) {
                clearTimeout(state.longPressTimer);
                state.longPressTimer = 0;
            }
            state.longPressTarget = null;
        }

        function getUpgradeFromElement(el, root) {
            if (!el || !el.id) return null;
            const match = el.id.match(/^(?:upgrade|vaultUpgrade)(\d+)$/);
            if (!match) return null;
            const id = Number(match[1]);
            if (!Number.isInteger(id) || id < 0) return null;

            // DOM suffixes refer to the upgrade's stable game ID, not its
            // current position in UpgradesInStore or in a filtered vault list.
            const upgrade = Game.UpgradesById && Game.UpgradesById[id];
            if (!upgrade) return null;
            if (root.id === 'vaultUpgrades') {
                if (typeof upgrade.isVaulted === 'function' && upgrade.isVaulted()) {
                    return upgrade;
                }
                return null;
            }
            return upgrade;
        }

        // Delegate from #store so the handler also works if Cookie Clicker
        // recreates #vaultUpgrades after the MOD has initialized.
        store.__touchDeviceFixVaultBound = true;

        addEvent(store, 'touchstart', function (e) {
            if (!Game.Has('Inspired checklist')) return;
            if (!e.touches || e.touches.length !== 1) return;

            const target = e.target && e.target.closest ? e.target.closest('.crate.upgrade') : null;
            if (!target) return;
            const root = target.closest('#upgrades, #vaultUpgrades');
            if (!root) return;

            const touch = e.touches[0];
            const upgrade = getUpgradeFromElement(target, root);
            if (!upgrade || upgrade.pool === 'toggle' || upgrade.pool === 'tech') return;

            clearLongPress();
            state.longPressTarget = { upgrade: upgrade, root: root };
            state.longPressStartX = touch.clientX;
            state.longPressStartY = touch.clientY;

            state.longPressTimer = setTimeout(function () {
                const entry = state.longPressTarget;
                state.longPressTimer = 0;
                if (!entry || !Game.Has('Inspired checklist')) {
                    state.longPressTarget = null;
                    return;
                }

                const me = entry.upgrade;
                if (!me || me.pool === 'toggle' || me.pool === 'tech') {
                    state.longPressTarget = null;
                    return;
                }

                if (typeof me.vault === 'function') me.vault();
                Game.upgradesToRebuild = 1;
                Game.storeToRebuild = 1;
                state.suppressNextUpgradeClick = true;
                state.longPressTarget = null;
                playTick();
            }, 2000);
        }, { passive: true });

        addEvent(store, 'touchmove', function (e) {
            if (!state.longPressTimer || !e.touches || !e.touches[0]) return;
            const touch = e.touches[0];
            const dx = touch.clientX - state.longPressStartX;
            const dy = touch.clientY - state.longPressStartY;
            if (dx * dx + dy * dy > 100) clearLongPress();
        }, { passive: true });

        addEvent(store, 'touchend', function () {
            if (state.longPressTimer) clearLongPress();
        }, { passive: true });

        addEvent(store, 'touchcancel', function () {
            clearLongPress();
            state.suppressNextUpgradeClick = false;
        }, { passive: true });

        addEvent(store, 'click', function (e) {
            if (!state.suppressNextUpgradeClick) return;
            state.suppressNextUpgradeClick = false;
            e.preventDefault();
            e.stopImmediatePropagation();
        }, true);
    }

    /* ------------------------------------------------------------
     * Add a 「全部」 choice to the building purchase-amount controls.
     * Cookie Clicker's native -1 bulk mode means buy the maximum affordable.
     * ------------------------------------------------------------ */
    function installBuyAllButton() {
        const store = byId('store');
        if (!store || store.__touchDeviceFixBuyAllBound) return;
        store.__touchDeviceFixBuyAllBound = true;

        const apply = function () {
            const maxButton = byId('storeBulkMax');
            if (!maxButton) return;

            if (maxButton.textContent.trim() !== '全部') {
                maxButton.textContent = '全部';
            }
            if (maxButton.getAttribute('aria-label') !== '全部購入') {
                maxButton.setAttribute('aria-label', '全部購入');
            }
            if (maxButton.title !== '購入可能な最大数を購入') {
                maxButton.title = '購入可能な最大数を購入';
            }
        };

        apply();
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(function () {
                // Avoid a tight observer loop if the game rebuilds the button.
                if (state.buyAllApplyQueued) return;
                state.buyAllApplyQueued = true;
                requestAnimationFrame(function () {
                    state.buyAllApplyQueued = false;
                    apply();
                });
            });
            observer.observe(store, { childList: true, subtree: true });
        }
        setInterval(apply, 1000);

        // The game's existing MAX button already switches to its native
        // maximum-purchase mode; only its visible label is changed to 「全部」.
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
        installBuyAllButton();
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
