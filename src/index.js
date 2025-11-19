import * as Delegation from '@ucanto/core/delegation'
import { Message } from '@ucanto/core'
import { CAR } from '@ucanto/transport'
import * as dagJSON from '@ipld/dag-json'

/** @typedef {Array<{ invocation: Uint8Array }>} EgressEvents */

export default {

  /**
   * Process a batch of pre-built invocations from the egress tracking queue
   * See wrangler.toml for batch configuration
   */
  async queue(batch, env) {
    try {
      console.log(`Processing batch of ${batch.messages.length} pre-built invocations`)
      
      /** @type {EgressEvents} */
      const egressEvents = batch.messages.map((msg, index) => {
        console.log(`Message ${index}: id=${msg.id}, timestamp=${msg.timestamp}`)
        
        // Cloudflare Queues serializes the Uint8Array from dagJSON.encode() as an object with numeric keys
        // Convert it back to Uint8Array, then decode the DAG-JSON
        const dagJsonBytes = new Uint8Array(Object.values(msg.body))
        console.log(`Message ${index} dagJsonBytes length:`, dagJsonBytes.length)
        
        const decoded = dagJSON.decode(dagJsonBytes)
        console.log(`Message ${index} decoded: messageId=${decoded.messageId}, timestamp=${decoded.timestamp}`)
        
        return {
          invocation: decoded.invocation,
        }
      })
            
      await sendBatched(egressEvents, env)
      batch.ackAll() // Acknowledge all successful messages

      console.log(`Successfully processed batch of ${batch.messages.length} pre-built invocations`)
    } catch (error) {
      console.error(`Failed to process batch:`, error)
      console.error(`Error name: ${error.name}`)
      console.error(`Error message: ${error.message}`)
      console.error(`Error stack: ${error.stack}`)
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
  console.log(`Preparing batch of ${events.length} pre-built invocations`)
  const response = await fetch(env.UPLOAD_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.ipld.car',
    },
    body: await createBatchedCAR(events)
  })
  console.log(`Sent batch of ${events.length} to ${env.UPLOAD_API_URL}`)
  console.log(`Response status: ${response.status} ${response.statusText}`)
  
  // Log response body for debugging
  const responseText = await response.text()
  console.log(`Response body: ${responseText}`)
  
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
  console.log(`Creating batched CAR from ${events.length} events`)
  
  const invocations = await Promise.all(
    events.map(async (event, index) => {
      try {
        console.log(`Extracting delegation ${index}: invocation type=${event.invocation.constructor.name}, length=${event.invocation.length}`)
        const result = await Delegation.extract(event.invocation)
        if (!result.ok) {
          console.error(`Delegation extraction failed for event ${index}:`, result.error)
          throw result.error
        }
        console.log(`Successfully extracted delegation ${index}`)
        return result.ok
      } catch (error) {
        console.error(`Error extracting delegation ${index}:`, error)
        throw error
      }
    })
  )
  
  console.log(`Building message from ${invocations.length} invocations`)
  // Build message structure then encode to CAR for upload-api
  const message = await Message.build({ invocations })
  console.log(`Encoding message to CAR`)
  const agentMessage = await CAR.request.encode(message)
  console.log(`CAR created, size: ${agentMessage.body.length} bytes`)
  return agentMessage.body
}
