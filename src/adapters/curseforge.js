// Adapter สำหรับ CurseForge (ต้องใช้ API key จาก https://console.curseforge.com/)
const API_BASE = 'https://api.curseforge.com/v1';

function headers() {
  return {
    'x-api-key': process.env.CURSEFORGE_API_KEY || '',
    Accept: 'application/json',
  };
}

export async function getProjectInfo(modId) {
  const res = await fetch(`${API_BASE}/mods/${modId}`, { headers: headers() });
  if (!res.ok) throw new Error(`ไม่พบ mod/modpack CurseForge: ${modId} (เช็คว่าใส่ CURSEFORGE_API_KEY แล้วหรือยัง)`);
  const data = await res.json();
  return data.data;
}

export async function getLatestVersion(modId) {
  const info = await getProjectInfo(modId);
  const files = info.latestFiles || [];
  if (!files.length) return null;
  files.sort((a, b) => new Date(b.fileDate) - new Date(a.fileDate));
  return files[0];
}

export function getVersionId(file) {
  return file?.id ?? null;
}

export async function getChangelog(modId, fileId) {
  try {
    const res = await fetch(`${API_BASE}/mods/${modId}/files/${fileId}/changelog`, { headers: headers() });
    if (!res.ok) return 'ไม่สามารถดึง changelog ได้';
    const data = await res.json();
    let text = data.data || 'ไม่มี changelog';
    // CurseForge เก็บ changelog เป็น HTML ตัด tag คร่าวๆ
    text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length > 1400) text = text.slice(0, 1400) + '...';
    return text || 'ไม่มี changelog';
  } catch {
    return 'ไม่สามารถดึง changelog ได้';
  }
}

export async function formatVersionMessage(file, projectInfo) {
  const changelog = await getChangelog(projectInfo.id, file.id);
  
  // ดึง download URL จาก file
  const downloadUrl = file.downloadUrl;
  const downloadFileName = file.fileName;

  return {
    title: `🔄 อัปเดตใหม่: ${file.displayName}`,
    url: `https://www.curseforge.com/minecraft/modpacks/${projectInfo.slug}/files/${file.id}`,
    icon: projectInfo.logo?.url,
    thumbnail: projectInfo.logo?.url,
    downloadUrl,
    downloadFileName,
    fields: [
      { name: 'ไฟล์', value: file.fileName, inline: true },
      { name: 'Game Version', value: (file.gameVersions || []).slice(0, 5).join(', ') || 'N/A', inline: true },
      { name: 'วันที่ปล่อย', value: new Date(file.fileDate).toLocaleString('th-TH'), inline: true },
      { name: 'Changelog', value: changelog },
    ],
  };
}
