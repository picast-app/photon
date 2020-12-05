import type { APIGatewayEvent } from 'aws-lambda'
import axios from 'axios'

export const onTheFly = async (event: APIGatewayEvent) => {
  const url = event.requestContext.path.replace(/^\//, '')
  console.log({ url })

  const { data, headers } = await axios.get(url, {
    responseType: 'arraybuffer',
  })

  console.log(headers)

  return {
    statusCode: 200,
    headers: Object.fromEntries(
      Object.entries(headers).filter(([k]) => /^content-/i.test(k))
    ),
    body: Buffer.from(data, 'binary').toString('base64'),
    isBase64Encoded: true,
  }
}
