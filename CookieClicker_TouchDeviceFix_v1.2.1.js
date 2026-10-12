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
    const MOD_VERSION = '1.2.1';

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
        // Keep the switch header visible, but never force its dimensions.
        // Only the actual content panels receive sizing styles, so they stay
        // in normal document flow instead of making the store jump.
        const contentSectionIds = ['upgrades', 'vaultUpgrades'];

        const apply = function () {
            const switchHeader = byId('toggleUpgrades');
            if (switchHeader) {
                switchHeader.style.setProperty('display', 'block', 'important');
                // Do not set height / max-height / overflow on this header.
            }

            for (const id of contentSectionIds) {
                const el = byId(id);
                if (!el) continue;
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

        function getUpgradeFromElement(el) {
            if (!el) return null;

            // The DOM ID suffix is a display-list index, not the upgrade ID.
            // Read the actual stable ID from Cookie Clicker's own click handler.
            const clickCode = el.getAttribute('onclick') || '';
            let match = clickCode.match(/UpgradesById\[(\d+)\]\.click\s*\(/);

            // Some versions put the handler on a descendant or use a different
            // formatting style, so inspect the rendered element's attributes too.
            if (!match) {
                for (const attr of Array.from(el.attributes || [])) {
                    if (/^on/i.test(attr.name)) {
                        match = String(attr.value).match(/UpgradesById\[(\d+)\]\.click\s*\(/);
                        if (match) break;
                    }
                }
            }

            if (match) {
                const id = Number(match[1]);
                return Game.UpgradesById && Game.UpgradesById[id] || null;
            }

            // Fallback for builds where the click handler is attached as a listener:
            // use the vault's saved upgrade IDs when the item is in the Vault.
            if (el.id && el.id.indexOf('vaultUpgrade') === 0 && Array.isArray(Game.vault)) {
                const index = Number(el.id.slice('vaultUpgrade'.length));
                if (Number.isInteger(index) && Game.UpgradesById[Game.vault[index]]) {
                    return Game.UpgradesById[Game.vault[index]];
                }
            }
            return null;
        }

        function isVaulted(upgrade) {
            if (!upgrade) return false;
            if (typeof upgrade.isVaulted === 'function') return !!upgrade.isVaulted();
            return Array.isArray(Game.vault) && Game.vault.indexOf(upgrade.id) !== -1;
        }

        function toggleVault(upgrade, wasInVault) {
            if (!Array.isArray(Game.vault)) return false;

            const index = Game.vault.indexOf(upgrade.id);
            if (wasInVault) {
                if (index !== -1) Game.vault.splice(index, 1);
            } else if (index === -1) {
                Game.vault.push(upgrade.id);
            }

            Game.upgradesToRebuild = 1;
            Game.storeToRebuild = 1;
            if (typeof Game.UpdateMenu === 'function') Game.UpdateMenu();
            return true;
        }

        store.__touchDeviceFixVaultBound = true;

        addEvent(store, 'touchstart', function (e) {
            if (!Game.Has('Inspired checklist')) return;
            if (!e.touches || e.touches.length !== 1) return;

            const target = e.target && e.target.closest ? e.target.closest('.crate.upgrade') : null;
            if (!target) return;
            const root = target.closest('#upgrades, #vaultUpgrades');
            if (!root) return;

            const touch = e.touches[0];
            const upgrade = getUpgradeFromElement(target);
            if (!upgrade || upgrade.pool === 'toggle' || upgrade.pool === 'tech') return;

            clearLongPress();
            state.longPressTarget = {
                upgrade: upgrade,
                rootId: root.id,
                wasInVault: isVaulted(upgrade)
            };
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

                // Update Game.vault directly. The native DOM ID is only a list
                // index, and current game versions do not expose an unvault() method.
                const nowVaulted = isVaulted(me);
                if (toggleVault(me, nowVaulted)) {
                    state.suppressNextUpgradeClick = true;
                    state.longPressTarget = null;
                    playTick();
                }
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
     * Keep this choice selected when switching between buying and selling.
     * ------------------------------------------------------------ */
    function installBuyAllButton() {
        const store = byId('store');
        const bulk = byId('storeBulk');
        const products = byId('products');
        if (!store || !bulk || !products || store.__touchDeviceFixBuyAllBound) return;
        store.__touchDeviceFixBuyAllBound = true;

        const buttonId = 'touchDeviceFixBuyAll';
        let buyAllMode = false;
        let buyAllButton = null;

        function selectAllAmount() {
            buyAllMode = true;
            if (typeof Game.storeBulkButton === 'function') {
                // Use the game's native unlimited mode first. The game changes
                // this to 100 while buying, so buying is handled below instead.
                Game.storeBulkButton(5);
                if (Game.buyMode === 1) Game.buyBulk = 100;
                else Game.buyBulk = -1;
            } else {
                Game.buyBulk = Game.buyMode === 1 ? 100 : -1;
            }
            apply();
        }

        function clearAllAmount() {
            buyAllMode = false;
            apply();
        }

        function getMaxAffordable(building) {
            if (!building || typeof building.getSumPrice !== 'function') return 0;
            const cookies = Number(Game.cookies) || 0;
            let low = 0;
            let high = 1;
            const cap = 1000000000;

            while (high < cap && building.getSumPrice(high) <= cookies) {
                low = high;
                high = Math.min(high * 2, cap);
            }
            if (building.getSumPrice(high) <= cookies) return high;

            while (low + 1 < high) {
                const mid = Math.floor((low + high) / 2);
                if (building.getSumPrice(mid) <= cookies) low = mid;
                else high = mid;
            }
            return low;
        }

        function ensureButton() {
            const nativeMax = byId('storeBulkMax');
            if (!byId('storeBulk') || !nativeMax) return;
            const existing = byId(buttonId);
            if (existing) {
                buyAllButton = existing;
                return;
            }

            // Clone the game's button for matching appearance, but remove its
            // native MAX click handler so it cannot change the selected amount.
            buyAllButton = nativeMax.cloneNode(true);
            buyAllButton.id = buttonId;
            buyAllButton.textContent = '全部';
            buyAllButton.title = '購入・売却する数を全部にする';
            buyAllButton.setAttribute('aria-label', '全部');
            Array.from(buyAllButton.attributes).forEach(function (attr) {
                if (/^on/i.test(attr.name)) buyAllButton.removeAttribute(attr.name);
            });
            buyAllButton.style.visibility = 'visible';
            buyAllButton.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (buyAllMode) {
                    // Keep the choice active; tapping it again should not
                    // unexpectedly switch back to a numeric amount.
                    selectAllAmount();
                } else {
                    selectAllAmount();
                }
            });

            const hundred = byId('storeBulk100');
            if (hundred && hundred.parentNode) {
                hundred.parentNode.insertBefore(buyAllButton, hundred.nextSibling);
            } else {
                bulk.appendChild(buyAllButton);
            }
        }

        function apply() {
            ensureButton();
            if (!buyAllButton) return;

            const isBuying = Game.buyMode === 1;
            // Native MAX is hidden in buy mode and is the existing all-sell
            // choice in sell mode. Our button stays available in both modes.
            buyAllButton.style.visibility = 'visible';
            buyAllButton.classList.toggle('on', buyAllMode);

            ['storeBulk1', 'storeBulk10', 'storeBulk100', 'storeBulkMax'].forEach(function (id) {
                const button = byId(id);
                if (button && buyAllMode) button.classList.remove('on');
            });

            if (buyAllMode) {
                Game.buyBulk = isBuying ? 100 : -1;
            }
        }

        // Changing buy/sell mode preserves 「全部」. Selecting 1/10/100/MAX
        // explicitly cancels the custom all mode.
        addEvent(bulk, 'click', function (e) {
            const target = e.target && e.target.closest ? e.target.closest('button, div') : null;
            if (!target || target.id === buttonId) return;
            if (target.id === 'storeBulkBuy' || target.id === 'storeBulkSell') {
                if (buyAllMode) {
                    setTimeout(apply, 0);
                }
                return;
            }
            if (/^storeBulk(1|10|100|Max)$/.test(target.id)) {
                clearAllAmount();
            }
        });

        // In buy-all mode, intercept a building click and purchase the maximum
        // currently affordable quantity. Normal purchase behavior is untouched
        // when the custom choice is not selected.
        addEvent(document, 'click', function (e) {
            if (!buyAllMode || Game.buyMode !== 1) return;
            const product = e.target && e.target.closest ? e.target.closest('#products .product') : null;
            if (!product) return;
            const match = product.id.match(/^product(\d+)$/);
            if (!match) return;
            const building = Game.ObjectsById && Game.ObjectsById[Number(match[1])];
            if (!building) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const amount = getMaxAffordable(building);
            if (amount > 0 && typeof building.buy === 'function') building.buy(amount);
        }, true);

        apply();
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(function () {
                if (state.buyAllApplyQueued) return;
                state.buyAllApplyQueued = true;
                requestAnimationFrame(function () {
                    state.buyAllApplyQueued = false;
                    apply();
                });
            });
            observer.observe(bulk, { childList: true, subtree: true });
        }
        setInterval(apply, 1000);
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

    /* ------------------------------------------------------------
     * 6. Compact timer panel: autosave estimate and active buffs.
     * ------------------------------------------------------------ */
    function installTimerPanel() {
        if (byId('touchDeviceFixTimerPanel')) return;

        const panel = document.createElement('div');
        panel.id = 'touchDeviceFixTimerPanel';
        // Keep it at the top-right, away from the Mod Loader area at bottom-right.
        panel.style.cssText = 'position:fixed;right:8px;top:58px;z-index:100000;background:rgba(0,0,0,.72);color:#fff;padding:6px 8px;border:1px solid rgba(255,255,255,.25);border-radius:6px;font:11px/1.4 Arial,sans-serif;max-width:190px;max-height:35vh;overflow:auto;pointer-events:none;white-space:pre-line;';
        panel.innerHTML = '<b>タイマー</b><div id="touchDeviceFixGoldenTimer">GC：--</div><div id="touchDeviceFixReindeerTimer">トナカイ：--</div><div id="touchDeviceFixAutosave">オートセーブ：--</div><div id="touchDeviceFixBuffs">バフ：なし</div>';
        document.body.appendChild(panel);

        function fmt(seconds) {
            seconds = Math.max(0, Math.floor(seconds));
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            return h > 0
                ? String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
                : String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        }

        function update() {
            const goldenEl = byId('touchDeviceFixGoldenTimer');
            const reindeerEl = byId('touchDeviceFixReindeerTimer');
            const autosaveEl = byId('touchDeviceFixAutosave');
            const buffsEl = byId('touchDeviceFixBuffs');
            if (!goldenEl || !reindeerEl || !autosaveEl || !buffsEl || typeof Game === 'undefined') return;

            // Game.shimmerTypes[type].time is elapsed frames. Before minTime,
            // the spawn chance is exactly 0, so do not show a probability yet.
            // Once eligible, display the chance checked on each game frame:
            // ((time - minTime) / (maxTime - minTime)) ^ 5.
            function nextSpawnText(typeName, label) {
                const type = Game.shimmerTypes && Game.shimmerTypes[typeName];
                if (!type) return label + '：この環境では取得不可';
                if (type.spawned || (Game.shimmers || []).some(function (s) { return s.type === typeName; })) {
                    return label + '：出現中';
                }
                const elapsed = Math.max(0, Number(type.time) || 0);
                const minTime = Number(type.minTime);
                const maxTime = Number(type.maxTime);
                if (!Number.isFinite(minTime) || !Number.isFinite(maxTime) || maxTime <= minTime) {
                    return label + '：出現条件を取得できません';
                }
                if (elapsed < minTime) {
                    return label + '：出現待ち';
                }
                const progress = Math.max(0, Math.min(1, (elapsed - minTime) / (maxTime - minTime)));
                const chancePercent = Math.pow(progress, 5) * 100;
                return label + '：出現確率 ' + chancePercent.toFixed(2) + '%';
            }
            goldenEl.textContent = nextSpawnText('golden', 'GC');
            reindeerEl.textContent = nextSpawnText('reindeer', 'トナカイ');

            if (Game.prefs && Game.prefs.autosave === 0) {
                autosaveEl.textContent = 'オートセーブ：OFF';
            } else {
                // Do not invent a countdown: WriteSave is also called manually,
                // so it cannot reliably identify the next automatic save.
                autosaveEl.textContent = 'オートセーブ：ON（約60秒周期）';
            }

            const buffs = [];
            if (Game.buffs) {
                for (const name in Game.buffs) {
                    const buff = Game.buffs[name];
                    if (!buff || !(buff.time > 0)) continue;
                    const seconds = buff.time / (Game.fps || 30);
                    buffs.push((buff.name || name) + ' ' + fmt(seconds));
                }
            }
            buffsEl.textContent = buffs.length ? 'バフ：\n' + buffs.join('\n') : 'バフ：なし';
        }

        update();
        state.timerPanelInterval = setInterval(update, 500);
    }

    /* ------------------------------------------------------------
     * 7. Sugar lump type details in the native lump tooltip.
     * ------------------------------------------------------------ */
    function installSugarLumpInfo() {
        if (typeof Game.lumpTooltip !== 'function' || Game.__touchDeviceFixLumpTooltipWrapped) return;
        const originalTooltip = Game.lumpTooltip;
        Game.__touchDeviceFixLumpTooltipWrapped = true;
        const names = {
            0: '通常の砂糖玉',
            1: '二股の砂糖玉',
            2: '黄金の砂糖玉',
            3: '肉の砂糖玉',
            4: 'キャラメル化した砂糖玉'
        };
        const details = {
            0: '収穫量：通常1個',
            1: '収穫量：1～2個',
            2: '収穫量：2～7個。クッキー所持数増加と黄金クッキー出現率上昇の効果',
            3: '収穫量：0～2個。グランマポカリプス中に発生',
            4: '収穫量：1～3個。砂糖玉を使うクールダウンを回復'
        };
        Game.lumpTooltip = function () {
            let html = originalTooltip.apply(this, arguments);
            const type = Number(Game.lumpCurrentType);
            if (names[type] && typeof html === 'string') {
                html = html.replace(/<\/div>\s*$/, '<div class="line"></div><b>成長中の砂糖玉：</b>' + names[type] + '<br>' + details[type] + '</div>');
            }
            return html;
        };
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
        installTimerPanel();
        installSugarLumpInfo();

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
