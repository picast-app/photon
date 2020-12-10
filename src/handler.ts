import type { APIGatewayEvent } from 'aws-lambda'
import axios from 'axios'
import sharp from 'sharp'
import { Headers } from './utils/http'

export const onTheFly = async (event: APIGatewayEvent) => {
  const url = event.requestContext.path?.replace(/^\//, '')
  if (!/^https?:\/\//.test(url)) return { statusCode: 404 }

  const { data } = await axios.get(url, {
    responseType: 'arraybuffer',
  })

  const format = new Headers(event.headers).get('accept')?.includes('webp')
    ? 'webp'
    : 'jpeg'
  const size = parseInt(event.queryStringParameters?.width ?? '256')
  const out = await sharp(data)
    .resize(size, size, { withoutEnlargement: true })
    .toFormat(format)
    .toBuffer()

  try {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': `image/${format}`,
      },
      body: out.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (e) {
    console.error('failed to respond', e)
    return {
      statusCode: 500,
    }
  }
}
