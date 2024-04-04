import { Client } from "@elastic/elasticsearch"
import { handleKeyAction, handleMemePost } from "."
import { EState } from "../constants"
import { TState, TTelegrafContext } from "../types"

export const handleCallbackQuery = async (ctx: TTelegrafContext, elastic: Client, states: Record<EState, TState<EState>>) => {
  // @ts-expect-error Property 'data' does not exist on type 'CallbackQuery'
  const callbackQuery = ctx.update.callback_query.data
  const [state, ...restCb] = callbackQuery.split('|')
  if (state === 'post') {
    await handleMemePost(elastic, ctx, restCb[0], restCb[1])
    return
  }
  if (state === 'key') {
    await handleKeyAction(ctx, restCb[0], restCb[1])
    return
  }
  await states[ctx.session.state].onCallback(ctx, callbackQuery)
}
