import * as modrinth from './modrinth.js';
import * as curseforge from './curseforge.js';

// เพิ่มแพลตฟอร์มใหม่ในอนาคต (เช่น steam) โดยสร้างไฟล์ adapter ใหม่
// ที่มีฟังก์ชัน getProjectInfo, getLatestVersion, getVersionId, formatVersionMessage
// แล้วมาลงทะเบียนตรงนี้ ไม่ต้องแก้ไฟล์อื่นเลย
export const adapters = {
  modrinth,
  curseforge,
};

export const platformChoices = Object.keys(adapters).map(key => ({
  name: key.charAt(0).toUpperCase() + key.slice(1),
  value: key,
}));
