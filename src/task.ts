import download from './utils/download'
import sharp, { Sharp } from 'sharp'
import * as s3 from './utils/s3'

export type Task = {
  podcast: string
  episode?: string
  url: string
}

type Format = 'png' | 'jpeg' | 'webp'

const TO_SIZES = [128, 256, 512, 1024]
const TO_FORMATS: Format[] = ['jpeg', 'webp']

export default async function handleTask(task: Task) {
  const raw = await download(task.url)

  const img = sharp(raw)

  const meta = await img.metadata()
  const maxSize = Math.min(meta.width, meta.height)

  const sizes =
    maxSize >= TO_SIZES.slice(-1)[0]
      ? TO_SIZES
      : [...TO_SIZES.filter((n) => n < maxSize), maxSize]

  const out = sizes
    .map((size) => ({
      size,
      img: img.clone().resize(size, size, {
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: true,
      }),
    }))
    .flatMap(({ img, size }) =>
      TO_FORMATS.map((format) => ({
        img: toFormat(img.clone(), format),
        size,
        format,
      }))
    )

  await Promise.allSettled(
    out.map(({ img, size, format }) =>
      img
        .toBuffer()
        .then((data) =>
          s3.upload(`${task.podcast}/art-${size}.${format}`, data)
        )
    )
  )
}

function toFormat(img: Sharp, format: Format) {
  switch (format) {
    case 'png':
      return img.png()
    case 'jpeg':
      return img.jpeg({ progressive: true })
    case 'webp':
      return img.webp()
    default:
      throw `unknown format type ${format}`
  }
}
