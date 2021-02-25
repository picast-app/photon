import type { APIGatewayEvent, SNSEvent } from 'aws-lambda'
import sharp from 'sharp'
import { Headers } from './utils/http'
import download from './utils/download'
import handleTask, { Task } from './task'

export const onTheFly = async (event: APIGatewayEvent) => {
  let url = event.requestContext.path?.replace(/^\//, '')
  let size = 256

  if (/^\d+\//.test(url)) {
    size = Math.min(parseInt(url.split('/')[0]), 2048)
    url = url.replace(/^\d+\//, '')
  }

  if (!/^https?:\/\//.test(url)) return { statusCode: 400 }

  const qStr =
    event.queryStringParameters &&
    Object.entries(event.queryStringParameters).length
      ? `?${Object.entries(event.queryStringParameters)
          .map(([k, v]) => `${k}=${v}`)
          .join('&')}`
      : ''

  const data = await download(url + qStr)

  const format = new Headers(event.headers).get('accept')?.includes('webp')
    ? 'webp'
    : 'jpeg'

  const out = await sharp(data)
    .resize(size, size, { withoutEnlargement: true })
    .toFormat(format)
    .toBuffer()

  try {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': `image/${format}`,
        'Cache-Control': 'public, max-age=2592000, immutable',
        'Access-Control-Allow-Origin': 'https://picast.app',
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

export const resize = async (event: SNSEvent) => {
  const tasks: Task[] = event.Records.map(({ Sns }) => JSON.parse(Sns.Message))
  console.log(tasks)
  await Promise.all(tasks.map(handleTask))
}
