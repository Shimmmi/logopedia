import OpenAI from "openai";
import { env } from "./env";

export interface SttProvider {
  transcribe(buf: Buffer, filename: string, mime: string): Promise<string>;
}

class OpenAiCompatibleStt implements SttProvider {
  async transcribe(buf: Buffer, filename: string, mime: string) {
    if (!env.aiApiKey) throw Object.assign(new Error("Нет AI_API_KEY для транскрибации"), { status: 503 });
    const client = new OpenAI({ apiKey: env.aiApiKey, baseURL: env.aiBaseUrl });
    const file = new File([new Uint8Array(buf)], filename, { type: mime || "audio/mpeg" });
    const res = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "ru",
    });
    return res.text;
  }
}

class YandexSpeechKitStt implements SttProvider {
  async transcribe(buf: Buffer) {
    const res = await fetch(
      "https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?lang=ru-RU&folderId=" +
        encodeURIComponent(env.yandexSpeechFolder),
      {
        method: "POST",
        headers: {
          Authorization: `Api-Key ${env.yandexSpeechKey}`,
          "Content-Type": "audio/ogg;codecs=opus",
        },
        body: new Uint8Array(buf),
      }
    );
    if (!res.ok) throw new Error("Yandex SpeechKit error");
    const data = await res.json();
    return data.result as string;
  }
}

export function getStt(): SttProvider {
  if (env.yandexSpeechKey) return new YandexSpeechKitStt();
  return new OpenAiCompatibleStt();
}
