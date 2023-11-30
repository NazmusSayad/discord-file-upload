console.clear()
require('dotenv').config()

import * as fs from 'fs'
import axios from 'axios'
import FormData from 'form-data'

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

  async sendFiles(...files: string[]) {
    try {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('file', fs.createReadStream(file))
      })

      const response = await axios.post<Data>(
        `https://discord.com/api/v10/channels/${this.#CHANNEL_ID}/messages`,
        formData,
        { headers: { Authorization: `Bot ${this.#DISCORD_BOT_TOKEN}` } }
      )

      return this.#formatData(response.data)
    } catch (error: any) {
      const statusCode = error.response?.statusCode
      if (!statusCode || statusCode < 400 || statusCode >= 500) {
        throw new Error("Something's wrong with the request!")
      }

      throw new Error(error?.response?.data?.message ?? error.message)
    }
  }

  async sendFile(file: string) {
    return (await this.sendFiles(file))[0]
  }
}

const uploader = new DiscordMediaUploader(
  process.env.CHANNEL_ID!,
  process.env.DISCORD_BOT_TOKEN!
)

uploader.sendFiles('./index.ts').then((data) => {
  console.log(data)
})
