#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const config = {
  skillsDir: path.join(__dirname, '../../skills'),
  uploadEndpoint: "https://api-ai-coder-jmbos.jomoo.com/api/skill/collect-skill",
  skillListEndpoint: "https://api-ai-coder-jmbos.jomoo.com/api/skill/list-name-all",
  tempDir: path.join(__dirname, '../../../temp'),
  authToken: "trae-skill-upload-token"
};

if (!fs.existsSync(config.tempDir)) {
  fs.mkdirSync(config.tempDir, { recursive: true });
  console.log(`Created temp directory: ${config.tempDir}`);
}

function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  let ip = 'unknown';
  let mac = 'unknown';
  
  for (const iface in interfaces) {
    const addresses = interfaces[iface];
    for (const addr of addresses) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ip = addr.address;
        mac = addr.mac;
        break;
      }
    }
    if (ip !== 'unknown') break;
  }
  
  return { ip, mac };
}

async function getExistingSkills() {
  try {
    const axios = require('axios');
    const headers = {};
    if (config.authToken) {
      headers['Authorization'] = `Bearer ${config.authToken}`;
    }
    console.log('Making request to get existing skills from:', config.skillListEndpoint);
    const response = await axios.get(config.skillListEndpoint, { headers });
    console.log('Successfully retrieved existing skills:', Array.isArray(response.data) ? response.data.length : 0);
    return response.data || [];
  } catch (error) {
    console.error('Error getting existing skills:', error.message);
    return [];
  }
}

function getLocalSkills() {
  try {
    const skills = fs.readdirSync(config.skillsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(skillName => skillName !== 'jomoo-upload-skill');
    console.log(`Found ${skills.length} local skills`);
    return skills;
  } catch (error) {
    console.error('Error reading local skills directory:', error.message);
    return [];
  }
}

function parseSkillNamesFromInput(input) {
  if (!input || typeof input !== 'string') {
    return [];
  }
  
  const localSkills = getLocalSkills();
  
  if (input.includes('上传 all') || input.includes('上传全部')) {
    return localSkills;
  }
  
  const mentionedSkills = [];
  
  for (const skillName of localSkills) {
    if (input.includes(skillName)) {
      mentionedSkills.push(skillName);
    }
  }
  
  const pattern = /上传\s*([a-zA-Z0-9_-]+)/g;
  let match;
  while ((match = pattern.exec(input)) !== null) {
    const skillName = match[1];
    if (!mentionedSkills.includes(skillName)) {
      mentionedSkills.push(skillName);
    }
  }
  
  return mentionedSkills;
}

async function getNewSkills() {
  const existingSkills = await getExistingSkills();
  const localSkills = getLocalSkills();
  
  const newSkills = localSkills.filter(skillName => {
    const skillPath = path.join(config.skillsDir, skillName);
    return !existingSkills.includes(skillName) && 
           fs.existsSync(path.join(skillPath, 'SKILL.md'));
  });
  
  console.log(`Found ${newSkills.length} new skill(s) to potentially upload`);
  return newSkills;
}

async function packageSkill(skillName, skillPath) {
  console.log(`Packaging skill: ${skillName} from ${skillPath}`);
  
  const zipPath = path.join(config.tempDir, `${skillName}.zip`);
  console.log(`Creating zip file at: ${zipPath}`);
  
  try {
    const archiver = require('archiver');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    return new Promise((resolve, reject) => {
      output.on('close', () => {
        console.log(`${skillName} packaged: ${archive.pointer()} bytes`);
        console.log(`Zip file created successfully: ${zipPath}`);
        resolve(zipPath);
      });
      
      archive.on('error', (err) => {
        console.error(`Error packaging ${skillName}:`, err.message);
        reject(err);
      });
      
      output.on('error', (err) => {
        console.error(`Error writing zip file for ${skillName}:`, err.message);
        reject(err);
      });
      
      archive.pipe(output);
      archive.directory(skillPath, false);
      archive.finalize();
    });
  } catch (error) {
    console.error(`Error packaging ${skillName}:`, error.message);
    return null;
  }
}

async function uploadSkill(skillName, zipPath) {
  console.log(`Uploading skill: ${skillName} to ${config.uploadEndpoint}`);
  
  try {
    const axios = require('axios');
    const FormData = require('form-data');
    
    const networkInfo = getNetworkInfo();
    console.log(`Network info - IP: ${networkInfo.ip}, MAC: ${networkInfo.mac}`);
    
    const form = new FormData();
    form.append('file', fs.createReadStream(zipPath));
    form.append('IP', networkInfo.ip);
    form.append('MAC', networkInfo.mac);
    
    const headers = {
      ...form.getHeaders()
    };
    if (config.authToken) {
      headers['Authorization'] = `Bearer ${config.authToken}`;
    }
    
    const response = await axios.post(config.uploadEndpoint, form, { headers });
    
    console.log(`Successfully uploaded ${skillName}: ${response.status}`);
    console.log(`Response data: ${JSON.stringify(response.data)}`);
    
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    return { success: true, message: `✓ 技能 "${skillName}" 上传成功` };
  } catch (error) {
    console.error(`Error uploading ${skillName}:`, error.message);
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    return { success: false, message: `✗ 技能 "${skillName}" 上传失败: ${error.message}` };
  }
}

async function processSkills(skillNames) {
  const results = [];
  
  for (const skillName of skillNames) {
    const skillPath = path.join(config.skillsDir, skillName);
    
    if (!fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
      results.push({ success: false, message: `✗ 技能 "${skillName}" 不存在或缺少 SKILL.md 文件` });
      continue;
    }
    
    const zipPath = await packageSkill(skillName, skillPath);
    if (!zipPath) {
      results.push({ success: false, message: `✗ 技能 "${skillName}" 打包失败` });
      continue;
    }
    
    const result = await uploadSkill(skillName, zipPath);
    results.push(result);
  }
  
  return results;
}

async function makeStatusCheckRequest() {
  try {
    const axios = require('axios');
    const headers = {};
    if (config.authToken) {
      headers['Authorization'] = `Bearer ${config.authToken}`;
    }
    const response = await axios.get(config.skillListEndpoint, { headers });
    console.log(`Status check successful - found ${Array.isArray(response.data) ? response.data.length : 0} skills in repository`);
  } catch (error) {
    console.error('Status check request failed:', error.message);
  }
}

function checkDependencies() {
  console.log('Checking dependencies...');
  
  try {
    require('archiver');
    require('axios');
    require('form-data');
    console.log('✓ All dependencies are installed');
    return true;
  } catch (error) {
    console.error('✗ Missing dependencies:', error.message);
    console.log('Please install dependencies: npm install archiver axios form-data');
    return false;
  }
}

async function executeSkill(input) {
  console.log('========================================');
  console.log('JMBOS Upload Skill Triggered');
  console.log('========================================');
  console.log('Input received:', input);
  console.log('----------------------------------------');
  
  if (!checkDependencies()) {
    const errorMsg = '❌ Error: Missing dependencies. Please run "npm install archiver axios form-data"';
    console.log(errorMsg);
    console.log('========================================');
    return errorMsg;
  }
  
  const mentionedSkills = parseSkillNamesFromInput(input);
  console.log(`解析到用户提到的技能: ${mentionedSkills.length > 0 ? mentionedSkills.join(', ') : '无'}`);
  
  if (mentionedSkills.length > 0) {
    console.log('步骤1: 用户明确指定了要上传的技能');
    const localSkills = getLocalSkills();
    const validSkills = mentionedSkills.filter(s => localSkills.includes(s));
    
    if (validSkills.length === 0) {
      const msg = `未找到指定的技能: ${mentionedSkills.join(', ')}\n可用技能: ${localSkills.join(', ')}`;
      console.log(msg);
      return msg;
    }
    
    const results = await processSkills(validSkills);
    const summary = results.map(r => r.message).join('\n');
    console.log('========================================');
    return summary;
  }
  
  if (input === '确认' || input.includes('确认')) {
    console.log('步骤3b: 用户确认上传，开始上传所有新技能');
    const newSkills = await getNewSkills();
    
    if (newSkills.length === 0) {
      const msg = '当前没有新技能需要上传。';
      console.log(msg);
      return msg;
    }
    
    const results = await processSkills(newSkills);
    const summary = results.map(r => r.message).join('\n');
    console.log('========================================');
    return summary;
  }
  
  if (input === '取消' || input.includes('取消')) {
    const msg = '已取消上传操作。';
    console.log(msg);
    return msg;
  }
  
  console.log('步骤2: 分析对话上下文，检测新技能');
  const newSkills = await getNewSkills();
  
  if (newSkills.length > 0) {
    console.log('步骤3: 检测到新技能，提示用户确认');
    const skillList = newSkills.join('\n  - ');
    const confirmMsg = `检测到以下 ${newSkills.length} 个新技能，是否上传？\n\n技能列表:\n  - ${skillList}\n\n请回复 "确认" 或 "取消"`;
    console.log(confirmMsg);
    return confirmMsg;
  }
  
  console.log('步骤4: 未指定技能且未检测到新技能，提示用户指定');
  const localSkills = getLocalSkills();
  const promptMsg = `请指定要上传的技能名称。\n\n可用技能列表:\n  - ${localSkills.join('\n  - ')}\n\n示例格式:\n  - "上传 my-skill"\n  - "上传 skill-a 和 skill-b"\n  - "上传 all"`;
  console.log(promptMsg);
  return promptMsg;
}

async function main() {
  if (!checkDependencies()) {
    return 'Error: Missing dependencies';
  }
  
  const input = process.argv[2] || 'Skill upload triggered';
  const result = await executeSkill(input);
  console.log('Result:', result);
  return result;
}

if (require.main === module) {
  main();
}

module.exports = {
  executeSkill,
  parseSkillNamesFromInput,
  getNewSkills,
  processSkills
};