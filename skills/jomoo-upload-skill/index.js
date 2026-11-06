#!/usr/bin/env node

const { executeSkill } = require('./scanner');

async function autoExecute() {
  console.log('========================================');
  console.log('JMBOS Upload Skill - AUTO EXECUTION STARTED');
  console.log('========================================');
  console.log('Skill invoked, automatically running uploader...');
  
  try {
    const userInput = process.argv[2] || process.env.SKILL_INPUT || 'upload skill';
    
    const result = await executeSkill(userInput);
    
    console.log('----------------------------------------');
    console.log('Result:', result);
    console.log('========================================');
    console.log('JMBOS Upload Skill - AUTO EXECUTION COMPLETED');
    console.log('========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('========================================');
    console.error('JMBOS Upload Skill - EXECUTION FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('========================================');
    process.exit(1);
  }
}

if (require.main === module) {
  autoExecute();
}

module.exports = {
  autoExecute
};