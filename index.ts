import * as fs from 'fs'
import axios from 'axios'
import sharp from 'sharp'
import FormData from 'form-data'
// @ts-ignore
import * as magic from 'detect-file-type'

export type Attachment = {
  id: string
  filename: string
  size: number
  url: string
  proxy_url: string
  content_type: string
  content_scan_version: number
}

export type Data = {
  attachments: Attachment[]
}

export type Result = {
  size: number
  contentType: string
  url: string
}

export default class DiscordMediaUploader {
  #CHANNEL_ID: string
  #DISCORD_BOT_TOKEN: string

  constructor(channelID: string, botToken: string) {
    this.#CHANNEL_ID = channelID
    this.#DISCORD_BOT_TOKEN = botToken
  }

  #formatData(data: Data): Result[] {
    return data.attachments.map((attachment) => {
      return {
        size: attachment.size,
        contentType: attachment.content_type,
        url: attachment.url.replace(/(\?\w+\=).*/, ''),
      }
    })
  }

  async #getExtension(imageBuffer: Buffer) {
    return new Promise((resolve, reject) => {
      magic.default.fromBuffer(imageBuffer, (err: any, result: any) => {
        if (err) reject(err.message)
        else resolve(result.ext)
      })
    })
  }

  async #generateThumbnail(imageBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      sharp(imageBuffer)
        .resize({
          withoutEnlargement: true,
          fit: 'inside',
          width: 768,
          height: 768,
        })
        .webp({ quality: 75 })
        .toBuffer((err, buffer) => {
          if (err) reject(err.message)
          else resolve(buffer)
        })
    })
  }

  async #generateFormData(file: string) {
    const formData = new FormData()
    const image = Buffer.from(file, 'base64')
    const thumbnail = await this.#generateThumbnail(image)

    formData.append('media-image', image, {
      filename: 'file.' + (await this.#getExtension(image)),
    })

    formData.append('media-thumbnail', thumbnail, {
      filename: 'file.thumbnail.' + (await this.#getExtension(thumbnail)),
    })

    return formData
  }

  async uploadFormData(formData: FormData) {
    try {
      const response = await axios.post<Data>(
        `https://discord.com/api/v10/channels/${this.#CHANNEL_ID}/messages`,
        formData,
        { headers: { Authorization: `Bot ${this.#DISCORD_BOT_TOKEN}` } }
      )

      return response.data
    } catch (error: any) {
      if (typeof error === 'string') throw new Error(error)

      const statusCode = error.response?.statusCode
      if (!statusCode || statusCode < 400 || statusCode >= 500) {
        throw new Error("Something's wrong with the request!")
      }

      throw new Error(error?.response?.data?.message ?? error.message)
    }
  }

  async uploadImage(base64Image: string) {
    const formData = await this.#generateFormData(base64Image)
    const data = await this.uploadFormData(formData)
    return this.#formatData(data)
  }
}

console.clear()
require('dotenv').config()
const uploader = new DiscordMediaUploader(
  process.env.CHANNEL_ID!,
  process.env.DISCORD_BOT_TOKEN!
)

uploader
  .uploadImage(fs.readFileSync('./img.jpg', 'base64'))
  .then((data) => {
    console.log(data)
  })
  .catch(console.log)
