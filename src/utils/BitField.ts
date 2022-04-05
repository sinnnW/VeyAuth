// Based from Disord.js bitfields
import { IBitField } from '../types/interfaces/IBitField';

export class BitField implements IBitField {
  field: number;
  overrides: any[];
  FLAGS: any;

  constructor(flags: any, bitfield: number = 0, overrides: any[]) {
    this.FLAGS = flags;
    this.field = bitfield;
    this.overrides = overrides;
  }

  /**
   * Check if a bitfield has a bit
   * @param {number} bit Bit
   * @returns {boolean} Has bit
   */
  has(bit: number): boolean {
    if ((this.field & bit) === bit)
      return true;

    for (var x = 0; x < this.overrides.length; x++) {
      if ((this.field & this.overrides[x]) === this.overrides[x])
        return true;
    }

    // Fallback
    return false;
  }
}