import amqplib from 'amqplib'
import { Telegraf } from 'telegraf'
import { TTelegrafContext } from '../types'
import process from 'process'
import 'dotenv/config'
import { getAmqpQueue } from '../../../../utils'
import {
  AMQP_PUBLISHER_DISTRIBUTION_CHANNEL,
  EMPTY_QUEUE_RETRY_DELAY,
} from '../../../../../constants'
import { delay, getDbConnection } from '../../../../../utils'
import { Logger } from 'winston'
import fs from 'fs/promises'
import { selectPublisherChannelsById } from '../../../../../utils/mysql-queries'
import { ECallback, EKeywordAction } from '../constants'
import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram'
import { TPublisherDistributionQueueMsg } from '../../../../types'

export const handleDistributionQueue = async (bot: Telegraf<TTelegrafContext>, logger: Logger) => {
  const amqp = await amqplib.connect(process.env.AMQP_ENDPOINT)
  const [distributionCh, distributionTimeout, distributionTimeotClear] = await getAmqpQueue(
    amqp,
    AMQP_PUBLISHER_DISTRIBUTION_CHANNEL,
  )

  try {
    for (;;) {
      const msg = await distributionCh.get(AMQP_PUBLISHER_DISTRIBUTION_CHANNEL)
      if (!msg) {
        await delay(EMPTY_QUEUE_RETRY_DELAY)
        continue
      }
      distributionTimeout(600_000, logger, msg)
      const payload = JSON.parse(msg.content.toString()) as TPublisherDistributionQueueMsg

      const buttons: InlineKeyboardButton.CallbackButton[][] = []
      const db = await getDbConnection()
      const channels = await selectPublisherChannelsById(db, payload.channelIds)
      await db.close()

      channels.forEach(channel => {
        if (channel.id === Number(payload.userId)) return null
        buttons.push([
          {
            text: `➡️ Отправить в @${channel.username}`,
            callback_data: `${ECallback.POST}|${channel.id}|${payload.memeId}`,
          },
        ])
      })

      payload.keywords.forEach(keyword =>
        buttons.push([
          {
            text: `🗑️ «${keyword}» (отписаться)`,
            callback_data: `${ECallback.KEY}|${EKeywordAction.DELETE}|${keyword}`,
          },
        ]),
      )

      payload.keywordGroups.forEach(keywordGroup =>
        buttons.push([
          {
            text: `🗑️ «${keywordGroup}» (отписаться)`,
            callback_data: `${ECallback.GROUP}|${EKeywordAction.DELETE}|${keywordGroup}`,
          },
        ]),
      )

      try {
        await bot.telegram.sendPhoto(
          payload.userId,
          {
            source: await fs.readFile(payload.document.fileName),
          },
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: buttons,
            },
            caption: `[источник](https://t.me/${payload.document.channelName}/${payload.document.messageId}) / [web](https://${process.env.MEMEPLEX_WEBSITE_DOMAIN}/memes/${payload.memeId})`,
          },
        )
        distributionCh.ack(msg)
      } catch (e) {
        logger.error(e)
        distributionCh.nack(msg)
        await delay(1000)
      }
    }
  } finally {
    distributionTimeotClear()
    if (distributionCh) await distributionCh.close()
    if (amqp) await amqp.close()
  }
}
