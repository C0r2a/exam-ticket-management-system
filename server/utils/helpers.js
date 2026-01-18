const { v4: uuidv4 } = require('uuid');

// Генерация username из ФИО
function generateUsername(fullName, role = 'student', index = 0) {
  const transliterate = (str) => {
    const map = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    return str.toLowerCase().split('').map(char => map[char] || char).join('').replace(/[^a-z0-9]/g, '');
  };
  
  const parts = fullName.trim().split(/\s+/).filter(p => p.length > 0);
  if (parts.length >= 2) {
    const first = transliterate(parts[0]);
    const second = transliterate(parts[1]);
    return `${first}${second.charAt(0)}${index + 1}`;
  } else if (parts.length === 1) {
    return `${transliterate(parts[0])}${index + 1}`;
  } else {
    return `${role}${index + 1}`;
  }
}

// Генерация пароля
function generatePassword(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

module.exports = {
  uuidv4,
  generateUsername,
  generatePassword
};



