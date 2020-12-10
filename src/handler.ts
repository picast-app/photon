import type { APIGatewayEvent, SNSEvent } from 'aws-lambda'
import sharp from 'sharp'
import { Headers } from './utils/http'
import download from './utils/download'
import handleTask, { Task } from './task'

export const onTheFly = async (event: APIGatewayEvent) => {
  const url = event.requestContext.path?.replace(/^\//, '')
  if (!/^https?:\/\//.test(url)) return { statusCode: 404 }

  const data = await download(url)

  const format = new Headers(event.headers).get('accept')?.includes('webp')
    ? 'webp'
    : 'jpeg'
  const size = parseInt(event.queryStringParameters?.size ?? '256')
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

export const resize = async (event: SNSEvent) => {
  const tasks: Task[] = event.Records.map(({ Sns }) => JSON.parse(Sns.Message))
  console.log(tasks)
  await Promise.all(tasks.map(handleTask))
}
