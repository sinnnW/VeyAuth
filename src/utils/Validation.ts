export function hasSpecialChars(input: string): boolean {
        return /[~`!#$%\^&*+=\-\[\]\\';,\/{}|\\':<>\?\ ]/g.test(input);
}
