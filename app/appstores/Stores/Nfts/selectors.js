/**
 * @version 0.50
 */
import { createSelector } from 'reselect'

export const getNftsData = createSelector(
    [state => state.nftsStore],
    (data => {
        return {
            address : data.address,
            derivationPath : data.derivationPath,
            loaded : data.loaded,
            nfts: data.nfts
        }
    })
)
