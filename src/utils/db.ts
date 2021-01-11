import { DDB } from 'sane-ddb'

export default new DDB(
  'echo_podcasts',
  {
    key: 'id',
    id: String,
    title: String,
    author: String,
    description: String,
    feed: String,
    episodeCount: Number,
    artwork: String,
    art: [String],
  },
  process.env.IS_OFFLINE
    ? {
        region: 'localhost',
        endpoint: 'http://localhost:8000',
      }
    : undefined
)
