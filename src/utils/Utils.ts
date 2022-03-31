export class Utils {
  /**
   * Creates a string
   * @param {number} length 
   * @param {boolean} includeLetters 
   * @param {boolean} includeNumbers 
   * @param {boolean} includeSpecial 
   * @returns {string} Generated string
   */
  static createString(length: number, includeLetters: boolean = true, includeNumbers: boolean = true, includeSpecial: boolean = true): string {
    var s = '';
    var chars = '';

    if (includeLetters)
      chars += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers)
      chars += '1234567890';
    if (includeSpecial)
      chars += '!@#$%^&*()_+-=[]\\{}|;\':",./<>?`~`';

    for (var x = 0; x < length; x++)
      s += chars[Math.floor(Math.random() * chars.length)];

    return s;
  }

  /**
   * Check if a string that is input contains any special characters
   * @param {string} input 
   * @returns {boolean} Whether the input has special characters or not
   */
  static hasSpecialChars(input: string): boolean {
    return /[^a-zA-Z0-9.-_]/i.test(input);
  }

  /**
   * Get the epoch time and return it in seconds
   * @returns {number} Time since epoch in seconds
   */
  static epoch(): number {
    return Math.round(Date.now() / 1000);
  }
}