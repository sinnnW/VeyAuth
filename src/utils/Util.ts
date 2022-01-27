export function createString(length: number, includeLetters: boolean = true, includeNumbers: boolean = true, includeSpecial: boolean = true): string {
    var s = '';
    var chars = '';

    if (includeLetters)
        chars += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers)
        chars += '1234567890';
    if (includeSpecial)
        chars += '!@#$%^&*()_+-=[]\\{}|;\':",./<>?`~`';

    for (var x = 0;x < length;x++) {
        s += chars[Math.floor(Math.random() * chars.length)];
    }

    return s;
}