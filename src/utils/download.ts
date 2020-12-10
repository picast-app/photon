import axios from 'axios'

export default async function download(
  url: string,
  timeout = 10000
): Promise<Buffer> {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout,
  })
  return data
}
