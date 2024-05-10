import { EState } from '../constants'
import { TMenuButton, TState } from '../types'
import { enterToState, onClickAddMyself } from '../utils'
import { buyPremiumState, channelSettingState } from '.'
import { getDbConnection } from '../../../../../utils'
import { i18n } from '../i18n'
import { selectPublisherChannelsByUserId } from '../../../../../utils/mysql-queries'
import { Markup } from 'telegraf'
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram'

export const mainState: TState = {
  stateName: EState.MAIN,
  inlineMenu: async ctx => {
    if (!ctx.from) {
      throw new Error('There is no ctx.from')
    }
    const db = await getDbConnection()
    const userChannels = await selectPublisherChannelsByUserId(db, ctx.from.id)
    await db.close()

    const channelButtons: InlineKeyboardButton[][] = userChannels.map(({ id, username }) => [
      Markup.button.callback(i18n['ru'].button.channelSubscriptions(username), `${id}|${username}`),
    ])
    return {
      text: i18n['ru'].message.mainMenu(),
      buttons: [...channelButtons],
    }
  },
  menu: async ctx => {
    const linkYourChannelButton: TMenuButton = Markup.button.channelRequest(
      i18n['ru'].button.linkYourChannel(),
      0,
    )
    const buyPremium: TMenuButton = [
      ctx.hasPremiumSubscription
        ? i18n['ru'].button.extendPremium()
        : i18n['ru'].button.subscribeToPremium(),
      ctx => enterToState(ctx, buyPremiumState),
    ]
    const mySubscriptionsButton: TMenuButton = [
      i18n['ru'].button.mySubscriptions(),
      async () => {
        await onClickAddMyself(ctx)
        await enterToState(ctx, channelSettingState)
      },
    ]
    return {
      text: i18n['ru'].message.mainMenu(),
      buttons: [[mySubscriptionsButton], [linkYourChannelButton], [buyPremium]],
    }
  },
}
