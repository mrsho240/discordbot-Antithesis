import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import * as trackCommand from './commands/track.js';

const commands = [trackCommand.data.toJSON()];
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (!process.env.CLIENT_ID) {
      console.error('❌ ไม่พบ CLIENT_ID ใน .env');
      process.exit(1);
    }

    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commands });

    console.log(
      process.env.GUILD_ID
        ? '✅ ลงทะเบียนคำสั่งสำเร็จ (เฉพาะเซิร์ฟเวอร์ทดสอบ ขึ้นทันที)'
        : '✅ ลงทะเบียนคำสั่งสำเร็จ (แบบ global อาจใช้เวลาถึง 1 ชม. กว่าจะขึ้นทุกเซิร์ฟเวอร์)'
    );
  } catch (err) {
    console.error('❌ ลงทะเบียนคำสั่งไม่สำเร็จ:', err);
  }
})();
