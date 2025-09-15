import * as Delegation from '@ucanto/core/delegation'
import { Message } from '@ucanto/core'
import { CAR } from '@ucanto/transport'

/** @typedef {Array<{ invocation: Uint8Array }>} EgressEvents */

export default {
  async queue(batch, env) {
    try {
      console.log(`Processing batch of ${batch.messages.length} pre-built invocations`)
      
      /** @type {EgressEvents} */
      const egressEvents = batch.messages.map(msg => ({
        invocation: msg.body.invocation,
      }))
            
      await sendBatched(egressEvents, env)
      batch.ackAll() // Acknowledge all successful messages

      console.log(`Successfully processed batch of ${batch.messages.length} pre-built invocations`)
    } catch (error) {
      console.error(`Failed to process batch:`, error)
      batch.retryAll() // Retry all messages in the batch
      console.log(`Retrying batch of ${batch.messages.length} pre-built invocations`)
    }
  }
}

/**
 * Send a batch of pre-built invocations to the upload-api
 * 
 * @param {EgressEvents} events 
 * @param {import('./index.js').Env} env 
 */
async function sendBatched(events, env) {
  const response = await fetch(env.UPLOAD_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.ipld.car',
    },
    body: await createBatchedCAR(events)
  })
  
  if (!response.ok) {
    throw new Error(`Upload-API batch error: ${response.status} ${response.statusText}`)
  }
}

/**
 * Create a batched CAR file from pre-built egress/record UCAN invocations
 * 
 * @param {EgressEvents} events 
 * @returns {Promise<Uint8Array>}
 */
async function createBatchedCAR(events) {
  const invocations = await Promise.all(
    events.map(async (event) => {
      const result = await Delegation.extract(event.invocation)
      if (!result.ok) throw result.error
      return result.ok
    })
  )
  
  // Build message structure then encode to CAR for upload-api
  const message = await Message.build({ invocations })
  const agentMessage = await CAR.request.encode(message)
  return agentMessage.body
}
