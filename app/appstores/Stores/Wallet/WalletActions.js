/**
 * @version 0.9
 */
import store from '@app/store'

import walletDS from '@app/appstores/DataSource/Wallet/Wallet'
import settingsActions from '@app/appstores/Stores/Settings/SettingsActions'

import Log from '@app/services/Log/Log'
import MarketingEvent from '@app/services/Marketing/MarketingEvent'

const { dispatch } = store

const walletActions = {

    setWalletsGeneralData: async (totalBalance, localCurrencySymbol) => {
        const oldData = store.getState().walletStore.walletsGeneralData
        if (oldData.totalBalance === totalBalance && oldData.localCurrencySymbol === localCurrencySymbol) {
             return false
        }
        dispatch({
            type: 'SET_WALLET_GENERAL_DATA',
            walletsGeneralData : {
                totalBalance,
                localCurrencySymbol
            }
        })
    },

    setAvailableWallets: async () => {
        Log.log('ACT/Wallet setAvailableWallets called')
        const wallets = await walletDS.getWallets()

        MarketingEvent.DATA.LOG_WALLETS_COUNT = wallets ? wallets.length.toString() : '0'
        Log.log('ACT/Wallet setAvailableWallets found', wallets)
        dispatch({
            type: 'SET_WALLET_LIST',
            wallets
        })

        return wallets
    },

    setSelectedSegwitOrNot: async function() {
        Log.log('ACT/MStore setSelectedSegwitOrNot called')
        let setting = await settingsActions.getSetting('btc_legacy_or_segwit')
        setting = setting === 'segwit' ? 'legacy' : 'segwit'
        await settingsActions.setSettings('btc_legacy_or_segwit', setting)
        Log.log('ACT/MStore setSelectedSegwitOrNot finished ' + setting)
        return setting
    },

    setUse: async (wallet) => {
        await walletDS.updateWallet(wallet)
    },

    setWalletBackedUpStatus: async (walletHash) => {
        await walletDS.updateWallet({ walletHash, walletIsBackedUp: 1 })

        const oldWallets = store.getState().walletStore.wallets
        let oldWalletsUpdated = false
        for (const oldWallet of oldWallets) {
            if (oldWallet.walletHash === walletHash) {
                oldWalletsUpdated = true
                oldWallet.walletIsBackedUp = 1
            }
        }
        if (oldWalletsUpdated) {
            dispatch({
                type: 'SET_WALLET',
                wallets: {...oldWallets}
            })
        }
    },

    getNewWalletName: async () => {
        const wallets = await walletDS.getWallets()

        if (typeof wallets === 'undefined' || !wallets || !wallets.length) {
            return 'TRUSTEE WALLET'
        }

        return 'TRUSTEE WALLET №' + (wallets.length)
    },

    setNewWalletName: async (walletHash, newName) => {
        try {
            let tmpNewWalletName = newName.replace(/'/g, '')

            if (tmpNewWalletName.length > 255) {
                tmpNewWalletName = tmpNewWalletName.slice(0, 255)
                newName = newName.slice(0, 255)
            }

            await walletDS.updateWallet({walletHash, walletName : tmpNewWalletName})

            const oldData = store.getState().mainStore.selectedWallet
            if (oldData && oldData.walletHash === walletHash) {
                oldData.walletName = newName
                dispatch({
                    type: 'SET_SELECTED_WALLET',
                    wallet : {...oldData}
                })
            }

            const oldWallets = store.getState().walletStore.wallets
            let oldWalletsUpdated = false
            for (const oldWallet of oldWallets) {
                if (oldWallet.walletHash === walletHash) {
                    oldWalletsUpdated = true
                    oldWallet.walletName = newName
                }
            }
            if (oldWalletsUpdated) {
                dispatch({
                    type: 'SET_WALLET',
                    wallets: {...oldWallets}
                })
            }

            return true
        } catch (e) {
            Log.err('walletActions.setNewWalletName error:', e.message)
            return false
        }
    }
}

export default walletActions
