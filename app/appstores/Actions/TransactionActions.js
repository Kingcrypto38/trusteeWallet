/**
 * @version 0.9
 */
import store from '../../store'

import transactionDS from '../DataSource/Transaction/Transaction'

import Log from '../../services/Log/Log'

import BlocksoftPrettyNumbers from '../../../crypto/common/BlocksoftPrettyNumbers'
import BlocksoftDict from '../../../crypto/common/BlocksoftDict'
import DaemonCache from '../../daemons/DaemonCache'
import UpdateTradeOrdersDaemon from '../../daemons/back/UpdateTradeOrdersDaemon'
import BlocksoftUtils from '../../../crypto/common/BlocksoftUtils'
import RateEquivalent from '../../services/UI/RateEquivalent/RateEquivalent'
import config from '../../config/config'

const { dispatch } = store

const transactionActions = {

    /**
     * @param {object} transaction
     * @param {string} transaction.currencyCode
     * @param {string} transaction.walletHash
     * @param {string} transaction.accountId
     * @param {string} transaction.transactionHash
     * @param {string} transaction.transactionStatus
     * @param {string} transaction.addressTo
     * @param {string} transaction.addressFrom
     * @param {string} transaction.addressAmount
     * @param {string} transaction.transactionFee
     * @param {string} transaction.transactionOfTrusteeWallet
     * @param {string} transaction.transactionsScanLog
     * @param {string} transaction.transactionJson
     * @param {string} transaction.bseOrderID
     * @param {string} transaction.createdAt: new Date().toISOString(),
     * @param {string} transaction.updatedAt: new Date().toISOString()
     */
    saveTransaction: async (transaction, source = '') => {

        try {

            await transactionDS.saveTransaction(transaction, false,source)

            const account = JSON.parse(JSON.stringify(store.getState().mainStore.selectedAccount))

            if (transaction.currencyCode === account.currencyCode) {

                // @todo page reload
            }

            if (typeof transaction.bseOrderID !== 'undefined') {
                UpdateTradeOrdersDaemon.updateTradeOrdersDaemon({ force: true })
            }

            DaemonCache.cleanCacheTxsCount(transaction)

        } catch (e) {

            Log.err('ACT/Transaction saveTransaction ' + e.message)
        }

    },

    /**
     *
     * @param transaction.accountId
     * @param transaction.transactionHash
     * @param transaction.transactionUpdateHash
     * @param transaction.transactionsOtherHashes
     * @param transaction.transactionJson
     * @param transaction.addressAmount
     * @param transaction.addressTo
     * @param transaction.transactionStatus
     * @param transaction.transactionFee
     * @param transaction.transactionFeeCurrencyCode
     * @returns {Promise<void>}
     */
    updateTransaction: async (transaction) => {
        try {

            await transactionDS.updateTransaction(transaction)

            const account = JSON.parse(JSON.stringify(store.getState().mainStore.selectedAccount))

            if (typeof transaction.accountId === 'undefined' || transaction.accountId === account.accountId) {

                const prepared = { ...account }

                let transactionHash
                const newTransactions = {}
                for (transactionHash in prepared.transactions) {
                    if (transactionHash === transaction.transactionUpdateHash) {
                        const tx = prepared.transactions[transactionHash]
                        tx.id = transaction.transactionHash
                        tx.transactionHash = transaction.transactionHash
                        tx.transactionsOtherHashes = transaction.transactionsOtherHashes
                        tx.transactionJson = transaction.transactionJson
                        if (typeof transaction.addressAmount !== 'undefined') {
                            tx.addressAmount = transaction.addressAmount
                        }
                        if (typeof transaction.addressTo !== 'undefined') {
                            tx.addressTo = transaction.addressTo
                        }
                        if (typeof transaction.transactionStatus !== 'undefined') {
                            tx.transactionStatus = transaction.transactionStatus
                        }
                        if (typeof transaction.transactionFee !== 'undefined') {
                            tx.transactionFee = transaction.transactionFee
                        }
                        if (typeof transaction.transactionFeeCurrencyCode !== 'undefined') {
                            tx.transactionFeeCurrencyCode = transaction.transactionFeeCurrencyCode
                        }
                        newTransactions[transaction.transactionHash] = tx
                    } else {
                        newTransactions[transactionHash] = prepared.transactions[transactionHash]
                    }
                }
                prepared.transactions = newTransactions

                dispatch({
                    type: 'SET_SELECTED_ACCOUNT',
                    selectedAccount: prepared
                })
            }

        } catch (e) {
            if (config.debug.appErrors) {
                console.log('ACT/Transaction updateTransaction ' + e.message)
                console.log(e)
            }
            Log.err('ACT/Transaction updateTransaction ' + e.message)
        }
    },

    preformatWithBSEforShowInner(transaction) {
        const direction = transaction.transactionDirection
        transaction.addressAmountPrettyPrefix = (direction === 'outcome' || direction === 'self' || direction === 'freeze') ? '-' : '+'
        if (typeof transaction.wayType === 'undefined' || !transaction.wayType) {
            transaction.wayType = transaction.transactionDirection
        }
        return transaction
    },

    preformatWithBSEforShow(_transaction, exchangeOrder, _currencyCode = false) {
        if (typeof exchangeOrder === 'undefined' || !exchangeOrder || exchangeOrder === null) {
            _transaction.bseOrderData = false // for easy checks
            _transaction.transactionOfTrusteeWallet = false
            _transaction = this.preformatWithBSEforShowInner(_transaction)
            return _transaction
        }

        const transaction = _transaction ? JSON.parse(JSON.stringify(_transaction)) : {
            currencyCode: _currencyCode,
            transactionHash: exchangeOrder.orderHash,
            transactionDirection : 'outcome',
            transactionOfTrusteeWallet : false,
            transactionStatus : '?',
            addressTo : '?',
            addressFrom : '?',
            addressAmountPretty: '?',
            blockConfirmations : false,
            blockNumber : false,
            createdAt: exchangeOrder.createdAt,
            bseOrderData : exchangeOrder
        }

        if (typeof exchangeOrder.status !== 'undefined' && exchangeOrder.status) {
            transaction.transactionStatus = exchangeOrder.status
        }
        if (typeof exchangeOrder.exchangeWayType !== 'undefined') {
            transaction.wayType = exchangeOrder.exchangeWayType
            if (exchangeOrder.outDestination && exchangeOrder.outDestination.includes('+')) {
                transaction.wayType = 'MOBILE_PHONE'
            }

            if (exchangeOrder.exchangeWayType === 'BUY') {
                transaction.transactionDirection = 'income'
            } else if (exchangeOrder.exchangeWayType === 'SELL') {
                transaction.transactionDirection = 'outcome'
            } else if (exchangeOrder.exchangeWayType === 'EXCHANGE') {
                if (typeof exchangeOrder.requestedOutAmount !== 'undefined' && typeof exchangeOrder.requestedOutAmount.currencyCode !== 'undefined') {
                    if (exchangeOrder.requestedOutAmount.currencyCode !== transaction.currencyCode) {
                        transaction.transactionDirection = 'income'
                    } else {
                        transaction.transactionDirection = 'outcome'
                    }
                }
            }
        }

        if (transaction.transactionDirection === 'income' && typeof exchangeOrder.requestedOutAmount !== 'undefined' && typeof exchangeOrder.requestedOutAmount.amount !== 'undefined') {
            transaction.addressAmountPretty = exchangeOrder.requestedOutAmount.amount
            if (!transaction.currencyCode) {
                transaction.currencyCode = exchangeOrder.requestedOutAmount.currencyCode
            }
        }
        if (transaction.transactionDirection === 'outcome' && typeof exchangeOrder.requestedInAmount !== 'undefined' && typeof exchangeOrder.requestedInAmount.amount !== 'undefined') {
            transaction.addressAmountPretty = exchangeOrder.requestedInAmount.amount
            if (!transaction.currencyCode) {
                transaction.currencyCode = exchangeOrder.requestedInAmount.currencyCode
            }
        }
        return this.preformatWithBSEforShowInner(transaction)
    },

    /**
     *
     * @param transaction
     * @param params.currencyCode
     * @param params.account
     */
    preformat(transaction, params) {
        if (!transaction) return

        let addressAmountSatoshi = false

        let account
        if (typeof params.account !== 'undefined') {
            account = params.account
        } else {
            throw new Error('something wrong with TransactionActions.preformat params')
        }

        try {
            transaction.addressAmountNorm = BlocksoftPrettyNumbers.setCurrencyCode(account.currencyCode).makePretty(transaction.addressAmount, 'transactionActions.addressAmount')
            const res = BlocksoftPrettyNumbers.makeCut(transaction.addressAmountNorm)
            if (res.isSatoshi) {
                addressAmountSatoshi = '...' + transaction.addressAmount
                transaction.addressAmountPretty = res.cutted
            } else {
                transaction.addressAmountPretty = res.separated
            }
        } catch (e) {
            e.message += ' on addressAmountPretty'
            throw e
        }

        transaction.basicCurrencySymbol = account.basicCurrencySymbol
        transaction.basicAmountPretty = 0

        transaction.addressAmountSatoshi = addressAmountSatoshi
        if (!addressAmountSatoshi) {
            try {
                if (account.basicCurrencyRate === 1) {
                    transaction.basicAmountNorm = transaction.addressAmountNorm
                } else {
                    transaction.basicAmountNorm = transaction.addressAmountNorm * account.basicCurrencyRate
                }
                transaction.basicAmountPretty = BlocksoftPrettyNumbers.makeCut(transaction.basicAmountNorm, 2).separated
            } catch (e) {
                e.message += ' on basicAmountPretty ' + transaction.addressAmountPretty
                throw e
            }
        }

        transaction.basicFeePretty = 0
        transaction.basicFeeCurrencySymbol = ''

        let feeRates, feeCurrencyCode
        if (transaction.transactionFeeCurrencyCode && transaction.transactionFeeCurrencyCode !== account.feesCurrencyCode) {
            feeCurrencyCode = transaction.transactionFeeCurrencyCode
            const extendedFeesCode = BlocksoftDict.getCurrencyAllSettings(transaction.transactionFeeCurrencyCode)
            transaction.feesCurrencySymbol = extendedFeesCode.currencySymbol || extendedFeesCode.currencyCode
            feeRates = DaemonCache.getCacheRates(transaction.transactionFeeCurrencyCode)
        } else {
            feeCurrencyCode = account.feesCurrencyCode
            transaction.feesCurrencySymbol = account.feesCurrencySymbol
            feeRates = account.feeRates
        }

        let getBasic = true

        if (typeof transaction.transactionFee === 'undefined') {
            Log.log('ACT/Transaction preformat bad transactionFee ' + JSON.stringify(transaction.transactionFee))
            transaction.transactionFee = 0
            transaction.transactionFeePretty = 0
        } else if (!transaction.transactionFee || transaction.transactionFee === 0) {
            transaction.transactionFee = 0
            transaction.transactionFeePretty = 0
        } else {
            try {
                const tmp = BlocksoftPrettyNumbers.setCurrencyCode(feeCurrencyCode).makePretty(transaction.transactionFee, 'transactionActions.fee')
                const tmp2 = BlocksoftUtils.fromENumber(tmp*1)
                const res = BlocksoftPrettyNumbers.makeCut(tmp2, 7)
                if (res.isSatoshi) {
                    getBasic = false
                    transaction.transactionFeePretty =  '...' + transaction.transactionFee
                    if (transaction.feesCurrencySymbol === 'ETH') {
                        transaction.feesCurrencySymbol = 'wei'
                    } else if (transaction.feesCurrencySymbol === 'BTC' || transaction.feesCurrencySymbol === 'BTC') {
                        transaction.feesCurrencySymbol = 'sat'
                    }
                } else {
                    transaction.transactionFeePretty = res.cutted
                }
            } catch (e) {
                e.message += ' on transactionFeePretty with tx ' + JSON.stringify(transaction)
                throw e
            }
        }

        try {
            if (!transaction.transactionFee) {
                transaction.transactionFee = 0
            }
            if (feeRates) {
                transaction.basicFeeCurrencySymbol = feeRates.basicCurrencySymbol
                if (feeRates.basicCurrencyRate === 1) {
                    transaction.basicFeePretty = BlocksoftPrettyNumbers.makeCut(transaction.transactionFeePretty, 2).justCutted
                } else if (getBasic) {
                    transaction.basicFeePretty = BlocksoftPrettyNumbers.makeCut(BlocksoftUtils.mul(transaction.transactionFeePretty, feeRates.basicCurrencyRate), 2).justCutted
                } else {
                    transaction.basicFeePretty = '0'
                }
            }
        } catch (e) {
            e.message += ' on basicFeePretty'
            throw e
        }

        return transaction

    }

}

export default transactionActions
