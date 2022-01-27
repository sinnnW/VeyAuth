import { BitField } from '../utils/BitField';
import { FLAGS } from './UserPermissions';

export class UserPermissionsArray {
    array: any;
    flags: any;

    constructor(flags: any, array: any) {
        this.flags = flags;
        this.array = array;
    }

    has(bit: number): boolean {
        for (var x = 0;x < this.array.length;x++) {
            if (new BitField(this.flags, this.array[x], [ FLAGS.ADMIN ]).has(bit)) 
                return true;
        }

        // Fallback
        return false;
    }
}