import type { Chat } from 'telegraf/typings/core/types/typegram'
import { enterToState, logUserAction } from '.'
import { getDbConnection, getTgChannelName, logInfo } from '../../../../../utils'
import { selectBotChannelById, upsertBotChannel } from '../../../../../utils/mysql-queries'
import { channelSettingState } from '../states'
import { i18n } from '../i18n'
import type { TTelegrafContext } from '../types'

export const addChannel = async (ctx: TTelegrafContext, text: string) => {
  const channel = getTgChannelName(text)
  if (!channel) {
    await ctx.reply(i18n['ru'].message.checkChannelNameFormat())
    await logUserAction(ctx, {
      error: `Incorrect channel link`,
      channel: text,
    })
    return
  }
  const readyButton = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: i18n['ru'].button.ready(),
            callback_data: channel,
          },
        ],
      ],
    },
  }
  let chat: Chat.ChannelGetChat | undefined
  try {
    const result = await ctx.telegram.getChat(`@${channel}`)
    if ('title' in result && 'accent_color_id' in result) {
      chat = result
    } else {
      await ctx.reply(i18n['ru'].message.addedUserInsteadOfChannel())

      await logUserAction(ctx, {
        error: `Adding a private channel`,
        channel,
      })
      return
    }
  } catch (error) {
    await ctx.reply(i18n['ru'].message.checkChannelName())
    return
  }
  let isOurUserAnAdmin: true | undefined
  let isOurBotAnAdmin: true | undefined
  try {
    const administrators = await ctx.telegram.getChatAdministrators(`@${channel}`)
    administrators.some(admin => {
      if (!isOurUserAnAdmin && admin.user.id === ctx.from?.id) {
        isOurUserAnAdmin = true
      } else if (!isOurBotAnAdmin && admin.user.id === ctx.botInfo.id) {
        isOurBotAnAdmin = true
      }
      return isOurUserAnAdmin && isOurBotAnAdmin
    })
  } catch (error) {
    await ctx.reply(i18n['ru'].message.botMustBeInTheChannelAndHaveAdminRights(), readyButton)
    if (error instanceof Error) await logInfo(ctx.logger, error)
    return
  }
  if (!isOurUserAnAdmin) {
    await ctx.reply(i18n['ru'].message.onlyAdminCanSubscribeChannel())
    await logUserAction(ctx, {
      error: `The user not an admin`,
      channel,
    })
    return
  }
  if (!isOurBotAnAdmin) {
    await ctx.reply(i18n['ru'].message.botMustHaveAdminRights(), readyButton)
    await logUserAction(ctx, {
      error: `Admin rights not granted`,
      channel,
    })
    return
  }

  const subscribers = await ctx.telegram.getChatMembersCount(`@${channel}`)
  const db = await getDbConnection()
  const [channelInDb] = await selectBotChannelById(db, chat.id)
  if (channelInDb && channelInDb.userId === ctx.from.id) {
    await ctx.reply(i18n['ru'].message.channelAlredyAdded())
    return
  }
  const timestamp = Date.now() / 1000
  const [newChannelInDb] = await upsertBotChannel(db, {
    telegramId: chat.id,
    userId: ctx.from.id,
    username: channel,
    subscribers,
    type: chat.type,
    timestamp,
  })
  await db.close()
  ctx.session.channel = {
    id: newChannelInDb.insertId,
    telegramId: chat.id,
    name: channel,
    type: chat.type,
  }
  await ctx.reply(i18n['ru'].message.addedChannel(channel))
  await logUserAction(ctx, {
    info: `Added`,
    channel,
  })
  await enterToState(ctx, channelSettingState)
  return
}
