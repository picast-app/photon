import { S3 } from 'aws-sdk'

export const s3 = new S3()

export const upload = async (name: string, data: Buffer) =>
  await s3
    .upload({
      Bucket: process.env.BUCKET_NAME,
      Key: name,
      Body: data,
      ACL: 'public-read',
    })
    .promise()
