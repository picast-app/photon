import download from './utils/download'
import sharp, { Sharp } from 'sharp'
import * as s3 from './utils/s3'
import initDB from '@picast-app/db'
import Vibrant from 'node-vibrant'
import { performance } from 'perf_hooks'

export type Task = {
  podcast: string
  episode?: string
  url: string
}

type Format = 'png' | 'jpeg' | 'webp'

type Output = { format: Format; size: number }
let outputs: Output[] = [
  { format: 'jpeg', size: 512 },
  ...[180, 360, 256, 512, 1024].map((size) => ({
    format: 'webp' as Format,
    size,
  })),
]

const db = initDB(
  process.env.IS_OFFLINE
    ? {
        region: 'localhost',
        endpoint: 'http://localhost:8000',
      }
    : undefined
)

export default async function handleTask(task: Task) {
  const raw = await download(task.url)

  const img = sharp(raw)

  const meta = await img.metadata()
  const maxSize = Math.min(meta.width, meta.height)

  outputs = (maxSize >= Math.max(...outputs.map(({ size }) => size))
    ? outputs
    : outputs.map(({ format, size }) => ({
        format,
        size: Math.min(size, maxSize),
      }))
  ).filter(
    (v, i) =>
      outputs.findIndex(
        ({ size, format }) => size === v.size && format === v.format
      ) === i
  )

  const sizes = Array.from(new Set(outputs.map(({ size }) => size)))

  const out = sizes
    .map((size) => ({
      size,
      img: img.clone().resize(size, size, {
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: true,
      }),
    }))
    .flatMap(({ img, size }) =>
      outputs
        .filter((out) => out.size === size)
        .map(({ format }) => ({
          size,
          format,
          img: toFormat(img.clone(), format),
        }))
    )

  const key = (size: number, format: Format) =>
    `${task.podcast}/art-${size}.${format}`

  let palette: Record<string, string> | undefined = undefined

  const upload = Promise.all(
    out.map(({ img, size, format }) =>
      img.toBuffer().then((data) => {
        console.log(`upload ${key(size, format)} to ${process.env.BUCKET_NAME}`)
        const tasks: Promise<any>[] = []
        tasks.push(s3.upload(key(size, format), data))
        if (size === 512 && format === 'jpeg')
          tasks.push(
            extractColors(data).then((v) => {
              palette = v
            })
          )
        return Promise.all(tasks)
      })
    )
  )

  const covers = out.map(({ size, format }) => key(size, format))
  if (!covers.length) return
  console.log(covers)
  const persist = db.podcasts.update(task.podcast, {
    covers,
    ...(palette && { palette }),
  })

  await Promise.all([upload, persist])
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

async function extractColors(img: Buffer) {
  const t0 = performance.now()
  const palette = await Vibrant.from(img).getPalette()
  console.log(`colors extracted in ${Math.round(performance.now() - t0)}ms`)

  return Object.fromEntries(
    Object.entries(palette).map(([k, v]) => [
      k[0].toLowerCase + k.slice(1),
      v.hex,
    ])
  )
}
